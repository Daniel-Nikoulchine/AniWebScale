import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { reconcileDeletionTombstones } from './deletion-reconciliation.mjs';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const MAGIC = Buffer.from('AWSBKUP1');

export const ARCHIVE_TABLES = Object.freeze([
  Object.freeze({ schema: 'neon_auth', table: 'user' }),
  Object.freeze({ schema: 'neon_auth', table: 'account' }),
  Object.freeze({ schema: 'neon_auth', table: 'session' }),
  Object.freeze({ schema: 'neon_auth', table: 'verification' }),
  Object.freeze({ schema: 'app', table: 'billing_customers' }),
  Object.freeze({ schema: 'app', table: 'entitlements' }),
  Object.freeze({ schema: 'app', table: 'stripe_events' }),
  Object.freeze({ schema: 'app', table: 'extension_auth_codes' }),
  Object.freeze({ schema: 'app', table: 'extension_sessions' }),
  Object.freeze({ schema: 'app', table: 'auth_rate_limits' }),
  Object.freeze({ schema: 'app', table: 'deletion_tombstones' }),
]);

// These records are deliberately present in backups for auditability, but must
// never become valid again after a restore. Restoring one of them could revive a
// logged-in browser, an extension bearer token, an authorization code, or a
// stale throttling window.
export const DISCARD_ON_RESTORE_TABLES = Object.freeze(new Set([
  'neon_auth.session',
  'neon_auth.verification',
  'app.extension_auth_codes',
  'app.extension_sessions',
  'app.auth_rate_limits',
]));

function tableKey({ schema, table }) {
  return `${schema}.${table}`;
}

function quoted(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe SQL identifier ${identifier}.`);
  return `"${identifier}"`;
}

export function decodeArchiveKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes.');
  return key;
}

export async function collectDatabaseArchive(client, now = () => new Date()) {
  const tables = {};
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const target of ARCHIVE_TABLES) {
      const columns = await client.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
            AND is_generated = 'NEVER'
            AND identity_generation IS NULL
          ORDER BY ordinal_position`,
        [target.schema, target.table],
      );
      if (columns.rows.length === 0) {
        throw new Error(`Required table ${tableKey(target)} does not exist or has no restorable columns.`);
      }
      const names = columns.rows.map(row => row.column_name);
      const projection = names.map(quoted).join(', ');
      const rows = await client.query(
        `SELECT ${projection} FROM ${quoted(target.schema)}.${quoted(target.table)} ORDER BY 1`,
      );
      tables[tableKey(target)] = { columns: names, rows: rows.rows };
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
  return {
    format: 'aniwebscale-postgres-backup',
    version: 2,
    createdAt: now().toISOString(),
    tables,
  };
}

export function validateDatabaseArchive(document) {
  if (document?.format !== 'aniwebscale-postgres-backup' || document.version !== 2) {
    throw new Error('Backup format or version is unsupported for restoration.');
  }
  if (!Number.isFinite(Date.parse(document.createdAt))) throw new Error('Backup creation time is invalid.');
  for (const target of ARCHIVE_TABLES) {
    const table = document.tables?.[tableKey(target)];
    if (!Array.isArray(table?.columns) || table.columns.length === 0 || !Array.isArray(table.rows)) {
      throw new Error(`Backup is missing ${tableKey(target)}.`);
    }
    if (new Set(table.columns).size !== table.columns.length
      || table.columns.some(column => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column))) {
      throw new Error(`Backup has invalid columns for ${tableKey(target)}.`);
    }
    if (table.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error(`Backup has invalid rows for ${tableKey(target)}.`);
    }
  }
  return document;
}

export async function encryptDatabaseArchive(document, key) {
  const validated = validateDatabaseArchive(document);
  const compressed = await gzipAsync(Buffer.from(JSON.stringify(validated), 'utf8'), { level: 9 });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export async function decryptDatabaseArchive(payload, key) {
  if (payload.length < 37 || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Backup header is invalid.');
  }
  const iv = payload.subarray(8, 20);
  const tag = payload.subarray(20, 36);
  const encrypted = payload.subarray(36);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  const compressed = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return validateDatabaseArchive(JSON.parse((await gunzipAsync(compressed)).toString('utf8')));
}

async function assertTargetColumns(client, target, archivedColumns) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [target.schema, target.table],
  );
  const actual = new Set(result.rows.map(row => row.column_name));
  const missing = archivedColumns.filter(column => !actual.has(column));
  if (missing.length > 0) {
    throw new Error(`Restore target ${tableKey(target)} is missing columns: ${missing.join(', ')}.`);
  }
}

export async function restoreDatabaseArchive(client, document) {
  const archive = validateDatabaseArchive(document);
  const restoredRows = {};
  const discardedTransientRows = {};
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('aniwebscale-database-restore'))`);
    for (const target of ARCHIVE_TABLES) {
      await assertTargetColumns(client, target, archive.tables[tableKey(target)].columns);
    }
    for (const target of [...ARCHIVE_TABLES].reverse()) {
      await client.query(`DELETE FROM ${quoted(target.schema)}.${quoted(target.table)}`);
    }
    for (const target of ARCHIVE_TABLES) {
      const table = archive.tables[tableKey(target)];
      if (DISCARD_ON_RESTORE_TABLES.has(tableKey(target))) {
        restoredRows[tableKey(target)] = 0;
        discardedTransientRows[tableKey(target)] = table.rows.length;
        continue;
      }
      const columns = table.columns.map(quoted).join(', ');
      for (const row of table.rows) {
        const values = table.columns.map(column => row[column]);
        const parameters = values.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${quoted(target.schema)}.${quoted(target.table)} (${columns}) VALUES (${parameters})`,
          values,
        );
      }
      restoredRows[tableKey(target)] = table.rows.length;
    }

    const reconciled = await reconcileDeletionTombstones((sql, values) => client.query(sql, values));
    await client.query('COMMIT');
    return {
      restoredRows,
      discardedTransientRows,
      reconciled,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

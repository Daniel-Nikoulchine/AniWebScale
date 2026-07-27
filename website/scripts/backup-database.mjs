import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import {
  collectDatabaseArchive,
  decodeArchiveKey,
  encryptDatabaseArchive,
} from '../lib/database-archive.mjs';
import { recordOperationalResult } from '../lib/operational-status.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  throw new Error('DATABASE_URL is missing or invalid.');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-encrypted-backup',
  connectionTimeoutMillis: 10_000,
});
await client.connect();
const startedAt = Date.now();
let archive;
try {
  archive = await collectDatabaseArchive(client);
  const payload = await encryptDatabaseArchive(
    archive,
    decodeArchiveKey(process.env.BACKUP_ENCRYPTION_KEY_B64),
  );
  const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || '../backups');
  await mkdir(outputDirectory, { recursive: true });
  const filename = `aniwebscale-${archive.createdAt.replace(/[:.]/g, '-')}.json.gz.aes`;
  const outputPath = resolve(outputDirectory, filename);
  await writeFile(outputPath, payload, { mode: 0o600, flag: 'wx' });
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'database_backup',
    success: true,
    durationMs: Date.now() - startedAt,
  });
  const rowCount = Object.values(archive.tables).reduce((sum, table) => sum + table.rows.length, 0);
  console.log(`BACKUP OK ${outputPath} (${rowCount} rows, AES-256-GCM, format v2)`);
} catch (error) {
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'database_backup',
    success: false,
    durationMs: Date.now() - startedAt,
  }).catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

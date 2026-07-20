import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATION_FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function loadMigrations(directory) {
  const names = (await readdir(directory))
    .filter(name => MIGRATION_FILE.test(name))
    .sort((left, right) => left.localeCompare(right));
  if (names.length === 0) throw new Error(`No migration files found in ${directory}.`);
  const versions = new Set();
  const migrations = [];
  for (const name of names) {
    const version = MIGRATION_FILE.exec(name)[1];
    if (versions.has(version)) throw new Error(`Duplicate migration version ${version}.`);
    versions.add(version);
    const sql = await readFile(join(directory, name), 'utf8');
    migrations.push({ version, name, sql, checksum: checksum(sql) });
  }
  return migrations;
}

export async function applyMigrations(client, migrations) {
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('aniwebscale-schema-migrations'))`);
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT schema_migrations_checksum_length CHECK (length(checksum) = 64)
      )
    `);
    const existing = await client.query(
      'SELECT version, name, checksum FROM app.schema_migrations ORDER BY version',
    );
    const appliedByVersion = new Map(existing.rows.map(row => [row.version, row]));
    const applied = [];
    const skipped = [];
    for (const migration of migrations) {
      const previous = appliedByVersion.get(migration.version);
      if (previous) {
        if (previous.checksum !== migration.checksum || previous.name !== migration.name) {
          throw new Error(`Applied migration ${migration.version} does not match ${migration.name}.`);
        }
        skipped.push(migration.name);
        continue;
      }
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO app.schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      applied.push(migration.name);
    }
    await client.query('COMMIT');
    return { applied, skipped };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

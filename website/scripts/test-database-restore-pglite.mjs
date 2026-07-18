import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import {
  collectDatabaseArchive,
  decryptDatabaseArchive,
  encryptDatabaseArchive,
  restoreDatabaseArchive,
} from '../lib/database-archive.mjs';
import { applyMigrations, loadMigrations } from '../lib/migrations.mjs';
import {
  assertRestoredFixture,
  bootstrapRestoreFixture,
  seedRestoreFixture,
} from '../test/fixtures/database-restore-fixture.mjs';

function pgliteClient(database) {
  return {
    async query(sql, parameters) {
      const statement = String(sql).trim();
      if (parameters || /^(SELECT|WITH)\b/i.test(statement)) {
        const result = await database.query(statement, parameters);
        return { ...result, rowCount: result.affectedRows ?? result.rows?.length ?? 0 };
      }
      const results = await database.exec(statement);
      const result = results.at(-1) || { rows: [], affectedRows: 0 };
      return { ...result, rowCount: result.affectedRows ?? result.rows?.length ?? 0 };
    },
  };
}

const sourceDatabase = new PGlite();
const targetDatabase = new PGlite();
const source = pgliteClient(sourceDatabase);
const target = pgliteClient(targetDatabase);
const migrations = await loadMigrations(fileURLToPath(new URL('../migrations/', import.meta.url)));
const privacyKey = Buffer.alloc(32, 7);
const backupKey = Buffer.alloc(32, 8);

try {
  await sourceDatabase.waitReady;
  await targetDatabase.waitReady;
  await bootstrapRestoreFixture(source, migrations, applyMigrations);
  await bootstrapRestoreFixture(target, migrations, applyMigrations);
  await seedRestoreFixture(source, privacyKey);
  const archive = await collectDatabaseArchive(source, () => new Date('2026-07-17T10:00:00.000Z'));
  const encrypted = await encryptDatabaseArchive(archive, backupKey);
  const result = await restoreDatabaseArchive(
    target,
    await decryptDatabaseArchive(encrypted, backupKey),
  );
  await assertRestoredFixture(target, result, migrations.length);
  console.log('PASS embedded PostgreSQL migration, encrypted backup and isolated restore');
} finally {
  await sourceDatabase.close();
  await targetDatabase.close();
}

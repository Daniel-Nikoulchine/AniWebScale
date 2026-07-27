import { fileURLToPath } from 'node:url';
import pg from 'pg';
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

if (process.env.CONFIRM_DATABASE_INTEGRATION_TEST !== 'yes') {
  throw new Error('Set CONFIRM_DATABASE_INTEGRATION_TEST=yes for the disposable local PostgreSQL test databases.');
}
const adminUrl = new URL(process.env.POSTGRES_ADMIN_URL || '');
if (!['127.0.0.1', 'localhost', '::1'].includes(adminUrl.hostname)) {
  throw new Error('The database integration test only runs against loopback PostgreSQL.');
}

const SOURCE_DATABASE = 'aniwebscale_source_test';
const RESTORE_DATABASE = 'aniwebscale_restore_test';
const privacyKey = Buffer.alloc(32, 7);
const backupKey = Buffer.alloc(32, 8);
const migrations = await loadMigrations(fileURLToPath(new URL('../migrations/', import.meta.url)));

function connectionUrl(database) {
  const value = new URL(adminUrl);
  value.pathname = `/${database}`;
  return value.toString();
}

async function withAdmin(operation) {
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const current = await admin.query('SELECT current_database() AS name');
    if (current.rows[0]?.name !== 'postgres') {
      throw new Error('POSTGRES_ADMIN_URL must target the postgres maintenance database.');
    }
    return await operation(admin);
  } finally {
    await admin.end();
  }
}

async function recreateDatabases() {
  await withAdmin(async admin => {
    await admin.query(`DROP DATABASE IF EXISTS ${SOURCE_DATABASE} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${RESTORE_DATABASE} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SOURCE_DATABASE}`);
    await admin.query(`CREATE DATABASE ${RESTORE_DATABASE}`);
  });
}

async function dropDatabases() {
  await withAdmin(async admin => {
    await admin.query(`DROP DATABASE IF EXISTS ${SOURCE_DATABASE} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${RESTORE_DATABASE} WITH (FORCE)`);
  });
}

await recreateDatabases();
let source;
let target;
try {
  source = new pg.Client({ connectionString: connectionUrl(SOURCE_DATABASE) });
  target = new pg.Client({ connectionString: connectionUrl(RESTORE_DATABASE) });
  await source.connect();
  await target.connect();
  await bootstrapRestoreFixture(source, migrations, applyMigrations);
  await bootstrapRestoreFixture(target, migrations, applyMigrations);
  await seedRestoreFixture(source, privacyKey);

  const collected = await collectDatabaseArchive(source, () => new Date('2026-07-17T10:00:00.000Z'));
  const encrypted = await encryptDatabaseArchive(collected, backupKey);
  const archive = await decryptDatabaseArchive(encrypted, backupKey);
  const result = await restoreDatabaseArchive(target, archive);
  await assertRestoredFixture(target, result, migrations.length);
  console.log('PASS versioned migration plus encrypted isolated database restore');
} finally {
  await source?.end().catch(() => undefined);
  await target?.end().catch(() => undefined);
  await dropDatabases();
}

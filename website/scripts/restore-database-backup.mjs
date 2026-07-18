import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  decodeArchiveKey,
  decryptDatabaseArchive,
  restoreDatabaseArchive,
} from '../lib/database-archive.mjs';
import { applyMigrations, loadMigrations } from '../lib/migrations.mjs';

if (process.env.CONFIRM_ISOLATED_RESTORE !== 'yes') {
  throw new Error('Set CONFIRM_ISOLATED_RESTORE=yes only for a reviewed isolated restore database.');
}
if (!/^postgres(?:ql)?:\/\//.test(process.env.RESTORE_DATABASE_URL || '')) {
  throw new Error('RESTORE_DATABASE_URL is missing or invalid.');
}
if (!process.argv[2]) throw new Error('Pass the encrypted backup path as the first argument.');

function databaseIdentity(value) {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  return url.toString();
}

if (process.env.DATABASE_URL
  && databaseIdentity(process.env.RESTORE_DATABASE_URL) === databaseIdentity(process.env.DATABASE_URL)) {
  throw new Error('RESTORE_DATABASE_URL must not point to the configured production/source database.');
}

const archive = await decryptDatabaseArchive(
  await readFile(resolve(process.argv[2])),
  decodeArchiveKey(process.env.BACKUP_ENCRYPTION_KEY_B64),
);
const client = new pg.Client({
  connectionString: process.env.RESTORE_DATABASE_URL,
  application_name: 'aniwebscale-isolated-restore',
  connectionTimeoutMillis: 10_000,
});
await client.connect();
try {
  const migrations = await loadMigrations(fileURLToPath(new URL('../migrations/', import.meta.url)));
  await applyMigrations(client, migrations);
  const result = await restoreDatabaseArchive(client, archive);
  console.log(JSON.stringify({ event: 'database_restore_complete', ...result }));
} finally {
  await client.end();
}

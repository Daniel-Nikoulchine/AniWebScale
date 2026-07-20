import 'dotenv/config';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { loadMigrations, applyMigrations } from '../lib/migrations.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  throw new Error('DATABASE_URL is missing or invalid.');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-schema-migration',
  connectionTimeoutMillis: 10_000,
});
const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

await client.connect();
try {
  const result = await applyMigrations(client, await loadMigrations(migrationDirectory));
  console.log(JSON.stringify({ event: 'database_migration_complete', ...result }));
} finally {
  await client.end();
}

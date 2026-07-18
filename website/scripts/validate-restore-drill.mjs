import 'dotenv/config';
import pg from 'pg';
import { ARCHIVE_TABLES, DISCARD_ON_RESTORE_TABLES } from '../lib/database-archive.mjs';
import { EXPECTED_SCHEMA_VERSION } from '../lib/schema-version.mjs';

if (process.env.CONFIRM_ISOLATED_RESTORE !== 'yes') {
  throw new Error('Set CONFIRM_ISOLATED_RESTORE=yes only for the dedicated restore-drill database.');
}
if (!/^postgres(?:ql)?:\/\//.test(process.env.RESTORE_DATABASE_URL || '')) {
  throw new Error('RESTORE_DATABASE_URL is missing or invalid.');
}
const client = new pg.Client({
  connectionString: process.env.RESTORE_DATABASE_URL,
  application_name: 'aniwebscale-restore-drill-validation',
  connectionTimeoutMillis: 10_000,
});
await client.connect();
try {
  const migration = await client.query('SELECT max(version) AS version FROM app.schema_migrations');
  if (migration.rows[0]?.version !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`Restore target schema is ${migration.rows[0]?.version || 'missing'}; expected ${EXPECTED_SCHEMA_VERSION}.`);
  }
  const counts = {};
  for (const target of ARCHIVE_TABLES) {
    const key = `${target.schema}.${target.table}`;
    const result = await client.query(`SELECT count(*)::integer AS count FROM "${target.schema}"."${target.table}"`);
    counts[key] = result.rows[0].count;
    if (DISCARD_ON_RESTORE_TABLES.has(key) && counts[key] !== 0) {
      throw new Error(`Transient credentials survived the restore drill in ${key}.`);
    }
  }
  console.log(JSON.stringify({ event: 'database_restore_drill_validated', schema: EXPECTED_SCHEMA_VERSION, counts }));
} finally {
  await client.end();
}

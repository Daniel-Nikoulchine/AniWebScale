import 'dotenv/config';
import pg from 'pg';
import { reconcileDeletionTombstones } from '../lib/deletion-reconciliation.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  throw new Error('DATABASE_URL is missing or invalid.');
}
if (process.env.CONFIRM_ISOLATED_RESTORE !== 'yes') {
  throw new Error('Set CONFIRM_ISOLATED_RESTORE=yes only for the reviewed isolated restore database.');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-deletion-reconciliation',
  connectionTimeoutMillis: 10_000,
});

await client.connect();
try {
  await client.query('BEGIN');
  const reconciled = await reconcileDeletionTombstones((sql, values) => client.query(sql, values));
  await client.query('COMMIT');
  console.log(JSON.stringify({ event: 'deletion_reconciliation_complete', reconciled }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

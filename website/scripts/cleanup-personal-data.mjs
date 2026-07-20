import 'dotenv/config';
import pg from 'pg';
import { cleanExpiredPersonalData } from '../lib/data-retention.mjs';
import { recordOperationalResult } from '../lib/operational-status.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  throw new Error('DATABASE_URL is missing or invalid.');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-data-retention',
  connectionTimeoutMillis: 10_000,
});

await client.connect();
const startedAt = Date.now();
try {
  await client.query('BEGIN');
  const result = await cleanExpiredPersonalData((sql, values) => client.query(sql, values));
  await client.query('COMMIT');
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'data_retention',
    success: true,
    durationMs: Date.now() - startedAt,
  });
  console.log(JSON.stringify({ event: 'data_retention_complete', deletedRows: result }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'data_retention',
    success: false,
    durationMs: Date.now() - startedAt,
  }).catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

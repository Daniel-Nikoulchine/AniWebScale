import 'dotenv/config';
import pg from 'pg';
import { recordOperationalResult } from '../lib/operational-status.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL is missing or invalid.');
if (!['true', 'false'].includes(process.env.RESTORE_DRILL_SUCCESS || '')) {
  throw new Error('RESTORE_DRILL_SUCCESS must be true or false.');
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-restore-drill-result',
  connectionTimeoutMillis: 10_000,
});
await client.connect();
try {
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'database_restore_drill',
    success: process.env.RESTORE_DRILL_SUCCESS === 'true',
    durationMs: Number(process.env.RESTORE_DRILL_DURATION_MS || 0),
  });
} finally {
  await client.end();
}

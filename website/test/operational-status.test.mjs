import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createOperationalStatusService,
  recordOperationalResult,
} from '../lib/operational-status.mjs';

describe('privacy-safe operational status', () => {
  it('records only aggregate job state', async () => {
    const calls = [];
    await recordOperationalResult(async (sql, values) => calls.push({ sql, values }), {
      jobName: 'database_backup',
      success: true,
      durationMs: 125.4,
    });
    assert.deepEqual(calls[0].values, ['database_backup', true, 125]);
    assert.doesNotMatch(JSON.stringify(calls), /email|user_id|token/);
  });

  it('marks stale or repeatedly failing jobs unhealthy', async () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z');
    const database = {
      configured: true,
      async query(sql) {
        if (sql.includes('max(version)')) return { rows: [{ current_version: '0009' }] };
        if (sql.includes('FROM app.service_metrics')) return { rows: [] };
        return {
          rows: [
            {
              job_name: 'data_retention',
              last_success_at: '2026-07-17T10:00:00.000Z',
              last_failure_at: null,
              last_duration_ms: 120,
              consecutive_failures: 0,
            },
            {
              job_name: 'database_backup',
              last_success_at: '2026-07-14T10:00:00.000Z',
              last_failure_at: '2026-07-17T10:00:00.000Z',
              last_duration_ms: 300,
              consecutive_failures: 2,
            },
            {
              job_name: 'database_backup_secondary',
              last_success_at: '2026-07-17T09:30:00.000Z',
              last_failure_at: null,
              last_duration_ms: 200,
              consecutive_failures: 0,
            },
            {
              job_name: 'database_restore_drill',
              last_success_at: '2026-07-13T09:30:00.000Z',
              last_failure_at: null,
              last_duration_ms: 800,
              consecutive_failures: 0,
            },
          ],
        };
      },
    };
    const status = await createOperationalStatusService({ database, now: () => now }).status();
    assert.equal(status.ok, false);
    assert.equal(status.jobs.data_retention.healthy, true);
    assert.equal(status.jobs.database_backup.healthy, false);
    assert.equal(status.schema.healthy, true);
  });

  it('fails the gate when deployment code is ahead of the database schema', async () => {
    const database = {
      configured: true,
      async query(sql) {
        if (sql.includes('max(version)')) return { rows: [{ current_version: '0007' }] };
        if (sql.includes('FROM app.service_metrics')) return { rows: [] };
        return {
          rows: ['data_retention', 'database_backup', 'database_backup_secondary', 'database_restore_drill'].map(job_name => ({
            job_name,
            last_success_at: '2026-07-17T11:00:00.000Z',
            consecutive_failures: 0,
          })),
        };
      },
    };
    const status = await createOperationalStatusService({
      database,
      now: () => Date.parse('2026-07-17T12:00:00.000Z'),
    }).status();
    assert.equal(status.ok, false);
    assert.deepEqual(status.schema, {
      healthy: false,
      currentVersion: '0007',
      expectedVersion: '0009',
    });
  });
});

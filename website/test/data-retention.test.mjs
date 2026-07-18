import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanExpiredPersonalData } from '../lib/data-retention.mjs';

describe('personal-data retention cleanup', () => {
  it('deletes every documented class in one caller-controlled transaction', async () => {
    const statements = [];
    const result = await cleanExpiredPersonalData(async sql => {
      statements.push(sql);
      return { rowCount: 1 };
    });

    assert.deepEqual(result, {
      authRateLimits: 1,
      extensionAuthCodes: 1,
      extensionSessions: 1,
      authVerifications: 1,
      authSessions: 1,
      stripeEvents: 1,
      deletionTombstones: 1,
      serviceMetrics: 1,
    });
    assert.ok(statements.some(sql => sql.includes('app.auth_rate_limits')));
    assert.ok(statements.some(sql => sql.includes('app.extension_sessions')));
    assert.ok(statements.some(sql => sql.includes('neon_auth.verification')));
    assert.ok(statements.some(sql => sql.includes('neon_auth.session')));
    assert.ok(statements.some(sql => sql.includes('app.stripe_events')));
    assert.ok(statements.some(sql => sql.includes('app.deletion_tombstones')));
    assert.ok(statements.some(sql => sql.includes('app.service_metrics')));
  });
});

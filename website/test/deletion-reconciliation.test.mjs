import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reconcileDeletionTombstones } from '../lib/deletion-reconciliation.mjs';

describe('restored deletion reconciliation', () => {
  it('removes every restorable identity link before deleting tombstoned users', async () => {
    const statements = [];
    const result = await reconcileDeletionTombstones(async sql => {
      statements.push(sql);
      return { rowCount: 1 };
    });
    assert.equal(result.users, 1);
    assert.equal(result.verifications, 1);
    assert.equal(result.rateLimits, 1);
    assert.ok(statements.some(sql => sql.includes('neon_auth.verification')));
    assert.ok(statements.some(sql => sql.includes('neon_auth.session')));
    assert.ok(statements.some(sql => sql.includes('neon_auth.account')));
    assert.ok(statements.some(sql => sql.includes('app.extension_sessions')));
    assert.ok(statements.some(sql => sql.includes('app.auth_rate_limits')));
    assert.match(statements.at(-1), /DELETE FROM neon_auth\."user"/);
  });
});

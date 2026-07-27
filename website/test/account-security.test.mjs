import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAccountSecurityService } from '../lib/account-security.mjs';

function databaseFixture() {
  const calls = [];
  return {
    configured: true,
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.includes('FROM neon_auth."user"')) {
        return { rows: [{ created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }] };
      }
      if (sql.includes('FROM neon_auth.session')) {
        return {
          rows: [
            { id: '11111111-1111-4111-8111-111111111111', expires_at: '2026-08-01T00:00:00.000Z' },
            { id: '22222222-2222-4222-8222-222222222222', expires_at: '2026-07-25T00:00:00.000Z' },
          ],
        };
      }
      if (sql.includes('FROM app.extension_sessions')) {
        return {
          rows: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              device_name: 'Living room PC',
              created_at: '2026-07-01T10:00:00.000Z',
              last_used_at: '2026-07-17T10:00:00.000Z',
              expires_at: '2026-08-17T10:00:00.000Z',
            },
            {
              id: '44444444-4444-4444-8444-444444444444',
              device_name: null,
              created_at: '2026-07-02T10:00:00.000Z',
              last_used_at: '2026-07-16T10:00:00.000Z',
              expires_at: '2026-08-16T10:00:00.000Z',
            },
            {
              id: '55555555-5555-4555-8555-555555555555',
              device_name: 'Laptop',
              created_at: '2026-07-03T10:00:00.000Z',
              last_used_at: '2026-07-15T10:00:00.000Z',
              expires_at: '2026-08-15T10:00:00.000Z',
            },
          ],
        };
      }
      return { rows: [], rowCount: sql.startsWith('UPDATE') || sql.startsWith('DELETE') ? 1 : 0 };
    },
    async transaction(operation) {
      return operation(async sql => {
        calls.push(sql);
        return { rowCount: sql.startsWith('UPDATE') ? 3 : 2, rows: [] };
      });
    },
  };
}

describe('account security controls', () => {
  it('summarizes browser and extension sessions without exposing tokens', async () => {
    const service = createAccountSecurityService({ database: databaseFixture() });
    const summary = await service.summary({ id: 'user-1' });
    assert.equal(summary.browserSessions.active, 2);
    assert.equal(summary.extensionSessions.active, 3);
    assert.equal(summary.extensionSessions.items[0].deviceName, 'Living room PC');
    assert.equal(summary.extensionSessions.items[1].deviceName, 'AniWebScale extension');
    assert.doesNotMatch(JSON.stringify(summary), /token/i);
  });

  it('revokes one user-owned session without exposing its credential', async () => {
    const database = databaseFixture();
    const service = createAccountSecurityService({ database });
    const result = await service.revokeSession(
      { id: 'user-1' },
      { kind: 'extension', id: '33333333-3333-4333-8333-333333333333' },
    );
    assert.deepEqual(result, { success: true, revoked: true });
    assert.ok(database.calls.some(sql => sql.includes('session_id = $2::uuid')));
  });

  it('revokes extension and browser sessions in one transaction', async () => {
    const database = databaseFixture();
    const service = createAccountSecurityService({ database });
    const result = await service.revokeAllSessions({ id: 'user-1' });
    assert.deepEqual(result, {
      success: true,
      revokedBrowserSessions: 2,
      revokedExtensionSessions: 3,
    });
    assert.ok(database.calls.some(sql => sql.includes('UPDATE app.extension_sessions')));
    assert.ok(database.calls.some(sql => sql.includes('DELETE FROM neon_auth.session')));
  });
});

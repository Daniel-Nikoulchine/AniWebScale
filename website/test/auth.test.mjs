import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthenticationError, requireActiveAccount } from '../lib/auth.mjs';

describe('authenticated account availability', () => {
  it('uses the current database identity for protected account operations', async () => {
    const database = {
      configured: true,
      async query(_sql, values) {
        return { rows: [{ id: values[0], email: 'current@example.com' }] };
      },
    };
    assert.deepEqual(
      await requireActiveAccount(database, { id: 'user-id', email: 'stale@example.com' }),
      { id: 'user-id', email: 'current@example.com' },
    );
  });

  it('rejects a still-valid token after its user was deleted', async () => {
    const database = {
      configured: true,
      async query() { return { rows: [] }; },
    };
    await assert.rejects(
      requireActiveAccount(database, { id: 'deleted-user-id', email: 'deleted@example.com' }),
      error => error instanceof AuthenticationError && /unavailable/i.test(error.message),
    );
  });
});

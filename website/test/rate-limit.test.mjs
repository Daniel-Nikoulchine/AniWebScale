import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RateLimitError,
  createApiRateLimitService,
  normalizeRequestAddress,
  requestAddress,
} from '../lib/rate-limit.mjs';

function databaseFixture() {
  const attempts = new Map();
  return {
    configured: true,
    attempts,
    async transaction(operation) {
      return operation(async (sql, values = []) => {
        if (!sql.includes('INSERT INTO app.auth_rate_limits')) return { rows: [], rowCount: 0 };
        const next = (attempts.get(values[0]) || 0) + 1;
        attempts.set(values[0], next);
        return { rows: [{ attempts: next }], rowCount: 1 };
      });
    },
  };
}

describe('sensitive API rate limiting', () => {
  it('applies pseudonymous per-IP and per-user limits', async () => {
    const database = databaseFixture();
    const service = createApiRateLimitService({
      database,
      identifierHashKey: Buffer.alloc(32, 7),
      addressForRequest: candidate => requestAddress(candidate, 'cf-connecting-ip'),
    });
    const request = new Request('https://example.test/api/account/delete', {
      headers: { 'cf-connecting-ip': '203.0.113.42' },
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.enforce(request, 'account_delete', 'user-123');
    }
    await assert.rejects(
      () => service.enforce(request, 'account_delete', 'user-123'),
      error => error instanceof RateLimitError && error.status === 429 && error.code === 'RATE_LIMITED',
    );
    assert.equal(database.attempts.size, 2);
    for (const key of database.attempts.keys()) {
      assert.doesNotMatch(key, /203\.0\.113\.42|user-123/);
    }
  });

  it('fails closed when its privacy key is unavailable', async () => {
    const service = createApiRateLimitService({ database: databaseFixture() });
    await assert.rejects(
      () => service.enforce(new Request('https://example.test'), 'account_export', 'user-123'),
      error => error instanceof RateLimitError && error.status === 503,
    );
  });

  it('uses only an explicitly trusted, valid address source', () => {
    const request = new Request('https://example.test', {
      headers: {
        'cf-connecting-ip': '203.0.113.42',
        'x-forwarded-for': '198.51.100.10, 192.0.2.1',
      },
    });
    assert.equal(requestAddress(request), 'unknown');
    assert.equal(requestAddress(request, 'cf-connecting-ip'), '203.0.113.42');
    assert.equal(requestAddress(request, 'x-forwarded-for'), 'unknown');
    assert.equal(normalizeRequestAddress('not-an-ip'), 'unknown');
    assert.equal(normalizeRequestAddress('2001:db8::1'), '2001:db8::1');
  });
});

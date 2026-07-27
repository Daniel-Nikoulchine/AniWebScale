import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AccountSignupError,
  createAccountSignupService,
} from '../lib/account-signup.mjs';
import { requestAddress } from '../lib/rate-limit.mjs';

const IDENTIFIER_HASH_KEY = Buffer.alloc(32, 7);

function fakeDatabase() {
  const users = new Map();
  const accounts = [];
  const limits = new Map();
  const query = async (sql, values = []) => {
    if (sql.startsWith('DELETE FROM app.auth_rate_limits')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO app.auth_rate_limits')) {
      const attempts = (limits.get(values[0]) || 0) + 1;
      limits.set(values[0], attempts);
      return { rows: [{ attempts }] };
    }
    if (sql.includes('INSERT INTO neon_auth."user"')) {
      if (users.has(values[1])) return { rows: [], rowCount: 0 };
      const id = '00000000-0000-4000-8000-000000000001';
      users.set(values[1], { id, name: values[0] });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO neon_auth.account')) {
      if (values[2]) accounts.push({ userId: values[0], password: values[1] });
      return { rows: [], rowCount: values[2] ? 1 : 0 };
    }
    throw new Error(`Unexpected SQL in fake database: ${sql}`);
  };
  return {
    configured: true,
    users,
    accounts,
    query,
    transaction: callback => callback(query),
  };
}

describe('website account signup', () => {
  it('returns the same generic response for new and existing addresses', async () => {
    const database = fakeDatabase();
    const deliveries = [];
    const service = createAccountSignupService({
      database,
      authUrl: 'https://auth.example.test/auth',
      publicUrl: 'https://app.example.test',
      identifierHashKey: IDENTIFIER_HASH_KEY,
      addressForRequest: candidate => requestAddress(candidate, 'cf-connecting-ip'),
      sendVerificationOtp: async (_authUrl, _publicUrl, email) => {
        deliveries.push(email);
      },
    });
    const request = new Request('https://app.example.test/api/auth/sign-up', {
      headers: { 'cf-connecting-ip': '203.0.113.8' },
    });

    const first = await service.signUp(request, {
      email: 'User@Example.com',
      password: 'correct horse battery staple',
      name: 'User',
    });
    const second = await service.signUp(request, {
      email: 'user@example.com',
      password: 'another valid password',
      name: 'Different',
    });

    assert.deepEqual(first, second);
    assert.equal(database.users.size, 1);
    assert.equal(database.accounts.length, 1);
    assert.match(database.accounts[0].password, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(database.accounts[0].password.includes('correct horse'), false);
    assert.deepEqual(deliveries, ['user@example.com', 'user@example.com']);
  });

  it('rate-limits repeated attempts without disclosing account existence', async () => {
    const service = createAccountSignupService({
      database: fakeDatabase(),
      authUrl: 'https://auth.example.test/auth',
      publicUrl: 'https://app.example.test',
      identifierHashKey: IDENTIFIER_HASH_KEY,
      addressForRequest: candidate => requestAddress(candidate, 'cf-connecting-ip'),
      sendVerificationOtp: async () => undefined,
    });
    const request = new Request('https://app.example.test/api/auth/sign-up', {
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await service.signUp(request, {
        email: 'limited@example.com',
        password: 'correct horse battery staple',
      });
    }
    await assert.rejects(
      service.signUp(request, {
        email: 'limited@example.com',
        password: 'correct horse battery staple',
      }),
      error => error instanceof AccountSignupError
        && error.status === 429
        && error.code === 'RATE_LIMITED',
    );
  });
});

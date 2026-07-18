import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AccountDeletionError,
  createAccountDeletionService,
} from '../lib/account-deletion.mjs';
import { hashPassword } from '../lib/password.mjs';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = 'user@example.com';
const PASSWORD = 'correct horse battery staple';
const PASSWORD_HASH = await hashPassword(PASSWORD);
const IDENTIFIER_HASH_KEY = Buffer.alloc(32, 7);

function fakeDatabase({ customerId = null } = {}) {
  const calls = [];
  let userExists = true;
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT u.email, credential.password')) {
      return {
        rows: userExists ? [{
          email: EMAIL,
          password: PASSWORD_HASH,
          stripe_customer_id: customerId,
        }] : [],
      };
    }
    if (sql.includes('SELECT email') && sql.includes('FOR UPDATE')) {
      return { rows: userExists ? [{ email: EMAIL }] : [] };
    }
    if (sql.includes('DELETE FROM neon_auth."user"')) userExists = false;
    return { rows: [], rowCount: 1 };
  };
  return {
    configured: true,
    calls,
    get userExists() { return userExists; },
    query,
    transaction: callback => callback(query),
  };
}

function deletionBody(overrides = {}) {
  return {
    confirmationEmail: EMAIL,
    password: PASSWORD,
    acknowledged: true,
    ...overrides,
  };
}

describe('website account deletion', () => {
  it('requires the matching email and current password', async () => {
    const database = fakeDatabase();
    const service = createAccountDeletionService({ database, identifierHashKey: IDENTIFIER_HASH_KEY });

    await assert.rejects(
      service.deleteAccount({ id: USER_ID }, deletionBody({ confirmationEmail: 'other@example.com' })),
      error => error instanceof AccountDeletionError
        && error.status === 400
        && error.code === 'EMAIL_CONFIRMATION_MISMATCH',
    );
    await assert.rejects(
      service.deleteAccount({ id: USER_ID }, deletionBody({ password: 'incorrect password' })),
      error => error instanceof AccountDeletionError
        && error.status === 403
        && error.code === 'PASSWORD_INCORRECT',
    );
    assert.equal(database.userExists, true);
    assert.equal(database.calls.some(call => call.sql.includes('DELETE FROM neon_auth."user"')), false);
  });

  it('deletes auth, verification, license and extension data', async () => {
    const database = fakeDatabase();
    const service = createAccountDeletionService({ database, identifierHashKey: IDENTIFIER_HASH_KEY });

    assert.deepEqual(
      await service.deleteAccount({ id: USER_ID }, deletionBody()),
      { success: true },
    );
    assert.equal(database.userExists, false);
    assert.ok(database.calls.some(call => call.sql.includes('DELETE FROM app.extension_auth_codes')));
    assert.ok(database.calls.some(call => call.sql.includes('DELETE FROM app.extension_sessions')));
    assert.ok(database.calls.some(call => call.sql.includes('DELETE FROM neon_auth.verification')));
    assert.ok(database.calls.some(call => call.sql.includes('DELETE FROM app.auth_rate_limits')));
    assert.ok(database.calls.some(call => call.sql.includes('INSERT INTO app.deletion_tombstones')));
  });

  it('deletes the Stripe customer before removing a billed account', async () => {
    const database = fakeDatabase({ customerId: 'cus_delete_me' });
    const stripeCalls = [];
    const stripe = {
      customers: {
        async retrieve(id) {
          stripeCalls.push(['retrieve', id]);
          return { id, deleted: false };
        },
        async del(id) {
          stripeCalls.push(['delete', id]);
          return { id, deleted: true };
        },
      },
    };
    const service = createAccountDeletionService({ database, stripe, identifierHashKey: IDENTIFIER_HASH_KEY });

    await service.deleteAccount({ id: USER_ID }, deletionBody());

    assert.deepEqual(stripeCalls, [
      ['retrieve', 'cus_delete_me'],
      ['delete', 'cus_delete_me'],
    ]);
    assert.equal(database.userExists, false);
  });

  it('keeps a billed account when Stripe is unavailable', async () => {
    const database = fakeDatabase({ customerId: 'cus_keep_me' });
    const service = createAccountDeletionService({
      database,
      stripe: null,
      identifierHashKey: IDENTIFIER_HASH_KEY,
    });

    await assert.rejects(
      service.deleteAccount({ id: USER_ID }, deletionBody()),
      error => error instanceof AccountDeletionError
        && error.status === 503
        && error.code === 'BILLING_UNAVAILABLE',
    );
    assert.equal(database.userExists, true);
  });

  it('keeps a billed account when Stripe rejects customer deletion', async () => {
    const database = fakeDatabase({ customerId: 'cus_keep_me' });
    const stripe = {
      customers: {
        async retrieve() { return { id: 'cus_keep_me', deleted: false }; },
        async del() { throw new Error('Stripe unavailable'); },
      },
    };
    const service = createAccountDeletionService({ database, stripe, identifierHashKey: IDENTIFIER_HASH_KEY });

    await assert.rejects(
      service.deleteAccount({ id: USER_ID }, deletionBody()),
      error => error instanceof AccountDeletionError
        && error.status === 502
        && error.code === 'BILLING_DELETION_FAILED',
    );
    assert.equal(database.userExists, true);
  });
});

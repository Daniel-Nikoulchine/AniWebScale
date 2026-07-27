import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AccountExportError,
  createAccountExportService,
} from '../lib/account-export.mjs';

const USER_ID = '00000000-0000-4000-8000-000000000001';

function databaseWithRows() {
  const calls = [];
  return {
    configured: true,
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('FROM neon_auth."user"')) {
        return { rows: [{ id: USER_ID, email: 'user@example.com', name: 'User' }] };
      }
      if (sql.includes('FROM app.billing_customers')) {
        return { rows: [{ stripe_customer_id: 'cus_123' }] };
      }
      if (sql.includes('FROM app.entitlements')) {
        return { rows: [{ plan: 'pro', status: 'active' }] };
      }
      if (sql.includes('FROM app.extension_sessions')) {
        return { rows: [{ device_name: 'Living room PC', created_at: '2026-07-17T00:00:00.000Z' }] };
      }
      return { rows: [] };
    },
  };
}

describe('website account export', () => {
  it('exports account data without credentials or token hashes', async () => {
    const database = databaseWithRows();
    const service = createAccountExportService({ database });
    const result = await service.exportAccount({ id: USER_ID });

    assert.equal(result.account.email, 'user@example.com');
    assert.equal(result.billing.stripe_customer_id, 'cus_123');
    assert.equal(result.entitlement.plan, 'pro');
    assert.equal(result.extensionSessions.length, 1);
    assert.equal(result.extensionSessions[0].device_name, 'Living room PC');
    assert.equal(JSON.stringify(result).includes('"password":'), false);
    assert.equal(JSON.stringify(result).includes('"token_hash":'), false);
    assert.ok(database.calls.every(call => call.values[0] === USER_ID));
  });

  it('fails closed when the database is unavailable', async () => {
    const service = createAccountExportService({ database: { configured: false } });
    await assert.rejects(
      service.exportAccount({ id: USER_ID }),
      error => error instanceof AccountExportError && error.status === 503,
    );
  });
});

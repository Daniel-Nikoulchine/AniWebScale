import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processStripeEvent } from '../lib/entitlements.mjs';

function fakeDatabase({ duplicate = false } = {}) {
  const calls = [];
  return {
    calls,
    async transaction(callback) {
      return callback(async (sql, values = []) => {
        calls.push({ sql, values });
        if (sql.includes('INSERT INTO app.stripe_events')) {
          return { rowCount: duplicate ? 0 : 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      });
    },
  };
}

const priceIds = {
  pro_monthly: 'price_monthly',
  pro_yearly: 'price_yearly',
  lifetime: 'price_lifetime',
};

describe('Stripe entitlement fulfillment', () => {
  it('grants Lifetime only from a paid signed Checkout event', async () => {
    const database = fakeDatabase();
    const result = await processStripeEvent(database, {
      id: 'evt_lifetime',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_lifetime',
          client_reference_id: '3e48666a-ff39-4b8f-843d-b0cf72c490cb',
          customer: 'cus_test',
          payment_intent: 'pi_test',
          payment_status: 'paid',
          metadata: { plan: 'lifetime' },
        },
      },
    }, priceIds);
    assert.deepEqual(result, { duplicate: false, handled: true });
    const grant = database.calls.find(call => call.sql.includes('lifetime_purchase_id'));
    assert.ok(grant);
    assert.deepEqual(grant.values, [
      '3e48666a-ff39-4b8f-843d-b0cf72c490cb',
      'cus_test',
      'cs_test_lifetime',
      'price_lifetime',
      'pi_test',
    ]);
  });

  it('does not process the same Stripe event twice', async () => {
    const database = fakeDatabase({ duplicate: true });
    const result = await processStripeEvent(database, {
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_duplicate' } },
    }, priceIds);
    assert.deepEqual(result, { duplicate: true, handled: true });
    assert.equal(database.calls.length, 1);
  });

  it('does not grant an unpaid Lifetime checkout', async () => {
    const database = fakeDatabase();
    const result = await processStripeEvent(database, {
      id: 'evt_unpaid',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_unpaid',
          client_reference_id: '3e48666a-ff39-4b8f-843d-b0cf72c490cb',
          payment_status: 'unpaid',
          metadata: { plan: 'lifetime' },
        },
      },
    }, priceIds);
    assert.deepEqual(result, { duplicate: false, handled: false });
    assert.equal(database.calls.some(call => call.sql.includes('lifetime_purchase_id')), false);
  });
});

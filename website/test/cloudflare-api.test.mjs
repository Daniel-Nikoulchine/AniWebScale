import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

function call(path, { env = {}, method = 'GET', headers, body } = {}) {
  return onRequest({
    env,
    request: new Request(`https://aniwebscale.pages.dev${path}`, {
      method,
      headers,
      body,
    }),
  });
}

describe('Cloudflare Pages Functions API', () => {
  it('reports fail-closed readiness without secrets', async () => {
    const response = await call('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.deepEqual(await response.json(), {
      ok: true,
      runtime: 'cloudflare-pages-functions',
      stripeConfigured: false,
      databaseConfigured: false,
      hyperdriveConfigured: false,
      authConfigured: false,
      webhookConfigured: false,
      licenseKeyConfigured: false,
      portalConfigured: false,
      fulfillmentReady: false,
    });
  });

  it('exposes public prices but no secret values', async () => {
    const response = await call('/api/config', {
      env: {
        PUBLIC_PRICE_MONTHLY: '4.99',
        PUBLIC_PRICE_YEARLY: '41.99',
        PUBLIC_PRICE_LIFETIME: '59.99',
        STRIPE_SECRET_KEY: 'not-a-key',
      },
    });
    const config = await response.json();
    assert.equal(config.prices.monthly, '4.99');
    assert.equal(config.prices.yearly, '41.99');
    assert.equal(config.prices.lifetime, '59.99');
    assert.equal(JSON.stringify(config).includes('STRIPE_SECRET_KEY'), false);
    assert.equal(config.checkout.proMonthly, false);
  });

  it('allows the site origin and browser extensions through CORS', async () => {
    const site = await call('/api/health', {
      env: { PUBLIC_URL: 'https://aniwebscale.pages.dev' },
      method: 'OPTIONS',
      headers: { Origin: 'https://aniwebscale.pages.dev' },
    });
    assert.equal(site.status, 204);
    assert.equal(site.headers.get('access-control-allow-origin'), 'https://aniwebscale.pages.dev');

    const extension = await call('/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'chrome-extension://abcdefghijklmnop' },
    });
    assert.equal(extension.headers.get('access-control-allow-origin'), 'chrome-extension://abcdefghijklmnop');
  });

  it('rejects unknown plans before authentication or payment calls', async () => {
    const response = await call('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'supporter' }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Unknown pricing plan.' });
  });

  it('returns JSON errors for unknown API routes', async () => {
    const response = await call('/api/not-found');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'API route not found.' });
  });
});

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
  it('keeps public health output minimal', async () => {
    const response = await call('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.deepEqual(await response.json(), { ok: true });
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
    assert.equal(config.legal.version, '2026-07-17');
    assert.equal(config.legal.reviewApproved, false);
    assert.equal(config.legal.dataProtectionApproved, false);
    assert.equal(config.auth.signupReady, false);
    assert.ok(response.headers.get('x-request-id'));
  });

  it('limits normal CORS to the site and scopes extension CORS to capability endpoints', async () => {
    const site = await call('/api/health', {
      env: { PUBLIC_URL: 'https://aniwebscale.pages.dev' },
      method: 'OPTIONS',
      headers: { Origin: 'https://aniwebscale.pages.dev' },
    });
    assert.equal(site.status, 204);
    assert.equal(site.headers.get('access-control-allow-origin'), 'https://aniwebscale.pages.dev');
    assert.match(site.headers.get('access-control-allow-methods'), /DELETE/);

    const extension = await call('/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'chrome-extension://abcdefghijklmnop' },
    });
    assert.equal(extension.headers.get('access-control-allow-origin'), null);

    const capability = await call('/api/extension-auth/token', {
      method: 'OPTIONS',
      headers: { Origin: 'moz-extension://00000000-0000-4000-8000-000000000000' },
    });
    assert.equal(
      capability.headers.get('access-control-allow-origin'),
      'moz-extension://00000000-0000-4000-8000-000000000000',
    );
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

  it('keeps account registration fail-closed without database configuration', async () => {
    const response = await call('/api/auth/sign-up', {
      env: {
        DATA_PROTECTION_APPROVED: 'true',
        PRIVACY_HASH_KEY_B64: Buffer.alloc(32, 7).toString('base64'),
        PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS: '1',
        PRIVACY_NEON_PITR_RETENTION_DAYS: '7',
        PRIVACY_AUTH_SESSION_RETENTION_DAYS: '30',
        PRIVACY_VENDOR_REVIEW_DATE: '2026-07-17',
        PRIVACY_TRANSFER_SAFEGUARDS: 'Reviewed SCC/adequacy register',
      },
      method: 'POST',
      headers: {
        Origin: 'https://aniwebscale.pages.dev',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'correct horse battery staple',
      }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'SIGNUP_UNAVAILABLE');
  });

  it('protects the account deletion endpoint with authentication', async () => {
    const response = await call('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationEmail: 'user@example.com',
        password: 'correct horse battery staple',
        acknowledged: true,
      }),
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTHENTICATION_REQUIRED');
  });

  it('protects the account export endpoint with authentication', async () => {
    const response = await call('/api/account/export');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTHENTICATION_REQUIRED');
  });

  it('protects account security and session revocation with authentication', async () => {
    const summary = await call('/api/account/security');
    assert.equal(summary.status, 401);
    assert.equal((await summary.json()).code, 'AUTHENTICATION_REQUIRED');

    const revoke = await call('/api/account/revoke-sessions', { method: 'POST' });
    assert.equal(revoke.status, 401);
    assert.equal((await revoke.json()).code, 'AUTHENTICATION_REQUIRED');

    const revokeOne = await call('/api/account/revoke-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'extension',
        id: '33333333-3333-4333-8333-333333333333',
      }),
    });
    assert.equal(revokeOne.status, 401);
    assert.equal((await revokeOne.json()).code, 'AUTHENTICATION_REQUIRED');
  });

  it('returns JSON errors for unknown API routes', async () => {
    const response = await call('/api/not-found');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'API route not found.' });
  });

  it('keeps aggregate operational status behind a dedicated monitor token', async () => {
    const unconfigured = await call('/api/operations/status');
    assert.equal(unconfigured.status, 503);

    const unauthorized = await call('/api/operations/status', {
      env: { OPERATIONS_MONITOR_TOKEN: 'o'.repeat(40) },
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await call('/api/operations/status', {
      env: { OPERATIONS_MONITOR_TOKEN: 'o'.repeat(40) },
      headers: { Authorization: `Bearer ${'o'.repeat(40)}` },
    });
    assert.equal(authorized.status, 503);
    const body = await authorized.json();
    assert.equal(body.readiness.runtime, 'cloudflare-pages-functions');
    assert.equal(body.readiness.databaseConfigured, false);
    assert.equal(body.readiness.fulfillmentReady, false);
  });
});

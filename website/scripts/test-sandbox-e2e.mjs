import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import Stripe from 'stripe';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const { Pool } = pg;
const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const authUrl = (process.env.NEON_AUTH_URL || '').replace(/\/$/, '');

if (process.env.E2E_ALLOW_SANDBOX_MUTATION !== '1') {
  throw new Error('Set E2E_ALLOW_SANDBOX_MUTATION=1 to run the sandbox mutation test.');
}
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('The sandbox E2E test refuses to run without a Stripe test secret.');
}
if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(publicUrl)) {
  throw new Error('The sandbox E2E test only targets a local website server.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
  appInfo: { name: 'AniWebScale Sandbox E2E', version: '1.0.0' },
});
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const suffix = randomUUID().replaceAll('-', '');
const email = `aniwebscale-e2e-${suffix}@example.com`;
const password = `E2e!${randomUUID()}Aa9`;
const eventId = `evt_aniwebscale_e2e_${suffix}`;
let userId = '';
let customerId = '';
let sessionId = '';
const sessionIds = [];
const cookies = new Map();

function rememberCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const entry of values) {
    const pair = entry.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function authRequest(path, init = {}) {
  const response = await fetch(`${authUrl}/${path}`, {
    ...init,
    headers: {
      Origin: publicUrl,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      ...init.headers,
    },
  });
  rememberCookies(response);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${body.message || body.error || 'unknown error'}`);
  return body;
}

async function websiteRequest(path, token, init = {}) {
  const response = await fetch(`${publicUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${body.error || 'unknown error'}`);
  return body;
}

async function cleanup() {
  await Promise.all(sessionIds.map(id => stripe.checkout.sessions.expire(id).catch(() => undefined)));
  if (customerId) await stripe.customers.del(customerId).catch(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 1_500));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) await client.query('DELETE FROM neon_auth."user" WHERE id = $1', [userId]);
    await client.query(
      `DELETE FROM app.stripe_events
        WHERE event_id = $1
           OR stripe_object_id = ANY($2::text[])`,
      [eventId, [...sessionIds, customerId].filter(Boolean)],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

try {
  const signup = await authRequest('sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'AniWebScale E2E' }),
  });
  userId = signup.user?.id || signup.data?.user?.id || '';
  if (!userId) throw new Error('Neon Auth signup returned no user ID.');

  const tokenBody = await authRequest('token');
  const authToken = tokenBody.token || tokenBody.data?.token;
  if (!authToken) throw new Error('Neon Auth returned no access token.');

  const checkoutPlans = [
    { plan: 'pro_monthly', mode: 'subscription', priceId: process.env.STRIPE_PRICE_PRO_MONTHLY },
    { plan: 'pro_yearly', mode: 'subscription', priceId: process.env.STRIPE_PRICE_PRO_YEARLY },
    { plan: 'lifetime', mode: 'payment', priceId: process.env.STRIPE_PRICE_LIFETIME },
  ];
  let session;
  for (const expected of checkoutPlans) {
    const checkout = await websiteRequest('/api/create-checkout-session', authToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `e2e_${expected.plan}_${suffix}`,
      },
      body: JSON.stringify({ plan: expected.plan }),
    });
    let checkoutSessionId = checkout.url?.match(/cs_test_[A-Za-z0-9]+/)?.[0] || '';
    if (!checkoutSessionId) {
      const sessions = await stripe.checkout.sessions.list({ limit: 20 });
      checkoutSessionId = sessions.data.find(item =>
        item.client_reference_id === userId && item.metadata?.plan === expected.plan)?.id || '';
    }
    if (!checkoutSessionId) throw new Error(`Stripe Checkout returned no ${expected.plan} test session ID.`);
    sessionIds.push(checkoutSessionId);

    const created = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const lineItems = await stripe.checkout.sessions.listLineItems(checkoutSessionId, { limit: 1 });
    const actualPriceId = typeof lineItems.data[0]?.price === 'string'
      ? lineItems.data[0].price
      : lineItems.data[0]?.price?.id;
    if (created.client_reference_id !== userId || created.metadata?.plan !== expected.plan) {
      throw new Error(`Stripe ${expected.plan} Checkout metadata is not linked to the Neon account.`);
    }
    if (created.mode !== expected.mode || actualPriceId !== expected.priceId) {
      throw new Error(`Stripe ${expected.plan} Checkout uses the wrong mode or Price ID.`);
    }
    customerId = typeof created.customer === 'string' ? created.customer : created.customer?.id || '';
    if (expected.plan === 'lifetime') {
      sessionId = checkoutSessionId;
      session = created;
    }
  }
  if (!session || !sessionId) throw new Error('The Lifetime Checkout session was not retained for fulfillment.');

  const event = {
    id: eventId,
    object: 'event',
    api_version: '2026-02-25.clover',
    created: Math.floor(Date.now() / 1000),
    data: { object: { ...session, payment_status: 'paid' } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'checkout.session.completed',
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const webhook = await fetch(`${publicUrl}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
    body: payload,
  });
  if (!webhook.ok) throw new Error(`Signed webhook failed with ${webhook.status}.`);

  const license = await websiteRequest('/api/license', authToken);
  if (license.plan !== 'lifetime' || typeof license.token !== 'string') {
    throw new Error('The paid webhook did not produce a Lifetime Pro license.');
  }
  const jwks = createRemoteJWKSet(new URL(`${publicUrl}/api/license/jwks.json`));
  await jwtVerify(license.token, jwks, {
    algorithms: ['ES256'],
    issuer: publicUrl,
    audience: 'aniwebscale-extension',
    subject: userId,
  });

  const portal = await websiteRequest('/api/create-portal-session', authToken, {
    method: 'POST',
    headers: { 'Idempotency-Key': `portal_${suffix}` },
  });
  if (!portal.url?.startsWith('https://billing.stripe.com/')) {
    throw new Error('Stripe Customer Portal returned no hosted session URL.');
  }

  console.log('PASS Neon signup and access token');
  console.log('PASS authenticated Monthly, Yearly and Lifetime Stripe Checkout sessions');
  console.log('PASS signed Stripe webhook and Neon entitlement');
  console.log('PASS signed Lifetime Pro license verification');
  console.log('PASS authenticated Stripe Customer Portal session');
} finally {
  await cleanup();
  await pool.end();
  console.log('PASS sandbox test data cleanup');
}

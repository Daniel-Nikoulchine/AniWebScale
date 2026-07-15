import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { AuthenticationError, createAuthVerifier } from './lib/auth.mjs';
import { createDatabase } from './lib/database.mjs';
import {
  isAuthUrl,
  isDatabaseUrl,
  isPkcs8PrivateKey,
  isStripePortalConfigurationId,
  isStripePriceId,
  isStripeSecretKey,
  isStripeWebhookSecret,
} from './lib/config.mjs';
import {
  entitlementForUser,
  isPaidEntitlement,
  processStripeEvent,
} from './lib/entitlements.mjs';
import { createLicenseService } from './lib/license.mjs';

const root = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const lucideFontRoot = resolve(fileURLToPath(new URL('./node_modules/lucide-static/font/', import.meta.url)));
const port = Number.parseInt(process.env.PORT || '4242', 10);
const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const paidEntitlementsEnabled = process.env.PAID_ENTITLEMENTS_ENABLED === 'true';
const stripeSecretConfigured = isStripeSecretKey(process.env.STRIPE_SECRET_KEY);
const webhookSecretConfigured = isStripeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET);
const databaseUrlConfigured = isDatabaseUrl(process.env.DATABASE_URL);
const authUrlConfigured = isAuthUrl(process.env.NEON_AUTH_URL);
const licenseKeyConfigured = isPkcs8PrivateKey(process.env.LICENSE_PRIVATE_KEY_PKCS8_B64);
const portalConfigurationId = isStripePortalConfigurationId(process.env.STRIPE_PORTAL_CONFIGURATION_ID)
  ? process.env.STRIPE_PORTAL_CONFIGURATION_ID
  : '';
const database = createDatabase(databaseUrlConfigured ? process.env.DATABASE_URL : '');
const authVerifier = createAuthVerifier(authUrlConfigured ? process.env.NEON_AUTH_URL : '');
const licenseService = createLicenseService({ issuer: publicUrl });
const stripe = stripeSecretConfigured
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      appInfo: { name: 'AniWebScale Website', version: '1.0.0' },
    })
  : null;

const plans = Object.freeze({
  pro_monthly: {
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    mode: 'subscription',
    label: 'AniWebScale Pro — monthly',
  },
  pro_yearly: {
    priceId: process.env.STRIPE_PRICE_PRO_YEARLY,
    mode: 'subscription',
    label: 'AniWebScale Pro — yearly',
  },
  lifetime: {
    priceId: process.env.STRIPE_PRICE_LIFETIME,
    mode: 'payment',
    label: 'AniWebScale Pro — lifetime',
  },
});

const priceIds = Object.freeze(Object.fromEntries(
  Object.entries(plans).map(([key, value]) => [key, value.priceId || '']),
));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const vendorFiles = Object.freeze({
  '/vendor/lucide/lucide.css': join(lucideFontRoot, 'lucide.css'),
  '/vendor/lucide/lucide.woff2': join(lucideFontRoot, 'lucide.woff2'),
});

const authOrigin = authVerifier.authBaseUrl ? new URL(authVerifier.authBaseUrl).origin : '';
const connectSources = ["'self'", authOrigin].filter(Boolean).join(' ');
const securityHeaders = {
  'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src ${connectSources}; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; upgrade-insecure-requests`,
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
};

function corsHeaders(request) {
  const origin = request.headers.origin || '';
  if (origin === publicUrl
    || origin.startsWith('chrome-extension://')
    || origin.startsWith('moz-extension://')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
  }
  return {};
}

function sendJson(request, response, statusCode, value) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

async function readBody(request, limit = 32_768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function fulfillmentReady() {
  return Boolean(
    paidEntitlementsEnabled
    && stripe
    && database.configured
    && authVerifier.configured
    && webhookSecretConfigured
    && licenseKeyConfigured
    && portalConfigurationId,
  );
}

function checkoutReady(plan) {
  return Boolean(
    fulfillmentReady()
    && isStripePriceId(plans[plan]?.priceId),
  );
}

function idempotencyKey(request, namespace) {
  const supplied = request.headers['idempotency-key'];
  const value = typeof supplied === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(supplied)
    ? supplied
    : randomUUID();
  return `aniwebscale:${namespace}:${value}`;
}

async function ensureStripeCustomer(user) {
  const existing = await database.query(
    'SELECT stripe_customer_id FROM app.billing_customers WHERE user_id = $1',
    [user.id],
  );
  if (existing.rows[0]?.stripe_customer_id) return existing.rows[0].stripe_customer_id;

  const customer = await stripe.customers.create({
    ...(user.email ? { email: user.email } : {}),
    metadata: { neon_user_id: user.id, product: 'aniwebscale' },
  }, { idempotencyKey: `aniwebscale:customer:${user.id}` });

  const stored = await database.query(
    `INSERT INTO app.billing_customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = now()
     RETURNING stripe_customer_id`,
    [user.id, customer.id],
  );
  return stored.rows[0].stripe_customer_id;
}

async function parseJsonBody(request, response) {
  try {
    return JSON.parse((await readBody(request)).toString('utf8') || '{}');
  } catch (error) {
    sendJson(request, response, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
      error: 'Invalid request body.',
    });
    return null;
  }
}

async function createCheckout(request, response) {
  const body = await parseJsonBody(request, response);
  if (!body) return;
  const plan = typeof body.plan === 'string' ? body.plan : '';
  const selected = plans[plan];
  if (!selected) return sendJson(request, response, 400, { error: 'Unknown pricing plan.' });
  if (!checkoutReady(plan)) {
    return sendJson(request, response, 503, {
      error: 'Checkout is not configured for paid Pro fulfillment yet.',
    });
  }

  try {
    const user = await authVerifier.authenticate(request);
    const entitlement = await entitlementForUser(database.query, user.id);
    if (isPaidEntitlement(entitlement)) {
      return sendJson(request, response, 409, {
        error: 'This account already has Pro. Use Manage billing for subscription changes.',
      });
    }

    const customer = await ensureStripeCustomer(user);
    const metadata = { plan, product: 'aniwebscale', user_id: user.id };
    const parameters = {
      mode: selected.mode,
      customer,
      client_reference_id: user.id,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${publicUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl}/account?checkout=canceled`,
      metadata,
      subscription_data: selected.mode === 'subscription' ? { metadata } : undefined,
      payment_intent_data: selected.mode === 'payment' ? { metadata } : undefined,
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
    };
    const session = await stripe.checkout.sessions.create(parameters, {
      idempotencyKey: idempotencyKey(request, `checkout:${user.id}:${plan}`),
    });
    return sendJson(request, response, 200, { url: session.url });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendJson(request, response, 401, { error: error.message });
    }
    console.error('Stripe Checkout session failed:', error.message);
    return sendJson(request, response, 502, {
      error: 'Stripe could not start checkout. Please try again.',
    });
  }
}

async function createPortalSession(request, response) {
  if (!fulfillmentReady()) {
    return sendJson(request, response, 503, { error: 'Billing management is not configured yet.' });
  }
  try {
    const user = await authVerifier.authenticate(request);
    const customer = await database.query(
      'SELECT stripe_customer_id FROM app.billing_customers WHERE user_id = $1',
      [user.id],
    );
    if (!customer.rows[0]?.stripe_customer_id) {
      return sendJson(request, response, 404, { error: 'This account has no Stripe billing profile.' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.rows[0].stripe_customer_id,
      ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
      return_url: `${publicUrl}/account`,
    });
    return sendJson(request, response, 200, { url: session.url });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendJson(request, response, 401, { error: error.message });
    }
    console.error('Stripe Portal session failed:', error.message);
    return sendJson(request, response, 502, { error: 'Billing management could not be opened.' });
  }
}

async function retrieveCheckout(request, url, response) {
  const sessionId = url.searchParams.get('session_id') || '';
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    return sendJson(request, response, 400, { error: 'Invalid Checkout Session.' });
  }
  if (!stripe || !authVerifier.configured) {
    return sendJson(request, response, 503, { error: 'Stripe is not configured.' });
  }
  try {
    const user = await authVerifier.authenticate(request);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== user.id && session.metadata?.user_id !== user.id) {
      return sendJson(request, response, 403, { error: 'Checkout Session does not belong to this account.' });
    }
    return sendJson(request, response, 200, {
      status: session.status,
      paymentStatus: session.payment_status,
      plan: session.metadata?.plan || null,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendJson(request, response, 401, { error: error.message });
    }
    console.error('Stripe Checkout lookup failed:', error.message);
    return sendJson(request, response, 404, { error: 'Checkout Session not found.' });
  }
}

async function issueLicense(request, response) {
  if (!database.configured || !authVerifier.configured) {
    return sendJson(request, response, 503, { error: 'Account licensing is not configured.' });
  }
  try {
    const user = await authVerifier.authenticate(request);
    const entitlement = await entitlementForUser(database.query, user.id);
    const license = await licenseService.sign({
      userId: user.id,
      plan: entitlement.plan,
      status: entitlement.status,
      currentPeriodEnd: entitlement.current_period_end,
    });
    return sendJson(request, response, 200, {
      ...license,
      cancelAtPeriodEnd: entitlement.cancel_at_period_end,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendJson(request, response, 401, { error: error.message });
    }
    console.error('License issuance failed:', error.message);
    return sendJson(request, response, 503, { error: 'License status is temporarily unavailable.' });
  }
}

async function handleWebhook(request, response) {
  if (!stripe || !database.configured || !process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(request, response, 503, { error: 'Stripe webhook is not configured.' });
  }
  let payload;
  try {
    payload = await readBody(request, 1_048_576);
  } catch {
    return sendJson(request, response, 413, { error: 'Webhook payload too large.' });
  }
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      request.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    const result = await processStripeEvent(database, event, priceIds);
    console.info(JSON.stringify({ event: event.type, eventId: event.id, ...result }));
    return sendJson(request, response, 200, { received: true, duplicate: result.duplicate });
  } catch (error) {
    console.warn('Rejected Stripe webhook:', error.message);
    return sendJson(request, response, 400, { error: 'Invalid webhook or entitlement update.' });
  }
}

function publicConfig() {
  return {
    prices: {
      monthly: process.env.PUBLIC_PRICE_MONTHLY || '4.99',
      yearly: process.env.PUBLIC_PRICE_YEARLY || '41.99',
      lifetime: process.env.PUBLIC_PRICE_LIFETIME || '59.99',
      currency: process.env.PUBLIC_CURRENCY || '$',
    },
    links: {
      chrome: process.env.CHROME_STORE_URL || '',
      firefox: process.env.FIREFOX_ADDONS_URL || '',
      github: process.env.GITHUB_REPO_URL || '',
      portal: '/account',
    },
    auth: {
      url: authVerifier.authBaseUrl,
      ready: authVerifier.configured,
    },
    legal: {
      name: process.env.LEGAL_NAME || 'Korrespont GbR',
      email: process.env.LEGAL_EMAIL || 'support@korrespont.com',
      address: process.env.LEGAL_ADDRESS || 'Paterkamp 11a, 59348 Lüdinghausen, Deutschland',
      representatives: process.env.LEGAL_REPRESENTATIVES || 'Karim Mahmoudi and Daniel Nikoulchine',
      vatId: process.env.LEGAL_VAT_ID || '',
    },
    checkout: {
      proMonthly: checkoutReady('pro_monthly'),
      proYearly: checkoutReady('pro_yearly'),
      lifetime: checkoutReady('lifetime'),
    },
  };
}

async function serveStatic(url, response) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const normalized = normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = resolve(join(root, normalized));
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403, securityHeaders);
    return response.end('Forbidden');
  }
  try {
    let servedPath = filePath;
    let info;
    try {
      info = await stat(servedPath);
    } catch (error) {
      if (extname(servedPath)) throw error;
      servedPath = `${servedPath}.html`;
      info = await stat(servedPath);
    }
    if (!info.isFile()) throw new Error('NOT_FILE');
    const content = await readFile(servedPath);
    const cache = extname(servedPath) === '.html' ? 'no-cache' : 'public, max-age=3600';
    response.writeHead(200, {
      ...securityHeaders,
      'Content-Type': mimeTypes[extname(servedPath)] || 'application/octet-stream',
      'Cache-Control': cache,
    });
    response.end(content);
  } catch {
    const fallback = await readFile(join(root, '404.html'));
    response.writeHead(404, {
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(fallback);
  }
}

async function serveVendor(pathname, response) {
  const filePath = vendorFiles[pathname];
  if (!filePath) return false;
  const content = await readFile(filePath);
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  });
  response.end(content);
  return true;
}

export function createWebsiteServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', publicUrl);
    try {
      if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
        response.writeHead(204, { ...securityHeaders, ...corsHeaders(request) });
        return response.end();
      }
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(request, response, 200, {
          ok: true,
          stripeConfigured: Boolean(stripe),
          databaseConfigured: database.configured,
          authConfigured: authVerifier.configured,
          webhookConfigured: webhookSecretConfigured,
          licenseKeyConfigured,
          portalConfigured: Boolean(portalConfigurationId),
          fulfillmentReady: fulfillmentReady(),
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        return sendJson(request, response, 200, publicConfig());
      }
      if (request.method === 'GET' && url.pathname === '/api/license/jwks.json') {
        return sendJson(request, response, 200, await licenseService.jwks());
      }
      if (request.method === 'POST' && url.pathname === '/api/create-checkout-session') {
        return await createCheckout(request, response);
      }
      if (request.method === 'POST' && url.pathname === '/api/create-portal-session') {
        return await createPortalSession(request, response);
      }
      if (request.method === 'GET' && url.pathname === '/api/checkout-session') {
        return await retrieveCheckout(request, url, response);
      }
      if (request.method === 'GET' && url.pathname === '/api/license') {
        return await issueLicense(request, response);
      }
      if (request.method === 'POST' && url.pathname === '/api/stripe-webhook') {
        return await handleWebhook(request, response);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return sendJson(request, response, 405, { error: 'Method not allowed.' });
      }
      if (await serveVendor(url.pathname, response)) return;
      return await serveStatic(url, response);
    } catch (error) {
      console.error('Unhandled website request error:', error);
      return sendJson(request, response, 500, { error: 'Unexpected server error.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const websiteServer = createWebsiteServer();
  websiteServer.listen(port, () => {
    console.log(`AniWebScale website running at ${publicUrl}`);
    if (!fulfillmentReady()) {
      console.log('Paid checkout remains fail-closed until Stripe, Neon, webhook, and license signing settings are complete.');
    }
  });

  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; closing the website server.`);
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    websiteServer.close(async error => {
      await database.close().catch(closeError => {
        console.error('Database shutdown failed:', closeError.message);
      });
      clearTimeout(deadline);
      process.exit(error ? 1 : 0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

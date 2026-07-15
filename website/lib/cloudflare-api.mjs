import Stripe from 'stripe';
import { AuthenticationError, createAuthVerifier } from './auth.mjs';
import { createDatabase } from './database.mjs';
import {
  isAuthUrl,
  isDatabaseUrl,
  isPkcs8PrivateKey,
  isStripePortalConfigurationId,
  isStripePriceId,
  isStripeSecretKey,
  isStripeWebhookSecret,
} from './config.mjs';
import {
  entitlementForUser,
  isPaidEntitlement,
  processStripeEvent,
} from './entitlements.mjs';
import { createLicenseService } from './license.mjs';

const STRIPE_API_VERSION = '2026-02-25.clover';
const REQUEST_LIMIT = 32_768;
const WEBHOOK_LIMIT = 1_048_576;

function envValue(env, name, fallback = '') {
  return typeof env?.[name] === 'string' ? env[name].trim() : fallback;
}

function boolEnv(env, name) {
  return envValue(env, name) === 'true';
}

function requestOrigin(request) {
  return new URL(request.url).origin;
}

function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

function corsHeaders(request, publicUrl) {
  const origin = request.headers.get('origin') || '';
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

function json(request, publicUrl, status, value) {
  return Response.json(value, {
    status,
    headers: {
      ...securityHeaders(),
      ...corsHeaders(request, publicUrl),
      'Cache-Control': 'no-store',
    },
  });
}

async function readBody(request, limit) {
  const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > limit) throw new Error('REQUEST_TOO_LARGE');
  return body;
}

async function parseJsonBody(request) {
  const body = await readBody(request, REQUEST_LIMIT);
  return JSON.parse(new TextDecoder().decode(body) || '{}');
}

function createPlans(env) {
  return Object.freeze({
    pro_monthly: {
      priceId: envValue(env, 'STRIPE_PRICE_PRO_MONTHLY'),
      mode: 'subscription',
    },
    pro_yearly: {
      priceId: envValue(env, 'STRIPE_PRICE_PRO_YEARLY'),
      mode: 'subscription',
    },
    lifetime: {
      priceId: envValue(env, 'STRIPE_PRICE_LIFETIME'),
      mode: 'payment',
    },
  });
}

export function createCloudflareApiRuntime(env, fallbackOrigin = 'http://localhost:8788') {
  const configuredPublicUrl = envValue(env, 'PUBLIC_URL');
  const publicUrl = (configuredPublicUrl || fallbackOrigin).replace(/\/$/, '');
  const stripeSecret = envValue(env, 'STRIPE_SECRET_KEY');
  const webhookSecret = envValue(env, 'STRIPE_WEBHOOK_SECRET');
  const databaseConnection = env?.HYPERDRIVE?.connectionString
    || envValue(env, 'DATABASE_URL');
  const databaseUrl = isDatabaseUrl(databaseConnection) ? databaseConnection : '';
  const authUrl = envValue(env, 'NEON_AUTH_URL');
  const licensePrivateKey = envValue(env, 'LICENSE_PRIVATE_KEY_PKCS8_B64');
  const portalConfigurationId = envValue(env, 'STRIPE_PORTAL_CONFIGURATION_ID');
  const plans = createPlans(env);
  const priceIds = Object.freeze(Object.fromEntries(
    Object.entries(plans).map(([key, value]) => [key, value.priceId]),
  ));
  const database = createDatabase(databaseUrl);
  const authVerifier = createAuthVerifier(isAuthUrl(authUrl) ? authUrl : '');
  const licenseService = createLicenseService({
    issuer: publicUrl,
    audience: envValue(env, 'LICENSE_AUDIENCE', 'aniwebscale-extension'),
    privateKeyBase64: licensePrivateKey,
  });
  const stripe = isStripeSecretKey(stripeSecret)
    ? new Stripe(stripeSecret, {
        apiVersion: STRIPE_API_VERSION,
        appInfo: { name: 'AniWebScale Cloudflare Pages', version: '1.0.0' },
        httpClient: Stripe.createFetchHttpClient(),
      })
    : null;
  const paidEntitlementsEnabled = boolEnv(env, 'PAID_ENTITLEMENTS_ENABLED');
  const webhookConfigured = isStripeWebhookSecret(webhookSecret);
  const licenseKeyConfigured = isPkcs8PrivateKey(licensePrivateKey);
  const portalConfigured = isStripePortalConfigurationId(portalConfigurationId);

  function fulfillmentReady() {
    return Boolean(
      paidEntitlementsEnabled
      && stripe
      && database.configured
      && authVerifier.configured
      && webhookConfigured
      && licenseKeyConfigured
      && portalConfigured,
    );
  }

  function checkoutReady(plan) {
    return fulfillmentReady() && isStripePriceId(plans[plan]?.priceId);
  }

  function idempotencyKey(request, namespace) {
    const supplied = request.headers.get('idempotency-key') || '';
    const value = /^[A-Za-z0-9_-]{16,128}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();
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

  async function createCheckout(request) {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const selected = plans[plan];
    if (!selected) return json(request, publicUrl, 400, { error: 'Unknown pricing plan.' });
    if (!checkoutReady(plan)) {
      return json(request, publicUrl, 503, {
        error: 'Checkout is not configured for paid Pro fulfillment yet.',
      });
    }

    try {
      const user = await authVerifier.authenticate(request);
      const entitlement = await entitlementForUser(database.query, user.id);
      if (isPaidEntitlement(entitlement)) {
        return json(request, publicUrl, 409, {
          error: 'This account already has Pro. Use Manage billing for subscription changes.',
        });
      }

      const customer = await ensureStripeCustomer(user);
      const metadata = { plan, product: 'aniwebscale', user_id: user.id };
      const session = await stripe.checkout.sessions.create({
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
        automatic_tax: { enabled: boolEnv(env, 'STRIPE_AUTOMATIC_TAX') },
      }, {
        idempotencyKey: idempotencyKey(request, `checkout:${user.id}:${plan}`),
      });
      return json(request, publicUrl, 200, { url: session.url });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message });
      }
      console.error('Stripe Checkout session failed:', error.message);
      return json(request, publicUrl, 502, {
        error: 'Stripe could not start checkout. Please try again.',
      });
    }
  }

  async function createPortalSession(request) {
    if (!fulfillmentReady()) {
      return json(request, publicUrl, 503, { error: 'Billing management is not configured yet.' });
    }
    try {
      const user = await authVerifier.authenticate(request);
      const customer = await database.query(
        'SELECT stripe_customer_id FROM app.billing_customers WHERE user_id = $1',
        [user.id],
      );
      if (!customer.rows[0]?.stripe_customer_id) {
        return json(request, publicUrl, 404, { error: 'This account has no Stripe billing profile.' });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.rows[0].stripe_customer_id,
        configuration: portalConfigurationId,
        return_url: `${publicUrl}/account`,
      });
      return json(request, publicUrl, 200, { url: session.url });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message });
      }
      console.error('Stripe Portal session failed:', error.message);
      return json(request, publicUrl, 502, { error: 'Billing management could not be opened.' });
    }
  }

  async function retrieveCheckout(request, url) {
    const sessionId = url.searchParams.get('session_id') || '';
    if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
      return json(request, publicUrl, 400, { error: 'Invalid Checkout Session.' });
    }
    if (!stripe || !authVerifier.configured) {
      return json(request, publicUrl, 503, { error: 'Stripe is not configured.' });
    }
    try {
      const user = await authVerifier.authenticate(request);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id !== user.id && session.metadata?.user_id !== user.id) {
        return json(request, publicUrl, 403, {
          error: 'Checkout Session does not belong to this account.',
        });
      }
      return json(request, publicUrl, 200, {
        status: session.status,
        paymentStatus: session.payment_status,
        plan: session.metadata?.plan || null,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message });
      }
      console.error('Stripe Checkout lookup failed:', error.message);
      return json(request, publicUrl, 404, { error: 'Checkout Session not found.' });
    }
  }

  async function issueLicense(request) {
    if (!database.configured || !authVerifier.configured) {
      return json(request, publicUrl, 503, { error: 'Account licensing is not configured.' });
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
      return json(request, publicUrl, 200, {
        ...license,
        cancelAtPeriodEnd: entitlement.cancel_at_period_end,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message });
      }
      console.error('License issuance failed:', error.message);
      return json(request, publicUrl, 503, { error: 'License status is temporarily unavailable.' });
    }
  }

  async function handleWebhook(request) {
    if (!stripe || !database.configured || !webhookConfigured) {
      return json(request, publicUrl, 503, { error: 'Stripe webhook is not configured.' });
    }
    let payload;
    try {
      payload = await readBody(request, WEBHOOK_LIMIT);
    } catch {
      return json(request, publicUrl, 413, { error: 'Webhook payload too large.' });
    }
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        payload,
        request.headers.get('stripe-signature') || '',
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch (error) {
      console.warn('Rejected Stripe webhook signature:', error.message);
      return json(request, publicUrl, 400, {
        error: 'Invalid webhook signature.',
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }
    try {
      const result = await processStripeEvent(database, event, priceIds);
      console.info(JSON.stringify({ event: event.type, eventId: event.id, ...result }));
      return json(request, publicUrl, 200, { received: true, duplicate: result.duplicate });
    } catch (error) {
      console.error('Stripe entitlement update failed:', error.message);
      return json(request, publicUrl, 503, {
        error: 'Entitlement update is temporarily unavailable.',
        code: 'ENTITLEMENT_UPDATE_FAILED',
      });
    }
  }

  function publicConfig() {
    return {
      prices: {
        monthly: envValue(env, 'PUBLIC_PRICE_MONTHLY', '4.99'),
        yearly: envValue(env, 'PUBLIC_PRICE_YEARLY', '41.99'),
        lifetime: envValue(env, 'PUBLIC_PRICE_LIFETIME', '59.99'),
        currency: envValue(env, 'PUBLIC_CURRENCY', '$'),
      },
      links: {
        chrome: envValue(env, 'CHROME_STORE_URL'),
        firefox: envValue(env, 'FIREFOX_ADDONS_URL'),
        github: envValue(env, 'GITHUB_REPO_URL'),
        portal: '/account',
      },
      auth: {
        url: authVerifier.authBaseUrl,
        ready: authVerifier.configured,
      },
      legal: {
        name: envValue(env, 'LEGAL_NAME', 'Korrespont GbR'),
        email: envValue(env, 'LEGAL_EMAIL', 'support@korrespont.com'),
        address: envValue(env, 'LEGAL_ADDRESS', 'Paterkamp 11a, 59348 Luedinghausen, Deutschland'),
        representatives: envValue(
          env,
          'LEGAL_REPRESENTATIVES',
          'Karim Mahmoudi and Daniel Nikoulchine',
        ),
        vatId: envValue(env, 'LEGAL_VAT_ID'),
      },
      checkout: {
        proMonthly: checkoutReady('pro_monthly'),
        proYearly: checkoutReady('pro_yearly'),
        lifetime: checkoutReady('lifetime'),
      },
    };
  }

  return {
    publicUrl,

    async handle(request) {
      const url = new URL(request.url);
      const { method } = request;
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...securityHeaders(), ...corsHeaders(request, publicUrl) },
        });
      }
      if (method === 'GET' && url.pathname === '/api/health') {
        return json(request, publicUrl, 200, {
          ok: true,
          runtime: 'cloudflare-pages-functions',
          stripeConfigured: Boolean(stripe),
          databaseConfigured: database.configured,
          hyperdriveConfigured: Boolean(env?.HYPERDRIVE?.connectionString),
          authConfigured: authVerifier.configured,
          webhookConfigured,
          licenseKeyConfigured,
          portalConfigured,
          fulfillmentReady: fulfillmentReady(),
        });
      }
      if (method === 'GET' && url.pathname === '/api/config') {
        return json(request, publicUrl, 200, publicConfig());
      }
      if (method === 'GET' && url.pathname === '/api/license/jwks.json') {
        return json(request, publicUrl, 200, await licenseService.jwks());
      }
      if (method === 'POST' && url.pathname === '/api/create-checkout-session') {
        return createCheckout(request);
      }
      if (method === 'POST' && url.pathname === '/api/create-portal-session') {
        return createPortalSession(request);
      }
      if (method === 'GET' && url.pathname === '/api/checkout-session') {
        return retrieveCheckout(request, url);
      }
      if (method === 'GET' && url.pathname === '/api/license') {
        return issueLicense(request);
      }
      if (method === 'POST' && url.pathname === '/api/stripe-webhook') {
        return handleWebhook(request);
      }
      if (method !== 'GET' && method !== 'POST') {
        return json(request, publicUrl, 405, { error: 'Method not allowed.' });
      }
      return json(request, publicUrl, 404, { error: 'API route not found.' });
    },
  };
}

const runtimeCache = new WeakMap();

export async function handleCloudflareApiRequest(request, env = {}) {
  let runtime = runtimeCache.get(env);
  if (!runtime) {
    runtime = createCloudflareApiRuntime(env, requestOrigin(request));
    runtimeCache.set(env, runtime);
  }
  try {
    return await runtime.handle(request);
  } catch (error) {
    console.error('Unhandled Cloudflare API request error:', error);
    return json(request, runtime.publicUrl, 500, { error: 'Unexpected server error.' });
  }
}

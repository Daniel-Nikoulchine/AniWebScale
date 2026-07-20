import Stripe from 'stripe';
import {
  AccountSignupError,
  createAccountSignupService,
} from './account-signup.mjs';
import {
  AccountDeletionError,
  createAccountDeletionService,
} from './account-deletion.mjs';
import {
  AccountExportError,
  createAccountExportService,
} from './account-export.mjs';
import {
  AccountSecurityError,
  createAccountSecurityService,
} from './account-security.mjs';
import {
  AuthenticationError,
  createAuthVerifier,
  requireActiveAccount,
} from './auth.mjs';
import { createDatabase } from './database.mjs';
import {
  isAuthUrl,
  isBase64Key,
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
import {
  ExtensionAuthError,
  createExtensionAuthService,
} from './extension-auth.mjs';
import { createLicenseService } from './license.mjs';
import { createOperationalStatusService } from './operational-status.mjs';
import {
  RateLimitError,
  createApiRateLimitService,
  requestAddress,
} from './rate-limit.mjs';
import {
  recordServiceMetric,
  serviceMetricName,
} from './service-observability.mjs';
import { boolEnv, dayEnv, envValue } from './api-environment.mjs';
import {
  constantTimeEqual,
  corsHeaders,
  json,
  log,
  parseJsonBody,
  readBody,
  requestOrigin,
  safeErrorFields,
  securityHeaders,
} from './api-http.mjs';

const STRIPE_API_VERSION = '2026-02-25.clover';
const WEBHOOK_LIMIT = 1_048_576;

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

export function createApiRuntime(env, {
  fallbackOrigin = 'http://localhost:8788',
  runtimeName = 'fetch-api',
  stripeAppName = 'AniWebScale API',
  addressForRequest = /** @type {(request: Request) => string} */ (() => 'unknown'),
} = {}) {
  const configuredPublicUrl = envValue(env, 'PUBLIC_URL');
  const publicUrl = (configuredPublicUrl || fallbackOrigin).replace(/\/$/, '');
  const stripeSecret = envValue(env, 'STRIPE_SECRET_KEY');
  const webhookSecret = envValue(env, 'STRIPE_WEBHOOK_SECRET');
  const databaseConnection = env?.HYPERDRIVE?.connectionString
    || envValue(env, 'DATABASE_URL');
  const databaseUrl = isDatabaseUrl(databaseConnection) ? databaseConnection : '';
  const authUrl = envValue(env, 'NEON_AUTH_URL');
  const privacyHashKeyValue = envValue(env, 'PRIVACY_HASH_KEY_B64');
  const privacyHashKeyConfigured = isBase64Key(privacyHashKeyValue);
  const identifierHashKey = privacyHashKeyConfigured
    ? Buffer.from(privacyHashKeyValue, 'base64')
    : null;
  const licensePrivateKey = envValue(env, 'LICENSE_PRIVATE_KEY_PKCS8_B64');
  const portalConfigurationId = envValue(env, 'STRIPE_PORTAL_CONFIGURATION_ID');
  const operationsMonitorToken = envValue(env, 'OPERATIONS_MONITOR_TOKEN');
  const operationsMonitorConfigured = operationsMonitorToken.length >= 32;
  const privacyConfiguration = Object.freeze({
    cloudflareLogRetentionDays: dayEnv(env, 'PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS'),
    neonPitrRetentionDays: dayEnv(env, 'PRIVACY_NEON_PITR_RETENTION_DAYS'),
    authSessionRetentionDays: dayEnv(env, 'PRIVACY_AUTH_SESSION_RETENTION_DAYS'),
    vendorReviewDate: envValue(env, 'PRIVACY_VENDOR_REVIEW_DATE'),
    transferSafeguards: envValue(env, 'PRIVACY_TRANSFER_SAFEGUARDS'),
  });
  const privacyConfigurationComplete = [
    privacyConfiguration.cloudflareLogRetentionDays,
    privacyConfiguration.neonPitrRetentionDays,
    privacyConfiguration.authSessionRetentionDays,
  ].every(Number.isInteger)
    && /^\d{4}-\d{2}-\d{2}$/.test(privacyConfiguration.vendorReviewDate)
    && privacyConfiguration.transferSafeguards.length >= 10;
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
  const extensionAuth = createExtensionAuthService({ database, licenseService });
  const accountSignup = createAccountSignupService({
    database,
    authUrl: authVerifier.authBaseUrl,
    publicUrl,
    identifierHashKey,
    addressForRequest,
  });
  const stripe = isStripeSecretKey(stripeSecret)
    ? new Stripe(stripeSecret, {
        apiVersion: STRIPE_API_VERSION,
        appInfo: { name: stripeAppName, version: '1.0.0' },
        httpClient: Stripe.createFetchHttpClient(),
      })
    : null;
  const accountDeletion = createAccountDeletionService({ database, stripe, identifierHashKey });
  const accountExport = createAccountExportService({ database });
  const accountSecurity = createAccountSecurityService({ database });
  const apiRateLimit = createApiRateLimitService({ database, identifierHashKey, addressForRequest });
  const operationalStatus = createOperationalStatusService({ database });
  const paidEntitlementsEnabled = boolEnv(env, 'PAID_ENTITLEMENTS_ENABLED');
  const webhookConfigured = isStripeWebhookSecret(webhookSecret);
  const licenseKeyConfigured = isPkcs8PrivateKey(licensePrivateKey);
  const portalConfigured = isStripePortalConfigurationId(portalConfigurationId);
  const legalReviewApproved = boolEnv(env, 'LEGAL_REVIEW_APPROVED');
  const taxConfigurationApproved = boolEnv(env, 'TAX_CONFIGURATION_APPROVED');
  const dataProtectionApproved = boolEnv(env, 'DATA_PROTECTION_APPROVED');
  const dataProtectionReady = dataProtectionApproved
    && privacyHashKeyConfigured
    && privacyConfigurationComplete;
  const liveCommerceApproved = legalReviewApproved
    && taxConfigurationApproved
    && dataProtectionReady;

  function fulfillmentReady() {
    return Boolean(
      paidEntitlementsEnabled
      && stripe
      && database.configured
      && authVerifier.configured
      && webhookConfigured
      && licenseKeyConfigured
      && portalConfigured
      && liveCommerceApproved,
    );
  }

  function checkoutReady(plan) {
    return fulfillmentReady() && isStripePriceId(plans[plan]?.priceId);
  }

  function readinessStatus() {
    return {
      runtime: runtimeName,
      stripeConfigured: Boolean(stripe),
      databaseConfigured: database.configured,
      hyperdriveConfigured: Boolean(env?.HYPERDRIVE?.connectionString),
      authConfigured: authVerifier.configured,
      webhookConfigured,
      licenseKeyConfigured,
      portalConfigured,
      operationsMonitorConfigured,
      privacyHashKeyConfigured,
      privacyConfigurationComplete,
      legalReviewApproved,
      taxConfigurationApproved,
      dataProtectionApproved: dataProtectionReady,
      liveCommerceApproved,
      fulfillmentReady: fulfillmentReady(),
    };
  }

  function dataProtectionRequired(request) {
    return json(request, publicUrl, 503, {
      error: 'New account processing is disabled until the documented data-protection review is approved.',
      code: 'DATA_PROTECTION_APPROVAL_REQUIRED',
    });
  }

  async function enforceRateLimit(request, action, userId = '') {
    try {
      await apiRateLimit.enforce(request, action, userId);
      return null;
    } catch (error) {
      if (error instanceof RateLimitError) {
        return json(request, publicUrl, error.status, { error: error.message, code: error.code });
      }
      log('error', { event: 'api_rate_limit_failed', action, ...safeErrorFields(error) });
      return json(request, publicUrl, 503, {
        error: 'Request protection is temporarily unavailable.',
        code: 'RATE_LIMIT_UNAVAILABLE',
      });
    }
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
    if (body.legalAccepted !== true || body.immediatePerformanceRequested !== true
      || body.legalVersion !== envValue(env, 'LEGAL_VERSION', '2026-07-17')) {
      return json(request, publicUrl, 400, {
        error: 'Please accept the terms and withdrawal information before checkout.',
        code: 'LEGAL_CONFIRMATION_REQUIRED',
      });
    }

    try {
      const tokenUser = await authVerifier.authenticate(request);
      const user = await requireActiveAccount(database, tokenUser);
      const rateLimited = await enforceRateLimit(request, 'checkout', user.id);
      if (rateLimited) return rateLimited;
      const entitlement = await entitlementForUser(database.query, user.id);
      if (isPaidEntitlement(entitlement)) {
        return json(request, publicUrl, 409, {
          error: 'This account already has Pro. Use Manage billing for subscription changes.',
        });
      }

      const customer = await ensureStripeCustomer(user);
      const metadata = {
        plan,
        product: 'aniwebscale',
        user_id: user.id,
        legal_version: body.legalVersion,
        immediate_performance_requested: 'true',
      };
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
      log('error', { event: 'stripe_checkout_failed', ...safeErrorFields(error) });
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
      const tokenUser = await authVerifier.authenticate(request);
      const user = await requireActiveAccount(database, tokenUser);
      const rateLimited = await enforceRateLimit(request, 'billing_portal', user.id);
      if (rateLimited) return rateLimited;
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
      log('error', { event: 'stripe_portal_failed', ...safeErrorFields(error) });
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
      const tokenUser = await authVerifier.authenticate(request);
      const user = await requireActiveAccount(database, tokenUser);
      const rateLimited = await enforceRateLimit(request, 'checkout_lookup', user.id);
      if (rateLimited) return rateLimited;
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
      log('error', { event: 'stripe_checkout_lookup_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 404, { error: 'Checkout Session not found.' });
    }
  }

  async function issueLicense(request) {
    if (!database.configured || !authVerifier.configured) {
      return json(request, publicUrl, 503, { error: 'Account licensing is not configured.' });
    }
    try {
      const tokenUser = await authVerifier.authenticate(request);
      const user = await requireActiveAccount(database, tokenUser);
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
        currentPeriodEnd: entitlement.current_period_end,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message });
      }
      log('error', { event: 'license_issuance_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 503, { error: 'License status is temporarily unavailable.' });
    }
  }

  function extensionAuthFailure(request, error) {
    if (error instanceof AuthenticationError) {
      return json(request, publicUrl, 401, { error: error.message, code: 'AUTHENTICATION_REQUIRED' });
    }
    if (error instanceof ExtensionAuthError) {
      return json(request, publicUrl, error.status, { error: error.message, code: error.code });
    }
    log('error', { event: 'extension_auth_failed', ...safeErrorFields(error) });
    return json(request, publicUrl, 503, { error: 'Extension authentication is temporarily unavailable.' });
  }

  async function authorizeExtension(request) {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    try {
      const user = await authVerifier.authenticate(request);
      const rateLimited = await enforceRateLimit(request, 'extension_authorize', user.id);
      if (rateLimited) return rateLimited;
      return json(request, publicUrl, 200, await extensionAuth.authorize(user, body));
    } catch (error) {
      return extensionAuthFailure(request, error);
    }
  }

  async function exchangeExtensionToken(request) {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    try {
      const rateLimited = await enforceRateLimit(request, 'extension_exchange');
      if (rateLimited) return rateLimited;
      return json(request, publicUrl, 200, await extensionAuth.exchange(body));
    } catch (error) {
      return extensionAuthFailure(request, error);
    }
  }

  async function refreshExtensionLicense(request) {
    try {
      return json(request, publicUrl, 200, await extensionAuth.refresh(request));
    } catch (error) {
      return extensionAuthFailure(request, error);
    }
  }

  async function revokeExtensionSession(request) {
    try {
      return json(request, publicUrl, 200, await extensionAuth.revoke(request));
    } catch (error) {
      return extensionAuthFailure(request, error);
    }
  }

  async function signUpAccount(request, waitUntil) {
    if (!dataProtectionReady) return dataProtectionRequired(request);
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    try {
      return json(request, publicUrl, 200, await accountSignup.signUp(request, body, waitUntil));
    } catch (error) {
      if (error instanceof AccountSignupError) {
        return json(request, publicUrl, error.status, { error: error.message, code: error.code });
      }
      log('error', { event: 'account_signup_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 503, { error: 'Account registration is temporarily unavailable.' });
    }
  }

  async function deleteAccount(request) {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    try {
      const user = await authVerifier.authenticate(request);
      const rateLimited = await enforceRateLimit(request, 'account_delete', user.id);
      if (rateLimited) return rateLimited;
      return json(request, publicUrl, 200, await accountDeletion.deleteAccount(user, body));
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message, code: 'AUTHENTICATION_REQUIRED' });
      }
      if (error instanceof AccountDeletionError) {
        return json(request, publicUrl, error.status, { error: error.message, code: error.code });
      }
      log('error', { event: 'account_deletion_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 503, {
        error: 'Account deletion is temporarily unavailable.',
        code: 'ACCOUNT_DELETION_FAILED',
      });
    }
  }

  async function exportAccount(request) {
    try {
      const user = await authVerifier.authenticate(request);
      const rateLimited = await enforceRateLimit(request, 'account_export', user.id);
      if (rateLimited) return rateLimited;
      const exported = await accountExport.exportAccount(user);
      log('info', { event: 'account_export_completed' });
      return json(request, publicUrl, 200, exported);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return json(request, publicUrl, 401, { error: error.message, code: 'AUTHENTICATION_REQUIRED' });
      }
      if (error instanceof AccountExportError) {
        return json(request, publicUrl, error.status, { error: error.message, code: error.code });
      }
      log('error', { event: 'account_export_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 503, {
        error: 'Account export is temporarily unavailable.',
        code: 'ACCOUNT_EXPORT_FAILED',
      });
    }
  }

  async function operationsStatus(request) {
    if (!operationsMonitorConfigured) {
      return json(request, publicUrl, 503, { error: 'Operations monitoring is not configured.' });
    }
    const supplied = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1] || '';
    if (!constantTimeEqual(supplied, operationsMonitorToken)) {
      return json(request, publicUrl, 401, { error: 'Operations monitor authentication required.' });
    }
    try {
      const status = await operationalStatus.status();
      return json(request, publicUrl, status.ok ? 200 : 503, {
        ...status,
        readiness: readinessStatus(),
      });
    } catch (error) {
      log('error', { event: 'operations_status_failed', ...safeErrorFields(error) });
      return json(request, publicUrl, 503, {
        error: 'Operations status is temporarily unavailable.',
        readiness: readinessStatus(),
      });
    }
  }

  function accountSecurityFailure(request, error) {
    if (error instanceof AuthenticationError) {
      return json(request, publicUrl, 401, { error: error.message, code: 'AUTHENTICATION_REQUIRED' });
    }
    if (error instanceof AccountSecurityError) {
      return json(request, publicUrl, error.status, { error: error.message, code: error.code });
    }
    log('error', { event: 'account_security_failed', ...safeErrorFields(error) });
    return json(request, publicUrl, 503, {
      error: 'Account security controls are temporarily unavailable.',
      code: 'ACCOUNT_SECURITY_FAILED',
    });
  }

  async function accountSecuritySummary(request) {
    try {
      const user = await authVerifier.authenticate(request);
      return json(request, publicUrl, 200, await accountSecurity.summary(user));
    } catch (error) {
      return accountSecurityFailure(request, error);
    }
  }

  async function revokeAccountSessions(request) {
    try {
      const user = await authVerifier.authenticate(request);
      const rateLimited = await enforceRateLimit(request, 'session_revoke_all', user.id);
      if (rateLimited) return rateLimited;
      return json(request, publicUrl, 200, await accountSecurity.revokeAllSessions(user));
    } catch (error) {
      return accountSecurityFailure(request, error);
    }
  }

  async function revokeAccountSession(request) {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return json(request, publicUrl, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: 'Invalid request body.',
      });
    }
    try {
      const user = await authVerifier.authenticate(request);
      const rateLimited = await enforceRateLimit(request, 'session_revoke_one', user.id);
      if (rateLimited) return rateLimited;
      return json(request, publicUrl, 200, await accountSecurity.revokeSession(user, body));
    } catch (error) {
      return accountSecurityFailure(request, error);
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
        Buffer.from(payload),
        request.headers.get('stripe-signature') || '',
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch (error) {
      log('warn', { event: 'stripe_webhook_rejected', ...safeErrorFields(error) });
      return json(request, publicUrl, 400, {
        error: 'Invalid webhook signature.',
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }
    try {
      const result = await processStripeEvent(database, event, priceIds);
      log('info', { event: 'stripe_webhook_processed', stripeEvent: event.type, ...result });
      return json(request, publicUrl, 200, { received: true, duplicate: result.duplicate });
    } catch (error) {
      log('error', { event: 'stripe_entitlement_update_failed', ...safeErrorFields(error) });
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
        signupReady: authVerifier.configured && database.configured && dataProtectionReady,
      },
      legal: {
        name: envValue(env, 'LEGAL_NAME', 'Korrespont GbR'),
        email: envValue(env, 'LEGAL_EMAIL', 'support@korrespont.com'),
        address: envValue(env, 'LEGAL_ADDRESS', 'Paterkamp 11a, 59348 Lüdinghausen, Deutschland'),
        representatives: envValue(
          env,
          'LEGAL_REPRESENTATIVES',
          'Karim Mahmoudi and Daniel Nikoulchine',
        ),
        vatId: envValue(env, 'LEGAL_VAT_ID'),
        phone: envValue(env, 'LEGAL_PHONE'),
        registerCourt: envValue(env, 'LEGAL_REGISTER_COURT'),
        registerNumber: envValue(env, 'LEGAL_REGISTER_NUMBER'),
        taxNotice: envValue(env, 'LEGAL_TAX_NOTICE'),
        version: envValue(env, 'LEGAL_VERSION', '2026-07-17'),
        reviewApproved: legalReviewApproved,
        taxConfigurationApproved,
        dataProtectionApproved: dataProtectionReady,
      },
      privacy: privacyConfiguration,
      checkout: {
        proMonthly: checkoutReady('pro_monthly'),
        proYearly: checkoutReady('pro_yearly'),
        lifetime: checkoutReady('lifetime'),
      },
    };
  }

  async function routeRequest(request, waitUntil) {
      const url = new URL(request.url);
      const { method } = request;
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...securityHeaders(), ...corsHeaders(request, publicUrl) },
        });
      }
      if (method === 'GET' && url.pathname === '/api/health') {
        return json(request, publicUrl, 200, { ok: true });
      }
      if (method === 'GET' && url.pathname === '/api/config') {
        return json(request, publicUrl, 200, publicConfig());
      }
      if (method === 'GET' && url.pathname === '/api/operations/status') {
        return operationsStatus(request);
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
      if (method === 'POST' && url.pathname === '/api/auth/sign-up') {
        return signUpAccount(request, waitUntil);
      }
      if (method === 'GET' && url.pathname === '/api/account/export') {
        return exportAccount(request);
      }
      if (method === 'GET' && url.pathname === '/api/account/security') {
        return accountSecuritySummary(request);
      }
      if (method === 'POST' && url.pathname === '/api/account/revoke-sessions') {
        return revokeAccountSessions(request);
      }
      if (method === 'POST' && url.pathname === '/api/account/revoke-session') {
        return revokeAccountSession(request);
      }
      if (method === 'DELETE' && url.pathname === '/api/account') {
        return deleteAccount(request);
      }
      if (method === 'POST' && url.pathname === '/api/extension-auth/authorize') {
        if (!dataProtectionReady) return dataProtectionRequired(request);
        return authorizeExtension(request);
      }
      if (method === 'POST' && url.pathname === '/api/extension-auth/token') {
        if (!dataProtectionReady) return dataProtectionRequired(request);
        return exchangeExtensionToken(request);
      }
      if (method === 'GET' && url.pathname === '/api/extension-auth/license') {
        return refreshExtensionLicense(request);
      }
      if (method === 'POST' && url.pathname === '/api/extension-auth/revoke') {
        return revokeExtensionSession(request);
      }
      if (method === 'POST' && url.pathname === '/api/stripe-webhook') {
        return handleWebhook(request);
      }
      if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
        return json(request, publicUrl, 405, { error: 'Method not allowed.' });
      }
      return json(request, publicUrl, 404, { error: 'API route not found.' });
  }

  return {
    publicUrl,
    fulfillmentReady,
    close: () => database.close(),

    async handle(request, waitUntil) {
      const metricName = serviceMetricName(request);
      const startedAt = Date.now();
      let status = 500;
      try {
        const response = await routeRequest(request, waitUntil);
        status = response.status;
        return response;
      } finally {
        if (metricName && database.configured) {
          const recording = recordServiceMetric(database.query, {
            metricName,
            status,
            durationMs: Date.now() - startedAt,
          }).catch(error => log('error', {
            event: 'service_metric_record_failed',
            metricName,
            ...safeErrorFields(error),
          }));
          if (typeof waitUntil === 'function') waitUntil(recording);
          else await recording;
        }
      }
    },
  };
}

export function createCloudflareApiRuntime(env, fallbackOrigin = 'http://localhost:8788') {
  return createApiRuntime(env, {
    fallbackOrigin,
    runtimeName: 'cloudflare-pages-functions',
    stripeAppName: 'AniWebScale Cloudflare Pages',
    addressForRequest: request => requestAddress(request, 'cf-connecting-ip'),
  });
}

const runtimeCache = new WeakMap();

export async function handleCloudflareApiRequest(request, env = {}, waitUntil) {
  let runtime;
  try {
    runtime = runtimeCache.get(env);
    if (!runtime) {
      runtime = createCloudflareApiRuntime(env, requestOrigin(request));
      runtimeCache.set(env, runtime);
    }
    return await runtime.handle(request, waitUntil);
  } catch (error) {
    log('error', {
      event: 'unhandled_request_error',
      method: request.method,
      path: new URL(request.url).pathname,
      ...safeErrorFields(error),
    });
    return json(request, runtime?.publicUrl || requestOrigin(request), 500, {
      error: 'Unexpected server error.',
    });
  }
}

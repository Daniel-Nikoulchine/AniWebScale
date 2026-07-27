const input = process.argv[2] || process.env.LIVE_BASE_URL || '';
const allowLocal = process.env.LIVE_ALLOW_LOCAL === '1';
const allowMissingStoreLinks = process.env.LIVE_ALLOW_MISSING_STORE_LINKS === '1';
const requireLegalApproval = process.env.LIVE_REQUIRE_LEGAL_APPROVAL === '1';
const requireSchemaStatus = process.env.LIVE_REQUIRE_SCHEMA_STATUS === '1';
const timeoutMs = Number.parseInt(process.env.LIVE_CHECK_TIMEOUT_MS || '10000', 10);
const chromeExtensionOrigin = process.env.LIVE_EXPECTED_CHROME_EXTENSION_ORIGIN
  || 'chrome-extension://dlomjcbmgkfaebhplgoihbjfclaagike';
const firefoxExtensionOrigin = process.env.LIVE_EXPECTED_FIREFOX_EXTENSION_ORIGIN
  || 'moz-extension://00000000-0000-4000-8000-000000000000';
const localhostOrigin = 'http://localhost:3000';
const pinnedLicenseJwk = {
  x: 'pFuIezfw7uChuH5OcZZstHMp_O1FzPd5A18vKIw-gXc',
  y: 'Rl2KW9NkEb8KWoTk3qQh-vsY--YHuQeldX6rNC37WRc',
};
const localExpectedLicenseJwk = allowLocal
  && process.env.LIVE_EXPECTED_LICENSE_JWK_X
  && process.env.LIVE_EXPECTED_LICENSE_JWK_Y
  ? {
      x: process.env.LIVE_EXPECTED_LICENSE_JWK_X,
      y: process.env.LIVE_EXPECTED_LICENSE_JWK_Y,
    }
  : pinnedLicenseJwk;

function fail(message) {
  throw new Error(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

function report(label) {
  console.log(`OK ${label}`);
}

function endpoint(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

async function request(baseUrl, pathname, init = {}) {
  const response = await fetch(endpoint(baseUrl, pathname), {
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    ...init,
    headers: {
      'User-Agent': 'AniWebScale-Live-Readiness/1.0',
      ...init.headers,
    },
  });
  return response;
}

async function json(response, label) {
  const contentType = response.headers.get('content-type') || '';
  requireValue(contentType.includes('application/json'), `${label} did not return JSON.`);
  return response.json();
}

function assertSecurityHeaders(response, requireHsts) {
  const csp = response.headers.get('content-security-policy') || '';
  requireValue(csp.includes("object-src 'none'"), 'Content-Security-Policy must block objects.');
  requireValue(csp.includes("frame-ancestors 'none'"), 'Content-Security-Policy must block framing.');
  requireValue(csp.includes('https://checkout.stripe.com'), 'Content-Security-Policy must allow Stripe Checkout forms.');
  requireValue(response.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options must be nosniff.');
  requireValue(response.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options must be DENY.');
  requireValue(response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy is missing or unsafe.');
  if (requireHsts) {
    requireValue((response.headers.get('strict-transport-security') || '').includes('max-age='), 'HTTPS deployment must emit Strict-Transport-Security.');
  }
}

try {
requireValue(input, 'Pass the public HTTPS origin or set LIVE_BASE_URL.');
let parsed;
try {
  parsed = new URL(input);
} catch {
  fail('LIVE_BASE_URL is not a valid absolute URL.');
}
requireValue(!parsed.username && !parsed.password, 'LIVE_BASE_URL must not contain credentials.');
requireValue(!parsed.search && !parsed.hash && (parsed.pathname === '/' || parsed.pathname === ''), 'LIVE_BASE_URL must be an origin without path, query, or fragment.');
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
if (allowLocal) {
  requireValue(isLocal || parsed.protocol === 'https:', 'LIVE_ALLOW_LOCAL permits HTTP only for a local address.');
} else {
  requireValue(parsed.protocol === 'https:', 'The live deployment must use HTTPS.');
  requireValue(!isLocal && !parsed.hostname.endsWith('.local'), 'The live deployment must use a public hostname.');
}
const baseUrl = parsed.origin;
const requireHsts = parsed.protocol === 'https:' && !isLocal;

const homeResponse = await request(baseUrl, '/');
requireValue(homeResponse.status === 200, `Homepage returned HTTP ${homeResponse.status}.`);
assertSecurityHeaders(homeResponse, requireHsts);
const home = await homeResponse.text();
requireValue(home.includes('AniWebScale'), 'Homepage does not identify AniWebScale.');
requireValue(home.includes('data-plan="pro_monthly"'), 'Homepage is missing Monthly checkout.');
requireValue(home.includes('data-billing="yearly"'), 'Homepage is missing the Yearly billing option.');
requireValue(home.includes('data-plan="lifetime"'), 'Homepage is missing Lifetime checkout.');
report('homepage, pricing controls and security headers');

const accountResponse = await request(baseUrl, '/account');
requireValue(accountResponse.status === 200, `Account page returned HTTP ${accountResponse.status}.`);
const account = await accountResponse.text();
requireValue(account.includes('accept-legal') && account.includes('request-performance'), 'Account page is missing legal checkout confirmations.');
requireValue(account.includes('verification-form') && account.includes('authorize-extension'), 'Account page is missing email verification or extension authorization.');
report('account page');

for (const legalPath of ['/imprint', '/privacy', '/terms', '/withdrawal', '/refund', '/support']) {
  const response = await request(baseUrl, legalPath);
  requireValue(response.status === 200, `${legalPath} returned HTTP ${response.status}.`);
}
report('legal and support pages');

const healthResponse = await request(baseUrl, '/api/health');
requireValue(healthResponse.status === 200, `Health endpoint returned HTTP ${healthResponse.status}.`);
const health = await json(healthResponse, 'Health endpoint');
requireValue(Boolean(healthResponse.headers.get('x-request-id')), 'Health endpoint is missing X-Request-Id.');
requireValue(
  health.ok === true && Object.keys(health).length === 1,
  'Public health endpoint must expose only its liveness result.',
);
report('minimal public liveness endpoint');

const operationsToken = String(process.env.OPERATIONS_MONITOR_TOKEN || '').trim();
requireValue(operationsToken.length >= 32, 'OPERATIONS_MONITOR_TOKEN is required for readiness checks.');
const operationsResponse = await request(baseUrl, '/api/operations/status', {
  headers: { Authorization: `Bearer ${operationsToken}` },
});
const operations = await json(operationsResponse, 'Operations status');
requireValue(
  operationsResponse.status === 200 || operationsResponse.status === 503,
  `Operations status returned HTTP ${operationsResponse.status}.`,
);
const readiness = operations.readiness;
for (const field of [
  'stripeConfigured',
  'databaseConfigured',
  'authConfigured',
  'webhookConfigured',
  'licenseKeyConfigured',
  'portalConfigured',
  'operationsMonitorConfigured',
  'privacyHashKeyConfigured',
  'privacyConfigurationComplete',
  'dataProtectionApproved',
  'fulfillmentReady',
]) {
  requireValue(readiness?.[field] === true, `Protected readiness field ${field} is not ready.`);
}
report('Stripe, Neon, Auth, webhook, portal and license health');

if (requireSchemaStatus) {
  requireValue(operationsResponse.status === 200, `Operations status returned HTTP ${operationsResponse.status}.`);
  requireValue(
    operations.schema?.healthy === true
      && operations.schema.currentVersion === operations.schema.expectedVersion,
    `Database schema is behind deployment code: ${JSON.stringify(operations.schema)}.`,
  );
  report('database schema matches deployment code');
}

const configResponse = await request(baseUrl, '/api/config');
requireValue(configResponse.status === 200, `Public config returned HTTP ${configResponse.status}.`);
const config = await json(configResponse, 'Public config');
const expectedPrices = {
  monthly: process.env.LIVE_EXPECTED_PRICE_MONTHLY || '4.99',
  yearly: process.env.LIVE_EXPECTED_PRICE_YEARLY || '41.99',
  lifetime: process.env.LIVE_EXPECTED_PRICE_LIFETIME || '59.99',
  currency: process.env.LIVE_EXPECTED_CURRENCY || '$',
};
for (const [name, expected] of Object.entries(expectedPrices)) {
  requireValue(config.prices?.[name] === expected, `Public ${name} price must be ${expected}.`);
}
requireValue(config.checkout?.proMonthly === true, 'Monthly checkout is not ready.');
requireValue(config.checkout?.proYearly === true, 'Yearly checkout is not ready.');
requireValue(config.checkout?.lifetime === true, 'Lifetime checkout is not ready.');
requireValue(config.auth?.ready === true, 'Public Neon Auth configuration is not ready.');
requireValue(config.auth?.signupReady === true, 'Website account registration is not approved for live processing.');
const authUrl = new URL(config.auth.url);
requireValue(authUrl.protocol === 'https:' && authUrl.pathname.endsWith('/auth'), 'Public Neon Auth URL must be HTTPS and end in /auth.');
if (!allowLocal) {
  const trustedResponse = await fetch(`${authUrl.toString().replace(/\/$/, '')}/sign-in/email`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      'User-Agent': 'AniWebScale-Live-Readiness/1.0',
    },
    body: JSON.stringify({
      email: `live-origin-check-${Date.now()}@example.invalid`,
      password: 'AniWebScale-live-origin-check',
    }),
  });
  const trustedBody = await trustedResponse.text();
  requireValue(
    trustedResponse.status === 401 && !/invalid origin/i.test(trustedBody),
    `Neon Auth rejected the website origin with HTTP ${trustedResponse.status}.`,
  );
  for (const origin of [chromeExtensionOrigin, firefoxExtensionOrigin, localhostOrigin]) {
    const response = await fetch(`${authUrl.toString().replace(/\/$/, '')}/sign-in/email`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'User-Agent': 'AniWebScale-Live-Readiness/1.0',
      },
      body: JSON.stringify({
        email: `live-origin-check-${Date.now()}@example.invalid`,
        password: 'AniWebScale-live-origin-check',
      }),
    });
    const body = await response.text();
    requireValue(
      response.status === 403 && /invalid origin/i.test(body),
      `Neon Auth unexpectedly allowed origin ${origin} with HTTP ${response.status}.`,
    );
  }
  const directSignupEmail = `live-direct-signup-${Date.now()}@example.invalid`;
  const directSignupBodies = [];
  const directSignupStatuses = [];
  for (const email of [directSignupEmail, `other-${directSignupEmail}`]) {
    const response = await fetch(`${authUrl.toString().replace(/\/$/, '')}/sign-up/email`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
        'User-Agent': 'AniWebScale-Live-Readiness/1.0',
      },
      body: JSON.stringify({
        email,
        password: 'AniWebScale-live-direct-signup-check',
        name: 'Live readiness check',
      }),
    });
    directSignupStatuses.push(response.status);
    directSignupBodies.push(await response.text());
  }
  requireValue(
    directSignupStatuses[0] >= 400
      && directSignupStatuses[0] === directSignupStatuses[1]
      && directSignupBodies[0] === directSignupBodies[1],
    'Direct Neon signup must be disabled with a uniform response.',
  );
  report('website-only Neon Auth origin allowlist');
}
for (const field of ['name', 'email', 'address', 'representatives']) {
  requireValue(typeof config.legal?.[field] === 'string' && config.legal[field].trim(), `Legal field ${field} is empty.`);
}
requireValue(config.legal?.version === '2026-07-17', 'Legal version is not the expected checkout version.');
if (requireLegalApproval) {
  requireValue(config.legal?.reviewApproved === true, 'Legal review is not approved for live commerce.');
  requireValue(config.legal?.taxConfigurationApproved === true, 'Tax configuration is not approved for live commerce.');
  requireValue(config.legal?.dataProtectionApproved === true, 'Data-protection review is not approved for live processing.');
  requireValue(typeof config.legal?.taxNotice === 'string' && config.legal.taxNotice.trim(), 'Legal tax notice is empty.');
}
if (!allowMissingStoreLinks) {
  requireValue(/^https:\/\//.test(config.links?.chrome || ''), 'Chrome Store URL is missing.');
  requireValue(/^https:\/\//.test(config.links?.firefox || ''), 'Firefox Add-ons URL is missing.');
}
const serializedConfig = JSON.stringify(config);
requireValue(!/(?:sk_(?:test|live)_|whsec_|postgres(?:ql)?:\/\/[^\s:/]+:[^@\s]+@|BEGIN PRIVATE KEY)/.test(serializedConfig), 'Public config exposes a secret-shaped value.');
report('public prices, store links, legal data and Neon Auth URL');

const jwksResponse = await request(baseUrl, '/api/license/jwks.json');
requireValue(jwksResponse.status === 200, `JWKS endpoint returned HTTP ${jwksResponse.status}.`);
const jwks = await json(jwksResponse, 'JWKS endpoint');
requireValue(Array.isArray(jwks.keys) && jwks.keys.length === 1, 'JWKS must expose exactly one active signing key.');
const key = jwks.keys[0];
requireValue(key.kty === 'EC' && key.crv === 'P-256' && key.alg === 'ES256' && key.use === 'sig', 'JWKS key must be an ES256 P-256 signing key.');
requireValue(typeof key.kid === 'string' && key.kid.length >= 8, 'JWKS key ID is missing.');
requireValue(!('d' in key), 'JWKS must not expose private key material.');
requireValue(
  key.x === localExpectedLicenseJwk.x && key.y === localExpectedLicenseJwk.y,
  'JWKS does not match the public key pinned in the extension.',
);
report('public license verification key');

for (const plan of ['pro_monthly', 'pro_yearly', 'lifetime']) {
  const response = await request(baseUrl, '/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      legalAccepted: true,
      immediatePerformanceRequested: true,
      legalVersion: config.legal.version,
    }),
  });
  requireValue(response.status === 401, `${plan} must be ready and reject unauthenticated checkout with HTTP 401; received ${response.status}.`);
}
const portalResponse = await request(baseUrl, '/api/create-portal-session', { method: 'POST' });
requireValue(portalResponse.status === 401, `Customer Portal must be ready and reject unauthenticated access with HTTP 401; received ${portalResponse.status}.`);
const licenseResponse = await request(baseUrl, '/api/license');
requireValue(licenseResponse.status === 401, `License endpoint must fail closed with HTTP 401; received ${licenseResponse.status}.`);
const signupValidationResponse = await request(baseUrl, '/api/auth/sign-up', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: baseUrl },
  body: JSON.stringify({ email: 'invalid', password: 'short' }),
});
requireValue(signupValidationResponse.status === 400, 'Website signup proxy is unavailable or does not validate input.');
report('Monthly, Yearly, Lifetime, portal and license fail-closed authentication');

const invalidWebhook = await request(baseUrl, '/api/stripe-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
requireValue(invalidWebhook.status === 400, `Unsigned webhook must be rejected with HTTP 400; received ${invalidWebhook.status}.`);
report('unsigned Stripe webhook rejection');

const allowedCors = await request(baseUrl, '/api/health', { headers: { Origin: baseUrl } });
requireValue(allowedCors.headers.get('access-control-allow-origin') === baseUrl, 'First-party CORS origin is not allowed exactly.');
const rejectedCors = await request(baseUrl, '/api/health', { headers: { Origin: 'https://untrusted.invalid' } });
requireValue(!rejectedCors.headers.has('access-control-allow-origin'), 'Untrusted CORS origin was allowed.');
const rejectedExtensionCors = await request(baseUrl, '/api/health', { headers: { Origin: firefoxExtensionOrigin } });
requireValue(!rejectedExtensionCors.headers.has('access-control-allow-origin'), 'Normal API routes allowed a browser extension origin.');
const capabilityCors = await request(baseUrl, '/api/extension-auth/token', {
  method: 'OPTIONS',
  headers: { Origin: firefoxExtensionOrigin },
});
requireValue(
  capabilityCors.headers.get('access-control-allow-origin') === firefoxExtensionOrigin,
  'Extension capability endpoint is missing scoped CORS.',
);
report('site-only API CORS with scoped extension capability endpoints');

console.log(`LIVE READY ${baseUrl}`);
} catch (error) {
  console.error(`LIVE NOT READY: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

import 'dotenv/config';
import {
  isAuthUrl,
  isDatabaseUrl,
  isPkcs8PrivateKey,
  isStripePortalConfigurationId,
  isStripePriceId,
  isStripeSecretKey,
  isStripeWebhookSecret,
} from '../lib/config.mjs';

function publicUrlReady(input) {
  try {
    const parsed = new URL(input || '');
    const local = parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    return parsed.protocol === 'https:' || local;
  } catch {
    return false;
  }
}

const checks = new Map([
  ['PUBLIC_URL', publicUrlReady(process.env.PUBLIC_URL)],
  ['STRIPE_SECRET_KEY', isStripeSecretKey(process.env.STRIPE_SECRET_KEY)],
  ['STRIPE_WEBHOOK_SECRET', isStripeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)],
  ['STRIPE_PRICE_PRO_MONTHLY', isStripePriceId(process.env.STRIPE_PRICE_PRO_MONTHLY)],
  ['STRIPE_PRICE_PRO_YEARLY', isStripePriceId(process.env.STRIPE_PRICE_PRO_YEARLY)],
  ['STRIPE_PRICE_LIFETIME', isStripePriceId(process.env.STRIPE_PRICE_LIFETIME)],
  ['STRIPE_PORTAL_CONFIGURATION_ID', isStripePortalConfigurationId(process.env.STRIPE_PORTAL_CONFIGURATION_ID)],
  ['DATABASE_URL', isDatabaseUrl(process.env.DATABASE_URL)],
  ['NEON_AUTH_URL', isAuthUrl(process.env.NEON_AUTH_URL)],
  ['LICENSE_PRIVATE_KEY_PKCS8_B64', isPkcs8PrivateKey(process.env.LICENSE_PRIVATE_KEY_PKCS8_B64)],
  ['PAID_ENTITLEMENTS_ENABLED', process.env.PAID_ENTITLEMENTS_ENABLED === 'true'],
]);

for (const [name, ready] of checks) {
  console.log(`${ready ? 'OK' : 'MISSING/INVALID'} ${name}`);
}

if ([...checks.values()].some(ready => !ready)) process.exitCode = 1;

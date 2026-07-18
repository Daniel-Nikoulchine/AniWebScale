import 'dotenv/config';
import {
  isAuthUrl,
  isBase64Key,
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

function retentionDays(input) {
  const days = Number.parseInt(input || '', 10);
  return Number.isInteger(days) && days >= 0 && days <= 3_650;
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
  ['PRIVACY_HASH_KEY_B64', isBase64Key(process.env.PRIVACY_HASH_KEY_B64)],
  ['OPERATIONS_MONITOR_TOKEN', String(process.env.OPERATIONS_MONITOR_TOKEN || '').trim().length >= 32],
  ['LICENSE_PRIVATE_KEY_PKCS8_B64', isPkcs8PrivateKey(process.env.LICENSE_PRIVATE_KEY_PKCS8_B64)],
  ['PAID_ENTITLEMENTS_ENABLED', process.env.PAID_ENTITLEMENTS_ENABLED === 'true'],
  ['LEGAL_REVIEW_APPROVED', process.env.LEGAL_REVIEW_APPROVED === 'true'],
  ['TAX_CONFIGURATION_APPROVED', process.env.TAX_CONFIGURATION_APPROVED === 'true'],
  ['DATA_PROTECTION_APPROVED', process.env.DATA_PROTECTION_APPROVED === 'true'],
  ['PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS', retentionDays(process.env.PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS)],
  ['PRIVACY_NEON_PITR_RETENTION_DAYS', retentionDays(process.env.PRIVACY_NEON_PITR_RETENTION_DAYS)],
  ['PRIVACY_AUTH_SESSION_RETENTION_DAYS', retentionDays(process.env.PRIVACY_AUTH_SESSION_RETENTION_DAYS)],
  ['PRIVACY_VENDOR_REVIEW_DATE', /^\d{4}-\d{2}-\d{2}$/.test(process.env.PRIVACY_VENDOR_REVIEW_DATE || '')],
  ['PRIVACY_TRANSFER_SAFEGUARDS', String(process.env.PRIVACY_TRANSFER_SAFEGUARDS || '').trim().length >= 10],
  ['LEGAL_TAX_NOTICE', Boolean(process.env.LEGAL_TAX_NOTICE?.trim())],
]);

for (const [name, ready] of checks) {
  console.log(`${ready ? 'OK' : 'MISSING/INVALID'} ${name}`);
}

if ([...checks.values()].some(ready => !ready)) process.exitCode = 1;

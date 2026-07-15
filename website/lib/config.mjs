import { createPrivateKey } from 'node:crypto';

function value(input) {
  return typeof input === 'string' ? input.trim() : '';
}

export function isStripeSecretKey(input) {
  return /^sk_(?:test|live)_[A-Za-z0-9_]{16,}$/.test(value(input));
}

export function isStripeWebhookSecret(input) {
  return /^whsec_[A-Za-z0-9]{16,}$/.test(value(input));
}

export function isStripePriceId(input) {
  return /^price_[A-Za-z0-9]{12,}$/.test(value(input));
}

export function isStripePortalConfigurationId(input) {
  return /^bpc_[A-Za-z0-9]{12,}$/.test(value(input));
}

export function isDatabaseUrl(input) {
  try {
    const parsed = new URL(value(input));
    return (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:')
      && Boolean(parsed.hostname)
      && Boolean(parsed.username)
      && !value(input).includes('replace_with');
  } catch {
    return false;
  }
}

export function isAuthUrl(input) {
  try {
    const parsed = new URL(value(input));
    const localDevelopment = parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    return (parsed.protocol === 'https:' || localDevelopment)
      && parsed.pathname.replace(/\/$/, '').endsWith('/auth');
  } catch {
    return false;
  }
}

export function isPkcs8PrivateKey(input) {
  try {
    const pem = Buffer.from(value(input), 'base64').toString('utf8');
    if (!pem.startsWith('-----BEGIN PRIVATE KEY-----')) return false;
    const key = createPrivateKey(pem);
    return key.asymmetricKeyType === 'ec'
      && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
  } catch {
    return false;
  }
}

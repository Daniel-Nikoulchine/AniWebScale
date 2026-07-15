import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  isAuthUrl,
  isDatabaseUrl,
  isPkcs8PrivateKey,
  isStripePortalConfigurationId,
  isStripePriceId,
  isStripeSecretKey,
  isStripeWebhookSecret,
} from '../lib/config.mjs';

describe('runtime configuration validation', () => {
  it('accepts the expected Stripe identifier families', () => {
    assert.equal(isStripeSecretKey(`sk_test_${'a'.repeat(24)}`), true);
    assert.equal(isStripeWebhookSecret(`whsec_${'b'.repeat(24)}`), true);
    assert.equal(isStripePriceId(`price_${'c'.repeat(24)}`), true);
    assert.equal(isStripePortalConfigurationId(`bpc_${'d'.repeat(24)}`), true);
  });

  it('rejects publishable keys and setup placeholders', () => {
    assert.equal(isStripeSecretKey(`pk_test_${'a'.repeat(24)}`), false);
    assert.equal(isStripeSecretKey('sk_test_replace_me'), false);
    assert.equal(isStripeWebhookSecret('whsec_replace_me'), false);
    assert.equal(isStripePriceId('price_replace_me'), false);
  });

  it('requires usable database and auth URLs', () => {
    assert.equal(isDatabaseUrl('postgresql://owner:secret@db.example/neondb?sslmode=require'), true);
    assert.equal(isDatabaseUrl('postgresql://replace_with_neon_connection_string'), false);
    assert.equal(isAuthUrl('https://example.neonauth.example/neondb/auth'), true);
    assert.equal(isAuthUrl('http://example.com/auth'), false);
    assert.equal(isAuthUrl('http://localhost:3000/auth'), true);
  });

  it('accepts only an EC P-256 PKCS8 signing key', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    assert.equal(isPkcs8PrivateKey(Buffer.from(pem).toString('base64')), true);
    assert.equal(isPkcs8PrivateKey('replace_with_generated_base64_pkcs8'), false);
  });
});

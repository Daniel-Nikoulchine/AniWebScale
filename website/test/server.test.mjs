import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAID_ENTITLEMENTS_ENABLED = 'false';
const { createWebsiteServer } = await import('../server.mjs');

let server;
let baseUrl;

before(async () => {
  server = createWebsiteServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('website server', () => {
  it('serves the complete landing page with security headers', async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /checkout\.stripe\.com/);
    assert.match(html, /AniWebScale/);
    assert.doesNotMatch(html, /Anime4K Browser/);
    assert.match(html, /Simple, honest pricing/);
    assert.match(html, /A modern GPU is required/);
    assert.match(html, /id="gpu-requirements"/);
    assert.match(html, /id="features"/);
    assert.match(html, /id="faq"/);
    assert.match(html, /Crunchyroll, Netflix and similar services require Native/);
    assert.match(html, /Netflix, Prime Video, Disney\+ &amp; more via Native\*/);
    assert.match(html, /Protected-stream compatibility depends on the service/);
    const freePricingCard = html.match(/<article class="price-card reveal">.*?<\/article>/s)?.[0] || '';
    assert.doesNotMatch(freePricingCard, /Fullscreen automation|Live performance stats/);
    assert.match(freePricingCard, /Anime4K real-time presets/);
    assert.match(freePricingCard, /WebGPU renderer/);
    assert.match(html, /data-plan="pro_monthly"/);
    assert.match(html, /data-price="pro">\$4\.99/);
    assert.match(html, /data-price="lifetime">\$59\.99/);
    assert.doesNotMatch(html, /class="[^"]*\bcloud\b/);
    assert.doesNotMatch(html, /(?:&copy;|©).*AniWebScale/);
  });

  it('does not ship decorative cloud styles', async () => {
    const response = await fetch(`${baseUrl}/styles.css`);
    const css = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(css, /\.cloud(?:\b|-)/);
  });

  it('exposes only public configuration', async () => {
    const response = await fetch(`${baseUrl}/api/config`);
    const config = await response.json();
    assert.equal(response.status, 200);
    assert.equal(config.prices.currency, '$');
    assert.deepEqual(config.prices, { monthly: '4.99', yearly: '41.99', lifetime: '59.99', currency: '$' });
    assert.equal(config.legal.name, 'Korrespont GbR');
    assert.equal(config.legal.email, 'support@korrespont.com');
    assert.equal(config.legal.address, 'Paterkamp 11a, 59348 Lüdinghausen, Deutschland');
    assert.equal(config.legal.representatives, 'Karim Mahmoudi and Daniel Nikoulchine');
    assert.deepEqual(config.checkout, { proMonthly: false, proYearly: false, lifetime: false });
    assert.equal('secretKey' in config, false);
    assert.equal(JSON.stringify(config).includes('sk_test_'), false);
  });

  it('rejects unknown checkout plans', async () => {
    const response = await fetch(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'made_up_plan' }),
    });
    assert.equal(response.status, 400);
  });

  it('rejects retired supporter plan identifiers', async () => {
    const response = await fetch(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'supporter_monthly' }),
    });
    assert.equal(response.status, 400);
  });

  it('keeps checkout in safe preview mode without Stripe secrets', async () => {
    const response = await fetch(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'lifetime' }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not configured/i);
  });

  it('keeps Pro checkout disabled until paid fulfillment is connected', async () => {
    const response = await fetch(`${baseUrl}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro_monthly' }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /paid Pro fulfillment/i);
  });

  it('serves legal and fallback pages', async () => {
    const privacy = await fetch(`${baseUrl}/privacy.html`);
    const extensionlessPrivacy = await fetch(`${baseUrl}/privacy`);
    const missing = await fetch(`${baseUrl}/definitely-missing`);
    assert.equal(privacy.status, 200);
    assert.equal(extensionlessPrivacy.status, 200);
    assert.match(await privacy.text(), /Payments through Stripe/);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /between the frames/);
  });

  it('serves the account UI and a public license verification key', async () => {
    const account = await fetch(`${baseUrl}/account.html`);
    const extensionlessAccount = await fetch(`${baseUrl}/account`);
    const jwks = await fetch(`${baseUrl}/api/license/jwks.json`);
    assert.equal(account.status, 200);
    assert.equal(extensionlessAccount.status, 200);
    assert.match(await account.text(), /One account/);
    assert.equal(jwks.status, 200);
    const body = await jwks.json();
    assert.equal(body.keys.length, 1);
    assert.equal(body.keys[0].alg, 'ES256');
    assert.equal('d' in body.keys[0], false);
  });

  it('serves the local Lucide icon library assets', async () => {
    const stylesheet = await fetch(`${baseUrl}/vendor/lucide/lucide.css`);
    const font = await fetch(`${baseUrl}/vendor/lucide/lucide.woff2`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get('content-type'), /text\/css/);
    assert.match(await stylesheet.text(), /\.icon-sun::before/);
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/woff2');
  });
});

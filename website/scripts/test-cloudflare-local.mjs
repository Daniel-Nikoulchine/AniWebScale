import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import Stripe from 'stripe';
import { isStripeWebhookSecret } from '../lib/config.mjs';

const port = 8788;
const origin = `http://127.0.0.1:${port}`;
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const localValues = parseDotenv(await readFile('.env'));
const output = [];
const child = spawn(process.execPath, [
  wrangler,
  'pages',
  'dev',
  '--ip=127.0.0.1',
  `--port=${port}`,
  '--log-level=error',
  '--show-interactive-dev-session=false',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    WRANGLER_SEND_METRICS: 'false',
    ...(localValues.DATABASE_URL
      ? { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: localValues.DATABASE_URL }
      : {}),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', chunk => output.push(chunk.toString()));
child.stderr.on('data', chunk => output.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler exited early (${child.exitCode}).\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return response;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Wrangler did not start within 30 seconds.\n${output.join('')}`);
}

function stopServer() {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
}

try {
  const healthResponse = await waitForServer();
  const health = await healthResponse.json();
  assert.equal(health.runtime, 'cloudflare-pages-functions');
  assert.equal(typeof health.fulfillmentReady, 'boolean');
  if (health.fulfillmentReady) {
    assert.equal(health.stripeConfigured, true);
    assert.equal(health.databaseConfigured, true);
    assert.equal(health.authConfigured, true);
    assert.equal(health.webhookConfigured, true);
    assert.equal(health.licenseKeyConfigured, true);
    assert.equal(health.portalConfigured, true);
  }

  const pageResponse = await fetch(`${origin}/`);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /AniWebScale/);

  const iconResponse = await fetch(`${origin}/vendor/lucide/lucide.css`);
  assert.equal(iconResponse.status, 200);
  assert.match(iconResponse.headers.get('cache-control') || '', /max-age=86400/);

  const missingResponse = await fetch(`${origin}/api/missing`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: 'API route not found.' });

  const jwksResponse = await fetch(`${origin}/api/license/jwks.json`);
  assert.equal(jwksResponse.status, 200);
  const jwks = await jwksResponse.json();
  assert.equal(jwks.keys?.[0]?.alg, 'ES256');
  assert.equal(jwks.keys?.[0]?.kty, 'EC');

  if (health.stripeConfigured && health.databaseConfigured && health.webhookConfigured) {
    const webhookResponse = await fetch(`${origin}/api/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=0,v1=invalid',
      },
      body: '{}',
    });
    assert.equal(webhookResponse.status, 400);
    assert.deepEqual(await webhookResponse.json(), {
      error: 'Invalid webhook signature.',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    });

    if (isStripeWebhookSecret(localValues.STRIPE_WEBHOOK_SECRET)) {
      const stripe = new Stripe(localValues.STRIPE_SECRET_KEY);
      const eventPayload = JSON.stringify({
        id: `evt_aniwebscale_local_${Date.now()}`,
        object: 'event',
        type: 'aniwebscale.deployment.test',
        data: { object: { id: `test_${Date.now()}` } },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: eventPayload,
        secret: localValues.STRIPE_WEBHOOK_SECRET,
      });
      const signedResponse = await fetch(`${origin}/api/stripe-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: eventPayload,
      });
      const signedResult = await signedResponse.json();
      assert.equal(
        signedResponse.status,
        200,
        `Signed local webhook failed: ${JSON.stringify(signedResult)}\n${output.join('')}`,
      );
      assert.equal(signedResult.received, true);
      assert.equal(signedResult.duplicate, false);
    }
  }

  console.log('Cloudflare Pages local runtime: static assets and Pages Functions passed.');
} finally {
  stopServer();
}

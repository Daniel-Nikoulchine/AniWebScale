import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import pg from 'pg';
import Stripe from 'stripe';
import { isStripeWebhookSecret } from '../lib/config.mjs';

const port = 8788;
const origin = `http://127.0.0.1:${port}`;
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
let hasLocalEnv = process.env.CLOUDFLARE_LOCAL_IGNORE_ENV !== '1';
const localValues = parseDotenv(hasLocalEnv ? await readFile('.env').catch(error => {
  if (error?.code !== 'ENOENT') throw error;
  hasLocalEnv = false;
  return '';
}) : '');
if (!hasLocalEnv) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  Object.assign(localValues, {
    PUBLIC_URL: origin,
    LICENSE_PRIVATE_KEY_PKCS8_B64: Buffer.from(
      privateKey.export({ type: 'pkcs8', format: 'pem' }),
    ).toString('base64'),
    PAID_ENTITLEMENTS_ENABLED: 'false',
  });
}
const output = [];
const wranglerArguments = [
  wrangler,
  'pages',
  'dev',
  '--ip=127.0.0.1',
  `--port=${port}`,
  '--log-level=error',
  '--show-interactive-dev-session=false',
];
if (!hasLocalEnv) {
  for (const [key, value] of Object.entries(localValues)) {
    wranglerArguments.push('--binding', `${key}=${value}`);
  }
}
const child = spawn(process.execPath, wranglerArguments, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    WRANGLER_SEND_METRICS: 'false',
    ...(!hasLocalEnv
      ? { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres' }
      : localValues.DATABASE_URL
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
  assert.deepEqual(health, { ok: true });
  let readiness;
  const operationsToken = String(localValues.OPERATIONS_MONITOR_TOKEN || '').trim();
  if (operationsToken.length >= 32) {
    const response = await fetch(`${origin}/api/operations/status`, {
      headers: { Authorization: `Bearer ${operationsToken}` },
    });
    assert.ok(response.status === 200 || response.status === 503);
    readiness = (await response.json()).readiness;
    assert.equal(readiness?.runtime, 'cloudflare-pages-functions');
  }
  if (readiness?.fulfillmentReady) {
    assert.equal(readiness.stripeConfigured, true);
    assert.equal(readiness.databaseConfigured, true);
    assert.equal(readiness.authConfigured, true);
    assert.equal(readiness.webhookConfigured, true);
    assert.equal(readiness.licenseKeyConfigured, true);
    assert.equal(readiness.portalConfigured, true);
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

  if (readiness?.databaseConfigured && readiness.authConfigured && localValues.DATABASE_URL) {
    const email = `cloudflare-local-signup-${Date.now()}@example.invalid`;
    const signupResponse = await fetch(`${origin}/api/auth/sign-up`, {
      method: 'POST',
      headers: {
        Origin: localValues.PUBLIC_URL || 'https://aniwebscale.pages.dev',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: 'correct horse battery staple',
        name: 'Cloudflare local signup test',
      }),
    });
    const signup = await signupResponse.json();
    if (!readiness.dataProtectionApproved) {
      assert.equal(signupResponse.status, 503);
      assert.equal(signup.code, 'DATA_PROTECTION_APPROVAL_REQUIRED');
      console.log('Cloudflare signup is fail-closed until data-protection approval.');
    } else {
      assert.equal(
        signupResponse.status,
        200,
        `Cloudflare signup failed: ${JSON.stringify(signup)}\n${output.join('')}`,
      );
      assert.equal(signup.success, true);
      const client = new pg.Client({ connectionString: localValues.DATABASE_URL });
      await client.connect();
      try {
        const user = await client.query(
          `SELECT id FROM neon_auth."user" WHERE email = $1`,
          [email],
        );
        assert.equal(user.rowCount, 1);
        await client.query(`DELETE FROM neon_auth."user" WHERE id = $1`, [user.rows[0].id]);
      } finally {
        await client.end();
      }
    }
  }

  if (readiness?.stripeConfigured && readiness.databaseConfigured && readiness.webhookConfigured) {
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

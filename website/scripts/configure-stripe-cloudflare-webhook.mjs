import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import Stripe from 'stripe';
import { isStripeSecretKey, isStripeWebhookSecret } from '../lib/config.mjs';

const argumentsList = process.argv.slice(2);

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  return argumentsList.find(value => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

const projectName = option('project', 'aniwebscale');
const publicUrl = option('public-url', 'https://aniwebscale.pages.dev').replace(/\/$/, '');
const environmentFile = option('env-file', '.env');
const endpointUrl = `${publicUrl}/api/stripe-webhook`;
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const events = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];

function run(executable, args, { capture = false, input } = {}) {
  return new Promise((resolvePromise, reject) => {
    const stdout = [];
    const stderr = [];
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
      windowsHide: true,
    });
    if (capture) {
      child.stdout.on('data', chunk => stdout.push(chunk.toString()));
      child.stderr.on('data', chunk => stderr.push(chunk.toString()));
    }
    child.stdin.end(input ?? '');
    child.once('error', reject);
    child.once('exit', code => {
      const output = stdout.join('');
      const errors = stderr.join('');
      if (code === 0) return resolvePromise({ output, errors });
      reject(new Error(`${executable} exited with code ${code}. ${errors || output}`.trim()));
    });
  });
}

function runWrangler(args, options) {
  return run(process.execPath, [wrangler, ...args], options);
}

async function putSecret(name, value) {
  console.log(`Uploading Cloudflare binding: ${name}`);
  await runWrangler(['pages', 'secret', 'put', name, `--project-name=${projectName}`], {
    input: value,
  });
}

async function deploy() {
  await run(process.execPath, ['scripts/bootstrap-cloudflare.mjs', '--skip-secrets']);
}

async function deploymentReadiness() {
  const operationsToken = String(values.OPERATIONS_MONITOR_TOKEN || '').trim();
  if (operationsToken.length < 32) throw new Error('OPERATIONS_MONITOR_TOKEN is missing or invalid.');
  const response = await fetch(`${publicUrl}/api/operations/status`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${operationsToken}` },
  });
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`Protected Cloudflare readiness returned ${response.status}.`);
  }
  const status = await response.json();
  if (!status.readiness) throw new Error('Protected Cloudflare readiness is missing.');
  return status.readiness;
}

const values = parseDotenv(await readFile(environmentFile));
if (!isStripeSecretKey(values.STRIPE_SECRET_KEY)) {
  throw new Error('STRIPE_SECRET_KEY is missing or invalid.');
}
if (values.STRIPE_SECRET_KEY.startsWith('sk_live_')
  && (values.LEGAL_REVIEW_APPROVED !== 'true'
    || values.TAX_CONFIGURATION_APPROVED !== 'true'
    || !values.LEGAL_TAX_NOTICE?.trim())) {
  throw new Error(
    'Live Stripe setup requires LEGAL_REVIEW_APPROVED=true, '
    + 'TAX_CONFIGURATION_APPROVED=true, and a reviewed LEGAL_TAX_NOTICE.',
  );
}

const stripe = new Stripe(values.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
  appInfo: { name: 'AniWebScale Cloudflare Bootstrap', version: '1.0.0' },
});
const endpointList = await stripe.webhookEndpoints.list({ limit: 100 });
let endpoint = endpointList.data.find(item => item.url === endpointUrl && item.status === 'enabled');
let signingSecret;

if (!endpoint) {
  endpoint = await stripe.webhookEndpoints.create({
    url: endpointUrl,
    enabled_events: events,
    description: 'AniWebScale Cloudflare Pages payment fulfillment',
    metadata: {
      product: 'aniwebscale',
      managed_by: 'aniwebscale-cloudflare-bootstrap',
    },
  });
  signingSecret = endpoint.secret || '';
  if (!isStripeWebhookSecret(signingSecret)) {
    throw new Error('Stripe created the endpoint without returning a valid signing secret.');
  }
  console.log(`Created Stripe webhook endpoint ${endpoint.id} (${endpoint.livemode ? 'live' : 'test'} mode).`);
} else {
  const managed = endpoint.metadata?.managed_by === 'aniwebscale-cloudflare-bootstrap';
  if (!managed) {
    throw new Error(
      `A Stripe endpoint already uses ${endpointUrl}, but its signing secret is not recoverable. `
      + 'Disable it or set the matching Cloudflare secret manually before continuing.',
    );
  }
  await stripe.webhookEndpoints.update(endpoint.id, { disabled: true });
  const replacedEndpointId = endpoint.id;
  endpoint = await stripe.webhookEndpoints.create({
    url: endpointUrl,
    enabled_events: events,
    description: 'AniWebScale Cloudflare Pages payment fulfillment',
    metadata: {
      product: 'aniwebscale',
      managed_by: 'aniwebscale-cloudflare-bootstrap',
    },
  });
  signingSecret = endpoint.secret || '';
  if (!isStripeWebhookSecret(signingSecret)) {
    throw new Error('Stripe replaced the endpoint without returning a valid signing secret.');
  }
  console.log(`Rotated managed Stripe webhook endpoint ${replacedEndpointId} to ${endpoint.id}.`);
}

if (signingSecret) {
  await putSecret('STRIPE_WEBHOOK_SECRET', signingSecret);
  await putSecret('PAID_ENTITLEMENTS_ENABLED', 'false');
  await deploy();

  const eventPayload = JSON.stringify({
    id: `evt_aniwebscale_cloudflare_${Date.now()}`,
    object: 'event',
    type: 'aniwebscale.deployment.test',
    data: { object: { id: `test_${Date.now()}` } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: signingSecret,
  });
  async function probe(expectedDuplicate) {
    const deadline = Date.now() + 30_000;
    let lastStatus = 0;
    let lastResult = {};
    let transientFailureSeen = false;
    while (Date.now() < deadline) {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: eventPayload,
      });
      const result = await response.json().catch(() => ({}));
      lastStatus = response.status;
      lastResult = result;
      if (response.ok && result.received === true && result.duplicate === expectedDuplicate) return;
      if (!expectedDuplicate
        && transientFailureSeen
        && response.ok
        && result.received === true
        && result.duplicate === true) return;
      const retryable = result.code === 'WEBHOOK_SIGNATURE_INVALID'
        || result.code === 'ENTITLEMENT_UPDATE_FAILED'
        || response.status >= 500;
      if (!retryable) break;
      transientFailureSeen = true;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 1_000));
    }
    throw new Error(
      `Stripe webhook probe failed with status ${lastStatus}`
      + `${lastResult.code ? ` (${lastResult.code})` : ''}.`,
    );
  }

  await probe(false);
  await probe(true);
  console.log('Signed Stripe webhook and retry idempotency probes passed.');
}

await putSecret('PAID_ENTITLEMENTS_ENABLED', 'true');
await deploy();

const readiness = await deploymentReadiness();
if (!readiness.fulfillmentReady) {
  throw new Error('Cloudflare is deployed, but paid fulfillment remains unavailable.');
}
const configResponse = await fetch(`${publicUrl}/api/config`, { cache: 'no-store' });
const config = await configResponse.json();
if (!config.checkout?.proMonthly || !config.checkout?.proYearly || !config.checkout?.lifetime) {
  throw new Error('One or more Stripe Checkout plans remain unavailable.');
}

const obsoleteEndpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter(item => (
  item.id !== endpoint.id
  && item.status === 'disabled'
  && item.metadata?.managed_by === 'aniwebscale-cloudflare-bootstrap'
  && item.url === endpointUrl
));
for (const obsolete of obsoleteEndpoints) {
  await stripe.webhookEndpoints.del(obsolete.id);
}

console.log(`Stripe webhook and paid fulfillment are ready at ${publicUrl}.`);

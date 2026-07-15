import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import {
  isAuthUrl,
  isDatabaseUrl,
  isPkcs8PrivateKey,
  isStripePortalConfigurationId,
  isStripePriceId,
  isStripeSecretKey,
  isStripeWebhookSecret,
} from '../lib/config.mjs';

const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const argumentsList = process.argv.slice(2);

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  return argumentsList.find(value => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

const projectName = option('project', 'aniwebscale');
const environmentFile = option('env-file', '.env');
const enablePaid = argumentsList.includes('--enable-paid');
const skipSecrets = argumentsList.includes('--skip-secrets');
const uploadWebhookSecret = argumentsList.includes('--upload-webhook-secret');

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

function parseJsonOutput(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('Wrangler returned no JSON project list.');
  return JSON.parse(clean.slice(start, end + 1));
}

function validatePaidConfiguration(values) {
  const checks = {
    STRIPE_SECRET_KEY: isStripeSecretKey(values.STRIPE_SECRET_KEY),
    STRIPE_PRICE_PRO_MONTHLY: isStripePriceId(values.STRIPE_PRICE_PRO_MONTHLY),
    STRIPE_PRICE_PRO_YEARLY: isStripePriceId(values.STRIPE_PRICE_PRO_YEARLY),
    STRIPE_PRICE_LIFETIME: isStripePriceId(values.STRIPE_PRICE_LIFETIME),
    STRIPE_PORTAL_CONFIGURATION_ID: isStripePortalConfigurationId(
      values.STRIPE_PORTAL_CONFIGURATION_ID,
    ),
    DATABASE_URL: isDatabaseUrl(values.DATABASE_URL),
    NEON_AUTH_URL: isAuthUrl(values.NEON_AUTH_URL),
    LICENSE_PRIVATE_KEY_PKCS8_B64: isPkcs8PrivateKey(values.LICENSE_PRIVATE_KEY_PKCS8_B64),
  };
  if (uploadWebhookSecret) {
    checks.STRIPE_WEBHOOK_SECRET = isStripeWebhookSecret(values.STRIPE_WEBHOOK_SECRET);
  }
  const invalid = Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name);
  if (invalid.length) {
    throw new Error(`Paid deployment is missing valid values for: ${invalid.join(', ')}`);
  }
}

async function deployedProject() {
  const { output } = await runWrangler(['pages', 'project', 'list', '--json'], { capture: true });
  return parseJsonOutput(output).find(project => (
    project.name === projectName || project['Project Name'] === projectName
  )) || null;
}

function projectOrigin(project) {
  const configured = option('public-url');
  if (configured) return configured.replace(/\/$/, '');
  const pagesDomain = project?.domains?.find(domain => domain.endsWith('.pages.dev'))
    || project?.subdomain
    || project?.['Project Domains']?.split(',').map(domain => domain.trim())
      .find(domain => domain.endsWith('.pages.dev'));
  return `https://${pagesDomain || `${projectName}.pages.dev`}`;
}

const uploadKeys = [
  'PUBLIC_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_LIFETIME',
  'STRIPE_PORTAL_CONFIGURATION_ID',
  'STRIPE_AUTOMATIC_TAX',
  'PAID_ENTITLEMENTS_ENABLED',
  'DATABASE_URL',
  'NEON_AUTH_URL',
  'LICENSE_PRIVATE_KEY_PKCS8_B64',
  'LICENSE_AUDIENCE',
  'PUBLIC_PRICE_MONTHLY',
  'PUBLIC_PRICE_YEARLY',
  'PUBLIC_PRICE_LIFETIME',
  'PUBLIC_CURRENCY',
  'CHROME_STORE_URL',
  'FIREFOX_ADDONS_URL',
  'GITHUB_REPO_URL',
  'LEGAL_NAME',
  'LEGAL_EMAIL',
  'LEGAL_ADDRESS',
  'LEGAL_REPRESENTATIVES',
  'LEGAL_VAT_ID',
];
if (uploadWebhookSecret) uploadKeys.push('STRIPE_WEBHOOK_SECRET');

try {
  await runWrangler(['whoami'], { capture: true });
} catch {
  throw new Error('Cloudflare is not authenticated. Run `npx wrangler login` and retry.');
}

let project = await deployedProject();
if (!project) {
  await runWrangler([
    'pages',
    'project',
    'create',
    projectName,
    '--production-branch=main',
    '--compatibility-date=2026-07-15',
    '--compatibility-flags=nodejs_compat',
  ]);
  project = await deployedProject();
}

const values = parseDotenv(await readFile(environmentFile));
const publicUrl = projectOrigin(project);
values.PUBLIC_URL = publicUrl;
values.PAID_ENTITLEMENTS_ENABLED = enablePaid ? 'true' : 'false';
if (enablePaid) validatePaidConfiguration(values);

if (!skipSecrets) {
  for (const key of uploadKeys) {
    if (!values[key]) continue;
    console.log(`Uploading Cloudflare binding: ${key}`);
    await runWrangler(['pages', 'secret', 'put', key, `--project-name=${projectName}`], {
      input: values[key],
    });
  }
}

await run(process.execPath, ['scripts/build-client.mjs']);
await runWrangler([
  'pages',
  'deploy',
  '--project-name',
  projectName,
  '--branch=main',
  '--commit-dirty=true',
]);

async function waitForHealth() {
  const deadline = Date.now() + 30_000;
  let lastStatus = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${publicUrl}/api/health`, { cache: 'no-store' });
      lastStatus = String(response.status);
      if (response.ok) return response.json();
    } catch {
      lastStatus = 'unreachable';
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Cloudflare health check remained ${lastStatus} after 30 seconds.`);
}

const health = await waitForHealth();
if (health.runtime !== 'cloudflare-pages-functions') {
  throw new Error('The deployment did not return the Cloudflare Pages Functions runtime marker.');
}
if (enablePaid && !health.fulfillmentReady) {
  throw new Error('Cloudflare deployed, but paid fulfillment is not ready.');
}

console.log(`Cloudflare Pages deployment ready at ${publicUrl}`);
console.log(`Paid fulfillment: ${health.fulfillmentReady ? 'ready' : 'disabled (fail-closed)'}`);

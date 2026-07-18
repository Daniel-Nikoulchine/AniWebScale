import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const websiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!port) throw new Error('Could not allocate a local readiness-test port.');
  return port;
}

function signingKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  return {
    privateKeyBase64: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
    publicJwk,
  };
}

async function waitForHealth(baseUrl, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Readiness test server exited with ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // The child process can need a few polling intervals to start listening.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Readiness test server did not become healthy.');
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = new Promise(resolve => child.once('exit', resolve));
  const timedOut = new Promise(resolve => setTimeout(() => resolve('timeout'), 3_000));
  if (await Promise.race([exited, timedOut]) === 'timeout' && child.exitCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

const port = await availablePort();
const baseUrl = `http://localhost:${port}`;
const licenseKey = signingKey();
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  PUBLIC_URL: baseUrl,
  STRIPE_SECRET_KEY: `sk_test_${'a'.repeat(24)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${'b'.repeat(24)}`,
  STRIPE_PRICE_PRO_MONTHLY: 'price_Monthly1234567890',
  STRIPE_PRICE_PRO_YEARLY: 'price_Yearly123456789012',
  STRIPE_PRICE_LIFETIME: 'price_Lifetime1234567890',
  STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_Portal123456789012',
  DATABASE_URL: 'postgresql://owner:password@127.0.0.1:5432/neondb?sslmode=require',
  NEON_AUTH_URL: 'https://auth.example.com/neondb/auth',
  LICENSE_PRIVATE_KEY_PKCS8_B64: licenseKey.privateKeyBase64,
  PRIVACY_HASH_KEY_B64: Buffer.alloc(32, 7).toString('base64'),
  OPERATIONS_MONITOR_TOKEN: 'local-operations-monitor-token-1234567890',
  LIVE_EXPECTED_LICENSE_JWK_X: licenseKey.publicJwk.x,
  LIVE_EXPECTED_LICENSE_JWK_Y: licenseKey.publicJwk.y,
  PAID_ENTITLEMENTS_ENABLED: 'true',
  LEGAL_REVIEW_APPROVED: 'true',
  TAX_CONFIGURATION_APPROVED: 'true',
  DATA_PROTECTION_APPROVED: 'true',
  LEGAL_TAX_NOTICE: 'VAT included where applicable.',
  LEGAL_VERSION: '2026-07-17',
  PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS: '1',
  PRIVACY_NEON_PITR_RETENTION_DAYS: '7',
  PRIVACY_AUTH_SESSION_RETENTION_DAYS: '30',
  PRIVACY_VENDOR_REVIEW_DATE: '2026-07-17',
  PRIVACY_TRANSFER_SAFEGUARDS: 'Local readiness fixture with reviewed safeguards.',
  PUBLIC_PRICE_MONTHLY: '4.99',
  PUBLIC_PRICE_YEARLY: '41.99',
  PUBLIC_PRICE_LIFETIME: '59.99',
  PUBLIC_CURRENCY: '$',
  CHROME_STORE_URL: '',
  FIREFOX_ADDONS_URL: '',
  GITHUB_REPO_URL: '',
};

const server = spawn(process.execPath, [join(websiteRoot, 'server.mjs')], {
  cwd: websiteRoot,
  env,
  stdio: ['ignore', 'ignore', 'pipe'],
  windowsHide: true,
});
let serverError = '';
server.stderr.setEncoding('utf8');
server.stderr.on('data', chunk => { serverError += chunk; });

try {
  await waitForHealth(baseUrl, server);
  const check = spawn(process.execPath, [join(websiteRoot, 'scripts', 'check-live-deployment.mjs'), baseUrl], {
    cwd: websiteRoot,
    env: {
      ...env,
      LIVE_ALLOW_LOCAL: '1',
      LIVE_ALLOW_MISSING_STORE_LINKS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  let errorOutput = '';
  check.stdout.setEncoding('utf8');
  check.stderr.setEncoding('utf8');
  check.stdout.on('data', chunk => { output += chunk; });
  check.stderr.on('data', chunk => { errorOutput += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    check.once('error', reject);
    check.once('exit', resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`Local live-readiness check failed (${exitCode}).\n${output}${errorOutput}`);
  }
  if (!output.includes(`LIVE READY ${baseUrl}`)) {
    throw new Error(`Local live-readiness check returned no success marker.\n${output}`);
  }
  console.log('PASS isolated local live-readiness gate');
} finally {
  await stop(server);
  if (serverError && server.exitCode !== 0 && server.signalCode !== 'SIGTERM') process.stderr.write(serverError);
}

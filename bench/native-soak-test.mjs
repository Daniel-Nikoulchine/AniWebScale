#!/usr/bin/env node
/**
 * Native-client soak probe (sandbox E2E, invisible).
 *
 * Runs the REAL RealEsrganNativeVulkanClient through 300 sequential
 * runFrameRgba frames at the E2E clip geometry (540x405 -> 1280x960 target)
 * against a spawned host, inside a headless Firefox content script.
 *
 * Isolates the fetch/host path from the pipeline (no WebGPU, no readback):
 * - soak survives 300  -> the E2E wrapper killer lives pipeline-side
 * - soak dies with stage -> fetch/host-side, exact stage in the trail
 *
 * Result surfaces via the document title beacon (read via remote protocol).
 * Run inside the sandbox wrapper, never visible:
 *   E2E_FIREFOX_BINARY=/usr/bin/zen-browser node scripts/e2e-sandbox.mjs \
 *     --type firefox -- node bench/native-soak-test.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { cmd as webExt } from 'web-ext';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Ephemeral loopback port (avoids Firefox's blocked-port list and stale
// listeners from a previous run).
let ORIGIN = '';
const HOST_BIN = path.join(workspace, 'native/linux-host/build/aniwebscale-ncnn-host');
const ESBUILD_BIN = path.join(workspace, 'node_modules', '.bin', 'esbuild');
const FRAMES = Number(process.env.SOAK_FRAMES || 300);
const SOAK_TIMEOUT_MS = Number(process.env.SOAK_TIMEOUT_MS || 600_000);

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', ORIGIN);
  if (url.pathname === '/__health') { response.writeHead(200); response.end('ok'); return; }
  if (url.pathname === '/' || url.pathname === '/page.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><title>SOAK idle</title></head><body>x</body></html>');
    return;
  }
  response.writeHead(404); response.end();
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port: PORT } = server.address();
ORIGIN = `http://127.0.0.1:${PORT}`;

// --- Start the real host and handshake for port/token ------------------------
function framedWrite(proc, obj) {
  const data = Buffer.from(JSON.stringify(obj));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length);
  proc.stdin.cork?.();
  proc.stdin.write(Buffer.concat([len, data]));
  proc.stdin.uncork?.();
}
function framedRead(proc) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const len = buffer.readUInt32LE(0);
      if (buffer.length < 4 + len) return;
      proc.stdout.removeListener('data', onData);
      proc.stdout.removeListener('end', onEnd);
      resolve(JSON.parse(buffer.subarray(4, 4 + len).toString()));
    };
    const onEnd = () => {
      proc.stdout.removeListener('data', onData);
      reject(new Error('host stdout ended before a framed reply'));
    };
    proc.stdout.on('data', onData);
    proc.stdout.once('end', onEnd);
  });
}

const host = spawn(HOST_BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] });
host.stderr.on('data', d => console.error('[host]', d.toString().trim().split('\n').slice(-1).join('\n').slice(0, 200)));
framedWrite(host, { type: 'hello', protocolVersion: 3, requestId: 'soak1' });
const hello = await framedRead(host);
const TEST_PORT = hello.httpPort;
const TEST_TOKEN = hello.httpToken;
console.log('[soak] host ready on 127.0.0.1:' + TEST_PORT + ` frames=${FRAMES}`);

// --- Bundle the real client + soak loop --------------------------------------
mkdirSync(path.join(workspace, '.tmp/soaktest'), { recursive: true });
writeFileSync(path.join(workspace, '.tmp/soaktest/soak-entry.ts'), `
const TESTPORT = ${TEST_PORT};
const TESTTOKEN = ${JSON.stringify(TEST_TOKEN)};
const FRAMES = ${FRAMES};
// eslint-disable-next-line
import { RealEsrganNativeVulkanClient } from '../../src/core/realesrgan-native-vulkan-client';

function safeText(error: unknown): string {
  try {
    const message = (error as { message?: unknown })?.message;
    if (typeof message === 'string' && message) return message.slice(0, 80);
  } catch { /* fall through */ }
  try { return String(error).slice(0, 80); } catch { return 'unreadable'; }
}

(async () => {
  const title = (text: string) => { document.title = 'SOAK ' + text; };
  title('boot');
  try {
    const client = await RealEsrganNativeVulkanClient.create({
      resolveEndpoint: async () => ({ ok: true as const, port: TESTPORT, token: TESTTOKEN }),
      engine: 'ncnn',
    });
    if (!client) { title('FAIL client-null'); return; }
    const w = 540, h = 405, tw = 1280, th = 960;
    const frame = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      frame[i * 4] = (i * 3) & 0xff;
      frame[i * 4 + 1] = (i * 5) & 0xff;
      frame[i * 4 + 2] = (i * 7) & 0xff;
      frame[i * 4 + 3] = 255;
    }
    let ok = 0, fail = 0, failStage = '', worst = 0;
    const t00 = performance.now();
    for (let n = 0; n < FRAMES; n += 1) {
      const t0 = performance.now();
      try {
        const result = await client.runFrameRgba('unused', w, h, frame, tw, th);
        if (result.data.length !== tw * th * 4) throw new Error('bad size ' + result.data.length);
        ok += 1;
      } catch (error) {
        fail += 1;
        if (!failStage) failStage = safeText(error);
      }
      const ms = performance.now() - t0;
      if (ms > worst) worst = ms;
      if ((n + 1) % 10 === 0) title('n=' + (n + 1) + ' ok=' + ok + ' fail=' + fail + ' worst=' + Math.round(worst) + (failStage ? ' e=' + failStage : ''));
    }
    const wall = Math.round(performance.now() - t00);
    title('DONE ok=' + ok + ' fail=' + fail + ' worst=' + Math.round(worst) + ' wall=' + wall + (failStage ? ' e=' + failStage : ''));
  } catch (error) {
    title('FAIL ' + safeText(error));
  }
})();
`);
const bundleEntry = path.join(workspace, '.tmp/soaktest/soak-entry.ts');
execSync(
  `"${ESBUILD_BIN}" ${bundleEntry} --bundle --format=iife --outfile=.tmp/soaktest/client-bundle.js --define:__ANIME4K_E2E__=true`,
  { cwd: workspace, stdio: 'inherit' },
);

// --- Minimal extension injecting the bundle -----------------------------------
const tmp = mkdtempSync(path.join(os.tmpdir(), 'soaktest-'));
writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'soaktest',
  version: '1.0',
  browser_specific_settings: { gecko: { id: 'soaktest@example.com', strict_min_version: '115.0' } },
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['client-bundle.js'] }],
}));
writeFileSync(path.join(tmp, 'client-bundle.js'), readFileSync(path.join(workspace, '.tmp/soaktest/client-bundle.js')));

const runner = await webExt.run({
  sourceDir: tmp,
  target: ['firefox-desktop'],
  firefox: process.env.E2E_FIREFOX_BINARY,
  startUrl: [`${ORIGIN}/page.html`],
  args: ['-headless'],
  pref: { 'xpinstall.signatures.required': false },
  noInput: true,
  noReload: true,
  verbose: false,
});

// Poll the soak beacon until the frame loop reports DONE/FAIL, bounded by
// SOAK_TIMEOUT_MS (default 10 min), instead of sleeping a fixed 120s.
const deadline = Date.now() + SOAK_TIMEOUT_MS;
let titles = [];
let done = false;
try {
  while (Date.now() < deadline) {
    const desktopRunner = runner.extensionRunners?.find(c => c.getName?.() === 'Firefox Desktop');
    const remote = desktopRunner?.remoteFirefox;
    const root = await remote?.client.request({ to: 'root', type: 'listTabs' }).catch(() => null);
    titles = (root?.tabs ?? []).slice(0, 6).map(t => t.title ?? '?');
    done = titles.some(t => t.startsWith('SOAK DONE') || t.startsWith('SOAK FAIL'));
    if (done) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('[soak] TITLES:', JSON.stringify(titles));
  runner.extensionRunners?.find(c => c.getName?.() === 'Firefox Desktop')?.remoteFirefox?.disconnect?.();
  await runner.exit().catch(() => {});
  process.exit(done ? 0 : 2);
} finally {
  server.close();
  host.kill();
  host.stdin?.destroy?.();
}

#!/usr/bin/env node
/**
 * Isolated test of the REAL RealEsrganNativeVulkanClient inside a Firefox
 * content script: bundles the client with webpack, spawns the real host,
 * and runs a frame through the HTTP transport. Result surfaces via the
 * document title beacon.
 *
 * The client normally fetches its endpoint from the background via
 * REALESRGAN_HTTP_INFO; for this standalone test the bundle is compiled with
 * __NATIVE_TEST_ENDPOINT__ pointing straight at the spawned host.
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

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// NOTE: 4190 is on Firefox's blocked-port list (managesieve) — the tab would
// show "Blocked Page" and no content script would ever run. Pick a safe port.
const PORT = 4191;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const HOST_BIN = path.join(workspace, 'native/linux-host/build/aniwebscale-ncnn-host');

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', ORIGIN);
  if (url.pathname === '/__health') { response.writeHead(200); response.end('ok'); return; }
  if (url.pathname === '/' || url.pathname === '/page.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><title>NATIVETEST idle</title></head><body>x</body></html>');
    return;
  }
  response.writeHead(404); response.end();
});

await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

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
  // Buffered: chunks may contain the whole reply (head+body) or several
  // replies; never discard bytes (the first version deadlocked on exactly
  // that — the leftover after the 4-byte head was dropped and the body read
  // waited for data that had already arrived).
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
host.stderr.on('data', d => console.error('[host]', d.toString().trim().split('\n').slice(-2).join('\n').slice(0, 300)));
framedWrite(host, { type: 'hello', protocolVersion: 3, requestId: 't1' });
const hello = await framedRead(host);
const TEST_PORT = hello.httpPort;
const TEST_TOKEN = hello.httpToken;
console.log('[nativetest] host ready on 127.0.0.1:' + TEST_PORT);

// --- Bundle the real client ---------------------------------------------------
mkdirSync(path.join(workspace, '.tmp/nativetest'), { recursive: true });
writeFileSync(path.join(workspace, '.tmp/nativetest/test-entry.ts'), `
const TESTPORT = ${TEST_PORT};
const TESTTOKEN = '${TEST_TOKEN}';
// eslint-disable-next-line
import { RealEsrganNativeVulkanClient } from '../../src/core/realesrgan-native-vulkan-client';

(async () => {
  const trail: string[] = [];
  const title = (text: string) => { trail.push(text); document.title = 'NATIVETEST-TRAIL ' + trail.length + ':' + trail.join('|').slice(-120); };
  title('E');
  try {
    // Bisection step 1: plain fetch to the endpoint, exactly the client's shape
    const w0 = 480, h0 = 270;
    const rgba0 = new Uint8Array(w0 * h0 * 4);
    rgba0[w0 * h0 * 4 - 1] = 255;
    const resp = await fetch('http://127.0.0.1:' + TESTPORT + '/upscale?token=' + TESTTOKEN + '&w=480&h=270', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rgba0,
    });
    const buf0 = await resp.arrayBuffer();
    title('S1+' + buf0.byteLength);
  } catch (e0) {
    const m0 = (e0 && (e0 as Error).message) ? (e0 as Error).message : String(e0);
    title('S1FAIL');
    return;
  }
  try {
    // Bisection step 2a: replicate the client's EXACT queryEndpoint shape
    interface HttpEndpointReply { ok: boolean; port?: number; token?: string; }
    const qReply = await Promise.race([
      chrome.runtime.sendMessage({ type: 'REALESRGAN_HTTP_INFO' }),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 10_000)),
    ]) as HttpEndpointReply | 'timeout' | null;
    if (qReply === 'timeout') { title('S2A-TO'); return; }
    if (!qReply || !qReply.ok) { title('S2A-NR'); return; }
    title('S2A+');
  } catch (e2a) {
    const m2a = (e2a && (e2a as Error).message) ? (e2a as Error).message : String(e2a);
    title('S2AFAIL');
    return;
  }
  try {
    const client = await RealEsrganNativeVulkanClient.create();
    if (!client) { title('FAIL client-null'); return; }
    title('S2B+');
    // 480x270 deterministic frame
    const w = 480, h = 270;
    const planar = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      planar[i] = (i % 255) / 255;
      planar[i + w * h] = ((i * 7) % 255) / 255;
      planar[i + 2 * w * h] = ((i * 13) % 255) / 255;
    }
    title('S2C');
    const result = await client.runFrame('unused', null, w, h, planar);
    title('OK ' + result.length);
  } catch (e) {
    const m = (e && (e as Error).message) ? (e as Error).message : String(e);
    title('FAIL ' + m.slice(0, 60));
  }
})();
`);
const bundleEntry = path.join(workspace, '.tmp/nativetest/test-entry.ts');
execSync(
  `npx esbuild ${bundleEntry} --bundle --format=iife --outfile=.tmp/nativetest/client-bundle.js --define:__ANIME4K_E2E__=true`,
  { cwd: workspace, stdio: 'inherit' },
);

// --- Minimal extension injecting the bundle -----------------------------------
const tmp = mkdtempSync(path.join(os.tmpdir(), 'nativetest-'));
writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'nativetest',
  version: '1.0',
  browser_specific_settings: { gecko: { id: 'nativetest@example.com', strict_min_version: '115.0' } },
  background: { scripts: ['background.js'] },
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['client-bundle.js'] }],
}));
// Minimal background answering REALESRGAN_HTTP_INFO with the spawned host's
// endpoint — the production broker does the same via connectNative.
writeFileSync(path.join(tmp, 'background.js'), `
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'REALESRGAN_HTTP_INFO') {
    sendResponse({ ok: true, port: ${TEST_PORT}, token: '${TEST_TOKEN}' });
  }
  return false;
});
`);
writeFileSync(path.join(tmp, 'client-bundle.js'), readFileSync(path.join(workspace, '.tmp/nativetest/client-bundle.js')));

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

await new Promise(resolve => setTimeout(resolve, 25000));
try {
  const desktopRunner = runner.extensionRunners?.find(c => c.getName?.() === 'Firefox Desktop');
  const remote = desktopRunner?.remoteFirefox;
  const root = await remote?.client.request({ to: 'root', type: 'listTabs' }).catch(() => null);
  const titles = (root?.tabs ?? []).slice(0, 6).map(t => t.title ?? '?');
  console.log('[nativetest] TITLES:', JSON.stringify(titles));
  desktopRunner?.remoteFirefox?.disconnect?.();
  await runner.exit().catch(() => {});
} finally {
  server.close();
  host.kill();
  host.stdin?.destroy?.();
}

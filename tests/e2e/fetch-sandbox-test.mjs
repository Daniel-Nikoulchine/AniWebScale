#!/usr/bin/env node
/**
 * Isolated Firefox content-script fetch test: does a plain fetch() to a
 * loopback HTTP endpoint work from a real Firefox (Zen) content script?
 *
 * Serves a page, injects a minimal extension whose content script POSTs a
 * 4-byte body to the same server, and reports the outcome through the
 * page title + console. Run via tests/e2e-sandbox.mjs --type firefox.
 */
import { createServer } from 'node:http';
import { cmd as webExt } from 'web-ext';
import path from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';

// Ephemeral loopback port (avoids Firefox's blocked-port list and stale
// listeners from a previous run).
let ORIGIN = '';

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', ORIGIN);
  if (url.pathname === '/__health') { response.writeHead(200); response.end('ok'); return; }
  if (url.pathname === '/' || url.pathname === '/page.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><title>FETCHTEST idle</title></head><body>x</body></html>');
    return;
  }
  if (url.pathname === '/echo') {
    let body = [];
    request.on('data', c => body.push(c));
    request.on('end', () => {
      response.writeHead(200, {
        'content-type': 'application/octet-stream',
        'access-control-allow-origin': '*',
        'x-echo-length': String(Buffer.concat(body).length),
      });
      response.end(Buffer.concat(body));
    });
    return;
  }
  response.writeHead(404); response.end();
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port: PORT } = server.address();
ORIGIN = `http://127.0.0.1:${PORT}`;
console.log(`fetch test server at ${ORIGIN}`);

// Minimal extension: content script POSTs to /echo, logs result, sets title.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'fetchtest-'));
mkdirSync(tmp, { recursive: true });
writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'fetchtest',
  version: '1.0',
  browser_specific_settings: { gecko: { id: 'fetchtest@example.com', strict_min_version: '115.0' } },
  background: { scripts: ['background.js'] },
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['content.js'] }],
}));
writeFileSync(path.join(tmp, 'background.js'), `
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'fetchtest-result') { globalThis.__fetchtestResult = msg; sendResponse({ok: true}); }
  return false;
});
`);
writeFileSync(path.join(tmp, 'content.js'), `
(async () => {
try {
  // 1.2 MB body like a real frame (640x480 RGBA8)
  const body = new Uint8Array(1228800);
  body[0] = 1; body[1228799] = 255;
  const r = await fetch('${ORIGIN}/echo', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
  const buf = await r.arrayBuffer();
  document.title = 'FETCHTEST-RESULT ok ' + r.status + ' len=' + buf.byteLength;
} catch (e) {
  let m = 'unknown';
  try { m = (e && e.message) ? e.message : String(e); } catch { m = 'unreadable-error'; }
  document.title = 'FETCHTEST-RESULT fail ' + m.slice(0, 80);
}
})();
`);

const runner = await webExt.run({
  sourceDir: tmp,
  target: ['firefox-desktop'],
  firefox: process.env.E2E_FIREFOX_BINARY,
  startUrl: [`${ORIGIN}/page.html`],
  args: ['-headless'],
  pref: {
    'dom.webgpu.enabled': true,
    'xpinstall.signatures.required': false,
  },
  noInput: true,
  noReload: true,
  verbose: false,
});

// Poll the tab title beacon instead of sleeping a fixed 12s: return as soon
// as the content script reports, bounded by a hard timeout.
const deadline = Date.now() + 45_000;
let titles = [];
try {
  while (Date.now() < deadline) {
    const desktopRunner = runner.extensionRunners?.find(c => c.getName?.() === 'Firefox Desktop');
    const remote = desktopRunner?.remoteFirefox;
    if (remote) {
      // The content script sets document.title as the beacon. Read all tabs'
      // titles through the remote debugging client's tab list.
      const root = await remote.client.request({ to: 'root', type: 'listTabs' }).catch(error => ({ error: error.message }));
      const tabList = root?.tabs ?? [];
      titles = [];
      for (const tabActor of tabList.slice(0, 6)) {
        try {
          const tab = await remote.client.request({ to: tabActor.actor, type: 'getTarget' }).catch(() => null);
          titles.push(tab?.title ?? tabActor.title ?? '?');
        } catch { titles.push('?'); }
      }
      if (titles.some(title => title.includes('FETCHTEST-RESULT'))) break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('[fetchtest] TITLES:', JSON.stringify(titles));
  runner.extensionRunners?.find(c => c.getName?.() === 'Firefox Desktop')?.remoteFirefox?.disconnect?.();
  await runner.exit().catch(() => {});
} finally {
  server.close();
}
console.log('done — RESULT ok:true = loopback fetch works; ok:false shows the error');

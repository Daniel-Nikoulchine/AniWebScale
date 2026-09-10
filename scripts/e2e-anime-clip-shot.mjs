#!/usr/bin/env node
/**
 * Anime clip E2E shot — proves the extension works on real anime material,
 * not just the synthetic fixture.webm.
 *
 * Serves tests/fixtures/one_piece_clip.mp4 on 127.0.0.1:4189/clip.html
 * and captures screenshots of the injected overlay (Chromium + bwrap headless).
 *
 * Optionally drives RealESRGAN via the E2E bridge (configure-realesrgan +
 * fullscreen) and captures a second shot if the pipeline produces a canvas.
 *
 * Run sandboxed (invisible):
 *   node scripts/e2e-sandbox.mjs --type chromium -- node scripts/e2e-anime-clip-shot.mjs
 * Env:
 *   E2E_ANIME_HEADFUL=1   -> headed (debugging)
 *   E2E_ANIME_REALESRGAN=0 -> skip RealESRGAN fullscreen pass (overlay only)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(workspace, 'dist-chrome');
const clipPath = path.join(workspace, 'tests/fixtures/one_piece_clip.mp4');
const framePath = path.join(workspace, 'tests/fixtures/one_piece_frame.png');
const outDir = path.join(workspace, '.tmp', 'e2e-proof');
const PORT = Number(process.env.E2E_ANIME_PORT || 4189);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const tryRealEsrgan = process.env.E2E_ANIME_REALESRGAN !== '0';
const headed = process.env.E2E_ANIME_HEADFUL === '1';

if (!existsSync(path.join(extensionPath, 'manifest.json'))) {
  console.error(`dist-chrome missing at ${extensionPath}. Run ANIME4K_E2E=1 npm run build:chrome`);
  process.exit(2);
}
if (!existsSync(clipPath)) {
  console.error(`clip missing at ${clipPath}`);
  process.exit(2);
}

const consoleLines = [];
const server = createServer((req, res) => {
  const url = new URL(req.url || '/', ORIGIN);
  if (url.pathname === '/__health') { res.writeHead(200); res.end('ok'); return; }
  if (url.pathname === '/__console' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try { const v = JSON.parse(body); const line = `[${v.level}] ${v.text}`; consoleLines.push(line); console.log('PAGE', line); } catch { /* best-effort diagnostics */ }
      res.writeHead(204); res.end();
    });
    return;
  }
  if (url.pathname === '/clip.html' || url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:#000;height:100%;overflow:hidden}
      video#clip{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000}
      #hud{position:fixed;left:8px;top:8px;color:#0f0;font:12px monospace;background:rgba(0,0,0,.6);padding:4px 6px;z-index:9999}
    </style></head><body>
    <video id="clip" muted autoplay loop playsinline src="/one_piece_clip.mp4"></video>
    <div id="hud">ANIME CLIP — waiting…</div>
    <script>
      const hud = document.getElementById('hud');
      const send = (level, text) => { try { void fetch('/__console', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({level, text})}); } catch { /* page console mirror best effort */ } };
      for (const level of ['log','info','warn','error']) { const o = console[level].bind(console); console[level] = (...a)=>{ send(level, a.map(v=>String(v?.message ?? v)).join(' ')); o(...a); }; }
      const beacon = s => { document.title = 'CLIP ' + s; if (hud) hud.textContent = s; };
      window.addEventListener('anime4k-e2e-log', e => { const d=e.detail??{}; send(d.level??'info', d.text??String(d)); });
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      if (!token) {
        const next = new URLSearchParams({token: crypto.randomUUID()});
        const mf = params.get('modelFile'); if (mf) next.set('modelFile', mf);
        location.href = '/clip.html?' + next.toString();
      } else {
        beacon('token=yes — awaiting bridge');
        const bridgeOnce = (action, payload={}) => new Promise((resolve,reject)=>{
          const id=crypto.randomUUID();
          const t=setTimeout(()=>reject(new Error('bridge timeout '+action)), 5000);
          const recv=e=>{
            if(e.source!==window || e.data?.type!=='anime4k-e2e-response' || e.data?.token!==token || e.data?.id!==id) return;
            window.removeEventListener('message', recv); clearTimeout(t);
            e.data.ok ? resolve(e.data) : reject(new Error(e.data.message||'bridge failed'));
          };
          window.addEventListener('message', recv);
          window.postMessage({type:'anime4k-e2e-command', token, id, action, ...payload}, location.origin);
        });
        const seenLogs=new Set();
        setInterval(async ()=>{
          try{ const r=await bridgeOnce('get-logs'); for(const l of r.logs??[]){ if(!seenLogs.has(l)){ seenLogs.add(l); send('ext', l); }}}catch{}
        }, 800);
        // Do NOT auto-configure — node orchestrates timing: source shot first, then configure-realesrgan
        send('info','[clip-shot] page ready (node will configure)');
        beacon('ready');
        const tryFS=async()=>{
          try{ if(!document.fullscreenElement){ await document.querySelector('#clip').requestFullscreen(); send('info','[clip-shot] fullscreen entered via gesture'); } }catch(e){ send('warn','[clip-shot] fullscreen retry failed '+String(e?.message||e)); }
        };
        window.addEventListener('click', ()=>void tryFS(), true);
        window.addEventListener('keydown', ()=>void tryFS(), true);
        // expose helper for node to configure via page.evaluate
        window.__clipShotConfigure = async (mode) => {
          const bridge=async(action,payload={})=>{
            let last=null;
            for(let i=0;i<40;i++){ try{ return await bridgeOnce(action,payload);}catch(e){ last=e; await new Promise(r=>setTimeout(r,300)); }}
            throw last??new Error('bridge unreachable');
          };
          if (mode==='realesrgan') {
            await bridge('configure-realesrgan');
            send('info','[clip-shot] configured mode=REALESRGAN');
            beacon('configured REALESRGAN');
          } else {
            send('info','[clip-shot] overlay-only');
            beacon('overlay-only');
          }
          try{ await document.querySelector('#clip').requestFullscreen(); send('info','[clip-shot] fullscreen requested'); } catch(e){ send('warn','[clip-shot] fullscreen pre-click failed '+e.message); }
        };
        // heartbeat
        setInterval(()=>send('info','[clip-shot] heartbeat t='+Math.round(performance.now()/1000)+'s videoReady='+String(!!document.querySelector('#clip').videoWidth)), 4000);
      }
    </script></body></html>`);
    return;
  }
  if (url.pathname === '/one_piece_clip.mp4') {
    const stat = statSync(clipPath);
    const base = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
    const range = req.headers.range;
    if (!range) { res.writeHead(200, { ...base, 'content-length': stat.size }); res.end(readFileSync(clipPath)); return; }
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    const start=m?.[1]?Number(m[1]):0;
    const end=Math.min(m?.[2]?Number(m[2]):stat.size-1, stat.size-1);
    if(!m||start>end||start>=stat.size){ res.writeHead(416, {...base,'content-range':`bytes */${stat.size}`}); res.end(); return; }
    const chunk=readFileSync(clipPath).subarray(start,end+1);
    res.writeHead(206, {...base,'content-length':chunk.length,'content-range':`bytes ${start}-${end}/${stat.size}`});
    res.end(chunk); return;
  }
  if (url.pathname === '/one_piece_frame.png' && existsSync(framePath)) {
    res.writeHead(200, {'content-type':'image/png','cache-control':'no-store','content-length':statSync(framePath).size});
    res.end(readFileSync(framePath)); return;
  }
  res.writeHead(404); res.end('not found');
});

await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
console.log(`[clip-shot] server at ${ORIGIN}/clip.html (tryRealEsrgan=${tryRealEsrgan} headed=${headed})`);

const token = randomUUID();
const startUrl = `${ORIGIN}/clip.html?token=${token}`;

await mkdir(outDir, { recursive: true });

// --- Playwright Chromium with extension ---
import { chromium } from '@playwright/test';
const browserExecutable = process.env.E2E_CHROMIUM_BINARY || chromium.executablePath();
if (!existsSync(browserExecutable)) { console.error('Chromium missing at', browserExecutable); process.exit(2); }
import { mkdtemp } from 'node:fs/promises';
const profile = await mkdtemp(path.join(os.tmpdir(), 'e2e-anime-'));

let context;
let serversClosed = false;
async function closeServers(){ if(serversClosed) return; serversClosed=true; await new Promise(r=>server.close(r)); }

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: browserExecutable,
    channel: process.env.E2E_CHROMIUM_BINARY ? undefined : 'chromium',
    headless: !headed,
    viewport: headed ? { width: 1280, height: 800 } : { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--lang=en-US',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-features=Vulkan',
    ],
  });

  const page = await context.newPage();
  console.log(`[clip-shot] goto ${startUrl}`);
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // wait for bridge to settle
  await page.waitForTimeout(1500);

  // ensure video is playing and overlay injected (overlay-only at least)
  console.log('[clip-shot] waiting for overlay host...');
  // overlay appears after content.js finds video + not in fullscreen initially it still injects a host (display maybe none until fullscreen but host exists)
  // server.mjs overlay gate: video gets data-anime4k-video-id immediately even outside fullscreen (host created but hidden)
  // clip.html has fullscreen gating, but even before fullscreen host should exist for 'same origin' test
  // wait up to 15s
  let overlayCount = 0;
  try {
    await page.waitForSelector('[data-anime4k-overlay-host]', { state: 'attached', timeout: 12000 });
    overlayCount = await page.locator('[data-anime4k-overlay-host]').count();
  } catch { /* best-effort diagnostics */ }
  const videoId = await page.evaluate(() => document.querySelector('#clip')?.dataset?.anime4kVideoId || '');
  const videoDims = await page.evaluate(() => { const v=document.querySelector('#clip'); return v?{w:v.videoWidth,h:v.videoHeight,ready:v.readyState,paused:v.paused,ct:v.currentTime}:null; });
  console.log(`[clip-shot] overlays=${overlayCount} videoId=${videoId||'(none)'} dims=${JSON.stringify(videoDims)}`);
  // diagnostics before source shot: host/canvas geometry explains black screenshots
  const preInfo = await page.evaluate(() => {
    const v=document.querySelector('#clip');
    const host=document.querySelector('[data-anime4k-overlay-host]');
    const canvas=document.querySelector('canvas');
    const pixel=(()=>{ try{ const c=document.createElement('canvas'); c.width=16;c.height=16; const g=c.getContext('2d'); g.drawImage(v,0,0,16,16); return Array.from(g.getImageData(8,8,1,1).data);}catch{return null;} })();
    return {
      host: host?{rect:host.getBoundingClientRect(), style:{display:getComputedStyle(host).display, vis:getComputedStyle(host).visibility, w:getComputedStyle(host).width, h:getComputedStyle(host).height}}:null,
      canvas: canvas?{w:canvas.width,h:canvas.height, style:{vis:getComputedStyle(canvas).visibility, disp:getComputedStyle(canvas).display, w:getComputedStyle(canvas).width, h:getComputedStyle(canvas).height, bg:getComputedStyle(canvas).backgroundColor}, parent:canvas.parentElement?.tagName}:null,
      vRect: v?.getBoundingClientRect(),
      pixel,
    };
  });
  console.log('[clip-shot] pre-shot DOM', JSON.stringify(preInfo));
  // wait for a colorful frame (skip dark intro 0-2s and transition 3.0-3.1)
  let waitCt=0;
  for(let attempt=0; attempt<10; attempt++){
    try {
      await page.waitForFunction(() => { 
        const v=document.querySelector('#clip'); 
        if(!v || v.readyState<2) return false;
        const c=document.createElement('canvas'); c.width=16;c.height=16;
        const g=c.getContext('2d');
        g.drawImage(v,0,0,16,16);
        const d=g.getImageData(8,8,1,1).data;
        // bright anime skin tone ~ R>80, not dark intro
        return d[0]>80 && d[1]>50 && d[2]>50;
      }, { timeout: 4000 });
      waitCt = await page.evaluate(()=>document.querySelector('#clip').currentTime);
      console.log('[clip-shot] bright frame found ct=' + waitCt);
      break;
    } catch { 
      console.log('[clip-shot] bright wait attempt failed, ct=' + await page.evaluate(()=>document.querySelector('#clip').currentTime));
      await page.waitForTimeout(500);
    }
  }
  if(!waitCt) {
    waitCt = await page.evaluate(()=>document.querySelector('#clip').currentTime);
    console.log('[clip-shot] fallback ct=' + waitCt);
  }
  await page.waitForTimeout(200);

  // source shot should show the raw anime frame, not the black RealESRGAN canvas that
  // covers it (host is display:block even without fullscreen due to viewport-cover heuristic)
  const prePixelAfterWait = await page.evaluate(() => { const v=document.querySelector('#clip'); const c=document.createElement('canvas'); c.width=16;c.height=16; const g=c.getContext('2d'); try{ g.drawImage(v,0,0,16,16); return Array.from(g.getImageData(8,8,1,1).data);}catch{return null;} });
  console.log('[clip-shot] pixel after wait', prePixelAfterWait);
  await page.evaluate(() => {
    document.querySelectorAll('[data-anime4k-overlay-host]').forEach(h=>h.remove());
    document.querySelectorAll('canvas').forEach(c=>{ if(c.width>0) c.remove(); });
  });
  await page.waitForTimeout(200);
  const afterHide = await page.evaluate(() => {
    const v=document.querySelector('#clip');
    const c=document.createElement('canvas'); c.width=16;c.height=16; c.getContext('2d').drawImage(v,0,0,16,16);
    const vs=getComputedStyle(v);
    // force video visible for source shot (pipeline hides it with opacity 0)
    v.style.opacity='1';
    v.style.visibility='visible';
    v.style.display='block';
    return { pixel: Array.from(c.getContext('2d').getImageData(8,8,1,1).data), hostCount: document.querySelectorAll('[data-anime4k-overlay-host]').length, canvasCount: document.querySelectorAll('canvas').length, vStyle:{opacity:vs.opacity, vis:vs.visibility, disp:vs.display, w:vs.width, h:vs.height, tf:vs.transform} };
  });
  console.log('[clip-shot] after hide', afterHide);
  const shot1 = path.join(outDir, 'anime-source.png');
  await page.screenshot({ path: shot1, fullPage: false });
  // also element shot for comparison
  try {
    const elShot = path.join(outDir, 'anime-source-element.png');
    await page.locator('#clip').screenshot({ path: elShot });
    console.log(`[clip-shot] element shot ${elShot} (${statSync(elShot).size} bytes)`);
  } catch (e) { console.log('[clip-shot] element shot failed', e.message); }
  console.log(`[clip-shot] saved ${shot1} (${statSync(shot1).size} bytes)`);

  // Now configure RealESRGAN and capture upscaled output
  if (tryRealEsrgan) {
    console.log('[clip-shot] configuring RealESRGAN via bridge...');
    try {
      await page.evaluate(() => window.__clipShotConfigure('realesrgan'));
      console.log('[clip-shot] configure call returned');
    } catch (e) { console.warn('[clip-shot] configure failed', e.message); }
    await page.waitForTimeout(1500);
  }

  // Try to trigger fullscreen via click (needs gesture)
  console.log('[clip-shot] clicking video to trigger fullscreen...');
  try { await page.click('#clip', { timeout: 3000 }); } catch { /* best-effort diagnostics */ }
  await page.waitForTimeout(800);
  try { await page.keyboard.press('f'); } catch { /* best-effort diagnostics */ }
  await page.waitForTimeout(1200);

  const fsEl = await page.evaluate(() => document.fullscreenElement?.id || document.fullscreenElement?.tagName || null);
  console.log(`[clip-shot] fullscreenElement=${fsEl ?? 'null'}`);

  let applied = '';
  let canvasVisible = false;
  let overlayAfter = overlayCount;
  try {
    await page.waitForTimeout(1000);
    applied = await page.evaluate(() => document.querySelector('#clip')?.dataset?.anime4kApplied || '');
    canvasVisible = await page.evaluate(() => {
      const c = document.querySelector('#clip')?.parentElement?.querySelector('canvas') || document.querySelector('canvas');
      if (!c) return false;
      const s = getComputedStyle(c);
      return s.visibility !== 'hidden' && s.display !== 'none' && c.width > 0;
    });
    overlayAfter = await page.locator('[data-anime4k-overlay-host]').count();
  } catch { /* best-effort diagnostics */ }

  console.log(`[clip-shot] applied=${applied||'(none)'} canvasVisible=${canvasVisible} overlaysAfter=${overlayAfter}`);

  // If RealESRGAN expected, wait a bit longer for worker inference
  if (tryRealEsrgan) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const cur = await page.evaluate(() => document.querySelector('#clip')?.dataset?.anime4kApplied || '');
      if (cur === 'true') { applied = cur; break; }
      await page.waitForTimeout(500);
    }
    console.log(`[clip-shot] after RealESRGAN wait applied=${applied}`);
    // capture even if not applied — shows progress
  }

  const shot2Name = applied === 'true' ? 'anime-realesrgan.png' : 'anime-fullscreen.png';
  const shot2 = path.join(outDir, shot2Name);
  await page.screenshot({ path: shot2, fullPage: false });
  console.log(`[clip-shot] saved ${shot2} (${statSync(shot2).size} bytes)`);

  // popup shot
  const EXT_ID = 'dlomjcbmgkfaebhplgoihbjfclaagike';
  try {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${EXT_ID}/popup.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await popup.waitForTimeout(400);
    const popupShot = path.join(outDir, 'anime-popup.png');
    await popup.screenshot({ path: popupShot, fullPage: true });
    console.log(`[clip-shot] saved ${popupShot} (${statSync(popupShot).size} bytes)`);
    await popup.close();
  } catch (e) { console.warn('[clip-shot] popup shot failed', e.message); }

  // summary log
  console.log('---');
  console.log(`SOURCE   ${shot1}`);
  console.log(`${applied==='true'?'REALESRGAN':'FULLSCREEN'} ${shot2}`);
  console.log(`consoleLines: ${consoleLines.length}`);
  for (const l of consoleLines.slice(-20)) console.log('  ' + l);
  console.log('[clip-shot] done');
  await page.close();
} finally {
  await context?.close().catch(()=>{});
  await rm(profile, { recursive: true, force: true }).catch(()=>{});
  await closeServers();
}

#!/usr/bin/env node
/**
 * Compare same anime frame with vs without RealESRGAN.
 * - Same video time (3.0s), same viewport (1280x720)
 * - Source: overlay removed, video opacity 1, paused
 * - Realesrgan: configured, fullscreen, applied, paused at same time
 * Output: .tmp/e2e-proof/anime-compare-source.png and anime-compare-realesrgan.png
 * Run: node scripts/e2e-sandbox.mjs --type chromium -- node scripts/e2e-compare.mjs
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extPath = path.join(workspace, 'dist-chrome');
const clipPath = path.join(workspace, 'tests/fixtures/one_piece_clip.mp4');
const outDir = path.join(workspace, '.tmp/e2e-proof');
const PORT = 4196;
const ORIGIN = `http://127.0.0.1:${PORT}`;

if (!existsSync(path.join(extPath,'manifest.json'))) { console.error('dist-chrome missing'); process.exit(2); }
if (!existsSync(clipPath)) { console.error('clip missing'); process.exit(2); }

const consoleLines=[];
const server=createServer((req,res)=>{
  const url=new URL(req.url||'/', ORIGIN);
  if(url.pathname==='/'||url.pathname==='/clip.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000;height:100%;overflow:hidden} video#clip{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000} #hud{position:fixed;left:8px;top:8px;color:#0f0;font:12px monospace;background:rgba(0,0,0,.6);padding:4px 6px;z-index:9999}</style></head><body><video id="clip" muted playsinline src="/one_piece_clip.mp4"></video><div id="hud">ready</div><script>
      const hud=document.getElementById('hud');
      const send=(l,t)=>{ try{void fetch('/__console',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({level:l,text:t})});}catch{ /* ignore */}};
      for(const lvl of ['log','info','warn','error']){ const o=console[lvl].bind(console); console[lvl]=(...a)=>{send(lvl,a.map(v=>String(v?.message??v)).join(' ')); o(...a);}; }
      window.addEventListener('anime4k-e2e-log',e=>{ const d=e.detail??{}; send(d.level??'info', d.text??String(d)); });
      const params=new URLSearchParams(location.search);
      const token=params.get('token');
      if(!token){ location.href='/clip.html?token='+crypto.randomUUID(); } else {
        const bridgeOnce=(a,p={})=>new Promise((res,rej)=>{ const id=crypto.randomUUID(); const t=setTimeout(()=>rej(new Error('bridge '+a)),5000); const h=e=>{ if(e.source!==window||e.data?.type!=='anime4k-e2e-response'||e.data?.token!==token||e.data?.id!==id) return; window.removeEventListener('message',h); clearTimeout(t); e.data.ok?res(e.data):rej(e.data.message);}; window.addEventListener('message',h); window.postMessage({type:'anime4k-e2e-command',token,id,action:a,...p},location.origin); });
        setInterval(async()=>{ try{ const r=await bridgeOnce('get-logs'); for(const l of r.logs??[]) send('ext',l);}catch{ /* ignore */}},800);
        hud.textContent='ready token'; send('info','[compare] ready');
        window.__compareConfigure=async(mode)=>{
          const bridge=async(act,pl={})=>{ let last=null; for(let i=0;i<40;i++){ try{return await bridgeOnce(act,pl);}catch(e){last=e; await new Promise(r=>setTimeout(r,300));}} throw last; };
          if(mode==='realesrgan'){ await bridge('configure-realesrgan'); send('info','[compare] configured REALESRGAN'); hud.textContent='configured REALESRGAN'; }
          try{ await document.querySelector('#clip').requestFullscreen(); send('info','[compare] fullscreen requested'); }catch(e){ send('warn','[compare] fs fail '+e.message); }
        };
        window.addEventListener('click', async()=>{ try{ if(!document.fullscreenElement) await document.querySelector('#clip').requestFullscreen(); }catch{ /* ignore */} });
        setInterval(()=>send('info','[compare] hb ct='+document.querySelector('#clip').currentTime.toFixed(2)),4000);
      }
    </script></body></html>`);
    return;
  }
  if(url.pathname==='/__console' && req.method==='POST'){ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{const v=JSON.parse(b); consoleLines.push(`[${v.level}] ${v.text}`); console.log('PAGE',`[${v.level}] ${v.text}`);}catch{ /* ignore */} res.writeHead(204); res.end();}); return; }
  if(url.pathname==='/one_piece_clip.mp4'){ const s=statSync(clipPath); const base={'content-type':'video/mp4','accept-ranges':'bytes','cache-control':'no-store'}; const range=req.headers.range; if(!range){ res.writeHead(200,{...base,'content-length':s.size}); res.end(readFileSync(clipPath)); return;} const m=/^bytes=(\d*)-(\d*)$/.exec(range); const st=m?.[1]?Number(m[1]):0; const en=Math.min(m?.[2]?Number(m[2]):s.size-1,s.size-1); if(!m||st>en||st>=s.size){res.writeHead(416,{...base,'content-range':`bytes */${s.size}`}); res.end(); return;} const chunk=readFileSync(clipPath).subarray(st,en+1); res.writeHead(206,{...base,'content-length':chunk.length,'content-range':`bytes ${st}-${en}/${s.size}`}); res.end(chunk); return; }
  res.writeHead(404); res.end();
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
console.log(`[compare] server ${ORIGIN}/clip.html`);

const token=randomUUID();
const startUrl=`${ORIGIN}/clip.html?token=${token}`;
await mkdir(outDir,{recursive:true});
import { chromium } from '@playwright/test';
const browserExecutable=process.env.E2E_CHROMIUM_BINARY||chromium.executablePath();
import { mkdtemp } from 'node:fs/promises';
const profile=await mkdtemp(path.join(os.tmpdir(),'compare-'));
let context;
try{
  context=await chromium.launchPersistentContext(profile,{
    executablePath: browserExecutable,
    channel: process.env.E2E_CHROMIUM_BINARY?undefined:'chromium',
    headless: true,
    viewport:{width:2560,height:1920},
    deviceScaleFactor:1,
    args:[`--disable-extensions-except=${extPath}`,`--load-extension=${extPath}`,'--autoplay-policy=no-user-gesture-required','--enable-unsafe-webgpu','--ignore-gpu-blocklist','--use-gl=angle','--enable-features=Vulkan','--window-size=2560,1920']
  });
  const page=await context.newPage();
  console.log(`[compare] goto ${startUrl}`);
  await page.goto(startUrl,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(1500);
  // wait for overlay host (proves extension injected) then we will hide it for source
  try{ await page.waitForSelector('[data-anime4k-overlay-host]',{state:'attached',timeout:8000}); console.log('[compare] overlay host attached'); }catch{ console.log('[compare] no overlay'); }
  // ensure video ready
  await page.waitForFunction(()=>{ const v=document.querySelector('#clip'); return v && v.readyState>=2 && v.videoWidth>0;},{timeout:8000});
  console.log('[compare] video ready');

  // seek to colorful frame 2.8s (from earlier sampling: 2.6 colorful)
  const seekTo=async(t, pause=true)=>{
    await page.evaluate(({tt, pause})=>{
      const v=document.querySelector('#clip');
      if(pause) v.pause();
      return new Promise((res)=>{
        const h=()=>{ v.removeEventListener('seeked',h); res(v.currentTime); };
        v.addEventListener('seeked',h);
        v.currentTime=tt;
        // fallback if already there
        setTimeout(()=>{ v.removeEventListener('seeked',h); res(v.currentTime); },1000);
      });
    }, {tt:t, pause});
    await page.waitForTimeout(400);
  };
  console.log('[compare] seeking source to 2.8s');
  await seekTo(2.8, true);
  // hide overlay/canvas and force video visible for source
  await page.evaluate(()=>{
    document.querySelectorAll('[data-anime4k-overlay-host]').forEach(h=>h.style.display='none');
    document.querySelectorAll('canvas').forEach(c=>{ if(c.width>0) c.style.display='none'; });
    const v=document.querySelector('#clip'); if(v){ v.style.opacity='1'; v.style.visibility='visible'; v.style.display='block'; }
  });
  await page.waitForTimeout(300);
  const srcPixel=await page.evaluate(()=>{ const v=document.querySelector('#clip'); const c=document.createElement('canvas'); c.width=16;c.height=16; const g=c.getContext('2d'); g.drawImage(v,0,0,16,16); return Array.from(g.getImageData(8,8,1,1).data); });
  console.log('[compare] source pixel',srcPixel);
  // save native source frame at 640x480 (no viewport upscale) for 1:1 vs 4x proof
  try{
    const srcNativeB64=await page.evaluate(()=>{
      const v=document.querySelector('#clip');
      const c=document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight;
      const g=c.getContext('2d'); g.drawImage(v,0,0,c.width,c.height);
      return c.toDataURL('image/png');
    });
    if(srcNativeB64.startsWith('data:image/png;base64,')){
      const buf=Buffer.from(srcNativeB64.split(',')[1],'base64');
      const p=path.join(outDir,'anime-compare-source-native.png');
      const { writeFileSync } = await import('node:fs');
      writeFileSync(p, buf);
      console.log(`[compare] source native saved ${p} (${buf.length} bytes) ${640}x${480}`);
    }
  }catch(e){ console.log('[compare] source native err', String(e));}
  const srcShot=path.join(outDir,'anime-compare-source.png');
  await page.screenshot({path:srcShot, fullPage:false});
  console.log(`[compare] source saved ${srcShot} (${statSync(srcShot).size} bytes)`);
  try{ const el=path.join(outDir,'anime-compare-source-element.png'); await page.locator('#clip').screenshot({path:el}); console.log(`[compare] source element ${el} (${statSync(el).size})`);}catch{ /* ignore */}
  const srcVideoCt = await page.evaluate(()=>document.querySelector('#clip')?.currentTime);
  console.log('[compare] source ct', srcVideoCt);
  await page.close();

  // --- phase 2: fresh page for REALESRGAN ---
  console.log('[compare] --- phase 2 REALESRGAN fresh page ---');
  const page2 = await context.newPage();
  await page2.goto(startUrl,{waitUntil:'domcontentloaded',timeout:20000});
  await page2.waitForTimeout(1500);
  try{ await page2.waitForSelector('[data-anime4k-overlay-host]',{state:'attached',timeout:8000}); console.log('[compare] overlay host attached (p2)'); }catch{ console.log('[compare] no overlay p2'); }
  await page2.waitForFunction(()=>{ const v=document.querySelector('#clip'); return v && v.readyState>=2 && v.videoWidth>0;},{timeout:8000});
  console.log('[compare] video ready p2');
  console.log('[compare] configuring REALESRGAN p2');
  await page2.evaluate(()=>window.__compareConfigure('realesrgan'));
  await page2.waitForTimeout(1500);
  try{ await page2.click('#clip',{timeout:3000}); }catch{ /* ignore */}
  await page2.waitForTimeout(1000);
  const fsEl=await page2.evaluate(()=>document.fullscreenElement?.tagName||null);
  console.log('[compare] fullscreen p2',fsEl);
  let applied='';
  for(let i=0;i<30;i++){
    applied=await page2.evaluate(()=>document.querySelector('#clip')?.dataset.anime4kApplied||'');
    if(applied==='true') break;
    await page2.waitForTimeout(500);
  }
  console.log('[compare] applied p2',applied);
  // seek to same 2.8 and keep PLAYING (RealESRGAN needs requestVideoFrameCallback)
  console.log('[compare] seeking p2 to 2.8s playing');
  await page2.evaluate(({tt})=>{
    const v=document.querySelector('#clip');
    v.currentTime=tt;
    v.play().catch(()=>{});
  }, {tt:2.8});
  // wait for first inference to prime
  await page2.waitForTimeout(3000);
  // re-seek to exact 2.8, let ONE frame render, then freeze — keeps canvas content
  await page2.evaluate(({tt})=>{
    const v=document.querySelector('#clip');
    v.currentTime=tt;
    v.play().catch(()=>{});
  }, {tt:2.8});
  try{ await page2.waitForFunction(()=>{ const v=document.querySelector('#clip'); return v && v.currentTime>=2.8 && v.currentTime<2.9; }, {timeout:3000}); }catch{ /* ignore */}
  await page2.evaluate(()=>{ const v=document.querySelector('#clip'); v.pause(); });
  await page2.waitForTimeout(600);
  console.log('[compare] p2 ct before shot', await page2.evaluate(()=>document.querySelector('#clip').currentTime));
  const canvasInfo=await page2.evaluate(()=>{
    const c=document.querySelector('canvas');
    const v=document.querySelector('#clip');
    return {
      canvas: c?{w:c.width,h:c.height, cssW:getComputedStyle(c).width, vis:getComputedStyle(c).visibility, disp:getComputedStyle(c).display, bg:getComputedStyle(c).backgroundColor}:null,
      video:{applied: v?.dataset.anime4kApplied||'', opacity:getComputedStyle(v).opacity, vis:getComputedStyle(v).visibility},
      hostCount: document.querySelectorAll('[data-anime4k-overlay-host]').length
    };
  });
  console.log('[compare] canvasInfo',JSON.stringify(canvasInfo));
  // pixel of canvas center via drawing canvas to temp
  const canvasPixel=await page2.evaluate(()=>{
    const c=document.querySelector('canvas');
    if(!c) return null;
    const t=document.createElement('canvas'); t.width=16; t.height=16;
    const g=t.getContext('2d');
    try{ g.drawImage(c, c.width/2-8, c.height/2-8,16,16,0,0,16,16); return Array.from(g.getImageData(8,8,1,1).data); }catch(e){return String(e);}
  });
  console.log('[compare] canvas center pixel',canvasPixel);
  const reShot=path.join(outDir,'anime-compare-realesrgan.png');
  await page2.screenshot({path:reShot, fullPage:false});
  console.log(`[compare] realesrgan saved ${reShot} (${statSync(reShot).size})`);
  // also try canvas native capture via toDataURL size
  try{
    const dataUrl=await page2.evaluate(()=>{
      const c=document.querySelector('canvas');
      if(!c) return null;
      try{ return c.toDataURL('image/png'); }catch(e){return 'err '+String(e);}
    });
    console.log('[compare] canvas toDataURL prefix',dataUrl?.slice(0,80));
    if(dataUrl && dataUrl.startsWith('data:image/png;base64,')){
      const b64=dataUrl.split(',')[1];
      const buf=Buffer.from(b64,'base64');
      const nativePath=path.join(outDir,'anime-compare-realesrgan-native.png');
      const { writeFileSync } = await import('node:fs');
      writeFileSync(nativePath, buf);
      console.log(`[compare] native canvas saved ${nativePath} (${buf.length} bytes)`);
      try{
        const dims=await page2.evaluate(()=>{
          const c=document.querySelector('canvas');
          return c?{w:c.width,h:c.height, cssW:getComputedStyle(c).width, cssH:getComputedStyle(c).height}:null;
        });
        console.log('[compare] native dims', JSON.stringify(dims));
      }catch{ /* ignore */}
    }
  }catch(e){ console.log('[compare] toDataURL err', String(e));}
  // element screenshot of canvas for direct compare
  try{
    const elPath=path.join(outDir,'anime-compare-realesrgan-canvas.png');
    await page2.locator('canvas').screenshot({path: elPath});
    console.log(`[compare] canvas element saved ${elPath} (${statSync(elPath).size})`);
  }catch(e){ console.log('[compare] canvas element err', String(e));}

  console.log('---');
  console.log(`SOURCE ${srcShot}`);
  console.log(`REALESRGAN ${reShot}`);
  console.log(`consoleLines ${consoleLines.length}`);
  for(const l of consoleLines.slice(-15)) console.log(' '+l);
  await page2.close();
} finally {
  await context?.close().catch(()=>{});
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
  await new Promise(r=>server.close(r));
}

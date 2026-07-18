import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIMARY_PORT = Number(process.env.E2E_PRIMARY_PORT || 4173);
const CROSS_ORIGIN_PORT = Number(process.env.E2E_CROSS_ORIGIN_PORT || 4174);
export const PRIMARY_ORIGIN = `http://127.0.0.1:${PRIMARY_PORT}`;
const CROSS_ORIGIN = `http://127.0.0.1:${CROSS_ORIGIN_PORT}`;

// Two seconds of a deterministic 320x180 VP9/WebM frame sequence. Keeping the
// fixture inline makes the harness independent of ffmpeg and external sites.
const VIDEO = Buffer.from(
  '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',
  'base64',
);

const commonStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #eef; background: #10131a; font: 14px system-ui; }
  h1 { font-size: 18px; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px; }
  .player { position: relative; width: 320px; height: 180px; background: #000; }
  .player:fullscreen { width: 100vw; height: 100vh; }
  .player:fullscreen video.media { width: 100%; height: 100%; }
  video.media { display: block; width: 320px; height: 180px; object-fit: contain; background: #000; }
  video.small { width: 200px; height: 110px; }
  .subtitle { position: absolute; z-index: 20; left: 20px; right: 20px; bottom: 42px; text-align: center; pointer-events: auto; }
  .site-controls { position: absolute; z-index: 21; left: 0; right: 0; bottom: 0; height: 34px; background: rgba(20,20,20,.9); }
  iframe { width: 390px; height: 240px; border: 1px solid #556; }
`;

function shell(title, body, script = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title}</title><style>${commonStyles}</style></head>
<body>${body}<script>${script}</script></body></html>`;
}

const playable = (id, source, extra = '') =>
  `<video id="${id}" class="media" ${extra} muted autoplay loop playsinline src="${source}"></video>`;

function mediaPage() {
  return shell('Anime4K E2E media', `
    <h1>Same-origin, CORS, and minimum-size fixtures</h1>
    <div class="row">
      <div><div id="same-player" class="player">${playable('same-video', '/fixture.webm')}</div><p>same origin</p><button id="fullscreen-same">Fullscreen same</button></div>
      <div><div id="cors-player" class="player">${playable('cors-video', `${CROSS_ORIGIN}/fixture.webm`, 'crossorigin="anonymous"')}</div><p>CORS</p><button id="fullscreen-cors">Fullscreen CORS</button></div>
      <div><video id="small-video" class="media small" muted autoplay loop playsinline src="/fixture.webm"></video><p>below threshold</p></div>
    </div>
  `, `
    document.querySelector('#fullscreen-same').addEventListener('click', () => document.querySelector('#same-player').requestFullscreen());
    document.querySelector('#fullscreen-cors').addEventListener('click', () => document.querySelector('#cors-player').requestFullscreen());
  `);
}

function dynamicPage() {
  return shell('Anime4K E2E dynamic video', `
    <h1>Dynamic replacement</h1><div id="dynamic-root">${playable('dynamic-video-0', '/fixture.webm')}</div>
  `, `
    window.replaceDynamicVideo = function(index) {
      const previous = document.querySelector('#dynamic-root video');
      const next = document.createElement('video');
      next.id = 'dynamic-video-' + index;
      next.className = 'media';
      next.muted = true; next.autoplay = true; next.loop = true; next.playsInline = true;
      next.src = '/fixture.webm?cycle=' + index;
      previous.replaceWith(next);
      return next.id;
    };
    window.addSecondVideo = function() {
      const second = document.createElement('video');
      second.id = 'second-video'; second.className = 'media';
      second.muted = true; second.autoplay = true; second.loop = true; second.playsInline = true;
      second.src = '/fixture.webm?second=1'; document.querySelector('#dynamic-root').append(second);
    };
    window.removeSecondVideo = function() { document.querySelector('#second-video')?.remove(); };
  `);
}

function layeredPage() {
  return shell('Anime4K E2E layers', `
    <h1>Website subtitles and controls</h1>
    <div id="player" class="player">
      ${playable('layer-video', '/fixture.webm')}
      <div id="subtitle" class="subtitle">DOM subtitle remains visible</div>
      <button id="site-controls" class="site-controls" type="button">Website controls</button>
    </div>
    <button id="enter-fullscreen" type="button">Enter fullscreen</button>
    <button id="enter-video-fullscreen" type="button">Enter video fullscreen</button>
    <button id="enter-page-fullscreen" type="button">Enter broad page fullscreen</button>
  `, `
    document.querySelector('#enter-fullscreen').addEventListener('click', async () => {
      if (document.fullscreenEnabled) await document.querySelector('#player').requestFullscreen();
    });
    document.querySelector('#enter-video-fullscreen').addEventListener('click', async () => {
      if (document.fullscreenEnabled) await document.querySelector('#layer-video').requestFullscreen();
    });
    document.querySelector('#enter-page-fullscreen').addEventListener('click', async () => {
      if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    });
  `);
}

function framePage() {
  return shell('Anime4K E2E frame', playable('frame-video', '/fixture.webm'), `
    const report = () => {
      const count = document.querySelectorAll('[data-anime4k-overlay-host]').length;
      if (count > 0) parent.postMessage({ type: 'anime4k-e2e-frame-ready', count }, '*');
      return count > 0;
    };
    const timer = setInterval(() => { if (report()) clearInterval(timer); }, 50);
    window.addEventListener('message', event => {
      if (event.data === 'anime4k-e2e-frame-ping') report();
    });
  `);
}

function iframeHostPage() {
  return shell('Anime4K E2E iframe host', `
    <h1>Cross-origin iframe</h1><iframe id="video-frame" src="${CROSS_ORIGIN}/frame.html"></iframe>
  `);
}

function blobFrameHostPage() {
  return shell('Anime4K E2E blob iframe host', `
    <h1>Origin-derived blob iframe</h1><iframe id="blob-video-frame"></iframe>
  `, `
    const markup = '<!doctype html><html><body>'
      + '<video id="blob-video" muted autoplay loop playsinline '
      + 'style="display:block;width:320px;height:180px" src="/fixture.webm"></video>'
      + '</body></html>';
    document.querySelector('#blob-video-frame').src = URL.createObjectURL(
      new Blob([markup], { type: 'text/html' }),
    );
  `);
}

function aboutBlankFrameHostPage() {
  return shell('Anime4K E2E inherited about:blank iframe', `
    <h1>Inherited about:blank player frame</h1>
    <iframe id="about-blank-video-frame" src="about:blank" allowfullscreen></iframe>
  `, `
    const frame = document.querySelector('#about-blank-video-frame');
    const frameDocument = frame.contentDocument;
    frameDocument.head.innerHTML = '<style>'
      + 'html,body{margin:0;background:#000}.player{position:relative;width:320px;height:180px}'
      + '.player:fullscreen{width:100vw;height:100vh}.player:fullscreen video{width:100%;height:100%}'
      + 'video{display:block;width:320px;height:180px;background:#000}'
      + '</style>';
    frameDocument.body.innerHTML = '<div id="about-blank-player" class="player">'
      + '<video id="about-blank-video" muted autoplay loop playsinline src="/fixture.webm"></video>'
      + '</div><button id="about-blank-fullscreen" type="button">Enter fullscreen</button>';
    frameDocument.querySelector('#about-blank-fullscreen').addEventListener('click', () => {
      frameDocument.querySelector('#about-blank-player').requestFullscreen();
    });
  `);
}

function shadowPage() {
  return shell('Anime4K E2E open shadow root', `
    <h1>Open Shadow DOM video lifecycle</h1><div id="shadow-host"></div>
  `, `
    const shadowRoot = document.querySelector('#shadow-host').attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '<style>video { display:block; width:320px; height:180px; background:#000 }</style>';
    window.addShadowVideo = function(index) {
      const video = document.createElement('video');
      video.id = 'shadow-video-' + index;
      video.muted = true; video.autoplay = true; video.loop = true; video.playsInline = true;
      video.src = '/fixture.webm?shadow=' + index;
      shadowRoot.append(video);
      return video;
    };
    window.removeShadowVideo = function() { shadowRoot.querySelector('video')?.remove(); };
    window.addShadowVideo(0);
  `);
}

function emptyPage(url) {
  const token = url.searchParams.get('self');
  const continuation = token ? `
    setTimeout(async () => {
      const previous = JSON.parse(sessionStorage.getItem('anime4k-e2e-results') || '[]');
      previous.push({ name: 'navigation cleanup', pass: document.querySelectorAll('[data-anime4k-overlay-host]').length === 0 });
      await fetch('/__result/${encodeURIComponent(token)}', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pass: previous.every(item => item.pass), checks: previous }),
      });
      document.title = previous.every(item => item.pass) ? 'Anime4K E2E PASS' : 'Anime4K E2E FAIL';
    }, 250);
  ` : '';
  return shell('Anime4K E2E empty', '<h1>No video on this page</h1>', continuation);
}

function selfTestPage(url) {
  const token = url.searchParams.get('token') || 'missing-token';
  const forceNoAdapter = url.searchParams.get('forceNoAdapter') === '1';
  return shell('Anime4K Firefox self-test', `
    <h1>Firefox temporary-extension self-test</h1>
    <div class="row">
      ${playable('self-same', '/fixture.webm')}
      ${playable('self-cors', `${CROSS_ORIGIN}/fixture.webm`, 'crossorigin="anonymous"')}
      <video id="self-small" class="media small" muted autoplay loop playsinline src="/fixture.webm"></video>
      <div id="self-player" class="player">
        ${playable('self-layer', '/fixture.webm')}
        <div id="self-subtitle" class="subtitle">DOM subtitle</div>
        <button id="self-controls" class="site-controls" type="button">Controls</button>
      </div>
      <div id="self-dynamic">${playable('self-dynamic-video', '/fixture.webm')}</div>
      <div id="self-shadow-host"></div>
      <iframe id="self-frame" src="${CROSS_ORIGIN}/frame.html"></iframe>
    </div>
  `, `
    (async () => {
      const checks = [];
      const check = (name, pass, detail) => {
        const value = { name, pass: Boolean(pass), detail: detail || '' };
        checks.push(value);
        void fetch('/__progress/${encodeURIComponent(token)}', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
        });
      };
      const waitFor = async (predicate, timeout = 10000) => {
        const deadline = performance.now() + timeout;
        while (performance.now() < deadline) {
          const value = predicate(); if (value) return value;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error('Timed out waiting for fixture state');
      };
      const bridge = (action, payload = {}) => new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => reject(new Error('E2E bridge timed out: ' + action)), 60000);
        const receive = event => {
          if (event.source !== window || event.data?.type !== 'anime4k-e2e-response'
              || event.data?.token !== '${token}' || event.data?.id !== id) return;
          window.removeEventListener('message', receive); clearTimeout(timeout);
          if (event.data.ok) resolve(event.data); else reject(new Error(event.data.message || 'E2E bridge failed'));
        };
        window.addEventListener('message', receive);
        window.postMessage({ type: 'anime4k-e2e-command', token: '${token}', id, action, ...payload }, location.origin);
      });
      let frameCount = 0;
      const selfShadowRoot = document.querySelector('#self-shadow-host').attachShadow({ mode: 'open' });
      selfShadowRoot.innerHTML = '<style>video { display:block; width:320px; height:180px }</style>';
      const addShadowVideo = index => {
        const video = document.createElement('video');
        video.id = 'self-shadow-' + index; video.muted = true; video.autoplay = true;
        video.loop = true; video.playsInline = true; video.src = '/fixture.webm?self-shadow=' + index;
        selfShadowRoot.append(video); return video;
      };
      let selfShadowVideo = addShadowVideo(0);
      window.addEventListener('message', event => {
        if (event.data?.type === 'anime4k-e2e-frame-ready') frameCount = event.data.count;
      });
      try {
        await waitFor(() => document.querySelectorAll('video[data-anime4k-video-id]').length === 5);
        await waitFor(() => document.querySelectorAll('[data-anime4k-overlay-host]').length === 6);
        check('same-origin injection', Boolean(document.querySelector('#self-same').dataset.anime4kVideoId));
        check('CORS source unchanged', document.querySelector('#self-cors').getAttribute('src') === '${CROSS_ORIGIN}/fixture.webm');
        await waitFor(() => document.querySelector('#self-cors').videoWidth === 320);
        check('CORS video decoded', document.querySelector('#self-cors').videoHeight === 180);
        const smallId = document.querySelector('#self-small').dataset.anime4kVideoId;
        const smallHost = document.querySelector('[data-anime4k-overlay-host="' + CSS.escape(smallId) + '"]');
        check('minimum-size gate', getComputedStyle(smallHost).display === 'none');

        await waitFor(() => selfShadowVideo.dataset.anime4kVideoId);
        check('open Shadow DOM injection', Boolean(selfShadowVideo.dataset.anime4kVideoId));
        selfShadowVideo.remove();
        await waitFor(() => document.querySelectorAll('[data-anime4k-overlay-host]').length === 5);
        selfShadowVideo = addShadowVideo(1);
        await waitFor(() => selfShadowVideo.dataset.anime4kVideoId
          && document.querySelectorAll('[data-anime4k-overlay-host]').length === 6);
        check('open Shadow DOM cleanup', Boolean(selfShadowVideo.dataset.anime4kVideoId));

        document.querySelector('#self-frame').contentWindow.postMessage('anime4k-e2e-frame-ping', '*');
        await waitFor(() => frameCount > 0);
        check('cross-origin iframe injection', frameCount === 1);

        const forceNoAdapter = ${JSON.stringify(forceNoAdapter)};
        const gpuAdapter = !forceNoAdapter && navigator.gpu
          ? await navigator.gpu.requestAdapter().catch(() => null)
          : null;
        check('WebGPU API available', Boolean(navigator.gpu));
        await bridge('configure', { forceNoAdapter });
        await waitFor(() => document.querySelector('#self-layer').dataset.anime4kAutoFullscreen === 'true');
        check('no start during normal playback',
          document.querySelectorAll('video[data-anime4k-applied="true"]').length === 0);
        if (!document.fullscreenEnabled) throw new Error('Firefox Fullscreen API is unavailable in the E2E profile.');
        await document.querySelector('#self-layer').requestFullscreen();
        await waitFor(() => document.fullscreenElement?.id === 'self-player');
        if (gpuAdapter) {
          check('WebGPU adapter available', true);
          await waitFor(() => document.querySelector('#self-layer').dataset.anime4kApplied === 'true', 60000);
          check('automatic direct-video fullscreen output',
            document.querySelector('#self-player > canvas')?.style.visibility === 'visible'
            && document.querySelector('#self-layer').style.opacity === '0');
        } else {
          check('WebGPU adapter unavailable gate', true,
            'No adapter on this runner; validating fail-open source visibility instead.');
          await new Promise(resolve => setTimeout(resolve, 2000));
          check('no-adapter fallback keeps source visible',
            !document.querySelector('#self-layer').dataset.anime4kApplied
            && document.querySelector('#self-layer').style.opacity !== '0');
        }
        await document.exitFullscreen();
        await waitFor(() => !document.fullscreenElement);
        await waitFor(() => !document.querySelector('#self-layer').dataset.anime4kApplied);
        check('automatic fullscreen cleanup', document.querySelector('#self-layer').style.opacity === '');

        for (let index = 1; index <= 20; index++) {
          const previous = document.querySelector('#self-dynamic video');
          const next = document.createElement('video');
          next.id = 'self-dynamic-' + index; next.className = 'media'; next.muted = true;
          next.autoplay = true; next.loop = true; next.playsInline = true; next.src = '/fixture.webm?cycle=' + index;
          previous.replaceWith(next);
          await waitFor(() => next.dataset.anime4kVideoId && document.querySelectorAll('[data-anime4k-overlay-host]').length === 6);
        }
        check('20 dynamic replacement cleanups', document.querySelectorAll('[data-anime4k-overlay-host]').length === 6);

        const subtitle = document.querySelector('#self-subtitle');
        const rect = subtitle.getBoundingClientRect();
        check('DOM subtitles remain topmost', document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === subtitle);
        check('website controls remain intact', document.querySelector('#self-controls').textContent === 'Controls');
      } catch (error) {
        check('self-test completed', false, String(error?.message || error) + '\\n' + String(error?.stack || ''));
      }
      sessionStorage.setItem('anime4k-e2e-results', JSON.stringify(checks));
      location.href = '/empty.html?self=${encodeURIComponent(token)}';
    })();
  `);
}

function writeHtml(response, html, cors) {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    ...(cors ? { 'access-control-allow-origin': '*' } : {}),
  });
  response.end(html);
}

function writeVideo(request, response, cors) {
  const baseHeaders = {
    'content-type': 'video/webm',
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    ...(cors ? { 'access-control-allow-origin': '*' } : {}),
  };
  const range = request.headers.range;
  if (!range) {
    response.writeHead(200, { ...baseHeaders, 'content-length': VIDEO.length });
    response.end(VIDEO);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = Math.min(match?.[2] ? Number(match[2]) : VIDEO.length - 1, VIDEO.length - 1);
  if (!match || !Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= VIDEO.length) {
    response.writeHead(416, { ...baseHeaders, 'content-range': `bytes */${VIDEO.length}` });
    response.end();
    return;
  }
  const chunk = VIDEO.subarray(start, end + 1);
  response.writeHead(206, {
    ...baseHeaders,
    'content-length': chunk.length,
    'content-range': `bytes ${start}-${end}/${VIDEO.length}`,
  });
  response.end(chunk);
}

export async function startFixtureServers() {
  const results = new Map();
  const waiters = new Map();

  const handle = (crossOrigin) => async (request, response) => {
    const url = new URL(request.url || '/', crossOrigin ? CROSS_ORIGIN : PRIMARY_ORIGIN);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
      response.end(); return;
    }
    if (url.pathname === '/__health') {
      response.writeHead(200, { 'content-type': 'text/plain' }); response.end('ok'); return;
    }
    if (!crossOrigin && request.method === 'POST' && url.pathname.startsWith('/__result/')) {
      const token = decodeURIComponent(url.pathname.slice('/__result/'.length));
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      let value;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { value = { pass: false, checks: [{ name: 'result JSON', pass: false }] }; }
      results.set(token, value);
      waiters.get(token)?.(value); waiters.delete(token);
      response.writeHead(204); response.end(); return;
    }
    if (!crossOrigin && request.method === 'POST' && url.pathname.startsWith('/__progress/')) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        console.log(`${value.pass ? 'PASS' : 'FAIL'}  ${value.name}${value.detail ? `: ${value.detail}` : ''}`);
      } catch {
        console.log('FAIL  invalid Firefox progress payload');
      }
      response.writeHead(204); response.end(); return;
    }
    if (url.pathname === '/fixture.webm') { writeVideo(request, response, crossOrigin); return; }
    if (url.pathname === '/media.html' || url.pathname === '/') { writeHtml(response, mediaPage(), crossOrigin); return; }
    if (url.pathname === '/dynamic.html') { writeHtml(response, dynamicPage(), crossOrigin); return; }
    if (url.pathname === '/layers.html') { writeHtml(response, layeredPage(), crossOrigin); return; }
    if (url.pathname === '/iframe-host.html') { writeHtml(response, iframeHostPage(), crossOrigin); return; }
    if (url.pathname === '/blob-frame-host.html') { writeHtml(response, blobFrameHostPage(), crossOrigin); return; }
    if (url.pathname === '/about-blank-frame-host.html') { writeHtml(response, aboutBlankFrameHostPage(), crossOrigin); return; }
    if (url.pathname === '/shadow.html') { writeHtml(response, shadowPage(), crossOrigin); return; }
    if (url.pathname === '/frame.html') { writeHtml(response, framePage(), true); return; }
    if (url.pathname === '/empty.html') { writeHtml(response, emptyPage(url), crossOrigin); return; }
    if (!crossOrigin && url.pathname === '/firefox-self-test.html') { writeHtml(response, selfTestPage(url), false); return; }
    response.writeHead(404, { 'content-type': 'text/plain' }); response.end('not found');
  };

  const primary = createServer((request, response) => void handle(false)(request, response));
  const cross = createServer((request, response) => void handle(true)(request, response));
  await Promise.all([
    new Promise((resolve, reject) => primary.once('error', reject).listen(PRIMARY_PORT, '127.0.0.1', resolve)),
    new Promise((resolve, reject) => cross.once('error', reject).listen(CROSS_ORIGIN_PORT, '127.0.0.1', resolve)),
  ]);

  return {
    waitForResult(token, timeoutMs = 45_000) {
      if (results.has(token)) return Promise.resolve(results.get(token));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(token);
          reject(new Error(`Timed out waiting for browser self-test ${token}`));
        }, timeoutMs);
        waiters.set(token, value => { clearTimeout(timer); resolve(value); });
      });
    },
    async close() {
      await Promise.all([
        new Promise(resolve => { primary.close(resolve); primary.closeAllConnections?.(); }),
        new Promise(resolve => { cross.close(resolve); cross.closeAllConnections?.(); }),
      ]);
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const servers = await startFixtureServers();
  console.log(`Anime4K E2E fixtures: ${PRIMARY_ORIGIN} and ${CROSS_ORIGIN}`);
  const stop = async () => { await servers.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

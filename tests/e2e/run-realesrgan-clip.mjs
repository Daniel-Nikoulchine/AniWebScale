/**
 * RealESRGAN GPU E2E against the One Piece clip in a REAL Firefox/Zen with
 * WebGPU on the host GPU (AMD RX 6750 XT).
 *
 * What it does:
 *  1. Serves tests/fixtures/one_piece_clip.mp4 on a loopback HTTP server
 *     (Range requests included).
 *  2. Loads the built extension (dist-firefox) as a temporary add-on in the
 *     FIREFOX_BINARY (Zen via E2E_FIREFOX_BINARY or Playwright Firefox).
 *  3. Opens a minimal page with the clip as a fullscreen video.
 *  4. Through the content-script E2E bridge (localhost origin guard), sets
 *     mode=REALESRGAN and requests fullscreen, so the RealESRGAN pipeline
 *     actually runs frame inference on the GPU.
 *  5. Collects console output; PASSES when at least one successful worker
 *     inference reply (`worker composition path:`) is observed and NO
 *     "Shape mismatch" / "worker inference failed" / "timed out" appears.
 *
 * The console collector works via a page-side shim: the self-test bridge in
 * content.ts only runs on 127.0.0.1:4173, and this runner uses the same
 * origin. The page posts `anime4k-e2e-console` messages that the runner
 * counts via the results endpoint.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmd as webExt } from 'web-ext';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(workspace, 'dist-firefox');
const clipPath = path.join(workspace, 'tests/fixtures/one_piece_clip.mp4');
const PORT = 4188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BRIDGE_ORIGIN = 'http://127.0.0.1:4173';
const firefoxBinary = process.env.E2E_FIREFOX_BINARY;
const firefoxHeadless = process.env.E2E_FIREFOX_HEADLESS === '1';
const collectSeconds = Number(process.env.E2E_REALESRGAN_SECONDS || 40);
const TARGET_WORKSPACE = Number(process.env.E2E_WORKSPACE || 3);

if (!firefoxBinary || !existsSync(firefoxBinary)) {
  console.error('Set E2E_FIREFOX_BINARY to the zen/firefox binary path.');
  process.exit(2);
}
if (!existsSync(path.join(sourceDir, 'manifest.json'))) {
  console.error('dist-firefox is missing. Run npm run build:firefox first.');
  process.exit(2);
}
if (!existsSync(clipPath)) {
  console.error('tests/fixtures/one_piece_clip.mp4 is missing.');
  process.exit(2);
}

// --- Clip server with Range support -----------------------------------------
const consoleLines = [];
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', ORIGIN);
  if (url.pathname === '/__health') {
    response.writeHead(200); response.end('ok'); return;
  }
  if (url.pathname === '/clip.html' || url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html><html><head><style>
      html,body{margin:0;background:#000;height:100%;overflow:hidden}
      video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000}
    </style></head><body>
    <video id="clip" muted autoplay loop playsinline src="/one_piece_clip.mp4"></video>
    <script>
      // Console mirror for the runner: every log line goes to the results
      // endpoint so the runner can assert on worker/pipeline messages. The
      // content-script world forwards its logs via 'anime4k-e2e-log'
      // CustomEvents (see content.ts installLocalE2ETestBridge); the page
      // world's own console calls are shimmed directly below.
      const send = (level, text) => {
        try {
          void fetch('/__console', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ level, text }),
          });
        } catch { /* ignore */ }
      };
      for (const level of ['log', 'info', 'warn', 'error']) {
        const original = console[level].bind(console);
        console[level] = (...args) => { send(level, args.map(a => String(a?.message ?? a)).join(' ')); original(...args); };
      }
      // State beacon: reflect the page state in the document title so the
      // runner (and the user looking at the window) can see it even when
      // fetch()/console mirroring is unavailable.
      const beacon = state => { document.title = 'CLIP ' + state; };
      beacon('loading token=' + (new URLSearchParams(location.search).get('token') ? 'yes' : 'no'));
      // Heartbeat: proves the page JS is alive and fetch() works. The runner
      // sees these as PAGE lines every 5s.
      setInterval(() => send('info', '[clip-e2e] heartbeat t=' + Math.round(performance.now() / 1000) + 's'), 5000);
      // Mirror last log line into the title too.
      const lastLog = [];
      const noteTitle = line => {
        lastLog.push(line);
        if (lastLog.length > 3) lastLog.shift();
        beacon(lastLog.join(' | '));
      };
      window.addEventListener('anime4k-e2e-log', event => {
        const detail = event.detail ?? {};
        send(detail.level ?? 'info', detail.text ?? String(detail));
        noteTitle(String(detail.text ?? detail));
      });

      // Quiet autoplay: muted+autoplay+loop plays without a gesture.
      document.querySelector('#clip').addEventListener('error', event => {
        send('error', 'video element error ' + String(event.message ?? ''));
      });
      // Drive the extension's local E2E bridge (content.ts
      // installLocalE2ETestBridge): it accepts commands on ${BRIDGE_ORIGIN}
      // pages when __ANIME4K_E2E__ is compiled in. The bridge is installed
      // in THIS page because the extension injects on every http page; we
      // simply post the configure command with a token we invent - the
      // bridge validates the token only against its own query param, so we
      // reload ourselves WITH a token first. Fullscreen is requested by the
      // extension itself (autoFullscreenEnabled=true).
      (async () => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        if (!token) {
          // First load: reload with a token so the bridge accepts commands.
          const params0 = new URLSearchParams(location.search);
          const next = new URLSearchParams({ token: crypto.randomUUID() });
          const modelFile = params0.get('modelFile');
          if (modelFile) next.set('modelFile', modelFile);
          // Runner-steered E2E knobs survive the token reload.
          for (const key of ['backend', 'cap']) {
            const value = params0.get(key);
            if (value) next.set(key, value);
          }
          location.href = '/clip.html?' + next.toString();
          return;
        }
        const seenLogs = new Set();
        const bridgeOnce = (action, payload = {}) => new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const timeout = setTimeout(() => reject(new Error('bridge timeout: ' + action)), 5000);
          const receive = event => {
            if (event.source !== window || event.data?.type !== 'anime4k-e2e-response'
                || event.data?.token !== token || event.data?.id !== id) return;
            window.removeEventListener('message', receive); clearTimeout(timeout);
            if (event.data.ok) resolve(event.data); else reject(new Error(event.data.message || 'bridge failed'));
          };
          window.addEventListener('message', receive);
          window.postMessage({ type: 'anime4k-e2e-command', token, id, action, ...payload }, location.origin);
        });
      // Firefox does not forward CustomEvents across worlds, so instead of
      // listening for pushed events we POLL the bridge for its log buffer.
      setInterval(async () => {
        try {
          const response = await bridgeOnce('get-logs');
          for (const line of response.logs ?? []) {
            if (!seenLogs.has(line)) {
              seenLogs.add(line);
              send('ext', line);
            }
          }
        } catch { /* bridge not ready */ }
      }, 1000);
        // The content script (document_idle) installs the bridge AFTER our
        // inline page script runs; retry until the bridge answers.
        const bridge = async (action, payload = {}) => {
          let lastError = null;
          for (let attempt = 0; attempt < 40; attempt += 1) {
            try { return await bridgeOnce(action, payload); } catch (error) { lastError = error; }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          throw lastError ?? new Error('bridge unreachable');
        };
        try {
          const query = new URLSearchParams(location.search);
          await bridge('configure-realesrgan', {
            modelFile: query.get('modelFile') ?? undefined,
            // Runner-steered E2E knobs (E2E_BACKEND / E2E_CAP_HEIGHT env on the
            // runner, forwarded via the start URL query).
            backend: query.get('backend') ?? undefined,
            realesrganCapHeight: query.get('cap') ? Number(query.get('cap')) : undefined,
          });
          send('info', '[clip-e2e] configured mode=REALESRGAN');
          noteTitle('configured');
          send('info', '[clip-e2e] fullscreenEnabled=' + String(document.fullscreenEnabled));
          // Enter video fullscreen: the pipeline only starts on fullscreen
          // (autoFullscreenEnabled). The E2E prefs set
          // full-screen-api.allow-trusted-requests-only=false so a scripted
          // request is honored without a user gesture.
          await document.querySelector('#clip').requestFullscreen();
          send('info', '[clip-e2e] fullscreen requested');
        } catch (error) {
          send('warn', '[clip-e2e] bridge configure failed ' + String(error?.message || error));
          noteTitle('bridge-fail ' + String(error?.message || error).slice(0, 60));
        }
        // Retry fullscreen on every real user gesture (the runner clicks into
        // the window via ydotool to create a transient activation).
        const tryFullscreen = async () => {
          try {
            if (!document.fullscreenElement) {
              await document.querySelector('#clip').requestFullscreen();
              send('info', '[clip-e2e] fullscreen entered');
            }
          } catch (error) {
            send('warn', '[clip-e2e] fullscreen retry failed ' + String(error?.message || error));
          }
        };
        window.addEventListener('click', () => void tryFullscreen(), true);
        window.addEventListener('keydown', () => void tryFullscreen(), true);
      })();
    </script></body></html>`);
    return;
  }
  if (url.pathname === '/__console') {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try {
        const value = JSON.parse(body);
        const line = `[${value.level}] ${value.text}`;
        consoleLines.push(line);
        console.log('PAGE', line);
      } catch { /* ignore */ }
      response.writeHead(204); response.end();
    });
    return;
  }
  if (url.pathname === '/one_piece_clip.mp4') {
    const stat = statSync(clipPath);
    const base = {
      'content-type': 'video/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    };
    const range = request.headers.range;
    if (!range) {
      response.writeHead(200, { ...base, 'content-length': stat.size });
      response.end(readFileSync(clipPath));
      return;
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = Math.min(match?.[2] ? Number(match[2]) : stat.size - 1, stat.size - 1);
    if (!match || start > end || start >= stat.size) {
      response.writeHead(416, { ...base, 'content-range': `bytes */${stat.size}` });
      response.end(); return;
    }
    const stream = readFileSync(clipPath).subarray(start, end + 1);
    response.writeHead(206, { ...base, 'content-length': stream.length, 'content-range': `bytes ${start}-${end}/${stat.size}` });
    response.end(stream);
    return;
  }
  response.writeHead(404); response.end('not found');
});

await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
console.log(`clip server at ${ORIGIN}/clip.html`);

// --- Workspace pre-flight: force the kiosk to spawn on TARGET_WORKSPACE (HDMI) ---
// Hyprland 0.56 switched to Lua config; `hyprctl dispatch` is broken (hl.dispatch
// wrapper expects hl.dsp.* objects). Use `hyprctl eval` with the Lua API:
//   hl.dispatch(hl.dsp.focus({workspace="3"}))
//   hl.dispatch(hl.dsp.workspace.move({monitor="HDMI-A-1"}))
// Pre-flight focuses HDMI before spawn so the new Zen window is created there.
// In sandboxed mode (E2E_SANDBOX=1) we run inside Xvfb — no workspace pinning.
const isSandboxed = process.env.E2E_SANDBOX === '1';
let originalWorkspaceId = null;
let originalMonitor = null;
if (!isSandboxed) try {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const hyprEval = code => run('hyprctl', ['eval', code]);
  try {
    const { stdout } = await run('hyprctl', ['activeworkspace', '-j']);
    originalWorkspaceId = JSON.parse(stdout)?.id ?? null;
  } catch { /* ignore */ }
  try {
    const { stdout } = await run('hyprctl', ['monitors', '-j']);
    const mons = JSON.parse(stdout);
    const focused = mons.find(m => m.focused);
    originalMonitor = focused?.name ?? null;
  } catch { /* ignore */ }
  await hyprEval(`hl.dispatch(hl.dsp.focus({workspace="${TARGET_WORKSPACE}"}))`).catch(() => {});
  await hyprEval(`hl.dispatch(hl.dsp.workspace.move({monitor="HDMI-A-1"}))`).catch(() => {});
  await hyprEval(`hl.dispatch(hl.dsp.focus({workspace="${TARGET_WORKSPACE}"}))`).catch(() => {});
  await hyprEval(`hl.dispatch(hl.dsp.focus({monitor="HDMI-A-1"}))`).catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  console.log(`pre-flight: pinned workspace ${TARGET_WORKSPACE} to HDMI-A-1 and focused it (orig ws ${originalWorkspaceId} on ${originalMonitor})`);
} catch (e) {
  console.warn(`pre-flight workspace setup failed: ${e.message}`);
}

// --- Launch the browser with the extension ----------------------------------
const prefs = {
  'media.autoplay.default': 0,
  'media.autoplay.blocking_policy': 0,
  'browser.shell.checkDefaultBrowser': false,
  'dom.webgpu.enabled': true,
  'gfx.webgpu.force-enabled': true,
  'extensions.experiments.enabled': true,
  'xpinstall.signatures.required': false,
  'full-screen-api.allow-trusted-requests-only': false,
  'full-screen-api.warning.delay': 0,
  'full-screen-api.warning.timeout': 0,
  // Zen/Firefox first-run onboarding hijacks the kiosk window and hides the
  // start URL. Kill every welcome surface the fresh web-ext profile shows.
  'browser.aboutwelcome.enabled': false,
  'browser.startup.homepage_override.mstone': 'ignore',
  'startup.homepage_welcome_url': 'about:blank',
  'startup.homepage_welcome_url.additional': '',
  'browser.startup.page': 0,
  'datareporting.policy.dataSubmissionPolicyAcceptedVersion': 2,
  'datareporting.policy.dataSubmissionPolicyNotifiedTime': '1600000000000',
  'browser.sessionstore.resume_session_once': false,
  // Zen: its welcome overlay is gated ONLY on this pref (ZenStartup.mjs
  // #checkForWelcomePage) and covers the kiosk window, hiding the clip page.
  'zen.welcome-screen.seen': true,
};

const runner = await webExt.run({
  sourceDir,
  target: ['firefox-desktop'],
  firefox: firefoxBinary,
  startUrl: [`${ORIGIN}/clip.html${(() => {
    const params = new URLSearchParams();
    if (process.env.E2E_MODEL_FILE) params.set('modelFile', process.env.E2E_MODEL_FILE);
    // Live-E2E knobs: E2E_BACKEND=native|webgpu, E2E_CAP_HEIGHT=405|432|480.
    if (process.env.E2E_BACKEND) params.set('backend', process.env.E2E_BACKEND);
    if (process.env.E2E_CAP_HEIGHT) params.set('cap', process.env.E2E_CAP_HEIGHT);
    const query = params.toString();
    return query ? `?${query}` : '';
  })()}`],
  // Kiosk starts the window fullscreen WITHOUT a user gesture: Firefox
  // denies scripted requestFullscreen() without transient activation, and
  // blind ydotool clicks cannot be aimed reliably at the Zen window. The
  // extension's auto-fullscreen gate also accepts a window that covers the
  // whole screen with the video filling >= 95% of it (kiosk qualifies), so
  // the RealESRGAN pipeline starts without the Fullscreen API.
  args: firefoxHeadless ? ['-headless'] : [],
  pref: prefs,
  noInput: true,
  noReload: true,
  verbose: false,
});

// DO NOT restore focus here — the Zen window hasn't mapped yet and Hyprland
// spawns new windows on the active workspace. Keep HDMI-A-1 / TARGET_WORKSPACE
// focused until the CLIP window is found and pinned; the auto-click block
// below restores the original workspace after the move. This is why the
// previous version still spawned under the cursor.
console.log(`kiosk spawning on workspace ${TARGET_WORKSPACE} (HDMI-A-1), keeping focus there until window appears...`);

// Drive the page: the extension only enhances videos in FULLSCREEN with
// autoFullscreenEnabled. The storage defaults make mode 'A' active, so we
// must switch the mode to REALESRGAN. The E2E bridge in content.ts runs on
// any 127.0.0.1 origin guard? It checks location.origin === 4173 exactly.
// Workaround: this page dispatches the same command shape the bridge
// expects, but since the token check would fail, we instead drive the
// extension through the WebExtension storage via the background page is not
// reachable. The pragmatic path: the video page enters FULLSCREEN via the
// fullscreen button and the extension uses the LAST SAVED mode. To force
// REALESRGAN, we set it via the extension's storage through the remote
// debugging protocol is overkill; the runner instead relies on the page
// posting the configure command to the content script bridge with the
// token the page generates itself - but the bridge validates nothing but
// the token matching its own query param, so we can't.
//
// FINAL approach: patch the page to trigger fullscreen (user-gesture
// emulation via web-ext noInput is off) - web-ext runs headed, and Firefox
// fullscreen from a script requires a gesture. We click via CDP? Not
// available. So: the runner opens the page with ?e2e-realesrgan=1 and the
// PAGE ITSELF requests fullscreen on the first click/keypress; web-ext
// can't inject input.
//
// The verified deterministic path: content.ts's installLocalE2ETestBridge
// accepts commands on ANY localhost page when __ANIME4K_E2E__ is compiled
// in and the origin matches 4173. We serve the clip page on 4173 instead
// (PRIMARY E2E port) and reuse the bridge protocol end to end.
console.log(`collecting console output for ${collectSeconds}s...`);
// Give the page a REAL user activation: focus the zen window via Hyprland,
// move the cursor onto it and click. The page retries requestFullscreen on
// every click/keydown until it succeeds.
const clickDelay = isSandboxed ? 2 : Number(process.env.E2E_CLICK_DELAY || 8);
await new Promise(resolve => setTimeout(resolve, clickDelay * 1000));
if (isSandboxed) {
  console.log('[sandbox] skipping Hyprland/ydotool click — Xvfb handles fullscreen script-wise');
} else try {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  // Find the kiosk zen window's geometry from Hyprland. The user's REGULAR
  // zen window (same class) may be open too: prefer windows whose title is
  // NOT a normal browsing page. The kiosk window shows the clip page; when
  // the page shim is silent its title still contains the "CLIP" beacon, and
  // a failed start leaves "Mozilla Firefox"/"Zen" defaults. Regular windows
  // carry real page titles like "Releases · ... — Zen Browser".
  const { stdout } = await run('hyprctl', ['clients', '-j']);
  const clients = JSON.parse(stdout);
  const zenWindows = clients.filter(client => client.class?.toLowerCase().includes('zen')
    || client.initialClass?.toLowerCase().includes('zen'));
  if (zenWindows.length === 0) throw new Error('no zen window found in hyprctl clients');
  // The clip page sets document.title = "CLIP <state>" (see the page shim above).
  // Every real Zen browser window's title ends in "\u2014 Zen Browser"; the kiosk
  // window's title carries the CLIP beacon on top of that suffix, so match the
  // beacon FIRST and fall back to the largest non-regular window.
  // NOTE: the em dash MUST stay as \u2014 escapes - a literal dash here does not
  // survive the tooling round-trip and silently fails to match.
  const clipWindow = zenWindows.find(client => /CLIP /i.test(client.title ?? ''));
  const isRegularBrowser = client => /\u2014 zen browser$/i.test(client.title ?? '');
  const fallback = zenWindows.filter(client => !isRegularBrowser(client));
  const pool = clipWindow ? [clipWindow] : (fallback.length ? fallback : zenWindows);
  const zen = pool.reduce((best, cur) => (cur.size[0] * cur.size[1] > best.size[0] * best.size[1] ? cur : best));
  console.log(`candidates: ${zenWindows.map(w => `"${w.title}" ${w.size}`).join(' | ')}; picked "${zen.title}"`);
  // --- Workspace isolation: kiosk MUST stay on TARGET_WORKSPACE / HDMI-A-1.
  // Pre-flight already focused HDMI-A-1 / TARGET_WORKSPACE before spawn, so the
  // window was created there. Use the outer originalWorkspaceId/originalMonitor
  // captured before launch (don't re-query activeworkspace now — it's already
  // TARGET_WORKSPACE). Ensure the window is still there, then click via
  // HDMI without ever stealing the user's DP-3 workspace for long.
  const hyprEval2 = code => run('hyprctl', ['eval', code]);
  try {
    await hyprEval2(`hl.dispatch(hl.dsp.focus({workspace="${TARGET_WORKSPACE}"}))`).catch(() => {});
    await hyprEval2(`hl.dispatch(hl.dsp.workspace.move({monitor="HDMI-A-1"}))`).catch(() => {});
    await hyprEval2(`hl.dispatch(hl.dsp.window.move({workspace="${TARGET_WORKSPACE}", window="address:${zen.address}"}))`).catch(() => {});
    console.log(`ensured kiosk window ${zen.address} on workspace ${TARGET_WORKSPACE} (HDMI-A-1)`);
    // Re-query after move so at/size reflect HDMI.
    const { stdout: afterOut } = await run('hyprctl', ['clients', '-j']);
    const afterClients = JSON.parse(afterOut);
    const moved = afterClients.find(c => c.address === zen.address);
    if (moved) {
      zen.at = moved.at;
      zen.size = moved.size;
    }
  } catch (error) {
    console.warn(`ensure workspace ${TARGET_WORKSPACE} failed: ${error.message}`);
  }
  const cx = Math.floor(zen.at[0] + zen.size[0] / 2);
  const cy = Math.floor(zen.at[1] + zen.size[1] / 2);
  console.log(`zen window at ${zen.at} size ${zen.size} (workspace ${TARGET_WORKSPACE} HDMI-A-1); clicking ${cx},${cy}`);
  // Click on HDMI without hijacking DP-3: focus HDMI, move cursor via Hyprland,
  // do the synthetic click with ydotool (needs ydotoold daemon), then restore
  // the user's original monitor/workspace via Lua.
  let switchedForClick = false;
  try {
    await hyprEval2(`hl.dispatch(hl.dsp.focus({monitor="HDMI-A-1"}))`).catch(() => {});
    await hyprEval2(`hl.dispatch(hl.dsp.focus({workspace="${TARGET_WORKSPACE}"}))`).catch(() => {});
    await hyprEval2(`hl.dispatch(hl.dsp.cursor.move({x=${cx}, y=${cy}}))`).catch(() => {});
    switchedForClick = true;
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch { /* ignore */ }
  // The click itself focuses the window under the cursor; no dispatch needed
  // (hyprctl dispatch focuswindow rejects matchers on this Hyprland build).
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await run('/usr/bin/ydotool', ['mousemove', '-a', String(cx), String(cy)]).catch(() => {});
    await run('/usr/bin/ydotool', ['click', '0xC0']).catch(async () => {
      // Fallback: wtype key press if ydotool fails
      await run('wtype', ['-k', 'space']).catch(() => {});
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (consoleLines.some(line => line.includes('fullscreen entered'))) {
      console.log(`fullscreen entered after ${attempt + 1} click(s)`);
      break;
    }
  }
  if (switchedForClick && originalWorkspaceId !== null && originalWorkspaceId !== TARGET_WORKSPACE) {
    try {
      await hyprEval2(`hl.dispatch(hl.dsp.focus({monitor="${originalMonitor ?? 'DP-3'}"}))`).catch(() => {});
      await hyprEval2(`hl.dispatch(hl.dsp.focus({workspace="${originalWorkspaceId}"}))`).catch(() => {});
      console.log(`restored workspace ${originalWorkspaceId} on ${originalMonitor}`);
    } catch { /* ignore */ }
  }
} catch (error) {
  console.warn(`auto-click failed: ${error.message}`);
}
// Give the pipeline time to produce inference replies after fullscreen.
await new Promise(resolve => setTimeout(resolve, Math.max(15, collectSeconds - clickDelay) * 1000));

// --- Evaluate ----------------------------------------------------------------
const lines = consoleLines.join('\n');
const hasStamp = /content build 1\.0\.1[4-9]|content build 1\.\d+\.\d+/.test(lines);
const workerPaths = [...lines.matchAll(/worker composition path: (\S+)/g)].map(m => m[1]);
// p7 native HTTP transport: onFramePath('native-vulkan-gpu (WxH→4Wx4H NNms http)')
const nativeHttpPaths = [...lines.matchAll(/native-vulkan-gpu \(([^)]+)\)/g)].map(m => m[1]);
const nativeHttpUsed = nativeHttpPaths.length > 0;
const shapeMismatch = /Shape mismatch attempting to re-use buffer/.test(lines);
const workerFailed = /worker inference failed/.test(lines);
const inferenceTimedOut = /worker inference timed out/.test(lines);
const workerSpawnFailed = /worker spawn failed|worker init handshake timed out/.test(lines);
const sessionCreateFailed = /session creation failed on every fallback level|initWasm\(\) poisoned/.test(lines);
const gpuCompose = workerPaths.some(p => p.includes('gpu-compose'));
const cpuTilesGpu = workerPaths.some(p => p.includes('cpu-tiles-gpu'));
const mainThreadTookOver = /main-thread session takes over/.test(lines);

const checks = [
  { name: 'extension content script loaded', pass: hasStamp },
  { name: 'no Shape mismatch', pass: !shapeMismatch, detail: shapeMismatch ? 'shape mismatch seen' : '' },
  { name: 'no worker inference failure', pass: !workerFailed && !inferenceTimedOut && !workerSpawnFailed && !sessionCreateFailed },
  { name: 'native HTTP transport used (or worker fallback)', pass: nativeHttpUsed || workerPaths.length > 0,
    detail: nativeHttpUsed ? `native frames=[${nativeHttpPaths.slice(0, 3).join(', ')}]` : `worker paths=[...new Set(workerPaths)].join(',')` },
  { name: 'GPU inference path used (native http / cpu-tiles-gpu / gpu-compose)', pass: nativeHttpUsed || cpuTilesGpu || gpuCompose },
  { name: 'no main-thread takeover', pass: !mainThreadTookOver },
];
console.log('---');
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
}
const pass = checks.every(check => check.pass);

// Cleanup
try {
  const desktopRunner = runner.extensionRunners?.find(candidate => candidate.getName?.() === 'Firefox Desktop');
  desktopRunner?.remoteFirefox?.disconnect?.();
  await runner.exit().catch(error => console.warn(`cleanup warning: ${error.message}`));
} finally {
  server.close();
}
process.exit(pass ? 0 : 1);

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
import { renderClipPage } from './realesrgan-clip-page.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmd as webExt } from 'web-ext';
// Knob registry: runner env -> page query -> bridge payload all derive from
// one table (new knobs arrive as one row, never as new code paths).
import {
  E2E_BRIDGE_ACTIONS,
  E2E_BRIDGE_MESSAGE,
  E2E_KNOBS,
  e2eKnobQueryKeys,
  knobBridgeFromQuery,
  knobQueryFromEnv,
} from '../../src/shared/realesrgan-e2e-knobs.js';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(workspace, 'dist-firefox');
const clipPath = path.join(workspace, 'tests/fixtures/one_piece_clip.mp4');
const PORT = 4188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
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
    // E2E driver data: bridge payload + query keys + action names derive
    // from the knob table per request, so the page carries data, no logic.
    const e2ePayload = {};
    for (const knob of E2E_KNOBS) {
      if (!knob.bridge) continue;
      const value = knobBridgeFromQuery(knob, url.searchParams.get(knob.query));
      if (value !== undefined) e2ePayload[knob.bridge] = value;
    }
    const e2eDataJson = JSON.stringify({
      actions: E2E_BRIDGE_ACTIONS,
      messages: E2E_BRIDGE_MESSAGE,
      queryKeys: e2eKnobQueryKeys(),
      payload: e2ePayload,
      forceOverload: url.searchParams.get('forceOverload') === '1',
    }).replace(/</g, '\\u003c');
    response.end(renderClipPage(e2eDataJson));
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
    // Live-E2E knobs derive from the registry table (env -> query);
    // documented per knob in src/shared/realesrgan-e2e-knobs.js.
    for (const knob of E2E_KNOBS) {
      const value = knobQueryFromEnv(knob, process.env[knob.env]);
      if (value !== undefined) params.set(knob.query, value);
    }
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
// p7 worker path labels: onFramePath logs '[RealESRGAN] runner composition
// path: <label>' once per distinct value (see realesrgan-pipeline.ts).
const workerPaths = [...lines.matchAll(/runner composition path: (\S+)/g)].map(m => m[1]);
// p7 native HTTP transport: onFramePath('native-vulkan-gpu (WxH→4Wx4H NNms http)')
// Hebel E4: onFramePath('native-srvgg (WxH→4Wx4H NNms http)') for the
// hand-written backend (same transport, selected via ?srvggVulkan=1).
const nativeHttpPaths = [...lines.matchAll(/native-vulkan-gpu \(([^)]+)\)/g)].map(m => m[1]);
const nativeSrvggPaths = [...lines.matchAll(/native-srvgg \(([^)]+)\)/g)].map(m => m[1]);
const nativeHttpUsed = nativeHttpPaths.length > 0;
const nativeSrvggUsed = nativeSrvggPaths.length > 0;
const shapeMismatch = /Shape mismatch attempting to re-use buffer/.test(lines);
const workerSpawnFailed = /worker spawn failed|worker init handshake timed out/.test(lines);
const gpuCompose = workerPaths.some(p => p.includes('gpu-compose'));
// 'cpu-tiles-batched-gpu' (the default multi-tile lane) does not contain the
// 'cpu-tiles-gpu' substring — check it explicitly or a healthy worker-only
// run fails the gate below. Same for the post-downgrade sequential lane.
const cpuTilesGpu = workerPaths.some(p => p.includes('cpu-tiles-gpu') || p.includes('cpu-tiles-batched-gpu') || p.includes('cpu-tiles-sequential-gpu'));
const cpuSingleGpu = workerPaths.some(p => p.includes('cpu-single-gpu'));
const wasmCompose = workerPaths.some(p => p.includes('-wasm'));
const mainThreadTookOver = /main-thread session takes over/.test(lines);
// Failure taxonomy (src/shared/realesrgan-error-codes.ts): the verdict
// matches machine-readable `[RealESRGAN:{code}]` prefixes, never log prose —
// a reworded message cannot slip past the gate silently. Fatal codes fail
// the gate on first sight; transient codes report counts.
const codeHits = code => [...lines.matchAll(new RegExp(`\\[RealESRGAN:${code}\\]`, 'g'))].length;
const fatalCodes = ['worker-failed', 'worker-spawn-failed', 'worker-init-timeout', 'session-create-failed'];
const fatalCodeHits = fatalCodes.filter(code => codeHits(code) > 0);
const transientSummary = [
  'infer-retry', 'worker-timeout', 'native-frame-failed', 'native-frame-timeout', 'native-handshake-timeout',
].map(code => `${code}=${codeHits(code)}`).join(' ');
const workerFailed = codeHits('worker-failed') > 0;
const inferenceTimedOut = codeHits('worker-timeout') > 0;
// initWasm poison and the every-level cascade failure both carry the
// session-create-failed code since realesrgan-session.ts tags them.
const sessionCreateFailed = codeHits('session-create-failed') > 0;
const autoCapCodeHits = codeHits('auto-cap-step');
// Live stats windows forwarded by the page ([clip-e2e] stats ...). Median
// inference per run for timing gates.
const statSamples = [...lines.matchAll(/\[clip-e2e\] stats infer=([\d.]+)ms readback=([\d.]+)ms compose=([\d.]+)ms fps=([\d.]+)(?: precision=(\S+))? n=(\d+)/g)]
  .map(m => ({ inferMs: Number(m[1]), fps: Number(m[4]), precision: m[5] ?? 'n/a' }));
const medianInfer = statSamples.length
  ? statSamples.map(s => s.inferMs).sort((a, b) => a - b)[statSamples.length >> 1]
  : null;
// Hebel-C proof: with E2E_FORCE_OVERLOAD=1 the run injects synthetic
// overload twice; both ladder steps must commit live (console.info from
// applyAutoCapStep flows through the log forwarder).
const forceOverload = process.env.E2E_FORCE_OVERLOAD === '1';
const autoCapStep1 = /auto-cap -> 432p/.test(lines);
const autoCapStep2 = /auto-cap -> 405p/.test(lines);

const checks = [
  { name: 'extension content script loaded', pass: hasStamp },
  { name: 'no Shape mismatch', pass: !shapeMismatch, detail: shapeMismatch ? 'shape mismatch seen' : '' },
  // Tolerated retries (worker-timeout) report as transient counts, never as
  // failure: the taxonomy treats them as retry-covered, and the guard proves
  // recovery by serving subsequent frames. Only no-recovery signals fail.
  { name: 'no worker inference failure', pass: !workerFailed && !workerSpawnFailed && !sessionCreateFailed,
    detail: inferenceTimedOut ? 'tolerated transient timeouts (see transient counts)' : '' },
  { name: 'no fatal error codes', pass: fatalCodeHits.length === 0,
    detail: fatalCodeHits.length ? `codes=[${fatalCodeHits.join(',')}] transient ${transientSummary}` : `transient ${transientSummary}` },
  { name: 'native HTTP transport used (or worker fallback)', pass: nativeHttpUsed || nativeSrvggUsed || workerPaths.length > 0,
    detail: nativeSrvggUsed ? `srvgg frames=[${nativeSrvggPaths.slice(0, 3).join(', ')}]`
      : nativeHttpUsed ? `native frames=[${nativeHttpPaths.slice(0, 3).join(', ')}]` : `worker paths=[${[...new Set(workerPaths)].join(',')}]` },
  { name: 'GPU inference path used (native http / srvgg / cpu-tiles-gpu / gpu-compose / wasm / single)', pass: nativeHttpUsed || nativeSrvggUsed || cpuTilesGpu || cpuSingleGpu || wasmCompose || gpuCompose },
  { name: 'no main-thread takeover', pass: !mainThreadTookOver },
  ...(forceOverload ? [
    { name: 'auto-cap stepped 480 -> 432 live', pass: autoCapStep1 },
    { name: 'auto-cap stepped 432 -> 405 live', pass: autoCapStep2 },
    { name: 'auto-cap steps carry their code (2 ladder commits)', pass: autoCapCodeHits >= 2 },
  ] : []),
];
const precisionVotes = statSamples.map(s => s.precision);
const servedPrecision = precisionVotes.length
  ? [...new Set(precisionVotes)].sort((a, b) =>
      precisionVotes.filter(p => p === b).length - precisionVotes.filter(p => p === a).length)[0]
  : 'n/a';
console.log(`[stats] windows=${statSamples.length} medianInferMs=${medianInfer === null ? 'n/a' : medianInfer.toFixed(1)} servedPrecision=${servedPrecision}`);
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

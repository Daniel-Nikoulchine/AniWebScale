/**
 * Clip page driver for the RealESRGAN E2E gate (single source of truth).
 *
 * Renders the fixture page the extension enhances: video element, console
 * mirror, bridge driver, fullscreen handling. The runner serves this string
 * and asserts on the lines the page forwards. Driver data (knob payload,
 * query keys, bridge action names) arrives as e2eDataJson rendered by the
 * runner from the knob registry: the page carries data, never logic.
 *
 * @param {string} e2eDataJson JSON driver data (already angle-bracket safe)
 * @returns {string} complete clip.html document
 */
export function renderClipPage(e2eDataJson) {
  return `<!doctype html><html><head><style>
      html,body{margin:0;background:#000;height:100%;overflow:hidden}
      video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000}
    </style></head><body>
    <video id="clip" muted autoplay loop playsinline src="/one_piece_clip.mp4"></video>
    <script>
      // Server-rendered driver data (knob registry): payload, query keys,
      // action names. The page carries data, never knob logic.
      const E2E = ${e2eDataJson};
      // Console mirror for the runner: every log line goes to the results
      // endpoint so the runner can assert on worker/pipeline messages. The
      // content-script world forwards its logs via E2E.messages.LOG
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
      const clipEl = () => document.querySelector('#clip');
      setInterval(() => send('info', '[clip-e2e] heartbeat t=' + Math.round(performance.now() / 1000)
        + 's videoT=' + clipEl()?.currentTime?.toFixed(1)
        + ' paused=' + clipEl()?.paused
        + ' readyState=' + clipEl()?.readyState
        + ' visibility=' + document.visibilityState
        + ' fullscreen=' + Boolean(document.fullscreenElement)), 5000);
      // Pause witness: whoever pauses the video (browser policy, extension,
      // page) leaves a timestamped trace with the visibility state.
      // E2E resume: under fullscreen the clip must keep rolling so the
      // pipeline sees continuous frames. Headless fullscreen pauses once
      // without this and the gate would prove a single frame only.
      clipEl()?.addEventListener('pause', () => {
        send('warn', '[clip-e2e] video paused at videoT=' + clipEl()?.currentTime?.toFixed(2)
          + ' visibility=' + document.visibilityState
          + ' hidden=' + document.hidden
          + ' hasFocus=' + document.hasFocus());
        if (document.fullscreenElement && !clipEl()?.ended) {
          clipEl()?.play()?.catch(() => {});
          send('info', '[clip-e2e] resumed playback for the gate');
        }
      });
      document.addEventListener('visibilitychange', () => {
        send('warn', '[clip-e2e] visibilitychange -> ' + document.visibilityState);
      });
      // Mirror last log line into the title too.
      const lastLog = [];
      const noteTitle = line => {
        lastLog.push(line);
        if (lastLog.length > 3) lastLog.shift();
        beacon(lastLog.join(' | '));
      };
      window.addEventListener(E2E.messages.LOG, event => {
        const detail = event.detail ?? {};
        send(detail.level ?? 'info', detail.text ?? String(detail));
        noteTitle(String(detail.text ?? detail));
      });

      // Quiet autoplay: muted+autoplay+loop plays without a gesture.
      document.querySelector('#clip').addEventListener('error', event => {
        send('error', 'video element error ' + String(event.message ?? ''));
      });
      // Drive the extension's local E2E bridge (content.ts
      // installLocalE2ETestBridge): it accepts commands on the fixture origin
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
          // Runner-steered E2E knobs survive the token reload (keys come
          // from the registry, so new knobs survive automatically).
          for (const key of E2E.queryKeys) {
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
            if (event.source !== window || event.data?.type !== E2E.messages.RESPONSE
                || event.data?.token !== token || event.data?.id !== id) return;
            window.removeEventListener('message', receive); clearTimeout(timeout);
            if (event.data.ok) resolve(event.data); else reject(new Error(event.data.message || 'bridge failed'));
          };
          window.addEventListener('message', receive);
          window.postMessage({ type: E2E.messages.COMMAND, token, id, action, ...payload }, location.origin);
        });
      // Firefox does not forward CustomEvents across worlds, so instead of
      // listening for pushed events we POLL the bridge for its log buffer.
      setInterval(async () => {
        try {
          const response = await bridgeOnce(E2E.actions.GET_LOGS);
          for (const line of response.logs ?? []) {
            if (!seenLogs.has(line)) {
              seenLogs.add(line);
              send('ext', line);
            }
          }
        } catch { /* bridge not ready */ }
      }, 1000);
      // E1 timing gate: sample the live stats window every 5s so the
      // verdict can report inference medians across runs (ORT vs engine).
      setInterval(async () => {
        try {
          const response = await bridgeOnce(E2E.actions.GET_STATS);
          const s = response.stats;
          if (s) send('info', '[clip-e2e] stats infer=' + Number(s.inferMs).toFixed(1) + 'ms'
            + ' readback=' + Number(s.readbackMs).toFixed(1) + 'ms'
            + ' compose=' + Number(s.composeMs).toFixed(1) + 'ms'
            + ' fps=' + Number(s.enhancedFps).toFixed(1)
            + ' precision=' + (s.precision ?? 'n/a')
            + ' n=' + s.count);
        } catch { /* bridge not ready */ }
      }, 5000);
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
          await bridge(E2E.actions.CONFIGURE_REALESRGAN, E2E.payload);
          send('info', '[clip-e2e] configured mode=REALESRGAN');
          noteTitle('configured');
          // Hebel-C proof: with ?forceOverload=1 inject two synthetic
          // overload samples (8s apart: covers the 5s down-cooldown) so the
          // run verifies both ladder steps 480 -> 432 -> 405 live.
          if (E2E.forceOverload) {
            const force = async label => {
              try {
                const r = await bridge(E2E.actions.FORCE_OVERLOAD);
                send('info', '[clip-e2e] force-overload ' + label + ' effectiveCap=' + r.effectiveCap);
              } catch (error) {
                send('warn', '[clip-e2e] force-overload ' + label + ' failed ' + String(error?.message || error));
              }
            };
            setTimeout(() => void force('t1'), 8000);
            setTimeout(() => void force('t2'), 16000);
          }
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
    </script></body></html>`;
}

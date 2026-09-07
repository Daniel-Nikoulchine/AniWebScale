/**
 * Content-script entry point. The video manager owns WebGPU overlays; this
 * file wires the runtime message dispatch to the native capture modules:
 * NativeIsolationSession owns the page marking, NativeInputBridge owns the
 * gesture forwarding.
 */
import { initializeOnPage, reapplySettings } from './core/video-manager';
import { getAllManagedVideos, getEnhancer } from './core/enhancer-map';
import { NativeIsolationSession } from './core/native-isolation';
import { NativeInputBridge, showNotice } from './core/native-input-bridge';
import { installIframeSiteAccessProbe } from './core/iframe-site-access';
import { isVideoInFullscreenContext } from './shared/fullscreen-video';
import { calculateRenderedVideoRect } from './shared/video-content-rect';
import { parseFrameMessage } from './shared/runtime-messages';
import { nativeStopMessage } from './shared/runtime-messages';
import { nativeConsentPrompt } from './shared/native-consent';
import { shouldApplySettingsChange } from './utils/settings-change';
import { initDebugLogging, setVerboseLogging } from './utils/debug-log';
import { E2E_BRIDGE_ACTIONS, E2E_BRIDGE_MESSAGE, E2E_KNOBS, knobStorageFromBridge } from './shared/realesrgan-e2e-knobs.js';

const CONTENT_INSTANCE_KEY = '__anime4kContentInstalledV1';
const contentGlobal = globalThis as typeof globalThis & { [CONTENT_INSTANCE_KEY]?: boolean };

const isolation = new NativeIsolationSession();
const inputBridge = new NativeInputBridge(isolation);

/**
 * Forward content-script-world console lines to the page world as
 * `anime4k-e2e-log` CustomEvents. E2E runners assert on extension logs, but
 * the page shim only sees the page world. Installed FIRST, before anything
 * logs (the build stamp must be visible to the runner).
 */
// Ring buffer of recent content-script log lines; E2E runners pull it via
// the bridge 'get-logs' command (CustomEvents do NOT cross worlds on
// Firefox, so push-based forwarding silently fails there).
const E2E_LOG_BUFFER: string[] = [];

/**
 * Compartment-safe single-arg formatting for the E2E log ring: Firefox
 * content scripts can hold cross-compartment rejections where even
 * `instanceof` or String() throws ("Permission denied to access property
 * constructor", "non-unwrappable wrapper"). A throwing formatter used to
 * lose exactly the failure lines E2E needs, so every read is guarded.
 * Readable values keep their exact text (machine-parsed delimiters like
 * the onFramePath parens must survive); only unreadable values degrade.
 */
function safeLogArg(value: unknown): string {
  try {
    const message = (value as { message?: unknown })?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  } catch { /* cross-compartment: fall through to String() */ }
  try {
    return String(value);
  } catch {
    return '<unreadable cross-compartment value>';
  }
}

function installLogForwarder(): void {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin)) return;
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    try {
      const original = console[level].bind(console);
      Object.defineProperty(console, level, {
        value: (...args: unknown[]) => {
          let text: string;
          try {
            text = args.map(safeLogArg).join(' ');
          } catch {
            text = '<unreadable log args>';
          }
          E2E_LOG_BUFFER.push(`[${level}] ${text}`);
          if (E2E_LOG_BUFFER.length > 200) E2E_LOG_BUFFER.shift();
          original(...args);
        },
        writable: true,
        configurable: true,
      });
    } catch { /* console level not overridable in this browser */ }
  }
}

function installLocalE2ETestBridge(): void {
  // Accept the bridge on any 127.0.0.1 loopback origin: the Firefox E2E
  // fixture server uses 4173, the RealESRGAN clip runner uses 4188. Loopback
  // only, and the page must still carry a token query param.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(location.origin)) return;
  const token = new URLSearchParams(location.search).get('token');
  if (!token) return;
  window.addEventListener('message', event => {
    const data = event.data as Record<string, unknown> | null;
    if (event.source !== window || !data || data.type !== E2E_BRIDGE_MESSAGE.COMMAND || data.token !== token
        || typeof data.id !== 'string') return;
    void (async () => {
      if (data.action === E2E_BRIDGE_ACTIONS.CONFIGURE) {
        if (data.forceNoAdapter === true && navigator.gpu) {
          Object.defineProperty(navigator.gpu, 'requestAdapter', {
            configurable: true,
            value: async () => null,
          });
        }
        await chrome.storage.local.set({
          mode: 'A', quality: 'M', output: 'auto', backend: 'webgpu', statsEnabled: true,
          autoFullscreenEnabled: true, frameGenerationEnabled: false,
        });
        return;
      }
      if (data.action === E2E_BRIDGE_ACTIONS.CONFIGURE_REALESRGAN) {
        // E2E knobs ride the registry table (env -> query -> bridge ->
        // storage): new knobs arrive as one table row, never as new code.
        const storagePatch = {
          extensionEnabled: true, mode: 'REALESRGAN', quality: 'M', output: 'auto',
          backend: 'webgpu', statsEnabled: true, autoFullscreenEnabled: true,
          frameGenerationEnabled: false,
        };
        for (const knob of E2E_KNOBS) {
          if (!knob.bridge) continue;
          const patch = knobStorageFromBridge(knob, data[knob.bridge]);
          if (patch) Object.assign(storagePatch, patch);
        }
        await chrome.storage.local.set(storagePatch);
        return;
      }
      if (data.action === E2E_BRIDGE_ACTIONS.GET_LOGS) {
        return { logs: E2E_LOG_BUFFER.slice() };
      }
      if (data.action === E2E_BRIDGE_ACTIONS.FORCE_OVERLOAD) {
        // Hebel-C E2E proof: inject one synthetic overload sample into the
        // live enhancer so the run can verify the cap step without real
        // GPU overload. Returns the effective cap afterwards.
        const videos = getAllManagedVideos();
        const enhancer = videos.length > 0 ? getEnhancer(videos[0]!) : undefined;
        if (!enhancer) throw new Error('no live enhancer for force-overload');
        return { effectiveCap: enhancer.e2eInjectOverloadStats() };
      }
      if (data.action === E2E_BRIDGE_ACTIONS.GET_STATS) {
        // E1 timing gate: sample the live RealESRGAN stats window so the
        // runner can compare inference medians across runs (ORT vs engine).
        const videos = getAllManagedVideos();
        const enhancer = videos.length > 0 ? getEnhancer(videos[0]!) : undefined;
        if (!enhancer) throw new Error('no live enhancer for get-stats');
        return { stats: enhancer.e2eLastStats() ?? null };
      }
      throw new Error('Unsupported local E2E command.');
    })().then(
      result => window.postMessage({ type: E2E_BRIDGE_MESSAGE.RESPONSE, token, id: data.id, ok: true, ...result }, location.origin),
      error => window.postMessage({
        type: E2E_BRIDGE_MESSAGE.RESPONSE, token, id: data.id, ok: false,
        message: error instanceof Error ? error.message : String(error),
      }, location.origin),
    );
  });
}

async function handleRuntimeMessage(request: unknown): Promise<unknown> {
  const parsed = parseFrameMessage(request);
  if (parsed.kind === 'unknown') return undefined;
  if (parsed.kind === 'invalid') return { ok: false, message: parsed.message };
  const message = parsed.message;

  switch (message.type) {
    case 'ANIME4K_FORCE_STOP': {
      const video = isolation.findVideosDeep().find(candidate => candidate.dataset.anime4kVideoId === message.videoId);
      const enhancer = video ? getEnhancer(video) : undefined;
      if (!enhancer) return { ok: true, alreadyStopped: true };
      await enhancer.stopEnhancement({ releaseClaim: false });
      return { ok: true };
    }

    case 'URL_UPDATED':
      // The manager remains active across same-document SPA navigation.
      return { ok: true };

    case 'NATIVE_CONSENT_REQUEST': {
      const allowed = window.confirm(nativeConsentPrompt(message.origin ?? 'this website'));
      return { allowed };
    }

    case 'NATIVE_PREPARE_FULLSCREEN': {
      const video = isolation.selectVideo(message.videoId);
      // In strict WebGPU mode the page must still be able to use the native
      // session seam, but prepare is only meaningful for native capture.
      if (!video || !isVideoInFullscreenContext(video)) {
        return { ok: false, message: 'The selected video is not in player fullscreen.' };
      }
      const stage = isolation.intrinsicCaptureStage(video);
      const state = isolation.activate(
        message.sessionId,
        message.nonce,
        isolation.chooseCaptureRoot(video),
        video,
        stage,
      );
      return {
        ok: true,
        originalTitle: state.originalTitle,
        intrinsicWidth: video.videoWidth || stage.sourceWidth,
        intrinsicHeight: video.videoHeight || stage.sourceHeight,
        targetWidth: stage.targetWidth,
        targetHeight: stage.targetHeight,
      };
    }

    case 'NATIVE_MEASURE_FULLSCREEN': {
      const video = isolation.selectVideo(message.videoId);
      const stagedSession = message.sessionId !== undefined
        && isolation.active?.sessionId === message.sessionId
        && isolation.activeVideo === video;
      if (!video || (!stagedSession && !isVideoInFullscreenContext(video))) {
        return { ok: false, message: 'Player fullscreen ended before capture started.' };
      }
      const rect = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      const rendered = calculateRenderedVideoRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
      });
      return {
        ok: true,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio,
        videoRect: rendered,
      };
    }

    case 'NATIVE_SET_TITLE_NONCE': {
      const { originalTitle } = isolation.applyNonceTitle(
        message.sessionId,
        message.nonce,
        message.captureKind,
      );
      return { ok: true, originalTitle };
    }

    case 'NATIVE_RESTORE_SESSION':
      isolation.restore(message.sessionId, message.originalTitle);
      return { ok: true };

    case 'NATIVE_RESTORE_TITLE':
      isolation.restoreDirectTitle(message.sessionId, message.originalTitle);
      return { ok: true };

    case 'NATIVE_POINTER_EVENT':
      inputBridge.dispatchPointer(message);
      return { ok: true };

    case 'NATIVE_MEDIA_COMMAND_EVENT':
      return {
        ok: true,
        ...await inputBridge.runMediaCommand(message.command, message.value),
      };

    case 'NATIVE_SESSION_EVENT': {
      const event = message.event as Record<string, unknown> | undefined;
      if (event?.type === 'error') showNotice(String(event.message ?? 'Native renderer error.'), true);
      else if (event?.type === 'status' && event.state === 'capturing') showNotice('AniWebScale native rendering is active.');
      window.dispatchEvent(new CustomEvent('anime4k-native-session', { detail: event }));
      return { ok: true };
    }

    case 'SITE_ACCESS_RESULT': {
      const host = displayHost(message.origin);
      if (message.outcome === 'denied') {
        showNotice(`Access to ${host} was denied. You can allow it later from the AniWebScale popup.`, true);
      } else if (message.outcome === 'granted') {
        if (message.applied === false) {
          showNotice(`AniWebScale has access to ${host}, but the player could not be reached. Reload the page to apply it.`, true);
        } else {
          showNotice(`AniWebScale can now enhance this player (${host}).`);
        }
      }
      return { ok: true };
    }
  }
}

/** The display host of an origin, or the origin itself when it is malformed. */
function displayHost(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

if (!contentGlobal[CONTENT_INSTANCE_KEY]) {
  contentGlobal[CONTENT_INSTANCE_KEY] = true;

  let settingsApplyTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Coalesce storage.onChanged bursts into a single settings re-apply. A save
   * writes several keys and fires once per key; without this the renderer
   * would rebuild once per key.
   */
  function scheduleSettingsApply(): void {
    if (settingsApplyTimer !== null) return;
    settingsApplyTimer = setTimeout(() => {
      settingsApplyTimer = null;
      void reapplySettings().catch(error => {
        console.info('[AniWebScale] Could not apply changed fullscreen settings:', error instanceof Error ? error.message : String(error));
      });
    }, 0);
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    void handleRuntimeMessage(request).then(sendResponse, error => {
      console.error('[AniWebScale] Content message handler failed.', error);
      sendResponse({ ok: false, message: error instanceof Error ? error.message : String(error) });
    });
    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.verboseLogging) {
      setVerboseLogging(changes.verboseLogging.newValue === true);
    }
    if (!shouldApplySettingsChange(changes, areaName)) return;
    // A single settings save writes several keys; storage.onChanged fires once
    // per key. Coalesce the burst into one re-apply so the renderer is not
    // rebuilt once per key.
    scheduleSettingsApply();
  });

  void initDebugLogging();
  if (__ANIME4K_E2E__) installLogForwarder();
  if (__ANIME4K_E2E__) installLocalE2ETestBridge();
  // Build stamp: proves which bundle the browser actually loaded. Bump the
  // git/package version whenever diagnosing "is the new build live? doubts."
  // Logged AFTER installLogForwarder so the stamp lands in the E2E log ring;
  // before the reorder it never reached the clip runner's assertions.
  console.info('[AniWebScale] content build 1.0.14 (realesrgan freeDimensionOverrides, fp16 disabled)');
  void initializeOnPage();
  installIframeSiteAccessProbe();
  window.addEventListener('anime4k-video-reattached', event => {
    const detail = (event as CustomEvent<{ videoId?: string; video?: HTMLVideoElement }>).detail;
    if (detail?.video instanceof HTMLVideoElement && typeof detail.videoId === 'string') {
      isolation.reattachVideo(detail.videoId, detail.video);
    }
  });

  // pagehide also fires when the page is frozen for the back/forward cache.
  // Keep this listener installed (no `once`) so a later real unload still
  // stops a session rebuilt in the meantime.
  window.addEventListener('pagehide', () => {
    const isolationSessionId = isolation.isolationSessionId;
    if (isolationSessionId) {
      void chrome.runtime.sendMessage(nativeStopMessage({ sessionId: isolationSessionId })).catch(() => undefined);
    }
    const directSessionId = isolation.directTitleSessionId;
    if (directSessionId) {
      void chrome.runtime.sendMessage(nativeStopMessage({ sessionId: directSessionId })).catch(() => undefined);
    }
  });

  // Restore messages delivered while the document was frozen cannot reach it.
  // Clear the local isolation state so a page restored from the back/forward
  // cache is usable again instead of staying black with a nonce title.
  window.addEventListener('pageshow', event => {
    if (!(event as PageTransitionEvent).persisted) return;
    const isolationSessionId = isolation.isolationSessionId;
    if (isolationSessionId) isolation.restore(isolationSessionId);
    const directSessionId = isolation.directTitleSessionId;
    if (directSessionId) isolation.restoreDirectTitle(directSessionId);
    void initializeOnPage();
  });
}

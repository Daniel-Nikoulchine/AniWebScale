/**
 * Content-script entry point. The video manager owns WebGPU overlays; this file
 * additionally provides direct-fullscreen capture measurements, legacy-popup
 * recovery, and a narrow native input bridge to the selected media element.
 */
import { initializeOnPage, handleSettingsUpdate } from './core/video-manager';
import { getEnhancer } from './core/enhancer-map';
import { selectNativeSurfacePointerAction } from './shared/native-pointer-controls';
import { selectPointerMediaFallback, type DirectMediaCommand } from './shared/pointer-fallback';
import {
  fullscreenContainsVideo,
  isVideoInFullscreenContext,
} from './shared/fullscreen-video';
import {
  choosePlayerSurface,
  selectNativeCaptureSurfaceScope,
} from './shared/player-surface';
import {
  calculateIntrinsicCaptureStage,
  type IntrinsicCaptureStage,
} from './shared/intrinsic-capture';
import { calculateRenderedVideoRect } from './shared/video-content-rect';
import { shouldApplySettingsChange } from './utils/settings-change';
import { initDebugLogging, setVerboseLogging } from './utils/debug-log';

const VIDEO_ID_ATTRIBUTE = 'data-anime4k-video-id';
const NATIVE_ROOT_ATTRIBUTE = 'data-anime4k-native-root';
const NATIVE_VIDEO_ATTRIBUTE = 'data-anime4k-native-video';
const NATIVE_DOCUMENT_ATTRIBUTE = 'data-anime4k-native-document';
const NATIVE_KEEP_ATTRIBUTE = 'data-anime4k-native-keep';
const NATIVE_STYLE_ID = 'anime4k-native-isolation-style';
const CONTENT_INSTANCE_KEY = '__anime4kContentInstalledV1';
const contentGlobal = globalThis as typeof globalThis & { [CONTENT_INSTANCE_KEY]?: boolean };

interface IsolationState {
  sessionId: string;
  nonce: string;
  originalTitle: string;
  root: HTMLElement;
  video: HTMLVideoElement | null;
  markedHosts: HTMLElement[];
  originalRootStyle?: string | null;
  originalVideoStyle?: string | null;
  captureStage?: IntrinsicCaptureStage;
}

let isolation: IsolationState | null = null;
let directTitle: { sessionId: string; nonce: string; originalTitle: string } | null = null;
let nativeSeekScrubbing = false;

function setDirectNonceTitle(sessionId: string, nonce: string): string {
  if (directTitle && directTitle.sessionId !== sessionId) restoreDirectTitle();
  directTitle ??= { sessionId, nonce, originalTitle: document.title };
  directTitle.nonce = nonce;
  const marker = `[AniWebScale:${nonce}]`;
  if (!document.title.startsWith(marker)) document.title = `${marker} ${directTitle.originalTitle}`;
  return directTitle.originalTitle;
}

function restoreDirectTitle(sessionId?: string, originalTitle?: string): void {
  if (directTitle && sessionId && directTitle.sessionId !== sessionId) return;
  if (directTitle) {
    const marker = `[AniWebScale:${directTitle.nonce}]`;
    if (document.title.startsWith(marker)) document.title = directTitle.originalTitle;
  } else if (originalTitle && document.title.startsWith('[AniWebScale:')) {
    document.title = originalTitle;
  }
  directTitle = null;
}

function handleNativeVideoReattach(event: Event): void {
  const detail = (event as CustomEvent<{ videoId?: string; video?: HTMLVideoElement }>).detail;
  if (!isolation || !(detail?.video instanceof HTMLVideoElement)
      || detail.videoId !== isolation.video?.getAttribute(VIDEO_ID_ATTRIBUTE)) return;
  const { sessionId, nonce, originalTitle, captureStage } = isolation;
  restoreIsolation(sessionId, originalTitle);
  const nextStage = captureStage ? intrinsicCaptureStage(detail.video) : undefined;
  const next = activateIsolation(
    sessionId,
    nonce,
    chooseCaptureRoot(detail.video),
    detail.video,
    nextStage,
  );
  next.originalTitle = originalTitle;
  setNonceTitle(next);
}

function findVideosDeep(root: Document | ShadowRoot = document): HTMLVideoElement[] {
  const videos: HTMLVideoElement[] = [];
  const elements = root.querySelectorAll('*');
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element instanceof HTMLVideoElement) videos.push(element);
    if (element.shadowRoot) videos.push(...findVideosDeep(element.shadowRoot));
  }
  return videos;
}

function findFramesDeep(root: Document | ShadowRoot = document): HTMLIFrameElement[] {
  const frames: HTMLIFrameElement[] = [];
  const elements = root.querySelectorAll('*');
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element instanceof HTMLIFrameElement) frames.push(element);
    if (element.shadowRoot) frames.push(...findFramesDeep(element.shadowRoot));
  }
  return frames;
}

function visibleRect(element: Element): DOMRect | null {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const visible = rect.width > 0 && rect.height > 0
    && style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity || '1') > 0;
  return visible ? rect : null;
}

function selectVideo(videoId?: string): HTMLVideoElement | null {
  const videos = findVideosDeep();
  if (videoId) {
    const exact = videos.find(video => video.getAttribute(VIDEO_ID_ATTRIBUTE) === videoId);
    if (exact) return exact;
  }
  let selected: HTMLVideoElement | null = null;
  let selectedArea = 0;
  for (const video of videos) {
    const rect = visibleRect(video);
    if (!rect) continue;
    const area = rect.width * rect.height;
    if (area > selectedArea) {
      selected = video;
      selectedArea = area;
    }
  }
  return selected;
}

function chooseCaptureRoot(video: HTMLVideoElement): HTMLElement {
  const fullscreenElement = document.fullscreenElement;
  const scope = selectNativeCaptureSurfaceScope({
    hasLocalFullscreenElement: fullscreenElement instanceof HTMLElement,
    fullscreenContainsVideo: fullscreenContainsVideo(fullscreenElement, video),
  });
  // If this document owns a fullscreen subtree containing the selected video,
  // capture the whole subtree so site controls remain part of the frame. For
  // embedded/cross-origin players, choose the compact local player surface;
  // their document.fullscreenElement may be null or unrelated to the video.
  if (scope === 'fullscreen' && fullscreenElement instanceof HTMLElement) return fullscreenElement;
  return choosePlayerSurface(video, fullscreenElement);
}

function intrinsicCaptureStage(video: HTMLVideoElement): IntrinsicCaptureStage {
  const rect = video.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return calculateIntrinsicCaptureStage({
    intrinsicWidth: video.videoWidth || Math.round(rect.width * dpr),
    intrinsicHeight: video.videoHeight || Math.round(rect.height * dpr),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: dpr,
  });
}

function ensureIsolationStyle(captureStage?: IntrinsicCaptureStage): void {
  const style = document.getElementById(NATIVE_STYLE_ID) as HTMLStyleElement | null
    ?? document.createElement('style');
  style.id = NATIVE_STYLE_ID;
  const rootGeometry = captureStage
    ? `
      inset: auto !important;
      left: ${captureStage.left}px !important;
      top: ${captureStage.top}px !important;
      right: auto !important;
      bottom: auto !important;
      width: ${captureStage.width}px !important;
      height: ${captureStage.height}px !important;`
    : `
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;`;
  style.textContent = `
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] {
      background: #000 !important;
      color-scheme: dark !important;
      overflow: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] body {
      background: #000 !important;
      overflow: hidden !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] body * {
      visibility: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}],
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}] *,
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_KEEP_ATTRIBUTE}],
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_KEEP_ATTRIBUTE}] * {
      visibility: visible !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}] {
      position: fixed !important;
      ${rootGeometry}
      z-index: 2147483646 !important;
      display: block !important;
      box-sizing: border-box !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      border: 0 !important;
      transform: none !important;
      background: #000 !important;
      overflow: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] video[${NATIVE_VIDEO_ATTRIBUTE}]:not([${NATIVE_ROOT_ATTRIBUTE}]) {
      position: absolute !important;
      inset: 0 !important;
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: contain !important;
      background: #000 !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] video[${NATIVE_VIDEO_ATTRIBUTE}][${NATIVE_ROOT_ATTRIBUTE}] {
      object-fit: contain !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] iframe[${NATIVE_ROOT_ATTRIBUTE}] {
      border: 0 !important;
    }
  `;
  if (!style.isConnected) (document.head ?? document.documentElement).appendChild(style);
}

function setNonceTitle(state: IsolationState): void {
  const marker = `[AniWebScale:${state.nonce}]`;
  if (!document.title.startsWith(marker)) document.title = `${marker} ${state.originalTitle}`;
}

function activateIsolation(
  sessionId: string,
  nonce: string,
  root: HTMLElement,
  video: HTMLVideoElement | null,
  captureStage?: IntrinsicCaptureStage,
): IsolationState {
  if (isolation && isolation.sessionId !== sessionId) restoreIsolation(isolation.sessionId);
  if (!isolation) {
    const markedHosts: HTMLElement[] = [];
    let containingRoot: Node = root.getRootNode();
    while (containingRoot instanceof ShadowRoot) {
      const host = containingRoot.host as HTMLElement;
      markedHosts.push(host);
      containingRoot = host.getRootNode();
    }
    isolation = {
      sessionId,
      nonce,
      originalTitle: document.title,
      root,
      video,
      markedHosts,
      originalRootStyle: root.getRootNode() instanceof ShadowRoot ? root.getAttribute('style') : undefined,
      originalVideoStyle: video?.getRootNode() instanceof ShadowRoot ? video.getAttribute('style') : undefined,
      captureStage,
    };
  } else {
    isolation.root = root;
    isolation.video = video;
    isolation.nonce = nonce;
    isolation.captureStage = captureStage;
  }

  ensureIsolationStyle(captureStage);
  document.documentElement.setAttribute(NATIVE_DOCUMENT_ATTRIBUTE, sessionId);
  root.setAttribute(NATIVE_ROOT_ATTRIBUTE, sessionId);
  video?.setAttribute(NATIVE_VIDEO_ATTRIBUTE, sessionId);
  isolation.markedHosts.forEach(host => host.setAttribute(NATIVE_KEEP_ATTRIBUTE, sessionId));

  // Document styles cannot cross a shadow boundary. Apply the same temporary
  // geometry directly for an open-shadow player and restore the exact inline
  // style when the session ends.
  if (root.getRootNode() instanceof ShadowRoot) {
    const geometry: Record<string, string> = captureStage
      ? {
          inset: 'auto', left: `${captureStage.left}px`, top: `${captureStage.top}px`,
          right: 'auto', bottom: 'auto', width: `${captureStage.width}px`, height: `${captureStage.height}px`,
        }
      : { inset: '0', width: '100vw', height: '100vh' };
    const rootStyle: Record<string, string> = {
      position: 'fixed', zIndex: '2147483646', display: 'block',
      'box-sizing': 'border-box', ...geometry, 'max-width': 'none',
      'max-height': 'none', margin: '0', border: '0', transform: 'none',
      background: '#000', overflow: 'hidden', visibility: 'visible',
    };
    Object.entries(rootStyle).forEach(([property, value]) => root.style.setProperty(property, value, 'important'));
  }
  if (video?.getRootNode() instanceof ShadowRoot) {
    const videoStyle: Record<string, string> = {
      width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none',
      'object-fit': 'contain', background: '#000', visibility: 'visible',
    };
    Object.entries(videoStyle).forEach(([property, value]) => video.style.setProperty(property, value, 'important'));
  }
  setNonceTitle(isolation);
  return isolation;
}

function restoreIsolation(sessionId?: string, originalTitle?: string): void {
  if (isolation && sessionId && isolation.sessionId !== sessionId) return;
  const state = isolation;

  document.documentElement.removeAttribute(NATIVE_DOCUMENT_ATTRIBUTE);
  document.querySelectorAll(`[${NATIVE_ROOT_ATTRIBUTE}]`).forEach(element => {
    element.removeAttribute(NATIVE_ROOT_ATTRIBUTE);
  });
  findVideosDeep().forEach(video => video.removeAttribute(NATIVE_VIDEO_ATTRIBUTE));
  document.getElementById(NATIVE_STYLE_ID)?.remove();

  if (state) {
    state.root.removeAttribute(NATIVE_ROOT_ATTRIBUTE);
    state.markedHosts.forEach(host => host.removeAttribute(NATIVE_KEEP_ATTRIBUTE));
    if (state.originalRootStyle !== undefined) {
      if (state.originalRootStyle === null) state.root.removeAttribute('style');
      else state.root.setAttribute('style', state.originalRootStyle);
    }
    if (state.video && state.originalVideoStyle !== undefined) {
      if (state.originalVideoStyle === null) state.video.removeAttribute('style');
      else state.video.setAttribute('style', state.originalVideoStyle);
    }
    const marker = `[AniWebScale:${state.nonce}]`;
    if (document.title.startsWith(marker)) document.title = state.originalTitle;
  } else if (originalTitle && document.title.startsWith('[AniWebScale:')) {
    document.title = originalTitle;
  }
  isolation = null;
  nativeSeekScrubbing = false;
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value, document.baseURI);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function selectSourceFrame(sourceUrl: string): HTMLIFrameElement | null {
  const target = normalizeUrl(sourceUrl);
  let selected: HTMLIFrameElement | null = null;
  let selectedArea = 0;
  for (const frame of findFramesDeep()) {
    const rect = visibleRect(frame);
    if (!rect) continue;
    if (normalizeUrl(frame.src) === target) return frame;
    const area = rect.width * rect.height;
    if (area > selectedArea) {
      selected = frame;
      selectedArea = area;
    }
  }
  return selected;
}

function showNotice(message: string, isError = false): void {
  const previous = document.getElementById('anime4k-native-notice');
  previous?.remove();
  const notice = document.createElement('div');
  notice.id = 'anime4k-native-notice';
  notice.textContent = message;
  Object.assign(notice.style, {
    position: 'fixed',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    padding: '10px 16px',
    borderRadius: '8px',
    background: isError ? '#9b1c1c' : 'rgba(20, 20, 24, .94)',
    color: '#fff',
    font: '13px/1.4 system-ui, sans-serif',
    boxShadow: '0 4px 18px rgba(0,0,0,.35)',
    visibility: 'visible',
  });
  document.documentElement.appendChild(notice);
  setTimeout(() => notice.remove(), isError ? 8_000 : 3_000);
}

function installLocalE2ETestBridge(): void {
  if (location.origin !== 'http://127.0.0.1:4173' || location.pathname !== '/firefox-self-test.html') return;
  const token = new URLSearchParams(location.search).get('token');
  if (!token) return;
  window.addEventListener('message', event => {
    const data = event.data as Record<string, unknown> | null;
    if (event.source !== window || !data || data.type !== 'anime4k-e2e-command' || data.token !== token
        || typeof data.id !== 'string') return;
    void (async () => {
      if (data.action === 'configure') {
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
      throw new Error('Unsupported local E2E command.');
    })().then(
      () => window.postMessage({ type: 'anime4k-e2e-response', token, id: data.id, ok: true }, location.origin),
      error => window.postMessage({
        type: 'anime4k-e2e-response', token, id: data.id, ok: false,
        message: error instanceof Error ? error.message : String(error),
      }, location.origin),
    );
  });
}

function dispatchPointer(message: Record<string, unknown>): void {
  const video = isolation?.video ?? selectVideo();
  if (!video) return;
  const root = isolation?.root ?? isolation?.video ?? video;
  const rect = root.getBoundingClientRect();
  const normalizedX = Math.min(1, Math.max(0, Number(message.x)));
  const normalizedY = Math.min(1, Math.max(0, Number(message.y)));
  const clientX = rect.left + normalizedX * rect.width;
  const clientY = rect.top + normalizedY * rect.height;
  let target: Element | null = document.elementFromPoint(clientX, clientY);
  while (target?.shadowRoot) {
    const nested = target.shadowRoot.elementFromPoint(clientX, clientY);
    if (!nested || nested === target) break;
    target = nested;
  }
  target ??= video;

  const semanticTarget = target.closest('button, input, [role="button"], [role="slider"]') ?? target;
  const descriptor = [
    semanticTarget.tagName,
    semanticTarget.id,
    semanticTarget.className,
    semanticTarget.getAttribute('type'),
    semanticTarget.getAttribute('role'),
    semanticTarget.getAttribute('aria-label'),
    semanticTarget.getAttribute('title'),
    semanticTarget.getAttribute('data-testid'),
  ].filter(value => typeof value === 'string').join(' ');
  const targetRect = semanticTarget.getBoundingClientRect();
  const targetRatioX = targetRect.width > 0 ? (clientX - targetRect.left) / targetRect.width : normalizedX;
  const interactiveTarget = semanticTarget.matches('button, input, [role="button"], [role="slider"]');
  // Consult the native seek surface first. When the pointer is inside the
  // bottom seek zone (or an active scrub is in progress) the native output
  // window owns that gesture and must consume it before any fullscreen
  // control descriptor below can short-circuit the gesture.
  if (isolation && (nativeSeekScrubbing || !interactiveTarget)) {
    const nativeSurfaceAction = selectNativeSurfacePointerAction({
      event: message.event as 'move' | 'down' | 'up' | 'wheel',
      button: typeof message.button === 'number' ? message.button : 0,
      buttons: typeof message.buttons === 'number' ? message.buttons : 0,
      normalizedX,
      normalizedY,
      duration: video.duration,
      scrubbing: nativeSeekScrubbing,
    });
    nativeSeekScrubbing = nativeSurfaceAction.scrubbing;
    if (nativeSurfaceAction.consume) {
      if (nativeSurfaceAction.seekTime !== undefined
          && Math.abs(video.currentTime - nativeSurfaceAction.seekTime) > 0.01) {
        video.currentTime = nativeSurfaceAction.seekTime;
      }
      return;
    }
  }
  const fallback = selectPointerMediaFallback({
    event: message.event as 'move' | 'down' | 'up' | 'wheel',
    button: typeof message.button === 'number' ? message.button : 0,
    descriptor,
    targetIsVideo: semanticTarget === video,
    targetRatioX,
    deltaY: typeof message.deltaY === 'number' ? message.deltaY : 0,
    duration: video.duration,
    currentTime: video.currentTime,
    volume: video.volume,
  });
  // Only treat a gesture as a fullscreen toggle when it did not already
  // resolve to a concrete media command and is not an active native scrub.
  const nativeFullscreenControl = isolation !== null
    && !fallback
    && !nativeSeekScrubbing
    && /fullscreen|full-screen|enter-full|exit-full/i.test(descriptor);
  if (nativeFullscreenControl) {
    if (message.event === 'up') showNotice('Native output is already fullscreen. Press Esc to exit.');
    return;
  }
  const before = {
    paused: video.paused,
    currentTime: video.currentTime,
    volume: video.volume,
    muted: video.muted,
    fullscreen: document.fullscreenElement,
  };

  const scheduleDirectFallback = () => {
    if (!fallback) return;
    window.setTimeout(() => {
      const expectedSeekTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER,
        Math.max(0, before.currentTime + (fallback.value ?? 0)));
      const expectedVolume = Math.min(1, Math.max(0, before.volume + (fallback.value ?? 0)));
      const needsFallback = fallback.command === 'playPause' ? video.paused === before.paused
        : fallback.command === 'seekBy' ? Math.abs(video.currentTime - expectedSeekTime) > 0.5
          : fallback.command === 'volumeBy' ? Math.abs(video.volume - expectedVolume) > 0.01
            : fallback.command === 'toggleMute' ? video.muted === before.muted
              : document.fullscreenElement === before.fullscreen;
      const command = fallback.command === 'toggleFullscreen' && document.fullscreenElement
        ? 'exitFullscreen'
        : fallback.command;
      if (needsFallback) void runMediaCommand(command as DirectMediaCommand, fallback.value).catch(() => undefined);
    }, 200);
  };

  if (message.event === 'wheel') {
    target.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      deltaX: typeof message.deltaX === 'number' ? message.deltaX : 0,
      deltaY: typeof message.deltaY === 'number' ? message.deltaY : 0,
      shiftKey: message.shiftKey === true,
      ctrlKey: message.ctrlKey === true,
      altKey: message.altKey === true,
    }));
    scheduleDirectFallback();
    return;
  }

  const eventType = message.event === 'down' ? 'pointerdown'
    : message.event === 'up' ? 'pointerup'
      : 'pointermove';
  target.dispatchEvent(new PointerEvent(eventType, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    clientX,
    clientY,
    button: typeof message.button === 'number' ? message.button : 0,
    buttons: typeof message.buttons === 'number' ? message.buttons : 0,
    shiftKey: message.shiftKey === true,
    ctrlKey: message.ctrlKey === true,
    altKey: message.altKey === true,
  }));
  const mouseEventType = message.event === 'down' ? 'mousedown'
    : message.event === 'up' ? 'mouseup'
      : 'mousemove';
  target.dispatchEvent(new MouseEvent(mouseEventType, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    // MouseEvent.button must be >= 0 per the DOM spec; -1 is only valid for
    // PointerEvent. The native protocol sends -1 for "no button changed" on
    // move events, so clamp it to 0 here and default to 0 when absent.
    button: typeof message.button === 'number' ? Math.max(0, message.button) : 0,
    buttons: typeof message.buttons === 'number' ? message.buttons : 0,
    shiftKey: message.shiftKey === true,
    ctrlKey: message.ctrlKey === true,
    altKey: message.altKey === true,
  }));
  // Players typically reveal their control bar on pointerover / mouseover,
  // not on every move. Dispatch the corresponding over-events so synthetic
  // pointer traffic from the native output window still triggers the UI.
  if (message.event === 'move') {
    target.dispatchEvent(new PointerEvent('pointerover', {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX, clientY, button: 0, buttons: 0,
    }));
    target.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true, cancelable: true, composed: true,
      clientX, clientY, button: 0, buttons: 0,
    }));
  }
  if (message.event === 'up' && message.button === 0) {
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0,
      shiftKey: message.shiftKey === true,
      ctrlKey: message.ctrlKey === true,
      altKey: message.altKey === true,
    }));
  }
  scheduleDirectFallback();
}

async function runMediaCommand(command: string, value?: number): Promise<{ fullscreenActive: boolean }> {
  if (command === 'exitFullscreen') {
    if (document.fullscreenElement) await document.exitFullscreen();
    return { fullscreenActive: Boolean(document.fullscreenElement) };
  }
  const video = isolation?.video ?? selectVideo();
  if (!video) return { fullscreenActive: Boolean(document.fullscreenElement) };
  switch (command) {
    case 'playPause':
      if (video.paused) await video.play(); else video.pause();
      break;
    case 'play':
      await video.play();
      break;
    case 'pause':
      video.pause();
      break;
    case 'seekBy':
      video.currentTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER,
        Math.max(0, video.currentTime + (Number.isFinite(value) ? value! : 0)));
      break;
    case 'volumeBy':
      video.volume = Math.min(1, Math.max(0, video.volume + (Number.isFinite(value) ? value! : 0)));
      break;
    case 'toggleMute':
      video.muted = !video.muted;
      break;
    case 'toggleFullscreen':
      if (isolation) break;
      if (document.fullscreenElement) await document.exitFullscreen();
      break;
  }
  return { fullscreenActive: Boolean(document.fullscreenElement) };
}

async function handleRuntimeMessage(request: Record<string, unknown>): Promise<unknown> {
  switch (request.type) {
    case 'SETTINGS_UPDATED':
      return new Promise(resolve => {
        void handleSettingsUpdate(request as { type: string; modifiedModeId?: string }, resolve);
      });

    case 'ANIME4K_FORCE_STOP': {
      const videoId = typeof request.videoId === 'string' ? request.videoId : '';
      const video = findVideosDeep().find(candidate => candidate.dataset.anime4kVideoId === videoId);
      const enhancer = video ? getEnhancer(video) : undefined;
      if (!enhancer) return { ok: true, alreadyStopped: true };
      await enhancer.stopEnhancement(true, false);
      return { ok: true };
    }

    case 'URL_UPDATED':
      // The manager remains active across same-document SPA navigation.
      return { ok: true };

    case 'NATIVE_CONSENT_REQUEST': {
      const origin = typeof request.origin === 'string' ? request.origin : 'this website';
      const allowed = window.confirm(
        `Allow AniWebScale to capture this browser tab with the local Windows renderer for ${origin}?\n\n`
        + 'DRM playback requires browser hardware acceleration to be disabled and the browser restarted. '
        + 'Otherwise protected video may appear black. The renderer only receives composited pixels and does not bypass DRM.',
      );
      return { allowed };
    }

    case 'NATIVE_PREPARE_SESSION': {
      if (typeof request.sessionId !== 'string' || typeof request.nonce !== 'string') {
        return { ok: false, message: 'Invalid native session.' };
      }
      const video = selectVideo(typeof request.videoId === 'string' ? request.videoId : undefined);
      if (!video) return { ok: false, message: 'The selected video is no longer available.' };
      const root = chooseCaptureRoot(video);
      const state = activateIsolation(request.sessionId, request.nonce, root, video);
      const currentScreen = screen as Screen & { availLeft?: number; availTop?: number };
      return {
        ok: true,
        originalTitle: state.originalTitle,
        intrinsicWidth: video.videoWidth || Math.round(video.getBoundingClientRect().width * devicePixelRatio),
        intrinsicHeight: video.videoHeight || Math.round(video.getBoundingClientRect().height * devicePixelRatio),
        screenAvailWidth: screen.availWidth,
        screenAvailHeight: screen.availHeight,
        screenAvailLeft: currentScreen.availLeft ?? 0,
        screenAvailTop: currentScreen.availTop ?? 0,
        devicePixelRatio,
      };
    }

    case 'NATIVE_PREPARE_FULLSCREEN': {
      if (typeof request.sessionId !== 'string' || typeof request.nonce !== 'string') {
        return { ok: false, message: 'Invalid native session.' };
      }
      const video = selectVideo(typeof request.videoId === 'string' ? request.videoId : undefined);
      if (!video || !isVideoInFullscreenContext(video)) {
        return { ok: false, message: 'The selected video is not in player fullscreen.' };
      }
      const stage = intrinsicCaptureStage(video);
      const state = activateIsolation(
        request.sessionId,
        request.nonce,
        chooseCaptureRoot(video),
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
      const video = selectVideo(typeof request.videoId === 'string' ? request.videoId : undefined);
      const stagedSession = typeof request.sessionId === 'string'
        && isolation?.sessionId === request.sessionId
        && isolation.video === video;
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

    case 'NATIVE_MEASURE_POPUP': {
      const currentScreen = screen as Screen & { availLeft?: number; availTop?: number };
      const video = isolation?.video ?? selectVideo();
      const videoRect = video?.getBoundingClientRect();
      return {
        ok: true,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio,
        screenAvailWidth: screen.availWidth,
        screenAvailHeight: screen.availHeight,
        screenAvailLeft: currentScreen.availLeft ?? 0,
        screenAvailTop: currentScreen.availTop ?? 0,
        videoRect: videoRect ? {
          left: videoRect.left,
          top: videoRect.top,
          width: videoRect.width,
          height: videoRect.height,
        } : undefined,
      };
    }

    case 'NATIVE_PREPARE_TOP_FRAME': {
      if (typeof request.sessionId !== 'string' || typeof request.nonce !== 'string') {
        return { ok: false, message: 'Invalid native session.' };
      }
      const frame = selectSourceFrame(typeof request.sourceUrl === 'string' ? request.sourceUrl : '');
      if (!frame) {
        return {
          ok: false,
          isolatedFrame: false,
          message: 'The embedded player frame could not be isolated for native fullscreen capture.',
        };
      }
      activateIsolation(request.sessionId, request.nonce, frame, null);
      return { ok: true, isolatedFrame: true };
    }

    case 'NATIVE_SET_TITLE_NONCE': {
      if (typeof request.sessionId !== 'string' || typeof request.nonce !== 'string') return { ok: false };
      if (request.captureKind === 'direct-fullscreen') {
        return { ok: true, originalTitle: setDirectNonceTitle(request.sessionId, request.nonce) };
      }
      if (isolation?.sessionId === request.sessionId) {
        isolation.nonce = request.nonce;
        setNonceTitle(isolation);
      } else if (document.body) {
        isolation = {
          sessionId: request.sessionId,
          nonce: request.nonce,
          originalTitle: document.title,
          root: document.body,
          video: selectVideo(),
          markedHosts: [],
        };
        setNonceTitle(isolation);
      }
      return { ok: true, originalTitle: isolation?.originalTitle };
    }

    case 'NATIVE_RESTORE_SESSION':
      restoreIsolation(
        typeof request.sessionId === 'string' ? request.sessionId : undefined,
        typeof request.originalTitle === 'string' ? request.originalTitle : undefined,
      );
      return { ok: true };

    case 'NATIVE_RESTORE_TITLE':
      restoreDirectTitle(
        typeof request.sessionId === 'string' ? request.sessionId : undefined,
        typeof request.originalTitle === 'string' ? request.originalTitle : undefined,
      );
      return { ok: true };

    case 'NATIVE_POINTER_EVENT':
      dispatchPointer(request);
      return { ok: true };

    case 'NATIVE_MEDIA_COMMAND_EVENT':
      return {
        ok: true,
        ...await runMediaCommand(
          String(request.command ?? ''),
          typeof request.value === 'number' ? request.value : undefined,
        ),
      };

    case 'NATIVE_SESSION_EVENT': {
      const event = request.event as Record<string, unknown> | undefined;
      if (event?.type === 'error') showNotice(String(event.message ?? 'Native renderer error.'), true);
      else if (event?.type === 'status' && event.state === 'capturing') showNotice('AniWebScale native rendering is active.');
      window.dispatchEvent(new CustomEvent('anime4k-native-session', { detail: event }));
      return { ok: true };
    }

    default:
      return undefined;
  }
}

if (!contentGlobal[CONTENT_INSTANCE_KEY]) {
  contentGlobal[CONTENT_INSTANCE_KEY] = true;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    void handleRuntimeMessage(request as Record<string, unknown>).then(sendResponse, error => {
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
    void handleSettingsUpdate({ type: 'SETTINGS_UPDATED' }, () => undefined).catch(error => {
      console.info('[AniWebScale] Could not apply changed fullscreen settings:', error instanceof Error ? error.message : String(error));
    });
  });

  void initDebugLogging();
  void initializeOnPage();
  if (__ANIME4K_E2E__) installLocalE2ETestBridge();
  window.addEventListener('anime4k-video-reattached', handleNativeVideoReattach);

  window.addEventListener('pagehide', () => {
    window.removeEventListener('anime4k-video-reattached', handleNativeVideoReattach);
    if (isolation) {
      void chrome.runtime.sendMessage({ type: 'NATIVE_STOP', sessionId: isolation.sessionId }).catch(() => undefined);
    }
    if (directTitle) {
      void chrome.runtime.sendMessage({ type: 'NATIVE_STOP', sessionId: directTitle.sessionId }).catch(() => undefined);
    }
  }, { once: true });
}

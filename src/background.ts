import { ensureLatestConfig } from './utils/migration';
import { createAsyncSerializer } from './shared/async-serializer';
import { NativeHostUnavailableError, NativeMessagingClient, createRequestId } from './native/client';
import {
  isNativeConfiguration,
  NativeConfiguration,
  NativeEvent,
  NativeMediaCommandName,
  NativeStatusEvent,
  NATIVE_PROTOCOL_VERSION,
} from './native/protocol';
import {
  calculateVideoCaptureRegion,
} from './shared/popup-geometry';
import {
  NATIVE_SESSION_VERSION,
  matchesExpectedNativeSession,
  requiresLegacyPopupRestore,
  selectRecoveredSessionTab,
} from './shared/session-recovery';
import {
  isHttpOrigin,
  isNativePlaybackStateAuthorized,
  isNativeSessionControlAuthorized,
  parseNativeConsentResponse,
} from './shared/native-session-messages';
import {
  resolveFullscreenExitState,
} from './shared/fullscreen-exit';
import type { FullscreenExitFrameResponse } from './shared/fullscreen-exit';
import {
  isNativeFallbackRequest,
} from './shared/native-fallback-request';
import type { NativeFallbackRequest } from './shared/native-fallback-request';
import {
  migrateLegacyBroadSiteAccess,
  synchronizeRegisteredContentScripts,
} from './site-access';
import type {
  NativeSessionRecord,
  NativeStatusSnapshot,
  PopupMeasurement,
  PreparedVideo,
} from './background-types';
import {
  generateNonce,
  nativeRequestBase,
  sourceOrigin,
  topLevelOrigin,
} from './background-helpers';
import { NativeSessionStore } from './background/session-store';
import { NativeBridge } from './background/native-bridge';

const CONSENT_STORAGE_KEY = 'anime4kNativeConsentByOrigin';
const SESSION_VERSION = NATIVE_SESSION_VERSION;

const store = new NativeSessionStore();
const bridge = new NativeBridge();
let latestStatus: NativeStatusSnapshot = { active: false };
const serialized = createAsyncSerializer();
let fullscreenExitSessionId: string | null = null;
let siteAccessChain: Promise<void> = Promise.resolve();

function updateSiteAccess(migrateLegacy = false): Promise<void> {
  if (__ANIME4K_E2E__) return Promise.resolve();
  const operation = siteAccessChain.then(async () => {
    if (migrateLegacy) await migrateLegacyBroadSiteAccess();
    await synchronizeRegisteredContentScripts();
  });
  siteAccessChain = operation.catch(() => undefined);
  return operation;
}

async function isExtensionEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(['extensionEnabled']);
  return stored.extensionEnabled !== false;
}

async function claimEnhancement(
  videoId: string,
  sender: chrome.runtime.MessageSender,
): Promise<{ ok: boolean; message?: string }> {
  if (!await isExtensionEnabled()) {
    return { ok: false, message: 'AniWebScale is disabled.' };
  }
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;
  if (tabId === undefined || videoId.length === 0 || videoId.length > 128) {
    return { ok: false, message: 'The AniWebScale activation claim was invalid.' };
  }

  const next = { tabId, frameId, videoId };
  const previous = await store.loadActiveEnhancement();
  if (previous && (previous.tabId !== tabId || previous.frameId !== frameId || previous.videoId !== videoId)) {
    if (store.activeSession?.tabId === previous.tabId && store.activeSession.frameId === previous.frameId
        && store.activeSession.videoId === previous.videoId) {
      await stopNativeSession('Another video was selected.', true);
    } else {
      await sendToFrame(previous.tabId, previous.frameId, {
        type: 'ANIME4K_FORCE_STOP',
        videoId: previous.videoId,
      }).catch(() => undefined);
    }
  }
  await store.persistActiveEnhancement(next);
  return { ok: true };
}

async function releaseEnhancement(videoId: string, sender: chrome.runtime.MessageSender): Promise<void> {
  const current = await store.loadActiveEnhancement();
  if (current && current.tabId === sender.tab?.id && current.frameId === (sender.frameId ?? 0)
      && current.videoId === videoId) {
    await store.persistActiveEnhancement(null);
  }
}

async function sendToFrame<T = unknown>(
  tabId: number,
  frameId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<T>;
}

async function requestOriginConsent(tabId: number, origin: string): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
  const consentByOrigin = (stored[CONSENT_STORAGE_KEY] ?? {}) as Record<string, boolean>;
  if (typeof consentByOrigin[origin] === 'boolean') {
    return consentByOrigin[origin];
  }

  let response: { allowed?: unknown } | undefined;
  try {
    response = await sendToFrame<{ allowed?: unknown }>(tabId, 0, {
      type: 'NATIVE_CONSENT_REQUEST',
      origin,
    });
  } catch (error) {
    console.warn('[NativeBridge] Could not show native fallback consent.', error);
    return false;
  }

  const allowed = parseNativeConsentResponse(response);
  if (allowed === null) return false;
  consentByOrigin[origin] = allowed;
  await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consentByOrigin });
  return allowed;
}

async function checkOnboarding(): Promise<void> {
  const local = await chrome.storage.local.get('hasCompletedOnboarding');
  if (!local.hasCompletedOnboarding) {
    // Do not steal focus from playback when an update installs in the
    // background. The user can still open the guide explicitly from the UI.
    await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html'), active: false });
  }
}

async function routeNativeEvent(event: NativeEvent, sourceClient: NativeMessagingClient): Promise<void> {
  // A disconnected client can still have a previously queued callback. Never
  // reinterpret an unscoped transport error from that client as belonging to
  // the replacement native session.
  if (sourceClient !== bridge.currentClient) return;
  const session = store.activeSession;

  if (event.type === 'pointer' || event.type === 'mediaCommand') {
    if (session && event.sessionId === session.sessionId) {
      const message = {
        ...event,
        type: event.type === 'pointer' ? 'NATIVE_POINTER_EVENT' : 'NATIVE_MEDIA_COMMAND_EVENT',
      };
      if (event.type === 'mediaCommand' && event.command === 'exitFullscreen') {
        await exitNativeFullscreen(session, message);
      } else {
        // A player may run its <video> in an iframe while the native output
        // window is owned by the top-level document. send the pointer to the
        // source frame where isolation is staged, and also to the top frame:
        // whichever content-script instance holds the active isolation will act
        // on it. A cross-frame mismatch silently dropped seek/scrub before.
        const targets = session.frameId === 0
          ? [0]
          : [session.frameId, 0];
        await Promise.all(targets.map(frameId => sendToFrame(session.tabId, frameId, message).catch(() => undefined)));
      }
    }
    return;
  }

  if (event.type === 'metrics' && session && event.sessionId === session.sessionId) {
    latestStatus = {
      ...latestStatus,
      active: true,
      metrics: {
        fps: event.fps,
        frameTimeMs: event.frameTimeMs,
        droppedFrames: event.droppedFrames,
      },
    };
    await sendSessionEvent(session, event);
    return;
  }

  if (event.type === 'status' && session && event.sessionId === session.sessionId) {
    latestStatus = {
      ...latestStatus,
      active: event.state !== 'stopped' && event.state !== 'failed',
      state: event.state,
      message: event.message,
    };
    if (!event.requestId?.startsWith('playback-')) await sendSessionEvent(session, event);
    if (event.state === 'failed' || event.state === 'stopped') {
      void serialized(() => stopNativeSession(event.message ?? event.state, false, true, session.sessionId));
    }
    return;
  }

  if (event.type === 'error') {
    if (session && (!event.sessionId || event.sessionId === session.sessionId)) {
      latestStatus = { ...latestStatus, state: 'failed', message: event.message };
      await sendSessionEvent(session, event);
      // A renderer error invalidates the capture surface even when the host
      // classifies it as theoretically recoverable. Use the same idempotent
      // restore path for device loss, capture loss, and fatal protocol errors.
      void serialized(() => stopNativeSession(event.message, false, true, session.sessionId));
    }
    return;
  }

  if (event.type === 'stopped' && session && event.sessionId === session.sessionId) {
    await sendSessionEvent(session, event);
    void serialized(() => stopNativeSession(event.reason, false, true, session.sessionId));
  }
}

async function exitNativeFullscreen(session: NativeSessionRecord, message: unknown): Promise<void> {
  if (fullscreenExitSessionId === session.sessionId) return;
  fullscreenExitSessionId = session.sessionId;
  try {
    // Crunchyroll can replace player elements during the exit animation. Ask
    // the top document (authoritative for the fullscreen stack) and the source
    // frame, then confirm the resulting state. A short retry absorbs those DOM
    // swaps without requiring the user to press Esc several times.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (store.activeSession?.sessionId !== session.sessionId) return;
      const topFrame = await sendToFrame<FullscreenExitFrameResponse>(
        session.tabId,
        0,
        message,
      ).catch(() => null);
      const sourceFrame = session.frameId === 0
        ? topFrame
        : await sendToFrame<FullscreenExitFrameResponse>(
          session.tabId,
          session.frameId,
          message,
        ).catch(() => null);
      const state = resolveFullscreenExitState(topFrame, sourceFrame);
      if (state === 'exited') {
        await serialized(() => stopNativeSession('Fullscreen exited.', true, true, session.sessionId));
        return;
      }
      if (attempt < 4) await new Promise<void>(resolve => setTimeout(resolve, 150));
    }
    // The renderer keeps displaying the enhanced frame while its own failsafe
    // timer waits. This avoids dropping back to an unenhanced source window if
    // a transient browser transition prevented confirmation.
  } finally {
    if (fullscreenExitSessionId === session.sessionId) fullscreenExitSessionId = null;
  }
}

async function sendSessionEvent(session: NativeSessionRecord, event: NativeEvent): Promise<void> {
  await sendToFrame(session.tabId, session.frameId, {
    type: 'NATIVE_SESSION_EVENT',
    // Some host-level errors do not carry a session ID. Scope every forwarded
    // event here so a delayed delivery cannot tear down a replacement session.
    event: { ...event, sessionId: session.sessionId },
  }).catch(() => undefined);
}

async function prepareDirectFullscreen(session: NativeSessionRecord): Promise<PreparedVideo> {
  const prepared = await sendToFrame<PreparedVideo>(session.tabId, session.frameId, {
    type: 'NATIVE_PREPARE_FULLSCREEN',
    sessionId: session.sessionId,
    videoId: session.videoId,
    nonce: session.nonce,
  });
  if (!prepared?.ok) throw new Error(prepared?.message ?? 'The selected video is not in player fullscreen.');
  if (session.frameId === 0) {
    session.originalTitle = prepared.originalTitle;
    return prepared;
  }
  const title = await sendToFrame<{ ok?: boolean; originalTitle?: string }>(session.tabId, 0, {
    type: 'NATIVE_SET_TITLE_NONCE',
    captureKind: 'direct-fullscreen',
    sessionId: session.sessionId,
    nonce: session.nonce,
  });
  if (!title?.ok) throw new Error('The fullscreen browser window could not be marked for capture.');
  session.originalTitle = title.originalTitle;
  return prepared;
}

async function startNativeFallback(
  request: NativeFallbackRequest,
  sender: chrome.runtime.MessageSender,
): Promise<{
  ok: boolean;
  status: 'started' | 'unavailable' | 'denied';
  message?: string;
  sessionId?: string;
}> {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;
  const senderOrigin = sourceOrigin(sender);
  if (tabId === undefined || senderOrigin === null) {
    return { ok: false, status: 'denied', message: 'The native request did not come from a trusted HTTP(S) page origin.' };
  }

  // Consent is keyed to the user-visible top-level website, not a CDN/player
  // iframe origin. MessageSender.origin is authoritative here: location.origin
  // serializes as "null" in inherited about:blank/srcdoc frames even though the
  // extension sender retains the parent's effective HTTP(S) origin.
  const consentOrigin = topLevelOrigin(sender) ?? senderOrigin;
  if (!await requestOriginConsent(tabId, consentOrigin)) {
    return { ok: false, status: 'denied', message: 'Native capture was not allowed for this website.' };
  }

  if (store.activeSession
      && store.activeSession.tabId === tabId
      && store.activeSession.frameId === frameId
      && store.activeSession.videoId === request.videoId) {
    await updateNativeConfiguration(request.configuration);
    return { ok: true, status: 'started', sessionId: store.activeSession.sessionId };
  }

  await stopNativeSession('A different video was selected.', true);

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { ok: false, status: 'unavailable', message: 'The source tab is no longer available.' };
  }
  if (tab.windowId === undefined) {
    return { ok: false, status: 'unavailable', message: 'The source tab has no browser window.' };
  }

  const session: NativeSessionRecord = {
    version: SESSION_VERSION,
    captureKind: 'direct-fullscreen',
    phase: 'preparing',
    sessionId: crypto.randomUUID(),
    nonce: generateNonce(),
    tabId,
    frameId,
    videoId: request.videoId,
    origin: consentOrigin,
    sourceUrl: sender.url ?? tab.url ?? senderOrigin,
    topLevelUrl: tab.url ?? senderOrigin,
    sourceWindowId: tab.windowId,
    configuration: request.configuration,
    output: request.output,
    createdAt: Date.now(),
  };

  await store.persistSession(session);
  try {
    const prepared = await prepareDirectFullscreen(session);
    await store.persistSession(session);

    // Let the site's fullscreen transition and controls settle before
    // measuring the exact visible decoded-video rectangle.
    await new Promise<void>(resolve => setTimeout(resolve, 250));
    const captureMeasurement = await sendToFrame<PopupMeasurement>(session.tabId, session.frameId, {
      type: 'NATIVE_MEASURE_FULLSCREEN',
      sessionId: session.sessionId,
      videoId: session.videoId,
    }).catch(() => null);
    if (!captureMeasurement?.ok || !captureMeasurement.videoRect) {
      throw new Error('Player fullscreen ended before native capture could start.');
    }
    const captureRegion = captureMeasurement?.videoRect
      ? calculateVideoCaptureRegion({
        ...captureMeasurement.videoRect,
        viewportWidth: captureMeasurement.innerWidth ?? 0,
        viewportHeight: captureMeasurement.innerHeight ?? 0,
        devicePixelRatio: captureMeasurement.devicePixelRatio ?? request.videoRect.devicePixelRatio,
      })
      : undefined;

    session.intrinsicWidth = prepared.intrinsicWidth;
    session.intrinsicHeight = prepared.intrinsicHeight;
    session.captureWidth = captureRegion?.width ?? prepared.intrinsicWidth;
    session.captureHeight = captureRegion?.height ?? prepared.intrinsicHeight;
    session.targetWidth = prepared.targetWidth;
    session.targetHeight = prepared.targetHeight;
    await store.persistSession(session);

    const client = await bridge.connectAndHandshake(routeNativeEvent);
    bridge.assertSupportsConfiguration(session.configuration);
    const started = await client.request<NativeStatusEvent>({
      ...nativeRequestBase(),
      type: 'start',
      sessionId: session.sessionId,
      windowNonce: session.nonce,
      mode: session.configuration.mode,
      quality: session.configuration.quality,
      frameGenerationEnabled: session.configuration.frameGenerationEnabled,
      ...(prepared.targetWidth && prepared.targetHeight ? {
        targetWidth: prepared.targetWidth,
        targetHeight: prepared.targetHeight,
      } : {}),
      ...(captureRegion ? {
        captureX: captureRegion.x,
        captureY: captureRegion.y,
        captureWidth: captureRegion.width,
        captureHeight: captureRegion.height,
      } : {}),
    }, 15_000);
    if (started.type !== 'status' || started.sessionId !== session.sessionId
        || (started.state !== 'starting' && started.state !== 'capturing')) {
      throw new Error(started.type === 'status' && started.message
        ? started.message
        : 'The native renderer did not start capture.');
    }

    session.phase = 'active';
    const scalingSummary = session.captureWidth && session.captureHeight
      && session.targetWidth && session.targetHeight
      ? `${session.captureWidth}×${session.captureHeight} → ${session.targetWidth}×${session.targetHeight}`
      : undefined;
    latestStatus = {
      active: true,
      sessionId: session.sessionId,
      state: started.state,
      message: [started.message, scalingSummary].filter(Boolean).join(' · '),
      configuration: session.configuration,
    };
    await store.persistSession(session);
    await sendSessionEvent(session, started);
    return { ok: true, status: 'started', sessionId: session.sessionId };
  } catch (error) {
    const unavailable = error instanceof NativeHostUnavailableError;
    const message = error instanceof Error ? error.message : String(error);
    console.error('[NativeBridge] Failed to start the native renderer.', error);
    await stopNativeSession(message, true);
    return {
      ok: false,
      status: 'unavailable',
      message: unavailable
        ? 'AniWebScale Native Host is not installed. Install the Windows native package, then try again.'
        : message,
    };
  }
}

async function updateNativeConfiguration(configuration: NativeConfiguration): Promise<void> {
  const session = store.activeSession;
  if (!session) throw new Error('No native session is active.');
  const client = await bridge.connectAndHandshake(routeNativeEvent);
  bridge.assertSupportsConfiguration(configuration);
  const status = await client.request<NativeStatusEvent>({
    ...nativeRequestBase(),
    type: 'updateConfiguration',
    sessionId: session.sessionId,
    mode: configuration.mode,
    quality: configuration.quality,
    frameGenerationEnabled: configuration.frameGenerationEnabled,
  });
  session.configuration = configuration;
  latestStatus = { ...latestStatus, configuration };
  await store.persistSession(session);
  await sendSessionEvent(session, status);
}

async function restoreContent(session: NativeSessionRecord): Promise<void> {
  if (session.captureKind === 'direct-fullscreen') {
    const restoreSession = {
      type: 'NATIVE_RESTORE_SESSION',
      sessionId: session.sessionId,
      nonce: session.nonce,
      originalTitle: session.originalTitle,
    };
    await sendToFrame(session.tabId, session.frameId, restoreSession).catch(() => undefined);
    await sendToFrame(session.tabId, 0, {
      type: 'NATIVE_RESTORE_TITLE',
      sessionId: session.sessionId,
      nonce: session.nonce,
      originalTitle: session.originalTitle,
    }).catch(() => undefined);
    return;
  }
  const message = {
    type: 'NATIVE_RESTORE_SESSION',
    sessionId: session.sessionId,
    nonce: session.nonce,
    originalTitle: session.originalTitle,
  };
  await sendToFrame(session.tabId, session.frameId, message).catch(() => undefined);
  if (session.frameId !== 0) {
    await sendToFrame(session.tabId, 0, message).catch(() => undefined);
  }
}

async function restoreTab(session: NativeSessionRecord): Promise<void> {
  if (session.captureKind !== 'legacy-popup' || session.originalWindowId === undefined
      || session.originalIndex === undefined) return;
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(session.tabId);
  } catch {
    return;
  }

  try {
    await chrome.windows.get(session.originalWindowId);
    const destinationTabs = await chrome.tabs.query({ windowId: session.originalWindowId });
    await chrome.tabs.move(session.tabId, {
      windowId: session.originalWindowId,
      index: Math.min(session.originalIndex, destinationTabs.length),
    });
    await chrome.tabs.update(session.tabId, { active: true });
    const state = session.originalWindowState;
    if (!state || state === 'normal') {
      await chrome.windows.update(session.originalWindowId, {
        ...session.originalWindowBounds,
        state: 'normal',
        focused: true,
      });
    } else {
      await chrome.windows.update(session.originalWindowId, { state, focused: state !== 'minimized' });
    }
  } catch {
    // If the original window was closed during capture, preserve the tab in a
    // new normal browser window rather than closing or reloading it.
    if (tab.windowId !== session.originalWindowId) {
      const state = session.originalWindowState;
      const restored = await chrome.windows.create({
        tabId: session.tabId,
        type: 'normal',
        focused: state !== 'minimized',
        ...(!state || state === 'normal' ? session.originalWindowBounds : {}),
      });
      if (restored.id !== undefined && state && state !== 'normal') {
        await chrome.windows.update(restored.id, { state });
      }
    }
  }
}

async function stopNativeSession(
  reason: string,
  notifyHost: boolean,
  restoreBrowser = true,
  expectedSessionId?: string,
): Promise<void> {
  const session = store.activeSession ?? await store.loadPersistedSession();
  if (!matchesExpectedNativeSession(session, expectedSessionId)) return;
  if (!session) {
    latestStatus = { active: false };
    bridge.disconnect();
    return;
  }
  session.phase = 'stopping';
  await store.persistSession(session);
  if (notifyHost && bridge.currentClient?.connected) {
    try {
      await bridge.currentClient.request({
        ...nativeRequestBase(),
        type: 'stop',
        sessionId: session.sessionId,
      }, 3_000);
    } catch (error) {
      console.warn('[NativeBridge] Native stop acknowledgement was not received.', error);
    }
  }

  if (restoreBrowser) {
    await restoreContent(session);
    if (requiresLegacyPopupRestore(session)) await restoreTab(session);
  }
  bridge.disconnect();
  await store.persistSession(null);
  const currentEnhancement = await store.loadActiveEnhancement();
  if (currentEnhancement?.tabId === session.tabId
      && currentEnhancement.frameId === session.frameId
      && currentEnhancement.videoId === session.videoId) {
    await store.persistActiveEnhancement(null);
  }
  latestStatus = { active: false, state: 'stopped', message: reason };
}

async function findRecoveredSessionTab(session: NativeSessionRecord): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({});
  const candidates = await Promise.all(tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; windowId: number } => (
      tab.id !== undefined && tab.windowId !== undefined
    ))
    .map(async tab => ({
      tab,
      recovery: {
        id: tab.id,
        windowId: tab.windowId,
        title: tab.title,
        url: tab.url,
        windowType: (await chrome.windows.get(tab.windowId).catch(() => null))?.type,
      },
    })));
  const recovered = selectRecoveredSessionTab(
    candidates.map(candidate => candidate.recovery),
    session.nonce,
  );
  return recovered ? candidates.find(candidate => candidate.tab.id === recovered.id)?.tab ?? null : null;
}

async function recoverPersistedSession(): Promise<void> {
  const persisted = await store.loadPersistedSession();
  if (!persisted) return;
  await store.persistSession(persisted);
  if (!await isExtensionEnabled()) {
    await stopNativeSession('AniWebScale was disabled.', true);
    return;
  }

  const recoveredTab = await findRecoveredSessionTab(persisted);
  if (!recoveredTab || recoveredTab.id === undefined) {
    try {
      await bridge.connectAndHandshake(routeNativeEvent);
    } catch {
      // Cleanup below is still safe when the host is already gone.
    }
    // A recycled tab/window ID or matching URL is not proof that this is our
    // capture surface. Stop the host session, but never move or restyle an
    // unverified browser tab.
    await stopNativeSession('Could not recover the saved native capture window.', true, false);
    return;
  }
  if (persisted.captureKind === 'legacy-popup' && recoveredTab.id !== persisted.tabId) {
    persisted.tabId = recoveredTab.id;
    persisted.frameId = 0;
    persisted.popupWindowId = recoveredTab.windowId;
    const windows = await chrome.windows.getAll();
    const normalWindow = windows.find(window => window.type === 'normal' && window.id !== recoveredTab.windowId);
    if (normalWindow?.id !== undefined) persisted.originalWindowId = normalWindow.id;
    await store.persistSession(persisted);
  } else if (persisted.captureKind === 'direct-fullscreen') {
    persisted.tabId = recoveredTab.id;
    persisted.sourceWindowId = recoveredTab.windowId;
    await store.persistSession(persisted);
  }

  if (persisted.phase !== 'active') {
    try {
      await bridge.connectAndHandshake(routeNativeEvent);
    } catch {
      // Browser restoration below is still safe for the nonce-verified tab.
    }
    await stopNativeSession('Recovered an interrupted native startup.', true);
    return;
  }

  try {
    const client = await bridge.connectAndHandshake(routeNativeEvent);
    const status = await client.request<NativeStatusEvent>({
      ...nativeRequestBase(),
      type: 'status',
      sessionId: persisted.sessionId,
    }, 5_000);
    if (status.type === 'status' && (status.state === 'starting' || status.state === 'capturing')) {
      latestStatus = {
        active: true,
        sessionId: persisted.sessionId,
        state: status.state,
        message: status.message,
        configuration: persisted.configuration,
      };
      return;
    }
  } catch (error) {
    console.warn('[NativeBridge] Could not reconnect to the saved native session.', error);
  }
  await stopNativeSession('The saved native session is no longer running.', true);
}

async function forwardMediaCommand(command: NativeMediaCommandName, value?: number): Promise<void> {
  const session = store.activeSession;
  if (!session) throw new Error('No native session is active.');
  const client = await bridge.connectAndHandshake(routeNativeEvent);
  client.post({
    ...nativeRequestBase(),
    type: 'mediaCommand',
    sessionId: session.sessionId,
    command,
    ...(Number.isFinite(value) ? { value } : {}),
  });
}

async function forwardPointer(request: Record<string, unknown>): Promise<void> {
  const session = store.activeSession;
  if (!session) throw new Error('No native session is active.');
  const x = Number(request.x);
  const y = Number(request.y);
  const event = request.event;
  if (!['move', 'down', 'up', 'wheel'].includes(String(event))
      || !Number.isFinite(x) || x < 0 || x > 1
      || !Number.isFinite(y) || y < 0 || y > 1) {
    throw new Error('Invalid native pointer event.');
  }
  const client = await bridge.connectAndHandshake(routeNativeEvent);
  client.post({
    ...nativeRequestBase(),
    type: 'pointer',
    sessionId: session.sessionId,
    event: event as 'move' | 'down' | 'up' | 'wheel',
    x,
    y,
    ...(typeof request.button === 'number' ? { button: request.button } : {}),
    ...(typeof request.buttons === 'number' ? { buttons: request.buttons } : {}),
    ...(typeof request.deltaX === 'number' ? { deltaX: request.deltaX } : {}),
    ...(typeof request.deltaY === 'number' ? { deltaY: request.deltaY } : {}),
    ...(typeof request.shiftKey === 'boolean' ? { shiftKey: request.shiftKey } : {}),
    ...(typeof request.ctrlKey === 'boolean' ? { ctrlKey: request.ctrlKey } : {}),
    ...(typeof request.altKey === 'boolean' ? { altKey: request.altKey } : {}),
  });
}

async function handleMessage(request: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!request || typeof request !== 'object') return undefined;
  const message = request as Record<string, unknown>;

  switch (message.type) {
    case 'ENHANCEMENT_CLAIM':
      if (typeof message.videoId !== 'string') return { ok: false, message: 'Missing video ID.' };
      return serialized(() => claimEnhancement(message.videoId as string, sender));

    case 'ENHANCEMENT_RELEASE':
      if (typeof message.videoId === 'string') {
        await serialized(() => releaseEnhancement(message.videoId as string, sender));
      }
      return { ok: true };

    case 'NATIVE_FALLBACK_REQUEST':
      if (!isNativeFallbackRequest(request)) {
        return { ok: false, status: 'denied', message: 'The native fallback request was invalid.' };
      }
      if (!await isExtensionEnabled()) {
        return { ok: false, status: 'denied', message: 'AniWebScale is disabled.' };
      }
      return serialized(() => startNativeFallback(request, sender));

    case 'NATIVE_UPDATE_CONFIGURATION': {
      const configuration = message.configuration ?? {
        mode: message.mode,
        quality: message.quality,
        frameGenerationEnabled: message.frameGenerationEnabled,
      };
      if (!isNativeConfiguration(configuration)) {
        return { ok: false, message: 'Invalid native enhancement configuration.' };
      }
      try {
        await serialized(async () => {
          const session = store.activeSession;
          if (!session || !isNativeSessionControlAuthorized(session, message, {
            tabId: sender.tab?.id,
            frameId: sender.frameId,
          })) {
            throw new Error('The native configuration update did not come from the active video.');
          }
          await updateNativeConfiguration(configuration);
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    }

    case 'NATIVE_STOP':
      return serialized(async () => {
        const session = store.activeSession;
        if (!session) return { ok: true };
        if (!isNativeSessionControlAuthorized(session, message, {
          tabId: sender.tab?.id,
          frameId: sender.frameId,
        })) {
          return { ok: false, message: 'The native stop request did not belong to the active session.' };
        }
        await stopNativeSession('Stopped by the user.', true);
        return { ok: true };
      });

    case 'NATIVE_STATUS':
      return { ok: true, ...latestStatus };

    case 'NATIVE_PLAYBACK_STATE': {
      const session = store.activeSession;
      const playbackActive = message.playbackActive;
      const mediaTime = message.mediaTime;
      if (!session || !isNativePlaybackStateAuthorized(session, message, {
        tabId: sender.tab?.id,
        frameId: sender.frameId,
      }) || typeof playbackActive !== 'boolean'
          || typeof mediaTime !== 'number' || !Number.isFinite(mediaTime) || mediaTime < 0) {
        return { ok: false, message: 'Invalid native playback state.' };
      }
      const client = await bridge.connectAndHandshake(routeNativeEvent);
      client.post({
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        requestId: `playback-${createRequestId()}`,
        type: 'status',
        sessionId: session.sessionId,
        playbackActive,
        mediaTime,
      });
      return { ok: true };
    }

    case 'NATIVE_MEDIA_COMMAND':
      if (typeof message.command !== 'string'
          || !['playPause', 'play', 'pause', 'seekBy', 'volumeBy', 'toggleMute', 'toggleFullscreen', 'exitFullscreen'].includes(message.command)) {
        return { ok: false, message: 'Invalid media command.' };
      }
      await forwardMediaCommand(message.command as NativeMediaCommandName,
        typeof message.value === 'number' ? message.value : undefined);
      return { ok: true };

    case 'NATIVE_POINTER':
      await forwardPointer(message);
      return { ok: true };

    case 'NATIVE_RESET_CONSENT': {
      if (typeof message.origin === 'string' && isHttpOrigin(message.origin)) {
        const stored = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
        const consents = (stored[CONSENT_STORAGE_KEY] ?? {}) as Record<string, boolean>;
        delete consents[message.origin];
        await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consents });
      } else {
        await chrome.storage.local.remove(CONSENT_STORAGE_KEY);
      }
      return { ok: true };
    }

    case 'SETTINGS_UPDATED': {
      const extensionEnabled = await isExtensionEnabled();
      const current = await store.loadActiveEnhancement();
      let contentUpdatedNativeSession = false;
      if (current) {
        const response = await sendToFrame<{ status?: string; message?: string }>(
          current.tabId,
          current.frameId,
          { type: 'SETTINGS_UPDATED' },
        ).catch(() => null);
        if (response?.status === 'ERROR') {
          return { ok: false, message: response.message || 'The active renderer could not apply the new settings.' };
        }
        contentUpdatedNativeSession = response?.status === 'SUCCESS'
          && store.activeSession?.tabId === current.tabId
          && store.activeSession.frameId === current.frameId
          && store.activeSession.videoId === current.videoId;
      }
      if (!extensionEnabled) {
        await serialized(() => stopNativeSession('AniWebScale was disabled.', true));
        await store.persistActiveEnhancement(null);
        return { ok: true };
      }
      // A live content script owns normal backend updates. Only update the
      // native host here when recovering an orphaned session; otherwise the
      // same expensive native pipeline would be rebuilt twice.
      if (store.activeSession && !contentUpdatedNativeSession) {
        const settings = await chrome.storage.local.get(['mode', 'quality', 'frameGenerationEnabled']);
        const configuration = {
          mode: settings.mode,
          quality: settings.quality,
          frameGenerationEnabled: settings.frameGenerationEnabled,
        };
        if (isNativeConfiguration(configuration)) {
          await serialized(() => updateNativeConfiguration(configuration));
        }
      }
      return { ok: true };
    }

    case 'SITE_ACCESS_SYNC':
      await updateSiteAccess();
      return { ok: true };

    case 'OPEN_OPTIONS_PAGE':
      await chrome.runtime.openOptionsPage();
      return undefined;

    case 'OPEN_ONBOARDING':
      await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return undefined;

    default:
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  void handleMessage(request, sender).then(sendResponse, error => {
    console.error('[Background] Message handler failed.', error);
    sendResponse({ ok: false, message: error instanceof Error ? error.message : String(error) });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    void serialized(async () => {
      const current = await store.loadActiveEnhancement();
      if (current?.tabId === tabId) await store.persistActiveEnhancement(null);
    });
  }
  if (store.activeSession?.tabId === tabId && (changeInfo.status === 'loading' || changeInfo.url)) {
    const sessionId = store.activeSession.sessionId;
    void serialized(() => stopNativeSession('The source tab navigated.', true, true, sessionId));
    return;
  }

  if (changeInfo.status === 'complete' && tab.url) {
    void chrome.tabs.sendMessage(tabId, { type: 'URL_UPDATED', url: tab.url }).catch(error => {
      if (!String(error?.message ?? error).includes('Receiving end does not exist')) {
        console.warn('[Background] Could not notify a tab about navigation.', error);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  void serialized(async () => {
    const current = await store.loadActiveEnhancement();
    if (current?.tabId === tabId) await store.persistActiveEnhancement(null);
  });
  const session = store.activeSession;
  if (session?.tabId === tabId) {
    const sessionId = session.sessionId;
    void serialized(() => stopNativeSession(
      'The source tab was closed.',
      true,
      false,
      sessionId,
    ));
  }
});

chrome.windows.onRemoved.addListener(windowId => {
  const session = store.activeSession;
  const captureWindowId = session?.captureKind === 'direct-fullscreen'
    ? session.sourceWindowId
    : session?.popupWindowId;
  if (session && captureWindowId === windowId && session.phase !== 'stopping') {
    const sessionId = session.sessionId;
    void serialized(() => stopNativeSession('The capture browser window was closed.', true, true, sessionId));
  }
});

chrome.runtime.onStartup.addListener(() => {
  void serialized(recoverPersistedSession);
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Startup synchronization failed.', error);
  });
});

chrome.runtime.onInstalled.addListener(details => {
  void serialized(async () => {
    await ensureLatestConfig();
    await recoverPersistedSession();
    if (details.reason === 'install' || details.reason === 'update') await checkOnboarding();
  });
  void updateSiteAccess(true).catch(error => {
    console.warn('[Site access] Installation synchronization failed.', error);
  });
});

chrome.permissions.onAdded.addListener(() => {
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Could not register scripts for newly granted access.', error);
  });
});

chrome.permissions.onRemoved.addListener(() => {
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Could not remove scripts for revoked access.', error);
  });
});

// MV3 service workers can restart without onStartup. Reconcile the durable
// session every time the background module itself is evaluated.
void serialized(recoverPersistedSession);
void updateSiteAccess(true).catch(error => {
  console.warn('[Site access] Initial synchronization failed.', error);
});

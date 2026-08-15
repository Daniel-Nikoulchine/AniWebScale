/**
 * Owns the native capture session state machine: prepare, start, stop,
 * recovery, event routing, pointer/media forwarding and status mirroring.
 *
 * Extracted from background.ts so the orchestration invariants live in one
 * place instead of being call-site discipline:
 *
 * - Serialization: every state transition runs through the injected
 *   `serialized` runner, so a stop can never overlap a start.
 * - Client scoping: events from a disconnected/replaced client are dropped
 *   (`sourceClient !== bridge.currentClient`) so a stale transport error
 *   cannot tear down a replacement session.
 * - Session scoping: host events are only honored when their sessionId
 *   matches the active session.
 *
 * The module owns the NativeSessionStore and NativeBridge, and receives the
 * frame messaging function (sendToFrame) as a dependency so callers stay in
 * control of chrome.tabs.* access.
 */
import {
  createRequestId,
  NativeHostUnavailableError,
  NativeMessagingClient,
} from '../native/client';
import {
  type NativeConfiguration,
  type NativeEvent,
  type NativeMediaCommandName,
  type NativePointerEventType,
  type NativeStatusEvent,
  NATIVE_PROTOCOL_VERSION,
  isNativePointerEventPayload,
} from '../native/protocol';
import { calculateVideoCaptureRegion } from '../shared/popup-geometry';
import {
  NATIVE_SESSION_VERSION,
  matchesExpectedNativeSession,
  requiresLegacyPopupRestore,
  selectRecoveredSessionTab,
} from '../shared/session-recovery';
import {
  resolveFullscreenExitState,
  type FullscreenExitFrameResponse,
} from '../shared/fullscreen-exit';
import type { NativeFallbackRequest } from '../shared/native-fallback-request';
import {
  generateNonce,
  nativeRequestBase,
  sourceOrigin,
  topLevelOrigin,
} from '../background-helpers';
import { NativeSessionStore } from './session-store';
import { NativeBridge } from './native-bridge';
import type {
  NativeSessionRecord,
  NativeStatusSnapshot,
  PopupMeasurement,
  PreparedVideo,
} from '../background-types';

/** How the session machine reports the outcome of a fallback start. */
export interface NativeFallbackStartResult {
  ok: boolean;
  status: 'started' | 'unavailable' | 'denied';
  message?: string;
  sessionId?: string;
}

/** External services the session machine needs from the caller. */
export interface SessionDependencies {
  /** Message a content-script frame. */
  sendToFrame<T = unknown>(tabId: number, frameId: number, message: unknown): Promise<T>;
  /** Ask the user for consent to capture the given origin. */
  requestOriginConsent(tabId: number, origin: string): Promise<boolean>;
  /** Whether the extension as a whole is enabled. */
  isExtensionEnabled(): Promise<boolean>;
  /** Run a state transition without overlapping another. */
  serialized<T>(operation: () => Promise<T>): Promise<T>;
}

export class NativeSession {
  readonly store: NativeSessionStore;
  readonly bridge: NativeBridge;
  private latestStatus: NativeStatusSnapshot = { active: false };
  private fullscreenExitSessionId: string | null = null;
  private deps: SessionDependencies;

  constructor(deps: SessionDependencies) {
    this.store = new NativeSessionStore();
    this.bridge = new NativeBridge();
    this.deps = deps;
  }

  /** The last known native renderer status. */
  get status(): NativeStatusSnapshot {
    return this.latestStatus;
  }

  /** The currently active session, if any. */
  get activeSession(): NativeSessionRecord | null {
    return this.store.activeSession;
  }

  /** Run a state transition without overlapping another. */
  private runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    return this.deps.serialized(operation);
  }

  /** Claim a video enhancement (serialized). */
  async claimEnhancement(
    videoId: string,
    sender: chrome.runtime.MessageSender,
  ): Promise<{ ok: boolean; message?: string }> {
    return this.runSerialized(() => this.doClaimEnhancement(videoId, sender));
  }

  private async doClaimEnhancement(
    videoId: string,
    sender: chrome.runtime.MessageSender,
  ): Promise<{ ok: boolean; message?: string }> {
    if (!await this.deps.isExtensionEnabled()) {
      return { ok: false, message: 'AniWebScale is disabled.' };
    }
    const tabId = sender.tab?.id;
    const frameId = sender.frameId ?? 0;
    if (tabId === undefined || videoId.length === 0 || videoId.length > 128) {
      return { ok: false, message: 'The AniWebScale activation claim was invalid.' };
    }

    const next = { tabId, frameId, videoId };
    const previous = await this.store.loadActiveEnhancement();
    if (previous && (previous.tabId !== tabId || previous.frameId !== frameId || previous.videoId !== videoId)) {
      if (this.store.activeSession?.tabId === previous.tabId && this.store.activeSession.frameId === previous.frameId
          && this.store.activeSession.videoId === previous.videoId) {
        await this.stopNativeSession('Another video was selected.', true);
      } else {
        await this.deps.sendToFrame(previous.tabId, previous.frameId, {
          type: 'ANIME4K_FORCE_STOP',
          videoId: previous.videoId,
        }).catch(() => undefined);
      }
    }
    await this.store.persistActiveEnhancement(next);
    return { ok: true };
  }

  /** Release a video enhancement claim (serialized). */
  async releaseEnhancement(videoId: string, sender: chrome.runtime.MessageSender): Promise<void> {
    await this.runSerialized(async () => {
      const current = await this.store.loadActiveEnhancement();
      if (current && current.tabId === sender.tab?.id && current.frameId === (sender.frameId ?? 0)
          && current.videoId === videoId) {
        await this.store.persistActiveEnhancement(null);
      }
    });
  }

  /** Start (or update) the native fallback session for a video (serialized). */
  async startNativeFallback(
    request: NativeFallbackRequest,
    sender: chrome.runtime.MessageSender,
  ): Promise<NativeFallbackStartResult> {
    return this.runSerialized(() => this.doStartNativeFallback(request, sender));
  }

  private async doStartNativeFallback(
    request: NativeFallbackRequest,
    sender: chrome.runtime.MessageSender,
  ): Promise<NativeFallbackStartResult> {
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
    if (!await this.deps.requestOriginConsent(tabId, consentOrigin)) {
      return { ok: false, status: 'denied', message: 'Native capture was not allowed for this website.' };
    }

    if (this.store.activeSession
        && this.store.activeSession.tabId === tabId
        && this.store.activeSession.frameId === frameId
        && this.store.activeSession.videoId === request.videoId) {
      await this.updateNativeConfiguration(request.configuration);
      return { ok: true, status: 'started', sessionId: this.store.activeSession.sessionId };
    }

    await this.stopNativeSession('A different video was selected.', true);

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
      version: NATIVE_SESSION_VERSION,
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
      output: 'auto',
      createdAt: Date.now(),
    };

    await this.store.persistSession(session);
    try {
      const prepared = await this.prepareDirectFullscreen(session);
      await this.store.persistSession(session);

      // Let the site's fullscreen transition and controls settle before
      // measuring the exact visible decoded-video rectangle.
      await new Promise<void>(resolve => setTimeout(resolve, 250));
      const captureMeasurement = await this.deps.sendToFrame<PopupMeasurement>(session.tabId, session.frameId, {
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
      await this.store.persistSession(session);

      const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
      this.bridge.assertSupportsConfiguration(session.configuration);
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
      this.latestStatus = {
        active: true,
        sessionId: session.sessionId,
        state: started.state,
        message: [started.message, scalingSummary].filter(Boolean).join(' · '),
        configuration: session.configuration,
      };
      await this.store.persistSession(session);
      await this.sendSessionEvent(session, started);
      return { ok: true, status: 'started', sessionId: session.sessionId };
    } catch (error) {
      const unavailable = error instanceof NativeHostUnavailableError;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[NativeBridge] Failed to start the native renderer.', error);
      await this.stopNativeSession(message, true);
      return {
        ok: false,
        status: 'unavailable',
        message: unavailable
          ? 'AniWebScale Native Host is not installed. Install the Windows native package, then try again.'
          : message,
      };
    }
  }

  /** Update the active session's renderer configuration. */
  async updateNativeConfiguration(configuration: NativeConfiguration): Promise<void> {
    const session = this.store.activeSession;
    if (!session) throw new Error('No native session is active.');
    const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
    this.bridge.assertSupportsConfiguration(configuration);
    const status = await client.request<NativeStatusEvent>({
      ...nativeRequestBase(),
      type: 'updateConfiguration',
      sessionId: session.sessionId,
      mode: configuration.mode,
      quality: configuration.quality,
      frameGenerationEnabled: configuration.frameGenerationEnabled,
    });
    session.configuration = configuration;
    this.latestStatus = { ...this.latestStatus, configuration };
    await this.store.persistSession(session);
    await this.sendSessionEvent(session, status);
  }

  /** Route an incoming native host event to the right frames. */
  async routeNativeEvent(event: NativeEvent, sourceClient: NativeMessagingClient): Promise<void> {
    // A disconnected client can still have a previously queued callback. Never
    // reinterpret an unscoped transport error from that client as belonging to
    // the replacement native session.
    if (sourceClient !== this.bridge.currentClient) return;
    const session = this.store.activeSession;

    if (event.type === 'pointer' || event.type === 'mediaCommand') {
      if (session && event.sessionId === session.sessionId) {
        const message = {
          ...event,
          type: event.type === 'pointer' ? 'NATIVE_POINTER_EVENT' : 'NATIVE_MEDIA_COMMAND_EVENT',
        };
        if (event.type === 'mediaCommand' && event.command === 'exitFullscreen') {
          await this.exitNativeFullscreen(session, message);
        } else {
          // A player may run its <video> in an iframe while the native output
          // window is owned by the top-level document. send the pointer to the
          // source frame where isolation is staged, and also to the top frame:
          // whichever content-script instance holds the active isolation will act
          // on it. A cross-frame mismatch silently dropped seek/scrub before.
          const targets = session.frameId === 0
            ? [0]
            : [session.frameId, 0];
          await Promise.all(targets.map(frameId => this.deps.sendToFrame(session.tabId, frameId, message).catch(() => undefined)));
        }
      }
      return;
    }

    if (event.type === 'metrics' && session && event.sessionId === session.sessionId) {
      this.latestStatus = {
        ...this.latestStatus,
        active: true,
        metrics: {
          fps: event.fps,
          frameTimeMs: event.frameTimeMs,
          droppedFrames: event.droppedFrames,
        },
      };
      await this.sendSessionEvent(session, event);
      return;
    }

    if (event.type === 'status' && session && event.sessionId === session.sessionId) {
      this.latestStatus = {
        ...this.latestStatus,
        active: event.state !== 'stopped' && event.state !== 'failed',
        state: event.state,
        message: event.message,
      };
      if (!event.requestId?.startsWith('playback-')) await this.sendSessionEvent(session, event);
      if (event.state === 'failed' || event.state === 'stopped') {
        void this.runSerialized(() => this.stopNativeSession(event.message ?? event.state, false, true, session.sessionId));
      }
      return;
    }

    if (event.type === 'error') {
      if (session && (!event.sessionId || event.sessionId === session.sessionId)) {
        this.latestStatus = { ...this.latestStatus, state: 'failed', message: event.message };
        await this.sendSessionEvent(session, event);
        // A renderer error invalidates the capture surface even when the host
        // classifies it as theoretically recoverable. Use the same idempotent
        // restore path for device loss, capture loss, and fatal protocol errors.
        void this.runSerialized(() => this.stopNativeSession(event.message, false, true, session.sessionId));
      }
      return;
    }

    if (event.type === 'stopped' && session && event.sessionId === session.sessionId) {
      await this.sendSessionEvent(session, event);
      void this.runSerialized(() => this.stopNativeSession(event.reason, false, true, session.sessionId));
    }
  }

  /** Exit the native fullscreen session with retries (absorbing DOM swaps). */
  async exitNativeFullscreen(session: NativeSessionRecord, message: unknown): Promise<void> {
    if (this.fullscreenExitSessionId === session.sessionId) return;
    this.fullscreenExitSessionId = session.sessionId;
    try {
      // Crunchyroll can replace player elements during the exit animation. Ask
      // the top document (authoritative for the fullscreen stack) and the source
      // frame, then confirm the resulting state. A short retry absorbs those DOM
      // swaps without requiring the user to press Esc several times.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (this.store.activeSession?.sessionId !== session.sessionId) return;
        const topFrame = await this.deps.sendToFrame<FullscreenExitFrameResponse>(
          session.tabId,
          0,
          message,
        ).catch(() => null);
        const sourceFrame = session.frameId === 0
          ? topFrame
          : await this.deps.sendToFrame<FullscreenExitFrameResponse>(
            session.tabId,
            session.frameId,
            message,
          ).catch(() => null);
        const state = resolveFullscreenExitState(topFrame, sourceFrame);
        if (state === 'exited') {
          await this.runSerialized(() => this.stopNativeSession('Fullscreen exited.', true, true, session.sessionId));
          return;
        }
        if (attempt < 4) await new Promise<void>(resolve => setTimeout(resolve, 150));
      }
      // The renderer keeps displaying the enhanced frame while its own failsafe
      // timer waits. This avoids dropping back to an unenhanced source window if
      // a transient browser transition prevented confirmation.
    } finally {
      if (this.fullscreenExitSessionId === session.sessionId) this.fullscreenExitSessionId = null;
    }
  }

  /** Forward a session event to the source frame. */
  private async sendSessionEvent(session: NativeSessionRecord, event: NativeEvent): Promise<void> {
    await this.deps.sendToFrame(session.tabId, session.frameId, {
      type: 'NATIVE_SESSION_EVENT',
      // Some host-level errors do not carry a session ID. Scope every forwarded
      // event here so a delayed delivery cannot tear down a replacement session.
      event: { ...event, sessionId: session.sessionId },
    }).catch(() => undefined);
  }

  /** Prepare a direct-fullscreen capture session. */
  private async prepareDirectFullscreen(session: NativeSessionRecord): Promise<PreparedVideo> {
    const prepared = await this.deps.sendToFrame<PreparedVideo>(session.tabId, session.frameId, {
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
    const title = await this.deps.sendToFrame<{ ok?: boolean; originalTitle?: string }>(session.tabId, 0, {
      type: 'NATIVE_SET_TITLE_NONCE',
      captureKind: 'direct-fullscreen',
      sessionId: session.sessionId,
      nonce: session.nonce,
    });
    if (!title?.ok) throw new Error('The fullscreen browser window could not be marked for capture.');
    session.originalTitle = title.originalTitle;
    return prepared;
  }

  /** Restore the page content after a capture session ends. */
  private async restoreContent(session: NativeSessionRecord): Promise<void> {
    if (session.captureKind === 'direct-fullscreen') {
      const restoreSession = {
        type: 'NATIVE_RESTORE_SESSION',
        sessionId: session.sessionId,
        nonce: session.nonce,
        originalTitle: session.originalTitle,
      };
      await this.deps.sendToFrame(session.tabId, session.frameId, restoreSession).catch(() => undefined);
      await this.deps.sendToFrame(session.tabId, 0, {
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
    await this.deps.sendToFrame(session.tabId, session.frameId, message).catch(() => undefined);
    if (session.frameId !== 0) {
      await this.deps.sendToFrame(session.tabId, 0, message).catch(() => undefined);
    }
  }

  /** Restore a legacy popup tab to its original window. */
  private async restoreTab(session: NativeSessionRecord): Promise<void> {
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

  /** Find the tab that matches a persisted session's nonce. */
  private async findRecoveredSessionTab(session: NativeSessionRecord): Promise<chrome.tabs.Tab | null> {
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

  /** Recover a persisted native session after a service-worker restart. */
  async recoverPersistedSession(): Promise<void> {
    const persisted = await this.store.loadPersistedSession();
    if (!persisted) return;
    await this.store.persistSession(persisted);
    if (!await this.deps.isExtensionEnabled()) {
      await this.stopNativeSession('AniWebScale was disabled.', true);
      return;
    }

    const recoveredTab = await this.findRecoveredSessionTab(persisted);
    if (!recoveredTab || recoveredTab.id === undefined) {
      try {
        await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
      } catch {
        // Cleanup below is still safe when the host is already gone.
      }
      // A recycled tab/window ID or matching URL is not proof that this is our
      // capture surface. Stop the host session, but never move or restyle an
      // unverified browser tab.
      await this.stopNativeSession('Could not recover the saved native capture window.', true, false);
      return;
    }
    if (persisted.captureKind === 'legacy-popup' && recoveredTab.id !== persisted.tabId) {
      persisted.tabId = recoveredTab.id;
      persisted.frameId = 0;
      persisted.popupWindowId = recoveredTab.windowId;
      const windows = await chrome.windows.getAll();
      const normalWindow = windows.find(window => window.type === 'normal' && window.id !== recoveredTab.windowId);
      if (normalWindow?.id !== undefined) persisted.originalWindowId = normalWindow.id;
      await this.store.persistSession(persisted);
    } else if (persisted.captureKind === 'direct-fullscreen') {
      persisted.tabId = recoveredTab.id;
      persisted.sourceWindowId = recoveredTab.windowId;
      await this.store.persistSession(persisted);
    }

    if (persisted.phase !== 'active') {
      try {
        await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
      } catch {
        // Browser restoration below is still safe for the nonce-verified tab.
      }
      await this.stopNativeSession('Recovered an interrupted native startup.', true);
      return;
    }

    try {
      const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
      const status = await client.request<NativeStatusEvent>({
        ...nativeRequestBase(),
        type: 'status',
        sessionId: persisted.sessionId,
      }, 5_000);
      if (status.type === 'status' && (status.state === 'starting' || status.state === 'capturing')) {
        this.latestStatus = {
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
    await this.stopNativeSession('The saved native session is no longer running.', true);
  }

  /** Forward a media command to the native host. */
  async forwardMediaCommand(command: NativeMediaCommandName, value?: number): Promise<void> {
    const session = this.store.activeSession;
    if (!session) throw new Error('No native session is active.');
    const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
    client.post({
      ...nativeRequestBase(),
      type: 'mediaCommand',
      sessionId: session.sessionId,
      command,
      ...(Number.isFinite(value) ? { value } : {}),
    });
  }

  /** Forward a pointer event to the native host. */
  async forwardPointer(request: Record<string, unknown>): Promise<void> {
    const session = this.store.activeSession;
    if (!session) throw new Error('No native session is active.');
    const payload = request as Record<string, unknown>;
    if (!isNativePointerEventPayload(payload)) {
      throw new Error('Invalid native pointer event.');
    }
    const event = payload.event as NativePointerEventType;
    const x = Number(payload.x);
    const y = Number(payload.y);
    const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
    client.post({
      ...nativeRequestBase(),
      type: 'pointer',
      sessionId: session.sessionId,
      event,
      x,
      y,
      ...(typeof payload.button === 'number' ? { button: payload.button } : {}),
      ...(typeof payload.buttons === 'number' ? { buttons: payload.buttons } : {}),
      ...(typeof payload.deltaX === 'number' ? { deltaX: payload.deltaX } : {}),
      ...(typeof payload.deltaY === 'number' ? { deltaY: payload.deltaY } : {}),
      ...(typeof payload.shiftKey === 'boolean' ? { shiftKey: payload.shiftKey } : {}),
      ...(typeof payload.ctrlKey === 'boolean' ? { ctrlKey: payload.ctrlKey } : {}),
      ...(typeof payload.altKey === 'boolean' ? { altKey: payload.altKey } : {}),
    });
  }

  /** Stop the active native session and restore the browser state (idempotent). */
  async stopNativeSession(
    reason: string,
    notifyHost: boolean,
    restoreBrowser = true,
    expectedSessionId?: string,
  ): Promise<void> {
    const session = this.store.activeSession ?? await this.store.loadPersistedSession();
    if (!matchesExpectedNativeSession(session, expectedSessionId)) return;
    if (!session) {
      this.latestStatus = { active: false };
      this.bridge.disconnect();
      return;
    }
    session.phase = 'stopping';
    await this.store.persistSession(session);
    if (notifyHost && this.bridge.currentClient?.connected) {
      try {
        await this.bridge.currentClient.request({
          ...nativeRequestBase(),
          type: 'stop',
          sessionId: session.sessionId,
        }, 3_000);
      } catch (error) {
        console.warn('[NativeBridge] Native stop acknowledgement was not received.', error);
      }
    }

    if (restoreBrowser) {
      await this.restoreContent(session);
      if (requiresLegacyPopupRestore(session)) await this.restoreTab(session);
    }
    this.bridge.disconnect();
    await this.store.persistSession(null);
    const currentEnhancement = await this.store.loadActiveEnhancement();
    if (currentEnhancement?.tabId === session.tabId
        && currentEnhancement.frameId === session.frameId
        && currentEnhancement.videoId === session.videoId) {
      await this.store.persistActiveEnhancement(null);
    }
    this.latestStatus = { active: false, state: 'stopped', message: reason };
  }

  /** Send playback state to the native host. */
  async sendPlaybackState(
    sessionId: string,
    playbackActive: boolean,
    mediaTime: number,
  ): Promise<void> {
    const client = await this.bridge.connectAndHandshake((event, eventClient) => this.routeNativeEvent(event, eventClient));
    client.post({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: `playback-${createRequestId()}`,
      type: 'status',
      sessionId,
      playbackActive,
      mediaTime,
    });
  }
}

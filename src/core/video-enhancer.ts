import {
  ANIME4K_APPLIED_ATTR,
  ANIME4K_FULLSCREEN_AUTO_ATTR,
  ANIME4K_PROTECTED_PLAYBACK_ATTR,
} from '../constants';
import type {
  Anime4KWebExtSettings,
  RealEsrganCapHeight,
  RenderStats,
} from '../types';
import {
  calculateAutoTargetDimensions,
  isProcessingEnabled,
  MODE_TO_ID,
} from '../shared/presets';
import {
  allowsNativeFallback,
  hasProtectedPlaybackSignal,
  selectInitialBackend,
} from '../shared/backend-selection';
import type { SelectedBackend } from '../shared/backend-selection';
import { assertBackendCompatibility, classifyFallbackReason } from './video-backend-policy';
import { electFullscreenCandidate, fullscreenContext } from './fullscreen-context';
import type { NativeFallbackReason } from '../shared/native-fallback-request';
import { blocksNativeRetry } from '../shared/native-retry';
import {
  createNativeSessionClient,
  type NativeFallbackOutcome,
  type NativeSessionClient,
} from './native-session-client';
import { matchesExpectedNativeEvent } from '../shared/session-recovery';
import { getEffectsForPreset, getSettings } from '../utils/settings';
import { isVideoInFullscreenContext } from '../shared/fullscreen-video';
import { OverlayManager } from './overlay-manager';
import { FullscreenLayoutManager } from './fullscreen-layout-manager';
import { BackendState } from './backend-state';
import { createRenderStatsTap } from './render-stats-tap';
import { EnhancerLifecycle } from './enhancer-lifecycle';
import { OverloadTracker } from './render-stats';
import { RealEsrganAutoCap } from '../shared/realesrgan-auto-cap';
import { formatRealEsrganError, REALESRGAN_ERROR_CODES } from '../shared/realesrgan-error-codes';
import { EventScope } from '../shared/event-scope';
import type { Renderer } from './renderer';
import { hasPlayerFullscreenSignal, showEnhancementNotification } from './video-enhancer-view';

export class VideoEnhancer {
  private static activeEnhancer: VideoEnhancer | null = null;
  private static readonly managedEnhancers = new Set<VideoEnhancer>();

  private renderer: Renderer | null = null;
  private video!: HTMLVideoElement;
  private readonly backend = new BackendState();
  private nativeSessionId: string | null = null;
  private currentModeId: string | null = null;
  private currentSettings: Anime4KWebExtSettings | null = null;
  private readonly overlay: OverlayManager;
  private readonly fullscreenLayout: FullscreenLayoutManager;
  private readonly videoId: string;
  private encryptedDetected = false;
  private performanceWarning = false;
  private lastNativeDroppedFrames = 0;
  private readonly nativeOverloadTracker = new OverloadTracker();
  /**
   * Hebel C: ephemeral RealESRGAN inference-cap override (480->432->405->360
   * on sustained overload, back up on headroom). Lives only while a WebGPU
   * renderer serves REALESRGAN; never persisted, reset on every settings
   * change and cleared with the renderer.
   */
  private autoCap: RealEsrganAutoCap | null = null;
  /**
   * Stats fan-out: overlay, auto-cap and future consumers subscribe here
   * instead of hand-wiring new paths through the producer. Emission keeps
   * the producer cadence (renderer 500 ms windows, native metrics events).
   */
  private readonly statsTap = createRenderStatsTap();
  /**
   * Latest stats window (500 ms cadence). Retained so E2E runs can sample
   * live inference timings without scraping the overlay DOM.
   */
  private lastStats: RenderStats | null = null;
  private destroyed = false;
  private switchingFromNativeRevision: number | null = null;
  private switchingFromNativeSessionId: string | null = null;
  private lastEncryptedHandlingAt = 0;
  private readonly targetResizeObserver: ResizeObserver;
  private targetUpdateTimer?: number;
  private nativePlaybackTimer?: number;
  private fullscreenDebounceTimer?: number;
  private fullscreenRevision = 0;
  /** The one serialized lifecycle: settings and fullscreen reconcile never interleave. */
  private readonly lifecycle = new EnhancerLifecycle();
  private readonly events = new EventScope();
  private videoEvents = new EventScope();
  private automaticSession = false;
  private nativeRetryBlocked = false;

  private readonly targetChangeHandler = () => {
    this.scheduleAutoTargetUpdate();
    this.scheduleFullscreenReconcile();
  };
  private readonly videoFrameHandler = () => {
    this.scheduleFullscreenReconcile(0);
  };
  private readonly fullscreenChangeHandler = () => {
    this.scheduleFullscreenReconcile(0);
  };
  private readonly mediaActivityHandler = () => {
    this.scheduleFullscreenReconcile(0);
  };
  private readonly windowScrollHandler = () => {
    this.scheduleFullscreenReconcile(0);
  };
  private readonly unsubscribeFullscreenContext: () => void;

  private readonly bfcacheRestoreHandler = (event: Event) => {
    // The native host session cannot survive a back/forward cache freeze: the
    // stop event was dropped together with the frozen document, leaving a
    // native-active enhancer wired to a session that no longer exists.
    if (!(event as PageTransitionEvent).persisted || !this.backend.isNativeActive) return;
    void this.stopEnhancement().then(
      () => this.scheduleFullscreenReconcile(0),
      () => undefined,
    );
  };

  private readonly nativeSessionHandler = (event: Event) => {
    if (this.destroyed) return;
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    if (!detail || typeof detail.type !== 'string') return;
    // Events are matched to the live session id, not to the transition
    // phase: a terminal host event can arrive while a configuration update
    // is between phases, and dropping it would leave a zombie session whose
    // cleanup never runs.
    //
    // Exception: an intentional native->webgpu switch nulls the session id
    // before asking the host to stop, so its terminal event no longer matches
    // the (null) live id. That event is still expected and must be swallowed
    // explicitly via the captured switch session id below.
    if (!matchesExpectedNativeEvent(this.nativeSessionId, detail.sessionId)
      && !(this.switchingFromNativeSessionId !== null && detail.sessionId === this.switchingFromNativeSessionId)) return;
    if (blocksNativeRetry(detail)) this.nativeRetryBlocked = true;
    if (detail.type === 'metrics') {
      if (!this.backend.isNativeActive) return;
      const fps = Number(detail.fps) || 0;
      const renderMs = Number(detail.frameTimeMs) || 0;
      const droppedFrames = Number(detail.droppedFrames) || 0;
      const budgetMs = 1000 / Math.max(24, fps || 24);
      const now = performance.now();
      this.performanceWarning = this.nativeOverloadTracker.recordSample(
        renderMs > budgetMs || droppedFrames > this.lastNativeDroppedFrames,
        now,
      );
      this.lastNativeDroppedFrames = droppedFrames;
      const stats: RenderStats = {
        fps,
        renderMs,
        droppedFrames,
        warning: this.performanceWarning,
      };
      this.handleStats(stats);
      return;
    }
    const state = detail.state;
    const ended = detail.type === 'stopped'
      || detail.type === 'error'
      || detail.type === 'status' && (state === 'stopped' || state === 'failed');
    if (!ended) return;
    const retryCaptureAfterFailedExit = detail.type === 'stopped'
      && detail.reason === 'capture_window_closed'
      && isVideoInFullscreenContext(this.video);
    if (this.switchingFromNativeRevision !== null
      && this.lifecycle.isCurrent(this.switchingFromNativeRevision)) {
      this.backend.markIdle();
      this.nativeSessionId = null;
      this.stopNativePlaybackHeartbeat();
      return;
    }
    this.backend.markIdle();
    this.nativeSessionId = null;
    this.stopNativePlaybackHeartbeat();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.currentModeId = null;
    this.performanceWarning = false;
    this.nativeOverloadTracker.reset();
    this.lastNativeDroppedFrames = 0;
    this.overlay.setStats(null);
    this.automaticSession = false;
    this.fullscreenLayout.exit();
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
    void this.native.release(this.videoId);
    if ((detail.type === 'error' || state === 'failed') && typeof detail.message === 'string') {
      showEnhancementNotification(detail.message);
    }
    if (retryCaptureAfterFailedExit) this.scheduleFullscreenReconcile(250);
  };

  private readonly encryptedHandler = () => {
    this.encryptedDetected = true;
    void this.handleEncryptedPlayback();
  };

  private readonly pageProtectedPlaybackHandler = () => {
    if (this.encryptedDetected) return;
    this.encryptedDetected = true;
    void this.handleEncryptedPlayback();
  };

  private constructor(video: HTMLVideoElement, private readonly native: NativeSessionClient = createNativeSessionClient()) {
    this.video = video;
    this.videoId = crypto.randomUUID?.() ?? `anime4k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.video.dataset.anime4kVideoId = this.videoId;
    VideoEnhancer.managedEnhancers.add(this);
    this.video.addEventListener('encrypted', this.encryptedHandler);
    this.events.on(window, 'anime4k-protected-playback', this.pageProtectedPlaybackHandler);
    if (document.documentElement?.hasAttribute(ANIME4K_PROTECTED_PLAYBACK_ATTR)) {
      this.encryptedDetected = true;
    }
    this.overlay = OverlayManager.create(this.video);
    // Stats fan-out: overlay forwarding and auto-cap ride the tap, so the
    // next consumer subscribes instead of touching the producer.
    this.wireStatsConsumers();
    this.fullscreenLayout = new FullscreenLayoutManager(this.video);
    this.targetResizeObserver = new ResizeObserver(this.targetChangeHandler);
    this.targetResizeObserver.observe(this.video);
    this.events.on(window, 'resize', this.targetChangeHandler);
    this.events.on(window, 'scroll', this.windowScrollHandler, true);
    this.unsubscribeFullscreenContext = fullscreenContext.subscribe(this.fullscreenChangeHandler);
    this.observeVideoEvents(this.video);
    this.events.on(window, 'anime4k-native-session', this.nativeSessionHandler);
    this.events.on(window, 'pageshow', this.bfcacheRestoreHandler);
    void getSettings().then(settings => {
      if (this.destroyed) return;
      this.currentSettings = settings;
      this.applyFullscreenMarker(
        isProcessingEnabled(settings.mode, settings.frameGenerationEnabled),
      );
      this.scheduleFullscreenReconcile(0);
    }).catch(error => {
      console.info('[Anime4K] Could not initialize fullscreen automation:', error instanceof Error ? error.message : String(error));
    });
  }

  public static create(video: HTMLVideoElement, nativeClient?: NativeSessionClient): VideoEnhancer {
    return new VideoEnhancer(video, nativeClient ?? createNativeSessionClient());
  }

  private beginTransition(): number {
    const revision = this.lifecycle.begin();
    this.backend.beginTransition();
    return revision;
  }

  private observeVideoEvents(video: HTMLVideoElement): void {
    this.videoEvents.on(video, 'loadedmetadata', this.mediaActivityHandler);
    this.videoEvents.on(video, 'playing', this.mediaActivityHandler);
    this.videoEvents.on(video, 'resize', this.mediaActivityHandler);
    this.videoEvents.on(video, 'timeupdate', this.videoFrameHandler);
  }

  private isTransitionCurrent(revision: number): boolean {
    return this.lifecycle.isCurrent(revision);
  }

  private isProtectedPlayback(): boolean {
    return hasProtectedPlaybackSignal({
      encryptedDetected: this.encryptedDetected,
      hasMediaKeys: Boolean(this.video.mediaKeys),
      pageProtectedPlaybackDetected: Boolean(
        document.documentElement?.hasAttribute(ANIME4K_PROTECTED_PLAYBACK_ATTR),
      ),
      hostname: location.hostname,
    });
  }

  private selectBackend(settings: Anime4KWebExtSettings): SelectedBackend {
    return selectInitialBackend({
      requested: settings.backend,
      protectedPlayback: this.isProtectedPlayback(),
      webgpuAvailable: Boolean(navigator.gpu),
    });
  }

  private async startEnhancement(settings?: Anime4KWebExtSettings): Promise<void> {
    if (this.renderer || this.backend.isNativeActive || this.destroyed || this.backend.isStarting) return;
    const revision = this.beginTransition();
    try {
      settings ??= this.currentSettings ?? await getSettings();
      if (!this.isTransitionCurrent(revision)) return;
      if (!isProcessingEnabled(settings.mode, settings.frameGenerationEnabled)) {
        this.currentSettings = settings;
        this.currentModeId = null;
        this.applyFullscreenMarker(false);
        this.backend.markIdle();
        return;
      }
      const selectedBackend = this.selectBackend(settings);
      assertBackendCompatibility(selectedBackend);
      this.currentSettings = settings;
      const claim = await this.native.claim(this.videoId);
      if (!this.isTransitionCurrent(revision)) return;
      if (!claim.ok) throw new Error(claim.message || 'Another Anime4K instance could not be stopped.');
      if (VideoEnhancer.activeEnhancer && VideoEnhancer.activeEnhancer !== this) {
        await VideoEnhancer.activeEnhancer.stopEnhancement({ releaseClaim: false });
        if (!this.isTransitionCurrent(revision)) return;
      }

      if (selectedBackend === 'native') {
        const reason: NativeFallbackReason = settings.backend === 'native'
          ? 'native-selected'
          : this.isProtectedPlayback() ? 'eme' : 'webgpu-unavailable';
        try {
          if (!await this.requestNativeFallback(reason, settings, revision)) return;
        } catch (error) {
          if (!this.isTransitionCurrent(revision)) return;
          throw error;
        }
      } else if (selectedBackend === 'webgpu') {
        if (!await this.initRenderer(settings, revision)) return;
      }
      if (!this.isTransitionCurrent(revision)) return;
      VideoEnhancer.activeEnhancer = this;
      this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return;
      // Renderer/backend failures are operational errors and are shown in the
      // page notification. Avoid turning an expected fallback failure into a
      // misleading red extension error entry in chrome://extensions.
      console.info('[Anime4K] Enhancement could not be started:', error instanceof Error ? error.message : String(error));
      await this.stopEnhancement({ stopNative: false });
      if (!this.destroyed) {
        showEnhancementNotification(error instanceof Error ? error.message : 'Anime4K could not be started.');
      }
    } finally {
      // If no backend committed (e.g. disabled processing, aborted transition),
      // leave the starting phase so later start attempts are not blocked.
      if (this.backend.isStarting && this.isTransitionCurrent(revision)) this.backend.markIdle();
    }
  }

  private async initRenderer(settings: Anime4KWebExtSettings, revision: number): Promise<boolean> {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser context.');
    if (this.video.readyState < this.video.HAVE_METADATA) {
      const video = this.video;
      await new Promise<void>((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('The video metadata could not be loaded.')); };
        // A preload="none" source the player never starts loading would
        // otherwise pin the backend in its starting phase forever.
        const stalled = window.setTimeout(failed, 10_000);
        const cleanup = () => {
          window.clearTimeout(stalled);
          video.removeEventListener('loadedmetadata', loaded);
          video.removeEventListener('error', failed);
        };
        video.addEventListener('loadedmetadata', loaded, { once: true });
        video.addEventListener('error', failed, { once: true });
      });
    }
    if (!this.isTransitionCurrent(revision)) return false;

    let rendererVideo = this.video;
    let rendererTargetDimensions = calculateAutoTargetDimensions(rendererVideo);
    const canvas = this.overlay.getCanvas();
    canvas.width = rendererTargetDimensions.width;
    canvas.height = rendererTargetDimensions.height;
    const effects = getEffectsForPreset(settings.mode, settings.quality, settings.realesrganCapHeight, settings.realesrganPrecision);
    this.currentModeId = MODE_TO_ID[settings.mode];

    let createdRenderer: Renderer | null = null;
    try {
      const { Renderer: WebGPURenderer } = await import('./renderer');
      if (!this.isTransitionCurrent(revision)) return false;
      const ownsRenderer = (source?: HTMLVideoElement) => !this.destroyed && (
        this.isTransitionCurrent(revision)
          && (!source || source === this.video)
          && createdRenderer !== null
          && this.renderer === createdRenderer
      );
      const renderer = await WebGPURenderer.create({
        video: rendererVideo,
        canvas,
        effects,
        targetDimensions: rendererTargetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
        onFirstFrameRendered: source => {
          if (ownsRenderer(source)) this.overlay.showCanvas();
        },
        onProgress: () => undefined,
        onStats: stats => {
          if (ownsRenderer()) this.handleStats(stats);
        },
        onError: error => {
          if (ownsRenderer()) void this.handleRendererError(error);
        },
      });
      createdRenderer = renderer;
      if (!this.isTransitionCurrent(revision)) {
        renderer.destroy();
        return false;
      }
      // Player frameworks frequently replace the <video> node while shaders
      // are still initializing. Align the completed renderer with the
      // latest node before it can own callbacks or expose an applied marker.
      while (rendererVideo !== this.video && this.isTransitionCurrent(revision)) {
        const nextVideo = this.video;
        await renderer.updateVideoSource(nextVideo);
        rendererVideo = nextVideo;
        const nextTarget = calculateAutoTargetDimensions(nextVideo);
        if (nextTarget.width !== rendererTargetDimensions.width
            || nextTarget.height !== rendererTargetDimensions.height) {
          await renderer.updateConfiguration({
            effects,
            targetDimensions: nextTarget,
            frameGenerationEnabled: settings.frameGenerationEnabled,
          });
          rendererTargetDimensions = nextTarget;
          canvas.width = nextTarget.width;
          canvas.height = nextTarget.height;
        }
      }
      if (!this.isTransitionCurrent(revision)) {
        renderer.destroy();
        return false;
      }
      this.renderer = renderer;
      this.backend.markWebGPUActive();
      if (renderer.hasRenderedCurrentSource()) this.overlay.showCanvas();
      return true;
    } catch (error) {
      if (createdRenderer && this.renderer !== createdRenderer) createdRenderer.destroy();
      if (!this.isTransitionCurrent(revision)) return false;
      if (!allowsNativeFallback(settings.backend)) throw error;
      const reason = classifyFallbackReason(error);
      return this.requestNativeFallback(reason, settings, revision);
    }
  }

  private async requestNativeFallback(
    reason: NativeFallbackReason,
    settings: Anime4KWebExtSettings,
    revision: number,
  ): Promise<boolean> {
    if (!this.isTransitionCurrent(revision)) return false;
    if (!allowsNativeFallback(settings.backend)) {
      throw new Error('The native fallback is disabled while Backend is forced to WebGPU.');
    }
    this.releaseWebGPUResources();
    this.overlay.hideCanvas();
    const rect = this.video.getBoundingClientRect();
    let response: NativeFallbackOutcome;
    try {
      response = await this.native.requestFallback({
        videoId: this.videoId,
        reason,
        configuration: {
          mode: settings.mode,
          quality: settings.quality,
          frameGenerationEnabled: settings.frameGenerationEnabled,
        },
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
      });
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return false;
      throw error;
    }
    if (!this.isTransitionCurrent(revision)) return false;
    if (!response.ok || typeof response.sessionId !== 'string') {
      throw new Error(response.message || 'The native Anime4K renderer is unavailable.');
    }
    this.backend.markNativeActive();
    this.nativeSessionId = response.sessionId;
    this.startNativePlaybackHeartbeat();
    this.currentModeId = MODE_TO_ID[settings.mode];
    return true;
  }

  /**
   * Switch from the WebGPU renderer to the native host. Consolidates the
   * sequence that handleEncryptedPlayback, handleRendererError and the
   * webgpu-to-native settings branch used to copy: release WebGPU, check the
   * fallback policy, request the native session, and on failure stop with a
   * notification. Returns true when the native backend committed.
   */
  private async switchToNative(
    reason: NativeFallbackReason,
    settings: Anime4KWebExtSettings,
    options: {
      blockedMessage?: string;
      fallbackErrorMessage: string;
      throwOnFailure?: boolean;
    },
    existingRevision?: number,
  ): Promise<boolean> {
    const revision = existingRevision ?? this.beginTransition();
    if (!allowsNativeFallback(settings.backend)) {
      await this.stopEnhancement({ stopNative: false });
      const blockedMessage = options.blockedMessage
        ?? 'The native fallback is disabled while Backend is forced to WebGPU.';
      if (!this.destroyed) showEnhancementNotification(blockedMessage);
      if (options.throwOnFailure) throw new Error(blockedMessage);
      return false;
    }
    this.releaseWebGPUResources();
    this.overlay.hideCanvas();
    try {
      if (!await this.requestNativeFallback(reason, settings, revision)) return false;
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return false;
      await this.stopEnhancement({ stopNative: false });
      if (!this.destroyed) {
        showEnhancementNotification(error instanceof Error ? error.message : options.fallbackErrorMessage);
      }
      if (options.throwOnFailure) throw error;
      return false;
    }
    if (!this.isTransitionCurrent(revision)) return false;
    // Only one enhancer may own the active slot: a competing video could
    // have committed while this fallback was in flight (mirrors startEnhancement).
    if (VideoEnhancer.activeEnhancer && VideoEnhancer.activeEnhancer !== this) {
      await VideoEnhancer.activeEnhancer.stopEnhancement({ releaseClaim: false });
      if (!this.isTransitionCurrent(revision)) return false;
    }
    VideoEnhancer.activeEnhancer = this;
    this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
    return true;
  }

  private async handleEncryptedPlayback(): Promise<void> {
    if (this.destroyed) return;
    // EME fires once: don't drop it while a WebGPU start is still in flight.
    // Beginning a new transition invalidates the pending start so the native
    // path below wins instead of leaving protected content on WebGPU.
    if (!this.renderer && !this.backend.isNativeActive && !this.backend.isStarting) return;
    if (this.backend.isNativeActive) return;
    // The encrypted + page-protected signals often arrive as a burst for the
    // same key session; revision guards would absorb the duplicates anyway,
    // but skip the redundant settings fetch + transition churn outright.
    const now = Date.now();
    if (now - this.lastEncryptedHandlingAt < 500) return;
    this.lastEncryptedHandlingAt = now;
    const revision = this.beginTransition();
    const settings = this.currentSettings ?? await getSettings();
    if (!this.isTransitionCurrent(revision)) return;
    await this.switchToNative('eme', settings, {
      blockedMessage: 'Protected playback cannot use the forced WebGPU backend. Select Auto or Native instead.',
      fallbackErrorMessage: 'Protected playback cannot be captured.',
    }, revision);
  }

  private async handleRendererError(error: Error): Promise<void> {
    if (this.destroyed) return;
    // WebGPU unavailability is expected when hardware acceleration is disabled.
    // Auto mode handles it by switching to Native, so do not surface it as an
    // uncaught-looking extension error in the browser's extension manager.
    console.info('[Anime4K] WebGPU stopped; attempting the configured fallback:', error.message);
    const revision = this.beginTransition();
    const settings = this.currentSettings ?? await getSettings();
    if (!this.isTransitionCurrent(revision)) return;
    const reason = classifyFallbackReason(error);
    await this.switchToNative(reason, settings, {
      blockedMessage: error.message || 'The video frame cannot be processed with WebGPU.',
      fallbackErrorMessage: 'Video frames cannot be processed on this site.',
    }, revision);
  }

  /**
   * Subscribes the built-in stats consumers. Called by the constructor;
   * white-box tests call it too instead of duplicating the wiring, so new
   * consumers cannot desync the harness.
   */
  private wireStatsConsumers(): void {
    this.statsTap.subscribe(stats => {
      if (this.currentSettings?.statsEnabled) this.overlay.setStats(stats);
      else this.overlay.setStats(null);
    });
    this.statsTap.subscribe(stats => this.feedAutoCap(stats));
  }

  private handleStats(stats: RenderStats): void {
    this.performanceWarning = stats.warning;
    this.lastStats = stats;
    this.statsTap.emit(stats);
  }

  /**
   * Next stats consumer slot: overlay and auto-cap already subscribe, so a
   * new consumer adds one line here instead of a path through the producer.
   */
  public subscribeStats(listener: (stats: RenderStats) => void): () => void {
    return this.statsTap.subscribe(listener);
  }

  private feedAutoCap(stats: RenderStats): void {
    // Hebel C: sustained overload steps the live RealESRGAN cap down the
    // ladder (and back up on headroom) without touching stored settings.
    const settings = this.currentSettings;
    if (settings?.mode !== 'REALESRGAN' || !this.renderer || !this.backend.isWebGPUActive) return;
    this.autoCap ??= new RealEsrganAutoCap(settings.realesrganCapHeight);
    const step = this.autoCap.onStats({
      warning: stats.warning,
      inferMs: stats.realesrgan?.inferMs ?? null,
      frameBudgetMs: stats.frameBudgetMs ?? null,
      now: performance.now(),
    });
    if (step !== null) void this.lifecycle.enqueue(() => this.applyAutoCapStep(step));
  }

  /**
   * Test-only: feed one synthetic sustained-overload sample so E2E runs can
   * prove the live Auto-Cap step without waiting for real GPU overload.
   * No-op in production builds. Returns the effective cap afterwards.
   */
  public e2eInjectOverloadStats(): number | null {
    if (typeof __ANIME4K_E2E__ === 'undefined' || !__ANIME4K_E2E__) return null;
    this.handleStats({
      fps: 24,
      renderMs: 60,
      droppedFrames: 0,
      warning: true,
      realesrgan: {
        readbackMs: 5, inferMs: 50, composeMs: 2, runnerPct: 100, gpuComposePct: 0, nativePct: 100,
        count: 12, enhancedFps: 10,
      },
      frameBudgetMs: 1000 / 24,
    });
    return this.autoCap?.effectiveCap ?? null;
  }

  /**
   * Test-only: latest stats window for E2E timing gates. No-op in
   * production builds. Returns the RealESRGAN slice or null.
   */
  public e2eLastStats(): RenderStats['realesrgan'] {
    if (typeof __ANIME4K_E2E__ === 'undefined' || !__ANIME4K_E2E__) return undefined;
    return this.lastStats?.realesrgan;
  }


  private scheduleAutoTargetUpdate(): void {
    if (!this.renderer || this.destroyed) return;
    if (this.targetUpdateTimer) window.clearTimeout(this.targetUpdateTimer);
    this.targetUpdateTimer = window.setTimeout(() => void this.refreshAutoTarget(), 150);
  }

  /**
   * Hebel C: commit one Auto-Cap ladder step on the live renderer. Runs
   * inside the serialized lifecycle so it can never interleave with a
   * settings change or backend switch; stale steps (a newer step or a
   * settings reset landed first) are dropped via the effective-cap check.
   */
  private async applyAutoCapStep(cap: RealEsrganCapHeight): Promise<void> {
    const renderer = this.renderer;
    const settings = this.currentSettings;
    if (this.destroyed || !renderer || !settings || settings.mode !== 'REALESRGAN') return;
    if (!this.autoCap || this.autoCap.effectiveCap !== cap) return;
    const targetDimensions = calculateAutoTargetDimensions(this.video);
    const canvas = this.overlay.getCanvas();
    if (canvas.width !== targetDimensions.width || canvas.height !== targetDimensions.height) {
      canvas.width = targetDimensions.width;
      canvas.height = targetDimensions.height;
    }
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(settings.mode, settings.quality, cap, settings.realesrganPrecision),
        targetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
      });
    } catch (error) {
      // The policy's override no longer describes the live pipeline: drop
      // it so the next overload verdict re-steps from the actual cap.
      this.autoCap?.reset(settings.realesrganCapHeight, performance.now());
      if (!this.destroyed && this.renderer === renderer) await this.handleRendererError(error as Error);
      return;
    }
    // Coded so the E2E gate counts ladder steps by code, not by prose.
    console.info(formatRealEsrganError(REALESRGAN_ERROR_CODES.AUTO_CAP_STEP,
      `RealESRGAN auto-cap -> ${cap}p (sustained ${cap < settings.realesrganCapHeight ? 'overload' : 'headroom'})`));
  }

  private async refreshAutoTarget(): Promise<void> {
    if (!this.renderer || !this.currentSettings || this.destroyed) return;
    const renderer = this.renderer;
    const settings = this.currentSettings;
    const targetDimensions = calculateAutoTargetDimensions(this.video);
    const canvas = this.overlay.getCanvas();
    if (canvas.width === targetDimensions.width && canvas.height === targetDimensions.height) return;
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(settings.mode, settings.quality, settings.realesrganCapHeight, settings.realesrganPrecision),
        targetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
      });
    } catch (error) {
      if (!this.destroyed && this.renderer === renderer) await this.handleRendererError(error as Error);
    }
  }

  public updateSettings(newSettings: Anime4KWebExtSettings): Promise<void> {
    return this.lifecycle.enqueue(() => this.applySettings(newSettings));
  }

  private async applySettings(newSettings: Anime4KWebExtSettings): Promise<void> {
    if (this.destroyed) return;
    const processingEnabled = isProcessingEnabled(newSettings.mode, newSettings.frameGenerationEnabled);
    const selectedBackend = this.selectBackend(newSettings);
    if (processingEnabled) assertBackendCompatibility(selectedBackend);
    const previousSettings = this.currentSettings;
    const previousModeId = this.currentModeId;
    this.currentSettings = newSettings;
    this.currentModeId = processingEnabled ? MODE_TO_ID[newSettings.mode] : null;
    // Hebel C: a settings change owns the cap again — retarget (or drop)
    // the ephemeral override so it can never fight the stored setting.
    if (newSettings.mode === 'REALESRGAN') this.autoCap?.reset(newSettings.realesrganCapHeight, performance.now());
    else this.autoCap = null;
    this.applyFullscreenMarker(processingEnabled);

    if (!processingEnabled) {
      this.automaticSession = false;
      if (this.renderer || this.backend.isNativeActive || this.backend.isStarting
          || this.native.hasPendingFallback(this.videoId)) await this.stopEnhancement();
      else {
        this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
        this.fullscreenLayout.exit();
      }
      return;
    }

    if (!this.renderer && !this.backend.isNativeActive) {
      if (this.backend.isStarting || this.native.hasPendingFallback(this.videoId)) {
        await this.stopEnhancement();
        if (this.destroyed) return;
      }
      this.scheduleFullscreenReconcile(0);
      return;
    }

    if (this.backend.isNativeActive) {
      if (selectedBackend === 'native') {
        const revision = this.beginTransition();
        try {
          const response = await this.native.updateConfiguration({
            ...(this.nativeSessionId ? { sessionId: this.nativeSessionId } : {}),
            videoId: this.videoId,
            configuration: {
              mode: newSettings.mode,
              quality: newSettings.quality,
              frameGenerationEnabled: newSettings.frameGenerationEnabled,
            },
          });
          if (!this.isTransitionCurrent(revision)) return;
          if (!response.ok) {
            throw new Error(response.message || 'The native renderer could not apply the selected configuration.');
          }
          // The host can stop while the update is in flight; the terminal
          // event then already cleaned the session up (nativeSessionId
          // cleared). Re-committing it would leave a zombie native-active
          // enhancer whose session no longer exists.
          if (this.nativeSessionId === null) {
            throw new Error('The native renderer stopped during the configuration update.');
          }
          this.backend.markNativeActive();
        } catch (error) {
          if (!this.isTransitionCurrent(revision)) return;
          // Only re-commit the previous configuration when the session
          // survived the update; a session that ended mid-update stays idle
          // so fullscreen reconciliation can restart enhancement.
          if (this.nativeSessionId !== null) this.backend.markNativeActive();
          this.currentSettings = previousSettings;
          this.currentModeId = previousModeId;
          this.applyFullscreenMarker(
            previousSettings !== null
              && isProcessingEnabled(previousSettings.mode, previousSettings.frameGenerationEnabled),
          );
          throw error;
        }
        return;
      }

      const revision = this.beginTransition();
      this.switchingFromNativeRevision = revision;
      const nativeSessionId = this.nativeSessionId;
      this.switchingFromNativeSessionId = nativeSessionId;
      this.nativeSessionId = null;
      this.stopNativePlaybackHeartbeat();
      this.nativeOverloadTracker.reset();
      this.lastNativeDroppedFrames = 0;
      this.overlay.setStats(null);
      try {
        await this.native.stop(
          nativeSessionId ? { sessionId: nativeSessionId, videoId: this.videoId } : { videoId: this.videoId },
        );
        if (!this.isTransitionCurrent(revision)) return;

        if (selectedBackend !== 'webgpu') {
          throw new Error('WebGPU is unavailable. Select Auto or Native instead.');
        }

        const claim = await this.native.claim(this.videoId);
        if (!this.isTransitionCurrent(revision)) return;
        if (!claim.ok) throw new Error(claim.message || 'Anime4K could not reclaim the active video.');
        if (!await this.initRenderer(newSettings, revision)) return;
        if (!this.isTransitionCurrent(revision)) return;
        if (VideoEnhancer.activeEnhancer && VideoEnhancer.activeEnhancer !== this) {
          await VideoEnhancer.activeEnhancer.stopEnhancement({ releaseClaim: false });
          if (!this.isTransitionCurrent(revision)) return;
        }
        VideoEnhancer.activeEnhancer = this;
        this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
        return;
      } catch (error) {
        if (!this.isTransitionCurrent(revision)) return;
        await this.stopEnhancement({ stopNative: this.backend.isNativeActive });
        if (!this.destroyed) {
          showEnhancementNotification(error instanceof Error ? error.message : 'The backend could not be changed.');
        }
        throw error;
      } finally {
        if (this.switchingFromNativeRevision === revision) this.switchingFromNativeRevision = null;
        this.switchingFromNativeSessionId = null;
      }
    }
    if (!this.renderer) return;
    if (selectedBackend === 'native') {
      await this.switchToNative('native-selected', newSettings, {
        fallbackErrorMessage: 'The native renderer could not be started.',
        throwOnFailure: true,
      });
      return;
    }

    const targetDimensions = calculateAutoTargetDimensions(this.video);
    const renderer = this.renderer;
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(newSettings.mode, newSettings.quality, newSettings.realesrganCapHeight, newSettings.realesrganPrecision),
        targetDimensions,
        frameGenerationEnabled: newSettings.frameGenerationEnabled,
      });
    } catch (error) {
      this.currentSettings = previousSettings;
      this.currentModeId = previousModeId;
      this.applyFullscreenMarker(
        previousSettings !== null
          && isProcessingEnabled(previousSettings.mode, previousSettings.frameGenerationEnabled),
      );
      if (this.renderer === renderer && renderer.isDestroyed()) await this.stopEnhancement({ stopNative: false });
      throw error;
    }
  }

  public getCurrentModeId(): string | null {
    return this.currentModeId;
  }

  /** Whether a backend is currently committed for this video. */
  public isActive(): boolean {
    return this.renderer !== null || this.backend.isNativeActive;
  }

  public getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  public detach(): void {
    this.overlay.detach();
    this.targetResizeObserver.disconnect();
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    if (this.targetUpdateTimer) {
      window.clearTimeout(this.targetUpdateTimer);
      this.targetUpdateTimer = undefined;
    }
    if (this.fullscreenDebounceTimer) {
      window.clearTimeout(this.fullscreenDebounceTimer);
      this.fullscreenDebounceTimer = undefined;
    }
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  public async reattach(newVideo: HTMLVideoElement): Promise<void> {
    if (this.destroyed) return;
    // Drop pending debounce work tied to the old node: a queued auto-target
    // refresh or fullscreen reconcile could otherwise fire mid-swap against
    // half-updated state. Both are rescheduled below as needed.
    if (this.targetUpdateTimer) {
      window.clearTimeout(this.targetUpdateTimer);
      this.targetUpdateTimer = undefined;
    }
    if (this.fullscreenDebounceTimer) {
      window.clearTimeout(this.fullscreenDebounceTimer);
      this.fullscreenDebounceTimer = undefined;
    }
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.videoEvents.dispose();
    this.videoEvents = new EventScope();
    this.video = newVideo;
    this.observeVideoEvents(this.video);
    this.fullscreenLayout.updateVideo(newVideo);
    this.video.dataset.anime4kVideoId = this.videoId;
    this.video.addEventListener('encrypted', this.encryptedHandler);
    this.applyFullscreenMarker(
      this.currentSettings !== null
        && isProcessingEnabled(this.currentSettings.mode, this.currentSettings.frameGenerationEnabled),
    );
    this.targetResizeObserver.disconnect();
    this.targetResizeObserver.observe(this.video);
    this.overlay.reattach(newVideo);
    window.dispatchEvent(new CustomEvent('anime4k-video-reattached', {
      detail: { videoId: this.videoId, video: newVideo },
    }));
    const renderer = this.renderer;
    if (renderer) {
      try {
        await renderer.updateVideoSource(newVideo);
      } catch (error) {
        if (this.destroyed || this.renderer !== renderer) return;
        await this.handleRendererError(
          error instanceof Error ? error : new Error('The replacement video frame could not be processed.'),
        );
      }
    }
    if (this.destroyed) return;
    if (this.renderer || this.backend.isNativeActive) this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
    this.scheduleFullscreenReconcile(0);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.lifecycle.invalidate();
    // Stop the backend BEFORE backend.destroy() flips the phase to idle:
    // stopEnhancement snapshots native ownership from the backend phase, and
    // a destroyed machine reads as idle — the native host would keep
    // capturing a dead player's region with no owner left to stop it.
    void this.stopEnhancement().catch(error => {
      console.warn('[Anime4K] Failed to finish enhancement cleanup:', error);
    });
    this.backend.destroy();
    VideoEnhancer.managedEnhancers.delete(this);
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.targetResizeObserver.disconnect();
    this.events?.dispose();
    this.videoEvents.dispose();
    this.unsubscribeFullscreenContext();
    if (this.targetUpdateTimer) window.clearTimeout(this.targetUpdateTimer);
    if (this.fullscreenDebounceTimer) window.clearTimeout(this.fullscreenDebounceTimer);
    this.targetUpdateTimer = undefined;
    this.fullscreenDebounceTimer = undefined;
    this.stopNativePlaybackHeartbeat();
    this.overlay.destroy();
    this.fullscreenLayout.exit();
    if (this.video.dataset.anime4kVideoId === this.videoId) delete this.video.dataset.anime4kVideoId;
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  public async stopEnhancement(options: { stopNative?: boolean; releaseClaim?: boolean } = {}): Promise<void> {
    const { stopNative = true, releaseClaim = true } = options;
    // Snapshot native ownership BEFORE beginTransition() flips the phase to
    // 'starting' — reading it afterwards made this guard permanently false,
    // so an active native session was only ever stopped while a fallback
    // request was still in flight.
    const wasNativeActive = this.backend.isNativeActive;
    const nativeSessionId = this.nativeSessionId;
    this.beginTransition();
    // Invalidate any debounced fullscreen reconcile: without this a pending
    // timer could restart enhancement right after this explicit stop.
    this.fullscreenRevision += 1;
    if (this.fullscreenDebounceTimer) {
      window.clearTimeout(this.fullscreenDebounceTimer);
      this.fullscreenDebounceTimer = undefined;
    }
    this.releaseWebGPUResources();
    this.backend.markIdle();
    this.nativeSessionId = null;
    this.switchingFromNativeRevision = null;
    this.switchingFromNativeSessionId = null;
    this.stopNativePlaybackHeartbeat();
    this.overlay.hideCanvas();
    this.fullscreenLayout.exit();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.currentModeId = null;
    this.performanceWarning = false;
    this.nativeOverloadTracker.reset();
    this.lastNativeDroppedFrames = 0;
    this.automaticSession = false;
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
    if (releaseClaim) {
      void this.native.release(this.videoId);
    }

    if ((stopNative && wasNativeActive) || this.native.hasPendingFallback(this.videoId)) {
      try {
        await this.native.stop(
          nativeSessionId ? { sessionId: nativeSessionId, videoId: this.videoId } : { videoId: this.videoId },
        );
      } catch (error) {
        console.warn('[Anime4K] Failed to stop native renderer:', error);
      }
    }
  }

  private releaseWebGPUResources(): void {
    const renderer = this.renderer;
    this.renderer = null;
    this.autoCap = null;
    renderer?.destroy();
  }

  private applyFullscreenMarker(enabled: boolean): void {
    if (enabled && !this.destroyed) this.video.setAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR, 'true');
    else this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  private scheduleFullscreenReconcile(delay = 90): void {
    if (this.destroyed) return;
    const revision = ++this.fullscreenRevision;
    if (this.fullscreenDebounceTimer) window.clearTimeout(this.fullscreenDebounceTimer);
    this.fullscreenDebounceTimer = window.setTimeout(() => {
      this.fullscreenDebounceTimer = undefined;
        void this.lifecycle.enqueue(() => this.reconcileFullscreen(revision));
    }, delay);
  }

  private async reconcileFullscreen(revision: number): Promise<void> {
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    // A detached video (stashed across a node swap) must neither start nor
    // stop here: the election below already excludes disconnected videos, so
    // without this guard every timeupdate/scroll during the stash TTL would
    // take the stop branch and tear down the backend the stash preserves.
    // reattach() reschedules a reconcile once the new node is connected.
    if (!this.video.isConnected) return;
    let settings: Anime4KWebExtSettings;
    try {
      settings = this.currentSettings ?? await getSettings();
    } catch (error) {
      console.info('[Anime4K] Could not load settings for fullscreen reconcile:', error instanceof Error ? error.message : String(error));
      return;
    }
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    this.currentSettings = settings;
    const processingEnabled = isProcessingEnabled(settings.mode, settings.frameGenerationEnabled);
    this.applyFullscreenMarker(processingEnabled);
    const preferredFullscreenVideo = this.isPreferredFullscreenVideo();
    const explicitContext = fullscreenContext.hasContext(this.video);
    const playerFullscreenSignal = hasPlayerFullscreenSignal(this.video);
    if (!explicitContext && !playerFullscreenSignal) this.nativeRetryBlocked = false;
    const shouldRun = processingEnabled
      && preferredFullscreenVideo
      && (explicitContext || playerFullscreenSignal)
      && !this.nativeRetryBlocked;

    if (shouldRun) {
      // Refresh the layout on every reconcile so a fullscreen element change
      // re-targets a running session (enter() is a no-op when unchanged).
      if (this.renderer || this.backend.isNativeActive) this.fullscreenLayout.enter();
      // A cancellation-marked fallback is still settling but must not block a
      // fresh start the way a live request does (see hasActiveFallback).
      // autoFullscreenEnabled=false keeps manual (popup-started) sessions
      // working but stops the reconcile from auto-starting new ones.
      if (settings.autoFullscreenEnabled
          && !this.renderer && !this.backend.isNativeActive && !this.backend.isStarting
          && !this.native.hasActiveFallback(this.videoId)) {
        this.fullscreenLayout.enter();
        this.automaticSession = true;
        await this.startEnhancement(settings);
        if (!this.renderer && !this.backend.isNativeActive) {
          this.automaticSession = false;
          this.fullscreenLayout.exit();
        }
      }
      return;
    }

    if (this.automaticSession || this.renderer || this.backend.isNativeActive
        || this.backend.isStarting || this.native.hasPendingFallback(this.videoId)) {
      this.automaticSession = false;
      await this.stopEnhancement();
    }
  }

  private isPreferredFullscreenVideo(): boolean {
    // The fullscreen context owns the election: every managed, undestroyed
    // enhancer's video competes; larger rendered area wins, ties break by
    // the lower video id. Detached (stashed) videos are excluded: their
    // removed nodes would otherwise keep voting with stale geometry.
    const candidates = [...VideoEnhancer.managedEnhancers]
      .filter(enhancer => !enhancer.destroyed && enhancer.video.isConnected)
      .map(enhancer => ({ video: enhancer.video, videoId: enhancer.videoId }));
    return electFullscreenCandidate(candidates)?.video === this.video;
  }

  private startNativePlaybackHeartbeat(): void {
    this.stopNativePlaybackHeartbeat();
    if (!this.backend.isNativeActive || this.destroyed) return;
    void this.sendNativePlaybackState();
    this.nativePlaybackTimer = window.setInterval(() => void this.sendNativePlaybackState(), 1000);
  }

  private stopNativePlaybackHeartbeat(): void {
    if (this.nativePlaybackTimer !== undefined) {
      window.clearInterval(this.nativePlaybackTimer);
      this.nativePlaybackTimer = undefined;
    }
  }

  private async sendNativePlaybackState(): Promise<void> {
    if (!this.backend.isNativeActive || this.destroyed) return;
    if (this.nativeSessionId === null) return;
    await this.native.sendPlaybackState({
      sessionId: this.nativeSessionId,
      videoId: this.videoId,
      playbackActive: !this.video.paused && !this.video.ended,
      mediaTime: Number.isFinite(this.video.currentTime) ? Math.max(0, this.video.currentTime) : 0,
    });
  }

}

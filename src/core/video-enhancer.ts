import {
  ANIME4K_APPLIED_ATTR,
  ANIME4K_FULLSCREEN_AUTO_ATTR,
  ANIME4K_PROTECTED_PLAYBACK_ATTR,
} from '../constants';
import type {
  Anime4KWebExtSettings,
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
import { fullscreenContext } from './fullscreen-context';
import type { NativeFallbackReason } from '../shared/native-fallback-request';
import {
  createNativeSessionClient,
  type NativeFallbackOutcome,
  type NativeSessionClient,
} from './native-session-client';
import { getEffectsForPreset, getSettings } from '../utils/settings';
import { OverlayManager } from './overlay-manager';
import { FullscreenLayoutManager } from './fullscreen-layout-manager';
import { BackendState } from './backend-state';
import { EnhancerLifecycle } from './enhancer-lifecycle';
import { NativeSwitchLedger } from './native-switch';
import { EventScope } from '../shared/event-scope';
import type { Renderer } from './renderer';
import { showEnhancementNotification } from './video-enhancer-view';
import { EnhancerStatsConsumer } from './enhancer-stats-consumer';
import {
  FullscreenReconciler,
  FULLSCREEN_RECONCILE_IMMEDIATE_MS,
} from './enhancer-fullscreen-reconciler';
import { NativeSessionObserver } from './enhancer-native-observer';

export class VideoEnhancer {
  private static activeEnhancer: VideoEnhancer | null = null;

  private renderer: Renderer | null = null;
  private video!: HTMLVideoElement;
  private readonly backend = new BackendState();
  private currentModeId: string | null = null;
  private currentSettings: Anime4KWebExtSettings | null = null;
  private readonly overlay: OverlayManager;
  private readonly fullscreenLayout: FullscreenLayoutManager;
  private readonly videoId: string;
  private encryptedDetected = false;
  private destroyed = false;
  private lastEncryptedHandlingAt = 0;
  private readonly targetResizeObserver: ResizeObserver;
  /**
   * First-frame watchdog: a renderer that never presents (transient device
   * loss at first start, observed flaky in Zen E2E) leaves applied set with
   * no canvas and no error. One restart heals it (proven by manual retry);
   * the flag bounds it to a single restart per enhancer life.
   */
  private firstFrameWatchdogTimer?: number;
  private firstFrameWatchdogFired = false;
  /** The one serialized lifecycle: settings and fullscreen reconcile never interleave. */
  private readonly lifecycle = new EnhancerLifecycle();
  /** Intentional native→webgpu switch: the abandoned session ledger. */
  private readonly nativeSwitch = new NativeSwitchLedger();
  private readonly events = new EventScope();
  private videoEvents = new EventScope();
  /** Native session id + 1 Hz playback heartbeat + overload metrics. */
  private readonly nativeObserver: NativeSessionObserver;
  /** Stats fan-out (overlay + Auto-Cap) and ephemeral inference-cap ladder. */
  private readonly statsConsumer: EnhancerStatsConsumer;
  /** Debounced fullscreen reconciliation and the auto-fullscreen marker. */
  private readonly reconciler: FullscreenReconciler;

  private readonly targetChangeHandler = () => {
    this.statsConsumer.scheduleTargetUpdate();
    this.reconciler.schedule();
  };
  private readonly videoFrameHandler = () => {
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
  };
  private readonly fullscreenChangeHandler = () => {
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
  };
  private readonly mediaActivityHandler = () => {
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
  };
  private readonly windowScrollHandler = () => {
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
  };
  private readonly unsubscribeFullscreenContext: () => void;

  private readonly bfcacheRestoreHandler = (event: Event) => {
    // The native host session cannot survive a back/forward cache freeze: the
    // stop event was dropped together with the frozen document, leaving a
    // native-active enhancer wired to a session that no longer exists.
    if (!(event as PageTransitionEvent).persisted || !this.backend.isNativeActive) return;
    void this.stopEnhancement().then(
      () => this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS),
      () => undefined,
    );
  };

  private readonly nativeSessionHandler = (event: Event) => {
    this.nativeObserver.handleEvent(event);
  };

  /**
   * Terminal native-session teardown callback for the observer: the enhancer
   * still owns renderer/layout/active-slot state, so the observer reports the
   * event and this runs the shared reset in order.
   */
  private handleNativeSessionEnded(ended: { message: string | null; retryCaptureAfterFailedExit: boolean }): void {
    this.resetEnhancementState();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.fullscreenLayout.exit();
    this.releaseActiveEnhancer();
    void this.native.release(this.videoId);
    if (ended.message !== null) showEnhancementNotification(ended.message);
  }

  private readonly encryptedHandler = () => {
    this.encryptedDetected = true;
    void this.handleEncryptedPlayback();
  };

  private readonly pageProtectedPlaybackHandler = () => {
    if (this.encryptedDetected) return;
    this.encryptedDetected = true;
    void this.handleEncryptedPlayback();
  };

  private constructor(video: HTMLVideoElement, private readonly native: NativeSessionClient) {
    this.video = video;
    this.videoId = crypto.randomUUID?.() ?? `anime4k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.video.dataset.anime4kVideoId = this.videoId;
    this.video.addEventListener('encrypted', this.encryptedHandler);
    this.events.on(window, 'anime4k-protected-playback', this.pageProtectedPlaybackHandler);
    if (document.documentElement?.hasAttribute(ANIME4K_PROTECTED_PLAYBACK_ATTR)) {
      this.encryptedDetected = true;
    }
    this.overlay = OverlayManager.create(this.video);
    this.fullscreenLayout = new FullscreenLayoutManager(this.video);
    // Stats fan-out: overlay forwarding and auto-cap ride the tap, so the
    // next consumer subscribes instead of touching the producer.
    this.statsConsumer = new EnhancerStatsConsumer({
      isDestroyed: () => this.destroyed,
      getSettings: () => this.currentSettings,
      getRenderer: () => this.renderer,
      isWebGPUActive: () => this.backend.isWebGPUActive,
      getVideo: () => this.video,
      getCanvas: () => this.overlay.getCanvas(),
      setOverlayStats: stats => this.overlay.setStats(stats),
      enqueue: operation => this.lifecycle.enqueue(operation),
      onRendererError: error => this.handleRendererError(error),
    });
    this.reconciler = new FullscreenReconciler({
      isDestroyed: () => this.destroyed,
      getVideo: () => this.video,
      getSettings: () => this.currentSettings,
      setSettings: settings => { this.currentSettings = settings; },
      loadSettings: () => getSettings(),
      hasRenderer: () => this.renderer !== null,
      isNativeActive: () => this.backend.isNativeActive,
      isStarting: () => this.backend.isStarting,
      hasActiveFallback: () => this.native.hasActiveFallback(this.videoId),
      hasPendingFallback: () => this.native.hasPendingFallback(this.videoId),
      enterLayout: () => this.fullscreenLayout.enter(),
      exitLayout: () => this.fullscreenLayout.exit(),
      start: settings => this.startEnhancement(settings),
      stop: () => this.stopEnhancement(),
      beginReconcile: () => this.lifecycle.beginReconcile(),
      isReconcileCurrent: token => this.lifecycle.isReconcileCurrent(token),
      enqueue: operation => this.lifecycle.enqueue(operation),
    });
    this.nativeObserver = new NativeSessionObserver({
      isDestroyed: () => this.destroyed,
      isNativeActive: () => this.backend.isNativeActive,
      getVideo: () => this.video,
      getVideoId: () => this.videoId,
      isAbandonedSwitchCurrent: () => this.nativeSwitch.isCurrent(revision => this.lifecycle.isCurrent(revision)),
      abandonsSwitch: sessionId => this.nativeSwitch.abandons(sessionId),
      recordStats: stats => this.handleStats(stats),
      markIdle: () => this.backend.markIdle(),
      blockAutoRetry: () => this.reconciler.blockAutoRetry(),
      scheduleFullscreenReconcile: delay => this.reconciler.schedule(delay),
      onSessionTerminated: ended => this.handleNativeSessionEnded(ended),
    }, native);
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
      this.reconciler.applyMarker(settings);
      this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
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

  /**
   * Stop a competing active enhancer so this one can take the single active
   * slot, then confirm this transition still owns the lifecycle. The caller
   * commits with commitActiveSlot() once its backend is live.
   */
  private async claimActiveSlot(revision: number): Promise<boolean> {
    if (VideoEnhancer.activeEnhancer && VideoEnhancer.activeEnhancer !== this) {
      await VideoEnhancer.activeEnhancer.stopEnhancement({ releaseClaim: false });
      if (!this.isTransitionCurrent(revision)) return false;
    }
    return true;
  }

  /** Commit this enhancer as the single active owner of the slot. */
  private commitActiveSlot(): void {
    VideoEnhancer.activeEnhancer = this;
    this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
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
        this.reconciler.applyMarker(null);
        this.backend.markIdle();
        return;
      }
      const selectedBackend = this.selectBackend(settings);
      assertBackendCompatibility(selectedBackend);
      this.currentSettings = settings;
      const claim = await this.native.claim(this.videoId);
      if (!this.isTransitionCurrent(revision)) return;
      if (!claim.ok) throw new Error(claim.message || 'Another Anime4K instance could not be stopped.');
      if (!await this.claimActiveSlot(revision)) return;

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
      this.commitActiveSlot();
      this.armFirstFrameWatchdog();
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
    const effects = getEffectsForPreset(settings.mode, settings.quality, settings.realesrganCapHeight);
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
    this.nativeObserver.beginSession(response.sessionId);
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
    if (!await this.claimActiveSlot(revision)) return false;
    this.commitActiveSlot();
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

  private handleStats(stats: RenderStats): void {
    this.statsConsumer.handleStats(stats);
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
    return this.statsConsumer.effectiveAutoCap;
  }

  /**
   * Test-only: latest stats window for E2E timing gates. No-op in
   * production builds. Returns the RealESRGAN slice or null.
   */
  public e2eLastStats(): RenderStats['realesrgan'] {
    if (typeof __ANIME4K_E2E__ === 'undefined' || !__ANIME4K_E2E__) return undefined;
    return this.statsConsumer.lastRenderedStats?.realesrgan;
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
    this.statsConsumer.applySettings(newSettings);
    this.reconciler.applyMarker(newSettings);

    if (!processingEnabled) {
      await this.applyDisabledSettings();
      return;
    }
    if (!this.renderer && !this.backend.isNativeActive) {
      await this.startWhenIdle();
      return;
    }
    if (this.backend.isNativeActive) {
      if (selectedBackend === 'native') {
        await this.updateActiveNativeConfiguration(newSettings, previousSettings, previousModeId);
        return;
      }
      await this.switchActiveNativeToWebGPU(newSettings, selectedBackend);
      return;
    }
    if (!this.renderer) return;
    if (selectedBackend === 'native') {
      await this.switchActiveWebGPUToNative(newSettings);
      return;
    }
    await this.reconfigureActiveRenderer(newSettings, previousSettings, previousModeId);
  }

  private async applyDisabledSettings(): Promise<void> {
    this.reconciler.resetAutomaticSession();
    if (this.renderer || this.backend.isNativeActive || this.backend.isStarting
        || this.native.hasPendingFallback(this.videoId)) await this.stopEnhancement();
    else {
      this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
      this.fullscreenLayout.exit();
    }
  }

  private async startWhenIdle(): Promise<void> {
    if (this.backend.isStarting || this.native.hasPendingFallback(this.videoId)) {
      await this.stopEnhancement();
      if (this.destroyed) return;
    }
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
  }

  private async updateActiveNativeConfiguration(newSettings: Anime4KWebExtSettings, previousSettings: Anime4KWebExtSettings | null, previousModeId: string | null): Promise<void> {
    const revision = this.beginTransition();
    try {
      const response = await this.native.updateConfiguration({
        ...(this.nativeObserver.currentSessionId ? { sessionId: this.nativeObserver.currentSessionId } : {}),
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
      // event then already cleaned the session up (native session id
      // cleared). Re-committing it would leave a zombie native-active
      // enhancer whose session no longer exists.
      if (this.nativeObserver.currentSessionId === null) {
        throw new Error('The native renderer stopped during the configuration update.');
      }
      this.backend.markNativeActive();
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return;
      // Only re-commit the previous configuration when the session
      // survived the update; a session that ended mid-update stays idle
      // so fullscreen reconciliation can restart enhancement.
      if (this.nativeObserver.currentSessionId !== null) this.backend.markNativeActive();
      this.restoreSettings(previousSettings, previousModeId);
      throw error;
    }
  }

  private async switchActiveNativeToWebGPU(newSettings: Anime4KWebExtSettings, selectedBackend: SelectedBackend): Promise<void> {
    const revision = this.beginTransition();
    const nativeSessionId = this.nativeObserver.currentSessionId;
    this.nativeSwitch.arm(revision, nativeSessionId);
    this.nativeObserver.reset();
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
      if (!await this.claimActiveSlot(revision)) return;
      this.commitActiveSlot();
      return;
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return;
      await this.stopEnhancement({ stopNative: this.backend.isNativeActive });
      if (!this.destroyed) {
        showEnhancementNotification(error instanceof Error ? error.message : 'The backend could not be changed.');
      }
      throw error;
    } finally {
      this.nativeSwitch.clear(revision);
    }
  }

  private async switchActiveWebGPUToNative(newSettings: Anime4KWebExtSettings): Promise<void> {
    await this.switchToNative('native-selected', newSettings, {
      fallbackErrorMessage: 'The native renderer could not be started.',
      throwOnFailure: true,
    });
  }

  private async reconfigureActiveRenderer(newSettings: Anime4KWebExtSettings, previousSettings: Anime4KWebExtSettings | null, previousModeId: string | null): Promise<void> {
    const targetDimensions = calculateAutoTargetDimensions(this.video);
    const renderer = this.renderer;
    if (!renderer) return;
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(newSettings.mode, newSettings.quality, newSettings.realesrganCapHeight),
        targetDimensions,
        frameGenerationEnabled: newSettings.frameGenerationEnabled,
      });
    } catch (error) {
      this.restoreSettings(previousSettings, previousModeId);
      if (this.renderer === renderer && renderer.isDestroyed()) await this.stopEnhancement({ stopNative: false });
      throw error;
    }
  }

  private restoreSettings(previousSettings: Anime4KWebExtSettings | null, previousModeId: string | null): void {
    this.currentSettings = previousSettings;
    this.currentModeId = previousModeId;
    this.reconciler.applyMarker(previousSettings);
  }

  /** Whether a backend is currently committed for this video. */
  public isActive(): boolean {
    return this.backend.isActive;
  }

  public getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  public getVideoId(): string {
    return this.videoId;
  }

  /** Whether destroy() already ran; population/election exclude these. */
  public get isDestroyed(): boolean {
    return this.destroyed;
  }

  public detach(): void {
    this.overlay.detach();
    this.targetResizeObserver.disconnect();
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.statsConsumer.clearTargetUpdate();
    this.reconciler.clearDebounce();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  public async reattach(newVideo: HTMLVideoElement): Promise<void> {
    if (this.destroyed) return;
    // Drop pending debounce work tied to the old node: a queued auto-target
    // refresh or fullscreen reconcile could otherwise fire mid-swap against
    // half-updated state. Both are rescheduled below as needed.
    this.statsConsumer.clearTargetUpdate();
    this.reconciler.clearDebounce();
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.videoEvents.dispose();
    this.videoEvents = new EventScope();
    this.video = newVideo;
    this.observeVideoEvents(this.video);
    this.fullscreenLayout.updateVideo(newVideo);
    this.video.dataset.anime4kVideoId = this.videoId;
    this.video.addEventListener('encrypted', this.encryptedHandler);
    this.reconciler.applyMarker(this.currentSettings);
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
    this.reconciler.schedule(FULLSCREEN_RECONCILE_IMMEDIATE_MS);
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
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.targetResizeObserver.disconnect();
    this.events?.dispose();
    this.videoEvents.dispose();
    this.unsubscribeFullscreenContext();
    this.statsConsumer.clearTargetUpdate();
    this.reconciler.clearDebounce();
    this.nativeObserver.clearSession();
    this.overlay.destroy();
    this.fullscreenLayout.exit();
    if (this.video.dataset.anime4kVideoId === this.videoId) delete this.video.dataset.anime4kVideoId;
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  /**
   * Arms the first-frame watchdog after a successful start: if no frame was
   * presented within 8 s (applied set, WebGPU renderer alive, canvas still
   * hidden, native not active), the first start hit a silent stall and one
   * restart is attempted. Healthy starts present in well under a second, so
   * the timeout never fires for them; the fired flag bounds it to one retry.
   */
  private armFirstFrameWatchdog(): void {
    if (this.firstFrameWatchdogFired || this.destroyed) return;
    this.disarmFirstFrameWatchdog();
    this.firstFrameWatchdogTimer = window.setTimeout(() => {
      this.firstFrameWatchdogTimer = undefined;
      if (this.destroyed || this.firstFrameWatchdogFired) return;
      if (this.backend.isNativeActive) return;
      if (!this.renderer) return;
      if (this.video.getAttribute(ANIME4K_APPLIED_ATTR) !== 'true') return;
      if (this.overlay.isCanvasVisible) return;
      this.firstFrameWatchdogFired = true;
      console.warn('[Anime4K] First frame never presented; restarting enhancement once.');
      void this.stopEnhancement()
        .then(() => { if (!this.destroyed) return this.startEnhancement(); })
        .catch(error => {
          console.warn('[Anime4K] First-frame watchdog restart failed:', error);
        });
    }, 8000);
  }

  private disarmFirstFrameWatchdog(): void {
    if (this.firstFrameWatchdogTimer !== undefined) {
      window.clearTimeout(this.firstFrameWatchdogTimer);
      this.firstFrameWatchdogTimer = undefined;
    }
  }

  public async stopEnhancement(options: { stopNative?: boolean; releaseClaim?: boolean } = {}): Promise<void> {
    const { stopNative = true, releaseClaim = true } = options;
    this.disarmFirstFrameWatchdog();
    // Snapshot native ownership BEFORE beginTransition() flips the phase to
    // 'starting' — reading it afterwards made this guard permanently false,
    // so an active native session was only ever stopped while a fallback
    // request was still in flight.
    const wasNativeActive = this.backend.isNativeActive;
    const nativeSessionId = this.nativeObserver.currentSessionId;
    this.beginTransition();
    // Invalidate any debounced fullscreen reconcile: without this a pending
    // timer could restart enhancement right after this explicit stop.
    this.lifecycle.invalidateReconcile();
    this.reconciler.clearDebounce();
    this.releaseWebGPUResources();
    this.resetEnhancementState();
    this.nativeSwitch.clear();
    this.overlay.hideCanvas();
    this.fullscreenLayout.exit();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.releaseActiveEnhancer();
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
    this.statsConsumer.releaseResources();
    renderer?.destroy();
  }

  /** Field resets common to every full native-session teardown. */
  private resetEnhancementState(): void {
    this.backend.markIdle();
    this.nativeObserver.reset();
    this.currentModeId = null;
    this.overlay.setStats(null);
    this.reconciler.resetAutomaticSession();
  }

  private releaseActiveEnhancer(): void {
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
  }

}

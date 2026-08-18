import {
  ANIME4K_APPLIED_ATTR,
  ANIME4K_FULLSCREEN_AUTO_ATTR,
  ANIME4K_PROTECTED_PLAYBACK_ATTR,
} from '../constants';
import type {
  Anime4KWebExtSettings,
  Dimensions,
  RenderStats,
} from '../types';
import {
  calculateAutoTargetDimensions,
  isDoubleMode,
  isProcessingEnabled,
  MODE_TO_ID,
} from '../shared/presets';
import {
  allowsNativeFallback,
  hasProtectedPlaybackSignal,
  selectInitialBackend,
} from '../shared/backend-selection';
import type { SelectedBackend } from '../shared/backend-selection';
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
import {
  isVideoInFullscreenContext,
  videoFillsOwnViewport,
} from '../shared/fullscreen-video';
import { OverlayManager } from './overlay-manager';
import { FullscreenLayoutManager } from './fullscreen-layout-manager';
import { BackendState } from './backend-state';
import { OverloadTracker } from './render-stats';
import type { Renderer } from './renderer';

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
  private oversharpenWarning = false;
  private lastNativeDroppedFrames = 0;
  private readonly nativeOverloadTracker = new OverloadTracker();
  private lastRenderStats: RenderStats | null = null;
  private destroyed = false;
  private switchingFromNativeRevision: number | null = null;
  private readonly targetResizeObserver: ResizeObserver;
  private targetUpdateTimer?: number;
  private nativePlaybackTimer?: number;
  private fullscreenDebounceTimer?: number;
  private fullscreenRevision = 0;
  /** The one serialized transition chain: settings applies and fullscreen reconciles never interleave. */
  private transitionChain: Promise<void> = Promise.resolve();
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
    // cleanup never runs. Expected-stop paths null the session id first, so
    // their events no longer match.
    if (!matchesExpectedNativeEvent(this.nativeSessionId, detail.sessionId)) return;
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
      this.lastRenderStats = stats;
      if (this.currentSettings?.statsEnabled) this.overlay.setStats(stats);
      else this.overlay.setStats(null);
      this.updateWarningDisplay();
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
      && this.backend.isTransitionCurrent(this.switchingFromNativeRevision)) {
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
    this.lastRenderStats = null;
    this.overlay.setStats(null);
    this.updateWarningDisplay();
    this.automaticSession = false;
    this.fullscreenLayout.exit();
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
    void this.native.release(this.videoId);
    if ((detail.type === 'error' || state === 'failed') && typeof detail.message === 'string') {
      this.showNotification(detail.message);
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
    window.addEventListener('anime4k-protected-playback', this.pageProtectedPlaybackHandler);
    if (document.documentElement?.hasAttribute(ANIME4K_PROTECTED_PLAYBACK_ATTR)) {
      this.encryptedDetected = true;
    }
    this.overlay = OverlayManager.create(this.video);
    this.fullscreenLayout = new FullscreenLayoutManager(this.video);
    this.targetResizeObserver = new ResizeObserver(this.targetChangeHandler);
    this.targetResizeObserver.observe(this.video);
    window.addEventListener('resize', this.targetChangeHandler);
    window.addEventListener('scroll', this.windowScrollHandler, true);
    this.unsubscribeFullscreenContext = fullscreenContext.subscribe(this.fullscreenChangeHandler);
    this.video.addEventListener('loadedmetadata', this.mediaActivityHandler);
    this.video.addEventListener('playing', this.mediaActivityHandler);
    this.video.addEventListener('resize', this.mediaActivityHandler);
    this.video.addEventListener('timeupdate', this.videoFrameHandler);
    window.addEventListener('anime4k-native-session', this.nativeSessionHandler);
    window.addEventListener('pageshow', this.bfcacheRestoreHandler);
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
    return this.backend.beginTransition();
  }

  private isTransitionCurrent(revision: number): boolean {
    return this.backend.isTransitionCurrent(revision);
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
      this.assertBackendCompatibility(selectedBackend);
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
        this.showNotification(error instanceof Error ? error.message : 'Anime4K could not be started.');
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
    const effects = getEffectsForPreset(settings.mode, settings.quality);
    this.currentModeId = MODE_TO_ID[settings.mode];
    this.updateOversharpenWarning(settings, rendererTargetDimensions);

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
          this.updateOversharpenWarning(settings, nextTarget);
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
      const reason = this.classifyFallbackReason(error);
      return this.requestNativeFallback(reason, settings, revision);
    }
  }

  private classifyFallbackReason(error: unknown): NativeFallbackReason {
    let current: unknown = error;
    while (current instanceof Error) {
      if (current.name === 'SecurityError' || /cross-origin|tainted|protected content/i.test(current.message)) {
        return 'security-error';
      }
      if (/WebGPU|adapter|kernel is unavailable/i.test(current.message)) return 'webgpu-unavailable';
      current = (current as Error & { cause?: unknown }).cause;
    }
    return 'video-frame-import-failed';
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
  ): Promise<boolean> {
    const revision = this.beginTransition();
    this.releaseWebGPUResources();
    this.overlay.hideCanvas();
    if (!allowsNativeFallback(settings.backend)) {
      await this.stopEnhancement({ stopNative: false });
      const blockedMessage = options.blockedMessage
        ?? 'The native fallback is disabled while Backend is forced to WebGPU.';
      if (!this.destroyed) this.showNotification(blockedMessage);
      if (options.throwOnFailure) throw new Error(blockedMessage);
      return false;
    }
    try {
      if (!await this.requestNativeFallback(reason, settings, revision)) return false;
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return false;
      await this.stopEnhancement({ stopNative: false });
      if (!this.destroyed) {
        this.showNotification(error instanceof Error ? error.message : options.fallbackErrorMessage);
      }
      if (options.throwOnFailure) throw error;
      return false;
    }
    if (!this.isTransitionCurrent(revision)) return false;
    VideoEnhancer.activeEnhancer = this;
    this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
    return true;
  }

  private async handleEncryptedPlayback(): Promise<void> {
    if (this.destroyed || (!this.renderer && !this.backend.isNativeActive)) return;
    if (this.backend.isNativeActive) return;
    const revision = this.beginTransition();
    const settings = this.currentSettings ?? await getSettings();
    if (!this.isTransitionCurrent(revision)) return;
    await this.switchToNative('eme', settings, {
      blockedMessage: 'Protected playback cannot use the forced WebGPU backend. Select Auto or Native instead.',
      fallbackErrorMessage: 'Protected playback cannot be captured.',
    });
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
    const reason = this.classifyFallbackReason(error);
    await this.switchToNative(reason, settings, {
      blockedMessage: error.message || 'The video frame cannot be processed with WebGPU.',
      fallbackErrorMessage: 'Video frames cannot be processed on this site.',
    });
  }

  private handleStats(stats: RenderStats): void {
    this.lastRenderStats = stats;
    this.performanceWarning = stats.warning;
    if (this.currentSettings?.statsEnabled) this.overlay.setStats(stats);
    else this.overlay.setStats(null);
    this.updateWarningDisplay();
  }

  private updateOversharpenWarning(settings: Anime4KWebExtSettings, target: Dimensions): void {
    const scale = Math.min(
      target.width / Math.max(1, this.video.videoWidth),
      target.height / Math.max(1, this.video.videoHeight),
    );
    this.oversharpenWarning = isDoubleMode(settings.mode) && scale < 2;
    this.updateWarningDisplay();
  }

  private updateWarningDisplay(): void {
    // All in-page warnings removed: the user never asked for diagnostics and
    // they only add a persistent corner nag. The renderer keeps working.
    this.overlay.setWarning(null);
  }

  private scheduleAutoTargetUpdate(): void {
    if (!this.renderer || this.destroyed) return;
    if (this.targetUpdateTimer) window.clearTimeout(this.targetUpdateTimer);
    this.targetUpdateTimer = window.setTimeout(() => void this.refreshAutoTarget(), 150);
  }

  private async refreshAutoTarget(): Promise<void> {
    if (!this.renderer || !this.currentSettings || this.destroyed) return;
    const renderer = this.renderer;
    const settings = this.currentSettings;
    const targetDimensions = calculateAutoTargetDimensions(this.video);
    const canvas = this.overlay.getCanvas();
    if (canvas.width === targetDimensions.width && canvas.height === targetDimensions.height) return;
    this.updateOversharpenWarning(settings, targetDimensions);
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(settings.mode, settings.quality),
        targetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
      });
    } catch (error) {
      if (!this.destroyed && this.renderer === renderer) await this.handleRendererError(error as Error);
    }
  }

  public updateSettings(newSettings: Anime4KWebExtSettings): Promise<void> {
    const result = this.transitionChain.then(
      () => this.applySettings(newSettings),
      () => this.applySettings(newSettings),
    );
    this.transitionChain = result.catch(() => undefined);
    return result;
  }

  private async applySettings(newSettings: Anime4KWebExtSettings): Promise<void> {
    if (this.destroyed) return;
    const processingEnabled = isProcessingEnabled(newSettings.mode, newSettings.frameGenerationEnabled);
    const selectedBackend = this.selectBackend(newSettings);
    if (processingEnabled) this.assertBackendCompatibility(selectedBackend);
    const previousSettings = this.currentSettings;
    const previousModeId = this.currentModeId;
    const previousOversharpenWarning = this.oversharpenWarning;
    this.currentSettings = newSettings;
    this.currentModeId = processingEnabled ? MODE_TO_ID[newSettings.mode] : null;
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
        const revision = this.backend.beginTransition();
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

      const revision = this.backend.beginTransition();
      this.switchingFromNativeRevision = revision;
      const nativeSessionId = this.nativeSessionId;
      this.nativeSessionId = null;
      this.stopNativePlaybackHeartbeat();
      this.nativeOverloadTracker.reset();
      this.lastNativeDroppedFrames = 0;
      this.lastRenderStats = null;
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
        VideoEnhancer.activeEnhancer = this;
        this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
        return;
      } catch (error) {
        if (!this.isTransitionCurrent(revision)) return;
        await this.stopEnhancement({ stopNative: this.backend.isNativeActive });
        if (!this.destroyed) {
          this.showNotification(error instanceof Error ? error.message : 'The backend could not be changed.');
        }
        throw error;
      } finally {
        if (this.switchingFromNativeRevision === revision) this.switchingFromNativeRevision = null;
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
    this.updateOversharpenWarning(newSettings, targetDimensions);
    const renderer = this.renderer;
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(newSettings.mode, newSettings.quality),
        targetDimensions,
        frameGenerationEnabled: newSettings.frameGenerationEnabled,
      });
    } catch (error) {
      this.currentSettings = previousSettings;
      this.currentModeId = previousModeId;
      this.oversharpenWarning = previousOversharpenWarning;
      this.updateWarningDisplay();
      this.applyFullscreenMarker(
        previousSettings !== null
          && isProcessingEnabled(previousSettings.mode, previousSettings.frameGenerationEnabled),
      );
      if (this.renderer === renderer && renderer.isDestroyed()) await this.stopEnhancement({ stopNative: false });
      throw error;
    }
  }

  private assertBackendCompatibility(selectedBackend: SelectedBackend): void {
    if (selectedBackend !== 'unavailable') return;
    throw new Error('WebGPU is unavailable and Backend is forced to WebGPU. Select Auto or Native instead.');
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
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  public async reattach(newVideo: HTMLVideoElement): Promise<void> {
    if (this.destroyed) return;
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    this.video = newVideo;
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
    this.backend.destroy();
    VideoEnhancer.managedEnhancers.delete(this);
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    window.removeEventListener('anime4k-protected-playback', this.pageProtectedPlaybackHandler);
    this.targetResizeObserver.disconnect();
    window.removeEventListener('resize', this.targetChangeHandler);
    window.removeEventListener('scroll', this.windowScrollHandler, true);
    this.unsubscribeFullscreenContext();
    this.video.removeEventListener('loadedmetadata', this.mediaActivityHandler);
    this.video.removeEventListener('playing', this.mediaActivityHandler);
    this.video.removeEventListener('resize', this.mediaActivityHandler);
    this.video.removeEventListener('timeupdate', this.videoFrameHandler);
    window.removeEventListener('anime4k-native-session', this.nativeSessionHandler);
    window.removeEventListener('pageshow', this.bfcacheRestoreHandler);
    if (this.targetUpdateTimer) window.clearTimeout(this.targetUpdateTimer);
    if (this.fullscreenDebounceTimer) window.clearTimeout(this.fullscreenDebounceTimer);
    this.stopNativePlaybackHeartbeat();
    void this.stopEnhancement().catch(error => {
      console.warn('[Anime4K] Failed to finish enhancement cleanup:', error);
    });
    this.overlay.destroy();
    this.fullscreenLayout.exit();
    if (this.video.dataset.anime4kVideoId === this.videoId) delete this.video.dataset.anime4kVideoId;
    this.video.removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
  }

  public async stopEnhancement(options: { stopNative?: boolean; releaseClaim?: boolean } = {}): Promise<void> {
    const { stopNative = true, releaseClaim = true } = options;
    this.beginTransition();
    const wasNativeActive = this.backend.isNativeActive;
    const nativeSessionId = this.nativeSessionId;
    this.releaseWebGPUResources();
    this.backend.markIdle();
    this.nativeSessionId = null;
    this.switchingFromNativeRevision = null;
    this.stopNativePlaybackHeartbeat();
    this.overlay.hideCanvas();
    this.fullscreenLayout.exit();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.currentModeId = null;
    this.performanceWarning = false;
    this.oversharpenWarning = false;
    this.nativeOverloadTracker.reset();
    this.lastNativeDroppedFrames = 0;
    this.lastRenderStats = null;
    this.updateWarningDisplay();
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
      this.transitionChain = this.transitionChain
        .catch(() => undefined)
        .then(() => this.reconcileFullscreen(revision));
    }, delay);
  }

  /**
   * Fullscreen detection is intentionally broader than the native API. Some
   * players use a fixed CSS stage and never set document.fullscreenElement.
   * A visible video that occupies the viewport is still an actual player
   * fullscreen context. This also gives same-page embeds a chance to start
   * after the player has been injected dynamically.
   */
  private hasPlayerFullscreenSignal(): boolean {
    const fullscreen = fullscreenContext.element;
    if (fullscreen && fullscreen.contains && fullscreen.contains(this.video)) return true;
    return videoFillsOwnViewport(this.video);
  }

  private async reconcileFullscreen(revision: number): Promise<void> {
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    const settings = this.currentSettings ?? await getSettings();
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    this.currentSettings = settings;
    const processingEnabled = isProcessingEnabled(settings.mode, settings.frameGenerationEnabled);
    this.applyFullscreenMarker(processingEnabled);
    const preferredFullscreenVideo = this.isPreferredFullscreenVideo();
    const explicitContext = fullscreenContext.hasContext(this.video);
    const playerFullscreenSignal = this.hasPlayerFullscreenSignal();
    if (!explicitContext && !playerFullscreenSignal) this.nativeRetryBlocked = false;
    const shouldRun = processingEnabled
      && preferredFullscreenVideo
      && (explicitContext || playerFullscreenSignal)
      && !this.nativeRetryBlocked;

    if (shouldRun) {
      if (!this.renderer && !this.backend.isNativeActive && !this.backend.isStarting
          && !this.native.hasPendingFallback(this.videoId)) {
        this.fullscreenLayout.enter();
        this.automaticSession = true;
        await this.startEnhancement(settings);
        if (!this.renderer && !this.backend.isNativeActive) this.automaticSession = false;
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
    // the lower video id.
    const candidates = [...VideoEnhancer.managedEnhancers]
      .filter(enhancer => !enhancer.destroyed)
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

  private showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.textContent = `Anime4K: ${message}`;
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '2147483647',
      maxWidth: '360px',
      padding: '12px 16px',
      borderRadius: '8px',
      background: '#2b2133',
      color: '#fff',
      boxShadow: '0 5px 24px rgba(0,0,0,.35)',
      font: '14px/1.45 system-ui, sans-serif',
    });
    document.body.appendChild(notification);
    window.setTimeout(() => notification.remove(), 8000);
  }
}

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
import type { NativeFallbackReason } from '../shared/native-fallback-request';
import { blocksNativeRetry } from '../shared/native-retry';
import { matchesExpectedNativeEvent } from '../shared/session-recovery';
import { getEffectsForPreset, getSettings } from '../utils/settings';
import {
  getFullscreenElement,
  hasFullscreenContext,
  isVideoInFullscreenContext,
} from '../shared/fullscreen-video';
import { OverlayManager } from './overlay-manager';
import { FullscreenLayoutManager } from './fullscreen-layout-manager';
import type { Renderer } from './renderer';

interface NativeFallbackResponse {
  ok: boolean;
  status?: 'started' | 'unavailable' | 'denied';
  message?: string;
  sessionId?: string;
}

export class VideoEnhancer {
  private static activeEnhancer: VideoEnhancer | null = null;
  private static readonly managedEnhancers = new Set<VideoEnhancer>();

  private renderer: Renderer | null = null;
  private nativeActive = false;
  private nativeSessionId: string | null = null;
  private currentModeId: string | null = null;
  private currentSettings: Anime4KWebExtSettings | null = null;
  private readonly overlay: OverlayManager;
  private readonly fullscreenLayout: FullscreenLayoutManager;
  private readonly videoId: string;
  private encryptedDetected = false;
  private performanceWarning = false;
  private oversharpenWarning = false;
  private nativeOverloadedSince: number | null = null;
  private lastNativeDroppedFrames = 0;
  private lastRenderStats: RenderStats | null = null;
  private destroyed = false;
  private switchingFromNative = false;
  private readonly targetResizeObserver: ResizeObserver;
  private targetUpdateTimer?: number;
  private nativePlaybackTimer?: number;
  private fullscreenDebounceTimer?: number;
  private fullscreenRevision = 0;
  private fullscreenTransition: Promise<void> = Promise.resolve();
  private transitionRevision = 0;
  private startingRevision: number | null = null;
  private readonly pendingNativeStarts = new Map<number, { stopRequested: boolean }>();
  private settingsUpdateChain: Promise<void> = Promise.resolve();
  private automaticSession = false;
  private nativeRetryBlocked = false;

  private readonly targetChangeHandler = () => {
    this.scheduleAutoTargetUpdate();
    this.scheduleFullscreenReconcile();
  };
  private readonly fullscreenChangeHandler = () => this.scheduleFullscreenReconcile();

  private readonly nativeSessionHandler = (event: Event) => {
    if (!this.nativeActive) return;
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    if (!detail || typeof detail.type !== 'string') return;
    if (!matchesExpectedNativeEvent(this.nativeSessionId, detail.sessionId)) return;
    if (blocksNativeRetry(detail)) this.nativeRetryBlocked = true;
    if (detail.type === 'metrics') {
      const fps = Number(detail.fps) || 0;
      const renderMs = Number(detail.frameTimeMs) || 0;
      const droppedFrames = Number(detail.droppedFrames) || 0;
      const budgetMs = 1000 / Math.max(24, fps || 24);
      const overloaded = renderMs > budgetMs || droppedFrames > this.lastNativeDroppedFrames;
      const now = performance.now();
      if (overloaded) {
        if (this.nativeOverloadedSince === null) this.nativeOverloadedSince = now;
      } else {
        this.nativeOverloadedSince = null;
      }
      this.lastNativeDroppedFrames = droppedFrames;
      this.performanceWarning = this.nativeOverloadedSince !== null
        && now - this.nativeOverloadedSince >= 2000;
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
    if (this.switchingFromNative) {
      this.nativeActive = false;
      this.nativeSessionId = null;
      this.stopNativePlaybackHeartbeat();
      return;
    }
    this.nativeActive = false;
    this.nativeSessionId = null;
    this.stopNativePlaybackHeartbeat();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.currentModeId = null;
    this.performanceWarning = false;
    this.nativeOverloadedSince = null;
    this.lastNativeDroppedFrames = 0;
    this.lastRenderStats = null;
    this.overlay.setStats(null);
    this.updateWarningDisplay();
    this.automaticSession = false;
    this.fullscreenLayout.exit();
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
    void chrome.runtime.sendMessage({ type: 'ENHANCEMENT_RELEASE', videoId: this.videoId }).catch(() => undefined);
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

  private constructor(private video: HTMLVideoElement) {
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
    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
    // A player may request Fullscreen from the top-level document while the
    // <video> lives in a (cross-origin) iframe. The frame-local
    // fullscreenchange event never fires in that case, so observe the
    // top-level document too and reconcile from the guest frame.
    if (window.top && window.top !== window) {
      try {
        window.top.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
        window.top.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
      } catch {
        // A cross-origin top document may reject listener registration.
        // The geometry reconcile below still runs on resize/scroll.
      }
    }
    window.addEventListener('anime4k-native-session', this.nativeSessionHandler);
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

  public static create(video: HTMLVideoElement): VideoEnhancer {
    return new VideoEnhancer(video);
  }

  private beginTransition(): number {
    this.transitionRevision += 1;
    return this.transitionRevision;
  }

  private isTransitionCurrent(revision: number): boolean {
    return !this.destroyed && revision === this.transitionRevision;
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
    if (this.renderer || this.nativeActive || this.destroyed || this.startingRevision !== null) return;
    const revision = this.beginTransition();
    this.startingRevision = revision;
    try {
      settings ??= this.currentSettings ?? await getSettings();
      if (!this.isTransitionCurrent(revision)) return;
      if (!isProcessingEnabled(settings.mode, settings.frameGenerationEnabled)) {
        this.currentSettings = settings;
        this.currentModeId = null;
        this.applyFullscreenMarker(false);
        return;
      }
      const selectedBackend = this.selectBackend(settings);
      this.assertBackendCompatibility(selectedBackend);
      this.currentSettings = settings;
      const claim = await chrome.runtime.sendMessage({
        type: 'ENHANCEMENT_CLAIM',
        videoId: this.videoId,
      }) as { ok?: boolean; message?: string } | undefined;
      if (!this.isTransitionCurrent(revision)) return;
      if (!claim?.ok) throw new Error(claim?.message || 'Another Anime4K instance could not be stopped.');
      if (VideoEnhancer.activeEnhancer && VideoEnhancer.activeEnhancer !== this) {
        await VideoEnhancer.activeEnhancer.stopEnhancement(true, false);
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
      await this.stopEnhancement(false);
      if (!this.destroyed) {
        this.showNotification(error instanceof Error ? error.message : 'Anime4K could not be started.');
      }
    } finally {
      if (this.startingRevision === revision) this.startingRevision = null;
    }
  }

  private async initRenderer(settings: Anime4KWebExtSettings, revision: number): Promise<boolean> {
    if (this.video.readyState < this.video.HAVE_METADATA) {
      const video = this.video;
      await new Promise<void>((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('The video metadata could not be loaded.')); };
        const cleanup = () => {
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
    const pending = { stopRequested: false };
    this.pendingNativeStarts.set(revision, pending);
    let response: NativeFallbackResponse | undefined;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'NATIVE_FALLBACK_REQUEST',
        videoId: this.videoId,
        reason,
        configuration: {
          mode: settings.mode,
          quality: settings.quality,
          frameGenerationEnabled: settings.frameGenerationEnabled,
        },
        output: 'auto',
        videoRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
      }) as NativeFallbackResponse | undefined;
    } catch (error) {
      this.pendingNativeStarts.delete(revision);
      if (!this.isTransitionCurrent(revision)) return false;
      throw error;
    }
    this.pendingNativeStarts.delete(revision);
    if (!this.isTransitionCurrent(revision)) {
      if (response?.ok && !pending.stopRequested && typeof response.sessionId === 'string') {
        await chrome.runtime.sendMessage({
          type: 'NATIVE_STOP',
          sessionId: response.sessionId,
          videoId: this.videoId,
        }).catch(() => undefined);
      }
      return false;
    }
    if (!response?.ok || typeof response.sessionId !== 'string') {
      throw new Error(response?.message || 'The native Anime4K renderer is unavailable.');
    }
    this.nativeActive = true;
    this.nativeSessionId = response.sessionId;
    this.startNativePlaybackHeartbeat();
    this.currentModeId = MODE_TO_ID[settings.mode];
    return true;
  }

  private async handleEncryptedPlayback(): Promise<void> {
    if (this.destroyed || (!this.renderer && !this.nativeActive)) return;
    if (this.nativeActive) return;
    const revision = this.beginTransition();
    const settings = this.currentSettings ?? await getSettings();
    if (!this.isTransitionCurrent(revision)) return;
    this.releaseWebGPUResources();
    this.overlay.hideCanvas();
    if (!allowsNativeFallback(settings.backend)) {
      await this.stopEnhancement(false);
      if (!this.destroyed) {
        this.showNotification('Protected playback cannot use the forced WebGPU backend. Select Auto or Native instead.');
      }
      return;
    }
    try {
      await this.requestNativeFallback('eme', settings, revision);
    } catch (error) {
      if (!this.isTransitionCurrent(revision)) return;
      await this.stopEnhancement(false);
      if (!this.destroyed) {
        this.showNotification(error instanceof Error ? error.message : 'Protected playback cannot be captured.');
      }
    }
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
    this.releaseWebGPUResources();
    this.overlay.hideCanvas();
    if (!allowsNativeFallback(settings.backend)) {
      await this.stopEnhancement(false);
      if (!this.destroyed) {
        this.showNotification(error.message || 'The video frame cannot be processed with WebGPU.');
      }
      return;
    }
    try {
      await this.requestNativeFallback(reason, settings, revision);
    } catch (fallbackError) {
      if (!this.isTransitionCurrent(revision)) return;
      await this.stopEnhancement(false);
      if (!this.destroyed) {
        this.showNotification(
          fallbackError instanceof Error ? fallbackError.message : 'Video frames cannot be processed on this site.',
        );
      }
    }
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
    const messages: string[] = [];
    if (this.oversharpenWarning) messages.push('A+A, B+B and C+A may oversharpen below 2x output.');
    if (this.performanceWarning) {
      const stats = this.lastRenderStats;
      messages.push(stats
        ? `Frame budget exceeded: ${stats.renderMs.toFixed(1)} ms, ${stats.fps.toFixed(1)} FPS, ${stats.droppedFrames} dropped.`
        : 'The selected preset exceeds the frame budget; frames are being dropped.');
    }
    this.overlay.setWarning(messages.length > 0 ? messages.join(' ') : null);
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
    const result = this.settingsUpdateChain.then(
      () => this.applySettings(newSettings),
      () => this.applySettings(newSettings),
    );
    this.settingsUpdateChain = result.catch(() => undefined);
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
      if (this.renderer || this.nativeActive || this.startingRevision !== null
          || this.pendingNativeStarts.size > 0) await this.stopEnhancement();
      else {
        this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
        this.fullscreenLayout.exit();
      }
      return;
    }

    if (!this.renderer && !this.nativeActive) {
      if (this.startingRevision !== null || this.pendingNativeStarts.size > 0) {
        await this.stopEnhancement();
        if (this.destroyed) return;
      }
      this.scheduleFullscreenReconcile(0);
      return;
    }

    if (this.nativeActive) {
      if (selectedBackend === 'native') {
        const revision = this.transitionRevision;
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'NATIVE_UPDATE_CONFIGURATION',
            ...(this.nativeSessionId ? { sessionId: this.nativeSessionId } : {}),
            videoId: this.videoId,
            configuration: {
              mode: newSettings.mode,
              quality: newSettings.quality,
              frameGenerationEnabled: newSettings.frameGenerationEnabled,
            },
            output: 'auto',
          }) as { ok?: boolean; message?: string } | undefined;
          if (!this.isTransitionCurrent(revision)) return;
          if (!response?.ok) {
            throw new Error(response?.message || 'The native renderer could not apply the selected configuration.');
          }
        } catch (error) {
          if (!this.isTransitionCurrent(revision)) return;
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
      this.switchingFromNative = true;
      const nativeSessionId = this.nativeSessionId;
      this.nativeActive = false;
      this.nativeSessionId = null;
      this.stopNativePlaybackHeartbeat();
      this.nativeOverloadedSince = null;
      this.lastNativeDroppedFrames = 0;
      this.lastRenderStats = null;
      this.overlay.setStats(null);
      try {
        await chrome.runtime.sendMessage({
          type: 'NATIVE_STOP',
          ...(nativeSessionId ? { sessionId: nativeSessionId } : {}),
          videoId: this.videoId,
        });
        if (!this.isTransitionCurrent(revision)) return;

        if (selectedBackend !== 'webgpu') {
          throw new Error('WebGPU is unavailable. Select Auto or Native instead.');
        }

        const claim = await chrome.runtime.sendMessage({
          type: 'ENHANCEMENT_CLAIM',
          videoId: this.videoId,
        }) as { ok?: boolean; message?: string } | undefined;
        if (!this.isTransitionCurrent(revision)) return;
        if (!claim?.ok) throw new Error(claim?.message || 'Anime4K could not reclaim the active video.');
        if (!await this.initRenderer(newSettings, revision)) return;
        if (!this.isTransitionCurrent(revision)) return;
        VideoEnhancer.activeEnhancer = this;
        this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
        return;
      } catch (error) {
        if (!this.isTransitionCurrent(revision)) return;
        await this.stopEnhancement(this.nativeActive);
        if (!this.destroyed) {
          this.showNotification(error instanceof Error ? error.message : 'The backend could not be changed.');
        }
        throw error;
      } finally {
        if (this.transitionRevision === revision) this.switchingFromNative = false;
      }
    }
    if (!this.renderer) return;
    if (selectedBackend === 'native') {
      const revision = this.beginTransition();
      this.releaseWebGPUResources();
      this.overlay.hideCanvas();
      try {
        if (!await this.requestNativeFallback('native-selected', newSettings, revision)) return;
      } catch (error) {
        if (!this.isTransitionCurrent(revision)) return;
        await this.stopEnhancement(false);
        if (!this.destroyed) {
          this.showNotification(error instanceof Error ? error.message : 'The native renderer could not be started.');
        }
        throw error;
      }
      if (!this.isTransitionCurrent(revision)) return;
      VideoEnhancer.activeEnhancer = this;
      this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
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
      if (this.renderer === renderer && renderer.isDestroyed()) await this.stopEnhancement(false);
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
    if (this.renderer || this.nativeActive) this.video.setAttribute(ANIME4K_APPLIED_ATTR, 'true');
    this.scheduleFullscreenReconcile(0);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    VideoEnhancer.managedEnhancers.delete(this);
    this.video.removeEventListener('encrypted', this.encryptedHandler);
    window.removeEventListener('anime4k-protected-playback', this.pageProtectedPlaybackHandler);
    this.targetResizeObserver.disconnect();
    window.removeEventListener('resize', this.targetChangeHandler);
    document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
    document.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
    if (window.top && window.top !== window) {
      try {
        window.top.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
        window.top.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
      } catch {
        // A cross-origin top document may reject listener removal; harmless.
      }
    }
    window.removeEventListener('anime4k-native-session', this.nativeSessionHandler);
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

  public async stopEnhancement(stopNative = true, releaseClaim = true): Promise<void> {
    this.beginTransition();
    this.startingRevision = null;
    const wasNativeActive = this.nativeActive;
    const nativeSessionId = this.nativeSessionId;
    let pendingNativeStop = false;
    for (const pending of this.pendingNativeStarts.values()) {
      if (pending.stopRequested) continue;
      pending.stopRequested = true;
      pendingNativeStop = true;
    }
    this.releaseWebGPUResources();
    this.nativeActive = false;
    this.nativeSessionId = null;
    this.switchingFromNative = false;
    this.stopNativePlaybackHeartbeat();
    this.overlay.hideCanvas();
    this.fullscreenLayout.exit();
    this.video.removeAttribute(ANIME4K_APPLIED_ATTR);
    this.currentModeId = null;
    this.performanceWarning = false;
    this.oversharpenWarning = false;
    this.nativeOverloadedSince = null;
    this.lastNativeDroppedFrames = 0;
    this.lastRenderStats = null;
    this.updateWarningDisplay();
    this.automaticSession = false;
    if (VideoEnhancer.activeEnhancer === this) VideoEnhancer.activeEnhancer = null;
    if (releaseClaim) {
      void chrome.runtime.sendMessage({ type: 'ENHANCEMENT_RELEASE', videoId: this.videoId }).catch(() => undefined);
    }

    if ((stopNative && wasNativeActive) || pendingNativeStop) {
      try {
        await chrome.runtime.sendMessage({
          type: 'NATIVE_STOP',
          ...(nativeSessionId ? { sessionId: nativeSessionId } : {}),
          videoId: this.videoId,
        });
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
      this.fullscreenTransition = this.fullscreenTransition
        .catch(() => undefined)
        .then(() => this.reconcileFullscreen(revision));
    }, delay);
  }

  private async reconcileFullscreen(revision: number): Promise<void> {
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    const settings = this.currentSettings ?? await getSettings();
    if (this.destroyed || revision !== this.fullscreenRevision) return;
    this.currentSettings = settings;
    const processingEnabled = isProcessingEnabled(settings.mode, settings.frameGenerationEnabled);
    this.applyFullscreenMarker(processingEnabled);
    const preferredFullscreenVideo = this.isPreferredFullscreenVideo();
    if (!hasFullscreenContext(
      getFullscreenElement(),
      { width: window.innerWidth, height: window.innerHeight },
      {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
      },
      window.top !== window,
    )) this.nativeRetryBlocked = false;
    const shouldRun = processingEnabled
      && preferredFullscreenVideo
      && !this.nativeRetryBlocked;

    if (shouldRun) {
      if (!this.renderer && !this.nativeActive && this.startingRevision === null
          && this.pendingNativeStarts.size === 0) {
        this.fullscreenLayout.enter();
        this.automaticSession = true;
        await this.startEnhancement(settings);
        if (!this.renderer && !this.nativeActive) this.automaticSession = false;
      }
      return;
    }

    if (this.automaticSession || this.renderer || this.nativeActive
        || this.startingRevision !== null || this.pendingNativeStarts.size > 0) {
      this.automaticSession = false;
      await this.stopEnhancement();
    }
  }

  private isPreferredFullscreenVideo(): boolean {
    if (!isVideoInFullscreenContext(this.video)) return false;
    const ownRect = this.video.getBoundingClientRect();
    const ownArea = ownRect.width * ownRect.height;
    for (const enhancer of VideoEnhancer.managedEnhancers) {
      if (enhancer === this || enhancer.destroyed
          || !isVideoInFullscreenContext(enhancer.video)) continue;
      const rect = enhancer.video.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > ownArea || area === ownArea && enhancer.videoId < this.videoId) return false;
    }
    return true;
  }

  private startNativePlaybackHeartbeat(): void {
    this.stopNativePlaybackHeartbeat();
    if (!this.nativeActive || this.destroyed) return;
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
    if (!this.nativeActive || this.destroyed) return;
    await chrome.runtime.sendMessage({
      type: 'NATIVE_PLAYBACK_STATE',
      ...(this.nativeSessionId ? { sessionId: this.nativeSessionId } : {}),
      videoId: this.videoId,
      playbackActive: !this.video.paused && !this.video.ended,
      mediaTime: Number.isFinite(this.video.currentTime) ? Math.max(0, this.video.currentTime) : 0,
    }).catch(() => undefined);
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

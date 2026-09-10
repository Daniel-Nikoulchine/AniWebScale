import type { RenderStats } from '../types';
import { blocksNativeRetry } from '../shared/native-retry';
import { matchesExpectedNativeEvent } from '../shared/session-recovery';
import { fullscreenContext } from './fullscreen-context';
import { OverloadTracker } from './render-stats';
import type { NativeSessionClient } from './native-session-client';
import { FULLSCREEN_RECONCILE_RETRY_MS } from './enhancer-fullscreen-reconciler';

/** What a terminal native event asks the enhancer to tear down. */
export interface NativeSessionEnded {
  /** Host error message to surface, or null when the stop was clean. */
  message: string | null;
  /** A capture-window close that may retry a fullscreen reconcile. */
  retryCaptureAfterFailedExit: boolean;
}

/**
 * The narrow host seam for native-session events. The observer interprets the
 * events (session matching, overload verdict, terminal teardown) and calls
 * back into the enhancer; it owns only the native session id, playback
 * heartbeat and overload metrics.
 */
export interface NativeSessionObserverContext {
  isDestroyed(): boolean;
  isNativeActive(): boolean;
  getVideo(): HTMLVideoElement;
  getVideoId(): string;
  /** Whether the abandoned session of an intentional native->webgpu switch is live. */
  isAbandonedSwitchCurrent(): boolean;
  /** Whether the given session id belongs to the abandoned switch. */
  abandonsSwitch(sessionId: unknown): boolean;
  recordStats(stats: RenderStats): void;
  markIdle(): void;
  blockAutoRetry(): void;
  scheduleFullscreenReconcile(delay: number): void;
  onSessionTerminated(ended: NativeSessionEnded): void;
}

/**
 * Owns the native session's live runtime: the session id, the 1 Hz playback
 * heartbeat and the overload window over host metrics. The terminal-event
 * teardown itself stays with the enhancer (renderer/layout/claim ownership).
 */
export class NativeSessionObserver {
  private sessionId: string | null = null;
  private playbackTimer?: number;
  private readonly overloadTracker = new OverloadTracker();
  private lastDroppedFrames = 0;

  constructor(
    private readonly ctx: NativeSessionObserverContext,
    private readonly native: NativeSessionClient,
  ) {}

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  /** Commit a freshly started native session and begin its heartbeat. */
  beginSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.startPlaybackHeartbeat();
  }

  /** Drop the session id and stop the heartbeat (without resetting metrics). */
  clearSession(): void {
    this.sessionId = null;
    this.stopPlaybackHeartbeat();
  }

  /** Full teardown of session + metrics (stop/native-exit paths). */
  reset(): void {
    this.clearSession();
    this.overloadTracker.reset();
    this.lastDroppedFrames = 0;
  }

  /** Drop the overload window only (backend switch). */
  resetMetrics(): void {
    this.overloadTracker.reset();
    this.lastDroppedFrames = 0;
  }

  /** Window listener body for `anime4k-native-session`. */
  handleEvent(event: Event): void {
    if (this.ctx.isDestroyed()) return;
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
    if (!matchesExpectedNativeEvent(this.sessionId, detail.sessionId)
      && !this.ctx.abandonsSwitch(detail.sessionId)) return;
    if (blocksNativeRetry(detail)) this.ctx.blockAutoRetry();
    if (detail.type === 'metrics') {
      this.handleMetrics(detail);
      return;
    }
    const state = detail.state;
    const ended = detail.type === 'stopped'
      || detail.type === 'error'
      || detail.type === 'status' && (state === 'stopped' || state === 'failed');
    if (!ended) return;
    const retryCaptureAfterFailedExit = detail.type === 'stopped'
      && detail.reason === 'capture_window_closed'
      && fullscreenContext.hasContext(this.ctx.getVideo());
    if (this.ctx.isAbandonedSwitchCurrent()) {
      this.ctx.markIdle();
      this.clearSession();
      return;
    }
    this.ctx.onSessionTerminated({
      message: (detail.type === 'error' || state === 'failed') && typeof detail.message === 'string'
        ? detail.message
        : null,
      retryCaptureAfterFailedExit,
    });
    if (retryCaptureAfterFailedExit) this.ctx.scheduleFullscreenReconcile(FULLSCREEN_RECONCILE_RETRY_MS);
  }

  private handleMetrics(detail: Record<string, unknown>): void {
    if (!this.ctx.isNativeActive()) return;
    const fps = Number(detail.fps) || 0;
    const renderMs = Number(detail.frameTimeMs) || 0;
    const droppedFrames = Number(detail.droppedFrames) || 0;
    const budgetMs = 1000 / Math.max(24, fps || 24);
    const now = performance.now();
    const performanceWarning = this.overloadTracker.recordSample(
      renderMs > budgetMs || droppedFrames > this.lastDroppedFrames,
      now,
    );
    this.lastDroppedFrames = droppedFrames;
    this.ctx.recordStats({
      fps,
      renderMs,
      droppedFrames,
      warning: performanceWarning,
    });
  }

  private startPlaybackHeartbeat(): void {
    this.stopPlaybackHeartbeat();
    if (!this.ctx.isNativeActive() || this.ctx.isDestroyed()) return;
    void this.sendPlaybackState();
    this.playbackTimer = window.setInterval(() => void this.sendPlaybackState(), 1000);
  }

  private stopPlaybackHeartbeat(): void {
    if (this.playbackTimer !== undefined) {
      window.clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
  }

  private async sendPlaybackState(): Promise<void> {
    if (!this.ctx.isNativeActive() || this.ctx.isDestroyed()) return;
    if (this.sessionId === null) return;
    const video = this.ctx.getVideo();
    await this.native.sendPlaybackState({
      sessionId: this.sessionId,
      videoId: this.ctx.getVideoId(),
      playbackActive: !video.paused && !video.ended,
      mediaTime: Number.isFinite(video.currentTime) ? Math.max(0, video.currentTime) : 0,
    });
  }
}

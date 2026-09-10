import {
  PRESENT_CURRENT_FRAME,
  PRESENT_INTERMEDIATE_FRAME,
  PRESENT_PREVIOUS_FRAME,
} from './presentation-protocol';

/**
 * Opaque handle to the renderer's two-texture frame history. The renderer owns
 * the device, the history textures and the presentation bind groups; the
 * generator only commands semantic operations, so no texture descriptor, bind
 * group or encoder detail leaks across the seam. `seed` fills both
 * orientations with the current final texture (first frame), `capture` copies
 * the final texture into the active orientation, and `swap` toggles the
 * orientation and refreshes the renderer's presentation bind group.
 */
export interface FrameGenerationHistory {
  /** Copy the final texture into BOTH history orientations (first frame). */
  seed(encoder: GPUCommandEncoder): void;
  /** Copy the final texture into the currently active history orientation. */
  capture(encoder: GPUCommandEncoder): void;
  /** Toggle previous/current and refresh the presentation bind group. */
  swap(): void;
}

/**
 * The presentation port the frame generator renders through. The Renderer
 * provides this; it owns the GPU device, the canvas presentation pipeline and
 * the live frame-loop state the generator must consult before acting. The
 * generator never touches GPU resources directly: it asks the host to ensure
 * the history, present a frame and write the interpolation factor.
 */
export interface FrameGenerationHost {
  readonly video: HTMLVideoElement;
  readonly frameBudgetMs: number;
  readonly frameGenerationEnabled: boolean;
  isDestroyed(): boolean;
  isRebuilding(): boolean;
  isFrameProcessing(): boolean;
  /**
   * Build (or rebuild) the two-texture history and return an opaque handle,
   * or null when frame generation is disabled or the final texture is not
   * available. Idempotent: the host releases any previous history first.
   */
  ensureHistory(): FrameGenerationHistory | null;
  /** Release the history textures and bind groups (the host owns them). */
  releaseHistory(): void;
  /** Write the interpolation factor into the presentation uniform. */
  writePresentationFactor(factor: Float32Array<ArrayBuffer>): void;
  /** Write the factor, encode the presentation pass and submit it. */
  presentFrame(factor: Float32Array<ArrayBuffer>, label: string): void;
}

/**
 * Owns the frame-generation subsystem of the renderer: the two-texture frame
 * history, the previous/current swap, the generated-intermediate scheduling
 * and the pause-flush state machine.
 *
 * Extracted from Renderer so the interpolation timing logic lives in one
 * place with its own interface instead of being interleaved across the frame
 * loop. The GPU presentation pipeline (device, canvas context, render
 * pipeline, history textures) stays in the Renderer; the generator reaches it
 * through the FrameGenerationHost seam and only holds an opaque
 * FrameGenerationHistory.
 */
export class FrameGeneration {
  private history: FrameGenerationHistory | null = null;
  private historyReady = false;
  private generatedFrameAnimationId: number | null = null;
  private frameGenerationStartedAt = 0;
  private playbackFlushPending = false;

  constructor(private readonly host: FrameGenerationHost) {}

  /**
   * Whether the renderer has a history bind group to present from. Used by
   * the renderer to choose between the history orientation and the plain
   * final-texture bind group.
   */
  get historyAvailable(): boolean {
    return this.history !== null;
  }

  /** Build (or rebuild) the two-texture frame history. */
  createResources(): void {
    this.destroyResources();
    this.history = this.host.ensureHistory();
  }

  /** Release the frame history and stop any scheduled generated frame. */
  destroyResources(): void {
    this.stopAnimation();
    this.history = null;
    this.historyReady = false;
    this.host.releaseHistory();
  }

  /**
   * Advance the frame history for a newly encoded frame. Seeds the history on
   * the first frame, then swaps previous/current and copies the fresh frame on
   * each subsequent one. Returns true when a generated intermediate should be
   * scheduled for presentation between this frame and the next.
   */
  prepareFrame(encoder: GPUCommandEncoder): boolean {
    if (!this.host.frameGenerationEnabled || !this.history) {
      this.host.writePresentationFactor(PRESENT_CURRENT_FRAME);
      return false;
    }
    this.stopAnimation();
    if (!this.historyReady) {
      this.history.seed(encoder);
      this.historyReady = true;
      this.host.writePresentationFactor(PRESENT_CURRENT_FRAME);
      return false;
    }

    this.history.swap();
    this.history.capture(encoder);
    this.host.writePresentationFactor(PRESENT_PREVIOUS_FRAME);
    return true;
  }

  private renderHistoryFrame(factor: Float32Array<ArrayBuffer>, label: string): void {
    if (this.host.isDestroyed() || !this.host.frameGenerationEnabled
        || !this.historyReady || this.host.isRebuilding()) return;
    // Called from finally blocks (pause flush, rebuild cleanup): never let a
    // presentation failure mask the original error or produce unhandled
    // rejections from void drainFrames.
    try {
      this.host.presentFrame(factor, label);
    } catch (error) {
      console.warn('[Anime4K] Frame generation present failed:', error);
    }
  }

  private renderGeneratedIntermediate(): void {
    this.renderHistoryFrame(PRESENT_INTERMEDIATE_FRAME, 'Generated intermediate frame');
  }

  /** Playback stopped: cancel the scheduled intermediate and flush the latest real frame. */
  onPlaybackStopped(): void {
    this.stopAnimation();
    this.playbackFlushPending = true;
    this.flush();
  }

  /**
   * A paused-seek frame is still being processed: cancel the scheduled
   * intermediate and mark a flush, but defer the actual present until the
   * in-flight frame completes (the renderer calls flush() from its finally).
   */
  markPausedForSeek(): void {
    this.stopAnimation();
    this.playbackFlushPending = true;
  }

  /** Present the latest real frame if a flush is pending and it is safe to do so. */
  flush(): void {
    if (!this.playbackFlushPending) return;
    if (!this.host.video.paused && !this.host.video.ended) {
      this.playbackFlushPending = false;
      return;
    }
    if (this.host.isDestroyed() || !this.host.frameGenerationEnabled || !this.historyReady) {
      this.playbackFlushPending = false;
      return;
    }
    if (this.host.isFrameProcessing() || this.host.isRebuilding()) return;
    this.playbackFlushPending = false;
    this.renderHistoryFrame(PRESENT_CURRENT_FRAME, 'Frame generation pause flush');
  }

  /** Schedule a generated intermediate frame halfway into the current frame budget. */
  scheduleIntermediate(): void {
    if (!this.host.frameGenerationEnabled || this.host.isDestroyed()
        || this.host.video.paused || this.host.video.ended) return;
    this.frameGenerationStartedAt = performance.now();
    const tick = (now: number) => {
      this.generatedFrameAnimationId = null;
      if (this.host.isDestroyed() || !this.host.frameGenerationEnabled || this.host.isRebuilding()) return;
      // Never present an intermediate while the main loop encodes the next
      // real frame: both write presentationUniform and would race the factor.
      if (this.host.isFrameProcessing()) {
        this.generatedFrameAnimationId = requestAnimationFrame(tick);
        return;
      }
      if (this.host.video.paused || this.host.video.ended) {
        this.onPlaybackStopped();
        return;
      }
      if (now - this.frameGenerationStartedAt >= this.host.frameBudgetMs * 0.5) {
        this.renderGeneratedIntermediate();
        return;
      }
      this.generatedFrameAnimationId = requestAnimationFrame(tick);
    };
    this.generatedFrameAnimationId = requestAnimationFrame(tick);
  }

  /** Cancel any scheduled generated-intermediate animation frame. */
  stopAnimation(): void {
    if (this.generatedFrameAnimationId !== null) {
      cancelAnimationFrame(this.generatedFrameAnimationId);
      this.generatedFrameAnimationId = null;
    }
  }

  /** Tear down on renderer destroy: stop scheduling and drop the pending flush. */
  destroy(): void {
    this.stopAnimation();
    this.playbackFlushPending = false;
  }
}

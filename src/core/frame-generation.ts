import {
  PRESENT_CURRENT_FRAME,
  PRESENT_INTERMEDIATE_FRAME,
  PRESENT_PREVIOUS_FRAME,
} from './presentation-protocol';

/**
 * The presentation surface the frame generator renders into. The Renderer
 * provides this; it owns the GPU device, the canvas presentation pipeline and
 * the live frame-loop state the generator must consult before acting.
 */
export interface FrameGenerationHost {
  readonly device: GPUDevice;
  readonly presentationUniform: GPUBuffer;
  readonly renderBindGroupLayout: GPUBindGroupLayout;
  readonly sampler: GPUSampler;
  readonly video: HTMLVideoElement;
  readonly finalTexture: GPUTexture;
  readonly frameBudgetMs: number;
  readonly frameGenerationEnabled: boolean;
  isDestroyed(): boolean;
  isRebuilding(): boolean;
  isFrameProcessing(): boolean;
  /** Re-resolve the renderer's active presentation bind group. */
  refreshPresentationBindGroup(): void;
  /** Encode the presentation pass into the given encoder. */
  encodePresentation(encoder: GPUCommandEncoder): void;
}

/**
 * Owns the frame-generation subsystem of the renderer: the two-texture frame
 * history, the previous/current swap, the generated-intermediate scheduling
 * and the pause-flush state machine.
 *
 * Extracted from Renderer so the interpolation timing logic lives in one
 * place with its own interface instead of being interleaved across the frame
 * loop. The GPU presentation pipeline (device, canvas context, render
 * pipeline) stays in the Renderer; the generator reaches it through the
 * FrameGenerationHost seam.
 */
export class FrameGeneration {
  private historyTextures: [GPUTexture, GPUTexture] | null = null;
  private previousHistoryTexture: GPUTexture | null = null;
  private currentHistoryTexture: GPUTexture | null = null;
  private historyPresentationBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private historyPresentationIndex = 0;
  private historyReady = false;
  private generatedFrameAnimationId: number | null = null;
  private frameGenerationStartedAt = 0;
  private playbackFlushPending = false;

  constructor(private readonly host: FrameGenerationHost) {}

  /** Whether the frame history has been seeded and can present. */
  get isHistoryReady(): boolean {
    return this.historyReady;
  }

  /**
   * The presentation bind group for the current history orientation, or null
   * when frame generation is inactive or the history is not built. The
   * renderer uses this to decide whether to present from history or from the
   * final enhancement texture.
   */
  get activeBindGroup(): GPUBindGroup | null {
    if (!this.host.frameGenerationEnabled || !this.historyPresentationBindGroups) return null;
    return this.historyPresentationBindGroups[this.historyPresentationIndex];
  }

  private createBinding(previous: GPUTexture, current: GPUTexture): GPUBindGroup {
    return this.host.device.createBindGroup({
      layout: this.host.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: this.host.sampler },
        { binding: 1, resource: previous.createView() },
        { binding: 2, resource: current.createView() },
        { binding: 3, resource: { buffer: this.host.presentationUniform } },
      ],
    });
  }

  /** Build (or rebuild) the two-texture frame history. */
  createResources(): void {
    this.destroyResources();
    if (!this.host.frameGenerationEnabled || !this.host.finalTexture) return;
    const descriptor: GPUTextureDescriptor = {
      label: 'Frame generation history',
      size: [this.host.finalTexture.width, this.host.finalTexture.height, 1],
      // copyTextureToTexture requires identical formats on both ends; the
      // history source is the final pipeline output (or, with no pipelines
      // scheduled, the 8-bit video frame texture), so inherit its format.
      format: this.host.finalTexture.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    };
    this.historyTextures = [
      this.host.device.createTexture(descriptor),
      this.host.device.createTexture(descriptor),
    ];
    [this.previousHistoryTexture, this.currentHistoryTexture] = this.historyTextures;
    this.historyPresentationBindGroups = [
      this.createBinding(this.historyTextures[0], this.historyTextures[1]),
      this.createBinding(this.historyTextures[1], this.historyTextures[0]),
    ];
  }

  /** Release the frame history and stop any scheduled generated frame. */
  destroyResources(): void {
    this.stopAnimation();
    this.historyTextures?.forEach(texture => texture.destroy());
    this.historyTextures = null;
    this.previousHistoryTexture = null;
    this.currentHistoryTexture = null;
    this.historyPresentationBindGroups = null;
    this.historyPresentationIndex = 0;
    this.historyReady = false;
  }

  private encodeHistoryCopy(encoder: GPUCommandEncoder, target: GPUTexture): void {
    // A DMA copy leaves the compute units free for the enhancement passes,
    // unlike the shader-based copy it replaces.
    encoder.copyTextureToTexture(
      { texture: this.host.finalTexture },
      { texture: target },
      [this.host.finalTexture.width, this.host.finalTexture.height, 1],
    );
  }

  /**
   * Advance the frame history for a newly encoded frame. Seeds the history on
   * the first frame, then swaps previous/current and copies the fresh frame on
   * each subsequent one. Returns true when a generated intermediate should be
   * scheduled for presentation between this frame and the next.
   */
  prepareFrame(encoder: GPUCommandEncoder): boolean {
    if (!this.host.frameGenerationEnabled || !this.previousHistoryTexture || !this.currentHistoryTexture) {
      this.host.device.queue.writeBuffer(this.host.presentationUniform, 0, PRESENT_CURRENT_FRAME);
      return false;
    }
    this.stopAnimation();
    if (!this.historyReady) {
      this.encodeHistoryCopy(encoder, this.previousHistoryTexture);
      this.encodeHistoryCopy(encoder, this.currentHistoryTexture);
      this.historyReady = true;
      this.host.device.queue.writeBuffer(this.host.presentationUniform, 0, PRESENT_CURRENT_FRAME);
      return false;
    }

    [this.previousHistoryTexture, this.currentHistoryTexture] = [
      this.currentHistoryTexture,
      this.previousHistoryTexture,
    ];
    this.encodeHistoryCopy(encoder, this.currentHistoryTexture);
    this.historyPresentationIndex = this.historyPresentationIndex === 0 ? 1 : 0;
    this.host.refreshPresentationBindGroup();
    this.host.device.queue.writeBuffer(this.host.presentationUniform, 0, PRESENT_PREVIOUS_FRAME);
    return true;
  }

  private renderHistoryFrame(factor: Float32Array<ArrayBuffer>, label: string): void {
    if (this.host.isDestroyed() || !this.host.frameGenerationEnabled
        || !this.historyReady || this.host.isRebuilding()) return;
    this.host.device.queue.writeBuffer(this.host.presentationUniform, 0, factor);
    const encoder = this.host.device.createCommandEncoder({ label });
    this.host.encodePresentation(encoder);
    this.host.device.queue.submit([encoder.finish()]);
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

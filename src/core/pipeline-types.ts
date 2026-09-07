import type { Dimensions, RealEsrganPhaseStats } from '../types';

export interface Anime4KPipeline {
  pass(encoder: GPUCommandEncoder): void;
  /**
   * Called by the renderer exactly once AFTER the encoder that carried this
   * frame's pass() work has been submitted to the queue. Pipelines that
   * defer per-frame work until the GPU copy is guaranteed executed register
   * their completion tracking here — the ordering is part of the interface,
   * not a timing accident. Optional; pipelines without post-submit work
   * omit it.
   */
  afterSubmit?(): void;
  getOutputTexture(): GPUTexture;
  /**
   * Actual output dimensions of this pipeline's texture. Optional; the
   * renderer falls back to the effect's upscaleFactor (input * factor) when
   * omitted. RealESRGAN reports the p8 presentation target here, which can
   * be smaller than the nominal 4x upscale.
   */
  getOutputDimensions?(): { width: number; height: number };
  /** Release GPU resources owned by this pipeline. */
  destroy?(): void;
  /**
   * Optional per-phase timings (averaged over the renderer's stat window).
   * Pipelines that don't expose phase breakdowns omit this; the renderer then
   * hides the per-phase overlay line and falls back to the basic FPS/renderMs.
   */
  getPhaseStats?(): RealEsrganPhaseStats | null;
  /** Total frames skipped/dropped by the scheduler (cumulative). */
  getSkippedFrames?(): number;
}

export type PipelineConstructor = new (options: {
  device: GPUDevice;
  inputTexture: GPUTexture;
  nativeDimensions?: Dimensions;
  targetDimensions?: Dimensions;
  /**
   * Optional per-effect runtime parameters. RealESRGAN reads
   * `maxInferenceHeight` from it; other pipelines ignore the field. Optional
   * so existing call sites that don't pass it keep working unchanged.
   */
  params?: { [key: string]: unknown };
  /**
   * Optional callback the pipeline fires when it detects an unrecoverable
   * WebGPU context loss (e.g. a staging-buffer map that fails with
   * "Context lost"). The renderer uses it to run device recovery, which the
   * browser's own device.lost event may never deliver (observed on Firefox
   * RDNA2). Optional; pipelines without recovery needs omit it.
   */
  onDeviceContextLost?: () => void;
  /**
   * Fatal hook: fired once when inference has failed repeatedly without a
   * single successful result. The renderer surfaces it as a runtime error so
   * the configured fallback (native path / plain video) takes over.
   */
  onFatalInferenceFailure?: () => void;
}) => Anime4KPipeline;

export type GeneratedKernelSet = Readonly<Record<string, string>>;

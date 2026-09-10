import type { Dimensions, RealEsrganPhaseStats } from '../types';

/**
 * The narrow slice of the WebGPU device/queue surface the RealESRGAN pipeline
 * and its output writer touch directly. Structurally satisfied by a real
 * GPUDevice, but declared separately so `pass()`/`afterSubmit()` and the
 * output writer can be driven with a fake in unit tests without a GPU.
 *
 * Keep this in lockstep with usage: a new GPU call added to the pipeline must
 * be added here (and to the test fakes). The real GPU composer is handed the
 * full device at the call site, so compute-pipeline creation is intentionally
 * NOT part of this port.
 */
export type PipelineGpuDevice = Pick<
  GPUDevice,
  | 'createBindGroup'
  | 'createBindGroupLayout'
  | 'createBuffer'
  | 'createComputePipeline'
  | 'createPipelineLayout'
  | 'createRenderPipeline'
  | 'createSampler'
  | 'createShaderModule'
  | 'createTexture'
  | 'popErrorScope'
  | 'pushErrorScope'
> & {
  readonly queue: Pick<GPUQueue, 'writeTexture' | 'writeBuffer' | 'onSubmittedWorkDone' | 'submit'>;
};

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
  /**
   * Declared capability flags. A pipeline that sets this lets the renderer's
   * capability accessors below skip per-call `typeof` probing; pipelines that
   * omit it (e.g. generated kernels outside this module) are probed once by
   * those accessors. Absent flag == absent capability, never "probe the
   * concrete class" once the descriptor is present.
   */
  readonly capabilities?: Anime4KPipelineCapabilities;
}

/** Optional feature flags a pipeline may declare (see Anime4KPipeline). */
export interface Anime4KPipelineCapabilities {
  afterSubmit?: boolean;
  outputDimensions?: boolean;
  phaseStats?: boolean;
  skippedFrames?: boolean;
}

function declaresCapability(
  pipeline: Anime4KPipeline,
  key: keyof Anime4KPipelineCapabilities,
): boolean {
  const declared = pipeline.capabilities?.[key];
  if (declared !== undefined) return declared;
  // Legacy pipelines without a descriptor: probe the method once here.
  switch (key) {
    case 'afterSubmit': return typeof pipeline.afterSubmit === 'function';
    case 'outputDimensions': return typeof pipeline.getOutputDimensions === 'function';
    case 'phaseStats': return typeof pipeline.getPhaseStats === 'function';
    case 'skippedFrames': return typeof pipeline.getSkippedFrames === 'function';
  }
}

/**
 * The single probe site for a pipeline's optional capabilities. The renderer
 * calls these instead of sprinkling `?.`/`typeof` checks across the frame
 * loop; a pipeline that declared `capabilities` is trusted, the rest are
 * probed here. Graceful degradation is unchanged: an absent capability is a
 * no-op / null / zero, never a throw.
 */
export function pipelineAfterSubmit(pipeline: Anime4KPipeline): void {
  if (declaresCapability(pipeline, 'afterSubmit')) pipeline.afterSubmit?.();
}

export function pipelineDestroy(pipeline: Anime4KPipeline): void {
  pipeline.destroy?.();
}

export function pipelineOutputDimensions(
  pipeline: Anime4KPipeline,
): { width: number; height: number } | null {
  if (!declaresCapability(pipeline, 'outputDimensions')) return null;
  return pipeline.getOutputDimensions?.() ?? null;
}

export function pipelinePhaseStats(pipeline: Anime4KPipeline): RealEsrganPhaseStats | null {
  if (!declaresCapability(pipeline, 'phaseStats')) return null;
  return pipeline.getPhaseStats?.() ?? null;
}

export function pipelineSkippedFrames(pipeline: Anime4KPipeline): number {
  if (!declaresCapability(pipeline, 'skippedFrames')) return 0;
  return pipeline.getSkippedFrames?.() ?? 0;
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

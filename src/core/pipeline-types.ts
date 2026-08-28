import type { Dimensions, RealEsrganPhaseStats } from '../types';

export interface Anime4KPipeline {
  updateParam(param?: string, value?: unknown): void;
  pass(encoder: GPUCommandEncoder): void;
  getOutputTexture(): GPUTexture;
  /** Release GPU resources owned by this pipeline. */
  destroy?(): void;
  /**
   * Optional per-phase timings (averaged over the renderer's stat window).
   * Pipelines that don't expose phase breakdowns omit this; the renderer then
   * hides the per-phase overlay line and falls back to the basic FPS/renderMs.
   */
  getPhaseStats?(): RealEsrganPhaseStats | null;
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
}) => Anime4KPipeline;

export type GeneratedKernelSet = Readonly<Record<string, string>>;

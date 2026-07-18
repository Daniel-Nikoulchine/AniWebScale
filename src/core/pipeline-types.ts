import type { Dimensions } from '../types';

export interface Anime4KPipeline {
  updateParam(param?: string, value?: unknown): void;
  pass(encoder: GPUCommandEncoder): void;
  getOutputTexture(): GPUTexture;
}

export type PipelineConstructor = new (options: {
  device: GPUDevice;
  inputTexture: GPUTexture;
  nativeDimensions?: Dimensions;
  targetDimensions?: Dimensions;
}) => Anime4KPipeline;

export type GeneratedKernelSet = Readonly<Record<string, string>>;

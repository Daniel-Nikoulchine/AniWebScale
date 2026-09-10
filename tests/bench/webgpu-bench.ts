/*
 * Anime4K preset benchmark entry. Runs in Chromium WebGPU and reports
 * GPU time (timestamp-query) plus wall time for the enhancement chain.
 *
 * The benchmark intentionally mirrors the production preset assembly
 * (resolvePresetGraph + scheduleEffectsForTarget + vendor/local constructors)
 * so the numbers reflect the shipped path, not a reimplementation.
 */
import * as Anime4K from 'anime4k-webgpu';
import { scheduleEffectsForTarget } from '../../src/shared/effect-scheduling';
import { GENERATED_KERNELS } from '../../src/shared/generated-kernels';
import { GENERATED_ANIME4K_WEBGPU_MODELS } from '../../.tmp/anime4k-bench/generated-anime4k-webgpu-models';
import { createGeneratedPipelineClass } from '../../src/shared/generated-pipelines';
import { createAnime4kWebgpuPipelineClass } from './anime4k-webgpu-pipeline';
import { createAnime4KShaderDevice } from '../../src/shared/wgsl-fidelity';
import { resolvePresetGraph } from '../../src/utils/effect-chain-templates';
import type { Anime4KMode, QualityTier } from '../../src/types';
import type { Anime4KPipeline, PipelineConstructor } from '../../src/core/pipeline-types';

type BenchVariant = 'vendor' | 'generated';

interface BenchSpec {
  mode: Anime4KMode;
  quality: QualityTier;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  warmup: number;
  iterations: number;
  variant: BenchVariant;
  chain?: { className: string; upscaleFactor?: number }[];
}

interface BenchResult {
  adapter: string;
  pipelineCount: number;
  outputWidth: number;
  outputHeight: number;
  gpuMsMedian: number;
  gpuMsMean: number;
  gpuMsP95: number;
  wallMsMedian: number;
  errors: string[];
}

let device: GPUDevice | null = null;
let anime4kDevice: GPUDevice | null = null;
let adapterDescription = 'unknown WebGPU adapter';

const localConstructors: Record<string, PipelineConstructor> = {
  CNNSoftUL: createGeneratedPipelineClass('CNNSoftUL', GENERATED_KERNELS.CNNSoftUL),
  DenoiseCNNx2M: createGeneratedPipelineClass('DenoiseCNNx2M', GENERATED_KERNELS.DenoiseCNNx2M),
  DenoiseCNNx2UL: createGeneratedPipelineClass('DenoiseCNNx2UL', GENERATED_KERNELS.DenoiseCNNx2UL),
};

const tiledConstructors: Record<string, PipelineConstructor> = Object.fromEntries(
  Object.entries(GENERATED_ANIME4K_WEBGPU_MODELS)
    .map(([className, model]) => [className, createAnime4kWebgpuPipelineClass(model)]),
);

function constructorFor(className: string, variant: BenchVariant): PipelineConstructor | undefined {
  const module = Anime4K as Record<string, unknown>;
  if (variant === 'generated') {
    const tiled = tiledConstructors[className];
    if (tiled) return tiled;
  }
  return localConstructors[className] ?? module[className] as PipelineConstructor | undefined;
}

function buildPipelines(
  gpu: GPUDevice,
  pipelineDevice: GPUDevice,
  input: GPUTexture,
  spec: BenchSpec,
): { pipelines: Anime4KPipeline[]; width: number; height: number } {
  const source = { width: spec.sourceWidth, height: spec.sourceHeight };
  const target = { width: spec.targetWidth, height: spec.targetHeight };
  const effects = spec.chain
    ?? scheduleEffectsForTarget(resolvePresetGraph(spec.mode, spec.quality), source, target).effects;
  const pipelines: Anime4KPipeline[] = [];
  let current = input;
  let width = spec.sourceWidth;
  let height = spec.sourceHeight;
  for (const effect of effects) {
    const Constructor = constructorFor(effect.className, spec.variant);
    if (!Constructor) throw new Error(`Missing WebGPU kernel ${effect.className}`);
    // Enabled-shader path uses the raw device (the generated kernels clamp
    // themselves); the vendor path uses the fidelity proxy exactly like the
    // production renderer.
    const pipeline = new Constructor({
      device: spec.variant === 'generated' ? gpu : pipelineDevice,
      inputTexture: current,
      nativeDimensions: { width, height },
      targetDimensions: target,
    });
    pipelines.push(pipeline);
    current = pipeline.getOutputTexture();
    width *= effect.upscaleFactor ?? 1;
    height *= effect.upscaleFactor ?? 1;
  }
  return { pipelines, width, height };
}

async function initialize(sourceWidth: number, sourceHeight: number): Promise<void> {
  if (device) return;
  if (!navigator.gpu) throw new Error('WebGPU is unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter was found');
  const information = adapter.info as GPUAdapterInfo | undefined;
  adapterDescription = information?.description || `${information?.vendor ?? ''} ${information?.architecture ?? ''}`.trim() || 'WebGPU adapter';
  const requiredFeatures: GPUFeatureName[] = [];
  if (adapter.features.has('timestamp-query')) requiredFeatures.push('timestamp-query');
  device = await adapter.requestDevice({ requiredFeatures });
  anime4kDevice = createAnime4KShaderDevice(device);
  (globalThis as { __benchFeatureTimestamp?: boolean }).__benchFeatureTimestamp = device.features.has('timestamp-query');
  void sourceWidth;
  void sourceHeight;
}

function createSourceTexture(width: number, height: number): GPUTexture {
  const gpu = device as GPUDevice;
  const texture = gpu.createTexture({
    label: 'Anime4K bench source',
    size: [width, height, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      bytes[o] = (x * 7 + y * 3) & 0xff;
      bytes[o + 1] = (x * 3 - y * 5) & 0xff;
      bytes[o + 2] = (x ^ y) & 0xff;
      bytes[o + 3] = 255;
    }
  }
  gpu.queue.writeTexture(
    { texture },
    bytes,
    { bytesPerRow: width * 4, rowsPerImage: height },
    [width, height, 1],
  );
  return texture;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

async function runBench(spec: BenchSpec): Promise<BenchResult> {
  await initialize(spec.sourceWidth, spec.sourceHeight);
  const gpu = device as GPUDevice;
  const pipelineDevice = anime4kDevice as GPUDevice;
  const input = createSourceTexture(spec.sourceWidth, spec.sourceHeight);
  const errors: string[] = [];
  const onUncaptured = (event: GPUUncapturedErrorEvent) => {
    errors.push(String((event.error as Error)?.message ?? event.error));
  };
  gpu.addEventListener('uncapturederror', onUncaptured);
  gpu.pushErrorScope('validation');
  let built: { pipelines: Anime4KPipeline[]; width: number; height: number };
  try {
    built = buildPipelines(gpu, pipelineDevice, input, spec);
  } catch (error) {
    errors.push(`build: ${String(error)}`);
    built = { pipelines: [], width: 0, height: 0 };
  }
  const buildError = await gpu.popErrorScope();
  if (buildError) errors.push(`build-scope: ${buildError.message}`);
  const { pipelines, width, height } = built;

  const hasTimestamps = gpu.features.has('timestamp-query');
  let querySet: GPUQuerySet | null = null;
  let resolveBuffer: GPUBuffer | null = null;
  let readBuffer: GPUBuffer | null = null;
  let timestampPeriod = 1;
  if (hasTimestamps) {
    querySet = gpu.createQuerySet({ type: 'timestamp', count: 2 });
    resolveBuffer = gpu.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    readBuffer = gpu.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    timestampPeriod = (gpu.queue as GPUQueue & { getTimestampPeriod?: () => number }).getTimestampPeriod?.() ?? 1;
  }

  const encodeFrame = (): GPUBuffer => {
    const encoder = gpu.createCommandEncoder({ label: 'Anime4K bench frame' });
    if (querySet) {
      const startPass = encoder.beginComputePass({
        timestampWrites: { querySet, beginningOfPassWriteIndex: 0 },
      });
      startPass.end();
    }
    pipelines.forEach(pipeline => pipeline.pass(encoder));
    if (querySet) {
      const endPass = encoder.beginComputePass({
        timestampWrites: { querySet, endOfPassWriteIndex: 1 },
      });
      endPass.end();
      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer as GPUBuffer, 0);
      encoder.copyBufferToBuffer(resolveBuffer as GPUBuffer, 0, readBuffer as GPUBuffer, 0, 16);
    }
    gpu.queue.submit([encoder.finish()]);
    return readBuffer as GPUBuffer;
  };

  const total = spec.warmup + spec.iterations;
  const gpuSamples: number[] = [];
  const wallSamples: number[] = [];
  for (let index = 0; index < total; index += 1) {
    const started = performance.now();
    const read = encodeFrame();
    if (hasTimestamps && read) {
      await read.mapAsync(GPUMapMode.READ);
      const view = new BigUint64Array(read.getMappedRange().slice(0));
      read.unmap();
      const tickDelta = Number(view[1] - view[0]);
      if (index >= spec.warmup) gpuSamples.push(tickDelta * timestampPeriod / 1e6);
    } else {
      await gpu.queue.onSubmittedWorkDone();
    }
    if (index >= spec.warmup) wallSamples.push(performance.now() - started);
  }

  const result: BenchResult = {
    adapter: adapterDescription,
    pipelineCount: pipelines.length,
    outputWidth: width,
    outputHeight: height,
    gpuMsMedian: gpuSamples.length ? median(gpuSamples) : Number.NaN,
    gpuMsMean: gpuSamples.length ? gpuSamples.reduce((a, b) => a + b, 0) / gpuSamples.length : Number.NaN,
    gpuMsP95: gpuSamples.length ? percentile(gpuSamples, 0.95) : Number.NaN,
    wallMsMedian: wallSamples.length ? median(wallSamples) : Number.NaN,
    errors,
  };

  gpu.removeEventListener('uncapturederror', onUncaptured);
  pipelines.forEach(pipeline => pipeline.destroy?.());
  input.destroy();
  querySet?.destroy();
  resolveBuffer?.destroy();
  readBuffer?.destroy();
  return result;
}

Object.assign(globalThis, { runAnime4KBench: runBench });

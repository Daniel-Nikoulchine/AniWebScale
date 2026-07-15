import type { Anime4KPipeline } from 'anime4k-webgpu';
import * as Anime4K from 'anime4k-webgpu';
import { scheduleEffectsForTarget } from '../../src/shared/effect-scheduling';
import { GENERATED_PIPELINE_CLASSES } from '../../src/shared/generated-pipelines';
import { createAnime4KShaderDevice } from '../../src/shared/wgsl-fidelity';
import { resolvePresetGraph } from '../../src/utils/effect-chain-templates';
import type { Anime4KMode, QualityTier } from '../../src/types';

const SOURCE_WIDTH = 96;
const SOURCE_HEIGHT = 54;

type PipelineConstructor = new (options: {
  device: GPUDevice;
  inputTexture: GPUTexture;
  nativeDimensions?: { width: number; height: number };
  targetDimensions?: { width: number; height: number };
}) => Anime4KPipeline;

let device: GPUDevice | null = null;
let anime4kDevice: GPUDevice | null = null;
let sourceTexture: GPUTexture | null = null;
let copyPipeline: GPUComputePipeline | null = null;
let adapterDescription = 'unknown WebGPU adapter';

function decodeFixture(base64: string): Uint8Array {
  const binary = atob(base64);
  if (binary.length !== SOURCE_WIDTH * SOURCE_HEIGHT * 4) {
    throw new Error('Fixture must be exactly one 96x54 RGBA8 frame');
  }
  const pixels = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) pixels[index] = binary.charCodeAt(index);
  return pixels;
}

async function initialize(fixtureBase64: string): Promise<void> {
  if (device) return;
  if (!navigator.gpu) throw new Error('WebGPU is unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter was found');
  const information = (adapter as GPUAdapter & { info?: { description?: string } }).info;
  adapterDescription = information?.description || 'WebGPU adapter';
  device = await adapter.requestDevice();
  anime4kDevice = createAnime4KShaderDevice(device);
  sourceTexture = device.createTexture({
    label: 'Anime4K golden source',
    size: [SOURCE_WIDTH, SOURCE_HEIGHT, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: sourceTexture },
    decodeFixture(fixtureBase64),
    { bytesPerRow: SOURCE_WIDTH * 4, rowsPerImage: SOURCE_HEIGHT },
    [SOURCE_WIDTH, SOURCE_HEIGHT, 1],
  );
  copyPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code: `
          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var outputTexture: texture_storage_2d<rgba16float, write>;
          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) pixel: vec3u) {
            let size = textureDimensions(outputTexture);
            if (pixel.x >= size.x || pixel.y >= size.y) { return; }
            textureStore(outputTexture, pixel.xy, textureLoad(inputTexture, vec2i(pixel.xy), 0));
          }
        `,
      }),
      entryPoint: 'main',
    },
  });
}

async function runGolden(
  mode: Anime4KMode,
  quality: QualityTier,
  fixtureBase64: string,
  targetScale: 2 | 4,
): Promise<{
  adapter: string;
  base64: string;
  width: number;
  height: number;
}> {
  await initialize(fixtureBase64);
  const gpu = device as GPUDevice;
  const pipelineDevice = anime4kDevice as GPUDevice;
  const input = sourceTexture as GPUTexture;
  const targetWidth = SOURCE_WIDTH * targetScale;
  const targetHeight = SOURCE_HEIGHT * targetScale;
  const effects = scheduleEffectsForTarget(
    resolvePresetGraph(mode, quality),
    { width: SOURCE_WIDTH, height: SOURCE_HEIGHT },
    { width: targetWidth, height: targetHeight },
  ).effects;
  const module = Anime4K as Record<string, unknown>;
  const local = GENERATED_PIPELINE_CLASSES as Record<string, PipelineConstructor>;
  const pipelines: Anime4KPipeline[] = [];
  let current = input;
  let width = SOURCE_WIDTH;
  let height = SOURCE_HEIGHT;
  for (const effect of effects) {
    const Constructor = local[effect.className]
      ?? module[effect.className] as PipelineConstructor | undefined;
    if (!Constructor) throw new Error(`Missing exact WebGPU kernel ${effect.className}`);
    const pipeline = new Constructor({
      device: pipelineDevice,
      inputTexture: current,
      nativeDimensions: { width, height },
      targetDimensions: { width: targetWidth, height: targetHeight },
    });
    pipelines.push(pipeline);
    current = pipeline.getOutputTexture();
    width *= effect.upscaleFactor ?? 1;
    height *= effect.upscaleFactor ?? 1;
  }
  if (width !== targetWidth || height !== targetHeight) {
    throw new Error(`Unexpected WebGPU output size ${width}x${height}`);
  }

  const readable = gpu.createTexture({
    size: [width, height, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  const bytesPerRow = width * 8;
  const output = gpu.createBuffer({
    size: bytesPerRow * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = gpu.createCommandEncoder();
  pipelines.forEach(pipeline => pipeline.pass(encoder));
  const pass = encoder.beginComputePass();
  pass.setPipeline(copyPipeline as GPUComputePipeline);
  pass.setBindGroup(0, gpu.createBindGroup({
    layout: (copyPipeline as GPUComputePipeline).getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: current.createView() },
      { binding: 1, resource: readable.createView() },
    ],
  }));
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  encoder.copyTextureToBuffer(
    { texture: readable },
    { buffer: output, bytesPerRow, rowsPerImage: height },
    [width, height, 1],
  );
  gpu.queue.submit([encoder.finish()]);
  await output.mapAsync(GPUMapMode.READ);
  const bytes = new Uint8Array(output.getMappedRange()).slice();
  output.unmap();
  output.destroy();
  readable.destroy();

  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return {
    adapter: adapterDescription,
    base64: btoa(binary),
    width,
    height,
  };
}

Object.assign(globalThis, { runAnime4KGolden: runGolden });

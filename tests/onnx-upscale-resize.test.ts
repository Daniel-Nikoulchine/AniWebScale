import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONNX_UPSCALE_MODELS,
  OnnxUpscalePipeline,
  type OnnxUpscaleModelDefinition,
  type OnnxUpscaleRuntime,
} from '../src/core/onnx-upscale-pipeline';
import { Renderer } from '../src/core/renderer';

type FakeTexture = GPUTexture & { destroySpy: ReturnType<typeof vi.fn> };

function fakeTexture(width: number, height: number): FakeTexture {
  const destroySpy = vi.fn((): undefined => undefined);
  return {
    width,
    height,
    createView: vi.fn(() => ({} as GPUTextureView)),
    destroy: destroySpy,
    destroySpy,
  } as unknown as FakeTexture;
}

function createPipeline(
  maxTextureDimension2D = 8192,
  model: OnnxUpscaleModelDefinition = ONNX_UPSCALE_MODELS['animejanai-x2'],
) {
  const createdTextures: FakeTexture[] = [];
  const device = {
    limits: { maxTextureDimension2D },
    createBuffer: vi.fn(() => ({ destroy: vi.fn() } as unknown as GPUBuffer)),
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => {
      const size = descriptor.size as [number, number, number];
      const texture = fakeTexture(size[0], size[1]);
      createdTextures.push(texture);
      return texture;
    }),
    createShaderModule: vi.fn(() => ({} as GPUShaderModule)),
    createComputePipeline: vi.fn(() => ({
      getBindGroupLayout: vi.fn(() => ({} as GPUBindGroupLayout)),
    } as unknown as GPUComputePipeline)),
    createBindGroup: vi.fn(() => ({} as GPUBindGroup)),
  } as unknown as GPUDevice;
  const runtime = {
    device,
    ort: {
      Tensor: { fromGpuBuffer: vi.fn(() => ({})) },
    },
    session: { release: vi.fn() },
    model,
  } as unknown as OnnxUpscaleRuntime;
  const input = fakeTexture(320, 180);
  const pipeline = OnnxUpscalePipeline.create(runtime, input);
  return { pipeline, device, createdTextures };
}

describe('ONNX upscale source texture rebinding', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUBufferUsage', { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, UNIFORM: 8 });
    vi.stubGlobal('GPUTextureUsage', { TEXTURE_BINDING: 1, STORAGE_BINDING: 2, COPY_SRC: 4 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reuses the loaded model while replacing size-dependent texture bindings', () => {
    const { pipeline, device, createdTextures } = createPipeline();
    const previousOutput = pipeline.getOutputTexture() as FakeTexture;

    pipeline.updateInputTexture(fakeTexture(640, 360));

    expect(pipeline.getOutputTexture()).toMatchObject({ width: 1280, height: 720 });
    expect(previousOutput.destroySpy).toHaveBeenCalledOnce();
    expect(device.createBindGroup).toHaveBeenCalledTimes(4);
    expect(createdTextures).toHaveLength(2);
  });

  it('keeps the current bindings when a resized output exceeds the GPU limit', () => {
    const { pipeline, device } = createPipeline(4096);
    const previousOutput = pipeline.getOutputTexture() as FakeTexture;

    expect(() => pipeline.updateInputTexture(fakeTexture(2560, 1440))).toThrow(/4096px texture limit/);
    expect(pipeline.getOutputTexture()).toBe(previousOutput);
    expect(previousOutput.destroySpy).not.toHaveBeenCalled();
    expect(device.createTexture).toHaveBeenCalledOnce();
  });

  it('uses rebinding instead of requesting a consumed model runtime on source resize', async () => {
    const renderer = Object.create(Renderer.prototype) as any;
    const nextInput = fakeTexture(640, 360);
    const nextOutput = fakeTexture(1280, 720);
    const updateInputTexture = vi.fn();
    renderer.rebuilding = false;
    renderer.destroyed = false;
    renderer.device = { queue: { onSubmittedWorkDone: vi.fn(() => Promise.resolve()) } } as unknown as GPUDevice;
    renderer.video = { videoWidth: 640, videoHeight: 360 } as HTMLVideoElement;
    renderer.effects = [{
      name: 'AnimeJaNai HD V3.1 Performance x2',
      id: 'animejanai/HD-V3.1/Performance/x2',
      className: 'AnimeJaNaiX2',
      upscaleFactor: 2,
      alwaysApply: true,
    }];
    renderer.targetDimensions = { width: 1920, height: 1080 };
    renderer.createSourceTexture = vi.fn(() => { renderer.videoFrameTexture = nextInput; });
    renderer.onnxUpscalePipeline = { updateInputTexture, getOutputTexture: () => nextOutput };
    renderer.buildPipelines = vi.fn(() => Promise.reject(new Error('must not rebuild the model')));
    renderer.createHistoryResources = vi.fn();
    renderer.createPresentationBindGroup = vi.fn();

    await renderer.rebuildForSourceResize();

    expect(updateInputTexture).toHaveBeenCalledWith(nextInput);
    expect(renderer.finalTexture).toBe(nextOutput);
    expect(renderer.buildPipelines).not.toHaveBeenCalled();
    expect(renderer.createHistoryResources).toHaveBeenCalledOnce();
    expect(renderer.createPresentationBindGroup).toHaveBeenCalledOnce();
    expect(renderer.rebuilding).toBe(false);
  });
});

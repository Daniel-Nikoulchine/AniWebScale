import { describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/core/renderer';

interface ProbeRenderer {
  gpu: unknown;
  deviceGeneration: number;
  device?: GPUDevice;
  video: { readyState: number; HAVE_CURRENT_DATA: number };
  sourceTextureFormat: GPUTextureFormat;
  logAdapterInfo(adapter: GPUAdapter): void;
  finishDeviceSetup(): void;
  createDevice(): Promise<void>;
  detectSourceTextureFormat(): Promise<GPUTextureFormat>;
}

function rendererWithGpu(gpu: unknown): ProbeRenderer {
  const renderer = Object.create(Renderer.prototype) as unknown as ProbeRenderer;
  renderer.gpu = gpu;
  renderer.deviceGeneration = 0;
  return renderer;
}

describe('renderer GPU provider seam', () => {
  it('creates the device through an injected requestDevice, never adapter.requestDevice', async () => {
    const device = { label: 'injected' } as unknown as GPUDevice;
    const adapterRequestDevice = vi.fn(() => {
      throw new Error('adapter.requestDevice must not be called when requestDevice is injected');
    });
    const requestDevice = vi.fn(async () => device);
    const gpu = {
      requestAdapter: vi.fn(async () => ({ requestDevice: adapterRequestDevice })),
      requestDevice,
    };
    const renderer = rendererWithGpu(gpu);
    renderer.logAdapterInfo = vi.fn();
    renderer.finishDeviceSetup = vi.fn();

    await renderer.createDevice();

    expect(requestDevice).toHaveBeenCalledOnce();
    expect(adapterRequestDevice).not.toHaveBeenCalled();
    expect(renderer.device).toBe(device);
  });

  it('falls back to adapter.requestDevice when no requestDevice is injected', async () => {
    const device = { label: 'adapter' } as unknown as GPUDevice;
    const adapterRequestDevice = vi.fn(async () => device);
    const gpu = {
      requestAdapter: vi.fn(async () => ({ requestDevice: adapterRequestDevice })),
    };
    const renderer = rendererWithGpu(gpu);
    renderer.logAdapterInfo = vi.fn();
    renderer.finishDeviceSetup = vi.fn();

    await renderer.createDevice();

    expect(adapterRequestDevice).toHaveBeenCalledOnce();
    expect(renderer.device).toBe(device);
  });

  async function detectWith(format: string): Promise<{ format: GPUTextureFormat; close: ReturnType<typeof vi.fn> }> {
    const close = vi.fn();
    const frame = { format, close } as unknown as VideoFrame;
    const createVideoFrame = vi.fn(() => frame);
    const renderer = rendererWithGpu({ createVideoFrame });
    renderer.video = { readyState: 2, HAVE_CURRENT_DATA: 2 };
    renderer.sourceTextureFormat = 'rgba8unorm';

    const detected = await renderer.detectSourceTextureFormat();
    expect(createVideoFrame).toHaveBeenCalledWith(renderer.video);
    return { format: detected, close };
  }

  it('uses an injected createVideoFrame and reports rgba16float for a high-bit frame', async () => {
    const { format, close } = await detectWith('I010');
    expect(format).toBe('rgba16float');
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports rgba8unorm for an 8-bit frame and closes the snapshot', async () => {
    const { format, close } = await detectWith('BGRA');
    expect(format).toBe('rgba8unorm');
    expect(close).toHaveBeenCalledOnce();
  });
});

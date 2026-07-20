import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/core/renderer';

function texture(width: number, height: number): GPUTexture {
  return {
    width,
    height,
    createView: vi.fn(() => ({} as GPUTextureView)),
    destroy: vi.fn(),
  } as unknown as GPUTexture;
}

describe('frame-generation presentation resources', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUTextureUsage', { TEXTURE_BINDING: 1, STORAGE_BINDING: 2 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('prebuilds both history orientations instead of allocating a bind group per frame', () => {
    const createdTextures: GPUTexture[] = [];
    const createBindGroup = vi.fn(() => ({ id: createBindGroup.mock.calls.length } as unknown as GPUBindGroup));
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.device = {
      createTexture: vi.fn((descriptor: GPUTextureDescriptor) => {
        const size = descriptor.size as [number, number, number];
        const result = texture(size[0], size[1]);
        createdTextures.push(result);
        return result;
      }),
      createBindGroup,
      createCommandEncoder: vi.fn(),
      queue: { writeBuffer: vi.fn() },
    } as unknown as GPUDevice;
    renderer.finalTexture = texture(1280, 720);
    renderer.frameGenerationEnabled = true;
    renderer.historyPipeline = {
      getBindGroupLayout: vi.fn(() => ({} as GPUBindGroupLayout)),
    } as unknown as GPUComputePipeline;
    renderer.renderBindGroupLayout = {} as GPUBindGroupLayout;
    renderer.sampler = {} as GPUSampler;
    renderer.presentationUniform = {} as GPUBuffer;
    renderer.historyTextures = null;
    renderer.previousHistoryTexture = null;
    renderer.currentHistoryTexture = null;
    renderer.previousHistoryBindGroup = null;
    renderer.currentHistoryBindGroup = null;
    renderer.historyPresentationBindGroups = null;
    renderer.historyPresentationIndex = 0;
    renderer.generatedFrameAnimationId = null;

    renderer.createHistoryResources();
    renderer.createPresentationBindGroup();

    expect(createdTextures).toHaveLength(2);
    expect(createBindGroup).toHaveBeenCalledTimes(4);
    const firstOrientation = renderer.renderBindGroup;

    const pass = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      end: vi.fn(),
    };
    const encoder = { beginComputePass: vi.fn(() => pass) } as unknown as GPUCommandEncoder;
    expect(renderer.prepareFrameGenerationHistory(encoder)).toBe(false);
    expect(renderer.prepareFrameGenerationHistory(encoder)).toBe(true);

    expect(createBindGroup).toHaveBeenCalledTimes(4);
    expect(renderer.renderBindGroup).not.toBe(firstOrientation);
  });

  it('flushes the latest real frame when playback stops between generated frames', () => {
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    const writeBuffer = vi.fn();
    const submit = vi.fn();
    const finish = vi.fn(() => ({} as GPUCommandBuffer));
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = { paused: true, ended: false };
    renderer.frameGenerationEnabled = true;
    renderer.historyReady = true;
    renderer.rebuilding = false;
    renderer.generatedFrameAnimationId = 42;
    renderer.presentationUniform = {} as GPUBuffer;
    renderer.device = {
      queue: { writeBuffer, submit },
      createCommandEncoder: vi.fn(() => ({ finish } as unknown as GPUCommandEncoder)),
    } as unknown as GPUDevice;
    renderer.encodePresentation = vi.fn();

    renderer.handlePlaybackStopped();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(renderer.generatedFrameAnimationId).toBeNull();
    expect(Array.from(writeBuffer.mock.calls[0][2] as Float32Array)).toEqual([1, 0, 0, 0]);
    expect(renderer.encodePresentation).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('defers the pause flush until an in-flight source frame has completed', () => {
    const writeBuffer = vi.fn();
    const submit = vi.fn();
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = { paused: true, ended: false };
    renderer.frameGenerationEnabled = true;
    renderer.historyReady = true;
    renderer.rebuilding = false;
    renderer.frameProcessing = true;
    renderer.generatedFrameAnimationId = null;
    renderer.presentationUniform = {} as GPUBuffer;
    renderer.device = {
      queue: { writeBuffer, submit },
      createCommandEncoder: vi.fn(() => ({ finish: vi.fn(() => ({} as GPUCommandBuffer)) })),
    } as unknown as GPUDevice;
    renderer.encodePresentation = vi.fn();

    renderer.handlePlaybackStopped();
    expect(writeBuffer).not.toHaveBeenCalled();
    expect(renderer.playbackFlushPending).toBe(true);

    renderer.frameProcessing = false;
    renderer.flushStoppedPlayback();

    expect(writeBuffer).toHaveBeenCalledOnce();
    expect(Array.from(writeBuffer.mock.calls[0][2] as Float32Array)).toEqual([1, 0, 0, 0]);
    expect(submit).toHaveBeenCalledOnce();
    expect(renderer.playbackFlushPending).toBe(false);
  });

  it('processes paused seek callbacks and requests a final current-frame flush', () => {
    const source = { paused: true, ended: false } as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = source;
    renderer.videoSourceRevision = 4;
    renderer.frameCallbackId = 17;
    renderer.playbackFlushPending = false;
    renderer.lastCallbackMediaTime = null;
    renderer.frameProcessing = false;
    renderer.rebuilding = false;
    renderer.startFrameCallbacks = vi.fn();
    renderer.stopGeneratedFrameAnimation = vi.fn();
    renderer.drainFrames = vi.fn();

    renderer.handleVideoFrame(source, 4, 0, { mediaTime: 1 } as VideoFrameCallbackMetadata);

    expect(renderer.startFrameCallbacks).toHaveBeenCalledOnce();
    expect(renderer.stopGeneratedFrameAnimation).toHaveBeenCalledOnce();
    expect(renderer.playbackFlushPending).toBe(true);
    expect(renderer.drainFrames).toHaveBeenCalledOnce();
  });

  it('ignores a callback queued by a video source that has since been replaced', () => {
    const oldSource = { paused: false, ended: false } as HTMLVideoElement;
    const currentSource = { paused: false, ended: false } as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = currentSource;
    renderer.videoSourceRevision = 5;
    renderer.frameCallbackId = 23;
    renderer.startFrameCallbacks = vi.fn();
    renderer.drainFrames = vi.fn();

    renderer.handleVideoFrame(oldSource, 4, 0, { mediaTime: 1 } as VideoFrameCallbackMetadata);

    expect(renderer.frameCallbackId).toBe(23);
    expect(renderer.startFrameCallbacks).not.toHaveBeenCalled();
    expect(renderer.drainFrames).not.toHaveBeenCalled();
  });

  it('resets first-frame readiness and renders the replacement source immediately', async () => {
    const oldSource = {
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;
    const replacement = {
      addEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = oldSource;
    renderer.videoSourceRevision = 2;
    renderer.firstFrameRendered = true;
    renderer.playbackStoppedHandler = vi.fn();
    renderer.stopFrameCallbacks = vi.fn();
    renderer.waitForFrameIdle = vi.fn(() => Promise.resolve());
    renderer.rebuildForSourceResize = vi.fn(async () => {
      expect(renderer.firstFrameRendered).toBe(false);
    });
    renderer.processFrame = vi.fn(async () => {
      renderer.firstFrameRendered = true;
      return true;
    });
    renderer.startFrameCallbacks = vi.fn();

    await renderer.applyVideoSource(replacement);

    expect(renderer.video).toBe(replacement);
    expect(renderer.videoSourceRevision).toBe(3);
    expect(renderer.rebuildForSourceResize).toHaveBeenCalledBefore(renderer.processFrame);
    expect(renderer.hasRenderedCurrentSource()).toBe(true);
    expect(renderer.startFrameCallbacks).toHaveBeenCalledOnce();
  });

  it('invalidates queued source callbacks before waiting for an in-flight frame', async () => {
    const oldSource = {
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;
    const replacement = {
      addEventListener: vi.fn(),
    } as unknown as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = oldSource;
    renderer.videoSourceRevision = 8;
    renderer.frameCallbackId = 31;
    renderer.firstFrameRendered = true;
    renderer.playbackStoppedHandler = vi.fn();
    renderer.stopFrameCallbacks = vi.fn(() => { renderer.frameCallbackId = null; });
    renderer.startFrameCallbacks = vi.fn();
    renderer.drainFrames = vi.fn();
    renderer.waitForFrameIdle = vi.fn(async () => {
      renderer.handleVideoFrame(
        oldSource,
        8,
        0,
        { mediaTime: 2 } as VideoFrameCallbackMetadata,
      );
    });
    renderer.rebuildForSourceResize = vi.fn(() => Promise.resolve());
    renderer.processFrame = vi.fn(() => Promise.resolve(true));

    await renderer.applyVideoSource(replacement);

    expect(renderer.videoSourceRevision).toBe(9);
    expect(renderer.drainFrames).not.toHaveBeenCalled();
    expect(renderer.startFrameCallbacks).toHaveBeenCalledOnce();
  });
});

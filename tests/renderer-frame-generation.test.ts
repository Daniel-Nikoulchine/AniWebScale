import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameGeneration, type FrameGenerationHost } from '../src/core/frame-generation';
import { Renderer } from '../src/core/renderer';

function texture(width: number, height: number): GPUTexture {
  return {
    width,
    height,
    createView: vi.fn(() => ({} as GPUTextureView)),
    destroy: vi.fn(),
  } as unknown as GPUTexture;
}

function frameGenerationHost(overrides: Partial<FrameGenerationHost> = {}): FrameGenerationHost {
  const base: FrameGenerationHost = {
    device: {
      createTexture: vi.fn(() => texture(1280, 720)),
      createBindGroup: vi.fn(() => ({} as GPUBindGroup)),
      createCommandEncoder: vi.fn(() => ({ finish: vi.fn(() => ({} as GPUCommandBuffer)) })),
      queue: { writeBuffer: vi.fn(), submit: vi.fn() },
    } as unknown as GPUDevice,
    presentationUniform: {} as GPUBuffer,
    renderBindGroupLayout: {} as GPUBindGroupLayout,
    sampler: {} as GPUSampler,
    video: { paused: false, ended: false } as HTMLVideoElement,
    finalTexture: texture(1280, 720),
    frameBudgetMs: 1000 / 24,
    frameGenerationEnabled: true,
    isDestroyed: () => false,
    isRebuilding: () => false,
    isFrameProcessing: () => false,
    refreshPresentationBindGroup: vi.fn(),
    encodePresentation: vi.fn(),
  };
  return { ...base, ...overrides };
}

/** Build the history and seed it with one frame so it is ready to present. */
function seedHistory(generation: FrameGeneration): void {
  generation.createResources();
  generation.prepareFrame({ copyTextureToTexture: vi.fn() } as unknown as GPUCommandEncoder);
}

describe('frame-generation presentation resources', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUTextureUsage', {
      COPY_SRC: 1,
      COPY_DST: 2,
      TEXTURE_BINDING: 4,
      STORAGE_BINDING: 8,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('prebuilds both history orientations and copies history via the DMA path', () => {
    const createdTextures: GPUTexture[] = [];
    const createBindGroup = vi.fn(() => ({ id: createBindGroup.mock.calls.length } as unknown as GPUBindGroup));
    const createTexture = vi.fn((descriptor: GPUTextureDescriptor) => {
      const size = descriptor.size as [number, number, number];
      const result = texture(size[0], size[1]);
      createdTextures.push(result);
      return result;
    });
    const writeBuffer = vi.fn();
    const refreshPresentationBindGroup = vi.fn();
    const host = frameGenerationHost({
      device: {
        createTexture,
        createBindGroup,
        createCommandEncoder: vi.fn(),
        queue: { writeBuffer },
      } as unknown as GPUDevice,
      finalTexture: texture(1280, 720),
      refreshPresentationBindGroup,
    });
    const generation = new FrameGeneration(host);

    generation.createResources();

    expect(createdTextures).toHaveLength(2);
    expect(createTexture.mock.calls[0][0].usage).toBe(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST);
    expect(createBindGroup).toHaveBeenCalledTimes(2);
    const firstOrientation = generation.activeBindGroup;
    expect(firstOrientation).not.toBeNull();
    const [initialPrevious, initialCurrent] = createdTextures;

    const copyTextureToTexture = vi.fn();
    const encoder = { copyTextureToTexture } as unknown as GPUCommandEncoder;
    expect(generation.prepareFrame(encoder)).toBe(false);
    expect(copyTextureToTexture).toHaveBeenCalledTimes(2);
    expect(copyTextureToTexture).toHaveBeenNthCalledWith(
      1,
      { texture: host.finalTexture },
      { texture: initialPrevious },
      [1280, 720, 1],
    );
    expect(copyTextureToTexture).toHaveBeenNthCalledWith(
      2,
      { texture: host.finalTexture },
      { texture: initialCurrent },
      [1280, 720, 1],
    );
    expect(Array.from(writeBuffer.mock.calls[0][2] as Float32Array)).toEqual([1, 0, 0, 0]);

    expect(generation.prepareFrame(encoder)).toBe(true);
    expect(copyTextureToTexture).toHaveBeenCalledTimes(3);
    // The swap made the initial previous texture current again, so the fresh
    // frame lands there.
    expect(copyTextureToTexture).toHaveBeenNthCalledWith(
      3,
      { texture: host.finalTexture },
      { texture: initialPrevious },
      [1280, 720, 1],
    );
    expect(Array.from(writeBuffer.mock.calls.at(-1)![2] as Float32Array)).toEqual([0, 0, 0, 0]);
    expect(refreshPresentationBindGroup).toHaveBeenCalledOnce();
    expect(generation.activeBindGroup).not.toBe(firstOrientation);
  });

  it('flushes the latest real frame when playback stops between generated frames', () => {
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn(() => 42);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    const writeBuffer = vi.fn();
    const submit = vi.fn();
    const encodePresentation = vi.fn();
    const videoState = { paused: false, ended: false };
    const host = frameGenerationHost({
      video: videoState as unknown as HTMLVideoElement,
      device: {
        createTexture: vi.fn(() => texture(1280, 720)),
        createBindGroup: vi.fn(() => ({} as GPUBindGroup)),
        createCommandEncoder: vi.fn(() => ({ finish: vi.fn(() => ({} as GPUCommandBuffer)) })),
        queue: { writeBuffer, submit },
      } as unknown as GPUDevice,
      encodePresentation,
    });
    const generation = new FrameGeneration(host);
    seedHistory(generation);
    generation.scheduleIntermediate();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    videoState.paused = true;
    generation.onPlaybackStopped();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(Array.from(writeBuffer.mock.calls.at(-1)![2] as Float32Array)).toEqual([1, 0, 0, 0]);
    expect(encodePresentation).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('defers the pause flush until an in-flight source frame has completed', () => {
    let frameProcessing = true;
    const writeBuffer = vi.fn();
    const submit = vi.fn();
    const encodePresentation = vi.fn();
    const host = frameGenerationHost({
      video: { paused: true, ended: false } as HTMLVideoElement,
      isFrameProcessing: () => frameProcessing,
      device: {
        createTexture: vi.fn(() => texture(1280, 720)),
        createBindGroup: vi.fn(() => ({} as GPUBindGroup)),
        createCommandEncoder: vi.fn(() => ({ finish: vi.fn(() => ({} as GPUCommandBuffer)) })),
        queue: { writeBuffer, submit },
      } as unknown as GPUDevice,
      encodePresentation,
    });
    const generation = new FrameGeneration(host);
    seedHistory(generation);
    const writesAfterSeed = writeBuffer.mock.calls.length;

    generation.onPlaybackStopped();
    expect(writeBuffer.mock.calls.length).toBe(writesAfterSeed);
    expect(encodePresentation).not.toHaveBeenCalled();

    frameProcessing = false;
    generation.flush();

    expect(writeBuffer.mock.calls.length).toBe(writesAfterSeed + 1);
    expect(Array.from(writeBuffer.mock.calls.at(-1)![2] as Float32Array)).toEqual([1, 0, 0, 0]);
    expect(encodePresentation).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();

    // The pending flag was consumed: a second flush stays quiet.
    generation.flush();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('processes paused seek callbacks and requests a final current-frame flush', () => {
    const source = { paused: true, ended: false } as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = source;
    renderer.videoSourceRevision = 4;
    renderer.frameCallbackId = 17;
    renderer.lastCallbackMediaTime = null;
    renderer.frameProcessing = false;
    renderer.rebuilding = false;
    renderer.startFrameCallbacks = vi.fn();
    renderer.frameGeneration = { markPausedForSeek: vi.fn(), flush: vi.fn() };
    renderer.drainFrames = vi.fn();

    renderer.handleVideoFrame(source, 4, 0, { mediaTime: 1 } as VideoFrameCallbackMetadata);

    expect(renderer.startFrameCallbacks).toHaveBeenCalledOnce();
    expect(renderer.frameGeneration.markPausedForSeek).toHaveBeenCalledOnce();
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
      readyState: 4,
      HAVE_METADATA: 1,
      videoWidth: 640,
      videoHeight: 360,
    } as unknown as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = oldSource;
    renderer.videoFrameTexture = texture(1280, 720);
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
      readyState: 4,
      HAVE_METADATA: 1,
      videoWidth: 640,
      videoHeight: 360,
    } as unknown as HTMLVideoElement;
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = oldSource;
    renderer.videoFrameTexture = texture(1280, 720);
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

  it('returns from processFrame before the GPU completes and reports stats on completion', async () => {
    let resolveCompletion: () => void;
    const completion = new Promise<void>(resolve => { resolveCompletion = resolve; });
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.rebuilding = false;
    renderer.video = {
      readyState: 2,
      HAVE_CURRENT_DATA: 2,
      paused: false,
      ended: false,
      videoWidth: 640,
      videoHeight: 360,
    };
    renderer.videoFrameTexture = texture(640, 360);
    renderer.copyCurrentVideoFrame = vi.fn(async () => undefined);
    renderer.pipelines = [];
    renderer.frameGeneration = { prepareFrame: vi.fn(() => false), scheduleIntermediate: vi.fn() };
    renderer.encodePresentation = vi.fn();
    renderer.recordStats = vi.fn();
    renderer.firstFrameRendered = false;
    renderer.onFirstFrameRendered = vi.fn();
    renderer.sourceDepthChecked = true;
    renderer.frameCompletion = null;
    renderer.device = {
      createCommandEncoder: vi.fn(() => ({ finish: vi.fn() })),
      queue: {
        submit: vi.fn(),
        onSubmittedWorkDone: vi.fn(() => completion),
      },
    };

    await expect(renderer.processFrame()).resolves.toBe(true);
    expect(renderer.device.queue.submit).toHaveBeenCalledOnce();
    // The frame loop must not wait for the GPU round trip: bookkeeping runs
    // only once the queue reports the submitted work as done.
    expect(renderer.recordStats).not.toHaveBeenCalled();
    expect(renderer.onFirstFrameRendered).not.toHaveBeenCalled();

    resolveCompletion!();
    await renderer.frameCompletion;

    expect(renderer.recordStats).toHaveBeenCalledOnce();
    expect(renderer.onFirstFrameRendered).toHaveBeenCalledWith(renderer.video);
    expect(renderer.firstFrameRendered).toBe(true);
  });

  it('waits for in-flight GPU work before releasing resources on destroy', async () => {
    let resolveCompletion: () => void;
    const completion = new Promise<void>(resolve => { resolveCompletion = resolve; });
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.frameProcessing = false;
    renderer.frameCompletion = completion.catch(() => undefined);
    renderer.video = { removeEventListener: vi.fn() };
    renderer.playbackStoppedHandler = vi.fn();
    renderer.stopFrameCallbacks = vi.fn();
    renderer.frameGeneration = { destroy: vi.fn(), destroyResources: vi.fn() };
    renderer.cleanupScheduled = false;
    renderer.waitForFrameIdle = vi.fn(async () => undefined);
    renderer.releaseResources = vi.fn();

    renderer.destroy();
    expect(renderer.frameGeneration.destroy).toHaveBeenCalledOnce();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(renderer.releaseResources).not.toHaveBeenCalled();

    resolveCompletion!();
    await completion.catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderer.releaseResources).toHaveBeenCalledOnce();
  });
});

describe('source texture format detection', () => {
  afterEach(() => vi.unstubAllGlobals());

  function formatProbeRenderer(format: string | null): any {
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    renderer.video = { readyState: 2, HAVE_CURRENT_DATA: 2 };
    renderer.videoFrameTexture = { ...texture(640, 360), format };
    renderer.sourceTextureFormat = 'rgba8unorm';
    renderer.sourceDepthChecked = false;
    renderer.sourceFormatStale = false;
    return renderer;
  }

  it('promotes the source texture to rgba16float once a 10-bit stream is detected', async () => {
    const close = vi.fn();
    vi.stubGlobal('VideoFrame', class { public format = 'I420P10'; public close = close; });
    const renderer = formatProbeRenderer('rgba8unorm');

    renderer.probeSourceTextureFormat();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(close).toHaveBeenCalledOnce();
    expect(renderer.sourceDepthChecked).toBe(true);
    expect(renderer.sourceTextureFormat).toBe('rgba16float');
    expect(renderer.sourceFormatStale).toBe(true);

    // The stale flag must route the next frame through the rebuild path
    // instead of copying into a texture with the wrong format.
    renderer.video.videoWidth = 640;
    renderer.video.videoHeight = 360;
    renderer.rebuilding = false;
    renderer.rebuildForSourceResize = vi.fn(async () => { renderer.sourceFormatStale = false; });
    await expect(renderer.processFrame()).resolves.toBe(false);
    expect(renderer.rebuildForSourceResize).toHaveBeenCalledOnce();
  });

  it('keeps rgba8unorm for 8-bit formats and stays quiet when formats match', async () => {
    vi.stubGlobal('VideoFrame', class { public format = 'I420'; public close = vi.fn(); });
    const renderer = formatProbeRenderer('rgba8unorm');

    renderer.probeSourceTextureFormat();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderer.sourceTextureFormat).toBe('rgba8unorm');
    expect(renderer.sourceFormatStale).toBe(false);
  });

  it('falls back to rgba8unorm when the frame cannot be snapshotted', async () => {
    vi.stubGlobal('VideoFrame', class {
      constructor() { throw new DOMException('tainted', 'SecurityError'); }
    });
    const renderer = formatProbeRenderer('rgba8unorm');

    renderer.probeSourceTextureFormat();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderer.sourceTextureFormat).toBe('rgba8unorm');
    expect(renderer.sourceFormatStale).toBe(false);
  });

  it('skips detection before the video has presentable data', async () => {
    const renderer = formatProbeRenderer('rgba8unorm');
    renderer.video.readyState = 1;

    await expect(renderer.detectSourceTextureFormat()).resolves.toBe('rgba8unorm');
  });
});

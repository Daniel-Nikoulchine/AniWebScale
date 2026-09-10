import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameGeneration, type FrameGenerationHistory, type FrameGenerationHost } from '../src/core/frame-generation';
import { Renderer } from '../src/core/renderer';

function texture(width: number, height: number): GPUTexture {
  return {
    width,
    height,
    createView: vi.fn(() => ({} as GPUTextureView)),
    destroy: vi.fn(),
  } as unknown as GPUTexture;
}

function makeHistory(): FrameGenerationHistory {
  return { seed: vi.fn(), capture: vi.fn(), swap: vi.fn() };
}

function frameGenerationHost(overrides: Partial<FrameGenerationHost> = {}): FrameGenerationHost {
  const base: FrameGenerationHost = {
    video: { paused: false, ended: false } as HTMLVideoElement,
    frameBudgetMs: 1000 / 24,
    frameGenerationEnabled: true,
    isDestroyed: () => false,
    isRebuilding: () => false,
    isFrameProcessing: () => false,
    ensureHistory: vi.fn(() => makeHistory()),
    releaseHistory: vi.fn(),
    writePresentationFactor: vi.fn(),
    presentFrame: vi.fn(),
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

  it('seeds both history orientations, then swaps and captures the next frame', () => {
    const history = makeHistory();
    const ensureHistory = vi.fn(() => history);
    const writePresentationFactor = vi.fn();
    const host = frameGenerationHost({ ensureHistory, writePresentationFactor });
    const generation = new FrameGeneration(host);

    generation.createResources();
    expect(ensureHistory).toHaveBeenCalledOnce();

    const encoder = { copyTextureToTexture: vi.fn() } as unknown as GPUCommandEncoder;
    expect(generation.prepareFrame(encoder)).toBe(false);
    expect(history.seed).toHaveBeenCalledOnce();
    expect(history.swap).not.toHaveBeenCalled();
    expect(Array.from(writePresentationFactor.mock.calls[0][0] as Float32Array)).toEqual([1, 0, 0, 0]);

    expect(generation.prepareFrame(encoder)).toBe(true);
    expect(history.swap).toHaveBeenCalledOnce();
    expect(history.capture).toHaveBeenCalledOnce();
    expect(Array.from(writePresentationFactor.mock.calls.at(-1)![0] as Float32Array)).toEqual([0, 0, 0, 0]);
  });

  it('releases the history the host owns when resources are rebuilt', () => {
    const releaseHistory = vi.fn();
    const host = frameGenerationHost({ releaseHistory });
    const generation = new FrameGeneration(host);

    generation.createResources();
    expect(generation.historyAvailable).toBe(true);
    generation.createResources();
    // Each createResources releases the previous history before ensuring the
    // new one, so the host has released twice after the rebuild.
    expect(releaseHistory).toHaveBeenCalledTimes(2);
    generation.destroyResources();
    expect(releaseHistory).toHaveBeenCalledTimes(3);
    expect(generation.historyAvailable).toBe(false);
  });

  it('flushes the latest real frame when playback stops between generated frames', () => {
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn(() => 42);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    const presentFrame = vi.fn();
    const videoState = { paused: false, ended: false };
    const host = frameGenerationHost({
      video: videoState as unknown as HTMLVideoElement,
      presentFrame,
    });
    const generation = new FrameGeneration(host);
    seedHistory(generation);
    generation.scheduleIntermediate();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    videoState.paused = true;
    generation.onPlaybackStopped();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(presentFrame).toHaveBeenCalledOnce();
    expect(Array.from(presentFrame.mock.calls[0][0] as Float32Array)).toEqual([1, 0, 0, 0]);
    expect(presentFrame.mock.calls[0][1]).toBe('Frame generation pause flush');
  });

  it('defers the pause flush until an in-flight source frame has completed', () => {
    let frameProcessing = true;
    const presentFrame = vi.fn();
    const host = frameGenerationHost({
      video: { paused: true, ended: false } as HTMLVideoElement,
      isFrameProcessing: () => frameProcessing,
      presentFrame,
    });
    const generation = new FrameGeneration(host);
    seedHistory(generation);

    generation.onPlaybackStopped();
    expect(presentFrame).not.toHaveBeenCalled();

    frameProcessing = false;
    generation.flush();

    expect(presentFrame).toHaveBeenCalledOnce();
    expect(Array.from(presentFrame.mock.calls[0][0] as Float32Array)).toEqual([1, 0, 0, 0]);

    // The pending flag was consumed: a second flush stays quiet.
    generation.flush();
    expect(presentFrame).toHaveBeenCalledOnce();
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

  it('drops the frame instead of killing the loop when history encode fails', async () => {
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
    renderer.sourceFormatStale = false;
    renderer.copyCurrentVideoFrame = vi.fn(async () => undefined);
    renderer.pipelines = [];
    renderer.frameGeneration = {
      prepareFrame: vi.fn(() => { throw new Error('lost device'); }),
    };
    renderer.encodePresentation = vi.fn();
    renderer.runAfterSubmit = vi.fn();
    renderer.droppedFrames = 0;
    renderer.onError = vi.fn();
    renderer.device = {
      createCommandEncoder: vi.fn(() => ({ finish: vi.fn() })),
      queue: {},
    };

    // A throwing prepareFrame used to escape into drainFrames' onError and
    // stop the whole frame loop; like the pass/presentation guards it must
    // drop exactly this frame.
    await expect(renderer.processFrame()).resolves.toBe(false);
    expect(renderer.droppedFrames).toBe(1);
    expect(renderer.encodePresentation).not.toHaveBeenCalled();
    expect(renderer.runAfterSubmit).toHaveBeenCalledOnce();
    expect(renderer.onError).not.toHaveBeenCalled();
  });
});

describe('source texture format detection', () => {
  afterEach(() => vi.unstubAllGlobals());

  function formatProbeRenderer(format: string | null): any {
    const renderer = Object.create(Renderer.prototype) as any;
    renderer.destroyed = false;
    // Production always injects the GPU provider (initialize rejects otherwise);
    // an empty provider keeps the new VideoFrame path under test.
    renderer.gpu = {};
    renderer.video = { readyState: 2, HAVE_CURRENT_DATA: 2 };
    renderer.videoFrameTexture = { ...texture(640, 360), format };
    renderer.sourceTextureFormat = 'rgba8unorm';
    renderer.sourceDepthChecked = false;
    renderer.sourceFormatStale = false;
    return renderer;
  }

  it('promotes the source texture to rgba16float once a 10-bit stream is detected', async () => {
    const close = vi.fn();
    vi.stubGlobal('VideoFrame', class { public format = 'P010'; public close = close; });
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

  it.each(['I420P10', 'I422P12', 'I444P16'])('recognizes planar high-bit format %s', async format => {
    vi.stubGlobal('VideoFrame', class { public format = format; public close = vi.fn(); });
    const renderer = formatProbeRenderer('rgba8unorm');

    await expect(renderer.detectSourceTextureFormat()).resolves.toBe('rgba16float');
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

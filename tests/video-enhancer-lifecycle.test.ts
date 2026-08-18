import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIME4K_APPLIED_ATTR } from '../src/constants';
import { Renderer } from '../src/core/renderer';
import type { RendererOptions } from '../src/core/renderer';
import { VideoEnhancer } from '../src/core/video-enhancer';
import { createNativeSessionClient } from '../src/core/native-session-client';
import { BackendState } from '../src/core/backend-state';
import { OverloadTracker } from '../src/core/render-stats';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createBareEnhancer() {
  const canvas = { width: 0, height: 0 };
  const video = {
    HAVE_METADATA: 1,
    readyState: 1,
    videoWidth: 640,
    videoHeight: 360,
    mediaKeys: null,
    paused: false,
    ended: false,
    currentTime: 0,
    dataset: { anime4kVideoId: 'video-1' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    })),
  };
  const overlay = {
    getCanvas: vi.fn(() => canvas),
    showCanvas: vi.fn(),
    hideCanvas: vi.fn(),
    setStats: vi.fn(),
    setWarning: vi.fn(),
    destroy: vi.fn(),
    detach: vi.fn(),
    reattach: vi.fn(),
  };
  const fullscreenLayout = {
    enter: vi.fn(),
    exit: vi.fn(),
    updateVideo: vi.fn(),
  };
  const targetResizeObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
  const enhancer = Object.create(VideoEnhancer.prototype) as any;
  Object.assign(enhancer, {
    video,
    videoId: 'video-1',
    native: createNativeSessionClient(),
    renderer: null,
    backend: new BackendState(),
    nativeSessionId: null,
    currentModeId: null,
    currentSettings: null,
    overlay,
    fullscreenLayout,
    encryptedDetected: false,
    performanceWarning: false,
    oversharpenWarning: false,
    nativeOverloadTracker: new OverloadTracker(),
    lastNativeDroppedFrames: 0,
    lastRenderStats: null,
    destroyed: false,
    switchingFromNative: false,
    targetResizeObserver,
    unsubscribeFullscreenContext: () => undefined,
    fullscreenRevision: 0,
    transitionChain: Promise.resolve(),
    automaticSession: false,
    nativeRetryBlocked: false,
  });
  return { enhancer, video, overlay, fullscreenLayout, targetResizeObserver };
}

describe('VideoEnhancer lifecycle transitions', () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let setIntervalSpy: ReturnType<typeof vi.fn>;
  let clearIntervalSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn(async (message: Record<string, unknown>) => (
      message.type === 'ENHANCEMENT_CLAIM' ? { ok: true } : { ok: true }
    ));
    setIntervalSpy = vi.fn(() => 71);
    clearIntervalSpy = vi.fn();
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    vi.stubGlobal('navigator', { gpu: {} });
    vi.stubGlobal('location', { hostname: 'example.com' });
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      screen: { width: 1920, height: 1080 },
      setInterval: setIntervalSpy,
      clearInterval: clearIntervalSpy,
      setTimeout: vi.fn(() => 72),
      clearTimeout: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    (VideoEnhancer as any).activeEnhancer = null;
  });

  afterEach(() => {
    (VideoEnhancer as any).activeEnhancer = null;
    vi.unstubAllGlobals();
  });

  it('destroys a WebGPU renderer that finishes creating after destroy', async () => {
    const creation = deferred<Renderer>();
    const renderer = { destroy: vi.fn() } as unknown as Renderer;
    let options: RendererOptions | undefined;
    vi.spyOn(Renderer, 'create').mockImplementation(async createOptions => {
      options = createOptions;
      return creation.promise;
    });
    const { enhancer, video, overlay } = createBareEnhancer();

    const starting = enhancer.startEnhancement({ ...DEFAULT_SETTINGS, backend: 'webgpu' });
    await vi.waitFor(() => expect(options).toBeDefined());

    enhancer.destroy();
    options?.onFirstFrameRendered?.(video as unknown as HTMLVideoElement);
    options?.onStats?.({ fps: 60, renderMs: 5, droppedFrames: 0, warning: false });
    creation.resolve(renderer);
    await starting;

    expect(renderer.destroy).toHaveBeenCalledOnce();
    expect(enhancer.renderer).toBeNull();
    expect(overlay.showCanvas).not.toHaveBeenCalled();
    expect(overlay.setStats).not.toHaveBeenCalledWith(expect.objectContaining({ fps: 60 }));
    expect(video.setAttribute).not.toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR, 'true');
    expect((VideoEnhancer as any).activeEnhancer).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('stops a pending native start without reviving state after its late response', async () => {
    const nativeStart = deferred<{ ok: boolean; status: 'started'; sessionId: string }>();
    sendMessage.mockImplementation(async (message: Record<string, unknown>) => {
      if (message.type === 'NATIVE_FALLBACK_REQUEST') return nativeStart.promise;
      return { ok: true };
    });
    const { enhancer, video } = createBareEnhancer();

    const starting = enhancer.startEnhancement({ ...DEFAULT_SETTINGS, backend: 'native' });
    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'NATIVE_FALLBACK_REQUEST' }));
    });

    enhancer.backend.markNativeActive();
    enhancer.nativePlaybackTimer = 41;
    (VideoEnhancer as any).activeEnhancer = enhancer;
    const stopping = enhancer.stopEnhancement();

    expect(enhancer.backend.isNativeActive).toBe(false);
    expect(enhancer.nativePlaybackTimer).toBeUndefined();
    expect(clearIntervalSpy).toHaveBeenCalledWith(41);
    expect(video.removeAttribute).toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR);
    expect((VideoEnhancer as any).activeEnhancer).toBeNull();
    await stopping;

    nativeStart.resolve({ ok: true, status: 'started', sessionId: 'session-late' });
    await starting;

    expect(enhancer.backend.isNativeActive).toBe(false);
    expect(enhancer.currentModeId).toBeNull();
    expect(video.setAttribute).not.toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR, 'true');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    // The client ledger absorbs the late session: exactly one effective stop
    // for the late session id is issued (the marker stop carries no session).
    const stops = sendMessage.mock.calls.filter(([message]) => message.type === 'NATIVE_STOP');
    expect(stops.filter(([message]) => message.sessionId === 'session-late')).toHaveLength(1);
    expect(stops.every(([message]) => message.videoId === 'video-1')).toBe(true);
  });

  it('retargets a renderer that completes after the site replaces its video node', async () => {
    const creation = deferred<Renderer>();
    let options: RendererOptions | undefined;
    const renderer = {
      destroy: vi.fn(),
      updateVideoSource: vi.fn(() => Promise.resolve()),
      updateConfiguration: vi.fn(() => Promise.resolve()),
      hasRenderedCurrentSource: vi.fn(() => false),
    } as unknown as Renderer;
    vi.spyOn(Renderer, 'create').mockImplementation(createOptions => {
      options = createOptions;
      return creation.promise;
    });
    const { enhancer, video, overlay } = createBareEnhancer();
    const replacement = {
      ...video,
      dataset: { anime4kVideoId: 'video-1' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };

    const starting = enhancer.startEnhancement({ ...DEFAULT_SETTINGS, backend: 'webgpu' });
    await vi.waitFor(() => expect(options).toBeDefined());
    options?.onFirstFrameRendered?.(video as unknown as HTMLVideoElement);
    await enhancer.reattach(replacement);
    creation.resolve(renderer);
    await starting;

    expect(renderer.updateVideoSource).toHaveBeenCalledWith(replacement);
    expect(renderer.destroy).not.toHaveBeenCalled();
    expect(enhancer.renderer).toBe(renderer);
    expect(overlay.showCanvas).not.toHaveBeenCalled();
    options?.onFirstFrameRendered?.(replacement as unknown as HTMLVideoElement);
    expect(overlay.showCanvas).toHaveBeenCalledOnce();
    expect(replacement.setAttribute).toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR, 'true');
    expect(video.setAttribute).not.toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR, 'true');
  });

  it('routes replacement-frame failures through the renderer fallback path', async () => {
    const failure = new Error('replacement import failed');
    const renderer = {
      updateVideoSource: vi.fn(() => Promise.reject(failure)),
      destroy: vi.fn(),
    };
    const { enhancer, video } = createBareEnhancer();
    const replacement = {
      ...video,
      dataset: { anime4kVideoId: 'video-1' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    enhancer.renderer = renderer;
    enhancer.handleRendererError = vi.fn(async () => {
      enhancer.renderer = null;
      enhancer.backend.markNativeActive();
    });

    await expect(enhancer.reattach(replacement)).resolves.toBeUndefined();

    expect(enhancer.handleRendererError).toHaveBeenCalledWith(failure);
    expect(replacement.setAttribute).toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR, 'true');
  });

  it('rolls back enhancer settings when a live renderer rejects a configuration', async () => {
    const { enhancer, overlay } = createBareEnhancer();
    const previousSettings = { ...DEFAULT_SETTINGS, backend: 'webgpu' as const };
    const renderer = {
      updateConfiguration: vi.fn(() => Promise.reject(new Error('shader compile failed'))),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    };
    enhancer.renderer = renderer;
    enhancer.currentSettings = previousSettings;
    enhancer.currentModeId = 'previous-mode';
    enhancer.oversharpenWarning = true;

    await expect(enhancer.updateSettings({
      ...previousSettings,
      mode: 'B',
    })).rejects.toThrow('shader compile failed');

    expect(enhancer.currentSettings).toBe(previousSettings);
    expect(enhancer.currentModeId).toBe('previous-mode');
    expect(enhancer.oversharpenWarning).toBe(true);
    expect(enhancer.renderer).toBe(renderer);
    expect(overlay.hideCanvas).not.toHaveBeenCalled();
  });

  it('clears a renderer that failed after replacing its GPU resources', async () => {
    const { enhancer, video, overlay } = createBareEnhancer();
    const previousSettings = { ...DEFAULT_SETTINGS, backend: 'webgpu' as const };
    const renderer = {
      updateConfiguration: vi.fn(() => Promise.reject(new Error('history allocation failed'))),
      isDestroyed: vi.fn(() => true),
      destroy: vi.fn(),
    };
    enhancer.renderer = renderer;
    enhancer.currentSettings = previousSettings;
    enhancer.currentModeId = 'previous-mode';
    (VideoEnhancer as any).activeEnhancer = enhancer;

    await expect(enhancer.updateSettings({
      ...previousSettings,
      mode: 'B',
    })).rejects.toThrow('history allocation failed');

    expect(enhancer.renderer).toBeNull();
    expect(renderer.destroy).toHaveBeenCalledOnce();
    expect(overlay.hideCanvas).toHaveBeenCalledOnce();
    expect(video.removeAttribute).toHaveBeenCalledWith(ANIME4K_APPLIED_ATTR);
    expect((VideoEnhancer as any).activeEnhancer).toBeNull();
  });

  it('serializes overlapping settings updates for one enhancer', async () => {
    const firstUpdate = deferred<void>();
    const { enhancer } = createBareEnhancer();
    const previousSettings = { ...DEFAULT_SETTINGS, backend: 'webgpu' as const };
    const renderer = {
      updateConfiguration: vi.fn()
        .mockImplementationOnce(() => firstUpdate.promise)
        .mockResolvedValueOnce(undefined),
      isDestroyed: vi.fn(() => false),
      destroy: vi.fn(),
    };
    enhancer.renderer = renderer;
    enhancer.currentSettings = previousSettings;

    const first = enhancer.updateSettings({ ...previousSettings, mode: 'B' });
    const second = enhancer.updateSettings({ ...previousSettings, mode: 'C' });
    await vi.waitFor(() => expect(renderer.updateConfiguration).toHaveBeenCalledTimes(1));

    firstUpdate.resolve();
    await first;
    await second;

    expect(renderer.updateConfiguration).toHaveBeenCalledTimes(2);
    expect(enhancer.currentSettings.mode).toBe('C');
  });
});

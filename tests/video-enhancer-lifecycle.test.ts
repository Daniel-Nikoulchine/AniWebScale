import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIME4K_APPLIED_ATTR } from '../src/constants';
import { Renderer } from '../src/core/renderer';
import type { RendererOptions } from '../src/core/renderer';
import { VideoEnhancer } from '../src/core/video-enhancer';
import { createNativeSessionClient } from '../src/core/native-session-client';
import { BackendState } from '../src/core/backend-state';
import { EnhancerLifecycle } from '../src/core/enhancer-lifecycle';
import { NativeSwitchLedger } from '../src/core/native-switch';
import { EventScope } from '../src/shared/event-scope';
import { DEFAULT_SETTINGS, getSettings } from '../src/utils/settings';
import { fullscreenContext } from '../src/core/fullscreen-context';
import { EnhancerStatsConsumer } from '../src/core/enhancer-stats-consumer';
import { FullscreenReconciler } from '../src/core/enhancer-fullscreen-reconciler';
import { NativeSessionObserver } from '../src/core/enhancer-native-observer';

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
    // Attached by default (production managed videos are connected except
    // across the stash window); detached is set explicitly per test.
    isConnected: true,
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
    currentModeId: null,
    currentSettings: null,
    overlay,
    fullscreenLayout,
    encryptedDetected: false,
    destroyed: false,
    targetResizeObserver,
    unsubscribeFullscreenContext: () => undefined,
    lifecycle: new EnhancerLifecycle(),
    nativeSwitch: new NativeSwitchLedger(),
    events: new EventScope(),
    videoEvents: new EventScope(),
    encryptedHandler: () => undefined,
    mediaActivityHandler: () => undefined,
    videoFrameHandler: () => undefined,
    targetChangeHandler: () => undefined,
    fullscreenChangeHandler: () => undefined,
    windowScrollHandler: () => undefined,
  });
  // White-box harness: wire the same collaborators the production constructor
  // builds, instead of duplicating their behavior, so the harness cannot
  // desync from the facade.
  enhancer.statsConsumer = new EnhancerStatsConsumer({
    isDestroyed: () => enhancer.destroyed,
    getSettings: () => enhancer.currentSettings,
    getRenderer: () => enhancer.renderer,
    isWebGPUActive: () => enhancer.backend.isWebGPUActive,
    getVideo: () => enhancer.video,
    getCanvas: () => enhancer.overlay.getCanvas(),
    setOverlayStats: stats => enhancer.overlay.setStats(stats),
    enqueue: operation => enhancer.lifecycle.enqueue(operation),
    onRendererError: error => enhancer.handleRendererError(error),
  });
  enhancer.reconciler = new FullscreenReconciler({
    isDestroyed: () => enhancer.destroyed,
    getVideo: () => enhancer.video,
    getSettings: () => enhancer.currentSettings,
    setSettings: settings => { enhancer.currentSettings = settings; },
    loadSettings: () => getSettings(),
    hasRenderer: () => enhancer.renderer !== null,
    isNativeActive: () => enhancer.backend.isNativeActive,
    isStarting: () => enhancer.backend.isStarting,
    hasActiveFallback: () => enhancer.native.hasActiveFallback(enhancer.videoId),
    hasPendingFallback: () => enhancer.native.hasPendingFallback(enhancer.videoId),
    enterLayout: () => enhancer.fullscreenLayout.enter(),
    exitLayout: () => enhancer.fullscreenLayout.exit(),
    start: settings => enhancer.startEnhancement(settings),
    stop: () => enhancer.stopEnhancement(),
    beginReconcile: () => enhancer.lifecycle.beginReconcile(),
    isReconcileCurrent: (token: number) => enhancer.lifecycle.isReconcileCurrent(token),
    enqueue: operation => enhancer.lifecycle.enqueue(operation),
  });
  enhancer.nativeObserver = new NativeSessionObserver({
    isDestroyed: () => enhancer.destroyed,
    isNativeActive: () => enhancer.backend.isNativeActive,
    getVideo: () => enhancer.video,
    getVideoId: () => enhancer.videoId,
    isAbandonedSwitchCurrent: () => enhancer.nativeSwitch.isCurrent((revision: number) => enhancer.lifecycle.isCurrent(revision)),
    abandonsSwitch: sessionId => enhancer.nativeSwitch.abandons(sessionId),
    recordStats: stats => enhancer.handleStats(stats),
    markIdle: () => enhancer.backend.markIdle(),
    blockAutoRetry: () => enhancer.reconciler.blockAutoRetry(),
    scheduleFullscreenReconcile: (delay: number) => enhancer.reconciler.schedule(delay),
    onSessionTerminated: ended => enhancer.handleNativeSessionEnded(ended),
  }, enhancer.native);
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
    enhancer.nativeObserver.playbackTimer = 41;
    (VideoEnhancer as any).activeEnhancer = enhancer;
    const stopping = enhancer.stopEnhancement();

    expect(enhancer.backend.isNativeActive).toBe(false);
    expect(enhancer.nativeObserver.playbackTimer).toBeUndefined();
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

    await expect(enhancer.updateSettings({
      ...previousSettings,
      mode: 'B',
    })).rejects.toThrow('shader compile failed');

    expect(enhancer.currentSettings).toBe(previousSettings);
    expect(enhancer.currentModeId).toBe('previous-mode');
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

  it('disposes video listeners on destroy so detached nodes cannot retain the enhancer', () => {
    const { enhancer } = createBareEnhancer();
    const dispose = vi.spyOn(enhancer.videoEvents, 'dispose');

    enhancer.destroy();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('does not stop a detached (stashed) video on fullscreen reconcile', async () => {
    // Stash window: the node is disconnected but the backend is deliberately
    // alive. Without the isConnected guard the election excludes the video,
    // the stop branch sees the live renderer and tears the session down.
    const { enhancer, video } = createBareEnhancer();
    enhancer.renderer = { destroy: vi.fn() } as unknown as Renderer;
    enhancer.currentSettings = { ...DEFAULT_SETTINGS };
    (video as unknown as Record<string, unknown>).isConnected = false;
    const stop = vi.spyOn(enhancer, 'stopEnhancement').mockResolvedValue(undefined);

    await enhancer.reconciler.reconcile(enhancer.lifecycle.currentReconcileToken());

    expect(stop).not.toHaveBeenCalled();
  });

  it('cancels a pending fullscreen reconcile on explicit stop', async () => {
    const { enhancer } = createBareEnhancer();
    const clearTimeout = window.clearTimeout as unknown as ReturnType<typeof vi.fn>;

    enhancer.reconciler.schedule(90);
    expect(enhancer.reconciler.hasPendingReconcile).toBe(true);
    const tokenBeforeStop = enhancer.lifecycle.currentReconcileToken();

    await enhancer.stopEnhancement();

    expect(clearTimeout).toHaveBeenCalledWith(72);
    expect(enhancer.reconciler.hasPendingReconcile).toBe(false);
    expect(enhancer.lifecycle.currentReconcileToken()).toBeGreaterThan(tokenBeforeStop);
  });

  it('exits the fullscreen layout when an automatic start commits no backend', async () => {
    const { enhancer, video, fullscreenLayout } = createBareEnhancer();
    enhancer.currentSettings = { ...DEFAULT_SETTINGS };
    enhancer.startEnhancement = vi.fn(async () => undefined);
    const preferred = vi.spyOn(fullscreenContext, 'preferredVideo')
      .mockReturnValue(video as unknown as HTMLVideoElement);
    const hasContext = vi.spyOn(fullscreenContext, 'hasContext').mockReturnValue(true);
    try {
      await enhancer.reconciler.reconcile(enhancer.lifecycle.currentReconcileToken());
    } finally {
      hasContext.mockRestore();
      preferred.mockRestore();
    }

    expect(fullscreenLayout.enter).toHaveBeenCalledOnce();
    expect(fullscreenLayout.exit).toHaveBeenCalled();
    expect(enhancer.reconciler.isAutomaticSession).toBe(false);
  });

  function createRealesrganEnhancer(capHeight: 480 | 432 | 405 = 480) {
    const { enhancer, video, overlay } = createBareEnhancer();
    const updateConfiguration = vi.fn(
      async (_config: { effects: Array<{ params?: unknown }> }) => undefined,
    );
    const renderer = {
      updateConfiguration,
      destroy: vi.fn(),
      isDestroyed: () => false,
    };
    enhancer.renderer = renderer;
    enhancer.backend.markWebGPUActive();
    enhancer.currentSettings = { ...DEFAULT_SETTINGS, mode: 'REALESRGAN', realesrganCapHeight: capHeight };
    return { enhancer, video, overlay, updateConfiguration };
  }

  function overloadStats() {
    return {
      fps: 24,
      renderMs: 60,
      droppedFrames: 0,
      warning: true,
      realesrgan: {
        readbackMs: 5, inferMs: 50, composeMs: 2, runnerPct: 100, gpuComposePct: 0, nativePct: 0,
        count: 12, enhancedFps: 10,
      },
      frameBudgetMs: 1000 / 24,
    };
  }

  it('steps the live cap 480 -> 432 on sustained overload without touching stored settings', async () => {
    const { enhancer, updateConfiguration } = createRealesrganEnhancer(480);
    enhancer.handleStats(overloadStats());
    await vi.waitFor(() => expect(updateConfiguration).toHaveBeenCalledOnce());
    const effects = updateConfiguration.mock.calls[0]![0].effects;
    expect(effects[0]!.params).toMatchObject({ maxInferenceHeight: 432 });
    expect(enhancer.statsConsumer.effectiveAutoCap).toBe(432);
    // Stored settings keep the user cap: the override is ephemeral.
    expect(enhancer.currentSettings.realesrganCapHeight).toBe(480);
  });

  it('does not step twice inside the cooldown and ignores non-REALESRGAN modes', async () => {
    const { enhancer, updateConfiguration } = createRealesrganEnhancer(480);
    enhancer.handleStats(overloadStats());
    await vi.waitFor(() => expect(updateConfiguration).toHaveBeenCalledOnce());
    enhancer.handleStats(overloadStats());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(updateConfiguration).toHaveBeenCalledOnce();

    enhancer.currentSettings = { ...DEFAULT_SETTINGS, mode: 'A' };
    enhancer.handleStats(overloadStats());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(updateConfiguration).toHaveBeenCalledOnce();
  });

  it('e2eInjectOverloadStats feeds one synthetic sample and reports the cap', async () => {
    const { enhancer, updateConfiguration } = createRealesrganEnhancer(480);
    expect(enhancer.e2eInjectOverloadStats()).toBe(432);
    await vi.waitFor(() => expect(updateConfiguration).toHaveBeenCalledOnce());
    expect(enhancer.statsConsumer.effectiveAutoCap).toBe(432);
  });

  it('drops a queued step after the renderer is released', async () => {
    const { enhancer, updateConfiguration } = createRealesrganEnhancer(480);
    enhancer.handleStats(overloadStats());
    await enhancer.stopEnhancement();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(updateConfiguration).not.toHaveBeenCalled();
  });

  it('first-frame watchdog spares paused videos and re-arms instead of restarting', async () => {
    const { enhancer, video, overlay } = createBareEnhancer();
    enhancer.backend.markWebGPUActive();
    enhancer.renderer = {};
    Object.assign(video, { getAttribute: vi.fn(() => 'true') });
    Object.assign(overlay, { isCanvasVisible: false });
    video.paused = true;
    const stop = vi.spyOn(enhancer, 'stopEnhancement').mockResolvedValue(undefined);
    vi.spyOn(enhancer, 'startEnhancement').mockResolvedValue(undefined);
    const callbacks: Array<() => void> = [];
    (window.setTimeout as any).mockImplementation((cb: () => void) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    enhancer.armFirstFrameWatchdog();
    expect(callbacks).toHaveLength(1);
    callbacks[0]!();
    await Promise.resolve();
    // Paused: no restart, but the single retry is not consumed either.
    expect(stop).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(2);
    video.paused = false;
    callbacks[1]!();
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });

  it('first-frame watchdog spares hidden tabs', async () => {
    const { enhancer, video, overlay } = createBareEnhancer();
    enhancer.backend.markWebGPUActive();
    enhancer.renderer = {};
    Object.assign(video, { getAttribute: vi.fn(() => 'true') });
    Object.assign(overlay, { isCanvasVisible: false });
    const stop = vi.spyOn(enhancer, 'stopEnhancement').mockResolvedValue(undefined);
    vi.spyOn(enhancer, 'startEnhancement').mockResolvedValue(undefined);
    const callbacks: Array<() => void> = [];
    (window.setTimeout as any).mockImplementation((cb: () => void) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    (document as any).hidden = true;
    try {
      enhancer.armFirstFrameWatchdog();
      callbacks[0]!();
      await Promise.resolve();
      expect(stop).not.toHaveBeenCalled();
    } finally {
      delete (document as any).hidden;
    }
  });
});

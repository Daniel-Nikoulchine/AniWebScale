import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FullscreenReconciler,
  shouldMarkAutoFullscreen,
  type FullscreenReconcilerContext,
} from '../src/core/enhancer-fullscreen-reconciler';
import { fullscreenContext } from '../src/core/fullscreen-context';
import { ANIME4K_FULLSCREEN_AUTO_ATTR } from '../src/constants';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

function createHarness() {
  const video = {
    isConnected: true,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  } as unknown as HTMLVideoElement;
  let settings = { ...DEFAULT_SETTINGS, autoFullscreenEnabled: true };
  let renderer = false;
  let native = false;
  let starting = false;
  let activeFallback = false;
  let pendingFallback = false;
  let destroyed = false;
  let reconcileToken = 0;
  const enterLayout = vi.fn();
  const exitLayout = vi.fn();
  const start = vi.fn(async () => undefined);
  const stop = vi.fn(async () => undefined);
  const context: FullscreenReconcilerContext = {
    isDestroyed: () => destroyed,
    getVideo: () => video,
    getSettings: () => settings,
    setSettings: next => { settings = next; },
    loadSettings: async () => settings,
    hasRenderer: () => renderer,
    isNativeActive: () => native,
    isStarting: () => starting,
    hasActiveFallback: () => activeFallback,
    hasPendingFallback: () => pendingFallback,
    enterLayout,
    exitLayout,
    start,
    stop,
    beginReconcile: () => ++reconcileToken,
    isReconcileCurrent: token => token === reconcileToken,
    enqueue: operation => operation(),
  };
  const reconciler = new FullscreenReconciler(context);
  return {
    reconciler,
    video,
    setSettings: (next: typeof settings) => { settings = next; },
    setRenderer: (next: boolean) => { renderer = next; },
    setNative: (next: boolean) => { native = next; },
    setStarting: (next: boolean) => { starting = next; },
    setActiveFallback: (next: boolean) => { activeFallback = next; },
    setPendingFallback: (next: boolean) => { pendingFallback = next; },
    setDestroyed: (next: boolean) => { destroyed = next; },
    nextToken: () => context.beginReconcile(),
    enterLayout,
    exitLayout,
    start,
    stop,
  };
}

describe('shouldMarkAutoFullscreen', () => {
  it('requires opted-in automation and an enabled processing mode', () => {
    expect(shouldMarkAutoFullscreen(null)).toBe(false);
    expect(shouldMarkAutoFullscreen({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: true, mode: 'A' })).toBe(true);
    expect(shouldMarkAutoFullscreen({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: false, mode: 'A' })).toBe(false);
    expect(shouldMarkAutoFullscreen({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: true, mode: 'OFF' })).toBe(false);
    expect(shouldMarkAutoFullscreen({
      ...DEFAULT_SETTINGS, autoFullscreenEnabled: true, mode: 'OFF', frameGenerationEnabled: true,
    })).toBe(true);
  });
});

describe('FullscreenReconciler', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      setTimeout: vi.fn(() => 11),
      clearTimeout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies and clears the auto-fullscreen marker', () => {
    const harness = createHarness();
    harness.reconciler.applyMarker({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: true, mode: 'A' });
    expect(harness.video.setAttribute).toHaveBeenCalledWith(ANIME4K_FULLSCREEN_AUTO_ATTR, 'true');

    harness.reconciler.applyMarker({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: false, mode: 'A' });
    expect(harness.video.removeAttribute).toHaveBeenCalledWith(ANIME4K_FULLSCREEN_AUTO_ATTR);
  });

  it('clears the marker after destroy even for an enabled config', () => {
    const harness = createHarness();
    harness.setDestroyed(true);
    harness.reconciler.applyMarker({ ...DEFAULT_SETTINGS, autoFullscreenEnabled: true, mode: 'A' });
    expect(harness.video.setAttribute).not.toHaveBeenCalled();
    expect(harness.video.removeAttribute).toHaveBeenCalledWith(ANIME4K_FULLSCREEN_AUTO_ATTR);
  });

  it('debounces reconciles and clearDebounce cancels the pending one', () => {
    const harness = createHarness();
    harness.reconciler.schedule();
    expect(window.setTimeout).toHaveBeenCalledOnce();
    expect(harness.reconciler.hasPendingReconcile).toBe(true);

    harness.reconciler.clearDebounce();
    expect(window.clearTimeout).toHaveBeenCalledWith(11);
    expect(harness.reconciler.hasPendingReconcile).toBe(false);
  });

  it('stops a live session when the fullscreen context is gone', async () => {
    const harness = createHarness();
    harness.setRenderer(true);
    const hasContext = vi.spyOn(fullscreenContext, 'hasContext').mockReturnValue(false);
    const hasSignal = vi.spyOn(fullscreenContext, 'hasPlayerSignal').mockReturnValue(false);
    try {
      await harness.reconciler.reconcile(harness.nextToken());
    } finally {
      hasContext.mockRestore();
      hasSignal.mockRestore();
    }
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.start).not.toHaveBeenCalled();
  });

  it('auto-starts and exits the layout when the start commits no backend', async () => {
    const harness = createHarness();
    const preferred = vi.spyOn(fullscreenContext, 'preferredVideo').mockReturnValue(harness.video);
    const hasContext = vi.spyOn(fullscreenContext, 'hasContext').mockReturnValue(true);
    const hasSignal = vi.spyOn(fullscreenContext, 'hasPlayerSignal').mockReturnValue(true);
    try {
      await harness.reconciler.reconcile(harness.nextToken());
    } finally {
      preferred.mockRestore();
      hasContext.mockRestore();
      hasSignal.mockRestore();
    }
    expect(harness.enterLayout).toHaveBeenCalled();
    expect(harness.exitLayout).toHaveBeenCalled();
    expect(harness.start).toHaveBeenCalledOnce();
    expect(harness.reconciler.isAutomaticSession).toBe(false);
  });

  it('does not auto-start while a native retry is blocked', async () => {
    const harness = createHarness();
    harness.reconciler.blockAutoRetry();
    const preferred = vi.spyOn(fullscreenContext, 'preferredVideo').mockReturnValue(harness.video);
    const hasContext = vi.spyOn(fullscreenContext, 'hasContext').mockReturnValue(true);
    const hasSignal = vi.spyOn(fullscreenContext, 'hasPlayerSignal').mockReturnValue(true);
    try {
      await harness.reconciler.reconcile(harness.nextToken());
    } finally {
      preferred.mockRestore();
      hasContext.mockRestore();
      hasSignal.mockRestore();
    }
    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.stop).not.toHaveBeenCalled();
  });

  it('ignores stale tokens and disconnected videos', async () => {
    const harness = createHarness();
    await harness.reconciler.reconcile(harness.nextToken() + 1);
    expect(harness.enterLayout).not.toHaveBeenCalled();

    const token = harness.nextToken();
    (harness.video as unknown as { isConnected: boolean }).isConnected = false;
    await harness.reconciler.reconcile(token);
    expect(harness.enterLayout).not.toHaveBeenCalled();
    expect(harness.stop).not.toHaveBeenCalled();
  });
});

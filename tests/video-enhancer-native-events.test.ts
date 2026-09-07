import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/overlay-manager', () => ({
  OverlayManager: { create: vi.fn() },
}));

vi.mock('../src/core/fullscreen-layout-manager', () => ({
  FullscreenLayoutManager: vi.fn(),
}));

import { OverlayManager } from '../src/core/overlay-manager';
import { FullscreenLayoutManager } from '../src/core/fullscreen-layout-manager';
import { VideoEnhancer } from '../src/core/video-enhancer';

function createVideo() {
  return {
    dataset: {} as Record<string, string>,
    mediaKeys: null,
    paused: true,
    ended: false,
    currentTime: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ x: 0, y: 0, width: 640, height: 360 })),
  };
}

function createNativeClient() {
  return {
    claim: vi.fn(async () => ({ ok: true })),
    release: vi.fn(async () => undefined),
    requestFallback: vi.fn(async () => ({ ok: false as const, message: 'unavailable' })),
    updateConfiguration: vi.fn(async () => ({ ok: true })),
    stop: vi.fn(async () => undefined),
    sendPlaybackState: vi.fn(async () => undefined),
    hasPendingFallback: vi.fn(() => false),
  };
}

describe('VideoEnhancer native session events (real instance)', () => {
  let windowListeners: Map<string, (...args: unknown[]) => void>;
  let timerId = 0;

  beforeEach(() => {
    windowListeners = new Map();
    timerId = 0;
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
      storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) } },
    });
    vi.stubGlobal('navigator', { gpu: {} });
    vi.stubGlobal('location', { hostname: 'example.com' });
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      setTimeout: vi.fn(() => ++timerId),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(() => ++timerId),
      clearInterval: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (...args: unknown[]) => void) => {
        windowListeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: vi.fn(() => false) },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal('ResizeObserver', class {
      observe(): void { /* test stub */ }
      disconnect(): void { /* test stub */ }
      unobserve(): void { /* test stub */ }
    });
    (VideoEnhancer as unknown as { activeEnhancer: unknown }).activeEnhancer = null;
  });

  afterEach(() => {
    (VideoEnhancer as unknown as { activeEnhancer: unknown }).activeEnhancer = null;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function createEnhancer() {
    const overlay = {
      getCanvas: vi.fn(),
      showCanvas: vi.fn(),
      hideCanvas: vi.fn(),
      setStats: vi.fn(),
      destroy: vi.fn(),
      detach: vi.fn(),
      reattach: vi.fn(),
    };
    const layout = { enter: vi.fn(), exit: vi.fn(), updateVideo: vi.fn() };
    vi.mocked(OverlayManager.create).mockReturnValue(overlay as never);
    vi.mocked(FullscreenLayoutManager).mockImplementation(function () {
      return layout;
    } as never);
    const native = createNativeClient();
    const enhancer = VideoEnhancer.create(createVideo() as unknown as HTMLVideoElement, native as never);
    const fireSessionEvent = (detail: Record<string, unknown>): void => {
      const listener = windowListeners.get('anime4k-native-session');
      if (!listener) throw new Error('native session listener was not registered');
      listener({ detail });
    };
    return { enhancer: enhancer as unknown as Record<string, never> & { destroy(): void }, overlay, layout, native, fireSessionEvent };
  }

  it('swallows the expected terminal event of an intentional native-to-webgpu switch', () => {
    const { enhancer, native, fireSessionEvent } = createEnhancer();
    const inner = enhancer as unknown as {
      backend: { markNativeActive(): void; isNativeActive: boolean };
      lifecycle: { begin(): number };
      nativeSessionId: string | null;
      switchingFromNativeRevision: number | null;
      switchingFromNativeSessionId: string | null;
    };
    inner.backend.markNativeActive();
    inner.nativeSessionId = null;
    inner.switchingFromNativeRevision = inner.lifecycle.begin();
    inner.switchingFromNativeSessionId = 'session-old';
    (VideoEnhancer as unknown as { activeEnhancer: unknown }).activeEnhancer = enhancer;

    fireSessionEvent({ type: 'stopped', sessionId: 'session-old' });

    expect(inner.backend.isNativeActive).toBe(false);
    expect(inner.nativeSessionId).toBeNull();
    // The terminal event of the intentionally stopped session must not run
    // the full teardown: no claim release, no host stop, active owner kept.
    expect(native.release).not.toHaveBeenCalled();
    expect(native.stop).not.toHaveBeenCalled();
    expect((VideoEnhancer as unknown as { activeEnhancer: unknown }).activeEnhancer).toBe(enhancer);
    enhancer.destroy();
  });

  it('ignores terminal events from superseded native sessions', () => {
    const { enhancer, native, fireSessionEvent } = createEnhancer();
    const inner = enhancer as unknown as {
      backend: { markNativeActive(): void; isNativeActive: boolean };
      nativeSessionId: string | null;
    };
    inner.backend.markNativeActive();
    inner.nativeSessionId = 'session-new';

    fireSessionEvent({ type: 'stopped', sessionId: 'session-old' });

    expect(inner.backend.isNativeActive).toBe(true);
    expect(inner.nativeSessionId).toBe('session-new');
    expect(native.release).not.toHaveBeenCalled();
    expect(native.stop).not.toHaveBeenCalled();
    enhancer.destroy();
  });
});

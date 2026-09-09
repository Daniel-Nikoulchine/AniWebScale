import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installHarness() {
  let resolveSettings!: (value: Record<string, unknown>) => void;
  const settings = new Promise<Record<string, unknown>>(resolve => {
    resolveSettings = resolve;
  });
  const storageGet = vi.fn(async () => settings);
  const setTimeout = vi.fn(() => 1);
  const clearTimeout = vi.fn();
  class FakeMutationObserver {
    public observe = vi.fn();
    public disconnect = vi.fn();
  }

  vi.stubGlobal('chrome', { storage: { local: { get: storageGet } } });
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
  vi.stubGlobal('document', {
    documentElement: {},
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('window', {
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  return { resolveSettings, setTimeout, storageGet };
}

describe('video manager initialization', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('coalesces concurrent initialization calls', async () => {
    const harness = installHarness();
    const manager = await import('../src/core/video-manager');

    const first = manager.initializeOnPage();
    const second = manager.initializeOnPage();
    expect(harness.storageGet).toHaveBeenCalledTimes(1);

    harness.resolveSettings({ extensionEnabled: true });
    await Promise.all([first, second]);

    expect(harness.setTimeout).toHaveBeenCalledTimes(1);
  });

  it('resolves initialization instead of rejecting when settings fail', async () => {
    const harness = installHarness();
    const manager = await import('../src/core/video-manager');
    harness.storageGet.mockRejectedValueOnce(new Error('storage unavailable'));

    // Fire-and-forget at the call sites: must never surface as an
    // unhandled rejection.
    await expect(manager.initializeOnPage()).resolves.toBeUndefined();
  });

  it('dissociates the video even when enhancer teardown throws', async () => {
    class FakeElement {}
    class FakeVideoElement extends FakeElement {
      hasAttribute = vi.fn(() => false);
    }
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLVideoElement', FakeVideoElement);
    const mutationCallbacks: Array<(mutations: Array<{ removedNodes: unknown[]; addedNodes: unknown[] }>) => void> = [];
    class FakeMutationObserver {
      constructor(callback: (mutations: Array<{ removedNodes: unknown[]; addedNodes: unknown[] }>) => void) {
        mutationCallbacks.push(callback);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }

    const harness = installHarness();
    // installHarness stubbed a bare MutationObserver; replace it with the
    // capturing one (population observes roots during initialization).
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const manager = await import('../src/core/video-manager');
    const enhancerMap = await import('../src/core/enhancer-map');

    const video = new FakeVideoElement();
    const destroy = vi.fn(() => { throw new Error('teardown boom'); });
    enhancerMap.associateEnhancer(
      video as unknown as HTMLVideoElement,
      { destroy } as unknown as import('../src/core/video-enhancer').VideoEnhancer,
    );

    const init = manager.initializeOnPage();
    harness.resolveSettings({ extensionEnabled: true });
    await init;
    expect(mutationCallbacks.length).toBeGreaterThan(0);

    // The teardown error stays visible, but the map entry must be gone.
    expect(() => {
      for (const callback of mutationCallbacks) callback([{ removedNodes: [video], addedNodes: [] }]);
    }).toThrow('teardown boom');
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(enhancerMap.getEnhancer(video as unknown as HTMLVideoElement)).toBeUndefined();
  });
});

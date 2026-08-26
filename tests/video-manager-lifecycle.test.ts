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
});

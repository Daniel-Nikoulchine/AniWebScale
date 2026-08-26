import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySettings } from '../src/utils/apply-settings';

function installChromeMock() {
  const callbacks: Array<() => void> = [];
  const set = vi.fn((_values: Record<string, unknown>, callback: () => void) => {
    callbacks.push(callback);
  });
  const sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal('chrome', {
    runtime: { lastError: null, sendMessage },
    storage: { local: { set, remove: vi.fn() } },
  });
  return { callbacks, set };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings application', () => {
  it('serializes overlapping saves in invocation order', async () => {
    const { callbacks, set } = installChromeMock();

    const first = applySettings({ mode: 'A' });
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));

    const second = applySettings({ mode: 'B' });
    await Promise.resolve();
    expect(set).toHaveBeenCalledTimes(1);

    callbacks[0]();
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(2));
    callbacks[1]();

    await expect(first).resolves.toBe('applied');
    await expect(second).resolves.toBe('applied');
    expect(set.mock.calls[0][0]).toMatchObject({ mode: 'A' });
    expect(set.mock.calls[1][0]).toMatchObject({ mode: 'B' });
  });

  it('persists local-only options before notifying the background', async () => {
    const { callbacks, set } = installChromeMock();

    const result = applySettings({ mode: 'A' }, { local: { verboseLogging: true } });
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    callbacks[0]();
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(2));
    callbacks[1]();

    await expect(result).resolves.toBe('applied');
    expect(set.mock.calls[0][0]).toMatchObject({ mode: 'A' });
    expect(set.mock.calls[1][0]).toEqual({ verboseLogging: true });
  });
});

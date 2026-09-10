import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySettings } from '../src/utils/apply-settings';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

function installChromeMock(sendResponse: unknown = { ok: true }) {
  const callbacks: Array<() => void> = [];
  const set = vi.fn((_values: Record<string, unknown>, callback: () => void) => {
    callbacks.push(callback);
  });
  const sendMessage = vi.fn(async () => sendResponse);
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

  it('reports saved-not-applied when the background refuses the update', async () => {
    const { callbacks } = installChromeMock({ ok: false });

    const result = applySettings({ mode: 'B' });
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0]();

    await expect(result).resolves.toBe('saved-not-applied');
  });

  it('reports saved-not-applied when the background cannot be reached', async () => {
    const callbacks: Array<() => void> = [];
    const set = vi.fn((_values: Record<string, unknown>, callback: () => void) => {
      callbacks.push(callback);
    });
    vi.stubGlobal('chrome', {
      runtime: { lastError: null, sendMessage: vi.fn(async () => { throw new Error('no receiver'); }) },
      storage: { local: { set, remove: vi.fn() } },
    });

    const result = applySettings({ mode: 'B' });
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0]();

    await expect(result).resolves.toBe('saved-not-applied');
  });

  it('reports failed when persistence itself rejects', async () => {
    const set = vi.fn((_values: Record<string, unknown>, callback: () => void) => {
      chrome.runtime.lastError = { message: 'quota exceeded' };
      callback();
    });
    vi.stubGlobal('chrome', {
      runtime: { lastError: null, sendMessage: vi.fn(async () => ({ ok: true })) },
      storage: { local: { set, remove: vi.fn() } },
    });

    await expect(applySettings({ mode: 'A' })).resolves.toBe('failed');
  });

  it('persists the full defaults on the options reset path', async () => {
    const { callbacks, set } = installChromeMock();

    const result = applySettings(DEFAULT_SETTINGS, { local: { verboseLogging: false } });
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    callbacks[0]();
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(2));
    callbacks[1]();

    await expect(result).resolves.toBe('applied');
    expect(set.mock.calls[0][0]).toEqual(DEFAULT_SETTINGS);
    // The vestigial output setting must never be written again.
    expect('output' in (set.mock.calls[0][0] as Record<string, unknown>)).toBe(false);
    expect(set.mock.calls[1][0]).toEqual({ verboseLogging: false });
  });
});

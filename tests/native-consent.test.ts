/**
 * native-consent: concurrent writes must not clobber each other, and
 * corrupt (non-boolean) stored values must not leak into the UI listing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeNativeConsents,
  recordNativeConsent,
  resetNativeConsent,
} from '../src/shared/native-consent';

const KEY = 'anime4kNativeConsentByOrigin';

function installStorage(initial: Record<string, unknown> = {}, gateReads = false) {
  const store: Record<string, unknown> = { ...initial };
  let releaseReads!: () => void;
  const readsGate = gateReads
    ? new Promise<void>(resolve => { releaseReads = resolve; })
    : null;
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          if (readsGate) await readsGate;
          return { [key]: store[key] };
        }),
        set: vi.fn(async (record: Record<string, unknown>) => {
          Object.assign(store, record);
        }),
        remove: vi.fn(async (key: string) => {
          delete store[key];
        }),
      },
    },
  });
  return { store, releaseReads: releaseReads! };
}

describe('native consent storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a consent answer', async () => {
    installStorage();
    await recordNativeConsent('https://example.com', true);
    await expect(describeNativeConsents()).resolves.toEqual([
      { origin: 'https://example.com', allowed: true },
    ]);
    await resetNativeConsent('https://example.com');
    await expect(describeNativeConsents()).resolves.toEqual([]);
  });

  it('keeps both answers of concurrent writes', async () => {
    // Both reads are gated so they overlap deterministically: without
    // write serialization the second set would clobber the first.
    const { store, releaseReads } = installStorage({}, true);
    const first = recordNativeConsent('https://a.example', true);
    const second = recordNativeConsent('https://b.example', false);
    releaseReads();
    await Promise.all([first, second]);
    expect(store[KEY]).toEqual({ 'https://a.example': true, 'https://b.example': false });
  });

  it('filters corrupt non-boolean values from the listing', async () => {
    installStorage({ [KEY]: { 'https://x.example': 'yes', 'https://y.example': true } });
    await expect(describeNativeConsents()).resolves.toEqual([
      { origin: 'https://y.example', allowed: true },
    ]);
  });
});

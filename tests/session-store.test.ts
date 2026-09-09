/**
 * NativeSessionStore.loadPersistedSession: identity fields are load-bearing
 * (host stop carries the sessionId, recovery nonce-matches tab titles), so
 * a partial/corrupt record must not load with undefined ids.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeSessionStore } from '../src/background/session-store';
import { NATIVE_SESSION_VERSION } from '../src/shared/session-recovery';

function storageStub(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (record: Record<string, unknown>) => {
      Object.assign(data, record);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    }),
  };
}

function installStorageStub(storage: ReturnType<typeof storageStub>) {
  vi.stubGlobal('chrome', { storage: { local: storage } });
}

function validRecord(): Record<string, unknown> {
  return {
    version: NATIVE_SESSION_VERSION,
    captureKind: 'direct-fullscreen',
    phase: 'preparing',
    sessionId: 'session-1',
    nonce: 'b'.repeat(32),
    tabId: 7,
    frameId: 0,
    videoId: 'video-1',
    origin: 'https://example.com',
    sourceUrl: 'https://example.com/watch/1',
    topLevelUrl: 'https://example.com/watch/1',
    configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
  };
}

describe('NativeSessionStore.loadPersistedSession identity validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a complete record', async () => {
    const storage = storageStub({ anime4kNativeSessionV1: validRecord() });
    installStorageStub(storage);
    const loaded = await new NativeSessionStore().loadPersistedSession();
    expect(loaded?.sessionId).toBe('session-1');
    expect(loaded?.nonce).toBe('b'.repeat(32));
  });

  it.each([
    ['sessionId', { sessionId: undefined }],
    ['nonce', { nonce: '' }],
    ['videoId', { videoId: undefined }],
    ['origin', { origin: 42 }],
    ['frameId', { frameId: 1.5 }],
  ])('rejects a record with a corrupt %s', async (_field, override) => {
    const storage = storageStub({ anime4kNativeSessionV1: { ...validRecord(), ...override } });
    installStorageStub(storage);
    await expect(new NativeSessionStore().loadPersistedSession()).resolves.toBeNull();
  });

  it('rejects a record with a non-numeric tabId', async () => {
    const storage = storageStub({ anime4kNativeSessionV1: { ...validRecord(), tabId: '7' } });
    installStorageStub(storage);
    await expect(new NativeSessionStore().loadPersistedSession()).resolves.toBeNull();
  });
});

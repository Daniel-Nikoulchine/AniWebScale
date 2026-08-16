import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { NativeSession } from '../src/background/native-session';
import type { NativeSessionRecord } from '../src/background-types';
import { NATIVE_SESSION_VERSION } from '../src/shared/session-recovery';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';
import type { NativeEvent, NativeConfiguration } from '../src/native/protocol';
import { createAsyncSerializer } from '../src/shared/async-serializer';

// ---------------------------------------------------------------------------
// Chrome fake (storage.local is used by the session store)
// ---------------------------------------------------------------------------

function installChromeStorageMock() {
  const store = new Map<string, unknown>();
  const get = vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
    if (keys === undefined) return Object.fromEntries(store);
    if (typeof keys === 'string') {
      return { [keys]: store.get(keys) };
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const key of keys) result[key] = store.get(key);
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(keys)) result[key] = store.get(key) ?? fallback;
    return result;
  });
  const set = vi.fn(async (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) store.set(key, value);
  });
  const remove = vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
  });
  vi.stubGlobal('chrome', {
    storage: { local: { get, set, remove } },
    runtime: { lastError: null },
    tabs: {
      get: async () => { throw new Error('Not stubbed.'); },
      query: async () => [],
      sendMessage: async () => undefined,
    },
    windows: { get: async () => { throw new Error('Not stubbed.'); } },
  } as unknown as typeof chrome);
  return { get, set, remove, store };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  installChromeStorageMock();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function config(overrides: Partial<NativeConfiguration> = {}): NativeConfiguration {
  return { mode: 'A', quality: 'M', frameGenerationEnabled: false, ...overrides };
}

function sender(overrides: Partial<chrome.runtime.MessageSender> = {}): chrome.runtime.MessageSender {
  return {
    tab: { id: 1 } as chrome.tabs.Tab,
    frameId: 0,
    url: 'https://example.com/watch/1',
    origin: 'https://example.com',
    ...overrides,
  };
}

function sessionRecord(overrides: Partial<NativeSessionRecord> = {}): NativeSessionRecord {
  return {
    version: NATIVE_SESSION_VERSION,
    captureKind: 'direct-fullscreen',
    phase: 'preparing',
    sessionId: 'session-1',
    nonce: 'a'.repeat(32),
    tabId: 1,
    frameId: 0,
    videoId: 'video-1',
    origin: 'https://example.com',
    sourceUrl: 'https://example.com/watch/1',
    topLevelUrl: 'https://example.com/watch/1',
    sourceWindowId: 10,
    configuration: config(),
    output: 'auto',
    createdAt: 1000,
    ...overrides,
  };
}

function pointerEvent(sessionId: string): NativeEvent {
  return {
    type: 'pointer',
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: 'req-1',
    sessionId,
    event: 'move',
    x: 0.5,
    y: 0.5,
  };
}

// ---------------------------------------------------------------------------
// Machine factory
// ---------------------------------------------------------------------------

type SendToFrame = <T = unknown>(tabId: number, frameId: number, message: unknown) => Promise<T>;

interface MachineOptions {
  sendToFrame?: SendToFrame;
  requestOriginConsent?: (tabId: number, origin: string) => Promise<boolean>;
  isExtensionEnabled?: () => Promise<boolean>;
  serialized?: <T>(operation: () => Promise<T>) => Promise<T>;
}

const noopSendToFrame: SendToFrame = async () => undefined as never;

function createMachine(options: MachineOptions = {}): NativeSession {
  const serialized = options.serialized ?? (async <T>(operation: () => Promise<T>): Promise<T> => operation());
  return new NativeSession({
    sendToFrame: options.sendToFrame ?? noopSendToFrame,
    requestOriginConsent: options.requestOriginConsent ?? (async () => true),
    isExtensionEnabled: options.isExtensionEnabled ?? (async () => true),
    serialized,
  });
}

describe('NativeSession state machine', () => {
  describe('claimEnhancement', () => {
    it('rejects claims when the extension is disabled', async () => {
      const machine = createMachine({ isExtensionEnabled: async () => false });
      const result = await machine.claimEnhancement('video-1', sender());
      expect(result).toEqual({ ok: false, message: 'AniWebScale is disabled.' });
    });

    it('rejects claims without a sender tab', async () => {
      const machine = createMachine();
      const result = await machine.claimEnhancement('video-1', sender({ tab: undefined }));
      expect(result).toEqual({ ok: false, message: 'The AniWebScale activation claim was invalid.' });
    });

    it('persists the claim', async () => {
      const machine = createMachine();
      const result = await machine.claimEnhancement('video-1', sender());
      expect(result).toEqual({ ok: true });
      expect(await machine.store.loadActiveEnhancement()).toEqual({
        tabId: 1,
        frameId: 0,
        videoId: 'video-1',
      });
    });

    it('stops a conflicting native session when a different video claims', async () => {
      const machine = createMachine();
      await machine.store.persistActiveEnhancement({ tabId: 1, frameId: 0, videoId: 'video-other' });
      await machine.store.persistSession(sessionRecord({ videoId: 'video-other', sessionId: 'session-other' }));
      const stopSpy = vi.spyOn(machine, 'stopNativeSession').mockResolvedValue(undefined);

      const result = await machine.claimEnhancement('video-1', sender());
      expect(result).toEqual({ ok: true });
      expect(stopSpy).toHaveBeenCalledWith('Another video was selected.', true);
    });
  });

  describe('releaseEnhancement', () => {
    it('clears the claim only when it matches', async () => {
      const machine = createMachine();
      await machine.store.persistActiveEnhancement({ tabId: 1, frameId: 0, videoId: 'video-1' });
      await machine.releaseEnhancement('video-1', sender());
      expect(await machine.store.loadActiveEnhancement()).toBeNull();

      await machine.store.persistActiveEnhancement({ tabId: 1, frameId: 0, videoId: 'video-1' });
      await machine.releaseEnhancement('video-other', sender());
      expect(await machine.store.loadActiveEnhancement()).not.toBeNull();
    });
  });

  describe('routeNativeEvent', () => {
    it('drops events from a client that is no longer current', async () => {
      const sent: unknown[] = [];
      const machine = createMachine({
        sendToFrame: async (_tabId: number, _frameId: number, message: unknown) => {
          sent.push(message);
          return undefined as never;
        },
      });
      await machine.store.persistSession(sessionRecord());

      // A stale client object that is not the bridge's current client.
      const staleClient = {} as unknown as Parameters<typeof machine.routeNativeEvent>[1];
      await machine.routeNativeEvent(pointerEvent('session-1'), staleClient);
      expect(sent).toHaveLength(0);
    });

    it('forwards pointer events only for the active session', async () => {
      const sent: unknown[] = [];
      const machine = createMachine({
        sendToFrame: async (_tabId: number, _frameId: number, message: unknown) => {
          sent.push(message);
          return undefined as never;
        },
      });
      await machine.store.persistSession(sessionRecord({ frameId: 2 }));

      // Wrong session: dropped.
      const staleClient = {} as unknown as Parameters<typeof machine.routeNativeEvent>[1];
      await machine.routeNativeEvent(pointerEvent('session-other'), staleClient);
      expect(sent).toHaveLength(0);

      // Correct session: forwarded to source frame + top frame.
      // The bridge has no current client; routeNativeEvent will drop events
      // that do not match, so we must assert the sendToFrame path directly.
      // Use the real bridge currentClient by connecting nothing: it's null,
      // so the guard drops. Instead, test the session-scoping via a fake
      // currentClient assignment.
      const client = machine.bridge.currentClient;
      // Override the bridge current client to a non-null object.
      Object.defineProperty(machine.bridge, 'currentClient', { value: {} });
      await machine.routeNativeEvent(pointerEvent('session-1'), machine.bridge.currentClient ?? ({} as never));
      expect(sent.length).toBe(2);
      expect(sent[0]).toMatchObject({ type: 'NATIVE_POINTER_EVENT', sessionId: 'session-1' });
      void client;
    });
  });

  describe('stopNativeSession', () => {
    it('is a no-op when the expected session does not match', async () => {
      const machine = createMachine();
      await machine.store.persistSession(sessionRecord({ sessionId: 'session-1' }));
      await machine.stopNativeSession('reason', true, true, 'session-other');
      expect(machine.store.activeSession).not.toBeNull();
    });

    it('stops, restores and clears the active session', async () => {
      const machine = createMachine();
      await machine.store.persistSession(sessionRecord());
      await machine.store.persistActiveEnhancement({ tabId: 1, frameId: 0, videoId: 'video-1' });
      const disconnectSpy = vi.spyOn(machine.bridge, 'disconnect').mockImplementation(() => undefined);

      await machine.stopNativeSession('User stop.', true);

      expect(disconnectSpy).toHaveBeenCalled();
      expect(machine.store.activeSession).toBeNull();
      expect(await machine.store.loadActiveEnhancement()).toBeNull();
      expect(machine.status).toEqual({ active: false, state: 'stopped', message: 'User stop.' });
    });
  });

  describe('recoverPersistedSession', () => {
    it('does nothing when no session is persisted', async () => {
      const machine = createMachine();
      const connectSpy = vi.spyOn(machine.bridge, 'connectAndHandshake');
      await machine.recoverPersistedSession();
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('stops the session when the extension is disabled', async () => {
      const machine = createMachine({ isExtensionEnabled: async () => false });
      await machine.store.persistSession(sessionRecord());
      const stopSpy = vi.spyOn(machine, 'stopNativeSession').mockResolvedValue(undefined);
      await machine.recoverPersistedSession();
      expect(stopSpy).toHaveBeenCalledWith('AniWebScale was disabled.', true);
    });

    it('does not restore an unverified tab', async () => {
      const machine = createMachine();
      await machine.store.persistSession(sessionRecord({ tabId: 999 }));
      const stopSpy = vi.spyOn(machine, 'stopNativeSession').mockResolvedValue(undefined);
      await machine.recoverPersistedSession();
      expect(stopSpy).toHaveBeenCalledWith(
        'Could not recover the saved native capture window.',
        true,
        false,
      );
    });
  });

  describe('serialization invariant', () => {
    it('runs transitions through the serialized runner', async () => {
      const ops: string[] = [];
      const machine = createMachine({
        serialized: async <T>(operation: () => Promise<T>): Promise<T> => {
          ops.push('serialized');
          return operation();
        },
      });
      await machine.claimEnhancement('video-1', sender());
      expect(ops).toContain('serialized');
    });

    it('createAsyncSerializer never overlaps operations', async () => {
      const serialized = createAsyncSerializer();
      const events: string[] = [];
      let releaseFirst: () => void = () => undefined;
      const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });

      const first = serialized(async () => {
        events.push('first-start');
        await firstGate;
        events.push('first-end');
      });
      const second = serialized(async () => {
        events.push('second-start');
      });

      // The first op is running and blocked on its gate. The second op must
      // not start until the first finishes.
      await new Promise<void>(resolve => setTimeout(resolve, 10));
      expect(events).toEqual(['first-start']);
      releaseFirst();
      await Promise.all([first, second]);
      expect(events).toEqual(['first-start', 'first-end', 'second-start']);
    });
  });
});

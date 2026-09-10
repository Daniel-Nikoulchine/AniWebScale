import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { NativeSession } from '../src/background/native-session';
import type { NativeSessionRecord } from '../src/background-types';
import { NATIVE_SESSION_VERSION } from '../src/shared/session-recovery';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';
import type { NativeEvent, NativeConfiguration } from '../src/native/protocol';
import type { NativeMessagingClient } from '../src/native/client';
import type { NativeSessionTransport, NativeEventHandler } from '../src/background/native-session-transport';
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
    windows: {
      get: async () => { throw new Error('Not stubbed.'); },
      getAll: async () => [],
    },
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
  createTransport?: (onEvent: NativeEventHandler) => NativeSessionTransport;
}

const noopSendToFrame: SendToFrame = async () => undefined as never;

function createMachine(options: MachineOptions = {}): NativeSession {
  const serialized = options.serialized ?? (async <T>(operation: () => Promise<T>): Promise<T> => operation());
  return new NativeSession({
    sendToFrame: options.sendToFrame ?? noopSendToFrame,
    requestOriginConsent: options.requestOriginConsent ?? (async () => true),
    isExtensionEnabled: options.isExtensionEnabled ?? (async () => true),
    serialized,
    ...(options.createTransport ? { createTransport: options.createTransport } : {}),
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

  describe('startNativeFallback', () => {
    it('rejects a fallback request without the matching active enhancement claim', async () => {
      const machine = createMachine();
      const result = await machine.startNativeFallback({
        type: 'NATIVE_FALLBACK_REQUEST',
        videoId: 'video-1',
        configuration: config(),
        videoRect: { x: 0, y: 0, width: 640, height: 360, devicePixelRatio: 1 },
      }, sender());

      expect(result).toEqual({
        ok: false,
        status: 'denied',
        message: 'The native request did not belong to the active video.',
      });
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
      const fakeClient = {} as unknown as NativeMessagingClient;
      const machine = createMachine({
        // Use the transport injection instead of patching bridge.currentClient.
        createTransport: () => ({
          connect: async () => fakeClient,
          disconnect: () => undefined,
          get currentClient() {
            return fakeClient;
          },
        }),
        sendToFrame: async (_tabId: number, _frameId: number, message: unknown) => {
          sent.push(message);
          return undefined as never;
        },
      });
      await machine.store.persistSession(sessionRecord({ frameId: 2 }));

      // Wrong session: dropped.
      await machine.routeNativeEvent(pointerEvent('session-other'), fakeClient);
      expect(sent).toHaveLength(0);

      // Correct session: forwarded to source frame + top frame.
      await machine.routeNativeEvent(pointerEvent('session-1'), fakeClient);
      expect(sent.length).toBe(2);
      expect(sent[0]).toMatchObject({ type: 'NATIVE_POINTER_EVENT', event: 'move', x: 0.5, y: 0.5 });
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

  describe('injected transport', () => {
    it('starts a fallback through the injected transport connect', async () => {
      const connect = vi.fn(async () => ({
        connected: true,
        request: async () => ({ type: 'status', sessionId: 'session-1', state: 'capturing' }),
        post: () => undefined,
        disconnect: () => undefined,
      } as unknown as NativeMessagingClient));
      const transport: NativeSessionTransport = {
        connect,
        disconnect: () => undefined,
        get currentClient() {
          return null;
        },
      };
      const createTransport = vi.fn(() => transport);
      const machine = createMachine({
        createTransport,
        sendToFrame: async (_tabId, _frameId, message) => {
          const type = (message as { type?: string }).type;
          if (type === 'NATIVE_PREPARE_FULLSCREEN') {
            return {
              ok: true,
              intrinsicWidth: 1920,
              intrinsicHeight: 1080,
              targetWidth: 1920,
              targetHeight: 1080,
              originalTitle: 'Title',
            } as never;
          }
          if (type === 'NATIVE_MEASURE_FULLSCREEN') {
            return {
              ok: true,
              videoRect: { x: 0, y: 0, width: 1920, height: 1080, devicePixelRatio: 1 },
              innerWidth: 1920,
              innerHeight: 1080,
              devicePixelRatio: 1,
            } as never;
          }
          return undefined as never;
        },
      });
      chrome.tabs.get = async () => ({ windowId: 10, url: 'https://example.com/watch/1' } as chrome.tabs.Tab);
      await machine.store.persistActiveEnhancement({ tabId: 1, frameId: 0, videoId: 'video-1' });

      await machine.startNativeFallback({
        type: 'NATIVE_FALLBACK_REQUEST',
        videoId: 'video-1',
        configuration: config(),
        videoRect: { x: 0, y: 0, width: 640, height: 360, devicePixelRatio: 1 },
      }, sender());

      expect(createTransport).toHaveBeenCalledTimes(1);
      expect(connect).toHaveBeenCalled();
    });

    it('posts playback heartbeats through the injected client with a typed request id', async () => {
      const posted: Array<Record<string, unknown>> = [];
      const fakeClient = {
        connected: true,
        request: async () => ({ type: 'status' }),
        post: (message: unknown) => { posted.push(message as Record<string, unknown>); },
        disconnect: () => undefined,
      } as unknown as NativeMessagingClient;
      const connect = vi.fn(async () => fakeClient);
      const machine = createMachine({
        createTransport: () => ({
          connect,
          disconnect: () => undefined,
          get currentClient() {
            return fakeClient;
          },
        }),
      });
      await machine.store.persistSession(sessionRecord());

      await machine.sendPlaybackState('session-1', true, 12.5);

      expect(connect).toHaveBeenCalled();
      expect(posted).toHaveLength(1);
      expect(posted[0]).toMatchObject({
        type: 'status',
        sessionId: 'session-1',
        playbackActive: true,
        mediaTime: 12.5,
      });
      // No `playback-` prefix: the reply is identified by the tracked request id.
      expect(String(posted[0]!.requestId).startsWith('playback-')).toBe(false);
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

/**
 * RealEsrganHttpInfoBroker: a hung host must not pin the cached port.
 * Re-handshake failure over a live-but-silent port invalidates it so the
 * next get() reconnects fresh instead of burning another full timeout.
 */
import { describe, expect, it } from 'vitest';
import { RealEsrganHttpInfoBroker } from '../src/background/realesrgan-http-info';

interface FakePort {
  posts: unknown[];
  disconnected: boolean;
  answerHellos: boolean;
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
    removeListener(listener: (message: unknown) => void): void;
  };
  onDisconnect: {
    addListener(listener: () => void): void;
    removeListener(listener: () => void): void;
  };
}

function fakePort(answerHellos: boolean): FakePort {
  const messageListeners = new Set<(message: unknown) => void>();
  const port: FakePort = {
    posts: [],
    disconnected: false,
    answerHellos,
    postMessage(message: unknown) {
      port.posts.push(message);
      if (port.answerHellos) {
        queueMicrotask(() => {
          for (const listener of [...messageListeners]) {
            listener({ type: 'ready', httpPort: 17321, httpToken: 'token-abc' });
          }
        });
      }
    },
    disconnect() {
      port.disconnected = true;
    },
    onMessage: {
      addListener: (listener: (message: unknown) => void) => { messageListeners.add(listener); },
      removeListener: (listener: (message: unknown) => void) => { messageListeners.delete(listener); },
    },
    onDisconnect: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
  };
  return port;
}

describe('RealEsrganHttpInfoBroker hung-host recovery', () => {
  it('drops the cached port after a failed re-handshake and reconnects', async () => {
    let now = 1_000_000;
    let connects = 0;
    const ports: FakePort[] = [];
    const broker = new RealEsrganHttpInfoBroker({
      now: () => now,
      handshakeTimeoutMs: 20,
      connectNative: () => {
        connects += 1;
        // First host answers; every later (restarted) host answers too —
        // the hung one is simulated by flipping the FIRST port silent.
        const port = fakePort(true);
        ports.push(port);
        return port;
      },
    });

    const first = await broker.get();
    expect(first).toEqual({ ok: true, port: 17321, token: 'token-abc' });
    expect(connects).toBe(1);

    // The host hangs: live port, no ready reply past the TTL.
    ports[0]!.answerHellos = false;
    now += 61_000;
    const hung = await broker.get();
    expect(hung.ok).toBe(false);
    expect(ports[0]!.disconnected).toBe(true);

    // Next get() must reconnect fresh instead of reusing the dead port.
    const recovered = await broker.get();
    expect(recovered).toEqual({ ok: true, port: 17321, token: 'token-abc' });
    expect(connects).toBe(2);
  });

  it('keeps serving the cached endpoint inside the TTL without reconnecting', async () => {
    let connects = 0;
    const broker = new RealEsrganHttpInfoBroker({
      handshakeTimeoutMs: 20,
      connectNative: () => {
        connects += 1;
        return fakePort(true);
      },
    });

    expect(await broker.get()).toMatchObject({ ok: true });
    expect(await broker.get()).toMatchObject({ ok: true });
    expect(connects).toBe(1);
  });
});

/**
 * Loopback HTTP transport broker for the ncnn native host (p7).
 *
 * chrome.runtime.connectNative exists only in extension pages, not content
 * scripts, so the renderer cannot own the native-messaging port itself.
 * The background owns the port (host lifeline + handshake) and answers
 * REALESRGAN_HTTP_INFO requests with the host's loopback HTTP endpoint:
 * { port, token }. Frame payloads then cross the loopback socket directly
 * from the content script as raw RGBA8 (no base64, no framed-JSON parse).
 *
 * Port lifetime: exactly one native-messaging port stays connected for the
 * broker's lifetime — disconnecting it kills the host process. A stale
 * endpoint cache re-handshakes over the SAME port (the host's HTTP socket
 * outlives its hello replies); a dead port triggers a fresh connect, which
 * picks up a restarted host's new ephemeral port and token.
 *
 * Token secrecy is per-browser-process: only extension contexts can reach
 * the background, so handing the token to content scripts of any origin is
 * acceptable within this trust model (loopback + token gates every other
 * local process out).
 */

import { NATIVE_HOST_NAME, NATIVE_PROTOCOL_VERSION } from '../native/protocol';

export interface RealEsrganHttpEndpointInfo {
  ok: true;
  port: number;
  token: string;
}

export interface RealEsrganHttpEndpointFailure {
  ok: false;
  message: string;
}

export type RealEsrganHttpEndpoint = RealEsrganHttpEndpointInfo | RealEsrganHttpEndpointFailure;

interface EventLike<T extends (...args: never[]) => void = (...args: never[]) => void> {
  addListener(listener: T): void;
  removeListener(listener: T): void;
}

interface PortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: EventLike<(message: unknown) => void>;
  onDisconnect: EventLike<() => void>;
}

interface HttpInfoBrokerOptions {
  connectNative: () => PortLike;
  /** Injectable for tests; defaults to Date.now(). */
  now?: () => number;
  /** Injectable for tests. */
  handshakeTimeoutMs?: number;
}

const HANDSHAKE_TIMEOUT_MS = 8000; // host cold start: Vulkan init + model load
const INFO_TTL_MS = 60_000;

export class RealEsrganHttpInfoBroker {
  private port: PortLike | null = null;
  private inFlight: Promise<RealEsrganHttpEndpoint> | null = null;
  private generation = 0;
  private info: RealEsrganHttpEndpointInfo | null = null;
  private infoAt = 0;
  private readonly now: () => number;
  private readonly handshakeTimeoutMs: number;
  private readonly options: HttpInfoBrokerOptions;

  constructor(options: HttpInfoBrokerOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
  }

  /**
   * Returns the host's HTTP endpoint. Never throws: failures become
   * { ok: false } so the renderer can fall back to the WASM path without
   * another hop. Concurrent callers share one handshake.
   */
  get(): Promise<RealEsrganHttpEndpoint> {
    if (this.info && this.now() - this.infoAt < INFO_TTL_MS) {
      return Promise.resolve(this.info);
    }
    if (!this.inFlight) {
      this.inFlight = this.ensureEndpoint().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /** Drops cached info and the port; the next get() reconnects fresh. */
  invalidate(): void {
    this.generation += 1;
    this.info = null;
    this.infoAt = 0;
    if (this.port) {
      const port = this.port;
      this.port = null;
      try { port.disconnect(); } catch { /* already gone */ }
    }
  }

  dispose(): void {
    this.invalidate();
  }

  private ensureEndpoint(): Promise<RealEsrganHttpEndpoint> {
    if (this.port) {
      // Host process is alive; re-handshake over the same port to pick up
      // its (stable) HTTP endpoint. Cheaper than a host restart.
      return this.handshake(this.port);
    }
    return new Promise<RealEsrganHttpEndpoint>(resolve => {
      let port: PortLike;
      try {
        port = this.options.connectNative();
      } catch (error) {
        resolve({ ok: false, message: error instanceof Error ? error.message : String(error) });
        return;
      }
      port.onDisconnect.addListener(() => {
        if (this.port === port) {
          this.port = null;
          this.invalidate();
        }
      });
      const generation = this.generation;
      void this.handshake(port).then(outcome => {
        if (outcome.ok && generation === this.generation) {
          this.port = port;
        } else {
          // Either the handshake failed or invalidate() ran while it was in
          // flight: never resurrect a stale port, a broken host is
          // reconnected fresh on the next get().
          try { port.disconnect(); } catch { /* ignore */ }
        }
        resolve(outcome);
      });
    });
  }

  private handshake(port: PortLike): Promise<RealEsrganHttpEndpoint> {
    return new Promise<RealEsrganHttpEndpoint>(resolve => {
      const timer = setTimeout(() => {
        cleanup();
        resolve({ ok: false, message: 'native host handshake timed out' });
      }, this.handshakeTimeoutMs);

      const onMessage = (message: unknown) => {
        const reply = message as Record<string, unknown> | null;
        if (!reply || reply.type !== 'ready') return;
        cleanup();
        const httpPort = reply.httpPort;
        const httpToken = reply.httpToken;
        if (typeof httpPort === 'number' && httpPort > 0
            && typeof httpToken === 'string' && httpToken.length > 0) {
          this.info = { ok: true, port: httpPort, token: httpToken };
          this.infoAt = this.now();
          resolve(this.info);
        } else {
          resolve({ ok: false, message: 'native host has no http transport (older host build)' });
        }
      };
      const onDisconnect = () => {
        cleanup();
        resolve({ ok: false, message: 'native host disconnected during handshake' });
      };
      const cleanup = () => {
        clearTimeout(timer);
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
      };

      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
      try {
        port.postMessage({
          type: 'hello',
          protocolVersion: NATIVE_PROTOCOL_VERSION,
          requestId: `http-info-${this.now()}`,
        });
      } catch (error) {
        cleanup();
        resolve({ ok: false, message: error instanceof Error ? error.message : String(error) });
      }
    });
  }
}

/**
 * Production wiring: one broker per background lifetime, answering
 * REALESRGAN_HTTP_INFO router requests. Returns the endpoint object the
 * renderer expects ({ ok, port, token } | { ok: false, message }).
 */
export function createRealEsrganHttpInfoHandler(): () => Promise<RealEsrganHttpEndpoint> {
  const broker = new RealEsrganHttpInfoBroker({
    connectNative: () => chrome.runtime.connectNative(NATIVE_HOST_NAME) as unknown as PortLike,
  });
  return () => broker.get();
}

import {
  isNativeEvent,
  NativeErrorEvent,
  NativeEvent,
  NATIVE_HOST_NAME,
  NATIVE_PROTOCOL_VERSION,
  NativeRequest,
} from './protocol';

type NativeEventListener = (event: NativeEvent) => void;

interface PendingRequest {
  resolve: (event: NativeEvent) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class NativeHostUnavailableError extends Error {
  constructor(message = 'The AniWebScale native host is not installed or could not be started.') {
    super(message);
    this.name = 'NativeHostUnavailableError';
  }
}

/** Promise-oriented wrapper around Chrome/Firefox Native Messaging ports. */
export class NativeMessagingClient {
  private port: chrome.runtime.Port | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Set<NativeEventListener>();
  private disconnectReason: string | null = null;

  get connected(): boolean {
    return this.port !== null && this.disconnectReason === null;
  }

  connect(): void {
    if (this.connected) return;

    this.disconnectReason = null;
    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    } catch (error) {
      this.port = null;
      throw new NativeHostUnavailableError(error instanceof Error ? error.message : String(error));
    }

    this.port.onMessage.addListener(this.handleMessage);
    this.port.onDisconnect.addListener(this.handleDisconnect);
  }

  onEvent(listener: NativeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request<TEvent extends NativeEvent = NativeEvent>(
    request: NativeRequest,
    timeoutMs = 10_000,
  ): Promise<TEvent> {
    if (!this.connected || !this.port) {
      throw new NativeHostUnavailableError(this.disconnectReason ?? undefined);
    }

    return new Promise<TEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new Error(`Native host timed out while handling ${request.type}.`));
      }, timeoutMs);

      this.pending.set(request.requestId, {
        resolve: event => resolve(event as TEvent),
        reject,
        timer,
      });

      try {
        this.port!.postMessage(request);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(request.requestId);
        reject(new NativeHostUnavailableError(error instanceof Error ? error.message : String(error)));
      }
    });
  }

  post(request: NativeRequest): void {
    if (!this.connected || !this.port) {
      throw new NativeHostUnavailableError(this.disconnectReason ?? undefined);
    }
    this.port.postMessage(request);
  }

  disconnect(): void {
    const port = this.port;
    this.port = null;
    if (port) {
      port.onMessage.removeListener(this.handleMessage);
      port.onDisconnect.removeListener(this.handleDisconnect);
      try {
        port.disconnect();
      } catch {
        // The browser may already have disconnected a crashed native process.
      }
    }
    this.rejectPending(new Error('Native messaging connection closed.'));
  }

  private readonly handleMessage = (message: unknown): void => {
    if (!isNativeEvent(message)) {
      console.warn('[NativeBridge] Ignoring an invalid message from the native host.', message);
      return;
    }

    const nativeError = message.type === 'error' ? message as NativeErrorEvent : null;
    const requestId = 'requestId' in message ? message.requestId : undefined;
    if (requestId) {
      const pending = this.pending.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(requestId);
        if (nativeError) {
          pending.reject(new Error(`${nativeError.code}: ${nativeError.message}`));
        } else {
          pending.resolve(message);
        }
      }
    }

    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('[NativeBridge] Native event listener failed.', error);
      }
    }
  };

  private readonly handleDisconnect = (): void => {
    const lastError = chrome.runtime.lastError;
    this.disconnectReason = lastError?.message ?? 'The native host disconnected.';
    this.port = null;
    this.rejectPending(new NativeHostUnavailableError(this.disconnectReason));

    const event: NativeErrorEvent = {
      type: 'error',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      code: 'HOST_DISCONNECTED',
      message: this.disconnectReason,
      recoverable: false,
    };
    for (const listener of this.listeners) listener(event);
  };

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

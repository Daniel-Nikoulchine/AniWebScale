import type { NativeEvent } from '../native/protocol';
import { NativeMessagingClient } from '../native/client';
import { NativeBridge } from './native-bridge';

export type NativeEventHandler = (event: NativeEvent, client: NativeMessagingClient) => Promise<void>;

/** Keeps native-session orchestration independent from connection mechanics. */
export class NativeSessionTransport {
  constructor(
    private readonly bridge: NativeBridge,
    private readonly onEvent: NativeEventHandler,
  ) {}

  connect(): Promise<NativeMessagingClient> {
    return this.bridge.connectAndHandshake((event, client) => this.onEvent(event, client));
  }

  disconnect(): void {
    this.bridge.disconnect();
  }

  get currentClient(): NativeMessagingClient | null {
    return this.bridge.currentClient;
  }
}

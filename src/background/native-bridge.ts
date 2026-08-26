/**
 * Owns the native messaging client lifecycle: connect, handshake, capability
 * discovery and configuration validation. Extracted from background.ts so the
 * orchestration code can request a ready client without managing the
 * connection state itself.
 */
import { NativeMessagingClient } from '../native/client';
import {
  type NativeCapabilitiesEvent,
  type NativeConfiguration,
  type NativeEvent,
} from '../native/protocol';
import { nativeRequestBase } from '../background-helpers';

export class NativeBridge {
  private client: NativeMessagingClient | null = null;
  private capabilities: NativeCapabilitiesEvent | null = null;
  private handshakePromise: Promise<NativeMessagingClient> | null = null;

  /**
   * Return a connected, handshaked client, reusing the existing connection
   * when it is still healthy. Throws when the host is unavailable or does not
   * advertise the required Windows Graphics Capture + Direct3D 11 support.
   */
  async connectAndHandshake(onEvent: (event: NativeEvent, client: NativeMessagingClient) => void): Promise<NativeMessagingClient> {
    if (this.client?.connected && this.capabilities) return this.client;
    if (this.handshakePromise) return this.handshakePromise;

    const handshake = this.openConnection(onEvent);
    this.handshakePromise = handshake;
    try {
      return await handshake;
    } finally {
      if (this.handshakePromise === handshake) this.handshakePromise = null;
    }
  }

  private async openConnection(
    onEvent: (event: NativeEvent, client: NativeMessagingClient) => void,
  ): Promise<NativeMessagingClient> {
    this.client?.disconnect();
    this.client = null;
    this.capabilities = null;
    const client = new NativeMessagingClient();
    this.client = client;
    client.onEvent(event => onEvent(event, client));
    try {
      client.connect();

      const ready = await client.request({
        ...nativeRequestBase(),
        type: 'hello',
      }, 5_000);
      if (ready.type !== 'ready') {
        throw new Error('The native host returned an invalid handshake response.');
      }

      const capabilities = await client.request<NativeCapabilitiesEvent>({
        ...nativeRequestBase(),
        type: 'capabilities',
      }, 5_000);
      if (capabilities.type !== 'capabilities' || !capabilities.windowsCapture || !capabilities.d3d11) {
        throw new Error('The native host does not support Windows Graphics Capture and Direct3D 11.');
      }

      if (this.client !== client) throw new Error('The native messaging connection was replaced during handshake.');
      this.capabilities = capabilities;
      return client;
    } catch (error) {
      if (this.client === client) {
        this.client = null;
        this.capabilities = null;
      }
      client.disconnect();
      throw error;
    }
  }

  /** Disconnect and forget the current client and its capabilities. */
  disconnect(): void {
    const client = this.client;
    this.client = null;
    this.capabilities = null;
    this.handshakePromise = null;
    client?.disconnect();
  }

  /** The live client, if connected (used to scope events to the current host). */
  get currentClient(): NativeMessagingClient | null {
    return this.client;
  }

  /** Throw when the connected host does not support a requested configuration. */
  assertSupportsConfiguration(configuration: NativeConfiguration): void {
    const capabilities = this.capabilities;
    if (!capabilities?.modes.includes(configuration.mode)) {
      throw new Error(`The installed native renderer does not support ${configuration.mode}.`);
    }
    if (!capabilities.qualities.includes(configuration.quality)) {
      throw new Error(`The installed native renderer does not support quality ${configuration.quality}.`);
    }
    if (configuration.frameGenerationEnabled && !capabilities.frameGeneration) {
      throw new Error('The installed native renderer does not support frame generation.');
    }
  }
}

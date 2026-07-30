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

  /**
   * Return a connected, handshaked client, reusing the existing connection
   * when it is still healthy. Throws when the host is unavailable or does not
   * advertise the required Windows Graphics Capture + Direct3D 11 support.
   */
  async connectAndHandshake(onEvent: (event: NativeEvent, client: NativeMessagingClient) => void): Promise<NativeMessagingClient> {
    if (this.client?.connected && this.capabilities) return this.client;

    this.client?.disconnect();
    this.client = null;
    this.capabilities = null;
    const client = new NativeMessagingClient();
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

      this.capabilities = capabilities;
      this.client = client;
      return client;
    } catch (error) {
      client.disconnect();
      this.capabilities = null;
      throw error;
    }
  }

  /** Disconnect and forget the current client and its capabilities. */
  disconnect(): void {
    this.client?.disconnect();
    this.client = null;
    this.capabilities = null;
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

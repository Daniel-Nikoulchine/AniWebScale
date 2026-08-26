import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeBridge } from '../src/background/native-bridge';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';

function installPortHarness() {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  const ports: Array<{ postMessage: ReturnType<typeof vi.fn> }> = [];
  const connectNative = vi.fn(() => {
    const port = {
      onMessage: {
        addListener: (listener: (message: unknown) => void) => messageListeners.push(listener),
        removeListener: vi.fn(),
      },
      onDisconnect: {
        addListener: (listener: () => void) => disconnectListeners.push(listener),
        removeListener: vi.fn(),
      },
      postMessage: vi.fn(),
      disconnect: vi.fn(() => disconnectListeners.forEach(listener => listener())),
    };
    ports.push(port);
    return port;
  });
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'request-id') });
  vi.stubGlobal('chrome', {
    runtime: { connectNative, lastError: null },
  });

  return { connectNative, messageListeners, ports };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NativeBridge connection lifecycle', () => {
  it('shares one in-flight handshake between concurrent callers', async () => {
    const harness = installPortHarness();
    const bridge = new NativeBridge();
    const first = bridge.connectAndHandshake(vi.fn());
    const second = bridge.connectAndHandshake(vi.fn());

    expect(harness.connectNative).toHaveBeenCalledTimes(1);
    expect(harness.ports).toHaveLength(1);

    const port = harness.ports[0];
    const hello = port.postMessage.mock.calls[0][0];
    harness.messageListeners.forEach(listener => listener({
      type: 'ready',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: hello.requestId,
    }));
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledTimes(2));
    const capabilitiesRequest = port.postMessage.mock.calls[1][0];
    harness.messageListeners.forEach(listener => listener({
      type: 'capabilities',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: capabilitiesRequest.requestId,
      windowsCapture: true,
      d3d11: true,
      modes: ['A'],
      qualities: ['M'],
      frameGeneration: false,
    }));

    await expect(Promise.all([first, second])).resolves.toSatisfy(([left, right]) => left === right);
    expect(bridge.currentClient).toBe(await first);
  });
});

import { describe, expect, it } from 'vitest';
import {
  NATIVE_PROTOCOL_VERSION,
  isNativeConfiguration,
  isNativeEnhancementMode,
  isNativeEvent,
  isNativeQuality,
  isWindowNonce,
} from '../src/native/protocol';

describe('native messaging protocol', () => {
  it('validates all modes, qualities, configurations, and 128-bit nonces', () => {
    for (const mode of ['OFF', 'A', 'B', 'C', 'AA', 'BB', 'CA', 'CNNX2', 'ARTCNN', 'ACNET', 'ARNET']) {
      expect(isNativeEnhancementMode(mode)).toBe(true);
    }
    expect(isNativeEnhancementMode('GANX3')).toBe(false);
    expect(isNativeEnhancementMode('GANX4')).toBe(false);
    expect(isNativeEnhancementMode('custom')).toBe(false);
    expect(isNativeQuality('UL')).toBe(true);
    expect(isNativeQuality('L')).toBe(false);
    expect(isNativeConfiguration({ mode: 'OFF', quality: 'M', frameGenerationEnabled: true })).toBe(true);
    expect(isNativeConfiguration({ mode: 'REALESRGANX4', quality: 'UL', frameGenerationEnabled: false })).toBe(false);
    expect(isNativeConfiguration({ mode: 'BB', quality: 'M' })).toBe(false);
    expect(isNativeConfiguration({ mode: 'BB', quality: 'L', frameGenerationEnabled: false })).toBe(false);
    expect(isWindowNonce('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isWindowNonce('not-a-nonce')).toBe(false);
  });

  it('accepts a complete capabilities event', () => {
    expect(isNativeEvent({
      type: 'capabilities',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: 'request-1',
      windowsCapture: true,
      d3d11: true,
      modes: ['OFF', 'A', 'B', 'C', 'AA', 'BB', 'CA', 'CNNX2', 'ARTCNN', 'ACNET', 'ARNET'],
      qualities: ['M', 'VL', 'UL'],
      frameGeneration: true,
    })).toBe(true);
  });

  it('accepts the protocol-v3 exit-fullscreen command', () => {
    expect(NATIVE_PROTOCOL_VERSION).toBe(3);
    expect(isNativeEvent({
      type: 'mediaCommand',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: 'native-key-1',
      sessionId: 'session-1',
      command: 'exitFullscreen',
    })).toBe(true);
  });

  it('rejects malformed and version-mismatched events', () => {
    expect(isNativeEvent({
      type: 'metrics',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      sessionId: 'session-1',
      fps: Number.NaN,
      frameTimeMs: 10,
      droppedFrames: 0,
    })).toBe(false);
    expect(isNativeEvent({
      type: 'capabilities',
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: 'request-1',
      windowsCapture: true,
      d3d11: true,
      modes: ['A'],
      qualities: ['M'],
    })).toBe(false);
    expect(isNativeEvent({
      type: 'ready',
      protocolVersion: 99,
      requestId: 'request-1',
    })).toBe(false);
    expect(isNativeEvent(null)).toBe(false);
  });
});

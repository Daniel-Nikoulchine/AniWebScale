import { describe, expect, it } from 'vitest';
import {
  NATIVE_PROTOCOL_VERSION,
  clampNativePointerCoords,
  isNativeConfiguration,
  isNativeEnhancementMode,
  isNativeEvent,
  isNativeMediaCommandName,
  isNativePointerEventPayload,
  isNativePointerEventType,
  isNativeQuality,
  isWindowNonce,
  NATIVE_MEDIA_COMMAND_NAMES,
  NATIVE_POINTER_EVENT_TYPES,
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

  it('validates the shared media-command vocabulary', () => {
    for (const command of NATIVE_MEDIA_COMMAND_NAMES) {
      expect(isNativeMediaCommandName(command)).toBe(true);
    }
    expect(isNativeMediaCommandName('bogus')).toBe(false);
    expect(isNativeMediaCommandName(undefined)).toBe(false);
    expect(NATIVE_MEDIA_COMMAND_NAMES).toContain('exitFullscreen');
    expect(NATIVE_MEDIA_COMMAND_NAMES).toContain('playPause');
  });

  it('validates the shared pointer event types', () => {
    for (const type of NATIVE_POINTER_EVENT_TYPES) {
      expect(isNativePointerEventType(type)).toBe(true);
    }
    expect(isNativePointerEventType('hover')).toBe(false);
    expect(isNativePointerEventType(7)).toBe(false);
  });

  it('validates native pointer payloads and clamps coordinates', () => {
    expect(isNativePointerEventPayload({ event: 'move', x: 0.5, y: 0.5 })).toBe(true);
    expect(isNativePointerEventPayload({ event: 'down', x: 1, y: 0, button: 0, buttons: 1 })).toBe(true);
    expect(isNativePointerEventPayload({ event: 'move', x: 1.5, y: 0.5 })).toBe(false);
    expect(isNativePointerEventPayload({ event: 'move', x: -0.1, y: 0.5 })).toBe(false);
    expect(isNativePointerEventPayload({ event: 'hover', x: 0.5, y: 0.5 })).toBe(false);
    expect(isNativePointerEventPayload({ event: 'move', x: 'not-a-number', y: 0.5 })).toBe(false);

    expect(clampNativePointerCoords(1.5, -0.2)).toEqual({ x: 1, y: 0 });
    expect(clampNativePointerCoords(0.3, 0.7)).toEqual({ x: 0.3, y: 0.7 });
    expect(clampNativePointerCoords(Number.NaN, 0.5)).toEqual({ x: 0, y: 0.5 });
  });
});

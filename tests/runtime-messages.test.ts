import { describe, expect, it } from 'vitest';
import {
  parseFrameMessage,
  parseNativeFallbackResponse,
  parseRuntimeRequest,
} from '../src/shared/runtime-messages';

describe('parseRuntimeRequest', () => {
  it('parses a well-formed enhancement claim', () => {
    expect(parseRuntimeRequest({ type: 'ENHANCEMENT_CLAIM', videoId: 'v1' }))
      .toEqual({ kind: 'message', message: { type: 'ENHANCEMENT_CLAIM', videoId: 'v1' } });
  });

  it('rejects a claim without a video ID with the handler rejection text', () => {
    expect(parseRuntimeRequest({ type: 'ENHANCEMENT_CLAIM' }))
      .toEqual({ kind: 'invalid', type: 'ENHANCEMENT_CLAIM', message: 'Missing video ID.' });
  });

  it('keeps a release without a video ID parseable', () => {
    expect(parseRuntimeRequest({ type: 'ENHANCEMENT_RELEASE' }))
      .toEqual({ kind: 'message', message: { type: 'ENHANCEMENT_RELEASE', videoId: undefined } });
  });

  it('rejects a malformed native fallback request with a denied status', () => {
    expect(parseRuntimeRequest({ type: 'NATIVE_FALLBACK_REQUEST', videoId: 'v1' }))
      .toEqual({
        kind: 'invalid',
        type: 'NATIVE_FALLBACK_REQUEST',
        message: 'The native fallback request was invalid.',
        status: 'denied',
      });
  });

  it('accepts a flattened configuration on NATIVE_UPDATE_CONFIGURATION', () => {
    const parsed = parseRuntimeRequest({
      type: 'NATIVE_UPDATE_CONFIGURATION',
      mode: 'A',
      quality: 'M',
      frameGenerationEnabled: false,
    });
    expect(parsed.kind).toBe('message');
    if (parsed.kind === 'message') {
      expect(parsed.message).toMatchObject({
        type: 'NATIVE_UPDATE_CONFIGURATION',
        configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      });
    }
  });

  it('rejects an invalid configuration', () => {
    expect(parseRuntimeRequest({ type: 'NATIVE_UPDATE_CONFIGURATION', mode: 'X' }))
      .toEqual({
        kind: 'invalid',
        type: 'NATIVE_UPDATE_CONFIGURATION',
        message: 'Invalid native enhancement configuration.',
      });
  });

  it('rejects a playback state with a negative media time', () => {
    expect(parseRuntimeRequest({
      type: 'NATIVE_PLAYBACK_STATE',
      sessionId: 's1',
      videoId: 'v1',
      playbackActive: true,
      mediaTime: -1,
    })).toEqual({ kind: 'invalid', type: 'NATIVE_PLAYBACK_STATE', message: 'Invalid native playback state.' });
  });

  it('rejects an unknown media command', () => {
    expect(parseRuntimeRequest({ type: 'NATIVE_MEDIA_COMMAND', command: 'rewind' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_MEDIA_COMMAND', message: 'Invalid media command.' });
  });

  it('rejects a non-HTTP consent origin instead of treating it as reset-all', () => {
    expect(parseRuntimeRequest({ type: 'NATIVE_RESET_CONSENT', origin: 'javascript:alert(1)' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_RESET_CONSENT', message: 'Invalid consent origin.' });
  });

  it('reports unknown types as unknown', () => {
    expect(parseRuntimeRequest({ type: 'SOMETHING_ELSE' })).toEqual({ kind: 'unknown' });
    expect(parseRuntimeRequest(null)).toEqual({ kind: 'unknown' });
    expect(parseRuntimeRequest('string')).toEqual({ kind: 'unknown' });
  });
});

describe('parseFrameMessage', () => {
  it('parses a session preparation message', () => {
    expect(parseFrameMessage({
      type: 'NATIVE_PREPARE_FULLSCREEN',
      sessionId: 's1',
      nonce: 'n1',
      videoId: 'v1',
    })).toEqual({
      kind: 'message',
      message: { type: 'NATIVE_PREPARE_FULLSCREEN', sessionId: 's1', nonce: 'n1', videoId: 'v1' },
    });
  });

  it('rejects a session preparation without a nonce', () => {
    expect(parseFrameMessage({ type: 'NATIVE_PREPARE_FULLSCREEN', sessionId: 's1' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_PREPARE_FULLSCREEN', message: 'Invalid native session.' });
  });

  it('parses a pointer event with optional fields', () => {
    const parsed = parseFrameMessage({
      type: 'NATIVE_POINTER_EVENT',
      event: 'move',
      x: 0.5,
      y: 0.9,
      button: -1,
    });
    expect(parsed.kind).toBe('message');
    if (parsed.kind === 'message') {
      expect(parsed.message).toMatchObject({
        type: 'NATIVE_POINTER_EVENT',
        event: 'move',
        x: 0.5,
        y: 0.9,
        button: -1,
        buttons: undefined,
      });
    }
  });

  it('rejects a media command event with a missing command', () => {
    expect(parseFrameMessage({ type: 'NATIVE_MEDIA_COMMAND_EVENT' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_MEDIA_COMMAND_EVENT', message: 'Invalid media command.' });
  });

  it('rejects a pointer event with non-finite coordinates', () => {
    expect(parseFrameMessage({ type: 'NATIVE_POINTER_EVENT', event: 'move' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_POINTER_EVENT', message: 'Invalid native pointer event.' });
    expect(parseFrameMessage({ type: 'NATIVE_POINTER_EVENT', event: 'move', x: NaN, y: 0.5 }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_POINTER_EVENT', message: 'Invalid native pointer event.' });
  });

  it('rejects a force-stop without a video id', () => {
    expect(parseFrameMessage({ type: 'ANIME4K_FORCE_STOP' }))
      .toEqual({ kind: 'invalid', type: 'ANIME4K_FORCE_STOP', message: 'Force-stop without a video id.' });
  });

  it('drops a malformed session event payload instead of forwarding it', () => {
    const parsed = parseFrameMessage({ type: 'NATIVE_SESSION_EVENT', event: 'garbage' });
    expect(parsed).toEqual({
      kind: 'message',
      message: { type: 'NATIVE_SESSION_EVENT', event: undefined },
    });
  });

  it('reports unknown types as unknown', () => {
    expect(parseFrameMessage({ type: 'NOT_A_FRAME_MESSAGE' })).toEqual({ kind: 'unknown' });
    expect(parseFrameMessage(undefined)).toEqual({ kind: 'unknown' });
  });
});

describe('parseNativeFallbackResponse', () => {
  it('keeps a known status', () => {
    expect(parseNativeFallbackResponse({ ok: true, status: 'started', sessionId: 's1' }))
      .toEqual({ ok: true, status: 'started', sessionId: 's1' });
  });

  it('drops an unknown status instead of forwarding it', () => {
    expect(parseNativeFallbackResponse({ ok: true, status: 'bogus' }))
      .toEqual({ ok: true });
  });
});

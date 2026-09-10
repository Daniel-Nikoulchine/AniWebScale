import { describe, expect, it } from 'vitest';
import {
  anime4kForceStopMessage,
  enhancementClaimMessage,
  enhancementReleaseMessage,
  nativeFallbackRequestMessage,
  nativeMediaCommandEventMessage,
  nativeMeasureFullscreenMessage,
  nativePlaybackStateMessage,
  nativePointerEventMessage,
  nativePrepareFullscreenMessage,
  nativeResetConsentMessage,
  nativeRestoreSessionMessage,
  nativeRestoreTitleMessage,
  nativeSessionEventMessage,
  nativeSetTitleNonceMessage,
  nativeStopMessage,
  nativeUpdateConfigurationMessage,
  parseFrameMessage,
  parseNativeFallbackResponse,
  parseRuntimeRequest,
  parseSiteAccessIframeResponse,
  parseStatusResponse,
  realEsrganHttpInfoMessage,
  settingsUpdatedMessage,
  siteAccessIframeRequestMessage,
  siteAccessResultMessage,
  siteAccessSyncMessage,
} from '../src/shared/runtime-messages';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';

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

  it('treats the deleted request types as unknown', () => {
    for (const type of ['NATIVE_STATUS', 'NATIVE_MEDIA_COMMAND', 'NATIVE_POINTER', 'OPEN_OPTIONS_PAGE', 'OPEN_ONBOARDING']) {
      expect(parseRuntimeRequest({ type })).toEqual({ kind: 'unknown' });
    }
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

  it('rejects a malformed session event payload at the seam', () => {
    expect(parseFrameMessage({ type: 'NATIVE_SESSION_EVENT', event: 'garbage' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_SESSION_EVENT', message: 'Invalid native session event.' });
    expect(parseFrameMessage({ type: 'NATIVE_SESSION_EVENT' }))
      .toEqual({ kind: 'invalid', type: 'NATIVE_SESSION_EVENT', message: 'Invalid native session event.' });
  });

  it('reports unknown types as unknown', () => {
    expect(parseFrameMessage({ type: 'NOT_A_FRAME_MESSAGE' })).toEqual({ kind: 'unknown' });
    expect(parseFrameMessage(undefined)).toEqual({ kind: 'unknown' });
  });
});

describe('frame message builders round-trip through parseFrameMessage', () => {
  it('builds an ANIME4K_FORCE_STOP message', () => {
    const built = anime4kForceStopMessage('v1');
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_PREPARE_FULLSCREEN message', () => {
    const built = nativePrepareFullscreenMessage({ sessionId: 's1', nonce: 'n1', videoId: 'v1' });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_MEASURE_FULLSCREEN message with omitted optionals', () => {
    const built = nativeMeasureFullscreenMessage();
    expect(built).toEqual({ type: 'NATIVE_MEASURE_FULLSCREEN' });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_SET_TITLE_NONCE message', () => {
    const built = nativeSetTitleNonceMessage({ sessionId: 's1', nonce: 'n1', captureKind: 'direct-fullscreen' });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_RESTORE_SESSION message with omitted optionals', () => {
    const built = nativeRestoreSessionMessage();
    expect(built).toEqual({ type: 'NATIVE_RESTORE_SESSION' });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_RESTORE_TITLE message', () => {
    const built = nativeRestoreTitleMessage({ sessionId: 's1', nonce: 'n1', originalTitle: 'Title' });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_SESSION_EVENT message', () => {
    const event = {
      type: 'status' as const,
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      sessionId: 's1',
      state: 'capturing' as const,
    };
    const built = nativeSessionEventMessage(event);
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_POINTER_EVENT message', () => {
    const built = nativePointerEventMessage({ event: 'down', x: 0.25, y: 0.75, button: 0, buttons: 1 });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });

  it('builds a NATIVE_MEDIA_COMMAND_EVENT message', () => {
    const built = nativeMediaCommandEventMessage('seekBy', 10);
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
    expect(parseFrameMessage(nativeMediaCommandEventMessage('playPause')))
      .toEqual({ kind: 'message', message: { type: 'NATIVE_MEDIA_COMMAND_EVENT', command: 'playPause', value: undefined } });
  });
});

describe('runtime request builders round-trip through parseRuntimeRequest', () => {
  it('round-trips every runtime request builder', () => {
    const requests = [
      enhancementClaimMessage('v1'),
      enhancementReleaseMessage('v1'),
      enhancementReleaseMessage(),
      nativeStopMessage({ sessionId: 's1', videoId: 'v1' }),
      nativeUpdateConfigurationMessage({ configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false } }),
      nativePlaybackStateMessage({ sessionId: 's1', videoId: 'v1', playbackActive: true, mediaTime: 1.5 }),
      nativeResetConsentMessage('https://a.example'),
      nativeResetConsentMessage(),
      settingsUpdatedMessage(),
      siteAccessSyncMessage(),
      siteAccessIframeRequestMessage('https://voe.sx'),
      realEsrganHttpInfoMessage(),
    ];
    for (const request of requests) {
      const parsed = parseRuntimeRequest(request);
      expect(parsed.kind).toBe('message');
      if (parsed.kind === 'message') expect(parsed.message).toEqual(request);
    }
  });

  it('round-trips a native fallback request builder', () => {
    const request = nativeFallbackRequestMessage({
      videoId: 'v1',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      videoRect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    });
    const parsed = parseRuntimeRequest(request);
    expect(parsed.kind).toBe('message');
    if (parsed.kind === 'message') expect(parsed.message).toEqual(request);
  });

  it('round-trips a site-access-result frame builder', () => {
    const built = siteAccessResultMessage({ origin: 'https://voe.sx', outcome: 'granted', applied: true });
    expect(parseFrameMessage(built)).toEqual({ kind: 'message', message: built });
  });
});

describe('response envelope parsers', () => {
  it('treats an absent envelope as success for status responses', () => {
    expect(parseStatusResponse(undefined)).toEqual({ ok: true });
    expect(parseStatusResponse(null)).toEqual({ ok: true });
    expect(parseStatusResponse({ ok: false, message: 'nope' })).toEqual({ ok: false, message: 'nope' });
  });

  it('treats an absent envelope as a refusal for iframe access responses', () => {
    expect(parseSiteAccessIframeResponse(undefined)).toEqual({ ok: false });
    expect(parseSiteAccessIframeResponse({ ok: true, outcome: 'prompting' }))
      .toEqual({ ok: true, outcome: 'prompting' });
    expect(parseSiteAccessIframeResponse({ ok: true, outcome: 'bogus' })).toEqual({ ok: true });
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

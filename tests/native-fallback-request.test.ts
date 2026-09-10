import { describe, expect, it } from 'vitest';
import { isNativeFallbackRequest } from '../src/shared/native-fallback-request';

const request = {
  type: 'NATIVE_FALLBACK_REQUEST',
  videoId: 'video-current',
  configuration: {
    mode: 'A',
    quality: 'M',
    frameGenerationEnabled: false,
  },
  videoRect: {
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    devicePixelRatio: 1,
  },
} as const;

describe('native fallback request validation', () => {
  it('does not trust or require the caller-declared location origin', () => {
    expect(isNativeFallbackRequest(request)).toBe(true);
    expect(isNativeFallbackRequest({ ...request, origin: 'null' })).toBe(true);
    expect(isNativeFallbackRequest({ ...request, origin: 'https://spoofed.example' })).toBe(true);
  });

  it('ignores reason/output from older senders instead of rejecting', () => {
    // Dropped from the wire; a legacy sender that still includes them parses.
    expect(isNativeFallbackRequest({ ...request, reason: 'eme', output: 'auto' })).toBe(true);
  });

  it('allows a transient zero-area rect because capture geometry is remeasured', () => {
    expect(isNativeFallbackRequest({
      ...request,
      videoRect: { ...request.videoRect, width: 0, height: 0 },
    })).toBe(true);
  });

  it('still rejects unsafe geometry and malformed configuration fields', () => {
    expect(isNativeFallbackRequest({
      ...request,
      videoRect: { ...request.videoRect, width: -1 },
    })).toBe(false);
    expect(isNativeFallbackRequest({
      ...request,
      videoRect: { ...request.videoRect, devicePixelRatio: Number.NaN },
    })).toBe(false);
    expect(isNativeFallbackRequest({
      ...request,
      configuration: { ...request.configuration, frameGenerationEnabled: 'yes' },
    })).toBe(false);
  });
});

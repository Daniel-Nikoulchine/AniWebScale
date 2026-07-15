import { isNativeConfiguration } from '../native/protocol';
import type { NativeConfiguration } from '../native/protocol';

const FALLBACK_REASONS = [
  'eme',
  'security-error',
  'webgpu-unavailable',
  'video-frame-import-failed',
  'animejanai-performance',
  'native-selected',
] as const;

export type NativeFallbackReason = (typeof FALLBACK_REASONS)[number];

export interface NativeFallbackRequest {
  type: 'NATIVE_FALLBACK_REQUEST';
  videoId: string;
  reason: NativeFallbackReason;
  configuration: NativeConfiguration;
  output: 'auto';
  videoRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    devicePixelRatio: number;
  };
}

export function isNativeFallbackRequest(value: unknown): value is NativeFallbackRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<NativeFallbackRequest>;
  const rect = request.videoRect;
  return request.type === 'NATIVE_FALLBACK_REQUEST'
    && typeof request.videoId === 'string'
    && request.videoId.length > 0
    && request.videoId.length <= 128
    && typeof request.reason === 'string'
    && FALLBACK_REASONS.includes(request.reason as NativeFallbackReason)
    && isNativeConfiguration(request.configuration)
    && request.output === 'auto'
    && !!rect
    && [rect.x, rect.y, rect.width, rect.height, rect.devicePixelRatio]
      .every(component => typeof component === 'number' && Number.isFinite(component))
    // The source frame is measured again after fullscreen isolation. A player
    // can transiently report 0x0 during that transition without making the
    // request malformed; the authoritative later measurement must decide.
    && rect.width >= 0
    && rect.height >= 0
    && rect.devicePixelRatio > 0;
}

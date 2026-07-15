import type { RenderBackend } from '../types';

export type SelectedBackend = 'webgpu' | 'native' | 'unavailable';

/**
 * Resolve the explicit backend contract without silently overriding a forced
 * WebGPU choice. Auto alone is allowed to fall back to the native renderer.
 */
export function selectInitialBackend(options: {
  requested: RenderBackend;
  protectedPlayback: boolean;
  webgpuAvailable: boolean;
  webgpuCompatible: boolean;
  preferNative?: boolean;
}): SelectedBackend {
  if (options.requested === 'native') return 'native';
  const webgpuUsable = options.webgpuAvailable && options.webgpuCompatible;
  if (options.requested === 'webgpu') return webgpuUsable ? 'webgpu' : 'unavailable';
  return options.protectedPlayback || options.preferNative || !webgpuUsable ? 'native' : 'webgpu';
}

export function allowsNativeFallback(requested: RenderBackend): boolean {
  return requested === 'auto' || requested === 'native';
}

/**
 * Sites whose normal playback path is known to use EME. The encrypted event
 * can fire before a dynamically discovered video is observed, so relying on
 * video.mediaKeys alone may briefly select WebGPU for protected playback.
 */
export function isKnownProtectedPlaybackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'crunchyroll.com' || normalized.endsWith('.crunchyroll.com');
}

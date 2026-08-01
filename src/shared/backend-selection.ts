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
}): SelectedBackend {
  if (options.requested === 'native') return 'native';
  if (options.requested === 'webgpu') return options.webgpuAvailable ? 'webgpu' : 'unavailable';
  return options.protectedPlayback || !options.webgpuAvailable ? 'native' : 'webgpu';
}

export function allowsNativeFallback(requested: RenderBackend): boolean {
  return requested === 'auto' || requested === 'native';
}

export interface ProtectedPlaybackSignals {
  encryptedDetected: boolean;
  hasMediaKeys: boolean;
  pageProtectedPlaybackDetected: boolean;
  hostname: string;
}

/**
 * Resolve protected playback from runtime media signals first. The hostname
 * fallback only covers players that initialize EME before extension scripts
 * can observe the page; it must not be the primary website compatibility path.
 */
export function hasProtectedPlaybackSignal(signals: ProtectedPlaybackSignals): boolean {
  return signals.encryptedDetected
    || signals.hasMediaKeys
    || signals.pageProtectedPlaybackDetected
    || isKnownProtectedPlaybackHost(signals.hostname);
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

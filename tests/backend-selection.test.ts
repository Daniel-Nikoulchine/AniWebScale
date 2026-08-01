import { describe, expect, it } from 'vitest';
import {
  allowsNativeFallback,
  hasProtectedPlaybackSignal,
  isKnownProtectedPlaybackHost,
  selectInitialBackend,
} from '../src/shared/backend-selection';
import {
  ENHANCEMENT_MODES,
  isProcessingEnabled,
} from '../src/shared/presets';

describe('backend selection', () => {
  it('uses WebGPU first for readable frames in Auto mode', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: true,
    })).toBe('webgpu');
  });

  it('uses native for protected or WebGPU-unavailable video only in Auto mode', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: true,
      webgpuAvailable: true,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: false,
    })).toBe('native');
  });

  it('honors both forced backend choices', () => {
    expect(selectInitialBackend({
      requested: 'native',
      protectedPlayback: false,
      webgpuAvailable: true,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: true,
      webgpuAvailable: true,
    })).toBe('webgpu');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: false,
      webgpuAvailable: false,
    })).toBe('unavailable');
    expect(allowsNativeFallback('webgpu')).toBe(false);
    expect(allowsNativeFallback('auto')).toBe(true);
  });

  it('covers every mode and frame-generation state across all backend choices', () => {
    for (const mode of ENHANCEMENT_MODES) {
      for (const frameGenerationEnabled of [false, true]) {
        expect(isProcessingEnabled(mode, frameGenerationEnabled))
          .toBe(mode !== 'OFF' || frameGenerationEnabled);
        expect(selectInitialBackend({
          requested: 'native',
          protectedPlayback: false,
          webgpuAvailable: true,
        })).toBe('native');
        expect(selectInitialBackend({
          requested: 'auto',
          protectedPlayback: false,
          webgpuAvailable: true,
        })).toBe('webgpu');
        expect(selectInitialBackend({
          requested: 'webgpu',
          protectedPlayback: false,
          webgpuAvailable: true,
        })).toBe('webgpu');
      }
    }
  });
});

describe('known protected playback hosts', () => {
  it('recognizes Crunchyroll and its subdomains without matching lookalikes', () => {
    expect(isKnownProtectedPlaybackHost('crunchyroll.com')).toBe(true);
    expect(isKnownProtectedPlaybackHost('www.crunchyroll.com')).toBe(true);
    expect(isKnownProtectedPlaybackHost('WWW.CRUNCHYROLL.COM.')).toBe(true);
    expect(isKnownProtectedPlaybackHost('crunchyroll.com.example.org')).toBe(false);
    expect(isKnownProtectedPlaybackHost('example.org')).toBe(false);
  });

  it('uses a page-level DRM signal on every website instead of relying on a hostname list', () => {
    expect(hasProtectedPlaybackSignal({
      encryptedDetected: false,
      hasMediaKeys: false,
      pageProtectedPlaybackDetected: true,
      hostname: 'video.example.org',
    })).toBe(true);
    expect(hasProtectedPlaybackSignal({
      encryptedDetected: false,
      hasMediaKeys: false,
      pageProtectedPlaybackDetected: false,
      hostname: 'video.example.org',
    })).toBe(false);
  });
});

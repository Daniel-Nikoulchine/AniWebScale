import { describe, expect, it } from 'vitest';
import {
  allowsNativeFallback,
  isKnownProtectedPlaybackHost,
  selectInitialBackend,
} from '../src/shared/backend-selection';
import {
  ENHANCEMENT_MODES,
  isProcessingEnabled,
  supportsWebGpuConfiguration,
} from '../src/shared/presets';

describe('backend selection', () => {
  it('uses WebGPU first for readable frames in Auto mode', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: true,
    })).toBe('webgpu');
  });

  it('uses native for protected or WebGPU-unavailable video only in Auto mode', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: true,
      webgpuAvailable: true,
      webgpuCompatible: true,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: false,
      webgpuCompatible: true,
    })).toBe('native');
  });

  it('honors a performance preference in Auto while keeping forced WebGPU explicit', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: true,
      preferNative: true,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: true,
      preferNative: true,
    })).toBe('webgpu');
  });

  it('honors both forced backend choices', () => {
    expect(selectInitialBackend({
      requested: 'native',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: true,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: true,
      webgpuAvailable: true,
      webgpuCompatible: true,
    })).toBe('webgpu');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: false,
      webgpuAvailable: false,
      webgpuCompatible: true,
    })).toBe('unavailable');
    expect(allowsNativeFallback('webgpu')).toBe(false);
    expect(allowsNativeFallback('auto')).toBe(true);
  });

  it('routes a WebGPU-incompatible mode to Native only when the backend allows it', () => {
    expect(selectInitialBackend({
      requested: 'auto',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: false,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'native',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: false,
    })).toBe('native');
    expect(selectInitialBackend({
      requested: 'webgpu',
      protectedPlayback: false,
      webgpuAvailable: true,
      webgpuCompatible: false,
    })).toBe('unavailable');
  });

  it('covers every mode and frame-generation state across all backend choices', () => {
    const firefox = 'Mozilla/5.0 Firefox/147.0';
    for (const mode of ENHANCEMENT_MODES) {
      const webgpuCompatible = supportsWebGpuConfiguration(mode, firefox);
      for (const frameGenerationEnabled of [false, true]) {
        expect(isProcessingEnabled(mode, frameGenerationEnabled))
          .toBe(mode !== 'OFF' || frameGenerationEnabled);
        expect(selectInitialBackend({
          requested: 'native',
          protectedPlayback: false,
          webgpuAvailable: true,
          webgpuCompatible,
        })).toBe('native');
        expect(selectInitialBackend({
          requested: 'auto',
          protectedPlayback: false,
          webgpuAvailable: true,
          webgpuCompatible,
        })).toBe(webgpuCompatible ? 'webgpu' : 'native');
        expect(selectInitialBackend({
          requested: 'webgpu',
          protectedPlayback: false,
          webgpuAvailable: true,
          webgpuCompatible,
        })).toBe(webgpuCompatible ? 'webgpu' : 'unavailable');
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
});

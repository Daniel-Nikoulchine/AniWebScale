import { describe, expect, it } from 'vitest';
import { normalizeLegacySettings } from '../src/utils/migration';

describe('settings migration', () => {
  it('preserves canonical v1 settings', () => {
    expect(normalizeLegacySettings({
      mode: 'CA',
      quality: 'UL',
      backend: 'webgpu',
      statsEnabled: false,
      autoFullscreenEnabled: false,
    }, {
      hasCompletedOnboarding: true,
    })).toEqual({
      extensionEnabled: true,
      mode: 'CA',
      quality: 'UL',
      output: 'auto',
      backend: 'webgpu',
      statsEnabled: false,
      autoFullscreenEnabled: false,
      frameGenerationEnabled: false,
      hasCompletedOnboarding: true,
    });
  });

  it('maps the old built-in mode and tier while discarding unsafe values', () => {
    expect(normalizeLegacySettings({
      selectedModeId: 'builtin-mode-bb',
      backend: 'arbitrary',
    }, {
      performanceTier: 'balanced',
    })).toEqual({
      extensionEnabled: true,
      mode: 'BB',
      quality: 'VL',
      output: 'auto',
      backend: 'auto',
      statsEnabled: true,
      autoFullscreenEnabled: true,
      frameGenerationEnabled: false,
      hasCompletedOnboarding: false,
    });
  });

  it('preserves AI modes and frame generation settings', () => {
    expect(normalizeLegacySettings({
      mode: 'ANIMEJANAI',
      quality: 'M',
      frameGenerationEnabled: true,
    }, {})).toMatchObject({
      mode: 'ANIMEJANAI',
      frameGenerationEnabled: true,
    });
  });

  it('preserves the global extension toggle', () => {
    expect(normalizeLegacySettings({ extensionEnabled: false }, {})).toMatchObject({
      extensionEnabled: false,
    });
  });

  it('preserves the disabled enhancement mode', () => {
    expect(normalizeLegacySettings({ mode: 'OFF' }, {})).toMatchObject({
      mode: 'OFF',
    });
  });

  it('resets removed GAN modes to the safe default', () => {
    expect(normalizeLegacySettings({ mode: 'GANX3' }, {})).toMatchObject({ mode: 'A' });
    expect(normalizeLegacySettings({ mode: 'GANX4' }, {})).toMatchObject({ mode: 'A' });
  });

  it('resets the removed Real-ESRGAN mode to the safe default', () => {
    expect(normalizeLegacySettings({ mode: 'REALESRGANX4' }, {})).toMatchObject({ mode: 'A' });
  });
});

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
      realesrganCapHeight: 480,
      realesrganPrecision: 'int8',
      hasCompletedOnboarding: true,
      siteAccessModelAcknowledged: false,
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
      statsEnabled: false,
      autoFullscreenEnabled: true,
      frameGenerationEnabled: false,
      realesrganCapHeight: 480,
      realesrganPrecision: 'int8',
      hasCompletedOnboarding: false,
      siteAccessModelAcknowledged: false,
    });
  });

  it('preserves a previously capped RealESRGAN height', () => {
    expect(normalizeLegacySettings({}, { realesrganCapHeight: 432 })).toMatchObject({
      realesrganCapHeight: 432,
    });
    expect(normalizeLegacySettings({}, { realesrganCapHeight: 999 })).toMatchObject({
      realesrganCapHeight: 480,
    });
  });

  it('preserves a previously selected RealESRGAN precision', () => {
    expect(normalizeLegacySettings({}, { realesrganPrecision: 'fp16' })).toMatchObject({
      realesrganPrecision: 'fp16',
    });
    expect(normalizeLegacySettings({}, { realesrganPrecision: 'half' })).toMatchObject({
      realesrganPrecision: 'int8',
    });
    expect(normalizeLegacySettings({ realesrganPrecision: 'fp32' }, {})).toMatchObject({
      realesrganPrecision: 'fp32',
    });
  });

  it('preserves AI modes and frame generation settings', () => {
    expect(normalizeLegacySettings({
      mode: 'ARTCNN',
      quality: 'M',
      frameGenerationEnabled: true,
    }, {})).toMatchObject({
      mode: 'ARTCNN',
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

  it('preserves the site-access model acknowledgement so onboarding stays closed', () => {
    expect(normalizeLegacySettings({}, {
      hasCompletedOnboarding: true,
      siteAccessModelAcknowledged: true,
    })).toMatchObject({
      hasCompletedOnboarding: true,
      siteAccessModelAcknowledged: true,
    });
    expect(normalizeLegacySettings({}, {})).toMatchObject({
      siteAccessModelAcknowledged: false,
    });
  });

  it('resets removed GAN modes to the safe default', () => {
    expect(normalizeLegacySettings({ mode: 'GANX3' }, {})).toMatchObject({ mode: 'A' });
    expect(normalizeLegacySettings({ mode: 'GANX4' }, {})).toMatchObject({ mode: 'A' });
  });

  it('resets the removed Real-ESRGAN mode to the safe default', () => {
    expect(normalizeLegacySettings({ mode: 'REALESRGANX4' }, {})).toMatchObject({ mode: 'A' });
  });

  it('falls back to a sync-stored RealESRGAN cap when local has none', () => {
    expect(normalizeLegacySettings({ realesrganCapHeight: 432 }, {})).toMatchObject({
      realesrganCapHeight: 432,
    });
    expect(normalizeLegacySettings(
      { realesrganCapHeight: 432 },
      { realesrganCapHeight: 405 },
    )).toMatchObject({ realesrganCapHeight: 405 });
  });

});

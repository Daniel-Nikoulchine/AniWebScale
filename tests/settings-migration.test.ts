import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureLatestConfig, normalizeLegacySettings } from '../src/utils/migration';

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

  describe('ensureLatestConfig end-to-end', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function installStorage(syncData: Record<string, unknown>, localData: Record<string, unknown>) {
      const syncStore: Record<string, unknown> = { ...syncData };
      const localStore: Record<string, unknown> = { ...localData };
      const removed: { area: string; keys: string[] }[] = [];
      const getArea = (store: Record<string, unknown>) => async (keys?: string[] | string) => {
        if (keys === undefined) return { ...store };
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.filter(key => key in store).map(key => [key, store[key]]));
      };
      vi.stubGlobal('chrome', {
        storage: {
          sync: {
            get: vi.fn(getArea(syncStore)),
            set: vi.fn(async (record: Record<string, unknown>) => { Object.assign(syncStore, record); }),
            remove: vi.fn(async (keys: string[]) => {
              removed.push({ area: 'sync', keys });
              for (const key of keys) delete syncStore[key];
            }),
          },
          local: {
            get: vi.fn(getArea(localStore)),
            set: vi.fn(async (record: Record<string, unknown>) => { Object.assign(localStore, record); }),
            remove: vi.fn(async (keys: string[]) => {
              removed.push({ area: 'local', keys });
              for (const key of keys) delete localStore[key];
            }),
          },
        },
      });
      return { syncStore, localStore, removed };
    }

    it('preserves a sync-only RealESRGAN precision across migration', async () => {
      // Second-device profile: precision lived only in chrome.storage.sync.
      const { localStore } = installStorage({ realesrganPrecision: 'fp16' }, {});
      await ensureLatestConfig();
      expect(localStore.realesrganPrecision).toBe('fp16');
    });

    it('clears the legacy local selectedModeId after migration', async () => {
      const { localStore, removed } = installStorage({}, { selectedModeId: 'old-mode' });
      await ensureLatestConfig();
      expect(localStore.selectedModeId).toBeUndefined();
      expect(removed.some(entry => entry.area === 'local' && entry.keys.includes('selectedModeId'))).toBe(true);
    });
  });

});

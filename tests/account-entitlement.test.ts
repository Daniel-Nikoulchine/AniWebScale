import { describe, expect, it } from 'vitest';
import {
  applyFreePlanLimits,
  isStoredLicenseActive,
  requiresProConfiguration,
} from '../src/account/entitlement';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

describe('account entitlement gates', () => {
  it('keeps Free on Anime4K and WebGPU', () => {
    const limited = applyFreePlanLimits({
      ...DEFAULT_SETTINGS,
      mode: 'ANIMEJANAI',
      backend: 'native',
      frameGenerationEnabled: true,
    });
    expect(limited.mode).toBe('A');
    expect(limited.backend).toBe('webgpu');
    expect(limited.frameGenerationEnabled).toBe(false);
  });

  it('marks Native, AI, Auto fallback and frame generation as Pro', () => {
    expect(requiresProConfiguration({ backend: 'native' })).toBe(true);
    expect(requiresProConfiguration({ backend: 'auto' })).toBe(true);
    expect(requiresProConfiguration({ mode: 'ARTCNN' })).toBe(true);
    expect(requiresProConfiguration({ frameGenerationEnabled: true })).toBe(true);
    expect(requiresProConfiguration({ mode: 'A', backend: 'webgpu' })).toBe(false);
  });

  it('rejects expired or incomplete cached licenses', () => {
    expect(isStoredLicenseActive({
      plan: 'pro',
      status: 'active',
      features: ['native_renderer'],
      expiresAt: Date.now() - 1,
    })).toBe(false);
    expect(isStoredLicenseActive({
      plan: 'pro',
      status: 'active',
      features: ['native_renderer'],
      expiresAt: Date.now() + 60_000,
    })).toBe(true);
  });
});

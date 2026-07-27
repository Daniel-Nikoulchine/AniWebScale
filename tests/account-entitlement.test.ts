import { SignJWT, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  applyFreePlanLimits,
  isStoredLicenseActive,
  requiresProConfiguration,
  verifyLicenseToken,
} from '../src/account/entitlement';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

describe('account entitlement gates', () => {
  it('keeps Free on Anime4K and WebGPU', () => {
    const limited = applyFreePlanLimits({
      ...DEFAULT_SETTINGS,
      mode: 'ARTCNN',
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

  it('rejects a locally forged Pro token even when its claims look valid', async () => {
    Object.assign(globalThis, {
      __ANIME4K_ACCOUNT_API_URL__: 'https://aniwebscale.pages.dev',
    });
    const { privateKey } = await generateKeyPair('ES256');
    const forged = await new SignJWT({
      plan: 'pro',
      status: 'active',
      features: ['anime4k', 'webgpu', 'native_renderer'],
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'attacker' })
      .setSubject('00000000-0000-4000-8000-000000000001')
      .setIssuer('https://aniwebscale.pages.dev')
      .setAudience('aniwebscale-extension')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    await expect(verifyLicenseToken(
      forged,
      '00000000-0000-4000-8000-000000000001',
    )).rejects.toThrow();
  });
});

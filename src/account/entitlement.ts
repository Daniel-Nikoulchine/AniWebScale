import type { Anime4KWebExtSettings, EnhancementMode } from '../types';

export const LICENSE_STORAGE_KEY = 'aniwebscaleVerifiedLicenseV1';

export interface VerifiedLicenseState {
  token: string;
  userId: string;
  plan: 'free' | 'pro' | 'lifetime';
  status: 'inactive' | 'active' | 'trialing';
  features: string[];
  expiresAt: number;
}

export interface AccountStatus {
  signedIn: boolean;
  email: string | null;
  plan: 'free' | 'pro' | 'lifetime';
  status: string;
  features: string[];
  message?: string;
}

const AI_MODES = new Set<EnhancementMode>(['CNNX2', 'ARTCNN', 'ACNET', 'ARNET', 'ANIMEJANAI']);

export function isProMode(mode: EnhancementMode): boolean {
  return AI_MODES.has(mode);
}

export function requiresProConfiguration(settings: Partial<Anime4KWebExtSettings>): boolean {
  return (settings.mode !== undefined && isProMode(settings.mode))
    || (settings.backend !== undefined && settings.backend !== 'webgpu')
    || settings.frameGenerationEnabled === true;
}

export function isStoredLicenseActive(value: unknown, minimumValidityMs = 0): value is VerifiedLicenseState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<VerifiedLicenseState>;
  return (state.plan === 'pro' || state.plan === 'lifetime')
    && (state.status === 'active' || state.status === 'trialing')
    && Array.isArray(state.features)
    && state.features.includes('native_renderer')
    && typeof state.expiresAt === 'number'
    && state.expiresAt > Date.now() + minimumValidityMs;
}

export async function hasStoredProLicense(minimumValidityMs = 0): Promise<boolean> {
  const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
  return isStoredLicenseActive(stored[LICENSE_STORAGE_KEY], minimumValidityMs);
}

export function applyFreePlanLimits(settings: Anime4KWebExtSettings): Anime4KWebExtSettings {
  return {
    ...settings,
    mode: isProMode(settings.mode) ? 'A' : settings.mode,
    backend: 'webgpu',
    frameGenerationEnabled: false,
  };
}

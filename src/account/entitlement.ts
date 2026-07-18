import { importJWK, jwtVerify } from 'jose';
import type { Anime4KWebExtSettings, EnhancementMode } from '../types';

export const LICENSE_STORAGE_KEY = 'aniwebscaleVerifiedLicenseV1';

const LICENSE_PUBLIC_JWK = {
  kty: 'EC',
  use: 'sig',
  alg: 'ES256',
  crv: 'P-256',
  x: 'pFuIezfw7uChuH5OcZZstHMp_O1FzPd5A18vKIw-gXc',
  y: 'Rl2KW9NkEb8KWoTk3qQh-vsY--YHuQeldX6rNC37WRc',
  kid: 'aniwebscale-license-v1',
} as const;
const licenseKey = importJWK(LICENSE_PUBLIC_JWK, 'ES256');

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

const AI_MODES = new Set<EnhancementMode>(['CNNX2', 'ARTCNN', 'ACNET', 'ARNET']);

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

export async function verifyLicenseToken(
  token: string,
  userId: string,
  minimumValidityMs = 0,
): Promise<VerifiedLicenseState> {
  const apiUrl = __ANIME4K_ACCOUNT_API_URL__.replace(/\/$/, '');
  const { payload } = await jwtVerify(token, await licenseKey, {
    algorithms: ['ES256'],
    issuer: apiUrl,
    audience: 'aniwebscale-extension',
    subject: userId,
  });
  const plan = payload.plan === 'pro' || payload.plan === 'lifetime' ? payload.plan : 'free';
  const status = payload.status === 'active' || payload.status === 'trialing'
    ? payload.status
    : 'inactive';
  const features = Array.isArray(payload.features)
    ? payload.features.filter((value): value is string => typeof value === 'string')
    : [];
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now() + minimumValidityMs) {
    throw new Error('The signed license is expired.');
  }
  if (!features.includes('anime4k') || !features.includes('webgpu')) {
    throw new Error('The signed license has invalid feature claims.');
  }
  if ((plan === 'pro' || plan === 'lifetime')
    && (!features.includes('native_renderer') || status === 'inactive')) {
    throw new Error('The signed license has inconsistent Pro claims.');
  }
  return {
    token,
    userId,
    plan,
    status,
    features,
    expiresAt: payload.exp * 1000,
  };
}

export async function verifiedStoredLicense(minimumValidityMs = 0): Promise<VerifiedLicenseState | null> {
  const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
  const value = stored[LICENSE_STORAGE_KEY] as Partial<VerifiedLicenseState> | undefined;
  if (!value || typeof value.token !== 'string' || typeof value.userId !== 'string') return null;
  if (typeof __ANIME4K_E2E__ !== 'undefined' && __ANIME4K_E2E__) {
    return isStoredLicenseActive(value, minimumValidityMs) ? value as VerifiedLicenseState : null;
  }
  try {
    return await verifyLicenseToken(value.token, value.userId, minimumValidityMs);
  } catch {
    await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
    return null;
  }
}

export async function hasStoredProLicense(minimumValidityMs = 0): Promise<boolean> {
  const license = await verifiedStoredLicense(minimumValidityMs);
  return Boolean(license
    && (license.plan === 'pro' || license.plan === 'lifetime')
    && (license.status === 'active' || license.status === 'trialing')
    && license.features.includes('native_renderer'));
}

export function applyFreePlanLimits(settings: Anime4KWebExtSettings): Anime4KWebExtSettings {
  return {
    ...settings,
    mode: isProMode(settings.mode) ? 'A' : settings.mode,
    backend: 'webgpu',
    frameGenerationEnabled: false,
  };
}

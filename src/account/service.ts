import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createNeonAuthClient } from './neon-auth-client';
import {
  AccountStatus,
  LICENSE_STORAGE_KEY,
  VerifiedLicenseState,
  hasStoredProLicense,
  isStoredLicenseActive,
} from './entitlement';

const apiUrl = __ANIME4K_ACCOUNT_API_URL__.replace(/\/$/, '');
const authClient = createNeonAuthClient(__ANIME4K_NEON_AUTH_URL__);
const licenseJwks = createRemoteJWKSet(new URL(`${apiUrl}/api/license/jwks.json`));
let refreshPromise: Promise<AccountStatus> | null = null;

function message(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error?.message === 'string') return value.error.message;
  }
  return fallback;
}

async function sessionUser(): Promise<{ id: string; email: string | null } | null> {
  const result = await authClient.getSession();
  if (result?.error) throw new Error(message(result.error, 'Could not read the account session.'));
  const user = result.data?.user;
  if (!user || typeof user.id !== 'string') return null;
  return { id: user.id, email: typeof user.email === 'string' ? user.email : null };
}

async function authToken(): Promise<string> {
  const result = await authClient.token();
  if (result?.error) throw new Error(message(result.error, 'Could not refresh the account token.'));
  const token = result?.data?.token;
  if (typeof token !== 'string') throw new Error('The account session expired. Please sign in again.');
  return token;
}

function freeStatus(email: string | null = null, signedIn = false, statusMessage?: string): AccountStatus {
  return {
    signedIn,
    email,
    plan: 'free',
    status: 'inactive',
    features: ['anime4k', 'webgpu'],
    ...(statusMessage ? { message: statusMessage } : {}),
  };
}

async function e2eStoredStatus(): Promise<AccountStatus | null> {
  if (!__ANIME4K_E2E__) return null;
  const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
  const license = stored[LICENSE_STORAGE_KEY];
  if (!isStoredLicenseActive(license)) return null;
  const verified = license as VerifiedLicenseState;
  return {
    signedIn: true,
    email: 'e2e@aniwebscale.invalid',
    plan: verified.plan,
    status: verified.status,
    features: verified.features,
  };
}

async function refreshLicenseNow(): Promise<AccountStatus> {
  const e2eStatus = await e2eStoredStatus();
  if (e2eStatus) return e2eStatus;
  const user = await sessionUser();
  if (!user) {
    await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
    return freeStatus();
  }

  try {
    const token = await authToken();
    const response = await fetch(`${apiUrl}/api/license`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as {
      token?: string;
      error?: string;
    };
    if (!response.ok || typeof body.token !== 'string') {
      throw new Error(body.error || 'The license server is unavailable.');
    }
    const { payload } = await jwtVerify(body.token, licenseJwks, {
      algorithms: ['ES256'],
      issuer: apiUrl,
      audience: 'aniwebscale-extension',
      subject: user.id,
    });
    const plan = payload.plan === 'pro' || payload.plan === 'lifetime' ? payload.plan : 'free';
    const status = payload.status === 'active' || payload.status === 'trialing'
      ? payload.status
      : 'inactive';
    const features = Array.isArray(payload.features)
      ? payload.features.filter((value): value is string => typeof value === 'string')
      : ['anime4k', 'webgpu'];
    if (typeof payload.exp !== 'number') throw new Error('The signed license has no expiration.');

    const verified: VerifiedLicenseState = {
      token: body.token,
      userId: user.id,
      plan,
      status,
      features,
      expiresAt: payload.exp * 1000,
    };
    await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: verified });
    return { signedIn: true, email: user.email, plan, status, features };
  } catch (error) {
    await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
    return freeStatus(user.email, true, message(error, 'License refresh failed. Free mode remains active.'));
  }
}

export async function refreshAccountStatus(): Promise<AccountStatus> {
  if (!refreshPromise) {
    refreshPromise = refreshLicenseNow().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function getAccountStatus(refresh = true): Promise<AccountStatus> {
  const e2eStatus = await e2eStoredStatus();
  if (e2eStatus) return e2eStatus;
  if (refresh) return refreshAccountStatus();
  const user = await sessionUser();
  if (!user) return freeStatus();
  const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
  const license = stored[LICENSE_STORAGE_KEY] as Partial<VerifiedLicenseState> | undefined;
  if (license && typeof license.expiresAt === 'number' && license.expiresAt > Date.now()) {
    return {
      signedIn: true,
      email: user.email,
      plan: license.plan === 'pro' || license.plan === 'lifetime' ? license.plan : 'free',
      status: typeof license.status === 'string' ? license.status : 'inactive',
      features: Array.isArray(license.features) ? license.features : ['anime4k', 'webgpu'],
    };
  }
  return refreshAccountStatus();
}

export async function signIn(email: string, password: string): Promise<AccountStatus> {
  const result = await authClient.signIn.email({ email, password });
  if (result?.error) throw new Error(message(result.error, 'Sign in failed.'));
  return refreshAccountStatus();
}

export async function signUp(email: string, password: string): Promise<AccountStatus> {
  const result = await authClient.signUp.email({
    email,
    password,
    name: email.split('@')[0] || 'AniWebScale user',
  });
  if (result?.error) throw new Error(message(result.error, 'Account creation failed.'));
  return refreshAccountStatus();
}

export async function signOut(): Promise<AccountStatus> {
  await authClient.signOut();
  await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
  return freeStatus();
}

export async function ensureProAccess(): Promise<boolean> {
  if (await hasStoredProLicense(60_000)) return true;
  const status = await refreshAccountStatus();
  return (status.plan === 'pro' || status.plan === 'lifetime')
    && (status.status === 'active' || status.status === 'trialing');
}

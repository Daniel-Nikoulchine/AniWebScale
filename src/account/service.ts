import {
  AccountStatus,
  LICENSE_STORAGE_KEY,
  VerifiedLicenseState,
  hasStoredProLicense,
  isStoredLicenseActive,
  verifiedStoredLicense,
  verifyLicenseToken,
} from './entitlement';

const apiUrl = __ANIME4K_ACCOUNT_API_URL__.replace(/\/$/, '');
const EXTENSION_SESSION_KEY = 'aniwebscaleExtensionSessionV1';
const PKCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
let refreshPromise: Promise<AccountStatus> | null = null;

interface ExtensionSession {
  refreshToken: string;
  userId: string;
  email: string | null;
  expiresAt: number;
}

interface LicenseResponse {
  token?: string;
  userId?: string;
  email?: string | null;
  refreshToken?: string;
  sessionExpiresAt?: string;
  error?: string;
  code?: string;
}

class AccountServerError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AccountServerError';
  }
}

function message(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error?.message === 'string') return value.error.message;
  }
  return fallback;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomSecret(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
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

function statusFromLicense(
  license: VerifiedLicenseState,
  session: ExtensionSession,
  statusMessage?: string,
): AccountStatus {
  return {
    signedIn: true,
    email: session.email,
    plan: license.plan,
    status: license.status,
    features: license.features,
    ...(statusMessage ? { message: statusMessage } : {}),
  };
}

async function storedSession(): Promise<ExtensionSession | null> {
  const stored = await chrome.storage.local.get([EXTENSION_SESSION_KEY]);
  const value = stored[EXTENSION_SESSION_KEY] as Partial<ExtensionSession> | undefined;
  if (!value
    || typeof value.refreshToken !== 'string'
    || !PKCE_PATTERN.test(value.refreshToken)
    || typeof value.userId !== 'string'
    || typeof value.expiresAt !== 'number'
    || value.expiresAt <= Date.now()) {
    if (value) await chrome.storage.local.remove([EXTENSION_SESSION_KEY, LICENSE_STORAGE_KEY]);
    return null;
  }
  return {
    refreshToken: value.refreshToken,
    userId: value.userId,
    email: typeof value.email === 'string' ? value.email : null,
    expiresAt: value.expiresAt,
  };
}

async function storeLicense(body: LicenseResponse, session: ExtensionSession): Promise<VerifiedLicenseState> {
  if (typeof body.token !== 'string' || typeof body.userId !== 'string' || body.userId !== session.userId) {
    throw new Error('The license server returned an invalid account binding.');
  }
  const verified = await verifyLicenseToken(body.token, session.userId);
  await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: verified });
  return verified;
}

async function e2eStoredStatus(): Promise<AccountStatus | null> {
  if (!__ANIME4K_E2E__) return null;
  const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY]);
  const license = stored[LICENSE_STORAGE_KEY];
  if (!isStoredLicenseActive(license)) return freeStatus();
  const verified = license as VerifiedLicenseState;
  return {
    signedIn: true,
    email: 'e2e@aniwebscale.invalid',
    plan: verified.plan,
    status: verified.status,
    features: verified.features,
  };
}

async function extensionFetch(path: string, init: RequestInit = {}): Promise<LicenseResponse> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as LicenseResponse;
  if (!response.ok) {
    throw new AccountServerError(
      response.status,
      body.error || 'The account server is unavailable.',
      body.code,
    );
  }
  return body;
}

async function refreshLicenseNow(): Promise<AccountStatus> {
  const e2eStatus = await e2eStoredStatus();
  if (e2eStatus) return e2eStatus;
  const session = await storedSession();
  if (!session) {
    await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
    return freeStatus();
  }
  try {
    const body = await extensionFetch('/api/extension-auth/license', {
      headers: { Authorization: `Bearer ${session.refreshToken}` },
    });
    const updatedSession = {
      ...session,
      email: typeof body.email === 'string' ? body.email : session.email,
    };
    const verified = await storeLicense(body, updatedSession);
    await chrome.storage.local.set({ [EXTENSION_SESSION_KEY]: updatedSession });
    return statusFromLicense(verified, updatedSession);
  } catch (error) {
    if (error instanceof AccountServerError && (error.status === 401 || error.status === 403)) {
      await chrome.storage.local.remove([EXTENSION_SESSION_KEY, LICENSE_STORAGE_KEY]);
      return freeStatus(null, false, message(error, 'The account session expired. Please sign in again.'));
    }
    const statusMessage = message(error, 'License refresh failed. Your account remains connected.');
    const cachedLicense = await verifiedStoredLicense();
    return cachedLicense
      ? statusFromLicense(cachedLicense, session, statusMessage)
      : freeStatus(session.email, true, statusMessage);
  }
}

function launchWebAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, responseUrl => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!responseUrl) reject(new Error('The account authorization was canceled.'));
      else resolve(responseUrl);
    });
  });
}

async function authorize(mode: 'signin' | 'signup'): Promise<AccountStatus> {
  const redirectUri = chrome.identity.getRedirectURL('aniwebscale');
  const codeVerifier = randomSecret();
  const codeChallenge = await sha256(codeVerifier);
  const state = randomSecret();
  const authorizationUrl = new URL(`${apiUrl}/account`);
  authorizationUrl.searchParams.set('extension_authorize', '1');
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('device_name', 'AniWebScale browser extension');
  if (mode === 'signup') authorizationUrl.searchParams.set('mode', 'signup');

  const responseUrl = new URL(await launchWebAuthFlow(authorizationUrl.toString()));
  const expectedRedirect = new URL(redirectUri);
  if (responseUrl.origin !== expectedRedirect.origin
    || responseUrl.pathname !== expectedRedirect.pathname
    || responseUrl.searchParams.get('state') !== state) {
    throw new Error('The account authorization response was invalid.');
  }
  const code = responseUrl.searchParams.get('code') || '';
  if (!PKCE_PATTERN.test(code)) throw new Error('The account authorization code was invalid.');

  const body = await extensionFetch('/api/extension-auth/token', {
    method: 'POST',
    body: JSON.stringify({ code, codeVerifier, redirectUri }),
  });
  if (typeof body.refreshToken !== 'string'
    || !PKCE_PATTERN.test(body.refreshToken)
    || typeof body.userId !== 'string'
    || typeof body.sessionExpiresAt !== 'string') {
    throw new Error('The account server returned an invalid extension session.');
  }
  const session: ExtensionSession = {
    refreshToken: body.refreshToken,
    userId: body.userId,
    email: typeof body.email === 'string' ? body.email : null,
    expiresAt: Date.parse(body.sessionExpiresAt),
  };
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
    throw new Error('The account server returned an expired extension session.');
  }
  const verified = await storeLicense(body, session);
  await chrome.storage.local.set({ [EXTENSION_SESSION_KEY]: session });
  return statusFromLicense(verified, session, 'Extension connected securely.');
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
  const session = await storedSession();
  if (!session) return freeStatus();
  if (refresh) return refreshAccountStatus();
  const license = await verifiedStoredLicense();
  return license ? statusFromLicense(license, session) : refreshAccountStatus();
}

export async function signIn(): Promise<AccountStatus> {
  return authorize('signin');
}

export async function signUp(): Promise<AccountStatus> {
  return authorize('signup');
}

export async function signOut(): Promise<AccountStatus> {
  const session = await storedSession();
  if (session) {
    await extensionFetch('/api/extension-auth/revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.refreshToken}` },
      body: '{}',
    }).catch(() => undefined);
  }
  await chrome.storage.local.remove([EXTENSION_SESSION_KEY, LICENSE_STORAGE_KEY]);
  return freeStatus();
}

export async function ensureProAccess(): Promise<boolean> {
  if (await hasStoredProLicense(60_000)) return true;
  const status = await refreshAccountStatus();
  return (status.plan === 'pro' || status.plan === 'lifetime')
    && (status.status === 'active' || status.status === 'trialing');
}

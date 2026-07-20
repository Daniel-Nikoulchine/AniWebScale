import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EXTENSION_SESSION_KEY = 'aniwebscaleExtensionSessionV1';
const LICENSE_STORAGE_KEY = 'aniwebscaleVerifiedLicenseV1';

function fakeChromeStorage(initial: Record<string, unknown>) {
  const state = new Map(Object.entries(initial));
  const local = {
    async get(keys: string | string[]): Promise<Record<string, unknown>> {
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requested.filter(key => state.has(key)).map(key => [key, state.get(key)]),
      );
    },
    async set(values: Record<string, unknown>): Promise<void> {
      Object.entries(values).forEach(([key, value]) => state.set(key, value));
    },
    async remove(keys: string | string[]): Promise<void> {
      (Array.isArray(keys) ? keys : [keys]).forEach(key => state.delete(key));
    },
  };
  return {
    state,
    chrome: { storage: { local } },
  };
}

function validSession() {
  return {
    refreshToken: 'a'.repeat(43),
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'viewer@example.com',
    expiresAt: Date.now() + 60_000,
  };
}

async function loadAccountService(
  response: Response | Error,
): Promise<{
  refreshAccountStatus: typeof import('../src/account/service').refreshAccountStatus;
  state: Map<string, unknown>;
}> {
  const storage = fakeChromeStorage({ [EXTENSION_SESSION_KEY]: validSession() });
  vi.stubGlobal('__ANIME4K_ACCOUNT_API_URL__', 'https://aniwebscale.pages.dev');
  vi.stubGlobal('__ANIME4K_E2E__', false);
  vi.stubGlobal('chrome', storage.chrome);
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }));
  const service = await import('../src/account/service');
  return { refreshAccountStatus: service.refreshAccountStatus, state: storage.state };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extension account refresh', () => {
  it('retains the local session during temporary server failures', async () => {
    const { refreshAccountStatus, state } = await loadAccountService(new Response(
      JSON.stringify({ error: 'Extension authentication is temporarily unavailable.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ));

    const status = await refreshAccountStatus();

    expect(status.signedIn).toBe(true);
    expect(status.email).toBe('viewer@example.com');
    expect(status.plan).toBe('free');
    expect(status.message).toMatch(/temporarily unavailable/i);
    expect(state.has(EXTENSION_SESSION_KEY)).toBe(true);
  });

  it('clears the local session after a definitive authentication rejection', async () => {
    const { refreshAccountStatus, state } = await loadAccountService(new Response(
      JSON.stringify({ error: 'The extension session is invalid or expired.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    const status = await refreshAccountStatus();

    expect(status.signedIn).toBe(false);
    expect(status.email).toBeNull();
    expect(state.has(EXTENSION_SESSION_KEY)).toBe(false);
    expect(state.has(LICENSE_STORAGE_KEY)).toBe(false);
  });
});

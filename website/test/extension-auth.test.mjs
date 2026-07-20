import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_EXTENSION_REDIRECTS,
  ExtensionAuthError,
  createExtensionAuthService,
} from '../lib/extension-auth.mjs';

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function challenge(verifier) {
  return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

function fakeDatabase() {
  const codes = new Map();
  const sessions = new Map();
  const query = async (sql, values = []) => {
    if (sql.includes('FROM neon_auth."user"')) {
      return {
        rows: [{
          id: values[0],
          email: 'verified@example.com',
          email_verified: true,
          banned: false,
        }],
      };
    }
    if (sql.startsWith('DELETE FROM app.extension_auth_codes WHERE expires_at')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO app.extension_auth_codes')) {
      codes.set(values[0], {
        user_id: values[1],
        code_challenge: values[2],
        redirect_uri: values[3],
        expires_at: values[4],
        device_name: values[5],
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('DELETE FROM app.extension_auth_codes WHERE code_hash')) {
      return { rows: [], rowCount: codes.delete(values[0]) ? 1 : 0 };
    }
    if (sql.includes('FROM app.extension_auth_codes')) {
      const row = codes.get(values[0]);
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('INSERT INTO app.extension_sessions')) {
      sessions.set(values[0], {
        user_id: values[1],
        expires_at: values[2],
        device_name: values[3],
        revoked_at: null,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM app.extension_sessions')) {
      const row = sessions.get(values[0]);
      return { rows: row && !row.revoked_at ? [{ user_id: row.user_id }] : [] };
    }
    if (sql.startsWith('UPDATE app.extension_sessions SET last_used_at')) {
      return { rows: [], rowCount: sessions.has(values[0]) ? 1 : 0 };
    }
    if (sql.includes('SET revoked_at')) {
      const row = sessions.get(values[0]);
      if (row) row.revoked_at = new Date();
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('FROM app.entitlements')) {
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in fake database: ${sql}`);
  };
  return {
    configured: true,
    query,
    transaction: callback => callback(query),
  };
}

const licenseService = {
  async sign({ userId }) {
    return {
      token: `signed-for-${userId}`,
      plan: 'free',
      status: 'inactive',
      features: ['anime4k', 'webgpu'],
      expiresIn: 900,
    };
  },
};

describe('extension web authorization', () => {
  it('exchanges each PKCE-bound authorization code only once', async () => {
    const service = createExtensionAuthService({
      database: fakeDatabase(),
      licenseService,
      now: () => Date.now(),
    });
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const redirectUri = DEFAULT_EXTENSION_REDIRECTS[0];
    const authorization = await service.authorize(
      { id: '00000000-0000-4000-8000-000000000001' },
      { redirectUri, codeChallenge: await challenge(verifier), state },
    );
    const responseUrl = new URL(authorization.redirectUrl);
    const code = responseUrl.searchParams.get('code');
    assert.equal(responseUrl.searchParams.get('state'), state);
    assert.ok(code);

    await assert.rejects(
      service.exchange({
        code,
        codeVerifier: base64Url(crypto.getRandomValues(new Uint8Array(32))),
        redirectUri,
      }),
      error => error instanceof ExtensionAuthError && error.code === 'INVALID_GRANT',
    );

    const exchanged = await service.exchange({ code, codeVerifier: verifier, redirectUri });
    assert.match(exchanged.refreshToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(exchanged.userId, '00000000-0000-4000-8000-000000000001');

    await assert.rejects(
      service.exchange({ code, codeVerifier: verifier, redirectUri }),
      error => error instanceof ExtensionAuthError && error.code === 'INVALID_GRANT',
    );

    const refreshed = await service.refresh(new Request('https://example.test', {
      headers: { Authorization: `Bearer ${exchanged.refreshToken}` },
    }));
    assert.equal(refreshed.userId, exchanged.userId);
  });

  it('rejects redirects that do not belong to the published extensions', async () => {
    const service = createExtensionAuthService({
      database: fakeDatabase(),
      licenseService,
    });
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    await assert.rejects(
      service.authorize(
        { id: '00000000-0000-4000-8000-000000000001' },
        {
          redirectUri: 'https://evil.invalid/callback',
          codeChallenge: await challenge(verifier),
          state: base64Url(crypto.getRandomValues(new Uint8Array(32))),
        },
      ),
      error => error instanceof ExtensionAuthError
        && error.code === 'INVALID_AUTHORIZATION_REQUEST',
    );
  });
});

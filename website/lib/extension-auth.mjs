import { entitlementForUser } from './entitlements.mjs';

const CODE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PKCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CHROME_EXTENSION_ID = 'dlomjcbmgkfaebhplgoihbjfclaagike';
const FIREFOX_EXTENSION_ID_HASH = '4a2640f4cc9e98dd67845bfd692f3cf39fa43b12';

export const DEFAULT_EXTENSION_REDIRECTS = Object.freeze([
  `https://${CHROME_EXTENSION_ID}.chromiumapp.org/aniwebscale`,
  `https://${FIREFOX_EXTENSION_ID_HASH}.extensions.allizom.org/aniwebscale`,
]);

export class ExtensionAuthError extends Error {
  constructor(status, message, code = 'EXTENSION_AUTH_ERROR') {
    super(message);
    this.name = 'ExtensionAuthError';
    this.status = status;
    this.code = code;
  }
}

function base64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomSecret() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function bearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return /^Bearer\s+([A-Za-z0-9_-]{43})$/i.exec(authorization)?.[1] || '';
}

function validRedirect(value, allowedRedirects) {
  return allowedRedirects.has(value) && (() => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  })();
}

async function verifiedAccount(query, userId) {
  const result = await query(
    `SELECT id::text, email, "emailVerified" AS email_verified, banned
       FROM neon_auth."user"
      WHERE id = $1`,
    [userId],
  );
  const account = result.rows[0];
  if (!account || account.banned === true) {
    throw new ExtensionAuthError(403, 'This account cannot authorize the extension.', 'ACCOUNT_UNAVAILABLE');
  }
  if (account.email_verified !== true) {
    throw new ExtensionAuthError(403, 'Verify your email before connecting the extension.', 'EMAIL_NOT_VERIFIED');
  }
  return {
    id: account.id,
    email: typeof account.email === 'string' ? account.email : null,
  };
}

function parseAuthorizationBody(body, allowedRedirects) {
  const redirectUri = stringValue(body?.redirectUri);
  const codeChallenge = stringValue(body?.codeChallenge);
  const state = stringValue(body?.state);
  const deviceNameInput = stringValue(body?.deviceName).replace(/\s+/g, ' ');
  if (!validRedirect(redirectUri, allowedRedirects)
    || !PKCE_PATTERN.test(codeChallenge)
    || !STATE_PATTERN.test(state)) {
    throw new ExtensionAuthError(400, 'Invalid extension authorization request.', 'INVALID_AUTHORIZATION_REQUEST');
  }
  if (deviceNameInput.length > 80) {
    throw new ExtensionAuthError(400, 'Extension device name is too long.', 'INVALID_DEVICE_NAME');
  }
  const deviceName = deviceNameInput || 'AniWebScale extension';
  return { redirectUri, codeChallenge, state, deviceName };
}

function parseExchangeBody(body, allowedRedirects) {
  const code = stringValue(body?.code);
  const codeVerifier = stringValue(body?.codeVerifier);
  const redirectUri = stringValue(body?.redirectUri);
  if (!PKCE_PATTERN.test(code)
    || !PKCE_PATTERN.test(codeVerifier)
    || !validRedirect(redirectUri, allowedRedirects)) {
    throw new ExtensionAuthError(400, 'Invalid extension token request.', 'INVALID_TOKEN_REQUEST');
  }
  return { code, codeVerifier, redirectUri };
}

/**
 * @param {{
 *   database?: any,
 *   licenseService?: any,
 *   allowedRedirects?: readonly string[],
 *   now?: () => number,
 * }} [options]
 */
export function createExtensionAuthService({
  database,
  licenseService,
  allowedRedirects = DEFAULT_EXTENSION_REDIRECTS,
  now = () => Date.now(),
} = {}) {
  const redirectAllowlist = new Set(allowedRedirects);

  function requireDatabase() {
    if (!database?.configured) {
      throw new ExtensionAuthError(503, 'Extension authentication is not configured.', 'DATABASE_UNAVAILABLE');
    }
  }

  async function signedAccount(query, userId, email) {
    const entitlement = await entitlementForUser(query, userId);
    const license = await licenseService.sign({
      userId,
      plan: entitlement.plan,
      status: entitlement.status,
      currentPeriodEnd: entitlement.current_period_end,
    });
    return {
      ...license,
      userId,
      email,
      cancelAtPeriodEnd: entitlement.cancel_at_period_end,
    };
  }

  return {
    async authorize(user, body) {
      requireDatabase();
      const { redirectUri, codeChallenge, state, deviceName } = parseAuthorizationBody(body, redirectAllowlist);
      const account = await verifiedAccount(database.query, user.id);
      const code = randomSecret();
      const codeHash = await sha256(code);
      const expiresAt = new Date(now() + CODE_TTL_MS);

      await database.transaction(async query => {
        await query('DELETE FROM app.extension_auth_codes WHERE expires_at <= now()');
        await query(
          `INSERT INTO app.extension_auth_codes (
             code_hash, user_id, code_challenge, redirect_uri, expires_at, device_name
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [codeHash, account.id, codeChallenge, redirectUri, expiresAt, deviceName],
        );
      });

      const redirect = new URL(redirectUri);
      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', state);
      return { redirectUrl: redirect.toString() };
    },

    async exchange(body) {
      requireDatabase();
      const { code, codeVerifier, redirectUri } = parseExchangeBody(body, redirectAllowlist);
      const codeHash = await sha256(code);
      const calculatedChallenge = await sha256(codeVerifier);
      const refreshToken = randomSecret();
      const refreshTokenHash = await sha256(refreshToken);
      const sessionExpiresAt = new Date(now() + SESSION_TTL_MS);

      return database.transaction(async query => {
        const result = await query(
          `SELECT user_id::text, code_challenge, redirect_uri, expires_at, device_name
             FROM app.extension_auth_codes
            WHERE code_hash = $1
            FOR UPDATE`,
          [codeHash],
        );
        const authorization = result.rows[0];
        if (!authorization
          || new Date(authorization.expires_at).getTime() <= now()
          || authorization.redirect_uri !== redirectUri
          || !constantTimeEqual(authorization.code_challenge, calculatedChallenge)) {
          throw new ExtensionAuthError(400, 'The extension authorization code is invalid or expired.', 'INVALID_GRANT');
        }

        const account = await verifiedAccount(query, authorization.user_id);
        await query('DELETE FROM app.extension_auth_codes WHERE code_hash = $1', [codeHash]);
        await query(
          `INSERT INTO app.extension_sessions (
             token_hash, user_id, expires_at, device_name
           ) VALUES ($1, $2, $3, $4)`,
          [refreshTokenHash, account.id, sessionExpiresAt, authorization.device_name],
        );
        const signed = await signedAccount(query, account.id, account.email);
        return {
          ...signed,
          refreshToken,
          sessionExpiresAt: sessionExpiresAt.toISOString(),
        };
      });
    },

    async refresh(request) {
      requireDatabase();
      const token = bearerToken(request);
      if (!token) {
        throw new ExtensionAuthError(401, 'Extension authentication required.', 'EXTENSION_SESSION_REQUIRED');
      }
      const tokenHash = await sha256(token);

      return database.transaction(async query => {
        const result = await query(
          `SELECT user_id::text
             FROM app.extension_sessions
            WHERE token_hash = $1
              AND revoked_at IS NULL
              AND expires_at > now()
            FOR UPDATE`,
          [tokenHash],
        );
        const session = result.rows[0];
        if (!session) {
          throw new ExtensionAuthError(401, 'The extension session is invalid or expired.', 'EXTENSION_SESSION_INVALID');
        }
        const account = await verifiedAccount(query, session.user_id);
        await query(
          'UPDATE app.extension_sessions SET last_used_at = now() WHERE token_hash = $1',
          [tokenHash],
        );
        return signedAccount(query, account.id, account.email);
      });
    },

    async revoke(request) {
      requireDatabase();
      const token = bearerToken(request);
      if (!token) return { success: true };
      const tokenHash = await sha256(token);
      await database.query(
        `UPDATE app.extension_sessions
            SET revoked_at = COALESCE(revoked_at, now())
          WHERE token_hash = $1`,
        [tokenHash],
      );
      return { success: true };
    },
  };
}

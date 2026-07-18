import { createRemoteJWKSet, jwtVerify } from 'jose';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export async function requireActiveAccount(database, user) {
  if (!database?.configured) {
    throw new AuthenticationError('Account authentication is not configured.');
  }
  const result = await database.query(
    `SELECT id::text, email
       FROM neon_auth."user"
      WHERE id = $1
        AND banned IS NOT TRUE`,
    [user.id],
  );
  const account = result.rows[0];
  if (!account) throw new AuthenticationError('This account is unavailable.');
  return {
    id: account.id,
    email: typeof account.email === 'string' ? account.email : user.email,
  };
}

export function createAuthVerifier(authBaseUrl = process.env.NEON_AUTH_URL || '') {
  const normalized = authBaseUrl.replace(/\/$/, '');
  const origin = normalized ? new URL(normalized).origin : '';
  const jwks = normalized ? createRemoteJWKSet(new URL(`${normalized}/.well-known/jwks.json`)) : null;

  return {
    configured: Boolean(jwks),
    authBaseUrl: normalized,

    async authenticate(request) {
      if (!jwks) throw new AuthenticationError('Account authentication is not configured.');
      const authorization = typeof request.headers?.get === 'function'
        ? request.headers.get('authorization') || ''
        : request.headers?.authorization || '';
      const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
      if (!match) throw new AuthenticationError();

      try {
        const { payload } = await jwtVerify(match[1], jwks, {
          algorithms: ['EdDSA'],
          issuer: origin,
          audience: origin,
        });
        if (typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) {
          throw new AuthenticationError('The account token has no valid user identifier.');
        }
        return {
          id: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : null,
        };
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError('The account token is invalid or expired.');
      }
    },
  };
}

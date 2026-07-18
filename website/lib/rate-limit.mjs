import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export class RateLimitError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'RateLimitError';
    this.status = status;
    this.code = code;
  }
}

export function privacyDigest(value, key) {
  return createHmac('sha256', key).update(String(value)).digest('hex');
}

export function normalizeRequestAddress(value) {
  const address = typeof value === 'string' ? value.trim() : '';
  return address.length <= 64 && isIP(address) ? address : 'unknown';
}

export function requestAddress(request, trustedHeaderName = '') {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(trustedHeaderName)) return 'unknown';
  return normalizeRequestAddress(request.headers.get(trustedHeaderName));
}

export async function consumeRateLimit(query, key, limit, windowSeconds) {
  const result = await query(
    `INSERT INTO app.auth_rate_limits (bucket_key, window_started_at, attempts)
     VALUES ($1, now(), 1)
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_started_at = CASE
         WHEN app.auth_rate_limits.window_started_at <= now() - ($2 * interval '1 second')
           THEN now()
         ELSE app.auth_rate_limits.window_started_at
       END,
       attempts = CASE
         WHEN app.auth_rate_limits.window_started_at <= now() - ($2 * interval '1 second')
           THEN 1
         ELSE app.auth_rate_limits.attempts + 1
       END
     RETURNING attempts`,
    [key, windowSeconds],
  );
  return Number(result.rows[0]?.attempts || 0) <= limit;
}

const POLICIES = Object.freeze({
  checkout: Object.freeze({ limit: 6, windowSeconds: 15 * 60 }),
  checkout_lookup: Object.freeze({ limit: 30, windowSeconds: 15 * 60 }),
  billing_portal: Object.freeze({ limit: 10, windowSeconds: 15 * 60 }),
  account_export: Object.freeze({ limit: 6, windowSeconds: 60 * 60 }),
  account_delete: Object.freeze({ limit: 3, windowSeconds: 60 * 60 }),
  session_revoke_all: Object.freeze({ limit: 5, windowSeconds: 15 * 60 }),
  session_revoke_one: Object.freeze({ limit: 20, windowSeconds: 15 * 60 }),
  extension_authorize: Object.freeze({ limit: 12, windowSeconds: 15 * 60 }),
  extension_exchange: Object.freeze({ limit: 20, windowSeconds: 15 * 60, addressOnly: true }),
});

/**
 * @param {{
 *   database?: any,
 *   identifierHashKey?: any,
 *   addressForRequest?: (request: Request) => string,
 * }} [options]
 */
export function createApiRateLimitService({
  database,
  identifierHashKey,
  addressForRequest = () => 'unknown',
} = {}) {
  return {
    async enforce(request, action, userId = '') {
      const policy = POLICIES[action];
      if (!policy) throw new Error(`Unknown API rate-limit policy: ${action}.`);
      if (!database?.configured || !identifierHashKey) {
        throw new RateLimitError(503, 'Request protection is temporarily unavailable.', 'RATE_LIMIT_UNAVAILABLE');
      }
      const addressHash = privacyDigest(
        normalizeRequestAddress(addressForRequest(request)),
        identifierHashKey,
      );
      const userHash = userId ? privacyDigest(userId, identifierHashKey) : '';
      const allowed = await database.transaction(async query => {
        const addressAllowed = await consumeRateLimit(
          query,
          `api-${action}-ip:${addressHash}`,
          policy.limit,
          policy.windowSeconds,
        );
        const userAllowed = policy.addressOnly || !userHash
          ? true
          : await consumeRateLimit(
              query,
              `api-${action}-user:${userHash}`,
              policy.limit,
              policy.windowSeconds,
            );
        return addressAllowed && userAllowed;
      });
      if (!allowed) {
        throw new RateLimitError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED');
      }
    },
  };
}

import {
  randomUUID,
} from 'node:crypto';
import { hashPassword } from './password.mjs';
import {
  consumeRateLimit,
  normalizeRequestAddress,
  privacyDigest,
} from './rate-limit.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_RESPONSE = Object.freeze({
  success: true,
  message: 'If this address can be registered, a verification code has been sent.',
});

export class AccountSignupError extends Error {
  constructor(status, message, code = 'ACCOUNT_SIGNUP_ERROR') {
    super(message);
    this.name = 'AccountSignupError';
    this.status = status;
    this.code = code;
  }
}

function signupInput(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const nameInput = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new AccountSignupError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  }
  if (password.length < 8 || password.length > 128) {
    throw new AccountSignupError(
      400,
      'Password must be between 8 and 128 characters.',
      'INVALID_PASSWORD',
    );
  }
  const name = (nameInput || email.split('@')[0] || 'AniWebScale user').slice(0, 100);
  return { email, password, name };
}

async function defaultSendVerificationOtp(authUrl, publicUrl, email) {
  if (!authUrl) return;
  await fetch(`${authUrl.replace(/\/$/, '')}/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: publicUrl,
    },
    body: JSON.stringify({ email, type: 'email-verification' }),
  });
}

/**
 * @param {{
 *   database?: any,
 *   authUrl?: string,
 *   publicUrl?: string,
 *   identifierHashKey?: any,
 *   addressForRequest?: (request: Request) => string,
 *   sendVerificationOtp?: typeof defaultSendVerificationOtp,
 * }} [options]
 */
export function createAccountSignupService({
  database,
  authUrl,
  publicUrl,
  identifierHashKey,
  addressForRequest = () => 'unknown',
  sendVerificationOtp = defaultSendVerificationOtp,
} = {}) {
  return {
    async signUp(request, body, waitUntil) {
      if (!database?.configured || !authUrl || !identifierHashKey) {
        throw new AccountSignupError(503, 'Account registration is not configured.', 'SIGNUP_UNAVAILABLE');
      }
      const { email, password, name } = signupInput(body);
      const addressHash = privacyDigest(
        normalizeRequestAddress(addressForRequest(request)),
        identifierHashKey,
      );
      const emailHash = privacyDigest(email, identifierHashKey);

      const allowed = await database.transaction(async query => {
        const addressAllowed = await consumeRateLimit(
          query,
          `signup-ip:${addressHash}`,
          8,
          15 * 60,
        );
        const emailAllowed = await consumeRateLimit(
          query,
          `signup-email:${emailHash}`,
          4,
          30 * 60,
        );
        return addressAllowed && emailAllowed;
      });
      if (!allowed) {
        throw new AccountSignupError(
          429,
          'Too many registration attempts. Please try again later.',
          'RATE_LIMITED',
        );
      }

      // Hash every valid request, including attempts for existing accounts, so
      // response timing does not reveal whether the email is already present.
      const passwordHash = await hashPassword(password);
      await database.transaction(async query => {
        const inserted = await query(
          `INSERT INTO neon_auth."user" (
             name, email, "emailVerified", "createdAt", "updatedAt"
           ) VALUES ($1, $2, false, now(), now())
           ON CONFLICT (email) DO NOTHING
           RETURNING id::text`,
          [name, email],
        );
        const userId = inserted.rows[0]?.id;
        const accountId = userId || randomUUID();
        await query(
          `INSERT INTO neon_auth.account (
             "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
           )
           SELECT $1::text, 'credential', $1::uuid, $2, now(), now()
            WHERE $3::boolean`,
          [accountId, passwordHash, Boolean(userId)],
        );
      });

      const delivery = Promise.resolve(sendVerificationOtp(authUrl, publicUrl, email))
        .catch(() => undefined);
      if (typeof waitUntil === 'function') waitUntil(delivery);
      else await delivery;
      return GENERIC_RESPONSE;
    },
  };
}

import { createHmac } from 'node:crypto';
import { verifyPassword } from './password.mjs';

const OTP_TYPES = Object.freeze([
  'email-verification',
  'sign-in',
  'forget-password',
]);

export class AccountDeletionError extends Error {
  constructor(status, message, code = 'ACCOUNT_DELETION_ERROR') {
    super(message);
    this.name = 'AccountDeletionError';
    this.status = status;
    this.code = code;
  }
}

function deletionInput(body) {
  const confirmationEmail = typeof body?.confirmationEmail === 'string'
    ? body.confirmationEmail.trim().toLowerCase()
    : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const acknowledged = body?.acknowledged === true;
  if (!confirmationEmail || !password || !acknowledged) {
    throw new AccountDeletionError(
      400,
      'Enter your account email and password, then confirm that deletion is permanent.',
      'DELETION_CONFIRMATION_REQUIRED',
    );
  }
  return { confirmationEmail, password };
}

function emailDigest(email, key) {
  return createHmac('sha256', key).update(email).digest('hex');
}

function verificationIdentifiers(email) {
  return [
    email,
    ...OTP_TYPES.map(type => `${type}-otp-${email}`),
  ];
}

function isMissingStripeCustomer(error) {
  return error?.code === 'resource_missing' && error?.param === 'id';
}

async function removeStripeCustomer(stripe, customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) await stripe.customers.del(customerId);
  } catch (error) {
    if (!isMissingStripeCustomer(error)) throw error;
  }
}

/**
 * @param {{database?: any, stripe?: any, identifierHashKey?: any}} [options]
 */
export function createAccountDeletionService({ database, stripe, identifierHashKey } = {}) {
  return {
    async deleteAccount(user, body) {
      if (!database?.configured) {
        throw new AccountDeletionError(
          503,
          'Account deletion is temporarily unavailable.',
          'DATABASE_UNAVAILABLE',
        );
      }
      const { confirmationEmail, password } = deletionInput(body);
      const result = await database.query(
        `SELECT u.email, credential.password, billing.stripe_customer_id
           FROM neon_auth."user" u
           LEFT JOIN LATERAL (
             SELECT password
               FROM neon_auth.account
              WHERE "userId" = u.id
                AND "providerId" = 'credential'
              ORDER BY "createdAt"
              LIMIT 1
           ) credential ON true
           LEFT JOIN app.billing_customers billing ON billing.user_id = u.id
          WHERE u.id = $1`,
        [user.id],
      );
      const account = result.rows[0];
      if (!account) {
        throw new AccountDeletionError(404, 'This account no longer exists.', 'ACCOUNT_NOT_FOUND');
      }
      const email = String(account.email || '').trim().toLowerCase();
      if (!email || confirmationEmail !== email) {
        throw new AccountDeletionError(
          400,
          'The confirmation email does not match this account.',
          'EMAIL_CONFIRMATION_MISMATCH',
        );
      }
      if (!await verifyPassword(password, account.password)) {
        throw new AccountDeletionError(403, 'The password is incorrect.', 'PASSWORD_INCORRECT');
      }

      if (account.stripe_customer_id) {
        if (!stripe) {
          throw new AccountDeletionError(
            503,
            'Billing is temporarily unavailable, so this account cannot be deleted safely.',
            'BILLING_UNAVAILABLE',
          );
        }
        try {
          await removeStripeCustomer(stripe, account.stripe_customer_id);
        } catch {
          throw new AccountDeletionError(
            502,
            'Billing could not be canceled. The account was not deleted; please try again.',
            'BILLING_DELETION_FAILED',
          );
        }
      }

      await database.transaction(async query => {
        const locked = await query(
          `SELECT email
             FROM neon_auth."user"
            WHERE id = $1
            FOR UPDATE`,
          [user.id],
        );
        if (!locked.rows[0]) return;
        const lockedEmail = String(locked.rows[0].email || '').trim().toLowerCase();
        const emails = [...new Set([email, lockedEmail].filter(Boolean))];

        await query('DELETE FROM app.extension_auth_codes WHERE user_id = $1', [user.id]);
        await query('DELETE FROM app.extension_sessions WHERE user_id = $1', [user.id]);
        await query(
          'DELETE FROM neon_auth.verification WHERE identifier = ANY($1::text[])',
          [emails.flatMap(verificationIdentifiers)],
        );
        if (identifierHashKey) {
          for (const currentEmail of emails) {
            await query(
              'DELETE FROM app.auth_rate_limits WHERE bucket_key = $1',
              [`signup-email:${emailDigest(currentEmail, identifierHashKey)}`],
            );
          }
        }
        await query(
          `INSERT INTO app.deletion_tombstones (user_id, email_hash, deleted_at, expires_at)
           VALUES ($1, $2, now(), now() + interval '400 days')
           ON CONFLICT (user_id) DO UPDATE SET
             email_hash = EXCLUDED.email_hash,
             deleted_at = EXCLUDED.deleted_at,
             expires_at = EXCLUDED.expires_at`,
          [user.id, identifierHashKey ? emailDigest(lockedEmail || email, identifierHashKey) : null],
        );
        await query('DELETE FROM neon_auth."user" WHERE id = $1', [user.id]);
      });

      return { success: true };
    },
  };
}

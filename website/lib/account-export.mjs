export class AccountExportError extends Error {
  constructor(status, message, code = 'ACCOUNT_EXPORT_ERROR') {
    super(message);
    this.name = 'AccountExportError';
    this.status = status;
    this.code = code;
  }
}

function first(rows) {
  return rows[0] ?? null;
}

/** @param {{database?: any}} [options] */
export function createAccountExportService({ database } = {}) {
  return {
    async exportAccount(user) {
      if (!database?.configured) {
        throw new AccountExportError(
          503,
          'Account export is temporarily unavailable.',
          'DATABASE_UNAVAILABLE',
        );
      }

      const [account, billing, entitlement, extensionSessions] = await Promise.all([
        database.query(
          `SELECT id::text, email, name, "emailVerified" AS email_verified,
                  "createdAt" AS created_at, "updatedAt" AS updated_at
             FROM neon_auth."user"
            WHERE id = $1`,
          [user.id],
        ),
        database.query(
          `SELECT stripe_customer_id, created_at, updated_at
             FROM app.billing_customers
            WHERE user_id = $1`,
          [user.id],
        ),
        database.query(
          `SELECT plan, status, stripe_customer_id, stripe_subscription_id,
                  stripe_checkout_session_id, stripe_price_id, lifetime_purchase_id,
                  current_period_end, cancel_at_period_end, created_at, updated_at
             FROM app.entitlements
            WHERE user_id = $1`,
          [user.id],
        ),
        database.query(
          `SELECT device_name, created_at, last_used_at, expires_at, revoked_at
             FROM app.extension_sessions
            WHERE user_id = $1
            ORDER BY created_at`,
          [user.id],
        ),
      ]);

      if (!account.rows[0]) {
        throw new AccountExportError(404, 'This account no longer exists.', 'ACCOUNT_NOT_FOUND');
      }

      return {
        format: 'aniwebscale-account-export',
        version: 1,
        generatedAt: new Date().toISOString(),
        account: first(account.rows),
        billing: first(billing.rows),
        entitlement: first(entitlement.rows),
        extensionSessions: extensionSessions.rows,
        notes: [
          'Passwords, authentication tokens, token hashes and payment-card data are excluded for security.',
          'Stripe and infrastructure providers may hold additional data under their own retention duties. Contact support for a complete processor-assisted access request.',
        ],
      };
    },
  };
}

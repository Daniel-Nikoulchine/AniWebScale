export class AccountSecurityError extends Error {
  constructor(status, message, code = 'ACCOUNT_SECURITY_ERROR') {
    super(message);
    this.name = 'AccountSecurityError';
    this.status = status;
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function latest(rows, field) {
  return rows.reduce((value, row) => {
    const candidate = row[field];
    return candidate && (!value || new Date(candidate) > new Date(value)) ? candidate : value;
  }, null);
}

function revokeInput(body) {
  const kind = body?.kind === 'browser' || body?.kind === 'extension' ? body.kind : '';
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!kind || !UUID_PATTERN.test(id)) {
    throw new AccountSecurityError(400, 'Select a valid account session.', 'INVALID_SESSION');
  }
  return { kind, id };
}

/** @param {{database?: any}} [options] */
export function createAccountSecurityService({ database } = {}) {
  function requireDatabase() {
    if (!database?.configured) {
      throw new AccountSecurityError(
        503,
        'Account security information is temporarily unavailable.',
        'DATABASE_UNAVAILABLE',
      );
    }
  }

  return {
    async summary(user) {
      requireDatabase();
      const [account, browserSessions, extensionSessions] = await Promise.all([
        database.query(
          `SELECT "createdAt" AS created_at, "updatedAt" AS updated_at
             FROM neon_auth."user"
            WHERE id = $1`,
          [user.id],
        ),
        database.query(
          `SELECT id::text, "expiresAt" AS expires_at
             FROM neon_auth.session
            WHERE "userId" = $1
              AND "expiresAt" > now()
            ORDER BY "expiresAt" DESC
            LIMIT 50`,
          [user.id],
        ),
        database.query(
          `SELECT session_id::text AS id, device_name, created_at, last_used_at, expires_at
             FROM app.extension_sessions
            WHERE user_id = $1
              AND revoked_at IS NULL
              AND expires_at > now()
            ORDER BY last_used_at DESC
            LIMIT 50`,
          [user.id],
        ),
      ]);
      if (!account.rows[0]) {
        throw new AccountSecurityError(404, 'This account no longer exists.', 'ACCOUNT_NOT_FOUND');
      }
      return {
        accountCreatedAt: account.rows[0].created_at,
        accountUpdatedAt: account.rows[0].updated_at,
        browserSessions: {
          active: browserSessions.rows.length,
          latestExpiry: latest(browserSessions.rows, 'expires_at'),
          items: browserSessions.rows.map(row => ({
            id: row.id,
            kind: 'browser',
            expiresAt: row.expires_at,
          })),
        },
        extensionSessions: {
          active: extensionSessions.rows.length,
          lastUsedAt: latest(extensionSessions.rows, 'last_used_at'),
          items: extensionSessions.rows.map(row => ({
            id: row.id,
            kind: 'extension',
            deviceName: row.device_name || 'AniWebScale extension',
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
            expiresAt: row.expires_at,
          })),
        },
      };
    },

    async revokeSession(user, body) {
      requireDatabase();
      const { kind, id } = revokeInput(body);
      const result = kind === 'browser'
        ? await database.query(
            `DELETE FROM neon_auth.session
              WHERE "userId" = $1 AND id = $2::uuid`,
            [user.id, id],
          )
        : await database.query(
            `UPDATE app.extension_sessions
                SET revoked_at = COALESCE(revoked_at, now())
              WHERE user_id = $1
                AND session_id = $2::uuid
                AND revoked_at IS NULL`,
            [user.id, id],
          );
      return { success: true, revoked: (result.rowCount ?? 0) > 0 };
    },

    async revokeAllSessions(user) {
      requireDatabase();
      return database.transaction(async query => {
        const extension = await query(
          `UPDATE app.extension_sessions
              SET revoked_at = COALESCE(revoked_at, now())
            WHERE user_id = $1
              AND revoked_at IS NULL`,
          [user.id],
        );
        const browser = await query(
          `DELETE FROM neon_auth.session
            WHERE "userId" = $1`,
          [user.id],
        );
        return {
          success: true,
          revokedBrowserSessions: browser.rowCount ?? 0,
          revokedExtensionSessions: extension.rowCount ?? 0,
        };
      });
    },
  };
}

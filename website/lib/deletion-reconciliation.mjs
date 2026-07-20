export async function reconcileDeletionTombstones(query) {
  const verifications = await query(
    `DELETE FROM neon_auth.verification verification
      USING neon_auth."user" account, app.deletion_tombstones tombstone
      WHERE account.id = tombstone.user_id
        AND verification.identifier IN (
          account.email,
          'email-verification-otp-' || account.email,
          'sign-in-otp-' || account.email,
          'forget-password-otp-' || account.email
        )`,
  );
  const authSessions = await query(
    `DELETE FROM neon_auth.session session
      USING app.deletion_tombstones tombstone
      WHERE session."userId" = tombstone.user_id`,
  );
  const authAccounts = await query(
    `DELETE FROM neon_auth.account credential
      USING app.deletion_tombstones tombstone
      WHERE credential."userId" = tombstone.user_id`,
  );
  const extensionSessions = await query(
    `DELETE FROM app.extension_sessions session
      USING app.deletion_tombstones tombstone
      WHERE session.user_id = tombstone.user_id`,
  );
  const authorizationCodes = await query(
    `DELETE FROM app.extension_auth_codes code
      USING app.deletion_tombstones tombstone
      WHERE code.user_id = tombstone.user_id`,
  );
  const rateLimits = await query(
    `DELETE FROM app.auth_rate_limits rate_limit
      USING app.deletion_tombstones tombstone
      WHERE tombstone.email_hash IS NOT NULL
        AND rate_limit.bucket_key = 'signup-email:' || tombstone.email_hash`,
  );
  const users = await query(
    `DELETE FROM neon_auth."user" account
      USING app.deletion_tombstones tombstone
      WHERE account.id = tombstone.user_id`,
  );
  return {
    users: users.rowCount ?? 0,
    authAccounts: authAccounts.rowCount ?? 0,
    authSessions: authSessions.rowCount ?? 0,
    verifications: verifications.rowCount ?? 0,
    extensionSessions: extensionSessions.rowCount ?? 0,
    authorizationCodes: authorizationCodes.rowCount ?? 0,
    rateLimits: rateLimits.rowCount ?? 0,
  };
}

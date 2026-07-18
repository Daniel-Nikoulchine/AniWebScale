export const RETENTION_DAYS = Object.freeze({
  rateLimits: 1,
  revokedSessions: 1,
  stripeEvents: 120,
  deletionTombstones: 400,
  serviceMetrics: 30,
});

export async function cleanExpiredPersonalData(query) {
  const results = {};
  const run = async (name, sql) => {
    const result = await query(sql);
    results[name] = result.rowCount ?? 0;
  };

  await run(
    'authRateLimits',
    `DELETE FROM app.auth_rate_limits
      WHERE window_started_at < now() - interval '${RETENTION_DAYS.rateLimits} day'`,
  );
  await run('extensionAuthCodes', 'DELETE FROM app.extension_auth_codes WHERE expires_at <= now()');
  await run(
    'extensionSessions',
    `DELETE FROM app.extension_sessions
      WHERE expires_at <= now()
         OR revoked_at <= now() - interval '${RETENTION_DAYS.revokedSessions} day'`,
  );
  await run(
    'authVerifications',
    `DELETE FROM neon_auth.verification
      WHERE "expiresAt" <= now() - interval '1 day'`,
  );
  await run(
    'authSessions',
    `DELETE FROM neon_auth.session
      WHERE "expiresAt" <= now() - interval '1 day'`,
  );
  await run(
    'stripeEvents',
    `DELETE FROM app.stripe_events
      WHERE processed_at < now() - interval '${RETENTION_DAYS.stripeEvents} days'`,
  );
  await run(
    'deletionTombstones',
    `DELETE FROM app.deletion_tombstones
      WHERE expires_at <= now()`,
  );
  await run(
    'serviceMetrics',
    `DELETE FROM app.service_metrics
      WHERE bucket_started_at < now() - interval '${RETENTION_DAYS.serviceMetrics} days'`,
  );

  return results;
}

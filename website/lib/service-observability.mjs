export const SERVICE_SLOS = Object.freeze({
  checkout: Object.freeze({ availabilityTarget: 0.995 }),
  billing_portal: Object.freeze({ availabilityTarget: 0.995 }),
  license: Object.freeze({ availabilityTarget: 0.999 }),
  extension_auth: Object.freeze({ availabilityTarget: 0.999 }),
  account_security: Object.freeze({ availabilityTarget: 0.995 }),
  stripe_webhook: Object.freeze({ availabilityTarget: 0.999 }),
});

export function serviceMetricName(request) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/create-checkout-session' || pathname === '/api/checkout-session') return 'checkout';
  if (pathname === '/api/create-portal-session') return 'billing_portal';
  if (pathname === '/api/license') return 'license';
  if (pathname.startsWith('/api/extension-auth/')) return 'extension_auth';
  if (pathname === '/api/account'
    || pathname.startsWith('/api/account/')
    || pathname === '/api/auth/sign-up') return 'account_security';
  if (pathname === '/api/stripe-webhook') return 'stripe_webhook';
  return null;
}

export async function recordServiceMetric(query, { metricName, status, durationMs }) {
  if (!SERVICE_SLOS[metricName]) throw new Error('Unknown service metric.');
  const duration = Math.max(0, Math.min(2_147_483_647, Math.round(durationMs)));
  await query(
    `INSERT INTO app.service_metrics (
       metric_name, bucket_started_at, request_count, failure_count, duration_ms_sum
     ) VALUES ($1, date_trunc('hour', now()), 1, $2, $3)
     ON CONFLICT (metric_name, bucket_started_at) DO UPDATE SET
       request_count = app.service_metrics.request_count + 1,
       failure_count = app.service_metrics.failure_count + EXCLUDED.failure_count,
       duration_ms_sum = app.service_metrics.duration_ms_sum + EXCLUDED.duration_ms_sum`,
    [metricName, Number(status) >= 500 ? 1 : 0, duration],
  );
}

export async function readServiceSlos(query) {
  const result = await query(
    `SELECT metric_name, sum(request_count)::bigint AS request_count,
            sum(failure_count)::bigint AS failure_count,
            sum(duration_ms_sum)::bigint AS duration_ms_sum
       FROM app.service_metrics
      WHERE bucket_started_at >= date_trunc('hour', now() - interval '24 hours')
        AND metric_name = ANY($1::text[])
      GROUP BY metric_name ORDER BY metric_name`,
    [Object.keys(SERVICE_SLOS)],
  );
  const rows = new Map(result.rows.map(row => [row.metric_name, row]));
  return Object.fromEntries(Object.entries(SERVICE_SLOS).map(([metricName, policy]) => {
    const row = rows.get(metricName);
    const requests = Number(row?.request_count || 0);
    const failures = Number(row?.failure_count || 0);
    const availability = requests > 0 ? (requests - failures) / requests : null;
    return [metricName, {
      healthy: availability === null || availability >= policy.availabilityTarget,
      sampled: requests > 0,
      requests,
      failures,
      availability,
      availabilityTarget: policy.availabilityTarget,
      averageDurationMs: requests > 0 ? Math.round(Number(row?.duration_ms_sum || 0) / requests) : null,
      windowHours: 24,
    }];
  }));
}

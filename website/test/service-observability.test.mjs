import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  readServiceSlos,
  recordServiceMetric,
  serviceMetricName,
} from '../lib/service-observability.mjs';

describe('privacy-safe service SLOs', () => {
  it('maps only coarse service names and stores no request identifiers', async () => {
    assert.equal(serviceMetricName(new Request('https://example.test/api/license?user=secret')), 'license');
    assert.equal(serviceMetricName(new Request('https://example.test/api/account')), 'account_security');
    assert.equal(serviceMetricName(new Request('https://example.test/api/auth/sign-up')), 'account_security');
    const calls = [];
    await recordServiceMetric(async (sql, values) => calls.push({ sql, values }), {
      metricName: 'license', status: 503, durationMs: 12.7,
    });
    assert.deepEqual(calls[0].values, ['license', 1, 13]);
    assert.doesNotMatch(JSON.stringify(calls), /secret|user_id|email|url/i);
  });

  it('marks a sampled service below its availability target unhealthy', async () => {
    const slos = await readServiceSlos(async () => ({
      rows: [{ metric_name: 'license', request_count: '1000', failure_count: '2', duration_ms_sum: '5000' }],
    }));
    assert.equal(slos.license.availability, 0.998);
    assert.equal(slos.license.healthy, false);
    assert.equal(slos.license.averageDurationMs, 5);
    assert.equal(slos.checkout.sampled, false);
    assert.equal(slos.checkout.healthy, true);
  });
});

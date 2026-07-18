const input = process.argv[2] || process.env.OPERATIONS_BASE_URL || '';
const token = String(process.env.OPERATIONS_MONITOR_TOKEN || '').trim();
if (token.length < 32) throw new Error('OPERATIONS_MONITOR_TOKEN is missing or too short.');
const url = new URL('/api/operations/status', input);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Operations status must use HTTPS outside loopback tests.');
}
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'AniWebScale-Operations-Monitor/1.0',
  },
  signal: AbortSignal.timeout(10_000),
});
const body = await response.json().catch(() => ({}));
if (response.status !== 200 || body.ok !== true) {
  throw new Error(`Operations are unhealthy (HTTP ${response.status}): ${JSON.stringify(body)}`);
}
if (body.schema?.healthy !== true || body.schema.currentVersion !== body.schema.expectedVersion) {
  throw new Error(`Database schema is behind deployment code: ${JSON.stringify(body.schema)}.`);
}
for (const jobName of ['data_retention', 'database_backup', 'database_backup_secondary']) {
  if (body.jobs?.[jobName]?.healthy !== true) throw new Error(`${jobName} is stale or failing.`);
}
console.log(`OPERATIONS HEALTHY ${url.origin}`);

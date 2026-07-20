import { EXPECTED_SCHEMA_VERSION } from './schema-version.mjs';
import { readServiceSlos } from './service-observability.mjs';

const EXPECTED_JOBS = Object.freeze({
  data_retention: 48 * 60 * 60 * 1000,
  database_backup: 48 * 60 * 60 * 1000,
  database_backup_secondary: 48 * 60 * 60 * 1000,
  database_restore_drill: 8 * 24 * 60 * 60 * 1000,
});

export async function recordOperationalResult(query, {
  jobName,
  success,
  durationMs,
}) {
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(jobName)) throw new Error('Invalid operational job name.');
  const duration = Math.max(0, Math.min(2_147_483_647, Math.round(durationMs)));
  await query(
    `INSERT INTO app.operational_runs (
       job_name, last_success_at, last_failure_at, last_duration_ms, consecutive_failures, updated_at
     ) VALUES (
       $1,
       CASE WHEN $2 THEN now() ELSE NULL END,
       CASE WHEN $2 THEN NULL ELSE now() END,
       $3,
       CASE WHEN $2 THEN 0 ELSE 1 END,
       now()
     )
     ON CONFLICT (job_name) DO UPDATE SET
       last_success_at = CASE WHEN $2 THEN now() ELSE app.operational_runs.last_success_at END,
       last_failure_at = CASE WHEN $2 THEN app.operational_runs.last_failure_at ELSE now() END,
       last_duration_ms = $3,
       consecutive_failures = CASE
         WHEN $2 THEN 0
         ELSE app.operational_runs.consecutive_failures + 1
       END,
       updated_at = now()`,
    [jobName, Boolean(success), duration],
  );
}

/** @param {{database?: any, now?: () => number}} [options] */
export function createOperationalStatusService({ database, now = () => Date.now() } = {}) {
  return {
    async status() {
      if (!database?.configured) throw new Error('DATABASE_UNAVAILABLE');
      const result = await database.query(
        `SELECT job_name, last_success_at, last_failure_at, last_duration_ms, consecutive_failures
           FROM app.operational_runs
          WHERE job_name = ANY($1::text[])
          ORDER BY job_name`,
        [Object.keys(EXPECTED_JOBS)],
      );
      const schemaResult = await database.query(
        'SELECT max(version) AS current_version FROM app.schema_migrations',
      );
      const currentVersion = schemaResult.rows[0]?.current_version ?? null;
      const schema = {
        healthy: currentVersion === EXPECTED_SCHEMA_VERSION,
        currentVersion,
        expectedVersion: EXPECTED_SCHEMA_VERSION,
      };
      const slos = await readServiceSlos(database.query);
      const rows = new Map(result.rows.map(row => [row.job_name, row]));
      const jobs = {};
      for (const [jobName, maximumAgeMs] of Object.entries(EXPECTED_JOBS)) {
        const row = rows.get(jobName);
        const lastSuccessAt = row?.last_success_at ?? null;
        const ageMs = lastSuccessAt ? now() - new Date(lastSuccessAt).getTime() : null;
        const healthy = Number.isFinite(ageMs)
          && ageMs >= 0
          && ageMs <= maximumAgeMs
          && Number(row?.consecutive_failures ?? 0) === 0;
        jobs[jobName] = {
          healthy,
          lastSuccessAt,
          lastFailureAt: row?.last_failure_at ?? null,
          lastDurationMs: row?.last_duration_ms ?? null,
          consecutiveFailures: Number(row?.consecutive_failures ?? 0),
          maximumAgeSeconds: maximumAgeMs / 1000,
        };
      }
      return {
        ok: schema.healthy
          && Object.values(jobs).every(job => job.healthy)
          && Object.values(slos).every(slo => slo.healthy),
        schema,
        jobs,
        slos,
      };
    },
  };
}

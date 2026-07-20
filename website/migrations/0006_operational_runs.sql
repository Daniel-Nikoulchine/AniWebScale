CREATE TABLE IF NOT EXISTS app.operational_runs (
  job_name text PRIMARY KEY,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_duration_ms integer,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_runs_job_name CHECK (job_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT operational_runs_duration_nonnegative CHECK (
    last_duration_ms IS NULL OR last_duration_ms >= 0
  ),
  CONSTRAINT operational_runs_failures_nonnegative CHECK (consecutive_failures >= 0)
);

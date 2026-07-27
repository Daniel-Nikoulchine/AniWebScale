CREATE TABLE IF NOT EXISTS app.service_metrics (
  metric_name text NOT NULL,
  bucket_started_at timestamptz NOT NULL,
  request_count bigint NOT NULL DEFAULT 0,
  failure_count bigint NOT NULL DEFAULT 0,
  duration_ms_sum bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_name, bucket_started_at),
  CONSTRAINT service_metrics_name CHECK (metric_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT service_metrics_counts CHECK (
    request_count >= 0 AND failure_count >= 0 AND failure_count <= request_count
    AND duration_ms_sum >= 0
  )
);

CREATE INDEX IF NOT EXISTS service_metrics_bucket_idx
  ON app.service_metrics (bucket_started_at);

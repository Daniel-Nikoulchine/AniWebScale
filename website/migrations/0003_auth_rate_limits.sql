CREATE TABLE IF NOT EXISTS app.auth_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL,
  CONSTRAINT auth_rate_limits_attempts_positive CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx
  ON app.auth_rate_limits (window_started_at);

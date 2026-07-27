CREATE TABLE IF NOT EXISTS app.deletion_tombstones (
  user_id uuid PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '400 days')
);

CREATE INDEX IF NOT EXISTS deletion_tombstones_expires_at_idx
  ON app.deletion_tombstones (expires_at);

ALTER TABLE app.stripe_events
  ADD COLUMN IF NOT EXISTS processed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS stripe_events_processed_at_idx
  ON app.stripe_events (processed_at);

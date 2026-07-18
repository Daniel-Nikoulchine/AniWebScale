ALTER TABLE app.extension_auth_codes
  ADD COLUMN IF NOT EXISTS device_name text;

ALTER TABLE app.extension_sessions
  ADD COLUMN IF NOT EXISTS session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS device_name text;

CREATE UNIQUE INDEX IF NOT EXISTS extension_sessions_session_id_idx
  ON app.extension_sessions (session_id);

ALTER TABLE app.extension_auth_codes
  DROP CONSTRAINT IF EXISTS extension_auth_codes_device_name_length;
ALTER TABLE app.extension_auth_codes
  ADD CONSTRAINT extension_auth_codes_device_name_length
  CHECK (device_name IS NULL OR length(device_name) BETWEEN 1 AND 80);

ALTER TABLE app.extension_sessions
  DROP CONSTRAINT IF EXISTS extension_sessions_device_name_length;
ALTER TABLE app.extension_sessions
  ADD CONSTRAINT extension_sessions_device_name_length
  CHECK (device_name IS NULL OR length(device_name) BETWEEN 1 AND 80);

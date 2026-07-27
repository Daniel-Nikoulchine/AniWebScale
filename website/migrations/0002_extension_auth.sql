CREATE TABLE IF NOT EXISTS app.extension_auth_codes (
  code_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  code_challenge text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extension_auth_codes_hash_length CHECK (length(code_hash) = 43),
  CONSTRAINT extension_auth_codes_challenge_length CHECK (length(code_challenge) = 43)
);

CREATE INDEX IF NOT EXISTS extension_auth_codes_expires_at_idx
  ON app.extension_auth_codes (expires_at);

CREATE TABLE IF NOT EXISTS app.extension_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT extension_sessions_hash_length CHECK (length(token_hash) = 43)
);

CREATE INDEX IF NOT EXISTS extension_sessions_user_id_idx
  ON app.extension_sessions (user_id);

CREATE INDEX IF NOT EXISTS extension_sessions_active_idx
  ON app.extension_sessions (expires_at)
  WHERE revoked_at IS NULL;

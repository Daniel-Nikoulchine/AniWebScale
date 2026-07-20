ALTER TABLE app.deletion_tombstones
  ADD COLUMN IF NOT EXISTS email_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'deletion_tombstones_email_hash_length'
       AND conrelid = 'app.deletion_tombstones'::regclass
  ) THEN
    ALTER TABLE app.deletion_tombstones
      ADD CONSTRAINT deletion_tombstones_email_hash_length
      CHECK (email_hash IS NULL OR length(email_hash) = 64);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS deletion_tombstones_email_hash_idx
  ON app.deletion_tombstones (email_hash)
  WHERE email_hash IS NOT NULL;

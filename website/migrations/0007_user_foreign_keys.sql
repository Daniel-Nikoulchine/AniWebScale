DELETE FROM app.extension_auth_codes code
 WHERE NOT EXISTS (
   SELECT 1 FROM neon_auth."user" user_record WHERE user_record.id = code.user_id
 );

DELETE FROM app.extension_sessions session_record
 WHERE NOT EXISTS (
   SELECT 1 FROM neon_auth."user" user_record WHERE user_record.id = session_record.user_id
 );

DELETE FROM app.billing_customers customer
 WHERE NOT EXISTS (
   SELECT 1 FROM neon_auth."user" user_record WHERE user_record.id = customer.user_id
 );

DELETE FROM app.entitlements entitlement
 WHERE NOT EXISTS (
   SELECT 1 FROM neon_auth."user" user_record WHERE user_record.id = entitlement.user_id
 );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'extension_auth_codes_user_id_fkey'
       AND conrelid = 'app.extension_auth_codes'::regclass
  ) THEN
    ALTER TABLE app.extension_auth_codes
      ADD CONSTRAINT extension_auth_codes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES neon_auth."user" (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'extension_sessions_user_id_fkey'
       AND conrelid = 'app.extension_sessions'::regclass
  ) THEN
    ALTER TABLE app.extension_sessions
      ADD CONSTRAINT extension_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES neon_auth."user" (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'billing_customers_user_id_fkey'
       AND conrelid = 'app.billing_customers'::regclass
  ) THEN
    ALTER TABLE app.billing_customers
      ADD CONSTRAINT billing_customers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES neon_auth."user" (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'entitlements_user_id_fkey'
       AND conrelid = 'app.entitlements'::regclass
  ) THEN
    ALTER TABLE app.entitlements
      ADD CONSTRAINT entitlements_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES neon_auth."user" (id) ON DELETE CASCADE;
  END IF;
END
$$;

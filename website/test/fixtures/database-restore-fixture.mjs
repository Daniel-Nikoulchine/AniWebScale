import { createHmac } from 'node:crypto';

export const ACTIVE_USER = '11111111-1111-4111-8111-111111111111';
export const DELETED_USER = '22222222-2222-4222-8222-222222222222';

export async function bootstrapRestoreFixture(client, migrations, applyMigrations) {
  await client.query('CREATE SCHEMA neon_auth');
  await client.query(`
    CREATE TABLE neon_auth."user" (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      name text,
      "emailVerified" boolean NOT NULL DEFAULT false,
      banned boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE TABLE neon_auth.account (
      id uuid PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
      "providerId" text NOT NULL,
      password text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE TABLE neon_auth.session (
      id uuid PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      "expiresAt" timestamptz NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE neon_auth.verification (
      id uuid PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamptz NOT NULL
    )
  `);
  await applyMigrations(client, migrations);
}

export async function seedRestoreFixture(client, privacyKey) {
  const emailHash = email => createHmac('sha256', privacyKey).update(email).digest('hex');
  await client.query(
    `INSERT INTO neon_auth."user" (id, email, name, "emailVerified")
     VALUES ($1, 'active@example.test', 'Active', true), ($2, 'deleted@example.test', 'Deleted', true)`,
    [ACTIVE_USER, DELETED_USER],
  );
  await client.query(
    `INSERT INTO neon_auth.account (id, "userId", "providerId", password)
     VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, 'credential', 'active-hash'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $2, 'credential', 'deleted-hash')`,
    [ACTIVE_USER, DELETED_USER],
  );
  await client.query(
    `INSERT INTO neon_auth.session (id, "userId", token, "expiresAt")
     VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'active-session', now() + interval '1 day'),
            ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $2, 'deleted-session', now() + interval '1 day')`,
    [ACTIVE_USER, DELETED_USER],
  );
  await client.query(
    `INSERT INTO neon_auth.verification (id, identifier, value, "expiresAt")
     VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'email-verification-otp-deleted@example.test', 'otp-hash', now() + interval '1 day')`,
  );
  await client.query(
    `INSERT INTO app.billing_customers (user_id, stripe_customer_id)
     VALUES ($1, 'cus_active'), ($2, 'cus_deleted')`,
    [ACTIVE_USER, DELETED_USER],
  );
  await client.query(
    `INSERT INTO app.entitlements (user_id, plan, status)
     VALUES ($1, 'pro', 'active'), ($2, 'lifetime', 'active')`,
    [ACTIVE_USER, DELETED_USER],
  );
  await client.query(
    `INSERT INTO app.extension_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '1 day')`,
    ['s'.repeat(43), DELETED_USER],
  );
  await client.query(
    `INSERT INTO app.extension_auth_codes (code_hash, user_id, code_challenge, redirect_uri, expires_at)
     VALUES ($1, $2, $3, 'https://example.test/callback', now() + interval '5 minutes')`,
    ['c'.repeat(43), DELETED_USER, 'p'.repeat(43)],
  );
  await client.query(
    `INSERT INTO app.auth_rate_limits (bucket_key, window_started_at, attempts)
     VALUES ($1, now(), 1)`,
    [`signup-email:${emailHash('deleted@example.test')}`],
  );
  await client.query(
    `INSERT INTO app.stripe_events (event_id, event_type)
     VALUES ('evt_restore_test', 'checkout.session.completed')`,
  );
  await client.query(
    `INSERT INTO app.deletion_tombstones (user_id, email_hash)
     VALUES ($1, $2)`,
    [DELETED_USER, emailHash('deleted@example.test')],
  );
}

export async function assertRestoredFixture(client, result, migrationCount) {
  const users = await client.query(`SELECT email FROM neon_auth."user" ORDER BY email`);
  const billing = await client.query('SELECT stripe_customer_id FROM app.billing_customers ORDER BY stripe_customer_id');
  const tombstones = await client.query('SELECT user_id::text FROM app.deletion_tombstones');
  const migrationsApplied = await client.query('SELECT count(*)::int AS count FROM app.schema_migrations');
  const transientCounts = {};
  for (const table of [
    'neon_auth.session',
    'neon_auth.verification',
    'app.extension_sessions',
    'app.extension_auth_codes',
    'app.auth_rate_limits',
  ]) {
    const count = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    transientCounts[table] = Number(count.rows[0]?.count);
  }
  if (JSON.stringify(users.rows) !== JSON.stringify([{ email: 'active@example.test' }])) {
    throw new Error(`Restore retained a deleted identity: ${JSON.stringify(users.rows)}.`);
  }
  if (JSON.stringify(billing.rows) !== JSON.stringify([{ stripe_customer_id: 'cus_active' }])) {
    throw new Error(`Restore retained deleted billing data: ${JSON.stringify(billing.rows)}.`);
  }
  if (tombstones.rows[0]?.user_id !== DELETED_USER
    || Number(migrationsApplied.rows[0]?.count) !== migrationCount) {
    throw new Error('Restore lost deletion history or migration state.');
  }
  if (Object.values(transientCounts).some(count => count !== 0)) {
    throw new Error(`Restore reactivated transient credentials: ${JSON.stringify(transientCounts)}.`);
  }
  const expectedDiscarded = {
    'neon_auth.session': 2,
    'neon_auth.verification': 1,
    'app.extension_sessions': 1,
    'app.extension_auth_codes': 1,
    'app.auth_rate_limits': 1,
  };
  if (Object.entries(expectedDiscarded).some(
    ([table, count]) => result.discardedTransientRows?.[table] !== count,
  )) {
    throw new Error(`Restore did not report discarded transient rows: ${JSON.stringify(result)}.`);
  }
  if (result.reconciled.users !== 1 || result.reconciled.rateLimits !== 0) {
    throw new Error(`Restore reconciliation did not remove all tombstoned data: ${JSON.stringify(result)}.`);
  }
}

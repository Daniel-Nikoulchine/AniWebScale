CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.billing_customers (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.entitlements (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_price_id text,
  lifetime_purchase_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_plan_known CHECK (plan IN ('free', 'pro', 'lifetime')),
  CONSTRAINT entitlements_status_known CHECK (
    status IN ('inactive', 'active', 'trialing', 'past_due', 'unpaid', 'paused', 'canceled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_subscription_id_idx
  ON app.entitlements (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS app.stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_object_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_events_processed_at_idx
  ON app.stripe_events (processed_at);

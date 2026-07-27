const ACTIVE_STATUSES = new Set(['active', 'trialing']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'canceled',
]);

function stripeId(value) {
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' && typeof value.id === 'string' ? value.id : null;
}

function unixDate(value) {
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000) : null;
}

function subscriptionPeriodEnd(subscription) {
  const itemPeriod = subscription.items?.data?.[0]?.current_period_end;
  return unixDate(subscription.current_period_end ?? itemPeriod);
}

function subscriptionPlan(subscription, priceIds) {
  const metadataPlan = subscription.metadata?.plan;
  if (metadataPlan === 'pro_monthly' || metadataPlan === 'pro_yearly') return metadataPlan;
  const priceId = stripeId(subscription.items?.data?.[0]?.price);
  if (priceId === priceIds.pro_monthly) return 'pro_monthly';
  if (priceId === priceIds.pro_yearly) return 'pro_yearly';
  return null;
}

async function userIdForCustomer(query, customerId) {
  if (!customerId) return null;
  const result = await query(
    'SELECT user_id::text FROM app.billing_customers WHERE stripe_customer_id = $1',
    [customerId],
  );
  return result.rows[0]?.user_id ?? null;
}

async function existingUserId(query, userId) {
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return null;
  const result = await query(
    'SELECT id::text FROM neon_auth."user" WHERE id = $1',
    [userId],
  );
  return result.rows[0]?.id ?? null;
}

async function upsertSubscription(query, {
  userId,
  customerId,
  subscriptionId,
  priceId,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  checkoutSessionId = null,
}) {
  const normalizedStatus = SUBSCRIPTION_STATUSES.has(status) ? status : 'inactive';
  await query(
    `INSERT INTO app.entitlements (
       user_id, plan, status, stripe_customer_id, stripe_subscription_id,
       stripe_checkout_session_id, stripe_price_id, current_period_end,
       cancel_at_period_end, updated_at
     ) VALUES ($1, 'pro', $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = CASE
         WHEN app.entitlements.plan = 'lifetime' AND app.entitlements.status = 'active'
           THEN app.entitlements.plan
         ELSE EXCLUDED.plan
       END,
       status = CASE
         WHEN app.entitlements.plan = 'lifetime' AND app.entitlements.status = 'active'
           THEN app.entitlements.status
         ELSE EXCLUDED.status
       END,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, app.entitlements.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, app.entitlements.stripe_subscription_id),
       stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, app.entitlements.stripe_checkout_session_id),
       stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, app.entitlements.stripe_price_id),
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = now()`,
    [
      userId,
      normalizedStatus,
      customerId,
      subscriptionId,
      checkoutSessionId,
      priceId,
      currentPeriodEnd,
      Boolean(cancelAtPeriodEnd),
    ],
  );
}

async function grantLifetime(query, { userId, customerId, checkoutSessionId, purchaseId, priceId }) {
  await query(
    `INSERT INTO app.entitlements (
       user_id, plan, status, stripe_customer_id, stripe_checkout_session_id,
       stripe_price_id, lifetime_purchase_id, cancel_at_period_end, updated_at
     ) VALUES ($1, 'lifetime', 'active', $2, $3, $4, $5, false, now())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = 'lifetime',
       status = 'active',
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, app.entitlements.stripe_customer_id),
       stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       lifetime_purchase_id = EXCLUDED.lifetime_purchase_id,
       current_period_end = NULL,
       cancel_at_period_end = false,
       updated_at = now()`,
    [userId, customerId, checkoutSessionId, priceId, purchaseId],
  );
}

export async function entitlementForUser(query, userId) {
  const result = await query(
    `SELECT plan, status, current_period_end, cancel_at_period_end
       FROM app.entitlements
      WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? {
    plan: 'free',
    status: 'inactive',
    current_period_end: null,
    cancel_at_period_end: false,
  };
}

export function isPaidEntitlement(entitlement) {
  return (entitlement?.plan === 'pro' || entitlement?.plan === 'lifetime')
    && ACTIVE_STATUSES.has(entitlement?.status);
}

export async function processStripeEvent(database, event, priceIds) {
  return database.transaction(async query => {
    const object = event.data?.object ?? {};
    const objectId = typeof object.id === 'string' ? object.id : null;
    const inserted = await query(
      `INSERT INTO app.stripe_events (event_id, event_type, stripe_object_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type, objectId],
    );
    if (inserted.rowCount === 0) return { duplicate: true, handled: true };

    if (event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded') {
      const userId = await existingUserId(
        query,
        object.client_reference_id || object.metadata?.user_id,
      );
      const customerId = stripeId(object.customer);
      const plan = object.metadata?.plan;
      const paid = object.payment_status === 'paid' || object.payment_status === 'no_payment_required';
      if (!userId || !paid) return { duplicate: false, handled: false };

      if (plan === 'lifetime') {
        await grantLifetime(query, {
          userId,
          customerId,
          checkoutSessionId: object.id,
          purchaseId: stripeId(object.payment_intent) || object.id,
          priceId: priceIds.lifetime,
        });
        return { duplicate: false, handled: true };
      }

      if (plan === 'pro_monthly' || plan === 'pro_yearly') {
        await upsertSubscription(query, {
          userId,
          customerId,
          subscriptionId: stripeId(object.subscription),
          priceId: priceIds[plan],
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          checkoutSessionId: object.id,
        });
        return { duplicate: false, handled: true };
      }
    }

    if (event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted') {
      const customerId = stripeId(object.customer);
      const userId = await existingUserId(
        query,
        object.metadata?.user_id || await userIdForCustomer(query, customerId),
      );
      const plan = subscriptionPlan(object, priceIds);
      if (!userId || !plan) return { duplicate: false, handled: false };
      const rawStatus = event.type === 'customer.subscription.deleted' ? 'canceled' : object.status;
      await upsertSubscription(query, {
        userId,
        customerId,
        subscriptionId: object.id,
        priceId: stripeId(object.items?.data?.[0]?.price) || priceIds[plan],
        status: rawStatus,
        currentPeriodEnd: subscriptionPeriodEnd(object),
        cancelAtPeriodEnd: object.cancel_at_period_end,
      });
      return { duplicate: false, handled: true };
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const subscriptionId = stripeId(object.subscription)
        || stripeId(object.parent?.subscription_details?.subscription);
      if (!subscriptionId) return { duplicate: false, handled: false };
      await query(
        `UPDATE app.entitlements
            SET status = $2, updated_at = now()
          WHERE stripe_subscription_id = $1
            AND plan <> 'lifetime'`,
        [subscriptionId, event.type === 'invoice.paid' ? 'active' : 'past_due'],
      );
      return { duplicate: false, handled: true };
    }

    return { duplicate: false, handled: false };
  });
}

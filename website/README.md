# AniWebScale website

The `website` folder is a standalone marketing site and Node server. It includes:

- responsive landing page with light and dark themes;
- features, interactive comparison, pricing, FAQ and browser download links;
- Stripe-hosted Checkout for monthly, yearly and one-time Pro plans;
- signed Stripe webhook endpoint;
- Neon Auth account page and database-backed Pro entitlements;
- short-lived signed licenses consumed by the browser extension;
- Checkout success and cancellation pages;
- Stripe customer portal link support;
- privacy, terms and imprint starter pages;
- attributed comparison imagery from the official Anime4K repository;
- no analytics, advertising scripts, remote fonts or third-party runtime code.

## Local setup

```powershell
cd website
npm install
Copy-Item .env.example .env
npm run dev
```

Run `npm run generate:license-key` once and copy the generated value into `.env`. Open `http://localhost:4242`. Without the remaining Stripe and Neon secrets, the full site runs in safe preview mode and paid buttons explain that checkout still needs configuration.

Verify the completed configuration without printing secret values:

```powershell
npm run check:config
```

## Stripe setup

1. The connected Stripe sandbox already contains the `AniWebScale Pro` product and the three Price IDs shown in `.env.example`.
2. Copy `.env.example` to `.env` and set the Stripe test secret, Neon connection string, and stable license signing key.
3. Keep the public display prices in the same file synchronized with the Stripe Prices.
4. The sandbox customer portal is configured by the `STRIPE_PORTAL_CONFIGURATION_ID` in `.env.example`. Create a separate live-mode configuration for production.
5. For local webhook testing, run:

   ```powershell
   stripe listen --forward-to localhost:4242/api/stripe-webhook
   ```

6. Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` and restart the server.

The webhook accepts `checkout.session.completed`, delayed-payment success, subscription lifecycle events, paid/failed invoices, and cancellations. Every Stripe event ID is recorded transactionally so retries cannot grant the same purchase twice. The success page never grants Pro.

Register these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.

Stripe recommends using the Checkout Session ID in the success URL and fulfilling payments from signed webhook events because a customer might never load the success page. This implementation follows that pattern:

- [Stripe Checkout lifecycle](https://docs.stripe.com/payments/checkout/how-checkout-works)
- [Checkout fulfillment and success URLs](https://docs.stripe.com/checkout/fulfillment)
- [Webhook signature verification](https://docs.stripe.com/webhooks)
- [Customer portal sessions](https://docs.stripe.com/customer-management/integrate-customer-portal)

## Production checklist

The container image includes a non-root runtime user, a health check, configuration validation, and graceful shutdown. Deployment and extension release commands are documented in [`../docs/RELEASE.md`](../docs/RELEASE.md).

- Set `PUBLIC_URL` to the final HTTPS origin.
- Add the production origin to the Neon Auth trusted-domain list, configure SMTP, and enable email verification.
- Use live Stripe keys and live-mode Price IDs only in the production secret store.
- Create a live-mode customer portal configuration and set its ID as `STRIPE_PORTAL_CONFIGURATION_ID`.
- Configure a live Stripe webhook for `https://your-domain.example/api/stripe-webhook`.
- Configure Chrome, Firefox and GitHub URLs.
- Replace all `LEGAL_*` placeholders and have the legal pages reviewed for the operator and sales regions.
- Decide whether `STRIPE_AUTOMATIC_TAX` can be enabled for the Stripe account.
- Use a stable `LICENSE_PRIVATE_KEY_PKCS8_B64`, then set `PAID_ENTITLEMENTS_ENABLED=true` only after a signed webhook has been tested end to end.
- Build the extension with `ANIME4K_ACCOUNT_API_URL=https://your-domain.example`. The optional `ANIME4K_NEON_AUTH_URL` variable overrides its public Auth endpoint.
- Set the Stripe Dashboard branding to match the pastel palette and upload `public/assets/logo-v2.png`.
- Replace the upstream anime demonstration frames with owned or commercially licensed material before a paid public launch. See `public/assets/anime4k/UPSTREAM_NOTICE.txt`.

After deploying, run the final non-mutating gate from the repository root:

```powershell
npm run check:live -- https://your-domain.example
```

It fails until Monthly, Yearly, Lifetime, Customer Portal, Neon Auth, HTTPS/HSTS, the public license key, CORS and both browser-store links are production-ready.

## Cloudflare Pages + Workers Free

This project can run without the Node container. Cloudflare Pages serves `public/`, while the
`functions/api/[[path]].js` Pages Function handles only `/api/*`. The checked-in `_routes.json`
keeps all static requests outside the Workers request quota. The API accepts either a Cloudflare
Hyperdrive binding named `HYPERDRIVE` or the encrypted `DATABASE_URL` secret for Neon.

Install dependencies, verify the Worker bundle and run the real Pages runtime locally:

```powershell
cd website
npm install
npm run check:cloudflare
npm run test:cloudflare:local
```

For the first Direct Upload deployment, authenticate once and bootstrap the Pages project. The
script reads the ignored `.env`, uploads values as encrypted Pages secrets without printing their
contents, forces the first deployment to remain fail-closed, and verifies the deployed runtime:

```powershell
npx wrangler login
npm run bootstrap:cloudflare
```

Create the deployed Stripe webhook, upload its endpoint-specific secret, verify signed delivery and
retry idempotency, then enable payments:

```powershell
npm run configure:stripe-webhook
```

Use `--env-file=.env.production` and `--public-url=https://example.com` for the live environment.
Do not enable paid fulfillment with the local `stripe listen` webhook secret; each deployed Stripe
webhook endpoint has its own signing secret.

## Tests

```powershell
npm test
```

Tests cover static delivery, CSP/security headers, public configuration, checkout plan allowlisting, preview mode and fallback pages.

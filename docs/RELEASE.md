# Release checklist

The repository can build local development bundles without a public server. Store releases are deliberately stricter: they must be compiled with the final HTTPS account origin so paid licenses never point to `localhost`.

## 1. Deploy the website API

### Cloudflare Pages + Pages Functions (Free target)

The repository includes `website/wrangler.jsonc`, a Pages Function restricted to `/api/*`, static
asset security headers and a Workers Free bundle-size gate. Direct Upload is the default because
the repository remote is not the production repository.

```powershell
cd website
npm install
npm run check:cloudflare
npm run test:cloudflare:local
npx wrangler login
npm run bootstrap:cloudflare -- --env-file=.env.production --public-url=https://your-domain.example
```

The first deployment sets `PAID_ENTITLEMENTS_ENABLED=false`. Create and verify the Stripe webhook,
store its signing secret directly in Cloudflare, and enable paid fulfillment with:

```powershell
npm run configure:stripe-webhook -- --env-file=.env.production --public-url=https://your-domain.example
```

Pages secrets must exist before the deployment that consumes them. Hyperdrive is supported through
the optional `HYPERDRIVE` binding; without it, the encrypted `DATABASE_URL` connects directly to
Neon. Static assets do not invoke the Function because `public/_routes.json` includes only `/api/*`.

### Container alternative

Copy `website/.env.production.example` to `website/.env.production`, fill every secret and ID, then set `PAID_ENTITLEMENTS_ENABLED=true` only after the live signed webhook has been verified.

Validate without printing secret values:

```powershell
cd website
$env:DOTENV_CONFIG_PATH = '.env.production'
npm run check:config
docker build -t aniwebscale-website .
docker run --rm --env-file .env.production -p 4242:4242 aniwebscale-website
```

The deployment must terminate TLS at `PUBLIC_URL` and forward requests to port 4242. Configure the live Stripe webhook at:

```text
https://your-domain.example/api/stripe-webhook
```

Register these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Use a live Stripe Customer Portal configuration and live Price IDs. Test mode and live mode have separate keys, webhook secrets, products, prices, and portal configurations.

## 2. Finish Neon Auth production settings

In the Neon Console, add the final website and browser-extension origins to the trusted-origin configuration. Configure a production email provider, enable the desired email-verification policy, and verify signup, sign-in, sign-out, and password reset before accepting real payments.

Keep `DATABASE_URL` server-side. Only `NEON_AUTH_URL` is public and embedded in the website/extension clients.

## 3. Build release extension bundles

Set the final public values in the shell that performs the build:

```powershell
$env:ANIME4K_ACCOUNT_API_URL = 'https://your-domain.example'
$env:ANIME4K_NEON_AUTH_URL = 'https://your-neon-auth-host.example/neondb/auth'
npm run build:release:all
```

`build:release:all` fails for HTTP, localhost, or placeholder domains. Upload `dist-chrome` and `dist-firefox` only after this check passes.

## 4. Store and operator completion

- Publish Chrome and Firefox listings, then put their exact URLs in the website environment.
- Set the repository URL or leave the GitHub link disabled.
- Review the imprint, privacy policy, terms, tax configuration, VAT ID, refund policy, and commercial rights for all bundled models/media.
- Upload Stripe branding and verify receipts, invoices, cancellation, monthly/yearly switching, and Lifetime purchases.
- Run the browser, native, hardware, and DRM acceptance procedures in `docs/TESTING.md`.

## 5. Final live smoke test

Before creating a real payment, run the non-mutating deployment gate. It verifies HTTPS/HSTS, security headers, public prices, Monthly/Yearly/Lifetime readiness, Customer Portal readiness, Neon Auth, the public ES256 license key, fail-closed authentication, webhook signature rejection, and CORS. Store links are required by default.

```powershell
$env:LIVE_BASE_URL = 'https://your-domain.example'
npm run check:live
```

For a pre-store deployment only, `LIVE_ALLOW_MISSING_STORE_LINKS=1` skips the Chrome/Firefox link requirement. Do not use that override for the final release gate.

Create a new real account, complete the lowest-risk live purchase permitted by the operator, confirm the signed webhook updates Neon, sign into both browser extensions, verify the signed Pro license, open the Customer Portal, then refund/cancel according to the test plan. Never grant Pro from the success redirect alone.

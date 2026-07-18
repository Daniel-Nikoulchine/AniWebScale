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

Before deploying account features, run `npm run generate:privacy-key` and `npm run generate:operations-token`, store both values only in the production secret store, complete `docs/DATA_PROTECTION.md`, configure every public `PRIVACY_*` fact and run `npm run migrate:database`. Put the operations token in both Cloudflare Pages and the GitHub Actions `OPERATIONS_MONITOR_TOKEN` secret. Configure all `BACKUP_SECONDARY_S3_*` Actions secrets for the independent encrypted copy. The live monitor must report the deployed schema version as current before traffic is accepted. New registration and every checkout remain fail-closed until `DATA_PROTECTION_APPROVED=true` and the other legal/tax gates are valid.

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

In the Neon Console, add only the final website origin to the trusted-origin configuration, disable localhost access, and require email verification. The extension uses a website-hosted PKCE authorization flow and must not receive Neon Auth cookies. Configure a production email provider and verify signup, OTP verification, sign-in, sign-out, and password reset before accepting real payments.

Keep `DATABASE_URL` server-side. `NEON_AUTH_URL` is public only to the website account client.

## 3. Build release extension bundles

Set the final public values in the shell that performs the build:

```powershell
$env:ANIME4K_ACCOUNT_API_URL = 'https://your-domain.example'
npm run build:release:all
```

`build:release:all` fails for HTTP, localhost, or placeholder domains. Run `npm run check:bundle-sizes` after the build; it requires the separate lazy model/quality chunks and enforces the 750 KiB per-chunk budget. Upload `dist-chrome` and `dist-firefox` only after both checks pass.

The current fallback production API is `https://aniwebscale.pages.dev`. Replace it with the confirmed custom domain only after Cloudflare, Neon trusted origins, Stripe URLs and legal links have all migrated together.

### Signed native Windows package

Native public releases must be produced by `.github/workflows/native-release.yml`. Configure repository secrets `ANIME4K_SIGNING_PFX_BASE64` (the base64-encoded code-signing PFX) and `ANIME4K_SIGNING_PFX_PASSWORD`. The workflow builds and tests both binaries, applies SHA-256 Authenticode signatures with a trusted timestamp, creates `native-release-manifest.json`, signs that manifest as detached CMS, verifies the signer and every hash, and then packages fixed-timestamp ZIP entries. The PFX is materialized only in the runner's temporary directory.

Configure the repository variable `ANIWEBSCALE_PUBLIC_URL` with the final HTTPS origin. The signed release workflow uses it for `ANIME4K_ACCOUNT_API_URL`; the scheduled live and operations monitors use the same value and deliberately fail when it is empty, still points at an obsolete host, lacks store links, or loses a legal/data-protection gate.

For an operator-side verification without access to the private key:

```powershell
.\native\scripts\sign-release.ps1 -BinaryDirectory .\native\build\bin\Release -VerifyOnly
```

Do not publish an unsigned local package. `package-local.ps1 -RequireNativeSignature -SkipBuild` fails unless both EXEs and the detached manifest are valid and signed by the same certificate.

## 4. Store and operator completion

- Publish Chrome and Firefox listings, then put their exact URLs in the website environment.
- Set the repository URL or leave the GitHub link disabled.
- Obtain legal/tax/data-protection approval for the imprint, privacy policy, terms, withdrawal flow, tax configuration, VAT ID/OSS treatment, vendor DPAs/transfers, retention values, refund policy and commercial rights for all bundled models/media. Registration and both test/live checkout are blocked until all three approval flags and required privacy fields are valid.
- Upload Stripe branding and verify receipts, invoices, cancellation, monthly/yearly switching, and Lifetime purchases.
- Run the browser, native, hardware, and DRM acceptance procedures in `docs/TESTING.md`.

## 5. Final live smoke test

Before creating a real payment, run the non-mutating deployment gate. It verifies HTTPS/HSTS, security headers, public prices, Monthly/Yearly/Lifetime readiness, Customer Portal readiness, Neon Auth, the public ES256 license key, fail-closed authentication, webhook signature rejection, and CORS. Store links are required by default.

```powershell
$env:LIVE_BASE_URL = 'https://your-domain.example'
$env:LIVE_REQUIRE_LEGAL_APPROVAL = '1'
npm run check:live
```

For a pre-store deployment only, `LIVE_ALLOW_MISSING_STORE_LINKS=1` skips the Chrome/Firefox link requirement. Do not use that override for the final release gate.

Confirm the daily retention and encrypted-backup workflows have succeeded. Create a new real account, download its export, verify its email, complete the lowest-risk live purchase permitted by the operator, confirm the signed webhook updates Neon, authorize both browser extensions through the website, verify the signed Pro license, open the Customer Portal, then refund/cancel and test account deletion according to the test plan. Never grant Pro from the success redirect alone.

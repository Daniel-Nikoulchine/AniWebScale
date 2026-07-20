# Secret rotation

Keep all production values in Cloudflare secrets or the responsible provider. `.env` files are local and ignored; they are not a production secret store.

| Secret | Rotation / response |
|---|---|
| Stripe secret key | Roll in Stripe, upload the new key as a Cloudflare Pages secret, deploy, test Checkout/Portal, then revoke the old key. Rotate immediately after suspected exposure. |
| Stripe webhook secret | Create a replacement endpoint/secret with `configure:stripe-webhook`, verify a signed event and duplicate replay, then disable the old endpoint. |
| Neon database password | Create a new least-privilege role/password, update Hyperdrive, run health/license/webhook tests, then revoke the old role. |
| License ES256 private key | Publish overlapping JWKS support before rotating. Existing extension builds trust the current public key; never rotate this key without a migration release. |
| Backup encryption key | Rotate yearly or after exposure. Keep old keys until all backups encrypted with them have expired and restore verification succeeds. |
| Cloudflare/Neon/Stripe account access | Require MFA, individual accounts and quarterly access review. Revoke departed or unused access immediately. |

Record only secret name, owner, rotation date and verification result—never the value. A rotation is complete only after live health, signed webhook, authenticated license and Customer Portal tests pass.

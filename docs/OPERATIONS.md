# AniWebScale operations runbook

## Monitoring and error reports

- Pages Functions emits structured API errors and every API response carries `X-Request-Id`; users see that value as a support code. `website/wrangler.jsonc` enables Workers observability logs and sampled traces, and Cloudflare exposes live deployment output through the dashboard and `npx wrangler pages deployment tail --project-name aniwebscale`. Set the dashboard retention to the reviewer-approved value published as `PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS`; the scheduled smoke test remains the durable release-readiness record.
- `.github/workflows/live-monitor.yml` runs the production smoke test every 15 minutes after this repository is pushed to GitHub. GitHub Actions failure notifications are the initial alert channel.
- `.github/workflows/operations-monitor.yml` checks every six hours that retention, encrypted backup and the independent backup copy have each completed successfully within 48 hours, and that an isolated restore drill succeeded within eight days. It also requires the database migration version expected by the deployed code and evaluates 24-hour availability SLOs for checkout, billing portal, license, extension authorization, account security and Stripe webhooks. Configure the same random `OPERATIONS_MONITOR_TOKEN` in Cloudflare Pages and GitHub Actions. The protected `/api/operations/status` response contains only coarse service/job names, aggregate counts, versions, timestamps, durations and failure counts; it contains no URLs, IP addresses, account identifiers or request data.
- Service metrics are stored in hourly aggregate buckets only and removed by the daily retention job after 30 days. HTTP 5xx responses count against availability; expected 4xx client/authentication rejections do not.
- Check Cloudflare **Workers & Pages → aniwebscale → deployment → Functions** for current 5xx errors and Stripe webhook failures. Use Cloudflare Pages Function metrics for invocation/error counts. Do not add auth tokens, e-mail addresses, request bodies or video data to logs.
- Treat failed checkout/license/webhook requests as severity 1, a full site outage as severity 2, isolated compatibility defects as severity 3. For severity 1, disable `PAID_ENTITLEMENTS_ENABLED` before diagnosis if fulfillment integrity is uncertain.

## Recovery order

1. Run `npm run check:live` from the repository root.
2. Inspect Cloudflare logs by support/request ID and Stripe webhook delivery history.
3. Confirm Neon availability and Hyperdrive health. Never grant Pro from a redirect; replay the signed Stripe event after fixing the cause.
4. Roll back the most recent Cloudflare deployment when the code deployment caused the incident.
5. Record start, impact, actions and resolution in an incident note without customer secrets.

## Personal-data breach procedure

1. Record when the organisation first became aware, affected systems/data subjects/data categories, likely cause and containment owner. Preserve relevant evidence without copying unrelated personal data.
2. Contain access, rotate affected secrets, revoke sessions and contact Cloudflare, Neon, Stripe or GitHub through their security/DPA channel as applicable.
3. Assess likelihood and severity for confidentiality, identity/account takeover, financial effects and loss of availability. Record the decision even when notification is not required.
4. If a risk to natural persons is not unlikely, notify the competent supervisory authority without undue delay and, where feasible, within 72 hours of awareness. Delayed notifications must explain the delay. Use staged notification when facts are incomplete.
5. If a high risk is likely, notify affected people without undue delay in clear language, including nature, likely consequences, mitigation and contact. Record any lawful exception.
6. Maintain a breach register for every personal-data incident with facts, effects, decisions and remedial action. Review root cause and TOM effectiveness after closure.

## Database backups

Neon point-in-time recovery is the primary fast recovery path. In addition, create an independent encrypted logical backup every day. The archive includes Neon Auth users, password hashes, linked accounts, browser sessions and verification rows plus AniWebScale billing, entitlement, Stripe-event, extension-session, abuse-prevention and deletion-tombstone tables. It therefore remains highly sensitive even though it is encrypted:

```powershell
cd website
$env:BACKUP_ENCRYPTION_KEY_B64 = '<32-byte base64 key from the password manager>'
npm run backup:database
npm run verify:backup
```

Generate a key once with `npm run generate:backup-key`, store it in a password manager separate from the backup destination, and never commit it. Copy encrypted files off the development PC to restricted storage. Keep 7 daily, 4 weekly and 6 monthly copies unless legal review specifies otherwise. Verify at least one backup weekly.

`.github/workflows/database-backup.yml` is the ready daily job. In the production GitHub repository, add Actions secrets `NEON_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY_B64`, `BACKUP_SECONDARY_S3_ENDPOINT`, `BACKUP_SECONDARY_S3_BUCKET`, `BACKUP_SECONDARY_S3_REGION`, `BACKUP_SECONDARY_S3_ACCESS_KEY_ID` and `BACKUP_SECONDARY_S3_SECRET_ACCESS_KEY`. The job verifies each encrypted backup, uploads and verifies a signed S3-compatible copy outside GitHub, then atomically updates a `latest.json` pointer containing only object key, byte count and SHA-256 digest. The GitHub artifact is retained for 30 days. Missing secondary-storage configuration fails the job and the separate `database_backup_secondary` health signal.

For restoration, first create an isolated Neon recovery branch at a point before the incident. The restore command refuses the configured source database, applies all versioned migrations, replaces only the declared archive tables in one transaction and reconciles deletion tombstones before committing:

```powershell
cd website
$env:RESTORE_DATABASE_URL = '<isolated Neon branch URL>'
$env:CONFIRM_ISOLATED_RESTORE = 'yes'
npm run restore:database -- backups/aniwebscale-YYYY-MM-DD.backup.enc
```

Restore deliberately discards every archived browser session, verification challenge, extension authorization code, extension session and rate-limit window; users must authenticate again. Verify the emitted restored/discarded row counts and confirm no tombstoned user or transient credential remains. Switch Hyperdrive only after checkout, webhook idempotency, account export, session revocation and license tests pass. Never point `RESTORE_DATABASE_URL` at production.

`.github/workflows/database-restore-drill.yml` performs this recovery every Sunday from the latest independent S3 copy. Configure `RESTORE_DRILL_DATABASE_URL` as a dedicated, non-production Neon database/branch whose Neon Auth schema matches production. It must never be used by an application and must not equal `NEON_DATABASE_URL`. The drill downloads with AWS Signature V4, enforces the pointer path and size limits, verifies SHA-256 before decryption, restores all durable rows, proves transient credentials are empty, checks migration `0009`, and records only aggregate success/duration in production operations state. A missing or stale result makes the operations gate unhealthy.

## Routine cadence

- Daily: monitor failures, Stripe webhook delivery, retention and backup status.
- Weekly: review the automated isolated restore result and unresolved support tickets.
- Monthly: dependency/security updates and access review.
- Quarterly: secret-rotation review, restore drill, legal/tax/store disclosure review.

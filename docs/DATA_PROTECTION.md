# AniWebScale data-protection register

This document is the repository copy of the records of processing activities, retention schedule and technical/organisational measures. It must be reviewed against the exact production configuration at least quarterly and whenever a purpose, vendor, data category, region or retention period changes.

`DATA_PROTECTION_APPROVED=true` is a release attestation, not self-certification. It may be set only after a qualified reviewer has completed the vendor/transfer register, confirmed the public values below and approved the exact deployed legal version. The application keeps new registration, extension connection and checkout fail-closed until the flag, the privacy HMAC key and all public retention facts are configured.

## Controller and scope

The controller identity, address, representatives and contact are supplied by the `LEGAL_*` production configuration and rendered on `/privacy` and `/imprint`. The processing covered here is the website, account/authentication service, payment/license service, browser extension, optional native renderer, support and backups.

No video frames, playback history or visited-page list are sent to AniWebScale. The extension processes pixels locally. Website access is optional and granted per origin from the popup; dynamically registered content scripts run only on origins the user has allowed.

## Records of processing activities

| Processing | Data subjects and data | Purpose and legal basis | Recipients | Retention |
|---|---|---|---|---|
| Website delivery and security | Visitors; IP address, request time, URL, status, browser/device and security event | Delivery, availability and attack defence; Art. 6(1)(f), legitimate interest in a secure service | Cloudflare | Production value `PRIVACY_CLOUDFLARE_LOG_RETENTION_DAYS` |
| Registration and account | Prospective/customers; email, display name, UUID, salted password hash, verification and session data | Pre-contract steps and account performance; Art. 6(1)(b) | Neon; Cloudflare as API host | Account lifetime; verification/session periods below |
| Registration abuse prevention | Prospective users; keyed-HMAC pseudonyms of IP and email, attempt count | Abuse prevention; Art. 6(1)(f) | Neon | Maximum 24 hours |
| Sensitive API abuse prevention | Account holders/visitors; keyed-HMAC pseudonyms of account UUID and IP, operation bucket and attempt count | Account/payment security and availability; Art. 6(1)(f) | Neon, Cloudflare | Maximum 24 hours |
| Checkout, billing and tax | Customers; email, address/tax details at Stripe, customer/subscription/checkout/payment/price IDs and status | Contract, payment, tax/accounting; Art. 6(1)(b), (c), and fraud prevention under (f) | Stripe, Neon, Cloudflare | Contract term; statutory accounting periods; webhook deduplication 120 days |
| License and extension authentication | Account holders; UUID, email, user-chosen device label, plan/status, hashed refresh token, expiry/use timestamps, short-lived signed license | Contract performance, account security and per-device revocation; Art. 6(1)(b), (f) | Neon, Cloudflare | Auth code 5 minutes; extension session 30 days, then cleanup within one day |
| Support and data-subject requests | Requester; contact, request, identity verification result, response and limited diagnostic/support ID | Contract support, legal duties and legal claims; Art. 6(1)(b), (c), (f) | Cloudflare logs and relevant vendor only as needed | Ticket lifetime plus documented legal-claim period; never store passwords/tokens/card data |
| Encrypted backups and recovery | Account holders; authentication rows including password hashes and session tokens, billing/license records, pseudonymous abuse-prevention records and deletion tombstones | Availability/recovery; Art. 6(1)(f), Art. 32 | Neon; encrypted GitHub artifact; restricted independent copy | GitHub 30 days; independent copies max. 6 months; Neon production value `PRIVACY_NEON_PITR_RETENTION_DAYS` |
| Deletion enforcement | Deleted account; internal UUID and keyed-HMAC pseudonym of the former email address | Prevent resurrection and remove matching pseudonymous rate-limit data after restores; Art. 6(1)(c), (f) and Art. 17 compliance | Neon and encrypted backups | Maximum 400 days |

## End-device and extension storage

| Key/class | Location | Purpose | Lifetime/removal |
|---|---|---|---|
| `aniwebscale-theme` | Website `localStorage` | Remember an explicitly selected theme | Written only after a user click; removable with browser site-data controls |
| Neon authentication session | Necessary browser cookie/storage managed by Neon Auth | Keep an account signed in | Production value `PRIVACY_AUTH_SESSION_RETENTION_DAYS` |
| Extension preferences/theme | `chrome.storage.local` / Firefox local extension storage | User-selected renderer settings | Until reset or extension removal |
| Website access grants | Browser extension permission store | Allow local video detection and enhancement on an explicitly selected origin | Until revoked in extension settings/browser controls or extension removal |
| Native consent by origin | Local extension storage | Remember per-site permission for native capture | Until reset or extension removal |
| Extension refresh token and signed license | Local extension storage | Revocable account/license session | 30 days maximum; removed on sign-out, revocation, expiry or account deletion |

Version 10 of the settings migration copies any historical `storage.sync` preferences to local storage and removes the synced keys. No new preference is written to browser sync.

## Retention enforcement

The daily `.github/workflows/data-retention.yml` job applies the schema and runs `npm run cleanup:retention`. It removes expired rate limits, verification records, Neon sessions, extension codes/sessions, 120-day Stripe event deduplication rows and expired deletion tombstones. Failures are operational alerts and must be handled as P1 because the deletion schedule is no longer being enforced.

Account deletion first deletes the Stripe customer where present, then removes extension/auth verification data, writes a 400-day tombstone containing the UUID and a keyed email HMAC, and deletes the Neon Auth user in one database transaction. Foreign-key cascades remove billing and entitlement rows. Passwords, raw tokens, raw email addresses and payment-card data are never placed in the deletion ledger.

The isolated restore command restores the newest archived `deletion_tombstones` table and reconciles it in the same transaction. It never restores browser sessions, verification challenges, extension authorization codes, extension sessions or rate-limit windows from the archive. A restored branch must not receive production traffic until the validation checklist in `OPERATIONS.md` passes.

## Processors and international transfers — approval register

The secure compliance register outside Git must contain, for Cloudflare, Neon, Stripe and GitHub:

- executed/current DPA or applicable controller terms and acceptance date;
- service role for each processing operation;
- subprocessor list/version and change-notification route;
- primary and support/telemetry processing regions;
- adequacy decision/DPF participation or SCC module and transfer-impact assessment where required;
- configured deletion/return behaviour and account-closure procedure;
- reviewer name, evidence link and next review date.

`PRIVACY_VENDOR_REVIEW_DATE` and `PRIVACY_TRANSFER_SAFEGUARDS` are the public summary of that register. Do not set `DATA_PROTECTION_APPROVED=true` if any evidence is missing or inconsistent with `/privacy`.

## Technical and organisational measures

- TLS/HSTS, restrictive CSP, no remote analytics assets, exact/scoped CORS and no framing.
- Salted scrypt password hashes; keyed HMAC for rate-limit identifiers; no request-body logging.
- PKCE for extension connection; authorization codes valid five minutes; refresh tokens stored only as SHA-256 hashes server-side.
- ES256 signed short-lived licenses and a pinned public verification key in the extension.
- Signed Stripe webhooks, idempotency keys and a deduplication table.
- Least-secret public configuration; database, Stripe, license, backup and HMAC keys remain server-side.
- AES-256-GCM logical backups with the encryption key stored separately; restricted retention and restore drills.
- MFA/access review and secret rotation under `SECRET_ROTATION.md`; dependency/security review monthly.
- Data-subject cases and security incidents are logged without passwords, tokens, card data or unnecessary copies of identity documents.
- Effectiveness is checked by automated tests/builds, daily retention and backup jobs, quarterly restore drills and quarterly legal/vendor review.

## DPO and DPIA screening

A qualified reviewer must record whether a data protection officer is required under the applicable German rules and keep the decision with the compliance register. The current design does not intentionally process special-category data, conduct behavioural advertising, or transmit video/browsing history to AniWebScale. A DPIA threshold assessment must nevertheless be repeated when telemetry, remote video processing, profiling, new permissions or materially larger-scale monitoring is introduced.

## Rights, incidents and accountability

`SUPPORT.md` defines intake, identity checks, the one-month deadline, provider-assisted searches and responses for access, rectification, erasure, restriction, portability and objection. `/api/account/export` provides a security-filtered machine-readable first-party export; provider-held records remain part of the full manual search.

`OPERATIONS.md` defines breach containment, risk assessment, the 72-hour supervisory-authority deadline, high-risk user notification and the breach register. All approvals, retention runs, rights cases, incidents, restores and quarterly reviews must be demonstrable without putting customer secrets into Git or logs.

# Support process

Public contact: `support@korrespont.com` and `/support`.

1. Acknowledge account/payment/security cases within one business day and ordinary cases within two business days.
2. Ask for browser, extension version, Windows version, GPU, website, exact error and support code. Never ask for password, token, private license, full card number or raw database data.
3. Search Cloudflare structured logs by support code. For billing, confirm the Stripe event and database entitlement independently.
4. Classify: security/payment lockout (P1), widespread outage (P2), reproducible defect (P3), compatibility/question (P4).
5. Refund through Stripe according to `/refund`; document the reason and Stripe object ID, not payment credentials.
6. Treat any request for access, rectification, deletion, restriction, portability or objection as a data-subject request even if the user does not cite the GDPR. Record receipt time, scope, identity-check method, owner and the one-month deadline. Acknowledge within one business day.
7. Verify identity proportionately through the authenticated account or control of the account e-mail. Request additional information only when there are objective doubts; never request a password, token, full identity-document copy or payment credential.
8. For access/portability, start with the authenticated `/api/account/export`, then search Neon Auth/PostgreSQL, Stripe, relevant Cloudflare support logs and active support records. Export only that user’s data, redact third-party data and explain excluded secrets/security material. Use a structured, commonly readable format.
9. For rectification, restriction or objection, apply the change to every active system and notify relevant processors. For deletion, use the account deletion service where possible, document any statutory retention hold, restrict held data to that purpose and confirm the backup/tombstone treatment.
10. Respond without undue delay and no later than one month after receipt. If a complex request lawfully requires an extension, tell the requester within the first month, state the reasons and new deadline. Any refusal must state reasons and complaint/judicial-remedy options.
11. Keep a minimal case record of dates, searches, decisions, disclosures and completion. Do not attach raw database dumps to ordinary tickets. Escalate a missed or uncertain deadline as P1.
12. Close with the resolution, user-facing workaround and any follow-up release. Review recurring cases weekly.

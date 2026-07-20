# Legal and tax launch gate (Germany / EU consumers)

The website contains Impressum, Datenschutz, AGB, Widerruf and refund documents. New account registration, extension connection and every test/live checkout remain fail-closed until the applicable gates are complete. `LEGAL_REVIEW_APPROVED`, `TAX_CONFIGURATION_APPROVED` and `DATA_PROTECTION_APPROVED` mean qualified reviewers approved the exact deployed version; they are not self-certification shortcuts. `DATA_PROTECTION_APPROVED` is effective only when the keyed-HMAC secret and all public retention/transfer fields are configured.

Confirm before approval:

- exact legal name/form (GbR or eGbR), all partners/representatives, service address, direct contact, register court/number if registered, VAT ID/W-IdNr if issued;
- regular VAT versus the German small-business exemption and the exact consumer price wording;
- Stripe Tax settings, tax-inclusive/exclusive Prices, invoices and customer-location evidence;
- countries sold to, EU B2C digital-service place-of-supply treatment, the EUR 10,000 cross-border threshold where applicable, and whether Union OSS registration/returns are required;
- classification of monthly/yearly access versus Lifetime for withdrawal rules, durable-medium confirmation and the immediate-performance checkbox;
- Cloudflare, Neon and Stripe DPAs, processing regions, transfer mechanism, retention/deletion schedule and supervisory authority details;
- GitHub DPA/terms, region and transfer mechanism for encrypted backup artifacts;
- the completed processor/transfer register, records of processing, TOMs, DPO/DPIA screening, retention job, rights process and 72-hour incident process in `DATA_PROTECTION.md`;
- final custom domain in website, Stripe, Neon trusted origins, stores and all legal links.

Record reviewer name, date and secure evidence location outside Git. Do not enable accounts or payments merely because test-mode checkout succeeds.

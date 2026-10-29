# 03 Missing Features and Gaps

**Snapshot:** 2026-10-06. Items are derived from repository scan and existing feature boundaries. A code reference is not proof of integration or release.

## P0 — Release and Security Blockers

| Gap | Evidence / risk | Definition of done |
| --- | --- | --- |
| Rotate exposed admin/database credentials | Prior session output contained authentication material; a production admin login succeeded once with a weak test password | Rotate admin and DB credentials via controlled terminal/secret management; rotate affected signing keys; reject old credentials; verify app health and audit |
| Fail-closed admin IP allowlist | `ADMIN_IP_WHITELIST` parsed to empty is treated as allowed; startup checks text presence, not valid parsed IPs | Production startup rejects empty/invalid parsed list; test valid, invalid, empty and proxied client addresses |
| Enforce admin MFA and strong password policy | Admin TOTP is optional; admin password-change minimum is 6 characters; JWT remains valid until expiry after password change | Require MFA for every production admin; enforce strong password policy; revoke sessions on credential/security changes; integration tests |
| Reconcile production database state | Historical records disagree about DB P1000/503 vs readiness 200 and pending migrations | Confirm target DB identity and owner; read-only migration status; restore-tested backup; approved migration; full post-deploy smoke |
| Security negative-test matrix | Existing route coverage is partial, not all APIs/roles/tenants | Test each write route for auth, role, tenant, resource owner, state, idempotency, audit and denial |
| Release Truth ownership | Matrix owners are TBD | Name accountable owner and approver for every P0 row; attach current evidence |

## P1 — Core Commercial Closures

- Complete Buyer/Company purchase E2E: identity → catalog/cart → promotion quote → order → provider sandbox → verified webhook → invoice/fulfillment → cancellation/return/refund.
- Complete Consumer purchase E2E independently from B2B identity and permissions.
- Complete merchant operation E2E: product/SKU → inventory reservation → order fulfillment → shipment/tracking → return/refund → audit and balance reconciliation.
- Complete POS shift lifecycle: open → sale/cash movements → return → close → cash and order reconciliation; prove employee permissions.
- Complete procurement/production link: purchase order → receipt → material/inventory → work order/report → finished SKU stock; currently cross-module integration is not established by model presence.
- Complete payment-provider acceptance separately for Stripe, PayPal and Solana; include webhook signature, duplicate/ordering, amount/currency mismatch, partial refund, failure retry and reconciliation.
- Complete payout/settlement only after payment and commission ledgers reconcile; automatic bank transfer remains unimplemented and should stay disabled.
- Complete Fashion Community migration and object-storage acceptance: source/target counts, account linking, media copy/CDN, moderation, deletion and rollback.
- Complete Flutter acceptance: `flutter analyze`, `flutter test`, Android build, iOS build/archive, API host, auth, payment, upload, notification and device smoke.
- Complete Fashion Ingestion acceptance: authorized source, fetch/parse/de-dup/image validation, actual provider (not mock), moderation, publish-to-Fashion API, worker crash/retry and deletion.

## P1 — Platform and AI Operations

- Growth mission-to-business-result loop: Mission → approval → authorized connector → persisted receipt → customer/order attribution → cost/revenue report.
- External connector controls: per-capability scopes, token expiry/revoke, consent, regional availability, budget caps, retry/idempotency, delivery receipts and emergency kill switch.
- AI tool capability registry: role × tool × read/write × tenant × approval × consent × cost × audit; include explicit negative cases.
- AI Task reliability: worker crash, DB disconnect, provider timeout/429/500, duplicate worker, stale lease, deploy during task, cancellation, stuck-task alert and dead-letter recovery.
- AI credits/cost reconciliation: grants, reservations, consumption, releases, refunds, expiration, provider partial success, actual provider cost and margin; current metering covers only selected workflows.
- Data/BI: define authoritative source, event IDs, metric denominator/window/currency, lineage and data freshness for every Growth/BI card.
- Privacy/data lifecycle: retention, deletion, export, consent withdrawal, tenant offboarding, backup retention and derived-media/embedding deletion for customer, chat, brain and community data.
- Media lifecycle: upload validation → private storage → processing → review → publish/CDN → archive/delete; store owner, tenant, checksum, MIME, license and deletion evidence.
- Incident/operations: SEV definitions, freeze/rollback, payment/AI/connector kill switches, incident owner, user notification and postmortem record.
- Observability: requestId, traceId, taskId, tenantId, providerRequestId, webhook/payment IDs; latency/error/retry/queue age/cost/webhook lag/DB pool/storage failure dashboards.

## P2 — Scale Platform Foundations

- General organization membership and role/scope model across multiple stores, brands and partner organizations.
- Versioned PIM with channel mappings, industry attributes, asset provenance and conflict resolution.
- Multi-warehouse/multi-store OMS with cross-channel reservations, transfers, fulfillment split and concurrent stock consistency.
- Customer 360/CDP with consent-safe identity resolution across Web, POS, support and marketing.
- Unified semantic BI/data warehouse with data lineage and auditable cohort/revenue/cost metrics.
- Public versioned API, OAuth app installs, webhook subscriptions, SDK, developer portal and reviewed App Marketplace.
- Multi-industry SaaS only after generic domain extension, tenant isolation, billing, data export/deletion, support SLA and legal review.

## P3 — Future Products, Not Current Gaps to Silently Enable

- White-label Operator Tenant, merchant self-service Growth OS, multi-level marketplace.
- Automated advertising spend optimization, outbound WhatsApp/SMS/email and broad social auto-publishing.
- Automatic withdrawals, bank payouts and automated finance settlement.
- Public developer marketplace, arbitrary third-party plugins, general autonomous multi-agent system.
- Voice/video generation, automatic fashion video editing and additional virtual try-on providers.

These require separate product approval, risk/privacy/legal/finance review and independent acceptance. Do not represent them as current launch blockers if they are explicitly out of current scope; keep them disabled until approved.

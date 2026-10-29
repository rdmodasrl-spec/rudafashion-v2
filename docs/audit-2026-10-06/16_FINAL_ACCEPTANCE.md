# 16 Final Acceptance Checklist

**Purpose:** Evidence-driven definition of “closed loop.” A route, model, screen, mock response or historical green test is not acceptance by itself.

## Evidence Status

Use one status per requirement:

- `NOT_STARTED`: no implementation or evidence.
- `IMPLEMENTED`: code exists, not fully tested.
- `TESTED`: automated acceptance passed against isolated test dependencies.
- `STAGING_VERIFIED`: approved staging environment/provider evidence attached.
- `RELEASED`: production release version, owner approval, monitoring and rollback recorded.
- `BLOCKED`: dependency or decision prevents work; name owner and unblock condition.
- `OUT_OF_SCOPE`: explicit product decision and revisit date.

Every row needs an owner, evidence link, commit/build ID, environment, date and next action. Never mark `RELEASED` based on repository structure alone.

## Global Release Gates

- [ ] Credential exposure response complete; old secrets invalid; rotation evidence stored in approved secret system, not this document.
- [ ] Admin MFA, IP policy, password/session lifecycle and lockout/rate limiting pass positive and negative tests.
- [ ] Target DB identity, schema/migration status, owner/grants, backup, restore and rollback/forward-fix are verified.
- [ ] Build, typecheck/lint, unit, integration and E2E results are attached for the release commit.
- [ ] All protected routes are mapped to principal, tenant, permission, resource ownership, state transition and denial tests.
- [ ] Audit and correlation IDs cover HTTP, worker, provider webhook and external delivery.
- [ ] Monitoring, on-call owner, runbook, incident escalation, freeze/rollback and kill switches are tested.
- [ ] Privacy retention, export/delete, media rights and consent behavior are approved for launch markets.

## Domain Acceptance

### Commerce and Inventory

- [ ] Buyer B2B and Consumer B2C identity/data are independently isolated.
- [ ] Cart/quote totals, price, stock and promotion are server-calculated and concurrency-safe.
- [ ] Order creation and reservation are atomic and replay-safe.
- [ ] Fulfillment/shipment/tracking/cancel/return/refund lifecycle is accepted.
- [ ] Multi-merchant partial shipment/refund/cancel behavior is explicitly tested or out of scope.
- [ ] POS open/sale/cash movement/return/close reconciles to orders and tender receipts.

### Payments and Finance

- [ ] Each enabled provider passes valid/invalid signature, replay, mismatch, duplicate, order-of-events and outage tests.
- [ ] Capture/refund/chargeback/provider fee/commission/platform fee/settlement are separate states/ledger entries.
- [ ] Daily reconciliation has zero unexplained variance for each enabled provider and currency.
- [ ] Commission reversals, payout holds and manual adjustments have immutable evidence and maker-checker control.
- [ ] Automatic payout remains disabled unless beneficiary verification, external receipt and rollback/reconciliation are accepted.
- [ ] Subscription/AI credit grant-reserve-consume-release-refund paths reconcile with provider usage.

### Identity and Admin

- [ ] Every role has a documented resource scope; cross-tenant and wrong-owner tests deny without side effects.
- [ ] Employee grant/revoke is effective immediately for API and queued tasks.
- [ ] Admin IP and MFA policy fail closed under missing/invalid configuration.
- [ ] Security-sensitive changes revoke or invalidate existing sessions within an agreed SLA.

### AI and Growth

- [ ] Each model/provider and mock is clearly distinguished in UI, logs, metrics and reports.
- [ ] Each tool has schema, tenant/role/capability checks, read/write classification, approval, budget and audit.
- [ ] Prompt injection, tool escalation, data leakage and model timeout/rate-limit tests pass.
- [ ] Task cancellation, lease fencing, duplicate worker, crash/redeploy and dead-letter recovery pass.
- [ ] Consent, suppression, approval, provider receipt, attribution and campaign cost connect for every enabled channel.
- [ ] Marketing ROI defines net/gross, returns, fees, currency, attribution window and data freshness.

### Ingestion and Community

- [ ] Only authorized sources are enabled with license/territory/channel evidence.
- [ ] Real AI provider is verified or feature is visibly marked mock and cannot pass production content acceptance.
- [ ] Duplicate, copyright, image quality, review, publish, takedown and deletion flows are tested.
- [ ] Ingestion DB/queue outage, retry, publication dedup and media-storage failure recover safely.

### Flutter and Globalization

- [ ] Android/iOS build, auth, checkout, push, media and deep links pass on supported devices.
- [ ] `flutter analyze` and `flutter test` pass for the release commit.
- [ ] Every launch locale has translation coverage, timezone/currency/rounding and legal/consent acceptance.
- [ ] Launch-country tax, shipping, payment, privacy and data residency owners approve.

### Developer Platform / Marketplace

- [ ] Internal vs public routes are classified; public API schemas/versioning/rate limits are published and contract-tested.
- [ ] OAuth app install, consent, scope, key/token rotation, revoke and uninstall cleanup pass.
- [ ] Webhooks are signed, replay-safe, retryable and observable.
- [ ] Third-party app/agent review, sandbox, permissions, pricing, support and incident policies are accepted before marketplace launch.

## Evidence Record Template

| Requirement ID | Status | Owner | Environment / build | Test or evidence link | Date | Blocker / next action |
| --- | --- | --- | --- | --- | --- | --- |
| Example: SEC-ADMIN-01 | NOT_STARTED | TBD | N/A | N/A | N/A | Approve security change window |

## Stop Conditions

- Stop release on any unresolved P0 security issue, cross-tenant access, payment/ledger variance, unsigned webhook mutation, duplicate financial side effect, missing backup/restore proof, or unowned production alert.
- Stop autonomous external action when consent, approval, scope, budget, provider receipt or rollback path is absent.
- Stop this audit phase here: business-code implementation begins only after a separate user instruction and approved change scope.

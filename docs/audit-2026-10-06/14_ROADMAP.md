# 14 Recommended Engineering Roadmap

**Snapshot:** 2026-10-06. Sequence is risk-first; phase completion requires evidence and owner sign-off, not code presence.

## Phase 0 — Secure and Establish Truth (P0)

- Rotate credentials and signing secrets exposed previously; confirm old material is rejected.
- Make admin IP allowlist fail closed; require production admin MFA; strengthen password/session revocation.
- Identify the exact production DB, migration state, grants, backup freshness and restorable backup.
- Run only approved read-only health/migration checks first; require explicit change approval before migrations/restart.
- Produce route-level release truth ledger with owner, evidence, status and next gate.

**Exit:** no unresolved credential exposure; admin security tests pass; current production DB/backup/migration truth is signed by owner.

## Phase 1 — Core Commerce and Finance Closure (P0/P1)

- Isolated DB test baseline, complete buyer and consumer checkout E2E.
- Payment provider sandbox tests for signature, replay, order amount/currency, duplicate, out-of-order, refund and reconciliation.
- Merchant/POS inventory/order/fulfillment/return/refund full lifecycle; tenant and employee negative tests.
- Partner commission accrual/reversal/statement reconciliation; keep unverified payout manual/disabled.

**Exit:** zero unexplained ledger variance; all core E2E/negative tests run against isolated DB and approved provider sandbox.

## Phase 2 — Data and Operational Reliability (P1)

- Map all process-local projection reads/writes and migrate business writes to explicit PostgreSQL services.
- Add transaction/outbox and idempotency for cross-domain side effects.
- Define request/task/provider/event correlation, dashboards, alert routing, rate limits, and runbooks.
- Execute backup restore and measure RPO/RTO; validate migration backup/preflight/rollback plan.
- Complete media lifecycle, Fashion Community migration proof and ingestion publication recovery.

**Exit:** restore drill passes; queue/provider/DB failure drills recover without duplicate financial/customer side effects.

## Phase 3 — AI and Growth Governed Automation (P1)

- Publish tool capability × role × tenant × approval × consent matrix.
- Verify real model providers and cost accounting; keep ingestion mock analyzer clearly non-production.
- Add durable worker failure/cancel/redeploy/retry tests and independent verifier.
- Complete one channel at a time from consent through approved send, provider receipt and verified attributed order.
- Add evaluation datasets and cost/quality/business-outcome dashboards.

**Exit:** each enabled capability has approval, budget, consent, audit, kill switch and measured quality; unsupported channels fail closed.

## Phase 4 — Multimarket and Product Platform (P2)

- Select initial countries/locales and implement currency/tax/shipping/consent/legal matrix.
- Build PIM, multi-store/warehouse OMS and customer identity/CDP only against validated product requirements.
- Add semantic analytics and data lineage with authoritative definitions.
- Complete Flutter platform matrix and release checklist.

**Exit:** each target market and client platform passes dedicated acceptance and support runbook.

## Phase 5 — Developer / Agent Marketplace (P3)

- Publish versioned public API, OAuth installs, webhook delivery and SDK only after threat modeling.
- Add app/agent review, sandbox, least privilege, revoke, quota/billing, versioning and support/SLA.
- Launch service, app or agent marketplace as distinct product with legal, commercial and incident owners.

**Exit:** security review, tenant isolation, contract tests, marketplace operations and financial reconciliation are accepted.

## Ordering Constraints

- Do not start autonomous marketing before consent, connector receipt, attribution and kill switch.
- Do not start automatic payouts before financial reconciliation and beneficiary validation.
- Do not scale multiple app replicas while process-local projection behavior is not understood.
- Do not claim multi-industry SaaS before tenant, billing, data lifecycle and industry extension contracts exist.
- Do not run production migrations or credential changes as part of this read-only audit; use a separately approved change window.

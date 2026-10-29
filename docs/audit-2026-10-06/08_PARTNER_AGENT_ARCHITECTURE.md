# 08 Partner Agent Architecture

**Snapshot:** 2026-10-06. Current partner/referral mechanics are not equivalent to an open external agent marketplace.

## Current Partner Evidence

- Partner identity, referrals/campaigns, click tracking and commission ledger/adjustment paths are present in Prisma and server modules.
- Partner Growth integration tests cover selected referral and commission flows.
- Existing code is a bounded partner/referral system. No evidence establishes complete multi-level contracts, automated bank payouts, public agent onboarding, open tool scopes or a regulated marketplace.

## Partner Commerce Flow

```mermaid
flowchart LR
  onboarding[Partner application / identity] --> review[Admin review and contract]
  review --> campaign[Scoped campaign or referral]
  campaign --> click[Deduplicated click / attribution]
  click --> order[Verified paid order]
  order --> ledger[Commission accrual ledger]
  ledger --> reversal[Return / refund reversal]
  ledger --> reconciliation[Statement and manual payout evidence]
  reconciliation --> audit[Partner and finance audit]
```

## Partner Commission Rules

- Referral ownership and hierarchy are server-derived; users cannot set their own parent/referrer.
- Commission is computed from a versioned contract/rate snapshot and eligible net amount, never from an editable dashboard total.
- Commission accrual is pending until the order/payment eligibility window is met. Returns, refunds, cancellations, chargebacks and fraud produce linked reversal entries rather than mutating history.
- Idempotency scope includes provider/order/item/partner/rule version. Duplicate webhook or replay cannot duplicate commission.
- Statements show accrued, pending, reversed, eligible, paid and held amounts separately by currency and period.
- Payment to partner is not complete until there is external payment-provider/bank receipt evidence and reconciliation.

## Agent Integration Target (Not Current Marketplace)

| Contract | Requirement |
| --- | --- |
| Agent principal | Unique app/agent identity, verified operator, tenant, environment and lifecycle state |
| OAuth/install | Explicit merchant/admin consent, exact scopes, expiring/revocable token and reauthorization path |
| Tools | Versioned schemas, data classification, read/write level, rate limits, idempotency and SLA |
| Commission | Contract version, attribution policy, eligible event, refund window, caps and audit |
| Execution | Proposal → policy check → approval → idempotent action → receipt → verifier |
| Isolation | Per-merchant tenant/data boundary, secret isolation, network and prompt-injection controls |
| Billing | Usage limits, provider cost attribution, refund/chargeback and partner revenue sharing |
| Operations | Health status, support escalation, deprecation/version compatibility and incident response |

## Top Gaps

1. Formalize partner onboarding/KYC, contracts, tax profile, jurisdiction and suspension process.
2. Specify attribution precedence and cookie/privacy consent; define conflict and self-referral fraud rules.
3. Verify eligible net commission math against discounts, tax, shipping, partial capture/refund and multi-currency.
4. Reconcile ledger totals, statement exports and manual payout evidence; keep automatic payout disabled until validated.
5. Add partner data minimization, customer privacy boundaries and export/deletion.
6. Separate partner campaign integrations from arbitrary installed agents; they have different security and commercial contracts.
7. For future agent marketplace, implement signed packages, review/scanning, least privilege, sandbox, revocation, SLA and incident response before third-party tools execute.

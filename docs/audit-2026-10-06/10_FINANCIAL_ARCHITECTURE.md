# 10 Financial Architecture

**Snapshot:** 2026-10-06. This is a control and reconciliation audit. It is not accounting, tax or legal advice.

## Current Financial Code Surface

- Commerce includes orders, payments, webhook events, refunds, returns, invoices and shipment relations.
- Merchant finance has operation ledgers, platform fee settings, manual settlement records and payout/order allocation models.
- Partner commission is ledger-oriented with selected adjustment/reversal paths.
- ModaGPT subscription has Stripe checkout/webhook, invoices, plan entitlements, credits and reservations.
- Stripe, PayPal and Solana-related configuration/route paths exist. Flutter includes several region-specific payment SDKs; those dependencies do not prove RUDA backend integration.
- Integration test files exist for ModaGPT billing, quote, partner commission and P0 HTTP/webhooks; this audit did not execute them.

## Financial State Domains

| Domain | Authoritative records | Do not confuse with |
| --- | --- | --- |
| Commerce payment | Provider-specific `PaymentTransaction`, signed webhook, captured amount/currency | Checkout return URL, client success event, order status alone |
| Refund/return | Return/Refund records plus provider-confirmed refund transaction | Return request or support promise |
| Commission | Accrual/reversal ledger tied to eligible order/payment and contract version | Partner dashboard estimate |
| Platform fee | Versioned fee policy applied to eligible transaction | Editable merchant UI rate without audit |
| Settlement/payout | Allocation, statement, payout attempt and external receipt | Manual status text or account balance |
| Subscription | Billing subscription/invoice/payment and verified Stripe event | Local plan toggle or success redirect |
| AI credit | Grant/reservation/consume/release/adjust ledger | Prompt count or UI remaining-credit cache |
| Tax/accounting | No complete jurisdictional accounting/tax engine established | Gross sales chart or provider settlement statement |

## Required Ledger Rules

- Append-only financial movements with stable event IDs, explicit currency/decimal precision, originating entity, actor, timestamps and reversal references.
- Every payment/refund/fee/commission/credit action is idempotent and tied to a provider event or internal business event.
- Verify webhook signature, provider account, event age/replay, object ID, order/payment link, amount, currency and expected state before mutation.
- Handle out-of-order events using a state machine and provider reconciliation; never blindly downgrade captured/settled state.
- Separate authorization, capture, refund, chargeback, fee, tax, commission, reserve, settlement and payout.
- Use decimal/integer minor units with an explicit currency exponent; never JavaScript floating point for ledger math.
- Store policy/rate/tax/FX snapshots applied at transaction time.
- Reconcile daily: provider settlement ↔ payment ledger ↔ orders/refunds ↔ commission ↔ platform fees ↔ payout allocations.
- Keep manual adjustment/payout maker-checker approval, reason, evidence and immutable audit.

## Not Yet Proven / Gaps

1. Full amount/currency/account validation and duplicate/out-of-order coverage for every provider webhook.
2. Partial captures, partial refunds, refund failure/retry, chargeback/dispute and provider fee reconciliation.
3. Cross-currency FX policy and settlement conversion snapshots.
4. Tax calculation, invoices/credit notes and jurisdiction-specific records.
5. Complete double-entry general ledger and accounting export are not established; do not claim accounting-system replacement.
6. Automatic bank payouts are not established. Manual settlement evidence remains distinct from payment to beneficiary.
7. Partner commission net-of-discount/tax/shipping/refund policy and payout eligibility window need explicit versioned rules.
8. ModaGPT credits must cover all billable providers and fallback attempts, including timeout/partial provider success.
9. Financial retention, correction, audit access, access segregation and restore/reconciliation drills need named finance owner.
10. Run all PostgreSQL suites against isolated test DB and provider sandbox before financial production release.

## Release Gate

No ledger or payout workflow is marked complete until the expected-vs-actual reconciliation produces zero unexplained variance, replay and failure tests pass, finance owner signs the policy snapshot, and support has a traceable correction/refund process.

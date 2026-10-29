# 04 Data Architecture Audit

**Snapshot:** 2026-10-06. This report lists existing data foundations and target gaps; it does not propose destructive schema changes.

## Current Data Stores

| Store | Repository evidence | Purpose / limits |
| --- | --- | --- |
| PostgreSQL via Prisma | `prisma/schema.prisma`, 103 migration SQL files | Authoritative Web business database; migration file count does not prove target DB application |
| Process-local arrays | `server.ts` `db` projection initialized from demo constants and hydrated from Prisma | Compatibility/read projection; production refuses missing DB or hydration failure, but remaining readers may be stale across multiple processes |
| Protected JSON files | `logs/*` configs and legacy community/support data | Operational config/legacy ingestion; must not become a second financial/customer source of truth |
| S3-compatible object storage | Provider config, signed URLs, gallery/community/media backup paths | Private media and backup objects; object lifecycle/deletion depends on configured bucket/CDN |
| Flutter local persistence | Hive/local storage and app repositories | Client cache/session state; never authoritative for order/payment/inventory |
| Ingestion SQL DB | SQLAlchemy models + Alembic under `fashion-ingestion/` | Separate source/content collection service database; not proven unified transactionally with Prisma |

## Existing Entity Domains

- Identity: `AccountIdentity`, `AuthAccount`, `AdminTwoFactor`, `FashionAccount`, `FashionAccountIdentity`.
- Organizations and users: `Merchant`, `Company`, `CompanyBusinessRole`, `MerchantEmployee`, `Customer`, `Consumer`, `MerchantCustomerLink`.
- Catalog: `Product`, `ProductVariant`, categories, supplier, material and BOM entities.
- Commerce: `Order`, `OrderItem`, `SalesQuote`, promotion rules/redemptions, invoices/documents, payment/refund/return, shipment/tracking.
- Inventory/operations: warehouse location, balance, append-style movements, reservation, transfer, POS shift/cash movement, purchase order/receipt, work order/report.
- Growth/partner: Partner, campaign, clicks, referral and changes, commission entries, growth missions/events/follow-ups.
- AI: employee definitions/installations/memories, tasks/approvals, merchant support/assistant history, Brain documents/chunks/facts/evaluations/experiences/lessons/feedback, billing and credit ledger/reservations.
- Community/control: Fashion posts/comments/reactions/follows, support requests, notifications, risk alerts, audit logs, vault requests.

## Current Source-of-Truth Matrix

| Business fact | Authoritative source | Derived/non-authoritative copies |
| --- | --- | --- |
| Product/SKU and published price | Product/ProductVariant records and existing pricing rules | AI copy/image drafts, process-local serialization, browser cache |
| Inventory quantity | normalized InventoryBalance + InventoryMovement/Reservation | `Product.inventoryStatus`, AI memory, imported spreadsheet |
| Order status and total | Order/OrderItem and transaction-bound update services | UI labels, AI summary, export file |
| Payment status | PaymentTransaction plus provider-signature-verified webhook event | Checkout redirect, browser result, unverified provider callback |
| Refund | RefundTransaction linked to payment/order and provider result | Return request alone, manual note without evidence |
| Commission | immutable Partner commission ledger entries and reversal entries | mutable dashboard total or inferred attribution |
| Payout/settlement | current payout/allocation records and verified evidence | UI state alone; no proof of bank transfer without provider evidence |
| ModaGPT subscription | Billing subscription/invoice/payment + verified Stripe webhook | success redirect or locally enabled plan label |
| AI usage | selected credit ledger/reservation/usage paths | provider request count without billing/cost record |
| Marketing attribution | persisted click/referral/campaign and business event relations | unlinked browser analytics, guessed source, AI estimate |
| AI recommendation/Brain memory | advisory/context data with provenance | never authority for inventory, price, payment, policy or permissions |

## Data Flow Contracts

1. Every write request derives actor and tenant from authenticated server context, not request-supplied `merchantId` or model output.
2. Business fact plus audit/outbox intent should commit atomically. External delivery happens after commit and records provider receipt/failure separately.
3. Payment, refund, commission, credit, settlement and payout are separate ledgers/states; do not collapse them into a single balance field.
4. Idempotency keys must include tenant/resource scope; webhook event IDs are provider-scoped and replay-safe.
5. AI and analytics outputs must record source IDs, period/window, currency and freshness; unknown data remains unknown rather than zero.
6. Files/media reference object key, tenant/owner, checksum, MIME, consent/license, review state, retention and deletion evidence.

## Missing or Unverified Data Architecture

- No repository evidence of a unified cross-channel PIM/versioned attribute registry.
- Current warehouse model is configured around one physical central warehouse; multi-warehouse stock allocation and cross-channel reservation are future scope.
- No complete Customer 360/CDP identity resolution and consent event model across web/POS/support/marketing was found.
- No cross-domain semantic metric layer/data warehouse and lineage contract was identified.
- Data export/deletion/retention/backup erasure policy across all AI memories, chat, media, logs and derived indexes needs formal coverage.
- Process-local `db` projection may become stale in multi-process deployment; enumerate remaining reads/writes before horizontal scaling.
- Ingestion DB to Prisma publishing has an API boundary, not a distributed transaction; retry/dedup/publication ownership must be documented and tested.

## Safe Migration Rules

- Never infer target migration state from migration file count or an isolated test DB.
- Confirm target database identity, backup restore viability, migration owner/schema grants and reviewed SQL before approval.
- Prefer additive schema and backfills with source/target counts, replay-safe import and rollback/forward-fix plan.
- Do not delete legacy source files/media until imported content and object-store links are verified.

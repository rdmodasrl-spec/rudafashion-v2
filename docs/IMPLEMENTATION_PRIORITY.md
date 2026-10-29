# Implementation Priority

## 1) Executive prioritization rule

This project should not be implemented as a product feature backlog. It should be implemented as a platform integrity backlog.

The rule is:

- P0 first: anything that can cause data loss, unauthorized access, financial incorrectness, unrecoverable outage, or unsafe AI execution
- P1 second: anything that breaks purchase-to-settlement and merchant operating continuity
- P2 third: growth, ecosystem, and platform scale features

## 2) P0 risk ordering (highest to lowest)

### P0-1: Admin security and fail-closed auth

Why first:

- Admin auth is a critical trust boundary.
- Audit evidence shows admin login, password policy, TOTP behavior, and IP allowlist logic are sensitive and must be treated as production security controls.
- Any allowlist or auth bypass must fail closed.

Files to prepare for patching:

- `server.ts`
- `prisma/schema.prisma`
- `tests/integration/p0-http.postgres.test.ts`
- `tests/tenant-access.test.ts`

Expected tests:

- admin login success only with valid credential + allowed IP + MFA policy
- admin login failure when IP is not allowed
- failed login does not produce account enumeration that leaks details
- session revocation and expiry checks
- password reset and change path require correct policy

### P0-2: Tenant / store / partner / agent isolation

Why first:

- This is a multi-tenant platform by design.
- No trusted release is possible without proving cross-tenant reads are denied.

Files to prepare for patching:

- `server.ts`
- `prisma/schema.prisma`
- `tests/tenant-access.test.ts`
- relevant route guards and middleware in `src` or server composition files if present

Expected tests:

- Tenant A cannot read Tenant B records
- Store A cannot read Store B inventory, orders, or customer records
- Partner A cannot see Partner B commission or payout data
- Agent A cannot execute Agent B permissions
- merchant cannot access platform-admin records

### P0-3: Payment and financial integrity

Why first:

- Payment correctness and ledger integrity are business-critical and security-critical.
- This includes payment intent, transaction state, refund logic, ledger reconciliation, payout and settlement state transitions.

Files to prepare for patching:

- `server.ts`
- `prisma/schema.prisma`
- any payment/ledger route/service modules under `src/` and `server.ts`
- tests for webhook idempotency and financial state transitions

Expected tests:

- duplicate payment callback is idempotent
- refund does not over-credit merchant or platform
- ledger entries balance across payment/settlement/refund states
- failed payment cannot create a positive revenue ledger entry

### P0-4: Backup / recovery / migration integrity

Why first:

- A platform is only safe if it can be recovered and migrated without corrupting state.
- Current evidence includes a backup and recover script set, but production restore proof is still required.

Files to prepare for patching:

- `scripts/start-production.sh`
- `scripts/predeploy-backup.ts`
- `scripts/recovery-drill.ts`
- `prisma/migrations/`
- `scripts/post-deploy-smoke.ts`

Expected tests:

- backup creation + checksum validation
- restore to a recovery database and schema verification
- migration smoke with `ALLOW_PRODUCTION_MIGRATIONS=true`
- failure path without backup or with invalid restore target

### P0-5: Audit logging and event traceability

Why first:

- Money and security decisions must be observable.
- Without a durable audit trail, incident response and platform trust fail.

Files to prepare for patching:

- `server.ts`
- Prisma and route/event model sections
- any logging or telemetry layers already present under `src/`

Expected tests:

- admin actions emit audit records with tenant, user, action, timestamp, and result
- financial operations produce immutable ledger or event evidence
- failed operations remain traceable and do not silently succeed

### P0-6: Database integrity and migration guardrails

Why first:

- A multi-model system with 103 migration files requires controlled migration discipline.
- The migration pattern must be safe and reversible where possible.

Files to prepare for patching:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `scripts/start-production.sh`
- migration validation tooling in scripts

Expected tests:

- migration ordering is valid
- destructive changes are blocked without explicit approval gate
- schema drift is detected before deployment
- foreign keys and constraint coverage are tested

## 3) P1 ordering

### P1-1: checkout + order + fulfillment + return

Why:

- It closes the merchant business flow from cart to delivery and refund.

Files to inspect/patch:

- `server.ts`
- Prisma order/payment inventory models
- checkout and order route/service code in `src/`

### P1-2: AI task queue + cost accounting + retry + observability

Why:

- AI systems are not safe until they can be costed, tracked, retried, and controlled.
- Current audit explicitly notes AI provider mock and task reliability gaps.

Files to inspect/patch:

- `fashion-ingestion/app/services/ai.py`
- any AI task queue / route modules under `src/` and `fashion-ingestion/`

### P1-3: CRM + consent + campaign attribution + ROI

Why:

- Marketing execution must be consent-safe and financially attributable.
- Without this, growth automation becomes non-compliant and non-credible.

### P1-4: partner commission + settlement + dispute logic

Why:

- In a platform model, partner trust depends on exact commission, payout, and settlement correctness.

### P1-5: POS reconciliation and merchant daily close

Why:

- POS requires cash/card/refund reconciliation to be operationally safe.

## 4) P2 ordering

### P2-1: Developer platform and API ecosystem

- API versioning
- API keys
- OAuth
- webhook verification
- SDK
- rate limits
- developer portal

### P2-2: Agent marketplace and app marketplace

- listing
- permission
- billing
- install/revoke
- usage tracking
- settlement

### P2-3: Globalization and compliance expansion

- locale, timezone, currency, tax, VAT, country rules, privacy, deletion

### P2-4: advanced AI marketing and analytics

- recommendation loops
- forecasting
- campaign optimization
- multi-channel ROI

## 5) First batch for P0 execution

This is the first actionable patch batch, before any P1 or P2 work.

### Batch A: Security and access

- `server.ts`
- `prisma/schema.prisma`
- `tests/tenant-access.test.ts`
- `tests/integration/p0-http.postgres.test.ts`

Objective:

- enforce fail-closed auth
- fix allowlist/role checks
- add negative tenancy tests

### Batch B: Financial correctness

- `server.ts`
- payment/ledger models in `prisma/schema.prisma`
- route/service modules that handle payment/refund/settlement
- financial tests under `tests/`

Objective:

- ensure ledger, refund, payout, and webhook idempotency correctness

### Batch C: Recovery and migration integrity

- `scripts/start-production.sh`
- `scripts/predeploy-backup.ts`
- `scripts/recovery-drill.ts`
- `prisma/migrations/`

Objective:

- verify restoration and migration safety before continuing

### Batch D: Audit / traceability

- `server.ts`
- event/audit model definitions
- route/service logging integration

Objective:

- guarantee every money and permission event is traceable and auditable

## 6) Expected first-batch tests

At minimum, the first batch should add and run:

- admin auth negative tests
- IP allowlist negative tests
- tenant isolation negative tests
- payment webhook idempotency tests
- refund/ledger balance tests
- backup and restore smoke tests
- migration validation tests

## 7) Important constraints

- Do not treat code presence as implementation.
- Do not mark a feature as IMPLEMENTED unless it has UI + API + DB + auth + test + operational proof.
- Do not treat mock AI or mock payment flows as production-accepted.
- Do not perform destructive migration or production reset without explicit approval.
- Do not allow broad refactor before P0 closure.

## 8) Proposed execution order next

1. Security patch batch
2. Tenant isolation patch batch
3. Financial integrity patch batch
4. Backup/recovery and migration batch
5. Event/audit traceability batch
6. Then move to P1 commerce/AI/marketing closure

This order preserves the platform’s trust boundary before adding growth and ecosystem capability.

# 01 Current System Audit

**Snapshot:** 2026-10-06
**Scope:** Repository source/config/tests inventory. No business source code was changed for this audit.
**Status vocabulary:** `COMPLETE` means evidence supports the stated bounded workflow; it does not imply whole-product production readiness. `PARTIAL` means code exists with integration or operational gaps. `UI_ONLY`, `API_ONLY`, `DATABASE_ONLY`, `MOCK`, `TODO`, `MISSING`, and `DEPRECATED` are used only when direct evidence supports them.

## Executive Findings

- The repository is a multi-runtime monorepo: React/Vite + Express/TypeScript Web application, Prisma/PostgreSQL persistence, a Flutter application under `fu/`, and a separate FastAPI/SQLAlchemy/Celery service under `fashion-ingestion/`.
- `server.ts` is the central Express application and contains several hundred route handlers. A pattern scan found about 463 matching API route declarations; this is a search result, not a completed endpoint-by-endpoint security audit.
- `prisma/schema.prisma` contains about 126 model declarations. The repository has 103 migration SQL files in the audited workspace; this count does not prove that any target database has applied them.
- Web portals include public/B2B buyer, consumer, merchant/employee, partner, and platform-admin experiences. Mobile Web/PWA paths and a separate Flutter app also exist.
- Test assets are broad: 84 files under `tests/`, 8 PostgreSQL integration suites under `tests/integration/`, and a POS E2E journey file. File presence is not execution evidence. No tests, build, migration status, Flutter analysis, Python pytest, or production smoke was run during this inventory.
- No `.github/workflows/` CI workflow was found. `codemagic.yaml` defines an iOS TestFlight build/publish workflow; it is not evidence that the workflow has recently passed.
- Fashion Ingestion's AI analyzer returns `provider: "mock"` in `fashion-ingestion/app/services/ai.py`; treat classification as mock until a real provider adapter and acceptance are recorded.
- Previous conversation evidence includes a successful single production admin login request and exposed authentication material. Rotate exposed credentials and signing secrets; do not copy any secret into this report.

## Runtime and Build Inventory

| Area | Evidence in repository | Audit state |
| --- | --- | --- |
| Web frontend | React 19, Vite, Tailwind, `src/apps/shared/PublicFrontendApp.tsx`, `src/apps/shared/components/*` | Historical audit reference: the former `src/App.tsx` root and shared UI modules were migrated into the application module structure; route-by-route UX acceptance not performed |
| Main API | Express 4, TypeScript, single `server.ts` composition root | Implemented code; broad route ownership and full negative-test matrix incomplete |
| Persistence | Prisma 6 + PostgreSQL; 103 migration files | Schema/migrations exist; current target DB status unknown |
| Web/mobile shell | Capacitor config and PWA manifest/service worker | Code/config exist; installed/offline/push behavior not tested here |
| Flutter | `fu/`, Flutter/Dart, Android/iOS/Web folders and commerce plugins | Source exists; RUDA API wiring and release status unknown |
| Ingestion | FastAPI, SQLAlchemy, Alembic, Celery/Redis, Docker Compose | Service source exists; deployment and live sources unknown |
| Production | PM2 ecosystem, guarded start, backup and smoke scripts | Release controls exist; full current production smoke not run here |
| CI | Codemagic TestFlight workflow | iOS pipeline config exists; no GitHub Actions workflow found; latest run status unknown |

## Functional Inventory

| Domain | Evidence | Classification | Remaining proof |
| --- | --- | --- | --- |
| Auth and account identities | Auth routes, `AuthAccount`, `AccountIdentity`, company/consumer/fashion identities | PARTIAL | Admin MFA/password/session hardening and full role/tenant negative tests |
| B2B buyer and checkout | Catalog, cart, checkout, quote/RFQ, order, invoice, payment routes | PARTIAL | Full sandbox transaction, refund, and buyer browser journey |
| Consumer retail | Consumer store/cart/checkout/account/wishlist views and Consumer API | PARTIAL | Consumer E2E and payment/account isolation |
| Merchant operations | Merchant portal, products, customers, inventory, orders, POS, procurement, production, finance | PARTIAL | End-to-end side-effect and recovery tests per module |
| Partner and commission | Partner portals, Referral/Campaign routes and commission ledger | PARTIAL | Production role hierarchy, payout/reconciliation and all ownership combinations |
| Growth OS | Mission, worker, CRM follow-ups, campaign/channel registry and metrics | PARTIAL | Authorized channel execution and real attribution-to-paid-order loop |
| AI Employee/ModaGPT | Provider routing, constrained tools, tasks, drafts, knowledge, creative, approvals | PARTIAL | Real provider/credit/restart and complete workflow validation |
| Billing | Stripe subscription checkout/webhook and selected credit-ledger consumers | PARTIAL / fail-closed by default | Stripe Test/Live acceptance, tax, refund/reconciliation, migration state |
| Fashion Community/Tik | Feed, media, identity, reaction/follow/comment, moderation | PARTIAL | Target migration/import/CDN/storage and account journey |
| Backup/DR | Database/media backup, cloud sync, Cloud SQL drill code | PARTIAL | Current backup restore drill and measured RPO/RTO |
| Flutter | Many module directories and native plugins | CODE_PRESENT / UNKNOWN | Analyzer, unit tests, API/auth/payment/device smoke |
| Fashion Ingestion | Authorized-source management, collection, de-dup, moderation | PARTIAL; AI analyzer MOCK | Live authorized-source run and actual classifier acceptance |

## Test and Evidence Inventory

`package.json` defines `npm run test:unit`, PostgreSQL integration commands, `npm run test:e2e`, build/lint, migration, backup and smoke commands. The integration suite files cover P0 HTTP/webhooks, Growth CRM, Partner/commission, ModaGPT Brain/task/quote/Billing. This audit did not execute them. Historical test results remain historical; no result is promoted to `Released` by this audit.

## Known Security Finding

Admin login currently permits password-only authentication when TOTP is not enabled. Admin password change has a lower minimum than merchant password change. Admin IP allowlist parsing is exact-match and an empty parsed list is treated as allowed; the production startup gate checks that the env string is non-empty but does not validate parsed IP entries. Prior credential exposure makes immediate credential rotation and a closed allowlist gate P0.

# 12 Developer Platform Architecture

**Snapshot:** 2026-10-06. Internal service routes and SDK dependencies do not constitute a supported external developer platform.

## Current State

- Main API is implemented through Express routes in `server.ts` and internal modules under `src/server/`.
- Integrations exist for payment, AI, social/media, identity and object storage; selected environment names are in `.env.example`.
- No public versioned API spec, client SDK release process, developer portal, app install/consent lifecycle or webhook subscription product was established in this audit.
- Flutter and Capacitor clients are first-party applications, not proof of third-party API stability.

## Target Developer Platform Components

| Component | Contract |
| --- | --- |
| Public API | `/v1` versioning, stable schemas, pagination, idempotency, error model and deprecation window |
| Identity | OAuth 2.1/OIDC, PKCE for user clients, service credentials for servers, scoped consent and revoke |
| Tenant installation | App owner, merchant grant, environment, callback verification, scope review and uninstall cleanup |
| Webhooks | Signed events, event IDs, retries, delivery receipts, replay/test tools and endpoint rotation |
| SDK/docs | Generated, tested clients; examples; changelog; sandbox; status and support policy |
| Marketplace | Review, privacy disclosure, security scan, permission prompts, pricing, version/rollback and removal |
| Operations | Quotas, abuse detection, observability, incident contact and SLA per plan |

## API Readiness Gaps

- Inventory routes and split public/private/admin/merchant/webhook surfaces before exposing any.
- Replace implicit response shapes with versioned OpenAPI schemas and contract tests.
- Normalize authentication errors, validation, pagination, rate limit headers, request IDs and retryable errors.
- Add idempotency contract to all external writes and stable request tracing.
- Avoid exposing internal employee, admin, AI memory, billing or database-admin routes.
- Add client credentials rotation and immediate revocation; never issue a shared static API key without tenant/scope restrictions.
- Add per-tenant quotas and data-export/delete endpoints with verified authorization.

## Readiness Gate

A public API release requires a named product contract, threat model, schema compatibility CI, sandbox fixtures, SDK tests, key rotation/revoke, webhook replay tests, tenant-isolation tests, published limits and support/incident ownership. Until those pass, label existing APIs internal and unstable.

# 05 Identity and Permission Audit

**Snapshot:** 2026-10-06. This is an audit baseline, not a claim that the complete API matrix is tested.

## Existing Identity/Role Evidence

- `AccountIdentity` / `AuthAccount` support shared credentials and role-specific accounts.
- Separate models/flows exist for Consumer, Company, Merchant, MerchantEmployee, Partner, and Fashion creator identities.
- Merchant endpoints commonly derive merchant scope from authenticated session and use `requireMerchantTenant` plus employee permission guards.
- Admin APIs use `requireAdminAuthAndIpWhitelist`; selected writes add `requireAdminPermission`.
- AI tools/task runtime carry tenant, actor, tool allowlist, approvals and audit metadata for selected workflows.

This is a multi-role foundation, but the repository does not prove a universal `Organization / Membership / Resource / Scope` model for arbitrary users managing multiple brands, stores, partner organizations and future industry tenants.

## Principal × Resource Baseline

| Principal | Tenant resolution | Allowed scope baseline | Required denial cases |
| --- | --- | --- | --- |
| Buyer | Authenticated buyer/company identity | Public catalog; own cart/order/quote/account | Read/change another buyer's order, invoice, quote or address |
| Consumer | Consumer auth identity/token | Own consumer profile, order, wishlist and retail checkout | Access B2B buyer, merchant or another consumer data |
| Merchant owner | Server-authenticated merchant account | Own merchant products, orders, customers, inventory and settings | Change merchantId in URL/body to reach another merchant |
| Merchant employee | Employee session + merchantId + granted permissions | Only resources/actions permitted by current employee role/grants | Use revoked permission, wrong merchant, or owner-only action |
| Partner | Authenticated Partner + server-computed hierarchy scope | Own referrals/campaigns/commissions and explicitly delegated children | Access another Partner or platform-wide finance/customer records |
| Platform admin | Admin JWT + current IP policy + permission | Explicitly authorized platform operation | No permission, wrong IP, stale/forged token, hidden cross-tenant write |
| AI Employee | Active installation + merchant tenant + tool-specific permission | Allowlisted bounded tools; write tools require existing approval | LLM-supplied tenant/resource/permission, uninstalled role, revoked grant |
| Background worker | Persisted task tenant/actor/lease | Task payload's server-approved capability scope | Stale lease, duplicate side effect, task tenant mismatch |
| Provider webhook | Provider identity/signature + event/resource reference | Update only matching provider-owned transaction | Invalid signature, replay, order/payment mismatch, amount/currency mismatch |

## Permission and Capability Matrix

| Capability | Expected permission boundary | Read/write | Approval | Current test coverage |
| --- | --- | --- | --- | --- |
| Product catalog | `product.catalog.read` / merchant ownership | Read | No | AI/product unit coverage; full route matrix not proven |
| Product publish | `product.publish` / merchant ownership and lifecycle | Write | Required on selected AI workflows | Workflow tests exist; all UI/API paths not mapped |
| Inventory | `warehouse.pick`, `warehouse.review`, `inventory.stock.read` | Read and selected adjustments | State/business guard; AI tool is read-only | Inventory/employee tests; cross-route matrix partial |
| Sales summary | `sales.summary.read` / merchant tenant | Read only | No | AI sales tests; production freshness not established |
| POS sale | `sales.order.create` / active shift | Write | Payment confirmation depends on method | POS unit/E2E file exists; E2E not run here |
| Return/refund | `return.manage` plus order/payment ownership | Write | Finance/provider workflow-specific | Refund tests and webhook integration partial |
| Employee management | `employees.manage` / own merchant | Write | Admin catalog approval is separate | Employee permission tests exist |
| AI creative | `employees.manage` + `product.creative.generate` + consent/entitlement | External generation/private draft | Merchant review; attach is explicit | Creative/provider tests exist; live provider unknown |
| Admin integrations | `settings.integrations` / admin + IP | Secret config/write | High-risk settings audit | Provider settings tests; all settings not exhaustive |
| Database operations | `settings.database`; backup delete has extra permission | Read/write/destructive | Exact confirmation for sensitive actions | Database-admin tests; production restore not demonstrated |
| Growth/Partner admin | `settings.ai_support`, `settings.integrations`, `growth.partners` as route-specific | Read/write | Mission/review rules | P0 integration covers selected routes only |

## Current Security Findings (P0)

1. `ADMIN_IP_WHITELIST` is split on commas and exact-matched. The guard treats an empty parsed list as allow-all. Startup checks the raw env string is non-empty, so comma/whitespace content can pass the raw check but parse to empty. Production must fail closed on invalid/empty parsed values.
2. Admin TOTP is optional: login enforces OTP only when a persisted TOTP record is already enabled. Define and enforce production MFA policy.
3. Admin password change allows a 6-character minimum while merchant password change requires 12. Strengthen admin policy and test it.
4. Password change does not itself revoke existing stateless admin JWTs. Add token version/revocation or rotate the signing secret in incident response.
5. A production admin login with weak credentials succeeded once in prior session output, and authentication material was exposed in conversation history. Rotate affected credentials/signing secrets immediately and audit active sessions.
6. Auth rate limit is per IP/path and permits 30 attempts per 15 minutes; consider stricter admin-specific limits, progressive delay and alerting. Do not lock out shared accounts solely by username.

## Required Negative Test Matrix

- Unauthenticated principal → every protected API returns the expected 401.
- Authenticated wrong role → 403; admin without named permission → 403.
- Merchant A → Merchant B object IDs on every read/write route → denied with no side effect.
- Employee with read-only grant → write denied; after permission revoke, old task/tool invocation denied.
- Partner A → Partner B referral/customer/campaign/commission → denied.
- Webhook invalid signature, replayed event, mismatched provider/payment/order/amount/currency → no duplicate or cross-resource update.
- AI model returns tenant/resource/permission escalation → ignored/rejected by server.
- Stale/expired worker lease or canceled task → no write after lease/cancel boundary.
- Audit/outbox failure on transactional action → business mutation rolled back or explicitly quarantined; never false success.
- Empty/invalid admin IP list in production → startup fails; valid configured address works through the actual proxy chain.
- Password changed / admin disabled / secret rotated → old tokens invalidated within documented incident SLA.

## Completion Gate

The API inventory must enumerate every route, principal, permission, tenant source, resource owner check, state mutation, audit/outbox, and test file. Route declarations alone are not sufficient. Mark the matrix released only when the negative suite runs against an isolated PostgreSQL database and the intended staging identity/proxy configuration.

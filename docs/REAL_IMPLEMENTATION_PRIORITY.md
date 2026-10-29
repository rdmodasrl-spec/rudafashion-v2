# Real Implementation Priority

## 1. 修正原则

这份 Priority 必须遵循以下规则：

- 目标不是把一个半成品从 0 重新做成完整平台
- 目标是对一个已经基本完成的大型系统做：
  - Reality Verification
  - Gap Detection
  - Targeted Fix
  - Test
  - Hardening
- 不能机械地要求每个功能都必须同时具备 UI + API + DB + Auth + Test + Operational proof
- 必须区分：
  - Implementation 状态
  - Verification 状态

## 2. 实现状态 vs 验证状态

### 2.1 Implementation 状态

- IMPLEMENTED
- PARTIAL
- UI_ONLY
- API_ONLY
- DB_ONLY
- MOCK
- MISSING
- BROKEN

### 2.2 Verification 状态

- VERIFIED
- TESTED
- INTEGRATION_VERIFIED
- PRODUCTION_VERIFIED
- UNVERIFIED

### 2.3 关键规则

- UNVERIFIED 不是 PARTIAL
- UNVERIFIED 只表示“没有完成验证”
- 如果功能已存在，并且有合理架构实现，则应保留为 IMPLEMENTED，并单独标注 Verification = UNVERIFIED
- 只有当功能实际不存在、或实现确实损坏、或业务链路无法成立时，才标记为 MISSING / BROKEN / PARTIAL

## 3. P0 重定义：不是重新开发，而是“已存在的系统中哪些地方会造成严重事故”

### P0-A: ALREADY SAFE

代码和流程已经存在，而且未发现明显风险。

Action:

- KEEP
- VERIFY

### P0-B: NEEDS TEST

功能已经存在，但缺少关键验证。

Action:

- TEST
- VERIFY

### P0-C: NEEDS HARDENING

功能存在，但存在安全、consistency、retry、idempotency 或权限风险。

Action:

- FIX
- HARDEN

### P0-D: ACTUALLY MISSING

真正不存在，需要补齐。

Action:

- BUILD

---

## 4. Real Priority Matrix

| Priority | Domain | Implementation | Verification | Risk | Real gap | Action |
| --- | --- | --- | --- | --- | --- | --- |
| P0-A | Admin auth and fail-closed controls | IMPLEMENTED | UNVERIFIED | Critical | Need verify auth fail-closed; may need hardening, not rebuild | VERIFY / FIX |
| P0-A | Store / tenant / merchant / partner access boundaries | IMPLEMENTED | UNVERIFIED | Critical | Route-level isolation needs proof | VERIFY / HARDEN |
| P0-A | Payment and transaction flow | IMPLEMENTED | UNVERIFIED | Critical | Business correctness and idempotency must be checked, not reimplemented | VERIFY / FIX |
| P0-A | Backup / recovery / migration automation | IMPLEMENTED | UNVERIFIED | Critical | Already has scripts; real recovery proof missing | VERIFY |
| P0-B | AI provider abstraction and routing | IMPLEMENTED | UNVERIFIED | High | Provider is present, but production call path not proven | TEST / VERIFY |
| P0-B | AI task queue / retry / cost tracking | IMPLEMENTED | UNVERIFIED | High | Existing flow likely works in principle but needs operational proof | TEST |
| P0-B | POS operational ledger and reconciliation | IMPLEMENTED | UNVERIFIED | High | May already exist; needs reconciliation validation | TEST |
| P0-C | Finance ledger / settlement / payout integrity | IMPLEMENTED | UNVERIFIED | Critical | Need identify state mismatches, duplicate webhooks, refund/commission sync gaps | FIX |
| P0-C | AI tool permissions / approval gate | IMPLEMENTED | UNVERIFIED | Critical | Need permission checks and approval enforcement proof | FIX |
| P0-C | Marketing consent + attribution + ROI | IMPLEMENTED | UNVERIFIED | High | Need consent guarantees and conversion attribution proof | FIX / TEST |
| P1 | Partner commission + referral + settlement | IMPLEMENTED | UNVERIFIED | High | Needs real payout and reconciliation verification | VERIFY / FIX |
| P1 | Commerce checkout + order + return/refund loop | IMPLEMENTED | UNVERIFIED | High | Must verify order lifecycle and refund state integrity | TEST |
| P1 | Merchant ops inventory / supplier / purchase flow | IMPLEMENTED | UNVERIFIED | High | Must test stock movement and inventory consistency | TEST |
| P1 | CRM / audience / campaign / email / SMS / push | IMPLEMENTED | UNVERIFIED | Medium-High | Consent and delivery proof required | TEST |
| P1 | Marketplace listing + order routing + settlement | IMPLEMENTED | UNVERIFIED | High | Route and settlement closure must be verified | TEST |
| P2 | Developer API ecosystem | PARTIAL | UNVERIFIED | Medium | OAuth / SDK / rate limits need platform maturity | COMPLETE / BUILD |
| P2 | App marketplace / public integrations | MISSING | UNVERIFIED | Medium | Not current product, likely future scope | MISSING — BUILD only if in scope |
| P2 | Global compliance expansion | PARTIAL | UNVERIFIED | Medium | Tax / timezone / region / GDPR logic requires compliance proof | VERIFY / COMPLETE |
| P2 | Advanced recommendation / forecasting | PARTIAL | UNVERIFIED | Medium | May be future enhancement, not emergency fix | KEEP / VERIFY |

## 5. 真实 P0 细化

### P0-1 Security

Not: 重做 Admin

Instead:

- 验证 Admin login、MFA、allowed IP、session revoke、password policy
- 只修存在的漏洞
- 只在 fail-closed 证据缺失时改代码

Action:

- VERIFY / FIX

### P0-2 Tenant isolation

Not: 重做 Multi-tenant

Instead:

- 检查 tenant/store/merchant/partner/agent access paths
- 查出是否存在越权或过度共享
- 只修实际存在的访问漏洞

Action:

- VERIFY / HARDEN

### P0-3 Finance

Not: 重做 Payment / Ledger

Instead:

- 检查 Payment → Payment Intent → Webhook → Transaction → Order → Ledger → Refund → Commission → Settlement → Payout → Reconciliation
- 找出重复、错账、状态错误、Webhook 重放问题
- 只修这部分，不重写整个 finance 系统

Action:

- VERIFY / FIX

### P0-4 Backup

Not: 重做 backup

Instead:

- 检查现有 predeploy backup、recovery drill、restore、migration、startup flow
- 如果已有，进行恢复验证和失败模式验证
- 真缺失才补

Action:

- VERIFY / COMPLETE

## 6. 真实的执行优先级（不按重做）

### 1. KEEP

以下内容已经存在，并且没有明显风险：

- 基础架构
- 商品/商户/订单框架
- AI 工作流骨架
- 备份/恢复脚本

### 2. VERIFY

以下内容已有实现，但缺少真实验收证据：

- Admin security controls
- tenant isolation
- payment flow
- AI provider path
- POS close/reconciliation
- backup recovery

### 3. HARDEN

已存在但潜在风险明显：

- fail-closed auth
- multitenant access controls
- AI tool permissions
- financial ledger integrity
- consent + attribution flows

### 4. COMPLETE

主干已存在，只缺关键闭环：

- checkout flow
- order/refund loop
- partner settlement
- campaign attribution
- developer API platform

### 5. REPLACE MOCK

真实功能存在，但 mock 仍在用：

- Fashion Ingestion AI provider

### 6. MISSING

真正缺失：

- public OAuth / full API ecosystem
- marketplace disputes
- complete accounting export
- some advanced compliance / public developer infrastructure

### 7. BROKEN

有明确错误，需要修复：

- admin fail-open risk
- unsafe cross-tenant access if present
- financial state machine issues if confirmed

## 7. 不能放到这个阶段的工作

以下内容在本阶段不应作为主目标：

- 重写 server.ts
- 重构 Prisma schema
- 重做 Payment
- 重做 AI
- 重写 Marketing
- 重做 POS
- 重做 Partner / Agent / Marketplace
- 重新开发整个 monolith

除非审计明确证明这些实现已经 BROKEN，并且最小修复方案不能在现有代码中完成。

## 8. 结论

在当前项目中，最重要的不是“重新开发一个完整平台”，而是：

- 区分“已经存在”与“已经通过验证”
- 区分“主体存在”与“生产闭环完成”
- 识别真实缺失并只补最小缺口
- 对已存在但未验证的系统执行测试与硬化

所以这份 Priority 的正确方向是：

- KEEP
- VERIFY
- TEST
- HARDEN
- COMPLETE
- REPLACE MOCK
- BUILD ONLY IF MISSING

不是：

- 重新构建一套全新平台

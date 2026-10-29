# ModaUI 套餐目录契约

状态：已上线（2026-10-27；生产商家接口 200，返回 5 个套餐）

## 1. 问题与目标

商家端 `GET /api/merchant/modagpt/plans` 返回 500 `MODAGPT_BILLING_PLAN_CONFIG_INVALID`，导致“套餐与额度”无法展示任何套餐。目标是让目录接口稳定返回当前计费代码真正支持的套餐，同时不改变价格、额度或购买状态。

## 2. 根因

- 迁移 `20261020140000_ab_partner_subscription_commissions` 预置了 `PLUS_YEAR`、`PRO_YEAR`、`BUSINESS_YEAR` 三个年度套餐，均为 `interval=year`、`purchaseEnabled=false`。
- 权威套餐代码 `modaGptPlanCodes` 仅包含 `FREE / PLUS / PRO / BUSINESS / FASHION_PRO` 五个月度套餐。
- `serializePlanCatalogItem` 对任何不在代码清单内或 `interval != month` 的行抛错；目录接口对整个结果集 `map`，因此一条年度预置数据使全部套餐失败。
- 生产核对：年度套餐订阅数为 0；五个月度套餐当前 `purchaseEnabled=false`。不存在真实年度订阅依赖。

## 3. 非目标

- 不实现年度套餐购买、续费、按年计费或 proration。
- 不修改数据库价格、额度、`purchaseEnabled/status`，不删除年度套餐行。
- 不改变 Stripe/支付集成状态判定。
- 不修改后台套餐编辑接口的字段语义。

## 4. 复用与数据归属

- 权威数据表：`ModaGptBillingPlan`。
- 权威代码清单：`src/server/modagptBilling.ts` 的 `modaGptPlanCodes`。
- 复用既有 `loadModaGptBillingCatalog`、`serializePlanCatalogItem`，不新增第二套目录服务。
- 年度套餐仍是数据库中的预留数据，待计费能力正式支持后再扩展代码清单与序列化契约。

## 5. API 契约

`GET /api/merchant/modagpt/plans`（商家会话）：

- 仅返回 `status=active` 且 ID 属于 `modaGptPlanCodes` 的套餐。
- 当前为五个 EUR 月度套餐，按 `monthlyPriceMinor`、`id` 升序。
- 每个套餐仍返回 `id/displayName/monthlyPriceMinor/currency/interval/status/purchaseEnabled/featured/recommended/monthlyCredits/rolloverPolicy/expirationPolicy/featureEntitlements/usageLimits/version`。
- 响应仍包含 `provider`、`subscription`、`creditBalance`、`enabledFeatures` 等既有字段。
- 不在清单内的行不会使接口失败，也不会出现在响应中。

`GET /api/admin/modagpt/billing/catalog`（管理员会话）：

- 同样仅加载 `modaGptPlanCodes` 内的套餐，避免年度预置数据导致后台目录 500。
- 后台编辑仍按套餐 ID 操作；当前不支持编辑或启用年度套餐。

## 6. 错误与兼容

- 目录内受支持套餐若字段非法（币种、价格、interval、额度、权益 JSON），仍返回 `MODAGPT_BILLING_PLAN_CONFIG_INVALID`，不得静默忽略损坏的正式套餐。
- 年度套餐不属于当前正式目录，过滤是契约行为，不是错误吞噬。
- 后续若要上线年度套餐，必须先扩展 `ModaGptPlanCode`、结账周期、订阅周期与前端文案，并新增 ADR/契约变更，不能只放开过滤。

## 7. 测试与验收

| 项目 | 命令 / 方式 | 结果 |
|---|---|---|
| 定向计费测试 | `node --import tsx --test tests/modagpt-billing.test.ts` | 9/9 通过（含目录 `where` 限定与年度占位行拒绝） |
| 全量单元测试 | `npm run test:unit` | 966/966 通过 |
| 类型检查 | `npx tsc --noEmit -p tsconfig.json` | EXIT 0 |
| 真实目录读取 | `loadModaGptBillingCatalog(prisma)` | 5 条：`FREE, PLUS, PRO, BUSINESS, FASHION_PRO` |
| 管理端查询同路径 | `findMany({ where: { id: { in: modaGptPlanCodes } } })` + `serializePlanCatalogItem` | 5 条全部序列化通过 |
| 生产商家接口 | `GET https://ruda.fashion/api/merchant/modagpt/plans`（真实商家会话） | **200**，5 个套餐，无 `MODAGPT_BILLING_PLAN_CONFIG_INVALID` |
| 管理端鉴权 | 未登录 `GET /api/admin/modagpt/billing/catalog` | **401 `ADMIN_AUTH_REQUIRED`**（路由正常，未绕过鉴权） |
| UI 目录 | 生产手机端 390×844 打开“套餐与额度” | 5 档套餐完整渲染，`五档套餐` 标题正常，无 500 |


## 8. 发布与回滚

- 2026-10-27 全站发布：六个前端应用重建并激活，服务端 `dist/server.cjs` 重建；无数据库迁移、无数据变更。
- 发布状态备份：`release/deploy-state/20261027T042539/`（旧 `server.cjs`、source map 与六个 `current.json`）。
- 商家手机端 release：`20261027032557941-e7a339d8`；商家 Web release：`20261027032548102-b180f0f5`。完整发布记录见 `docs/engineering/deployments.md`。
- 回滚：恢复 `src/server/modagptBilling.ts` 与 `server.ts` 中目录查询条件并重建服务端即可；前端无需回滚。服务端可直接 `cp release/deploy-state/20261027T042539/server.cjs.prev dist/server.cjs && ./node_modules/.bin/pm2 restart ruda-fashion`。

# 模块规格：RUDA 智能生产链（外发加工记账与月度结算）

- 模块 ID：`production-chain`
- 状态：**部分完成（代码、迁移与自动化测试已验证；真实登录态视觉验收、生产库迁移与发布待执行）**
- 应用标识：`ruda-production-chain`，运行时版本 `1.0.0`，免费、需商家在应用商店自主安装
- 主要代码：`prisma/schema.prisma`、`prisma/migrations/*_production_chain_*`、`src/server/productionChain.ts`、`server.ts`（路由注册与安装门禁）、`src/apps/merchant-admin-common/components/merchant/ProductionChain.tsx`、`src/apps/merchant-admin-common/components/merchant/ProductionFactoryWorkspace.tsx`
- 关联文档：`docs/app-store-ecosystem.md`、`docs/engineering/architecture.md`、`docs/engineering/module-registry.md`

## 1. 问题与目标

RUDA 商家的真实外发加工流程是：商家自己裁好布料和裁片 → 合作工厂上门取货 → 工厂加工 → 工厂送回 → 商家验收 → 月底按工厂统一核算加工费。

现有代码库只有「单 SKU 内部生产工单」（`ProductionWorkOrder` + `ProductionReport`），不能表达外部工厂、多 SKU 加工单、分批取货/送货、双方确认和**按工厂+月份**的月度结算。v1 生产链原型引入了 BOM、发料、耗用、工序进度和按单对账，超出真实业务复杂度，本轮删除。

目标：做一个**可安装/可停用的服装加工记账与月度结算应用**，把「加工单 → 取货 → 加工 → 送货验收 → 月度对账 → 付款」连成一条双方可在单据内直接沟通的闭环。

### 非目标（明确不做）

- 不做工厂 ERP：不做面料 BOM、发料/耗用、设备、工人排班、复杂工序路线。
- 不做原材料采购、仓库库位管理和自动入库。
- 不新建商品、SKU、供应商、员工、认证、消息系统。
- 不做银行/支付机构自动扣款；付款仅登记已发生的事实。
- 不做独立 App 运行面/小程序；工厂使用同一商家端构建中的受限工作区。
- 不提供 AI 自动确认账单或自动付款。

## 2. 复用审计与防重复结论

| 能力 | 现有实现 | 复用方式 |
|---|---|---|
| 应用目录与安装 | `App` / `AppCategory` / `AppInstallation`、`/api/app-store/*` | 直接复用；本应用只在 `appStoreNativeRuntimes` 登记运行时 |
| 商品与 SKU | `Product`、`ProductVariant`、`/api/merchant/*` | 加工单只存 `productId` / `variantId` 与下单时快照（款号、图片、SKU 文本、单价） |
| 商家身份/权限 | `requireMerchantTenant`、`requireEmployeePermission`、`EmployeeAuditLog` | 复用会话与 `production.view/manage/cost.view` 权限 |
| 加工厂协作方 | 无现有等价模型（`Supplier` 是采购往来对象） | 新建 `ProductionFactory` + 成员 + 一次性邀请令牌；不复用登录体系，工厂令牌独立签发 |
| 工厂登录 | 无 | 仅工厂成员可登录受限工作区；JWT 由 `deps.jwtSecret` 签发，7 天有效，撤销即失效 |
| 沟通 | 现有消息中心面向商家/客户，不承载工厂协作 | 单据内留言表 `ProductionMessage`（订单/结算单范围），不新建聊天系统；后续可接入统一消息中心 |
| PDF | 现有前端 `window.print()` 方案 | 结算单使用独立打印窗口「打印 / 保存为 PDF」，不新增服务端 PDF 依赖 |
| ModaGPT | `modagptMerchantTools` | 本期不注册写工具；只读工具列在后续阶段 |

结论：除加工厂协作主体、单据留言与月度结算外，全部复用现有能力；没有第二套商品/员工/认证/文件系统。

## 3. 应用安装与运行时门禁

- 目录应用 `ruda-production-chain`，分类 `manufacturing`，免费，`status=published`，运行时版本 `1.0.0`。
- 商家接口：`merchantAuth → requireProductionAppInstalled → employeePermission`。未安装或停用返回 `403 PRODUCTION_APP_NOT_INSTALLED`。
- 工厂接口：工厂 JWT → 校验成员/工厂状态 → 校验该商家安装仍为 `active` 且应用已发布，否则 `403 PRODUCTION_FACTORY_ACCESS_REVOKED`。
- 停用/卸载不删除 `Production*` 历史数据；卸载只影响 `AppInstallation`。数据清理是独立治理动作。

## 4. 业务流程与状态机

### 4.1 加工单（ProductionOrder）

商家选择 RUDA 商品与颜色/尺码矩阵，填写加工厂、每件加工费、取货日期、预计交货日期。

状态：`draft → pending_factory → accepted → in_production → completed`，任意未完成状态可 `cancelled`。

- `draft`：商家可改；`pending_factory`：已发送，等工厂接单。
- 工厂接单 → `accepted`；工厂开始加工（或首次送货）→ `in_production`。
- 所有 SKU 的验收合格数量 ≥ 计划数量 → 自动 `completed`。
- 取消/完成均保留全部取货、送货、验收、结算、留言记录。

### 4.2 取货（ProductionPickup）

商家登记取货：日期、裁片件数、包数、备注。工厂登录后确认实际收到件数；差异 = 实收 − 登记，保留记录，不阻止后续流程。

### 4.3 送货与验收（ProductionDelivery / ProductionDeliveryItem）

工厂按 SKU 登记送回数量（可分批，不得超过未送数量）。商家逐 SKU 验收：实收、合格、不合格、返工；短少由「送货数量 − 实收」自动计算。一张送货单只能验收一次（幂等）。验收后累加订单明细的已送/合格/不合格/返工/短少数量。

### 4.4 月度对账（ProductionStatement）

按「加工厂 + 月份」生成结算单，行按加工单汇总（款号、数量、金额），明细保存在 `breakdown` JSON。

- 计费口径：仅计入**已验收**送货单中的**合格数量**，单价取加工单 SKU 单价。
- 防重复：验收明细上的 `statementId` 一经占用即锁定；同一送货明细不能进入第二张结算单。
- 期初未结：取该工厂**上一张已确认结算单**的期末未结；没有则为 0。
- 本期新增：Σ（合格数量 × 单价）+ 商家调整金额。调整必须填写原因。
- 本期付款：生成结算单时归集该工厂尚未分配、且付款日期 ≤ 期末的付款记录。
- 期末未结 = 期初未结 + 本期新增 + 调整 − 本期付款。
- 状态：`draft → pending_factory → confirmed`；工厂可 `disputed`（填写差异原因），商家修改调整后可重新提交。
- 已确认结算单不可改金额或删除；后续差异通过下一期「调整」处理，历史保留。

### 4.5 付款（ProductionPayment）

商家登记付款日期、金额、方式、凭证说明，可关联结算单；未关联付款计入下一张结算单。付款幂等键唯一；累计付款不得超过该结算单「期初未结 + 本期新增 + 调整」。

### 4.6 单据沟通（ProductionMessage）

每张加工单、每张结算单都有双方可见的留言流。商家与工厂可在链上留言直到结束；读取时标记已读。留言不改变业务状态。

## 5. API 契约（全部返回 `{ success: true, ... }`；错误 `{ success:false, error }`）

商家（需安装 + 权限）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/production/catalog` | 商品（含 SKU/图片）、加工厂 |
| GET | `/api/production/summary` | 首页：本月加工金额、待确认账单、本月已付、未结、待处理加工单 |
| GET/POST | `/api/production/orders` | 列表/新建加工单（服务端计算数量与金额） |
| GET/PUT | `/api/production/orders/:id` | 详情（取货/送货/验收/留言）/仅草稿可改 |
| POST | `/api/production/orders/:id/submit`、`/cancel` | 提交工厂 / 取消 |
| POST | `/api/production/orders/:id/pickups` | 登记取货 |
| POST | `/api/production/orders/:id/deliveries/:deliveryId/inspect` | 逐 SKU 验收（一次性、幂等） |
| GET | `/api/production/deliveries` | 待验收 / 已验收送货单 |
| GET/POST | `/api/production/messages` | 读取 / 发送单据留言（`scopeType=order\|statement`） |
| GET/POST | `/api/production/statements` | 结算单列表 / 生成月度结算单 |
| GET | `/api/production/statements/:id` | 结算单详情（行/调整/付款/留言） |
| POST | `/api/production/statements/:id/adjustments` | 添加调整（草稿或争议状态） |
| POST | `/api/production/statements/:id/submit` | 商家确认并发送工厂 |
| GET/POST | `/api/production/payments` | 付款列表 / 新增付款（可关联结算单） |
| GET/POST | `/api/production/factories` | 工厂列表 / 新建并签发邀请 |
| POST | `/api/production/factories/:id/invite`、`/revoke` | 轮换邀请 / 撤销 |

工厂（JWT）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/production/factory/accept-invite`、`/login` | 接受邀请 / 登录 |
| GET | `/api/production/factory/me` | 工厂会话信息 |
| GET | `/api/production/factory/orders`、`/orders/:id` | 自己的加工单 |
| POST | `/api/production/factory/orders/:id/accept`、`/start` | 接单 / 开始加工 |
| POST | `/api/production/factory/pickups/:id/confirm` | 确认实收裁片 |
| POST | `/api/production/factory/orders/:id/deliveries` | 登记送货 |
| GET | `/api/production/factory/statements`、`/statements/:id` | 月度结算单 |
| POST | `/api/production/factory/statements/:id/confirm`、`/dispute` | 确认 / 提出差异 |
| GET/POST | `/api/production/factory/messages` | 留言（`scopeType=order\|statement`） |

错误码（实现值）：`PRODUCTION_APP_NOT_INSTALLED`、`PRODUCTION_INPUT_INVALID`、`PRODUCTION_ORDER_NOT_FOUND`、`PRODUCTION_ORDER_NOT_EDITABLE`、`PRODUCTION_ORDER_STATUS_INVALID`、`PRODUCTION_ORDER_NOT_CANCELLABLE`、`PRODUCTION_DELIVERY_EXCEEDS_PLANNED`、`PRODUCTION_DELIVERY_ALREADY_INSPECTED`、`PRODUCTION_INSPECTION_INVALID`、`PRODUCTION_PICKUP_ALREADY_CONFIRMED`、`PRODUCTION_STATEMENT_CONFIRMED`、`PRODUCTION_STATEMENT_CONFLICT`、`PRODUCTION_STATEMENT_STATUS_INVALID`、`PRODUCTION_PAYMENT_EXCEEDS_OUTSTANDING`、`PRODUCTION_PAYMENT_CONFLICT`、`PRODUCTION_PAYMENT_DUPLICATE`、`PRODUCTION_FACTORY_AUTH_REQUIRED`、`PRODUCTION_FACTORY_AUTH_INVALID`、`PRODUCTION_FACTORY_ACCESS_REVOKED`、`PRODUCTION_FACTORY_INVITE_INVALID`、`PRODUCTION_FACTORY_INVITE_EXPIRED`、`PRODUCTION_FACTORY_MEMBER_EXISTS`。

## 6. 数据归属与一致性

- 所有金额 `Decimal(14,2)`、单价 `Decimal(12,4)`；服务端四舍五入，前端不自行入账。
- 加工单金额 = Σ(SKU 数量 × 单价)；结算单金额以结算行、调整与付款的数据库记录为准。
- 送货/验收/结算写入在同一事务内更新累计数量与锁定关系，并使用条件更新防并发超额。
- 应用停用/卸载不删除业务数据；结算单确认后不可修改。

## 7. 权限

| 权限点 | 用途 |
|---|---|
| `production.view` | 查看首页、加工单、取货/送货/验收、结算单、付款 |
| `production.manage` | 建单/改草稿/提交/取消、登记取货、验收、生成结算、调整、确认、付款 |
| `production.cost.view` | 查看单价、金额、付款与未结；缺失时服务端隐藏金额字段 |

工厂成员只看被授权的本工厂单据与结算，不看到商家其他客户/订单/财务。

## 8. UI 范围

- 商家端（Web + 手机共用）：四个主页面「首页 / 加工单 / 对账 / 付款」；加工单详情含取货、送货验收、留言；对账详情含行、调整、付款、确认、打印。
- 工厂端：同一构建内的 `/merchant/factory` 受限工作区（无需商家账号），含登录/接受邀请、加工单列表与详情、取货确认、送货登记、结算确认/差异、留言。
- 黑白中性风格，复用现有按钮/输入/状态标签样式；手机端优先保证取货确认、送货登记、月底对账可单手完成。

## 9. 验收标准

1. 未安装/停用应用时商家接口 403；工厂接口同样被拒绝；历史数据保留。
2. 加工单支持 ≥3 颜色、多尺码矩阵，数量/金额由服务端计算。
3. 工厂只能看到自己的加工单；跨工厂访问 404；跨租户 403。
4. 分批取货、工厂确认实收并记录差异；分批送货，超计划返回 409。
5. 验收一次性、逐 SKU，合格数量计入计费；重复验收 409。
6. 月度结算按工厂+月份汇总；已结算明细不会重复计入下一期；期初/新增/调整/付款/期末计算公式正确。
7. 双方确认后结算单不可修改；争议可留言并重新提交；付款超未结返回 409 且幂等。
8. 商家与工厂均可在单据内留言并看到对方消息。
9. `prisma validate`、单元测试、隔离 PostgreSQL 集成测试、两个商家端构建通过；真实登录态页面验收。

## 10. 迁移、发布与回滚

- 迁移 `20261025190000_production_chain_app`：创建应用目录与 v1 表（历史）。
- 迁移 `20261026120000_production_chain_simplified`：新增取货、月度结算、调整、留言字段与表，删除未上线且从未写入真实数据的 v1 BOM/发料/进度/按单对账表。执行前必须备份；本迁移不可逆恢复被删表的数据（这些表在发布前无生产数据）。
- 回滚：应用层可先停用/下架应用停止使用；结构回滚按数据库备份恢复，不允许只删除安装记录冒充回滚。

## 11. 实施与验证记录（2026-10-25）

已落盘代码：

- 数据模型：`ProductionFactory`、`ProductionFactoryMember`、`ProductionOrder`、`ProductionOrderItem`、`ProductionOrderEvent`、`ProductionPickup`、`ProductionDelivery`、`ProductionDeliveryItem`、`ProductionQualityInspection`、`ProductionStatement`、`ProductionStatementLine`、`ProductionStatementAdjustment`、`ProductionPayment`、`ProductionMessage`。
- 服务端：`src/server/productionChain.ts`（全部商家/工厂路由、条件更新防并发、结算生成与锁定、付款幂等与上限校验、留言范围校验）。
- 商家界面：`src/apps/merchant-admin-common/components/merchant/ProductionChain.tsx`（概览 / 加工单 / 对账 / 付款、取货、验收、调整、付款、留言、打印）；入口仍为应用中心 `ruda-production-chain`。
- 工厂界面：`src/apps/merchant-admin-common/components/merchant/ProductionFactoryWorkspace.tsx`，通过 `/merchant/factory` 进入，两个商家端构建均已在 `main.tsx` 前置分流，不要求商家账号。
- 迁移：`prisma/migrations/20261026120000_production_chain_simplified`。

已实际运行：

| 命令 | 结果 |
|---|---|
| `npx prisma validate` | 通过 |
| `npx prisma migrate deploy`（全新 PostgreSQL 16 容器） | 全量迁移通过，含本迁移 |
| `npx prisma migrate diff --from-url … --to-schema-datamodel` | 过滤 `production` 无差异 |
| `node --import tsx --test tests/production-chain.test.ts` | 8/8 通过 |
| `npm run test:production-chain:integration`（隔离 PostgreSQL） | 1/1 通过：安装门禁、工厂邀请/登录、接单、取货差异、送货、一次性验收、月度结算、争议重提、确认、付款幂等与超额 409、跨工厂 404、跨租户 403、停用后拒绝 |
| `npm run build:app:merchant-admin-web` | 通过（最终 `20261025153100414-1df1a3d9`） |
| `npm run build:app:merchant-admin-mobile` | 通过（最终 `20261025153112803-41cb0dad`） |
| 真实登录态桌面视觉检查（Playwright，1440px） | 商家：登录 → 系统设置 → 应用管理 → 打开「智能生产链」→ 概览 / 加工单详情 / 对账详情；工厂：`/merchant/factory` 登录 → 加工单列表 / 详情（取货、送货、留言）/ 对账。截图位于 `/tmp/prodchain-shots/`（未提交仓库）。 |
| 真实登录态手机视觉检查（Playwright，390×844） | 工厂登录、加工单列表、详情通过；加工单明细表在窄屏横向滚动。商家手机端生产链页面未单独走查。 |

视觉检查发现并修复：工厂密码登录签发的 JWT 误把 `factoryId` 当作 `merchantId`，导致登录成功后接口 403；已在 `signFactoryToken` 调用处修正，并在集成测试中增加「登录 token 调 `/factory/me` 必须 200」的回归断言。

待执行（不冒充完成）：

1. 商家手机端生产链页面的真实登录态走查（本次仅验证工厂手机页面）。
2. 草稿加工单的界面编辑（服务端 `PUT /orders/:id` 已实现，界面暂未提供编辑入口）。
3. 目标环境数据库备份后执行迁移并发布服务端与两个商家端构建，需要用户明确授权。
4. v1 表删除不可逆；若目标库存在意外写入的 v1 数据，迁移不会删除付款/加工单主体，但 BOM/发料/进度/按单对账表将按设计删除。
5. 附件/凭证上传、通知催办、ModaGPT 只读工具未实现。


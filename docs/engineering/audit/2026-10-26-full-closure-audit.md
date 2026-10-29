# RUDA 全项目功能闭环审计（2026-10-26）

- 状态：**审计完成，整改未开始**（本次未修改任何业务代码、未执行数据库变更）
- 审计对象：工作区代码（= 2026-10-26 02:19 已上线的版本，分支 `ui/merchant-miniprogram-premium`，HEAD `9a85ac9`，工作区 1633 个未提交变更）
- 审计方式：只读。代码/路由/Prisma 模型/前端引用交叉核对 + 生产库只读计数 + 线上 HTTP 探测
- 取证命令示例：`grep -oE "'/api/..." server.ts`、`psql "$DATABASE_URL" -Atc "select count(*) ..."`、`curl -I https://modaui.ruda.fashion`

## 0. 结论摘要

1. **商家端营销不是"没开发"**：「经营增长」页面、草稿工作区、AI 文案生成、云端草稿持久化都在，Web 与手机端入口均已挂载。
2. **真正缺的是三件事**：① 商家端没有促销规则的所有权（既不能建、也看不到总后台给自己配的促销）；② 商家端没有任何可用发布渠道（只有平台级 Meta 发布）；③ 推广效果数据没有商家维度，总后台配置也不下发到商家端。
3. **总后台促销与商家端是两套互不相通的东西**：`PromotionRule`（数据库）与商家端 `MerchantWorkspaceDraft.growth`（JSON 草稿）之间没有任何引用关系。
4. **权限存在 P0 缺口**：管理员模拟登录、促销 CRUD、信用往来账读取均只校验"已登录"，不校验权限码。
5. **生产数据几乎为零**：促销 0 条、增长草稿 0 条、AI 用量记录 0 条。多数链路只有代码级证据，**尚不能宣称业务已闭环**。

## 1. 生产现状快照（只读）

| 指标 | 值 | 说明 |
| --- | --- | --- |
| 商家 | 3 | `modaui` / `002` / `ruda-demo-03` |
| 商品 / 订单 / 客户 | 6 / 1 / 3 | 仅够冒烟，不足以验证经营链路 |
| 促销规则 `PromotionRule` | 0 | 从未创建过促销 |
| 商家增长草稿 `MerchantWorkspaceDraft(workspace=growth)` | 0 | 商家端营销从未被真实使用 |
| 素材/面料 `Material` | 0 | 面料库存链路未跑过 |
| 成品库存 `InventoryBalance` | 4 | 仅个别 SKU 有库存行 |
| AI 用量 `ModaGptAiUsageRecord` | 0 | **没有一次成功 AI 调用落库** |
| 订阅 `ModaGptBillingSubscription` | 0 | 收费链路未启用 |
| AI 安装 `MerchantAiEmployeeInstallation` | 6 | 装了但没用量 |
| 通知事件 `NotificationEvent` | 3 | 业务事件接入点有限 |
| 数据模型 / API 端点 | 151 / 496 | 规模已具备，问题在"接缝" |

## 2. 营销推广专项（重点）

### 2.1 总后台入口与能力

- 导航：增长运营 → 增长总览 / 营销归因 / 促销管理
  `src/apps/platform-admin-common/components/admin/adminNavigation.ts:49-57`
- **促销管理**（`AdminPromotions.tsx`，340 行）→ `/api/admin/promotions` 的 GET/POST/PUT/DELETE
  `server.ts:35676 / 35685 / 35762 / 35843`，落库 `PromotionRule`（`prisma/schema.prisma:2400`），
  写入时 `logAudit(... 'PROMOTION_CREATED' ...)`，支持 `scope=sitewide|merchant|category|product` 与 `merchantIds`。
- 促销**在交易侧是真的**：买家结账输码报价 `/api/promotions/quote`（`server.ts:15219` 起），
  下单再次校验并写 `CouponRedemption`（`server.ts:15622` 起），并且按 `merchantIds` 限定（`server.ts:15264 / 15648`）。
  前台入口：`src/apps/shared/components/frontend/CheckoutView.tsx:51-79`。
- **营销活动**（`AdminGrowthCenter.tsx`，1468 行）→ `/api/admin/growth/campaigns*`、`/missions*`、`/crm*`、`/channels`、`/meta*`。
  活动数据存在 **进程内数组 + JSON 文件**（`server.ts:3501` `logs/marketing-campaigns.json`，`3514-3530`），
  **不是数据库表**，也没有 `merchantId` 字段。
- 唯一"真发布"渠道：Instagram / Facebook，走 Graph API 真实请求（`server.ts:13506-14156`），
  前置条件是 Meta OAuth + 主页任务权限 + IG 公开图片 URL，任一不满足即返回明确错误码。

### 2.2 商家端入口与能力

- Web 侧栏：营销增长 / 营销活动 `src/apps/merchant-admin-web/MerchantPortal.tsx:4495-4501`
- 手机端：更多 → 经营增长 `src/apps/merchant-admin-common/components/merchant/merchantMobileNavigation.ts:74`
- 组件：`MerchantGrowthWorkspace.tsx`（541 行），三块：增长概览 / 智能运营 / 营销活动。
- **已接通**：草稿（偏好、战术、活动）通过 `/api/merchant/workspace-drafts` 读写，
  服务端按 `merchantId` 隔离，表 `MerchantWorkspaceDraft` 唯一键 `[merchantId, workspace]`
  （`src/shared/merchantWorkspaceDraftClient.ts`、`prisma/schema.prisma:1546`）。
- **已接通**：AI 文案 → `/api/merchant/assistant/query`（`MerchantPortal.tsx:1651-1668`），
  服务端有 ModaGpt 额度预占与 provider 调用；本机 Ollama 已装默认 reasoning 模型 `qwen2.5:7b`。
- **未接通（UI 已如实提示）**：渠道 Email / Instagram / Facebook / Google Ads / WhatsApp 只是下拉选项，
  发布、投放、发送均无实现；保存时提示"仅保存在此设备，尚未发送或投放"（`MerchantGrowthWorkspace.tsx:424`）。
- **未接通**：商家端 0 处引用 promotion/coupon（全目录 grep 无结果），
  即总后台配了针对该商家的促销，商家在自己的后台看不到、也改不了。

### 2.3 推广链接与二维码

- 链接：`merchantStorefrontOrigin(storeSlug)` → `https://<slug>.ruda.fashion`（`src/shared/merchantStoreUrl.ts:26`），
  UTM 拼接在 `MerchantGrowthWorkspace.tsx:301-311`。线上已验证 `https://modaui.ruda.fashion` → 200，子域路由在服务端按 Host 解析（`server.ts:38969-38975`）。
- 商家 6 位码与二维码：`GET /api/merchants/code/:storeLookupCode` 与 `/qr.png`（`server.ts:14395 / 14424`），
  **前台仅 MerchantFinder 用了查码接口，`qr.png` 在全前端 0 引用**，商家端没有"我的商家码/下载二维码"入口。

### 2.4 推广效果

- 采集：公开上报 `/api/marketing/events` → `GrowthMarketingEvent`（`server.ts:11015-11020`，模型 `schema.prisma:2243`）。
- 该表**没有 `merchantId`**，只有 `source/medium/campaign`；总后台归因 groupBy 也只按这三个维度（`server.ts:12175/12189`）。
- 结果：无法按商家出"访问/点击/询盘/订单"报表；商家端也没有任何效果读取端点。

### 2.5 总后台 → 商家端联动

- 渠道状态 `/api/admin/growth/channels` 只被 `AdminGrowthCenter.tsx:377` 使用，商家端无对应端点。
- 没有"营销功能开关/套餐功能位"校验（`requireMerchantFeature` 类实现不存在），
  即总后台无法按商家启用或关闭营销能力。

### 2.6 营销专项结论

| 需求项 | 现状 | 缺口 |
| --- | --- | --- |
| 总后台配置营销功能/范围/状态 | 促销规则完整；活动为平台级 | 无"商家营销开关"；活动无商家归属 |
| 商家端入口 | 已存在（Web+手机） | 入口有，能力只有草稿 |
| 基于真实商品/价格生成内容 | 已实现（读取商家商品与价格） | 库存未参与（接口未传库存） |
| 智能营销真实调用 AI | 代码已接真实模型链路 | 生产 0 次成功调用，未验证额度/失败路径 |
| 推广发布 | 仅平台级 Meta | 商家端无任何渠道，无审批流 |
| 链接与二维码 | 链接真实；二维码接口有 | 商家端无二维码入口 |
| 客户分享 | 复制链接可用 | 无分享卡片/二维码/WhatsApp 分享 |
| 推广效果 | 全站级 UTM 事件 | 无商家维度、无商家报表 |
| 推广权限 | 草稿按商家隔离（OK） | 促销端点无权限码 |
| 总后台与商家端联动 | 无 | 完全断链 |

## 3. 全模块矩阵（代码级核对结果）

判定口径：
- **A 代码已接通**：入口 + 服务端端点 + 数据表 + 按商家隔离四要素都存在，但**未做线上运行验证**；
- **B 半闭环**：入口在，关键动作写不进真实业务数据；
- **C 仅总后台**：能力只在平台后台，商家端无入口/无端点；
- **D 有后端无入口**：端点存在，前端 0 引用；
- **E 缺数据/缺配置**：需要迁移、外部凭证或产品规则才能闭环。

| 业务域 | 入口 | 服务端 | 数据 | 判定 |
| --- | --- | --- | --- | --- |
| 总后台（平台） | `platform-admin-web/mobile` | 217 个 `/api/admin/*` | 151 模型 | A（权限缺口见 §4） |
| 商家 Web 后台 | `/merchant` | 156 个 `/api/merchant/*` | 按 merchantId 过滤 | A |
| 商家手机端 | `merchant-admin-mobile` | 同上 | 同上 | A |
| 微信小程序 | `miniprogram/`（19 页，含商品创建/购物车/结账） | `utils/api.js` → `API_BASE_URL` | 同上 | A（未在开发者工具验证） |
| 员工工作台 | `MerchantEmployeeMobileApp.tsx` | `/api/merchant/employees*`、`employee-orders`、`employee-picking`、`employee-audit` | `MerchantEmployee`、`EmployeeAuditLog` | A |
| 商品 & SKU | 商家商品页 / 建品表单 | `/api/merchant/products`、`/skus/batch-generate` | `Product` | A |
| 成衣库存 | 商家库存页 / 总后台库存中心 | `/api/merchant/inventory/{balances,movements,adjustments}`、`/api/admin/inventory/*` | `InventoryBalance/Movement` | A（生产仅 4 行） |
| 面料辅料 | 商家面料页 | `/api/merchant/materials`、`material-movements`、`/materials/:id/inbound` | `Material*` | A（生产 0 条） |
| 开单 / POS | `MerchantSmartPos.tsx` | `/api/merchant/pos/{shifts,activity,returns,settings}` | `MerchantPos*` | A |
| 订单 | 商家订单页 | `/api/merchant/orders`（20 个） | `Order` | A |
| 客户 / 供应商 | 往来单位 | `/api/merchant/{customers,suppliers}` | `Customer`/`Supplier` | A |
| 往来账（信用） | **仅总后台** `PlatformAdmin.tsx:473` | `GET /api/admin/credit-ledger/:customerId` | `CreditLedgerEntry` | **C**（商家端无端点、无页面） |
| 商家独立网站 | 子域 `<slug>.ruda.fashion`（线上 200） | `GET /api/merchant/storefront`、Host 解析 | `Merchant.storeSlug` | A（**无自定义域名字段/配置**） |
| 授权码 / 商品权限 | 买家 MerchantFinder 查 6 位码 | `/api/merchants/code/:code`、`getAuthorizedProductVisibility` | `Merchant.storeLookupCode`、`vaultAccessRequest` | A（二维码接口无前端入口） |
| 营销推广（促销） | 仅总后台「促销管理」 | `/api/admin/promotions*` | `PromotionRule`/`CouponRedemption` | **C** + 权限缺口 |
| 智能营销（活动） | 总后台 + 商家端草稿 | admin: JSON 文件；merchant: workspace-drafts | `logs/marketing-campaigns.json`、`MerchantWorkspaceDraft` | **B** |
| ModaGPT / ModaUI / AI | 商家 AI 首页、员工、图片 | `/api/merchant/modagpt/*`、`ai-employees`、`ai-team`、`/assistant/query` | `ModaGpt*`、`MerchantAssistant*` | A（生产 0 次成功调用） |
| 商家注册 / 登录 / 权限 | 商家与员工登录 | `/api/auth/*`（35 个） | `Merchant`、`MerchantEmployee` | A |
| 订阅与收费 | `ModaGptPricingSheet`、`/billing/*` | `/api/billing/checkout`、`/api/merchant/modagpt/plans` | `ModaGptBilling*` | A（生产 0 订阅、无 Stripe 私钥） |
| 消息通知 | 商家通知中心 | `/api/merchant/notifications*` | `NotificationEvent` | **B**（按邮箱取件，见 §4） |
| 数据统计 | 商家概览 / 总后台 BI | `/api/merchant/dashboard`（**无调用方**）、`/api/admin/bi/*` | 实时聚合 | **D**（前端自算，后端端点闲置） |
| 系统设置 | 商家设置 / 总后台设置 | `/api/merchant/settings`、`/api/admin/settings/*` | `settings` JSON | A |

> 说明：表中 A 仅表示"代码链路齐全"，不等于业务验收通过。生产库商品 6 条、订单 1 条、面料 0 条，绝大多数链路从未真实跑过。

## 4. 权限与数据隔离问题（P0 候选）

1. **管理员模拟登录无权限码、无审计**：`POST /api/admin/merchants/:id/impersonate`（`server.ts:31063`）
   仅 `requireAdminAuth`，任何后台账号都能拿到某商家 2 小时会话；块内无 `logAudit`。
2. **促销 CRUD 无权限码**：`/api/admin/promotions` 四个方法（`server.ts:35676/35685/35762/35843`），
   有 `logAudit` 但无 `requireAdminPermission`；全站 23 个权限码里没有营销/促销相关码。
3. **信用往来账读取无权限码**：`GET /api/admin/credit-ledger/:customerId`（`server.ts:36419`），
   而其写操作 `adjust` 有 `finance.credit`（`36441`），读写不对称。
4. **商家通知按 contactEmail 匹配**：`server.ts:24211-24217` 用 `recipient = 商家联系邮箱` 查询，
   `NotificationEvent` 无 `merchantId` 字段；改邮箱即丢历史，也缺少租户主键级隔离。
5. 全站 217 个 `/api/admin/*` 端点中 42 个仅 `requireAdminAuth`；其中 2FA、个人设置类合理，
   其余（含上述 3 组）需逐条归类后补权限码。


## 5. 重复实现 / 死代码 / 未接入口

- **死接口**：`/api/merchant/dashboard`（`server.ts:24279`）在 `src/` 与 `tests/` 中 0 引用；
  商家概览由前端用 `merchantOrders/merchantProducts` 本地计算，统计口径与后端实现存在不一致风险。
- **有后端无入口**：`/api/merchant/product-reservation-requests` 与 `/:id/decision` 在 `src/apps` 0 引用；
  买家侧 `/api/product-reservation-requests` 已接通（`B2BContext.tsx:1191`）→ 买家能申请，商家没有审批入口。
- **二维码无入口**：`/api/merchants/code/:code/qr.png` 全前端 0 引用。
- **两套"增长"语义**：总后台 `growth`（平台运营/归因/CRM）与商家端 `growth`（草稿工作区）含义不同，
  文档与文案需显式区分，否则易被误认为同一功能。
- 已有 `docs/engineering/duplication-audit.md` 记录历史重复项，本文件只记录本次新发现，不重复其结论。
- 仓库根 `docs/` 下另有多份历史完成度报告（`FINAL_GAP_MATRIX.md`、`BLOCKED_ITEMS.md`、`CONTINUOUS_COMPLETION.md` 等），
  本文件不复制其内容，只提供可复现的代码/数据库证据与新发现；执行整改时以本文件的 P0/P1/P2 编号为准。

## 6. 整改计划（建议，待确认后执行）

### P0（安全，先做，不改变业务行为）

1. `impersonate` 增加权限码（新增 `accounts.impersonate` 或复用 `accounts.manage`）+ `logAudit` 记录。
2. `/api/admin/promotions*` 增加 `requireAdminPermission('growth.promotions')`（新增权限码需同步权限清单文档）。
3. `GET /api/admin/credit-ledger/:customerId` 增加 `finance.credit`。
4. 商家通知读取改为按 `merchantId` 过滤（需 migration：`NotificationEvent.merchantId` 可空 + 回填 + 索引），
   过渡期兼容邮箱匹配。

### P1（营销闭环，分批，每批单独验收）

- **批次 1（只读打通，无 DB 变更）**
  - 新增 `GET /api/merchant/promotions`：返回对当前商家生效的促销（`scope=merchant` 且命中 `merchantIds`，
    或 sitewide/category/product 命中其商品），只读。
  - 商家端「营销活动」增加"平台促销"列表（码、类型、门槛、有效期、复制码）。
  - 商家端「店铺域名」增加商家码 + `qr.png` 二维码展示与下载。
  - 新增 `GET /api/merchant/growth/channels`：只读暴露渠道配置状态（已配置/未配置），不暴露密钥。
- **批次 2（效果归属，需 migration 批准）**
  - `GrowthMarketingEvent` 增 `merchantId`（可空 + 索引），上报时按 storefront 子域/slug 解析归属。
  - 新增 `GET /api/merchant/growth/performance`，只用已有事件与订单聚合，不补造指标。
  - 商家「增长概览」改用服务端口径，替换前端自算。
- **批次 3（发布，需外部凭证 + 产品决策）**
  - 保持"未接通"的诚实提示，先做"导出素材 + 复制链接/二维码"；
  - 若要自动发布，需 Meta 主页授权（IG/FB）与审批流，商家端不得直接使用平台 token。

### P1（非营销）

- 商家端往来账只读页（复用 `CreditLedgerEntry`，按该商家订单归属过滤）。
- 补齐或明确下线 `/api/merchant/product-reservation-requests` 的商家审批入口。

### P2

- `/api/merchant/dashboard` 决定接回或标记废弃。
- 修正提示与实际同步行为不一致处（`MerchantGrowthWorkspace.tsx:319/424` 仍写"仅保存在此设备"）。
- 本次审计遗留：`tsc --noEmit` 63 个既有类型错误（已于 2026-10-26 第二轮收口为 0，见第 10 节）、`npm run lint` 未通过，与本整改分开处理。


## 7. 需要产品决策 / 外部条件

| 编号 | 事项 | 影响 |
| --- | --- | --- |
| D1 | 商家能否自建促销（只读平台促销 / 自建 + 平台审批） | 决定是否新增字段、审批流与端点 |
| D2 | 是否允许 DB migration（事件表、通知表加 merchantId） | 批次 2 与 P0-4 的前置条件 |
| D3 | 本期发布渠道范围（导出素材 / 接 Meta / 接邮件） | 决定是否需要外部凭证与审批设计 |
| D4 | 是否先把当前 1633 个未提交变更提交为基线 | 否则整改 diff 与线上版本无法区分 |

外部凭证（缺失即相关功能只能保持"未配置"，不得伪造成功）：

- Meta App / 主页长期令牌（IG、FB 发布）
- SMTP 或事务邮件服务（邮件通知、营销邮件）
- WhatsApp Cloud API / 短信供应商（如要外部触达）
- Stripe 私钥（当前 `.env` 只有 `STRIPE_PUBLIC_KEY`，订阅收费无法完成）
- AI：本机 Ollama 已有 `qwen2.5:7b`（reasoning）与 `qwen2.5vl:3b`（vision），无外部 key 也可运行；
  `.env` 仅配置 `GEMINI_API_KEY`，DeepSeek / OpenAI / FAL 未配置。

## 8. 验收方式（每批整改后执行）

1. `npm run build`（六端）与 `npx tsc --noEmit`（对比既有 63 个错误，不允许新增）。
2. 真实商家账号登录 → 打开营销页 → 生成文案 → 保存 → 刷新/换端 → 数据仍在（核对 `MerchantWorkspaceDraft.revision`）。
3. 总后台建针对该商家的促销 → 商家端"平台促销"可见；另一商家不可见（租户隔离）。
4. 买家结账用码 → 报价金额、订单金额、`CouponRedemption` 三者一致；超限/过期返回明确错误。
5. 权限：用无对应权限码的管理员账号调用被保护端点，应返回 403 且有审计记录。
6. UI：桌面 1440 / 手机 390 两档截图，空/加载/错误/无权限四态检查。

## 9. 本次审计未覆盖

- 小程序真机与开发者工具运行（仅静态核对页面与 API 基址）。
- 支付真实扣款（仅确认端点与配置字段，未做沙箱交易）。
- 邮件/短信/WhatsApp 实际投递（依赖外部凭证，`processNotificationQueue` 仅入队）。
- 151 个模型的逐字段一致性核对（本轮按业务域聚合核对）。
- 生产性能与并发（未压测）。

## 10. 类型检查收口记录（2026-10-26 第二轮，无功能变更）

范围：仅修编译期错误与死代码，未新增功能、未改数据库结构、未改任何 API 契约与页面视觉。

### 10.1 结果

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| `npx tsc --noEmit`（= `npm run lint`） | 63 个错误 | **0 个错误** |
| `npm run build`（六端 + server 打包） | 未验证 | 通过（六端 release 产物 + `dist/server.cjs` 3.2mb） |
| `npm run test:unit` | 未建立基线 | 876 通过 / 889，13 个失败均为既有内容漂移（见 10.4） |

### 10.2 实际修改（4 个文件，行为等价）

| 文件 | 修改 | 原因 |
| --- | --- | --- |
| `server.ts:5489 / 5505` | `if (!result.valid)` → `if (result.valid === false)` | 项目 `tsconfig` 未开 `strict`，布尔字面量判别式不支持真值收窄，导致 `result.statusCode/error` 报错；改为显式比较后类型可收窄，运行时逻辑完全一致（`tests/wechat-message-push.test.ts` 5/5 通过） |
| `server.ts:20425` | 商家设置默认值补 `productEditingEnabled: false` | 读取端返回该字段、写端 `PUT /api/merchant/settings/product-editing` 已持久化该键，仅默认值缺失导致类型失败 |
| `src/context/B2BContext.tsx:391` | `registerConsumer` 入参类型补 `acceptedTerms?/acceptedPrivacy?/newsletterOptIn?` | 服务端 `/api/consumers/register` 强制要求两项法律同意，`ConsumerAuth.tsx` 也已提交，原类型声明过期 |
| `src/apps/shared/components/frontend/CheckoutView.tsx:72` | `const shippingFee = 0` → `const shippingFee: number = 0` | 字面量被收窄为 `0` 后 `shippingFee === 0` 分支变 `never`，`toFixed` 报错；加类型标注，值仍为 `0` |
| `src/apps/shared/components/frontend/CheckoutView.tsx:483-485` | 删除 `!paypalMerchantId && …` 提示块 | `paypalMerchantId` 全仓无定义、`src/` 内无任何同名标识符，该分支永远不会渲染（死代码），删除不改变任何可见界面 |
| `scripts/seed-public-demo-showrooms.ts:36` | `buildDemoMerchantData` 补 `export` | `scripts/seed-miniprogram-demo-employee.ts` 需要导入该函数 |

### 10.3 死代码归档（未提交到 Git 的 WIP，不是删除既有功能）

移出 4 个服务端文件 + 3 个测试（备份留存于仓库内归档目录），详见
`docs/engineering/archive/2026-10-26-unwired-wip/README.md`：

- ModaGPT 图片任务子系统：`modagptImageTask.ts`、`modagptImageTaskService.ts`、`modagptImageTaskWorker.ts`、`modagptImageTaskCleanup.ts` 及两个测试。原因：依赖 `modagptTaskQueue` / `modagptEntitlements` 中不存在的导出、Prisma 模型中不存在的字段，且 `server.ts` 无任何 `/api/**/image-tasks*` 路由，全链路零引用。
- 商家推广/推荐奖励：`src/server/merchantPromotions.ts` 与 `tests/merchant-promotions.test.ts`。原因：使用 `prisma.merchantPromotionBenefit` / `merchantGrowthReferral` / `partnerMerchantReferral`，而 `prisma/schema.prisma`（HEAD 与工作区均如此）没有这三个模型；模块零引用。

保留：`src/api/modagptImageTasks.ts` 与其测试（可正常编译，仅缺服务端端点，作为后续接入的前端契约）。

**待决策（D5）**：工作区存在未被 Git 跟踪的迁移 `prisma/migrations/20261020150000_merchant_trial_referral_rewards/migration.sql`，它创建的 `MerchantGrowthReferral`、`MerchantPromotionBenefit` 等表在 `prisma/schema.prisma` 中并不存在，数据库脚本与 Prisma schema 已漂移。需业务方确认该功能是否本迭代交付：交付则补模型 + `prisma generate` + 文档后恢复归档文件；不交付则连同未跟踪迁移一并清理，避免长期漂移。

### 10.4 单元测试 13 个失败（均为既有漂移，非本轮改动引入）

失败用例读的都是本轮未触碰的文件，属大面积未提交 WIP 与测试断言的漂移，已记录不擅自修改：

| 用例 | 断言对象 | 现象 |
| --- | --- | --- |
| 268 / 269 | `scripts/test-ai-growth-p0-isolated.sh`、`package.json` | 脚本缺 `env -i`；`test:billing:integration` 等未走隔离容器脚本 |
| 303 / 304 | `prisma/schema.prisma` | 期望 `MerchantCounterparty` / `MerchantCustomerLink` 字段布局，实际不同 |
| 338 / 352 / 468 / 568 / 570 | 商家小程序页面源码 | 缺 `POS 快速开单` 等文案/页面文件（小程序改版进行中） |
| 761 / 762 | `scripts` 中 PostgreSQL 工具 | 期望拒绝继承 `PGHOST`，实际读取到 `production` 环境 |
| 803 | `tests/public-demo-showrooms-seed.test.ts` | 断言图片域名 `b2b.ruda.fashion`，脚本实际为 `modaui.com/demo-products/*.jpg` |
| 854 | `tests/ui-translation-copy.test.ts` | `MerchantAiEmployees.tsx` 存在未登记文案 key |

### 10.5 端侧验收状态

- 桌面/手机浏览器与小程序：**本轮未做真实截图验收**，标记为「代码检查完成，视觉待验收」。
- 已验收项：类型检查 0 错误、六端构建通过、`tests/wechat-message-push.test.ts` 5/5（覆盖本轮改动的微信消息推送校验分支）。


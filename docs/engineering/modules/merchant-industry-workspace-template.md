# 模块规格：商家经营类型模板与服装生产批发商后台锁定

- Module ID：`merchant-industry-template`
- 模块状态：部分完成（模板、注册与会话已实现；7 种行业后台页面见 `merchant-industry-backends.md`）
- 文档阶段：开发中（先于代码落盘，2026-10-28）
- 日期：2026-10-28
- 对应运行面：商家电脑网页端、商家手机网页端、商家小程序、公共注册入口、平台总后台商家创建

> 2026-10-28 更新：7 个模板全部开放，且每个模板绑定独立行业模块（`src/apps/merchant-admin-industries/`）。
> 前端不再用同一个工作区组件切换 6 个行业的标题与字段。行业能力、页面和测试以
> [`merchant-industry-backends.md`](./merchant-industry-backends.md) 为准。


## 1. 背景与问题

RUDA 目前只有一套商家后台（`merchant-admin-web` / `merchant-admin-mobile`），页面内容是服装生产批发业务：商品与 SKU、面辅料、生产、库存、采购、订单、客户、财务、店铺装修、AI 员工。但系统缺少“这套后台属于哪种经营类型”的权威记录：

- `Merchant.industry` 只记录 ModaGPT 行业包（`FASHION_COMPANY` 等 9 个值），语义是 AI 员工行业包，不是“后台形态”。
- 注册页允许选择 6 个行业，任何行业都会创建同一个服装后台，登录后没有任何区分或拦截。
- 注册成功后只返回 `companyId` 与企业状态，前端不显示“进入哪个后台”，也没有商家维度的工作区标识。
- 平台后台创建商家、Google 一键开店、快速开店、企业注册各自写一套 `merchant.create`，字段不一致，无法统一初始化。

本模块引入“商家经营类型模板”（industry template）作为权威字段，把现有后台正式锁定为 **服装生产批发商**（`apparel_production_wholesale`）的工作区，并让注册 → 建商家 → 权限/工作区初始化 → 登录到正确后台 → 可用业务闭环全部由服务端统一决定。

## 2. 目标与非目标

### 目标

- 新增唯一权威字段 `Merchant.industryTemplate`，取值为经营类型模板 ID；现有服装后台绑定 `apparel_production_wholesale`。
- 注册页只允许选择已开放模板（当前仅服装生产批发商），其余 6 种显示“即将开放”且不可提交。
- 服务端在创建商家的**同一事务**内完成：行业包映射、模板写入、默认仓库、商家登录账号、ModaGPT 行业团队初始化、工作区快照。
- 登录（商家 / 员工 / Google / 小程序 / `/api/auth/me/*` / 商家 API 中间件）统一校验模板是否可用，未开放或未知模板不得进入服装后台。
- 注册成功且工作区可用时，服务端同时下发商家会话，前端自动进入 `merchant-admin-web`。
- 保持 `Merchant.industry`（ModaGPT 行业包）既有语义不变，避免影响 AI 团队与既有报表。

### 非目标

- 不新建第二套商家后台、第二套登录或第二套商家表。
- 不实现另外 6 种经营类型的后台页面；本轮只登记模板与“即将开放”状态。
- 不改变服装后台现有模块与权限规则，不做无关重构或 UI 改版。
- 不在本轮执行生产迁移与发布（迁移脚本随代码提交，执行需单独授权）。

## 3. 复用现状与防重复检查

| 项目 | 已有能力 | 本模块处理 |
|---|---|---|
| 行业枚举 | `src/constants/merchantIndustries.ts`（6 个 ModaGPT 行业） | 保留不动；新增独立模板常量文件，模板通过 `merchantIndustry` 映射到既有行业包 |
| AI 行业包 | `src/server/modagptCoreEmployees.ts`（`resolveNewModaGptIndustry`、`provisionModaGptIndustryTeam`） | 直接复用；模板只负责选择行业包，不重建 AI 团队逻辑 |
| 注册入口 | `src/apps/shared/components/auth/RegistrationPortal.tsx`、`MerchantLogin.tsx`、`MerchantQuickStart.tsx`、`GoogleSignInButton.tsx` | 复用页面与验证码/Google 流程，只替换行业选择为模板选择并补经营信息 |
| 服务端注册 | `server.ts` `/api/auth/register/company`、`/api/auth/register/merchant/quick`、`/api/auth/register/merchant`、Google 商家注册、`/api/admin/merchants`、ModaGPT 管理员草稿提交 | 全部接入统一模板解析，写同一组字段 |
| 登录与会话 | `merchantLoginHandler`、`employeeLoginHandler`、`/api/auth/me/merchant`、`/api/auth/me/employee`、`requireMerchantTenant` | 统一在服务端增加模板可用性校验 |
| 默认仓库 | `/api/auth/register/company` 内的 `warehouseLocation.create({ code: 'MAIN' })` | 复用；快速开店/Google 保持现状（无仓库），记录为已知差异 |
| 店铺模板 | `src/shared/merchantStorefrontTemplate.ts`（`getMerchantStorefrontTemplate`） | 不新增第二套；后台模板与店铺模板通过文档说明区分，本模块不写入 `settings.storefrontTemplate` |
| 商家上下文 | `src/context/B2BContext.tsx`、`src/types/b2b.ts` | 增加 `workspace` 快照字段，登录/注册沿用现有 API client |

检索过的关键字：`industryTemplate`、`merchantIndustries`、`resolveNewModaGptIndustry`、`provisionModaGptIndustryTeam`、`merchant.create`、`serializeMerchantRow`、`ruda_merchant_jwt`、`MERCHANT_PENDING_REVIEW`。结论：不存在既有“工作区/后台类型”字段或模板概念，必须新增；但所有周边能力均可复用，因此不新建模块系统。

## 4. 经营类型模板清单

模板定义位于 `src/constants/merchantIndustryTemplates.ts`（前后端共享，服务端校验也读这份）：

| 模板 ID | 名称 | 状态 | ModaGPT 行业包 | 工作区 |
|---|---|---|---|---|
| `apparel_production_wholesale` | 服装生产批发商 | 开放 | `FASHION_COMPANY` | `merchant_admin_apparel_production_wholesale`（现有 `MerchantPortal`） |
| `apparel_wholesale` | 服装批发商 | 开放 | `FASHION_WHOLESALE` | `merchant_admin_apparel_wholesale` |
| `trading_wholesale` | 贸易批发商 | 开放 | `TRADING_COMPANY` | `merchant_admin_trading_wholesale` |
| `department_wholesale` | 百货批发商 | 开放 | `DEPARTMENT_STORE` | `merchant_admin_department_wholesale` |
| `bags_wholesale` | 箱包批发商 | 开放 | `LEATHER_GOODS` | `merchant_admin_bags_wholesale` |
| `department_chain_retail` | 百货连锁店 | 开放 | `DEPARTMENT_STORE` | `merchant_admin_department_chain_retail` |
| `general_retail` | 综合零售商 | 开放 | `RETAIL_STORE` | `merchant_admin_general_retail` |

模板与前端模块的唯一映射在 `src/apps/merchant-admin-industries/registry.ts`；服装生产批发商映射为
`null`，继续由现有 `MerchantPortal` 承载，其余 6 个行业各自加载独立目录。


工作区模板 `merchant_admin_apparel_production_wholesale` 启用模块（与 `MerchantPortal` 真实 `activeTab` 一致）：
`dashboard, pos, products, sku_matrix, materials, production, inventory, procurement, orders, vault_requests, customers, finance, growth, content, gallery, ai_employees, fashion_studio, modagpt, profile, settings`。

模板同时声明可选的“注册经营信息”字段（仅服装模板启用）：经营模式（生产+批发 / 仅生产 / 仅批发）、是否自有生产能力、是否经营面料辅料；以及允许的主营品类集合。

## 5. 数据归属与迁移

`Merchant` 新增字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `industryTemplate` | `String? @db.VarChar(48)` | 经营类型模板 ID；`null` 仅存在于历史数据 |
| `industryTemplateSource` | `String @default("LEGACY_PENDING_REVIEW") @db.VarChar(32)` | 模板来源：`SELF_SELECTED`、`GOOGLE_ONBOARDING`、`ADMIN`、`LEGACY_MIGRATED`、`LEGACY_PENDING_REVIEW`、`MERCHANT_UPDATED` |
| `industryTemplateInitializedAt` | `DateTime?` | 模板确定时间 |
| `registrationProfile` | `Json?` | 注册时采集的经营信息（`operatingModel`、`hasProductionCapacity`、`carriesMaterials`、`categories`、`roles`），服务端白名单归一化后写入 |

迁移：`prisma/migrations/20261028120000_merchant_industry_template/migration.sql`

- `ALTER TABLE "Merchant" ADD COLUMN ...` 四个字段 + `Merchant_industryTemplate_idx` 索引。
- 回填：`industry = 'FASHION_COMPANY'` 的历史商家写入 `apparel_production_wholesale` / `LEGACY_MIGRATED` / `NOW()`。
- 其余历史行业保持 `industryTemplate = NULL`、来源 `LEGACY_PENDING_REVIEW`，按第 6 节“历史兼容”处理，不阻断既有生产账号。
- 回滚：删除索引与 4 个字段即可；新增字段不承载既有业务语义，回滚不丢失原有数据。

数据所有者：`Merchant` 行由服务端商家服务唯一写入；`B2BContext` 只在内存保存服务端返回的快照，不作为权威来源。

## 6. 服务端规则

### 6.1 注册模板解析（`resolveMerchantRegistrationTemplate`）

输入 `{ industryTemplate?, industry? }`：

1. 传 `industryTemplate`：必须存在于模板表，否则 `INVALID_INDUSTRY_TEMPLATE`；必须 `status = 'open'`，否则 `INDUSTRY_TEMPLATE_NOT_OPEN`。
2. 未传模板但传 `industry`（旧客户端 / 旧缓存页面）：按 ModaGPT 行业包反查已开放模板（`FASHION_COMPANY → apparel_production_wholesale`），找不到返回 `INDUSTRY_TEMPLATE_NOT_OPEN`。
3. 两者都未传：`REQUIRE_INDUSTRY_TEMPLATE`。

解析成功后统一使用模板的 `merchantIndustry` 写入 `Merchant.industry`，不再直接信任客户端行业字符串。

### 6.2 工作区快照与访问判定（`resolveMerchantWorkspaceState`）

序列化到 `merchant.workspace`：

```ts
{
  templateId, templateNameZh, templateNameIt, templateSource,
  workspaceTemplateId, workspaceNameZh, workspaceNameIt, modules,
  status: 'active' | 'legacy_review' | 'unavailable',
  accessAllowed: boolean
}
```

- 模板存在且开放 → `active`，`accessAllowed = true`。
- 模板存在但未开放/未知 → `unavailable`，`accessAllowed = false`（新注册不会被写成这种状态；仅管理员显式指定未开放模板时出现）。
- 无模板 + `industry = 'FASHION_COMPANY'` → `legacy_review`，工作区仍为服装后台，`accessAllowed = true`（历史兼容，避免生产账号被锁死）。
- 无模板 + 其他行业 → `legacy_review`，无工作区，`accessAllowed = true` 但无后台模块声明。

### 6.3 登录与接口拦截

| 入口 | 处理 |
|---|---|
| `POST /api/auth/login/merchant`、`/api/miniprogram/auth/login/merchant` | 模板不可用 → `403 MERCHANT_TEMPLATE_UNAVAILABLE`，`details.templateId` 回传 |
| `POST /api/auth/login/employee`、`/api/miniprogram/auth/login/employee` | 过滤掉模板不可用的商家；仅剩被拦截的商家时同样返回 `MERCHANT_TEMPLATE_UNAVAILABLE` |
| Google 商家登录/注册 | 签发 token 前校验模板 |
| `GET /api/auth/me/merchant`、`GET /api/auth/me/employee` | 模板不可用返回 `{ success: false }`，前端回到登录页 |
| 商家 API（`requireMerchantTenant`） | 每次请求读取商家模板，不可用返回 `403 MERCHANT_TEMPLATE_UNAVAILABLE`，避免旧 token 继续访问 |

租户隔离不变：`merchantId` 始终来自服务端 JWT，不接受前端传入。

### 6.4 注册事务

企业注册（`/api/auth/register/company`）在既有事务内追加：

1. `Company` + `BusinessRole` + `Verification` + 买家客户（零售商）创建（既有）。
2. `Merchant` 创建时写入 `industry`（来自模板）、`industryTemplate`、`industryTemplateSource`、`industryTemplateInitializedAt`、`registrationProfile`（既有字段不变）。
3. `warehouseLocation` 默认 `MAIN` 仓库（既有）。
4. `AuthAccount(role='merchant')` 商家登录账号（既有）。
5. `provisionModaGptIndustryTeam(...)` AI 行业团队（既有）。
6. 事务后：签发 `ruda_company_jwt`；若商家工作区可用，同时签发 `ruda_merchant_jwt` 并返回 `merchantId`、`merchantCode`、`workspace`。

响应新增字段（向后兼容）：

```json
{
  "success": true,
  "companyId": "...",
  "merchantId": "mch-...",
  "merchantCode": "brand-x",
  "workspace": { "templateId": "apparel_production_wholesale", "workspaceNameZh": "服装生产批发商后台", "accessAllowed": true, "modules": ["..."] },
  "merchantLoginAvailable": true
}
```

`autoApproved = false`（高风险）时仍创建商家与账号，但 `merchantLoginAvailable = false`，前端只显示审核中提示，不跳后台。

## 7. 前端流程（4 步 + 成功页）

`RegistrationPortal`：

1. **账户信息**：邮箱/手机验证码、密码（既有）。
2. **选择注册身份**：商家经营者（继续）/ 普通采购客户（返回并引导买家注册）；业务身份三选一（生产商/批发商/零售商）。
3. **选择经营类型**：7 个模板卡片，仅服装可选，其余置灰“即将开放”；主营品类按模板品类过滤；服装模板追加经营模式、自有生产、面料辅料三项经营信息。
4. **填写商家资料并提交**：店铺/品牌名、国家、城市、VAT、摘要确认、条款与隐私勾选。
5. **成功页**：显示公司状态、工作区名称；“进入服装生产批发商后台”按钮；工作区可用且自动审批时 2.5 秒后自动跳转 `/merchant`，审核中只显示等待提示。

`MerchantLogin`（注册 tab）与 `MerchantQuickStart`：行业下拉替换为模板下拉，默认选中服装模板，只列出已开放模板，其余以“即将开放”禁用项展示；`GoogleSignInButton` 通过 `industryTemplate` 查询参数传递模板。

`MerchantPortal` 不新增页面，只消费 `merchant.workspace`；若服务端返回不可用，`/api/auth/me/merchant` 已失败，前端回到登录页。

## 8. 错误码

| 错误码 | HTTP | 场景 |
|---|---|---|
| `REQUIRE_INDUSTRY_TEMPLATE` | 400 | 注册未传模板也无可映射行业 |
| `INVALID_INDUSTRY_TEMPLATE` | 400 | 模板 ID 不存在 |
| `INDUSTRY_TEMPLATE_NOT_OPEN` | 400 | 选择了未开放模板或未开放行业包 |
| `MERCHANT_TEMPLATE_UNAVAILABLE` | 403 | 登录/会话/商家 API 时模板不可用 |

## 9. 测试与验收标准

自动化（`npm run test:unit`，新增 `tests/merchant-industry-template.test.ts`）：

- 模板清单唯一、恰好 1 个开放模板、服装模板映射 `FASHION_COMPANY` 与服装工作区。
- 模板解析：正常 / 未开放 / 未知 / 缺失 / 旧行业回退。
- 工作区快照：开放、未开放、历史服装、其他历史行业。
- 注册经营信息白名单归一化。
- schema 与迁移文件契约（字段、索引、回填语句存在）。

人工/真实环境（未执行前标“待验收”）：

- 新邮箱走完 4 步注册，数据库 `Merchant` 行含模板与经营信息，`AuthAccount(role='merchant')` 可登录，`warehouseLocation` 存在 `MAIN`。
- 注册完成自动进入 `merchant-admin-web`，左侧导航为服装模块，接口无 403。
- 商家 Web / 手机 Web / 小程序同一账号登录后 `workspace.templateId` 一致。
- 选择未开放模板无法提交；直接调用 API 返回 `INDUSTRY_TEMPLATE_NOT_OPEN`。

## 10. 风险与回滚

- 风险：服务端对模板不可用的商家拦截登录；历史商家已按 `LEGACY_MIGRATED` / `LEGACY_PENDING_REVIEW` 兼容放行，不会因本轮上线被锁死。
- 风险：新增必填模板校验会影响旧缓存注册页；旧客户端回退到 `industry` 映射，仅服装行业可继续注册，属预期收紧。
- 回滚：代码回滚到上一版本即可，新增列可保留（服务端不读取时不影响旧行为）；如需彻底回滚按第 5 节删除列与索引。
- 生产迁移执行前需备份，并在发布说明中记录 `prisma migrate deploy` 与回滚步骤。

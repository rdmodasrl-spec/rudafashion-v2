# 模块规格：统一身份与行业商家注册即开通

- Module ID：`identity-merchant-onboarding`
- 模块状态：部分完成
- 文档阶段：开发中（Restaurant 正式自助开通修正先行）
- 日期：2026-10-28
- 对应运行面：公共前台 Web/手机、小程序买家入口、商家后台 Web/手机、商家小程序、平台总后台、服务端认证与 Prisma 数据模型

## 1. 问题与目标

RUDA 需要把普通采购客户注册、商家注册、平台管理员权限三条路径正式分开，同时保持同一套账号认证。当前仓库已有 `AccountIdentity`、`AuthAccount`、`Consumer`、`Customer`、`Merchant`、`MerchantEmployee`、`MerchantOnboardingApplication` 和八个开放的历史行业模板：`apparel_production_wholesale`、`apparel_wholesale`、`trading_wholesale`、`department_wholesale`、`bags_wholesale`、`department_chain_retail`、`general_retail`、`restaurant_ordering`。这些旧模板不是产品已确认的八个正式行业 ID，也不表示 V2.2 的新行业/Studio 映射已接通；目标结构以 [RUDA 多行业 AI 工作室 V2.2 规格](./modaui-industry-studios-v2.md) 为准。当前商家注册主流程为验证联系方式后直接建立商家账号和所选旧模板后台；免费成为商家无需先提交 `MerchantOnboardingApplication`。历史 `/api/onboarding/merchant/submit` 申请流程仍是独立的补充资料/复核流程，不得成为注册和开始经营的前置门槛。

本模块正式确定：普通注册默认是采购/前台身份；商家通过验证联系方式的商家注册流程直接创建或关联企业与行业后台；资料可后续完善；平台管理员只能由总后台授权。同一自然人可通过同一 `AccountIdentity` 同时拥有客户身份和一个或多个商家管理身份，但每个业务身份的授权和数据范围必须分开。人工复核可用于例外/历史申请及公开销售治理，不阻止已完成账号验证的商家使用后台经营能力。

## 2. 非目标

- 不新增第二套登录系统、用户表、商家表或平台管理员注册入口。
- 不把所有普通注册用户升级为商家。
- 当前存在八个开放的旧模板；它们与 V2.2 定义的八个正式行业并非一一对应。本规格不复制行业后台，目标行业到现有模块注册表的迁移/映射按 V2.2 规格实施。
- 不重构现有服装生产批发商后台的商品、库存、订单、客户、供应商、员工和店铺网站业务。
- 不在前端隐藏菜单后绕过服务端权限；服务端仍逐请求校验租户和角色。

## 3. 复用现状与防重复检查

| 类别 | 现有能力 | 本模块复用/调整 |
|---|---|---|
| 统一账号 | `AccountIdentity(scope='public')`，`AuthAccount.identityId`，`getOrCreateSharedAccountIdentity()` | 继续作为同一自然人跨客户、公司、商家身份的账号纽带 |
| 前台客户 | `Consumer`、`Customer`、`AuthAccount(role='consumer'/'buyer')`，`/api/consumers/register`，`/api/auth/register/buyer` | 普通注册只获得前台/采购身份，不创建 `Merchant` |
| 商家主体 | `Merchant`、`AuthAccount(role='merchant')`、`MerchantEmployee` | 在验证联系方式的正式注册事务中创建或关联 |
| 历史/补充申请 | `MerchantOnboardingApplication`、`/api/onboarding/merchant/submit` | 保留为独立记录与复核流程，不作为当前免费开店入口 |
| 行业模板 | `src/constants/merchantIndustryTemplates.ts`、`src/server/merchantIndustryTemplates.ts` | 当前八个旧 open 模板使用服务端唯一解析；角色与品类按所选旧模板校验，Restaurant 使用餐饮经营者角色和餐饮品类。目标正式行业映射见 V2.2，尚未完整接线 |
| 商家三端 | `merchant-admin-web`、`merchant-admin-mobile`、`merchant-miniprogram` | 三端继续使用同一 `/api/merchant/*`、同一 JWT 租户边界和同一模板快照 |
| 总后台 | `requireAdminAuth`、`requireAdminPermission('merchants.review')` | 查询商家/处理例外申请走平台管理员权限；不得要求新商家等待人工审核才能使用后台 |

检索过的关键字和目录：`AccountIdentity`、`AuthAccount`、`Consumer`、`Customer`、`MerchantOnboardingApplication`、`register/merchant`、`register/company`、`requireBuyerAuth`、`requireMerchantTenant`、`industryTemplate`、`merchant-admin-web`、`merchant-admin-mobile`、`merchant-miniprogram`、`server.ts`、`prisma/schema.prisma`、`docs/engineering/modules/*`。

## 4. 身份与权限边界

| 身份 | 注册/授权来源 | 默认入口 | 权限边界 |
|---|---|---|---|
| 前端客户/采购商 | 前台、小程序或买家注册；`Consumer`/`Customer` + `AuthAccount(role='consumer'/'buyer')` | 前台商城、折扣商城、小程序买家页 | 不能访问商家后台 API；不能管理商品、库存、订单和员工 |
| 商家经营者 | 验证联系方式并提交当前已开放的旧行业模板；服务端创建/关联 `Merchant` + `AuthAccount(role='merchant')` | 当前进入所选旧模板后台；Restaurant 仅可使用已接通的菜单/桌台模块。目标行业入口按 V2.2 迁移后提供 | 只能管理自己被授权的商家；`merchantId` 来自 JWT，不信任客户端传入 |
| 商家员工 | 商家后台员工模型 `MerchantEmployee` | 商家后台三端 | 受员工角色与权限数组限制 |
| 平台管理员 | 总后台管理员账号 `AuthAccount(role='admin')` | 平台总后台 | 不能通过公开注册获得；管理入驻审核、商家状态和平台运营 |

同一个邮箱/手机号可以通过 `AccountIdentity` 关联多个 `AuthAccount` 角色。账号身份可以共存，但服务端必须在每个 API 使用对应的 JWT、角色、租户和资源归属判定。

## 5. 商家入驻状态机

权威状态存在 `MerchantOnboardingApplication.status`：

| 状态 | 含义 | 允许下一状态 |
|---|---|---|
| `draft` | 草稿或未提交；当前公开 API 暂不创建草稿 | `pending_review`、`closed` |
| `submitted` | 历史兼容值，等价于 `pending_review` | `pending_review`、`additional_info_needed`、`approved`、`rejected` |
| `pending_review` | 待审核 | `additional_info_needed`、`approved`、`rejected`、`closed` |
| `reviewing` | 历史兼容值，等价于 `pending_review` | `additional_info_needed`、`approved`、`rejected` |
| `additional_info_needed` | 需要补充资料 | `pending_review`、`rejected`、`closed` |
| `approved` | 审核通过；必须关联正式 `approvedMerchantId` | `suspended`、`closed` |
| `rejected` | 审核驳回 | `pending_review`、`closed` |
| `suspended` | 已暂停 | `approved`、`closed` |
| `closed` | 已关闭 | 无 |

状态转换只能由服务端执行。审核通过时必须在同一事务中创建或激活商家主体、商家登录账号、默认仓库、该历史申请选定的开放旧模板、ModaGPT 行业团队和审计记录；不得出现只创建账号但没有后台权限、或创建商家但没有账号的半成品。新结构行业映射按 V2.2 规格迁移，不以本历史申请状态机替代。

## 6. API 契约

### 6.1 普通客户注册

- `POST /api/consumers/register`：创建前台消费者账户。
- `POST /api/auth/register/buyer`：创建采购商/买家账户。
- 结果：只签发消费者或买家会话；不创建 `Merchant`，不签发 `ruda_merchant_jwt`。

### 6.2 商家注册 API（当前旧模板兼容路径）

- `POST /api/auth/register/company`（主注册表单）、`POST /api/auth/register/merchant` 与 `POST /api/auth/register/merchant/quick`（兼容入口）。
- 验证：遵循各端既有邮箱/手机验证及密码校验；公开请求不能声明管理员或伪造模板。
- 模板：当前实现通过 `resolveMerchantRegistrationTemplate` 只接受八个旧 open 模板；Restaurant 按唯一旧模板 ID `restaurant_ordering` 和 `RESTAURANT` 行业身份进入，不按中文名称匹配。该兼容行为不等同于 V2.2 正式行业 ID/Studio registry 已迁移。
- 表单：Restaurant 仅允许 `RESTAURANT_OPERATOR` 业务身份及模板声明的餐饮经营品类；其他模板继续使用现有 `PRODUCER` / `WHOLESALER` / `RETAILER` 身份和模板品类。服务端按已解析模板白名单校验，不能信任客户端提供的行业/角色/品类组合。
- 兼容入口：邮箱快速注册与 Google 商家注册同样依据已解析模板设置餐饮 `businessType='restaurant'` 与 `RESTAURANT_OPERATOR` 注册资料，不得回落为 `brand_supplier` 或服装经营身份。既有 `/api/auth/register/merchant` 只接受其已声明的兼容业务类型；Restaurant 使用统一公司注册及快速注册入口。
- 写入：事务内持久化公司/统一身份、`Merchant.industryTemplate`、模板来源、默认仓库、商家账号及现有行业初始化能力；返回/设置商家会话。
- 业务资料不完整时显示待完善，不因此拒绝登录或冻结商品/订单权限。

### 6.3 历史/补充资料申请（非开店前置）

- `POST /api/onboarding/merchant/submit`
- 权限：公开入口；若用户已登录，后续可通过统一账号关联；当前公开提交必须提供联系邮箱。
- 模板：当前只接受八个旧 open 模板；未开放模板返回 `INDUSTRY_TEMPLATE_NOT_OPEN`。Restaurant 申请不表示 POS、支付或厨房能力已开通；这不是 V2.2 新行业映射的验收。
- 写入：`MerchantOnboardingApplication`，状态为 `pending_review`，保存申请资料、模板、注册经营信息和申请联系邮箱。
- 结果：只返回申请编号；该记录仅供补充资料/例外复核，不能替代正式注册，也不应是「免费成为商家」页面的提交目标。

### 6.4 平台审核（仅历史/例外申请）

- `GET /api/admin/merchant-onboarding/applications`
- `PUT /api/admin/merchant-onboarding/applications/:id/review`
- 权限：`requireAdminAuth` + `requireAdminPermission('merchants.review')`
- 决策：
  - `additional_info_needed`：标记需补资料，记录说明。
  - `rejected`：标记驳回，记录说明。
  - `approved`：按该申请记录创建或激活其所选行业商家（仅适用于仍需复核的历史/例外记录）。

审核通过响应必须返回 `application` 与 `merchant`。重复审核已通过申请应返回 409，不重复创建商家。

### 6.5 登录后入口

- 普通客户：进入前台商城。
- 当前旧模板注册且联系方式验证完成的商家：直接进入所选旧模板后台；V2.2 正式行业入口尚待迁移。
- 待补资料：可以继续使用授权的商家后台；仅资料提示，不冻结权限。
- 历史/例外申请状态不自动授予商家权限，不能代替正式商家身份。
- 暂停/关闭商家：服务端商家 API 返回 403，不能依赖前端路由隐藏。

## 7. 数据模型变更

`MerchantOnboardingApplication` 需要补充以下字段：

| 字段 | 说明 |
|---|---|
| `accountIdentityId` | 申请联系邮箱对应的统一账号 ID，可为空 |
| `companyId` | 审核通过时创建或关联的企业主体 ID，可为空 |
| `industryTemplate` | 申请选择的经营类型模板 |
| `industryTemplateSource` | 模板来源，例如 `SELF_SELECTED` |
| `registrationProfile` | 经营模式、生产能力、面辅料、角色和品类等白名单信息 |
| `submittedByAuthAccountId` | 若由已登录用户提交，可记录提交账号；当前预留 |

这些字段不替代 `Merchant`；申请在审核通过前不是商家主体。

## 8. 三端影响

- 商家 Web、商家手机 Web、商家小程序：使用正式注册后签发的商家会话；模板快照继续来自 `serializeMerchantRow().workspace`。
- 商家 API：继续通过 `requireMerchantTenant` 从 JWT 读取 `merchantId`；本模块不允许申请态 token 访问商家 API。
- 用户端小程序/前台：客户身份保持可用；同一账号成为商家后不取消采购身份。
- 平台总后台：商家中心用于监控注册/行业/资料/经营；历史/例外申请使用既有审核 API，不得把人工审核加回正式注册主流程。

## 9. 测试与验收标准

自动化：

- 商家入驻状态机只允许文档中的状态转换。
- 当前八个旧 open 模板各自通过 `POST /api/auth/register/company` 写入正确 `Merchant.industryTemplate`，并能建立对应 workspace 会话；Restaurant 会话仅显示已开放的菜单/桌台入口。此项验证旧注册兼容路径，不代表 V2.2 的八行业映射已完成。
- Restaurant 注册只能提交 `RESTAURANT_OPERATOR` 及 `restaurant_ordering` 模板声明的品类；非餐饮模板不能提交餐饮身份/品类。
- `/register-wholesale?registration=merchant` 必须进入标准验证注册流程，不得再提交无密码/未验证的等待审核申请。
- `POST /api/onboarding/merchant/submit` 仅保留为历史/例外申请路径，不得作为商家后台访问前置条件。
- 历史申请管理员审核路径必须按申请模板创建商家、`AuthAccount(role='merchant')`、默认仓库，并写 `approvedMerchantId`。
- 商家 API 继续使用服务端 JWT 租户边界，客户端传入 `merchantId` 无效。

真实验收：

1. 普通客户注册后进入前台商城，不能访问 `/api/merchant/*`。
2. 同一账号提交商家入驻申请后仍保留采购身份。
3. 注册选择八行业任一行业后，无须额外人工审核即可登录对应后台。
4. 资料不完整仅提示，不阻止合法登录与已授权经营操作。
5. 新商家能创建商品、库存、订单、客户和员工，且数据归属到自己的 `merchantId`。
6. 一个商家无法访问其他商家的数据。
7. 历史服装商家继续登录；行业不明确历史商家不被盲目迁移。
8. Web、手机 Web、商家小程序在现有支持范围内看到一致模板和权限结果。

## 10. 部署与回滚

- 数据库迁移为加字段和索引，非破坏性；上线前执行备份。
- 发布顺序：服务端 → 总后台商家中心 → 前台商家注册入口 → 小程序；只有另有 schema 变更时才执行对应兼容迁移。
- 回滚：代码回滚后新增字段可保留；若必须数据库回滚，删除新增索引和字段。不得删除已经审核通过创建的正式商家数据，除非有单独数据恢复计划。

## 11. 本轮实施记录

- 已新增 `src/server/merchantOnboarding.ts`，集中维护申请状态归一化、状态转换、审核决策和申请序列化。
- 本规格记录的是当前注册实现与历史模板；正式目标行业划分以 [`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md) 为准。该目标已将服装生产改为服装批发的可选能力，并新增综合批发；当前注册/审核 API 尚未迁移到该结构。
- 已扩展 `MerchantOnboardingApplication` schema 与迁移 `20261028234000_merchant_onboarding_identity`，补充统一账号、公司、模板、资料快照和提交账号字段；默认新申请为 `pending_review`。
- `/api/onboarding/merchant/submit` 只创建历史/例外申请；正式 `/api/auth/register/company`、`/api/auth/register/merchant`、`/api/auth/register/merchant/quick` 按模板直接创建正式商家后台并签发相应商家会话。注册即开通规则见 §12。
- 已新增平台审核 API：`GET /api/admin/merchant-onboarding/applications` 与 `PUT /api/admin/merchant-onboarding/applications/:id/review`，由 `merchants.review` 权限保护；审核通过事务内创建旧版服装生产批发商、商家账号、默认仓库、企业关联和 ModaGPT 行业团队。
- 已新增 `tests/merchant-onboarding-identity.test.ts`，覆盖开放模板、状态机、schema/migration、公开申请路径、兼容注册端点和平台审核闭环契约。
- 既有七行业与 Restaurant 注册均使用统一 `AccountIdentity` / `Merchant` / `AuthAccount`；Restaurant 尚未按餐饮类型采集独立角色与品类，表单会出现服装经营选项且服务端用通用品类白名单，详见 §15。
- 本轮此状态将由 §15 的 Restaurant 角色/品类修正记录和验证命令更新；前述旧行不应作为本轮真实浏览器、数据库或多端验收通过的证明。

## 12. 2026-10-28 决策更新：注册即开通对应行业后台

七种行业后台定型后，新商家注册不再进入人工审核等待：

- `POST /api/auth/register/merchant`、`POST /api/auth/register/merchant/quick` 在邮箱/验证码/密码校验通过后，直接创建 `Merchant`、`AuthAccount(role='merchant')`、默认仓库与 ModaGPT 行业团队，写入 `industryTemplate` 并签发 `ruda_merchant_jwt`；前端直接进入模板对应的行业后台。
- `POST /api/auth/register/company` 同样在注册事务内写入模板并签发商家会话。
- `MerchantOnboardingApplication` 与平台审核接口（`/api/admin/merchant-onboarding/*`）继续保留，用于历史申请、补充资料和需要人工复核的例外场景，不再是新商家开店的前置步骤。
- 安全边界不变：模板必须存在且开放，`merchantId` 只来自服务端 JWT，租户隔离与员工权限仍在每个 `/api/merchant/*` 请求校验。
- 行业差异见 [`merchant-industry-backends.md`](./merchant-industry-backends.md)。

## 13. 2026-10-29 小程序注册入口与法务勾选位置

- 小程序「邮箱注册」（`/pages/enterprise-register/index?portal=merchant-registration`）直接进入原生两步表单，不再跳 `web-view`。旧的 `/register-wholesale?registration=merchant` 中转与「复制注册链接」兜底已移除；`portal=partner` 仍保留代理后台 web-view。
- 法务勾选固定为表单最后一项：步骤内容 → 错误提示 → 单份《用户服务协议》《隐私政策》勾选 → 下一步 / 提交申请。原先 step 1、step 2 各一份的重复勾选块合并为一份。
- 合规门槛不变：`requestVerification`、`verifyContact`、`submitRegistration` 均要求两项协议已勾选；服务端 `/api/auth/register/company*` 契约与租户边界不变。
- 回归：`node --test tests/merchant-miniprogram-registration.test.ts`，其中包含「勾选块位于最后一个步骤 block 之后且先于提交按钮」与「页面不再引用 `register-wholesale`」的结构断言。

## 14. 2026-10-29 旧商家入驻页面收敛

- `merchant_onboarding` 曾由 `MerchantOnboarding.tsx` 提交无密码、未验证的 `MerchantOnboardingApplication`，并展示等待审核和计时式 AI 团队动画；该路径与注册即开通规则冲突，不能继续作为用户可见的免费开店入口。
- 该页面路由改为复用 `RegistrationEntry` 的验证注册路径，由用户明确选择权威行业模板；旧申请 API/后台审核仍只处理已有历史/例外申请，不影响注册后直接进入行业工作区。
- 不展示未经数据库/API 证实的流量、订单、审核时效或“AI 已完成”承诺。

## 15. Restaurant 自助开通补齐（2026-11-15）

### 审计发现

- 虽然 `restaurant_ordering` 已登记为 open，Web 注册表单没有餐饮角色/品类，小程序行业选项仍只有七项。
- `/api/auth/register/company` 在解析行业模板前统一要求三种服装/批零角色，并用静态品类白名单验证；Restaurant 的空品类模板因此无法提交。
- 邮箱快速注册把经营类型固定写成 `brand_supplier`；Google 快速注册也固定写成 `brand_supplier`。小程序与 Web 共享主注册 API，但小程序注册结果页不负责绕开登录流程。
- `?registration=merchant` 入口传给共享注册路由后没有被识别为直接企业注册；快速注册页面虽提交邮箱验证码 token，服务端却允许公开请求不带 token 创建商家。
- 隔离 PostgreSQL HTTP 验证曾发现快速注册创建 `AuthAccount` 时使用了不存在的 Prisma 关系字段 `AccountIdentity`（schema 实际字段为 `accountIdentity` / `identityId`），导致真实注册返回 500；已改为写入 `identityId` 并由回归集成测试确认。

### 复用与实施边界

- 复用现有 `AccountIdentity`、`Company`、`CompanyBusinessRole`、`Merchant`、`AuthAccount`、模板注册表、Restaurant 菜单/桌台工作区和 `/api/auth/register/company`；数据库角色/经营类型字段为字符串，无需新增表、字段或迁移。
- Restaurant 注册角色固定为 `RESTAURANT_OPERATOR`，经营类型保存为 `restaurant`；餐饮品类由 `restaurant_ordering.categories` 提供唯一白名单。
- 除快速注册 API 外，隔离 PostgreSQL 集成还覆盖 Web 表单实际调用的 `/api/auth/register/company/verify` → `/api/auth/register/company` 主链路；验证注册即创建 ACTIVE Restaurant workspace、返回可用商家 Cookie，并用该 Cookie 请求 Restaurant API。
- 原七个模板保留既有角色和注册页面品类选项；模板白名单扩展为原 API 已接受的所有品类，以免服务端改成模板校验时静默拒绝旧表单选项。
- Web 与小程序先选择行业，再展示对应身份/品类；快速邮箱与 Google 注册按模板设置 Restaurant 身份，不再落为服装供应商。
- 保持验证码要求为服务端安全边界：`registrationConfig.requireVerification=true` 时，快速注册必须提交已验证并消费过的邮箱 token；仅平台明确关闭验证要求时才允许省略。
- `registration=merchant` 与 `registration=enterprise` 共用直接企业注册入口，不增加第二套路由或身份系统。

### 本轮代码与验证状态

- 已改动 Web 注册入口及表单、商家快速注册请求、Google/邮箱快速注册服务端、公司注册服务端、共享模板/注册资料校验、小程序企业注册及对应测试；快速注册的 Prisma 关系字段已修复。
- `tests/merchant-onboarding-identity.test.ts` 与 `tests/merchant-miniprogram-registration.test.ts` 定向测试通过。
- `npm run test:restaurant-catalog:integration` 在隔离 PostgreSQL 上通过两条真实 HTTP 注册链路：邮箱快速注册返回 `201` / `setup_required` 并持久化 Restaurant 模板；Web 表单主链路验证邮箱后返回 `201`、`ACTIVE`、`merchantLoginAvailable=true`，数据库持久化 Restaurant 行业/模板/经营类型/角色/品类。主链路使用注册响应中的真实 `ruda_merchant_jwt` Cookie（非测试自行签发的 JWT）访问 Restaurant 桌台门店目录并得到 `200`。
- `npm run lint` 和 `npm run build:app:frontend-web` 通过；构建仅有既有 Vite 动态导入告警。浏览器只验证注册页面显示与视口布局，验证码响应被 mock，未通过真实浏览器表单创建账号；小程序开发者工具/真机仍待验收。
- 本地浏览器在 1440/820/390 宽度走到餐饮行业选择步骤，餐饮角色与品类可见且无横向溢出；验证码请求/验证使用 mock，未提交注册。截图：[1440](../../evidence/restaurant-onboarding/restaurant-registration-1440.png)、[820](../../evidence/restaurant-onboarding/restaurant-registration-820.png)、[390](../../evidence/restaurant-onboarding/restaurant-registration-390.png)。控制台有两次未登录 `/api/auth/me/company` 的 401，无 JavaScript 异常。
- 注册页 Impeccable 检测仍报告共享页脚的既有小字/低对比及嵌套容器；改动目录扫描另报告未改动的 `WeChatLoginButton` 对比度问题。本次仅将三个注册字段 placeholder 调至 `text-neutral-600`；未扩大到无关全站页脚/登录组件。
- 本次未运行生产数据库写操作、迁移、提交、推送或部署。
- Restaurant POS、支付、KDS、外卖履约与 AI Studio 未因开通表单完成而宣称交付；整体仍为「部分完成」。

## 16. V2.2 正式行业身份接入契约（2026-11-15）

### 目标与复用

- 正式行业注册以 [RUDA 多行业 AI 工作室 V2.2 规格](./modaui-industry-studios-v2.md) §2.1.1–§2.1.2 的 `formalIndustryId` 为准；旧 `industryTemplate` 仅用于工作区适配，`Merchant.industry` 继续表示兼容的 ModaGPT 行业包。
- 复用 `AccountIdentity`、`Merchant`、现有商家注册 API、`merchantIndustryTemplates` 兼容模板、`MerchantStudioEntitlement`、`requireMerchantTenant` 及现有 Web/小程序认证。不得新建身份/商家/权限系统。
- 新增的正式行业定义与旧模板适配关系必须由同一权威 industry registry 导出；注册请求不得覆盖 `studioCode`、AI 行业包、namespace、工作区模板或服务端权限。

### 数据与 API 契约

- `Merchant.formalIndustryId` 保存商家主经营行业的稳定 ID；旧行允许为空，以保留不能可靠推断行业的历史账号。
- `MerchantStudioEntitlement.formalIndustryId` 保存每条行业授权的稳定 ID；该表是多行业访问的权威来源。其原 `industryTemplate` 和 `industryCode` 字段继续作为旧工作区/AI 路由兼容上下文，不再充当正式行业授权。
- 尚未完成审核的 `/api/onboarding/merchant/submit` 申请在 `MerchantOnboardingApplication.formalIndustryId` 与 `industryCapabilityIds` 保存用户选择；审核通过时在同一个事务创建 Merchant 与 entitlement，不丢失行业/能力选择。
- Web 注册页直接使用正式行业 registry；小程序通过公开只读 `GET /api/merchant/industry-options` 读取同一 registry。响应为 `{ success, industries: [{ id, label, businessModel, capabilityIds, categories }] }`，只含已开放且有工作区适配器的行业，并设置 `Cache-Control: no-store`。两端不得维护第二份行业/能力代码表，提交均进入同一企业注册 API。
- `/api/auth/register/company`、商家兼容注册入口和 Google 入驻接受 `formalIndustryId` 与可选 `capabilityIds`；服务端先按 registry 校验正式行业状态、经营性质、允许的工作区适配器及能力白名单，再通过现有注册事务写入商家、主行业和一条 active Studio entitlement。Beauty/Hairstylist 在真实工作区、API、权限与主要流程通过验收前保持关闭，不得创建“成功开通但无功能”的后台。
- 隔离 HTTP/PostgreSQL 已通过 `bash scripts/test-merchant-miniprogram-isolated.sh` 验证：公开行业选项 API、全部当前开放正式 ID 注册、服装/皮具自有生产能力映射、主行业与 active entitlement 持久化、综合批发独立身份，以及非法跨行业 capability 被拒绝且不留下部分注册记录。生产数据库迁移未执行。
- 行业生产能力 ID 仅允许 `APPAREL_OWN_PRODUCTION`、`LEATHER_OWN_PRODUCTION`；只允许对应正式行业；能力授予与主行业/Studio 授权必须在同一数据库事务提交。若旧数据不能证明能力状态，不自动授予。
- `GET /api/merchant/studios` 返回稳定正式行业 ID、Studio ID、knowledge namespace、服务端确认的能力、适配器状态和当前 entitlement 状态；无权限、已撤销或 registry 不匹配的记录不返回可用访问。
- 新注册失败回滚商家、身份、仓库、Studio entitlement 等同一事务内的记录；禁止返回“注册成功”但 entitlement 未保存。旧客户端仍可按原 `industryTemplate` 兼容路径注册，返回的旧行为必须明确标记为 legacy compatibility，不能据此开放正式跨行业权限。

### 历史数据、三端和权限

- 不批量改写历史 `Merchant.industry`/`industryTemplate`。只将 V2.2 明确且可由原始模板证明的映射作为只读兼容依据；`trading_wholesale`、既有 `general_retail` 及缺少证据的自有生产状态不自动迁移。
- Web 与手机 Web 继续使用共享 API client，小程序继续使用现有商家认证请求；三端获得同一正式 ID/Studio entitlement 响应，商家租户始终从 JWT 解析。客户端隐藏菜单不算权限，业务/API 逐请求验证 entitlement 和员工权限。
- 多行业增加/撤销必须幂等，只修改目标正式行业行；撤销不得影响其它 Studio、旧商品/订单或历史工程文件。撤销后的 AI、项目、文件、知识空间和专业 API 请求必须由服务端拒绝。
- 旧注册行为保持可回滚：新 nullable 字段不改变旧 JWT；代码回滚后旧 `industryTemplate` 继续决定原工作区。正式新注册仅在 schema migration 成功后启用。

### 可执行验收

- 单元/契约：八个正式 ID 唯一、Studio/namespace 唯一、adapter 与经营性质相容；未知/关闭 ID、越行业 capability、客户端伪造 mapping 均拒绝；验证申请提交与审核审批保留 formal ID/capability；未授予生产能力时生产接口拒绝。
- 隔离 PostgreSQL HTTP：分别注册每个可开放正式行业，验证 `Merchant.formalIndustryId` 和 active entitlement 持久化；综合批发必须保留自己的 ID 且不能冒充百货批发或旧 Trade；跨租户/跨行业/已撤销 entitlement 请求拒绝；事务失败不留半成品。
- 三端：Web、手机 Web、小程序通过同一 API 读取完全一致的 formal ID 与可用能力；切换商家、员工权限和 entitlement 撤销后不能读取旧租户/旧行业缓存。
- 数据迁移：仅新增 nullable 字段与 entitlement 索引；不为模糊历史模板生成正式授权。部署前后需比较迁移前后记录数量及已有行业字段，回滚只回滚代码，保留新增 nullable 字段和正式授权记录。

本节为 V2.2 目标契约。未完成上述真实注册、数据库、权限与三端验收前，模块状态仍是「部分完成」；本节不宣称新行业已开放。

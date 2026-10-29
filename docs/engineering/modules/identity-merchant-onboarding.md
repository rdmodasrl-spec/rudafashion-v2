# 模块规格：统一身份与七行业商家注册即开通

- Module ID：`identity-merchant-onboarding`
- 模块状态：部分完成
- 文档阶段：开发中（先于本轮代码修改落盘）
- 日期：2026-10-28
- 对应运行面：公共前台 Web/手机、小程序买家入口、商家后台 Web/手机、商家小程序、平台总后台、服务端认证与 Prisma 数据模型

## 1. 问题与目标

RUDA 需要把普通采购客户注册、商家注册、平台管理员权限三条路径正式分开，同时保持同一套账号认证。当前仓库已有 `AccountIdentity`、`AuthAccount`、`Consumer`、`Customer`、`Merchant`、`MerchantEmployee`、`MerchantOnboardingApplication` 和七个正式开放的行业模板：`apparel_production_wholesale`、`apparel_wholesale`、`trading_wholesale`、`department_wholesale`、`bags_wholesale`、`department_chain_retail`、`general_retail`。当前商家注册主流程为验证联系方式后直接建立商家账号和所选行业后台；免费成为商家无需先提交 `MerchantOnboardingApplication`。历史 `/api/onboarding/merchant/submit` 申请流程仍是独立的补充资料/复核流程，不得成为注册和开始经营的前置门槛。

本模块正式确定：普通注册默认是采购/前台身份；商家通过验证联系方式的商家注册流程直接创建或关联企业与行业后台；资料可后续完善；平台管理员只能由总后台授权。同一自然人可通过同一 `AccountIdentity` 同时拥有客户身份和一个或多个商家管理身份，但每个业务身份的授权和数据范围必须分开。人工复核可用于例外/历史申请及公开销售治理，不阻止已完成账号验证的商家使用后台经营能力。

## 2. 非目标

- 不新增第二套登录系统、用户表、商家表或平台管理员注册入口。
- 不把所有普通注册用户升级为商家。
- 七行业工作区已存在；本规格不复制行业后台，只保证注册模板写入与现有模块注册表一致。
- 不重构现有服装生产批发商后台的商品、库存、订单、客户、供应商、员工和店铺网站业务。
- 不在前端隐藏菜单后绕过服务端权限；服务端仍逐请求校验租户和角色。

## 3. 复用现状与防重复检查

| 类别 | 现有能力 | 本模块复用/调整 |
|---|---|---|
| 统一账号 | `AccountIdentity(scope='public')`，`AuthAccount.identityId`，`getOrCreateSharedAccountIdentity()` | 继续作为同一自然人跨客户、公司、商家身份的账号纽带 |
| 前台客户 | `Consumer`、`Customer`、`AuthAccount(role='consumer'/'buyer')`，`/api/consumers/register`，`/api/auth/register/buyer` | 普通注册只获得前台/采购身份，不创建 `Merchant` |
| 商家主体 | `Merchant`、`AuthAccount(role='merchant')`、`MerchantEmployee` | 在验证联系方式的正式注册事务中创建或关联 |
| 历史/补充申请 | `MerchantOnboardingApplication`、`/api/onboarding/merchant/submit` | 保留为独立记录与复核流程，不作为当前免费开店入口 |
| 行业模板 | `src/constants/merchantIndustryTemplates.ts`、`src/server/merchantIndustryTemplates.ts` | 七个 open 模板使用服务端唯一解析与校验 |
| 商家三端 | `merchant-admin-web`、`merchant-admin-mobile`、`merchant-miniprogram` | 三端继续使用同一 `/api/merchant/*`、同一 JWT 租户边界和同一模板快照 |
| 总后台 | `requireAdminAuth`、`requireAdminPermission('merchants.review')` | 查询商家/处理例外申请走平台管理员权限；不得要求新商家等待人工审核才能使用后台 |

检索过的关键字和目录：`AccountIdentity`、`AuthAccount`、`Consumer`、`Customer`、`MerchantOnboardingApplication`、`register/merchant`、`register/company`、`requireBuyerAuth`、`requireMerchantTenant`、`industryTemplate`、`merchant-admin-web`、`merchant-admin-mobile`、`merchant-miniprogram`、`server.ts`、`prisma/schema.prisma`、`docs/engineering/modules/*`。

## 4. 身份与权限边界

| 身份 | 注册/授权来源 | 默认入口 | 权限边界 |
|---|---|---|---|
| 前端客户/采购商 | 前台、小程序或买家注册；`Consumer`/`Customer` + `AuthAccount(role='consumer'/'buyer')` | 前台商城、折扣商城、小程序买家页 | 不能访问商家后台 API；不能管理商品、库存、订单和员工 |
| 商家经营者 | 验证联系方式并提交七行业之一；服务端创建/关联 `Merchant` + `AuthAccount(role='merchant')` | 所选行业对应后台 | 只能管理自己被授权的商家；`merchantId` 来自 JWT，不信任客户端传入 |
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

状态转换只能由服务端执行。审核通过时必须在同一事务中创建或激活商家主体、商家登录账号、默认仓库、服装模板、ModaGPT 行业团队和审计记录；不得出现只创建账号但没有后台权限、或创建商家但没有账号的半成品。

## 6. API 契约

### 6.1 普通客户注册

- `POST /api/consumers/register`：创建前台消费者账户。
- `POST /api/auth/register/buyer`：创建采购商/买家账户。
- 结果：只签发消费者或买家会话；不创建 `Merchant`，不签发 `ruda_merchant_jwt`。

### 6.2 正式商家注册

- `POST /api/auth/register/company`（主注册表单）、`POST /api/auth/register/merchant` 与 `POST /api/auth/register/merchant/quick`（兼容入口）。
- 验证：遵循各端既有邮箱/手机验证及密码校验；公开请求不能声明管理员或伪造模板。
- 模板：通过 `resolveMerchantRegistrationTemplate` 只接受七个 open 模板。
- 写入：事务内持久化公司/统一身份、`Merchant.industryTemplate`、模板来源、默认仓库、商家账号及现有行业初始化能力；返回/设置商家会话。
- 业务资料不完整时显示待完善，不因此拒绝登录或冻结商品/订单权限。

### 6.3 历史/补充资料申请（非开店前置）

- `POST /api/onboarding/merchant/submit`
- 权限：公开入口；若用户已登录，后续可通过统一账号关联；当前公开提交必须提供联系邮箱。
- 模板：只接受七个 open 模板；未开放模板返回 `INDUSTRY_TEMPLATE_NOT_OPEN`。
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
- 正式注册且联系方式验证完成的商家：直接进入所选行业后台。
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
- 七个 open 模板各自通过 `POST /api/auth/register/company` 写入正确 `Merchant.industryTemplate`，并能建立对应 workspace 会话。
- `/register-wholesale?registration=merchant` 必须进入标准验证注册流程，不得再提交无密码/未验证的等待审核申请。
- `POST /api/onboarding/merchant/submit` 仅保留为历史/例外申请路径，不得作为商家后台访问前置条件。
- 历史申请管理员审核路径必须按申请模板创建商家、`AuthAccount(role='merchant')`、默认仓库，并写 `approvedMerchantId`。
- 商家 API 继续使用服务端 JWT 租户边界，客户端传入 `merchantId` 无效。

真实验收：

1. 普通客户注册后进入前台商城，不能访问 `/api/merchant/*`。
2. 同一账号提交商家入驻申请后仍保留采购身份。
3. 注册选择七行业任一行业后，无须额外人工审核即可登录对应后台。
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
- 已扩展 `MerchantOnboardingApplication` schema 与迁移 `20261028234000_merchant_onboarding_identity`，补充统一账号、公司、模板、资料快照和提交账号字段；默认新申请为 `pending_review`。
- 已调整 `/api/onboarding/merchant/submit`、`/api/auth/register/merchant`、`/api/auth/register/merchant/quick`：公开路径只创建入驻申请，不再签发商家 JWT，不直接创建正式商家后台。
- 已新增平台审核 API：`GET /api/admin/merchant-onboarding/applications` 与 `PUT /api/admin/merchant-onboarding/applications/:id/review`，由 `merchants.review` 权限保护；审核通过事务内创建服装生产批发商、商家账号、默认仓库、企业关联和 ModaGPT 行业团队。
- 已新增 `tests/merchant-onboarding-identity.test.ts`，覆盖开放模板、状态机、schema/migration、公开申请路径、兼容注册端点和平台审核闭环的静态契约。
- 已执行验证：`npx prisma format`、`npm run db:generate`、`node --import tsx --test tests/merchant-onboarding-identity.test.ts`、`npm run lint`、`git diff --check` 均通过。
- 待验收：真实浏览器/手机/小程序入驻页面、平台总后台审核页面、真实数据库 API 流程和历史商家登录回归；当前前端页面尚未接入新的申请状态响应。

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

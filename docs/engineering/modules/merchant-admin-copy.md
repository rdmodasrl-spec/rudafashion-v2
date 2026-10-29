# 商家端页面文案精简规格

- Module ID：`merchant-admin-copy`
- 模块状态：部分完成
- 文档阶段：开发中
- 日期：2026-10-24
- 对应负责人/团队（如适用）：RUDA 商家端产品与工程

## 1. 背景与问题

商家后台 Web、手机后台、共享商家业务组件及商家微信小程序存在重复说明、较长标题和冗余介绍，增加页面阅读负担。本次仅精简用户可见文案和确无业务作用的介绍区，不改变操作、业务规则、API、数据、权限或路由。

## 2. 目标与非目标

### 目标
- 页面主标题最多 4 个汉字；副标题最多 8 个汉字，标题已表达用途时删除副标题。
- 精简不必要的宣传介绍、重复提示和空状态文字，保留有用的业务、安全、隐私、付款和规则说明。
- 覆盖商家 Web、商家手机后台、商家微信小程序以及通过商家端弹窗/详情入口访问的共享商家组件。
- 以可运行的静态文案长度检查和相关构建验证整改结果。

### 非目标
- 不修改公共前台、公共商城、平台总后台、员工独立工作区或后端。
- 不调整信息架构、视觉主题、业务流程、路由、API、数据库、权限、状态或数据展示。
- 不删除有业务含义的字段、操作、警告、法务文本或确认步骤。

## 3. 现状审计与防重复检查

- 已检查源码、入口与路由：`src/apps/merchant-admin-web/MerchantAdminApp.tsx`、`MerchantPortal.tsx`、`src/apps/merchant-admin-mobile/MerchantAdminApp.tsx`、`MerchantMobileApp.tsx`、`src/apps/merchant-admin-common/components/merchant/`、`merchant-miniprogram/app.json` 及 `pages/`。
- 已检查工程文档：`AGENTS.md`、`docs/engineering/architecture.md`、`docs/engineering/module-registry.md`、模块规格模板。
- 关键词/目录：商家管理目标、merchant-admin、merchant-miniprogram、各页面标题/副标题/介绍/空状态、设置子页面与商家共享组件。
- 可复用能力：现有商家 Web/手机双入口、共享商家业务组件、`MerchantWorkspaceHeader`、现有导航/页面组件和各端现有文案；不新增组件、服务或副本。
- 已存在商家后台及小程序实现，本次直接精简既有文案，不创建第二套页面、业务逻辑或数据源。
- 入口路由：由 `src/apps/appTarget.ts` 选择商家 Web/手机构建目标；Web 页面入口是 `MerchantPortal`，手机后台入口是 `MerchantMobileApp`；小程序页面以 `merchant-miniprogram/app.json` 注册。

## 4. 归属与边界

- 所属业务域：商家后台。
- 使用运行面：商家后台 Web、商家后台手机端、商家微信小程序；商家共享组件中由上述入口加载的页面/弹窗。
- 模块负责：准确、自然的简体中文文案精简；仅删除无实际用途的介绍性内容。
- 模块不负责：公共商城、平台后台、商家独立网站及不属于商家端的公共页面。
- 调用方：既有商家管理入口、导航、弹窗及小程序页面。
- 正式入口：沿用各应用现有入口和页面映射，不新增路由。

## 5. 用户角色与权限

- 用户/角色：商家及按现有权限可访问商家端的员工。
- 服务端授权、租户边界和高风险操作保持不变；本任务不修改权限行为。

## 6. 用户流程与状态机

### 正常流程
1. 用户通过既有导航/卡片进入商家页面、详情、弹窗或小程序页面。
2. 页面显示简洁标题、必要字段/操作及有效状态提示。
3. 用户按现有流程操作，业务状态及返回结果保持原样。

### 状态与允许转换

不改变任何业务状态及其转换。

### 异常流程

保持既有验证、错误、无权限、超时及提交反馈；仅在不丢失原因和后续动作的前提下精简冗余句子。

## 7. UI/UX 规范

- 页面范围：商家经营主页、订单履约、商品/款式/SKU、库存/仓库/采购、客户/供应商、营销、财务、内容、AI/创作、POS、通知及设置子页；小程序注册的全部商家页面。
- 标题规则：页面主标题最多 4 个汉字；副标题最多 8 个汉字。中英文混合标题以语义清楚、自然为准，不简单截断；简短有歧义时保留必要原文并记录例外。
- 保留安全、隐私、支付、税务、配送、退款、业务规则、确认和错误原因等必要内容，改为简洁、明确表达。
- 桌面/手机端保持各自既有布局；不得靠截断或挤压达成字数要求。
- 复用原有设计系统和数据源，不添加装饰性文案、空白占位或模拟数据。

## 8. API 契约

- 复用原有 API 与共享 API client；本次无 API 新增或变更。
- 请求、响应、错误结构、认证、授权、幂等、分页、限流和兼容性均不变。

## 9. 数据与持久化

- 不修改权威数据模型、字段、索引、数据源或持久化行为。
- 无数据迁移；恢复方式为还原本任务中已修改的文案/介绍区。

## 10. 集成与事件

- 不新增事件、第三方服务或凭证；既有日志、监控和外部集成保持不变。

## 11. 测试计划

- 逐项核对导航注册页面和共享商家页面组件的可见标题、说明、空状态与设置子页。
- 静态检查商家 Web/手机/小程序中文主标题与副标题长度；记录依法/业务必要的例外。
- 执行 TypeScript lint、商家 Web 与手机独立构建、相关导航/页面测试及差异检查。
- 真实浏览器/小程序模拟器不可用时，明确标记端侧视觉待验收，不声称已验证。

## 12. 验收标准

- [ ] 修改仅限商家 Web、商家手机后台、商家共享组件、商家小程序及本规格/登记文档。
- [ ] 覆盖清单中的可达页面、详情和弹窗；未覆盖项有明确原因。
- [ ] 新增/修改的页面主标题不超过 4 个汉字，副标题不超过 8 个汉字；必要业务说明完整。
- [ ] 文案没有简单截断、错误语义、业务操作变化或新增模拟数据。
- [ ] 文案长度检查、相关构建/测试和 `git diff --check` 均报告真实结果。

## 13. 部署、兼容和回滚

- 环境变量/数据迁移：无。
- 受影响目标：`merchant-admin-web`、`merchant-admin-mobile`、商家微信小程序源码。
- 发布顺序：仅代码变更，不发布生产。
- 回滚：恢复本次文案与介绍区修改；无需数据库恢复。

## 14. 风险、假设与待确认

- `MerchantPortal.tsx`、`MerchantMobileApp.tsx` 及小程序页面承载大量动态交互；统一的标题/副标题定义需要按真实渲染判断，不能仅依靠字符串长度盲改。
- 商家小程序的隐私指引与服务协议属于法务文本，不得按普通介绍内容删改。
- 本次工作区开始时，商家端源码目录和 `docs/engineering/` 为未跟踪内容；改动必须保留其已有内容。

## 15. 实施记录

- 商家 Web：精简经营主页、工作台区块和入口操作文案，文件为 `src/apps/merchant-admin-web/MerchantPortal.tsx`。
- 商家手机端：精简库存、员工入口及表单文案，文件为 `src/apps/merchant-admin-mobile/MerchantMobileApp.tsx`。
- 商家共享组件：精简 `EmailApp.tsx`、`MerchantRfqCenter.tsx`、`AppStore.tsx`、`MerchantEmployeeMobileApp.tsx`、`MerchantGrowthWorkspace.tsx`、`MerchantProcurementWorkspace.tsx`、`MerchantReferralProgram.tsx` 中的标题、说明和状态反馈。邮箱能力未就绪的说明、AI 内容需人工审核等业务限制予以保留。
- 商家小程序：检查 `merchant-miniprogram/app.json` 注册页面及 `more` 动态入口；精简 assistant、counterparties、dashboard、login、order-create、orders、product-form、workspace、enterprise-register、privacy、service-agreement 页面文案。隐私/协议正文、安全提示和授权说明保留。
- 应用商店：前端目录及安装生命周期请求改为使用既有 `src/api/client.ts`；将安装、启停、卸载的英文反馈及确认提示改为简体中文，为已知 API 错误码提供用户可读提示，并在列表与详情入口禁用重复卸载点击。服务端路由、数据模型、权限及状态转换未修改。
- 邮箱域名配置：`EmailApp.tsx` 的状态/域名读取、添加与 DNS 验证统一使用共享 API client；错误码映射为简短中文，并在验证进行中阻止其他域名重复提交。邮箱托管仍未开通，页面仅处理域名所有权验证。
- 导航测试：`tests/merchant-mobile-navigation.test.ts` 将描述长度断言调整为“不超过 8 字”，并在 `src/i18n/uiCopyCatalog.ts` 补齐对应中意文案。
- 本次最终验证：`node --import tsx --test tests/app-store-validation.test.ts tests/api-client.test.ts tests/merchant-mobile-navigation.test.ts` 通过（16/16）；`npm run build:app:merchant-admin-web` 通过（release `20261023224551561-55ac0c56`）；`npm run build:app:merchant-admin-mobile` 通过（release `20261023224551470-7235b4fb`）；App Store/邮箱域名界面无直连 `fetch`，既有英文 API 提示扫描无匹配。前序小程序 JavaScript/JSON 语法检查及标题/文案长度扫描通过。
- 全仓 `npm run lint` 在 4 GB、8 GB、12 GB Node 堆限制下均因内存耗尽未完成，不能视为通过。未在本次运行 App Store 隔离 PostgreSQL 集成测试；没有使用生产数据库。
- 视觉验收：未完成。浏览器仅启动纯 Vite 前端时，商家 API 不可用，页面停留在加载状态；未取得真实商家登录态，也没有桌面/手机/小程序截图。
- 未完成项：本规格不代表所有商家模块业务闭环已审计或修复。本轮未重新逐条验收订单、商品/SKU、POS、库存、采购、客户、财务、店铺设置及小程序真实流程；这些模块仍需按业务流程逐项验证。状态保持“部分完成”。

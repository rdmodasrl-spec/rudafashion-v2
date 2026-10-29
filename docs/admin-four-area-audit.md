# RUDA 总后台四版块审计与迁移

## 审计范围与结论

依据当前源码核对总后台入口、菜单注册、桌面路由、移动端路由/回退、共享页面组件及后端管理员 API。导航数据源为 `src/apps/platform-admin-common/components/admin/adminNavigation.ts`；桌面内容路由在 `src/apps/platform-admin-web/PlatformAdmin.tsx`；移动端入口在 `src/apps/platform-admin-mobile/PlatformAdminMobile.tsx`；管理员 API 集中在 `server.ts`。

当前最终导航只保留四个版块。导航项目通过契约测试验证：名称均为四个汉字、每个页面只注册一次、可见项目归属四大版块之一。旧图库、社区、网页采集链接继续归一到时尚设计，不重复实现。

## 现有后台目录树

```text
RUDA 总后台
├── 业务管理
│   ├── 经营概览
│   ├── 商家管理
│   ├── 账号审核
│   ├── 客户管理
│   ├── 商品管理
│   ├── 专属授权
│   ├── 订单管理
│   ├── 库存管理
│   ├── 展厅管理
│   ├── 预约管理
│   ├── 收银管理
│   └── 结算管理
├── 增长运营
│   ├── 增长总览
│   ├── 招商获客
│   ├── 内容推广
│   ├── 增长数据
│   └── 时尚设计
├── 客服中心
│   ├── 客服会话
│   ├── 服务工单
│   ├── 买家客服
│   └── 客服设置
└── 平台管理
    ├── 平台设置
    ├── 智能代理
    ├── 运营助手
    ├── 模型管理
    ├── 计费管理
    ├── 风险监测
    ├── 生态应用
    ├── 消息通知
    ├── 数据备份
    └── 操作记录
```

## 实际页面、组件与子功能清单

| 路由/页面 | 实际组件或实现 | 审计结论 |
|---|---|---|
| 经营概览 | `PlatformAdmin.tsx` 内页 | 首页业务指标与快捷入口；快捷入口只跳转到正式业务页。 |
| 商家管理、账号审核、客户管理、商品管理、专属授权、订单管理、展厅管理、预约管理、收银管理、结算管理、消息通知、平台设置、操作记录 | `PlatformAdmin.tsx` 内页 | 共用管理员上下文和后端 API，不重复建应用或认证。账号审核页内含重复身份核验和采购商申请两个子页签；客户管理保留客户资料/业务记录，待审操作跳转至统一审核入口。展厅与预约按独立菜单分别渲染，预约仍使用既有数据与改期 API。 |
| 库存管理 | `AdminInventoryCenter.tsx` | 库存登记、流水和库存操作归一个正式页面。 |
| 增长总览 | `AdminGrowthWorkbench.tsx` | 周期指标、漏斗、招商待办、最新买手/商家与工具入口；数据源为 `growth/overview` 与 `growth/prospects`。 |
| 招商获客 | `AdminGrowthAcquisition.tsx`（内嵌 `AdminPartnerGrowth.tsx` 折叠区） | 潜在商家线索检索、状态流转与跟进；原代理网络保留在同一页折叠区。 |
| 内容推广 | `AdminGrowthContent.tsx`（内嵌 `AdminPromotions.tsx` 折叠区） | AI 渠道文案、推广草稿审核；原促销规则保留在同一页折叠区。 |
| 增长数据 | `AdminGrowthAnalytics.tsx`（内嵌 `AdminBIDashboard.tsx` 折叠区） | 指标口径、漏斗、渠道事件、AI 诊断；原经营报表保留在同一页折叠区。 |
| 智能代理、模型管理 | `AdminAiControlCenter.tsx` 的 agents/models 视图、`AdminGrowthWorkerCenter.tsx` | AI 员工/申请/反馈/ModaGPT 队列与 Growth Worker 统一归智能代理；模型服务配置按独立平台路由呈现。 |
| 运营助手 | `AdminModaGptOperator.tsx` | 商家资料/商品建档助手；从增长区移出，保留为平台管理独立入口。 |
| 促销管理 | `AdminPromotions.tsx` | 已内嵌到内容推广「促销活动」折叠区，不再单独占导航。 |
| 经营报表 | `AdminBIDashboard.tsx` | 已内嵌到增长数据「经营报表」折叠区，不再单独占导航。 |
| 风险监测 | `AdminRiskMonitor.tsx` | 风险告警及确认，不等同于系统运行监控。 |
| 时尚设计 | `AdminFashionContentHub.tsx` | 社区作品、图库、网页图片采集、创作工作台由一个内容中心承载；`AdminFashionCommunity.tsx` 与 `WebsiteImageCollector.tsx` 是内部子功能。 |
| 客服会话 | `AdminMerchantSupport.tsx` 默认模式 | 商家服务会话。 |
| 服务工单 | `AdminSupportRequests.tsx` | 用户咨询/支持请求处理记录。 |
| 买家客服 | `PlatformAdmin.tsx` 内页 | 站点客服助手问候语、兜底回复和快捷问题。 |
| 客服设置 | `AdminMerchantSupport.tsx` settings 模式 | 客服业务配置，与会话职责分开。 |
| 计费管理 | `AdminModaGptBilling.tsx` | 套餐、Credits 与 AI 功能计费配置；已从买家客服页面移出，只保留一个正式入口。 |
| 生态应用 | `AdminAppStoreMgmt.tsx` | 应用商店管理。 |
| 消息通知 | `PlatformAdmin.tsx`、`AdminNotificationEvents.tsx` | 通知配置与投递记录同属通知页，不再另造投递管理页面。 |
| 数据备份 | `AdminDatabaseCenter.tsx` | 当前同时承载数据库健康信息和备份/恢复；源码未显示一个独立系统监控页面，不人为拆造。 |
| 移动端 | `PlatformAdminMobile.tsx` | 订单、商家、客户、商品审核、库存、预约、通知、部分设置/日志等有原生移动实现；其余仍通过现有“切换电脑端”回退，未伪称全部已适配移动端。 |

### 组件目录清单

`src/apps/platform-admin-common/components/admin/` 当前源码：

```text
AdminAiControlCenter.tsx
AdminAppStoreMgmt.tsx
AdminBIDashboard.tsx
AdminDatabaseCenter.tsx
AdminEmailMgmt.tsx
AdminFashionCommunity.tsx
AdminFashionContentHub.tsx
AdminGrowthAcquisition.tsx
AdminGrowthAnalytics.tsx
AdminGrowthContent.tsx
AdminGrowthWorkbench.tsx
AdminGrowthWorkerCenter.tsx
AdminInventoryCenter.tsx
AdminMerchantSupport.tsx
AdminModaGptBilling.tsx
AdminModaGptOperator.tsx
AdminNotificationEvents.tsx
AdminPartnerGrowth.tsx
AdminPromotions.tsx
AdminRiskMonitor.tsx
AdminSupportRequests.tsx
WebsiteImageCollector.tsx
adminNavigation.ts
aiProviderSettings.ts
```

桌面总后台由 `PlatformAdminApp.tsx` 进行管理员身份入口校验并识别 `adminTab` 深链；移动入口由 `PlatformAdminMobile.tsx` 处理。主业务数据和服务仍由共享 `B2BContext`、`src/api/client` 与 `server.ts` 提供。

## 旧目录迁移表

| 原页面/入口 | 新归属 | 处理 |
|---|---|---|
| 经营概览、商家管理、账号审核、客户管理、商品管理、专属授权、订单管理、库存管理、展厅管理、收银管理、结算管理 | 业务管理 | 保留原业务页；预约从展厅页面拆为独立入口。 |
| 原「增长总览」`growth` | 增长运营 / 增长总览 | 旧 `AdminGrowthCenter` 删除，改由 `AdminGrowthWorkbench` 呈现指标、漏斗与待办。 |
| CRM 跟进、Growth Mission | 增长运营 / 招商获客 | 线索与跟进归入 `growth_acquisition`，复用 `growth/prospects*`、`growth/crm/follow-ups`。 |
| 内容活动、渠道连接 | 增长运营 / 内容推广 | AI 文案与活动审核归入 `growth_content`。 |
| UTM、Referral 归因、经营报表 | 增长运营 / 增长数据 | 指标口径与诊断归入 `growth_analytics`；经营报表内嵌折叠区。 |
| 促销管理 | 增长运营 / 内容推广 | `AdminPromotions` 原样内嵌「促销活动」折叠区。 |
| 代理管理 | 增长运营 / 招商获客 | `AdminPartnerGrowth` 原样内嵌「代理网络」折叠区。 |
| AI 控制中心 / AI 员工 / Growth Worker | 平台管理 / 智能代理 | 员工、申请、反馈、ModaGPT 任务队列和 Growth Worker 集中呈现。 |
| AI 控制中心 / 模型通道配置 | 平台管理 / 模型管理 | 从混合页面中分出独立视图，复用原 API。 |
| 运营助手 | 平台管理 / 运营助手 | 保留 `AdminModaGptOperator` 独立入口，不再占用增长区导航。 |
| 风险监测 | 平台管理 / 风险监测 | 从增长区移到平台管理，仍直接访问原页面。 |
| 时尚内容、图库、社区、网页采集 | 增长运营 / 时尚设计 | 图库/社区/采集别名统一到时尚设计。 |
| 商家服务、支持请求、客服助手、客服设置 | 客服中心 | 会话、工单、买家客服和设置保持职责分离。 |
| 客服助手页内 ModaGPT 套餐计费 | 平台管理 / 计费管理 | 移出客服页，仅保留一个计费入口。 |
| 平台设置、生态应用、消息通知、数据备份、操作记录 | 平台管理 | 保留原业务实现。 |
| 展厅页面中的预约列表 | 业务管理 / 预约管理 | 拆出独立路由；改期仍使用原预约 API。 |
| `gallery`、`fashion_community`、`website_collector` 深链 | 增长运营 / 时尚设计 | 别名映射到统一内容中心，并保留相应初始子视图。 |
| 采购商城快捷入口 | 业务管理范围外的外部跳转 | 桌面和移动总后台各自视图保留唯一快捷入口，显示“外部”标记并跳转共享商城，不是后台页面。 |
| 企业邮箱管理组件 | 不纳入可用导航 | 组件存在，但总后台没有渲染入口；它请求的 `/api/admin/email/overview` 在 `server.ts` 中不存在。保留源码，不宣称已上线，也不擅自删除。 |

## 重复、隐藏、缺失与权限核对

- **已处理的重复入口**：ModaGPT 计费原来嵌在买家客服页，现移至唯一的计费管理路由；内容图库、社区和采集由时尚设计统一承载，旧深链只做别名跳转。
- **保留的内部子功能**：增长总览只展示指标/趋势和待办；Growth Worker 归智能代理，运营助手独立在平台管理；客户线索与跟进归招商获客；AI 文案与活动审核归内容推广，促销规则内嵌其中；指标口径、归因诊断归增长数据，经营报表内嵌其中；通知投递记录属于消息通知；图库、社区和网页采集属于时尚设计。
- **账号审核归并**：现有账号审核 API 是重复身份/邮箱核验；已有采购商审批由 `reviewCustomer` 执行，现并入账号审核的“采购审核”子页签。商家列表当前提供商家资料管理与销售状态开关，没有发现独立的商家入驻审批工作流，因此没有伪造新的商家审核队列。客户资料继续由客户管理负责，待审动作只从那里跳转到统一入口。
- **未发现独立后台权限管理页面**：权限判定仍由后端管理员认证/权限中间件提供；本次没有改动认证、租户隔离或 API 权限策略。
- **API 审计计数**：`server.ts` 中匹配到 217 个 `/api/admin/` 路由声明；217 个均经过 `requireAdminAuth`，171 个声明 `requireAdminPermission`，5 个声明 `requireAnyAdminPermission`。其余管理员路由仍有管理员身份认证，但不都有单独的细粒度权限中间件；不能把“管理员身份认证”误称为“逐页权限配置”。
- **系统监控**：当前看到数据库健康/备份页和业务风险告警页；没有把后者冒称为系统监控，也未添加虚构功能。
- **导航审计结果**：当前 4 个一级版块、31 个唯一可见页面键；所有一级/二级导航名为四个汉字。测试覆盖唯一归属、四字纯中文标签、旧内容别名与新增路由。
- **未声称完成的工作**：本次仅静态核对源码路由和权限声明；没有逐个登录后台执行真实业务操作，也没有生产环境部署。当前没有可用的已登录浏览器会话，因此未生成真实后台页面截图。不得用未登录/未部署页面冒充已验收截图。

## 修改与验证

本轮功能修改：

- `src/apps/platform-admin-common/components/admin/adminNavigation.ts`
- `src/apps/platform-admin-common/components/admin/AdminGrowthWorkbench.tsx`（新增）
- `src/apps/platform-admin-common/components/admin/AdminGrowthAcquisition.tsx`（新增）
- `src/apps/platform-admin-common/components/admin/AdminGrowthContent.tsx`（新增）
- `src/apps/platform-admin-common/components/admin/AdminGrowthAnalytics.tsx`（新增）
- `src/apps/platform-admin-common/components/admin/growthAdminErrors.ts`（增长错误映射）
- `src/apps/platform-admin-common/components/admin/AdminPromotions.tsx`（`embedded` 支持）
- `src/apps/platform-admin-common/components/admin/AdminPartnerGrowth.tsx`（`embedded` 支持）
- `src/apps/platform-admin-common/components/admin/AdminBIDashboard.tsx`（`embedded` 支持）
- `src/apps/platform-admin-common/components/admin/AdminGrowthCenter.tsx`（删除）
- `src/apps/platform-admin-common/components/admin/AdminAiControlCenter.tsx`
- `src/apps/platform-admin-web/PlatformAdmin.tsx`
- `src/apps/platform-admin-mobile/PlatformAdminMobile.tsx`
- `tests/admin-navigation.test.ts`、`tests/growth-content-analytics.test.ts`、`tests/growth-admin-errors.test.ts`

其他与本任务相邻的未跟踪后台改动仍按工作树原状保留；没有重置或删除工作树内容。

验证结果：

- `npx tsc --noEmit -p tsconfig.json`：通过，无诊断。
- `npm run test:unit`：通过，930/930（新增增长错误映射与导航/内容分析契约用例）。
- `npm run build:app:platform-admin-web`：通过。
- `npm run build:app:platform-admin-mobile`：通过。
- `git diff --check`：仓库整体仍因既有未提交文件（如 `src/context/B2BContext.tsx`）报尾随空格失败，与本次后台文件无关；增长相关组件与文档当前为未跟踪文件，已单独做尾随空白扫描并通过。

**增长四工具复核（2026-10-26）：**

- 增长总览：`overview`、逾期线索、推广活动三个请求改为 `Promise.allSettled`，单块失败不清空其他成功区块；周期与刷新使用请求序号丢弃过期响应；工具网格补齐「时尚设计」并直达 `fashion_content`。
- 招商获客：检索输入 300ms 防抖；列表与详情分别使用请求序号；公司名称改为可聚焦按钮打开详情；新增状态字段 `aria-label`；表格容器支持横向滚动。
- 内容推广：推广活动标题改为「推广活动审核」；保存前校验活动名称、推广目标与文案；保存/审核开始时清理旧错误与提示，结果提示在重新加载草稿后保留；草稿刷新使用请求序号。
- 增长数据：周期切换作废在途 AI 诊断并清空旧快照；指标、漏斗、渠道事件和诊断分别显示加载/失败/空状态；诊断失败在卡内显示整改提示；内嵌经营报表、促销、代理网络隐藏重复主标题。
- 静态核对：`growth/overview` 的 `channelEvents`、`metricDefinitions`，`growth/analysis` 的 `analysis`/`notice`，线索详情 `{ prospect, followUps }`，`growth/campaigns` 的 `{ campaigns }` 与前端类型一致。
- 本轮复核命令：`npx tsc --noEmit -p tsconfig.json` 通过；`npm run test:unit` 930/930；桌面与手机后台构建通过；本次七个后台组件与两份文档通过尾随空白扫描（这些文件当前为未跟踪文件，`git diff --check` 不覆盖其内容）。
- 未完成：没有可用的已登录浏览器会话，未执行真实页面点击与截图；四页仍为「未验收」，不以构建成功替代端侧验收。

## 逐页 UI 整改与真实验收进度（2026-10-23）

本轮增加共享 `AdminPageHeader`，统一标题字级、字重、边框间距及右侧操作区，并用于多个导航页面/视图；当前增长区已重构为增长总览、招商获客、内容推广、增长数据与时尚设计。这些是组件级标题样式和文字调整，不代表页面内表格、弹窗、权限和业务操作已经逐项验收。

| 版块 | 导航页面 | 页面组件/源码位置 | 本轮状态 | 人工验收状态 |
|---|---|---|---|---|
| 业务管理 | 经营概览 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 商家管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 账号审核 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 客户管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 商品管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 专属授权 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 订单管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 库存管理 | `AdminInventoryCenter.tsx` | 未整改 | 未验收 |
| 业务管理 | 展厅管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 预约管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 收银管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 业务管理 | 结算管理 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 增长运营 | 增长总览 | `AdminGrowthWorkbench.tsx` | 指标/漏斗/待办/待审文案与四工具入口；三个请求独立失败、过期响应丢弃；业务未验收 | 未验收 |
| 增长运营 | 招商获客 | `AdminGrowthAcquisition.tsx` | 线索与跟进；搜索防抖、列表/详情过期响应保护；代理网络内嵌无重复标题 | 未验收 |
| 增长运营 | 内容推广 | `AdminGrowthContent.tsx` | AI 文案与活动审核；名称/目标校验、草稿请求保护；促销内嵌无重复标题 | 未验收 |
| 增长运营 | 增长数据 | `AdminGrowthAnalytics.tsx` | 指标口径与诊断；周期切换作废旧响应，诊断失败在卡内提示；经营报表内嵌无重复标题 | 未验收 |
| 增长运营 | 时尚设计 | `AdminFashionContentHub.tsx` | 移除重复的创作引导标题 | 本轮未复拍 |
| 客服中心 | 客服会话 | `AdminMerchantSupport.tsx` operations 模式 | 标题改为导航名称并移除重复介绍 | 本轮未复拍 |
| 客服中心 | 服务工单 | `AdminSupportRequests.tsx` | 标题统一；业务未验收 | 未验收 |
| 客服中心 | 买家客服 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 客服中心 | 客服设置 | `AdminMerchantSupport.tsx` settings 模式 | 统一标题样式并移除重复介绍 | 本轮未复拍 |
| 平台管理 | 平台设置 | `PlatformAdmin.tsx` | 未整改 | 未验收 |
| 平台管理 | 模型管理 | `AdminAiControlCenter.tsx` | 未整改 | 未验收 |
| 平台管理 | 计费管理 | `AdminModaGptBilling.tsx` | 未整改 | 未验收 |
| 平台管理 | 生态应用 | `AdminAppStoreMgmt.tsx` | 标题改为导航名称并统一样式；业务未验收 | 未验收 |
| 平台管理 | 消息通知 | `PlatformAdmin.tsx`、`AdminNotificationEvents.tsx` | 未整改 | 未验收 |
| 平台管理 | 数据备份 | `AdminDatabaseCenter.tsx` | 未整改 | 未验收 |
| 平台管理 | 操作记录 | `PlatformAdmin.tsx` | 未整改 | 未验收 |

**最新浏览器检查（源码预览，非生产发布）：**上一版导航（32 个页面键）曾在桌面/手机 1440×1000、390×844 各打开 32/32 并截图；当前导航已缩为 31 个页面键，新增的增长四个工具尚未重新截图。旧截图保存在 `/home/moda/.copilot/session-state/fb9830ac-1800-4832-b6e7-2ccac740c854/files/admin-ui-evidence/`，不能作为本次新工具的最新验收证据。

**后续代码更新（2026-10-23）：**本轮为手机端补齐商品审核、订单状态推进、预约状态处理、专属授权审核和现场 POS 销售，均复用现有 API/共享 Context；构建及对应测试通过，但未部署、未运行登录态浏览器验收。当前源码路由映射仍将“账号审核”和“买家客服”交接到桌面端。以上代码变化未包含在前述 64 张截图中，需在测试账号可用后重新拍摄并实测。

**域名访问：**已将共享浏览器切换至 `https://admin.ruda.fashion/admin?ruda-app=platform-admin-web&adminTab=app_store_mgmt`。域名可访问，但当前会话呈现管理员登录页并有 401，因此无法使用线上页面验证本地源码修改；未尝试绕过认证或修改生产配置。

这次是路由可访问性扫描和截图留档，不等于 64 张截图都已人工逐页验收，也没有逐页执行业务操作、权限边界或表单提交测试。已人工检查概览、生态应用、风险监测、操作记录及三个手机回退页面；其余页面仍标记为未验收。扫描中出现外部图片 `ERR_FAILED`、空 `src` 浏览器警告，以及操作记录页相关 API 500；这些问题需要分别核查，不能记为通过。企业邮箱仍没有确认到独立入口及概览 API，因此不计入 32 项真实导航页面。

**本轮实际改动：**新增 `AdminPageHeader.tsx`；将其用于 `AdminAppStoreMgmt.tsx`、`AdminSupportRequests.tsx`、`AdminMerchantSupport.tsx`、`AdminPromotions.tsx`、`AdminRiskMonitor.tsx`、`AdminBIDashboard.tsx`、`AdminPartnerGrowth.tsx`、`AdminFashionContentHub.tsx`、`AdminModaGptOperator.tsx`（历史记录中的 `AdminGrowthCenter.tsx` 已在此后重构中删除）。精简生态应用卡片长描述、客服/代理页面重复说明、时尚设计引导标题和运营助手说明；运营助手与促销页内嵌子模块隐藏重复主标题，同时保留刷新操作。风险监测手机卡片收紧；应用编辑表单仍保留完整描述字段。没有修改 API、数据库、认证、权限或生产发布指针。

**本轮验证：**

- `node --import tsx --test tests/admin-navigation.test.ts`：通过，3/3。
- `npm run build:app:platform-admin-web` 与 `npm run build:app:platform-admin-mobile`：通过，生成本地 release；未切换 `current.json`、未部署。
- 桌面和移动 32 路由扫描：均生成截图，文档级横向溢出为 0。
- `NODE_OPTIONS=--max-old-space-size=8192 npm run lint`：先前一次运行报告 60 条 TypeScript 诊断，分布在服务端、脚本、消费者认证、Prisma/ModaGPT 及相关测试；本次后台管理 UI 修改文件未出现在诊断中。最终复跑因 Node.js 堆内存耗尽退出。因此 lint 未通过，不能报告全仓类型检查通过。

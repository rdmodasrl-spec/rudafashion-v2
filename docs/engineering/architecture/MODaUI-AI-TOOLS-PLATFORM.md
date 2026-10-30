# MODAUI AI TOOLS PLATFORM —— 专业 AI 创作与营销平台（协议、门禁与能力范围）

> **文档状态**：v0.2。协议与门禁（P0）已实施并验证；专业工作中心（图片/视频/语音/发布/分析）为**规划**，未接通前不提供任何入口或假结果。
> **基线日期**：2026-10-30。**代码基线**：分支 `main`。
> **适用范围**：MODAUI / ModaGPT 商家侧 AI 能力、App Store 安装机制、工具执行、计费与租户隔离。
> **不适用范围**：已冻结的服装生产批发、服装批发行业 AI 行为（只允许"不改变行为地"接入本协议）。

---

## 1. 结论摘要

1. **平台已经有真正的工具执行层，不需要另建。** `ModaGptToolDefinition` + `createModaGptToolRuntime` 已经强制了权限、租户、审批、超时、重试、审计六件事（`src/server/modagptRuntime.ts:97-110`、`209-233`、`235-330`）。这是本次设计必须复用的核心。
2. **真正的断点在"安装"与"能力"之间。** 在 AI 能力链路上，安装记录 `AppInstallation` **没有任何读取方**（唯一把安装当门禁的地方是 `src/server/productionChain.ts:256`，且 `PRODUCTION_APP_ID` 写死）；而"能否安装"被硬编码在 `appStoreNativeRuntimes` 的两个 appId 白名单里（`src/server/appStoreValidation.ts:7-10`）。也就是说：**门禁模式被验证过一次，但从未泛化**。
3. **第一期不做 AI 公司，只做三件事**：Tool Manifest 注册协议、安装→能力授权的正式解析链、工具执行与计费的统一入口。AI 公司（多员工组织）作为后续可安装应用，建立在同一协议之上。

> 一句话边界：**App 是可安装的商业单元，Tool 是可执行的能力单元，Employee 是调度角色，Workflow 是编排模板。四者不得互相顶替。**

---

### 1.1 产品定位（2026-10-30 产品决策）

MODAUI AI Tools 的定位是**专业级 AI 创作与营销平台**，不是模型清单或小工具合集。商家不需要认识模型，
只需要表达目标；由 MODAUI 原生 AI Runtime 选择工具并组合执行。

六个工作中心（产品范围，按真实接通情况逐个开放）：

| 工作中心 | 职责 | 当前状态 |
|---|---|---|
| 创作工作台 | 自然语言目标 → 任务计划 → 审批 → 组合执行 | 计划 |
| 图片工作室 | 生图、多参考图、局部编辑、商品一致性、虚拟试衣 | 未接通（无图片供应商凭据） |
| 视频工作室 | 文生视频/图生视频、时间轴剪辑、渲染导出 | 未接通 |
| 语音与多语言 | 配音、跨语言、字幕时间戳 | 未接通；当前只提供文本翻译 |
| 发布中心 | 账号授权、排期、多平台真实发布与回执 | 未接通 |
| 品牌与素材 | 品牌规范、商品素材、版本、授权记录 | 计划（复用现有对象存储） |
| 营销分析 | 平台真实表现数据、对比与建议 | 未接通 |

**工具准入标准（全部满足才可进入正式清单）**：真实 API 或真实本地处理；明确商用许可；明确输入输出契约；
真实任务状态与结果；可记录费用；失败/超时/重试；商家租户隔离；可被原生 AI 自动调用；应用内可独立使用；
有真实质量验收。

**明确排除（不占正式工具位）**：重复的 AI 聊天壳、只换名字的提示词模板、无真实 API 的视频入口、
通用格式/PDF 转换、Emoji/头像/随机贴纸、只能叠字的"设计工具"、不能真正编辑的假剪辑器、
不接真实账号的自动发布按钮、无真实来源的"热门趋势"。

### 1.2 能力状态矩阵（唯一可信的"做到哪一步"）

状态只允许：**已完成 / 部分完成 / 待验证 / 未接通 / 被阻塞**。

| 能力 | 状态 | 证据 / 依赖 |
|---|---|---|
| Tool Manifest v1（协议、校验、投影） | 已完成 | `src/server/aiToolManifest.ts`、`src/server/aiToolRegistry.ts`、`tests/ai-tools-manifest.test.ts` |
| 安装 → 7 天 `MerchantToolGrant` 试用 | 已完成 | `POST /api/app-store/installations`、`grantAppTools` |
| 卸载/停用 → 撤销/暂停授权 | 已完成 | `DELETE /api/app-store/installations/:appId`、`setAppToolGrantState`、`revokeAppToolGrants` |
| 运行时门禁（未安装=不可调用，核心工具不受影响） | 已完成 | `modagptMerchantTaskExecutor.ts` 工具集过滤 |
| 管理端 Manifest 保存与读取 | 已完成 | `GET/PUT /api/admin/app-store/apps/:id/manifest` |
| 商家端工具清单/暂停/单次执行 | 已完成 | `GET /api/merchant/ai-tools`、`PATCH .../:toolId/grant`、`POST .../:toolId/invoke` |
| 商品文案创作（`ai_tools_write_copy`） | 已完成（代码 + 单测；真实模型调用待线上验证） | `src/server/modauiAiTools.ts`，复用 `generateAiEmployeeText` |
| 多语言翻译（`ai_tools_translate`） | 已完成（同上） | 同上 |
| 图片/视频/语音/发布/分析 | **未接通** | 仓库当前仅有 `GEMINI_API_KEY`；OpenAI 图片、Kling、Cloudinary、Runway/Shotstack、ElevenLabs、Ayrshare 均需商务与凭据，未接入即不提供入口 |
| 工具计费与额度 | **未接通** | Manifest `cost.credits` 当前固定为 0（不计量），P1 接 `ModaGptBillingSubscription` 后再启用 |

> 规则：**未接通的能力不得出现在可点击入口里，也不得用 Mock/静态进度伪装成功。** 新增能力必须先在此表把状态改为"已完成"并附证据。

### 1.3 Provider Adapter 契约（规划，未实现）

外部供应商一律通过适配器接入，**业务代码不得写死模型名称**。适配器必须实现：

```ts
type ProviderResult<T> = { ok: true; output: T; cost: { providerTaskId: string; amount: number; currency: string } }
  | { ok: false; error: string; retryable: boolean; providerTaskId?: string };

interface ProviderAdapter<Request, Output> {
  providerKey: string;                     // 供应商键，非模型名
  capabilities: string[];                  // image.generate / image.edit / video.generate / voice.tts / publish.social ...
  estimateCost(request: Request): { credits: number; currency: string };
  submit(request: Request, ctx: AdapterContext): Promise<{ providerTaskId: string }>;
  poll(providerTaskId: string, ctx: AdapterContext): Promise<ProviderResult<Output>>;
  cancel?(providerTaskId: string, ctx: AdapterContext): Promise<void>;
}
```

约束：凭据只在服务端读取（`credentialKey` 由 Manifest 声明）；每次调用记录 `providerTaskId` 供对账；
超时/重试幂等；不同商家数据隔离；供应商价格与 MODAUI 售价分开存储。

**自动路由**：按目标、输入素材、目标平台、质量等级、预算、时延、可用供应商选择适配器；
普通商家不选模型，高级用户只选"快速/标准/专业"质量档。

---

## 2. 现状审计（只读，逐文件核对）

> 行号为本轮审计时基线；实现变更后以代码为准。

### 2.1 App Store 现状

| 项 | 事实 | 证据 |
|---|---|---|
| 数据模型 | `AppCategory` / `App` / `AppInstallation`，安装唯一键 `(merchantId, appId)` | `prisma/schema.prisma:1884`、`1895`、`1920` |
| 应用字段 | `appId`、`name`、`slug`、`status`、`pricingType`、`pricePlan(Json)`、`permissions(Text/JSON 字符串)`、`features(Text)`、`version` | `prisma/schema.prisma:1895-1918` |
| 安装状态 | `installed` / `active` / `disabled` | `src/server/appStoreValidation.ts:56-70` |
| 商家接口 | `GET /api/app-store/apps`、`POST /api/app-store/installations`、`POST /api/app-store/installations/:appId/enable`、`.../disable`、`DELETE /api/app-store/installations/:appId` | `server.ts:19116`、`19152`、`19235`、`19241`、`19247` |
| 平台接口 | `/api/admin/app-store/{categories,apps}`、`apps/:id/installations`，权限 `settings.integrations` | `server.ts:19308-19430` |
| 安装权限 | 员工需 `employees.manage` 或 `store_manager` | `server.ts:19154` |
| 审计/事件 | 安装写 `APP_INSTALLED`；安装与启停触发 `merchantSyncEventHub` | `server.ts:19180`、`6038-6049` |

**已确认的三个硬缺陷（本次设计的直接起因）**

- **A1 白名单硬编码**：`appStoreNativeRuntimes = { 'ruda-business-email': '1.0.0', 'ruda-production-chain': '1.0.0' }`，其它应用一律 `APP_STORE_RUNTIME_UNAVAILABLE`；版本还要求完全相等（`appStoreValidation.ts:7-10`、`37-48`）。
- **A2 只允许免费**：`getAppStoreInstallationError` 强制 `pricingType === 'free'`，否则 `APP_STORE_PURCHASE_REQUIRED`（`appStoreValidation.ts:46`）。付费/订阅应用当前**无法安装**。
- **A3 安装未被泛化消费**：`/api/app-store/apps` 会用安装记录返回 `isInstalled/installationStatus`（`server.ts:19116-19145`），并把 `runtimeAvailable` 直接取自白名单函数；唯一**能力门禁**消费方是 `src/server/productionChain.ts:256`（`status: 'active'` + `PRODUCTION_APP_ID` 写死）。**AI 工具链（`createModaGptMerchantTools` / supervisor / runtime）完全不知道"应用"的存在**；`App.permissions` 同样只在写接口被 `parseAppStoreStringArray` 解析存库，运行时零消费。

> 结论：现状是"**应用商店是展示与台账，不是能力开关**"，与用户指出的"安装机制与动态工具注册未打通"完全一致。

### 2.2 工具层现状（可复用，但需外置为协议）

`ModaGptToolDefinition`（`modagptRuntime.ts:97-110`）字段：`name`、`description`、`inputSchema`、`outputSchema`、`permission`、`riskLevel`、`requiresApproval`、`timeoutMs`（100–60000）、`retryPolicy{maxAttempts 1–3, idempotent}`、`auditPolicy:'required'`、`validateInput`、`validateOutput`。

**已有 Manifest 主体，缺**：`version`、`appId` 归属、`industry[]`、`employees[]`、`creditCost`、`usageUnit`、启用/停用状态、凭据声明、`adapter`（http/mcp/native）。

运行时强制项（`modagptRuntime.ts:235-330`）：重复工具拒绝、定义合法性校验、`tenantId` 必须等于 principal 租户、权限双检（用户权限 + 员工权限）、审批令牌校验、输入校验、审计 start/succeeded/failed、超时、重试（>1 次必须 idempotent）、租约断言 `assertLease`。

现有工具（`src/server/modagptMerchantTools.ts`）：**21 个定义 + 21 个 handler**

| 分组 | 工具 |
|---|---|
| 商品 | `get_products`、`create_product_draft`、`update_product_draft`、`publish_product`(HIGH+审批)、`unpublish_product`(HIGH+审批) |
| 客户/报价 | `get_customers`、`create_quote_draft`、`get_quote`、`update_quote`、`submit_quote`、`send_quote` |
| 采购/财务 | `get_suppliers`、`create_procurement_draft`、`get_supplier_performance`、`currency_convert` |
| 经营分析 | `order_summary`、`sales_summary`、`inventory_summary`、`product_performance`、`customer_performance`、`finance_summary` |
| 工作流专用 | `get_inventory`、`get_sales`（`createModaGptInventoryReadTools`，`modagptRuntime.ts:495`） |

**缺口**：定义散落在 TypeScript 字面量中，与"哪个应用提供、哪个行业可用、多少钱、能否停用"完全解耦；新增工具必须改代码并重新发布服务端。

### 2.3 执行层现状

| 项 | 事实 | 证据 |
|---|---|---|
| 任务模型 | `ModaGptTask`：`taskType/status/payload/result/idempotencyKey/attempts/maxAttempts/availableAt/lockedBy/lockedUntil/tenantId/actorId/traceId/parentTaskId/goal/priority/agentId/context/plan/error` | `prisma/schema.prisma:2475-2515` |
| 状态机 | `queued/planning/running/waiting_approval/verifying/retrying/completed/failed/dead_letter/cancelled` + `canTransitionModaGptTask` | `src/server/modagptTaskQueue.ts:14-35` |
| 队列 | `ModaGptTaskRuntime`（别名 `ModaGptTaskQueue`）：租约、幂等键、attempts/maxAttempts、延迟 `availableAt` | `modagptTaskQueue.ts:152-430` |
| Worker | `startModaGptTaskWorker(queue, handlers, leaseMs)`，按 `taskType` 分发 | `src/server/modagptTaskWorker.ts:3-40` |
| 任务类型 | **仅 6 种**：`ai.event`、`ai.workflow.run`、`ops.health_check`、`growth.mission.review`、`studio.social.import`、`studio.video.trim` | `modagptTaskQueue.ts:4-11` |
| 商家任务执行 | `executeModaGptMerchantTask`（1036 行）在 `ai.workflow.run` handler 内调用 | `server.ts:48150`、`48230`；`modagptMerchantTaskExecutor.ts:38` |
| 意图路由 | `superviseModaGptCoreTask`：正则匹配 6 个 workflow，输出 `agents/tools/execution(ready / workflow_unavailable / agent_unavailable / tools_unavailable)` | `src/server/modagptTaskSupervisor.ts:4-11`、`111-149` |
| 可执行 workflow | 4 个：`product_publish`、`customer_quote_creation`、`business_analysis`、`procurement_management` | `modagptTaskSupervisor.ts:13-22` |
| 编排 | `createModaGptExecutionPlan` / `executeModaGptPlanWithVerification` / `replanModaGptPlan` | `src/server/modagptOrchestration.ts:27`、`93`、`190` |
| 预览接口 | `POST /api/merchant/modagpt/task/preview`：真实跑 supervisor + 权限预检，返回真实 422/503 | `server.ts:34980-35040` |

链路已经是"目标 → 路由 → 计划 → 工具 → 验证 → 审批 → 回读验证"，**缺的只是"这次调用属于哪个已安装应用 / 哪个可计费工具"这一维度**，因此无法按应用停用与计费。

### 2.4 员工层现状（**已存在两套，禁止再加第三套**）

| 体系 | 内容 | 证据 |
|---|---|---|
| 现行（ModaGPT 行业包） | 每行业 4 个核心员工（`business-manager`、`product-creative-manager`、`sales-customer-manager`、`supply-chain-finance-manager`），含 `skills/tools/defaultPermissions/memoryScope/knowledgeTags/modelPolicy/riskPolicy`，`status: pilot`、`writesRequireApproval: true` | `src/server/modagptCoreEmployees.ts:34-101` |
| 商家安装记录 | `MerchantAiTeamAssignment`（`merchantId+agentId` 唯一）；开通记录 `MerchantAiTeamProvisionRun` | `prisma/schema.prisma:1358-1373`、`1375` |
| 旧体系（AI 员工 v1） | `executableAiEmployeeSlugs = ['product-manager','inventory-manager','sales-manager']`；安装表 `MerchantAiEmployeeInstallation`（`grantedPermissions`）、记忆表 `MerchantAiEmployeeMemory` | `src/server/aiEmployeeRegistry.ts:9`；`schema.prisma:1282`、`1302` |

**结论**：员工组织能力已有两个版本。用户方案中的"AI 公司 / AI 总经理 / 6 名员工"是**第三个更上层组织层**，必须建在统一工具协议之上，并明确旧体系合并时间点，否则必然产生第三套权限与记忆。

### 2.5 计费现状

| 项 | 事实 | 证据 |
|---|---|---|
| 功能计费目录 | `ModaGptBillingFeature(featureKey, minimumPlan, creditCost, riskLevel, enabled, config, version)` | `schema.prisma:1985-1997` |
| 套餐/订阅/发票 | `ModaGptBillingPlan/Subscription/Invoice/Payment/WebhookEvent` | `schema.prisma:1999-2116` |
| 用量 | `ModaGptAiUsageRecord`（feature/agentId/taskId/provider/model/credits/tokens/imageUnits/videoSeconds/voiceSeconds/actualCostMinor/idempotencyKey） | `schema.prisma:1935-1962` |
| 额度账本 | `ModaGptCreditLedgerEntry` + `ModaGptCreditReservation`（预留/消耗/释放，均带 idempotencyKey） | `schema.prisma:2436-2474` |
| 套餐配额 | `free{chat:500,imageGeneration:0,tryOn:0}`、`pro{chat:5000,imageGeneration:30,tryOn:10}` | `src/server/modagptEntitlements.ts:23-26` |
| 权限门 | `requireEmployeePermission(...)`；`resolveMerchantAssistantDataAccess` | `server.ts:18852`；`src/server/merchantAssistantCapabilityRegistry.ts` |

**缺口**：计费最小粒度是"功能（feature）"，不是"应用（app）"或"工具（tool）"；没有 app 维度就没有应用内额度，也无法"某应用欠费即停用、聊天不受影响"。

### 2.6 租户与权限现状（安全基线，已具备）

- 商家接口统一走 `requireMerchantTenant`（`server.ts:18852`），tenant 只从服务端会话取。
- 工具运行时二次校验：`call.tenantId !== principal.tenantId → MODAGPT_POLICY_TENANT_DENIED`；权限需同时出现在 `principal.permissions` 与 `principal.agentPermissions[agentId]`（`modagptRuntime.ts:215-223`）。
- 审批：`ModaGptApproval`（`merchantId+taskId+toolId` 唯一、`expiresAt`、`payload` 指纹），HIGH/CRITICAL 必须持有效审批令牌（`modagptRuntime.ts:139`、`224-232`）。
- 审计：每次工具调用写 `EmployeeAuditLog`（`action: MODAGPT_TOOL_*`）。
- **缺口**：无商家级第三方凭据存储（当前无 `MerchantAppCredential` 类表），搜索/发布类工具无法安全保存 OAuth token。

---

## 3. 缺口清单（实施优先级依据）

| ID | 缺口 | 影响 | 优先级 |
|---|---|---|---|
| G1 | 安装记录未被泛化消费（仅 `productionChain.ts` 一处硬编码门禁） | 安装对 AI 能力无约束，无法按应用授权/停用 | P0 |
| G2 | `appStoreNativeRuntimes` 硬编码白名单 | 新应用无法上线，必须改代码发版 | P0 |
| G3 | 仅允许 `pricingType==='free'` | 无法售卖应用/套餐 | P0 |
| G4 | 工具无版本、无应用归属、无成本 | 无法动态注册、无法按应用计费 | P0 |
| G5 | 工具注册靠改代码，无 Manifest/注册表 | App Store 无法装配工具 | P0 |
| G6 | 无商家级第三方凭据存储 | 搜索/发布类工具不可上线 | P1 |
| G7 | 计费无 app 维度 | 无法做应用级额度与停用 | P1 |
| G8 | 两套员工体系并存 | AI 公司会在其上再加一套 | P1（合并计划） |
| G9 | 任务类型仅 6 种，无工具维度 | 无法做工具级可观测与重放 | P2 |
| G10 | 意图路由为硬编码正则、仅 6 workflow | 工具越多越不可维护 | P2 |
| G11 | 无工具级熔断/降级矩阵 | 单工具故障可能拖垮整轮对话 | P2 |
| G12 | 无 App 卸载的数据保留/导出规则 | 卸载要么误删、要么不敢删 | P1 |

---


## 4. 目标架构

### 4.1 分层（自下而上，全部复用现有实现）

```
商家会话（商家 JWT，requireMerchantTenant）
        │
        ▼
① 能力解析层  resolveMerchantToolset(merchantId, agentId, industry)
   已安装应用 ∩ 安装状态=active ∩ 应用已发布 ∩ 工具 enabled
   ∩ 行业适用 ∩ 员工适用 ∩ 员工权限 ∩ 商家套餐/额度
        │  输出：可用工具 ID 集合（空集也合法）
        ▼
② 编排层（现有）superviseModaGptCoreTask → createModaGptExecutionPlan → 子任务
        │
        ▼
③ 工具执行层（现有）createModaGptToolRuntime
   权限双检 · 租户校验 · 审批令牌 · 输入校验 · 超时 · 重试 · 审计 · 租约
        │
        ▼
④ 适配器层（新增）native(现有 handler) / http / mcp
        │
        ▼
⑤ 计费层（现有）CreditReservation → AiUsageRecord → CreditLedgerEntry
```

**关键设计决定：Manifest 只描述工具，不实现工具。** 执行仍然走 ③ 的现有 runtime；Manifest 决定"③ 里应该注册哪些定义、对谁可见、要多少钱"。

### 4.2 边界规则（写进评审基线）

| 概念 | 归属 | 不得承担的职责 |
|---|---|---|
| **App** | 商业单元：定价、授权范围、安装生命周期、数据保留 | 不得承载具体执行逻辑；不得是权限判断单位（权限仍由 `permission` 键判定） |
| **Tool** | 执行单元：一个输入 schema、一个输出 schema、一个 handler | 不得包含多步业务流程（那是 workflow）；不得内嵌提示词 |
| **Employee** | 调度角色：可见工具子集、权限子集、预算 | 不得绕过商家权限；不得直接改数据库（必须经 Tool） |
| **Workflow** | 编排模板：任务拆分、依赖、审批点 | 不得重复实现工具逻辑 |

**卸载隔离规则（硬性）**：应用被停用或卸载后，`resolveMerchantToolset` 必须立刻不再返回其工具；聊天、其它应用、既有业务页面**不得受影响**；编排层把缺失工具表达为 `tools_unavailable`（现有枚举，`modagptTaskSupervisor.ts:26`），而不是抛 500。

---

## 5. Tool Manifest v1 协议

### 5.1 存放位置与单一事实来源

- **权威存储**：`App.manifest`（新增 `Json` 列）+ 派生注册表 `ToolRegistryEntry`（见 §6）。
- **不引入第二份 YAML/JSON 文件作为运行时来源**，避免"配置与代码不一致"。
- Manifest 由平台后台写入（`settings.integrations` 权限），商家不可写。

### 5.2 字段定义（v1）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `manifestVersion` | `"1"` | 是 | 协议版本，用于向后兼容 |
| `appId` | string | 是 | 必须等于 `App.appId` |
| `tools[]` | array | 是 | 至少 1 项，上限 50 |
| `tools[].toolId` | string | 是 | `^[a-z][a-z0-9_]{1,63}$`，全局唯一 |
| `tools[].version` | semver | 是 | 工具版本，变更 schema 必须升 major |
| `tools[].displayName` | `{zh, it}` | 是 | 界面文案，随 `uiCopyCatalog` 规则 |
| `tools[].description` | string | 是 | ≤ 400 字符，给模型看的用途说明 |
| `tools[].inputSchema` | JSON Schema 子集 | 是 | 仅 `object/string/number/integer/boolean/array/enum/required/min/max` |
| `tools[].outputSchema` | JSON Schema 子集 | 是 | 同上 |
| `tools[].permission` | string | 是 | 必须存在于现有权限键集合 |
| `tools[].riskLevel` | `LOW｜MEDIUM｜HIGH｜CRITICAL` | 是 | `HIGH/CRITICAL` 强制审批（沿用现有 `approvalRiskLevels`） |
| `tools[].requiresApproval` | boolean | 是 | 与 riskLevel 取"或"关系 |
| `tools[].timeoutMs` | 100–60000 | 是 | 与现有 runtime 上限一致 |
| `tools[].retry` | `{maxAttempts 1-3, idempotent}` | 是 | `maxAttempts>1` 必须 `idempotent:true` |
| `tools[].industries[]` | enum[] | 是 | 空数组=全行业 |
| `tools[].employees[]` | agentId[] | 是 | 空数组=不绑定员工，仅应用内手动可用 |
| `tools[].cost` | `{unit: 'call'｜'image'｜'video_second'｜'token_k', credits}` | 是 | 复用 credit 体系 |
| `tools[].quota` | `{perMerchantMonthly?, perEmployeeDaily?}` | 否 | 应用级额度上限 |
| `tools[].adapter` | `{kind:'native'｜'http'｜'mcp', endpoint?, method?, authRef?}` | 是 | `native` = 现有 handler；`http` 需 `authRef` 指向 `MerchantAppCredential` |
| `tools[].credentials[]` | string[] | 否 | 需要的凭据键；缺失时工具解析为不可用 |
| `tools[].dataScopes[]` | string[] | 是 | 声明的数据域，用于审计与隐私说明 |
| `tools[].enabled` | boolean | 是 | 平台级开关 |
| `tools[].status` | `draft｜published｜deprecated` | 是 | 只有 `published` 参与解析 |
| `tools[].deprecation` | `{sunsetAt, replacementToolId?}` | 否 | 停用通知期 |

### 5.3 Manifest 校验规则（服务端强制，写入时即拒绝）

1. `appId` 与所属 `App.appId` 一致；
2. `toolId` 全局唯一（跨应用唯一，冲突返回 `TOOL_ID_CONFLICT`）；
3. `permission` 必须存在于平台权限键白名单；
4. `riskLevel ∈ {HIGH, CRITICAL}` 时 `requiresApproval` 必须为 `true`；
5. `adapter.kind === 'http'` 时 `endpoint` 必须为 `https://` 且 `authRef` 非空；
6. `status === 'published'` 的工具，其 `inputSchema/outputSchema` 必须通过 schema 子集校验；
7. `cost.credits >= 0`，`cost.unit` 必须命中枚举；
8. 单个应用 `tools` 上限 50，单 Manifest ≤ 128 KB。

非法 Manifest **不得部分生效**：整体拒绝，返回结构化错误（字段路径 + 原因），保留上一版可用 Manifest。

### 5.4 兼容与版本

- `manifestVersion` 只允许 `"1"`；未来 `"2"` 由解析层同时支持 `1` 与 `2`，禁止原地修改语义。
- 工具 `version` 变更规则：**只增字段**=minor；**删字段/改类型**=major，且必须保留旧版本至少一个发布周期（`deprecation.sunsetAt`）。
- 已安装商家的 `AppInstallation.installedVersion` 仅作记录；运行时以当前 `App.version` + Manifest 为准（与现有"版本必须完全相等"逻辑不同，实现时需移除该限制，风险与回退见 §13）。

### 5.5 Manifest 示例（真实工具，非假数据）

```json
{
  "manifestVersion": "1",
  "appId": "modaui-ai-tools",
  "tools": [{
    "toolId": "get_supplier_performance",
    "version": "1.0.0",
    "displayName": { "zh": "供应商表现", "it": "Performance fornitori" },
    "description": "读取已授权供应商的交付、价格与质量指标。",
    "inputSchema": { "type": "object", "required": ["supplierId"],
      "properties": { "supplierId": { "type": "string", "maxLength": 160 } },
      "additionalProperties": false },
    "outputSchema": { "type": "object", "required": ["metrics"] },
    "permission": "purchase.manage",
    "riskLevel": "LOW",
    "requiresApproval": false,
    "timeoutMs": 15000,
    "retry": { "maxAttempts": 1, "idempotent": true },
    "industries": [],
    "employees": ["supply-chain-finance-manager", "business-manager"],
    "cost": { "unit": "call", "credits": 1 },
    "adapter": { "kind": "native" },
    "credentials": [],
    "dataScopes": ["suppliers", "procurement"],
    "enabled": true,
    "status": "published"
  }]
}
```

> 该示例即现有 `get_supplier_performance`（`modagptMerchantTools.ts:549`）的原样登记——**第一批工具一律来自现有 21+2 个真实工具，不新写任何一个**，用于证明协议可用。

---


## 6. 数据模型变更

> 全部为**新增**，不改动既有列；唯一例外是移除 `appStoreNativeRuntimes` 白名单判断（代码层，非 schema）。

| 变更 | 定义 | 说明 |
|---|---|---|
| `App.manifest` | `Json?`，默认 `null` | Manifest v1 原文；`null` = 尚未迁移的旧应用 |
| `App.category` 扩展 | 新增分类 `ai-tools` / `ai-research` / `ai-visual` / `ai-video` / `ai-document` / `ai-language` / `ai-automation` | 仅数据，不改表结构 |
| `ToolRegistryEntry`（新表） | `toolId`(PK)、`appId`、`version`、`enabled`、`status`、`riskLevel`、`permission`、`cost`、`industries`、`employees`、`fingerprint`、`updatedAt` | 由 Manifest 派生，**只读投影**，用于快速解析与索引，不手工编辑 |
| `MerchantToolGrant`（新表） | `merchantId`、`toolId`、`status(active/revoked)`、`grantedBy`、`grantedAt`、`revokedAt`、`source('app-install'/'admin')`、`@@unique(merchantId, toolId)` | 商家级工具授权；安装应用时批量生成，卸载时置 `revoked` |
| `MerchantAppCredential`（新表） | `merchantId`、`appId`、`credentialKey`、`ciphertext`、`keyVersion`、`expiresAt`、`status`、`@@unique(merchantId, appId, credentialKey)` | 第三方 OAuth/API key；**服务端加密存储，永不出现在任何 API 响应** |
| `MerchantAppQuota`（新表） | `merchantId`、`appId`、`period`、`unit`、`used`、`limit`、`@@unique(merchantId, appId, period, unit)` | 应用级额度；与 credit ledger 并存，额度是本应用内的第二道闸 |
| `AppInstallationStatusEvent`（新表） | `installationId`、`from`、`to`、`actorId`、`reason`、`createdAt` | 安装生命周期留痕，补齐"谁在什么时候停用了什么" |

**迁移策略**：纯加列/加表，`ADD COLUMN IF NOT EXISTS` 风格，无数据回填、无破坏性操作。`ToolRegistryEntry` 由服务端启动时的 `reconcileToolRegistry()` 从 `App.manifest` 生成（幂等，`fingerprint` 比对）。

**回滚**：删除新增表/列不影响旧代码路径；`App.manifest` 为 `null` 时解析层回退到"仅现有 2 个 native 应用"的旧行为（保留兼容开关 `AI_TOOLS_MANIFEST_ENABLED`）。

---

## 7. 运行时能力解析（唯一入口）

```ts
// 设计签名（尚未实现）
resolveMerchantToolset({
  merchantId, agentId, industry, actorPermissions
}): Promise<{
  toolIds: string[];            // 可执行
  denied: Array<{ toolId: string; reason:
    'not_installed' | 'app_disabled' | 'tool_disabled' | 'industry_mismatch'
    | 'employee_mismatch' | 'permission_denied' | 'credential_missing'
    | 'quota_exceeded' | 'plan_required'; }>;
  appIds: string[];
}>
```

**判定顺序（短路，首个失败即拒绝）**

1. 应用已发布且 `Installation.status ∈ {installed, active}`；
2. `ToolRegistryEntry.enabled && status === 'published'`；
3. 行业匹配（`industries` 为空 = 全行业）；
4. 员工匹配（`employees` 为空 = 不绑定）；
5. 商家侧 `MerchantToolGrant.status === 'active'`；
6. 员工/用户权限包含 `permission`；
7. 凭据齐备（`credentials[]` 均有 `status='active'` 记录）；
8. 额度与套餐允许（既有 `MODAGPT_PLAN_QUOTAS` + `MerchantAppQuota`）。

**接入点（改动最小）**：`server.ts:34998`、`35096`、`48211` 三处 `createModaGptMerchantTools(...)` 调用前，用解析结果过滤 `tools.definitions`；`modagptMerchantTaskExecutor.ts:107` 同理。**runtime 本身不改**（它已经做了第 6、7 步的兜底）。

**既有先例（泛化，不新造）**：`src/server/productionChain.ts:256-266` 已用 `AppInstallation.status='active'` + `App.status='published'` 做能力门禁，只是 `PRODUCTION_APP_ID` 写死。P0 应把该判断抽为共享函数 `isAppActiveForMerchant(merchantId, appId)`，`productionChain` 改为调用同一函数，**禁止出现第二套门禁实现**。

**降级规则（必须实现）**：解析失败 ≠ 500。工具被拒绝时：
- 聊天/助手回答继续（`enable` 关闭即视为未安装，不报错）；
- 需要该工具的编排返回 `tools_unavailable`（沿用 `modagptTaskSupervisor.ts:26` 枚举）；
- 前端提示"该能力未安装/已停用"，附应用商店跳转，不暴露内部原因码。

---

## 8. API 契约

### 8.1 新增（商家侧，`requireMerchantTenant`）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/merchant/ai-tools` | 已登录商家 | 返回**已安装且可用**的工具列表（含 `toolId/displayName/riskLevel/cost/permissionGranted/disabledReason?`） |
| GET | `/api/merchant/ai-tools/:toolId` | 已登录商家 | 单工具详情 + 本月用量 + 额度 |
| POST | `/api/merchant/ai-tools/:toolId/invoke` | 工具 `permission` | 应用内单独使用工具（走同一 runtime，同一审批规则） |
| GET | `/api/merchant/ai-tools/usage` | 已登录商家 | 按应用/工具聚合用量（真实 `ModaGptAiUsageRecord`） |
| POST | `/api/merchant/apps/:appId/credentials` | `employees.manage` | 写入第三方凭据（加密存储，响应只回 `status/expiresAt`） |
| DELETE | `/api/merchant/apps/:appId/credentials/:key` | `employees.manage` | 撤销凭据 |

### 8.2 修改（保持向后兼容）

| 接口 | 变更 |
|---|---|
| `POST /api/app-store/installations` | 安装校验从"硬编码白名单"改为"`App.manifest` 存在且至少 1 个 `published` 工具"；允许 `pricingType !== 'free'`（订阅校验走 `ModaGptBillingSubscription`，未订阅返回 `APP_STORE_PURCHASE_REQUIRED`，语义不变） |
| `DELETE /api/app-store/installations/:appId` | 事务内：`MerchantToolGrant → revoked`、`MerchantAppCredential → status='revoked'`（**不删除密文**，按保留期清理）、写 `AppInstallationStatusEvent` |
| `POST /api/merchant/assistant/query` | 新增可选 `includeToolDenials?: boolean`，用于前端展示"未安装能力"提示；不改变既有响应结构 |

### 8.3 错误码（沿用现有风格）

`AI_TOOL_NOT_INSTALLED`、`AI_TOOL_DISABLED`、`AI_TOOL_INDUSTRY_MISMATCH`、`AI_TOOL_CREDENTIAL_MISSING`、`AI_TOOL_QUOTA_EXCEEDED`、`AI_TOOL_PLAN_REQUIRED`、`TOOL_MANIFEST_INVALID`、`TOOL_ID_CONFLICT`、`APP_MANIFEST_MISSING`。

---

## 9. 计费映射（复用，不新建账本）

| 场景 | 落点 |
|---|---|
| 工具单次成本 | `App.manifest.tools[].cost.credits` → 写入 `ModaGptBillingFeature.featureKey = 'tool:' + toolId`（自动登记，`enabled` 跟 Manifest） |
| 扣费 | 现有 `ModaGptCreditReservation`（预留）→ 成功后 `ModaGptCreditLedgerEntry(entryType='consume')` |
| 失败/超时 | `release` 释放预留，不写 consume |
| 用量记录 | `ModaGptAiUsageRecord.feature = 'tool:' + toolId`、`taskId`、`agentId`、`latencyMs`、`status` |
| 应用级额度 | `MerchantAppQuota`（月）与商家套餐**同时**生效，取更严格者 |
| 应用订阅 | 现有 `ModaGptBillingPlan/Subscription`；`App.pricePlan` 只做展示与定价快照 |

**禁止**：为 AI Tools 新建第二套钱包、第二套扣费服务、第二套发票逻辑。

---

## 10. 安全与租户隔离（上线前置条件）

1. **tenant 只从会话取**：`merchantId` 永不接受请求体/查询参数传入（现状已如此，实现时保持）。
2. **凭据加密**：`MerchantAppCredential.ciphertext` 用服务端密钥（`keyVersion` 轮换），解密只发生在 handler 内部，绝不进日志/响应。
3. **员工权限不放大**：总经理/编排层不得把 `permission` 之外的权限授予员工；`agentPermissions` 仍是硬边界（`modagptRuntime.ts:219-223`）。
4. **跨商家测试必须自动化**：商家 A 的 `MerchantToolGrant`/`MerchantAppCredential`/`MerchantAppQuota` 对 B 不可见；已有 `MODAGPT_POLICY_TENANT_DENIED` 需补针对新表的用例。
5. **卸载不越权**：卸载仅撤销本应用授权，不得触碰其它应用、订单、商品、库存。
6. **审计必达**：Manifest 变更、安装/启用/停用/卸载、凭据写入/撤销、额度拦截，全部写 `EmployeeAuditLog`。

---

## 11. 失败模式与降级矩阵

| 故障 | 行为 | 用户可见 |
|---|---|---|
| 工具超时 | runtime 抛 `MODAGPT_TOOL_TIMEOUT`，按 retryPolicy 重试，最终失败 | 任务标记失败 + 原因，不静默 |
| 工具 5xx | 同上；连续失败进入熔断（P2，需 `AI_TOOL_BREAKER_THRESHOLD`） | "该能力暂时不可用，请稍后重试" |
| 凭据过期 | 解析阶段 `credential_missing` | "请在应用设置中重新授权" + 跳转 |
| 额度用尽 | 解析阶段 `quota_exceeded`，预留失败 | "本月额度已用完" + 升级入口 |
| 应用被停用 | 工具从解析结果消失 | 聊天正常，仅提示该能力未安装 |
| Manifest 非法 | 拒绝保存，保留上一版 | 平台后台显示具体字段错误 |
| Registry 与 Manifest 不一致 | 启动时 reconcile 重建；不一致写审计 | 无感 |

---


## 12. 分阶段实施计划

> 阶段与用户方案的映射：本文 P0/P1 = 用户"第一阶段（工具平台底座）"；P2 = "第二阶段（AI 总经理与员工）"的前置；P3/P4 = 用户第三、四阶段。**P0 未通过验收，不进入 P1。**

### P0｜协议与门禁（已实施，2026-10-30）

| 交付 | 实际内容 |
|---|---|
| 代码 | `src/server/aiToolManifest.ts`（类型/校验/`resolveAiToolAccess`/`evaluateAiTool`/试用计划）、`src/server/aiToolRegistry.ts`（Manifest 读取、授权、撤销、暂停、投影、保存）、`src/server/modauiAiTools.ts`（2 个真实工具 + Manifest 工厂） |
| 数据 | `App.manifest`（JSONB，可空）+ `AiToolRegistryEntry` + `MerchantToolGrant` + `AppInstallationStatusEvent`；迁移 `20261030120000_modaui_ai_tools_platform` 只加不删 |
| 接入点 | 安装 → 发放 7 天试用；停用/启用 → 暂停/恢复；卸载 → 撤销；任务执行器按授权过滤工具集 |
| 兼容 | `AI_TOOLS_MANIFEST_ENABLED=false` 时回退到旧白名单；`ruda-business-email`、`ruda-production-chain` 保持原生白名单，不写 Manifest、不伪造 AI 工具 |
| 首批工具 | 仅 2 个真实可执行工具（文案创作、翻译）。**核心 MODAGPT 工具（`get_products`、`publish_product` 等）不注册到本应用**：注册会导致卸载后聊天不可用，违反"核心能力不受影响" |
| 不做 | 不做 AI 公司、不做图片/视频/发布/分析的占位入口、不接入未审查许可证的第三方服务 |

**P0 验收状态**

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 合法 Manifest 可保存；非法 Manifest（缺权限、HIGH 未审批、toolId 重复、非幂等重试、http 无凭据）逐条被拒并给出字段路径 | 已完成（`tests/ai-tools-manifest.test.ts` 覆盖） |
| 2 | 安装 → 发放试用；重复安装不延长到期时间 | 已完成（内存 prisma 代理测试） |
| 3 | 停用 → 暂停；启用 → 恢复；卸载 → 撤销 | 已完成 |
| 4 | 商家 A 的授权对商家 B 不可见 | 已完成（`MerchantToolGrant` 唯一键 `(merchantId, toolId)` + 按商家查询测试） |
| 5 | 未安装应用的工具从运行时工具集剔除，核心工具保留 | 已完成（`removeBlockedToolDefinitions` + 执行器接入） |
| 6 | Manifest 保存冲突（跨应用同一 toolId）不写入并保留上一版 | 已完成 |
| 7 | `tsc` 0 错误；`tests/ai-tools-manifest.test.ts` 13 项通过 | 已完成（见交付记录） |
| 8 | 商家安装后真实调用两个工具并返回模型结果 | **待验证**（需线上凭据与真实商家；单测只覆盖契约与门禁） |
| 9 | 图片/视频/发布中心 | **未接通**（无供应商凭据，不提供入口） |


### P1｜付费与额度

- Manifest `cost/quota` → `MerchantAppQuota` + 现有 credit 账本；订阅校验接入 `ModaGptBillingSubscription`。
- 验收：额度用尽后工具解析返回 `quota_exceeded`，聊天与其它工具不受影响；账单可追溯到具体 `toolId` 与 `taskId`。

### P2｜AI 工具中心 UI + 首批真实外部工具

- 应用内 8 个模块中最先只做 **工具中心 + 公司数据（真实用量）**，其余模块留空态并标注"未接入"。
- 外部工具按"凭据 → 沙箱 → 灰度"顺序接入，每个工具必须先有 Manifest、凭据表、超时/重试/熔断、跨租户测试。
- 验收：至少 3 类外部工具真实调用成功，且执行记录可在工具中心查到（非 Mock）。

### P3｜AI 公司（总经理 + 6 名员工）

- 员工复用 `modagptCoreEmployees` 行业包或新建公司级员工包（需先决定 G8 的合并方案），**不新建第三套员工表**。
- 验收：一个目标 → 总经理真实拆分 ≥3 名员工 → 员工真实调用工具 → 产出文件 → 商家审批（沿用 `ModaGptApproval`）。

### P4｜创作与发布（按闭环交付，不做空页面）

第一条必须打通的闭环（顺序不可跳）：

真实商品图片 → AI 商品广告图 → AI 短视频 → 视频剪辑（时间轴真实可编辑）→ 语音与字幕 →
平台内容适配 → 账号授权 → 商家审批 → **真实发布** → **真实数据回传**。

- 图片：`image.generate` / `image.edit` / `image.virtual_tryon` 适配器；商品一致性纳入质量门槛（不得擅自改变商品颜色、结构、品牌标识）。
- 视频：`video.generate` / `video.render` 适配器 + 时间轴编辑器；以播放器或裁剪按钮冒充时间轴视为未完成。
- 语音：`voice.tts` / `voice.transcribe` / `voice.dub`；声音克隆必须有本人授权，音乐/音效需商用授权。
- 发布：`publish.social` 适配器，状态机固定为
  `DIRECT_PUBLISHED | UPLOADED_AS_DRAFT | USER_ACTION_REQUIRED | PENDING_REVIEW | FAILED | UNSUPPORTED`。
  **草稿不得标记为已公开发布**；重试必须防重复发布；回执保存真实平台 ID。
- 分析：只用平台授权范围内的真实数据；无授权时显示"不可用"，禁止编造趋势或表现。

每个能力上线前必须：Manifest 登记 → 凭据服务端保存 → 沙箱验证 → 单商家灰度 → 更新 §1.2 状态矩阵并附证据。


---

## 13. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| 移除 `appStoreNativeRuntimes` 导致现有 2 个应用无法安装 | 商家侧回归 | 先用 Manifest 登记这 2 个应用（`native` 工具），再切换到新判定；保留开关回退 |
| Manifest 与代码定义不一致 | 工具"看似可用但执行失败" | runtime 启动期比对 `toolId` 集合，缺失即 `MODAGPT_TOOL_NOT_REGISTERED`（现有行为）+ 审计告警 |
| 卸载误删数据 | 不可逆 | 卸载 = 仅撤销授权，不删业务数据；删除走单独的显式清理流程与保留期 |
| 新增表拖慢主库 | 性能 | 仅索引查询；不做大表回填 |
| 付费化影响现有免费商家 | 商业风险 | 免费套餐工具标记 `cost.credits = 0`，订阅仅对新增应用生效 |
| 与五行业 Industry Packs 冲突 | 冻结范围被打扰 | 协议只做"可见性与门禁"，不改任何 workflow 逻辑；行业包工具保持原 `toolId` |

**回滚步骤**：① `AI_TOOLS_MANIFEST_ENABLED=false`（行为退回旧白名单）；② 回滚代码到上一提交；③ 新增表保留（不删数据）；④ 校验 `/api/app-store/apps` 与安装/卸载仍为旧行为。

---

## 14. 非目标（本期明确不做）

1. 不新建第二套 AI 聊天核心、模型路由、任务队列、计费系统。
2. 不新建第三套 AI 员工体系。
3. 不把 Paperclip / LangGraph / n8n / Postiz / ComfyUI 直接并入主代码库；如接入，必须先做许可证与授权审查，且以独立服务 + Manifest 方式。
4. 不改动已冻结的服装生产批发、服装批发行业 AI 行为。
5. 不做"AI 员工卡片式"假执行界面；未接通的功能一律在 UI 标记"未接入"。

---

## 15. 待决策（需产品确认后才能进入编码）

| 编号 | 问题 | 建议 |
|---|---|---|
| D1 | 首个上架应用命名与 appId | `modaui-ai-tools`（中文"AI 工具中心"，英文"MODAUI AI Tools"） |
| D2 | `pricingType` 与订阅的关系 | 应用订阅走 `ModaGptBillingSubscription`，`App.pricePlan` 仅展示 |
| D3 | 是否允许"未安装应用的工具"被聊天调用 | **不允许**（否则安装失去商业意义）；如需要"试用"，用 7 天 `MerchantToolGrant` 显式授予 |
| D4 | G8 两套员工体系的合并时间点 | 在 P3 之前完成合并，禁止 AI 公司再建第三套 |
| D5 | 首批真实外部工具清单 | 建议从"搜索/研究 + 图片生成"两类开始（均已有凭据需求模型），视频与发布放 P4 |
| D6 | 免费额度 | 每商家每月 `credits` 上限，具体数值由定价决定，不在本设计内假定 |

---

## 附录 A：审计证据命令（可复现）

```bash
grep -rn "AppInstallation" --include=*.ts --include=*.tsx src server.ts   # 仅平台后台 UI
sed -n '1,60p' src/server/appStoreValidation.ts                            # 白名单 + 仅免费
sed -n '97,140p' src/server/modagptRuntime.ts                              # 工具定义契约
sed -n '209,330p' src/server/modagptRuntime.ts                             # 权限/租户/审批/超时/重试/审计
sed -n '1,20p' src/server/modagptTaskQueue.ts                              # 6 种任务类型
sed -n '1,60p' src/server/modagptTaskSupervisor.ts                         # 意图路由与 execution 枚举
grep -n "model ModaGptTask" -A 40 prisma/schema.prisma                     # 队列模型
grep -n "model App\b" -A 40 prisma/schema.prisma                           # App/AppInstallation
```


---

## 变更记录

| 日期 | 版本 | 变更 | 说明 |
|---|---|---|---|
| 2026-10-30 | v0.1 | 初版：只读审计 + Tool Manifest v1 协议 + 分阶段计划 | 未写任何功能代码；P0 需评审通过后才实施 |
| 2026-10-30 | v0.2 | 产品定位升级为专业 AI 创作与营销平台；新增 §1.1 六个工作中心、§1.2 能力状态矩阵、§1.3 Provider Adapter 契约与自动路由；P0 协议与门禁已实施（Manifest v1、7 天试用授权、安装/停用/卸载联动、运行时门禁、管理端与商家端接口、2 个真实工具）；P4 改为按闭环交付 | 未接通能力（图片/视频/语音/发布/分析）明确标记，不提供入口；核心 MODAGPT 工具不注册到本应用 |

**维护要求**：实施 P0 时，必须同步更新本文 §2（现状）与模块登记表 `modaui-ai-tools-platform` 行；代码与本文不一致时以代码为准并立即修正本文，不得让设计文档停留在旧行为。

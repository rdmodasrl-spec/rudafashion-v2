# 模块规格：RUDA Global AI Evolution Center

- Module ID：`global-ai-evolution-center`
- 模块状态：部分完成（RUDA CORE 有 Brain/经验/评测/Provider 基础；全行业强隔离、授权学习、模型训练/独立评测/审批发布与回滚闭环未完成）
- 文档阶段：平台级规格已整理；源码静态审计已确认关键 schema 缺口；生产迁移状态、行业数据归属及资源/模型运行态仍待验证
- 日期：2026-11-14
- 对应负责人/团队：RUDA AI 平台与安全团队
- 架构归属：RUDA CORE + RUDA SUPER ADMIN；不是 Apparel 专属功能
- 相关行业规格：[`apparel-studio-v2.md`](./apparel-studio-v2.md)、[`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md)

> 这是 RUDA 全行业平台能力规格。现有 `ModaGptBrain*` 与 Provider 管理能力是优先复用基础，不代表 Global AI Evolution Center 已上线。本规格的静态审计没有查询生产数据库、GPU 资源或模型供应商。

> **平台优先级：** Self-Learning & Self-Evolving AI 是 RUDA CORE 的平台级基础设施，优先于单一 Studio 的专属 AI 能力升级。优先建设身份可信的行业/Studio namespace、数据授权和可追溯经验闭环；不以新增聊天界面或普通 Provider 设置页代替。

## 1. 背景与问题

RUDA 要逐步建立能够授权积累经验、管理行业知识、训练/评估自有模型并按能力替换外部 Provider 的统一治理平台。该能力必须由 RUDA CORE 提供运行基础，由 SUPER ADMIN 在最小权限下管理。

平台共享的是基础设施：Model Gateway、任务调度、记忆/知识框架、评测运行器、模型注册/部署、权限、审计、成本与资源监控。行业不共享专业资料：每个行业有独立知识、记忆、工作经验、成功/失败案例、黄金测试集、评估标准、训练授权、专业模型和模型版本。企业私有记录在行业空间内继续按 tenant/merchant 隔离。

## 2. 目标与非目标

### 目标

- 将 AI Provider/Gateway、Brain/知识、任务、经验采集、模型注册、训练数据授权、离线评测、灰度发布和回滚纳入统一的平台治理边界。
- 支持两种运行方式：外部 Provider + RUDA 自有模型混合；以及指定能力完全在 RUDA 自有服务器/模型/确定性引擎运行。
- 所有模型路由按行业/Studio/能力/任务选择；自有模型达到独立质量门槛且获批后，才可接管该能力的生产任务。
- 确保跨行业/跨租户共享需可证明的明确授权、来源追踪、可撤回和审计；默认拒绝未授权数据进入共享知识或训练集。
- 给所有 Studio 提供统一治理能力，同时各自保留行业独立 namespace 和业务规则。
- 可追踪准确率/质量、任务成功率、成本、延迟、错误、GPU/运行资源、版本与回滚。
- 将记忆、学习、训练、升级定义为四种不同的持久化能力：记忆保存授权经验；学习在后续任务检索并利用已验证经验；训练从冻结且获授权的数据集产出候选模型制品；升级只在独立评测和授权审批通过后改变生产路由。
- 建成完整闭环：授权经验采集 → 质量/隐私检查 → 专业审核 → 行业数据集版本 → 训练/候选制品 → 独立评测 → 审批/灰度 → 监控/回滚；每步记录来源、版本、状态和责任主体。
- 三个最终效果必须分别以真实证据证明：跨会话检索到获授权的长期记忆；不同任务利用已验证经验获得可比较的质量改善；关闭外部 API 后由 RUDA 自有模型/确定性引擎完成已通过认证的能力。

### 非目标

- 不新增第二个 AI 对话引擎、Provider Gateway、任务队列、计费或普通商家模型配置台。
- 不将未经审核的用户内容即时写入知识、训练集或生产权重。
- 不训练第三方模型不可见的内部推理；只收集合法、授权、可观察的输入/输出、执行结果和专业人员反馈。
- 不把“模型可下载/可部署”宣传为 RUDA 自研；记录开放权重的来源、许可证、改动、数据与训练方法。
- 不自动把新模型升级到生产，也不因总体分数达到某一比例取消高风险人工审批。
- 不把行业 namespace 设计为只靠前端菜单或可伪造的请求字段的软隔离。

## 3. 现状审计与防重复检查

### 3.1 已检查现有能力

- 服务：`src/server/modagptBrain.ts`、`modagptBrainService.ts`、`modagptRuntime.ts`、`modagptTaskSupervisor.ts`、`modagptMerchantTaskExecutor.ts`、`aiEmployeeProviders.ts`、`aiProviderCatalog.ts`、`aiProviderCallStore.ts`、`runpodGateway.ts`。
- 平台管理：`AdminAiControlCenter.tsx`、`AdminAiProviderConsole.tsx`、`AdminModaGptOperator.tsx`、`aiProviderSettings.ts` 及服务端 `/api/admin/*` 管理路由。
- 商家 Brain API：`/api/merchant/modagpt/brain/documents*` 与对应 tenant/merchant 访问上下文。
- Prisma：`ModaGptBrainDocument/Chunk/Entity/Fact/Event/Experience/Evaluation/Feedback/Lesson/LessonEvidence/RetrievalLog/LearningRun`、`ModaGptTask`、Provider 调用记录及相关迁移。
- 测试：`tests/integration/modagpt-brain.postgres.test.ts` 及 `tests/` 中 AI Provider、任务与 Brain 契约测试。
- 关键字/目录：`industryId`、`studioId`、`namespace`、`ModaGptBrain`、`LearningRun`、`Evaluation`、`training`、`dataset`、`modelVersion`、`ai-providers`、`AdminAiControlCenter`；`src/server/`、`src/apps/platform-admin-common/`、`prisma/schema.prisma`、`prisma/migrations/`。

### 3.2 现状结论

| 能力 | 可复用现状 | 不能据此声称已实现 |
|---|---|---|
| AI Brain / 任务运行 | 有通用 ModaGPT Agent/工具运行时、任务 Supervisor、`ModaGptTask` 与商家工具执行权限/审计设计 | 未证明所有 Studio 使用同一、可按行业隔离的线上计划/执行治理，也未证明任务运行具备统一的模型质量路由 |
| 记忆/知识基础（基线审计） | Brain 服务有 memory/knowledge/fact/experience/lesson 等处理、授权字段/权限过滤、检索排序与 retrieval log | 初始审计确认当时 schema 未明确 `industryId`/`studioId`；已由本轮切片增量加入字段及服务端过滤，但训练授权、全局治理仍未闭环 |
| 经验与反馈 | `ModaGptBrainExperience`、`Evaluation`、`Feedback`、`Lesson`/`LessonEvidence` 支持任务结果、版本、验证、反馈及候选经验记录 | 没有独立的各行业黄金测试集、数据许可工作流或已证明的模型权重训练管线 |
| Learning Run | `ModaGptBrainLearningRun` 可记录通用 runType/status/counts/policyVersion/start/end | 这不是完整训练 Job：没有证据显示数据集/制品/硬件资源/检查点/离线考试/部署准入已闭环 |
| 向量检索 | Prisma Brain Chunk 存 `embedding` 字符串/embeddingModel；Brain 服务定义可替换向量存储接口；Brain 迁移已定义关系数据表 | 被检迁移没有 `CREATE EXTENSION vector` 或原生 vector 列；运行时向量存储实际接线、扩展部署和性能未由本次生产查询验证。不能把“依赖 pgvector”当作已核实的运行事实 |
| Provider/Gateway | `aiEmployeeProviders`、Provider Catalog/Console、RunPod Gateway、Provider 调用/成本/错误记录与部分 Ollama/本地模型诊断可复用 | 有 Provider 配置/健康检查不等于全行业模型 registry、能力评测路由、RUDA 自有模型制品库、自有 GPU 集群/故障域切换已完成 |
| SUPER ADMIN | AI Control Center 聚合 AI 员工/Provider、反馈、队列及本地模型诊断；Provider Console 管理指定 Provider 与调用成本；Operator 面板管理运营配置 | 当前页面集合不是跨行业 Evolution Center；没有找到行业级数据授权、训练集版本、评测运行、模型发布审批/灰度/回滚的统一闭环 |
| 数据库上线 | Brain migration `20261001030000_add_modagpt_brain_core`、相关 schema 与隔离 PostgreSQL 测试源码存在 | 静态仓库不能证明生产 migration 已应用；本阶段未连接生产 DB，也未声称实际数据量/保留策略/权限已核实 |

### 3.2.1 本轮源码核对补充（2026-11-14）

- `ModaGptBrainAccessContext` 当前要求 `tenantId/merchantId/actorId/permissions/scopes`，没有行业或 Studio 身份；`ModaGptBrainCandidate` 也没有行业/Studio namespace。
- `MerchantAiEmployeeMemory` 与 Brain Document/Chunk/Entity/Fact/Event/Experience/Evaluation/Feedback/Lesson 等持久化模型有租户字段，但没有强制 `industryId` / `studioId` 列。检索查询以 tenant/merchant/scope 过滤，不能满足同一商家多行业的强隔离要求。
- `ModaGptBrainLearningRun` 当前只记录通用 runType/status/counts/policyVersion 和起止时间；没有 Dataset Version、授权快照、模型制品、训练资源、评测 ID 或部署准入关联。
- `AdminAiControlCenter` 与 `AdminAiProviderConsole` 是现有复用入口；平台导航有智能代理/模型管理等页面，但本轮未发现覆盖数据授权、行业 Steward、训练集冻结、独立考试、灰度发布和生产回滚的一体化中心。
- `Merchant.industryTemplate` 当前为单值。不能只用它推断多行业历史项目的归属，也不能把缺失/不确定 namespace 的历史资料自动提升为公共或行业知识。
- 唯一模板 registry 的八个条目现均配置了 `industryCode`、`studioCode`、`knowledgeNamespace`，并有契约测试覆盖映射唯一性及代码稳定性。服务端 Brain 检索/写入尚未使用这些字段做强制隔离；Restaurant 目前仅开放菜单/桌台基础工作区，不表示多行业 AI 授权或 Restaurant Studio 已实现。
- 这些结论来自源码、Prisma schema、migration 文件和调用点静态检查；未查询生产数据库、实际迁移状态、现行 Provider 契约/GPU、部署配置或外部供应商合同。

### 3.3 复用与防重复结论

- **先复用**现有 ModaGPT Brain schema/service、Provider/Gateway、任务队列、成本记录、Admin AI 控制面、管理员鉴权、审计和数据库迁移规范。
- 新增 Evolution Center 管理页面应扩展 `AdminAiControlCenter` / 现有平台导航，不建第二个 Admin 应用。
- Apparel 等行业逻辑仍由其 Studio/行业服务拥有；Evolution Center 管理它们的授权和制品，不把业务专业流程集中到巨型平台组件。
- 不先创建用户任务书列出的 `industry_registry`、`studio_registry`、`studio_knowledge_namespaces` 等表；V2 Studio 注册、行业 entitlement、Brain namespace 已在其他规格作为平台现状/缺口处理，须先联合盘点后确定权威 owner。
- 只有当现有 schema 查询无法表达行业隔离、许可/撤回、黄金数据集版本、模型制品与部署审批时，才增量扩展所缺实体/约束；每个 migration 必须有兼容、回填、锁表影响、验证与回滚说明。

### 阶段 1 的稳定 namespace 映射契约

行业/Studio/知识空间身份由 `src/constants/merchantIndustryTemplates.ts` 中已存在的单一模板注册表提供；下表来自当前 V2.0 任务书，不按显示名称匹配。重复经营模板可共享同一个专业 Studio/namespace，但其行业代码仍保持各自唯一。

| 商家模板 ID | `industryCode` | `studioCode` | `knowledgeNamespace` |
|---|---|---|---|
| `apparel_production_wholesale` | `apparel_production_wholesale` | `apparel_studio` | `apparel` |
| `apparel_wholesale` | `apparel_wholesale` | `apparel_studio` | `apparel` |
| `trading_wholesale` | `trade_wholesale` | `trade_studio` | `trade` |
| `department_wholesale` | `department_wholesale` | `department_wholesale_studio` | `department_wholesale` |
| `bags_wholesale` | `leather_bag_wholesale` | `leather_studio` | `leather` |
| `department_chain_retail` | `department_store_chain` | `retail_chain_studio` | `retail_chain` |
| `general_retail` | `general_retail` | `retail_studio` | `retail` |
| `restaurant_ordering` | `restaurant` | `restaurant_studio` | `restaurant` |

该表是一个 Studio/namespace 映射，不是多行业商家授权模型。`Merchant.industryTemplate` 缺失、无效或与 `Merchant.industry` 不一致时，Brain 写入与行业专属检索必须 fail closed；历史记录不能仅依名称归类。

#### 本次 namespace migration 实施契约

- 写入和检索上下文由服务端根据 merchant 数据库行中的 `industryTemplate` 解析；模板必须处于 `open`，其 `merchantIndustry` 必须与记录的 `Merchant.industry` 精确一致。客户端不得提交或覆盖行业/Studio/namespace。
- Brain 记录族统一增加 `industryId`、`studioId`、`knowledgeNamespace`。新写入由已验证上下文显式设置；所有候选和相关子查询必须同时匹配这三个字段以及 tenant/merchant。
- 既有 Brain 记录迁移为三个字段的空字符串 sentinel，语义是“历史归属未核实”。空值记录永不被行业检索或训练选取；不自动按商家当前模板回填，避免历史数据误归属。
- 数据库约束只允许三字段同时为空（隔离的 legacy）或同时非空（完整新 namespace），禁止部分 namespace。索引及幂等唯一键应带行业/Studio 维度；历史唯一键变更不得令 legacy 数据丢失。
- 该实现仍受当前 Merchant 单个 `industryTemplate` 限制；不声称支持一个商家同时启用多个 industry entitlement。合法多行业模型落地前，服务端只能解析当前唯一模板。
- 验证状态：迁移已在一次性隔离 PostgreSQL 全量 migration runner 中真实执行；数据库约束、命名索引、schema/client 生成和 Brain 检索集成测试通过。未连接或迁移生产/应用数据库。
- 回滚顺序：先回滚应用读取/写入逻辑，再保留 namespace 列和数据（不自动逆向回填/删除），后续回滚 migration 仅在未生产应用且核实无写入后评估。生产迁移不在本任务执行。

## 4. 归属与系统边界

| 层 | 权威责任 | 不可越界 |
|---|---|---|
| RUDA CORE | Provider Gateway、任务与事件、通用记忆/知识框架、模型注册契约、评测调度、授权判定、审计、路由/额度/成本、发布状态 API | 不持有第二份商品/订单/商家身份，不替行业 Studio 执行其确定性生产计算 |
| 行业 Studio | 行业 ID、独立知识/经验/记忆策略、专业工具/规则、黄金集、质量标准、训练授权边界、专业模型适配与行业结果验收 | 不私建第二个 Gateway、训练调度/管理中心或跨行业数据池 |
| RUDA SUPER ADMIN | 全行业治理界面、授权/审核、评测结果、资源/成本/状态、模型候选/灰度/回滚管理 | 不能绕过 namespace 与租户权限；高风险操作双重审批与审计 |
| 商家工作区 | 用户只访问获授权行业与自身企业资源；提供反馈/确认/授权流程 | 不展示全平台训练/模型管理，不信任客户端 tenant/industry/permission |

## 5. 权限、授权与隐私

| 主体 | 允许范围 |
|---|---|
| RUDA 平台 AI 管理员 | 可管理 Provider/模型注册、行业配置、全平台运行指标；读取训练样本原文仍须单独授权与审计 |
| 行业 Steward/专业审核员 | 仅在明确指派的行业 namespace 中审核知识、经验、样本、黄金集和评测结果 |
| 商家负责人 | 查看本企业记录、修改本企业可授权范围、授权/撤回特定数据用途 |
| 商家员工/设计师 | 按既有业务权限提交反馈或专业修正，不能自行授权跨租户训练或发布模型 |
| RUDA 普通运维/服务账号 | 仅访问运行所需的脱敏元数据和最小必要资源；不得默认读取客户设计/图片 |

强制规则：

- namespace、tenant、permission 和训练授权由服务端会话/关系解析；请求中 namespace 只作资源标识，不能成为授权。
- 一个记录至少能追踪 `industryId`、`studioId`、`tenantId`（平台级公共资料可为空 tenant，但必须有审批范围）、`knowledgeType`、`sourceId`、`approvalLevel`、`modelVersion`、`permissionScope`、来源许可/同意版本和时间。
- 租户私有记录永不自动晋升公共知识。跨租户训练仅允许明确 opt-in、范围/用途/期限具体、可撤回的数据；撤回后阻止新任务并按策略重建派生集/索引。
- 行业知识检索必须在服务端查询谓词和授权校验中同时包含行业、Studio、tenant、审批级别和权限范围；无权时拒绝，不能“先检索后让模型忽略”。
- 记录只保存供应商允许保留的请求/结果/可观察步骤；不采集模型隐藏推理。秘钥、完整令牌、敏感图像 URL 不进日志。
- 数据导出、删除、过期、来源授权撤回、向量派生数据重建和备份清除均需有审计/恢复规则。

## 6. 数据对象与状态机

以下是逻辑对象，不等同于必须新建同名数据表；映射现有 schema 后才能确定 migration：

| 逻辑对象 | 来源/目的 |
|---|---|
| `IndustryStudioPolicy` | 稳定 industry/studio ID、启用、能力、默认 namespace 与隔离策略；复用 V2 Studio Registry 权威源 |
| `KnowledgeRecord` / `ExperienceRecord` | 复用 Brain Document/Chunk/Experience/Fact/Lesson/Feedback；补足强制行业、Studio、许可和来源引用 |
| `DatasetVersion` / `DatasetSample` | 只收录获准、版本化的训练/黄金评估样本；与生产记忆分开保存及授权 |
| `ModelArtifact` / `ModelCapability` | 模型来源、许可证、行业/任务能力、权重摘要、运行方式、版本、评估结果和兼容性 |
| `EvaluationRun` / `EvaluationCaseResult` | 指定数据集版本、评测器、指标、阈值、输入模型版本与可复核结果 |
| `TrainingRun` | 引用数据集/授权快照、训练代码/参数/资源、起止状态、检查点与输出制品 |
| `DeploymentDecision` | 独立通过/拒绝、批准人、对照基线、灰度策略、回滚目标和审计 |
| `ResourceSnapshot` | GPU/CPU/存储/推理队列/成本/延迟的时间序列；不得写客户内容 |

### 状态

| 资源 | 允许状态和转换 |
|---|---|
| 授权数据 | `candidate → reviewed → approved → active → revoked/expired`; 拒绝/撤回后不得生成新的训练版本 |
| Dataset Version | `draft → validating → approved → frozen`; 仅已冻结版本可训练/评测，变更生成新版本 |
| Training Run | `queued → running → completed/failed/cancelled`; 失败有错误码、资源/重试策略；不能自动发布 |
| Model Artifact | `candidate → evaluation_pending → qualified/failed → approved → canary → active → deprecated/rolled_back` |
| Deployment | `pending_approval → canary → active`; 指标越界/错误率异常/人工回滚后切回上一个已批准制品 |

训练、评估、部署皆为后台任务，要求幂等、超时/取消、资源配额、重试上限、失败可诊断。训练和线上推理资源隔离。

## 7. AI 模式与模型路由

### 模式 A：外部 + RUDA 自有模型混合

- 每项 `industryId + studioId + capability` 单独声明允许 Provider、最低离线/线上评测门槛、隐私分类、成本/延迟边界及 fallback。
- 自有模型未达到该能力质量门槛时走获批外部 Provider；Provider 故障按明确策略返回失败或切换已验证 fallback。
- 只有已部署、评估通过且审批的自有模型，才可按业务允许策略优先服务。

### 模式 B：RUDA 自有运行

- 按任务选择 RUDA 自有模型、自有服务器与确定性专业引擎。
- 外部 Provider 关闭须按能力逐一执行断网/无密钥测试，确保核心任务和工程计算不依赖第三方。
- 训练 GPU、离线评测与生产推理有资源隔离、队列上限和熔断；训练不能耗尽生产可用资源。

### 路由规则

模型选择必须在服务端综合任务类型、行业/Studio entitlement、数据敏感级别、模型评测结果、质量阈值、许可、成本、延迟、可用性和 GPU/配额；不能由客户端传入 model ID 直接指定任意 Provider。路由与 fallback 结果写调用事实，密钥不返回前端。

## 8. API/服务契约

已有 Provider、AI task、Brain 和管理 API 继续是基础。当前未发现 `/api/admin/ai-evolution/*` 全局治理 API；以下为目标服务操作，编码前须对现有 admin 接口再查重，并在适用时补 OpenAPI/schema。

| 操作 | 最低契约 | 权限/审计 |
|---|---|---|
| 读取行业/Studio 能力注册 | 返回稳定 ID、启停、namespace、capability 状态与模型引用；过滤未授权管理范围 | `settings.ai_support` 或专门 AI 管理权限；只读审计 |
| 管理授权/知识策略 | 输入 source、industry/studio、用途、scope、许可/同意引用、到期/撤回；返回审批状态和审计 ID | 行业 Steward + 必要的商家授权；权限变更审计 |
| 管理 Dataset Version | 仅接收授权数据引用和标准标签；冻结时校验来源、跨租户、跨行业、删除/撤回状态及样本 schema | 数据管理员审批；禁止前端上传即入训练 |
| 启动/查询训练 | 启动请求指定冻结 dataset version、训练配方版本、目标能力、资源预算与幂等键；响应 run ID/state；查询返回错误/计数/制品引用 | 训练管理员；配额检查、双重确认适用于生产数据/高成本任务 |
| 执行评测 | 输入 candidate model artifact、冻结评测集、baseline、评测器/版本、阈值；输出逐指标与每案例结果、判定和可复核引用 | 行业评测员/平台审核；不可自行将评测结果改为通过 |
| 模型晋级/灰度/回滚 | 输入 artifact/version、适用行业能力、已通过评测 ID、灰度比例/终止条件；响应部署状态及目标版本 | 平台 AI 管理员 + 审批策略；每次决策不可变审计 |
| 监控运行资源/成本 | 按日期、行业、Studio、Provider/模型、任务类型聚合调用数/成功/失败/延迟/成本/GPU | 平台 AI 管理权限；最小化可见租户个人数据 |

所有 API 统一返回 `success`、稳定 `error` code 与可关联 `requestId`；鉴权失败 401/403、字段/状态非法 400、资源不存在 404、重复/版本冲突 409、限额/速率 429、外部依赖/训练资源失败 503 或项目统一错误。写操作使用幂等键，列表必须分页；所有 endpoint 服务端逐请求验证作用域。

## 9. UI/UX 与管理面

- 扩展现有平台总后台 AI 管理模块，不增加新的应用目标或独立后台。
- Global AI Evolution Center 包括：平台状态总览、行业隔离视图、Provider/自有模型注册、知识与授权、经验审核、数据集版本、训练队列、独立评测、模型晋级/回滚、GPU/成本/运行监控。
- 默认先显示状态、数量、版本、错误和聚合成本；查看样本原文需要额外权限、理由和审计。
- 超级管理员可跨行业查看运行元数据，但打开行业数据内容仍必须切换到获授权的行业 Steward 上下文；不能用“超级管理员”跳过客户同意/数据合同。
- 普通商家、员工不得看到模型权重、全局训练集、他商数据、GPU 管理或跨行业知识管理。
- 延续 RUDA 既有平台管理 UI；本规格不授权全站改版，管理员屏幕与手机端布局仍按平台现有 Web/Mobile 入口独立适配。

## 10. 集成与运营规则

- 任务、Brain 事件、样本授权、训练状态、评测、部署状态和 Provider 调用需可追踪 correlation/trace ID。
- Provider/训练任务故障不影响订单、库存、CAD 等确定性业务；AI 建议必须可读，AI 任务失败不伪装成业务写入成功。
- 紧急停用能力可按行业+能力+模型执行，不删除项目/数据；恢复需管理员确认。
- 每个 active model 有健康探测、质量/成本基线、当前版本、回滚版本和停用策略。
- 过期/撤回数据从新任务立即隔离；异步清理索引/派生集需状态可观测并支持重跑。
- 模型制品保存许可证、来源、权重 hash、训练数据快照 ID、代码/配置版本、评估报告和批准记录。

## 11. 阶段计划

| 阶段 | 交付 | 完成门槛 |
|---|---|---|
| 0. 源码审计 | 已核对 Brain/Provider schema 与迁移源码、AI Control Center/Provider Console、关键 Brain API/service/worker 和 Studio 模板映射；尚未核完每个行业调用方、生产 DB/资源/合同 | **核心源码盘点已完成；全行业调用方/外部运行态待验证**；无生产读写 |
| 1. 强制 namespace | 行业模板 registry 已补齐稳定映射；Brain API/service、商家员工记忆路径和商家助手反馈已改为服务端解析并按 tenant + industry + studio + knowledge namespace 过滤；不明历史记录保持空 namespace | **首个实施切片通过**：伪造客户端 namespace 被忽略、关闭/不匹配模板 fail closed、同租户跨 Studio 与 legacy 记录不可检索、隔离 PostgreSQL migration/检索测试通过；多行业 entitlement 和全行业调用方审计仍未完成 |
| 2. 治理数据/授权 | 扩展既有 Admin AI Console，做知识/经验审批、来源许可/撤回、行业 Steward 范围和审计 | 多租户数据不得被未授权导出、复用或训练 |
| 3. 数据集/评测 | 行业黄金集版本、授权锁定、离线评测队列、逐指标/逐案例结果；先建立 Apparel/Leather/Restaurant 分离基线 | 修改样本生成新版本；可重复跑出同一评估契约；权限测试通过 |
| 4. 模型制品/训练 | 记录开放权重许可证/来源；实现训练编排、资源配额、artifact/checkpoint 管理 | 隔离训练资源、幂等、失败清理、数据撤回、可重复构建与审计通过 |
| 5. 晋级与运行中心 | 评审、灰度、健康/质量门槛、自动停发保护与人工回滚 | 无审核不得上线；回滚真实恢复上个模型；成本/资源有依据 |
| 6. 全行业双模式 | 每一项能力在混合模式和 RUDA 自有运行模式分别进行真实测试 | 每个 Studio 独立通过能力评测、隐私/断网/故障测试后才可替换第三方 |

## 12. 测试与验收

- Prisma migration：使用隔离 PostgreSQL 验证 migration 执行、legacy 空 namespace 隔离、约束、索引及 schema/client 一致；历史 Brain 记录刻意不回填。生产规模锁表评估与生产应用状态仍待发布前确认。
- 授权单测/API：不带 namespace、伪造行业/Studio、tenant mismatch、角色越权、过期/撤回 consent、共享资料审查失败一律拒绝。
- 交叉隔离：行业 A 不能检索行业 B 的私有/专业数据；tenant A 不能检索 tenant B；公共知识仅限已审查 shared scope。
- 学习链路：未经验证经验不可晋级；坏样本/冲突 lesson 显示待审；数据集冻结后不可原地修改；撤回后新训练拒绝。
- **记住了：** 授权的项目经验跨会话仍可检索；撤回、过期、租户切换后不可检索，并能追溯来源和授权版本。
- **学会了：** 对独立保留的基准任务，比较“使用已验证经验”和“不使用经验”的版本化评测；证明质量改善而非复述或复制旧答案。
- **自有模型掌握了：** 记录 RUDA 自有权重摘要/来源许可/运行节点，隔绝全部外部模型凭证后，已认证能力仍能完成任务；该测试按行业与能力分别执行。
- 训练/模型：模拟取消、超时、重复任务、资源耗尽、worker 重启、checkpoint 损坏、评测失败；任何故障不污染 active model。
- 发布/回滚：阈值不足拒绝发布；无审批不能 active；灰度错误率越界停止；回滚后确认实际 Provider 路由使用旧版。
- 供应商/自有模式：密钥不出现在 API/log；按任务统计调用成本；逐能力验证关掉外部 Provider 后的真实可运行状态。
- 管理 UI：平台 Web 与平台手机端真实权限、加载/错误/空/确认/拒绝/冲突/撤回状态、截图及 console/网络证据。
- 所有指标必须注明数据集版本、评测器、模型版本和时间窗；禁止只报告一个全行业总准确率。

### 全局验收清单

- [ ] 所有运行 Studio 的行业可在唯一平台服务中注册/配置；行业 namespace、专业数据集、评估规则和模型版本独立。
- [ ] 数据授权、来源、用途、审批、撤回与删除审计可追踪，默认不跨租户/跨行业。
- [ ] Provider、训练、评估、部署与成本资源状态通过真实服务/数据库持久化。
- [ ] 训练与推理资源隔离；错误、超时、取消、重试/幂等和审计可验证。
- [ ] 模型晋级需要可复核的独立评测和适当审批；灰度失败/人工回滚成功。
- [ ] 混合运行与全自有运行按行业/能力分开证明，不以计划或演示替代。
- [ ] 各行业管理员和普通商家不能通过 UI/API 绕过授权边界。

### 用户确认版：RUDA CORE 最终证据清单

RUDA CORE 的目标是可持续积累获授权的真实业务经验、逐步训练和运行 RUDA 自有模型，并按能力减少外部 API 依赖；以下是目标验收，不代表当前已经实现。记忆、经验、数据集、训练、评估、模型升级是不同环节，任何一个环节有 UI 或记录表都不能替代后续真实证据。

| # | 最终验收证据 | 通过条件 |
|---|---|---|
| 1 | 双模式切换 | 按行业/Studio/能力分别验证混合模式和 RUDA 自有运行模式；路由决策及模型版本可追溯。 |
| 2 | 外部 API 调用记录 | 真实 Provider 调用可核对输入/输出引用、Provider 与模型版本、任务、费用、时间和保存授权；不记录隐藏推理或泄漏密钥。 |
| 3 | 跨会话长期记忆 | 经授权的记忆能在后续会话检索；可核对来源和权限；撤回、过期、删除或租户切换后不可继续检索。 |
| 4 | 企业/行业隔离 | 以 API 与数据库测试证明其他 tenant、industry、studio 的专业记忆/知识/任务不可读取或用于训练；客户端伪造 scope 被拒绝。 |
| 5 | 成功与失败经验积累 | 获准成功案例、失败案例和人工修正分别进入可追溯审核流程；不能未经审核直接成为共享知识或模型权重。 |
| 6 | 黄金数据集真实生成 | 由获授权、来源可追踪的样本生成带版本数据集；冻结后不可原地修改，撤回授权会阻止后续训练并触发派生数据治理。 |
| 7 | 自有模型真实训练 | 在 RUDA 控制的训练资源执行训练并保存训练配置、数据集版本、资源、日志、检查点与候选权重摘要；不以 API 调用或下载模型冒充训练。 |
| 8 | 新旧模型独立比较 | 在冻结且独立的评测集上按能力对照基线模型和候选模型，保存逐指标/逐案例结果、阈值及结论。 |
| 9 | 自动升级流程 | 从问题发现、候选训练、独立考试到审批/灰度均有真实状态和审计；系统可以自动提出或准备升级，但不得绕过授权审批自行修改生产权重/路由。 |
| 10 | 模型回滚 | 在测试环境真实触发回滚，确认服务端路由恢复至先前批准版本，旧制品可用且审计完整。 |
| 11 | RUDA 自有服务器推理 | 在记录的 RUDA 自有运行节点上完成已认证能力的真实推理，证明使用的权重/版本、资源和输出。 |
| 12 | 关闭外部 API 后独立运行 | 对已认证能力隔绝/禁用外部 API 凭证并完成任务；未达本地质量门槛的能力必须明确不可用，严禁静默回退外部模型。 |

自有模型采用逐能力退出机制：独立测试 → 影子对照 → 小比例试运行 → 逐步扩流 → 本地独立运行 → 才允许关闭对应外部 API。不同能力不得共用一个笼统达标结论；高风险动作仍须保留人工确认。

## 13. 部署、迁移与回滚

- 不新增独立服务部署前，先评估现有 Express/worker/Gateway 的故障隔离和资源预算；GPU 训练任务不可与交互推理无上限抢占资源。
- 所有 migration 先在隔离 PostgreSQL 验证并采用兼容方式；无法由权威来源证明行业归属的历史 Brain 数据维持不可检索的空 namespace，不作猜测式回填。若未来执行经审核的人工归类，须另行设计 dry-run、校验、分批处理与断点恢复。
- 先部署兼容读写代码，再回填/启用强制 namespace；存量无法可靠归属行业的记录不得默认归 Apparel 或 Shared Knowledge，先隔离待人工审查。
- 出现检索泄漏立即全局关闭相关 namespace 的写入/检索；不删除原始租户数据；恢复前重新跑隔离测试。
- 发生模型回归时停用新 artifact 并将服务端路由恢复至上一个批准版本；训练制品可保留取证但不影响线上业务。
- 生产部署、数据迁移、删除与硬件资源变更遵循现有审批/备份/回滚规则；本次仅整理文档。

## 14. 风险与假设

- 现有 Brain schema/migration 的源码关系已静态核对；实际生产迁移状态、vector provider、数据保留/删除运行策略、Provider 调用运行量、GPU/模型资源尚未核验。
- 当前行业注册源和多行业 entitlement 仍在 `modaui-industry-studios-v2.md` 阶段 0 审计范围；Evolution Center 不另建一个行业事实来源。
- 历史数据缺行业/Studio 标签时无法安全推断，可能需要人工归类或保持不可检索。
- 客户合同/供应商许可可能限制外部 Provider 输入留存、模型训练与经验复用；需逐模型/Provider 审核。
- 自有模型训练、90% 专业任务成功率、减少第三方 API 依赖均为目标，须逐能力以真实评估证明。

## 15. 实施记录

| 日期 | 阶段 | 状态 | 记录 |
|---|---|---|---|
| 2026-11-14 | 文档先行/静态审计 | 已完成 | 记录现有 ModaGPT Brain、经验/评测/反馈/学习记录、Provider 和平台 AI 管理界面；确认现有基础可复用但行业 namespace、全局训练/评测/发布治理未闭环。生产 DB、GPU 和模型运行态未验证。 |
| 2026-11-14 | 平台优先级与验收补充 | 已完成 | 按最新 V2.0 要求，将自我进化明确为 RUDA CORE 平台优先级；区分记忆/学习/训练/升级，补入“记住、学会、自有模型掌握”三项必须分别举证的最终验收，并补充 Brain schema 的行业/Studio 强隔离缺口。源码审计完成，生产运行态仍待验证；未进行生产读写。 |
| 2026-11-14 | 稳定行业 namespace 映射 | 已完成（配置/契约） | 将 V2.0 确认的八个行业模板映射写入唯一模板 registry，并添加映射完整性/唯一性测试。 |
| 2026-11-14 | Brain 行业隔离首片 | 已完成（代码与隔离验证；未部署） | Brain 记忆、文档/分块、实体、事件、事实、经验、评测、反馈、课程、检索日志及学习运行记录增加行业/Studio/namespace；所有服务端查询和写入按服务端解析的 tenant/industry/studio/namespace 限定。迁移对历史记录保留空值隔离并通过一次性 PostgreSQL 全迁移 runner；单测、类型检查和 1/1 PostgreSQL Brain 集成测试通过。商家单行业模型仍在，多行业授权、全行业调用方复核及生产迁移未完成。 |
| 2026-11-14 | 用户确认版 CORE 验收基线 | 文档已更新；能力待实施/验证 | 将双模式、外部调用证据、跨会话记忆、租户/行业隔离、成功/失败经验、黄金集、真实自有模型训练、新旧评测、自动升级、回滚、自有服务器推理及关闭外部 API 的 12 项证据写入本规格；RUDA CORE 目标和现状明确区分。 |

## 16. 文档交付验证

- 本次 namespace 切片变更：`src/constants/merchantIndustryTemplates.ts`、`src/server/modagptBrain.ts`、`src/server/modagptBrainService.ts`、`server.ts`、`prisma/schema.prisma`、`prisma/migrations/20261114220000_modagpt_brain_industry_namespace/`、Brain 单测/隔离 PostgreSQL 测试与 fixture。
- 实际验证：`npx prisma validate`、`npx prisma generate`、`npx tsc --noEmit -p tsconfig.json`、`node --import tsx --test tests/modagpt-brain.test.ts tests/industry-module-contract.test.ts`（24/24）、`npm run test:modagpt:brain:integration`（隔离 PostgreSQL 1/1）通过；`git diff --check` 通过。
- 未执行：生产 migration、部署/推送、模型训练/评测/灰度/回滚；GPU/本地模型及 Evolution Center UI 仍待开发和验证。
- 状态：行业隔离首片已在代码和隔离数据库验证，平台级训练、治理、发布等闭环仍未完成。

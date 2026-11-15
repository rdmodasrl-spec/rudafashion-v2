# RUDA V2.0 八行业 AI Studio 全面补全执行计划（阶段 0/1 契约与增量实施基线）

- 日期：2026-11-14
- 状态：**开发中（文档先行）**。本文件是增量补全的执行基线，不代表任何阶段已完成或已验收。
- 依据：`AGENTS.md`、`modaui-industry-studios-v2.md`、`apparel-studio-v2.md`、`global-ai-evolution-center.md`、`merchant-cross-device-sync.md`、`merchant-three-end-matrix.md`、`restaurant-ordering.md`、`modaui-four-industry-ai.md`、`trading-wholesale-ai.md`、`leather-studio-merchant-integration.md` 及当前仓库源码/Prisma/migration/测试。
- 约束：增量开发，不推倒重做；保护 Apparel/Leather 既有成果；不破坏现有商城和其他行业；不使用模拟数据、静态页面或假接口冒充完成；未实测项一律标“待验证/被阻塞”。

## 1. 当前 WIP 审计（2026-11-14 静态盘点）

> 审计来源：`git status`（61 个已修改、32 个未跟踪）、现有规格与源码。未执行全量测试，未连接生产数据库/Provider，未做真实三端验收。

### 1.1 已落地/进行中的共性切片
| 领域 | 当前证据 | 状态 | 缺口 |
|---|---|---|---|
| 行业/Studio/知识空间映射 | `src/constants/merchantIndustryTemplates.ts` 八模板映射；`MerchantStudioEntitlement` schema+migration `20261114230000`、服务端校验及 `GET /api/merchant/studios` 返回授权记录 | 部分完成 | 尚无授权/撤销管理流程；生产 migration 未应用；行业专业 UI、AI Job/知识和文件调用方未全部改用 entitlement |
| 共享 Studio 项目/版本 | `MerchantStudioProject`/`Version` schema+migration `20261114210000`、`20261114240000` 行业模板隔离、`/api/merchant/studio-projects` + Leather 兼容路由；多 entitlement API 测试覆盖 | 部分完成 | UI 仅接当前商家模板；仅标题/简报 payload；无文件/素材/AI Job/CAD 关联；无跨端事件/离线恢复/真实端到端验收；生产 migration 未应用 |
| Brain 行业命名空间首片 | schema 字段与 migration `20261114220000_modagpt_brain_industry_namespace`、服务端解析/过滤 WIP、集成测试脚本/用例存在 | 部分完成 | 历史空 namespace 隔离策略需生产核实；多行业/训练授权/治理未闭环 |
| AI Provider/Gateway 扩展 | `aiEmployeeProviders.ts` DeepSeek/fal/cloud-only 路由与 image edit WIP、`modagptEntitlements` Studio image policy、`modagptImageTasks`/工作台/小程序能力调整 WIP | 部分完成 | 真实密钥/供应商调用、成本账本、按能力路由策略、失败重试/熔断审计、三端实测未完成 |
| Restaurant 受限基础 | migrations `20261114150000`~`20261114200000`、`restaurantCatalog*`/`restaurantProcurement`/`restaurantCosting`、桌台/菜单 Web+小程序页面与路由接入 WIP，相关隔离测试脚本存在 | 部分完成 | 仅菜单/桌台/配方/采购等受限切片；无 POS/KDS/订单支付/外卖配送/财务多门店/Restaurant Studio 完整闭环 |
| Leather 基线/整合 | `legacy/leather-studio-v1/`、Leather 项目兼容、专项规格 | 部分完成 | 未接 RUDA 商家身份/CAD/纸格/工程文件/AI Job/导出/跨端同步全链路 |

### 1.2 平台级关键缺口（阶段 1 阻塞项）
1. **多行业商家授权**：新增 entitlement 持久模型与只读解析，支持多行业记录并与现有单模板商家兼容；仍缺管理员授权/撤销工作流、AI 团队关联改造和生产 migration。
2. **统一 Project/File/AI Job/素材/版本契约**：`MerchantStudioProject` 仅通用 payload；`ModaGptTask` 无 `projectId/studioCode/industryCode/fileIds/assetIds/revision` 关联；商家媒体/素材散落在 `MerchantModaGptDesign`、对象存储 key、商品媒体等路径。
3. **跨端同步与恢复**：SSE+30s 补偿存在于部分商家资源；Studio 项目/AI Job/文件缺统一事件、离线恢复、幂等恢复与冲突 UX 契约；小程序无 SSE。
4. **AI Gateway 治理**：Provider 配置存在，但缺统一按 `industry/studio/capability/task` 的路由策略、成本/用量归因到 project/job、标准失败分类与安全重试、供应商实测证据。
5. **权限/隔离**：需服务端强制 tenant + industry + studio + employee/role + resource ownership；行业知识/记忆/训练数据默认隔离。

### 1.3 八行业能力缺口矩阵（摘要）

| 行业/Studio | 已有基础 | 待补全（真实闭环） | 优先级 |
|---|---|---|---|
| Apparel Production/Wholesale（`apparel_studio`，生产与批发权限分离） | ModaUI 工作台、试穿/设计/换色基础、共享项目简报、Provider/素材/Brain 复用 | 真人试衣质量闭环、AI 设计+局部修改、模特棚拍、精细换色、AI 走秀视频、专业 CAD 打版/放码/生产导出；NL 编排；项目-文件-任务-版型-质量-批准；生产权限与批发权限服务端隔离；三端+Provider 实测 | P0（保护既有） |
| Leather（`leather_studio`） | Leather 基线代码、共享项目/版本 API、行业映射 | 整合 V1.0/Pro/V1.1/V1.2 到 RUDA 身份/权限；CAD/纸格/工程文件/AI Job/导出；统一文件与跨端同步；三端入口与回归 | P0（保护既有） |
| Trade（`trade_studio`） | 采购草稿/供应商查询绩效等只读+受控任务链（隔离验证） | 商品识别/分类、供应商管理、报价分析、多语言目录、采购工作流完整闭环；项目/素材/对话三端与真实验收 | P1 |
| Department Wholesale（`department_wholesale_studio`） | 只读分析工具；采购草稿写入尚未实现 | 当前增量目标：验证既有采购工具/审批链能否仅对 `department_wholesale` 开放，完成供应商与 SKU 读取、用户确认、采购草稿持久化/回读及租户隔离；图像识别、多语言目录、组合/比价自动决策和三端实机仍是后续缺口 | P1 |
| Retail Chain（`retail_chain_studio`） | 只读门店销售/库存/调拨候选 | 总部-门店-销售分析-库存调拨-补货-采购-多门店报告；真实门店/POS/权限与确认流程 | P1 |
| Retail（`retail_studio`） | 只读销售/资料缺失/补货候选 | 商品图片/标题描述/多语言/定价辅助/库存补货/营销/销售分析；与权威业务服务确认流程 | P1 |
| Restaurant（`restaurant_studio`） | 行业映射+菜单/桌台/配方/采购等受限切片与部分三端页面 | POS、桌台/预约、QR 点单、KDS、外卖/配送、配方食材采购库存、财务、多门店、Restaurant AI Studio；真实订单/支付/库存/权限闭环 | P1（分阶段） |

### 1.4 已确认的 Studio 入口范围

- 商家后台现有公共经营目录保持不变；行业专业能力只在 ModaUI/AI Studio 内呈现，不新增行业经营导航或多个 AI 菜单。
- 现有导航只保留一个 AI Studio 入口；进入后按当前商家行业自动显示对应专业 Studio，不增加 Studio 选择目录或其他行业 AI 一级菜单。
- registry 有八个行业模板/经营模式；Apparel Production 与 Apparel Wholesale 共用 `apparel_studio`，在同一个 Studio 内按当前模式区分权限，生产版型能力仍需 production entitlement。
- Web、手机 Web、小程序已接入同一授权列表并按当前行业模板自动路由；前端行业模板只用于选择呈现上下文，服务端仍从当前 JWT 和 entitlement 校验。代码与隔离库契约测试通过；本地浏览器进入 Studio 时因当前数据库缺少 `MerchantStudioEntitlement` 表返回 500，真实端验收仍被数据库迁移阻塞；小程序未做开发者工具/真机验收。

## 2. 阶段 1：公共底座契约（实现前冻结，允许小步迭代并版本化）

### 2.1 正式行业/Studio 权限与多行业授权

**目标**：在不破坏 `Merchant.industry` / `Merchant.industryTemplate` 现有行为的前提下，支持“同商家多 Studio 授权、按 Studio 隔离项目/知识/能力”。

本轮采用的最小兼容模型（新增数据只以服务端授权记录为权威）：
- 新增 `MerchantStudioEntitlement`（或等价权威表）：`merchantId`, `industryCode`, `industryTemplate`, `studioCode`, `mode`(production/wholesale/default), `status`(active/pending/revoked), `capabilities`(JSON, server-validated), `grantedBy`, `grantedAt`, `revokedAt`, `source`；唯一约束 `(merchantId, industryCode, studioCode, mode)`；索引按 `merchantId,status`。
- 兼容策略：存在 entitlement 记录时仅返回其中 `status=active` 且模板 registry 中 `industryCode/studioCode/mode` 完全匹配的记录，不要求所有已授权行业等于商家旧的单值 `Merchant.industry`；若该商家尚无任何 entitlement 记录，才由当前开放的 `Merchant.industryTemplate` 与 `Merchant.industry` 推导只读兼容访问。不得用兼容推导覆盖已有 pending/revoked 记录，也不得把模板推导写成持久授权。
- 多行业策略：一个商家可有多条 active entitlement；不同 `industryCode/studioCode/mode` 分别授权。相同 `(merchantId, industryCode, studioCode, mode)` 使用唯一约束避免重复；`capabilities` 只接受已知 capability 白名单，不信任客户端 JSON。旧商家仍可使用其单模板兼容访问，直至受控迁移或管理员授权记录生效。
- 行业授权和项目读取均由服务端 entitlement 服务裁决；`GET /api/merchant/studios` 返回授权源和能力状态，Studio 项目 API 可按 `industryTemplate` 精确选择授权，并对项目读写按 tenant + template + Studio 过滤；未传模板时只回落到商家现有主模板，不从其他授权中任意挑选。不可用前端行业列表或分类器直接授权。
- AI 团队/Agent：逐步将 `MerchantAiTeamAssignment` 从 `(merchantId, agentId)` 唯一演进为可按 `(merchantId, studioCode/industryCode, agentId)` 区分；迁移前必须审计所有 provision/query 路径并保持旧记录可读。
- 服务端 API：`GET /api/merchant/studios` 返回当前商家已授权 Studio 与能力状态；所有 Studio/项目/AI/文件请求必须校验 entitlement + employee permission + tenant ownership。

### 2.2 统一 Project / File / AI Job / 素材 / 版本

**现有可复用**：`MerchantStudioProject`/`Version`（标题+payload+revision+idempotency）、`MerchantModaGptDesign`（图片素材）、`ModaGptTask`（通用任务）、现有媒体上传/对象存储预签名与权限校验。

目标逻辑资源（统一 contract，存储可分阶段实现）：
| 资源 | 权威 ID | 必填归属 | 并发/幂等 | 备注 |
|---|---|---|---|---|
| Project | `projectId` (server UUID) | tenant/merchant, industryCode, studioCode, actor, entitlement | 创建 `Idempotency-Key`；更新 `expectedRevision`→409 | 继续扩展 `MerchantStudioProject`，payload 版本化 schema |
| ProjectVersion | `projectId + revision` | 同 project | append-only immutable snapshot | 已有；补充 `sourceJobId/fileRefs/assetRefs` 元数据 |
| File/Asset | `fileId/assetId` (server) | tenant/merchant, projectId?, studioCode, purpose, mime, size, storageKey, uploader, acl | 上传 token 单次/过期；完成确认幂等 | 复用现有媒体服务/对象存储；避免客户端拼公开永久路径 |
| AI Job | `jobId` (server, 可与 `ModaGptTask.id` 对齐) | tenant/merchant, projectId?, studioCode, capability, provider/model/version, inputRefs, outputRefs | 提交幂等键；状态机 queued/running/waiting_input/waiting_approval/succeeded/failed/cancelled；重试不重复扣费/写入 | 增量扩展 `ModaGptTask` 关联字段或建立受控关联表，需兼容旧任务 |
| Pattern/CAD Revision | `projectRevision` + typed artifact ref | project, deterministic engine version, quality report | 工程写入必须带 expectedRevision；确定性数据不被模型输出覆盖 | 行业引擎产物；图像结果不得冒充工程结果 |

**API contract 规范（Web/手机 Web/小程序共用）**：
- 认证：`requireMerchantTenant` + employee/action permission + entitlement + resource ownership。
- 列表：分页/游标、`Cache-Control: no-store` 用于权威读；支持按 `studioCode/projectId/jobId/status` 过滤（服务端校验）。
- 写入：`Idempotency-Key`（创建/提交类）、`expectedRevision`（版本更新类）；409 返回 `currentRevision` 与冲突原因。
- 错误 envelope：沿用现有 `success:false,error,details`/`BusinessError` 规范；区分 400/401/403/404/409/413/422/429/5xx。
- 文件上传：预签名→直传对象存储→服务端确认并绑定 project/job；校验 MIME/大小/用途/权限。
- Job 查询/恢复：按 `jobId` 查询原任务与输出引用；网络不确定时客户端重放同幂等键或轮询原 job，不重复创建。

### 2.3 跨端同步、冲突、断网恢复

- 权威源：服务端 DB + 对象存储；客户端缓存/本地草稿仅作非权威 UI 状态。
- 事件：复用 `merchantSyncEvents`/SSE，扩展 `studio_projects`/`studio_jobs`/`studio_files` 资源类型（或等价）；小程序 `onShow` + 受控轮询补偿。
- 冲突：所有 Studio 资源更新走条件写入；409 必须提示用户并刷新最新版本，不静默覆盖。
- 恢复：上传/任务使用可恢复的 `fileId/jobId/idempotencyKey`；恢复流程先查服务端状态再决定重试。
- 端侧要求：电脑 Web 专业编辑、手机 Web 受限编辑/查看、小程序轻操作/确认/通知；三端显示同一 ID/版本/状态语义。

### 2.4 AI Gateway、模型接入、成本与失败重试

- 统一入口：所有模型调用经服务端 Gateway（复用 `aiEmployeeProviders`/RunPod/catalog/call store），前端无密钥、无直连第三方。
- 路由维度：`industryCode, studioCode, capability, taskRisk, privacy/consent, latency/cost budget, provider health`；按配置选择 DeepSeek/fal/现有 Provider/未来自有模型，失败按白名单能力回退并记录。
- 成本与审计：每次调用记录 tenant/merchant/projectId/jobId/capability/provider/model/tokens-or-units/cost estimate/actual(if available)/status/error；额度预留/释放与幂等重试一致。
- 重试策略：仅对可安全重试的瞬时错误（网络/429/5xx）按退避重试；业务校验失败、权限失败、内容安全拒绝、确定性工程冲突不自动重试；重试不得重复扣费或重复落库产物。
- Provider 实测：在具备密钥与测试商家环境后执行真实调用矩阵并留证；无密钥/无环境不得宣称“已接通”。

## 3. 分阶段实施顺序（可并行子任务，但按门槛验收）

1. **P1 文档与契约冻结**（当前）：补全本计划、更新模块/矩阵/同步文档与 API 契约草案；盘点并登记 WIP 切片验证状态。
2. **P1 公共底座最小可运行**：entitlement 兼容模型 + Studio 列表/校验；Project/File/Job 关联字段与 API；同步事件与冲突/恢复契约测试；Gateway 路由/成本/重试基础实现与 mock+隔离 DB 验证。
3. **P1 三端基础接线**：电脑/手机 Web/小程序对同一 Project/Job/File 状态读写与恢复；保留各端原布局。
4. **P2 Apparel & Leather 专业闭环**：优先复用与补全既有能力，补真实文件/任务/版本/导出链路。
5. **P2 其他六行业**：在底座上逐行业补专业工作流与业务写入（经权限确认），Restaurant 按既有分期推进 POS/KDS/订单支付等高风险闭环。
6. **P3 行业 AI 智能化**：行业助手/知识空间/项目记忆/工作流，读取授权真实数据，写入需确认；行业与租户严格隔离。
7. **P4 真实验收与回归**：逐行业逐端逐项执行 10 类验收，问题修复后回归，留存证据；生产发布/迁移按 `AGENTS.md` 11.1 与发布约定单独执行。

## 4. 验证矩阵（未执行项标待验证）

| 类别 | 命令/方式 | 预期 | 当前状态 |
|---|---|---|---|
| 类型与静态 | `npm run lint` / `tsc --noEmit`、`prisma validate`、`git diff --check` | 通过 | `npm run lint`、此前 `prisma validate`、本轮 `git diff --check` 通过 |
| 单元/契约 | `npm run test:unit`、定向 `node --import tsx --test ...` | 相关通过，无回归 | `npm run test:unit` 1471/1471 通过；Studio 相关定向测试 32/32 通过 |
| 隔离 PostgreSQL | 现有 `test:merchant-studio-projects:integration`、`test:modagpt:brain:integration`、restaurant/leather 隔离脚本及新增 entitlement/job/file 套件 | migration+持久化+权限+幂等+冲突+隔离通过 | `test:merchant-studio-projects:integration` 通过；其他脚本未在本轮执行 |
| 真实 API/Provider | 具备测试账号与密钥时调用 DeepSeek/fal/既有 Provider；记录请求、结果、成本、失败 | 真实可用或明确不可用 | Provider 未实测；本地 `GET /api/merchant/studios` 因缺少 `MerchantStudioEntitlement` 表返回 500，未对目标数据库运行迁移 |
| 三端验收 | 电脑 Web(1440/1024)、手机 Web(390/820)、小程序开发者工具/真机；同项目跨端操作 | 同 ID/版本/权限/状态一致 | Web/手机 Web 本地只读页面已检查 1440/820/390，无横向溢出；进入 Studio 被上述缺表 500 阻塞。小程序无开发者工具/真机证据，待验收 |
| 业务闭环 | 每行业专业流程 + Studio→Product Center 草稿→商家确认发布 | 真实数据闭环 | 待执行 |

## 5. 风险与控制

- **WIP 并存**：保留现有未提交改动，不回退无关文件；提交前逐项审查 diff 与测试。
- **数据模型演进**：新增表/字段优先 additive；迁移先隔离库验证并准备回滚/兼容窗口。
- **生产安全**：不执行未授权生产迁移/破坏性操作；发布遵循 `npm run sync -- "..." -- --deploy` 与失败保护。
- **能力真实性**：未接通 Provider/设备/业务流程必须显式标记不可用，不得伪造成功。

## 6. 本轮执行记录（滚动更新）

- 2026-11-14：完成全仓 WIP 与规格静态审计；创建本执行计划文档，冻结阶段 1 契约方向与分阶段门槛；后续按 P1 底座实现推进。
- 2026-11-14：实现 `MerchantStudioEntitlement` additive schema/migration、服务端稳定 ID/capability 校验及多授权列表读取；共享项目可按行业模板隔离读写，同一商家的生产版/批发版幂等请求空间分离。尚未实现管理员授权/撤销 UI/API，未应用 migration，未完成 Web/手机 Web/小程序多 Studio 选择与真实验收。
- 2026-11-14：保留唯一商家后台 AI 工作室入口并将 Web/手机 Web/小程序接入服务端授权校验及当前行业自动路由；单元测试 1471/1471、定向 Studio 测试 32/32、TypeScript 检查、商家 Web/手机 Web 构建和 Studio 隔离 PostgreSQL 集成测试通过。只读浏览器检查发现当前数据库缺少 `MerchantStudioEntitlement` 表，Studio API 返回 500；未执行数据库迁移、提交、推送或部署。完整三端、Provider、八行业专业闭环及 Product Center 验收仍未完成。

# RUDA Leather Studio 商家工作室整合规格与基线审计

- Module ID：`leather-studio-merchant-integration`
- 模块状态：部分完成（基线审计与共享项目/版本 API 已完成；桌面工作站、移动端、AI 与文件能力尚未完成）
- 日期：2026-11-14
- 基准项目：`legacy/leather-studio-v1/`
- 目标运行面：商家后台电脑 Web、手机 Web、RUDA 商家小程序
- 设计依据：`docs/engineering/design-values.md`、`docs/engineering/mobile-design-system.md`
- 原则：保留指定项目原样作为功能基准和回滚来源；先复用其实际引擎与流程，不复制一套同义系统。

> **项目类型纠正：** 原路径 `miniprogram/ruda-ai-leather-studio/` 实际是独立 React/Vite + Express 皮具 AI 工作室，不是微信小程序。该完整源码树现已原样移动到 `legacy/leather-studio-v1/`，作为只读功能基线/回滚来源，不是新的 RUDA 构建目标。RUDA 微信小程序仍是 `miniprogram/` 根下由 `app.json` 注册的原生页面。目录名不代表运行面。

## 1. 问题、目标与范围

把已有独立 Leather Studio 的真实识别、结构推理、CAD、项目、知识和导出能力接入 RUDA 商家后台；电脑端为完整专业工作站，手机 Web 与微信小程序使用不同布局但操作同一服务端项目和原生 CAD 版本。

此次审计覆盖指定项目全部 57 个源/配置/样例文件的清单、SPA/REST 路由、主要调用链、CAD/识别/知识代码、Drizzle schema 与 migration、登录和持久化方式，以及 RUDA 商家 Web、手机 Web、小程序行业入口与服务端租户中间件。

本规格不宣称整合功能已实现，也不批准覆盖源项目、删除数据、数据库改写或生产发布。

## 2. 指定项目现状与功能清单

### 2.1 页面、组件与路由

这是一个 React 单页应用，不是多页小程序。`src/App.tsx` 以 `HomeLanding`、Leather 工作台、照片/结构视图为主界面；工作台组合 `AiChatPanel`、`PatternCanvas`、`InspectorPanel`，并打开 `ExportModal`、`VersionDrawer` 和 `IntelligenceDrawer`。尚未发现独立 URL 路由表。

服务端由该项目自己的 Express `server.ts` 提供 `/api/v1/*`。主要 API 按能力分为项目/图片/分析任务、AI 指令/CAD/质量/版本/导入导出、标准模板、记忆/知识/案例/评测/训练集/生产反馈；没有 RUDA 商家后台入口，也没有微信小程序页面调用这些 API 的证据。

### 2.2 功能逐项审计

状态含义：

- **已实现（独立版源码）**：前端与服务端/确定性引擎存在可追踪实现；不等于已通过 RUDA 集成或真实生产验收。
- **部分实现**：关键代码存在，但身份、租户、持久化、并发、文件、模型或验证闭环不足。
- **未实现**：指定项目内未找到对应功能。

| 功能 | 状态 | 源码证据与当前边界 |
|---|---|---|
| 页面与工作流 | 部分实现 | 单 SPA 含项目首页、工作台、照片结构视图、CAD、参数检查器、版本/智能抽屉和导出弹窗；没有 RUDA 商家导航/小程序入口。 |
| AI 对话与自然语言 CAD 指令 | 已实现（独立版源码） | `AiChatPanel` → `/projects/:id/ai/command/plan` → 用户确认 → `.../execute`；Gemini 生成结构化命令，确定性 CAD 事务执行并可回滚。该模型调用未接 RUDA AI Gateway。 |
| 图片上传/多角度采集 | 部分实现 | 有 7 视角引导、参考物校准和照片质量检查；图片作为 data URL 写入项目 JSON，使用独立 JSON 请求，不产生 RUDA `File ID` 或走统一媒体服务。 |
| 图像识别与结构拆解 | 部分实现 | `runPhotoReconstructionPipeline` 有 14 步流程并调用 Gemini Vision，识别包型、可见/推断隐藏部件、边界、尺寸和不确定性；推理结果并非图像直接量测的生产纸格，需用户/专业人员复核。 |
| 二维纸格/专业 CAD | 已实现（独立版源码） | `cadEngine.ts` 有 Bezier 路径、几何、参数化生成、节点编辑、部件关系、嵌套、确定性事务、撤销/重做等实现；Web SVG Canvas 提供交互编辑。尚无本项目自动化测试执行证据。 |
| 参数化尺寸/实测校准 | 已实现（独立版源码） | 宽/高/深、结构、材料、功能参数及多轴毫米校准驱动重新生成纸格；部分其他 API 写入仍未统一要求 expected version。 |
| 缝份、缝合和工艺计算 | 已实现（独立版源码） | `leatherKnowledge.ts` 材料/厚度补偿/工艺规则，CAD 引擎的缝合关系、配对和校验。知识数据仍属于独立 schema/代码。 |
| 标准样板库 | 部分实现 | `masterPatternLibrary.ts` 静态内置模板 + PostgreSQL 自定义模板 API，支持筛选、匹配、应用；模板数据和生产审核边界尚未纳入 RUDA 权威存储/角色。 |
| 五层记忆与长期学习 | 部分实现 | schema/service 包含 session、user、project、engineering knowledge、historical experience、向量检索、反馈候选、审核升级和版本回滚；PostgreSQL 未配置时有内存实现。现有 `ownerUid/enterpriseId` 不等同 RUDA `tenantId` 与成员授权。 |
| 知识库/训练集/质量评测 | 部分实现 | 皮革材料/部件/工艺/结构、训练样本、盲测、评估数据集、评估结果和 benchmark 实现存在；当前入口由独立认证保护，生产评估的有效性不能由页面/种子数据本身证明。 |
| 质量检测与签核 | 部分实现 | 有 CAD 几何/接缝校验、照片像素启发式、质量报告、打版师/实物样签核和工厂反馈；真实产线样本验收未在本轮执行。 |
| 版本/项目历史 | 部分实现 | 项目 JSON 内有版本快照和撤销/重做；仅部分 PATCH/AI 命令检查 `expectedVersion`。持久化 upsert 不是 revision 条件更新事务，任务保存在进程内 Map，重启/多实例不能恢复。 |
| DXF/PDF/SVG 导出 | 已实现（独立版源码） | `cadExport.ts` 提供 DXF、PDF、SVG、CSV、JSON 生成及 DXF 解析/往返验证；客户端生成文件，服务端记录导出元数据，不等于 RUDA 文件服务归档。 |
| 登录/商家/员工权限 | 部分实现 | 独立 Firebase Google 登录及 demo token；API 按 `ownerUid` 隔离。没有 RUDA Merchant JWT、`LEATHER_GOODS`、员工角色/权限或商家租户校验。不得沿用为商家正式登录。 |
| 数据库/文件/任务 | 部分实现 | 独立 Drizzle PostgreSQL schema 含 `ruda_projects` 和皮具知识/记忆/评测等表；无 PostgreSQL 时项目回退 JSON；图片内嵌项目 JSON；AI Job 用进程内 Map。物理数据库连接是否与 RUDA 共用需在受控环境核实。 |
| RUDA 商品草稿/商城发布 | 未实现 | 未发现连接 RUDA Product Center 的 API/ID 关联；集成后仍须使用现有商品 API，且只能创建草稿并由用户确认发布。 |
| RUDA 三端入口/项目同步 | 未实现 | RUDA 商家 Web、手机 Web 和微信小程序尚无 Leather Studio 专属入口、共享 Project ID、CAD revision 或互操作验收。 |

### 2.3 独立项目 API 清单

当前独立 Express API 路由清单：

- 系统/模板：`GET /api/v1/system/health`、`GET/POST /api/v1/master-templates`、`PATCH /api/v1/master-templates/:id`。
- 项目/图片/任务：`GET/POST /api/v1/projects`、`GET/PATCH/DELETE /api/v1/projects/:id`、`POST /api/v1/projects/:id/images`、`POST /api/v1/projects/:id/analysis`、`GET /api/v1/jobs/:id`。
- 工程/命令：`GET /projects/:id/components|patterns`、`POST /projects/:id/ai/command/plan|execute`、`POST /projects/:id/quality-signoff|apply-template|calibrate|patterns/:pieceId/validate|versions|versions/:version/restore|undo|redo|exports|import-dxf`、`GET /projects/:id/exports`。
- 智能/评估/工厂反馈：`GET /intelligence/overview|retrieve|blind-tests|production-feedback|benchmarks`，对应记忆、偏好、候选审核、案例归档、知识回滚、评估、盲测、生产反馈和 benchmark 写入路由。
- 训练集/路线图：`GET /training-samples|training-samples/export|architecture/roadmap`、`POST/PATCH /training-samples`。

上述路径是原应用的现有接口，不可直接被三个端作为新权威 API。整合时应提供商家认证下的兼容适配层，并保持 CAD payload 与 ID 不被静默改写。

## 3. RUDA 现有能力与防重复结论

| 区域 | 已存在事实 | 本次整合方式 |
|---|---|---|
| 行业/商家模板 | `Merchant.industry` 有 `LEATHER_GOODS`；`bags_wholesale` 映射到 `merchant_admin_bags_wholesale`，注册模板已开放 | 用稳定行业/模板代码授权；禁止中文名称匹配。前端隐藏入口不作为权限判断。 |
| 商家 Web | `MerchantPortal` 当前有 `fashion_studio` / `modagpt`，无 Leather 专属工作台 | 在现有桌面后台外壳内增加按服务端能力返回的入口，不替换后台布局。 |
| 商家手机 Web | `MerchantMobileApp` 当前提供商家经营导航，无 Leather 专属入口 | 适配手机 Web 原导航与布局，不缩小桌面 CAD 三栏界面。 |
| RUDA 微信小程序 | 原生 `miniprogram/app.json` 与 WXSS/页面；`pages/modagpt` 是既有 AI 入口 | 新增/接入原生便捷入口，复用同一商家 API/项目；不得把独立 React/Vite Studio 当成小程序或另建用户体系。 |
| API/认证/租户 | `server.ts` 的 `requireMerchantTenant` 解析 RUDA 商家 JWT，员工权限由 `requireEmployeePermission` 校验 | 统一用 RUDA JWT、服务端商家/员工身份与租户归属；不引 Firebase、demo token 或新用户表。 |
| 媒体 | 既有 `POST /api/merchant/media/presign` 与共享上传客户端 | 项目图片用 RUDA 媒体服务和 File/asset 关联；不再把大体积 data URL 当权威文件存储。 |
| AI | 有 RUDA AI Provider/员工生成运行时和统一费用/调用边界 | 复用已配置的服务端 AI Gateway；禁止前端供应商直连或新增一套 Gemini key 管理。 |
| 数据 | RUDA 主业务用 Prisma/PostgreSQL；`FashionStudioProject` 是服装帖子文档，不适合作为 Leather CAD 项目 | 不复用语义不符的 Fashion 模型；先定义 Leather 项目、成员/租户、revision、任务和文件关系，再走 Prisma migration 审查。原 Drizzle 数据不可删除或静默改归属。 |

## 4. 目标架构与契约

### 4.1 身份与 Studio 授权

- `LEATHER_GOODS` 与 `bags_wholesale` 是当前可核实的箱包行业映射；`studioCode` 拟使用固定代码 `leather_studio`（实施前由注册表/测试锁定）。
- 每次 API 从已验证 RUDA Merchant JWT 取得 `merchantId`；查数据库确认当前商家已获 Leather entitlement。员工还须通过明确的 Leather Studio 使用/编辑权限，不能以有后台登录即默认可编辑 CAD。
- 其他行业不因共用页面/ModaUI 获得 Leather API 权限。小程序与手机端同样由服务端校验。
- 当前 `Merchant.industry`/`industryTemplate` 为单值；多行业公司同时开 Apparel 与 Leather 不可仅靠本次 UI 显示实现。V2 多行业 entitlement 的权威关系及管理员授权流程必须先落模型/契约；不得信任客户端传入多个行业。

### 4.2 规范 API 能力组

下面是拟议的统一 RUDA 商家 API 资源，不等同当前已存在路由；实施前按现有客户端规范定最终路径和错误包络。

| 能力 | 规范操作 | 必需规则 |
|---|---|---|
| 入口与能力 | `GET studio entitlement/capabilities` | 从会话租户解析行业；返回 studioCode、可用能力、只读/生产授权；不接受客户端 industry/tenant 覆盖。 |
| 项目 | list/create/read/update/delete | 一个权威 Project ID；merchant/tenant/studio 关系由服务端写入；项目列表仅返回该商家可见项目。 |
| 项目写入 | `expectedRevision` + `Idempotency-Key` | 数据库原子条件更新；版本冲突明确返回 409/current revision；重复命令不得重复写部件/重复创建任务。 |
| 图片/文件 | 复用商家 presign 与媒体服务 | File ID 归属 tenant/project/studio；生成/查看/下载逐请求检查授权；不在跨端 JSON 缓存里保存权威图片。 |
| AI Job | create/read/recover/cancel（适用时） | 持久化 job ID、状态、失败原因、幂等键；任务重试不重复扣费/生成；由服务端调用 RUDA Gateway。 |
| CAD/版型 | 读写完整原生 `Project`/Pattern payload | 不丢弃未知工程字段；算法/导出复用经审计的现有引擎；仅用户确认后应用 AI 提案。 |
| 知识/记忆 | 按 studio、tenant、成员/权限查询和修改 | 现有记忆层/审核级别/训练集访问不能跨行业泄漏；先定数据迁移及现有记录归属。 |
| 导出 | DXF/PDF/SVG/CSV/JSON | 复用既有导出实现；导出前重新校验项目 revision 和生产权限；需要归档时关联 RUDA 文件服务。 |

### 4.3 电脑、手机、小程序职责

- **商家电脑 Web：**复用原有 CAD 引擎、PatternCanvas、工程参数、结构/接缝检验、版本和生产文件能力；放在现有 MerchantPortal 外壳内。
- **商家手机 Web：**同一项目/任务/文件/版本；支持照片、对话、查看结构/纸格、有限参数编辑、确认、历史与审批。复杂节点编辑仍由电脑端完成；UI 保持现有 mobile shell。
- **RUDA 小程序：**原生采集/拍照、对话、任务状态、结果、轻量修改/确认和历史；共用 API 与项目数据，不复制完整 CAD 引擎和工作站布局。
- UI、文案和行业入口按现有 RUDA 平台风格：Web 使用 `design-values.md`；Mobile Web 使用 `mobile-design-system.md`；小程序沿用其原生 WXSS/rpx/导航；禁止在后台引入旧 Studio 的棕铜色装饰作为第二品牌色。

## 5. 历史数据、迁移与回滚

- 指定源目录和其中的数据文件目前为未跟踪文件；本次审计未读写项目 fallback 数据文件，未覆盖原项目。
- 源项目有独立 Drizzle migrations/schema（包括 `users`、`ruda_projects`、皮革知识/材料/五金/工艺/结构/案例/经验、五层记忆、反馈/候选/版本、评测/向量、盲测、模板、工厂反馈、训练样本等），另有 JSON fallback。实际 PostgreSQL 是否含有效用户项目/训练数据，当前没有连接证据。
- 在确认生产/开发库、数据行数、Firebase UID 与 RUDA Merchant/员工映射、企业归属和媒体对象前，禁止自动重属主或批量迁移。保留源 schema 和数据为回滚来源；迁移需先备份、校验计数/ID/CAD checksum，再按可重复批次导入并验证跨端读取。
- 新增的 RUDA 持久层应为兼容式 Prisma migration；不删除旧表/列，不在导入前覆盖项目；回滚为停用 Leather API/入口并恢复原独立 Studio，不依赖逆向删除源数据。

## 6. 验收计划

### 6.1 用现有真实用例建立回归基线

优先复用 `MASTER_PATTERN_LIBRARY`、`BENCHMARK_CASES_SUITE`、`aiEvaluationDatasets`、`blindTestRecords`、DXF 往返验证和样例包图；将真实可复用的脱敏 CAD fixture 纳入 RUDA 测试。基线项目当前没有 `test` 脚本，且 lint/build 结果见 §7，故不能声称已完成回归。

### 6.2 必测场景

1. 箱包批发商商家账号打开 Leather Studio；其他行业请求同一 API 返回 403。
2. 员工无 Studio 权限不能读/写项目；授权员工只能访问当前 tenant 的项目。
3. 一个已有项目在电脑创建/上传后，手机 Web 和小程序读取同一 Project ID、File ID、CAD payload 与版本。
4. 手机上传照片/发出 AI 命令后，电脑能读取持久化结果和 AI Job；断网恢复不会伪成功或重复任务。
5. 电脑编辑 CAD 后手机/小程序能读最新 revision；过期写入为 409，CAD 新旧字段不丢失。
6. 同幂等键重复提交不重复产生项目、部件、任务或扣费；并发冲突不 last-write-wins。
7. 样例图经过照片质量检查/结构重建，按固定 benchmark 验证尺寸、纸格、缝线和校验输出；人工确认前不标记生产合格。
8. 原标准模板、手工节点/参数修改、undo/redo、DXF 导入、DXF/PDF/SVG/CSV/JSON 导出结果与原始基准一致。
9. 关闭/撤销权限后，所有端入口消失且服务端拒绝访问；历史项目仍保留。
10. 同一商家多行业的授权工作室可以并列存在；增加/移除行业不得覆盖原项目（等待 V2 entitlement 关系实现后验收）。

### 6.3 UI/端侧验收

- 桌面 Web：1440×1000 与 1024×800，真实商家会话；工作站入口、原 MerchantPortal shell、现有 ModaUI 助手位置/上下文、CAD 交互和错误/冲突状态。
- 手机 Web：390×844、820×1180；沿用手机后台原导航/布局，检查拍摄/上传、轻操作、版本和无横向溢出。
- 小程序：微信开发者工具/真机，验证原生入口、登录态、拍摄/上传、任务恢复、项目详情、确认与权限拒绝。
- 真实截图与操作记录缺失时，端状态只能标为“待验证”。

## 7. 本轮基线验证

命令均对未修改的指定项目执行：

- `npm --prefix legacy/leather-studio-v1 run lint`（移动前基线检查）：失败。环境未安装独立项目依赖，缺少 `drizzle-orm`、`firebase/auth`、`drizzle-kit`、`pg`、`jspdf`、`firebase-admin` 等模块；另有 `server/intelligenceInMemory.ts` 与 `server/intelligenceService.ts` 两处 `unknown[]` → `string[]` 类型错误。
- `npm --prefix legacy/leather-studio-v1 run build -- --outDir /tmp/ruda-leather-studio-audit-build`（移动前基线检查）：失败，Vite 无法解析 `firebase/auth`。构建输出被指向 `/tmp`，未在原项目内生成/覆盖构建产物。
- 无该独立项目的 `test` 脚本或 `tests/` 目录。
- `git status` 显示原项目源码仍为未跟踪文件，现位于 `legacy/leather-studio-v1/`；它在搬移前通过 `npm --prefix miniprogram/ruda-ai-leather-studio ...` 执行了上述基线检查，搬移后未修改其源码、安装依赖或覆盖文件。
- 原项目目录已从误标为小程序的 `miniprogram/ruda-ai-leather-studio/` 原样移动至 `legacy/leather-studio-v1/`；移动前确认目标不存在，移动后核对 57 个文件及核心 CAD/服务端文件存在。

以上是当前检出/依赖状态的事实，不据此判断原项目在其原始 AI Studio 环境中的部署状态。

## 8. 首批共享 API 契约：项目与 CAD 版本

本阶段只建立三端共用的 Leather 项目存储和版本控制，不代表电脑工作站、AI 对话、媒体上传、异步任务或导出已接通。

### 8.1 身份与授权

- 使用现有 RUDA Merchant JWT、`requireMerchantTenant`、严格行业模板守卫及员工权限 `ai.tools.use`。
- 首批仅允许 `industryTemplate = bags_wholesale` 的商家调用；服务端从已验证会话取得 `merchantId`，不接受请求传入的 `merchantId`、`industryTemplate` 或 `studioCode`。行业 ID 沿用权威模板配置，不新增另一份模块枚举或导航标签。
- 店主账号按现有员工权限中间件规则访问；员工必须具备 `ai.tools.use`。撤销权限后请求立即被拒绝。
- 不新增账号、认证、行业映射或独立 Studio entitlement 表；当前单行业限制仍有效。

### 8.2 数据归属

- `MerchantLeatherStudioProject` 是 RUDA 中 Leather Studio 原生项目的权威记录，`MerchantLeatherStudioProjectVersion` 保存不可变的完整快照。
- 项目由 merchant tenant 拥有，服务端固定写入 `studioCode = leather_studio` 与 `industryTemplate = bags_wholesale`。
- `payload` 保存 Leather 原生 CAD/项目 JSON，不转换或裁剪未知字段；标题、状态、当前 revision 和租户归属由 RUDA 列管理。
- 每次成功创建产生 revision 1 快照；每次更新必须提供当前 `expectedRevision`，通过同一数据库事务原子更新项目并追加下一 revision 快照。过期 revision 返回 409 和服务端当前 revision，不执行 last-write-wins。
- 创建支持 `Idempotency-Key`（长度 1–160）；同租户、同 key、同请求内容重放返回原项目；同 key 不同内容返回 409。
- 使用 Prisma migration 仅新增项目/版本表和 Merchant 反向关系，不迁移或删除 legacy 数据，不存储图片 data URL。

### 8.3 首批接口

所有接口均位于 RUDA `/api/merchant/leather-studio`，要求商家认证、商家租户、`bags_wholesale` 行业身份和 `ai.tools.use` 权限。

| 方法与路径 | 请求/响应要点 |
|---|---|
| `GET /projects?limit=&cursor=` | 返回当前 tenant 项目列表；limit 默认 30、范围 1–100；cursor 为上一页项目 ID。 |
| `POST /projects` | 请求 `{ title, payload }`，必需 `Idempotency-Key`；服务端创建 revision 1，响应 `{ project }`；相同请求重放返回原项目与 `replayed: true`。 |
| `GET /projects/:id` | 仅返回当前 tenant 的项目及完整 `{ id, title, studioCode, industryTemplate, revision, status, payload, createdAt, updatedAt }`。 |
| `PUT /projects/:id` | 请求 `{ title, payload, expectedRevision }`；成功追加新 revision；缺失/非法 revision 返回 400，冲突返回 409，当前 revision 位于 RUDA 标准错误包络 `error.details.currentRevision`。 |
| `GET /projects/:id/versions` | 返回当前 tenant 项目的不可变 revision 元数据；不得跨 tenant 暴露项目是否存在。 |

项目不存在或属于其他 tenant 统一返回 404。无商家会话返回 401，行业/员工权限不满足返回 403，字段验证失败返回 400；错误沿用 RUDA API 错误结构。首批不提供删除、恢复、AI job、文件上传、知识记忆、模板管理或产品发布接口，待对应服务契约与授权实现后再开放。

### 8.4 本阶段验收

- Prisma schema 与 migration 一致，数据库只新增两张项目/版本表及所需索引/外键。
- 单测覆盖输入规范化/大小限制、幂等 hash 规范性、行业能力与员工权限声明、路由守卫/tenant 查询条件和 schema/migration 结构。
- 隔离 PostgreSQL + HTTP 集成测试覆盖未登录拒绝、错误行业拒绝、员工 `ai.tools.use` 权限、同一行业跨 tenant 的项目/版本 404、并发幂等创建只产生一个项目、同 key 不同内容冲突，以及并发 `expectedRevision` 写入只有一个成功并留下连续不可变快照。
- 项目 CRUD 本身为三端共享 API；端侧尚未接入并完成真实跨设备截图/操作前，电脑、手机、小程序仍标记为待验证。

本轮验证记录：

- `bash scripts/test-ai-growth-p0-isolated.sh leather-studio`：1/1 HTTP 集成测试通过；runner 在带所有权标识的临时 PostgreSQL 容器内成功应用全部 164 条 migration（包括本模块 migration），完成后移除容器。没有连接或改动生产/应用数据库。
- `node --import tsx --test tests/leather-studio-project.test.ts`：5/5 通过。
- `npm run lint`、`npx prisma validate`、`git diff --check`：通过。
- 本轮没有前端代码变更；Web/手机/小程序真实页面、截图和跨端操作尚未验收。
- 前序全量 `npm run test:unit` 曾有 1409 项通过、2 项既有 UI 文案目录失败（`merchant-mobile-navigation.test.ts`、`ui-translation-copy.test.ts`）；本轮未重跑全量 suite，也未改动相关文案文件。

## 9. 实施顺序与停止条件

1. **阶段 A：审计与契约（完成）**：锁定此功能清单、RUDA 入口、权限、API 与持久化边界；核对真实数据库/文件服务和源数据状态。
2. **阶段 B1：共享项目基座（进行中）**：项目/版本存储与商家 API 已实现，并通过隔离 PostgreSQL HTTP 并发/租户/权限测试；job、file、AI Gateway 适配仍未实现。
3. **阶段 B2：其他共享服务端基座**：补充持久化 job、媒体服务、AI Gateway、行业/Studio/员工 entitlement 及幂等任务机制。
4. **阶段 C：电脑 Web**：接入保留的 CAD/设计能力与共享 RUDA API；原项目继续独立可回滚。
5. **阶段 D：手机 Web / 小程序基础并行接入**：原有导航内加入口，使用同一 API 和项目；适配各自布局。
6. **阶段 E：跨端验证**：用同一测试商家/Project ID 完成 §6 的项目、任务、媒体、CAD revision 互操作测试。
7. **阶段 F：迁移历史知识/项目（若存在数据）**：仅在数据映射与回滚审批完成后按 §5 导入；无有效旧数据时也要留下可核验的零行审计。

若原 Firebase UID、企业/商家归属或项目数据无法可靠映射，停止迁移而非猜测；在此之前保留源系统和原有数据。

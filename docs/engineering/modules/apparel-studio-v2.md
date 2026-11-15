# 模块规格：RUDA Apparel Studio V2.0

- Module ID：`apparel-studio-v2`
- 模块状态：部分完成（现有 ModaUI 已有图像/试穿/换色基础；六项专业能力、统一项目和生产闭环未完成）
- 文档阶段：规格已整理；共享项目/版本 API 首片已实现，隔离数据库验证通过；真实运行态与端侧仍待验收
- 日期：2026-11-14
- 对应负责人/团队：RUDA 产品与工程团队
- 上位规格：[`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md)
- 平台级 AI 演进治理：[`global-ai-evolution-center.md`](./global-ai-evolution-center.md)

> 本文是现有系统增量升级规格，不代表目标能力已实现。当前审计以源码、Prisma schema、迁移、现有模块文档和测试清单作静态核查；没有连接生产数据库、调用生产 Provider 或完成真实商家端到端验收。`modaui-engines.md` 中的 Provider 环境实测证据日期为 2026-10-27，应在开始相关实现时重新核验。

## 1. 背景与问题

Apparel 是 RUDA 多行业平台中的专业工作室，不是独立账号、独立 AI 后端或独立商品系统。目标是在保留已有 RUDA 商家后台、ModaUI、试穿/换色、计费与媒体服务的基础上，逐项补足专业能力，并打通从服装设计到可审核商品草稿的真实流程。

六项固定专业能力：

1. 真人 AI 虚拟试衣。
2. AI 服装设计。
3. AI 模特棚拍。
4. 高清精调色。
5. AI 走秀视频。
6. AI 专业智能打版。

同时需支持同一服装项目中的自然语言任务编排、版本与文件管理、质量检测、受授权的长期记忆和学习。长期记忆、经验、知识治理、模型注册/评测/训练和平台管理属于 RUDA CORE 的全行业能力；Apparel 仅拥有独立命名空间、行业数据和专业评测策略。

## 2. 目标与非目标

### 目标

- 复用统一身份、商家租户、员工权限、ModaGPT 运行时/任务队列、Provider Gateway、文件服务、额度/用量和 RUDA Product Center。
- 在一套 Apparel Engine 下支持 Production 与 Wholesale 两种授权模式；专业打版仅由服务端 entitlement 开放，不复制两套 AI 技术系统。
- 建立一个能关联图片、设计、任务、质量报告、版型原生数据、样衣反馈和生产资料的 Apparel Project；三端读写同一服务端项目和版本。
- 电脑商家端优先交付完整专业工作站；手机 Web 和小程序同步建设基础入口、API、项目同步、照片/对话/任务查看及适配操作，不等待电脑功能全部完成。
- 能力缺失、Provider 不可用、数据不足或需人工确认时，真实、明确地反馈；不伪造任务成功、准确率或生产批准。
- 模型、知识、经验和训练数据经过授权、隔离、审查与独立评测后才能用于学习或部署。

### 非目标

- 不重做商家后台外壳、导航、现有 RUDA 设计规范、Apparel/Leather 能力或 ModaUI 入口。
- 不在 Studio 中新建用户/商家/支付/订单/库存/商品权威系统、第二套 AI Gateway、任务队列、记忆库或文件服务。
- 不以文生图/效果图冒充服装结构识别、纸样、放码、工艺资料或 Tech Pack。
- 不自动把 AI 生成的生产数据批准为可投产结果；不自动发布商品。
- 不默认把客户图片、提示词、设计、版型或反馈纳入共享知识或模型训练。
- 不以目标成功率（包括 90%）替代实测；不宣称 RUDA 自有模型或闭环训练已上线。

## 3. 现状审计与防重复检查

### 3.1 静态审计范围

- 页面/组件：`src/apps/merchant-admin-common/components/merchant/modaui/ModaUIWorkbench.tsx`、`modaWorkbenchCapabilities.ts`、`MerchantAiHome.tsx`、`MerchantProductTryOn.tsx`、`ModaGptGarmentRecolor.tsx`。
- 运行时/服务：`src/server/aiEmployeeProviders.ts`、`aiEmployeeCreative.ts`、`aiImageEngine.ts`、`modagptRuntime.ts`、`modagptTaskSupervisor.ts`、`modagptMerchantTaskExecutor.ts`、`modagptBrain.ts`、`modagptBrainService.ts`、`fashionStudioProjects.ts`。
- API：`server.ts` 中 `/api/merchant/modagpt/images`、`/api/merchant/modagpt/designs*`、`/api/merchant/modagpt/task*`、`/api/merchant/modagpt/brain/documents*`，及 `/api/admin/fashion/studio/projects*`。
- 数据：`MerchantModaGptDesign`、`ModaGptTask`、ModaGPT Brain 相关 Prisma 模型、`FashionStudioProject` 与相关迁移。
- 管理面：`AdminAiControlCenter.tsx`、`AdminAiProviderConsole.tsx`、`AdminModaGptOperator.tsx`。
- 现有权威文档：[`modaui-workbench.md`](./modaui-workbench.md)、[`modaui-engines.md`](./modaui-engines.md)、[`modaui-core.md`](./modaui-core.md)、[`modaui-ai-provider-console.md`](./modaui-ai-provider-console.md)、[`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md)。
- 搜索关键字/目录：`tryOn`、`imageGeneration`、`recolor`、`video`、`fashion-studio`、`FashionStudioProject`、`ModaGptTask`、`MerchantModaGptDesign`、`pattern`、`打版`、`纸样`、`放码`、`裁片`、`tech pack`；`src/`、`server.ts`、`prisma/schema.prisma`、`prisma/migrations/`、`tests/`。

### 3.2 已发现能力与差距

| 能力/资源 | 当前有证据的实现 | 当前差距与状态 |
|---|---|---|
| 工作台 | `ModaUIWorkbench` 是可复用创作工作台；本轮将能力目录对齐为六项任务书能力 | 六项目录只说明能力分类，不代表六项均可执行；专业打版与走秀视频仍未接入真实引擎 |
| 真人 AI 试衣 | `MerchantProductTryOn` / 工作台经 `POST /api/merchant/modagpt/images` 调用；服务端检查商家租户、试穿 entitlement、模特隐私同意、商家商品存储键和幂等请求；现有引擎清单记载 fal `fal-ai/fashn/tryon/v1.6` | 引擎清单在 2026-10-27 记录 fal 密钥/套餐不可用；未证明人物身份保持、服装细节、姿态/遮挡质量检测和统一项目版本闭环。执行状态需按新环境复测 |
| AI 服装设计 | `design` 通过既有服务端图片生成路径；输出可以保存为 `MerchantModaGptDesign` 素材 | 不是结构化款式设计或可靠的局部修改引擎。既有引擎审计记录 Provider/套餐不可用；当前无六能力统一任务计划与质量报告闭环 |
| AI 模特棚拍 | `studio` 复用图片生成能力 | 当前属于文字方向+文生图，非基于已确认服装图的图生图棚拍；未证明模特身份/服装一致性、姿势/光线参数化、套图版本等要求 |
| 高清精调色 | 工作台已有客户端像素换色能力；`modaui-engines.md` 记录可做确定性图像加工 | 不等于 AI 服装分割/区域理解；精细蒙版、纹理/高光保护、色差量化、色彩配置文件和非破坏性项目图层仍需能力审计/补齐 |
| AI 走秀视频 | 有视频时间线编辑与剪辑相关代码 | `video` 工作台能力明确为 `unavailable`；既有 `FashionStudioProject` 和 `/api/admin/fashion/studio/projects*` 属平台管理员内容视频时间线项目（`tenantId=platform`），不是商家 AI 视频生成项目。不能当作走秀生成已实现 |
| AI 专业智能打版 | 本轮确认 Apparel 工作台此前没有该能力入口；全仓检索未找到 Apparel 裁片几何、服装尺寸放码、工业纸样质量校验或生产文件导出的权威服务/API/模型。旧 Leather Studio 代码属于另一行业，不能充当 Apparel 打版引擎 | 第六项现以明确的“未接入”状态显示并可被自然语言识别；没有可执行 CAD、放码及生产导出闭环，仍属阻塞，不能以入口、旧 Leather 代码或图像生成替代 |
| 自然语言多能力编排 | 复用 `/api/merchant/modagpt/task/preview`、`/api/merchant/modagpt/task` 与任务执行服务 | 当前工作流注册范围主要为商品、客户报价、经营分析和采购；任务 API 当前拒绝非空附件，未证明能把一条 Apparel 命令拆成六项专业任务、询问缺失信息、保持约束并联动结果 |
| 任务与素材 | `ModaGptTask` 有队列/重试/租户等通用字段；`MerchantModaGptDesign` 存商家素材及请求幂等信息；试穿可保存结果 | 没有发现一个 Apparel Project 把六类资产、AI Job、版型版本、质量报告和人工批准串起来。任务行没有明确 Apparel `projectId`/行业/Studio/版型 revision 的统一关系 |
| 现有项目 | `FashionStudioProject` 存视频时间线 JSON，且当前接口为平台管理员权限、平台租户；工作区另有 Leather 项目实现 | 管理员项目不可复用。阶段 B 统一商家 Studio 项目/版本存储，以服务端 `studioCode` + 行业模板区分专业 payload，不为 Apparel 再造一套项目 CRUD |
| 小程序 | 小程序有 ModaUI assistant 入口/共享对话范围 | `/api/merchant/modagpt/images` 当前包含小程序禁用检查；不能据此称图片能力三端一致。小程序现有入口不等于试衣/项目/文件端到端接通 |
| Provider 与管理 | 复用 `aiEmployeeProviders`、`aiProviderCatalog`/`runpodGateway`、Provider Console、额度与调用记录；平台有 AI 管理/诊断界面 | 既有 Provider 能力不等于按 Apparel 任务质量、数据隐私、延迟、费用、GPU 与模型评测结果完整路由；没有证据表明已具备全行业统一的模型注册、训练/发布/回滚中心 |
| Brain/知识 | `ModaGptBrainService` 与经验、评测、反馈、知识文档/分块、事实、课程/证据、检索日志、学习运行记录等模型存在；有权限及 tenant/merchant 检索过滤 | 当前模型未见明确 `industryId`/`studioId` 字段；文档元数据/authorization JSON 不等于 enforced namespace。不能据此证明 Apparel 与其他行业或跨租户已完成检索隔离 |

### 3.3 复用结论与数据决策门槛

- 复用 `Merchant` / 统一商家认证与员工授权；任何 industry/studio entitlement 均由服务端从权威关系解析。
- 复用 `src/api/client.ts`、`ModaUIEntry`、现有工作台/对话组件、`ModaGptTask` 队列、Provider/Gateway、图片上传/媒体存储、额度/用量、Brain 基础设施、RUDA Product Center。
- 商家 AI Studio 项目采用一个共享的服务端项目与不可变版本存储；各 Studio 以服务端确定的 `studioCode`、`industryTemplate` 和各自校验过的 payload schema 隔离。Leather 旧路径保持兼容并指向同一权威存储。
- **不新增第二套工作台、AI 接口 wrapper、模型适配器、知识库、记忆库、任务队列或商品数据。**
- `MerchantModaGptDesign` 是素材记录，不应扩成没有版本/生产语义的万能项目表；管理员 `FashionStudioProject` 也不是商家项目。
- 尚未发现商家 Apparel 项目、工程版型和统一版本关系。实现前再次全局检索当前共享项目（含新建 Leather 项目/版本能力）；只有证明其抽象/约束不适配后，才决定增量扩展公共项目契约或新增 Apparel 专属表。不得把 Apparel 版型塞进 Leather 原生项目表，也不得直接照附件建议一次性建一组镜像表。
- Brain 现有 schema 和服务先复用；先补齐 schema/查询实际 namespace 的方案及迁移部署状态，再决定最小字段、索引或 ACL 扩展。

## 4. 归属与边界

- 所属业务域：RUDA 多行业 AI Studio → Apparel Studio。
- 运行面：商家后台电脑 Web、手机 Web、商家小程序；三端共用 RUDA 后端和服务端权威项目。不同端保持现有 RUDA 外壳、布局、导航、颜色、字体、间距和交互习惯。
- 电脑端：完整设计/专业编辑/参数化 CAD/质量复核/生产输出工作站。
- 手机 Web：拍照上传、对话、查看结构/纸样/结果、有限尺寸修改、确认/审批、版本和进度、文件预览/下载；复杂 CAD 精细编辑留在电脑端。
- 小程序：复用商家身份与同一项目/任务/文件 ID；提供行业入口、拍照、对话、状态/结果、简单修改、确认、历史与通知，不创建独立项目或记忆数据。
- 本模块负责 Apparel 行业工作流、能力适配、项目/工程数据契约、行业质量标准及电脑端专业操作。
- RUDA CORE / SUPER ADMIN 负责全行业模型/知识/记忆/授权训练/评测/发布治理，见 [`global-ai-evolution-center.md`](./global-ai-evolution-center.md)。
- 本模块不负责商家认证、通用文件、账单/订单、商城、平台模型治理或其他行业专业规则。

## 5. 用户角色与权限

| 角色 | 允许范围 | 强制约束 |
|---|---|---|
| 商家负责人 | 使用获授权 Apparel 模式、管理本企业项目/素材、批准设计或生产资料 | `merchantId`、tenant、行业/Studio entitlement 来自已验证会话/服务端，不信任请求体 |
| 商家员工/设计师/版师 | 按员工权限执行设计、编辑、测量、审核等动作 | 每个写 API 检查 action permission；生产批准与模型/知识管理分权 |
| 生产批准人 | 审核样衣反馈和生产版型/Tech Pack | 高风险生产结果明确二次确认并留下审计记录 |
| RUDA 平台 AI 管理员/行业 Steward | 通过平台 Evolution Center 管理模型、授权数据与 Apparel 知识策略 | 只允许授权 namespace；任何跨租户训练/共享要有明确授权和审计 |
| 普通顾客/未授权行业商家 | 不可访问 Apparel 工作区数据和生产能力 | 菜单隐藏不算授权；服务端拒绝未授权资源且不泄露资源存在性 |

## 6. 业务流程与状态

### 正常流程

1. 后端读取已验证商家、行业、Studio 模式与能力 entitlement；未授权时拒绝进入/执行。
2. 用户创建/恢复一个 Apparel Project，上传原始图和服装素材，服务端记录文件归属、用途、授权、来源及隐私期限。
3. 用户用自然语言或明确功能操作发起任务；规划器识别能力、项目、输入/输出、保持约束、缺失资料、授权和确认要求。
4. 缺少尺码/视角/材料等必要信息时进入 `waiting_for_input`，不得猜测隐藏结构或制造测量值。
5. 任务经统一 ModaGPT Job/Provider Gateway 异步执行，输出文件/结构化数据保存为新版本，不覆盖输入。
6. 对应能力执行独立质量检查；失败时保持失败/需人工复核，不返回成功形状的占位结果。
7. 设计批准后才可启动打版；样衣反馈形成新 revision；生产批准人确认后才可导出生产包。
8. 用户明确确认后，复用 Product Center API 创建商品草稿；发布仍由原有商品权限/审核流程完成。

### 状态（逻辑状态；执行前映射到现有 ModaGPT 任务状态）

| 当前状态 | 操作/事件 | 目标状态 | 服务端校验/失败处理 |
|---|---|---|---|
| draft | 提交任务 | queued | entitlement、输入 schema、Idempotency-Key、资源归属通过后建 Job |
| queued | worker 获得租约 | running | 记录 provider/model/version；租约过期可安全重试 |
| queued/running | 需要用户补充 | waiting_for_input | 保留任务与输入版本；前端明确问题 |
| queued/running | 高风险写入需批准 | waiting_for_approval | 不提交生产写入；等待具权限用户决策 |
| running | 任务与独立检查成功 | succeeded | 同一事务提交结果引用、project revision、质量证据 |
| running | Provider/校验/存储失败 | failed 或 retry | 保存明确错误类别；确定性工程数据不受模型失败影响 |
| 任一未终态 | 用户取消/超时 | cancelled 或 failed | 取消 Provider（如支持）并释放额度/临时资产 |
| succeeded | 新版本批准/修改 | 新 Project Revision | 原版本只读可恢复；并发 revision 冲突返回 409 |

### 异常流程

- 行业/Studio 未授权：401/403，服务端不依赖前端行业选择。
- 输入无效/附件角色错误：400，保持原素材；不按上传顺序猜角色。
- Provider 无模型/额度不足：明确 503/403/429 及恢复提示；不扣未执行任务的额度。
- Provider 超时/图片或视频写入失败：可查询原 Job、幂等重试、释放预留；禁止重复扣费和假结果。
- 项目 revision 过期：409 + 最新 revision/冲突标记；旧写入不覆盖新版本。
- 小程序当前图片 API 禁用：在该端接线完成前显示不支持/待启用状态；不得伪装成已提交。
- 训练数据未获授权或撤回：禁止进入跨租户/公共训练集，记录拒绝/删除审计。

## 7. UI/UX 规范

- 延续现有 RUDA 商家后台品牌与各端既有布局，不改全站视觉，不把电脑多栏缩小成手机布局。
- 电脑端复用现有 `创作空间` / `ModaUIEntry`，以专业工作区承载项目、功能工具、工程参数、CAD、质量结果和版本历史；不新建第二个 ModaUI 首页。
- 手机 Web、小程序保留各自既有导航、组件、触控与页面层级；共享数据和状态语义，不共享强制相同的 UI 排版。
- 每个能力的 unavailable、加载、排队、缺资料、需批准、失败、成功、无历史、额度不足、离线/冲突都有真实状态。
- “AI 质量检测”展示实际检查项、结果、规则/模型版本和人工复核状态；不能只显示绿勾。
- 服装效果图、试衣/棚拍/视频标注为视觉资产；未确认不得流入生产资料区。
- 实施任何 UI 前按工程要求读取 Impeccable、RUDA `design-values.md` 和对应端设计文档，运行真实三端测试及 `impeccable detect`；本次文档工作未改 UI。

## 8. API 契约

### 现有接口（复用，不视作新 Apparel Project API）

| 用途 | 已存在路径 | 当前事实/限制 |
|---|---|---|
| AI 任务预览/执行/状态 | `POST /api/merchant/modagpt/task/preview`、`POST /api/merchant/modagpt/task`、`GET /api/merchant/modagpt/task/:id` | 复用租户、员工权限、任务队列与幂等；当前支持的工作流不是 Apparel 六能力流水线，附件契约仍需扩展审计 |
| 试穿/图片生成 | `POST /api/merchant/modagpt/images` | 当前 `tryOn`/`imageGeneration` 入口；继续沿用 entitlement、Provider、额度、上传校验与请求幂等。小程序目前被明确拦截 |
| 素材读写 | `/api/merchant/modagpt/designs*`、`GET /api/merchant/modagpt/entitlements` | 复用素材所有权、额度和能力状态；不等于项目/版型版本 API |
| Brain 知识文档 | `/api/merchant/modagpt/brain/documents*` | 现有商家 Brain 文档能力；必须在检索前加入经证实的行业/Studio namespace 过滤，不能把客户端传入 namespace 当权限 |
| 平台 Provider 管理 | `/api/admin/ai-providers/runpod*`、AI Provider/AI Control Center 管理接口 | 复用平台管理员权限和审计；新增模型治理操作归 Global AI Evolution Center |
| 管理员视频项目 | `/api/admin/fashion/studio/projects*` | 平台租户、管理员权限的时间线项目，不作为商家 Apparel 项目接口 |
| 商家 Studio 项目与版本 | `GET/POST /api/merchant/studio-projects`、`GET/PUT /api/merchant/studio-projects/:id`、`GET /api/merchant/studio-projects/:id/versions` | 同一商家项目存储；行业/Studio 从商家会话与服务端能力映射确定，不接受客户端指定租户或 Studio；Leather 旧路径继续兼容 |

### 目标逻辑 API 能力（具体路径在实现前再次查重并落到 OpenAPI/契约测试）

1. Project CRUD/恢复/归档、项目历史与当前 revision。
2. Project 下文件上传、用途/角色/授权元信息、下载授权。
3. 创建自然语言任务/明确能力任务、获取状态/进度/错误/输出/取消与安全重试。
4. 读取设计版本、确认设计、创建版型任务、编辑类型化版型数据并以 `expectedRevision` 保存。
5. 获取独立质量报告、样衣反馈、人工批准、生产包导出。
6. 在用户显式确认后创建 Product 草稿；Apparel 作品到草稿的具体输入、媒体上传、权限、幂等、失败恢复和发布边界见本节“Apparel 作品进入商品草稿”。

**统一契约约束：** 商家会话取 `userId/tenantId/merchantId`；`industryId/studioId` 由服务端权威映射/entitlement 确认。项目、文件、Job、pattern version 均使用服务端 ID。所有写请求要求可重放的 Idempotency-Key；版本写入要求 `expectedRevision`；未知字段拒绝或按已声明兼容策略处理；返回明确错误 envelope。候选新路径仅在全仓确认没有同义能力后登记，不为各端创建不同 API。

**Apparel 作品关联契约（阶段 B 的增量实现范围）：** 复用 `MerchantStudioProject.payload` 与版本 API，以 `linkedDesigns: [{ designId, title, category }]` 保存作品库 `MerchantModaGptDesign` 的引用，不复制图片二进制或另建素材表。Web/手机 Web/小程序都通过现有商家作品库 API 读取素材，项目写入时服务端必须验证全部 design ID 属于当前商家，并以数据库标题/类别规范化引用；重复 ID 去重，引用最多 50 项。关联/解除关联与简报共用 `expectedRevision`，每次变更追加 Project Version。无效引用返回 `400 STUDIO_PROJECT_DESIGNS_INVALID`，不存在或跨商家引用返回统一的 `404 STUDIO_PROJECT_DESIGN_NOT_FOUND`，不得透露其他商家的作品信息。外部文件、AI Job 和 CAD 仍是独立未完成项，不得因作品关联完成而宣称整个项目文件闭环已完成。

**Apparel 作品进入商品草稿（本轮增量闭环）：** 用户先将当前结果保存为自己的 `MerchantModaGptDesign`，再显式选择“创建商品草稿”并填写款号、名称、服装品类、颜色、尺码和 SKU。确认后，客户端从当前已保存结果生成 WebP，经既有 `POST /api/merchant/media/presign` 上传到当前商家的商品媒体存储，再以同一媒体元信息和 `MerchantProductCreateForm` 所用字段调用既有 `POST /api/merchant/products`，固定传入 `lifecycleStatus: draft`、`creationRequestKey` 和 `Idempotency-Key`；生产批发商/服装批发商的权限、行业字段和持久化继续由服务端现有校验决定。缺少媒体存储配置、上传失败、商品校验/权限失败均须显示错误，不得报告创建成功；商品请求结果不确定时保留同一幂等键与已上传媒体供安全重试。创建成功后通过商家商品权威刷新机制让 Product Center 读取新草稿。AI 作品只作为商家选择的商品图片，不自动推断工艺、库存或价格，不发布商品；后续检查和发布必须由商家在现有 Product Center 商品流程中完成。Web 与手机 Web 共享该流程；小程序暂不提供生成结果到商品草稿的操作，标记待接入/验收。该切片不新增 API、表或商品字段，也不声称六项专业能力、项目文件/任务关联或生产审批已全部闭环。

## 9. 数据与持久化

| 数据 | 当前权威候选/证据 | 目标要求 |
|---|---|---|
| 商家/租户/员工 | 既有 Merchant、统一认证与员工权限模型 | 继续复用；项目 tenant 从会话和关系解析 |
| 已生成图片 | `MerchantModaGptDesign` + 现有文件/媒体存储 | 用于素材记录；关联 Project/任务/版本须由正式契约管理 |
| AI Job | `ModaGptTask` | 复用队列与任务状态；补齐/关联 `projectId`、行业/Studio/能力和输出引用前，先评估通用任务模型/迁移兼容 |
| 视频时间线 | `FashionStudioProject`（平台管理员内容视频） | 只保留原业务；不可被商家 Apparel Project 复用 |
| Apparel Project / CAD / 版本 | 管理员 `FashionStudioProject` 不适用；工作区另有 Leather 项目代码 | 阶段 B 统一 merchant Studio project/version 存储；专业 payload 由 Studio 对应校验器维护，Studio 间不共享未经验证的 CAD 数据。Apparel 原生版型 schema、确定性校验和生产导出仍为后续独立门槛 |
| 质量/反馈/经验 | 可复用 `ModaGptBrainExperience`、`ModaGptBrainEvaluation`、`ModaGptBrainFeedback`、`ModaGptBrainLesson*` | 增加 Apparel/task/project/version 的稳定来源引用与独立评测契约；只存可保存的输入/输出证据，不记录第三方隐藏推理 |
| 行业知识 | `ModaGptBrainDocument/Chunk` 与服务 | 现状有 tenant/merchant 与 JSON authorization/metadata；必须先落实强制行业/Studio scope 查询过滤，不以 JSON 字段存在替代隔离测试 |

任何 migration 前须核查生产 schema、migration history、旧数据规模与回滚；本规格不授权/不执行 schema 变更。不得一次性按附件逻辑表名机械新增 `apparel_projects` 等一组镜像表。

## 10. 集成、行业隔离与模型治理

- 六项能力都通过 RUDA CORE 服务端 Gateway；没有前端第三方密钥或直接 Provider 调用。
- 视觉生成与工程几何分离：外部/自有模型负责理解/候选生成；CAD 纸样、尺寸、放码、缝份与校验由确定性 Apparel 工程引擎输出并版本化。
- Provider 可按能力、质量门槛、隐私授权、延迟、费用和资源状态路由；失败回退不得静默更改工程数据。
- Apparel 专业记忆/知识/训练集/成功失败案例/黄金测试集/评测规则/专业模型与版本必须属于 Apparel namespace；企业私有数据再按 tenant 隔离。仅明确允许的通用材料可进入 Shared Knowledge。
- 所有外部模型输入受供应商合同、数据保存与训练限制；未经商家明确授权，不将图片、设计、客户资料或生产文件用于跨租户训练。
- 训练/学习结果进入审核与离线评测；没有胜出比较、回归测试、审批和可回滚制品时不得自动替换生产模型。
- 平台侧模型/训练/知识控制台不向普通商家展示；配置入口和审计详见 [`global-ai-evolution-center.md`](./global-ai-evolution-center.md)。

## 11. 分阶段实施

| 阶段 | 交付边界 | 门槛 |
|---|---|---|
| A. 审计闭环 | 重新核验当前 Provider/套餐、迁移部署、真实商家 API；复核各三端入口与文件权限；补齐路径/数据调用清单 | 不改生产业务；形成可复现证据、六能力差距和共享项目决策 |
| B. 共享项目/任务契约 | 一个 merchant Studio project/version 存储与统一 API；三个端接入同一项目列表/打开/保存设计简报；文件、Job、revision、namespace、错误/通知契约 | 幂等、冲突、租户/Studio 隔离、权限、持久化及三端同 ID/revision 行为通过 |
| C. PC 专业能力试点 | 复用现有试穿/设计/换色；以真实闭环优先逐项升级试穿、设计/局部修改、棚拍与色彩；保留非可用显示 | 每项独立 Provider/成本/失败/质量证据和 1440/1024 真实浏览器验收 |
| D. 工业打版 | 首发 T 恤、衬衫、基础连衣裙；结构识别、版型 schema、参数几何、放码、校验、样衣反馈、打印/CAD 导出 | 真实几何与独立尺寸/拼接测试；PDF 实际比例打印、DXF 目标 CAD 兼容；版师确认 |
| E. 视频与流水线 | 接入合规视频 Provider/自有模型；贯通设计确认→任务编排→质量门禁→生产资料/商品草稿 | 视频身份/服装时序测试；失败可恢复；未确认不发布 |
| F. 自主学习接入 | 使用平台 Global AI Evolution Center 现有/增量治理能力；构建 Apparel 授权样本、黄金集、评测和候选模型 | 授权/撤回、行业/租户隔离、独立测试、人工审批、灰度与回滚全部通过 |

每阶段完成后更新本文实施记录和 [`merchant-three-end-matrix.md`](./merchant-three-end-matrix.md) / [`merchant-cross-device-sync.md`](./merchant-cross-device-sync.md)；手机与小程序的基础项目/API 同步不推迟到 PC 全部完成后。

## 12. 测试计划与验收标准

### 必须覆盖的测试

- 单元/契约：六能力路由、输入角色、尺寸 schema、Provider 状态、错误转换、幂等、版本校验、允许/拒绝的状态转换。
- 隔离 PostgreSQL HTTP：商家/员工权限、商家 A/B 资源隔离、行业/Studio 交叉拒绝、数据真实持久化、失败事务回滚、迁移升级与恢复。
- Provider：无密钥/超时/限流/格式错误/不可用时不伪造结果、不重复扣费、原始 CAD 不变。
- 质量：六功能分别建独立标准集；统计首次成功、自动修复后成功、人工修改、严重错误、确认率、虚假成功率、延迟和成本。90% 是目标，不是验收预设值。
- 纸样：几何闭合/自交/单位/尺寸/拼接/缝份/刀口/放码；真实 PDF 比例及 DXF 目标软件兼容；样衣测量和版师签核。
- 三端：电脑端完整 CAD；手机 Web 同一 Project ID/版本/结果；小程序拍照/对话/任务/确认后电脑端可见；冲突旧 revision 得 409，不覆盖新版本；断网恢复及重复提交不重复生成/插入裁片。
- 真实端验收：桌面/手机 Web 截图和操作、控制台/网络错误；小程序开发者工具或真机证据。单纯构建/API 单测不能代表三端完成。
- 回归：ModaUI/Commerce、Apparel 现有试穿与素材功能、Leather CAD、商家其他行业与商品中心。

### 用户确认版：六项专业能力验收矩阵

以下是 Apparel Studio 的固定产品范围；六项能力不得删减、以其他入口替代，或只做到静态页面/聊天回复。每项必须有真实输入、真实执行路径、可持久化结果、独立质量检查及失败/重试记录。具体 Provider 或本地引擎尚未接通时，状态必须如实标为未完成/被阻塞。

| 能力 | 输入与真实执行验收 | 结果与质量验收 |
|---|---|---|
| 真人 AI 虚拟试衣 | 明确区分 `person_image` 与 `garment_image`，附件角色随文件保存，不按上传顺序猜测；支持半身/全身模特、服装正背面/细节/多角度。真实调用获准试衣引擎，并执行人体姿态/服装区域识别、遮挡关系与人物保护。 | 输出保存到项目新版本；检查人物身份特征、服装轮廓/纹理/纽扣/印花、肩线袖口衣领、边缘融合、肢体结构和输出完整性。用真实 T 恤、衬衫、连衣裙、外套、长短袖、不同姿势与纹理样本验收；保存输入/输出引用、模型版本及独立检查结果。Sharp 只可用于图像处理，不可作为换衣模型。 |
| AI 服装设计 | 支持从零设计、参考图设计和连续自然语言修改，至少覆盖款式、领型、袖型、衣长、腰线/廓形、口袋、纽扣/拉链、面料外观和颜色；支持多方案。设计知识须能处理西装结构、羊绒/羊毛/真丝/牛仔/针织等术语及其视觉约束。 | 原图不可变；局部编辑需保护非目标区域；保存设计参数、前后版本、历史、对比和回退；需有最终设计确认状态。视觉图像必须与结构化服装数据分开，AI 效果图不自动成为纸样或生产批准。 |
| AI 模特棚拍 | 支持系统模特与有授权的商家模特素材、姿势、外观、全身/半身/特写；提供影棚/白灰背景/商业背景/户外/秀场等场景，以及机位、视角、构图、光线、比例控制。真实执行基于已确认服装/模特的影棚生成，而非只做无商品约束的文字生图。 | 同一套图中模特身份稳定；检查服装轮廓、颜色、纹理、纽扣、印花、刺绣和配件一致性。支持单张、多姿势/多背景、套图、高清输出、版本比较与素材保存。不得宣传为真实特定相机拍摄。 |
| 高清精调色 | 支持衣物及不同面料/装饰区域识别或明确的人工掩膜，能用自然语言设定目标色、只改局部、保留纹理和光影，并批量生成多个颜色版本。使用非破坏性编辑、可撤销的图层/蒙版与原图保护。 | 检查颜色差异、经纬纹理、褶皱曲率、高光/阴影、印花/刺绣/纽扣/拉链保护；保留色彩空间/配置文件信息（适用时）。没有材料光谱或实物测量时，只报告图像颜色参考，不承诺实体染色一致。 |
| AI 走秀视频 | 输入可来自已确认设计、试衣/棚拍结果、项目素材或授权参考视频/动作；自然语言可描述步伐、转身、停顿、裙摆及镜头运动。视频必须经异步 AI Job 执行并展示真实排队、进度、错误、重试/取消状态；音频须有合法使用依据。 | 保存视频及模型/任务/项目版本；检查人物身份、服装款式/纽扣/花纹时序一致性、动作连续性、人体结构、编码和音画同步。失败不能返回占位视频或伪成功。 |
| AI 专业智能打版 | 允许单图做可见结构识别，但不得臆造隐藏结构、背面或尺寸；多视角、已确认设计和人体/成衣尺寸可补充输入。输出有来源与置信度的结构档案；以确定性参数化几何生成有边界/关系的裁片，支持缝份、刀口、对位、经纱方向、尺寸表、松量、面料属性、纸样编辑与规则放码。首期完成 T 恤、衬衫、基础连衣裙。 | 真实检查单位、几何闭合/自交、尺寸、裁片拼接、缝份、刀口、袖山/袖窿、放码及裁片完整性；记录样衣实测、版师意见和新旧版差异，生产批准由专业人员完成。导出 PDF、DXF、SVG、裁片清单、尺寸表、面辅料/工艺资料和 Tech Pack；PDF 做实际比例打印校准，DXF 在指定工业 CAD 中打开验证。AI 图片不得代替原生纸样几何。 |

### 用户确认版：八项贯穿式智能能力验收

八项能力不是新增后台一级菜单，也不是 Apparel 自建平台底座；它们作为上述六项专业功能的贯穿能力，复用 RUDA CORE 的身份、Project/File/AI Job、Model Gateway、成本、记忆、知识与治理服务。行业知识和业务规则限定在 Apparel namespace，企业数据继续按 tenant 隔离。

| 贯穿能力 | 必须通过的验收 |
|---|---|
| 自然语言统一指挥 | 连续多轮理解功能、当前 Project、附件角色、修改目标/保持约束、缺失资料、引擎、确认要求和质量验证；可组合图片与文本；缺少必要信息时进入 `waiting_for_input` 并提问，不以聊天文本冒充执行。 |
| 全自动工作流水线 | 能把设计、试衣、棚拍、换色、视频、打版、检查及生产资料拆成有依赖关系的真实 Job；保留每一步输入/输出版本、失败、重试及人工节点。设计/生产确认前不得自动进入不可逆的生产写入或发布。 |
| 长期记忆 | 复用 RUDA CORE 五层记忆（工作、项目经历、专业知识、操作流程、模型参数）；只检索获授权且来源可追溯的 Apparel/企业数据，支持更正、过期、撤回、删除和访问审计。 |
| 自我学习 | 从获准的成功/失败案例、用户反馈及版师修正形成候选经验；经质量/授权审核、数据集版本化、独立评测后才能用于知识或训练，不得由未经审核输入直接修改生产模型。 |
| RUDA 自有模型 | 支持外部与 RUDA 自有模型混合运行，并支持每项能力单独切换到 RUDA 自有服务器模式；达到该能力独立质量门槛后才可优先接管。自主模式下无本地合格模型时必须明确不可用，严禁静默回退外部 API。 |
| AI 自动质量检查 | 六项能力分别执行专业检查，显示实际检查项、规则/模型版本、结果、失败原因和人工复核状态；质量失败可安全重试/转人工，不能显示无证据绿勾。 |
| 项目与版本管理 | 一个 Apparel Project 关联原图、设计、人物/服装素材、任务、试衣/棚拍/换色结果、视频、结构档案、纸样、尺寸、质量报告、反馈和生产资料；重要更改追加 revision，不覆盖原件；三端共享同一服务端 ID/版本。 |
| 真实生产连接 | 设计确认后可生成生产纸样和 Tech Pack；经生产批准及商家显式确认后，复用现有 RUDA Product Center 创建未发布商品草稿。商品正式发布仍走既有审核/权限，不得从视觉素材直接自动上架。 |

### 用户确认版：单句驱动完整工作流验收

使用真实企业账号和真实授权素材，至少执行一次如下等价场景：上传衬衫正/背面图及有授权的模特图，要求保留领口和面料、把长袖改短袖、生成三个颜色、试穿、制作商业棚拍和走秀视频，并为 M/L/XL 生成纸样、完成质量检查及生产资料。

验收必须证明：规划器拆出真实依赖 Job；附件类型明确；缺少尺寸/材料等信息时先追问；设计修改和颜色/视觉结果均生成独立版本；只有用户确认设计后才启动打版；质量失败可诊断和恢复；样衣/版师审核被记录；生产包经有权人员批准；Product Center 只创建待审核草稿。全流程每个结果可从同一 Project ID 追溯到 API、数据库、模型/引擎版本、费用、Job、质量结果及操作者。任何步骤未接通都应明确阻断并留下原因，不得以静态演示替代。

### 指标、证据与完成状态

- 90% 以上是逐项专业能力的目标，不是预设通过线或已达成声明。使用预先冻结的独立标准集，报告分母、数据集/评测器/模型版本、时间窗、首次成功率、自动修复后成功率、人工修正率、严重错误率、用户确认率、虚假成功率、成本和时延；不得跨六项合并掩盖弱项。
- 每项能力和全流程均需有真实操作记录、输入/输出文件引用、API/Job/数据库证据、模型与成本记录、独立质量报告、失败恢复、多版本及租户/权限隔离结果；打版另需 PDF 实际打印、DXF 目标 CAD 兼容和版师/样衣记录。
- Web、手机 Web、小程序分别提交实际页面/交互证据及 console/网络检查；没有开发者工具或真机证据的小程序状态保持“待验证”。构建通过、接口存在或隔离测试通过均不能单独代表端到端完成。
- 能力状态使用仓库工程定义的“已完成、部分完成、待验证、被阻塞”；只有真实功能和对应验收全部通过才可标“已完成”。自有模型训练、模型替换和外部 API 关闭还须通过 [`global-ai-evolution-center.md`](./global-ai-evolution-center.md) 的平台级门槛。

### 完成门槛

- [ ] 六项能力均有真实执行引擎、任务与错误状态、持久化输出和独立质量证据；未接入项明确 blocked。
- [ ] 自然语言可规划跨能力工作流；缺输入时追问，未经确认不执行高风险写入。
- [ ] 同一商家、同一行业、同一项目在 Web/手机 Web/小程序读到同一份服务端版本。
- [ ] Apparel 行业/tenant/权限过滤可被跨界拒绝测试证明。
- [ ] CAD/尺码/缝份/放码是类型化、确定性、可复核的原生数据；图像结果不冒充工程结果。
- [ ] RUDA Product Center 草稿、人工审核及正式发布沿现有接口；未经确认不得直接发布。
- [ ] 外部与 RUDA 自有模型按能力逐项切换，只有通过评测/审批的版本可服务生产。
- [ ] 所有阶段测试有实际命令与结果；没有实际浏览器/小程序验证的端标记“待验证”。

## 13. 部署、兼容和回滚

- 目标沿用既有 `merchant-admin-web`、`merchant-admin-mobile`、商家小程序和当前 Express/PostgreSQL 部署；不新增独立运行面。
- Provider 凭证继续使用项目认可的服务端安全配置；不提交密钥。
- 新 migration 必须先隔离数据库验证，生产部署前评估兼容窗口、回填和回滚；对大文件不做破坏性迁移。
- 发布顺序：兼容服务端契约/数据 schema → 后端能力/worker → 电脑端入口 → 手机 Web/小程序基础入口与同步 → 分能力灰度。
- 回滚：关闭对应能力 entitlement/feature flag，恢复前一版本服务与模型路由；保留既有 Project/Job/文件并兼容旧 schema。CAD 版本以追加版本回退，不覆盖原生产记录。
- 不执行部署或数据库迁移，除非该阶段明确进入实施并按项目发布规则执行。

## 14. 风险与未确认事项

- Apparel 生成/试穿当前可用 Provider/套餐状态可能与 2026-10-27 审计不同，进入实施前须重验。
- Apparel 项目、文件、任务和 CAD 版本现有数据是否有未被静态搜索覆盖的部署外服务/历史存储，须结合实际运行数据再确认。
- 工业打版的首期尺码体系、单位、制造商工艺规则、DXF 版本与 CAD 兼容设备需按真实生产样本确认。
- 商家图片/设计数据是否允许供应商留存、RUDA 训练或跨租户经验提取需有明确授权。
- 自有模型能力、GPU 和 90% 目标均为规划/目标，不是当前事实。

## 15. 实施记录

| 日期 | 阶段 | 状态 | 记录 |
|---|---|---|---|
| 2026-11-14 | 文档先行/静态审计 | 已完成 | 建立 Apparel 专项规格，确认五项工作台入口与六项产品能力差异；复用 Provider/任务/素材/Brain 基础；记录 Pattern Engine、商家统一 Project 和平台级行业隔离缺口。未改功能代码、API、schema 或迁移；未连接生产数据库/Provider，真实端侧和当前运行状态待验证。 |
| 2026-11-14 | 阶段 A/B：共享项目存储首片 | 首片已完成 | 复核行业模板为 `apparel_production_wholesale` / `apparel_wholesale`，确认管理员 FashionStudioProject 不适用。采用统一 merchant Studio project/version 核心承载 Leather 与 Apparel 项目；已实现持久化、幂等创建、商家/行业隔离、revision 冲突和旧 Leather API 兼容。文件附件、AI Job 关联、三端入口与真实运行环境验收仍未完成。 |
| 2026-11-14 | 阶段 B：项目与作品引用跨端切片 | 代码完成、运行态待验证 | 电脑/手机 Web 共用 ModaUI 项目面板，小程序复用同一项目与作品 API；`linkedDesigns` 只保存当前商家作品库引用，服务端校验归属并规范化标题/类别，关联/解除关联通过 revision 创建新版本。隔离 PostgreSQL 集成测试覆盖规范化、去重、跨商家拒绝和版本记录。当前 `.env` 数据库仍缺项目迁移，真实项目保存被阻塞；小程序实机和真实跨端操作待验收。 |

## 16. 本轮实现与验证记录

- 检查范围：共享 merchant Studio project/version 表、统一 API 与 Leather 旧路由兼容；Apparel 两个现有行业模板映射同一 `apparel_studio`；商家租户、`ai.tools.use`、幂等创建、revision 并发冲突。
- 已实现：共享 `MerchantStudioProject` / `MerchantStudioProjectVersion`，并以 additive migration 从旧 Leather 项目表回填；没有删除旧表。统一 API 不接受客户端传入租户/Studio，服务端仅按商家当前模板映射 Apparel 或 Leather。
- 实际验证：Prisma schema 校验通过；`node --import tsx --test tests/leather-studio-project.test.ts` 通过；`npm run test:merchant-studio-projects:integration` 在临时 PostgreSQL 中通过，应用全部 migration 并验证 Leather 兼容路由、Apparel wholesale/production 映射、跨租户拒绝、员工权限、幂等重放和 409 revision 冲突；`npx tsc --noEmit -p tsconfig.json` 通过；`git diff --check` 通过。
- 未验证：生产 migration 状态/数据库、Provider/套餐、Apparel 版型 payload 专业 schema、照片/文件/AI Job 关联、三端 UI 接入与真实桌面/手机/小程序跨端操作。未执行部署或生产写入；没有 UI 变更或截图。
- 下一步：接入电脑/手机 Web 和小程序现有入口，共享项目 ID 与服务端版本；再连接照片/文件/AI Job，并实现 Apparel 专业能力。
- 2026-11-14 运行态复核：当前 `.env` 指向本机 PostgreSQL `xversal`，`npx prisma migrate status` 报告 13 个待应用 migration，其中包含 `20261114210000_merchant_studio_projects` 与后续 `20261114240000_studio_project_template_scope`。未执行迁移；因有其他行业迁移待应用且该数据库用途未确认，禁止直接 `migrate deploy`。商家端遇到精确匹配的项目表缺失错误时，API 现在返回 `STUDIO_PROJECT_MIGRATION_REQUIRED` 和明确提示，不再显示通用 500；项目真实持久化仍被数据库迁移阻塞。
- 2026-11-14 作品引用切片实现：新增 Apparel Project `linkedDesigns` 服务端归属验证及数据库规范化；Web/手机 Web 共用项目面板和小程序项目页均可从现有作品库选择、解除关联并在保存时写入 revision。未创建第二套作品存储，未复制图像文件。`npm run lint`、Studio 项目单测、隔离 PostgreSQL 项目集成测试、商家 Web/手机 Web 构建及小程序 JS 语法检查通过。浏览器实测本地已登录 Apparel Studio 项目面板 390/820/1440 视口无横向溢出；项目列表因本机迁移未部署显示明确阻塞，未写入本机数据库。小程序真机操作、真实数据跨端持久化、项目文件/AI Job/CAD/Product Center 流程仍待验证。

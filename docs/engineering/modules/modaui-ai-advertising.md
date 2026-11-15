# MODAUI AI Advertising —— 商家 AI 广告生产平台（模块规格）

状态：**规格先行，未实现**（2026-10-30 建立；本文件是实施依据，不是完成声明）
模块 ID：`modaui-ai-advertising`
所属应用：MODAUI AI Tools（`appId = modaui-ai-tools`）
相关模块：`modaui-core`、`modaui-engines`、`modaui-workbench`、`modagpt-billing`、`merchant-three-end-matrix`、`merchant-cross-device-sync`

## 0. 状态口径（先读这一条）

本文件区分三种事实，不得混用：

| 口径 | 含义 | 当前内容 |
|---|---|---|
| 已实现 | 有代码、有测试、可复现 | 确定性图片引擎（`src/server/aiImageEngine.ts`）与三个图片类工具（质检/白底主图/多画幅）；文本工具（文案/翻译） |
| 规格已定、未实现 | 本文定义契约，代码尚未写 | 商品入口、创意规划器、四条广告路线、编辑器、素材包、发布中心、效果分析 |
| 被阻塞 | 依赖外部凭据/授权，无法在本机验证 | 生成式图片/视频、数字人、口播与口型同步、社交平台发布、广告投放数据 |

任何页面、按钮、进度条都不得把后两类显示为可用。

## 1. 问题与目标

商家要买的是「我把商品给你，你帮我把广告做好」，不是「买一个视频生成器」。当前 AI Tools 只有文案、翻译与图片加工，商家仍需自己懂分镜、运镜和提示词——这正是本模块要消除的复杂度。

目标：

1. 商家只需选择商品 → 选择广告目标 → 选择风格 → 确认方案 → 生成 → 修改 → 导出/发布。
2. 提示词、分镜、脚本、配音文案、字幕、CTA、标题全部由 MODAUI 后台生成，商家默认看不到提示词。
3. 每一次昂贵生成之前，先给出分镜与预估费用，商家确认后才产生供应商费用。
4. 商品真实信息（价格、颜色、材质、SKU、卖点）只能来自商品库或商家确认，AI 不得编造。
5. 产出不是单个 MP4，而是可复用素材包 + 可编辑工程 + 真实费用记录。

非目标（第一版明确不做）：

- 不做「任意商品任意替换都能完美贴合」的 Product Swap 承诺；只在同品类/同款式变体上提供，并在 UI 明示限制。
- 不做付费广告投放（Meta Ads / TikTok Ads）账户管理；第一阶段只做社交内容发布。
- 不新建第二套用户、商家、权限、通知、文件、计费、任务队列体系。
- 不在第一版做「AI 预测哪条广告会爆」；只做真实发布数据回看。

## 2. 复用与查重（开工前必须核对的结论）

| 检索范围 | 结论 |
|---|---|
| 商品资料 | 复用 `Prisma` 既有 `Product`/`ProductSku`/`ProductImage` 与商家端现有商品 API；不新建「广告商品表」 |
| 文本生成 | 复用 `src/server/aiEmployeeProviders.ts` 的 `generateAiEmployeeText`；不新建第二套模型调用 |
| 图片加工 | 复用 `src/server/aiImageEngine.ts`（分割/抠图/主图/质检/主色/变体/去重/画幅） |
| 视频加工 | 复用 `src/server/aiMediaToolkit.ts`（FFmpeg：裁剪/拼接/转码/抽音轨/截帧/烧字幕），`withSandbox` 为唯一二进制执行入口 |
| 工具执行与门禁 | 复用 `createModaGptToolRuntime` + `src/server/aiToolManifest.ts` + `modauiAiTools.ts`；不另立执行器 |
| 额度与费用 | 复用 `src/server/aiToolQuota.ts`、`ModaGptAiUsageRecord`、`src/server/aiProviderPricing.ts` |
| 任务与失败重试 | 复用 `modagptTaskQueue.ts` / `modagptTaskWorker.ts` 的后台任务模型；不新建队列 |
| 文件与素材 | 复用商家店铺 `merchants/<merchantId>/storefront/...` 存储边界与既有上传服务 |
| 通知 | 复用统一通知能力，不直连邮件/推送 |
| 数字人/口播/发布供应商 | **仓库内无任何实现**（无 SDK、无密钥、无适配器）→ 属新增集成，需单独立 ADR 与凭据方案 |

防重复结论：广告平台只新增**编排层与契约**（商品简报、创意方案、分镜工程、素材包、发布回执），底层一律复用上面 9 项。任何「再写一套图片/视频/上传/任务」的实现都不予合入。

## 3. 商家使用流程（UI 事实定义）

导航（一级 = 四字，沿用后台既有导航规范）：

```
MODAUI AI Tools
├─ 广告工作台      ← 默认入口：横幅 + 三个广告骨架 + 最近 5 条任务（17/20 屏）
├─ AI 广告制作      ← 商品广告 / UGC / 数字人 / 我的分身 / 快速模板
├─ 视频与图片编辑    ← 分镜 + 时间轴 + 字幕/配音/封面
├─ 多语言与素材版本   ← 语音版本 / 商品变体 / 品牌模板 / 批量
├─ 发布中心        ← 账号授权、排期、审批、发布回执
├─ 广告效果        ← 创意测试对比（仅真实平台数据）
└─ 高级设置        ← 品牌记忆、肖像/声音授权、费用与上限
```

五步主流程（每一步都必须有真实后端，否则不进入下一步）：

1. **选商品**：商品库选择 / 上传一组图 / 粘贴详情网址 / 批量导入 SKU。
2. **选目标**：新品上市、商品宣传、商品展示、促销、品牌介绍、UGC、数字人口播、社媒短视频。
3. **选风格**：高级商业感、生活方式、UGC 真人感、数字人讲解、电影镜头、促销快节奏。
4. **看方案**：至少 3 个创意方案（Hook/脚本/分镜/字幕/CTA/标题 + 预估费用），商家选定一个。
5. **生成与交付**：生成 → 编辑器微调 → 导出素材包 → 发布或下载。

失败与空态的硬要求：商品资料缺失时给「手动补充」而不是让 AI 瞎补；网址抓取失败必须显示原因并提供粘贴/上传入口；额度不足时显示真实剩余量与升级路径。

## 4. 商品入口与商品简报（Product Brief）

四条输入都归一到同一个权威结构 `AiAdProductBrief`（服务端类型，不落 DB；写入广告工程时快照）：

| 字段 | 来源 | 规则 |
|---|---|---|
| `productId` / `skuIds` | 商品库 | 必须属于当前 `merchantId`，服务端校验归属 |
| `name` / `description` | 商品库 | 直接引用，不改写 |
| `priceMinor` / `currency` | 商品库 | **只读**；广告文案中的价格只能引用该值，AI 不得生成价格 |
| `colors` / `sizes` | SKU | 真实 SKU 维度，颜色用于「颜色版本」与一致性检查 |
| `images` | 商品图 | 至少 1 张方形主图，用于生成与一致性比对 |
| `sellingPoints` | 商家确认 | AI 可起草，**保存前必须商家确认** |
| `brand`（Logo/主色/字体） | 品牌记忆 | 复用商家设置，不重复填 |
| `source` | `catalog` / `upload` / `url` / `batch` | 决定可追溯性与错误提示 |

约束：

- 网址抓取只提取公开结构化信息（名称、图片、描述、价格标注）；抓取结果一律标 `unverified: true`，商家确认后才可进入生成。
- 抓取失败返回真实原因（`URL_UNREACHABLE` / `URL_NO_STRUCTURED_DATA` / `URL_BLOCKED_BY_ROBOTS`），并提供「上传图片 + 手动填写」入口。
- 商品资料变更（价格/颜色/名称）后，引用它的广告工程必须标记 `brief_stale` 并提示刷新，不静默沿用旧价。

## 5. 创意规划器（Creative Planner）

输入：`AiAdProductBrief` + 目标 + 平台 + 语言 + 风格 + 时长 + 质量档。

输出（每次 ≥3 个方案，同一请求内确定性排序，可复现）：

```ts
type AiAdConcept = {
  conceptId: string;            // 方案 ID，发布后用于回传真实数据
  route: 'product' | 'ugc' | 'digital_human' | 'quick';
  goal: AiAdGoal;
  hook: string;                 // 3 秒开头
  script: Array<{ scene: number; voiceover: string; onScreenText: string | null }>;
  storyboard: AiAdShot[];       // 每个镜头：时长、景别、运镜、商品角度、字幕
  cta: string;
  title: string;
  hashtags: string[];
  subtitleLanguage: string;
  estimatedCostMinor: number;   // 来自 aiProviderPricing，未配置价即拒绝估算
  quality: 'economy' | 'standard' | 'pro';
};
```

规则：

- 脚本、配音文案、字幕、CTA、标题由 `generateAiEmployeeText` 生成，JSON Schema 强校验；解析失败即 `AI_TOOLS_PROVIDER_RESPONSE_INVALID`，不做“猜着补全”。
- 价格、材质、折扣、功效不得由模型产生；生成后做**事实白名单校验**：文案中出现的数字必须能在 `AiAdProductBrief` 中找到来源，否则该方案作废。
- 预估费用必须先经 `aiProviderPricing` 计算；高峰价未配置时返回 `PRICE_NOT_CONFIGURED`，不允许给猜测区间。
- 方案阶段不产生任何供应商费用（纯文本模型 + 本地引擎）。

## 6. 四条生产路线

| 路线 | 真实执行 | 依赖状态 |
|---|---|---|
| A. Product Ad | 分镜 → 每镜头：本地图片引擎出商品素材（主图/变体/画幅）+ 付费视频模型只生成需要创意的镜头 | 图片部分可用（已完成）；视频模型**未接通** |
| B. UGC Ad | 授权数字创作者 + 口播 + 商品镜头穿插；需人物授权记录与商品接触质量检查 | **未接通**（无供应商凭据、无授权库） |
| C. Digital Human | 商家本人 Digital Twin：肖像授权 + 声音授权 + 多语言口型同步 | **未接通**；授权与撤销必须先建记录模型 |
| D. Quick Ad | 纯本地：`aiMediaToolkit`（Ken Burns/裁切/转场/烧字幕）+ `aiImageEngine`（主图/变体/画幅）+ 本地 TTS | **部分可用**：视频合成与字幕可用，TTS 未接通 |

路线选择规则：先判断 `quick` 是否满足需求（模板类广告默认走 quick，不调用付费视频模型）；只有需要创意镜头时才升级到 A/B/C，并把升级理由与费用展示给商家。

## 7. 广告复用系统

- **模板保存**：把一条成功广告的镜头结构、样式、字幕样式、品牌元素存为 `AiAdTemplate`，与具体商品解绑。
- **复制旧广告**：读取旧工程 → 替换 `brief` → 保留构图/运镜/音乐 → 需重新过一致性检查。
- **Product Swap**：仅支持同品类/同款式替换；替换后执行商品一致性检查（见 §9），不通过则拒绝输出而不是硬贴。
- **多 SKU / 颜色版本**：一次选择多个 SKU 生成同一模板的变体；批量前必须显示逐条预估费用与总上限，超上限直接拒绝。
- **画幅**：同一工程用 `reframeAiImageToAspect` 与 FFmpeg 输出 9:16 / 1:1 / 16:9，不重新生成内容。

## 8. 广告编辑系统（不允许只有播放器）

工程结构（`AiAdProject`）：

```ts
type AiAdProject = {
  projectId: string;
  merchantId: string;
  conceptId: string;
  brief: AiAdProductBrief;      // 快照 + briefStale 标记
  timeline: AiAdTrack[];        // video / audio / subtitle / overlay 多轨
  shots: AiAdShot[];            // 每镜头：来源(kind)、供应商任务 ID、时长、in/out
  versions: Array<{ versionId: string; createdAt: string; note: string }>;
};
```

要求：

- 单镜头重生成只重跑该镜头，其余镜头复用已有产物；改一句字幕绝不触发整片重生成。
- 时间轴可拖拽、可裁切、可排序、可替换素材、可换 BGM、可换封面；每次保存产生新版本，可回滚。
- 保存为**幂等写**（`versionId` 由内容哈希 + 工程号生成），重复提交不产生重复版本。
- 编辑器面向前端三端（电脑/手机网页/小程序）共享同一工程 API，交互按端适配。

## 9. 商品真实度检查（Consistency Check）

| 维度 | 判定方式 | 不通过处理 |
|---|---|---|
| 颜色 | 生成结果的商品区域主色 vs `brief.colors`（Lab ΔE） | 标 `color_mismatch`，允许局部重做 |
| 形状/结构 | 分割轮廓与源图轮廓的面积比、宽高比偏差 | 标 `shape_mismatch` |
| Logo/文字 | 生成区域的文字与 Logo 区域清晰度与 OCR（OCR 未接入则标 `unknown`） | 不给结论，不假装通过 |
| 价格/卖点 | 文案数字白名单校验 | 方案作废 |

所有维度必须返回 `pass` / `warn` / `fail` / `unknown`，`unknown` 不得显示为通过。

## 10. 素材包（Deliverable Bundle）

一次广告交付 = 一个可下载/可发布的素材包：源图、脚本 JSON、分镜 JSON、主视频、3 个开头版本、封面、标题/正文/标签/CTA、字幕（SRT/VTT）、配音音频、多语言版本、9:16/1:1/16:9、编辑工程、生成记录（供应商任务 ID、耗时、真实费用）。

存储：复用商家存储前缀，素材以 `assetId` 索引；删除广告不得删除被其他工程引用的素材（引用计数）。

## 11. 发布与效果（分两期）

第一期（内容发布）：社交账号 OAuth 授权 → 选择素材包 → 商家审批 → 排期 → 真实发布 → 保存 `platformPostId` + 链接 + 失败原因 + 重试。发布前必须校验 AI 生成内容标识与平台披露要求。

第二期（付费投放）：Meta/TikTok 广告账户授权、广告系列/广告组/预算/素材审核/真实投放数据。**不把内容发布说成已投放广告**。

效果回传：`conceptId` 必须写入发布记录；只有拿到平台真实播放/点击/互动数据才允许展示图表，拿不到就显示「未授权数据」而不是空图。

## 12. 成本控制（硬性）

- 方案确认前不调用付费视频/音频模型。
- 模板类广告走本地引擎，成本≈0。
- 单镜头修改只重跑单镜头；批量任务必须设总费用上限（`costCeilingMinor`），超限拒绝而不是降级静默执行。
- 每次生成展示预估与实际：实际费用写 `ModaGptAiUsageRecord.actualCostMinor`，来源为供应商回执，拿不到回执标 `unknown`。
- 供应商可替换：模型 ID 由 `aiProviderCatalog` 解析，不在业务代码里写死。


## 13. 数据模型（新增表，均以 `merchantId` 为租户键）

| 表 | 归属 | 关键字段 | 说明 |
|---|---|---|---|
| `AiAdProject` | 商家 | id, merchantId, conceptId, status, briefSnapshot(Json), costEstimateMinor, actualCostMinor, createdBy | 广告工程唯一事实来源 |
| `AiAdProjectVersion` | 商家 | id, projectId, versionHash(unique), timeline(Json), note | 内容哈希幂等，支持回滚 |
| `AiAdConcept` | 商家 | id, projectId, route, goal, script(Json), storyboard(Json), quality | 一个工程 ≥3 个方案 |
| `AiAdAsset` | 商家 | id, projectId, kind, storageKey, mimeType, width/height, durationMs, refCount | 素材库索引 |
| `AiAdDigitalHuman` | 商家 | id, kind(self/third_party), consentStatus, portraitConsentAt, voiceConsentAt, revokedAt | 无授权记录不得生成 |
| `AiAdPublication` | 商家 | id, projectId, conceptId, platform, platformPostId, status, failureReason, publishedAt | 内容发布回执 |
| `AiAdMetricSnapshot` | 商家 | id, publicationId, capturedAt, views/clicks/likes/conversions, source | 仅存平台真实返回值 |

派生数据（缓存、预览帧、缩略图）必须可重建，且不得被当作权威来源。

## 14. API 契约（新增，全部 `requireMerchantTenant`）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/merchant/ai-ad/brief/from-product` | `ai.tools.use` | 商品库 → `AiAdProductBrief` |
| POST | `/api/merchant/ai-ad/brief/from-url` | `ai.tools.use` | 抓取失败返回真实原因码 |
| POST | `/api/merchant/ai-ad/brief/from-upload` | `ai.tools.use` | 图片上传 + 手动补充 |
| POST | `/api/merchant/ai-ad/concepts` | `ai.tools.use` | 生成 ≥3 方案 + 预估费用（不产生视频费用） |
| POST | `/api/merchant/ai-ad/projects` | `ai.tools.approve` | 确认方案并建工程（写 `Idempotency-Key`） |
| POST | `/api/merchant/ai-ad/projects/:id/shots/:shotId/regenerate` | `ai.tools.approve` | 单镜头重生成 |
| PATCH | `/api/merchant/ai-ad/projects/:id/timeline` | `ai.tools.approve` | 保存时间轴（新版本） |
| POST | `/api/merchant/ai-ad/projects/:id/export` | `ai.tools.use` | 输出素材包 |
| POST | `/api/merchant/ai-ad/publications` | `ai.tools.publish` | 发布（需审批） |
| GET | `/api/merchant/ai-ad/publications/:id/metrics` | `ai.tools.use` | 真实数据，无授权即 403 |

统一约定：错误结构沿用 `{ success:false, error, reason }`；写操作必须声明幂等键；列表分页；长耗时任务返回 `taskId` 并复用 `modagptTaskQueue` 状态查询，**不允许同步阻塞请求伪造进度**。

## 15. 权限与租户边界

- `merchantId` 只能来自会话 JWT；请求体传入的 `merchantId` / `tenantId` 一律忽略。
- 员工权限最小集：`ai.tools.use`（制作/查看）、`ai.tools.approve`（确认方案、发布审批）、`ai.tools.publish`（真实发布）、`ai.tools.billing`（费用上限设置）。
- 数字人、肖像、声音属敏感数据：仅商家管理员可创建/撤销；撤销后必须立即停止新广告生成，并标记历史广告不可再发布。
- 供应商密钥只在服务端；前端只能拿到能力枚举（`available` / `unavailable` / `not_connected`）。

## 16. 状态机

```
draft → planning → concept_selected → generating → review → published → archived
生成失败：generating → failed（可 retry，不产生重复扣费）
编辑保存：review → review（新版本，不改变状态）
```

非法跃迁必须服务端拒绝（例如 `draft → published`）。每个状态变更写审计（复用 `employeeAuditLog`）。

## 17. 依赖与影响范围

| 依赖 | 影响 |
|---|---|
| 商品库读写 | 只读为主；`brief_stale` 需要新增「商品变更 → 广告工程标记」事件消费 |
| 存储 | 素材包体积大，需配额与清理策略（引用计数为 0 才可清） |
| 计费 | 新增 `ai.ad.video` / `ai.ad.voice` 费用项前必须先过 `modagpt-billing-catalog` 决策，未批准不得扣费 |
| 三端 UI | 电脑端 / 手机网页端 / 商家小程序必须同步入口与状态；见 §19 |
| 通知 | 长任务完成/失败通知复用统一通知 |

## 18. 测试与验收标准

机械可测（必须进 `tests/`）：

- 商品归属越权：其他商家 `productId` 必返回 403，且不产生 `AiAdProject`。
- 事实白名单：文案含 brief 中不存在的价格/折扣时方案被拒绝。
- 费用守门：价格未配置时 `concepts` 返回 `PRICE_NOT_CONFIGURED`；批量超 `costCeilingMinor` 拒绝执行。
- 幂等：同一 `Idempotency-Key` 重复建工程只产生一个工程、一次扣费。
- 单镜头重生成：仅目标镜头产生新供应商任务（可通过任务计数断言）。
- 一致性检查：颜色不符的生成结果标 `fail`，不得落为可用素材。
- 数字人授权缺失/撤销后：生成接口返回 `DIGITAL_HUMAN_CONSENT_REQUIRED` / `DIGITAL_HUMAN_CONSENT_REVOKED`。

人工/真实环境验收（八案例，未执行前一律标「待验证」）：

| # | 案例 | 依赖 | 当前状态 |
|---|---|---|---|
| 1 | 商品库选品 → 3 个创意 → 生成商品广告 | 视频供应商 | 未实现 |
| 2 | 授权数字人生成 UGC 视频 | 数字人供应商 + 授权库 | 未实现 |
| 3 | 商家本人分身 + 另一语言口播 | 同上 + TTS/口型 | 未实现 |
| 4 | 旧广告换真实 SKU + 一致性检查 | 视频编辑 + 检查 | 未实现 |
| 5 | 同一广告输出 IG/TikTok/YouTube 三画幅 | 本地 FFmpeg + 画幅引擎 | 部分可验证（引擎已有） |
| 6 | 低成本模板广告完整素材包 | 本地引擎 + TTS | 部分可验证（无 TTS） |
| 7 | 测试社交账号授权 → 审批 → 真实发布 | 平台 OAuth | 未实现 |
| 8 | 真实发布数据对比不同创意 | 平台数据授权 | 未实现 |

## 19. 三端矩阵（商家后台联动）

| 能力 | 电脑网页端 | 手机网页端 | 商家小程序 | 当前 |
|---|---|---|---|---|
| 广告工作台入口 | 待做 | 待做 | 待做 | 未实现 |
| 商品选择/简报确认 | 待做 | 待做 | 待做 | 未实现 |
| 创意方案对比 | 待做 | 待做 | 只读查看为宜 | 未实现 |
| 时间轴编辑 | 待做 | 精简版 | 不做（能力限制） | 未实现 |
| 发布审批 | 待做 | 待做 | 待做 | 未实现 |

三端必须共用同一 API 与同一 `AiAdProject` 事实来源；小程序不得另建数据源。变更时同步更新 `merchant-three-end-matrix.md`。

## 20. 分阶段实施计划

| 阶段 | 内容 | 退出条件 |
|---|---|---|
| P0（已完成） | 确定性图片引擎 + 三个图片工具 + 真实像素测试 | 引擎单测全绿，`tsc` 无错 |
| P1 | 商品简报（catalog/upload）+ 创意规划器（纯文本模型，含事实白名单与费用预估） | 案例 1 的方案阶段可真实跑通，且无付费视频调用 |
| P2 | Quick Ad 本地合成（FFmpeg + 图片引擎 + 烧字幕）+ 素材包导出 | 案例 5、6 真实产出文件 |
| P3 | 编辑工程（时间轴/版本/单镜头重生成） | 机械测试全绿 + 电脑端真实编辑验收 |
| P4 | Product Ad（付费视频镜头编排）+ 一致性检查 | 案例 1、4 真实生成并记录费用 |
| P5 | 数字人中心（授权模型先行）+ UGC | 案例 2、3 |
| P6 | 发布中心（内容发布）→ 效果回看 | 案例 7、8 |

每个阶段都必须先在本文更新状态，再写代码；未通过退出条件不得进入下一阶段。

## 21. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| 视频供应商费用失控 | 方案确认后生成、单镜头重生成、批量上限 | 关闭对应 provider 即可停止费用，已生成素材保留 |
| 商品信息失真 | 事实白名单 + 一致性检查 + 商家确认 | 下架相关素材包，不动商品库 |
| 肖像/声音授权争议 | 授权记录必须存在且在有效期内，撤销立即生效 | 撤销授权 → 停止生成 + 历史广告禁止发布 |
| 发布失败/被平台拒 | 保存真实原因与重试，不伪造成功 | 重试或改素材，不写假 `platformPostId` |
| 新表迁移 | 只新增表，不改既有表；迁移可重复执行 | 回滚代码即恢复，数据表保留不影响旧功能 |

## 22. P1 商品广告策划器（2026-10-30 实施）

### 22.1 范围与取舍

已实现：真实商品 → 商品简报（事实白名单）→ 三套广告方案（脚本/分镜/时长/画面/配音/字幕/CTA/语言/比例/预算/供应商状态）→ 广告工程持久化（方案、镜头、版本、幂等保存）。

明确未实现（不得在 UI 上表现为可用）：URL 抓取导入、付费视频生成、TTS 配音、数字人、发布、效果数据。视频/TTS 供应商当前无 Adapter，接口只返回真实状态码，不返回假视频、假音频、假费用。

### 22.2 数据表（migration `20261030221500_modaui_ad_planner`）

| 表 | 关键列 | 约束 |
|---|---|---|
| `AiAdProject` | `merchantId`、`productId`、`status`、`brief`(Json 快照)、`briefHash`、`selectedConceptId`、`currentVersionNo`、`costEstimate`(Json)、`createdBy`、`clientRequestId` | `@@unique([merchantId, clientRequestId])` 幂等建工程；`@@index([merchantId, updatedAt])` |
| `AiAdConcept` | `projectId`、`conceptKey`、`route`、`goal`、`title`、`audience`、`hook`、`cta`、`language`、`aspectRatio`、`durationMs`、`script`(Json)、`storyboard`(Json)、`hashtags`(Json)、`providerStatus`(Json)、`costEstimate`(Json) | `@@unique([projectId, conceptKey])`，一个工程恒 ≥3 个方案 |
| `AiAdProjectVersion` | `projectId`、`versionNo`、`contentHash`、`conceptId`、`script`、`storyboard`、`costEstimate`、`note`、`createdBy` | `@@unique([projectId, versionNo])`、`@@unique([projectId, contentHash])` 幂等版本 |

纯新增，不改既有表；回滚删表即可，旧功能不读取这些结构。

### 22.3 API 契约（全部 `requireMerchantTenant` + `ai.tools.use`）

| 方法 | 路径 | 请求 | 成功响应 | 失败码 |
|---|---|---|---|---|
| GET | `/api/merchant/ai-ad/products/:productId/brief` | — | `brief`、`facts`（白名单）、`missing[]` | `AI_AD_PRODUCT_NOT_FOUND`(404) |
| POST | `/api/merchant/ai-ad/concepts` | `productId`、`goal`、`language`、`aspectRatio`、`resolutionKey`、`priceDisclosure` | `concepts[3]`、`brief`、`providerStatus` | `AI_AD_PRODUCT_NOT_FOUND`、`PROVIDER_NOT_CONFIGURED`(503)、`PRICE_NOT_CONFIGURED`(409)、`AI_AD_FACT_UNGROUNDED`(422)、`AI_TOOLS_PROVIDER_RESPONSE_INVALID`(502) |
| POST | `/api/merchant/ai-ad/projects` | `productId`、`concepts`、`selectedConceptKey`、`clientRequestId` | `project`（含 `versions[0]` 为 v1） | `AI_AD_PRODUCT_NOT_FOUND`、`AI_AD_CONCEPT_INVALID`、`AI_AD_CONCEPTS_REQUIRED` |
| GET | `/api/merchant/ai-ad/projects` | 分页 `take`/`cursor` | `projects[]` | — |
| GET | `/api/merchant/ai-ad/projects/:id` | — | `project` + `concepts` + `versions` 摘要 | `AI_AD_PROJECT_NOT_FOUND`(404) |
| PATCH | `/api/merchant/ai-ad/projects/:id` | `conceptKey?`、`script?`、`storyboard?`、`reorder?`、`note?` | `version`（新版本或幂等命中） | `AI_AD_PROJECT_NOT_FOUND`、`AI_AD_SCRIPT_INVALID`、`AI_AD_SHOT_NOT_FOUND` |
| GET | `/api/merchant/ai-ad/projects/:id/versions` | — | `versions[]` | `AI_AD_PROJECT_NOT_FOUND` |
| POST | `/api/merchant/ai-ad/projects/:id/estimate` | `resolutionKey?` | `costEstimate`（按当前分镜重算，不调用供应商） | `AI_AD_PROJECT_NOT_FOUND`、`AI_AD_STORYBOARD_EMPTY` |

约定：`merchantId` 只取会话；所有查询 `where: { merchantId, ... }`；写操作带 `Idempotency-Key` 或 `clientRequestId`；错误结构沿用 `{ success:false, error }`。

### 22.4 供应商与费用状态（不得混用）

```ts
type AiAdServiceStatus =
  | 'ready'                    // 已配置凭据且有真实 Adapter
  | 'provider_access_required'  // 有价目与 Adapter 设计，但缺凭据
  | 'adapter_not_built'         // 目录里有能力，服务端没有实现调用
  | 'price_not_configured'      // 有模型但该分辨率/档位无价格
  | 'provider_not_configured';  // 目录里没有该能力
```

- Product/UGC：视频镜头 `adapter_not_built`（当前事实），预算仍按 `aiProviderCatalog` 单价真实计算并标 `provider_access_required` 或 `adapter_not_built`；**不得**因此扣费或启动任务。
- Quick：纯本地 FFmpeg + 确定性图片引擎，`computeOnly` 成本 0；配音未接通时默认改为画面字幕，不进 TTS 计费。
- 费用金额一律来自 `estimateAiProviderCost`；返回 `ok:false` 时状态为 `price_not_configured`，`amountMinor: null`，禁止写 0。

### 22.5 事实白名单

1. 从商品行抽取允许出现的事实 token：名称/品牌/品类/面料/成分/产地/颜色/尺码/价格（整数分 → 十进制字符串）、SKU 编码、`sellingPoints`。
2. AI 返回文案后执行 `findUngroundedAiAdFacts`：扫描数字与百分比，未在 token 集合中出现过的数字 → 该方案作废并返回 `AI_AD_FACT_UNGROUNDED` 与具体 token（不回显商家隐私之外的内部字段）。
3. `brief.priceMinor == null` 时：`priceDisclosure:'allowed'` 直接 `PRICE_NOT_CONFIGURED`；`'none'` 允许生成但禁止出现任何货币金额，模型返回含金额同样作废。
4. 模型返回结构不符合 JSON Schema → `AI_TOOLS_PROVIDER_RESPONSE_INVALID`，不修补、不猜。

### 22.6 本轮验证与遗留

- 机械测试（`tests/modaui-ad-planner.test.ts`，14 项）：简报字段与缺失项、事实白名单（价格多种书写形式/成分百分比）、缺价两种披露策略、三路线时长合计与本地路线无付费镜头、供应商状态（缺凭据/缺 Adapter/缺文本 Provider）、按目录单价计算的视频成本与不可计价时 `null`、模型响应结构校验、编造数字作废、单镜头编辑/排序/脚本同步、内容哈希幂等、方案载荷校验、租户查询条件与建工程/存版本幂等。
- 基准工具：`npx tsx scripts/ai-image-quality-benchmark.ts <图片目录> --out report.json`。输出每张图的分割原因、背景一致性、主体占比、白底图结果与质检明细；失败图标记 `packshot-skip`，不写成功。算法自检（3 张合成图）已验证：白底/单色背景 `ok`，渐变背景 `background_not_uniform` + 质检 `fail`。
- 仍必须真实商品与真实凭据才能验收：30–50 张真实商品图（浅色/黑色/透明/毛绒/复杂背景/阴影）、真实商品跑出三方案（需要文本 Provider Key）、视频与配音（Adapter 未实现）、三端页面（UI 未建）。

## 23. P1 商家端四屏（前端实施契约）

### 23.1 主流程与「非导演软件」原则

主流程只有四步：**选择商品 → 选择广告方案 → 确认预算 → 分镜与保存**。

- 镜头编号、景别、机位、来源（`ai_video`/`product_image`/`local_motion`）、模型、提示词、分辨率**不进入主流程**。镜头细节只在第 4 屏「高级设置」折叠区内出现，默认收起。
- 商家在预算确认前看不到任何「开始生成」的可点击入口：P1 未接通视频/配音/数字人，按钮渲染为禁用并写明「暂未接通」，不出现假按钮、假进度、假结果。
- 主流程中所有金额来自服务端 `costEstimate`；`amountUsd === null` 时显示「未配置价格」，不显示 0、不显示「免费」。
- 三端共用同一套接口与同一份数据；界面布局按端适配，业务字段与状态文案一致。

### 23.2 第 1 屏：选择商品

| 项 | 契约 |
|---|---|
| 商品列表 | 复用既有 `GET /api/merchant/products`（已按租户隔离），不新增列表接口 |
| 商品事实 | `GET /api/merchant/ai-ad/products/:productId/brief` 返回 `brief` / `facts` / `providerStatus` |
| 展示字段 | 首图、名称、款号（`styleNo`）、SKU 数量、颜色、尺码、价格、缺失资料 |
| 缺失资料 | 直接渲染 `brief.missing`（`price`/`images`/`skus`/`colors`/`material`/`description`/`sellingPoints`）的中文标签，**不得用默认值填充** |
| 搜索 | 前端本地过滤名称/款号/SKU/颜色；数据源本身就是当前商家商品，前端不接受任何 `merchantId` 参数 |
| 补充图片 | 复用 `POST /api/merchant/media/presign` + `uploadMerchantMedia`，最多 6 张，随建工程写入 `AiAdProject.supplementImages`。P1 只保存并在第 4 屏列出「已加入素材（生成时使用）」，不参与本轮的文案生成 |
| 状态 | 加载 / 无商品 / 加载失败（可重试）/ 无权限（403） |

### 23.3 第 2 屏：三个广告方案对比

- 一次点击触发 `POST /api/merchant/ai-ad/concepts`，服务端只做**一次**文本调用生成三套方案；重复点击在请求中禁用按钮，不做并发去重以外的自动重试。
- 三个方案固定为 Product Ad / UGC Ad / Quick Ad，卡片展示：广告方向（Route 标签）、受众、开头 Hook、视频长度、镜头数量、镜头摘要（编号 + 景别 + 画面 + 时长）、配音文案、CTA、生成能力状态。
- 错误必须原样呈现，不生成占位文案：

| 情况 | 界面 |
|---|---|
| 503 `PROVIDER_NOT_CONFIGURED` | 「未配置文本模型，无法生成方案」+ 指向工具中心 |
| 409 `PRICE_NOT_CONFIGURED` | 「商品缺少价格，方案无法报价」+ 返回第 1 屏补价格 |
| 422 `AI_AD_FACT_UNGROUNDED` | 「方案中出现商品没有的数字：<tokens>」，三套方案均不展示、不可选择 |
| 502 `AI_TOOLS_PROVIDER_RESPONSE_INVALID` | 「模型返回格式异常，请重试」，不修补、不猜测 |

- 「选择此方案」是唯一前进动作；未生成方案时不能进入第 3 屏。

### 23.4 第 3 屏：预算确认

| 展示项 | 来源 |
|---|---|
| 供应商与能力状态 | `concepts[].providerStatus`（`text`/`video`/`voice`/`digitalHuman`），逐项显示 ready / 缺凭据 / Adapter 未实现 / 未配置 |
| 费用明细 | `concepts[].costEstimate.lines`：图片/视频（秒数）/配音（字符数）/本地计算 |
| 预计总额 | `costEstimate.amountUsd`；`status !== 'priced'` 时显示「未配置价格（PRICE_NOT_CONFIGURED）」 |
| 可用额度 | `GET /api/merchant/ai-tools` 的 `quota.remaining`（日/月）；取不到时显示「未获取到额度」，不编造 |
| 主操作 | 「保存项目并进入分镜」→ `POST /api/merchant/ai-ad/projects`（幂等键 `clientRequestId`）；「开始生成」始终禁用并标注「暂未接通」 |

- 建工程后如需按当前分镜重算，调用 `POST /api/merchant/ai-ad/projects/:id/estimate`；预算不随界面猜测变化。
- 第 3 屏**不调用**任何生成接口，这一阶段零供应商费用。

### 23.5 第 4 屏：分镜与保存

- 默认视图是只读「镜头一览」：序号、时长、画面、配音、字幕，配合保存与版本操作。
- 「高级设置」折叠区内可：编辑画面描述、配音、字幕、时长；上移/下移调整顺序；添加/删除镜头。
- 保存走 `PATCH /api/merchant/ai-ad/projects/:id`（服务端校验镜头、重算脚本与预算、按内容哈希幂等）；`409 AI_AD_VERSION_CONFLICT` 提示「内容已被其他端更新，请重新加载」。
- 版本：`GET /api/merchant/ai-ad/projects/:id/versions` 列表；「恢复」= 用该版本的分镜 PATCH 成**新版本**，历史版本不被覆盖、不被删除。
- 所有状态以服务端返回为准；刷新页面重新 `GET`，**不使用 localStorage 冒充数据库**。

### 23.6 三端矩阵（本模块）

| 能力 | 电脑网页端 | 手机网页端 | 商家小程序 | 状态 |
|---|---|---|---|---|
| 商品选择与缺失资料 | 表格 + 卡片混合，右侧方案区 | 单列卡片，底部固定步骤条 | 单列卡片 | 待建（本轮实施） |
| 三方案生成与对比 | 三列并排 | 横向滑动卡片 | 纵向卡片 | 待建（本轮实施） |
| 预算确认 | 右侧预算面板 | 独立步骤页 | 独立步骤页 | 待建（本轮实施） |
| 分镜高级编辑 | 折叠面板 + 表格 | 折叠面板 + 列表 | 折叠面板 + 列表 | 待建（本轮实施） |
| 版本保存与恢复 | 版本抽屉 | 版本页 | 版本页 | 待建（本轮实施） |
| 视频/配音/数字人生成 | 禁用 + 「暂未接通」 | 禁用 + 「暂未接通」 | 禁用 + 「暂未接通」 | 未接通（Provider 未实现） |

## 24. P2 广告工作室（双模式 / 视觉比较 / 双层编辑器，2026-10-30）

状态：**部分完成**。本轮只提升界面与本地确定性编辑能力；视频、配音、数字人、发布仍未接通，任何「生成视频」入口继续禁用并写明原因。

### 24.1 目标与硬边界

目标：让普通商家在不理解模型、提示词、运镜、分镜、剪辑术语的前提下完成「选商品 → 比较三个创意 → 确认预算 → 编辑并保存分镜」。

硬边界：

1. 不新增第二套业务数据源。四步流程继续使用 §22.3 的 8 条接口；本轮只新增 1 条**本地确定性**镜头修改接口（§24.6）。
2. 不做假能力：没有真实视频/配音 Provider 时，不出现可点击的生成按钮，不用固定示意图冒充生成结果。
3. 方案卡片的「创意参考图」只能是真实商品图（`brief.imageUrls`），并明确标注「商品实拍参考」；没有商品图时显示空状态，不加载占位示意图。
4. 简单文字与模板类修改必须走本地确定性逻辑，不调用任何付费供应商；费用以 `costEstimate.callsPaidProvider === false` 明确记录。

### 24.2 双模式

| 模式 | 默认 | 主流程必填项 | 自动处理 | 用户可见范围 |
|---|---|---|---|---|
| 快速制作 | 是 | 商品 | 方案方向（三套固定路线）、语言（跟随界面）、比例 9:16、档位 720p、预算与能力全部由服务端返回 | 只显示商品、三张方案卡、预算与保存 |
| 专业制作 | 否 | 商品 + 目标/语言/比例/清晰度 | 分镜结构仍由代码模板生成，不允许手写模型 ID 或提示词 | 增加目标、语言、比例、清晰度、费用明细、供应商状态、逐镜头参数 |

规则：

- 模式切换不清空任何已选商品、方案、项目或分镜草稿；切换回快速模式只隐藏专业控件，不丢弃专业设置。
- 专业模式允许调整：广告目标（`goal`）、目标语言（`language`）、视频比例（`aspectRatio`）、清晰度（`resolutionKey`）、镜头时长/景别/机位/转场/速度/裁切/位置、配音与字幕文本。
- 数字人、真实视频生成、人物授权在专业模式中**只显示禁用入口与原因**，不得显示为可用。
- 模式偏好本轮只保存在页面内存中，不写 `localStorage`；项目与分镜仍只落服务端。

### 24.3 统一 Stepper 与自动保存

- 四步固定：`1 选择商品 → 2 比较方案 → 3 确认预算 → 4 编辑与保存分镜`。
- 当前步骤高亮；已完成步骤可点击返回；未到达步骤禁用并说明。完成判定：第 1 步有 `brief`、第 2 步有 `selectedConcept`、第 3 步有 `project`。
- 返回上一步不得丢失任何内容：商品、方案数组、选中的方案、预算、编辑中的分镜草稿都保留在页面状态中。
- 自动保存：分镜草稿变化后 1200–1500ms 防抖调用 `PATCH /api/merchant/ai-ad/projects/:id`，内容未变化时服务端按内容哈希幂等返回、不产生新版本。界面必须显示「正在自动保存 / 已自动保存 vN / 自动保存失败（可重试）」。
- 自动保存失败不得标记为已保存；保留草稿并暴露错误原因，手动「保存版本」仍可用。

### 24.4 三个方案的视觉比较

统一卡片（三端同构，布局按端适配），每张卡只展示：

| 区域 | 内容 | 来源 |
|---|---|---|
| 广告风格 | 路线名（Product / UGC / Quick Ad）+ 一句风格定位 | `concept.route` |
| 创意参考图 | 真实商品首图，角标「商品实拍参考」；无图显示「没有商品图」空状态 | `brief.imageUrls[0]` |
| 广告开头 | `concept.hook` | 服务端 |
| 时长 | `concept.durationMs` | 服务端 |
| 主要镜头 | 前 3 个镜头的画面描述（超出折叠在详情） | `concept.storyboard` |
| 目标语言 | `concept.language` 中文标签 | 服务端 |
| 广告形式 | 路线 + 比例（如 `Product Ad · 9:16`） | 服务端 |
| 实际生成能力 | 视频 / 配音状态（已接通 / 缺少凭据 / 适配器未实现 / 未接通） | `concept.providerStatus` |
| 预估费用 | `costEstimate.amountUsd`；为 `null` 时显示「未配置价格」 | 服务端 |

- 不展示大段模型分析、提示词、受众长文；这些只在「查看详情」展开区出现。
- 操作固定为：`查看详情`、`选择此方案`、`对比`（切换为三列对比表：风格 / 开头 / 时长 / 镜头数 / 语言 / 形式 / 能力 / 费用）。
- 未生成方案时不允许进入第 3 步。

### 24.5 分镜编辑器两层

普通层（默认）：

- 镜头卡片：序号、时长、画面描述、配音、字幕后两行预览。
- 拖动排序 + 上移/下移按钮（键盘与手机可用）；删除需至少保留 1 个镜头。
- 就地编辑画面描述、配音、字幕、时长（0.5–30 秒）。
- 局部重新生成入口固定禁用，并写明「单镜头重新生成需要视频 Provider，当前未接通，不会扣费」。
- 自动保存状态可见。

专业层：

- 多轨时间轴：画面轨（按 `durationMs` 比例渲染）、音频轨（仅有配音的镜头）、字幕轨（仅有字幕的镜头）。
- 每个镜头可设置：景别（`framing`）、机位（`camera`）、转场（`transition`）、速度（`speed` 0.5–2.0）、裁切（`crop`）、位置（`position`）。
- 时间轴只读取服务端返回的真实分镜，不生成假视频帧、假波形、假缩略图。
- 专业层操作与普通层写同一份 `storyboard`，保存后版本一致。

### 24.6 自然语言镜头修改（本地结构化任务）

商家选中镜头 → 「修改这个镜头」→ 选择预设或输入自己的要求：

| 预设 | 结构化结果（立即可应用） | 代价 |
|---|---|---|
| 更高级 | 景别→近景、机位→推近、速度 0.9、转场淡入、画面追加质感要求 | 本地，0 供应商调用 |
| 商品更清楚 | 景别→近景、裁切→紧凑、位置→居中、画面追加商品轮廓要求 | 本地 |
| 换一个背景 | 画面追加纯色背景要求、转场淡入，标记「等待生成」 | 本地记录；图像/视频 Provider 未接通，不执行生成 |
| 人物更自然 | 画面追加自然人物姿态要求，标记「等待生成」 | 本地记录；不执行生成 |
| 节奏更快 | 该镜头时长 × 0.75（下限 0.5s）、速度 1.1 | 本地 |
| 重新设计 | 恢复画面/配音/字幕为原始分镜，标记「等待重新生成」 | 本地记录；不执行生成 |
| 自定义要求 | 清洗后的文本写入 `directionNote`（≤200 字） | 本地 |

接口：

| 方法 | 路径 | 请求 | 成功响应 | 失败码 |
|---|---|---|---|---|
| POST | `/api/merchant/ai-ad/projects/:id/shots/:shotId/edit` | `conceptKey?`、`preset?`、`instruction?`（二选一必填） | `plan`（`preset`/`tier`/`callsPaidProvider`/`requiresGeneration`/`patch`）、`storyboard`、`script`、`version`、`project` | `AI_AD_SHOT_NOT_FOUND`(404)、`AI_AD_SHOT_EDIT_INVALID`(400)、`AI_AD_PROJECT_NOT_FOUND`(404)、`AI_AD_VERSION_CONFLICT`(409) |

服务端规则：

1. `merchantId` 只取会话；方案与镜头必须属于该商家的工程。
2. 预设与自由文本都由服务端映射为结构化 `patch`，再走与 PATCH 相同的 `assertAiAdShotList` → 费用重算 → 内容哈希 → 版本保存。
3. `callsPaidProvider` 恒为 `false`（本轮没有视频/图像生成 Adapter），响应必须如实返回。
4. 需要重新生成才能生效的预设，只记录结构化要求并把 `requiresGeneration` 置为 `true`；前端据此显示「已记录要求，等待生成能力接通」，不得显示镜头已重新生成。
5. 未知预设、空请求、超长文本 → `AI_AD_SHOT_EDIT_INVALID`，不猜测、不纠正。

### 24.7 布局

- 电脑网页端：保留 MODAUI 全局导航；应用内部内容 `mx-auto` 居中，最大宽度 `1320px`；商品区与方案区并列；三方案三列网格；编辑器主区更宽，版本/预算在侧栏；底部操作区清晰。
- 手机网页端：一步一屏、纵向卡片、步骤条横向可滚动、图片与方案卡优先、底部固定主操作（sticky），触控目标不小于 36px。
- 商家小程序：保留原生顶部胶囊，不自定义导航；一步一屏；底部主操作固定；版本与预算独立卡片。

### 24.8 数据与兼容

- `AiAdStoryboardShot` 仅新增可选字段：`transition`、`speed`、`crop`、`position`、`directionNote`。旧数据缺省即按 `cut / 1 / none / center / null` 解释，不需要数据库迁移（`storyboard` 是 Json 列）。
- 内容哈希包含新增字段：参数变化会产生新版本，这是真实编辑，不是重复保存。
- 三端共用同一接口与同一工程事实；小程序不得自建数据源或本地数据库。

### 24.9 验收与遗留

- 机械验证：`tsc --noEmit`；`tests/modaui-ad-planner.test.ts`（含新增镜头编辑用例）；`tests/modaui-ad-planner-ui.test.ts`（双模式、Stepper、真实参考图、修改镜头入口、自动保存、三端契约）；`npm run test:unit`；目标应用构建；WXML 指令检查；Impeccable `detect`。
- 真实端侧验收（未执行一律「待验证」）：电脑 1440/1280、手机 390、小程序模拟器；拖动排序、自动保存、NL 修改、专业层时间轴、返回上一步不丢内容。
- 仍未接通：真实视频/图像生成、TTS、数字人、发布、效果数据。相关入口只保留禁用态与原因。

## 25. P3 商家端收敛（后台复杂、前台简单，2026-10-30）

状态：**部分完成**。本节只收敛商家可见操作面：删除商家侧技术模式与技术参数，改为「商品 → 用途 → 平台 → 开始制作 → 选方案 → 保存」。视频生成、数字人、发布仍按 §24 标注未接通，任何入口不得伪装可用。

### 25.1 问题与目标

§24 的双模式把「目标/语言/画幅/分辨率」和逐镜头技术参数暴露给普通商家，与原产品原则冲突：技术选型应由 MODAUI 统一配置，商家只做商业选择。

目标：

1. 商家只做 4 个决定：选商品、选广告用途、选发布平台、确认额度。
2. 技术参数（模型、供应商、提示词、分镜结构、运镜、编码、档位、模型路由、成本参数）不再出现在商家界面。
3. 不新增第二套数据源与接口：用途/平台只映射为既有 `goal` / `aspectRatio`，仍调用 §22.3 的既有接口。

非目标：本节不实现视频生成、数字人、TTS、发布与效果数据；这些能力缺席时必须显示禁用态与原因。

### 25.2 商家可见操作（三端一致）

| 序号 | 操作 | 控件 | 真实作用 |
|---|---|---|---|
| 1 | 选择商品 | 商品库搜索/选择 + 补充实拍图（网页端） | `productId` → 服务端读取真实商品资料与事实白名单 |
| 2 | 选择广告用途 | 4 个选项 | 映射 `goal` 与首选路线排序（见 25.3） |
| 3 | 选择发布平台 | 平台选项 | 映射 `aspectRatio`；平台发布能力未接通，界面如实标注 |
| 4 | 开始制作 | 一个主按钮 | `POST /api/merchant/ai-ad/concepts` |
| 5 | 选方案、确认额度 | 三张方案卡 + 费用卡 | `POST /api/merchant/ai-ad/projects` |
| 6 | 保存/编辑 | 自动保存 + 可选「专业精修」 | `PATCH /api/merchant/ai-ad/projects/:id` |

删除项：全局「快速制作 / 专业制作」切换、目标/语言/画幅/分辨率四个下拉、费用「重算」按钮。分镜技术字段（景别/运镜/素材/转场/裁切/位置/速度）只在商家主动展开「专业精修（可选）」后出现，默认折叠。

### 25.3 用途与平台映射（确定性，不含调用）

| 广告用途 | `goal` | 首选路线（方案排序） | 能力状态 |
|---|---|---|---|
| 商品宣传 | `conversion` | `product` | 仅策划与分镜，视频未接通 |
| 数字人介绍 | `awareness` | `ugc` | **禁用**：数字人/口型同步未接通 |
| 促销广告 | `conversion` | `quick` | 仅策划与分镜，本地合成未接通 |
| 品牌视频 | `launch` | `product` | 仅策划与分镜，视频未接通 |

| 发布平台 | `aspectRatio` | 发布能力 |
|---|---|---|
| 抖音 / 小红书 / 视频号 / Instagram Reels / YouTube Shorts | `9:16` | 未接通（无 OAuth 与发布凭据） |
| 官网 / 独立站 | `16:9` | 未接通 |
| 电商主图视频 | `1:1` | 未接通 |

规则：

1. 映射只在前端把商业选择翻译成既有请求字段；服务端仍自行校验并决定路线模板、档位与费用，客户端不能提交模型 ID、提示词或供应商。
2. 未接通的用途/平台必须显示「未接通」并禁止选择，不得让商家以为可以生成或发布。
3. 用途与平台切换不清空已选商品、方案与分镜；重新生成方案时按新的 `goal` 请求。
4. 平台只影响画幅与导出比例，不改变费用口径。

### 25.4 复杂度归属（平台后台）

以下配置只在平台侧维护，商家界面不出现：API Key、Provider、模型目录与单价、默认质量档、广告模板与提示词、数字人供应商、语音、视频参数、故障切换、成本上限、内容规范。本轮未新增平台配置界面；现状仍是代码内目录（`loadAiAdCatalog()`），与 §22 一致。

### 25.5 验收

- 机械验证：`tests/modaui-ad-planner-ui.test.ts` 断言「无模式切换、无四个技术下拉、用途/平台存在、数字人禁用、专业精修为可选展开、自动保存仍在」；`tests/modaui-ad-planner.test.ts` 断言用途映射的 `goal` 被服务端接受。
- 端侧：电脑 1440/1280、手机 390、小程序模拟器逐屏检查；未执行一律标「待验证」。
- 遗留：真实生成、数字人、发布、效果数据均未接通；本节的「开始制作」只产出真实策划、分镜、版本与费用估算。

## 26. Runpod 公共端点接入（服务端渲染接口）

规格全文：`docs/engineering/modules/modaui-runpod-gateway.md`。本节只记录与广告策划器的接缝。

### 26.1 已实现

| 接口 | 方法 | 用途 | 调用模式 |
|---|---|---|---|
| `/api/merchant/ai-ad/render/image` | POST | 商品背景 / 营销图 | `runsync`，模型 `z-image-turbo`（默认）/ `qwen-image` |
| `/api/merchant/ai-ad/render/video` | POST | 商品图生成动态镜头（需 `imageUrl`） | `run` 提交，返回 `jobId` + `pollUrl` |
| `/api/merchant/ai-ad/render/video/:jobId` | GET | 查询视频任务 | `status` 轮询，`done:true` 时返回 `videos` |
| `/api/merchant/ai-ad/render/voice` | POST | 分镜配音 | `runsync`，模型 `minimax-speech` |

共同约束：

- 三个接口都走 `requireMerchantTenant` + `AI_TOOLS_USE_PERMISSION`，租户由会话决定。
- 调用前用 `estimateRunpodRequestCost` 算价；算不出价格（缺模型/缺该分辨率单价）返回 409，不发起付费调用。
- `RUNPOD_API_KEY` 缺失返回 503 `RUNPOD_NOT_CONFIGURED`；密钥只在服务端读取，响应只含 `jobId`、媒体链接与估算成本。
- 用量上限：图片 1 张/请求、视频 2–10 秒、配音 ≤3000 字符（本阶段按单次请求限制，不做账户级配额）。
- 不写数据库、不扣额度、不生成"模拟结果"；`cost.estimated: true` 明确表示这是估算而非账单。
- 供应商状态：`video` / `voice` 的 `adapterBuilt` 现在取决于 `RUNPOD_API_KEY` 是否配置，未配置时仍如实显示未接通。

### 26.2 未实现（不得写成已完成）

- 商家端按钮与结果展示：电脑网页、手机网页、小程序**均未接入**这三个接口，商家界面暂时看不到出图/出视频/配音入口。
- 生成物落 R2 / 素材库，写回广告工程分镜（`AiAdProject` 无新增字段）。
- 额度扣减与账单核对；按次成本只回传给调用方。
- 数字人：Runpod 第一批名单无对应 slug，保持「未接通」。
- 平台发布（IG/TikTok/YouTube 等）与投放。

### 26.3 验收

- 机械验证：`tests/runpod-gateway.test.ts` 17/17（密钥缺失、白名单、错误码映射、输出提取、轮询、失败、截止、价格守门）；`npx tsc --noEmit` 0 错误。
- 真实调用：**未执行**，环境无 `RUNPOD_API_KEY`；运营配置后需按 §26.1 逐条实测并记录实际账单。
- 端侧：无 UI 变更，端侧验收不适用于本轮。

## 变更记录

| 日期 | 变更 | 验证 |
|---|---|---|
| 2026-10-30 | 建立商家 AI 广告生产平台规格（商品入口/创意规划器/四路线/编辑器/素材包/发布/成本/验收/三端矩阵） | 文档评审；P0 引擎与工具已有 17 项单测通过，其余能力均标注未实现 |
| 2026-10-30 | P1 实现：商品简报与事实白名单（`modauiAdBrief.ts`）、创意规划器与费用守门（`modauiAdPlanner.ts`）、工程/方案/版本持久化（`modauiAdStore.ts` + migration `20261030221500_modaui_ad_planner`）、8 条商家路由、图片基准脚本 | `tsc --noEmit` 0；`tests/modaui-ad-planner.test.ts` 14/14；图片引擎与图片工具合计 31/31；`npm run test:unit` 1265/1265；`prisma validate` 通过；三端 UI 未建、视频/配音/数字人/发布未接通 |
| 2026-10-30 | P1 商家端四屏：共享组件 `ModaUiAdPlanner.tsx`（电脑 + 手机网页端）、小程序 `pages/ad-planner`、补充图片落库（`AiAdProject.supplementImages` + migration `20261030233000_modaui_ad_supplement_images`）、版本列表返回 `script/storyboard` 以支持真实恢复 | 见本节验证记录：`tsc --noEmit`、`tests/modaui-ad-planner.test.ts` 17/17、`tests/modaui-ad-planner-ui.test.ts` 6/6、`npm run test:unit`、三端构建、WXML 指令检查 |
| 2026-10-30 | P2 广告工作室：双模式、统一 Stepper、真实素材方案卡与对比、双层分镜编辑器、自然语言镜头修改（`modauiAdShotEdit.ts` + 1 条本地接口）、自动保存、1320px 居中布局与移动端固定操作区 | 见 §24.9：`tsc --noEmit`、目标单测、`npm run test:unit`、三端构建、WXML 检查、Impeccable detect |
| 2026-10-30 | P3 商家端收敛：删除快速/专业模式与目标/语言/画幅/分辨率下拉，改为「商品 → 广告用途 → 发布平台 → 开始制作」；技术字段收进默认折叠的「专业精修（可选）」；数字人与发布保持禁用并写明原因 | 见 §25.5：`tests/modaui-ad-planner-ui.test.ts`、`tests/modaui-ad-planner.test.ts`、`tsc --noEmit`、WXML 检查；端侧待验证 |
| 2026-10-30 | P4 服务端渲染：Runpod 公共端点网关（`runpodGateway.ts`）+ 目录登记 6 个 slug + 4 条 render 接口（出图/视频提交/视频状态/配音）；视频与配音状态改为按 `RUNPOD_API_KEY` 真实判定 | 见 §26.3：`tests/runpod-gateway.test.ts` 17/17、`tsc --noEmit` 0；真实调用与三端入口均未完成 |

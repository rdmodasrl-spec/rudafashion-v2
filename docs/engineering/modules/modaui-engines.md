# ModaUI 创作引擎清单与接入方案

状态：审计完成，接入未执行（2026-10-27）
模块 ID：`modaui-engines`
相关模块：`modaui-workbench`、`merchant-admin`、`modagpt-billing`

## 1. 问题与目标

ModaUI 工作台已有五项创作能力入口，但“界面上有入口”不等于“服务端有引擎”。本文是唯一的引擎事实清单：**哪些能力有真实引擎、引擎如何调用、当前环境是否可用、缺失能力怎么接**。任何“已支持/即将支持”的说法必须以本文为准，不得凭 UI 入口推断能力存在。

非目标：

- 不在本文中承诺供应商报价（未拿到正式报价前只写“待核实”，不写单价）。
- 不新增第二套图片/试穿/视频服务端适配器，全部走 `src/server/aiEmployeeProviders.ts` 已有的 provider 抽象。
- 不改动计费规则；计费项沿用 `imageGeneration` / `tryOn`。

## 2. 复用与查重（防重复开发）

| 已检索 | 结论 |
|---|---|
| 关键字：`generateLocalCreativeImage`、`createFal`、`FAL_VIRTUAL_TRY_ON_MODEL_ID`、`LOCAL_IMAGE_GENERATION_URL`、`sdapi`、`img2img`、`video` provider | 仓库内唯一的图片 provider 抽象是 `src/server/aiEmployeeProviders.ts`；唯一的本地文生图客户端是 `src/server/aiEmployeeCreative.ts`；没有任何图生图、视频、分割的实现或环境变量 |
| 环境变量全量键名（`.env`，只读键名，不读取值） | 35 个键，无 `LOCAL_IMAGE_GENERATION_URL`、无 fal/Replicate/Stability/Kling/Runway 等键；`GEMINI_API_KEY` 为空字符串 |
| 本机监听端口 | `127.0.0.1:11434`（Ollama，文本）；**`127.0.0.1:7860` 无监听**，`curl /sdapi/v1/progress` 不可达 |
| 服务端门禁 | `server.ts:32837-32866`（entitlements）、`server.ts:33609-33628`（生成端点） |

复用结论：**不得新建引擎适配器**，缺失能力应扩展 `aiEmployeeProviders.ts` 的 `AiImageProviderSettings`（或新增受控 provider 分支），并同步 entitlements 的 `providers` 字段。

## 3. 引擎事实矩阵

| 能力（工作台 ID） | 真实执行方式 | 当前环境 | 计费 | 失败语义 |
|---|---|---|---|---|
| AI 服装设计 `design` | 服务端文生图 | **不可用**（无 provider） | 1 × `imageGeneration` | 403 `MODAGPT_UPGRADE_REQUIRED` / 503 `MODAGPT_IMAGE_PROVIDER_NOT_CONFIGURED` |
| 虚拟试穿 `tryon` | fal `fal-ai/fashn/tryon/v1.6` | **不可用**（无 fal key） | 1 × `tryOn` | 503 `MODAGPT_TRYON_PROVIDER_NOT_CONFIGURED` |
| 精准换色 `recolor` | 浏览器 canvas 像素级换色（保留纹理与版型） | 可用（无服务端调用） | 不扣额度 | 前端校验：仅 jpeg/png/webp，≤8MB |
| 商业棚拍 `studio` | 目前是**文字棚拍方向 + 文生图**，不是图生图 | 不可用（同文生图） | 1 × `imageGeneration` | 同文生图；套餐不足时 `plan_required` |
| 时装视频 `video` | 无 | 未接入（UI 只读提示） | 不扣额度 | 前端直接阻止 |

### 3.1 文生图（`design` / `studio` 共用）

- 分支：`provider === 'automatic1111'` → `POST {LOCAL_IMAGE_GENERATION_URL}/sdapi/v1/txt2img`；`provider === 'fal'` → `createFal(key).subscribe(model, { prompt, image_size: 'square', num_images: 1 })`。
- 本地分支安全约束（`aiEmployeeCreative.ts`）：URL 必须是 `http://127.0.0.1|localhost|[::1]`、无凭证、无路径/查询；响应必须是 `images[0]` 的 base64，≤8MB，超时 120s。
- 固定参数：1024×1024、steps 25、cfg 6.5、batch 1；prompt 前缀 `Original commercial fashion product photography. No text, logo, or watermark.`
- fal 分支受 `aiProviderCircuitBreaker`（`creative_fal`）保护，`fallbackToLocal: false` → fal 失败不会偷偷切到本地。

### 3.2 虚拟试穿（`tryon`）

- **只有 fal**：`FAL_VIRTUAL_TRY_ON_MODEL_ID = 'fal-ai/fashn/tryon/v1.6'`；非 fal 分支直接抛 `AI_EMPLOYEE_FAL_NOT_CONFIGURED`。
- 人物图与服装图先 `client.storage.upload`（生命周期 1 天），再 `subscribe`，`category: tops|bottoms|one-pieces`、`garment_photo_type: 'auto'`、`num_samples: 1`、超时 120s。
- 服务端额外校验：`garmentStorageKey` 必须属于 `merchants/<merchantId>/storefront/images/`，否则 403 `MODAGPT_IMAGE_STORAGE_KEY_FORBIDDEN`；上传字节必须是真实 jpeg/png/webp（魔数校验），≤3MB。

## 4. 当前环境实测（2026-10-27）

| 检查 | 方法 | 结果 |
|---|---|---|
| entitlements | 真实签名商家会话 `GET /api/merchant/modagpt/entitlements` | 200；`plan: free`；`providers.image: "unavailable"`；`capabilities.imageGeneration: false`、`tryOn: false` |
| 文生图 | `POST /api/merchant/modagpt/images`（`task: imageGeneration`） | 403 `MODAGPT_UPGRADE_REQUIRED` |
| 虚拟试穿 | 同上（`task: tryOn` + 双图 dataURL + `privacyConsent`） | 403 `MODAGPT_UPGRADE_REQUIRED` |
| 额度 | `ModaGptCreditLedgerEntry` 聚合前后对比 | 0 → 0（条目数不变） |
| 资产 | `MerchantModaGptDesign` 计数前后对比 | 0 → 0 |

证据：`docs/engineering/audit/modaui-workbench-2026-10-27/p0-real-api-evidence.json`。

结论：本机**双重门禁**挡住了真实出图——先被套餐门（free 无图片额度）拦，即使绕过也会被引擎门（`providers.image === 'unavailable'`）503 拦。两种拒绝都发生在扣额度之前，符合“未接入不得扣费/不得伪造成功”。

## 5. 缺失能力接入方案（未实施，供排期）

### 5.1 图生图（把商品图/换色图/试穿图变成商业棚拍）

- 首选：扩展 `automatic1111` 分支到 `POST /sdapi/v1/img2img`（`init_images: [base64]`、`denoising_strength`、其余参数与 txt2img 一致），复用同一 loopback 校验、同一 8MB 上限、同一 120s 超时。边际成本仅 GPU 与模型，无按次费用。
- 备选：fal 图生图/编辑模型。**接入前必须先核实 fal 模型目录与正式单价**，未核实前不得对外报价或承诺 SLA。
- API 契约草案：`task: 'studio'`、`sourceImage?`/`sourceDesignId?`（二者互斥且必填其一）、`direction`、`intensity`（0.2–0.8）；服务端校验 `sourceDesignId` 归属当前商家；计费 1 × `imageGeneration`；失败必须释放预留。
- 验收要求：真实请求/响应、生成文件、耗时、额度流水、失败释放各一份证据。

### 5.2 AI 自动识别服装区域（换色不用手画）

- 首选本地分割模型（SAM 系）输出 mask → 前端只把它当作画笔初值，用户仍可修正；不引入新的按次计费。
- 备选：云端分割 API（同样需先核实单价）。
- 在接入前，换色继续使用手动画笔/全图蒙版，并保持 UI 明示“手动选区”。

### 5.3 视频

- 本机无 GPU、无视频模型、无相关密钥；云端候选（供应商、模型、时长上限、单价）**尚未审计**。
- 在完成一次真实供应商评估并拿到可验证 API 之前，`video` 保持 `not_integrated`，不得出现“生成中”“排队中”等伪造进度。

## 6. 权限与租户边界

- 所有引擎调用都在 `requireMerchantTenant` 之后，`merchantId` 只来自 JWT，不接受请求体传入。
- 试穿图片来源三选一：本请求上传的 dataURL、属于本商家的 `garmentStorageKey`、或前端素材（仍走同一端点校验）。
- 引擎密钥只在服务端环境变量中，前端只读取 `providers.image` 的枚举值（`fal` / `local` / `unavailable`）。

## 7. 测试与验收标准

| 项 | 判定 |
|---|---|
| 引擎状态一致性 | `entitlements.providers.image` 与 `capabilities.*` 与工作台 `resolveWorkbenchAvailability` 三处结论一致 |
| 未接入不扣费 | 403/503 前后额度流水与资产计数不变 |
| 无伪造成功 | 引擎缺失时 UI 显示“引擎不可用/未接入”，不出现结果块与假进度 |
| 幂等 | 订阅商家必须带 `Idempotency-Key`（8–80 位 `[A-Za-z0-9._-]`），重复键返回 `MODAGPT_CREDIT_RESERVATION_ALREADY_SETTLED` 而不是重复扣费 |
| 真实出图 | 需要可用 provider（本地 SD WebUI + `LOCAL_IMAGE_GENERATION_URL`，或 fal key）后才能验收，当前环境无法执行 |

## 变更记录

| 日期 | 变更 | 验证 |
|---|---|---|
| 2026-10-27 | 建立引擎事实矩阵与缺失能力接入方案；完成本机真实接口取证 | 真实会话 200/403 证据、额度与资产前后对比、端口与 env 键名核查 |

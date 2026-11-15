# MODAUI Runpod 公共端点网关

状态：网关客户端已实现并通过单元测试（2026-10-30）；生成端点、前端入口、资产落库与计费扣减**未实现**。
负责人：平台 AI 基础能力组。

## 1. 问题与目标

商家需要「真出图 / 真出视频 / 真配音」，但自建 GPU 端点成本高、维护重。Runpod 的 **Public Endpoints** 提供已托管的模型，按 slug 直接调用，无需我们部署、无需我们建 Endpoint。

目标：

- 用服务端唯一网关调用 Runpod，**密钥永不下发前端**。
- 模型 slug、能力、单价登记进既有 `aiProviderCatalog`，不新增第二套「供应商/价格」概念。
- 图片走同步 `runsync`，视频走异步 `run` + 轮询 `status`，两者都有硬超时。
- 拿不到价格或拿不到密钥时**明确失败**，不产生"看起来成功"的假结果。

非目标（本阶段不做）：

- 不自建 Serverless Endpoint；如果未来改用自有 Endpoint，只需把 slug 换成 endpoint id（调用形式相同），网关已把 base 路径集中在一处。
- 不在这里做平台发布（OAuth 见 `modaui-ai-advertising.md` §25 未接通清单）。

## 2. 复用与查重（防重复开发）

| 已有能力 | 位置 | 本网关如何复用 |
|---|---|---|
| 供应商目录 / 能力 / 档位 / 数据合规 | `src/server/aiProviderCatalog.ts` | 新增 providerId `runpod` 与 6 个模型；路由仍按「能力 + 档位」解析，业务代码不写死 slug |
| 成本核算与峰谷价 | `src/server/aiProviderPricing.ts` | `estimateRunpodRequestCost` 直接调用 `estimateAiProviderCost`，未知价格返回拒绝原因 |
| 本地媒体引擎 | `src/server/aiImageEngine.ts`、`src/server/aiMediaToolkit.ts` | Runpod 出图后的抠图/白底/多画幅仍走本地引擎，不重复训练模型 |
| 广告策划器费用守门 | `src/server/modauiAdPlanner.ts` | 报价仍由 `estimateAiAdTimelineCost` 计算，网关只负责「真实调用」 |
| 商家鉴权与租户 | `server.ts` `requireMerchantTenant` + `AI_TOOLS_USE_PERMISSION` | 未来端点沿用同一中间件，不新增权限模型 |

检索过的关键字：`runpod`、`RUNPOD`、`public endpoint`、`runsync`、`wan`、`qwen-image`、`z-image`、`minimax`。结论：仓库此前**没有任何** Runpod 代码或环境变量，因此必须新建网关模块；但**不**新建目录/价格/能力体系。

## 3. 第一批 slug 名单（事实）

| 能力 | slug（`modelId`） | 展示名 | 档位 | 单价（Public Endpoints 公开报价） | 调用模式 |
|---|---|---|---|---|---|
| image_generate | `z-image-turbo` | Z-Image Turbo | economy | $0.005 / 张 | `runsync` |
| image_generate / image_edit | `qwen-image` | Qwen Image | balanced | $0.02 / 张 | `runsync` |
| video_generate | `wan-2-6-i2v` | WAN 2.6 I2V | pro | 720p $0.10/s；1080p $0.15/s | `run` + `status` |
| video_generate | `wan-2-2-i2v` | WAN 2.2 I2V | economy | 720p $0.06/s（$0.30 / 5s） | `run` + `status` |
| video_generate | `wan-2-1-i2v` | WAN 2.1 I2V | economy | 720p $0.06/s（$0.30 / 5s） | `run` + `status` |
| tts | `minimax-speech` | Minimax Speech 02 HD | economy | $0.05 / 1000 字符（$50 / 百万字符） | `runsync` |

价格是运营参数：可用 `AI_PROVIDER_CATALOG_JSON` 覆盖，不需要改代码发版。实际账单以 Runpod 控制台为准，本目录只用于**事前估算与拒绝无价调用**。

## 4. 调用契约

```
POST {base}/v2/{slug}/runsync        # 短任务：图片、短配音
POST {base}/v2/{slug}/run            # 长任务：视频
GET  {base}/v2/{slug}/status/{jobId} # 长任务轮询
Authorization: Bearer <RUNPOD_API_KEY>
```

- `base` 默认 `https://api.runpod.ai`，可用 `RUNPOD_API_BASE_URL` 覆盖（测试/代理用）。
- 请求体统一 `{ "input": { ...模型字段 } }`；模型字段（`prompt` / `image` / `size` / `duration`）由调用方按 slug 组装，网关**不猜测**各模型私有字段。
- 视频轮询：默认间隔 2s（指数退避到 8s 封顶），默认总截止 300s，可用参数收紧。
- 单次 HTTP 超时默认 90s（`runsync`）/ 30s（`run` 与 `status`）。
- 网关只接受**白名单内** slug；未知 slug 在发出请求前就失败（`RUNPOD_MODEL_NOT_ALLOWED`），防止误用任意公共端点。

### 错误码

| 码 | 触发条件 | 处理 |
|---|---|---|
| `RUNPOD_NOT_CONFIGURED` | 没有 `RUNPOD_API_KEY` | 503，前端按「未接通」展示 |
| `RUNPOD_MODEL_NOT_ALLOWED` | slug 不在目录白名单 | 400，属代码缺陷 |
| `RUNPOD_INVALID_INPUT` | 4xx 且非 401/403/429 | 400 |
| `RUNPOD_UNAUTHORIZED` | 401 / 403 | 502，对外文案"供应商鉴权失败"，不暴露密钥细节 |
| `RUNPOD_RATE_LIMITED` | 429 | 429 + `retryAfterMs` |
| `RUNPOD_UPSTREAM_ERROR` | 5xx / 网络错误 | 502 |
| `RUNPOD_TIMEOUT` | 超过超时或轮询截止 | 504 |
| `RUNPOD_JOB_FAILED` | `status` 为 `FAILED` / `CANCELLED` | 502，带供应商 error 文本（已截断） |
| `RUNPOD_OUTPUT_INVALID` | 完成但提取不到媒体 URL | 502，不返回伪造链接 |
| `RUNPOD_PRICE_UNKNOWN` | 目录缺该模型/该分辨率价格 | 409，拒绝发起付费调用 |

## 5. 成本护栏

- 调用前必须能算出价格：`estimateRunpodRequestCost` 返回 `ok:false` 时**不发起请求**。
- 单次请求上限（代码常量，非运营参数）：图片 4 张、视频 10 秒、配音 3000 字符；超限直接拒绝。
- 估算值与使用量随响应返回给调用方（`cost: { usd, modelId, usage }`），用于后续额度扣减；本阶段**不写数据库、不扣额度**。

## 6. 凭据与环境变量

| 变量 | 说明 |
|---|---|
| `RUNPOD_API_KEY` | **仅服务端**。平台后台未录入密钥时作为兜底；两者都缺失时网关所有调用返回 `RUNPOD_NOT_CONFIGURED` |
| `RUNPOD_API_BASE_URL` | 可选，默认 `https://api.runpod.ai` |
| `AI_PROVIDER_CATALOG_JSON` | 可选，覆盖单价/状态/凭据名 |
| `ADMIN_TOTP_ENCRYPTION_KEY` / `JWT_ADMIN_SECRET` | 平台后台密钥的加密主密钥（复用现有实现），与密文分离存放 |

密钥来源优先级：平台后台加密存储（`integrationConfig.aiEmployeeProviders.runpodApiKeyEncrypted`）→ 环境变量。后台开关 `runpodProviderEnabled=false` 时视为未配置。

硬约束：密钥不得出现在前端 bundle、日志、错误响应或 Git；网关日志只输出 slug、jobId、状态与耗时。平台后台接口见 `modaui-ai-provider-console.md`。

## 7. 权限与租户边界

- 网关本身无状态、不读请求上下文；调用方必须在服务端从会话取 `merchantId`，不得接受客户端传入。
- 未来端点沿用 `requireMerchantTenant` + `requireAnyEmployeePermission(AI_TOOLS_USE_PERMISSION)`，与既有 8 条 ai-ad 接口一致。
- 商家素材（商品图）会上传至 Runpod：数据政策登记为 `commercial_paid`，`free_tier` 模型不得用于商家保密资料。

## 8. 输出提取

不同公共端点返回结构不同（字符串 URL、`{ image_url }`、`{ video_url }`、数组、嵌套 `output`）。网关用确定性提取器递归收集 `http(s)` 媒体链接并去重；提取不到就报 `RUNPOD_OUTPUT_INVALID`，**绝不猜测或拼接 URL**。

## 9. 尚未实现（诚实清单）

- 商家端按钮与结果展示（电脑网页 / 手机网页 / 小程序均未接入这 4 条 render 接口）。
- 生成物落 R2 / 媒体库、写入广告工程分镜。
- 额度扣减、账单核对、运营成本看板。
- 数字人（第一批 slug 名单无对应端点，仍为"未接通"）。
- 平台发布（IG/TikTok/YouTube 等）与广告投放。

### 9.1 已接入的服务端接口

| 接口 | 说明 |
|---|---|
| `POST /api/merchant/ai-ad/render/image` | `runsync`；`modelId` 限 `z-image-turbo` / `qwen-image`；`sizeTier` 1k/2k；返回 `images[]` 与 `cost.usd` |
| `POST /api/merchant/ai-ad/render/video` | `run` 提交；需要 `imageUrl`；`durationSeconds` 2–10；`resolutionKey` 720p/1080p；返回 `jobId` + `pollUrl` |
| `GET /api/merchant/ai-ad/render/video/:jobId` | `status` 查询；`done:true` 时返回 `videos[]` |
| `POST /api/merchant/ai-ad/render/voice` | `runsync`，`minimax-speech`；`text` 1–3000 字符；返回 `audio[]` |

错误码到 HTTP 的映射：`RUNPOD_NOT_CONFIGURED`→503、`RUNPOD_PRICE_UNKNOWN`→409、`RUNPOD_RATE_LIMITED`→429、`RUNPOD_TIMEOUT`→504、其余上游/输出错误→502、入参与白名单错误→400。

## 10. 测试与验收

| 项 | 方式 | 状态 |
|---|---|---|
| 无密钥时不发请求、报 `RUNPOD_NOT_CONFIGURED` | `tests/runpod-gateway.test.ts` | 已实现并通过 |
| 白名单外 slug 直接拒绝 | 同上 | 已实现并通过 |
| `runsync` 成功、URL 提取、耗时字段 | 同上（注入 fake fetch） | 已实现并通过 |
| 401/429/5xx 的错误码映射、错误信息不含密钥 | 同上 | 已实现并通过 |
| `run` + `status` 轮询直到完成 / 截止超时 / `FAILED` | 同上 | 已实现并通过 |
| 价格缺失、无价分辨率、用量越界时拒绝 | 同上 | 已实现并通过 |
| 真实 Runpod 调用 | 需 `RUNPOD_API_KEY` | **未执行**（环境无密钥） |
| 4 条 render 接口的端到端 | 需真实密钥 + 商家账号 | **未执行** |

## 变更记录

| 日期 | 变更 | 验证 |
|---|---|---|
| 2026-10-30 | 建立网关规格；实现 `src/server/runpodGateway.ts`、目录新增 `runpod` 供应商与 6 个模型 | `tests/runpod-gateway.test.ts` 17/17、`npx tsc --noEmit` 0 错误 |
| 2026-10-30 | 接入 4 条 render 接口（出图 / 视频提交 / 视频状态 / 配音）；`aiAdAvailableCredentials` 加入 `RUNPOD_API_KEY`；视频、配音状态按密钥真实判定 | `npx tsc --noEmit` 0 错误、`npm run test:unit`；真实调用待配置密钥 |
| 2026-10-30 | 平台后台密钥管理：`runpodApiKeyEncrypted`/`runpodProviderEnabled` 复用现有加密存储，`/api/admin/ai-providers/runpod`（GET/PUT/test）三条超级管理员接口，密钥解析改为后台优先、环境变量兜底 | `tests/runpod-gateway.test.ts` 21/21、`npx tsc --noEmit` 0 错误；后台页面未实现 |
| 2026-10-30 | 控制台补全：模型启停/价格覆盖、测试结果落库、`AiProviderCall` 调用记录（含 4 条 render 接口写入）、产物落库到既有对象存储、平台后台 Web+Mobile 页面（导航「密钥管理」） | `tests/ai-provider-console.test.ts` 16/16、`npm run test:unit` 1322/1322、`tsc` 0 错误、`build:app:platform-admin-web/mobile` 成功；真实密钥与对象存储验收待完成 |

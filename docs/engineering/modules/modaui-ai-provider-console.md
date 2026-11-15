# MODAUI AI 服务商控制台（平台总后台）

状态：服务端接口 + 平台后台 Web/手机页面已实现（2026-10-30）；真实 Runpod 调用与素材落库需配置密钥与对象存储后验收。
相关规格：`modaui-runpod-gateway.md`（网关与调用契约）、`modaui-ai-advertising.md` §26（商家侧渲染接口）。

## 1. 目标与非目标

**目标**：平台超级管理员在总后台录入 Runpod API Key；全站服务端统一使用该密钥调用图片、图片编辑、视频、语音模型；可查看模型接入状态、做连接测试、查看调用记录与费用。

**非目标**：不重建 AI Runtime；不新增第三套任务管理系统；不改商品/订单/商家核心业务；不向商家暴露模型名、密钥、技术参数或服务商选择；第一阶段只接入 Runpod 一个服务商。

## 2. 复用与查重

| 已有能力 | 位置 | 复用方式 |
|---|---|---|
| 对称加密 AES-256-GCM | `server.ts` `encryptSecret/decryptSecret`（主密钥来自环境变量） | 直接复用；项目无外部 Secret Manager，按需求第 4 条使用 AES-256-GCM，主密钥在环境变量、密文在数据库，两者分离 |
| 平台级配置持久化 | `integrationConfig` + `saveIntegrationConfig()` | 在 `aiEmployeeProviders` 组内新增 runpod 字段；不新建配置表 |
| 后台鉴权 | `requireAdminAuth` + `requireAdminPermission('settings.ai_support')` | 全部接口沿用；不新增权限码 |
| 审计 | `logAudit(...)` | 记录操作人/动作/是否换钥/启停，不记录密钥内容 |
| 模型目录与计价 | `src/server/aiProviderCatalog.ts`（`runpod` 供应商 6 个模型）、`aiProviderPricing.ts` | 目录是只读事实源；后台只覆盖"启停 + 单价"，不回写代码 |
| 调用网关 | `src/server/runpodGateway.ts` | 密钥由控制台注入；网关不读前端 |
| 对象存储 | `getMediaObjectStorageClient/Bucket`、`getMediaObjectPublicUrl`（与 `media/presign` 同一 S3/R2 客户端） | 生成成功后服务端下载并写入同一存储桶，返回 MODAUI 永久地址 |
| 通用 UI | Tailwind 类 + `PasswordInput` + `apiGet/apiPut/apiPatch/apiPost` | 页面按现有设计系统实现，不新建组件库 |

检索关键字：`runpod`、`RUNPOD`、`encryptSecret`、`settings.ai_support`、`ai-employee-providers`、`getMediaObjectStorageClient`。
结论：加密、配置、权限、审计、存储、目录全部复用；唯一新增持久化结构是调用记录表 `AiProviderCall` —— 现有 `AuditLog` 是审计事件流，无法按商家/模型/状态/费用聚合，硬塞会污染审计语义。

## 3. 页面与导航

位置：平台总后台 → 平台管理 → **密钥管理**（`AdminTab = 'ai_providers'`；页面标题为「AI 服务商」）。同页四个分区：

1. **服务商与密钥**：Runpod 状态卡（启用状态、密钥来源、脱敏密钥、最后更新时间与操作人）＋「更换密钥」卡（录入/替换、清除、启用/禁用）。
2. **模型接入**：6 个模型的名称、slug、功能类型、请求模式、计量单位、参考价、启用开关、最后测试结果。
3. **连接测试**：说明探测方式（`GET /v2/{slug}/health`，不产生生成费用），显示时间与结果。
4. **调用记录与费用**：最近调用列表（时间/商家/模型/任务类型/状态/费用/结果/失败原因）与按状态的费用汇总。

导航命名：按《全站工程铁规》§5.2 使用四汉字「密钥管理」（与相邻「模型管理」区分：模型管理选模型通道，密钥管理管服务商与服务密钥/调用记录）。手机端：同一组件在 `platform-admin-mobile` 复用，单列布局，输入与按钮自适应宽度。

## 4. 密钥管理（安全要求逐条落实）

| 要求 | 实现 |
|---|---|
| 1 密钥只在服务端使用 | 只有 `resolveRunpodRuntimeConfig()` 读取明文；前端只拿 `maskedKey` |
| 2 禁止写入前端/浏览器/小程序/公开配置/Git | 前端无 `RUNPOD` 字样；密钥仅存配置表密文；单测静态断言 |
| 3 禁止明文保存 | `encryptSecret(apiKey)` 后再写 `runpodApiKeyEncrypted` |
| 4 优先 Secret Manager，否则 AES-256-GCM + 主密钥独立 | 项目无 Secret Manager，用既有 AES-256-GCM；主密钥在环境变量，密文在数据库 |
| 5 GET 只返回是否存在与脱敏 | `maskedKey` 形如 `****abcd`；无任何接口返回明文 |
| 6 换钥只提交新密钥，空白不覆盖 | PUT 中空 `apiKey` 视为不修改；需清空时显式 `clearApiKey: true` |
| 7 日志不含密钥或 Authorization | 审计只写 `keyChanged: replaced/cleared/unchanged`；网关日志只写 slug/jobId/状态/耗时 |
| 8 仅服务端校验过的超级管理员 | 三条接口均为 `requireAdminAuth` + `requireAdminPermission('settings.ai_support')` |
| 9 记录操作人、时间、操作类型 | 审计事件 `RUNPOD_PROVIDER_CONFIG_UPDATED` + 配置内 `runpodKeyUpdatedAt/By` |

密钥解析顺序：`runpodProviderEnabled=false` → 未配置；否则后台密文优先，环境变量 `RUNPOD_API_KEY` 兜底。

## 5. 模型接入管理

第一阶段登记模型（slug 以 RunPod 官方 Public Endpoint 为准，不按名称猜测）：

| 模型 | slug | 功能 | 请求模式 | 计量 | 参考价 |
|---|---|---|---|---|---|
| Z-Image Turbo | `z-image-turbo` | 商品广告图 | `runsync` | 每张 | $0.005 |
| Qwen Image | `qwen-image` | 商品图片编辑 | `runsync` | 每张 | $0.02 |
| WAN 2.6 I2V | `wan-2-6-i2v` | 高质量商品视频 | `run` + `status` | 每秒 | 720p $0.10 / 1080p $0.15 |
| WAN 2.2 I2V | `wan-2-2-i2v` | 经济型商品视频 | `run` + `status` | 每秒 | 720p $0.06 |
| WAN 2.1 I2V | `wan-2-1-i2v` | 备用视频 | `run` + `status` | 每秒 | 720p $0.06 |
| MiniMax Speech 02 HD | `minimax-speech` | 多语言配音 | `runsync` | 每千字符 | $50 / 百万字符 |

后台可覆盖 `enabled` 与 `priceCents`（成本配置，不写死前端）。覆盖存于配置 JSON，记录 `updatedAt/By`；目录仍是唯一价格基线。启停只影响是否允许发起请求与界面状态，不修改目录文件。最后测试结果按模型记录在 `runpodModelTestResults`。

## 6. API 契约

全部接口 `Cache-Control: no-store`；统一错误体 `{ success: false, error: CODE }`；内部异常不返回堆栈。

| 方法 | 路径 | 权限 | 请求 | 响应要点 |
|---|---|---|---|---|
| GET | `/api/admin/ai-providers/runpod` | `settings.ai_support` | — | `provider{ enabled,configured,source,maskedKey,keyUpdatedAt,keyUpdatedBy,lastTest,models[] }` |
| PUT | `/api/admin/ai-providers/runpod` | 同上 | `{ apiKey?, clearApiKey?, enabled? }` | 同上；空 `apiKey` 不覆盖 |
| PATCH | `/api/admin/ai-providers/runpod/models/:modelId` | 同上 | `{ enabled?, priceCents? }` | 更新后的 provider 视图 |
| POST | `/api/admin/ai-providers/runpod/test` | 同上 | `{ modelId? }` | `test{ ok,status,modelId,checkedAt }`，写入 lastTest |
| GET | `/api/admin/ai-providers/runpod/calls` | 同上 | `?status=&modelId=&merchantId=&page=&pageSize=` | `calls[]`、`total`、`migrationPending` |
| GET | `/api/admin/ai-providers/runpod/calls/summary` | 同上 | `?days=7` | `summary{ totals, byStatus, byModel }` |

错误码：`RUNPOD_KEY_INVALID` 400、`RUNPOD_PROVIDER_CONFIG_INVALID` 400、`RUNPOD_MODEL_UNKNOWN` 404、`RUNPOD_MODEL_PRICE_INVALID` 400、`RUNPOD_NOT_CONFIGURED` 400。
调用记录接口在表未迁移时返回 200 + `migrationPending: true`（不隐藏状态、也不中断页面），不返回 503。

## 7. 调用记录与费用

表 `AiProviderCall`（§9）。字段：商家、AI Tools 应用、任务 ID、模型、任务类型、状态、供应商实际费用（分）、费用来源、估算费用、计价版本、结果素材、失败原因、耗时、创建/完成时间。

状态：`pending`（已受理未完成）、`succeeded`、`failed`（供应商失败）、`timeout`（轮询/网关超时）、`cancelled`（取消）、`rejected`（成本护栏或参数校验拦截，未发起付费调用）。

费用优先级：供应商真实费用 → 估算（`costSource: estimate`，明确标记）→ 未知（`null`，不填 0 冒充）。
不伪造：`rejected`/`failed` 必须写 `errorCode`；只有真实 HTTP 200 且拿到媒体 URL 才写 `succeeded`。

## 8. 素材落库

生成成功后：服务端下载产物 → 校验 MIME/大小 → 写入既有对象存储 `merchants/{merchantId}/ai-ad/{images|videos|audio}` → 得到 MODAUI 公网地址 → 回填 `assetUrl`/`assetId`。
对象存储未配置时：仍返回供应商 URL，但记录 `assetStored:false` 与 `ASSET_STORE_UNAVAILABLE`，不谎称已入库。

## 9. 数据模型与迁移

新增表 `AiProviderCall`（纯新增，不改既有列；回滚 `DROP TABLE`）。
迁移文件：`prisma/migrations/20261030235500_modaui_ai_provider_console/migration.sql`。
配置项（JSON，无 schema 变更）：`runpodApiKeyEncrypted`、`runpodProviderEnabled`、`runpodKeyUpdatedAt/By`、`runpodLastTest`、`runpodModelOverrides`、`runpodModelTestResults`。

表未迁移时控制台不崩溃：读接口返回 `migrationPending: true` 与空列表；写记录失败只记日志，不影响商家侧生成。

## 10. 未实现

- 供应商真实费用回填（Runpod 未稳定返回费用，当前以估算为主，`costSource: estimate`）。
- 与计费/额度系统扣减联动（需另行设计，不在本模块）。
- 平台发布、数字人、多服务商接入。

## 11. 验收

| # | 验收项 | 方式 | 状态 |
|---|---|---|---|
| 1 | 超级管理员录入 API Key | 后台页面 + PUT | 待真实密钥验证 |
| 2 | 密钥加密保存、刷新后有效 | 密文留存 + 重新 GET 有 `maskedKey` | 待真实密钥验证 |
| 3 | 页面无法读取完整密钥 | 单测断言视图无明文字段 | 通过 |
| 4 | 非超级管理员无法调用 | 权限中间件 + 集成测试路由表 | 通过（静态） |
| 5 | 完成一次低成本真实探测 | `/test` → `health` | 待密钥 |
| 6 | 通过网关调用真实模型 | 4 条 render 接口 | 待密钥 |
| 7 | 结果保存到素材库 | 对象存储写入 + `assetStored` | 待对象存储 + 密钥 |
| 8 | 换钥后新请求用新钥 | 配置读取即时生效（无缓存） | 通过 |
| 9 | 现有业务与测试正常 | `tsc` + `test:unit` | 通过 |

## 变更记录

| 日期 | 内容 | 证据 |
|---|---|---|
| 2026-10-30 | 建立模块文档：服务端接口、密钥解析、模型目录 | 代码 + 单测 |
| 2026-10-30 | 补齐后台页面（四分区）、模型启停与价格覆盖、连接测试落库、调用记录与费用汇总、素材落库路径 | `tests/ai-provider-console.test.ts`、`npx tsc --noEmit`、`build:app:platform-admin-web` |

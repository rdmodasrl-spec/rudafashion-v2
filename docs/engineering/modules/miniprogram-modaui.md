# 用户端小程序 ModaUI 版块

- 模块 ID：`miniprogram-modaui`
- 状态：**部分完成**（服务端开关端点、平台开关定义、小程序按开关渲染、虚拟试衣入口收口已完成并有定向测试；微信开发者工具/真机截图未取得，虚拟试衣能力尚未建设，因此不得标记为「已验收」）
- 关联文档：[`platform-feature-flags.md`](./platform-feature-flags.md)、[`modaui-workbench.md`](./modaui-workbench.md)、[`../module-registry.md`](../module-registry.md)
- 强制规则：`AGENTS.md` §3（单一事实来源）、§4（文档先行）、§6（API 契约）、§9（安全）、§13（完成定义）

---

## 0. 目标与非目标

### 0.1 目标

1. 用户端小程序（`miniprogram/`）底部「ModaUI」tab 能真正打开：`pages/modagpt/index` 进入后展示设计对话界面，不再被无条件跳回首页。
2. 开放状态由**平台功能开关**单一权威控制（总后台「平台管理 → 功能开关」），运营可随时关闭，无需重新提审小程序。
3. 服务端与前端双重生效：关闭时前端隐藏/回退，且本就无写接口被放开；读取失败一律按关闭处理（fail-closed）。
4. 与商家小程序 ModaUI 使用同一套开关中心、同一套持久化，不新建第二个配置中心。

### 0.2 非目标（本次明确不做）

- 不建设消费者虚拟试衣（`pages/tryon`）：其依赖的 `getModaGptEntitlements` / `requestModaGptImage` / `getModaGptImageTask` 在 `miniprogram/utils/api.js` 中不存在，服务端也没有对应消费者接口（仅 `/api/modagpt/public/chat`）。本次隐藏入口，避免「点了报错」。
- 不改动商家侧 ModaUI（`merchant_miniprogram_modaui_enabled`）语义与取值。
- 不新增 AI 计费、额度体系改造；对话沿用 `/api/modagpt/public/chat` 现有匿名限流。
- 不做按用户/按灰度放量。

---

## 1. 现状与根因（改动前实测）

| 事实 | 证据 |
|---|---|
| 小程序已有「ModaUI」tab | `miniprogram/app.json` tabBar 第 3 项 `pages/modagpt/index`，文案 `ModaUI`；`tests/miniprogram-navigation.test.ts` 断言五位导航 |
| 页面按服务端开关渲染 | `miniprogram/pages/modagpt/index.js:19-38` 读取 `features.aiSectionEnabled`，非 `true` 时 toast「AI 版块暂未开放」并 `wx.switchTab` 回首页 |
| **服务端端点缺失** | 全仓 `grep 'miniprogram/features'` 仅命中 `miniprogram/utils/api.js:293`；`server.ts` 与 `dist/server.cjs` 均无该路由 |
| 线上实测 | `curl https://ruda.fashion/api/miniprogram/features` 返回 SPA HTML（`<!doctype html>`），非 JSON → 小程序 `apiRequest` 解析失败 → 走 catch 分支「AI 版块暂不可用」→ 回首页 |
| 虚拟试衣不可用 | `miniprogram/pages/tryon/index.js` 引入了 `api.js` 中不导出的三个函数；`pages/tryon` 未注册进 `app.json.pages`；服务端无对应路由 |

结论：本次「开通」不是打开一个已有开关，而是补齐**缺失的服务端开关端点**并让开放状态可见、可关、可审计。

---

## 2. 复用审计（防重复）

检索关键字：`miniprogram/features`、`aiSectionEnabled`、`featureFlag`、`FEATURE_FLAG_DEFINITIONS`、`modagpt/public/chat`、`getMiniProgramFeatures`。

| 能力 | 现有权威实现 | 复用结论 |
|---|---|---|
| 平台开关存储与审计 | `src/server/featureFlags.ts`（`logs/feature-flags.json`，原子写、mtime 重载、fail-closed）+ 总后台 `AdminFeatureFlags` | **复用**，仅新增一条定义，不新建存储 |
| 后台开关页面 | `src/apps/platform-admin-common/components/admin/AdminFeatureFlags.tsx` 按 `store.list()` 泛化渲染 | 无需改 UI，新定义自动出现 |
| 对话能力 | `POST /api/modagpt/public/chat`（匿名、20 次/小时/IP、敏感信息拦截、`Cache-Control: no-store`） | **复用**，不新建对话接口 |
| 小程序请求通道 | `miniprogram/utils/api.js` 的 `apiRequest`（`auth:false` 支持匿名） | 复用，`getMiniProgramFeatures()` 已存在 |
| 页面与文案 | `miniprogram/pages/modagpt/index.{js,wxml,wxss}` 已具备完整对话 UI | 复用，仅补开关字段与入口收口 |

**为什么只加一条开关而不新建模块**：仓库已有通用开关中心与消费者页面，缺的只是一个只读端点与一个 key；新建第二套配置或新页面会破坏 SSOT。

**防重复**：开关值唯一权威仍为 `logs/feature-flags.json`；小程序只保存渲染副本；服务端每次读取前 `refresh()`。

---

## 3. 数据归属

| 项 | 决定 |
|---|---|
| 权威存储 | `logs/feature-flags.json`（与商家开关同一文件、同一结构） |
| 开关键 | `miniprogram_modaui_enabled` |
| 默认值 | `false`（fail-closed）；开放必须由管理员或运维显式写入并记录 `updatedBy` |
| 生效范围 | 仅用户端小程序「ModaUI」tab；不影响商家端与 Web 端 |
| 缓存 | 进程内缓存 + 文件 mtime 变更自动重载（1000ms 节流）；客户端返回 `Cache-Control: no-store` |

---

## 4. API 契约

### 4.1 `GET /api/miniprogram/features`

- 用途：用户端小程序读取版块开放状态。
- 认证：无（公开只读）。不返回任何租户、账号、操作人信息。
- 响应头：`Cache-Control: no-store`。
- 请求参数：无。
- 成功响应 `200`：

```json
{ "success": true, "features": { "aiSectionEnabled": true, "tryOnEnabled": false } }
```

| 字段 | 类型 | 语义 |
|---|---|---|
| `features.aiSectionEnabled` | boolean | 是否开放 ModaUI 对话版块，等于 `featureFlagStore.isEnabled('miniprogram_modaui_enabled')` |
| `features.tryOnEnabled` | boolean | 消费者虚拟试衣是否可用。当前恒为 `false`（能力未建设），前端据此隐藏入口 |

- 失败：开关文件不可读时仍返回 `200` + `aiSectionEnabled: false`（fail-closed），不 5xx、不暴露文件路径。
- 幂等：只读，天然幂等。
- 限流：无独立限流（读操作、无写副作用）；对话接口自身限流 20 次/小时/IP。

### 4.2 未新增写接口

开放/关闭只经过既有 `PATCH /api/admin/feature-flags/:key`（`requireAdminAuth` + `settings.features`，写 `AuditLog`），不新增任何面向小程序的写接口。

---

## 5. 页面与状态矩阵

| 场景 | 行为 |
|---|---|
| 开关开 + 接口 200 | 渲染「RUDA · AI STUDIO / ModaUI」对话页，可发送、可重试，显示敏感信息提示 |
| 开关关 + 接口 200 | toast「AI 版块暂未开放」，`wx.switchTab` 回首页 |
| 接口异常/网络失败 | toast「AI 版块暂不可用」，回首页（不白屏、不留在空页） |
| 敏感信息输入 | 服务端返回 `MODAGPT_SENSITIVE_PROMPT_BLOCKED`，页面提示「请勿发送个人联系方式、证件、银行卡或密码等敏感信息。」 |
| AI 超时/失败 | 页面显示「暂时无法连接 ModaUI，请稍后重试。」，输入内容与历史保留 |
| 虚拟试衣入口 | `tryOnEnabled !== true` 时整块隐藏（不出现「点了报错」的按钮） |

---

## 6. 权限与边界

- 读接口公开，不携带、不校验 token，不依赖客户端传入的任何身份参数。
- 对话接口匿名可用，但受 IP 限流与敏感信息拦截；不写数据库、不产生额度。
- 平台开关只能由持有 `settings.features` 的管理员修改，并写入 `AuditLog`（`entity=FeatureFlag`）。
- 商家端开关（`merchant_miniprogram_modaui_enabled`）与本次键互不影响，禁止合并语义。

---

## 7. 测试与验收标准

### 7.1 自动化（`tests/miniprogram-modaui-section.test.ts`）

1. `server.ts` 存在公开路由 `/api/miniprogram/features`，无 `requireAdminAuth`/`requireMerchantTenant`，设置 `Cache-Control: no-store`，值来自 `featureFlagStore.isEnabled(MINIPROGRAM_MODAUI_ENABLED_KEY)`。
2. `src/server/featureFlags.ts` 定义 `miniprogram_modaui_enabled`，`defaultEnabled === false`，`permission === 'settings.features'`，且商家开关仍为 `list()[0]`（兼容既有测试）。
3. `miniprogram/utils/api.js` 请求路径与路由字面量一致。
4. 页面以 `aiSectionEnabled === true` 判定开放，虚拟试衣按钮受 `tryOnEnabled` 控制，无硬编码 `aiSectionEnabled: true`。

### 7.2 端到端（隔离实例）

- 无配置文件时：返回 `aiSectionEnabled=false`。
- 写入 `{"miniprogram_modaui_enabled": true}` 后（不重启）：返回 `true`（验证 mtime 重载）。
- `POST /api/modagpt/public/chat` 空消息返回 `400 MESSAGE_REQUIRED`（证明路由可达且校验生效）。

### 7.3 未完成（不得标记已验收）

- 微信开发者工具截图/录屏（tab 打开、关闭态回退、对话回复）。
- 真机验收与发布新版小程序（服务端开放对已发布版本是否生效取决于线上版本是否已包含该页面逻辑）。

---

## 8. 部署与回滚

- 部署：随服务端构建（`esbuild server.ts --bundle --outfile=dist/server.cjs`）发布；无数据库迁移；`logs/feature-flags.json` 首次写入自动创建。
- 开关：总后台「平台管理 → 功能开关」可即时关闭；也可由运维写入文件（1000ms 内生效）。
- 回滚：还原上一份 `dist/server.cjs` 并重启进程即可；小程序侧旧版本仍读同端点，端点不存在时按「暂不可用」回首页，不会白屏。
- 风险：开放对话会消耗 AI 供应商额度（匿名 20 次/小时/IP）；如需限制总成本，先在开关中心关闭即可立即止血。

---

## 9. 变更记录

| 日期 | 变更 | 验证 |
|---|---|---|
| 2026-10-27 | 新增 `miniprogram_modaui_enabled` 平台开关、`GET /api/miniprogram/features` 公开端点、虚拟试衣入口按 `tryOnEnabled` 收口 | 定向单测 + 隔离实例真实请求；开发者工具截图待验收 |

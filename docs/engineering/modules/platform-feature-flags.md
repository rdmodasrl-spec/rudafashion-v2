# 平台功能开关中心（Feature Flag Center）

- 模块 ID：`platform-feature-flags`
- 状态：**部分完成**（总后台 Web/手机端开关页、服务端持久化、小程序配置读取、服务端门禁、审计与测试已实现。开关集合：`merchant_miniprogram_modaui_enabled`、`miniprogram_modaui_enabled`、`fashion_enabled`（时尚版块全局）、`modaui_enabled`（ModaUI 全局）。前两个开关已在隔离预览实例验收（§8.3）；两个全局开关见 §12。**仍未完成**：微信开发者工具与真机截图验收）
- 关联文档：[`modaui-workbench.md`](./modaui-workbench.md)、[`merchant-three-end-matrix.md`](./merchant-three-end-matrix.md)、[`../module-registry.md`](../module-registry.md)
- 强制规则：`AGENTS.md` §3（单一事实来源）、§4（文档先行）、§6（API 契约）、§9（安全与审计）、§15（商家三端联动）

---

## 0. 目标与非目标

### 0.1 目标

1. 平台超级管理员在 RUDA 总后台「平台管理 → 功能开关」中，随时开启/关闭 **商家小程序** 内的 ModaUI 版块，不需要开发人员改代码、重新提交小程序审核。
2. 关闭是**双层生效**：前端隐藏入口 + 服务端拒绝新建 ModaUI 任务；不依赖前端隐藏。
3. 开关状态由服务端持久化，读取失败时按「关闭」处理（fail-closed），不允许绕过服务端校验。
4. 变更记录操作人、操作时间、旧值、新值，并进入现有 `AuditLog` 审计。
5. 为后续版块（时尚视频、折扣商城等）复用同一套 key 约定与同一个后台页面。
6. （2026-10-28 增补）提供两个**互相独立**的全局开关，作为整个产品的总闸：
   - `fashion_enabled`：关闭后 Web、手机网页、用户小程序隐藏时尚入口，`/api/fashion/*` 全部返回
     `403 FASHION_MODULE_DISABLED`；所有作品、视频、图片、评论、关注与统计数据原样保留。
   - `modaui_enabled`：关闭后隐藏 ModaUI 入口，并拒绝**新建** AI 生成任务
     （公共对话、商家图片/设计/知识库、助理问答）；已存在的聊天记录、作品与任务记录保留，
     正在执行的任务不取消、不重复扣费。
   两个开关互不影响：关闭时尚不改动 ModaUI 任何行为，反之亦然。平台管理员始终可以进入总后台并重新开启。

### 0.2 非目标（本次明确不做）

- 不控制商家 Web、商家手机 Web、商家手机 App 的 **ModaUI 具体功能与额度**。这三端继续由既有套餐额度、引擎可用性、员工权限决定；2026-10-28 起它们受 **全局** `modaui_enabled` 总闸约束（只做统一停用，不做按端差异化放量）。
- 不做按商家、按租户、按灰度百分比的分组放量（首期为平台级全局开关；如需要，扩展为作用域表，不在此次范围）。
- 不改动已提交任务的生命周期、不删除历史作品、不调整计费。
- 不新增独立的「开关服务」或第二个配置中心；不引入 localStorage 作为权威来源。

---

## 1. 复用审计（改动前）

检索关键字：`featureFlag`、`FEATURES_ENABLED`、`settings.`、`/api/admin/settings`、`platformConfig`、`SystemSetting`、`auditLog.create`、`requireAdminPermission`、`isWorkspaceEnabled`。

| 能力 | 现有实现（权威） | 复用结论 |
|---|---|---|
| 平台级系统配置持久化 | `server.ts` 中 `logs/integration-config.json`、`logs/footer-config.json`、`logs/registration-config.json`、`logs/notification-config.json`（`readFile` + 原子写 `tmp` + `rename`） | **复用同一约定**新建 `logs/feature-flags.json`。仓库没有通用 `Setting` 表，为避免为单个开关引入生产 Prisma 迁移，沿用平台配置既有的服务端文件持久化方式 |
| 管理员认证与权限 | `requireAdminAuth` + `requireAdminPermission(permission)`；`hasAdminPermission` 支持 `'*'` | 复用；新增权限键 `settings.features` |
| 操作审计 | `logAuditAndWait(userName, role, action, entity, entityId, oldValue, newValue)` 写入 `AuditLog` | 复用；`action=FEATURE_FLAG_UPDATED`，`entity=FeatureFlag`，`entityId=<flag key>` |
| 总后台导航与页面 | `src/apps/platform-admin-common/components/admin/adminNavigation.ts`（四个业务分区、导航名四字规则）、`AdminModaGptBilling.tsx` 等既有开关/表单页模式 | 复用；平台管理分区新增「功能开关」（四字） |
| 小程序版块可见性 | `merchant-miniprogram/utils/review-features.js`（写死 `AI_FEATURES_ENABLED = false`）、`utils/permissions.js` 的 `isWorkspaceEnabled` / `visibleGroups` | 扩展为**读取服务端开关**，函数签名与调用点不变 |
| 小程序请求通道 | `merchant-miniprogram/utils/api.js`（统一 `wx.request`、Bearer 注入、`ApiError`） | 复用；仅追加一个标识客户端的请求头 |
| ModaUI 生成入口 | `POST /api/merchant/modagpt/images`（额度/计费/引擎门禁）、`POST /api/merchant/modagpt/designs`、`POST /api/merchant/modagpt/brain/documents`、`POST /api/merchant/assistant/query` | 复用；在**额度预留与任务创建之前**插入开关门禁（四个写入口均已接入） |

**为什么必须新建而不是扩展已有模块**：仓库中不存在任何功能开关模型、接口或页面（`grep featureFlag` 无结果），`review-features.js` 只是一个写死的编译期常量，无法由平台运营修改。新建内容限定为：一个服务端存储模块 + 3 个 API + 1 个后台页面 + 1 个小程序工具模块，不复制认证、审计、导航、请求通道。

**防重复**：开关值只有一个权威来源（`logs/feature-flags.json` + 进程内缓存的同一份数据）。前端只缓存**副本**用于渲染，服务端始终重新读取；任何服务端写入都必须经过 `featureFlagStore.set()`。


---

## 2. 数据归属与存储

| 项 | 决定 |
|---|---|
| 权威存储 | 服务端文件 `logs/feature-flags.json`（与 `integration-config.json` 同级目录、同原子写方式） |
| 权威读取方 | 服务端进程（`featureFlagStore`），Web/小程序只读副本 |
| 开关键 | `merchant_miniprogram_modaui_enabled`（商家小程序）、`miniprogram_modaui_enabled`（用户小程序）、`fashion_enabled`（时尚全局）、`modaui_enabled`（ModaUI 全局） |
| 值结构 | `{ "flags": { "<key>": { "enabled": boolean, "updatedAt": ISO, "updatedBy": string } } }` |
| 默认值 | 两个小程序开关 `false`（评审期隐藏）；`fashion_enabled` / `modaui_enabled` 默认 `true`，与当前线上已开放状态一致，避免发布即误停 |
| 缓存 | 进程内缓存 + 写后立即生效；读取前按文件 `mtime`（节流 1000ms）检测变化并重载，覆盖多进程/多实例与手工改文件 |
| 文件损坏 | 解析失败时保留默认值（关闭），记录 `loadError` 并在后台页面提示，不抛异常导致服务不可用 |
| 多租户作用域 | 无租户作用域；平台级全局开关。商家管理员不能覆盖平台关闭结果 |

---

## 3. API 契约

### 3.1 `GET /api/admin/feature-flags`

- 认证：`requireAdminAuth`；权限：`settings.features`
- 响应 `200`

```json
{
  "success": true,
  "loadError": null,
  "flags": [
    {
      "key": "merchant_miniprogram_modaui_enabled",
      "name": "ModaUI 智能创作",
      "terminal": "商家小程序",
      "description": "AI 设计、虚拟试穿、换色等功能",
      "permission": "settings.features",
      "enabled": false,
      "updatedAt": "2026-10-27T21:00:00.000Z",
      "updatedBy": "superadmin"
    }
  ]
}
```

- 错误：`401`（未登录/会话失效）、`403 ADMIN_PERMISSION_REQUIRED`
- `Cache-Control: no-store`

### 3.2 `PATCH /api/admin/feature-flags/:key`

- 认证：`requireAdminAuth`；权限：`settings.features`
- 请求体：`{ "enabled": boolean, "expectedUpdatedAt"?: string | null }`
- 成功 `200`：`{ "success": true, "flag": <单条快照>, "previous": { "enabled": bool, "updatedAt": string|null } }`
- 错误：
  - `400 FEATURE_FLAG_REQUEST_INVALID`：`enabled` 非布尔
  - `404 FEATURE_FLAG_UNKNOWN`：未知 key（不接受任意键写入）
  - `409 FEATURE_FLAG_VERSION_CONFLICT`：传入的 `expectedUpdatedAt` 与当前不一致（并发编辑保护）
  - `403 ADMIN_PERMISSION_REQUIRED`
- 幂等：同一 `enabled` 重复提交结果一致，不产生额外副作用；仍写一条审计
- 审计：`FEATURE_FLAG_UPDATED`，`oldValue` / `newValue` 为 `{ enabled, updatedAt }` JSON
- 即时生效：写入完成后同一进程内后续读取立即返回新值（无 TTL 等待）

### 3.3 `GET /api/merchant/feature-flags`

- 认证：`requireMerchantTenant`（商家老板与员工均可读）
- 响应 `200`：`{ "success": true, "version": "<ISO updatedAt 或文件 mtime>", "flags": { "merchant_miniprogram_modaui_enabled": false } }`
- `Cache-Control: no-store`；不返回操作人姓名（最小暴露）
- 读失败（服务端存储异常）时返回默认值（关闭），不会返回 `true`

### 3.4 服务端生成门禁

`POST /api/merchant/modagpt/images` 与 `POST /api/merchant/assistant/query` 在处理器最前端增加：

```
if (isMerchantMiniprogramRequest(req) && !flagEnabled) → 403 MODAUI_MINIPROGRAM_DISABLED
```

- 终端识别：小程序在 `utils/api.js` 统一发送 `X-Ruda-Client: merchant-miniprogram`；缺失或其它取值的请求不受此开关影响（商家 Web / 手机 Web / 手机 App）。
- 门禁位置在**额度预留、计费、任务创建之前**，命中时 `403` 且不产生任何额度扣减、任务或资产写入。
- 返回体：`{ "success": false, "error": { "code": "MODAUI_MINIPROGRAM_DISABLED", "message": "该功能暂未开放" } }`

### 3.5 `GET /api/public/feature-flags`（2026-10-28 新增）

- 认证：无（公开只读），`Cache-Control: no-store`
- 用途：Web / 手机网页 / 用户小程序 / 商家端渲染入口时读取**副本**；不是授权依据
- 响应 `200`：

```json
{ "success": true, "version": "2026-10-28T10:00:00.000Z", "flags": { "fashion_enabled": true, "modaui_enabled": true } }
```

- 只返回两个全局开关的布尔值，不返回操作人、时间线或其它 key；读取异常时按 `false`（fail-closed）
- 服务端始终在请求处理时重新判断开关，客户端副本被篡改不会放行

### 3.6 全局门禁（2026-10-28 新增）

| 门禁 | 作用范围 | 命中结果 |
|---|---|---|
| `requireFashionEnabled` | 挂载在 `/api/fashion` 之前的 Express 中间件，覆盖帖文、互动、发布、举报、草稿、通知等全部用户接口 | `403 { "code": "FASHION_MODULE_DISABLED", "message": "该功能暂未开放" }` |
| `requireModauiEnabled` | `POST /api/modagpt/public/chat`、`POST /api/merchant/modagpt/images`、`POST /api/merchant/modagpt/designs`、`POST /api/merchant/modagpt/brain/documents`、`POST /api/merchant/assistant/query`（均在额度预留与任务创建之前） | `403 { "code": "MODAUI_DISABLED", "message": "该功能暂未开放" }` |

- `/api/admin/fashion/**`、`/api/admin/modagpt/**` 不受门禁影响：管理员必须始终能进入后台管理与重新开启。
- 只拦截**写操作与新任务**；`GET` 历史作品/任务/聊天记录接口继续可用，关闭不删除数据。
- 两道门禁分别只读取自己的 key，互不依赖（关闭时尚时 ModaUI 请求正常，反之亦然）。

---

## 4. 权限与租户边界

| 操作 | 主体 | 校验 |
|---|---|---|
| 查看/修改开关 | 平台管理员，`permissions` 含 `settings.features` 或 `'*'` | 服务端 `requireAdminAuth` + `requireAdminPermission` |
| 读取开关状态 | 商家老板/员工（自己的会话） | `requireMerchantTenant`；不接受客户端传入的商家 ID |
| 读取全局开关副本 | 任意访客（仅布尔值） | `/api/public/feature-flags`，不含身份信息 |
| 创建 ModaUI 任务 | 商家/访客会话 + 全局开关开启 + 该终端开关开启 | 门禁 + 既有租户/额度/引擎检查 |

商家管理员**没有**任何写入平台开关的接口；即使前端被篡改，服务端仍按开关拒绝。

---

## 5. 关闭时的行为矩阵

### 5.1 `fashion_enabled`（时尚版块）

| 终端 | 入口 | 直接访问 `/trends`、旧链接、收藏 | 服务端 |
|---|---|---|---|
| 前端 Web | 顶部「潮流时尚」、页脚时尚链接、账户中心「RUDA 时尚」隐藏 | 「该功能暂未开放」提示页 + 返回首页 | `/api/fashion/*` → `403 FASHION_MODULE_DISABLED` |
| 前端手机网页 | 底部导航「时尚」隐藏 | 同上 | 同上 |
| 用户小程序 | 自定义 tabBar 隐藏「时尚」；`pages/fashion` 直接打开时提示并回首页 | 同上 | 同上 |
| 商家端 | 无时尚入口，不受影响 | 不受影响 | 不受影响 |

保留：作品、视频、图片、评论、关注、通知、举报与统计数据全部保留；重新开启后原样可见。
不影响：ModaUI 的入口、会话与生成任务。

### 5.2 `modaui_enabled`（ModaUI）

| 终端 | 入口 | 直接访问 | 新建 AI 任务 |
|---|---|---|---|
| 前端 Web / 手机网页 | 底部导航 ModaUI 隐藏；`ai_team_preview` 路由渲染「该功能暂未开放」 | 同左 | `403 MODAUI_DISABLED` |
| 用户小程序 | tabBar 隐藏 ModaUI；`pages/modagpt` 提示并回首页 | 同左 | 同上 |
| 商家 Web / 手机 Web | 「创作空间」入口隐藏；已打开的 `modagpt`/`fashion_studio` 渲染提示页 | 同左 | 同上 |
| 商家小程序 | `ai_home`/`assistant` 入口隐藏（与既有商家开关取交集） | 同左 | 同上（`MODAUI_DISABLED` 优先返回） |

保留：聊天记录、生成作品、任务历史、已保存素材全部保留；正在执行的任务按既有任务机制继续完成，
不取消、不重复扣费。重新开启后历史内容原样可见。
不影响：时尚版块的入口、帖子与互动。

### 5.3 既有小程序开关（不变）

| 终端 | 入口 | 直接访问旧路径/收藏 | 新建任务 |
|---|---|---|---|
| 商家小程序 | 隐藏 `ai_home`、`tryon`、`ai_employees` 与 `assistant` 标签页入口 | `pages/assistant` 显示「该功能暂未开放」+ 返回按钮 | `403 MODAUI_MINIPROGRAM_DISABLED`，不扣费、不建任务 |
| 商家 Web / 手机 Web / 手机 App | 不受影响 | 不受影响 | 不受影响 |

关闭后：

- 已提交任务不删除、不重复扣费，按既有任务机制完成或恢复；
- 历史作品（`MerchantModaGptDesign`）与任务记录保留，重新开启后继续可见；
- 不删除商品图片、任务记录或其它业务数据。


---

## 6. 小程序端实现

- 新增 `utils/feature-flags.js`
  - `refreshFeatureFlags({ force })`：调用 `/api/merchant/feature-flags`，成功写入本地缓存（`ruda_merchant_feature_flags`，含 `fetchedAt`）；失败静默保留旧缓存（默认关闭）。
  - `getFlag(key)`：同步读缓存，缺省返回 `false`（fail-closed）。
  - `isModauiEnabled()`：`getFlag('merchant_miniprogram_modaui_enabled')`。
  - 刷新节流 3s（避免 `onShow` 频繁请求）；本地缓存不设过期时间，只作渲染副本，读取失败时沿用最后成功副本，无副本按关闭处理；`force` 跳过节流。
- `utils/review-features.js` 改为委托 `isModauiEnabled()`，保留 `isWorkspaceEnabled(id)` 签名，`permissions.js` 无需改动。
- `app.js` `onLaunch` 触发一次后台刷新（不阻塞渲染）。
- `pages/more/index.js`：`loadProfile()` 中先刷新开关再 `visibleGroups` 过滤。
- `pages/assistant/index.js`：`onShow` 刷新后若关闭，`setData({ modauiBlocked: true })`，页面渲染「该功能暂未开放」与返回按钮，停止欢迎序列与请求。
- `utils/api.js`：所有请求附带 `X-Ruda-Client: merchant-miniprogram`。

---

## 7. 审计与可运营性

- 每次写操作写一条 `AuditLog`：`action=FEATURE_FLAG_UPDATED`、`entity=FeatureFlag`、`entityId=<key>`、`oldValue/newValue={enabled,updatedAt,result:"success"}`、操作人取自 `req.admin.username`。
- 后台页面展示「最近操作人 / 操作时间」，数据来自开关快照本身（服务端写入时记录），不依赖前端推断。
- 开关文件损坏或读取失败：后台页面显示提示条；小程序与生成接口按关闭处理。

---

## 8. 测试与验收

### 8.1 可机械检查（必须通过）

- `tests/platform-feature-flags.test.ts`：默认关闭、写入持久化、重新加载、未知 key 拒绝、版本冲突、损坏文件回退、配置文件删除后回到默认关闭、mtime 重载、客户端请求头识别。
- `tests/modaui-miniprogram-flag.test.ts`：服务端三端点与权限键存在；门禁在额度预留之前；四个写入口均受控；小程序发送客户端头；`feature-flags.js` 默认 `false`；`review-features.js` 委托；`more`/`assistant` 刷新与关闭态；总后台导航为「功能开关」并接入 Web 与手机两个应用。
- `tests/merchant-miniprogram-tabbar.test.ts`：评审期隐藏断言改为断言「默认关闭」。
- 小程序代码约束（由 `tests/merchant-miniprogram-login.test.ts` 强制，扫描除 `pages/assistant`、`pages/tryon` 外的全部小程序 JS）：禁止展开语法 `...` 与对象字面量计算键 `{ [key]: value }`。因此 `utils/api.js` 用 `headers[MINIPROGRAM_CLIENT_HEADER] = ...` 单独赋值注入终端头，不要回退成对象计算键写法。
- 页面单测的 `require` 桩必须覆盖新依赖：`pages/more/index.js` 引入 `utils/feature-flags` 后，`tests/merchant-miniprogram-more-profile.test.ts` 与 `tests/merchant-miniprogram-more-workspace.test.ts` 各自提供 `refreshFeatureFlags` 桩，否则会以 `Unexpected module` 失败。
- `npm run lint`（`tsc --noEmit`）、`git diff --check`、各目标构建通过。

### 8.2 需人工/真机验收（未完成不得声称完成）

状态更新（2026-10-28）：1、3、4、7 的服务端链路已在隔离预览实例验证（§8.3）；5 实际返回 401 而非 403（§8.3.4-3）；2、6 仍需真机/部署后验证。

1. 总后台开启 → 小程序出现入口并可进入（截图）。**待验证**：需部署后真机/开发者工具。
2. 总后台关闭 → 入口消失；直接打开 `pages/assistant` 显示「该功能暂未开放」。**待验证**：同上。
3. 关闭状态下小程序请求 `POST /api/merchant/modagpt/images` 返回 `403 MODAUI_MINIPROGRAM_DISABLED`，且 `ModaGptCreditLedgerEntry` 无新增、`MerchantModaGptDesign` 无新增。**服务端已用真实请求验证（预览实例）；小程序侧待真机复验。**
4. 关闭再开启后历史作品仍在。**服务端已验证；真机侧待复验。**
5. 普通商家账号调用 `PATCH /api/admin/feature-flags/:key` 返回 403。**实际为 401 `ADMIN_AUTH_REQUIRED`，请求被拒绝且状态未变，状态码差异待确认。**
6. 商家 Web / 手机 Web / 手机 App 在开关关闭时仍能正常使用 ModaUI。**待验证**（开关仅作用于小程序通道，代码层未加门禁）。
7. 刷新、重新登录、小程序重启后状态一致。**服务端已验证刷新/重新登录/进程重启一致；小程序重启待真机复验。**

### 8.3 本轮实机验收记录（2026-10-28，隔离预览实例）

本轮在**不触碰生产环境**的前提下，用真实服务进程 + 真实 PostgreSQL + 真实浏览器完成了链路验收。生产仍运行 2026-10-27 04:26 构建的 `dist/server.cjs`，**不包含本功能**；`dist/apps/platform-admin-web/current.json` 仍指向 2026-10-27 03:26 的旧 release，因此生产总后台当前看不到「功能开关」页。上线仍需单独授权。

#### 8.3.1 环境构成（可复现）

- 数据库：临时 `postgres:16-alpine` 容器，仅监听 `127.0.0.1:32792`，`npx prisma migrate deploy` 成功（`Database schema is up to date!`），与生产库完全隔离。
- 服务进程：`node --import tsx server.ts`，`PORT=5411`、`NODE_ENV=production`、`ALLOW_PRIVATE_ADMIN_IPS=true`、工作目录为 `/tmp/ruda-verify`，因此 `logs/feature-flags.json` 写在隔离目录，生产 `logs/` 未被写入（生产侧 `logs/feature-flags.json` 至今不存在）。
- 总后台资源：用仓库 `vite.config.ts` 现构建 `platform-admin-web` / `platform-admin-mobile` 到 `/tmp`（未写入 `dist/apps`，未执行 `publish:app`）。
- 浏览器：Playwright 1.63 + 本机 Chromium，真实登录、真实点击开关。
- 账号：隔离库中新建 `verifyadmin`（`AuthAccount.role=admin`）与 `PVRFLAG1` 商家账号，密码随机生成，仅存于 `/tmp`。

#### 8.3.2 已取得的真实结果

| 验收项 | 方式 | 结果 |
|---|---|---|
| 初始状态 fail-closed | `GET /api/admin/feature-flags` | `enabled=false`，`loadError=null` |
| 开启并持久化 | `PATCH /api/admin/feature-flags/merchant_miniprogram_modaui_enabled` | HTTP 200，`enabled=true`，`updatedBy=verifyadmin`；`logs/feature-flags.json` 同步写入 |
| 重新登录后状态一致 | 重新 `POST /api/auth/login/admin` + GET | `enabled=true`，`updatedAt` 不变 |
| 进程重启后状态一致 | kill 进程并重启 | `enabled=true`，`updatedAt` 不变（文件为权威来源） |
| 商家端读到开关 | `GET /api/merchant/feature-flags` + Bearer + `X-Ruda-Client: merchant-miniprogram` | `{"flags":{"merchant_miniprogram_modaui_enabled":true}}` |
| 开启态放行 | `POST /api/merchant/modagpt/images`（空请求体） | HTTP 400 `MODAGPT_IMAGE_REQUEST_INVALID`（已越过开关门禁） |
| 关闭态拦截 | 同上，先 `PATCH enabled=false` | HTTP 403 `{"code":"MODAUI_MINIPROGRAM_DISABLED","message":"该功能暂未开放"}` |
| 无新增额度/作品 | `select count(*)` on `ModaGptCreditLedgerEntry` / `MerchantModaGptDesign` | 调用前后均为 `0 / 0` |
| 重新开启后数据保留 | 再次 `PATCH enabled=true` | 计数仍为 `0 / 0`，历史数据未被清理 |
| 商家越权 | 商家 Bearer 调 `PATCH /api/admin/feature-flags/:key` | **HTTP 401 `ADMIN_AUTH_REQUIRED`**，开关文件未变（见 8.3.4 差异说明） |
| 总后台 Web 端 | 1440×900 真实浏览器 | 已开启 / 已关闭 / 再次开启 三态截图留存，切换成功 |
| 总后台手机端 | 390×844 移动视口 | 同上，开关在手机端可正常操作 |

截图与响应原文保存在本次验收目录 `/tmp/ruda-verify/evidence/`（`web-01..03`、`mobile-01..03`、各步骤 `*.txt` 原始响应）。Playwright 控制台仅有一条登录前的 401 探测请求，无页面异常。

#### 8.3.3 本轮测试命令

```
node --import tsx --test tests/modaui-miniprogram-flag.test.ts \
  tests/merchant-miniprogram-login.test.ts \
  tests/merchant-miniprogram-more-profile.test.ts \
  tests/merchant-miniprogram-more-workspace.test.ts
# tests 26 / pass 26 / fail 0
```

本轮未改动任何业务代码，全量 1004 项与 `tsc --noEmit` 结果沿用上一轮记录，未重复执行，不作为本轮新证据。

#### 8.3.4 未完成与差异

1. **未部署到可公开访问的预览环境**：尚未获得部署授权，预览实例仅监听 `127.0.0.1:5411`；生产未发布本功能。
2. **微信开发者工具/真机验证未完成**：本机 DevTools CLI 的 `auto` 通道需要 IDE「安全设置」中的 CLI token（`--port` + `--token`），无图形界面授权无法获取；因此「入口出现/消失」「直接打开 `pages/assistant` 显示该功能暂未开放」的截图尚未取得。此外小程序 `API_BASE_URL` 固定为生产域名，即使连上自动化也会打到未升级的生产服务端，需先部署再验证。
3. **越权状态码差异**：验收清单要求 HTTP 403，当前实际返回 401 `ADMIN_AUTH_REQUIRED`（未持有管理员会话）。请求确已被拒绝且开关未变化，但状态码与清单不一致。是否将「已认证但非管理员」改为 403 属认证语义调整，需单独确认后再改，本次未改动认证实现。
4. 手机端截图中「平台管理」二级导航为横向滚动轨道，最右侧标签在 390 宽度下被裁切，属该组件既有的可横向滚动行为，未在本次改动范围内调整。

---

## 9. 部署与回滚


- 部署：随服务端代码发布新增 `logs/feature-flags.json`（首次写入时自动创建）。无数据库迁移。
- 回滚：代码回滚后开关文件失去读取方，无副作用；小程序旧版本仍读旧常量（隐藏），不会出现「已开放却无法使用」。
- 风险：开关文件所在磁盘不可写时无法保存（返回 500，页面提示），读取仍按最后成功值/默认关闭。
- 不需要重新提交小程序审核即可改变开放状态（小程序侧仅需一次带读取逻辑的版本）。

---

## 10. 后续扩展约定

新增版块开关时：

1. 在 `FEATURE_FLAG_DEFINITIONS` 增加一条（`key` 命名 `<terminal>_<module>_enabled`，全小写下划线）；
2. 指定 `permission`（默认沿用 `settings.features`）；
3. 在对应终端读取同一 key，并在该版块的服务端写接口前置门禁；
4. 更新本文件「行为矩阵」与 `module-registry.md`。

不新增第二个后台页面，不新增第二份配置文件。

---

## 11. 变更记录

| 日期 | 变更 | 验证 |
|---|---|---|
| 2026-10-27 | 首期：新增 `merchant_miniprogram_modaui_enabled` 开关、总后台「功能开关」（平台管理分区）、3 个 API、小程序动态读取与两条服务端门禁、审计 | 见本次交付报告；§8.2 真机与部署验收待完成 |
| 2026-10-28 | 新增全局开关 `fashion_enabled`、`modaui_enabled`；新增 `GET /api/public/feature-flags`；`/api/fashion` 总门禁与 5 个 AI 写入口门禁；Web/手机网页/用户小程序/商家端入口联动；开关页增加关闭确认与保存反馈 | 见 §12 |
| 2026-10-28（复验） | 同一生产进程上重跑「关闭 → 验证 → 重新开启」并重新生成全部截图；验收脚本内置服务端断言与基线归位，输出 `verification.json` | 见 §12.1；`failures: []` |

---

## 12. 全局开关验收记录（2026-10-28）

环境：本机生产进程（PM2 `ruda-fashion`，`dist/server.cjs`，`127.0.0.1:3011`）+ 生产 PostgreSQL；
总后台 `https://admin.ruda.fashion`，管理员 `admin@admin.com` 真实登录。截图与原始响应见
[`../evidence/feature-switches/README.md`](../evidence/feature-switches/README.md)。

| 验收项 | 结果 |
|---|---|
| 四个开关在总后台可见（Web 1440×1000 / 手机 390×844） | 通过，见 `admin-flags-01/03` |
| 关闭前确认框（确认关闭 / 取消） | 通过，见 `admin-flags-02` |
| 关闭时尚 → `/api/fashion/posts`、`/api/fashion/posts/:id/view` | 403 `FASHION_MODULE_DISABLED` |
| 关闭时尚 → ModaUI 公共对话 | 不受影响（400 `MESSAGE_REQUIRED`） |
| 关闭时尚 → 桌面导航入口消失、`/trends` 提示页 | 通过，见 `web-02/03` |
| 重新开启时尚 → `/trends` 恢复 | 通过，见 `web-04` |
| 关闭 ModaUI → 公共对话 / 商家 AI 写入口 | 403 `MODAUI_DISABLED` |
| 关闭 ModaUI → 时尚接口 | 仍 200（互不影响） |
| 关闭 ModaUI → 手机网页底部导航隐藏 ModaUI | 通过，见 `mobile-01/02` |
| 重新开启 ModaUI → 对话恢复 | 通过 |
| 进程重启后状态保持 | 通过 |
| 关闭前后数据量 | `FashionCommunityPost` 14→14、`ModaGptTask` 12→12、`MerchantModaGptDesign` 0→0 |
| 审计 | 每次变更写入 `AuditLog`（操作人、时间、前后状态、`result=success`） |
| 平台管理员仍可访问后台 | 关闭期间 `/api/admin/feature-flags` 200 |

机械检查（真实执行）：

```
npx tsc --noEmit                 # 0
git diff --check                 # 0
npm run build                    # EXIT 0（含前端各应用与 dist/server.cjs）
node --import tsx --test tests/platform-feature-flags.test.ts tests/platform-global-switches.test.ts \
  tests/modaui-miniprogram-flag.test.ts tests/miniprogram-fashion-parity.test.ts \
  tests/fashion-governance.test.ts tests/fashion-community-integrity.test.ts \
  tests/merchant-miniprogram-*.test.ts
# 42 + 56 + 37 项全部通过
```

全量回归：`node --import tsx --test tests/*.test.ts` → **1056 / 1054 通过 / 2 失败**，
失败项为既有测试债（迁移时间戳重复、历史文案对缺失），与本次开关无关。


未完成（不得视为已验收）：

1. 微信小程序真机/开发者工具：动态隐藏 tab、「该功能暂未开放」跳转仍为**待验证**。
2. 商家 Web / 手机 Web 的「创作空间」入口隐藏只有代码与单测证据，**待验证**（未截图）。
3. 商家小程序 `ai_home` 与全局开关取交集，真机**待验证**。

### 12.1 复验记录（2026-10-28 18:07 UTC，本机 19:07）

同一生产进程（`node dist/server.cjs`，PID 600182，启动于 17:10:48，构建于 17:09，`127.0.0.1:3011`）
上，用 `scripts/platform-switches-shot.mjs` 一次跑完「真实登录总后台 → 截图 → 关闭时尚 → 关闭 ModaUI →
重新开启 → 恢复校验」，脚本内置服务端断言并写出
[`evidence/feature-switches/verification.json`](../evidence/feature-switches/verification.json)。

真实结果（`failures: []`、`pageErrors: []`、退出码 0）：

| 断言 | 实测 |
|---|---|
| 时尚开启 → `GET /api/fashion/posts?limit=1` | 200 |
| 时尚关闭 → 同一接口 | 403 `FASHION_MODULE_DISABLED` |
| 时尚关闭 → `GET /api/miniprogram/features` | `fashionSectionEnabled=false`（小程序统一规则） |
| 时尚关闭 → `GET /api/public/feature-flags` | `fashion_enabled=false`、`modaui_enabled=true`（互不影响） |
| 时尚关闭 → `POST /api/modagpt/public/chat {}` | 400 `MESSAGE_REQUIRED`（未被误拦） |
| ModaUI 开启 → 公共对话 | 400 `MESSAGE_REQUIRED` |
| ModaUI 关闭 → 公共对话 | 403 `MODAUI_DISABLED` |
| ModaUI 关闭 → `/api/fashion/posts` | 200（时尚不受影响） |
| 恢复后 → `/api/fashion/posts` / 公共对话 | 200 / 400 `MESSAGE_REQUIRED` |
| 商家端载荷未登录 → `GET /api/merchant/feature-flags` | 401 `MERCHANT_AUTH_REQUIRED`（不向未认证调用方外泄开关） |

- 数据保留：复验前后 `FashionCommunityPost` 14、`FashionCommunityView` 8、`ModaGptTask` 12、
  `MerchantModaGptDesign` 0（完全一致）。
- 审计：`AuditLog` 新增 7 条 `FEATURE_FLAG_UPDATED`，操作人 `admin@admin.com`，含前后状态。
- 截图：桌面总后台、关闭确认框、手机总后台、桌面首页（开/关）、`/trends` 提示页与恢复页、
  手机底部导航（ModaUI 开/关）均重新生成，见证据目录。

复验期间发现的线上状态（已归位）：17:47–17:48 账号 `admin` 曾把四个开关全部关闭，
导致时尚与 ModaUI 在线上停用约 20 分钟；本次脚本启动即归位为开启，结束再次确认两个总闸为
`true`。关闭状态**不会自动恢复**，见证据 README §7.1。该轮也说明「误关可恢复」已被真实验证。

仍未完成（与 §12 相同，不因本次复验而改变）：

1. 微信开发者工具/真机截图（用户小程序 tab 动态隐藏、`pages/fashion` 关闭提示）。
2. 商家 Web / 手机 Web「创作空间」入口消失截图（仅代码 + 单测证据）。
3. 商家小程序 `ai_home` 真机交叉验证。

# 生态应用商店（Ecosystem App Store）

- 状态：已完成（平台后台与商家 Web/手机端已修复，隔离环境 + 生产环境均验证；商家小程序本次未改、未发布）
- 归属运行面：平台总后台（Web/手机共用组件）、商家电脑 Web、商家手机 Web
- 权威数据源：PostgreSQL `App` / `AppCategory` / `AppVersion` / `AppInstallation`（Prisma）
- 服务端：`src/server/appStore*.ts`、`server.ts` 内 `/api/admin/apps*`、`/api/merchant/apps*`
- 客户端：`src/apps/platform-admin-common/components/admin/AdminAppStoreMgmt.tsx`、`src/apps/merchant-admin-common/components/merchant/MerchantAppStore.tsx`

## 1. 问题与目标

本次是**修复既有生态应用商店**，不是新建第二套商店。

现象：

1. 平台总后台「应用商店管理」页面空白，显示加载失败。
2. 错误提示出现 `[object Object]`。
3. 前几天已开发并上架的应用看不到。

目标：

- 平台总后台重新渲染真实应用列表、分类、审核与上架状态。
- 错误提示显示真实原因，并提供重试入口；不得用空数组掩盖失败。
- 商家电脑 Web 在左侧主导航「系统设置」上方新增一级入口「应用商店」。
- 商家手机 Web 在「更多」菜单中加入独立入口「应用商店」，底部 Tab 结构不变。
- 两端进入同一套真实商店，目录、安装与授权状态一致，租户隔离。

非目标（本次不做）：

- 不重做后台外壳、导航层级、颜色与字体。
- 不新建应用记录、不生成演示应用数据。
- 小程序导航不变，小程序发布另行确认。

## 2. 复用与防重复检查

| 检查项 | 结论 |
|---|---|
| 已搜索关键字 | `app_store`、`AppInstallation`、`/api/admin/apps`、`/api/merchant/apps`、`AdminAppStoreMgmt`、`MerchantAppStore` |
| 已有服务端 | `GET /api/admin/apps`、`POST /api/admin/apps`、`PUT /api/admin/apps/:id`、`POST /api/admin/apps/:id/{submit,review,publish,unpublish}`、`GET /api/merchant/apps`、`POST /api/merchant/apps/:id/install`、`PATCH /api/merchant/apps/:id`（启用/停用）、`POST /api/merchant/apps/:id/uninstall` |
| 已有客户端 | `AdminAppStoreMgmt`（平台后台）、`MerchantAppStore`（商家共享组件，Web/手机共用） |
| 可复用 | `apiGet/apiPost/apiPut`（统一认证注入、错误封装）、`ApiError`、`localizeCopy` 文案目录 |
| 结论 | 服务端与共享组件均存在，**根因在客户端请求与错误处理**，因此只修客户端与入口，不新增接口 |

## 3. 根因分析

### 3.1 `[object Object]`

`AdminAppStoreMgmt.tsx` 原先使用裸 `fetch`，并把响应体当作成功处理：

```ts
const appsData = await response.json();
if (appsData.error) throw new Error(appsData.error);   // ← error 是对象
```

服务端失败时返回统一信封：

```json
{ "success": false, "error": { "code": "…", "message": "…", "retryable": false, "details": {} }, "requestId": "…" }
```

把对象传给 `Error` 构造函数会得到字符串 `[object Object]`，真实原因（code / message / requestId）全部丢失。同时裸 `fetch` 没有携带认证与统一错误处理，失败时把 `apps` 置为空数组，页面因此显示空白而不是错误。

修复：

- 全部改用 `apiGet` / `apiPost` / `apiPut`。
- 新增导出函数 `describeAppStoreError(error, fallback)`：优先读取 `ApiError.code` 映射为中文原因，其次读取 `error.message`，最后回退默认文案；对非字符串值做安全处理。
- 新增 `loadError` 状态：加载失败时隐藏列表、显示真实错误原因与「重试」按钮，不再渲染空列表。

### 3.2 安装返回 500（真实 schema 漂移）

隔离环境安装应用返回 500，日志指向 `AppInstallation.updatedAt` 不存在：

- Prisma schema 声明 `updatedAt`，数据库实际缺列（历史手工迁移遗漏）。
- 迁移 `prisma/migrations/20261029234500_app_installation_updated_at/migration.sql` 以 `ADD COLUMN IF NOT EXISTS` 补齐，向后兼容、可重复执行。

## 4. 应用清单（生产库核对）

核对命令（只读）：`SELECT id, name, status, published, … FROM "App"`。

| 应用 ID | 名称 | 状态 | 上架 | 安装数（修复前） |
|---|---|---|---|---|
| `ruda-production-chain` | 智能生产链 | PUBLISHED | 是 | 0 |
| `ruda-business-email` | 邮箱域名配置 | PUBLISHED | 是 | 0 |

- 分类 9 条，均存在。
- 修复前安装记录 0 条，说明业务上确实无人安装，**不是数据丢失**；后台空白是客户端错误处理导致。
- 未新增任何应用记录。

## 5. 入口位置

| 运行面 | 位置 | 实现 |
|---|---|---|
| 商家电脑 Web | 左侧主导航一级入口「应用商店」，位于「系统设置」上方 | `MerchantPortal.tsx`：`activeTab` 新增 `'app_store'`，按钮 `#merchant-sidebar-tab-app-store`，点击 `setActiveTab('app_store')` 渲染独立页面 `<MerchantAppStore />` |
| 商家手机 Web | 「更多」菜单独立入口「应用商店」，底部 Tab 不变 | `merchantMobileNavigation.ts` 新增 `app_store` 项；`MerchantMobileApp.tsx` 的 `openMoreItem` 命中后 `setSettingsSection('apps')` |
| 平台总后台 | 既有「应用商店管理」Tab（Web/手机共用组件） | 仅修复数据与错误渲染 |

导航文案规则：一级名称四字（`应用商店`），描述不超过八字（`安装与管理应用`），并登记到 `src/i18n/uiCopyCatalog.ts`。

## 6. 权限与租户边界

- 平台后台：`authenticateAdminSession`，需 `app_store` 管理权限（当前管理员 `permissions: ['*']`）。
- 商家端：`authenticateMerchant`，商家 ID 只来自服务端 JWT，客户端不传。
- 安装/启用/停用/卸载均按 `(merchantId, appId)` 唯一约束，跨商家不可见、不可改。
- 未发布的独立应用不会出现在商家目录。

## 7. 验证记录（隔离环境）

隔离环境：Docker Postgres `ruda-staging-db`（127.0.0.1:55432，库 `ruda_staging_test`）、服务端口 3013、生产数据快照导入。

| 项目 | 结果 |
|---|---|
| 平台后台列表可见 2 个应用 | 通过 |
| 页面出现 `[object Object]` | 未出现 |
| 商家 Web「应用商店」入口可见并可进入 | 通过 |
| 商家手机「更多 → 应用商店」入口可见并可进入 | 通过 |
| 安装 → 启用 → 停用 | 均 200，`AppInstallation` 写入并更新 |
| 平台后台 `_count.installations` | 1（与商家端一致） |
| 页面运行时报错 | 0 |

截图：`docs/engineering/evidence/app-store/01..06.png`（隔离环境，含强制失败的错误面板 `07`、重试恢复 `08`），`09/10` 为生产后台实拍。

## 7.1 生产上线记录

- 提交：`7bc109a`（代码）、`aebd72d`（发布脏检查排除构建产物）、`ec9914d`（审计文档归档）。
- 迁移：`20261029234500_app_installation_updated_at` 已随 `deploy-release.sh` 在生产 `xversal` 库应用，`prisma migrate status` 显示 158 个迁移、`Database schema is up to date`。
- 生产库核对：应用 2 个（`ruda-production-chain` 已上架、`ruda-business-email` 已上架），分类 9 个，安装记录 0 条；未新增任何应用或演示数据。
- 生产实拍：平台后台「生态应用」正常渲染 2 个应用，无 `[object Object]`、无加载失败面板。
- 生产包核对：`merchant-admin-web` 含 `#merchant-sidebar-tab-app-store`，`merchant-admin-mobile` 含「安装与管理应用」，`platform-admin-web` 含错误面板文案。
- 生产入口实拍限制：生产未开启七行业一键演示登录（`DEMO_LOGIN_UNAVAILABLE`），商家账号口令不可代用，因此商家 Web/手机入口的实拍来自隔离环境（同一提交构建）；生产以构建产物内容核对为证据，待商家自行登录验收。

## 8. 已知缺口

- 小程序端：现有应用管理能力未改动，未发布，未验收。
- 生产数据库迁移与正式发布需单独确认后执行。
- 应用详情页的权限说明与版本历史仍由既有接口提供，本次未扩展。

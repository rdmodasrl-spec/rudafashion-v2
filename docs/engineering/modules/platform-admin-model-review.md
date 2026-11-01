# 平台后台：商品模型审核与管理员权限

> 项目：`P2-STORE-TEMPLATES` 的配套平台能力（不是 P1-ADMIN-UI 的行业升级）。
> 关联文档：[merchant-premium-3d-library.md](./merchant-premium-3d-library.md)（模型链路与审核凭证规则）、
> [merchant-21-storefront-templates.md](./merchant-21-storefront-templates.md)（项目二主文档）。

## 1. 问题与目标

商家上传的 3D 商品模型必须经平台审核才能对买家公开。第四轮已把「公开」的判定条件从
`reviewStatus === 'approved'` 升级为「approved + 合法审核凭证 `modelReview`」，但存在两个运营缺口：

1. **没有任何界面能完成审核**：只有 `PUT /api/admin/products/:id/media/:mediaId/model-review` 接口，
   平台运营必须手写 HTTP 请求才能批准一个模型。
2. **权限不可观测**：`AuthAccount.permissions` 只有数据库字段，没有注册表、没有分配界面。
   管理员登录时 `permissions` 为空会被签成 `['*']`（隐式超级管理员），
   因此「谁有 `products.review`」这个问题在现有系统里无法回答，也无法最小化授权。

目标：

- 平台运营在后台能看到「待审核模型」清单，逐个预览并批准/驳回（含驳回原因）。
- 平台运营能看到管理员账号及其权限，并按最小权限原则调整（含 `products.review`）。
- 权限键集中注册，代码与界面共用一份清单，不再到处散落字符串。

非目标（本轮不做）：

- 不改「空权限 = `*`」的既有语义（改动会让现有管理员瞬间失权，属破坏性变更，见 §7）。
- 不做管理员账号的创建/删除/密码重置。
- 不做商家侧模型上传 UI 的改造（已有 `Model3DUploader`）。
- 不做模型二进制的内容安全扫描（另有 GLB 结构校验，见 §2）。

## 2. 复用现状与查重结论

| 检索项 | 结论 |
| --- | --- |
| 现有模型审核入口 | `PUT /api/admin/products/:id/media/:mediaId/model-review`（第四轮新增），**直接复用，不新增第二个批准接口** |
| 现有商品审核 | `PUT /api/admin/products/:id/review`（改 `lifecycleStatus` / 推荐位），与模型审核职责不同，不合并 |
| 权限校验 | `requireAdminAuth` + `requireAdminPermission` + `hasAdminPermission`，**复用**，不新建授权中间件 |
| 权限注册表 | 全库检索 `PERMISSION_GROUPS` / `AVAILABLE_PERMISSIONS` / `permissionRegistry` **均无**，需新建（本轮新建 `src/shared/adminPermissions.ts`） |
| 管理员账号管理页 | 不存在。`accounts.manage` 权限只用于买家/商家身份合并审核，不涉及管理员 |
| 平台后台导航 | `adminNavigation.ts` 的 `ADMIN_NAV_GROUPS`，新增两个四字导航项（**模型审核**、**权限管理**） |
| 审计 | `logAudit` / `logAuditAndWait`，**复用**；权限变更必须留痕 |
| GLB 校验 | `src/server/glbValidation.ts`，上传时已校验结构；审核页只消费结果，不重复校验 |

因此：**不新建第二套审核系统，不新建第二套权限系统**，只补「权限目录 + 两个受控接口 + 两个页面」。

## 3. 权限目录（单一事实来源）

`src/shared/adminPermissions.ts` 导出：

```ts
export const ADMIN_PERMISSION_GROUPS: Array<{
  key: string;            // 分组键
  label: string;          // 中文分组名
  permissions: Array<{ key: string; label: string; description: string; risk: 'normal' | 'sensitive' }>;
}>;

export const ADMIN_PERMISSIONS: string[];          // 全部合法权限键
export function isKnownAdminPermission(key: string): boolean;
export const ADMIN_SUPER_PERMISSION = '*';
```

约束：

- 权限键集合必须覆盖 `server.ts` 中所有 `requireAdminPermission('...')` / `requireAnyAdminPermission([...])` 的参数。
  `tests/admin-permission-catalog.test.ts` 会扫描 `server.ts` 并断言两者一致——新增接口用了未注册的权限键会直接测试失败。
- `products.review` 标为 `sensitive`（能改变买家可见内容）。
- 目录不含 `*`；`*` 只在服务端语义上作为超级权限存在，界面以「超级管理员」标签展示。

## 4. API 契约

所有接口：`requireAdminAuth`（独立 admin JWT，商家/买家 token 无法通过）。

### 4.1 `GET /api/admin/model-reviews`

- 权限：`products.review`
- 查询：`?status=pending|approved|rejected|all`（默认 `pending`）、`?limit=`（默认 50，上限 200）
- 返回：`{ success, items: [{ productId, productName, styleNo, merchantId, merchantName, mediaId, modelUrl, reviewStatus, credentialValid, uploadedAt, review?: { reviewerId, reviewerUsername, reviewedAt, decision, reason } }], counts: { pending, approved, rejected } }`
- 数据来源：扫描 `Product.media` JSON 中 `type === 'model'` 的条目；**只读**。
- 授权边界：平台管理员可见全部商家（平台级视图）；不向买家/商家暴露。

### 4.2 `PUT /api/admin/products/:id/media/:mediaId/model-review`

第四轮已存在，本轮不改契约，只被 UI 调用。

- 权限：`products.review`
- 入参：`{ decision: 'approved' | 'rejected', reason?: string }`；`rejected` 必须给原因。
- 凭证：`reviewerId` 取 `req.admin.accountId`（数据库主键），缺失 403 `MODEL_REVIEW_ADMIN_IDENTITY_REQUIRED`。
- 事务：商品媒体更新 + `PRODUCT_MODEL_REVIEW` 审计同事务。

### 4.3 `GET /api/admin/accounts`

- 权限：`accounts.manage` 或 `*`
- 返回：`{ success, accounts: [{ id, username, email, permissions, isSuper, require2fa, lastLoginAt, updatedAt }] }`
- 只返回 `role = 'admin'` 的账号；不返回 `passwordHash`。

### 4.4 `PUT /api/admin/accounts/:id/permissions`

- 权限：`accounts.manage` 或 `*`
- 入参：`{ permissions: string[] }`
- 校验：每个键必须 `isKnownAdminPermission`，否则 400 `ADMIN_PERMISSION_UNKNOWN`；去重；上限 100 个。
- 防自锁：目标账号等于当前登录账号且新权限不含 `accounts.manage` / `*` 时返回 409 `ADMIN_PERMISSION_SELF_LOCKOUT`。
- 写入：`AuthAccount.permissions`（JSON 字符串），并 `logAuditAndWait(..., 'ADMIN_PERMISSION_UPDATE', 'AuthAccount', id, before, after)`。
- 副作用：`updatedAt` 变更会让该账号既有会话失效（`isAdminSessionCurrent`），需重新登录——这是有意的，确保新权限随新 token 生效。

## 5. 页面

### 5.1 模型审核（`modelReview`）

导航：业务管理 → **模型审核**（`adminNavigation.ts`，四字）。

- 顶部：状态筛选（待审核 / 已通过 / 已驳回 / 全部）+ 计数 + 刷新。
- 列表：商品名、款号、商家、媒体 ID、模型链接、上传/审核时间、审核人。
- 行内操作：`预览模型`（新窗口打开 GLB）、`通过`、`驳回`（弹出原因输入，必填）。
- 状态：加载、空状态（「暂无待审核模型」）、错误（显示真实错误码与重试按钮）。
- 无 `products.review` 权限时：页面显示「无权访问」并说明缺少的权限键，不渲染操作按钮（服务端仍会 403）。

### 5.2 权限管理（`permissionManager`）

导航：平台管理 → **权限管理**（`adminNavigation.ts`，四字）。

- 列表：管理员账号、邮箱、当前权限（chip，`*` 显示为「超级管理员」）、最近登录、2FA。
- 编辑：按分组勾选权限，保存后提示「权限已更新，该账号需重新登录生效」。
- 自我保护：编辑自己时，移除 `accounts.manage` 的选项禁用并给出原因。
- 明确展示「空权限 = 超级管理员」这一既有语义，避免运营误判。

## 6. 状态、错误与审计

| 场景 | 行为 |
| --- | --- |
| 无权限 | 服务端 403 `ADMIN_PERMISSION_REQUIRED`；UI 显示无权状态 |
| 未登录 / 会话过期 | 401 `ADMIN_AUTH_REQUIRED`；UI 提示重新登录 |
| 驳回未填原因 | 400 `MODEL_REVIEW_REASON_REQUIRED` |
| 模型媒体不存在 | 404 `MODEL_MEDIA_NOT_FOUND` |
| 权限键非法 | 400 `ADMIN_PERMISSION_UNKNOWN` |
| 自我移除管理权限 | 409 `ADMIN_PERMISSION_SELF_LOCKOUT` |
| 审核成功 | 200 + 审计 `PRODUCT_MODEL_REVIEW` |
| 权限变更成功 | 200 + 审计 `ADMIN_PERMISSION_UPDATE` |

## 7. 已知语义与风险（本轮不改，但必须记录）

管理员登录时：`permissions: adminPermissions.length ? adminPermissions : ['*']`（`server.ts` 管理员登录路由）。

即 **`permissions` 为空数组 = 隐式超级管理员**。生产 3 个 admin 账号当前都是 `[]`，
所以它们实际上拥有全部权限，包括 `products.review`。

风险：这是默认放行（fail-open）。若要改为默认拒绝，必须同时给现有管理员显式授权，
否则会瞬间锁死平台后台。本轮只做**可观测与可分配**，不改语义；改动需要单独评审 + 迁移方案。

## 8. 测试与验收

自动化：

- `tests/admin-permission-catalog.test.ts`：权限目录覆盖 `server.ts` 全部权限键；目录无 `*`；`products.review` 为 sensitive。
- `tests/platform-admin-model-review.test.ts`：两条新接口存在且带正确守卫；权限接口有自我锁死保护与审计；页面组件调用真实接口而非假数据。

人工（生产）：

1. 管理员登录平台后台 → 业务管理 → 模型审核。
2. 看到一个 `pending` 模型 → 通过。
3. 商家商品详情 API 立即出现该模型。
4. 驳回路径：驳回必须填原因；驳回后买家不可见。

## 9. 部署与验证记录（2026-11-01）

### 9.1 已部署

生产目录 `/www/wwwroot/ruda.fashion` 先快照（`backup/pre-p2-merge-20261101-025912` + 全量 tar + 数据库预发布备份），
再合并 `v2/main`，冲突按「P2 自有文件取 v2 / ModaUI 模型与新特性保留」处理。
`npx tsc --noEmit` ✅ ｜ `npm run test:unit` 1404 通过（仅 2 个 ModaUI 既有 WIP 失败，与本次无关）
｜ `npm run build` ✅ ｜ pm2 只重启 `ruda-fashion` ｜ `SMOKE_BASE_URL=https://modaui.com npm run smoke:post-deploy` ✅

新 release：`platform-admin-web 20261101021449902-f9a55763`、`platform-admin-mobile 20261101021451813-f1b87b4c`。
构建产物中确认包含 `/api/admin/model-reviews`、`驳回原因（必填）`、`权限管理`、`超级管理员` 等字符串。

### 9.2 接口实测（生产，签管理员会话后真实 HTTP）

| 验证 | 结果 |
| --- | --- |
| `GET /api/admin/model-reviews?status=all` | 200，counts `{pending:0, approved:4, rejected:0}`（当时 4 条均为脚本直写的 approved，`credentialValid:false`） |
| `GET /api/admin/accounts` | 200，3 个 admin，`isSuper:true`（`permissions: []`） |
| `PUT .../permissions` 传 `products.bogus` | 400 `ADMIN_PERMISSION_UNKNOWN`，库未变 |
| `PUT .../permissions` 移除自己的 `accounts.manage` | 409 `ADMIN_PERMISSION_SELF_LOCKOUT`，库未变 |

### 9.3 端到端闭环（生产，商品 `demo-industry-department-chain-retail-3`）

| 步骤 | 结果 |
| --- | --- |
| 审核前买家详情 | 无 model，响应无 `.glb` |
| 管理员批准 | 200，买家详情立刻返回模型 + 凭证 `{reviewerId: b65541e4-…（数据库主键）, reviewerUsername: 'admin', reviewedAt, decision: 'approved', reason}` |
| 管理员驳回（写原因） | 200，买家详情重新无 model、无 `.glb` |
| 审计 | `PRODUCT_MODEL_REVIEW` 两条，`newValue` 含 `mediaId`/`decision`/`reason`/`reviewerId` |

> 说明：`demo-industry-bags-wholesale-1/2/3` 三个演示商品在公开接口本就不可见（`PRODUCT_NOT_FOUND`），
> 因此端到端验证改用可公开访问的 `demo-industry-department-chain-retail-3`。

### 9.4 权限分配路径（隔离库 `ruda_p2_3d`，6/6 通过）

`scripts/p2/3d-admin-permission-path.mjs`：

1. 授予 `products.review` → 200 + 审计（delta=1）+ `requiresRelogin:true`
2. 被授权者用新 token 读模型审核清单 → 200
3. 收回后 → 403 `ADMIN_PERMISSION_REQUIRED`
4. 自我移除 `accounts.manage` → 409，库未变
5. 未登记权限键 → 400
6. 通配符 `*` 无法通过接口下发 → 400

### 9.5 页面取证（生产真实浏览器，Chromium）

| 页面 | 1440 | 390 |
| --- | --- | --- |
| 业务管理 → 模型审核 | ✅ 渲染、状态筛选、空状态与计数正确，无 console 错误 | ✅ 渲染，移动端导航包含「模型审核」 |
| 平台管理 → 权限管理 | ✅ 3 个管理员、按分组勾选、超级管理员说明、敏感标记 | ✅ 渲染正常 |

截图（随仓库提交）：[model-review-pending-1440.png](../evidence/p2-admin-model-review/model-review-pending-1440.png)、
[model-review-pending-390.png](../evidence/p2-admin-model-review/model-review-pending-390.png)、
[permission-manager-1440.png](../evidence/p2-admin-model-review/permission-manager-1440.png)、
[permission-manager-390.png](../evidence/p2-admin-model-review/permission-manager-390.png)。
取证时间 2026-11-01，截图内容为真实生产页面（待审核 2 · 已通过 0 · 已驳回 2）。

### 9.6 仍未完成

- 生产 4 条演示模型已按授权回滚：2 条改为 `pending`（脚本 `3d-legacy-model-review.mjs --apply`，
  原 media 备份在 `/tmp/p2-legacy-model-rollback-*.json`），2 条保留验收时的 `rejected` 决定（含驳回原因与凭证）。
  但这 4 条的商品都不是真实商家上传产物，真实商家 pending 流程仍需商家端上传闭环。
- 权限默认放行语义（§7）未改。
- 权限分配只在隔离库做了写入验证；生产 3 个账号仍为超级管理员，未做降权（会改变真实运营权限，需产品确认）。

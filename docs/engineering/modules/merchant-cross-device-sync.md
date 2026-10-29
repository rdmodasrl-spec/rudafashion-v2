# 模块规格：商家后台跨端数据一致性

- Module ID：`merchant-cross-device-sync`
- 模块状态：部分完成
- 文档阶段：开发中
- 日期：2026-10-26
- 对应负责人/团队（如适用）：RUDA 商家端与平台工程

## 1. 背景与问题

同一商家通过电脑网页端（`merchant-admin-web`）、手机网页端（`merchant-admin-mobile`）和商家微信小程序（`merchant-miniprogram`）操作商品、库存、订单、客户和店铺设置时，曾出现一端保存后另一端仍显示旧值、商品详情/编辑无法读取、部分字段保存后不生效，以及接口局部失败导致整批数据不刷新等问题。该问题属于业务数据一致性 P0，不得用“增加刷新按钮”或“整页定时刷新”冒充修复。

本规格先完成事实审计，再修复权威数据源、身份/租户隔离、服务端写回、缓存失效、事件/轮询补偿和并发冲突处理，最后给出可复现的三端验收步骤。真实跨端点击验收需要有效测试商家账号与可用环境，未执行前不得标记为完成。

## 2. 目标与非目标

### 目标

- 三端只使用现有 RUDA 服务端与 PostgreSQL/Prisma 作为商家业务数据唯一权威来源。
- 同一商家的三端使用同一认证体系、同一 `merchantId` 来源、同一员工权限与服务端租户校验。
- 商品、库存、订单、客户、店铺设置、媒体和发布状态的实际写入必须持久化，并在其他端通过事件或受控刷新获得服务端最终结果。
- 修复已确认的 API 缺失、字段静默丢弃、缓存跨请求复用、整批失败和并发覆盖问题。
- 对库存和商品编辑提供明确的并发冲突结果，不静默覆盖。
- 切换账号或商家时清理客户端共享 GET 缓存，避免前一租户数据短暂泄漏。
- 将三端联动规则写入项目级 `AGENTS.md`，并维护可执行检查清单与回归测试。

### 非目标

- 不新建第二套商品、订单、库存、客户或设置系统。
- 不新增 WebSocket；沿用现有 SSE + 定时/前台恢复补偿。
- 不重写 `MerchantPortal`、`MerchantMobileApp` 或小程序整体架构。
- 不修改数据库 schema，不执行生产迁移。
- 不在本轮实现所有历史模块的完整双向编辑；缺失能力记录在矩阵中，不伪造演示数据。

## 3. 现状审计与防重复检查

### 3.1 已检查入口与调用链

| 运行面 | 入口/主要文件 | 数据读取 | 数据写入 |
|---|---|---|---|
| 商家 Web | `src/apps/merchant-admin-web/MerchantPortal.tsx`、`B2BContext.tsx` | `/api/merchant/products`、`orders`、`customers`、`settings` 等 | 复用 `B2BContext` 与共享 API client |
| 商家手机 Web | `src/apps/merchant-admin-mobile/MerchantMobileApp.tsx`、`B2BContext.tsx` | 同一组 `/api/merchant/*` | 同一组服务端路由；商品编辑复用 `updateProduct` |
| 商家小程序 | `merchant-miniprogram/utils/api.js`、`pages/*` | 同一 `https://ruda.fashion/api/merchant/*` | 原生 `wx.request`，Bearer token 来自独立会话键 |
| 服务端 | `server.ts`、`src/server/merchantSyncEvents.ts` | Prisma/PostgreSQL | 商家租户中间件与领域路由 |

已追踪链路：页面操作 → `B2BContext`/小程序 `request` → `/api/merchant/*` → `requireMerchantTenant` → Prisma → 响应 → 当前端状态更新 → SSE `merchant.changed` 或页面 `onShow` 再读取。

### 3.2 环境、身份与租户

- Web 与手机 Web 使用同源相对 `/api`；`admin.ruda.fashion` 的 API 请求会由 `resolveApiUrl` 指向 `ruda.fashion`。商家域与小程序均使用 `https://ruda.fashion`。
- 小程序 `API_BASE_URL` 固定为 `https://ruda.fashion`；生产环境三端一致，但开发版小程序也会写生产，属于测试环境隔离风险，发布前不得用开发版做破坏性数据测试。
- 商家身份由 JWT 中的 `merchantId` 解出；`requireMerchantTenant` 不信任前端传入的商家 ID。员工会话继续检查 `MerchantEmployee.active`、角色与权限。
- 小程序登录使用 `/api/miniprogram/auth/login`，Bearer token 存在独立键 `ruda_merchant_mini_auth`；不会与买家会话共享。
- 数据库为同一 `DATABASE_URL` 对应的 Prisma/PostgreSQL。`server.ts` 仍保留进程内兼容投影，但商家业务写入以 Prisma 为准；PM2 当前为单实例，SSE 内存事件不跨实例。

### 3.3 已确认根因

1. **缺失商家商品详情 API**：小程序 `product-detail`、`product-form` 和首页最近商品调用 `GET /api/merchant/products/:id`，服务端只注册了列表、批量写、单项 PUT/DELETE 和 `material-availability`，请求实际为 404。小程序无法可靠打开商品详情或编辑。
2. **商品更新字段静默丢弃**：`PUT /api/merchant/products/:id` 只写回部分字段，`brand`、`season`、`bulkPriceMinimumQuantity`、`requiresFullCarton`、`manufacturingProcess`、`fit`、`weight`、`packaging`、`washCare` 等没有持久化。三端表单看似保存成功，刷新后仍为旧值。
3. **库存字段被过期表单覆盖**：商品编辑请求会带上显示时的 `stockCentral`，而该接口没有库存台账事务；合法库存应只通过带 `version` 的库存调整接口写入。商品元数据更新必须保留服务端库存，不得用客户端旧值覆盖。
4. **同步整批失败**：`B2BContext.syncMerchantData` 与 Web 的 `refreshMerchantOperations` 使用 `Promise.all`，一个接口失败会导致商品、订单、客户等全部不更新；失败还可能被仅记录到控制台。
5. **事件后读取旧缓存**：共享 `apiGet` 缓存只按 URL 和 TTL 命中。`syncMerchantData` 使用 30 秒缓存，SSE 事件到达后立即同步仍可能拿到旧响应。
6. **缺少缓存租户隔离**：`apiCache` 没有在退出登录、切换商家或恢复会话时清理；同一浏览器在缓存 TTL 内切换商家可能读到前一商家的响应。
7. **缺少商品并发保护**：商品更新先读后写，没有版本条件；两个端同时编辑会静默后写覆盖先写。库存调整已有 `version`，商品没有。
8. **小程序停留页面不刷新**：商品/订单页只在 `onShow` 读取；页面保持打开时不会感知另一端修改。设置只有在重新进入设置页时才读取。
9. **设置跨端回显缺口**：Web/手机 Web 收到 `settings` 事件时只刷新经营数据或团队，不重新加载店铺设置表单。

### 3.4 复用结论

- 复用现有 `requireMerchantTenant`、员工权限中间件、Prisma 模型、`B2BContext`、共享 API client 和 `MerchantSyncEventHub`。
- 不新增认证、商品、库存或设置表；不新增第二套 Web API wrapper。
- 小程序无法复用 React/构建产物，只同步接口契约与字段映射，不复制业务服务。
- 现有 SSE 已存在且单实例部署；本次修复事件后的缓存失效与重连补拉，不另建推送服务。

## 4. 权威数据与缓存边界

| 数据 | 权威来源 | 客户端派生/缓存 | 刷新方式 |
|---|---|---|---|
| 商品/媒体/发布状态 | `Product`、`ProductVariant`、`Product.media` | 组件状态；GET 缓存仅提速 | 写入响应 + SSE / 30 秒补偿 / 页面 `onShow` |
| 单仓库存 | `InventoryBalance` + `InventoryMovement` | 商品 SKU 汇总仅展示 | 库存 `version` 写入 + SSE + 页面刷新 |
| 连锁门店库存 | `MerchantStoreStock` + `StockReservation` + `StockMovement` | 按门店展示实存、预留和可售；购物车/表单不作为权威库存 | 同一服务端事务与门店/SKU advisory lock；订单预留/履约后刷新 |
| 订单/支付/履约 | `Order`、`OrderItem`、`Order.storeId`、`Shipment`、支付/退款模型 | 列表与详情状态 | 服务端事务 + SSE + 前端恢复；门店订单按原 `storeId` 处理 |
| 客户 | `Customer` + `MerchantCustomerLink` | 列表/编辑表单状态 | 写响应 + SSE |
| 店铺设置 | `Merchant` + `settings` JSON | 表单状态；移动偏好 localStorage 仅界面偏好 | GET/PUT + SSE |
| 工作区草稿 | `MerchantWorkspaceDraft.revision` | 本地表单 | 乐观并发 `expectedRevision` |

客户端 localStorage 仅用于界面偏好、POS 暂存购物车等非权威数据；不得作为正式商品、库存、订单、客户或设置数据源。小程序 POS 的销售、退货、退款、现金流水、班次历史均重新读取 `/api/merchant/pos/*` 服务端结果；客户端显示和小票文本不是订单/退款/库存/现金账的权威来源。开发环境的 `ruda_products` 等写入受 `import.meta.env.DEV` 限制，生产不启用。

## 5. 用户流程与状态

### 5.1 正常跨端流程

1. A 端提交商品/设置/库存修改，服务端校验租户与权限并持久化。
2. 服务端返回持久化后的对象；A 端以响应替换本地乐观状态。
3. 服务端在响应成功后发布 `merchant.changed`，带资源类别。
4. B 端 SSE 收到事件后强制绕过客户端缓存，重新读取服务端；读取失败保留旧数据并明确提示，不得伪装成功。
5. 无 SSE 的小程序在页面可见时按 30 秒补偿读取，并在 `onShow`/下拉刷新时读取。
6. 用户切回页面、网络恢复或 SSE 重连时补拉完整状态。

### 5.2 并发状态

| 场景 | 服务端规则 | 客户端行为 |
|---|---|---|
| 商品同时编辑 | 请求可带 `expectedUpdatedAt`；服务端以 `updatedAt` 条件更新，不匹配返回 409 `PRODUCT_VERSION_CONFLICT` | 回滚乐观状态，提示“已在其他端更新”，立即重新读取 |
| 库存调整 | 必须携带当前 `version`；不匹配返回 409 `INVENTORY_VERSION_CONFLICT` | 保留错误，刷新余额后重试 |
| 工作区草稿 | `expectedRevision` 条件更新 | 409 后重新加载最新草稿 |
| 订单状态推进 | 服务端事务与允许状态转换；非法状态拒绝 | 显示真实服务端错误并刷新 |

### 5.3 异常

- 401：清除当前会话，回到登录，不继续使用旧商家缓存。
- 403：显示无权限，不隐藏为“空数据”。
- 409：明确冲突，不自动覆盖；刷新服务端结果。
- 网络失败：保留可读旧状态并提示同步失败；写入失败不得提示成功。
- SSE 断线：浏览器自动重连；重连成功补拉全量；30 秒补偿仍生效。

## 6. API 契约

### 6.1 新增：`GET /api/merchant/products/:id`

- 用途：供商家三端读取单商品，含 SKU、媒体与当前库存派生值。
- 认证：`requireMerchantTenant`；员工需具备 `sales.order.create`、`production.report` 或 `product.publish` 中任一权限，与商品列表一致。
- 租户边界：`where: { id, merchantId: 当前会话 merchantId }`；不得回退到其他商家或公共商品接口。
- 响应：`{ success: true, product }`。无权限/不存在统一返回 404 `MERCHANT_PRODUCT_NOT_FOUND`，不泄露其他商家商品是否存在。
- 数据：`serializeMerchantProductForRequest`，员工无成本权限时不返回 `costPrice` 和各 SKU `cost`。
- 缓存：商家详情按请求读取数据库；客户端不得把该 GET 当作跨端实时通道。
- 兼容性：纯新增，不影响现有公共 `GET /api/products/:id`。

### 6.2 变更：`PUT /api/merchant/products/:id`

- 认证/权限：保持 `requireMerchantTenant`、`product.publish` 或 `store_manager`、商品编辑开关、成本权限。
- 新增可选请求字段：`expectedUpdatedAt`（ISO 时间字符串）。
  - 合法且与服务端 `Product.updatedAt` 不一致：409 `{ success: false, error: 'PRODUCT_VERSION_CONFLICT', product }`。
  - 省略时保持旧客户端兼容，但服务端仍以读取到的 `updatedAt` 作为本次写入条件，避免读后并发覆盖；不匹配同样返回 409。
  - 非法格式：400 `PRODUCT_VERSION_INVALID`。
- 写回字段补齐：`brand`、`season`、`bulkPriceMinimumQuantity`、`requiresFullCarton`、`manufacturingProcess`、`fit`、`weight`、`packaging`、`washCare`，以及原有名称、款号、分类、价格、MOQ、箱规、可见性、发布状态、媒体、SKU 元数据、描述。
- 库存边界：商品 PUT 不修改 `InventoryBalance`。服务端保留现有 SKU 的 `stockCentral/stockMestre/stockMilano/reserved`，库存只能通过带 `version` 的 `/api/merchant/inventory/adjustments` 修改。
- 成本边界：无成本权限的员工不得写 `costPrice`；未提交该字段时保留当前成本，不得归零。
- 幂等/并发：同一 `updatedAt` 条件写入；冲突返回 409，不做静默覆盖。
- 媒体校验：保持既有对象存储校验，不新增绕过路径。

### 6.3 变更：客户端同步

- `B2BContext.syncMerchantData`：逐资源 `Promise.allSettled`；成功资源独立更新，失败资源保留旧值并返回部分失败；所有商家权威读取绕过 `apiGet` TTL 缓存。
- Web `refreshMerchantOperations`：同样逐资源更新，单接口失败不清空其他已成功数据；对用户可见的失败只提示一次。
- `apiGet` 增加显式缓存清理能力；登录、退出、恢复会话、切换商家时清理；SSE 重连/收到事件后强制读取。
- 小程序商品、订单列表：页面可见时 30 秒补偿刷新，`onHide/onUnload` 清理定时器；详情页 `onShow` 重新读取，写入后返回可见刷新。
- 设置事件：Web 设置页、手机设置页收到 `settings` 资源后重新加载 `/api/merchant/settings`，以服务端最终值为准；未保存草稿会被最新服务端值替换，保存时通过版本条件避免覆盖其他端修改。

### 6.4 变更：`GET/PUT /api/merchant/settings`

- `GET` 增加只读 `updatedAt`（`Merchant.updatedAt`），供编辑页做版本基准；不写入 `settings` JSON。
- `PUT` 新增可选 `expectedUpdatedAt`：服务端以 `updateMany({ where: { id, updatedAt } })` 条件写入，`count !== 1` 时返回 409 `MERCHANT_SETTINGS_CONFLICT`，不静默覆盖其他端保存。
- 省略 `expectedUpdatedAt` 的旧客户端仍可保存，但服务端会在读取后条件写入，期间有并发变更则返回 409。
- 非法 `expectedUpdatedAt` 返回 400 `SETTINGS_VERSION_INVALID`；成功响应返回新的 `updatedAt`。
- Web/手机 Web 保存冲突时提示“设置已在其他端更新”，不把失败显示为成功；手机端重新加载最新设置，Web 端要求重新打开设置再编辑。

## 7. 权限、安全与租户隔离

- 所有商家 API 继续从 JWT 读取 `merchantId`，不接受客户端指定其他商家。
- 新增详情接口必须按 `merchantId` 过滤；库存写入保持 `version` 和事务。
- 缓存清理属于租户隔离措施，不是权限替代；服务端仍逐请求授权。
- 不记录 JWT、密码、完整媒体签名 URL 或客户隐私到普通日志。
- 小程序与 Web 不共享会话键；三端均通过服务端校验，不以隐藏 UI 作为授权。

## 8. 测试计划

### 8.1 自动化

- 静态契约测试：商家商品详情 GET 存在；商品 PUT 持久化字段集合完整；同步使用 `allSettled` 和强制读取；缓存清理已接入认证生命周期；小程序关键请求路径都有对应服务端路由。
- 单元测试：商品版本冲突判定；同步部分失败仍应用成功资源（如可提取纯函数）。
- 类型检查：`npx tsc --noEmit -p tsconfig.json` 或项目 `npm run lint`。
- 构建：`build:app:merchant-admin-web`、`build:app:merchant-admin-mobile`。
- 小程序：JS 语法检查；微信开发者工具可运行时检查页面注册和请求路径（本次环境若不可用则标记待验收）。

### 8.2 真实跨端（必须在测试商家与隔离环境执行）

- 测试 A：电脑端创建商品 → 手机端、小程序重新进入/等待补偿刷新 → 三端字段一致。
- 测试 B：小程序修改标题/规格/价格 → 电脑端与手机端刷新 → 数据库、API 响应、页面一致。
- 测试 C：一端推进订单 → 其他端读取相同状态；库存只扣一次。
- 测试 D：修改设置/图片/发布状态 → 其他端回显；切换商家后无旧缓存。
- 测试 E：两端同时编辑同一商品，后提交端收到 409 而非静默覆盖；库存并发返回版本冲突。
- 测试 F：断网/恢复、SSE 断开重连、快速连续修改，确认不会把失败提示为成功。

### 8.3 视觉与设备

- 桌面 1440、手机 390；商品编辑/详情、订单列表、设置页。
- 小程序开发者工具或真机：商品详情、编辑、库存调整、订单状态、设置页。
- 无真实会话/设备证据时，状态只能写“代码/构建已验证，实际跨端待验收”。

## 9. 验收标准

- [ ] 三端配置核查记录完整，生产 API 基址与数据库一致；开发版环境风险明确。
- [ ] 同一商家的 `merchantId` 与租户边界由服务端 JWT 决定，三端不自行传入权威商家 ID。
- [ ] 商品详情/编辑在小程序不再 404。
- [ ] 商品所有可编辑字段保存后重新读取仍存在。
- [ ] 库存修改只经库存接口，商品元数据更新不覆盖库存。
- [ ] 任一资源接口失败不会阻止其他资源更新，且失败有可见提示。
- [ ] 其他端写入后，本端通过 SSE 或 30 秒补偿/`onShow` 获得服务端新值。
- [ ] 商品与库存并发冲突返回明确 409，不静默覆盖。
- [ ] 切换商家/退出后无旧租户缓存可读。
- [ ] 三端真实交叉测试通过；未执行项明确列出。

## 10. 部署、回滚与风险

- 无数据库迁移。新增 GET 与 PUT 字段为向后兼容扩展。
- 发布顺序：服务端 → Web/手机 Web → 小程序。仅发布客户端时，小程序商品详情仍会 404，因此必须先发布服务端。
- 回滚：恢复前一版 `server.ts` bundle / 应用 release；`expectedUpdatedAt` 为可选字段，旧客户端可继续使用。若需回滚客户端，保留新服务端字段写回不会破坏旧客户端。
- 风险：SSE 为进程内事件，生产多实例前必须替换为跨实例事件总线或确保粘性路由；当前单实例配置下仍保留 30 秒补偿。
- 风险：小程序开发版固定写生产；后续引入测试域名前不得在开发版执行破坏性测试。
- 风险：商品 SKU 变体表与 JSON `skus` 历史上存在双表示；本次只修复元数据写回与库存保护，SKU 变体创建/删除的完整矩阵仍待专项验证。

## 11. 实施记录（开发后补充）

- 变更文件：
  - 服务端：`server.ts`（商品详情 GET、商品 PUT 完整字段/版本条件/库存保护、设置 GET/PUT 版本条件、`sendInternalError` 返回、箱规校验、品牌空值保护）。
  - 共享层：`src/api/client.ts`（`clearApiCache`）、`src/context/B2BContext.tsx`（认证切换清缓存、`Promise.allSettled`、TTL=0、SSE `open` 重同步、商品 409 刷新）。
  - Web：`src/apps/merchant-admin-web/MerchantPortal.tsx`（逐资源刷新、`settingsSyncNonce`、设置版本冲突处理）。
  - 手机 Web：`src/apps/merchant-admin-mobile/MerchantMobileApp.tsx`（逐资源刷新、设置版本、SSE 设置/团队刷新）。
  - 小程序：`merchant-miniprogram/pages/products/index.js`、`orders/index.js`、`product-detail/index.js`、`product-form/index.js`（30 秒静默刷新、详情 `onShow`、`expectedUpdatedAt` 与 409）。
  - 契约测试：`tests/merchant-cross-device-contract.test.ts`；事件与资源映射沿用 `tests/merchant-sync-events.test.ts`。
- 执行命令与结果：
  - `npx tsc --noEmit -p tsconfig.json`：退出码 0，无输出。
  - `npm run test:unit`：935 个测试全部通过（935/935）。
  - `node --import tsx --test tests/merchant-cross-device-contract.test.ts tests/merchant-sync-events.test.ts`：9/9 通过。
  - `npm run build:app:merchant-admin-web`：退出码 0，产出 release `20261026035134969-d9c1c13d`。
  - `npm run build:app:merchant-admin-mobile`：退出码 0，产出 release `20261026035135260-b42ad4be`。
  - `node --check` 检查四个小程序页面：通过。
  - `npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external`：退出码 0。
  - `git diff --check`：退出码 0。
- 截图/验收证据：尚无真实三端会话截图。
- 未完成项：真实三端登录态交叉验收（§8.2 测试 A–F）、微信开发者工具/真机验收待执行；SSE 多实例风险与小程序生产 API 基址风险未改变。
- 2026-10-26 ModaUI 聊天布局补充：仅调整共享 `MerchantAiHome`、手机 Web 导航收起/键盘 inset 与小程序 `pages/assistant` 菜单/拖柄，不新增或修改任何商家数据读写路径、缓存键、事件或权限；跨端数据一致性口径不变。

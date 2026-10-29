# 模块规格：折扣商城（Discount Mall）

- Module ID：`discount-mall`
- 模块状态：**部分完成**（本阶段交付：数据模型 + 服务端商城状态机/公开读取 + 总后台「折扣商城」商品中心 + 平台自营商品上传/编辑/安全删除 + 审计 + 单测。**未完成**：前台首页切换到商城公开 API、平台自营商品的买家下单/履约链路、浏览器与真机视觉验收、生产部署）
- 文档阶段：已审查（随代码同步）
- 日期：2026-10-28
- 关联文档：[`../module-registry.md`](../module-registry.md)、[`commerce-order-chain.md`](./commerce-order-chain.md)、[`platform-feature-flags.md`](./platform-feature-flags.md)
- 强制规则：`AGENTS.md` §1（流程）、§3（单一事实来源）、§4（文档先行）、§6（API 契约）、§7（数据库）、§8（任务/事件）、§9（安全与审计）

---

## 1. 背景与问题

RUDA 前端首页是**折扣商城**，商品有两个来源：

1. **商家特价商品**：商家在自己的商品上把展示区设为「折扣市场」（`Product.status = 'clearance'`）。
2. **平台自营商品**：RUDA 平台在总后台上传并维护的商品（`Product.merchantId = null`，无商家归属）。

改动前的真实状态（已核查，不是推测）：

| 事实 | 证据 |
|---|---|
| 商家可以自行设置「折扣市场」，无平台审核环节 | `src/apps/merchant-admin-common/components/merchant/ProductZonePicker.tsx`、`MerchantPortal.tsx:5260` |
| 总后台「商品管理」只能切 `lifecycleStatus`、`featuredOnSale`、`featuredOnHome`，没有「加入/移出折扣商城」「上架/下架」状态 | `src/apps/platform-admin-web/PlatformAdmin.tsx:2163-2289`、`server.ts:42623` `PUT /api/admin/products/:id/review` |
| 总后台没有创建平台自营商品的接口 | `grep "app.post('/api/admin/products"` 无结果；商品创建只有 `POST /api/merchant/products`（要求商家租户） |
| 公开商品列表 `GET /api/products` 用 `merchant: { OR: [...] }` 过滤，**商家为空的平台自营商品永远查不到** | `server.ts:14988-15023` |
| 买家下单直接拒绝无商家的商品 | `server.ts:16270` `PRODUCT_MERCHANT_REQUIRED` |
| 生产库当前 `status='clearance'` 的商品为 0 条，平台自营商品 0 条 | 2026-10-28 只读查询：3 家商家 / 7 个商品，全部 `status='new'` |

因此「总后台统一管理折扣商城」在改动前**不存在**：既没有商城展示状态，也没有平台自营商品，更没有让商品只在商城层面下架而不影响商家店铺的能力。

## 2. 目标与非目标

### 2.1 目标（本阶段）

1. 为 `Product` 增加**独立的折扣商城展示状态机**：未加入、待审核、已上架、已下架、已驳回、已结束、无法上架。状态与商家自己的「折扣市场」分区、商品 `lifecycleStatus` 互不覆盖。
2. 总后台新增「折扣商城」商品中心（业务管理分区，四字导航名）：统一列出**商家特价商品 + 平台自营商品**，显示来源、归属、价格、库存、SKU、审核状态、商城状态、首页精选、特色大图，支持筛选、搜索、排序。
3. 平台管理员可执行：加入商城、审核通过/驳回、上架、下架、重新上架、移出商城、设置首页精选、设置特色大图、设置商城展示顺序、设置商城特价有效期。
4. 补齐**平台自营商品**的上传、编辑和安全删除（草稿可删，有交易历史只能归档）。
5. 所有商城操作走 `requireAdminAuth` + `requireAdminPermission('products.review')`，并把操作人、前后状态、原因写入 `AuditLog`。
6. 提供公开只读 API `GET /api/discount-mall/products`：只返回当前真正可展示的商城商品（商家公开特价 + 平台自营），带分页、搜索、分类筛选，供前台首页下一步接入。

### 2.2 非目标（本阶段明确不做）

- **不改动前端首页代码**（`HomeView.tsx`、`MobileEditorialHome.tsx`、`CatalogView.tsx`、小程序首页均未修改）。首页切换到商城公开 API 属于下一步，见 §12 遗留。
- 不新增第二个商品库、不复制商家商品/库存/价格到商城表；商城状态是 `Product` 上的字段，不是平行数据。
- 不改动买家下单价格计算（`getProductWholesalePriceForQuantity` 与 `customer.discountRate` 逻辑保持不变）。
- 不实现平台自营商品的买家下单、扣库存、结算与履约（当前下单链路要求商品有商家归属）。
- 不删除、不改写商家原始商品、SKU、库存、历史订单。
- 不引入新的权限体系；沿用 `products.review` 权限键。
- 不新增「折扣价」独立字段（原因见 §7.2）。

## 3. 现状审计与防重复检查

搜索关键词：`折扣商城`、`clearance`、`featuredOnSale`、`featuredOnHome`、`mall`、`lifecycleStatus`、`/api/products`、`/api/admin/products`、`serializeProductRow`、`isPublicStorefront`、`PUBLIC_STOREFRONT_MERCHANT_FILTER`、`InventoryBalance`、`logAuditAndWait`。

| 能力 | 现有权威实现 | 复用结论 |
|---|---|---|
| 商品与 SKU | `Product`、`ProductVariant`（`prisma/schema.prisma:2928-3039`）、`Product.skus` JSON 兼容旧数据 | 复用，仅新增商城状态字段 |
| 库存 | `InventoryBalance`（`merchantId` 可空，`variantId + locationId` 唯一）、`SINGLE_WAREHOUSE_CODE` 中央仓 | 复用；平台自营商品库存写 `merchantId = null` 的中央仓余额 |
| 商家「折扣市场」分区 | `Product.status = 'clearance'`，商家后台 `ProductZonePicker` / 批量分区 | 复用为「商家特价」语义，不新增分区字段 |
| 特色大图 / 首页精选 | `Product.featuredOnSale`（特色大图）、`Product.featuredOnHome`（首页精选），总后台已有开关 | 复用，不新增同类布尔字段 |
| 商品审核 | `Product.lifecycleStatus`（draft/pending_review/published/rejected/archived）+ `PUT /api/admin/products/:id/review` | 复用为**商品级**审核；商城准入审核是**另一层**（见 §6.2），不复用同一字段 |
| 商家/店铺公开性 | `isPublicStorefront()`、`PUBLIC_STOREFRONT_MERCHANT_FILTER`（`src/server/publicProductVisibility.ts`） | 复用，作为商城上架前置条件 |
| 公开商品读取 | `GET /api/products`（`server.ts:14988`）、`GET /api/products/:id` | **不改动**，避免影响商家店铺页；新增独立商城读取接口 |
| 报价计算 | `getProductWholesalePriceForQuantity`（`src/shared/productPricing.ts`）、`PRODUCT_CATEGORIES` | 复用，用于后台「当前折扣价/折扣幅度」计算，口径与买家实际成交价一致 |
| 商品创建校验 | `isValidMerchantProductPricing`、`normalizeMerchantProductVariantSettings`（`src/shared/merchantProductCreation.ts`） | 复用，平台自营商品走同一套价格/SKU 校验 |
| 管理员权限 | `requireAdminAuth` + `requireAdminPermission`，`hasAdminPermission` 支持 `*` | 复用 `products.review` |
| 审计 | `logAuditAndWait()` 写 `AuditLog`（含 beforeState/afterState/requestId） | 复用 |
| 总后台导航 | `adminNavigation.ts`（四个分区、四字导航名） | 业务管理分区新增「折扣商城」 |

**为什么必须新增而不是扩展现有页面**：现有「商品管理」页面只能改商品级状态；折扣商城需要独立的准入与展示状态，以及与商家店铺解耦的下架能力。若把商城状态塞进 `lifecycleStatus`，平台下架会连带下架商家自己店铺的商品 —— 明确禁止。

**防重复**：商城状态只存于 `Product.mall*` 字段一处；没有任何「折扣商城商品表」「商城价格表」「商城库存表」。平台自营商品沿用 `Product` 表，通过 `merchantId IS NULL` 识别，不建立第二个商品模型。

## 4. 归属与边界

- 所属业务域：`commerce-core`（商品）与 `platform-admin`（总后台）之间的平台运营能力。
- 运行面：平台总后台 Web（`platform-admin-web`）与平台总后台手机端（`platform-admin-mobile`），共享 `platform-admin-common` 组件；服务端 `server.ts`。
- 模块负责：商城展示状态机、商城准入规则、平台自营商品 CRUD、商城公开读取、审计。
- 模块不负责：商家自己店铺的发布状态、商品级审核、买家下单与价格、履约与结算、首页 UI。
- 调用方：总后台折扣商城页、后续前台首页/小程序首页（只读公开接口）。
- 数据归属：`Product`（唯一条目来源）+ `ProductVariant`/`InventoryBalance`（库存事实）+ `AuditLog`（操作事实）。

## 5. 角色与权限

| 操作 | 权限 | 服务端校验 | 审计 |
|---|---|---|---|
| 查看商城商品中心 | `requireAdminAuth` | 管理员会话有效 | 否（只读） |
| 加入/移出商城、审核、上下架、精选、大图、排序、有效期 | `products.review` | 每次请求校验；非法状态转换返回 409 | 是，`DISCOUNT_MALL_*` |
| 新建/编辑平台自营商品 | `products.review` | 仅允许 `merchantId IS NULL` 的商品 | 是，`PLATFORM_PRODUCT_*` |
| 删除平台自营商品 | `products.review` | 仅草稿/已归档，且无 `OrderItem` 引用 | 是，`PLATFORM_PRODUCT_DELETED` |
| 公开读取商城商品 | 匿名 | 只返回上架且通过准入、公开可见的商品 | 否 |

租户边界：所有写操作按 `productId` 定位，**不接受客户端传入的 `merchantId`**；平台自营商品必须校验 `merchantId === null`，商家商品必须校验 `merchantId !== null`，防止跨归属篡改。

## 6. 用户流程与状态机

### 6.1 商城展示状态（`Product.mallStatus`）

| 状态 | 含义 | 是否公开可见 |
|---|---|---|
| `not_listed` | 未加入折扣商城（默认） | 否 |
| `pending` | 已加入，等待平台审核 | 否 |
| `listed` | 已上架，通过准入检查 | 是（且需有效期有效） |
| `unlisted` | 平台已下架（商品本身不动） | 否 |
| `rejected` | 平台审核驳回（附原因） | 否 |
| `ended` | 活动结束或商品不可继续展示 | 否 |
| `blocked` | 因缺少必要信息/规则不满足无法上架（附原因码） | 否 |

### 6.2 两层审核的区别（避免重复审核）

- **商品级审核**（既有）：`lifecycleStatus`，决定商品在商家店铺/目录是否存在，商家提交、平台用「商品管理」审核。本模块不改动。
- **商城准入审核**（新增）：`mallStatus`，决定商品是否进入折扣商城。必须是 `lifecycleStatus = 'published'` 的商品才允许通过准入。

平台驳回商城准入**不会**改变 `lifecycleStatus`，也不会下架商家店铺商品；反之，商家把商品设为 `archived` 后，商城准入自动失效（读取时判定为不可展示）。

### 6.3 允许的状态转换

| 当前状态 | 操作 | 目标状态 | 服务端校验 | 失败处理 |
|---|---|---|---|---|
| `not_listed` / `rejected` / `unlisted` / `ended` | 加入商城 | `pending` | 商品存在；商家商品需 `status='clearance'` 且非私密/非授权专属 | 400 `DISCOUNT_MALL_NOT_ELIGIBLE` + 原因码 |
| `pending` | 审核通过 | `listed` | 全部准入规则通过（§7.1） | 转为 `blocked` 并返回 409 `DISCOUNT_MALL_NOT_READY` + 原因码 |
| `pending` | 审核驳回 | `rejected` | 必填驳回原因（≤200 字） | 400 `DISCOUNT_MALL_REASON_REQUIRED` |
| `unlisted` / `blocked` / `rejected` | 上架/重新上架 | `listed` | **重新**执行全部准入规则，不复用上次结论 | 409 + 原因码 |
| `listed` | 下架 | `unlisted` | 商品存在 | — |
| `listed` / `pending` / `unlisted` / `blocked` / `rejected` | 移出商城 | `not_listed` | 商品存在 | — |
| `listed` | （读取时）有效期已结束 | `ended` | `mallSaleEndsAt < now` | 公开接口不返回 |

非法转换（如 `not_listed` 直接「上架」）返回 409 `DISCOUNT_MALL_TRANSITION_INVALID`，不会静默成功。

## 7. 业务规则

### 7.1 准入规则（服务端唯一判定，`src/server/discountMall.ts`）

商家特价商品（`merchantId !== null`）：

1. `lifecycleStatus === 'published'`，否则 `NOT_PUBLISHED`。
2. `status === 'clearance'`，否则 `MERCHANT_NOT_CLEARANCE`（商家未标记折扣市场）。
3. `visibility !== 'private'` 且 `isExclusiveProtected !== true`，否则 `MERCHANT_PRODUCT_PRIVATE`（授权商品走原有授权规则，不进入公开商城）。
4. 商家店铺公开可见（`isPublicStorefront`），否则 `MERCHANT_STOREFRONT_INACTIVE`。
5. 主图存在，否则 `MISSING_COVER_IMAGE`。
6. 批发价 > 0，否则 `PRICE_INVALID`。
7. 至少一个启用 SKU，否则 `NO_SELLABLE_SKU`。

平台自营商品（`merchantId === null`）：

8. `lifecycleStatus === 'published'`、主图、批发价、SKU 同上。
9. `PLATFORM_FULFILLMENT_NOT_READY`：买家下单链路当前要求商品有商家归属（`PRODUCT_MERCHANT_REQUIRED`），在补齐平台自营下单/履约前，平台自营商品**不能**上架到公开商城，避免顾客看到无法购买的商品。此限制只影响「上架」动作，不影响创建、编辑、审核和草稿状态。

通用：

10. 商城特价有效期：`mallSaleStartsAt` 未到为 `SALE_WINDOW_NOT_STARTED`，`mallSaleEndsAt` 已过为 `SALE_WINDOW_ENDED`（读取时会转成 `ended`）。

每个原因都是稳定错误码 + 中文说明，后台页面直接展示，不靠前端推断。

### 7.2 价格口径（不制造虚假折扣）

商城页面与后台**不新增折扣价字段**，全部使用既有真实价格，口径与买家实际成交一致：

| 展示项 | 取值 | 说明 |
|---|---|---|
| 正常批发价 | `Product.wholesalePrice` | 商家基准批发价，平台不改写 |
| 当前折扣价（成交价） | `getProductWholesalePriceForQuantity(wholesalePrice, wholesalePrice100, moq, bulkPriceMinimumQuantity)` | 按起订量 MOQ 计算的实际单价，与 `server.ts` 下单计价同一函数 |
| 量大批发价 | `Product.wholesalePrice100`（可为空） | 达到门槛后的单价 |
| 建议零售价 RRP | `Product.rrpPrice` | 新建商品可能为 0，显示为「未设置」，不参与折扣计算 |
| 折扣幅度 | `1 - 当前折扣价 / 正常批发价`，仅当折扣价 < 正常批发价时显示 | 无量大批发价时不显示，不虚构划线价 |

不新增 `discountPrice` 的原因：买家下单价格由服务端 `getProductWholesalePriceForQuantity × customer.discountRate` 决定；若后台可写一个下单链路不认的「折扣价」，就会产生虚假折扣。要做平台级折扣价，必须同时改下单计价、订单快照和前台价格展示，属于独立任务（§12）。

### 7.3 下架语义（必须守住）

- 商城「下架」只把 `mallStatus` 改为 `unlisted`：**不**改 `lifecycleStatus`、**不**改商家 `status`、**不**删 SKU/库存/订单。
- 商家店铺是否展示由商家自己的商品状态与店铺设置决定，与商城状态无关。
- 「移出商城」把 `mallStatus` 改回 `not_listed`，同样不动商品本体。
- 「删除」仅对**平台自营**且为草稿/已归档、无 `OrderItem` 引用的商品开放；其它情况只能归档（返回 409 `PRODUCT_DELETE_NOT_ALLOWED`）。

## 8. UI 规范

- 入口：总后台「业务管理 → 折扣商城」（四字导航，位于「商品管理」之后），Web 与手机端共用 `AdminDiscountMall` 组件。
- 顶部：标题「折扣商城」+ 一行状态统计（商家特价 / 平台自营 / 待审核 / 已上架 / 已下架）；不写重复说明段落。
- 工具条：搜索款号/名称/品牌、来源筛选（全部/商家特价/平台自营）、商家筛选、商品审核状态、商城状态、分页。
- 表格列：商品（图/款号/名称）、来源、归属、正常批发价、当前折扣价、折扣幅度、可售库存、MOQ/SKU、审核状态、商城状态、首页精选、特色大图、操作。
- 行内操作：加入商城、审核通过、驳回（填原因）、上架、下架、移出、精选开关、大图开关、排序值、详情/审计记录。
- 平台自营商品：右上「新增自营商品」表单（款号、名称、分类、品牌、季节、主图 URL、批发价、量大批发价、RRP、MOQ、箱规、SKU 列表、描述），创建后为草稿，再由平台审核发布。
- 状态使用中性黑白配色 + 少量必要状态色；不使用营销文案、不新增主题色。
- 空/加载/错误/无权限四态齐全：读取失败显示可重试按钮；无权限时管理端返回 403，页面显示「无权限」而非空白表格。

## 9. 数据模型与迁移

迁移文件：`prisma/migrations/20261028230000_discount_mall/migration.sql`（追加列，全部可空或带默认值，无数据回填，可安全在旧代码运行期先部署）。

`Product` 新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `mallStatus` | `String @default("not_listed")` | 商城展示状态 |
| `mallStatusReason` | `String?` | 驳回/下架/阻断原因（原因码 + 中文，≤500） |
| `mallListedAt` | `DateTime?` | 最近一次上架时间 |
| `mallUnlistedAt` | `DateTime?` | 最近一次下架/移出时间 |
| `mallListedBy` | `String?` | 上架操作管理员 |
| `mallUnlistedBy` | `String?` | 下架/移出操作管理员 |
| `mallReviewedBy` / `mallReviewedAt` | `String?` / `DateTime?` | 最近一次商城审核 |
| `mallSortOrder` | `Int @default(0)` | 商城展示顺序（升序） |
| `mallSaleStartsAt` / `mallSaleEndsAt` | `DateTime?` | 商城特价有效期 |
| `mallUpdatedBy` | `String?` | 最近一次商城状态操作人 |

索引：`@@index([mallStatus, mallSortOrder])`。

不新增的表：没有 `DiscountMallProduct`、没有商城价格表、没有商城库存表。平台自营商品 = `Product.merchantId IS NULL`，其库存 = 中央仓 `InventoryBalance`（`merchantId = null`）。

回滚：`DROP COLUMN` 即可回到旧结构；旧代码忽略这些列，因此可以先回滚代码再回滚列，无数据丢失。

## 10. API 契约

全部为 JSON，成功 `{ success: true, ... }`，失败沿用项目统一错误结构（`error.code` / `error.message` / `error.details`）。

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/admin/discount-mall/products` | `requireAdminAuth` | 分页列表；query：`q`、`source`（all/merchant/platform）、`merchantId`、`lifecycleStatus`、`mallStatus`、`featured`（home/sale）、`page`、`pageSize`（≤100）；返回 `items`、`total`、`page`、`pageSize`、`summary` |
| POST | `/api/admin/discount-mall/products/:id/join` | `products.review` | 加入商城 → `pending` |
| POST | `/api/admin/discount-mall/products/:id/review` | `products.review` | body `{ decision: 'approve' \| 'reject', reason? }` |
| POST | `/api/admin/discount-mall/products/:id/list` | `products.review` | 上架/重新上架（重新执行准入） |
| POST | `/api/admin/discount-mall/products/:id/unlist` | `products.review` | 下架，body `{ reason? }` |
| POST | `/api/admin/discount-mall/products/:id/remove` | `products.review` | 移出商城，body `{ reason? }` |
| PUT | `/api/admin/discount-mall/products/:id/display` | `products.review` | body `{ featuredOnHome?, featuredOnSale?, mallSortOrder?, mallSaleStartsAt?, mallSaleEndsAt? }` |
| GET | `/api/admin/discount-mall/products/:id/history` | `requireAdminAuth` | 该商品的商城操作审计（最近 50 条） |
| POST | `/api/admin/platform-products` | `products.review` | 新建平台自营商品（草稿或发布），`merchantId` 强制 null |
| PUT | `/api/admin/platform-products/:id` | `products.review` | 编辑平台自营商品（仅 `merchantId IS NULL`） |
| DELETE | `/api/admin/platform-products/:id` | `products.review` | 删除平台自营草稿/归档商品（无订单引用） |
| GET | `/api/discount-mall/products` | 匿名 | 公开商城读数：仅 `listed` + 准入通过 + 有效期有效；支持 `q`、`category`、`page`、`pageSize`（≤60）；`Cache-Control: no-store` |

错误码：`DISCOUNT_MALL_PRODUCT_NOT_FOUND`(404)、`DISCOUNT_MALL_NOT_ELIGIBLE`(400)、`DISCOUNT_MALL_TRANSITION_INVALID`(409)、`DISCOUNT_MALL_NOT_READY`(409)、`DISCOUNT_MALL_REASON_REQUIRED`(400)、`PLATFORM_PRODUCT_REQUIRED`(400)、`PLATFORM_PRODUCT_FIELDS_INVALID`(400)、`PRODUCT_DELETE_NOT_ALLOWED`(409)。

幂等与并发：状态转换以 `mallStatus` 期望值做条件更新（`updateMany({ where: { id, mallStatus: expected } })`），并发重复提交只有一次生效，其余返回 409；审计写入与状态更新在同一事务内（`logAuditAndWait(..., tx)`）。

## 11. 测试与验收标准

### 11.1 自动化

- `tests/discount-mall.test.ts`：准入规则（每条原因码各一例）、状态机合法/非法转换、价格口径、公开可见性判定、审计动作常量；源码契约：路由存在、导航项存在、页面组件被两个平台后台挂载、下架不改商品本体。
- `tests/admin-navigation.test.ts`：导航集合新增 `discount_mall`（四字名「折扣商城」），不重复。
- 命令：`node --import tsx --test tests/discount-mall.test.ts tests/admin-navigation.test.ts`；类型检查 `npx tsc --noEmit`。

### 11.2 手工验收（本阶段可执行部分）

1. 总后台业务管理出现「折扣商城」，列出商家特价 + 平台自营，来源/归属/价格/库存/状态列正确。
2. 对一件 `status='clearance'` 的公开商品执行「加入商城 → 审核通过 → 上架」，`GET /api/discount-mall/products` 能查到；`GET /api/products` 行为不变。
3. 执行「下架」后公开商城接口不再返回该商品，但商家商品 `lifecycleStatus`、`status`、SKU、库存、订单不变（数据库对比）。
4. 「重新上架」在商品失效（如改为 `archived`）时被拒绝并给出原因码。
5. 平台自营商品可创建、编辑、审核为发布；尝试上架返回 `PLATFORM_FULFILLMENT_NOT_READY`（当前设计）。
6. 每次操作在 `GET .../history` 与「操作记录」中可见：操作人、时间、前状态、后状态、原因。
7. 商城公开接口的分页、搜索、分类筛选、空态真实生效。

## 12. 遗留与风险

| 项 | 状态 | 说明 |
|---|---|---|
| 前台首页接入商城公开 API | 待完成（按用户指令本阶段不改首页） | 首页/小程序仍读 `GET /api/products` 并按 `status='clearance'` 展示，因此**商城「下架」暂时不会影响首页**。下一步把首页商城区块改读 `/api/discount-mall/products` 后，下架才在公开首页生效 |
| 平台自营商品下单/履约 | 被阻塞 | 下单链路要求 `product.merchantId`，平台自营商品无商家归属；需单独设计平台自营订单分组、库存扣减、结算与开票 |
| 平台级折扣价 | 待验证 | 需要同时改下单计价、订单价格快照与前台展示，避免虚假折扣 |
| 视觉验收 | 待验收 | 未在浏览器/手机实机截图验收；`impeccable detect` 仅解析 `.js`，不覆盖 TSX 视觉规则 |
| 生产部署 | 未执行 | 需先跑迁移（加列）→ 重启服务 → 再发布前端构建 |

## 13. 部署与回滚

1. 先部署服务端（含迁移 `prisma migrate deploy`）——迁移只加列，旧前端不受影响。
2. 再发布总后台 Web/手机端构建产物。
3. 回滚：回滚前端构建 → 回滚服务端 → （可选）`DROP COLUMN`。期间数据无删除，商家商品与订单不受影响。







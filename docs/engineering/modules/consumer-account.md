# 模块规格：消费者账户与零售前台（B2C 账户闭环）

- Module ID：`consumer-account`
- 模块状态：部分完成
- 文档阶段：开发中
- 日期：2026-10-29

## 1. 背景与问题

公共前台（`frontend-web` / `frontend-mobile`）已经交付消费者注册、登录、商城、购物袋和账户页面，但服务端缺少对应的消费者接口：

| 前端调用 | 服务端状态（修复前） | 用户可见结果 |
|---|---|---|
| `GET/POST/PUT/DELETE /api/consumers/me/addresses` | 不存在 | 地址列表永远为空，新增/删除静默失败 |
| `PATCH /api/consumers/me` | 不存在（只有 `GET`） | 个人资料保存失败 |
| `GET/POST/DELETE /api/consumers/me/wishlist` | 不存在 | 愿望清单永远为空 |
| `GET /api/consumers/me/orders` | 不存在 | 我的订单永远为空 |
| `POST /api/promotions/calculate/retail` | 不存在 | 购物袋优惠券无效，折扣恒为 0 |
| `GET /api/retail/products[/:id]` | 不存在 | 消费者商城商品列表为空 |

`B2BContext` 对这些调用统一使用 `catch {}`，因此问题不会以错误提示暴露，只会表现为「数据一直是空的」。

## 2. 目标与非目标

### 目标

- 为消费者账户页补齐有真实持久化与服务端校验的接口：资料、地址、愿望清单、订单读取、零售促销计算、零售商品目录。
- 复用既有 `Consumer`、`Order`、`Product`、`PromotionRule` 模型与 `serializePublicProductRow`、`calculatePromotion` 逻辑，不新建第二套商品/订单/促销数据源。
- 所有写操作以 `consumer` JWT 身份为准，禁止信任客户端传入的 `consumerId`。
- 前端不再静默吞掉这些接口的错误。

### 非目标

- 不开放消费者结账下单。`ConsumerCheckout` 的「结账暂不可用」保持不变：VAT 服务端税额、按卖家拆分订单、卖家银行账户核验属于独立任务，需单独规格与审批。
- 不实现积分抵扣（`usedPoints` 暂时只回显 0，不参与计算）。
- 不改造 B2B 买家（`Customer`）链路与商家后台。

## 3. 现状审计与防重复检查（必填）

- 已检查的源码/路由/模型/测试：
  - `src/context/B2BContext.tsx`（消费者状态与 API 调用）
  - `src/apps/shared/components/consumer/*`（Store/Cart/Checkout/Account/Orders/Wishlist）
  - `src/apps/shared/PublicFrontendApp.tsx`（视图路由）
  - `server.ts` 消费者段（`/api/consumers/register|login|me`）、`/api/products`、`/api/promotions/quote`、`/api/orders`
  - `prisma/schema.prisma`：`Consumer`、`Order`、`OrderItem`、`Product`、`PromotionRule`、`CouponRedemption`
  - `src/utils/promotion-calculator.ts`、`src/server/publicProductVisibility.ts`
- 关键词/目录搜索结果：`consumers/me`、`retail`、`wishlist`、`promotion`、`addresses`。
- 可复用的现有能力：
  - 商品可见性与序列化：`PUBLIC_PRODUCT_VISIBILITY_FILTER`、`PUBLIC_STOREFRONT_MERCHANT_FILTER`、`getAuthorizedProductVisibility()`、`serializePublicProductRow()`（`/api/products` 已在用）。
  - 促销计算：`calculatePromotion()` + `getPromotionCalculationRule()` + `isPromotionActive()`（`/api/promotions/quote` 已在用），本次只把渠道从 `wholesale` 扩到 `retail`。
  - 身份：消费者 JWT（`JWT_BUYER_SECRET`，`role === 'consumer'`），`/api/consumers/me` 已在使用。
- 是否存在同类数据表：`Consumer.addresses` 已是 JSON 列（既有设计），地址不新建表；`Order` 已有 `customerId`（B2B），消费者订单通过新增可空 `consumerId` 复用同一张表，避免第二套订单。
- 现有方案为何不能直接满足：`/api/products` 是批发口径（`wholesalePrice`、买家可见性），消费者需要零售口径（`rrpPrice`）与消费者身份；`/api/promotions/quote` 绑定 `Customer` KYC 与 `discountRate`，不能直接给消费者使用。
- 如何避免第二套权威实现：零售接口只做「筛选 + 调价口径转换」，可见性、促销规则、商品序列化全部复用同一批函数；`Order` 不复制表。

## 4. 归属与边界

- 所属业务域：公共前台 / 消费者零售。
- 运行面：`frontend-web`、`frontend-mobile`（共享 `PublicFrontendApp`）。
- 模块负责：消费者自助账户数据（资料、地址、收藏）、零售商品目录读取、零售促销试算、消费者订单读取。
- 模块不负责：结账下单、支付、退款、库存扣减、VAT、积分结算。
- 调用方：`src/context/B2BContext.tsx` → `src/apps/shared/components/consumer/*`。
- 依赖方：`Product`、`Order`、`PromotionRule`、`Consumer`。

## 5. 用户角色与权限

- 角色：`consumer`（`Consumer.status === 'active'`）。
- 认证：`Authorization: Bearer <token>` 或 Cookie `ruda_consumer_jwt`，`verifyToken(token, JWT_BUYER_SECRET)` 且 `payload.role === 'consumer'`。
- 资源归属：`consumerId` 一律来自 token；请求体/查询中的 `consumerId` 忽略。
- 审计：资料与地址变更为低风险自助操作，不写管理员审计；写操作记录服务端错误日志上下文（`sendInternalError` 标签）。
- 高风险：本次无金额、库存、权限变更。

## 6. 用户流程与状态机

### 正常流程

1. 消费者登录 → 打开「我的账户」→ `GET /api/consumers/me`（既有）。
2. 修改资料 → `PATCH /api/consumers/me` → 返回更新后的安全字段。
3. 地址管理 → `GET /api/consumers/me/addresses` → `POST`/`PUT`/`DELETE`，服务端校验必填项并限制条数上限 10。
4. 收藏 → `POST/DELETE /api/consumers/me/wishlist/:productId`，`GET` 返回可购买商品列表。
5. 购物袋 → `POST /api/promotions/calculate/retail` 用服务端零售价与促销规则试算。
6. 我的订单 → `GET /api/consumers/me/orders` 返回本人订单（当前无写入方，因此为空数组）。

### 状态与允许转换

| 当前状态 | 操作/事件 | 目标状态 | 服务端校验 | 失败处理 |
|---|---|---|---|---|
| 无地址 | POST 地址 | 已保存 | 必填字段 + 上限 10 | 400 `CONSUMER_ADDRESS_INVALID` / 409 `CONSUMER_ADDRESS_LIMIT_REACHED` |
| 有地址 | PUT `/addresses/:id` | 已更新 | id 必须存在 | 404 `CONSUMER_ADDRESS_NOT_FOUND` |
| 有地址 | DELETE `/addresses/:id` | 已删除 | id 必须存在 | 404 `CONSUMER_ADDRESS_NOT_FOUND` |
| 未收藏 | POST wishlist | 已收藏 | 商品必须可公开购买 | 404 `PRODUCT_NOT_AVAILABLE` |
| 已收藏 | DELETE wishlist | 未收藏 | 幂等 | 200 |
| 会话失效 | 任意请求 | 401 | token 校验 | `CONSUMER_AUTH_REQUIRED` / `CONSUMER_SESSION_INVALID` |

### 异常流程

- 无权限：401 `CONSUMER_AUTH_REQUIRED`；账号非 `active`：401 `CONSUMER_SESSION_INVALID`。
- 输入错误：400，字段校验不接受空值或超长字符串。
- 外部依赖失败：`sendInternalError`，不暴露堆栈。
- 重复提交/并发：地址写入采用读改写 + 单次 `$transaction`（JSON 列），收藏依赖唯一约束幂等。
- 超时/中断：前端展示可重试提示，不保留乐观成功状态。

## 7. UI/UX 规范

- 页面：`ConsumerAccount`、`ConsumerStore`、`ConsumerCart`、`ConsumerOrders`、`ConsumerWishlist`（既有，不改布局）。
- 文案：沿用现有简体中文/意大利文混排的 `localizeCopy` 约定，不新增装饰性文案。
- 状态：加载/空/错误使用既有卡片与提示；本次把原本被 `catch {}` 吞掉的错误改为 `addNotification('warning', ...)`。
- 真实数据源：全部来自上述服务端接口。

## 8. API 契约

复用：`GET /api/consumers/me`、`GET /api/products`、`POST /api/promotions/quote`（B2B，不改）。

新增（均为消费者身份）：

| 方法 | 路径 | 说明 |
|---|---|---|
| PATCH | `/api/consumers/me` | 更新 `firstName`/`lastName`/`phone`/`country`/`currency`/`preferredLang`/`newsletterOptIn` |
| GET | `/api/consumers/me/addresses` | `{ success, addresses }` |
| POST | `/api/consumers/me/addresses` | `{ success, address }` |
| PUT | `/api/consumers/me/addresses/:id` | `{ success, address }` |
| DELETE | `/api/consumers/me/addresses/:id` | `{ success }` |
| GET | `/api/consumers/me/wishlist` | `{ success, items }`（`Product[]`） |
| POST | `/api/consumers/me/wishlist/:productId` | 幂等收藏 |
| DELETE | `/api/consumers/me/wishlist/:productId` | 幂等取消 |
| GET | `/api/consumers/me/orders` | `{ success, orders }` |
| POST | `/api/promotions/calculate/retail` | `PromotionCalculationResult` |
| GET | `/api/retail/products` | `{ success, items, total, page, limit }` |
| GET | `/api/retail/products/:idOrStyleNo` | `Product` |

错误结构：`{ success: false, error: '<CODE>' }`，与既有接口一致。
零售试算的例外：优惠券不可用时不返回错误码，而是在 200 响应中带 `couponError`（`PROMOTION_CODE_INVALID_OR_INACTIVE` / `PROMOTION_NOT_APPLICABLE` / 使用上限），
同时 `discountTotal` 为 0，前端据此提示「优惠券不可用」但仍能显示正确的商品小计与运费。
幂等：收藏 `POST/DELETE` 幂等；地址写操作以 id 为准。
分页：零售商品列表 `page`（默认 1，上限 100）、`limit`（默认 24，上限 60）。
限流：复用公共读接口既有策略，本次不新增写限流桶（地址/收藏为低频自助写）。

## 9. 数据与持久化

- 权威模型：
  - `Consumer.addresses`（JSON 数组，既有列）→ 地址。
  - `ConsumerWishlistItem`（新增）→ 收藏关系，`@@unique([consumerId, productId])`，级联删除。
  - `Order.consumerId`（新增可空）+ 索引 → 消费者订单归属，复用既有订单表。
- 迁移：`prisma/migrations/20261029120000_consumer_account_closure/migration.sql`（仅新增表/列/索引/外键，无数据回填）。
- 回滚：删除新表、`Order.consumerId` 列与索引即可；不影响既有 B2B 数据。
- 派生数据：无。

## 10. 集成与事件

- 本次不发布业务事件（无订单/支付写入）。
- 日志：`sendInternalError(res, error, 'consumer-*')` 标签。

## 11. 测试计划

- 单元：地址校验与上限、零售价选取、促销渠道判定（`tests/consumer-account-contract.test.ts`）。
- 路由契约：新增 `tests/api-route-existence.test.ts`，校验前端/小程序字面 API 路径均存在于 `server.ts`，已知未闭环路径以显式清单登记。
- 权限：静态断言消费者接口使用 token 内 `consumerId`，不接受请求体 `consumerId`。
- 视觉：桌面与手机端打开「我的账户」「商城」「购物袋」，记录空态与错误态；无真实数据时仅标记代码检查完成。

## 12. 验收标准（必须可验证）

- [ ] 消费者登录后资料保存返回 200 并持久化。
- [ ] 地址增删改查返回真实数据，刷新后仍在。
- [ ] 收藏写入后 `GET` 返回同一商品；重复收藏不报错。
- [ ] 零售促销计算使用服务端价格，伪造 `unitPrice` 无效。
- [ ] 零售商品列表只返回可公开购买商品。
- [ ] 所有接口拒绝未认证与伪造 `consumerId` 的请求。
- [ ] `npm run lint`、`npm run test:unit`、`npm run build` 通过。

## 13. 部署、兼容和回滚

- 环境变量：无新增。
- 数据迁移：需执行 `prisma migrate deploy`（仅新增结构）。
- 受影响构建目标：`frontend-web`、`frontend-mobile`、`server`。
- 发布顺序：先迁移，再发布服务端，最后发布前端。
- 回滚：回滚代码后新表/新列可保留（不被旧代码读取），或按 §9 逆向删除。

## 14. 风险、假设与待确认

- 风险：`Consumer.addresses` 为 JSON 列，并发写同一消费者时存在读改写覆盖风险；本次用 `$transaction` + 行内二次读取降低，仍非强一致。
- 假设：消费者订单未来写入同一 `Order` 表，`consumerId` 为归属字段。
- 待确认：消费者结账、VAT、按卖家拆单的最终产品方案。

## 15. 实施记录（开发后补充）

- 变更文件：
  - `prisma/schema.prisma`、`prisma/migrations/20261029120000_consumer_account_closure/migration.sql`
  - `src/server/consumerAccount.ts`（地址/资料校验单一实现）、`src/shared/consumerRetail.ts`（配送口径常量）
  - `server.ts`（12 个消费者/零售接口 + `serializeConsumerOrder` + 图片任务 `status` 契约修复）
  - `src/context/B2BContext.tsx`、`src/apps/shared/components/consumer/ConsumerCart.tsx`
  - `tests/consumer-account-contract.test.ts`、`tests/api-route-existence.test.ts`
- 执行命令与结果：
  - `npx tsc --noEmit` → 0 错误
  - `node --import tsx --test tests/consumer-account-contract.test.ts` → 7/7 通过
  - `node --import tsx --test tests/api-route-existence.test.ts` → 2/2 通过
  - `npm run test:unit` → 1142 项，1138 通过（4 项为本任务前既存失败：小程序 POS 展开语法 1 项、ModaUI 布局守卫 2 项、UI 文案目录 1 项）
  - `npm run build` → 成功
  - `bash scripts/test-consumer-account-isolated.sh`（一次性 PostgreSQL + 全量迁移 + 真实服务端）→ **21 项 HTTP 校验全部通过**
    （注册/登录、401 鉴权、资料 PATCH 与受保护字段忽略、空补丁拒绝、地址增改查删与校验、收藏拒绝不可售商品、订单读取、零售目录、零售商品 404、零售试算 409、试算未登录 401）
- 未完成项：消费者结账下单（VAT / 拆单 / 转账核验）仍关闭；小程序试衣的 `images/tasks/:id` 轮询路由不存在（同步返回后已不需要轮询，但客户端仍保留恢复逻辑，见 `tests/api-route-existence.test.ts` 的 `KNOWN_UNIMPLEMENTED`）。

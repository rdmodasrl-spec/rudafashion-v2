# 用户端小程序「我的」页面与授权码找店

- 模块 ID：`miniprogram-profile`
- 状态：**部分完成**（页面、底部导航第 5 项、只读授权列表接口、订单口径纯函数、定向测试已完成；微信开发者工具/真机视觉与真实登录态验收未执行，因此不得标记为「已完成」）
- 关联文档：[`miniprogram-modaui.md`](./miniprogram-modaui.md)、[`miniprogram-fashion-parity.md`](./miniprogram-fashion-parity.md)、[`platform-feature-flags.md`](./platform-feature-flags.md)、[`../module-registry.md`](../module-registry.md)、`AGENTS.md` §3/§4/§5/§6/§13
- 变更日期：2026-10-28

---

## 0. 目标与非目标

### 0.1 目标

1. 用户端小程序（`miniprogram/`）底部第五个 tab 由「商城」调整为「我的」，其余四项（首页、商家、ModaUI、时尚）保持不变；首页仍是商城入口，不改动首页。
2. 「我的」为真实数据驱动的个人中心：账户身份与资质、订单状态速览、可用服务、账户与设置。
3. 「我的」内提供**授权码找店**入口：平时不占空间，点击后弹出输入框，由服务端验证商家授权码，成功后进入该商家真实店铺。
4. 只呈现后端真实存在的能力；没有服务端实现的入口（收藏商品、关注商家、浏览记录、收货地址簿）不渲染，避免「点了报错」。
5. 所有金额、状态、权限判断沿用服务端权威口径，前端只做展示与导航。

### 0.2 非目标（本次明确不做）

- 不修改首页（`pages/home/index`）、商家、ModaUI、时尚四个 tab 的页面与业务。
- 不新增第六个底部导航，不增减底部导航数量（仍为五项）。
- 不新建收藏 / 关注商家 / 浏览记录 / 收货地址簿的存储与接口（当前买家侧无权威实现，见 §9）。
- 不新建第二套授权体系：授权码验证复用既有 `/api/merchants/code/:code`，商品可见性复用既有 `getAuthorizedProductVisibility` 规则。
- 不改动商家后台三端与商家小程序；本次只涉及买家侧小程序 + 一个买家只读接口。

---

## 1. 改前实测事实

| 事实 | 证据 |
|---|---|
| 底部五项为 首页 / 商家 / ModaUI / 时尚 / **商城** | `miniprogram/app.json` `tabBar.list` 第 5 项 `pages/market/index`；`miniprogram/custom-tab-bar/index.js` `ALL_TABS` 第 5 项文案 `商城` |
| 小程序没有「我的」页面 | `miniprogram/app.json.pages` 中无 `pages/profile/*`；账户入口分散在 `pages/settings/index`（汉堡菜单入口） |
| Web 手机端五项为 首页 / 找店 / ModaUI / 时尚 / **我的** | `src/apps/shared/components/MobileBottomNav.tsx` 的 `account` tab（`我的`/`Account`） |
| 商城 tab 与首页内容重复 | `pages/market/index` 为「公共商城」商品列表；需求确认首页即商城 |
| 授权码找店已有前端页面，但 RUDA 长码分支无服务端实现 | `miniprogram/pages/find-store/index.js:193` 调用 `redeemStoreAccessCode` → `POST /api/vault/store-access/redeem`；全仓 `grep 'store-access'` 仅命中 `miniprogram/utils/api.js:160`，`server.ts` 无该路由 |
| 真正可用的服务端授权码为 6 位商家编号 | `server.ts:15152` `GET /api/merchants/code/:storeLookupCode`，校验 `^\d{6}$`、`isPublicStorefront`，返回 `storeSlug`；`Merchant.storeLookupCode`（唯一、序列生成） |
| 买家无收藏 / 关注商家 / 浏览记录 / 地址簿接口 | `grep '/api/favorites'`、`followMerchant`、`recentlyViewed`、`browseHistory` 在 `server.ts`/`src/server` 均无命中；`/api/consumers/me/wishlist`、`/api/consumers/me/addresses` 属于消费者（零售）身份，与小程序买家 JWT 不是同一身份体系 |
| 买家侧有真实的订单 / 通知 / 授权申请能力 | `/api/orders`（`server.ts:16847`，`requireBuyerAuth`）、`/api/notifications`（`server.ts:16998`）、`/api/vault/status`、`/api/vault/request`（`server.ts:17471`/`17499`） |
| 买家缺少「我的授权」列表读取接口 | 只有按 `merchantIds` 查询的 `/api/vault/status`，无法列出买家全部授权 → 本次补齐只读接口（§5） |

结论：本次不是「新建个人中心系统」，而是把已有的账户、订单、通知、授权、设置能力收敛到一个真实入口，并让授权码找店改走真正存在的服务端验证。

---

## 2. 复用审计（防重复）

检索关键字：`profile`、`personal`、`account`、`我的`、`redeemStoreAccessCode`、`storeLookupCode`、`vault`、`notifications`、`getAuthProfile`、`getBuyerOrders`。

| 能力 | 现有权威实现 | 复用结论 |
|---|---|---|
| 底部导航 | `miniprogram/app.json` + `custom-tab-bar/index.js`（含平台开关过滤） | **复用**，只改第 5 项指向 `pages/profile/index`，保留 `fashion_enabled`/`modaui_enabled` 过滤逻辑 |
| 买家身份与会话 | `utils/auth.js`（`getAuthSession`/`getVerifiedAuthProfile`）、`/api/auth/me/buyer` | **复用**，不新增登录或会话校验 |
| 订单列表与状态 | `pages/orders/index`、`GET /api/orders`、`serializeOrderRow` | **复用**：订单卡片与动作全部保留，仅新增列表筛选参数 |
| 订单数量口径 | 服务端 `status`/`paymentStatus`/`currentTasks.buyer.action` 字段 | 纯函数 `utils/order-summary.js` 只做展示映射，**不产生新状态**，不改服务端 |
| 消息通知 | `GET /api/notifications`、`POST /api/notifications/:id/read` | **复用**，新增小程序只读页面与 `api.js` 包装 |
| 商品授权（看货授权） | `VaultAccessRequest` + `/api/vault/status`、`/api/vault/request`、`isActiveVaultAuthorization` | **复用**模型与状态判定；仅新增买家只读列表路由 |
| 授权码找店 | `GET /api/merchants/code/:storeLookupCode`、`pages/store/index` | **复用**，不新建验证逻辑，不做前端放行 |
| 账户偏好与语言 | `pages/settings/index`、`utils/preferences.js`、`/api/account/preferences` | **复用**，`我的` 只做入口跳转 |
| 客服 / 隐私 / 协议 | `pages/support/index`、`pages/privacy/index`、`pages/service-agreement/index` | **复用** |
| 商家工作区 | `pages/merchant/index`（商家/员工会话） | **复用**，按角色显示 |
| 平台开关 | `/api/public/feature-flags`、`utils/module-flags.js` | 不改动；`我的` 不参与模块开关，开关关闭时仍可用 |

**为什么必须新增 `GET /api/vault/authorizations`**：买家已有申请与商家已有审核，但买家无法读取「我有哪些授权」，只能凭猜测的 `merchantIds` 调用 `/api/vault/status`。该路由是同一权威模型上的只读投影，不复制业务规则、不引入第二份授权数据。

**为什么新增 `utils/order-summary.js` 纯函数**：订单速览需要在页面渲染前汇总，若直接写在 `wxml` 会形成不可测的重复口径。纯函数集中一处，可被 `tests/` 直接调用验证。

---

## 3. 导航与页面归属

| 项 | 改动前 | 改动后 | 说明 |
|---|---|---|---|
| 第 1 项 | 首页 `pages/home/index` | 不变 | 首页即商城，不改 |
| 第 2 项 | 商家 `pages/merchants/index` | 不变 | |
| 第 3 项 | ModaUI `pages/modagpt/index` | 不变 | 仍受 `modaui_enabled` 控制 |
| 第 4 项 | 时尚 `pages/fashion/index` | 不变 | 仍受 `fashion_enabled` 控制 |
| 第 5 项 | 商城 `pages/market/index` | **我的 `pages/profile/index`** | 首页已承担商城职责；底部不得出现第六项 |

- `pages/market/index` 文件保留并仍在 `app.json.pages` 中，作为普通页面可被打开，只是不再是 tab；因此原本对它使用 `wx.switchTab` 的两处调用（`pages/cart/index.js`、`pages/product/index.js`）改为回首页 tab，避免 `switchTab` 调用非 tab 页失败。
- 新增页面：`pages/profile/index`、`pages/authorizations/index`、`pages/notifications/index`，全部在 `app.json.pages` 注册，四个源文件（js/json/wxml/wxss）齐备。

---

## 4. 数据归属

| 数据 | 权威来源 | 小程序侧 | 是否缓存 |
|---|---|---|---|
| 账户身份、企业名、资质状态 | `Customer`（买家）/ `Merchant`+`MerchantEmployee`（商家/员工），JWT 由服务端签发 | 会话副本 `utils/auth.js`，进入页面时以 `/api/auth/me/*` 复核 | 仅 wx storage 保存会话；页面 `onShow` 重新拉取 |
| 订单与状态 | `Order` + `OrderAgreement` + `CurrentTasks`（`GET /api/orders`） | 只做展示映射 | 不缓存 |
| 消息通知 | `NotificationEvent`（`GET /api/notifications`） | 最新 30 条 | 不缓存 |
| 商品授权 | `VaultAccessRequest`（新增 `GET /api/vault/authorizations`） | 只读列表 | 不缓存 |
| 店铺与授权码 | `Merchant.storeLookupCode`、`storefrontEnabled`、`isVerified`（`GET /api/merchants/code/:code`） | 只做跳转 | 不缓存 |
| 授权商品可见性 | `getAuthorizedProductVisibility` + `getBuyerVaultAccessStatus`（服务端） | 不参与判断 | 无 |

---

## 5. API 契约

### 5.1 新增：`GET /api/vault/authorizations`

- 用途：买家读取自己的看货授权申请及当前有效状态。
- 认证：`requireBuyerAuth`（Bearer `ruda_buyer_jwt`）；未登录 401。
- 租户/身份边界：`customerId` 只从令牌解析，**不接受**客户端传入的 `customerId`/`merchantId` 过滤。
- 请求：无参数（上限 100 条，按申请时间倒序；同一商家只保留最新一条）。
- 响应：

```json
{
  "success": true,
  "authorizations": [
    {
      "id": "vr-...",
      "merchantId": "…",
      "merchantName": "…",
      "storeSlug": "…",
      "status": "approved",
      "appliedAt": "2026-10-20 10:00:00",
      "expiresAt": "2026-12-31T00:00:00.000Z"
    }
  ]
}
```

- `status` 取值：`approved`（有效）、`expired`（曾批准但已过期）、`pending`（待商家审核）、`rejected`（已拒绝）。
- `storeSlug` 仅在商家店铺当前公开（`isPublicStorefront`）时返回，否则为 `null`，小程序不提供进入店铺动作。
- 错误：401 沿用 `requireBuyerAuth` 现有错误体；500 走 `sendInternalError`，不暴露内部信息。
- 缓存：`Cache-Control: no-store`。
- 幂等性：只读，天然幂等。
- 限流：本次不新增限流器（与同域只读的 `/api/notifications` 一致）；页面不轮询，仅在 `onShow` 与下拉刷新时请求。

### 5.2 复用：`GET /api/merchants/code/:storeLookupCode`

- 已存在。仅接受 6 位数字；校验商家存在且店铺公开；返回 `{ success: true, storeSlug }`。
- 400 `MERCHANT_STORE_CODE_INVALID`（格式不符）、404 `MERCHANT_STORE_NOT_FOUND`（无此编号或店铺未公开）。
- 「我的」弹窗只提交 6 位授权码；不把店铺 slug 或前端输入当作授权凭证。
- 进入店铺后，普通商品与授权商品仍按服务端可见性规则返回；拿到授权码不等于拿到私密货盘权限。

### 5.3 复用：`GET /api/orders`、`GET /api/notifications`、`POST /api/notifications/:id/read`

- 契约不变，小程序只新增 `api.js` 包装函数：`getBuyerAuthorizations`、`getBuyerNotifications`、`markBuyerNotificationRead`。

---

## 6. 权限与边界

- 未登录：显示登录/注册入口；不显示任何数字（不以 0 冒充真实数据）；订单、授权、消息入口点击后先引导登录，不显示他人数据。
- 买家：`/api/orders`、`/api/notifications`、`/api/vault/authorizations` 均只返回令牌对应 `customerId` 的数据。
- 商家 / 员工：显示真实商家名与角色，并提供既有「商家中心」入口；不调用买家接口。
- 员工会话失效或商家店铺未公开时，服务端 `/api/auth/me/employee` 返回 `success:false`，`utils/auth.js` 清除会话，页面回到未登录态。
- 授权码验证不依赖前端；前端只把服务端结果用于跳转或提示。

---

## 7. 页面结构与交互

### 7.1 我的（`pages/profile/index`）

1. **身份区**：真实头像或姓名首字；买家显示联系人 + 企业名 + 资质状态（`approved` = 企业资质已通过，其余 = 资质审核中）；商家/员工显示商家名 + 角色。未登录显示「登录 / 注册 RUDA 账号」。
2. **我的订单**：右侧「全部订单」；四格真实计数：待付款、待发货、运输中、售后服务。数字来源于 `/api/orders`；加载中显示占位，失败显示「订单暂时无法加载」，未登录显示登录提示。
3. **服务**：授权码找店、商品授权（已授权数量）、消息通知（未读数）。均为单行入口，统一图标与右侧箭头。
4. **账户与设置**：个人资料与账户安全、语言设置（均进入既有 `pages/settings/index`）、帮助与联系客服、隐私政策、服务条款；商家/员工额外显示商家中心。
5. 底部：`RUDA · Fashion Business` 静态品牌行。

### 7.2 授权码找店弹窗

- 触发：服务区「授权码找店」行，页面不常驻搜索框。
- 弹窗内容仅：标题、提示「请输入商家提供的授权码」、6 位数字输入框、错误提示、主按钮「验证并进入店铺」。
- 关闭方式：右上关闭、点击遮罩关闭；再次打开时清空输入与错误。
- 提交：`loading` 状态禁用按钮，防重复提交；成功后 `wx.navigateTo('/pages/store/index?storeSlug=…')` 并关闭弹窗；失败按 §5.2 错误码给出可读原因，允许修改后重试。
- 输入只接受 6 位数字（前端先做格式校验减少无效请求，服务端仍是最终判定）。

### 7.3 商品授权（`pages/authorizations/index`）

- 读取 `GET /api/vault/authorizations`；每条显示商家名、状态标签、申请时间、到期时间（有则显示）。
- `approved` 且有 `storeSlug` 时可进入店铺；`pending`/`rejected`/`expired` 仅展示，不提供绕过动作。
- 空状态：说明「还没有向商家申请看货授权」，并提供前往商家页的入口。

### 7.4 消息通知（`pages/notifications/index`）

- 读取 `GET /api/notifications`；显示未读标记；点击未读项调用 `POST /api/notifications/:id/read` 并本地更新未读数。
- 空状态、加载失败重试均实现；不做轮询。

### 7.5 订单页筛选

- `pages/orders/index` 增加可选参数 `filter`（`pendingPayment` / `toShip` / `shipping` / `afterSales`），只对已加载列表做本地筛选，并在页头显示当前筛选与「显示全部」。
- 订单卡片、付款、约定确认、取消等既有动作不变。

---

## 8. 状态与错误处理

| 场景 | 表现 |
|---|---|
| 未登录 | 身份区登录按钮；订单/授权/消息区显示登录提示，不显示 0 |
| 加载中 | 各区块独立 loading 文案，不阻塞其它区块 |
| 接口失败 | 显示可读原因 + 重试入口，不显示伪造数字 |
| 401 | `apiRequest` 清除会话；页面回到未登录态并提示重新登录 |
| 授权码格式错误 | 弹窗内提示「请输入 6 位数字授权码」，不发请求 |
| 授权码不存在/店铺未公开 | 「未找到该授权码对应的公开店铺」 |
| 授权码请求过于频繁（若上游未来加限流） | 429 时提示「验证次数过多，请稍后再试」 |
| 收藏/关注/浏览/地址 | 不渲染入口（无权威实现） |

---

## 9. 不渲染的入口与原因

| 需求项 | 结论 | 原因 |
|---|---|---|
| 我的收藏（商品） | 不实现 | 买家侧无收藏表与接口；`/api/consumers/me/wishlist` 属于零售消费者身份，不可借用买家 JWT |
| 关注的商家 | 不实现 | 无买家-商家关注模型与接口（`MerchantCustomerLink` 是商家侧客户关系，不是买家关注） |
| 浏览记录 | 不实现 | 无浏览上报/读取接口 |
| 收货地址簿 | 不实现 | 小程序下单在 `pages/checkout` 逐单填写地址，无买家地址簿接口 |
| RUDA 长码（`RUDA-…`）授权 | 不在「我的」提供 | `POST /api/vault/store-access/redeem` 在仓库与生产 bundle 中均不存在，`StoreAccessCredential` 只有表结构、无签发与核销实现；为避免「点了报错」，「我的」只接受 6 位商家授权码。既有 `pages/find-store` 的长码分支属历史遗留死分支，不在本次改动范围内，需另行补齐服务端能力后再启用 |

上述缺口如需上线，必须先补服务端模型/接口并更新本文档，不得先做前端假入口。

---

## 10. 测试与验收

### 10.1 机械测试（`tests/miniprogram-profile.test.ts` 等）

1. 底部五项文案与路径为 首页 / 商家 / ModaUI / 时尚 / 我的，且第 5 项为 `pages/profile/index`（同时更新 `tests/miniprogram-navigation.test.ts`）。
2. 新页面已注册且四个源文件存在。
3. `summarizeBuyerOrders` 对固定订单样本给出 待付款/待发货/运输中/售后 计数，未登录返回 `null`。
4. `normalizeStoreCode` 只接受 6 位数字。
5. `server.ts` 中 `GET /api/vault/authorizations` 存在，挂在 `requireBuyerAuth` 下，按 `req.buyer.customerId` 过滤，且不接受客户端传入的 `customerId`。
6. `miniprogram/utils/api.js` 导出三个新包装函数，路径与服务端一致。
7. 页面不得出现「我的收藏 / 关注的商家 / 浏览记录 / 收货地址」等无后端支撑的入口文案。
8. `tests/miniprogram-profile-page.test.ts` 用 vm + 假 `require` 直接运行 `pages/profile/index.js`：买家身份渲染、订单速览聚合、未登录引导登录、授权码格式错误不发请求、有效码跳转真实店铺、404 时保留弹窗并可重试、商家会话不加载买家订单。

### 10.2 待人工/真机验收（本次未执行）

- 微信开发者工具或真机：登录/未登录两种身份区、订单四格数字、授权码弹窗开关与四种结果、进入正确店铺、授权页与消息页真实数据、窄屏与安全区适配。
- 真实买家账号下的订单/通知/授权数据一致性。

---

## 11. 影响范围与回滚

- 影响：用户端小程序导航与新增三个页面；`pages/orders` 增加可选筛选；`pages/cart`、`pages/product` 两处 `switchTab` 目标改为首页；`server.ts` 新增一条买家只读路由。
- 不影响：Web / 手机 Web / 商家后台三端 / 商家小程序 / 平台后台 / 数据库结构（无迁移）。
- 回滚：还原 `miniprogram/app.json` 第 5 项为 `pages/market/index` 文案「商城」，删除 `custom-tab-bar` 第 5 项改动与三个新页面目录，删除 `server.ts` 的单条路由即可；无数据变更、无需回滚迁移。

---

## 12. 本次验证记录（2026-10-28）

| 项目 | 命令/方式 | 结果 |
|---|---|---|
| 小程序 JS 语法 | `node --check`（`utils/api.js`、`utils/order-summary.js`、`pages/profile|authorizations|notifications|orders|login|cart|product`、`custom-tab-bar/index.js`） | 全部通过，无输出 |
| `app.json` 结构 | `JSON.parse` 校验 | `app.json ok` |
| 定向测试 | `node --import tsx --test tests/miniprogram-*.test.ts tests/platform-global-switches.test.ts tests/modaui-miniprogram-flag.test.ts` | `# pass 95 / # fail 0`，`exit=0`（其中本次新增 14 项：`miniprogram-profile` 9 项 + 页面行为 5 项） |
| WXML 指令检查 | `node scripts/check-wxml-directives.mjs miniprogram` | `26 个文件，0 个问题` |
| 类型检查 | `npx tsc --noEmit --pretty false` | `exit=0`（包含新增 `/api/vault/authorizations` 路由） |
| 真实授权码接口 | `curl http://127.0.0.1:3012/api/merchants/code/{000001,000002,999999,abc}` | `200 {"storeSlug":"modaui"}` / `404 MERCHANT_STORE_NOT_FOUND` / `404 MERCHANT_STORE_NOT_FOUND` / `400 MERCHANT_STORE_CODE_INVALID`，与弹窗错误映射一致 |
| 授权数据读取 | 临时只读 Prisma 脚本（已删除）查询 `VaultAccessRequest` 与 `Merchant` | 字段可用；当前库中 `VaultAccessRequest` 为 0 条（授权页会走空状态）；3 个商家编号 `000001`/`000002`/`000003`，其中 `000002` 店铺未公开 |
| 新路由在线状态 | `curl http://127.0.0.1:3012/api/vault/authorizations` | 返回 SPA HTML：当前运行的进程是改动前启动的，**新路由需重启/部署后生效**（见 §12.1） |
| UI 检测器 | `.agents/skills/impeccable/scripts/impeccable detect miniprogram/pages` | `exit=0`，但工具只解析 `.js`，WXML/WXSS 规则未执行，**不能据此声称视觉合格** |
| 真机/开发者工具 | — | **未执行**，见 §10.2 |

### 12.1 上线顺序要求

1. 先部署服务端（新路由），再发布小程序版本；反过来会出现「商品授权」区块显示加载失败（前端会优雅降级，不会显示假数据）。
2. 本次未重启 PM2 进程 `ruda-fashion`，也未重建 `dist/server.cjs`；仓库改动尚未部署到生产。
3. 小程序包内 `utils/api.js` 的基址为 `https://ruda.fashion`，发布前需在微信后台确认 request 合法域名（既有要求，未变化）。

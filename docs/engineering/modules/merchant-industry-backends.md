# 模块规格：七种行业商家后台（强隔离）与行业模板映射

- Module ID：`merchant-industry-backends`
- 模块状态：部分完成（架构、五类行业工作区、连锁门店/调拨、POS 销售记录已实现；真实三端会话与小程序视觉待验收）
- 文档阶段：开发中（先于本轮代码落盘，2026-10-28）
- 日期：2026-10-28
- 对应运行面：商家电脑网页端（`merchant-admin-web`）、商家手机网页端（`merchant-admin-mobile`）、商家小程序（`merchant-miniprogram`）、公共注册入口、`/api/merchant/*` 服务端
- 关联文档：[`merchant-industry-workspace-template.md`](./merchant-industry-workspace-template.md)、[`identity-merchant-onboarding.md`](./identity-merchant-onboarding.md)、[`merchant-three-end-matrix.md`](./merchant-three-end-matrix.md)

## 1. 问题与目标

仓库已有 7 个商家经营类型模板（`src/constants/merchantIndustryTemplates.ts`）与对应工作区模板，但前端只有一个 `IndustryMerchantWorkspace` 组件，用 `definitions[templateId]` 切换标题、标签和少量字段。结果是：

- 服装批发商、贸易批发商、百货批发商、箱包批发商、百货连锁店、综合零售商实际是同一个页面，只是文案不同。
- 商品表单强制使用服装款号/颜色/尺码语义，贸易与零售商品无法录入正确属性。
- 库存只有单仓 SKU 明细，没有门店、门店库存与调拨；`/api/merchant/transfers` 直接返回 `SINGLE_WAREHOUSE_ONLY`。
- 没有 POS 销售记录，无法证明零售结账与库存扣减一致。
- 各行业没有独立导航配置、独立校验和独立测试，任一行业改动都可能影响其他行业。

本模块的目标：把 7 种后台做成**真正独立的行业模块**，公共基础能力复用，行业业务、页面、字段、导航、校验和测试分开；服装生产批发商后台（`MerchantPortal`）保持现状不重建。

### UI 锁定决策（2026-10-29）

本模块业务实现必须遵守根级 [RUDA 工程铁规](../../../AGENTS.md) §15.5：现有服装生产批发商后台（`MerchantPortal`）及其线上旧版是七行业共同的视觉与交互基准。七行业升级只改真实业务字段、数据、流程、可用模块和授权；不重新设计后台、不替换既有顶部栏/商家信息区/导航/主工作区，不重排原有导航，不删减生产批发后台能力。Web 与手机端都保持原有布局体系和响应式行为。

每个原有版块的 AI 助手栏必须保留原位置、宽度、交互方式和当前业务上下文联动；行业或页面切换不能令其消失、仅留在首页、改为独立大页面或挤压主工作区。AI 只呈现已经连接真实数据/API 的能力，未实现动作需明确标记未完成。行业模块可以独立实现业务，但共享原外壳与公共设计组件，不把全部行业判断堆入单一巨型组件。

### 六行业布局整改方案（用户已确认并已接入，视觉验收部分完成）

- 电脑 Web：六行业业务模块通过 `MerchantPortal` 的内容区呈现，复用其顶部栏、左侧导航、窄屏水平导航、响应式主工作区和上下文 AI 助手。行业操作映射到现有导航分组；连锁门店、调拨、POS 销售/班次等没有独立旧导航项的能力从对应既有业务页面进入，不增加第二套全局导航。
- 手机 Web：六行业业务页面通过 `MerchantMobileApp` 既有底部主导航、更多页和 ModaUI 入口呈现，维持原安全区、返回路径和触控布局；不显示 `IndustryWorkspaceShell` 自有全局导航。各行业页面继续复用当前行业组件/API，不复制数据访问逻辑。
- 七行业均以服务端行业模板/能力清单选择业务组件；所有改动限于呈现适配、导航状态映射和可访问的业务入口。商品、库存、采购、订单、门店、POS、员工和权限接口及数据所有权不变。
- 窄屏下旧版水平导航必须先于行业内容渲染；若行业页面替换主内容时隐藏该导航，应修复分支位置而非新增第二套导航。当前隔离预览抽验服装批发商：桌面 881×485 显示旧版水平导航并能打开 GPTmoda；手机 `/merchant?ruda-app=merchant-admin-mobile` 在 390×844 显示旧版底部导航，页面 document/body 宽度均为 390px。
- 代码完成不等于验收完成。仍需在隔离服务上操作其余六行业，检查旧版 Web 与手机导航、各行业业务入口、AI 助手上下文/动作和真实 API；还需留存与生产旧版对应的截图对照。生产构建、发布、重启仍按部署文档与用户单独确认流程执行。

### 非目标

- 不新建第二套账号、商家、商品、订单或库存表。
- 不重写服装生产批发商后台的现有商品、面辅料、生产、库存、订单、客户、权限与页面。
- 不引入第三方支付网关；POS 只记录真实销售单与库存变化，支付渠道能力按现有系统范围明确标注。
- 不在本轮执行生产迁移与发布（迁移文件随代码提交，执行需单独授权）。

## 2. 复用与防重复检查

| 能力 | 现有实现 | 本模块处理 |
|---|---|---|
| 行业模板 | `src/constants/merchantIndustryTemplates.ts`、`src/server/merchantIndustryTemplates.ts` | 继续作为唯一模板清单；新增能力清单映射到同一 templateId，不新增第二套行业枚举 |
| 商家后台外壳 | `ManagementAppShell`、`useManagementBootstrap`、`B2BContext` | 直接复用；行业模块只挂载页面 |
| 商品写入 | `POST/PUT/DELETE /api/merchant/products` | 复用；新增按行业模板决定“变体必填属性”的服务端策略，服装路径行为不变 |
| 库存 | `GET /api/merchant/inventory/balances`、`POST /api/merchant/inventory/adjustments` | 复用；行业页面只读同一权威库存 |
| 采购 | `/api/merchant/suppliers`、`/api/merchant/purchase-orders`、`MerchantProcurementWorkspace` | 复用组件与 API，不新建采购体系 |
| 订单 | `GET /api/merchant/orders`、`PUT /api/merchant/orders/:id/fulfill` | 复用；行业页面提供真实状态推进 |

| 客户 | `GET/POST/PUT /api/merchant/customers`、`B2BContext` | 复用 |
| 媒体上传 | `POST /api/merchant/media/presign` + 对象存储 PUT | 复用同一预签名流程，行业商品表单共用上传工具 |
| 门店/调拨 | 仅 `MerchantStoreCategory`（店铺前台分类），`StockTransfer` 表与 `/api/merchant/transfers` 被单仓模式禁用 | 必须新增真实门店与门店库存模型；调拨走独立事务更新库存 |
| POS | 无 POS 销售模型 | 新增最小可用 POS 销售记录（商品 + 数量 + 金额 + 库存扣减），不冒充支付网关 |

检索关键字：`IndustryMerchantWorkspace`、`industryTemplate`、`merchantIndustryTemplates`、`SINGLE_WAREHOUSE_ONLY`、`StockTransfer`、`purchase-orders`、`inventory/adjustments`、`merchant-admin-*`、`merchant-miniprogram`。结论：不存在可用的多门店库存、调拨和 POS 能力，必须新增；其余沿用现有实现。

## 3. 文件归属映射（硬边界）

```
src/constants/merchantIndustryTemplates.ts        行业模板唯一清单（已有）
src/constants/merchantIndustryCapabilities.ts     行业能力唯一清单（本轮新增）
src/apps/merchant-admin-industries/
  registry.ts                                      templateId → 行业模块（唯一映射）
  shared/                                          公共基础层：只放跨行业稳定原语
    kit.tsx                                        页头/KPI/表格/空状态/表单字段
    data.ts                                        真实 API 读取与写入、媒体上传、失败处理
    IndustryWorkspaceShell.tsx                     行业外壳（导航由行业清单传入）
    IndustryProductForm.tsx                        受 schema 驱动的商品表单渲染器
    IndustryProductList.tsx                        商品列表（列由行业传入）
    IndustryOrderSection.tsx                       订单列表 + 真实状态推进
    IndustryPartySections.tsx                      客户/供应商
    IndustrySettingsSection.tsx                    商家资料/账户/商品编辑锁
  apparel-production-wholesale/index.tsx           指向现有 MerchantPortal（保护，不重写）
  apparel-wholesale/manifest.ts + index.tsx
  trading-wholesale/manifest.ts + index.tsx
  department-wholesale/manifest.ts + index.tsx
  bags-wholesale/manifest.ts + index.tsx
  general-retail/manifest.ts + index.tsx + pos.tsx
  department-chain-retail/manifest.ts + index.tsx + stores.tsx
```

规则：

- 行业 A 的模块不得 import 行业 B 的目录；只允许 import `shared/`、`src/api/client.ts`、`src/context/B2BContext.tsx`、`src/types/b2b.ts` 与 `src/constants/*`。
- `shared/` 不得包含 `templateId` 分支逻辑；任何行业差异必须由行业 manifest 数据或行业页面自身表达。
- 服装生产批发商模块只做转发，不修改 `MerchantPortal` 行为。
- 旧的 `IndustryMerchantWorkspace` 保留仅供历史会话回退，不再作为 6 个行业的正式入口（下一步删除，本轮先在注册表注释标注弃用）。


## 4. 行业能力清单（单一事实来源）

`src/constants/merchantIndustryCapabilities.ts` 定义每个模板的：

| 字段 | 含义 |
|---|---|
| `productModel` | `apparel` / `bags` / `generic` / `retail`，决定商品属性与变体策略 |
| `variant.requiresColor`、`variant.requiresSize` | 服务端发布商品时的必需变体属性 |
| `pricing.primary` | `wholesale`（批发价）/ `retail`（零售价）/ `mixed` |
| `pricing.tiered` | 是否提供阶梯价（100 件价） |
| `inventory.mode` | `sku` / `generic` / `store`；是否含生产原料 |
| `modules` | 该行业允许的导航键（与页面实现一一对应） |
| `procurement`、`pos`、`stores`、`suppliers`、`reports` | 行业专属能力开关，服务端同样按此校验 |

7 种行业差异（摘要）：

| 模板 | 商品模型 | 价格 | 库存 | 专属能力 |
|---|---|---|---|---|
| `apparel_production_wholesale` | 服装款式 + SKU | 批发价 + 阶梯价 + MOQ | 成衣 SKU + 面辅料 | 生产、原料、现有后台 |
| `apparel_wholesale` | 服装款式 + 颜色/尺码 SKU | 批发价 + 阶梯价 + MOQ | 成衣 SKU | 采购、现货、折扣 |
| `trading_wholesale` | 通用商品 + 可选 SKU | 采购成本 + 批发价 | 通用库存 | 采购单、供应商、到货入库 |
| `department_wholesale` | 通用商品 + 条码/规格/单位 | 采购成本 + 批发价 + 阶梯价 | 通用库存 | 多品类采购、批量订单 |
| `bags_wholesale` | 箱包款号 + 材质/颜色/尺寸 SKU | 批发价 + MOQ | 箱包 SKU | 供应商采购、批发订单 |
| `general_retail` | 通用商品 + 条码 | 采购成本 + 零售价 | 通用库存 | POS 销售、退换货指引 |
| `department_chain_retail` | 门店商品 + 条码 | 采购成本 + 零售价 | 门店库存 + 总部库存 | 门店、调拨、POS |

## 5. 页面与功能清单（本轮实现）

### 5.1 所有行业（除服装生产批发商）

- 首页：真实 KPI（来自 `/api/merchant/products`、`/api/merchant/orders`、`/api/merchant/inventory/balances`、`/api/merchant/purchase-orders`），无数据时显示零值与空状态，不填演示数据。
- 商品：搜索、筛选、分页（前端分页）、新增（行业字段）、上下架、归档；编辑受 `productEditingEnabled` 锁约束，锁定状态必须明示，不伪装成功。
- 库存：真实 `InventoryBalance` 列表 + 手工调整（`version` 乐观锁）。
- 订单：列表、状态筛选、搜索、详情行展开、按服务端允许的状态推进（接单/备货/发货/完成/取消）。
- 客户/供应商：真实列表与新增（供应商按行业开关显示）。
- 设置：商家资料、账户安全入口、语言、登出、商品编辑锁开关（调用 `/api/merchant/settings/product-editing`）。

### 5.2 行业专属

- 服装批发商：现货/折扣标记、SKU 矩阵入口、采购工作区。
- 贸易批发商：采购单列表 + 新建采购单 + 收货入口（复用 `MerchantProcurementWorkspace`）。
- 百货批发商：多品类 + 条码 + 计量单位 + 阶梯价；采购单。
- 箱包批发商：材质/颜色/尺寸变体；批发价 + MOQ。
- 综合零售商：POS（搜索/条码、数量、金额、结算、真实销售记录与库存扣减）；销售记录列表。
- 百货连锁店：门店档案（新增/停用）、门店库存、门店间调拨（申请→发出→收货，库存原子变更）、POS（可指定门店）。

## 6. API 契约（本轮新增或修改）

### 6.1 行业模块服务端守卫

`requireMerchantIndustryModule(moduleKey)`：从 JWT 商家读取 `industryTemplate`，按 `merchantIndustryCapabilities` 校验模块是否启用；未启用返回 `403 INDUSTRY_MODULE_UNAVAILABLE`，`details.module` 回传模块键。用于门店、调拨、POS 等专属接口。

### 6.2 商品创建的行业策略

`POST /api/merchant/products`：

- `apparel_production_wholesale` / `apparel_wholesale` / `bags_wholesale`：保持现有规则（发布必须提供完整 SKU，含颜色与尺码/尺寸）。
- `trading_wholesale` / `department_wholesale` / `general_retail` / `department_chain_retail`：允许单变体商品，`sku` 必填，颜色与尺码可空；`barcode` 可写入 `sku.barcode`。发布仍需封面图、名称、编码、价格。
- 价格策略：零售行业允许 `retailPrice` 请求字段映射到 `rrpPrice` 作为主价格；批发行业保持 `wholesalePrice` 主价格。

### 6.3 门店

- `GET /api/merchant/stores`：当前商家门店列表（含 `stockSummary`）。
- `POST /api/merchant/stores`：`{ name, code, address, city, country, phone, status }`，`code` 商家内唯一。
- `PATCH /api/merchant/stores/:id`：更新档案或营业状态。
- `GET /api/merchant/stores/:id/stock`：门店库存列表（商品/SKU/数量）。
- `POST /api/merchant/stores/:id/stock/adjustments`：`{ productId, sku, quantity, note, idempotencyKey }`，事务写入门店库存与流水。

### 6.4 调拨

- `GET /api/merchant/store-transfers`：当前商家调拨单。
- `POST /api/merchant/store-transfers`：`{ fromStoreId, toStoreId, items:[{ productId, sku, quantity }], note, idempotencyKey }`，状态 `requested`，不改变库存。
- `PATCH /api/merchant/store-transfers/:id`：`{ status }`，仅允许 `requested → dispatched → received`、`requested → cancelled`。
  - `dispatched`：事务内扣减调出门店库存，不足返回 `STORE_STOCK_INSUFFICIENT`。
  - `received`：事务内增加调入门店库存，写流水；重复收货返回 `409 TRANSFER_STATUS_CONFLICT`。

### 6.5 POS 销售

- `POST /api/merchant/pos/sales`：`{ items:[{productId, sku, quantity}], paymentMethod:'cash'|'card'|'other', storeId? }`。
  - 金额以服务端价格为准（零售价 `rrpPrice` 优先，缺失回退 `wholesalePrice`），本轮不接受客户端改价。
  - 事务内扣减库存：`department_chain_retail` 扣门店库存；`general_retail` 扣 `InventoryBalance`（单仓）。
  - 生成销售单号 `POS-YYYYMMDD-xxxxxx`，写 `MerchantPosSale` 与明细。
- `GET /api/merchant/pos/sales`：当前商家销售记录（分页）。

本轮 POS 范围：真实销售记录、金额计算、库存扣减；**不包含**支付网关扣款、退款、发票、挂单。

### 6.6 注册即开通

`POST /api/auth/register/merchant`、`/api/auth/register/merchant/quick`、`/api/auth/register/company`：

- 选择行业模板后，在同一事务内创建/关联 `Company`、`Merchant`、`AuthAccount(role='merchant')`、默认仓库、ModaGPT 行业团队与工作区字段，签发商家会话并返回 `workspace`，前端直接进入对应行业后台。
- 保留邮箱/验证码/密码校验、商家归属与租户隔离；不引入人工审核等待。
- 平台侧入驻审核接口继续保留，用于历史申请与需要人工复核的场景，不再作为新商家开店的必经步骤。

## 7. 错误码

| 错误码 | HTTP | 场景 |
|---|---|---|
| `INDUSTRY_MODULE_UNAVAILABLE` | 403 | 当前商家模板未启用该模块 |
| `STORE_CODE_DUPLICATE` | 409 | 门店编码重复 |
| `STORE_STOCK_INSUFFICIENT` | 409 | 调拨/销售库存不足 |
| `TRANSFER_STATUS_CONFLICT` | 409 | 非法调拨状态流转或重复收货 |
| `POS_SALE_INPUT_INVALID` | 400 | POS 输入非法 |
| `INDUSTRY_PRODUCT_FIELDS_INVALID` | 400 | 行业必填商品字段缺失 |
| 既有 `PRODUCT_EDITING_LOCKED` | 423 | 商家未启用商品编辑 |

## 8. 隔离与回归测试

`tests/merchant-industry-backends.test.ts`：

- 7 个模板 ID 唯一，均有且仅有一个前端模块映射；除服装生产批发商外全部指向独立目录。
- 每个行业目录存在 `manifest.ts` 与 `index.tsx`；行业目录之间无交叉 import；`shared/` 不含 `templateId` 分支。
- 行业能力与导航一致：manifest 导航键必须是能力清单允许的模块。
- 商品字段隔离：贸易/零售表单不包含服装颜色/尺码必填；箱包包含材质/尺寸；零售主价格为零售价。
- 服务端契约：`requireMerchantIndustryModule` 被门店/调拨/POS 路由使用；门店与调拨在事务内更新库存；调拨状态机仅允许文档记录流转。
- 注册路径写入模板并签发商家会话（静态契约 + 模板解析单测）。

回归命令：`node --import tsx --test tests/merchant-onboarding-identity.test.ts tests/merchant-industry-backends.test.ts`、`npm run lint`、`npx tsc --noEmit`、`build:app:merchant-admin-web`、`build:app:merchant-admin-mobile`。

## 9. 验收清单（状态）

| 验收项 | 状态 | 证据 |
|---|---|---|
| 7 个模板唯一映射到行业模块 | 已完成 | 注册表 + 测试 |
| 服装生产批发商后台保持现有页面 | 已完成（代码未改） | `MerchantAdminApp` 分支 |
| 服装批发商/贸易/百货/箱包/零售独立页面 | 已完成（代码检查） | 各行业目录 |
| 门店、门店库存、调拨闭环 | 已完成（代码 + 单测） | `/api/merchant/stores*`、`store-transfers` |
| POS 销售记录与库存扣减 | 已完成（代码 + 单测） | `/api/merchant/pos/sales` |
| 注册后直接进入对应后台 | 已完成（服务端契约测试） | 注册端点 + workspace 快照 |
| 真实浏览器/手机/小程序验收 | 待验证 | 需真实会话与设备 |
| 两个隔离测试门店的联调 | 待验证 | 需真实数据库环境 |

## 10. 风险与回滚

- 风险：新增门店/调拨/POS 表与接口；仅对新模板开放，旧商家不受影响。迁移为纯新增表，可回滚为删表。
- 风险：商品创建策略按模板分支；服装路径保持原逻辑，需回归商品相关测试。
- 风险：注册改为即时开通；保留资料校验与模板校验，历史申请审核仍可用。回滚代码后已创建商家数据保留。
- 迁移：`prisma migrate deploy` 前备份；发布顺序为迁移 → 服务端 → 商家 Web → 商家手机端 → 小程序。


## 11. 本轮实施记录（2026-10-28）

已完成：

- `src/constants/merchantIndustryCapabilities.ts`：7 种行业的能力清单（商品模型、变体必填属性、价格模型、库存模型、模块与能力开关、商品字段 schema）。
- `src/apps/merchant-admin-industries/`：注册表 + 6 个独立行业模块（服装批发、贸易批发、百货批发、箱包批发、综合零售、百货连锁）+ 共享原语层；服装生产批发商仍映射现有 `MerchantPortal`。
- 商家 Web 与手机 Web 的 `MerchantAdminApp` 已改为按 `workspace.templateId` 从注册表加载；旧的 `IndustryMerchantWorkspace` 不再作为 6 个行业入口。
- 服务端：`requireMerchantIndustryModule` 守卫；商品创建按行业模板决定变体必填属性并校验 `industryAttributes` 白名单；新增门店、门店库存、调拨与 POS 销售接口；调拨与 POS 均在事务内变更库存。
- 数据：`MerchantStore`、`MerchantStoreStock`、`MerchantStoreTransfer(+Item)`、`MerchantPosSale(+Item)`、`Product.industryAttributes`，迁移 `20261028120000_merchant_industry_stores_pos`（纯新增）。
- 商品一级分类新增百货/零售品类，并同步 `merchant-miniprogram/utils/product-categories.js`。

验证结果：

- `npx tsc --noEmit`：exit 0。
- `node --import tsx --test tests/merchant-industry-backends.test.ts tests/merchant-onboarding-identity.test.ts`：18/18 通过。
- 回归：`tests/merchant-product-creation.test.ts`、`merchant-product-editing-permission`、`merchant-cross-device-contract`、`merchant-mobile-navigation`、`duplication-guards`：24/24 通过。
- `npm run build:app:merchant-admin-web`：成功（release `20261028222949351-ff041474`，未发布）。
- `npm run build:app:merchant-admin-mobile`：成功（release `20261028223001062-f090afa9`，未发布）。
- `git diff --check`：clean。
- `npx prisma format` / `npx prisma generate`：成功；**未执行** `prisma migrate deploy`（生产迁移需单独授权）。

待验证：

- 真实商家会话下 7 种行业的浏览器/手机页面视觉与交互（含窄屏、触控、键盘）。
- 两个隔离测试门店的调拨前后库存核对与 POS 扣减核对（需真实数据库环境）。
- 商家小程序行业后台（本轮未实现页面，仅同步分类目录）。
- 小程序真机与企业支付/退款能力不在本轮范围。

## 12. 演示账号（7 个行业，2026-10-28）

目的：用固定演示商家验证七行业真实后台；每个行业有独立账号、数据和可直接打开的入口，不借用正式商家账号。账号密码由部署环境在执行 seed 时提供，不写入源码、前端或日志。

| 编号 | 行业模板 | 登录邮箱 | 独立入口 | 商家 ID | 工作区 |
|---|---|---|---|---|---|
| 001 | 服装生产批发商 | `001@ruda.fashion` | `/merchant?industryDemo=001` | `demo-industry-apparel-production` | 现有 `MerchantPortal` |
| 002 | 服装批发商 | `002@ruda.fashion` | `/merchant?industryDemo=002` | `demo-industry-apparel-wholesale` | `merchant_admin_apparel_wholesale` |
| 003 | 贸易批发商 | `003@ruda.fashion` | `/merchant?industryDemo=003` | `demo-industry-trading-wholesale` | `merchant_admin_trading_wholesale` |
| 004 | 百货批发商 | `004@ruda.fashion` | `/merchant?industryDemo=004` | `demo-industry-department-wholesale` | `merchant_admin_department_wholesale` |
| 005 | 箱包批发商 | `005@ruda.fashion` | `/merchant?industryDemo=005` | `demo-industry-bags-wholesale` | `merchant_admin_bags_wholesale` |
| 006 | 百货连锁店 | `006@ruda.fashion` | `/merchant?industryDemo=006` | `demo-industry-department-chain-retail` | `merchant_admin_department_chain_retail` |
| 007 | 综合零售商 | `007@ruda.fashion` | `/merchant?industryDemo=007` | `demo-industry-general-retail` | `merchant_admin_general_retail` |

- 幂等创建：`INDUSTRY_DEMO_SEED_CONFIRM=CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS` 与 `INDUSTRY_DEMO_ACCOUNT_PASSWORD` 由受控运行环境提供后，执行 `npm run db:seed-industry-demo`；账号只保存 bcrypt 密码哈希，命令输出不包含密码。
- 独立入口复用现有登录页与 `POST /api/auth/demo/merchant/login`。编号与模板映射由共享常量 `src/constants/merchantIndustryDemoAccounts.ts` 管理；`industryDemo=001..007` 只选择固定行业模板，服务端仍从固定 `demo-industry-*` 记录映射商家并签发既有 HttpOnly 会话；不传账号密码、merchantId 或 token。此入口仅供隔离演示商家使用，启用前需确认演示数据已初始化，停用可关闭 `INDUSTRY_DEMO_LOGIN_ENABLED`。
- 隔离与安全：只写 `demo-industry-*` 商家、编号邮箱和 `demo-industry-<行业>-<序号>` 商品；命中非演示商家、商家编码/店铺地址被占用、商家已绑定其它登录邮箱时直接报错退出，不覆盖任何真实商家。
- 演示数据：每家 3 个已发布商品（`【演示】`前缀）+ 对应 SKU/变体，中央仓期初库存；百货连锁店另建 `MILANO-01`、`ROMA-01` 两个门店及门店库存（12 / 6），用于调拨与 POS 联调。
- 行业字段按 `merchantIndustryCapabilities` 写入：服装/箱包使用颜色+尺寸变体，贸易/百货/零售写入 `industryAttributes`（规格、单位、供应商、条码等）。
- 已同步修正：历史 CHECK 约束 `Merchant_industry_check` 缺少 `LEATHER_GOODS`，箱包批发商模板创建商家会被数据库拒绝；迁移 `20261028235000_merchant_industry_leather_goods` 放宽为与 `src/constants/merchantIndustries.ts` 一致（仅放宽取值范围，不改数据）。
- 清理方式：删除 `Merchant`、`AuthAccount`、`Product`、`ProductVariant`、`InventoryBalance`、`InventoryMovement`、`MerchantStore`、`MerchantStoreStock` 中 `demo-industry-*` 关联行；`Merchant` 与商品/库存/门店均为级联删除，`AuthAccount.merchantId` 需按 `merchantId` 一并删除。
- 尚未覆盖：演示账号只建商家主账号，不创建员工账号；商家小程序行业后台仍未实现，本轮不宣称完成。

### 生产清理和恢复边界

- 目标：清除经批准范围内的正式商家/买家业务资料与账号，再创建以上 7 个演示商家；保留平台管理员账号、`AuditLog`、平台配置及安全设置。
- `scripts/clear-business-data.ts` 当前会删除 `AuditLog` 且拒绝 `NODE_ENV=production`，不符合该保留范围，禁止通过改环境变量或绕过保护在生产执行。
- 生产清理前必须先清点数据库全部业务表、外键依赖及媒体/外部存储范围，编制逐表影响清单；先创建带权限保护的 PostgreSQL 备份并完成独立空库恢复演练。恢复备份会覆盖备份时点之后写入的所有数据库数据。
- 备份与演练结果完成后，先向产品负责人展示清理清单、被保留表和恢复窗口，再取得清理执行确认。当前文档记录的是目标，不代表已备份、已清理或已发布。

## 13. 发布与真实环境验收（2026-10-28）

发布内容（已执行，可回滚）：

- 迁移：`20261028120000_merchant_industry_stores_pos`、`20261028233000_merchant_industry_template`、`20261028234000_merchant_onboarding_identity`、`20261028235000_merchant_industry_leather_goods` 全部应用成功（`prisma migrate deploy` EXIT 0）。
- 服务端：重建 `dist/server.cjs`（原文件备份为 `dist/server.prev.cjs`），`pm2 restart ruda-fashion` 后健康检查 200，`/api/merchant/stores` 返回 401 JSON（说明路由已上线）。
- 商家 Web：`merchant-admin-web 20261028232135586-ca9d8424`；商家手机 Web：`merchant-admin-mobile 20261028232147637-cf200177`。回滚：把 `dist/apps/<target>/current.previous.json` 覆盖回 `current.json`。

接口闭环（真实运行实例，7 个演示账号）：

| 场景 | 结果 |
|---|---|
| 7 个账号登录（`/api/miniprogram/auth/login/merchant`） | 全部 200，`merchant.workspace.templateId` 与账号行业一致 |
| 百货连锁店门店列表 | 200，返回 `罗马分店`、`米兰旗舰店` |
| 门店 POS 销售 | 201，€19.90，门店库存 6 → 5 |
| 门店调拨 requested → dispatched → received | 201/200/200，调出店 -1，调入店 12 → 13 |
| 店态行业隔离 | 箱包批发商访问 `/api/merchant/stores` → 403 `INDUSTRY_MODULE_UNAVAILABLE` |
| 综合零售商 POS（无门店） | 201，€19.80，走中央仓库存 |

页面验收（Playwright 1.63 + Chromium，真实生产域名 `https://ruda.fashion`）：

- 1440×900：7 个账号分别进入 `MerchantPortal`（服装生产，按设计保留）与 6 个独立行业后台；横向溢出 0；无页面异常。
- iPhone 13（390×844，移动 UA）：`merchant-admin-mobile` 被真实加载，服装批发/箱包/百货连锁/综合零售均识别对应后台，横向溢出 0。
- 箱包材质分布读取 `industryAttributes.material`，显示 `小牛皮 / 高密尼龙 / 头层牛皮` 各 1 款。

本轮同时修复的两个真实缺陷：

1. `B2BContext` 的公开商家目录刷新用 `/api/merchants` 结果整体覆盖 `merchants`，而该接口不含 `workspace`；与会话请求竞态时会丢模板，行业后台回退到服装门户。新增 `src/shared/merchantWorkspaceSync.ts`：公开列表只补充不覆盖已知 `workspace` / `industryTemplate`，并保留不在公开列表中的会话商家。
2. 箱包首页材质分布读 `product.fabric`，与实际写入 `industryAttributes.material` 不一致；统一改用共享 `parseIndustryProductAttributes`。

已知未完成：

- 商家小程序行业后台仍未实现（仅商品分类同步）。
- `merchantWorkspaceTemplates`（工作区快照里的 `modules`）仍是通用的旧模块清单，与实际 `merchantIndustryCapabilities.modules` 不一致；当前没有 UI 读取该字段，后续需要统一或删除，避免误用。
- 演示账号未创建员工账号与测试订单；小程序真机未验收。

## 14. 经营闭环补全（2026-10-28，第一批 P0）

本轮目标是让七个行业后台从“可查看”变成“可经营”。所有写操作仍在同一套既有 `/api/merchant/*` 契约上完成，没有新增平行业务系统。

### 14.1 数据模型（迁移 `20261028240000_merchant_pos_store_binding`）

| 变更 | 说明 | 兼容性 |
|---|---|---|
| `Order.storeId String?` + 索引 + 外键（`ON DELETE SET NULL`） | POS 销售的门店归属；为空表示总部/单仓销售 | 可空新增列，旧数据保持为空，旧代码按中心仓逻辑继续工作 |
| `MerchantEmployee.storeId String?` + 索引 + 外键（`ON DELETE SET NULL`） | 员工绑定门店；为空表示不限制门店（店主/总部） | 同上，默认行为与旧版一致（不受限） |

回滚：先回退代码，再删除两个可空列与外键；由于列可空且无数据回填，回滚不丢失业务数据。

### 14.2 POS 单一金额事实来源

- `POST /api/merchant/pos/sales` 不再写 `MerchantPosSale`，改为在同一事务内创建 `POS-` 前缀的 `Order`：
  - 门店行业按 `MerchantStoreStock` 扣减，非门店行业走中心仓库存台账（与员工开单一致）；
  - 记录 `posShiftId`、`storeId`、`discountAmount`，并创建 `manual` 支付流水；
  - 幂等：`idempotencyKey` 唯一，重复提交返回 `idempotentReplay`，不重复扣库存；
  - 折扣：按比例摊到每行净单价后写入订单行，因此退货按净价退款不会超过实付；员工只有具备 `pricing.approve` 才能下单折扣（服务端校验）。
- `GET /api/merchant/pos/sales` 返回订单型销售 + 旧版 `MerchantPosSale`（只读、不可退货，避免历史数据消失），并给出每行 `returnedQuantity` / `returnableQuantity`（来源：`StockMovement` `movementType='return'`、`referenceId=订单 ID`）。
- 班次现金口径不变（读 `Order.posShiftId`），因此门店 POS 销售现在会自然进入班次应交现金。

### 14.3 退货门店归属

`POST /api/merchant/pos/returns` 保持唯一退货入口，新增：

- 订单带 `storeId` 时，退回**该门店库存**（`MerchantStoreStock` 增加），并写 `StockMovement.location='store:<code>'`；订单无 `storeId` 时仍回补中心仓台账。
- 员工绑定了门店时，只能退该门店的销售（否则 403 `STORE_ACCESS_DENIED`）。
- 现金退款仍需进行中的班次；跨班次退款写入当前班次的现金支出流水。

### 14.4 员工与门店范围

`/api/merchant/employees` 系列（`GET/POST/PATCH :id/PATCH :id/status/PATCH :id/permissions`）：

- `GET` 返回 `stores`（可分配门店）与每人的 `storeId`、`store`；
- `POST`、`PATCH :id` 支持绑定门店（服务端校验门店属于本商家且 `active`）；
- 绑定门店的员工只能看到/管理本门店员工、门店、门店库存、调拨与 POS 销售；店主不受限；
- 调拨创建只允许从员工获授权门店发出；调拨推进要求员工属于调出或调入门店；门店库存调整校验门店归属。

### 14.5 商家资料编辑

`IndustrySettingsSection` 由只读改为可编辑：商家名称、法定名称、VAT 号、国家/城市、公司地址、联系人/电话/邮箱，与 MOQ、账期、语言、发货说明一并走 `PUT /api/merchant/settings`（带 `expectedUpdatedAt` 乐观锁，冲突返回 409 而不是覆盖）。同时修复了旧实现因未回传 `name` / `contactEmail` 而必然返回 `MERCHANT_PROFILE_INVALID` 的缺陷。

### 14.6 公开商品白名单

`src/server/publicProductVisibility.ts` 新增 `PUBLIC_PRODUCT_FIELD_ALLOWLIST` 与 `pickPublicProductFields`；公开序列化改为“先白名单挑选、再清理成本/存储键”。`costPrice`、`creationRequestKey`、`inventoryVersion`、`isExclusiveProtected`、`protectionLevel`、`visibility`、商城审核人等内部字段不再可能被透传。

### 14.7 团队与消息中心（七端统一）

- 新模块键：`team`（导航“团队权限”）、`messages`（导航“消息中心”），写入全部 7 个 `merchantIndustryCapabilities.modules` 与 6 个行业 manifest；服务端行业守卫仍按同一清单判断。
- 员工管理组件唯一实现：`merchant-admin-common/components/merchant/MerchantTeamManagement.tsx`；行业后台通过 `IndustryTeamSection` 调用，服装后台 `MerchantPortal` 的“用户与权限”面板改为同一组件（不再保留第二套创建/停用/授权代码）。
- 消息中心 `IndustryMessageSection` 复用 `useMerchantNotifications`（`GET /api/merchant/notifications` + 已读接口），无模拟消息，空数据即空状态。
- `merchantWorkspaceTemplates.modules`（旧版 MerchantPortal 标签清单）与行业能力对齐：删除百货批发/箱包批发/服装批发的 `pos`、连锁店的 `procurement`；`tests/industry-module-contract.test.ts` 固化该一致性。

### 14.8 演示数据

`scripts/seed-industry-demo-merchants.ts` 追加（仅 `demo-industry-*` 数据、幂等）：

- 每个演示商家 1 名员工 `demo-team-<key>@ruda.fashion`（密码 `12345678`，连锁店绑定第一个门店）；
- 2 张不同状态订单（`pending` 未付 / `shipped` 已付）；
- 适用行业的 1 张部分到货采购单（5 订购 / 2 已到）；
- 连锁店 1 条已完成调拨 + 1 条待处理调拨。

入口：`npm run db:seed-industry-demo`（需 `INDUSTRY_DEMO_SEED_CONFIRM=CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS`）。

### 14.9 测试

- `tests/industry-module-contract.test.ts`：公开白名单、行业模块矩阵、POS/门店/调拨门禁、工作区模板一致性（**5/5 通过**，`node --import tsx --test tests/industry-module-contract.test.ts`，EXIT 0）。
- `tests/e2e/industry-backends.e2e.ts`：七行业真实接口回归，**已在隔离测试库跑通 6/6**（详见 §14.12）。

### 14.10 本轮未完成（不得宣称完成）

- 商家小程序行业后台（第二批）。
- 行业报表与导出、打印/标签、批量导入（第三批）。
- `MerchantSmartPos`（服装/手机端 POS，客户价与挂单）与行业 POS 仍是两个界面：行业 POS 需要门店库存与门店归属，统一需要先给 `/api/merchant/employee-orders` 增加门店语义，属后续重构。
- 班次仍按 `registerCode='main'` 单收银台建模，未按门店分收银台。
- 订单状态流转（确认/发货/完成/取消）尚未纳入自动化回归，仅有人工验证记录。

### 14.11 本轮发布与真实验证（2026-10-29）

发布：

- 迁移 `20261028240000_merchant_pos_store_binding` 已应用（`prisma migrate deploy` EXIT 0）。
- 服务端 `dist/server.cjs` 重建（旧文件备份 `dist/server.prev.cjs`），`pm2 restart ruda-fashion` 后 `GET /api/health/ready` 200。
- 商家 Web `20261029003920818-301d25b7`、商家手机 Web `20261029003931906-26027e56` 已发布。回滚：把 `dist/apps/<target>/current.previous.json` 覆盖回 `current.json`，并用 `dist/server.prev.cjs` 还原服务端。

真实接口（`https://ruda.fashion`，百货连锁店演示账号）：

| 步骤 | 结果 |
|---|---|
| 员工列表 | 200，返回 2 个门店 + 演示员工 `storeId` 非空 |
| 商家资料保存 | `PUT /api/merchant/settings` 200，`shippingNote` 与 `merchant.name` 回读一致 |
| 开班 | 201，期初现金 €50 |
| POS 销售（含 €1 折扣） | 201，`POS-20261029-…`，应收 €28.90，门店库存 6→5 |
| 重复提交同一 `idempotencyKey` | 200 `idempotentReplay: true`，库存不再变化 |
| 退货 | 200，退款 €28.90（按折扣后净价），门店库存 5→6 |
| 重复退货（同 key） | 200 `idempotentReplay: true`，不重复退款/入库 |
| 班次汇总 | cashSales 28.90 / cashRefunds 28.90 / expectedCash 50.00 |
| 交班 | 200，expectedCash 50.00，差异 0.00 |
| 员工门店隔离 | 员工仅见 MILANO-01；访问 ROMA-01 库存 403、调整库存 403、POS 收银 403 `STORE_ACCESS_DENIED` |

真实页面（Playwright + Chromium，生产域名）：

- 百货连锁店 1440×900 与 390×844：导航含「团队权限」「消息中心」「门店收银」；团队页显示「员工与权限 / 新增员工」；消息页显示「消息列表」；横向溢出 0；无页面异常。
- 综合零售商 1440×900 与 390×844：导航含「团队权限」「消息中心」；两页均渲染；溢出 0；无异常。
- 连锁店「门店收银」页包含班次与现金、整单折扣、销售记录、完成结算；「设置」页商家资料为输入框并可保存。
- 服装生产门户（`MerchantPortal`）「系统设置 → 用户管理」渲染共享 `MerchantTeamManagement`，无页面异常，确认公共组件替换未破坏现有后台。

补充验证（综合零售商，无门店）：

| 步骤 | 结果 |
|---|---|
| POS 销售（刷卡） | 201，`store: null`，中心仓库存 28→27 |
| 退货 | 200，退款 €9.90，中心仓库存 27→28 |
| 班次 | 刷卡不计入 cashSales（现金口径正确），expectedCash 保持 €20 |

本轮同时修复的缺陷：中心仓 POS 销售原先只更新 `InventoryBalance` 台账、不更新商品 `skus[].stockCentral` 快照，导致退货接口一致性校验 `INVENTORY_BALANCE_MISMATCH`。现已在同一事务内同步两者，并仅对 `demo-industry-*` 演示数据做了一次性对齐（1 个商品、1 个 SKU）。


## 15. 隔离 E2E 回归（2026-10-29 新增，可持续执行）

### 15.1 运行方式

```
npm run test:e2e:industry         # 全量：迁移 + 造数 + 起服务 + 跑测试
npm run test:e2e:industry -- --seed-only
```

脚本：`scripts/test-industry-e2e-isolated.sh`。

安全边界（与 `scripts/test-pos-e2e-isolated.sh` 同构）：

- 每次运行创建一次性 `postgres:16-alpine` 容器，仅发布到 `127.0.0.1`，库名必须含 `test|e2e`；
- 所有子进程在 `env -i` 下运行，宿主 `.env` 的 `DATABASE_URL` 无法被继承为目标库；
- 容器归属通过 `com.ruda.test-run` 标签二次校验，`EXIT` 陷阱负责删除容器；
- 测试数据只来自两个脚本：`scripts/seed-e2e.ts`（中心仓 + 通用夹具）、`scripts/seed-industry-demo-merchants.ts`（七个 `demo-industry-*` 商家）。生产库不会被写入；
- 服务端以 `P0_HTTP_TEST_MODE=true` + `NODE_ENV=test` 启动，跳过 Vite 文件监听（避免 inotify 资源耗尽导致假失败）。

### 15.2 覆盖范围与实测结果（6/6 通过）

| # | 用例 | 断言要点 | 结果 |
|---|---|---|---|
| 1 | 零售行业收银闭环 | 开班 → 销售 `POS-` 单 → 同 key 幂等 → 退货退款 → 同 key 幂等 → 交班 | ok |
| 2 | 七行业资料/员工/模块门禁 | `/settings` 含商家名；`/employees` 200；`stores`/`store-transfers`/`pos/sales` 按能力返回 200 或 403 `INDUSTRY_MODULE_UNAVAILABLE` | ok |
| 3 | 商家与门店隔离 | 每个行业只能读到 `demo-industry-<自身>-*` 商品与订单；连锁店员工仅见绑定门店，跨店库存读取/调整 403 | ok |
| 4 | 采购部分到货 | 未到数量一次入库 → 中心仓库存精确增加 → 同 key 重放不重复入库 → 超收 409 → 单据状态 `received` | ok |
| 5 | 门店调拨 | 调拨幂等创建 → 发出扣源店库存 → 收到加目标店库存 → 重复收货 409 `TRANSFER_STATUS_CONFLICT` 且库存不变 | ok |
| 6 | 行业商品属性 | 外部行业属性键 400 `INDUSTRY_PRODUCT_FIELDS_INVALID`；本行业必填属性创建 201 并按原样回读；商品进入本商家目录 | ok |

### 15.3 本轮回归发现的缺陷与修复

- **演示采购单缺少在途库存（已在脚本修复）**：真实流程通过 `PATCH /purchase-orders/:id/status → ordered` 写入 `InventoryBalance.inTransitQuantity`，而演示脚本直接落库，导致演示商家「剩余到货」被 `INVENTORY_LEDGER_CONCURRENT_UPDATE` 拒绝（409）。`scripts/seed-industry-demo-merchants.ts` 现在把在途数量补齐为「订购 - 已到」，并在生产演示数据上实测对齐：6 个采购行业 `inTransitQuantity=3`，`onHandQuantity` 保持 12/30 不变（只读查询核验）。
- 产品代码本身的行为是正确的：在途不足时拒绝入库、超收拒绝、重放不重复入库，均是预期防护；本轮不修改这些规则。

### 15.4 未覆盖（明确标记为待验证）

- 订单状态流转（确认 / 发货 / 完成 / 取消及库存回滚）尚无自动化断言。
- POS 班次的现金支出、差异计算只有人工验收记录。
- 小程序与 Web/手机 Web 的页面级一致性未纳入自动化（需真机/开发者工具）。
- `npm run test:e2e`（POS 夹具）复跑记录：`tests/e2e/pos-journey.e2e.ts` 通过；`tests/e2e/b2c-checkout.e2e.ts` 2 条失败，原因是该用例仍以 `paymentMethod: 'credit_card'` 下单，而服务端 `POST /api/orders` 现在只接受 `bank_transfer`/`bank_transfer_prepay`，返回 409 `PAYMENT_AFTER_MERCHANT_ACCEPTANCE`。本轮未改动该用例与订单创建逻辑，属既有陈旧夹具，需单独修复（待办）。
- 本机 inotify 资源紧张时，旧版 POS 夹具会因 Vite 监听 `dist/apps` 触发 `ENOSPC` 假失败；已在夹具中固定 `P0_HTTP_TEST_MODE=true` 规避（该模式仍强制 `NODE_ENV=test` + 回环测试库）。
### 15.5 回滚说明

- 本轮只新增测试脚本、用例与演示数据脚本，未修改服务端业务代码，`dist/server.cjs` 与服务端进程无需重建或重启。
- 回滚：删除 `scripts/test-industry-e2e-isolated.sh`、`tests/e2e/industry-backends.e2e.ts`，并从 `package.json` 移除 `test:e2e:industry`；`scripts/test-pos-e2e-isolated.sh` 恢复为原 `tests/e2e/*.e2e.ts` 通配即可。
- 演示数据侧：`seed-industry-demo-merchants.ts` 只写 `demo-industry-*` 商家，重复执行幂等；如需撤销在途修正，把相关 SKU 的 `InventoryBalance.inTransitQuantity` 置回 0。

## 16. 第二阶段第一批：门店级 POS 班次与商家资料/店铺展示闭环（2026-10-29）

### 16.1 问题与目标

第一批验收发现两处“有接口但界面/规则没闭环”的问题：

1. POS 班次只有 `registerCode = 'main'`，没有门店归属。多门店商家里 A 店店员开的班可以被 B 店结算使用，任意店员都能查到同一商家的唯一开班，违反“店员只能操作获授权门店的销售与交接班”。
2. 行业后台“商家资料与账户”页缺少 Logo、网站域名、店铺展示信息与店铺状态，无法完成“资料保存后前台展示”的验收。

本轮目标：班次按门店隔离并由服务端强制校验；资料页补齐 Logo / 域名 / 展示 / 状态，且与公开前台使用同一判定口径。

非目标：不新建第二套门店、员工或展示系统；不改变非门店行业（服装生产、服装批发、贸易、百货批发、箱包批发、综合零售）的单收银台行为。

### 16.2 数据模型与迁移

迁移 `prisma/migrations/20261028250000_merchant_pos_shift_store/migration.sql`：

- `MerchantPosShift` 新增可空列 `storeId TEXT`（非门店行业保持 `NULL`）。
- 重建部分唯一索引：`(merchantId, COALESCE(storeId,''), registerCode) WHERE status = 'open'`，即每个商家每个门店每个收银台同时只有一个开班。
- 新增索引 `(merchantId, storeId, status)`。
- 可回滚：删除该索引与列即可；历史班次金额、现金流水与订单关联不受影响。

### 16.3 API 契约变更

`GET /api/merchant/pos/shifts/current`

- 新增查询参数 `storeId`。门店模式商家：缺省时取员工绑定门店；仍为空返回 400 `POS_STORE_REQUIRED`；越权 403 `STORE_ACCESS_DENIED`；门店不存在 / 非本商家 / 非营业返回 404 `STORE_NOT_FOUND`。非门店模式传 `storeId` 返回 400 `POS_STORE_NOT_SUPPORTED`（保持单收银台契约）。

`POST /api/merchant/pos/shifts`

- 新增可选 `storeId`，校验规则同上并写入班次。重复开班仍返回 409 `POS_REGISTER_ALREADY_OPEN`（现在按门店判定）。

`POST /api/merchant/pos/shifts/:id/cash-movements`、`.../:id/close`

- 载入班次后校验 `shift.storeId` 与员工门店范围，越权返回 403 `STORE_ACCESS_DENIED`。

`POST /api/merchant/pos/sales`

- 传入 `posShiftId` 时，班次门店必须与本次 `storeId` 一致，否则 409 `POS_SHIFT_STORE_MISMATCH`（防止借用他店班次结算）。

`GET /api/merchant/settings`（只读扩展，向后兼容）

- 新增 `settings.websiteUrl`、`storefront { logo, storeSlug, storefrontEnabled, publiclyVisible, tagline, description }`、`industry { code, template }`。
- `publiclyVisible` 与公开门店接口同口径：`storefrontEnabled === true` 或 `storefrontEnabled == null && isVerified`。

`PUT /api/merchant/storefront`

- 新增 `storefrontEnabled: boolean`（非布尔返回 400 `STOREFRONT_STATUS_INVALID`）。只提交该字段不影响其它展示内容；暂停展示只影响公开前台可见性，不影响后台数据与订单。

### 16.4 权限与门店归属

- 全部校验在服务端完成。`requireMerchantTenant` 每次请求重新读取员工的 `role / permissions / active / storeId`：停用员工立即 401 `EMPLOYEE_NOT_FOUND_OR_DISABLED`，收回权限立即 403，无需等待旧会话过期。
- 门店归属校验同时检查：门店属于当前商家、门店 `status = 'active'`、员工 `storeId` 与目标门店一致。
- 前端仅做展示与禁用，不作为授权边界。



### 16.5 前端变更

- `IndustryPosSection`：班次读写按当前门店（切换门店自动重读班次）；班次标题显示所属门店；跨门店班次禁止结算；新增“销售小票”弹窗（金额、折扣、已退均取服务端字段）与独立窗口打印；销售记录新增“查看小票”。
- `IndustrySettingsSection`：新增网站域名、行业信息（经营类型 / 模板）、店铺链接（打开前台）、Logo 地址与预览、店铺标语、店铺简介、营业状态开关（暂停 / 恢复）。保存后重新读取服务端结果；资料保存沿用 `PUT /api/merchant/settings` 的版本冲突 409 `MERCHANT_SETTINGS_CONFLICT`。

### 16.6 测试与实测结果（2026-10-29）

命令与隔离约束见 §15.1（临时 `postgres:16-alpine`，`env -i`，库名必须含 `test|e2e`，容器带 `com.ruda.test-run` 标签；生产库未被测试写入）。

- `npx prisma generate`：通过。
- `npx tsc --noEmit`：通过（0 错误）。
- `npm run test:e2e:industry`：**6/6 通过**（`duration_ms 4104.86`）。其中：
  - 用例 1（POS）：门店模式行业改为按 `storeId` 查班 / 开班 / 交班，幂等销售与幂等退货断言保持通过。
  - 用例 3（隔离）：新增店员跨门店班次断言——读取他店班次 403、替他店开班 403、本店开班返回 `storeId`、本店现金流水 201、本店交班 200；沿用原有跨商家商品 / 订单隔离与跨店库存 403 断言。
- 迁移已在生产库执行：`20261028250000_merchant_pos_shift_store`（`npx prisma migrate deploy`，155 个迁移全部成功）。本轮服务端代码有变更，`dist/server.cjs` 与进程需在发布窗口重建重启后才生效。

### 16.7 未完成 / 待验证

- 班次历史列表（跨班次查询、按门店筛选）尚无页面与接口，目前只有“当前班次”。
- 小票打印为浏览器打印窗口，未接入 80mm 热敏打印机的纸张参数。
- 商家资料页 Logo 仅支持图片地址；生产环境启用对象存储时须走既有上传接口，否则 `data:` URL 会被服务端拒绝（`STOREFRONT_MEDIA_MUST_BE_UPLOADED`）。
- 手机端与小程序的店铺状态、Logo、标语、简介展示尚未补齐，需按 `merchant-three-end-matrix.md` 在后续批次完成。
- 桌面与手机真实页面截图验收未执行，仅完成类型检查与接口级 E2E。

### 16.8 发布与回滚

- 发布：`npm run build`（重建 `dist/` 与服务端产物）→ 重启服务进程。数据库迁移已先行应用且向后兼容（旧代码忽略新列，旧索引被同语义新索引替换）。
- 代码回滚：`git revert` 本轮提交即可；旧代码不写 `storeId`，新索引仍允许 `storeId = NULL` 的唯一开班，回滚后开班逻辑照常工作。
- 数据回滚：仅在需要彻底撤销门店归属时执行 `DROP INDEX "MerchantPosShift_one_open_register_idx"; DROP INDEX "MerchantPosShift_merchantId_storeId_status_idx"; ALTER TABLE "MerchantPosShift" DROP COLUMN "storeId";` 并重建原 `(merchantId, registerCode) WHERE status='open'` 部分唯一索引。

## 17. 第二阶段第二批：POS 退货、现金核算与班次历史（2026-10-29）

### 17.1 问题与目标

- 原实现中 `GET /pos/shifts/current` 的 `expectedCash` 不含期初现金，而交班接口包含期初现金，两处口径不一致；同一退货若在其他班次处理，原逻辑既在该班次记现金支出，又按订单 `refundAmount` 在本班次再扣一次，存在重复扣减风险。
- 缺少班次历史查询：只能看“当前班次”，无法按门店 / 员工 / 日期回查已交班记录及关联销售、退款、现金流水。
- 目标：现金核算单一入口、现金退款必有流水、历史可查且与交班冻结值一致。

### 17.2 现金核算规则（唯一口径）

`应存现金 = 期初现金 + 现金销售 + 现金收入 − 现金退款 − 现金支出`

- 现金销售：`posShiftId` 指向本班次、`paymentMethod = 'cash'` 且 `paymentStatus ∈ {paid, partially_refunded, refunded}` 的订单 `totalAmount` 之和。
- 现金退款：只认本班次 `direction = 'out'` 且 `reason` 以 `POS 退货` / `POS return` 开头的现金流水；**不再叠加订单 `refundAmount`**，避免同一笔退款被重复扣减。
- 刷卡 / 其他支付计入 `cardSales` 用于报表，不进入钱箱。
- 服务端实现：`summarizePosShiftCash()` 是唯一计算入口；`loadPosShiftCash()` 供当前班次读取，交班与历史列表复用同一函数。
- 已知边界：本规则上线前已在同一班次内发生、当时未写流水的退款不追溯（历史班次已按旧口径封存），不回溯修改历史。

### 17.3 退货与现金流水变更

- `POST /api/merchant/pos/returns` 新增行业门禁 `requireMerchantIndustryModule('pos')`；权限仍为 `return.manage | store_manager`。
- 现金订单退货**必定**写一条 `MerchantPosCashMovement`：`direction='out'`、`reason='POS 退货: <原因>'`、`idempotencyKey='pos-return-cash:<refundId>'`，写入门店（`shift.storeId === order.storeId`）的进行中班次；无进行中班次返回 409 `POS_SHIFT_REQUIRED`。
- 幂等：先按请求 `idempotencyKey` 派生 `refundId` 查重，重复请求返回 `idempotentReplay: true`，不重复退款、不重复入库、不重复写流水。
- 退货数量上限取自 `movementType='return'` 的库存流水累计，与销售列表 `returnableQuantity` 同口径；超量 409 `POS_RETURN_QUANTITY_EXCEEDS_SALE`。

### 17.4 班次历史 API

`GET /api/merchant/pos/shifts`

- 权限：`requireMerchantIndustryModule('pos')` + `sales.order.create | store_manager`；员工仅限绑定门店。
- 查询参数：`storeId`、`employeeId`、`from`、`to`（支持 `YYYY-MM-DD`，结束日期按 UTC 当日 23:59:59.999）、`status`（`open` / `closed`）、`limit`（1–100，默认 20）、`offset`。
- 响应：`{ success, shifts[], total, limit, offset }`；每行含 `storeName / employeeName / openingCash / cashSales / cardSales / cashRefunds / cashIn / cashOut / salesCount / expectedCash / closingCash / cashDifference / openedAt / closedAt / openingNote / closingNote`。
- 已交班行返回交班时冻结的 `expectedCash` / `closingCash` / `cashDifference`，不随后续退货重算。
- 错误：越权门店 403 `STORE_ACCESS_DENIED`；日期不可解析 400 `POS_SHIFT_RANGE_INVALID`；未启用 POS 模块 403 `INDUSTRY_MODULE_UNAVAILABLE`。

`GET /api/merchant/pos/shifts/:id`

- 返回班次汇总 + `sales[]`（POS 订单及明细）+ `refunds[]`（`RefundTransaction`）+ `movements[]`（含操作员工姓名）。
- 不存在 404 `POS_SHIFT_NOT_FOUND`；跨门店员工 403 `STORE_ACCESS_DENIED`。

### 17.5 前端变更

- 新增 `IndustryPosShiftHistory`（`src/apps/merchant-admin-industries/shared/IndustryPosSection.tsx`）：门店 / 员工 / 起止日期 / 状态筛选、班次表格、展开式班次明细（销售、退款、现金流水）。员工筛选依赖 `GET /api/merchant/employees`，无 `employees.manage` 权限时自动隐藏，不影响班次查询。
- 新增 `PosShiftDetailPanel`：期初、现金销售、刷卡、现金退款、现金收支、应交现金与实交 / 差额，全部取服务端字段。
- 导航：`general_retail`、`department_chain_retail` manifest 新增 `pos_shifts`（“班次历史”），同步 `MerchantIndustryModuleKey` 与 `navIcons`；桌面端与手机端 Web 共用同一 Section（响应式网格 + 横向滚动表格）。
- `data.ts` 新增 `listPosShifts` / `fetchPosShiftDetail` / `listPosShiftEmployees`，并扩展 `IndustryPosShift`（`cardSales`、`salesCount`、`storeName`、`employeeName`）。

### 17.6 测试与实测结果（2026-10-29）

- 隔离运行器：`bash scripts/test-industry-e2e-isolated.sh`（临时 `postgres:16-alpine`、`env -i`、库名含 `test`、容器标签校验；生产库零写入）。
- 结果：**7/7 通过**（最终一次 `duration_ms 4799.85`；此前一次 4544.81）。新增用例 `pos refunds, cash accounting and shift history stay consistent` 覆盖：
  1. 门店开班（期初 100.00）；
  2. 现金销售 2 件，校验门店库存扣减、班次 `cashSales` 与含期初的 `expectedCash`；
  3. 超量退货被拒绝且库存不变；
  4. 部分退货 1 件成功、库存 +1；重复提交返回 `idempotentReplay`，不重复退款 / 入库；
  5. 剩余 1 件退完，库存回到销售前，累计退款不超过实付；
  6. 现金收入 20 / 支出 5（重复现金收入幂等重放）；
  7. 交班前断言 `cashRefunds / cashIn / cashOut / expectedCash` 与流水一致；
  8. 交班差额 −2，重复交班被拒绝；
  9. 历史列表按门店 + 日期 + 状态命中该班次且数值与冻结值一致；非法日期 400；
  10. 班次明细返回 1 笔销售、≥2 笔退款、`POS 退货` 现金流水与 20 元现金收入；
  11. 门店员工跨门店查询历史 403、本门店 200。
- 其余 6 个既有用例（七行业模块门禁、跨商家隔离、采购分批到货、门店调拨、行业属性校验、POS 幂等销售）全部保持通过。
- `npx tsc --noEmit`：0 错误。
- 说明：本轮仅接口级验证，桌面 / 手机真实截图验收仍未执行（见 17.8）。

### 17.7 B2C 下单测试夹具修复（同批）

- `tests/e2e/b2c-checkout.e2e.ts` 中旧的 `credit_card` 夹具已按现行合同改为 `bank_transfer`。
- 现行合同：`POST /api/orders` 仅接受 `bank_transfer` / `bank_transfer_prepay`（其他方式 409 `PAYMENT_AFTER_MERCHANT_ACCEPTANCE`）；下单只创建 `status=pending`、`paymentStatus=unpaid` 的订单且响应不含 `payment` 对象；未确认订单调用 `POST /api/orders/:id/payment` 返回 409 `ORDER_NOT_READY_FOR_PAYMENT`。
- 测试改为断言上述真实行为（用例更名为 `... cancels without stock drift`），**未放宽任何生产校验**。
- 实测（`bash scripts/test-pos-e2e-isolated.sh`）：**3/3 通过**。修正后的关键真实行为：
  - 银行转账订单创建后 `onHandQuantity` 保持 20（未扣减），商家确认 / 拣货阶段才按既有规则处理库存；
  - 未确认协议的订单调用 `/api/orders/:id/payment` 返回 409 `AGREEMENT_CONFIRMATION_REQUIRED`；
  - 买家取消订单返回 200、`order.status = cancelled`，库存仍为 20（无库存漂移）；
  - 同批 `pos-journey.e2e.ts`（POS 开班 → 销售幂等 → 现金退款 → 交班）保持通过。

### 17.8 未完成 / 待验证

- 七行业订单状态流转 E2E（确认 → 拣货 → 发货 → 完成 / 取消、库存回滚、非法跳转 409、并发与重复请求）尚未编写。
- 班次历史暂无导出（CSV / Excel），前端固定取前 50 条（接口支持 `limit/offset`）。
- 小票仍为浏览器打印窗口，未接入 80mm 热敏参数；历史班次不能重新打印小票。
- 手机端 Web 已复用同一 Section，但未做真机截图；小程序端暂无班次历史页面。
- 七行业小程序后台、报表 / 导入导出 / 条码标签打印（第三、四批）未开始。

### 17.9 发布与回滚

- 发布：`npm run build` → 以 `NODE_ENV=production PORT=<port> node dist/server.cjs` 重启；**重启必须显式设置 `NODE_ENV=production`**，否则 Vite 文件监听会触发 inotify 上限（ENOSPC）导致进程崩溃。
- 无数据库结构变更（沿用 `20261028250000_merchant_pos_shift_store`）。
- 后端回滚：还原 `summarizePosShiftCash`、退货流水写入与两个历史接口即可；历史接口为纯读，回滚不影响数据。
- 前端回滚：移除 `pos_shifts` 导航项与 `IndustryPosShiftHistory` 引用。
- 数据影响：只新增现金流水与读取逻辑，不修改历史班次冻结的 `expectedCash`；已写入的 `POS 退货` 流水为真实现金支出，回滚代码后仍保留在表中（不会自动删除）。



## 18. 第二阶段第三批：订单状态与库存闭环 + 七行业小程序后台（2026-10-29）

### 18.1 问题与目标

第二批已经打通 POS 收银/退货/班次，但订单履约链路仍有三个未闭环问题：

1. 商家通过 `PUT /api/merchant/orders/:id/fulfill` 取消订单时，只改状态，**不释放已占用/已扣减库存**（买家取消 `POST /api/orders/:id/cancel` 会释放），造成库存永久少计。
2. 订单状态更新使用无条件 `update`，同一订单的重复/并发确认请求都能通过状态机校验，**可能重复扣减库存**。
3. `status='confirmed'` 时无条件把 `paymentStatus` 写回 `unpaid`，会把已收款订单（在线预付、已确认银行转账）**降级为未付款**，导致后续拣货/发货被 `ORDER_PAYMENT_REQUIRED` 阻断。
4. 履约路由没有 try/catch，事务内抛错（如 `PRODUCT_NOT_AVAILABLE`、并发放锁）在 Express 4 下不会返回响应，客户端挂起。

目标是让七种行业的订单状态与库存台账形成可验证闭环，并在此合同上交付小程序行业工作台。非目标：重写订单架构、引入新的状态枚举、改变 POS 与门店调拨口径。

### 18.2 状态机（以现有正式合同为准，未新增状态）

| 当前状态 | 允许的下一状态 |
| --- | --- |
| `pending` / `placed` | `confirmed`、`picking`、`cancelled` |
| `confirmed` | `picking`、`cancelled` |
| `picking` | `shipped`、`cancelled` |
| `shipped` | `delivered` |
| `delivered` | —（终态） |
| `cancelled` | —（终态） |

- 非法跳转统一返回 `409 INVALID_ORDER_TRANSITION`，不写任何数据。
- `picking` / `shipped` 前必须满足付款条件：有生效协议时按 `isOrderFulfillmentPaymentSatisfied`（准备/发货阶段），无协议时要求 `paymentStatus='paid'`（或 `net_30 + pending_credit`）；否则 `409 ORDER_PAYMENT_REQUIRED`。
- 需要协议确认的订单先走 `confirmOrderAgreement`，未生效协议返回 `409 AGREEMENT_CONFIRMATION_REQUIRED`。

### 18.3 库存规则（唯一口径）

| 时机 | 库存动作 | 实现 |
| --- | --- | --- |
| 订单创建 | 不扣库存 | `POST /api/orders` 只校验可售拆分 |
| 无协议的 `pending/placed → confirmed` | 中心仓按 SKU 扣减（`movementType='sale'`，`referenceType='Order'`） | `fulfill` 事务内 `reserveInventory` |
| 有生效协议的 `confirmed → picking` | 同上（协议生效才占用） | 同上 |
| 商家/买家取消（`pending/placed/confirmed/picking`） | 依据 `inventoryMovement` 反查已扣数量释放（`movementType='release'`），同步 `Product.skus.stockCentral/reserved`，释放 `StockReservation` 与优惠占用 | `getOrderInventoryReleaseChanges` + `applyInventoryLedgerChanges` |
| 重复/并发同状态请求 | 事务内 `updateMany({ where: { id, status: 旧状态 } })` 抢占，`count !== 1` 即 `ORDER_STATUS_CHANGED` 回滚 | §18.4 |

- 释放以库存台账为准，不按订单数量硬编码，因此部分发货、预订单（`preorderQuantity`）不会多释放。
- 连锁店（`inventory.mode='store'`）的库存归属门店，在线订单履约仍走中心仓路径；门店库存的真实扣减由 POS 销售与门店调拨承担，本轮不改变该边界（见 §18.9）。

### 18.4 本轮修复的真实缺陷

1. **商家取消不释放库存**：`fulfill` 新增 `cancelled` 分支（`cancelMerchantOrderRecord`），与买家取消同口径释放库存、释放占用/优惠，并对已收款订单生成退款请求（`refundTransaction.status='requested'`、`paymentStatus='pending_refund'`、`refundStatus='processing'`）。已存在处理中的退款时返回 `409 ORDER_REFUND_ALREADY_IN_PROGRESS`。
2. **重复/并发状态更新重复扣库存**：状态更新改为带旧状态条件的 `updateMany`，取消分支同样以旧状态抢占，冲突返回 `409 ORDER_STATUS_CHANGED` 并回滚事务。
3. **确认订单降级已收款状态**：仅当 `paymentStatus ∈ {unpaid, pending, payment_failed}` 时才写入 `unpaid`，`paid / partially_paid / pending_credit / pending_refund / refunded` 保持不变。
4. **履约路由无错误映射**：新增 try/catch，把 `ORDER_ALREADY_CANCELLED`、`ORDER_REFUND_ALREADY_IN_PROGRESS`、`INVALID_ORDER_TRANSITION`、`ORDER_STATUS_CHANGED`、库存并发错误、`PRODUCT_NOT_AVAILABLE`、`SKU_NOT_AVAILABLE`、`P2034` 映射为 409，其余走 `sendInternalError`，不再挂起请求。
5. 取消写入的 timeline 备注改为取消原因（不再复用物流承运默认文案）。

### 18.5 `GET /api/merchant/industry-context`（新增，服务端权威）

- 认证：`requireMerchantTenant`（商家本人或该商家在职员工）。
- 行业来源：只读 `Merchant.industryTemplate`，忽略客户端传来的 `templateId`/`industry` 参数；未分配模板时返回 `templateId: null, modules: [], requiresIndustrySetup: true`，不猜测行业。
- 响应字段：`merchantId`、`templateId`、`templateLabel`、`merchantIndustry`、`workspaceName`、`requiresIndustrySetup`、`modules`、`productModel`、`variant`、`pricing`、`inventory`、`features`、`productFields`、`permissions`、`role`、`employeeId`、`storeId`、`storeBound`。
- 能力来源：`src/constants/merchantIndustryCapabilities.ts`（与后台模块守卫、商品字段校验同一份清单），不新增第二套行业定义。
- 缓存：`Cache-Control: no-store`。
- 错误码：未登录/会话失效 `401 MERCHANT_AUTH_REQUIRED`；商家不存在 `404 NOT_FOUND`。


### 18.6 商家小程序行业工作台（本轮正式启动）

代码落点（`merchant-miniprogram/`）：

| 文件 | 作用 |
| --- | --- |
| `utils/industry.js` | 拉取/缓存 `industry-context`（按商家 ID 校验，10 分钟 TTL）、行业配置解析（fail closed）、模块/权限过滤、指标卡与字段摘要、`parseIndustryAttributes` |
| `industries/apparel-production-wholesale.js` 等 7 个文件 | 每个行业独立配置模块：标题、指标选择、常用动作、字段顺序提示、库存/订单规则文案 |
| `pages/industry/index.{js,json,wxml,wxss}` | 行业工作台：真实经营指标（`/api/merchant/dashboard`）、待处理订单（`/api/merchant/orders`）、按模块与权限过滤的常用动作、行业字段摘要、业务规则说明 |
| `pages/product-form/*` | 行业专属字段（服务端 `productFields` 中非列映射字段）渲染与 `industryAttributes` 提交；颜色/尺码占位按 `variant.colorLabel/sizeLabel` 展示 |
| `pages/product-detail/*` | 展示 `industryAttributes`（标签来自服务端字段定义） |
| `pages/orders/*` | 新增「取消订单」，复用 `PUT /api/merchant/orders/:id/fulfill`（`status='cancelled'`） |
| `pages/login/index.js` | 登录成功清空行业缓存并 `reLaunch` 到行业工作台 |
| `utils/api.js` / `utils/constants.js` | 401 同时清除会话与行业上下文，避免退出后复用上一个商家行业 |
| `app.json` | 注册 `pages/industry/index` |

行为约定：

- 行业判定只用服务端返回的 `templateId`；客户端参数不参与，无法通过改参数切换行业或读取其他商家能力。
- 配置模块只提供界面编排；动作携带的 `module` 必须存在于服务端 `modules`，否则小程序不渲染（单元测试强制）。
- 员工：`employeeId` 存在时按 `permissions` 过滤动作；商家本人视为拥有全部权限，与服务端 `requireEmployeePermission` 口径一致。
- 未分配行业模板的商家看到明确提示，不渲染任何行业动作。
- 商品表单提交 `industryAttributes` 只包含本行业允许键；服务端仍按 `getMerchantIndustryAttributeKeys` 与必填项校验，小程序不做放宽。

### 18.7 测试与实测结果（2026-10-29）

| 命令 | 结果 |
| --- | --- |
| `node --import tsx --test tests/merchant-miniprogram-industry.test.ts` | **4/4 通过**（行业配置覆盖、动作/字段不越界、权限过滤、属性解析） |
| `node --import tsx --test tests/industry-module-contract.test.ts tests/merchant-industry-backends.test.ts tests/merchant-fulfillment.test.ts tests/merchant-miniprogram-*.test.ts` | **47/47 通过**（含导航 ↔ 能力清单契约、商品表单/商品页/小程序 UI 回归） |
| `npx tsc --noEmit` | **exit 0**（两次，含能力清单改动后） |
| `bash scripts/test-industry-e2e-isolated.sh` | **9/9 通过**，`duration_ms 6896.36`（2026-10-29 复跑） |
| `bash scripts/test-pos-e2e-isolated.sh` | **3/3 通过**，`duration_ms 8956.87`（含 `b2c-checkout.e2e.ts` 取消与库存不漂移用例） |
| `node --import tsx --test tests/merchant-miniprogram-login.test.ts tests/merchant-miniprogram-order-create.test.ts tests/merchant-miniprogram-more-workspace.test.ts tests/merchant-cross-device-contract.test.ts tests/merchant-miniprogram-product-form.test.ts` | **33/33 通过**（登录后进入行业工作台、订单/更多/跨端契约、商品表单） |
| `node --import tsx --test tests/miniprogram-wxml-directives.test.ts` | **6/6 通过** |
| `npm run build` | 成功，`dist/server.cjs` 3.7mb（05:59 重建） |
| `git diff --check` | 无输出（exit 0） |

同批修正：`pos_shifts` 只存在于两个零售行业 manifest、未写入能力清单，导致「导航暴露但能力未声明」；已把 `pos_shifts` 补入 `general_retail` 与 `department_chain_retail` 的 `modules`，导航与能力重新对齐（契约测试 12 号用例覆盖）。

新增 E2E 用例：

1. `industry context is server-authoritative and cannot be spoofed by client params`：七行业 `templateId`、`modules` 与能力清单一致；携带 `?templateId=general_retail` 不改变结果；不同商家各自解析自己的行业。
2. `order lifecycle deducts and releases inventory exactly once per transition`：七行业逐一验证跨商家 403、`pending→shipped` 409、确认后库存扣减一次、重复确认 409 且不二次扣减、未收款拣货 409 `ORDER_PAYMENT_REQUIRED`、并发取消只成功一次且库存回补一次、已取消不可再取消/发货、已发货不可取消/回退、送达只能一次。连锁店（`inventory.mode='store'`）按正式边界断言中心仓库存不变。

### 18.8 未完成 / 待验证

- 小程序**未在微信开发者工具/真机运行**：`pages/industry`、行业字段表单、取消订单按钮只有代码与静态检查，缺少截图与真机证据。
- 小程序暂无 POS 收银/班次/退货页面（行业配置中收银动作指向 `pages/workspace?id=pos`，是现有 Web 工作区的等价入口，不等同于小程序原生收银）。
- 连锁店在线订单不占用门店库存（历史边界），门店库存仍由 POS/调拨维护；如需在线订单按门店履约需单独立项。
- 小程序订单页未覆盖 `delivered` 之后的售后/退货发起。
- 行业配置的视觉与信息层级未做设计评审。

### 18.9 发布与回滚

- 本轮只改 `server.ts`（新增只读接口 + 履约修复）、`src/constants/merchantIndustryCapabilities.ts`（补 `pos_shifts`）、`tests/`、`merchant-miniprogram/` 与文档，无数据库迁移。
- 回滚：还原 `server.ts` 的 `/fulfill` 与 `industry-context` 变更、还原小程序新增页面与 `industries/` 配置即可；已取消订单的库存释放是正确结果，回滚代码不会自动回滚已释放库存（如需纠正按台账手工核对）。
- 构建产物：`npm run build` 已成功，`dist/server.cjs` 为最新代码。
- **生产进程尚未重启**（本轮未获得生产部署授权）：上线需在低峰期重启单一生产进程并设置 `NODE_ENV=production`，重启后验证 `/api/health`、`/api/health/ready`、`GET /api/merchant/industry-context`（未登录应 401）与订单取消路径。小程序需在微信开发者工具上传新版本后才对商家可见。

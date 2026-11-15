# 模块规格：RUDA Restaurant OS（第八行业）

- Module ID：`restaurant-ordering`
- 模块状态：部分完成（阶段 0 审计完成；阶段 1 Web 表单主注册 API 在隔离 PostgreSQL 验证为 ACTIVE 并使用注册 Cookie 访问餐饮 API，邮箱快速注册亦已验证；注册 UI 1440/820/390 已实测但验证码 mock、未提交表单；小程序真机/工具验收仍待完成。阶段 2A–2F 目录/库存/采购 API、阶段 3A 桌台目录 API 与三端入口代码已通过定向测试；POS/KDS/订单闭环尚未实现）
- 文档阶段：规格先行
- 日期：2026-11-14
- 目标运行面：商家电脑 Web、商家手机 Web、RUDA 商家小程序、厨房显示屏、RUDA 顾客点单入口；电脑端优先交付专业经营流程，其余端从首期共享 API/权限/数据契约
- 关联规格：[`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md)、[`merchant-three-end-matrix.md`](./merchant-three-end-matrix.md)、[`merchant-cross-device-sync.md`](./merchant-cross-device-sync.md)
- 设计基线：[`design-values.md`](../design-values.md)、[`mobile-design-system.md`](../mobile-design-system.md)

> **产品决定：** 用户已确认餐饮为 RUDA 第八行业，经营范围为完整餐饮经营系统，不限于点单页面。正式开发任务书固定 `industry_code = restaurant`、`studio_code = restaurant_studio`、`knowledge_namespace = restaurant`。阶段 0 检查确认共享行业模板注册表是现有模板/工作区的唯一映射源，因此采用符合该注册表命名模式的固定内部键 `restaurant_ordering` / `merchant_admin_restaurant_ordering`；它们不是数据库 `industry_id`。当前仓库没有独立行业注册表或可核实的餐饮 `industry_id`，该值仍必须从正式注册源读取/生成，不得猜测、硬编码或覆盖既有行业 ID。
>
> **依据：** 已核对本规格所附 `Pasted text #1`（《RUDA Restaurant OS：第八行业正式开发任务书》）及用户补充的 Restaurant 智能化强化要求。两者共同构成本规格的产品范围和验收来源；如附件 #2 后续提供，再补入核对差异。

## 当前开发切片：Restaurant 商家可开通与桌面基础经营

**目标：** 让餐饮商家通过既有商家注册链路自助选择并开通 Restaurant，再从既有 MerchantPortal 实际维护菜单、菜品和桌台；不另建身份、注册、商品订单或菜单数据源。

- 行业身份严格使用现有固定键 `industryTemplate=restaurant_ordering` 与 `industry=RESTAURANT`；不按行业中文名称匹配，不要求 RUDA 管理员预置来源。注册表单的角色和经营品类由该模板定义，服务端校验模板、角色与品类组合；餐饮注册使用 `RESTAURANT_OPERATOR`，不得要求申请人选择服装品类或伪装成零售商。
- 商家后台首期仅暴露真实已接通的「菜单管理」「桌台管理」。菜单、菜品、桌台和门店通过既有 Restaurant Catalog API 持久化；权限和 tenant 由后端会话及现有员工权限中间件判定。
- 继续复用 `RestaurantMenu`、`RestaurantDish`、`RestaurantTable`、`MerchantStore` 和 `restaurant_menu` capability；不新增餐馆平行数据表或 API。
- 商家 Web 共用注册表单；小程序企业注册页共用 `/api/auth/register/company`，必须提供相同的 Restaurant 模板、经营者身份与餐饮品类。快速邮箱和 Google 注册依模板保存正确的 `restaurant` 经营类型。商家后台桌台/菜单的各端入口与验收状态记录在三端矩阵。
- 当前开放范围不包括 POS 收银、正式顾客点单、订单/支付、KDS、外卖履约、门店原料仓和 Restaurant AI Studio。界面与注册说明不得暗示这些能力已可用；这些能力完成并通过验收前，Restaurant OS 整体状态仍为「部分完成」。
- 菜单发布仍遵守服务端现有权限、版本、有效配方及公开门店校验；不能因为自助开通而放宽发布条件或将餐饮菜单同步成 B2B 商品。

## 当前闭环切片：采购收货 → 实际成本 → 配方 → 菜单发布

**目标：** 在现有餐饮菜单工作区中补齐采购单创建、提交与实际收货的 Web/手机 Web/小程序操作入口，使餐厅员工可从真实供应商采购开始，持续走到服务端实际收货成本、有效配方及顾客可见菜单。此切片不代表完整 Restaurant OS 或 Restaurant AI Studio 已完成。

- 复用现有 `/api/merchant/suppliers` 供应商目录和 `/api/merchant/restaurant/purchase-orders*` 采购单/收货 API；不增加采购表、接口、库存台账或成本算法。
- 三端复用同一商家 JWT、租户权限、采购订单和供应商数据。服务端继续执行 Restaurant 模板、`purchase.manage`、资源归属、幂等键、版本冲突及中央仓限制。
- 流程：维护餐饮原料 → 选择本商家有效供应商并创建采购草稿 → 确认提交采购单 → 按实际到货数量和单价登记收货 → 服务端事务写真实收货/库存流水 → 查询配方实际成本与菜单毛利 → 激活配方 → 加入菜单草稿 → 商家确认发布 → 从公开 Restaurant 菜单 API 验证发布结果。
- 实收数量、实付单价及过敏原必须来自商家核对；不得把报价、模型生成内容或 UI 输入当作已收货/已发布事实。AI 不参与本切片的库存、价格、食品安全或发布写入。
- Web 与手机 Web 继续复用 `RestaurantMenuWorkspace`；小程序在既有 `restaurant-menu` 页面加入等效采购/收货操作，不增加后台一级入口。
- 空态、加载态、失败重试、幂等重复提交、版本冲突与无权限错误均须明确；写入成功后从服务端重新读取，不以本地乐观更新作为完成依据。
- 验收至少覆盖三端相同 API 契约、隔离 PostgreSQL 真实采购/收货/成本/发布持久化、租户与员工权限、重复请求与版本冲突，以及 Web 390/820/1440 视口检查。小程序开发者工具/真机不可用时标记待验收。
- 非本切片：POS/订单/支付/KDS/预约/外卖履约、多门店库存、餐饮图像生成、Restaurant AI Studio 的真实模型调用与 AI Job。不能由本切片完成状态推导这些能力已开放。

## 1. 问题与目标

RUDA 现有 7 个经营模板没有餐饮专用工作区。普通零售 POS、商家订单和商品模型已存在，但它们不能单独表达餐饮菜单、桌台、预约、菜品规格/加料、配方原料、厨房工位、制作任务、外卖履约和真实成本。目标是交付一套可日常营业的 Restaurant OS，而不是独立聊天框或仅可点击的演示页面。

Restaurant OS 由三项共享同一 RUDA 身份、Tenant、门店、订单与账务事实的业务面组成：

1. **Restaurant Business**：POS、堂食、桌台/预约、QR 点单、菜单/菜品/套餐、厨房 KDS、外卖/自取/配送、配方/原料/库存、采购、员工/排班、顾客/会员、营销、财务及多门店经营。
2. **Restaurant Studio**：复用 RUDA AI CORE 的餐饮专业工作室，支持菜品研发、菜单、摄影、成本/毛利、销量预测、采购/库存建议、营销和经营分析。
3. **Restaurant Storefront**：复用既有 RUDA 顾客入口实现在线菜单、桌台扫码、线上点单/支付、堂食、外卖、自取、订单跟踪及预约等获批能力。

POS、Storefront、员工点单、第三方授权渠道的订单最终进入同一个 RUDA 权威订单中心；厨房任务和报表是有事件/来源可追溯的业务实体或投影，不得另建一份互不相认的订单/账务系统。

## 2. 范围与非目标

### 最终产品范围

- 行业注册、Studio entitlement、门店/经营模式、员工权限和后台专业入口。
- 多菜单/时段/门店/渠道、菜品/套餐/规格/加料/过敏原/售罄与确认发布。
- 餐饮 POS、桌台/楼层/区域、预约/候位、QR 与线上点单、暂存/恢复、拆并单、分人/部分付款、折扣/退款/收据（以所在地区合法与现有支付能力为准）。
- KDS 工位、订单自动分单、部分出餐、计时、超时提醒、取消同步、打印/离线恢复。
- 外卖、自取、配送区域/任务、第三方渠道适配（只有真实授权和回调通过才开放）。
- 配方版本、食材单位换算、采购价格、批次/效期、盘点/损耗、库存 reservation/消耗/释放、供应商采购及收货。
- 顾客/会员/营销、员工岗位/排班、财务对账/门店报表及多门店总部视图。
- Restaurant Studio + `restaurant_intelligence` AI Brain、自动化规则引擎、AI 智能驾驶舱、任务/评估/知识隔离及低风险规则动作。
- 桌面 Web、手机 Web、小程序、厨房显示屏及顾客入口使用共用后端和数据；按设备保留 RUDA 各自原布局、导航与交互。

### 非目标

- 不重做公共商城、买家账户、商家后台外壳、支付网关、订单、商品、库存、客户、员工或通知系统。
- 不在第一阶段一次性交付上述全部最终范围；预约/会员/第三方渠道/自动派送等按阶段进入，但须列入后续正式验收，不得以“非目标”从最终产品删除。
- 不伪造地图服务、支付结果、外卖平台连接、预测结果、经营数据或设备在线状态；未接通能力须明确标为不可用/待验证。
- 不因建立餐馆模板而删除、改名或改变 7 个既有模板的 ID、导航、权限或注册行为。
- 不把现有 `general_retail` POS 改造成餐馆模板，也不让餐馆默认获得 Apparel/Leather Studio、服装/皮具知识或工具。
- AI 默认只读；不得未经有权限人员确认，执行真实收款/退款、采购付款、售价修改、正式配方/食品安全信息修改、正式菜单发布、库存调整或对外营销发布。
- 不修改生产数据库或部署。本规格不批准任何迁移或上线操作。

## 3. 现状审计与防重复结论

### 3.1 已确认的复用能力

| 领域 | 当前 RUDA 能力 | 本模块复用边界 |
|---|---|---|
| 行业与模板 | `src/constants/merchantIndustryTemplates.ts` 是前后端共用的 7 模板清单；`src/server/merchantIndustryTemplates.ts` 负责服务端注册解析；旧行业枚举已有 `RESTAURANT` | 增加模板时只扩展权威注册链，不新建另一套餐馆行业映射；`restaurant` 分类器结果不能直接作为授权 |
| 商家身份与租户 | `Merchant`、商家 JWT、`requireMerchantTenant`、`MerchantEmployee` 及员工权限服务 | 所有商家接口从已验证会话取得 tenant；不得信任客户端 `merchantId`、模板 ID 或员工权限 |
| 菜品基础资料 | `Product`、`ProductVariant`，已有名称、多语言描述、图片、分类、SKU/条码及零售价等字段 | 优先复用作为菜品身份和基础资料；餐饮菜单价格、可售时段等若不同于一般商品，必须在菜单域明确单一权威字段，不得双写或把菜品默认发布到 B2B 商城 |
| 订单与订单行 | `Order`、`OrderItem`、商家订单列表/详情、订单消息、协议、发货和状态操作 | 作为餐馆订单和明细的唯一权威记录；新增渠道数据只能补充订单上下文，不能另建餐馆订单/订单行系统 |
| POS 与支付记录 | `/api/merchant/pos/sales`、`MerchantSmartPos`、POS 班次、`PaymentTransaction`；POS 销售写入现有订单并要求员工确认现场已收款 | 复用 POS 收银、班次和支付事实；堂食桌台单/外卖流程不得伪造“已支付”，也不能将 POS 现场确认套用到顾客线上付款 |
| 门店与库存 | `MerchantStore`、`MerchantStoreStock`、`StockReservation`、库存流水；门店履约规格见 `merchant-store-fulfillment.md` | 有门店时复用门店范围、库存锁和预留；没有餐馆原料/配方库存事实时，不推导或伪造食材库存。售罄状态与商品实物库存必须区分 |
| 商品媒体 | 现有商家媒体预签名上传和对象存储流程 | 菜品图片复用现有媒体服务、权限、文件 ID 和清理规则；不使用 data URL 或自行拼接存储路径 |
| 三端同步 | 商家 Web/手机 Web 共用 API client、B2BContext 与 SSE；小程序沿用商家 JWT、请求封装及页面恢复刷新 | 统一 API、tenant 和业务规则；保持各端既有布局/颜色/字体/导航与触控习惯 |
| ModaUI / AI | 现有助手、任务 Supervisor、Provider Gateway 和行业配置 | 复用现有服务端 AI 入口；Restaurant Studio 只加载餐饮能力与获批知识，不复制 AI 运行时或建立平行模型网关 |

### 3.2 当前缺口

- `merchantIndustryTemplates.ts`、`merchantIndustryCapabilities.ts`、行业工作区 registry、demo 行业映射和入驻注册均未注册餐馆模板。
- `RESTAURANT` 是旧行业枚举值，但不等于已开通餐馆工作区或授权。
- 当前 Prisma schema 未发现餐馆菜单、菜品选项组、堂食桌台或餐馆营业时间模型。
- 当前 `Order.deliveryType` 仅定义通用配送/展厅自提等值，不能充分表达堂食桌台、自取与餐馆外卖；`Order.status` 不能未经审计就复用为厨房制作状态机。
- 通用 POS 依据已上架 `Product`/SKU 和当前库存进行销售，含人工支付确认；不提供菜单分类、加料组合、桌台扫码或厨房状态流程。
- 当前未确认统一顾客接口是否支持无需登录的餐馆桌台/外卖下单、餐馆线上支付、税费规则及向商家订单实时通知。

### 3.3 防重复搜索记录

已检索：`merchantIndustryTemplates`、`merchantIndustryCapabilities`、`industryWorkspaceModules`、`RESTAURANT`、`restaurant`、`MerchantSmartPos`、`/api/merchant/pos/sales`、`/api/merchant/orders`、`/api/orders`、`Order`、`OrderItem`、`PaymentTransaction`、`MerchantStore`、`MerchantStoreStock`、`Product`、`ProductVariant`、`Menu`、`DiningTable`、`Modifier`、`Restaurant`。

复用现有订单/POS/商品/支付/库存/身份/媒体能力的证据如上。缺失的餐饮专用概念只在完成 schema、API 调用方及兼容审计后，才可新增最小扩展；不得照本节名词一次性创建多个重复表。

## 4. 行业注册、入口与权限

### 4.1 唯一行业与工作室映射

| 项目 | 固定值/来源 | 说明 |
|---|---|---|
| 行业代码 | `restaurant` | 用户任务书固定；不得从显示名称或分类器文本推断授权 |
| Studio 代码 | `restaurant_studio` | 用户任务书固定；必须经 RUDA 唯一 Studio registry 映射 |
| 知识命名空间 | `restaurant` | 与 Apparel、Leather、其他行业隔离，检索在服务端按权限过滤 |
| `industry_id` | RUDA 正式行业注册表 | 阶段 0 读取真实 ID；不得猜测、硬编码、覆盖既有行业 ID |
| 商家模板/工作区 ID | `restaurant_ordering` / `merchant_admin_restaurant_ordering` | 唯一模板 registry 的稳定内部键；当前开放有限的菜单/桌台工作区；不等于 `industry_id` |
| 用户可见名称 | 餐馆 / RUDA Restaurant | 简体中文术语遵循全站词表；不能与综合零售商合并 |

阶段 0 核对行业注册表、七个已用模板、历史行业 ID、能力清单、Studio registry、注册/补充行业流程、种子/演示账号和所有调用方；确认无冲突后一次性更新唯一注册链及测试。普通消费者注册仍不要求选择行业。商家行业授权、Studio entitlement、门店角色和商城公开销售授权是不同权限，不得互相推导。

普通顾客仍按现有规则注册，不强制选择餐馆行业。商家选择该模板后沿用当前商家身份及注册状态；不得私自改变商家审核或公开销售审核流程。行业开通和公开商城销售授权是两个独立状态。

### 4.2 权限建议

复用现有角色与员工权限服务。实施阶段先核实现有权限是否满足，再决定最小新增项；禁止把 UI 隐藏当作授权。

| 角色 | 菜单 | 订单 | 桌台 | 现场收款/退款 |
|---|---|---|---|---|
| 商家所有者 | 完整管理 | 查看、接单、改状态 | 完整管理 | 依现有支付/退款授权 |
| 餐馆经理 | 管理和上下架 | 接单、分派、状态操作 | 管理 | 使用已有审批权限 |
| 收银/服务员 | 只读菜单 | 创建堂食单、提交桌台单 | 查看/服务获授权桌台 | 只登记已完成的现场收款；折扣按既有价格审批 |
| 厨房员工 | 只读出单 | 查看必要菜品/备注，更新制作状态 | 不读顾客敏感资料 | 无 |
| 顾客 | 查看当前公开菜单 | 只能创建/读取本人或当前会话所授权订单 | QR 仅授权对应餐馆/门店/桌台 | 线上支付必须以支付服务确认结果为准 |

建议的细粒度员工权限候选：`restaurant.menu.manage`、`restaurant.order.accept`、`restaurant.order.prepare`、`restaurant.table.manage`。候选权限只有经 `employeePermissions`、默认角色、服务端路由和权限测试完整登记后才可使用；首期可映射到现有权限，但不得无条件扩大所有员工权限。

所有订单、菜单、桌台、上传、退款及变更操作都要验证 `merchantId` 与门店范围；跨租户资源统一按现行 API 契约返回 404/403，不泄露其他商家资源是否存在。

## 5. 用户流程与状态

### 5.1 菜单与营业配置

1. 商家电脑端从现有行业入口打开餐馆工作区。
2. 商家维护菜单分类和菜品资料，关联现有 `Product` 记录；若需照片，调用 RUDA 媒体服务。
3. 菜品配置上架/售罄/暂停售卖；服务端在下单时再次校验状态和价格。
4. 商家配置营业时间、可接单状态和堂食/自取/外卖可用方式。时间范围、时区、节假日覆盖和闭店订单策略需在 API 契约中固定，客户端不做权威判定。
5. 桌台配置生成随机、不可枚举且可撤销的二维码凭据；服务端将其约束到商家、门店和桌台，不信任顾客提交的任意 `tableId`。

### 5.2 店内点单

- 店员可从餐饮 POS 为柜台或桌台建单；顾客可通过门店/桌台 QR 打开当前餐馆菜单并提交订单。所有入口最终使用统一 `Order`/`OrderItem` 和价格/支付领域服务。
- 桌台下单必须确定唯一服务模式：堂食桌台、柜台自取，或餐馆外卖；一个订单不能静默切换门店/桌台。
- POS 账单需要按阶段支持暂存/恢复、加菜/退菜、拆并单、分人或部分付款、组合支付、折扣、优惠券、小费、退款和收据；各项只在真实 API、状态机、员工授权及本地支付/税务条件通过后开放。
- 预约、候位、楼层/区域和桌台状态（空闲、已预约、使用中、待结账、清洁中、停用）属于最终范围；预约冲突与桌台状态由服务端校验，不依赖浏览器本地状态。
- 顾客提交后订单进入待餐馆确认状态；厨房状态和支付状态分开记录。

### 5.3 外卖/自取

- 顾客只能选择当前商家开放的订单方式、服务时间和可用菜单项。
- 自取订单记录承诺取餐时间/地点；外送订单需要完整地址、联系人及可送范围校验。
- 最终范围包括配送区域/费用/最低金额/营业时段、配送任务、骑手分配与履约状态、异常/送达凭证和经授权的第三方渠道适配；逐项分期实现。没有真实地图/配送 API、商家账号授权或有效回调时，必须显示未配置，不能生成虚假距离、轨迹、连接状态或送达结果。
- 支付可以是现有服务明确支持且由服务端核验的线上支付，或现有 POS 的人工现场确认。支付网关暂不可用时不得把订单写成已支付，也不得伪造成功回调。

### 5.4 订单状态和价格

建议将商家处理状态定义为独立、受服务端校验的状态流：

`submitted → accepted → preparing → ready → served / picked_up / delivered → completed`

允许的取消/拒绝分支、退款、订单超时和部分制作须在详细 API/状态规格列出。`paymentStatus` 继续由 RUDA 支付事实驱动；不得用厨房状态推导已付款，也不得把业务拒单直接当作已退款。

金额使用现有 Decimal 精度与 RUDA 确定性价格服务；订单创建时在 `OrderItem` 记录最终菜名、SKU/选项、数量、单价、折扣及金额快照。税率、是否含税、服务费、包装费、配送费、最低起送金额及货币必须依运营国家/商家配置和法律要求明确后才能上线，不得硬编码或由 AI 估算后自动入账。

### 5.5 菜单、菜品与售罄

- 支持分类、不同菜单/门店/时段、菜品、多语言内容、套餐、规格/加料组、价格、图片、已确认过敏原、营业时段和渠道可售状态。
- 所有渠道（顾客网站、QR、小程序、POS、已授权第三方）显示/校验同一服务端有效版本；门店暂停、全渠道暂停、单渠道暂停和定时恢复必须有明确作用域与审计记录。
- AI 翻译、介绍或生成图仅为待审核素材；过敏原、实际配料/份量与食品安全声明必须来自人工核验的原料/配方数据，AI 不得猜测或改写。

### 5.6 配方、原料、采购及厨房

- 食材支持采购/库存单位、经配置校验的换算比例、供应商/采购价格、安全库存、批次、生产/到期日期、储存位置、已确认过敏原和门店归属。
- 菜品关联有效配方版本；支持份量/规格差异、子配方、损耗/产出率、生效时间和审核。配方修改不得改写历史订单成本/消耗快照。
- 库存采用可审计流水、预留、消耗、释放、盘点差异和损耗记录。下单/制作/取消/退菜扣减时点按门店规则固定；取消未制作订单释放预留，已消耗原料不得凭空恢复。每次变动使用事务与幂等键并记录原因、来源及操作者。
- 采购支持申请、审核、订单、部分/全部收货、退货、采购价历史、批次入库、对账和付款记录；AI 只给建议，正式采购单/付款须有权人员确认。
- KDS 支持可配置厨房工位、按菜品自动分单、菜品级部分出餐、计时、特殊要求/已确认过敏原提示、超时提醒、取消同步和状态历史，并适配厨房大屏/平板、声音提醒、打印机和断网恢复补偿。设备或连接未真实接通时不得显示为在线。厨房状态不替代/复制订单状态；事件传递须可靠、有事件 ID、重试与幂等。
- 经营模式按配置支持正餐、咖啡、快餐、外卖厨房、烘焙、中央厨房、连锁及酒店餐饮；模式差异不得复制独立订单核心。

### 5.7 员工、财务及多门店

- 复用 RUDA 账号、员工身份和 RBAC；岗位/门店/排班/考勤/工时按最小权限接入，退款、免单、作废、库存调整和财务变更可以要求独立或双人审批。
- 营业报表区分营业额、净销售、退款、折扣、支付费用、原料成本、毛利、运营费用及经营利润；销售额减原料成本不能称为净利润。金额使用现有精度/货币服务。
- 支持 Tenant 下多 Outlet 的独立菜单、价格、营业时间、员工、桌台、库存、订单和结算；总部只在明确授权范围内汇总，跨店调拨/采购用正式业务服务。
- 当地税务、电子发票、收银设备和个人数据规则须由目标市场专业方确认；不得把未经验证的法规写死成跨国规则。

## 6. 数据归属与模型演进原则

| 数据 | 权威所有者 | 设计约束 |
|---|---|---|
| 菜品基础身份、名称、图像及商品关联 | 现有 `Product` | 不新增一套与 Product 无关联的商品主表；餐馆菜品默认不自动公开到 RUDA 批发商城 |
| 餐馆菜单分类、菜单展示顺序、时段/门店可售 | 审计后确定最小 Restaurant Menu 配置实体 | 只保存餐饮特有配置；关联 merchant、可选 store 和 product；不复制多语言商品字段 |
| 菜品可选项/加料 | 现有变体能表达的优先复用；否则新增餐饮专属选项组/选项 | 组合价格服务端计算；下单时把选项与价格快照写进现有订单行，不另建订单行系统 |
| 桌台与 QR 凭据 | 最小餐饮桌台实体 | tenant/store 作用域、唯一随机凭据、轮换/撤销；不把可猜的数据库 ID 当作认证凭证 |
| 顾客订单与订单行 | `Order`、`OrderItem` | 唯一订单及财务事实；餐馆场景只增加明确扩展字段或一对一上下文，不平行创建餐馆订单表 |
| 厨房/履约状态 | 现有订单状态与事件能力，审计后确定扩展 | 必须保留允许的状态转换和操作审计；厨房视图是投影，不产生第二份订单状态 |
| 支付/退款 | `PaymentTransaction` 及现有支付/退款服务 | 外部通知验签、幂等、金额/币种核对；人工收款必须有实际收款确认 |
| 菜单与餐饮菜品属性 | `Product` + 经审计确定的餐饮菜单关联/配置 | Product 继续是商品身份权威源；餐饮可售时段、渠道、规格、过敏原等仅存其专属扩展，不复制商品多语言/媒体 |
| 原料、配方、批次与库存流水 | 先复核库存、采购、供应商与批次模型；缺失才增最小餐饮域实体 | 单位换算、配方版本、批次追溯、reservation/consumption/waste 可审计；不以 SKU 库存数字冒充原料库存，也不覆盖历史快照 |
| KDS 与厨房工位 | 订单/订单行 + 事件；必要时增加任务实体/投影 | 每张任务关联唯一来源订单项和事件 ID，重试不重复创建；KDS 状态不成为第二份订单 |
| 门店、桌台、预约与配送 | `MerchantStore` 优先；缺少餐饮语义时增最小扩展 | 门店上下文、桌台凭据、预约冲突和配送区域由服务端验证 |
| 供应商/采购/员工 | 既有 Supplier、采购、RBAC/员工及审批服务 | 只增加餐饮专用关联/字段；不创建平行供应商、采购、账号或权限系统 |
| 餐厅 Studio 项目、文件与 AI 任务 | RUDA 项目/文件/AI CORE | 同一行业 Studio 命名空间；不新建独立 AI runtime、对象存储或记忆数据库 |
| 预测与经营报告 | 权威订单、配方、库存、采购、排班/营业时间等来源；AI 分析历史记录 | 每份建议保存范围、截至时间、数据源/口径、模型/规则版本、数据充分性；报告指标可回查确定性计算 |
| 文件 | 现有媒体服务/对象存储 | 数据库存 file ID/受控引用，不存图片字节或凭证 |

实施前需再次检索 Prisma schema、migration、写入事务和查询调用方，确认是否已有兼容字段。只有确认缺失后才能创建最小 additive migration；明确索引、唯一约束、租户外键、回滚方式和旧客户端兼容窗口。不得直接按产品名词生成多个表。

### 6.1 待审计的领域实体候选（不是建表清单）

只用于阶段 0 比对现有模型，不能按名称直接建表；现有能力应扩展或关联，真正缺失时才新增最小增量实体。

| 领域 | 候选业务概念 |
|---|---|
| 餐厅/门店 | Restaurant Profile、Outlet、Business Mode、Opening Hours、Service Settings |
| 菜单 | Menu、Category、Menu Item 关联、Variant、Modifier Group/Option、Allergen、Menu Schedule |
| 堂食 | Floor、Dining Area、Table、Reservation、Waitlist、Table Session |
| 原料/配方 | Ingredient、Ingredient Batch、Recipe、Recipe Version、Recipe Ingredient、Stock Movement/Reservation、Waste Record、Stocktake |
| 厨房 | Kitchen Station、Kitchen Ticket/Item、Kitchen Event |
| 订单履约 | 复用 RUDA Order/OrderItem，仅按需增加餐饮上下文、配送区域/Assignment/Event、Channel Mapping |
| 采购/员工 | 复用现有 Supplier、采购、MerchantEmployee/RBAC；缺失的餐饮关联、排班/考勤信息才扩展 |
| AI/事件 | 复用 Project/File/AI Job/Usage/Knowledge/Memory 与可靠事件机制；按需关联 `restaurant_studio`、`restaurant_intelligence` 和行业知识 |

具体字段、索引、外键、唯一约束、状态转换及迁移/回滚方式须在各阶段开始前基于真实 schema、调用链和业务事务另行定稿；候选 `restaurant_*` 表名不构成新建数据源的批准。

## 7. API 与集成边界

所有客户端走统一 RUDA 服务端规则，不为电脑、手机、顾客 Web 和小程序建设独立订单后端。以下为待实施的逻辑操作；具体 REST 路径和 payload 必须在改代码前基于现有调用方/API 契约落定。

| 操作 | 调用身份 | 服务端责任 |
|---|---|---|
| 读取公开菜单/营业状态 | 公共顾客或有效桌台凭据 | 仅返回公开且当前可售信息；限流、缓存时效和商家停业状态需明确 |
| 管理菜单/桌台/营业方式 | 商家 JWT + 员工权限 | tenant/store 校验、字段白名单、并发版本、审计和输入校验 |
| 创建店员 POS 订单 | 商家 JWT + `sales.order.create` 或确认后的餐饮权限 | 复用统一订单领域服务、商品/价格、库存和 Idempotency-Key |
| 创建桌台/外卖订单 | 买家会话或受限的顾客订单凭据 | 防刷/幂等、服务端重算价格、餐馆营业状态/方式/可售项校验及订单持久化 |
| 接单、拒单、开始制作、出餐/配送完成 | 商家 JWT + 对应员工权限 | 按允许状态转换更新同一订单并留下操作者/时间/原因 |
| 查询餐馆订单/厨房工作队列 | 商家 JWT + tenant/store/角色范围 | 分页、状态/门店筛选；厨房角色仅返回制作所需最小字段 |
| 查询支付/退款状态 | 顾客所有权或商家权限 | 读取支付服务最终状态，不采信客户端支付结果 |
| 创建/恢复 Studio 项目、上传文件、提交/读取 AI Job | 商家 JWT + `restaurant_studio` entitlement + 租户/门店权限 | 使用 RUDA 项目/文件/AI CORE 服务；各端共用 Project/File/AI Job ID，AI Job 为异步、可查询、可重试 |
| 查询餐饮报告/预测/建议 | 有权商家员工/管理员 | 服务端按 Outlet/期间/权限过滤；返回数据截止、口径、数据缺失、预测/实际标志和计算来源 |
| 确认 AI 建议或创建 Product 草稿 | 有权员工显式确认 | 检查目标对象版本/权限，幂等保存变更审计；正式发布仍调用 Product Center 审核流程 |

错误至少区分：未登录、无权限、租户资源不存在、菜品停卖、价格已变更、门店暂停接单、订单方式无效、营业时间外、库存不足、状态冲突、幂等键重复使用、限流、支付未确认和内部错误。写接口需幂等；并发状态/菜单修改需版本条件或等效事务保护。

创建订单的事务边界应包含：重新读取并校验菜品/价格/营业状态，计算金额，按既有库存规则预留或扣减（仅适用可库存 SKU），建立 `Order` 与 `OrderItem`，记录选项快照和必要支付状态；任何失败均全部回滚。不得由客户端总价、商家 ID、门店 ID、行业 ID 或支付状态决定权威结果。

业务事件建议包括 `OrderPlaced`、`OrderAccepted`、`PaymentConfirmed`、`KitchenTicketCreated`、`KitchenItemStarted/Ready`、`OrderReadyForPickup`、`OrderDelivered/Cancelled`、`RecipeVersionChanged`、`InventoryReserved/Consumed/Released/Adjusted`、`ReservationCreated/Cancelled`。名称仅为契约设计候选，实施前复用 RUDA 既有事件规范并登记生产者/消费者、唯一 ID、版本和重试策略。

### 7.1 Restaurant Studio 与 `restaurant_intelligence`

- Studio 固定使用 `studio_code: restaurant_studio`、`industry_code: restaurant`、`knowledge_namespace: restaurant`，统一调用现有 RUDA AI CORE / Model Gateway、任务框架、文件服务、项目/记忆和额度审计；不得新建独立第三方 AI 系统或模型网关。
- Brain 以 `restaurant_intelligence` 为餐饮领域服务/能力边界，按请求身份、Tenant、Outlet、员工权限和用途，读取经授权的订单、菜单、有效配方、原料/库存批次、采购、财务及排班数据。它不是绕过业务 API 直接写库的独立智能体。
- AI 专业能力覆盖：POS 菜品/套餐/加购建议；厨房优先级、负载与出餐时间建议；库存低量/临期/消耗预测；采购比价与数量建议；菜单销量、成本、毛利分析；会员分群/复购/营销建议；客流/排班建议；营业异常、成本变化、多门店对比和每日经营报告。
- Studio 工作区包含 AI 菜品研发、菜单设计、多语言内容、菜品摄影、成本分析、销售预测、采购助手、营销助手、经营报告及历史项目。AI 生成配方、图片、文案均为草稿；生成图不能冒充实物菜品照片或改变真实配料/份量/过敏原。
- AI 成本/价格/库存计算必须调用确定性业务计算服务，返回可追溯的输入数据、单位、时间和口径；不能由模型自由生成数字。报告分别标明营业额、净销售、原料成本、原料毛利与其余运营费用；数据不足时明确返回“数据不足”及缺失项。
- 销量/客流/采购/出餐等预测基于可用历史订单、当前库存、有效配方、门店营业时间、节假日、预约/已知活动、季节等实际数据。预测记录预测区间、生成时间、数据截止点、特征来源/缺失、模型/规则版本和置信/质量信息；结果到期后记录实际结果与误差并用于评估。禁止以预测值冒充订单、库存或已实现收入。
- AI 分析失败、超时或配额耗尽必须隔离在异步任务/分析通道，不阻断 POS、订单、支付、KDS 或库存核心流程；AI Job 状态和失败原因可诊断、可重试。

### 7.2 自动化规则与确认边界

使用现有事件/队列/任务基础设施；先审计是否已有 Outbox 或可靠投递机制。关键事件须带唯一 Event ID、Tenant/Outlet、来源/业务对象 ID、发生时间、处理状态和重试记录；事件消费者幂等，不能依赖某个浏览器在线。

| 触发事件 | 规则动作 | 自动执行边界 |
|---|---|---|
| 订单创建/确认 | 按菜品工位建立厨房任务 | 允许配置后自动分单；不得重复出票 |
| 菜品售罄/恢复 | 按门店/渠道规则同步可售状态 | 只按已确认规则更新；可审计、可撤回 |
| 原料低于阈值/批次临期 | 建立库存/效期预警及 AI 补货建议 | 自动提醒；不得自动提交采购/付款 |
| 厨房任务超时 | 提醒授权岗位/值班人员 | 可自动通知，不自动篡改订单状态 |
| 营业日结束/销售汇总完成 | 生成经营日报/刷新分析 | 定时任务可自动运行；报告必须标记期间、来源与完成状态 |
| 采购到货/收货确认 | 增加对应批次及库存流水 | 仅在有权限的收货确认后入账，支持部分收货和幂等 |
| 价格/配方/食品安全/菜单正式变更 | 形成建议或待审核草稿 | 必须有相应权限人员明确确认；保留修改前后版本与审批记录 |

退款、资金/支付、采购付款、售价修改、正式配方或食品安全信息修改、正式菜单发布、库存调整等高风险写入必须经服务端授权与必要审批；AI 不可通过“低风险规则”配置绕过此项。所有 AI 产生的待确认修改记录 AI Job、用户、Tenant、Studio、目标实体/版本、建议前后值、确认人/时间和执行结果。

### 7.3 AI 智能驾驶舱

面向有权限的餐厅经营者提供每日营业总结、销售排行、成本/毛利变化、库存风险、采购建议、厨房效率、顾客经营分析和次日建议。自然语言查询只允许调用可审计、权限过滤的业务查询工具；每个答案标明数据时间范围、指标口径、实际/预测区分和缺失数据。日报金额须与 RUDA 权威财务/订单汇总对账；无可靠成本来源时不输出“利润”结论。

AI 知识记录必须复用 RUDA 知识/记忆系统并保存或可解析 `industry_id`、`studio_id`、`tenant_id`、`knowledge_type`、`source_id`、`approval_level`、`model_version`、`permission_scope`；检索在服务端先做行业、Tenant、Outlet、审批与员工授权过滤。只有明确批准的通用基础资料可进入 Shared Knowledge。Restaurant AI 员工复用 RUDA 智能员工/Agent 框架及同一权限、任务、审计和知识空间，不单独建账号/数据库或绕过正式业务 API。

RUDA AI 管理中心继续作为唯一模型/Provider、密钥、知识 namespace、五层记忆权限、额度、成本、训练集、质量评估、运行与失败任务的管理面。Restaurant 只登记餐饮 profile/capability；模型密钥仅保存在服务端安全配置，不能暴露浏览器、小程序或日志。App Store 中的视频、摄影、翻译、广告、客服、分析等是可选扩展应用，不得要求安装才能使用餐饮核心 Studio。

### 7.4 RUDA Product Center 闭环

Studio 项目与 RUDA `Product` 保持独立 ID，通过现有或经审计扩展的正式关联服务连接。菜品资料可含 Product ID、Industry/Category、名称/图片、设计文件、材料、规格/变体、SKU、成本来源、生产/菜单资料和批发价（适用字段由 RUDA Product Center 契约确定）。AI 或用户可生成商品草稿；必须由有权限商家审核后才可正式发布到 RUDA 商城/相应渠道。不得从 Studio 另建商城、订单或产品主数据；不得自动发布。

## 8. 界面范围与设计约束

- **三个端一起规划**：电脑 Web、手机 Web、小程序在功能开发前统一 API、身份/行业识别、Studio 匹配、项目/文件/AI Job、任务状态、权限、错误/通知和版本/并发契约；不得建立三套后端、AI 服务、项目 ID 或数据源。
- **电脑端专业工作站优先**：先完成菜单、完整 POS、桌台、KDS、工程化经营配置和 Restaurant Studio 专业功能；复用 MerchantPortal 外壳、顶部栏、侧栏和既有交互，不重做后台。电脑端是优先交付顺序，不代表其他端等到最后才建基础入口/API。
- **手机 Web**：与电脑端共用同一订单/项目/任务数据，按原手机导航和触控习惯支持拍摄上传、AI 对话、结果/结构查看、简单修改、确认、历史、审批/进度及文件查看下载；不缩小桌面三栏，不强求复杂 CAD/密集配置在手机完成。
- **RUDA 小程序**：使用现有商家账号和统一 API，沿用原有小程序导航、WXSS/rpx 和交互，支持行业入口、拍照、AI 对话、任务/结果、简单修改/确认、项目历史、通知及商品/订单入口；不能另建用户、项目、记忆或餐饮订单数据库。
- **厨房显示设备**：提供适合大屏/平板/厨房浏览器的实时工位队列、计时、提醒与恢复能力；不强制套用后台页面布局。
- **顾客点单界面**：优先复用 RUDA 既有前台/顾客小程序的账户、商品展示、媒体与组件；只增加餐饮专属菜单/桌台/购物车流程，不另建顾客账号系统。
- **视觉**：电脑、手机 Web、小程序和顾客端分别遵循 RUDA 平台现有布局、颜色、字体、间距、导航、圆角/图标令牌和交互习惯；不加餐饮专属主题、不擅自重设计或混用后台/Storefront 设计系统，不引入 UI 依赖。
- **文案**：简体中文为默认；行业名称使用“餐馆（外卖与店内点单）”，产品 Studio 仍用既有 ModaUI/Restaurant Studio 命名规则；状态名三端一致。
- 四字导航规则适用于新增后台导航项；仅在确有业务必要时增加，并先映射到既有导航分组，不重组行业导航。

## 9. 错误、审计与运营要求

- 订单关键转换记录操作者、员工、门店、时间、前后状态和拒绝/取消原因；不得将顾客完整地址、手机号或支付凭证写入非必要日志。
- 菜单/价格更改对新订单立即按版本生效；已提交订单保留原价格快照，不因后续改价而变化。
- QR 凭据泄露可撤销/重置；匿名顾客不能通过订单号枚举读取他人订单。
- 写接口支持重复请求；付款、退款、接单、出餐等不可通过重放重复执行。
- 顾客网络中断后可查询其已提交订单的服务端状态；不得用客户端本地购物车/缓存冒充订单已创建。
- 商家暂停接单、停业和服务端故障时，顾客界面返回可理解原因，不继续收下无法履行的订单。

## 10. 实施分期

必须逐阶段交付真实调用链、测试结果、问题清单和遗留项；当前阶段验收未通过，不得标记后续阶段完成，也不得用页面完成代替业务闭环。

### 阶段 0：现状审计与契约（编码前门槛）

**状态：已完成（代码与 schema 现状审计；具体业务阶段仍需按真实调用链补足 API/事务细节）。**

- **行业/身份：** `merchantIndustryTemplates.ts` 为共享行业模板事实源；当前 8 个模板开放，其中 Restaurant 仅开放菜单/桌台基础工作区。`industryTemplate` 与旧 ModaGPT `Merchant.industry` 是不同字段；商家 JWT、`requireMerchantTenant`、`MerchantEmployee`/RBAC 为既有身份边界。入驻分类器输出不能授予行业权限。
- **桌面/手机 Web：** 两个独立构建目标，共享 Merchant API 和会话；行业 UI 由 `src/apps/merchant-admin-industries/registry.ts` 映射。餐饮没有独立组件；不得 fallback 到 Apparel。
- **小程序：** `merchant-miniprogram` 有现存登录/请求封装及 7 个已开放模板配置。无 Restaurant 专属页面或点单业务，不另建账号/后端。
- **订单/POS/支付：** `Order`/`OrderItem`、`PaymentTransaction`、`MerchantPosSale`、POS 班次/销售路由已存在；`POST /api/merchant/pos/sales` 写 RUDA 订单，但只涵盖 SKU 购物车与人工现场收款，不支持餐饮桌台/加料/KDS/支付组合，故不能直接宣称为餐饮 POS。`POST /api/orders` 是现有权威买家下单链路。支付回调、退款必须复用各自权威服务。
- **商品/库存/门店/采购：** 复用 `Product`/`ProductVariant`、`InventoryBalance`/`InventoryMovement`、`MerchantStore`/`MerchantStoreStock`、`Supplier`/`MerchantPurchaseOrder` 等现有领域。未发现餐饮配方/原料批次/过敏原/桌台/预约/KDS 扩展；不得把 SKU 库存当原料库存，也不得先复制商品、订单或门店系统。
- **AI/文件/知识：** 复用 RUDA ModaUI/Model Gateway、任务、媒体、AI 员工和知识/记忆管理；需在阶段 5 实际追踪调用权限和知识检索过滤后才开放 Restaurant Brain。当前无 Restaurant 专属 AI 服务或数据空间证明。
- **测试/端侧：** 行业注册、能力和小程序配置有单元/契约测试；真实餐饮 API、数据库持久化、目标市场支付/税务和三端/设备实测尚无证据。本任务后续每阶段需补相应隔离集成和真实端验收。

阶段 0 后续契约门槛：实现每个业务阶段前，必须从对应 RUDA 服务继续追踪 API/事务/状态/权限和回滚；支付/税务/游客登录/配送市场策略确认前，不启用线上收款、自动配送或生产菜单发布。

### 阶段 1：第八行业注册与授权

**状态：有限自助开通正在接入桌面工作区；完整行业能力仍开发中。** 唯一模板 registry 使用 `restaurant_ordering` / `merchant_admin_restaurant_ordering`，并关联固定 `industry_code` / `studio_code` / namespace。当前开放菜单/菜品草稿及桌台目录，服务端要求行业模板与 `RESTAURANT` 身份精确匹配，并继续校验租户、员工权限和门店范围；不依赖注册来源为 `ADMIN`。这不代表 POS/KDS/订单支付或 Restaurant Studio 已开放。正式 `industry_id` 仍须从注册源读取/生成；手机 Web、小程序入口、Studio entitlement、门店/经营模式和完整员工权限矩阵尚待实现。

本阶段后续还需确认正式 `industry_id` 存储/来源（当前仓库不是独立行业注册表，不能杜撰 UUID），Studio entitlement 与套餐/审批衔接、门店/经营模式配置、员工权限矩阵，以及三端入口基础契约。验收普通用户不受影响、7 个既有模板行为不变、餐饮未开放时无错误 Studio/API 权限。

### 阶段 2：菜单、菜品、配方、原料与库存

**阶段状态：部分完成。2A 菜品/菜单草稿 API 与 2B 原料目录/不可变配方版本 API 均已通过隔离 PostgreSQL HTTP 集成测试；2C–2F central 原料库存调整、采购收货、真实收货成本估算及商家菜单发布/受限公开读取 API 已通过验证；当前桌面菜单/桌台基础工作区接入中，门店独立库存、批次/效期和订单消耗仍未实现。**

#### 2A 数据与接口契约

- **菜品归属：** `RestaurantDish` 是餐馆菜品和餐饮属性的权威记录，按 `merchantId` 隔离。可选关联现有 `Product` 作为 Product Center 的资料关联；新建菜品不会自动创建、上架或写入 `Product`，防止餐饮草稿意外进入 B2B 商城。后续需要 Product 草稿时，走 §7.4 的显式确认流程。
- **菜单归属：** `RestaurantMenu` 是商家或门店范围的菜单，默认仅 `draft`。`RestaurantMenuItem` 只保存菜单展示关系、该菜单价格/币种、排序和可售状态，菜单项引用同一商家菜品；菜单价不写 `Product` 零售价，也不覆盖已创建 RUDA 订单的价格快照。
- **复用结论：** 复用 `Merchant`、`MerchantStore`、`Product`（仅可选关联）、现有商家 JWT/员工 RBAC、API 错误 envelope 和审计；不新建餐馆账号、商城商品、订单、门店或支付事实。通用 `Material` / `MaterialInventoryBalance` / `MaterialInventoryMovement` 是后续原料库存候选权威来源；2A 不再造另一套库存。
- **状态与版本：** 菜品状态 `draft|active|archived`；菜单状态 `draft|published|archived`（2A 不提供 publish 写操作）；菜单项状态 `available|sold_out|hidden`。菜单每次更新使用 `expectedVersion` 乐观并发校验；菜品和菜单列表均由当前商家租户限定，门店菜单只能引用同租户的有效门店。
- **服务端契约：** 电脑 Web、手机 Web、小程序共用 `/api/merchant/restaurant/*`：`GET/POST /menus`、`GET/PATCH /menus/:menuId`、`GET/POST /dishes`、`GET/PATCH /dishes/:dishId`、`POST /menus/:menuId/items`、`PATCH /menus/:menuId/items/:itemId`。创建资源带 `Idempotency-Key`；PATCH 带整数 `expectedVersion`；菜单列表分页且限定商家，读取菜单详情可带菜单项与菜品。服务端从 JWT 取商家身份；拒绝客户端 tenant/行业/权限字段；可选 `productId` 和 `storeId` 必须属于同一商家。API 的公开顾客读取、正式发布和 POS 下单不在 2A 暴露。
- **权限与关闭策略：** Restaurant 已作为自选行业开放，继续走现有商家注册/审核流程；餐饮目录 API 要求行业模板精确为 `restaurant_ordering` 且商家行业为 `RESTAURANT`，并要求现有 `product.import.draft` 员工权限（店主沿用现有店主权限）。来源字段不参与授权判定。顾客公开读取仍须通过 `isPublicStorefront`，菜单发布继续校验发布权限、有效配方、版本与门店；不开放 POS、顾客下单或支付。
- **错误/幂等：** 资源跨租户与不存在统一返回 not found；错误/缺失版本返回验证错误；旧 `expectedVersion` 返回 `409 RESTAURANT_MENU_VERSION_CONFLICT` 或 `409 RESTAURANT_DISH_VERSION_CONFLICT`；重复菜单项返回冲突；菜单/菜品创建请求接受 Idempotency-Key，并在同 key 不同请求时拒绝冲突。
- **验收：** 在隔离 PostgreSQL HTTP 测试中创建商家 A 的草稿菜品、门店菜单和菜单项，重新读取确认数据库值；商家 B/非餐饮/无菜单权限用户不能读取或写入；无效 Product/Store 归属被拒绝；并发旧版本更新发生冲突；菜单仍为草稿且不创建 RUDA `Product`、`Order` 或支付记录。端侧入口与状态见 2A.1。

#### 2A.1 菜单草稿跨端入口

- **本轮范围：** 电脑 Web、商家手机 Web 与商家小程序均接入同一 `RestaurantMenuWorkspace` 能力边界和 `/api/merchant/restaurant/*` 权威 API；电脑与手机 Web 共用已有响应式组件，小程序保留原生页面与导航。三端维护菜单/菜品草稿并可向草稿菜单添加菜品。当前页面已实现此子集。
- **授权：** 页面入口只从服务端 `industry-context` 的 `restaurant_menu` 模块与当前行业模板显示；Web 页面和小程序仍必须通过服务端商家 JWT、`restaurant_ordering + RESTAURANT`、员工 `product.import.draft` 与租户/门店校验。隐藏入口不构成安全边界。
- **非目标：** 此初始草稿入口本身不实现配方编辑和菜单发布（后续闭环见 2A.2），也不开放 POS、支付、顾客下单或 KDS；不复制 Restaurant 数据库、菜单状态或 API client；不改变手机 Web 与小程序既有导航骨架。
- **验收：** `merchant-miniprogram-industry.test.ts` 与 Restaurant 菜单契约测试覆盖行业模板精确映射、模块/员工权限过滤、页面注册、列表读取及草稿创建使用同一 API；商家手机 Web 构建和类型检查通过，`RestaurantMenuWorkspace` 的本地浏览器模拟 API 检查覆盖 1440/820/390 三档且无横向溢出。浏览器记录到 Vite HMR WebSocket 被本机网络访问策略拦截（`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`），属于本地开发热更新通道，不是菜单 API 失败；真实商家登录态、小程序开发者工具/真机仍待验收。

#### 2A.2 有效配方到菜单发布跨端工作流

- **问题：** 现有服务端已有 Restaurant 食材目录、不可变配方版本、激活、菜单成本读取和带版本校验的正式发布/撤回 API；端侧只有菜单/菜品草稿 UI，商家无法在同一工作区满足“每道菜有 active 配方”前置条件或完成经确认的菜单发布。
- **范围：** 在共享 Web 工作区和原生小程序页中复用上述 API，提供食材读取/新建、选择菜品创建配方版本、激活配方、显示真实配方状态并发布/撤回菜单。配方输入的产出数量/单位、食材用量与损耗率由服务端规范校验；公开操作仅为经授权人员确认后的菜品目录发布，不意味着在线点餐、POS 收银或支付已经开放。
- **权限与确认：** 所有写入仍由 `restaurant_menu` 服务端路由、JWT、租户、员工权限和门店边界验证；发布/撤回必须使用 `expectedVersion` 且服务端要求发布权限。前端发布/撤回须二次确认；不得将失败显示为成功。食材 allergen code 如实随服务端记录展示，不新增或推断食品安全声明。
- **并发/错误：** 菜单与食材/配方版本冲突必须提示刷新当前权威状态后重试；创建配方与食材沿用 `Idempotency-Key`，激活和菜单状态转换沿用服务端版本契约；外部/跨租户资源仍按 API 既有错误处理。
- **非目标：** 不新增 schema/API、库存扣减、采购/付款、在线订单、税务、支付、KDS、外卖或 AI；不把发布菜单称作餐馆已可营业或完整 Restaurant OS。
- **验收：** 隔离 PostgreSQL HTTP 测试覆盖食材/配方/发布 API 的权限、版本、租户和状态转换；新增三端契约及小程序页面模拟测试检查同一 API、幂等请求、版本参数、确认流程和真实错误状态。商家 Web 与 Mobile 构建、TS 检查通过；本地组件在 1440/820/390 视口完成模拟 API 工作流（原料创建→配方版本→激活→确认发布），无横向溢出或浏览器错误，截图写入 `/tmp/restaurant-menu-workspace-{1440,820,390}.png`；Impeccable rendered-page 检查通过。小程序通过页面控制器模拟测试与 JS 语法检查，但未运行微信开发者工具/真机。真实商家登录态、三端连接隔离数据库交叉读写和门店权限实测仍待验收；这组本地浏览器模拟不替代持久化测试。

- **截图归档：** 1440/820/390 视口截图已归档至 [restaurant-2a2 evidence](../evidence/restaurant-2a2/README.md)；截图使用内存 mock API，仅作为布局/交互证据，不代表真实数据持久化或小程序运行验收。

#### 2B 原料目录与配方版本契约

- **审计结论：** 既有 `Material`、`MaterialInventoryBalance`、`MaterialInventoryMovement` 是共享物料/库存权威模型，但当前 `/api/merchant/materials` 只接受服装类目和 `meter|piece|kg|roll`，不能直接表达餐饮食材；通用物料/BOM/流水接口也会把同一租户物料展示给现有生产流程。`ProductBomItem` 必须继续服务 RUDA Product 生产 BOM，不得把 Restaurant 配方塞入商品 BOM。
- **复用及隔离：** 新增 `RestaurantIngredient` 作为餐饮语义与现有 `Material` 的唯一一对一分类关联；库存余额和流水仍只在现有 Material 库存模型中，不复制第二套库存。餐饮 API 以此关联管理食材；通用服装物料、入库、流水、BOM 与生产可用量 API 必须排除 RestaurantIngredient 标记的 Material，避免同一商家多行业时食材混入服装生产流程。
- **食材字段：** 复用 Material 的商家内唯一编码、名称、供应商关联、补货点及启停状态；RestaurantIngredient 保存餐饮类别及受控 allergen code 列表。允许单位 `g|kg|ml|l|piece`，类别为 `produce|meat|seafood|dairy|grain|seasoning|beverage|packaging|other`。创建时不伪造库存、采购价或食品安全认证；通用 Material 的 `unitCost` 不作为真实采购成本。
- **配方版本：** 新增不可变 `RestaurantRecipe` 与 `RestaurantRecipeItem`。每次创建为指定商家菜品生成单调递增版本，材料/食材必须属于同一商家且存在 RestaurantIngredient 关联；单份用量以该食材基准单位储存，产出数量/单位明确，数量与损耗率服务端校验。新版本在激活前为草稿；激活事务仅允许一个当前 active 版本，先前 active 版本变为 archived，历史版本与其行项目不删除或改写。该阶段不扣库存、不计算真实采购成本，也不修改菜单或历史订单快照。
- **接口契约：** 共享 `/api/merchant/restaurant/*` 增加 `GET/POST /ingredients`、`GET/PATCH /ingredients/:ingredientId`、`GET/POST /dishes/:dishId/recipes`、`POST /recipes/:recipeId/activate`。食材/配方版本列表统一分页，食材列表可按已验证类别过滤。创建用 `Idempotency-Key`；食材 PATCH 与激活使用 `expectedVersion`；配方版本创建不可变并返回服务端分配的版本号。所有接口沿用商家 JWT、精确 `restaurant_ordering + RESTAURANT` 身份校验、`restaurant_menu` 模块及现有 `product.import.draft` 权限，不信任客户端 tenant、industry、价格/库存或 version 分配。
- **错误与事务：** 跨租户/跨行业资源按现有资源不存在策略处理；错误字段返回 400；食材/菜品停用、错误版本和重复版本分别返回明确 409；配方版本写入和激活在事务内完成，唯一约束/序列化冲突转换为可重试 409。已关联库存流水的食材不能改单位；不得删除被历史配方引用的食材。
- **验收：** `npm run test:restaurant-catalog:integration` 在一次性隔离 PostgreSQL 容器验证餐饮食材创建/读取/版本更新、同键幂等与键冲突、跨租户/非餐饮/无权限拒绝、服装物料列表/入库接口排除餐饮食材、已有库存后禁止改单位、配方版本递增与激活互斥、历史配方不可变和菜品/食材归属；检查没有新增或重复库存台账、Product BOM、Order、付款或虚构采购成本。单元测试覆盖输入字段、餐饮单位、类别、allergen code、数量与配方格式。
- **端与关闭状态：** 此子阶段交付共享后端 API、模型、迁移和测试；菜单/菜品入口按 2A.1 分端实施。正式菜单发布、顾客读取和 POS 下单继续受各自阶段权限关闭。

#### 2C 餐饮原料库存调整契约

- **审计结论：** 既有 `MaterialInventoryBalance`/`MaterialInventoryMovement` 可复用为唯一库存台账；现有通用 Material 入库只支持全局 `central` 仓。`WarehouseLocation` 与 `MerchantStore` 当前没有权威映射，不能假装 central 仓等同于门店库存。
- **范围：** 先交付商家级 central 仓库存读取、盘点差异和损耗调整；明确不是门店分仓、采购收货、订单预留/消耗或自动补货。门店绑定仓库、批次/效期、采购收货及 POS/KDS 原料扣减需独立阶段契约。
- **API：** `GET /ingredients/:ingredientId/stock` 返回 central 仓 `onHandQuantity`、`reservedQuantity`、`availableQuantity` 和 balance `version`；`POST /ingredients/:ingredientId/stock-adjustments` 接受 `locationCode=central`、非零有符号 `delta`、`reason=count_correction|waste`、`expectedVersion` 和可选短说明。创建时余额版本为 0；重复提交使用 `Idempotency-Key`。
- **权限与租户：** 沿用商家 JWT、餐饮 pilot/module guard；调整需要现有 `production.manage` 或 `store_manager` 权限。门店限定员工因尚无门店—仓库映射而明确拒绝；只允许商家所有者/未绑定门店的获授权管理者使用 central 仓。
- **事务与错误：** 事务内验证同商家且 active 的 RestaurantIngredient/Material、全局 active central location、请求幂等、`expectedVersion` 与 balance；调整后不得低于已预留量。更新余额版本并新增同一事务的 MaterialInventoryMovement；重复相同请求回放原结果，幂等键不同内容返回 409，陈旧版本/库存不足返回明确 409。不能创建或改写订单、采购单、Product 或 recipe。
- **验收：** 隔离 PostgreSQL HTTP 测试验证正负调整、损耗方向、重复与冲突键、版本冲突、不可低于 reserved、商家隔离、非餐饮/无权限/门店限定用户拒绝，并直接核对单一共享 balance/movement 持久化。此阶段不计算采购成本，不把中央库存展示为门店库存。

阶段 2 后续还需实现经审核的菜单时段/规格/加料/过敏原呈现、门店级批次/效期、门店—仓库权威映射、库存 reservation/consumption，以及与 POS/KDS 的事务联动。成本估算 API 已基于实际收货历史验证，但不能替代库存批次、门店成本或财务核算；菜单发布/公开读取也不包含顾客点单、税务和支付。后续子阶段以 2A–2F 通过为依赖，不可提前宣称完整阶段 2。

#### 2D 餐饮采购单与 central 仓收货（已完成 API 切片）

- **现状审计与复用：** 复用唯一 `Supplier` 供应商及 `RestaurantIngredient` → `Material` 关系、既有 `MaterialInventoryBalance`/`MaterialInventoryMovement` 台账、商家 JWT/RBAC、审计和精确餐饮行业身份校验。既有 `MerchantPurchaseOrder`/`MerchantPurchaseReceipt`/`MerchantPurchaseReceiptItem` 行项目绑定成品 `Product`/SKU，收货更新成品库存，不适合原料采购；强行复用会把食材混入商品采购语义及成品库存，故本切片需要餐饮采购单/行/收货/收货行的专属事实模型，而不另建 Supplier、Material 或库存台账。
- **目标与非目标：** 支持同租户有效供应商与餐饮食材之间的采购单、下单状态、部分/完整收货；真实收货数量与实际单位采购价以不可变收货行保存；收货事务同时增加共享原料库存余额、版本和流水。只支持当前已有的 `central` 仓。此切片不实现门店仓映射、批次/效期、付款、供应商报价比价、币种换算、采购成本加权算法、POS 扣料、自动采购或 UI。
- **归属与模型：** 新增 `RestaurantPurchaseOrder`、`RestaurantPurchaseOrderItem`、`RestaurantPurchaseReceipt`、`RestaurantPurchaseReceiptItem`，均由商家 Tenant 所有；订单及收货行保存餐饮 `ingredientId` 和单位快照，收货行保存实际 `unitCost` 与订单币种快照，数量和单价均以该单位输入，不支持包装单位换算；历史采购价不得回写 `Material.unitCost`。采购单只允许 `draft → ordered → partially_received → received`，`draft|ordered → cancelled`；订单行收货数量只增不减，收货记录不可修改/删除。Recipe 成本在后续切片中基于经确认的真实收货数据计算，本切片不声称有成本分析。
- **接口与授权：** `GET/POST /api/merchant/restaurant/purchase-orders`、`GET /purchase-orders/:id`、`POST /purchase-orders/:id/submit`、`POST /purchase-orders/:id/cancel`、`POST /purchase-orders/:id/receipts` 共用 REST/客户端错误 envelope；列表分页及 tenant 隔离。仅 `purchase.manage` 员工权限可写，菜单 pilot/module gate 与商家身份继续强制；采购单供应商、食材均须同一 Tenant 且有效；门店绑定员工暂拒绝 central 收货。创建订单与每次收货分别要求 `Idempotency-Key`；收货行必须提交实际收货 `quantity` 和 `unitCost`，两个十进制量均以字符串传递，不静默以估算价填充。
- **事务、金额与错误：** 数量精度匹配共享库存 `Decimal(14,3)`，单价使用货币金额精度 `Decimal(12,4)`；采购单币种为 ISO 4217 代码且订单内固定，不做汇率换算。创建/提交/取消/收货均使用事务和版本条件；收货不得超过未收数量，必须将共享余额增加、version 递增、`MaterialInventoryMovement` 入账、不可变收货单及采购单状态更新原子提交。失败整体回滚；幂等键不同内容返回 409、旧版本/状态/并发冲突返回明确 409、无效行/数量/价格返回 400、跨租户对象不泄漏并返回 404。库存查询统一由 2C endpoint 读取，不维护缓存副本。
- **验收：** 隔离 PostgreSQL HTTP 测试覆盖同租户有效供应商/食材、供应商/食材跨租户拒绝、权限、草稿与提交状态、重复下单/收货重放及键冲突、部分与完整收货、超收拒绝、expectedVersion 冲突、实际单位价历史快照、central 库存与 movement 持久化、非餐饮共享 Material 排除和拒绝路径不产生收货/库存写入。UI/电脑手机小程序真实互操作及故障注入式事务回滚测试未实现。

#### 2E 菜品配方实际采购成本估算（已完成 API 切片）

- **目标：** 为餐饮管理者提供可复算的确定性成本估算，后续可供 Restaurant Brain 使用；本切片不调用 AI，不写回菜品价格、配方、采购价或库存，也不冒充财务/税务账。
- **计算口径：** 每项食材单价只来自有效 RestaurantPurchaseReceiptItem 实际收货行，按实际收货数量计算全历史加权平均单价；服务端按 Tenant/食材/币种聚合真实收货数量、金额、行数和最新收货时间，不读取无限历史行到应用内存。不使用报价价、`Material.unitCost` 或演示默认值。食谱消耗量为配方数量 × `(1 + wasteRate)`，单批成本为各食材成本之和，再除以配方 yield 得每份估算。响应注明 `weighted_average_actual_receipts`、真实收货行数量、最新来源时间和配方版本。
- **货币：** 不做 FX 换算。参与计算的实际收货行须同一货币；存在缺失成本或多币种时返回明确 `insufficient_data` / `currency_mismatch`，不得给成功形状的 0 成本。若比较菜单售价，菜单货币必须与采购成本货币相同，否则不返回毛利。
- **接口/权限：** `GET /api/merchant/restaurant/dishes/:dishId/cost?menuId=...`，复用 Restaurant 行业身份校验与 `purchase.manage`（成本/供应商价格属于敏感经营信息）；Tenant 条件限制菜品、配方、菜单、采购单与收货行。
- **精度/错误：** 全程使用 Decimal，不通过 JS 浮点中间运算；平均单价展示 6 位，行/总成本/每份成本/毛利保留 4 位，菜单价格保持现有 2 位，毛利率保留 2 位；毛利按响应展示的每份成本计算。无 active recipe 返回明确冲突；缺收货成本或多币种返回 `insufficient_data` / `currency_mismatch`，金额为 null；菜单不存在及跨租户资源不泄漏并返回明确错误。
- **当前实现：** `GET /api/merchant/restaurant/dishes/:dishId/cost?menuId=...` 只读地计算当前 active recipe；复用 `RestaurantPurchaseReceiptItem` 历史事实，以参数化 SQL 做数据库聚合，门店范围员工在门店仓映射未配置前拒绝读取。可选菜单比较只在币种相同时返回毛利；不修改 Material、配方、菜单、库存或收货。
- **验收：** `tests/restaurant-costing.test.ts` 覆盖加权平均、损耗、产出量、缺失成本、多币种及数据库聚合精度；隔离 PostgreSQL HTTP 测试覆盖真实收货来源、错误 `Material.unitCost` 不参与、租户及权限隔离、同币种毛利/异币种隐藏毛利和查询无写副作用。该 API 切片不等于餐饮 UI、财务报表或 POS 已完成。

#### 2F 餐厅菜单发布与公开读取（已完成 API 切片）

- **查重与复用：** 复用 `RestaurantMenu`/`RestaurantMenuItem`/`RestaurantDish`/active `RestaurantRecipe`、现有商家 `storeSlug` 和 `isPublicStorefront` 可见性规则；不新增一套 storefront、商品主表或餐厅账号。现有 `/api/merchants/store/:storeSlug` 只返回商家店铺资料，商品目录使用 Product 查询，无法返回 Restaurant 菜单；2A 菜单目前仅草稿 API，菜单项写 `available` 不代表已公开发布。
- **发布契约：** 商家通过 `POST /api/merchant/restaurant/menus/:menuId/publish` 提交 `{ expectedVersion }`，使用现有 `employees.manage` 权限、Restaurant 行业身份/module 校验与租户/门店校验。只能发布非空草稿菜单；每个菜品须非 archived，且有 active recipe；事务中将引用菜品设为 active，并将菜单切为 `published`、递增 version。再次发布/旧版本冲突明确拒绝；已发布菜单只能经显式 `POST .../:menuId/unpublish` 停止公开，不允许直接编辑或静默替换内容。发布不是 Product Center 上架，也不触发下单、收费或库存动作。
- **公开读取契约：** `GET /api/restaurant/stores/:storeSlug/menus` 只对行业模板和 `RESTAURANT` 身份一致且通过既有 `isPublicStorefront` 检查的商家返回 `published` 菜单和 `available` 菜单项。当前仅返回菜单/菜品名称、描述、分类、过敏原、价格、币种和排序；现有数据没有确认可公开的餐厅图片来源，因此不返回图片。也不返回成本、供应商、采购、库存、配方、内部 ID/权限信息或未发布草稿。无公开店铺、非餐饮和未知 slug 均返回一致 404；响应 `Cache-Control: no-store`，避免菜品售罄/撤回的陈旧公开缓存。
- **状态及并发：** 发布只允许 `draft → published`，撤回只允许 `published → draft`；两者都要求正整数 `expectedVersion`，并用事务与条件更新避免并发覆盖。撤回保留菜单项和历史，不删除数据；撤回后公开读取立即不再返回该菜单。
- **验收：** 隔离 PostgreSQL HTTP 测试覆盖未发布不公开、草稿菜无 active recipe 禁止发布、发布/撤回/版本冲突、跨 Tenant 与无权限拒绝、非 Restaurant/非公开店铺 404、公开响应只含 allowlist 字段、撤回后不可见且无菜单/Product/Order/库存副作用；公开读取按 IP 与店铺限流并 `no-store`。该切片不包含菜单时段、顾客下单、税务、支付或 POS。

### 阶段 3：POS、桌台、订单与 KDS

实现餐饮 POS、桌台/QR/预约的本阶段范围、统一 RUDA 订单、状态机、厨房工位/分单/部分出餐、支付确认/班结和订单历史。验收从顾客/店员下单、厨房接单出餐到收款完成一笔真实测试订单，不重复扣库/建任务。

**复用审计与开通门槛：** 现有商家 POS 已通过 `/api/merchant/pos/sales` 写入唯一 `Order`/`OrderItem`，复用 `MerchantPosShift` 和既有现金班结；但路由由 `pos` 行业模块保护，当前 Restaurant 模板仅开放受限 `restaurant_menu` API，且通用 POS 只接收已发布 Product/SKU 并校验成品库存，没有 KDS 实体或原料配方消耗。因此不得仅把 Restaurant 的 `pos` capability 打开或把菜品伪装成服装/零售 SKU。阶段 3 必须在同一 RUDA `Order`/`OrderItem` 上定义 Restaurant menu-item 快照映射、原料预留/消耗和 KDS 任务事务边界，并完成税务/支付适用范围（R0）后再开放写操作；不得新增第二套 Order/Payment/POS。

**阶段 3 代码审计结果（当前未开通）：**

- 通用 POS 创建订单时要求每行有已发布 `Product`、有效 SKU 和成品库存；事务会扣减 `InventoryBalance`/`MerchantStoreStock`，建立 `Order` + `OrderItem`，并在员工确认现场收款后写入 `paymentStatus=paid` 及 `provider=manual` 的 `PaymentTransaction`。Restaurant 菜品不能安全地映射成假 `Product`/SKU，也不能沿用成品库存扣减。
- 既有 `OrderItem.productId`、SKU/颜色/尺码是必填产品语义，没有 Restaurant menu item 外键或菜品选项/配方快照；复用 `Order` 根订单可行，但需要先设计能被现有订单/退款/销售查询兼容的 Restaurant 行项目扩展，不能留下空商品行或伪造 `productId`。
- 初步静态查重显示 `src/` 与 `server.ts` 中 `order.items` / `item.productId` 相关模式约 254 处、33 个文件命中（包含只读展示和辅助逻辑，不等于 254 个独立业务调用）。这说明直接放宽 `OrderItem` 字段或插入占位商品具有较大兼容风险。阶段 3 schema 变更前，必须逐类核对下单、订单详情/列表、库存/履约、退货退款、导出/报表和权限调用方，建立受影响测试矩阵；该静态计数是范围提示，不是完整调用图。
- `OrderInvoice` 保存税率、税额快照，但没有 Restaurant 菜单税码/税率配置或餐馆收银 fiscalization 能力；通用 POS 本身不计算税。消费者结账目前也没有开放可复用的 VAT/支付流程。因此不能把 `taxRate=0` 或“菜单价含税”当作默认政策。
- 当前行业能力清单中 `restaurant_ordering.modules=['restaurant_menu']`、`features.pos=false`；Restaurant 商家工作区模块仍为空，符合暂不暴露的状态。代码库未发现 KDS ticket/工位数据模型或 Restaurant POS/支付 API。
- **安全开通结论：** 先保持 `pos=false`、Restaurant 写单/收款关闭；不改通用 POS、不生成人工“已支付”、不开始扣减原料。R0 需补齐适用国家/商家税务配置来源、菜单标价含税口径、收据/发票责任、仅支持的支付方式及失败/退款规则。确认这些真实约束后，再以兼容扩展复用 `Order`/`PaymentTransaction` 并实施 KDS/配方库存事务；该阶段还须完成上述 OrderItem 调用方影响矩阵。此审计未声称阶段 3 已实现。

#### 3A 餐厅门店桌台目录（本轮实施切片）

- **查重与复用：** 已检索 `MerchantStore`、`Order.storeId`、现有商家 POS/产品预订模型和 Restaurant schema；未发现餐饮桌台实体或可复用的桌台主数据。服装/零售库存门店不是餐桌，因此新增一个仅存桌台主数据的 `RestaurantTable`，由现有 `MerchantStore` 和 Merchant Tenant 归属，不新增门店或订单系统。
- **范围：** 餐饮试点商家可按已存在的 active MerchantStore 创建、分页/筛选读取、编辑与停用桌台；字段为门店、桌台编码、显示名称、座位数、区域和 active/inactive 状态。编码在同商家同门店内唯一；写操作采用 `expectedVersion`、创建幂等键及审计记录。仅限商家员工后台 API，暂不提供顾客 QR、占用状态、预约或订单关联。
- **API 契约：** `GET /api/merchant/restaurant/table-stores` 返回当前员工有权访问的 active `MerchantStore`（仅 id/code/name/city）；`GET /api/merchant/restaurant/tables?storeId=...&status=active|inactive&page=1&limit=50`；`POST /api/merchant/restaurant/tables` 请求 `{ storeId, code, name, capacity, area? }` 并带 `Idempotency-Key`；`PATCH /api/merchant/restaurant/tables/:tableId` 请求 `{ expectedVersion, name?, capacity?, area?, status? }`。创建回 `201`、同请求重放回 `200`，修改成功返回递增后的 version；输入无效回 `400`，员工门店越权回 `403`，租户/停用门店未找到回 `404`，重复桌号/旧版本/幂等键不同内容回 `409`。列表最多 100 条/页。
- **非目标及边界：** 不开放 `pos`、订单、支付、桌台占用/清台、预约或 KDS；不采集顾客姓名/电话等个人信息。桌台目录不能被视为 POS/桌台订位已完成。桌台列表按 `storeId` 查询；门店限定员工只能访问其绑定门店，不能通过客户端指定其他租户/门店越权。
- **权限与错误：** 复用商家 JWT、Restaurant 精确行业身份/module 校验与现有 `employees.manage`，不新建权限体系。门店必须属于当前商家且 active；外租户资源返回 404，门店限定员工越界返回 403，旧版本返回 409，非法输入返回 400。
- **验收：** 隔离 PostgreSQL HTTP 测试覆盖门店读取、创建/重放/幂等键冲突、同门店编码冲突、列表与停用、expectedVersion 冲突、跨租户门店拒绝、门店限定员工边界和无权限拒绝；核对数据持久化且没有生成 `Order`、`OrderItem`、Payment、库存或顾客数据。Restaurant 菜单目录隔离 PostgreSQL HTTP 测试通过，覆盖菜品/菜单草稿、权限、幂等、版本与租户隔离；自选 Restaurant 的公开菜单读取在未发布菜单时返回空列表。桌面 MerchantPortal 已接入桌台列表/新增/编辑/启停和菜单草稿 UI；本地浏览器以模拟 API 验证菜单加载/新增菜品交互及 1440/820/390 视口无横向溢出。手机 Web 与小程序已接入同一菜单/菜品 API；食材/配方版本/菜单发布 API 已有隔离数据库测试，但对应端到端工作流仍按 2A.2 补齐。真实商家登录态、三端交叉读取及小程序开发者工具/真机仍待验收。

#### 3A.1 桌台目录三端入口与服务端模块门禁

- **现状与范围：** 既有电脑端 `RestaurantTableWorkspace` 已使用 `MerchantStore` 与 `/api/merchant/restaurant/table-stores`、`/tables`；手机 Web 和商家小程序没有桌台目录入口。核对发现既有路由仅检查 `restaurant_menu`，未独立校验 `restaurant_tables`。本切片在不改变 endpoint / payload 的前提下，为桌台 API 增加精确 `restaurant_tables` 服务端模块门禁；手机 Web 接入现有组件，小程序增加原生桌台页。
- **权限：** 各端只在当前 Restaurant 模板且 workspace 含 `restaurant_tables` 时显示；服务端桌台路由校验商家 JWT、精确桌台模块、Restaurant 身份、Tenant 和员工门店过滤。创建、编辑与启停要求 `employees.manage`，客户端权限判断不取代服务端授权。
- **状态与冲突：** 只管理桌台主数据（编码、名称、座位、区域、启用状态），修改采用服务端 `expectedVersion`；创建带 `Idempotency-Key`。旧版本、重复桌号、门店越权和网络错误需显示明确反馈并刷新权威数据。切换门店清除旧列表和编辑状态。
- **非目标：** 不开放桌台占用/清台、预约、顾客 QR、订单、POS、支付或厨房流程；不增加数据库、API 或行业模板，不更改各端现有导航框架。
- **验收：** 新增桌台页/工作区契约与小程序控制器模拟测试，覆盖门店/桌台读取、创建幂等、版本更新及精确模块/员工权限；TS、Web/Mobile 构建和 `git diff --check` 通过。API 持久化/租户/权限使用现有隔离 PostgreSQL 集成测试；真实登录态、真实三端交叉数据库操作及微信开发者工具/真机仍单独待验收。

### 阶段 4：顾客 Storefront、外卖、自取、配送与渠道

实现在线菜单、顾客下单、取餐、配送区域和获授权的第三方渠道适配；只有实际 API、授权、签名回调和对账通过才启用。验收一笔外卖/自取订单完整履约，渠道来源及 RUDA 订单关联可核对。

### 阶段 5：Restaurant Studio 与 Restaurant Brain

在 RUDA AI CORE 上接入餐饮知识隔离、Restaurant Studio 项目/文件/任务和 `restaurant_intelligence`；分域交付菜品研发、菜单、摄影、成本/毛利、销量预测、采购、营销、经营报告及自然语言查询。AI 只读/草稿默认，所有高风险写入须有权人员确认。验收真实数据来源、计算可追溯、数据不足提示、AI 失败不影响 POS/订单/KDS/库存。

### 阶段 6：营销、财务、员工、采购与多门店

按既有 RUDA 客户、财务、员工/审批、供应商/采购服务扩展会员/优惠、排班/考勤、交班/对账、多门店库存/菜单/结算和总部报告。验收单店/多店权限边界、金额精度、审批、盘点/采购到货和财务数据一致。

### 阶段 7：三端、厨房设备与全量回归

验证电脑 Web、手机 Web、小程序、厨房显示设备与顾客点单入口；逐项测试同一 Tenant/Outlet/Order/Studio Project/AI Job/File/版本在各端读取和操作一致、冲突可见、重试幂等、断网可恢复。完成 R01–R30、C01–C09、Restaurant Brain 补充验收、原 7 行业回归、监控/告警和部署/回滚评估。

## 11. 测试与验收标准

**功能完成的定义：** 必须有真实 API、授权检查、数据库持久化或经审计的现有权威存储、错误处理、日志/审计、自动化测试及实际操作证据。静态页面、演示数据、AI 对话能回复、前端隐藏菜单、构建通过均不能单独算功能完成。每项测试记录环境、测试 Tenant/Outlet/账号、步骤、预期/实际、API、数据库核验、截图/日志、PASS/FAIL、问题和回归结果。

### 单元与契约

- 固定代码 `restaurant` → `restaurant_studio` → `restaurant` namespace 唯一映射；`industry_id` 来自正式注册表；无效/停用映射不能获得餐馆 API 权限；本次只新增餐饮模板映射，原 7 个模板行为保持不变。
- 菜品、价格、营业方式、桌台 token、选项组合及状态转换输入校验。
- 服务端价格计算、金额精度、幂等键和重复操作行为。
- 员工角色权限矩阵、门店作用域、跨租户读取/写入拒绝。
- 三端请求/响应、错误 envelope、状态枚举及版本冲突契约一致。

### 隔离 PostgreSQL HTTP 集成

- 餐馆模板商家可管理菜单；非餐馆模板被拒绝。
- 商家 A 的菜单/桌台/订单不能由商家 B 查询或修改；员工越权被拒绝。
- 堂食桌台、店员 POS、自取和外卖订单均落同一权威 `Order`/`OrderItem`，金额与快照持久化。
- 相同幂等请求只产生一笔订单/一条支付记录；同一幂等键不同内容返回冲突。
- 并发售罄/暂停接单/菜单改价时，服务端按提交事务顺序拒绝过期或无效订单，不超卖、不使用旧价格。
- 订单状态只允许合法转换；重复接单/退款/出餐不重复生效；线上支付未收到权威回调不能标为已支付。
- 数据库事务任一写入失败时，订单、订单行、库存 reservation 和支付状态均回滚。
- 原 7 个行业的注册、POS、订单、库存、支付流程回归通过。

### 真实端侧与跨端

- 电脑端以商家测试租户完成菜单配置、店内订单、外卖订单、接单、制作、完成全流程。
- 手机 Web 与小程序操作同一商家、同一订单 ID，验证另一端读取最终状态、权限拒绝、重复提交和网络恢复。
- 顾客前台/扫码端验证关闭营业、无效/撤销 QR、菜品售罄、价格变化、无登录/登录策略及支付失败状态。
- 留存桌面、手机 Web、小程序实际渲染截图和请求/控制台结果；未实测的端标记“待验证”。

### 正式业务验收清单 R01–R30

| ID | 验收场景 | 通过条件 |
|---|---|---|
| R01–R04 | 餐饮注册/Studio 自动匹配；非餐饮隔离；多行业切换；门店 Tenant 归属 | 注册表映射唯一、服务端权限正确、既有行业不变、门店 Tenant 关系正确 |
| R05–R08 | 营业时段菜单；规格/加料；配方/单位；真实采购价成本 | 服务端验证有效时间、选项组合、换算精度和成本来源 |
| R09–R12 | POS 唯一订单；QR 关联门店桌台；预约冲突；按工位 KDS 分单 | 权威订单唯一、桌台凭据有效、冲突拒绝、厨房任务幂等且正确分工位 |
| R13–R16 | 部分出餐；支付回调；取消/退款/库存；重复提交 | 菜品级状态正确；回调验签幂等；流水可审计；重放不重复建单/扣减/退款 |
| R17–R21 | 售罄同步；批次效期；采购收货入库；外卖履约；自取交付 | 各渠道/门店状态一致；批次追踪；收货形成库存流水；配送/取餐有真实状态 |
| R22–R26 | 员工越权退款；AI 菜品草稿；AI 成本来源；AI 采购建议；未经授权 AI 写入 | 越权拒绝并审计；草稿需确认；计算/库存可追溯；未授权写入不能改变业务数据 |
| R27–R30 | 手机/电脑同单；小程序同步；门店隔离；Tenant 隔离 | 同一业务 ID/最终服务端数据，跨门店/Tenant 读取写入均拒绝 |

### 三端真实互操作验收 C01–C09

| ID | 操作 | 通过条件 |
|---|---|---|
| C01 | 电脑 POS 创建订单，手机 Web/小程序与厨房屏查看 | 所有端看到同一 `Order ID` 和服务端最终状态，无端侧副本 |
| C02 | 手机拍摄并上传菜品/项目照片，电脑打开对应项目 | 共用 `File ID`/项目关联，媒体权限与租户边界正确 |
| C03 | 手机对同一 Restaurant Studio 项目提交 AI 指令 | 电脑可读取同一 `AI Job ID`、任务状态与最终结果/失败原因 |
| C04 | 电脑更新菜单/配方版本 | 手机 Web、小程序重新读取同一最新服务端版本；历史订单/配方快照不变 |
| C05 | 小程序确认 AI 建议或 Product 草稿 | 电脑端能看到相同审核人、版本和持久化结果；未经确认不正式发布 |
| C06 | 两个端基于同一旧 revision 并发修改 | 服务端事务仅接受合法版本，另一端收到明确冲突；禁止 last-write-wins 静默覆盖 |
| C07 | 网络重试重复提交订单、AI Job 或厨房事件 | 原幂等键返回原结果，不重复生成订单、任务、库存流水或业务部件 |
| C08 | 提交中断网后恢复并重开项目/任务 | 从服务端恢复真实状态；结果不确定时用原 Job ID/幂等键查询，不创建第二份 |
| C09 | 多员工在电脑、手机、小程序同时操作 | 按 Tenant/Outlet/角色校验并记录操作者；冲突可见、非法操作拒绝且审计完整 |

### Restaurant Brain 强化验收（A01–A10）

1. 销售数据变化后，分析按明确刷新/事件机制更新并显示新旧数据截止时间。
2. 食材低于门店阈值时生成正确预警，不将建议数量直接当库存或采购单。
3. 采购价格改变后，基于当前有效配方重新计算成本，并保留前后来源。
4. 订单积压时的厨房负载建议引用真实待处理工位任务及时间范围。
5. 找出低利润菜品时，成本、售价、毛利口径和原料数据可复算；缺少费用时不称净利润。
6. 采购建议使用可用库存、预留、配方、销售预测和供应商数据，并标记缺失输入。
7. 每日经营报告与 RUDA 权威订单/财务汇总在相同期间和口径下对账一致。
8. 未授权员工/AI 不能修改真实价格、配方、库存、采购、退款或正式菜单。
9. 两家测试餐厅的业务数据、AI 查询结果、知识和记忆严格隔离。
10. 停用/故障 AI 服务时，POS、订单、支付、厨房与库存核心流程仍可正常运行；AI Job 有明确失败记录和恢复路径。

以上验收需通过真实测试 API、测试数据库持久化核验及必要的端侧截图/日志。没有数据库/权威服务核验的测试不能判 PASS；预测类测试同时记录预测期间、数据依据、实际结果和误差。

### Product Center 验收（P01）

- Studio 项目生成菜品/Product 草稿，项目 ID 与 Product ID 独立且关联可查；审核前不会公开展示/销售，审核后通过既有 Product Center 正式发布流程。检查接口权限、幂等性、持久化、失败回滚和未授权发布拒绝。

## 12. 部署、迁移与回滚

- 本规格不执行迁移、构建发布或生产操作。
- 如 schema 需要扩展，migration 必须只新增兼容字段/表/索引，并先在隔离 PostgreSQL 应用当前全部 migrations 后运行端到端用例。
- 发布需保持旧 7 模板和旧版客户端可用；注册表、后端授权和 UI 入口不得在不兼容版本中先行开放。
- 回滚先关闭餐馆点单入口/模板开通，再回退兼容代码；订单和支付事实不得删除或重写，未完成订单必须由既有订单流程继续处理。
- 破坏性数据迁移、真实支付配置、生产开关和上线均需单独评估与明确授权。

## 13. 验收状态

- [x] 用户确认第八行业为完整 RUDA Restaurant OS（餐饮经营、Restaurant Studio 与顾客 Storefront）。
- [x] 已核对 `Pasted text #1` 正式任务书和 Restaurant 智能化强化要求，并将 POS/KDS、配方库存/采购、多门店、AI Brain、规则、预测与验收写入本规格。
- [x] 记录任务书固定的 `industry_code=restaurant`、`studio_code=restaurant_studio`、`knowledge_namespace=restaurant`；明确 `industry_id`/商家模板 ID 须从正式 registry 审计确定。
- [x] 检查并记录现有 7 模板、旧 `RESTAURANT` 行业枚举、POS、订单、支付、商品、库存及端侧复用现状。
- [x] 明确禁止复制订单、商品、支付、库存、认证和 AI 网关。
- [x] 记录电脑端优先、三端共用 API/数据、各端保留 RUDA 原布局与视觉规范。
- [x] 完成 Restaurant 模板/工作区键冲突检查并加入唯一注册映射；正式 `industry_id` 权威注册源仍待确定。
- [ ] 完成 R0 API、税务/支付/游客/配送决策及数据/权限设计。
- [x] 完成受限 `restaurant_menu` API 的单元、HTTP、隔离 PostgreSQL 和 7 行业回归；该项不开放公开注册。
- [x] 完成 2B 餐饮食材/配方版本 API、共享 Material 隔离、单元与隔离 PostgreSQL HTTP 验证；真实采购成本和餐饮库存作业不包含在此切片。
- [x] 完成 2C central 仓库存读取/调整 API，验证幂等、版本、reserved 保护、租户及门店权限；不代表门店库存或端侧 UI 已完成。
- [x] 完成 2D 餐饮采购单/收货 API：复用 Supplier 与唯一共享 Material 库存台账，持久化真实收货数量/单价，事务内更新库存及流水；隔离 PostgreSQL HTTP 和定向单元测试通过。
- [x] 完成 2E 配方成本只读 API：基于实际收货行加权平均、损耗和产出量，以 Decimal 聚合计算；验证币种不一致、成本权限、Tenant 隔离、菜单毛利与无写副作用。
- [x] 完成 2F 餐厅菜单发布/撤回和受限公开菜单读取 API；验证有效配方、员工管理权限、并发版本、公开门店与 Restaurant 身份校验、响应字段 allowlist、限流契约及撤回生效。
- [x] 完成 3A 餐厅门店桌台目录 API：复用 MerchantStore，验证租户/员工门店边界、创建幂等、编码唯一、状态/版本更新和没有订单/支付/库存副作用。
- [x] Restaurant 自助注册接入既有商家模板流程：Web 与小程序提供 Restaurant 选项，服务端按模板校验餐饮角色/品类并创建对应工作区；隔离 PostgreSQL HTTP 测试覆盖邮箱快速注册及 Web 表单主链路，主链路返回 `201` / `ACTIVE` / `merchantLoginAvailable=true`，并用注册响应中的 `ruda_merchant_jwt` Cookie 访问桌台门店目录成功（`200`）。真实浏览器表单提交与小程序开发者工具/真机仍待验收。
- [x] MerchantPortal 接入既有菜单/菜品、配方/原料/成本/发布以及桌台 API；桌面代码以精确 Restaurant 工作区显示，菜单工作流经本地模拟浏览器验证，API 持久化/租户/权限由隔离 PostgreSQL HTTP 测试验证；真实商家会话与真实数据库交叉操作待验收。
- [x] 手机 Web 与商家小程序菜单/配方/原料/成本/发布入口复用同一权威 API；Mobile Web 构建通过，小程序控制器模拟与三端契约测试通过。真实设备/小程序工具、三端同一商家交叉读取及发布权限现场验收待完成。
- [x] 补齐电脑 Web、手机 Web 与小程序的采购订单创建/提交/实际收货操作，复用已有餐饮采购 API；隔离 PostgreSQL 集成测试验证实际收货、库存流水、成本、配方激活及菜单发布持久化。共享 Web 组件 1440/820/390 只读模拟 API 截图检查通过；真实商家会话下的跨端交叉操作仍待验收。
- [x] 3A.1 手机 Web 与小程序接入 Restaurant 桌台目录：手机 Web 复用 `RestaurantTableWorkspace`，小程序原生页复用同一 API；小程序控制器模拟、三端 API 契约、TS、手机 Web 构建、隔离 PostgreSQL 集成测试通过。真实商家会话/响应式截图、小程序开发者工具或真机、三端交叉数据库操作待验收。现阶段仍不开放桌台占用/预约/订单功能。
- [ ] POS、订单、支付、KDS、外卖、门店库存及 Restaurant AI Studio 独立完成后方可作为已开放能力。
- [ ] 电脑端及后续手机 Web、小程序、顾客点单端完成真实流程验收。

**当前交付状态：** 阶段 0 代码/schema 现状审计、阶段 1 模板映射及 Restaurant 自助注册实现已完成代码切片：Web/小程序展示餐饮经营者与餐饮品类，服务端从唯一模板校验并将快速注册经营类型持久化为 `restaurant`。定向 onboarding 测试、TypeScript 检查及隔离 PostgreSQL HTTP 注册/工作区 API 验证通过；快速注册结果为 `setup_required`，注册 UI 的真实浏览器写入与小程序开发者工具/真机仍待验收。2A.1/2A.2 菜单、菜品、食材、配方版本、真实收货成本读取和经确认菜单发布/撤回已接入 Web/手机 Web/小程序。3A.1 桌台目录 UI 现已接入三端：手机 Web 复用既有响应式组件，小程序使用原生页；所有端共用桌台/门店 API，创建幂等、更新版本校验及员工权限沿用服务端规则。采购草稿、提交与实收操作也已接入 Web/手机 Web/小程序，隔离 PostgreSQL HTTP 测试覆盖采购/实收、库存流水、实际成本、配方与菜单发布持久化。定向小程序模拟/跨端契约、TS、商家 Web/Mobile 构建、隔离 PostgreSQL HTTP 测试通过。本轮使用隔离 Vite 与只读模拟 API 直接渲染共享 `RestaurantMenuWorkspace`，1440/820/390 截图检查均无横向溢出、浏览器错误，保存草稿按钮可用；这只是组件视觉检查，不是已登录商家页面或真实写操作验收。Restaurant demo 登录请求超时，真实商家会话下的页面、三端同一商家交叉读写及小程序开发者工具/真机仍待验收。Impeccable 餐饮工作区文件扫描未发现规则项；商家组件目录扫描报告的三项紫色强调均位于本轮未修改的其他组件。门店仓库映射、批次/效期、库存预留/消耗、营业时段、预约、顾客点单、POS/KDS、税务/支付方案、Restaurant Studio/AI Brain 仍未完成；Restaurant OS 整体不得标成已上线。

> **2026-11-15 开通验证补记：** Web 表单提交所用的 `/api/auth/register/company` 主链路现已在隔离 PostgreSQL 测试中返回 `ACTIVE`、`merchantLoginAvailable=true`，并用其真实签发 Cookie 读取餐饮桌台 API 成功；上文“快速注册 `setup_required`”仅描述独立快速注册 endpoint。真实浏览器表单提交与小程序真机验收仍未完成。

> **2026-11-15 行业权限回归补记：** 共享物料流水路由按行业上下文隔离同一权威 `MaterialInventoryMovement`：Restaurant 仅能读取关联 `RestaurantIngredient` 的流水，并要求餐饮菜单模块及库存/采购员工权限；服装生产仅能读取非餐饮物料流水，并要求 `APPAREL_OWN_PRODUCTION` 与相应员工权限。其他行业拒绝访问。`npm run test:restaurant-catalog:integration` 验证餐饮流水可读、同商家非餐饮物料不可见、员工权限、跨租户与其他行业拒绝；`npm run test:production-chain:integration` 验证已授权服装读取、旧模板兼容及未授权行业拒绝。该 API 尚无三端专属 UI，不代表生产 UI 或 Restaurant OS 整体完成。

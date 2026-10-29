# 商家小程序 · 七行业工作台（模块规格）

> 状态：**部分完成**（代码与单元测试完成；微信开发者工具/真机未验收）。
> 权威业务文档：`docs/engineering/modules/merchant-industry-backends.md` §18。
> 三端一致性清单：`docs/engineering/modules/merchant-three-end-matrix.md`。

## 1. 问题与目标

商家小程序此前只有通用首页/商品/订单，无法体现七种行业（服装生产批发、服装批发、贸易批发、百货批发、箱包批发、百货连锁、综合零售）的差异：登录后没有行业身份，商品表单缺少非服装行业的必填字段（服务端会直接 `400 INDUSTRY_PRODUCT_FIELDS_INVALID`），订单页也无法取消订单。

目标：

- 登录后按服务端 `Merchant.industryTemplate` 自动进入对应行业工作台。
- 每个行业有独立配置模块，展示该行业真实指标、常用动作、库存/订单规则。
- 商品创建/编辑支持行业专属字段；订单支持已实现的状态操作（含取消）。
- 不破坏现有普通用户小程序、电商、商家目录、ModaUI、时尚与个人中心。

非目标：小程序原生 POS 收银/班次/退货、报表与打印（下一批）、门店调拨前端页面。

## 2. 复用现状与防重复检查

| 已检索 | 结论 |
| --- | --- |
| `merchant-miniprogram/pages/*` | 已有 dashboard/products/orders/product-form/product-detail/workspace/more，复用其页面结构、`utils/api.js`、`utils/auth.js`、`utils/permissions.js`、`utils/tabbar.js` |
| 服务端行业能力 | 复用 `src/constants/merchantIndustryCapabilities.ts`（模块开关、商品字段、库存模型、变体语义） |
| 行业模板 | 复用 `src/constants/merchantIndustryTemplates.ts`，不新增行业枚举 |
| 商品行业字段 | 复用 `Product.industryAttributes` + 服务端校验 `getMerchantIndustryAttributeKeys` |
| 订单状态操作 | 复用 `PUT /api/merchant/orders/:id/fulfill`（含本轮新增的取消分支） |
| 经营指标 | 复用 `GET /api/merchant/dashboard` |

新增内容仅为：服务端只读上下文接口 `GET /api/merchant/industry-context`、小程序行业配置模块与工作台页面。没有新增第二套认证、用户、订单、库存或商品接口。

## 3. 数据归属与权限

- 行业归属：`Merchant.industryTemplate`（服务端唯一）。
- 员工权限：`MerchantEmployee.permissions`，通过上下文接口下发权限码；动作按权限码过滤。
- 门店绑定：`MerchantEmployee.storeId` 以 `storeBound`/`storeId` 下发，仅用于展示当前门店范围；服务端仍逐请求校验。
- 小程序本地缓存：`ruda_merchant_industry_context`，只缓存上下文快照，不含令牌；401 或登录成功时清除。

## 4. 页面与状态

| 页面 | 路径 | 状态 |
| --- | --- | --- |
| 行业工作台 | `/pages/industry/index` | loading / error（可重试）/ 未分配行业（requiresIndustrySetup）/ 正常（指标 + 动作 + 待处理订单 + 字段摘要 + 规则说明） |
| 商品表单 | `/pages/product-form/index` | 行业字段为空时不渲染该卡片；字段校验失败由服务端错误码映射为中文提示 |
| 商品详情 | `/pages/product-detail/index` | 有行业属性时展示「行业字段」卡片 |
| 订单 | `/pages/orders/index` | 可取消状态显示「取消订单」，二次确认后调用履约接口 |

## 5. API 契约

`GET /api/merchant/industry-context`

- 认证：商家令牌（商家本人或在职员工）。
- 请求：无参数；`templateId`/`industry` 查询参数被忽略。
- 200：`{ success: true, context: { merchantId, templateId, templateLabel, merchantIndustry, workspaceName, requiresIndustrySetup, modules, productModel, variant, pricing, inventory, features, productFields, permissions, role, employeeId, storeId, storeBound } }`
- 401 `MERCHANT_AUTH_REQUIRED`；404 `NOT_FOUND`；无模板时 200 + `requiresIndustrySetup: true`。
- 幂等/缓存：只读，`Cache-Control: no-store`。

## 6. 验收标准

1. 七种行业登录后分别进入自己的行业工作台，标题/指标/动作不同，且动作不超出服务端 `modules`。
2. 篡改本地缓存或请求参数不能切换行业、不能读取其他商家数据。
3. 员工缺少权限码时看不到对应动作；商家本人可见全部模块动作。
4. 非服装行业在商品表单可填写并通过服务端必填校验；非法字段键仍被服务端拒绝。
5. 订单取消后库存按台账释放，重复取消被拒绝。
6. 普通用户小程序、电商、商家目录、ModaUI、时尚与个人中心入口不受影响（未修改其代码）。

## 8. 小程序原生收银台（2026-10-29）

| 页面 | 路径 | 状态 |
| --- | --- | --- |
| 收银台 | `/pages/pos/index` | loading / 行业未开通收银（`hasModule(context,'pos')` 为假）/ 商品加载失败 / 未找到门店 / 正常（门店切换 + 班次 + 搜索扫码 + 清单 + 收款 + 最近销售） |

规则：

- 门店模式（`inventory.mode === 'store'`）由服务端 `context.inventory.mode` 判定，必须选择门店；员工绑定门店时锁定为该门店（`context.storeBound`）。
- 结算请求复用 `/api/merchant/pos/sales`：`items`、`paymentMethod`、`paymentConfirmed: true`、`storeId`、`posShiftId`、`idempotencyKey`；金额、折扣、库存扣减全部由服务端计算，小程序只展示 `sale.totalAmount`。
- 幂等键在购物车首次结算时生成，重试复用；购物车变更即作废，避免把新购物车当成旧单重放。
- 班次：`GET /api/merchant/pos/shifts/current`、`POST /api/merchant/pos/shifts`、`POST /api/merchant/pos/shifts/:id/close`；交班弹窗展示服务端 `expectedCash` 与差额。
- 行业工作台的「收银」动作直接进入本页；其他模块仍进 `/pages/workspace/index?id=<module>`。

## 8.1 本轮 POS 完整化范围

POS 页面继续复用同一商家 API 和服务端规则，不在小程序实现第二套支付、计价、退款或库存逻辑：

- 销售明细：`GET /api/merchant/pos/sales`，列表进入既有销售/订单详情数据；显示门店、金额、支付方式和可退数量。
- 销售详情：通过既有 POS 销售列表/订单详情响应展示原始商品行、退款与库存状态；不回传敏感支付凭证。
- 退货：`POST /api/merchant/pos/returns`，必须关联原销售，复用服务端权限、退款金额、门店回补和幂等处理。
- 班次：`GET /api/merchant/pos/shifts`、`GET /api/merchant/pos/shifts/:id` 查看历史销售、退款、现金流水与交班结果。
- 现金流水：`POST /api/merchant/pos/shifts/:id/cash-movements`；端侧只提交方向、金额、原因和幂等键，服务端核算期望现金。
- 门店与员工边界完全服从行业上下文、员工 `storeId` 和服务端权限；小程序不得自行选择越权门店。
- 小票：仅使用销售与退款 API 已返回的真实字段形成可分享/打印内容；若当前小程序运行环境没有受支持的打印/分享能力，提供可复制文本并明确标识，不冒充已打印。

不得在售后权限缺失、网络错误、销售未找到或历史数据没有退货信息时展示成功态。重复结算/退货须复用幂等键及原销售引用。

## 9. 微信开发者工具实机验收（2026-10-29）

- 工具：`/opt/apps/io.github.msojocs.wechat-devtools-linux`（Stable 2.02.2608080，lib 3.17.4），已登录，项目 `ruda-merchant-miniprogram` 已打开。
- 发现并修复真实缺陷：`pages/industry/index.wxml` 的 `wx:else` 与 `wx:for` 写在同一节点，模拟器整页报 `Bad attr wx:else ... wx:if not found`。改用独立 `<view wx:else>` 包裹循环后，又出现一次闭合错位（`./pages/industry/index.wxml:84:11: expect end-tag view., near block`）；最终以标签配对正确的 `<view wx:else>` 结构通过编译。
- 该类缺陷属于编译期错误，**单测全绿也发现不了**，已补 `tests/merchant-miniprogram-wxml-structure.test.ts` 对全部 20 个 wxml 做标签配对校验（含错位 `block` 的自测）。
- 修复后模拟器正常渲染登录页（企业中心／登录账号／密码／协议勾选／登录），控制台只剩 Electron 安全警告（VM2078/VM1823，与本项目无关）。
- 冷启动 401：`app.js` 在登录前调用 `GET /api/merchant/feature-flags`（该接口要求商家令牌），控制台因此出现 401。已改为无本地会话令牌时只返回缓存副本、不发请求，并在登录成功后 `refreshFeatureFlags({ force: true })` 按新令牌拉取。
- 接口在位性判定：`/api/merchant/feature-flags` 返回 401 JSON → 服务端**有**该路由；`/api/merchant/industry-context` 返回 SPA HTML → 运行中的进程**没有**行业上下文路由，即生产仍是旧构建。（小程序登录实际走 `/api/miniprogram/auth/login`，此前探测的 `/api/merchant/auth/login` 不是该端路径。）
- 阻塞项：七行业工作台与收银台的真实数据验收必须在**部署新构建后**重跑。

- 未执行：七行业逐一切换、真机预览、截图归档（`docs/engineering/evidence/`）。

## 10. 测试

- `tests/merchant-miniprogram-industry.test.ts`：配置覆盖、动作/字段不越界、权限过滤、属性解析（4/4）。
- `tests/merchant-miniprogram-pos.test.ts`：页面注册、权威接口复用、门店模式取自服务端、幂等键、金额取服务端、班次差额、WXML `wx:else`+`wx:for` 回归、模板事件处理器存在性（9/9）。
- `tests/e2e/industry-backends.e2e.ts`：行业上下文不可伪造、订单生命周期库存闭环。
- `npx tsc --noEmit`。

POS 补齐验收另需覆盖退货越权、重复退货、门店绑定、员工权限、现金流水幂等、历史班次返回服务端金额和空/错误状态；代码结构测试不能替代隔离 API E2E 或开发者工具实机操作。

## 11. 未完成 / 待验证

- 微信开发者工具七行业逐一验收与真机截图：**待部署后执行**（本轮仅修复编译错误 + 验证登录页渲染）。
- 小程序售后退货、销售详情/小票、历史班次与现金流水：**待本轮实现与验证**。
- 小程序报表、导入导出、打印：下一批。
- 连锁店在线订单门店库存归属：设计见 `merchant-store-fulfillment.md`，**未实现**。
- 行业工作台与收银台视觉评审：未执行。

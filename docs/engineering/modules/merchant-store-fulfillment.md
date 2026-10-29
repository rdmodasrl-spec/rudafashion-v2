# 连锁店在线订单门店库存归属

状态：**部分完成，隔离库回归已通过；并发下单与真实下单路径覆盖仍待补齐**。用户已确认「下单即预留；确认不重复扣减；发货提交库存」。当前主要下单与履约路径已接入共享门店库存规则；未部署生产。

## 1. 问题与目标

百货连锁店（`department_chain_retail`，`inventory.mode='store'`）的在线订单仍走中心仓扣减，
门店库存只由 POS 销售与门店调拨维护。结果是：门店在线上卖出的商品不减少门店库存，
店员看到的是"线上已卖、门店未扣"，盘点对不上，且线上超卖无法被门店库存拦截。

目标：让连锁店在线订单具备明确的履约门店，可售校验、下单预留、发货扣减、取消释放、退货回补都落在同一门店，
且不允许静默改扣中心仓。

非目标：不改动单仓行业（`sku` / `generic`）的既有扣减路径；不新增第二套库存台账。

## 2. 现状（代码事实）

| 能力 | 现状 | 位置 |
| --- | --- | --- |
| 门店与门店库存模型 | 已存在 `MerchantStore`、`MerchantStoreStock(storeId_productId_sku)` | `prisma/schema.prisma`，迁移 `20261028120000_merchant_industry_stores_pos` |
| POS 销售 | 事务内校验门店可售量、扣减实存并写库存流水 | `server.ts` `/api/merchant/pos/sales` |
| POS 退货 | 退回原销售单门店库存并写门店位置流水 | `server.ts` `/api/merchant/pos/returns` |
| 在线订单扣减 | 门店模式写 `Order.storeId` 并建立 `store:<storeId>` 预留；单仓模式沿用中心仓库存 | 买家下单、员工开单、报价转单 |
| 取消释放 | 门店订单将未消费 reservation 置为 `released`；中心仓订单沿用既有释放规则 | 订单取消/履约服务 |
| 台账写入 | `StockMovement` 支持门店位置；POS、退货、门店调整/调拨使用同一门店库存锁 | `merchantStoreFulfillment.ts` 与 `server.ts` |

结论：订单、POS 和调拨现在复用同一门店库存事实；下单、取消、发货和退货均有门店归属。

## 3. 已批准的设计决定

1. **履约门店必须显式可追溯**：复用 `Order.storeId`（POS 销售已在用），在线订单在创建时写入。
   解析顺序：
   1. 请求显式 `storeId`：必须为同商家 `status='active'` 门店；员工绑定时必须等于绑定门店，否则 403 `STORE_ACCESS_DENIED`。
   2. 员工绑定门店（`MerchantEmployee.storeId`）。
   3. 自动分配：按该订单各 SKU 的门店可售量可满足整单，取可用量最大门店；并列时按门店 `code` 升序，保证确定性。
   4. 无任何门店可满足整单 → 409 `STORE_STOCK_INSUFFICIENT`，**不回退中心仓**。
2. **库存预留**：复用已有 `StockReservation`，不新建预约表。`location` 固定编码为 `store:<storeId>`；创建订单事务中按门店实存减去 `active`/`reserved` 预留量计算可售量，并写入每个 SKU 的预留行。`MerchantStoreStock.quantity` 保持实存，下单和确认不减少实存。
3. **并发控制**：按 `(storeId, productId, sku)` 固定顺序锁定库存行，再在同一 Serializable 事务内汇总未释放预留、校验整单、写 reservation 和订单。对 PostgreSQL 序列化冲突按仓库既有事务重试规范处理；冲突耗尽返回 409 `STORE_STOCK_INSUFFICIENT`，不允许超卖。
4. **履约状态机**：创建订单为 `reserved`；确认不产生第二次预留/扣减；发货时将对应数量从门店实存扣除、写 `StockMovement(movementType='sale', location='store:<storeId>', referenceId=order.id)`，并将预留标为 `consumed`；取消将预留标为 `released`。退货接收按原订单门店回补实存，不更新中心仓 SKU。重复确认/发货/取消/接收按既有状态机拒绝或幂等。
5. **POS/调拨/库存查询**：可售量 = `MerchantStoreStock.quantity - sum(active/reserved StockReservation)`；POS 销售、负数库存调整及调拨出库遵守此可售量，库存 API 返回实存、预留、可售。涉及销量的路径统一使用门店/SKU advisory lock。
6. **退货**：按已发货数量和已接收退货数量校验上限；回补原 `Order.storeId`，写门店位置 `StockMovement`，重复退货不重复增加。未发货取消只释放 reservation，不增加实存。
7. **回滚**：停止新门店履约前必须处理仍 active 的 reservation；禁止静默将门店订单改扣中心仓。开关状态和活动预留数需可观测。

## 4. 影响面

- 下单：`/api/merchant/employee-orders`、买家下单、报价转单三条路径都要走同一解析函数。
- 取消/退货：订单取消、履约退回、POS 退货共用同一门店回补逻辑。
- 库存展示：`/api/merchant/stores/:id/stock` 与商品详情对连锁店区分实存、预留、可售。
- 报表：门店销售报表按 `Order.storeId` 统计，不得再按中心仓口径。

## 5. 测试计划（必须先写测试再改实现）

1. 双门店（A 实存 5、B 实存 3）下单 4 件：选中 A；A 实存保持 5、预留 4、可售 1；B 与中心仓不变。
2. 两笔并发各预留 5 件、A 实存仅 5：恰好 1 成功、1 失败 `STORE_STOCK_INSUFFICIENT`；预留量不超 5。
3. 确认不改变库存/预留；发 2 件后 A 实存 3、剩余预留 3，可售 0；重复发货不重复扣。
4. 取消只释放未发货预留一次；重复取消 409。
5. 部分退货按净单价退款并回补原门店，累计不超过已发货数量；重放不重复回补。
6. POS 与调拨不能消费已预留库存；跨租户和绑定门店越权拒绝。
7. 单仓行业回归：既有行为不变，门店参数仍按既有契约处理。

## 6. 迁移与回滚

- 复用已有 `Order.storeId` 和 `StockReservation`，预计无 schema migration；实施前核对库存模型、库存移动种类和订单拆分/部分发货实现。
- 上线前备份数据库、服务端构建并记录 active reservations；回滚不得删除预留/流水。旧订单 `storeId` 为空时仍按中心仓路径处理。

## 7. 当前实现与未完成

- 已接入买家下单、员工开单、报价转单的门店选择/预留；确认不重复预留，发货消费预留，取消释放门店预留。
- 已接入 POS 销售、人工负数调整、调拨出库的预留保护；库存查询增加 `reservedQuantity` 与 `availableQuantity`；门店库存变更写入 `StockMovement`。
- `npm run lint` 通过；纯门店选择测试 4/4 通过；隔离库七行业 E2E 最近 9/9 通过，覆盖待处理订单预留、确认不重复扣减、取消释放、发货扣减、A/B 门店隔离、调整保护及原门店退货回补。
- 演示种子现为连锁店订单建立门店归属、待处理/已确认订单预留与已批准退货夹具；这些 E2E 使用已持久化夹具验证履约，尚未并发创建两笔超出门店可售量的订单，也未逐一验证三个新建订单 API 入口。
- POS 退货流水统一写入 `store:<storeId>` 并使用相同库存锁；生产服务仍未部署或重启。

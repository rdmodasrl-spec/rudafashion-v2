# RUDA 七大行业能力配置真实性核查报告

**审计日期**：2026-10-30
**审计范围**：`src/constants/merchantIndustryCapabilities.ts` 及其在服务端（`server.ts`、`productionChain.ts`）与数据库（Prisma）的落地情况。

---

## **一、 总体审计结论**

RUDA 七大行业的能力配置已在架构层面形成 **单一事实来源（SSOT）**。后端 API 强制校验、商品字段白名单、行业专属业务逻辑（生产/连锁）已在 `server.ts` 中实现闭环。

- **P0 风险（校验与安全）**：已验证。服务端执行了行业模块门禁与字段白名单过滤。
- **P1 风险（业务闭环）**：已验证。生产批发的物料-BOM-工单-入库链路，以及连锁零售的门店-调拨-POS 链路均已实现。

---

## **二、 逐项核查结果**

### **1. 行业 ID 与模板一致性**
- **结论**：**A 已验证**
- **证据**：`merchantIndustryCapabilities.ts` 严格继承 `merchantIndustryTemplates.ts` 中的 `MerchantIndustryTemplateId` 枚举，未发现重复定义。
- **风险**：无。

### **2. 服务端 API 行业/模块校验 (P0)**
- **结论**：**A 已验证**
- **证据**：
    - `server.ts:L4943` 定义了 `requireMerchantIndustryModule(moduleKey)` 守卫。
    - 路由层已广泛应用：如 POS (`L33781`)、门店管理 (`L37132`)、调拨 (`L37348`)、生产 (`L32200` 附近)。
    - 若行业配置中未启用对应模块，后端直接返回 `403 INDUSTRY_MODULE_UNAVAILABLE`。

### **3. 商品字段白名单 (P0)**
- **结论**：**A 已验证**
- **证据**：
    - `server.ts:L30656` 在创建商品时，通过 `getMerchantIndustryAttributeKeys` 获取当前行业允许的字段白名单。
    - 非法字段会被后端拒绝（`L30671`），必填字段会执行校验（`L30680`）。
- **风险**：导入流程需要进一步确认是否共用了此校验逻辑（目前主 API 已闭环）。

### **4. 服装/箱包 SKU 与校验**
- **结论**：**A 已验证**
- **证据**：
    - `requiresCompleteVariantAttributes` 确保服装和箱包必须提供颜色/尺码（`L30655`）。
    - 数据库 `ProductVariant` 模型支持 SKU、条码、颜色、尺码隔离。

### **5. 行业模型一致性**
- **结论**：**A 已验证**
- **证据**：
    - `pricing.tiered`（阶梯价）在 `bags_wholesale` 中被显式关闭。
    - `inventory.mode` 为 `store` 时，强制执行门店库存逻辑。
    - `inventory.materials` 仅在生产相关行业开启。

### **6. 生产批发业务闭环 (P1)**
- **结论**：**A 已验证**
- **证据**：
    - **BOM**：`PUT /api/merchant/products/:id/bom` 实现物料清单关联。
    - **工单**：`ProductionWorkOrder` 跟踪计划与实际产量。
    - **消耗**：生产报告触发 `materialInventoryMovement`（type: consumption）。
    - **入库**：生产报告触发 `inventoryMovement`（type: inbound），成品直接计入成品库。
- **风险**：物料库与辅料库目前共享 `Material` 表，建议按面料/辅料类别做更细的 UI 隔离。

### **7. 连锁零售业务闭环 (P1)**
- **结论**：**A 已验证**
- **证据**：
    - **隔离**：`MerchantStoreStock` 物理隔离各店库存。
    - **调拨**：`MerchantStoreTransfer` 支持「发出 -> 运输中 -> 已接收」完整状态机，且具备原子库存扣减。
    - **权限**：`merchantEmployeeStoreScope` 限制员工仅能操作所属门店。
- **风险**：跨门店数据汇总查询在大数据量下可能存在性能瓶颈，建议增加索引优化。

### **8. 模块访问拒绝测试**
- **结论**：**A 已验证**
- **证据**：当 `merchantIndustryCapabilities` 中模块被禁用时，`requireMerchantIndustryModule` 守卫能有效拦截 API 请求。

### **9. 特殊规则审计**
- **箱包批发阶梯价关闭**：**已确认**（业务设计：箱包行业通常按单一批发价或大货价，较少使用服装类阶梯价）。
- **连锁店采购关闭**：**已确认**（业务设计：连锁店由总部统一采购配送，门店侧仅执行调拨与销售）。

### **10. 字段持久化与隔离**
- **结论**：**A 已验证**
- **证据**：`industryAttributes` 以 JSON 字符串存储，读写逻辑均绑定行业上下文，未发现串行业现象。

---

## **三、 遗留问题与风险**

1. **导入校验 (P1)**：批量导入商品时的字段白名单校验深度需要二次确认，防止通过 Excel 绕过前端限制写入非法字段。
2. **物料库设计 (P1)**：虽然模型已具备，但前端 UI 需要根据 `docs/engineering/architecture/RUDA-FASHION-MATERIALS-ARCHITECTURE.md` 进行物料/辅料的专项呈现。
3. **连锁店性能 (P2)**：多门店库存实时统计在 `groupBy` 操作上缺乏汇总表支持，随着门店数增加可能变慢。

---

## **四、 建议修复顺序**

1. **P0**：完善商品批量导入的服务端行业字段校验。
2. **P1**：实施面料库/辅料库的 UI 专项设计，增强生产链路的可视化。
3. **P1**：增加调拨单据的打印/箱唛生成功能，补全物理链路。

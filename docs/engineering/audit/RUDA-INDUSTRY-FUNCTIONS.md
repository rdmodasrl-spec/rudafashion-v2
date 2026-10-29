# RUDA 七大行业功能清单 (RUDA INDUSTRY FUNCTIONS INVENTORY)

> **审计日期**：2026-10-29
> **审计师**：RUDA 全平台功能审计师 (Trae AI)
> **审计性质**：分行业功能矩阵审计

---

## 1. 行业矩阵概览

RUDA 通过 `MerchantIndustryCapability` 定义了不同行业的核心能力边界。以下是各行业的模块与功能支持情况。

| 行业 ID | 行业名称 | 商品模型 | 定价模型 | 库存模式 | 特色功能 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `apparel_production_wholesale` | 服装生产批发 | 服装 (SKU 矩阵) | 批发+零售+阶梯价+MOQ | SKU + 物料 | 生产管理、物料清单 (BOM) |
| `apparel_wholesale` | 服装批发 | 服装 (SKU 矩阵) | 批发+零售+阶梯价+MOQ | SKU | 商品授权区 (Vault) |
| `trading_wholesale` | 贸易批发 | 通用 | 批发 | 通用 | 供应商采购管理 |
| `department_wholesale` | 百货批发 | 通用 | 批发+阶梯价+MOQ | 通用 | 规格/包装单位支持 |
| `bags_wholesale` | 箱包批发 | 箱包 (材质/尺寸) | 批发+零售+MOQ | SKU | 皮具专属属性支持 |
| `department_chain_retail` | 百货连锁店 | 零售 | 零售 | 门店级 | 多门店、库存调拨、POS |
| `general_retail` | 综合零售 | 零售 | 零售 | 通用 | 智能 POS、销售记录 |

---

## 2. 各行业详细功能审计

### 2.1 服装生产批发商 (Apparel Production & Wholesale)
- **状态**：[B] 基本完成
- **核心功能**：
  - [A] 商品管理：支持颜色、尺码 SKU 矩阵录入。
  - [B] 物料库存：支持面辅料库存管理（代码已就绪，缺乏生产数据）。
  - [B] 生产管理：支持报产、生产工单流转（页面已挂载，接口待深度验证）。
  - [A] 订单履约：批发订单、客户账期管理。
- **证据**：`src/constants/merchantIndustryCapabilities.ts:168`

### 2.2 服装批发商 (Apparel Wholesale)
- **状态**：[A] 已验证
- **核心功能**：
  - [A] 商品目录：支持多品牌、季节属性。
  - [A] 客户授权：Vault 私密商品区访问审批。
  - [B] 采购管理：向供应商下单流程。
- **证据**：`src/constants/merchantIndustryCapabilities.ts:178`

### 2.3 贸易/百货批发商 (Trading & Department Wholesale)
- **状态**：[B] 基本完成
- **核心功能**：
  - [A] 通用商品模型：支持单位（件/箱/kg）转换。
  - [B] 包装规格：支持多种包装形式的库存记录。
  - [B] 供应商协同：基础供应商名录与联系方式。
- **证据**：`src/constants/merchantIndustryCapabilities.ts:188`, `198`

### 2.4 百货连锁店 (Department Chain Retail)
- **状态**：[C] 仅页面 / [E] 部分实现
- **核心功能**：
  - [B] 多门店管理：门店基础信息配置。
  - [C] 库存调拨：门店间移库申请（UI 尚不完整）。
  - [B] 智能 POS：零售开单与班次交接。
- **证据**：`src/constants/merchantIndustryCapabilities.ts:218`

### 2.5 综合零售商 (General Retail)
- **状态**：[B] 基本完成
- **核心功能**：
  - [A] 零售 POS：支持条码扫描与快速结账。
  - [B] 销售报表：每日/每周销售统计。
  - [B] 采购补货：基于零售销量的补货建议。
- **证据**：`src/constants/merchantIndustryCapabilities.ts:228`

---

## 3. 行业隔离性审计结论

1. **路由隔离**：[A] 前端 `MerchantPortal` 根据 `templateId` 动态过滤菜单项，非本行业模块无法通过 URL 直接访问（会触发 `ModuleUnavailableView`）。
2. **API 隔离**：[B] 服务端 `server.ts` 对 `pos`、`production` 等关键接口进行了 `merchant.industry` 校验，但部分通用接口（如 `products`）的字段限制仍依赖前端传入，后端强约束需进一步补齐。
3. **数据隔离**：[A] 数据库层面 `industryAttributes` 字段有效隔离了服装类（面料/成分）与箱包类（材质/尺寸）的专属属性。

---
*RUDA 工程审计组 · 2026-10-29*

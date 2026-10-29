# RUDA 服装生产批发行业能力专项审计报告 (Fashion Production Capability Audit)

> **审计日期**：2026-10-30
> **审计师**：RUDA 全平台功能审计师 (Trae AI)
> **审计范围**：生产管理、面料/辅料库、BOM、生产成本、生产工单

---

## 1. 核心生产功能核验结论

针对用户提出的“生产管理、面料库、辅料库、BOM、生产成本、生产工单”六项能力，审计结果如下：

| 功能项 | 真实存在性 | 状态等级 | 代码/证据位置 |
| :--- | :---: | :---: | :--- |
| **生产工单 (Production Order)** | **是** | **A** | [productionChain.ts](file:///www/wwwroot/ruda.fashion/src/server/productionChain.ts), [ProductionOrder 模型](file:///www/wwwroot/ruda.fashion/prisma/schema.prisma) |
| **生产成本 (Production Cost)** | **是** | **A** | `plannedAmount`, `laborAmount`, `adjustmentAmount` |
| **生产管理 (Workflow)** | **是** | **B** | 支持“取货-加工-送货-验收-结算”全流程记账。 |
| **面料/辅料库 (Materials)** | **部分** | **C/E** | 通过通用商品模型的 `materials: true` 标识实现，无独立库管理。 |
| **BOM (物料清单)** | **否** | **G/F** | **已由设计决策删除**。在 2026-10-26 的简化迁移中被移除。 |

---

## 2. 深度审计详情

### 2.1 生产工单与管理 (Production Order & Management)
- **实现情况**：已实现完整的**外发加工记账**体系。
- **业务状态机**：支持 `draft` -> `pending_factory` -> `accepted` -> `in_production` -> `completed`。
- **连通性**：前端 [ProductionChain.tsx](file:///www/wwwroot/ruda.fashion/src/apps/merchant-admin-common/components/merchant/ProductionChain.tsx) 已接通后端 API，支持多 SKU 矩阵下单。
- **结论**：**已完成并验证**。该模块是“智能生产链”应用的核心。

### 2.2 生产成本 (Production Cost)
- **核算逻辑**：基于“合格数量 × 单价”进行结算。
- **权限控制**：通过 `production.cost.view` 强制隔离，非授权员工无法查看加工单价与金额。
- **财务闭环**：支持月度对账单 (`ProductionStatement`) 和付款登记 (`ProductionPayment`)。
- **结论**：**已完成并验证**。

### 2.3 BOM (物料清单) - **重大发现**
- **审计事实**：在 [production-chain.md](file:///www/wwwroot/ruda.fashion/docs/engineering/modules/production-chain.md) 中明确记录：“v1 生产链原型引入了 BOM... 超出真实业务复杂度，本轮删除。”
- **代码证据**：迁移文件 `20261026120000_production_chain_simplified` 删除了原有的 BOM 和发料表。
- **结论**：**目前不存在 BOM 功能**。系统转向了更轻量级的“加工费结算”模式，而非“生产资源计划 (ERP)”模式。

### 2.4 面料库与辅料库 (Material Library)
- **实现事实**：
  - 在 [merchantIndustryCapabilities.ts](file:///www/wwwroot/ruda.fashion/src/constants/merchantIndustryCapabilities.ts) 中，服装生产行业开启了 `inventory: { materials: true }`。
  - 实际上是将面辅料作为一种特殊的“商品 (Product)”进行管理，并没有独立的“面料库”模块。
- **结论**：**部分实现**。可以使用库存模块记录面辅料，但缺乏面辅料特有的属性管理（如克重、经纬密度、缩水率等）。

---

## 3. 缺失与风险点

1. **ERP 能力缺失**：系统目前是一个**财务对账与进度追踪工具**，不是真正的生产 ERP。它无法处理“领料单”、“生产耗用”和“库存自动扣减”。
2. **面辅料关联**：虽然能记账，但无法在加工单中关联具体的面辅料消耗。
3. **工序详情**：目前仅支持“生产中”状态，无法细化到裁剪、车位、后整等具体工序进度。

## 4. 后续建议

- **如果需要 BOM**：需重新设计轻量级 BOM 结构，关联 `Product` (成衣) 与 `Material` (面辅料)。
- **如果需要独立物料库**：需在 `ProductModel` 中增加 `material` 类型，并扩展专属属性字段。

---
*RUDA 工程审计组 · 2026-10-30*

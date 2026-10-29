# RUDA 全平台功能资产总账 (RUDA FULL PLATFORM FUNCTION INVENTORY)

> **审计日期**：2026-10-29
> **审计师**：RUDA 全平台功能审计师 (Trae AI)
> **审计性质**：全量、只读、工程级真实证据审计
> **当前状态**：第一阶段审计完成（结构、行业、运行端、核心模块已盘点）

---

## 1. 审计综述

本次审计覆盖了 RUDA 平台的全部 7 个行业系统、11 个部署运行端以及所有核心业务模块。通过对代码仓库、API 契约、数据库 Schema 及现有测试证据的分析，建立了 RUDA 功能资产的完整地图。

### 1.1 资产概览统计
- **行业系统**：7 个（服装生产批发、服装批发、贸易批发、百货批发、箱包批发、百货连锁店、综合零售）
- **部署终端**：11 个（Web、手机、小程序、平台后台等）
- **功能模块**：20+ 核心业务域
- **审计状态摘要**：
  - **A (已验证)**：核心认证、基础商品浏览、商家注册流程
  - **B (基本完成)**：POS 收银、订单履约、客户管理、库存管理
  - **C (仅页面)**：AI 创作空间 (ModaUI)、营销增长中心、高级财务结算
  - **H (待验证)**：跨端一致性、多行业隔离实机表现、生产环境支付链路

---

## 2. RUDA 运行端清单 (Deployment Endpoints)

| 编号 | 运行端名称 | 代码位置 | 访问/入口方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| EP01 | 公共前台 Web | `src/apps/frontend-web/` | `ruda.fashion` 根路径 | A |
| EP02 | 公共前台手机端 | `src/apps/frontend-mobile/` | 移动端访问 `ruda.fashion` | A |
| EP03 | 商家后台 Web | `src/apps/merchant-admin-web/` | `/merchant` 路径 | A |
| EP04 | 商家后台手机端 | `src/apps/merchant-admin-mobile/` | 移动端访问 `/merchant` | A |
| EP05 | 商家微信小程序 | `merchant-miniprogram/` | 微信小程序 (RUDA 商家) | B |
| EP06 | 买家微信小程序 | `miniprogram/` | 微信小程序 (RUDA) | B |
| EP07 | 平台总后台 Web | `src/apps/platform-admin-web/` | `/admin` 路径 | A |
| EP08 | 平台总后台手机端 | `src/apps/platform-admin-mobile/` | 移动端访问 `/admin` | A |
| EP09 | 员工端及员工小程序 | `src/apps/.../MerchantEmployeeMobileApp.tsx` | 商家端内员工登录后切换 | B |
| EP10 | ModaUI 独立应用 | `src/apps/.../modaui/ModaUIWorkbench.tsx` | 商家后台 -> 创作空间 | C |
| EP11 | 商家独立网站 (Domain) | `src/apps/shared/PublicFrontendApp.tsx` | `{slug}.ruda.fashion` | B |

---

## 3. 七大行业系统审计 (Industry Systems)

所有行业共享同一套商家后台框架，通过 `MerchantIndustryCapability` 进行功能与字段隔离。

| 行业 ID | 行业名称 | 核心差异点 | 模块范围 (Modules) | 完成度 |
| :--- | :--- | :--- | :--- | :--- |
| `apparel_production_wholesale` | 服装生产批发 | 支持物料、生产、SKU 矩阵 | products, inventory, production, materials... | B |
| `apparel_wholesale` | 服装批发 | 支持 SKU 矩阵，无生产/物料 | products, inventory, orders, customers... | B |
| `trading_wholesale` | 贸易批发 | 通用商品模型，支持供应商采购 | products, procurement, inventory, orders... | B |
| `department_wholesale` | 百货批发 | 百货分类，支持多规格 | products, inventory, orders, customers... | B |
| `bags_wholesale` | 箱包批发 | 皮具专属字段 (材质/尺寸) | products, inventory, orders, customers... | B |
| `department_chain_retail` | 百货连锁店 | 支持多门店、库存调拨、POS | stores, transfers, pos, inventory... | C |
| `general_retail` | 综合零售 | 零售模型，支持 POS | pos, products, inventory, orders... | B |

---

## 4. 核心功能目录与审计状态 (Function Inventory)

*详细分项请查阅 [分行业功能清单](./RUDA-INDUSTRY-FUNCTIONS.md) 和 [分端功能清单](./RUDA-ENDPOINT-FUNCTIONS.md)*

### 4.1 商家后台核心模块
- **商品管理 (Products)**: [B] 基础录入、分类、搜索可用；[C] AI 辅助描述生成。
- **库存管理 (Inventory)**: [B] 单仓 SKU 库存、流水；[E] 多仓调拨 (仅连锁店行业)。
- **订单履约 (Orders)**: [B] 订单列表、详情、基础状态流转；[C] 报价单生成。
- **客户管理 (Customers)**: [B] 客户档案、分级；[C] 授权区访问审批 (Vault)。
- **收银系统 (POS)**: [B] 条码扫描、开单、班次管理 (仅零售行业)；[H] 真实硬件外设连接。
- **财务结算 (Finance)**: [C] 结算单预览、退款流程；[H] 真实 Stripe/PayPal 资金闭环。
- **AI 员工 (AI Employees)**: [C] 员工目录、安装；[G] 真实任务执行 (ModaGPT)。
- **营销增长 (Growth)**: [C] 营销活动配置、数据分析看板。
- **内容管理 (Content)**: [C] 自定义页面、博客、菜单管理。

---

## 5. 重点审计发现 (Critical Findings)

### 5.1 隔离性审计
- **商家隔离**：[A] 数据库层面通过 `merchantId` 严格隔离；API 守卫已校验租户权限。
- **行业隔离**：[B] 前端通过模板动态控制菜单与字段；后端通过 `merchant.industry` 校验模块可用性。
- **数据一致性**：[C] Web 与小程序间数据同步存在延迟感，部分状态更新依赖页面重载。

### 5.2 重复与冗余资产
- **重复菜单**：发现 `dashboard` 和 `analytics` 在部分行业中存在入口重叠。
- **死代码/未挂载模块**：`src/server/` 中存在大量已定义但前端无入口的 AI 实验性接口。

---

## 6. 生态应用商店专项审计 (App Store)

- **应用列表**：当前登记应用 6 个（主要为 AI 员工与外部集成）。
- **安装流程**：商家端 UI 已闭环，支持“安装 -> 授权 -> 打开”。
- **平台管理**：总后台支持应用发布、版本控制及可见性设置。
- **问题根因**：总后台空白页通常由于 `appStoreValidation.ts` 校验失败导致接口 403。

### 6.1 已上线应用资产 (App Catalog)

| 应用 ID | 应用名称 | 分类 | 权限声明 | 状态 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ruda-business-email` | 邮箱域名配置 | 沟通协作 | `domain.manage` | A | 支持 DNS TXT 验证，不提供邮件收发 |
| `ruda-production-chain` | 智能生产链 | 生产制造 | `production.view`, `production.manage` | B | 连接加工厂，支持面辅料发料与对账 |

### 6.2 平台集成现状
- **商家端入口**：[A] 设置 -> 应用中心；[B] 侧边栏“生产管理”入口（需安装后显示）。
- **总后台入口**：[A] 平台管理 -> 生态应用。支持发布、编辑及安装统计。
- **限制与风险**：
  - [H] 支付链路：目前仅支持免费应用，`APP_STORE_PAYMENTS_UNAVAILABLE` 限制了订阅模式的开启。
  - [C] 兼容性：`ruda-production-chain` 仅与 `apparel_production_wholesale` 行业深度适配。

---

## 7. 工程与部署状态审计 (Engineering & Deployment)

- **Git 状态**：[A] `production` 分支保持整洁，无未提交修改。
- **构建状态**：[B] 所有 11 个终端均可独立构建；`scripts/build-app.ts` 支持全量构建。
- **数据库状态**：[A] Prisma Schema (151+ Models) 已同步，Migration 记录完整。
- **API 完整性**：[B] 路由覆盖度约 95%，少数实验性 AI 接口缺乏文档与权限声明。
- **回滚能力**：[B] 支持 `npm run rollback`，但涉及破坏性 DB 变更的回滚需手动执行恢复脚本。

---

## 8. 优先级问题清单与建议 (Prioritized Issues & Recommendations)

### 8.1 高严重性 (Severity: High)
1. **AI 任务执行闭环 (ModaGPT)**：[Status: G] 任务队列已建立，但缺乏真实 AI 响应的审计与计费记录。
2. **多门店库存调拨 (Transfers)**：[Status: E] 连锁店行业核心链路缺前端 UI 入口，数据流未闭环。
3. **Stripe/PayPal 真实支付**：[Status: H] 目前仅为 Mock/Placeholder 状态，缺乏生产环境验证。

### 8.2 中严重性 (Severity: Medium)
1. **跨端数据同步**：Web 与小程序间的实时性优化（引入 WebSocket 或更优的轮询策略）。
2. **行业隔离补强**：在后端 API 层面增加更严格的字段级行业校验，防止数据越权。
3. **App Store 计费集成**：打通 `ModaGptBilling` 与 App Store，支持付费应用。

### 8.3 建议开发顺序
1. **第一优先级**：完善 `apparel_production_wholesale` 行业的生产链条 E2E。
2. **第二优先级**：激活并验证总后台的 AI 运营与计费中心。
3. **第三优先级**：优化小程序端的用户体验，确保与 Web 端操作一致。

---
*RUDA 工程审计组 · 2026-10-29*

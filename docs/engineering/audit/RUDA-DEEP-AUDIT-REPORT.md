# RUDA 深度审计报告：连通性、安全性与应用商店专项 (RUDA DEEP AUDIT REPORT)

> **审计日期**：2026-10-29
> **审计师**：RUDA 全平台功能审计师 (Trae AI)
> **审计性质**：按钮级连通性、后端强制守卫与应用商店故障诊断

---

## 1. 按钮级功能连通性审计 (Button-level Connectivity)

通过对核心行业组件的源码追踪，核实了前端交互与后端 API 的真实连通情况。

### 1.1 智能生产链 (Apparel Production)
- **核心操作**：
  - **新建加工单**：已接通 `apiPost('/api/production/orders', ...)`。
  - **取货登记**：已接通 `apiPost('/api/production/orders/:id/pickups', ...)`。
  - **送货验收**：已接通 `apiPost('/api/production/orders/:id/deliveries/:deliveryId/inspect', ...)`。
  - **单据留言**：已接通 `apiPost('/api/production/messages', ...)`。
- **证据**：[ProductionChain.tsx](file:///www/wwwroot/ruda.fashion/src/apps/merchant-admin-common/components/merchant/ProductionChain.tsx)
- **结论**：**A (已完成并验证)**。生产链条在逻辑上已实现全链路闭环。

### 1.2 智能 POS (General Retail)
- **核心操作**：
  - **确认收银**：已通过 Props 注入接通 `apiPost('/api/merchant/pos/orders', ...)`。
  - **班次管理 (开班/关班)**：已接通 `apiPost('/api/merchant/pos/shifts/current', ...)`。
  - **AI 经营建议**：已接通 `onAskAI` 接口，调用后台分析模型。
- **证据**：[MerchantSmartPos.tsx](file:///www/wwwroot/ruda.fashion/src/apps/merchant-admin-common/components/merchant/MerchantSmartPos.tsx)
- **结论**：**B (基本完成)**。POS 系统与核心订单/库存 API 高度集成。

---

## 2. 后端行业限制机制审计 (Backend Industry Guards)

审计确认，RUDA 的行业限制**并非仅靠前端隐藏菜单**，而是由后端 API 守卫强制执行。

### 2.1 强制限制逻辑
- **机制**：RUDA 将行业专属功能注册为“原生应用 (Native App)”。
- **守卫实现**：
  - `requireProductionAppInstalled` 守卫：在每个 `/api/production/*` 请求前，强制校验当前商家的 `AppInstallation` 状态是否为 `active`。
  - **越权防护**：如果商家未安装或已停用“智能生产链”应用，后端将直接返回 `403 PRODUCTION_APP_NOT_INSTALLED`，即使前端尝试调用也会被拦截。
- **证据**：[server.ts:19280](file:///www/wwwroot/ruda.fashion/server.ts#L19280)
- **结论**：**后端强限制已生效**。行业功能的安全边界是稳固的。

---

## 3. 生态应用商店专项排查 (App Store Diagnostic)

### 3.1 已开发应用位置
- **代码位置**：
  - **智能生产链** (`ruda-production-chain`)：后端路由见 `src/server/productionChain.ts`。
  - **邮箱域名配置** (`ruda-business-email`)：后端逻辑见 `src/server/merchantEmailDomain.ts`。
- **资产登记**：应用已在 `appStoreNativeRuntimes` 中登记，版本号为 `1.0.0`。
- **证据**：[appStoreValidation.ts](file:///www/wwwroot/ruda.fashion/src/server/appStoreValidation.ts)

### 3.2 总后台空白页故障诊断与修复
- **故障现象**：平台总后台“生态应用”页面显示空白或加载失败。
- **根因分析**：
  - `AdminAppStoreMgmt.tsx` 原先使用原生 `fetch` 而非封装的 `apiGet`。
  - 原生 `fetch` 无法自动处理跨域 URL 转换（admin 门户通常与 API 处于不同子域），且未包含必要的认证凭据，导致接口 401 或请求路径错误。
- **修复方案**：已将所有 API 调用重构为使用 `apiGet`/`apiPost`/`apiPut` 统一客户端。
- **证据**：[AdminAppStoreMgmt.tsx](file:///www/wwwroot/ruda.fashion/src/apps/platform-admin-common/components/admin/AdminAppStoreMgmt.tsx)

---

## 4. 正式开发顺序建议 (Final Recommendations)

1. **核心稳定化**：鉴于行业 API 守卫已就绪，应优先验证“智能生产链”在不同商户间的**数据绝对隔离性**（P0）。
2. **应用商店闭环**：利用已修复的平台总后台，完成“邮箱域名配置”应用的上线测试，作为生态扩展的首个标杆（P1）。
3. **功能激活**：目前大量功能为“B (基本完成)”，建议不要急于增加新菜单，而是通过补齐 POS 硬件适配和 AI 任务执行的真实日志，将 B 级功能提升为 A 级（P1）。

---
*RUDA 工程审计组 · 2026-10-29*

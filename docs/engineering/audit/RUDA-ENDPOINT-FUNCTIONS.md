
> **审计日期**：2026-10-29
> **审计师**：RUDA 全平台功能审计师 (Trae AI)
> **审计性质**：分终端运行面审计

---

## 1. 终端清单概览

RUDA 是一个多端协同的商业操作系统，覆盖了从消费者到平台管理者的全链路运行面。

| 编号 | 运行端名称 | 技术栈 | 核心职责 | 当前状态 |
| :--- | :--- | :--- | :--- | :--- |
| **EP01/02** | 公共前台 (Web/App) | React + Vite | 品牌展示、展厅导购、批发注册 | A |
| **EP03/04** | 商家后台 (Web/App) | React + Lucide | 经营管理、商品/订单/客户/财务 | B |
| **EP05** | 商家微信小程序 | 原生微信小程序 | 移动办公、实时通知、轻量操作 | B |
| **EP06** | 买家微信小程序 | 原生微信小程序 | 选品、下单、订单跟踪、ModaUI | B |
| **EP07/08** | 平台总后台 (Web/App) | React + Lucide | 商家审核、数据监控、AI 运营 | A |
| **EP09** | 员工端 (Mobile) | React (Shared) | 移动收银、报产、仓库作业 | B |
| **EP10** | ModaUI 独立应用 | React + Three.js | AI 设计、虚拟试衣、数字模特 | C |
| **EP11** | 商家独立网站 | React (Dynamic) | 商家专属二级域名店铺 | B |

---

## 2. 各终端详细功能审计

### 2.1 公共前台 (Public Frontend)
- **核心功能**：
  - [A] 首页 (HomeView)：推荐商家、热门品类展示。
  - [A] 展厅 (ShowroomsView)：按城市/行业查找商家。
  - [A] 批发注册 (WholesaleRegisterView)：潜在买家/商家入驻入口。
- **路径**：`src/apps/shared/components/frontend/`

### 2.2 商家后台 (Merchant Admin)
- **核心功能**：
  - [A] 经营主页 (Dashboard)：关键指标统计看板。
  - [B] 商品工作台：支持 SKU 矩阵、批量导入、图片管理。
  - [B] 订单履约：订单状态流转 (Pending -> Shipped -> Delivered)。
  - [B] 客户中心：客户分级、白名单管理。
  - [C] 营销中心：优惠券、活动配置。
- **路径**：`src/apps/merchant-admin-web/MerchantPortal.tsx`

### 2.3 微信小程序 (Mini-programs)
- **商家端 (EP05)**：
  - [B] 工作台 (Workspace)：扫码查货、快速开单。
  - [B] 消息中心：订单提醒、系统通知。
  - [A] 商家名片：Logo/联系方式/店铺码展示。
- **买家端 (EP06)**：
  - [B] 商品市场：分类浏览、全局搜索。
  - [B] 购物车与结算：支持 B2B 阶梯价计算。
  - [C] ModaUI：AI 设计交互入口。
- **路径**：`merchant-miniprogram/`, `miniprogram/`

### 2.4 平台总后台 (Platform Admin)
- **核心功能**：
  - [A] 商家管理 (MerchantCenter)：审核入驻、套餐授权。
  - [B] 数据监控 (BIDashboard)：全站 GMV、活跃度分析。
  - [A] 系统配置：权限 (RBAC)、IP 白名单、功能开关。
  - [B] 应用市场管理：App 发布与审核。
- **路径**：`src/apps/platform-admin-web/PlatformAdmin.tsx`

### 2.5 商家独立网站 (Merchant Storefront)
- **核心功能**：
  - [B] 专属店铺：`{slug}.ruda.fashion` 独立渲染。
  - [B] 风格模板：支持 `ecommerce_standard` 和 `luxury_black_gold` 切换。
  - [B] 商品透出：仅展示该商家已发布的公开商品。
- **路径**：`src/apps/shared/components/frontend/MerchantStoreView.tsx`

---

## 3. 跨端一致性审计发现

1. **数据源一致性**：[A] 所有终端均消费统一的 `/api/` 接口，数据库底层字段一致。
2. **状态同步**：[C] Web 端订单状态更新后，小程序端有时需手动下拉刷新才能看到变更。
3. **UI 适配**：[B] 商家后台 Web 版功能最全，手机版及小程序仅保留 P0 级操作项。

---
*RUDA 工程审计组 · 2026-10-29*
# RUDA 运行端功能清单 (RUDA ENDPOINT FUNCTIONS INVENTORY)

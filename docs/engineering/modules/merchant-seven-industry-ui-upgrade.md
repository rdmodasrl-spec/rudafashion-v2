# RUDA 七行业 Premium UI/UX 升级：第一阶段审计与优先级计划

- 文档状态：**部分完成** —— 代码盘点与计划已完成；逐页视觉核对待执行（本阶段按指令不修改生产页面）
- 日期：2026-10-31
- 范围：`merchant-admin-web`、`merchant-admin-mobile`、`merchant-admin-common`、`merchant-admin-industries`、`merchant-miniprogram`（商家端）
- 上游规则：`AGENTS.md` §5（UI 铁规）、§15.3（三端联动）、§15.5（七行业 UI 锁定）、§16（技能调用）
- 项目编号：**P1-ADMIN-UI**
- **项目边界**：本文件只覆盖「商家后台」的七个行业 UI/UX 高级化。商家私人独立网站的 21 套模板是**另一个独立项目**（`P2-STORE-TEMPLATES`，见 `merchant-21-storefront-templates.md`），Batch 0–5 不含任何网站模板任务，两个项目的验收不可互相替代。

---

## 1. 七行业识别（以代码为准，不自行定义）

唯一注册表：`src/constants/merchantIndustryTemplates.ts`；模块映射：`src/apps/merchant-admin-industries/registry.ts`；演示入口：`src/constants/merchantIndustryDemoAccounts.ts`（`?industryDemo=001..007`）。

| # | 行业（模板 id） | 中文名 | 入口 | 外壳 | 侧边栏版块 |
| --- | --- | --- | --- | --- | --- |
| 1 | `apparel_production_wholesale` | 服装生产批发商 | `/merchant` | **旧版 MerchantPortal（UI 基准）** | MerchantPortal 内联（9 大版块） |
| 2 | `apparel_wholesale` | 服装批发商 | 同上 | 行业工作区 | 经营首页 / 服装款式 / 现货库存 / 批发订单 / 客户 / 供应商 / 采购 / 团队权限 / 消息中心 / 设置 |
| 3 | `trading_wholesale` | 贸易批发商 | 同上 | 行业工作区 | 经营首页 / 贸易商品 / 采购单 / 供应商 / 库存 / 批发销售 / 客户 / 团队权限 / 消息中心 / 设置 |
| 4 | `department_wholesale` | 百货批发商 | 同上 | 行业工作区 | 经营首页 / 百货商品 / 仓储库存 / 采购单 / 供应商 / 批发订单 / 客户 / 团队权限 / 消息中心 / 设置 |
| 5 | `bags_wholesale` | 箱包批发商 | 同上 | 行业工作区 | 经营首页 / 箱包款式 / 箱包库存 / 批发订单 / 客户 / 供应商 / 采购 / 团队权限 / 消息中心 / 设置 |
| 6 | `department_chain_retail` | 百货连锁店 | 同上 | 行业工作区 | 经营首页 / 门店管理 / 门店商品 / 总部库存 / 库存调拨 / 门店收银 / 销售记录 / 班次历史 / 门店订单 / 客户 / 团队权限 / 消息中心 / 设置 |
| 7 | `general_retail` | 综合零售商 | 同上 | 行业工作区 | 经营首页 / 收银台 / 销售记录 / 班次历史 / 零售商品 / 零售库存 / 订单 / 客户 / 供应商 / 采购 / 团队权限 / 消息中心 / 设置 |

小程序端：`merchant-miniprogram/industries/` 已有 7 个行业配置文件，页面 19 个（dashboard / products / orders / pos / workspace / industry / ai-tools / ad-planner 等）。

## 2. 关键架构事实（决定升级策略）

1. **七个行业共用同一套外壳**：`MerchantAdminApp` → `MerchantPortal`（9 297 行）。六行业通过 `industryWorkspace` prop 注入工作区组件；服装生产批发商不注入（承接旧版，即 §15.5 的 UI 基准）。
2. **行业工作区是独立层**：`src/apps/merchant-admin-industries/`，32 个文件 5 229 行，其中 `shared/` 27 个文件（含 `kit.tsx` 251 行的共享组件层）。
3. **共享组件层集中在** `merchant-admin-common/components/merchant/`，44 个文件约 20 857 行（`MerchantAiHome` 2 476、`ModaUiAdPlanner` 2 099、`MerchantAiEmployees` 1 863 为最大三个）。
4. **没有 UI 组件库依赖**：`package.json` 中不存在 `@radix-ui/*`、`class-variance-authority`、`tailwind-merge`、`clsx`、`recharts`、`sonner`、`@tremor/react`。全部 UI 为手写 Tailwind v4。
5. 结论：**第二批（共享组件）改动可一次性覆盖 7 个行业；第三批（专属组件）才需要逐行业处理。** 这与「不能只升级公共组件」并不矛盾——公共层先把 24 项能力补齐，行业层再补业务化组合。

## 3. 共享组件清单（现状）

`src/apps/merchant-admin-industries/shared/kit.tsx`（唯一行业组件工具箱，251 行）：

| 导出 | 能力 | 状态 |
| --- | --- | --- |
| `formatMoney` / `formatCount` / `formatDate` | 数字与日期格式化 | 可用 |
| `Button` | 主/次/危险 | 可用 |
| `PageHeader` | 标题 + 说明 + 操作区 | 可用 |
| `SectionCard` | 区块容器 | 可用 |
| `KpiCard` / `KpiGrid` | KPI 卡片与栅格 | 可用（无趋势、无环比） |
| `StatusPill` | 5 种语义色标签 | 可用 |
| `DataTable` | 列定义 + 行点击 + 空文案 | **基础版**：无排序、无多选、无批量、无列宽持久化 |
| `EmptyState` | 标题 + 说明 + 操作 | 可用 |
| `SearchInput` | 单框搜索 | 可用（无高级筛选） |
| `FormField` / `inputClass` | 标签 + 必填 + 错误 + 帮助 | 基础版（无校验引擎、无多步） |
| `ErrorBanner` | 行内错误 + 关闭 | 可用 |
| `Modal` | 弹窗 + 页脚 | 可用（无 Drawer / BottomSheet） |
| `Pagination` | 页码 + 每页条数 | 可用 |
| `LoadingBlock` | 文本加载块 | **存在但在行业组件中零使用** |
| `TextLinkButton` | 文本按钮 | 可用 |

## 4. 24 项能力矩阵（共享层）

✅ 已具备 ｜ ⚠️ 部分 ｜ ❌ 缺失

| # | 能力 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | 行业 Dashboard | ✅ | 各行业 `index.tsx` 均有 经营首页 |
| 2 | KPI 数据卡片 | ✅ | `KpiCard`，但无趋势/环比 |
| 3 | 统计图表 | ❌ | 全仓无图表库，也无 SVG 图表组件 |
| 4 | 数据表格 | ⚠️ | `DataTable` 有骨架，缺排序/多选/批量/列设置 |
| 5 | 搜索组件 | ✅ | `SearchInput` |
| 6 | 高级筛选器 | ❌ | 只有单框搜索，无筛选条件组 |
| 7 | 日期选择器 | ❌ | 依赖原生 `input[type=date]` |
| 8 | 表单组件 | ⚠️ | `FormField` + `inputClass`，无统一校验与多步 |
| 9 | 商品/服务展示 | ✅ | `IndustryProductsSection` 等 |
| 10 | 详情页面 | ⚠️ | 以 Modal 承载，无独立详情布局 |
| 11 | 创建/编辑页面 | ✅ | `IndustryProductForm`（326 行） |
| 12 | Drawer | ❌ | 无 |
| 13 | Dialog | ✅ | `Modal` |
| 14 | Bottom Sheet | ❌ | 无（手机端缺失明显） |
| 15 | Toast / 通知 | ✅ | 全局 `NotificationToasts`（common 层） |
| 16 | 状态标签 | ✅ | `StatusPill` |
| 17 | 文件上传 | ✅ | `SmartMediaUploader`（common 层） |
| 18 | 图片管理 | ⚠️ | 上传可用，裁剪/排序/主图标记不完整 |
| 19 | Loading 状态 | ⚠️ | `LoadingBlock` 存在但**行业组件零使用**（扫描 `isLoading|animate-pulse|Skeleton` = 0） |
| 20 | Empty 状态 | ✅ | `EmptyState`，35 处文案 |
| 21 | Error 状态 | ✅ | `ErrorBanner` + 行内错误 |
| 22 | 权限不足状态 | ❌ | 行业组件 0 处（扫描 `无权限|permission|forbidden|403` = 0） |
| 23 | 移动端组件 | ⚠️ | 有独立手机外壳与 `mobileMode`，但无 BottomSheet / 移动表格方案 |
| 24 | 导航与操作反馈 | ✅ | 外壳导航（锁定）+ Toast |

**共享层覆盖率：13 / 24 = 54%**（✅ 计 1，⚠️ 计 0.5）。缺口集中在图表、筛选、日期、Drawer/BottomSheet、权限、表格进阶、加载。

## 5. 行业专属组件清单

六行业工作区共用 `shared/` 的版块组件，行业差异通过 `index.tsx` 组合 + `data.ts`（743 行，行业指标与文案）+ `manifest.ts`（侧边栏）体现：

| 行业 | 专属文件 | 专属业务点 |
| --- | --- | --- |
| 服装批发 | `apparel-wholesale/index.tsx`（116） | 款式/尺码/颜色/SKU/现货、批发订单 |
| 箱包批发 | `bags-wholesale/index.tsx`（115） | 箱包款式、箱包库存 |
| 贸易批发 | `trading-wholesale/index.tsx`（114） | 采购单、批发销售、贸易商品 |
| 百货批发 | `department-wholesale/index.tsx`（108） | 百货商品、仓储库存、采购单 |
| 百货连锁 | `department-chain-retail/{index 158, stores 243, transfers 212}` | **门店管理、库存调拨、门店收银、班次历史** |
| 综合零售 | `general-retail/index.tsx`（133） | **收银台、销售记录、班次历史** |
| 服装生产批发（基准） | `MerchantPortal.tsx` 内联 + `ProductionChain.tsx`（1 342） | 生产链、物料、工单、报产 |

共享版块组件（6 行业复用）：`IndustryProductsSection`（362）、`IndustryProductForm`（326）、`IndustryOrdersSection`（207）、`IndustryCustomersSection`（125）、`IndustrySuppliersSection`（99）、`IndustryMessageSection`（96）、`IndustryPosSection`（907）、`IndustrySettingsSection`（362）、`IndustryTeamSection`（21）、`IndustryDashboardParts`（86）。

**判断**：行业辨识度目前主要靠「侧边栏文案 + data.ts 指标名」，而不是「组件信息结构与数据展示方式」。这直接违反指令第三节「禁止七个行业只是换一套颜色」。这是第三批要解决的核心问题。

## 6. 质量指标扫描（行业工作区，代码级）

| 指标 | 数值 | 结论 |
| --- | ---: | --- |
| 文件数 / 行数 | 32 / 5 229 | — |
| `text-[8-11px]` | 9 | 少量残留（`IndustryPosSection` 6、`IndustryMessageSection` 3） |
| `rounded-full` | 1 | 良好 |
| `rounded-2xl` | 1 | 良好 |
| 加载态实现 | **0** | **P0 缺陷** |
| 权限态实现 | **0** | **P0 缺陷** |
| 空状态 | 35 处 | 良好 |
| 错误处理 | 293 处 | 良好（多为错误文案/分支） |

对照旧外壳 `MerchantPortal`（行业 1 基准）：2 099 行仪表盘内 `text-[10px]/[11px]` 密集，2026-10-31 已做一轮整治（见 `merchant-seven-industry-acceptance.md` §7）。

## 7. 重复与缺口

**重复实现（需收敛到 `kit.tsx`）**

1. 各行业 `index.tsx` 各自手写 KPI 数字块与列表样式（未统一用 `KpiGrid`）。
2. `IndustryPosSection`（907 行）与 `MerchantSmartPos`（1 374 行）存在两套 POS 交互。
3. 门店收银（`department-chain-retail`）与综合零售收银台（`general-retail`）各自实现，未共用 `IndustryPosSection` 的成熟部分。
4. 空/错误/加载三种状态在旧外壳与新工作区是两套写法。

**缺口**

- 无图表能力 → 所有行业只能展示数字，无法呈现趋势。
- 无批量操作/多选 → 商品、订单、库存的批量处理只能逐条。
- 无权限态 → 员工权限受限时页面表现未定义。
- 无 BottomSheet → 手机端编辑仍是整页跳转或 Modal。
- 无高级筛选 → 大列表只能靠搜索框。

## 8. 依赖与许可证评估（重点：不新增未批准依赖）

| 资源 | 形态 | 许可证（实测） | React 19 / Tailwind v4 | 结论 |
| --- | --- | --- | --- | --- |
| shadcn/ui | 复制式代码，非包 | MIT（组件代码），依赖 Radix MIT / CVA Apache-2.0 / tailwind-merge MIT / clsx MIT | Radix 支持 React 19（`^16.8 \|\| ^17 \|\| ^18 \|\| ^19`） | **仅借鉴结构**；如引入需批准 4 个依赖 |
| Magic UI | 组件 registry | MIT | 需 `motion`（已装 v12） | 借鉴动效写法，不整包引入 |
| Aceternity UI | 组件 registry | MIT（逐组件核验） | 依赖 `framer-motion`/`motion` | **不采用**：装饰性动效与 RUDA「克制」冲突 |
| Tailwind Plus | 付费模板 | **商业许可（按席位付费）** | Tailwind v4 兼容 | **不采用**：需采购，且是整页模板 |
| Untitled UI | 免费+Pro | 免费版 MIT-ish / Pro 商业 | React 19 部分 | **不采用**：整页模板，与既有设计系统冲突 |
| React Bits | 组件 registry | MIT | 需 `motion` | 借鉴文本/交互组件写法 |
| ReUI | 组件 registry | MIT | shadcn 衍生 | 借鉴 DataTable 交互 |
| **Tremor** | npm 包 | Apache-2.0 | **peer 要求 React ^18，不支持 19** | **明确拒绝**（除非降级 React） |
| Storefront UI | npm 包 | MIT | React 19 ✓，但自带设计令牌与 Tailwind 预设 | **拒绝安装**：与 RUDA 令牌冲突；只借鉴商品卡结构 |
| 21st.dev | 组件 registry | 逐组件不同 | 视组件 | 逐条核验后再考虑 |

**本轮结论**：不新增任何运行时依赖。图表用零依赖 SVG 组件实现；交互原语（Drawer/BottomSheet/Popover）用现有 Tailwind + 少量原生 API（`<dialog>`、`showModal`、`IntersectionObserver`）实现。若后续确需 Radix，单独提交 ADR 并取得批准。

## 9. 优先级计划（分 5 批，逐批验收）

### Batch 0 · 缺陷止血（P0，预计 0.5 天）

- 行业组件补加载态（骨架，不用转圈）。
- 行业组件补权限不足态（复用现有角色判定，服务端仍为权威）。
- 清理 `IndustryPosSection` / `IndustryMessageSection` 的 9 处 <12px。
- 修复剩余裂图（商家 Logo 类）。
- 门禁：`tsc` + `unit` + 截图。

### Batch 1 · 共享组件能力补齐（P1，预计 2–3 天，覆盖 7 行业）

按 §4 缺口，全部落在 `merchant-admin-industries/shared/kit.tsx` + 新文件：

1. `Skeleton` / `TableSkeleton` / `CardSkeleton`
2. `Drawer`（桌面右侧）+ `BottomSheet`（手机底部，含安全区）
3. `FilterBar`（条件组 + 已选标签 + 清空）
4. `DateRangePicker`（原生 date + 快捷区间，不引依赖）
5. `DataTable` 升级：排序、行多选、批量操作条、列宽、粘性表头
6. `TrendChart` / `SparkLine`（纯 SVG，无依赖）
7. `PermissionState`（无权限视图 + 申请入口）
8. `CommandPalette`（`⌘K`，复用现有路由与搜索）
9. `Tooltip` / `Popover`（原生 + 定位计算）
10. `MultiStepForm`（步骤条 + 校验汇总）

### Batch 2 · 数据展示专业化（P1，预计 2 天）

- KPI 卡增加环比与迷你趋势。
- Dashboard 增加「趋势 / 结构 / 对比」三类图。
- 订单与库存列表接入新 DataTable（排序、批量、导出交互）。
- 导出为 CSV（前端生成，服务端权限不变）。

### Batch 3 · 七行业专属组件（P2，逐行业 1–2 天）

每个行业按「业务对象 → 信息结构 → 专属组件」重做信息编排，**不改外壳**：

| 行业 | 专属升级重点 |
| --- | --- |
| 服装生产批发（基准） | 生产链改为阶段看板 + 物料缺口表 + 工单进度时间线 |
| 服装批发 | 款式矩阵（颜色 × 尺码 × 库存热区）+ 配码下单 |
| 箱包批发 | 材质/尺寸/五金规格表 + 箱规计算器 |
| 贸易批发 | 采购单-供应商-到货 三段状态流 + 汇率/成本对比 |
| 百货批发 | 品类树 + 仓储位 + 补货建议 |
| 百货连锁 | 门店对比矩阵 + 调拨单时间线 + 班次对账 |
| 综合零售 | 收银台键盘流 + 销售热力时段 + 班次交接 |

### Batch 4 · 移动端（P1，预计 1.5 天）

BottomSheet 编辑、移动表格（卡片化 + 横向滚动）、底部操作栏、触控 44px、安全区、页面切换过渡。

### Batch 5 · 逐行业验收（P0，每行业 0.5 天）

每行业 × Web/Mobile（小程序适用时）× 角色（店主/员工/受限）× 数据状态（有/空/错/无权限），留证到 `docs/engineering/evidence/`。

## 10. 每行业验收清单（模板）

```
行业：__________   模板 id：__________
[ ] Web 1440 / 1024   截图：____
[ ] Mobile 390        截图：____
[ ] 小程序（适用）     截图：____
[ ] 角色：店主 / 员工 / 受限员工
[ ] 状态：正常 / 空 / 错误 / 无权限 / 加载
[ ] 关键交互：__（下单、调拨、收银、报产…）
[ ] 外壳未变：顶部栏 / 侧边栏层级 / 主内容宽度 / AI 助手栏
[ ] tsc / unit / build / impeccable detect 全绿
[ ] 无新增依赖，或已附 ADR
```

## 11. 覆盖率与完成定义

- 当前共享层覆盖率：**54%**（13/24）。
- Batch 1+2 完成后预计：**92%**（22/24，剩余「图片裁剪」与「移动表格」在 Batch 4 补齐）。
- 项目完成定义：**七个行业各自通过 §10 清单**，且共享层 24 项无 ❌。只完成共享组件的行业不计为完成。

## 12. 风险与门禁

| 风险 | 控制 |
| --- | --- |
| 改共享 `kit.tsx` 影响 7 行业 | 每次只加不改签名；旧调用点全部保留；`tsc` + 逐行业截图 |
| `MerchantPortal` 9 297 行误改外壳 | 只改内联区块，不动 Shell/侧边栏/助手栏；diff 逐行自查 |
| 引入组件库破坏设计系统 | 本批零依赖；如需 Radix 走 ADR |
| 图表性能 | 纯 SVG，最多 30 个数据点，不做动画滚动 |
| 演示登录限流影响验收 | 30 次/15 分钟；验收前预留账号或分批取图 |

## 13. 下一步

批准后按 Batch 0 → 1 → 2 → 3 → 4 → 5 执行；每批单独提交、可回滚，每批完成后提交截图与测试报告。

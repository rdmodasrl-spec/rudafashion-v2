# 商家后台电脑端导航与「应用 / 聊天记录 / 最近动态」

- 日期：2026-10-30
- 适用运行面：**仅商家后台电脑网页端** `src/apps/merchant-admin-web`（入口 `src/apps/merchant-admin-web/main.tsx`，共享层 `src/apps/merchant-admin-common`）
- 明确不在本次范围：商家手机网页端 `merchant-admin-mobile`、商家小程序 `merchant-miniprogram`、平台总后台、买家端。用户于 2026-10-30 明确要求「现在说的是电脑端，不是手机」，因此三端导航结构在本轮**保持原样**，不做联动修改；本条属于 `AGENTS.md` §15 的显式范围收窄记录，不是遗漏。

## 1. 问题与目标

电脑端左侧导航目前是历史累积结构：顶部黑色横栏用 `RUDA / 企业中心` 品牌占位，左侧栏按「主页 / 商品库存 / 客户 / 增长 / 店铺内容 …」混合分组，底部还挂着「切换手机端」。带来三个问题：

1. 顶部看不到当前商家是谁，多商家登录后容易误操作。
2. 一级导航数量与分组不稳定，次要能力（内容、素材、生产、采购）与主要业务混排，AI 相关入口分散。
3. 已有真实能力没有入口：应用商店在导航里只有单点、已归档商品无处查看（回收站缺失）、AI 对话记录只能在助手面板里按页面上下文翻、「最近动态」完全没有。

目标：

1. 电脑端左侧导航定型为 **14 个一级入口**：业务 9 项、应用与记录 3 项、底部固定 2 项。
2. 顶部品牌位改为**真实商家公司名称**（`Merchant.companyLegalName`，缺省回退 `Merchant.name`），不再显示 RUDA 占位。
3. 交付三个真实功能：**应用（应用商店 / 回收站）**、**AI 聊天记录**、**最近动态**；数据全部来自既有权威表，不用演示数据补齐。
4. 视觉收敛到现有高级黑白/中性灰：侧栏白底、选中浅灰、无彩色高亮。

非目标：

- 不新增登录、权限、商品、订单、会话等第二套体系。
- 不重做首页、不改 AI 助手栏位置与交互、不改订单/商品业务规则。
- 不改手机 Web / 小程序导航（用户显式收窄范围）。
- 不做「最近动态」的实时推送；刷新以页面操作为准。

## 2. 防重复检查（`AGENTS.md` §3.7 必填）

| 项目 | 结论 |
|---|---|
| 已搜索关键字/目录 | `MerchantPortal.tsx` 的 `navItemClass`、`settingsSubItemClass`、`merchant-sidebar-*`；`merchantMobileNavigation.ts`；`AppStore.tsx`；`appInstallation`；`employeeAuditLog`；`orderChainEvent`；`inventoryMovement`；`merchantAssistantConversation`；`lifecycleStatus: 'archived'` |
| 直接复用 | 侧栏骨架与折叠状态（`sidebarNavExpanded`）、`MerchantAppStore`、`MerchantAiEmployees`、AI 助手查询链路 `/api/merchant/assistant/query`、员工审计表 `EmployeeAuditLog`、库存流水 `InventoryMovement`、订单 `timeline`、商品归档 `Product.lifecycleStatus='archived'` |
| 现有方案不足的证据 | ① 应用商店只有一级入口，回收站无任何页面/接口（`PRODUCT_ARCHIVE` 只写审计）；② 会话列表接口 `GET /api/merchant/assistant/conversations` 按 `context:scope` 过滤，无法跨上下文检索历史；③ 没有任何「最近动态」聚合接口，页面只能逐模块看 |
| 为什么需要新增 | 上述三项需要在**服务端**做跨表聚合与跨上下文会话读取，前端无法用既有接口正确实现；不新增则只能造假数据 |
| 如何避免形成第二套权威 | 新增接口全部只读聚合既有表（`Product`/`InventoryMovement`/`Order`/`EmployeeAuditLog`/`MerchantAssistantConversation`），不新建表、不写副本；恢复商品复用 `Product.lifecycleStatus` 单一字段；会话继续对话仍走既有 `/api/merchant/assistant/query` |

## 3. 电脑端导航结构（14 项）

分组只做视觉分隔（细分隔线），不新增分组标题文案。四字规则按 `AGENTS.md` §5.2 执行。

| # | 分组 | 中文 | 意大利语 | 目标（`activeTab`） | 展开子项 |
|---|---|---|---|---|---|
| 1 | 业务 | 经营主页 | Home | `dashboard`（home） | 经营分析 |
| 2 | 业务 | 订单履约 | Ordini | `orders` | 智能收银（`pos`）；角标＝待处理订单数 |
| 3 | 业务 | 商品管理 | Prodotti | `products` | 商品列表 / 店铺分类 / 款式规格 |
| 4 | 业务 | 库存管理 | Giacenze | `inventory` | 库存台账 / 物料库存 / 生产工单 / 采购订单 |
| 5 | 业务 | 客户管理 | Clienti | `customers` | 授权申请（角标＝待处理授权） |
| 6 | 业务 | 营销增长 | Crescita | `growth` | 增长概览 / 智能运营 / 营销活动 |
| 7 | 业务 | 创作空间 | Studio ModaUI | `fashion_studio` | —（`modauiEnabled=false` 时隐藏） |
| 8 | 业务 | 店铺内容 | Contenuti | `content` | 店铺预览（外链）/ 内容对象 / 菜单管理 / 博客文章 / 内容页面 / 内容素材 / 店铺设置 |
| 9 | 业务 | 财务结算 | Pagamenti e saldo | `finance` | — |
| 10 | 应用与记录 | 应用 | App | `app_store` | **应用商店** / **回收站**（`recycle_bin`） |
| 11 | 应用与记录 | AI 聊天记录 | Cronologia AI | `ai_chat_history` | — |
| 12 | 应用与记录 | 最近动态 | Attività recenti | `recent_activity` | — |
| 13 | 底部固定 | 智能员工 | Team AI | `ai_employees` | — |
| 14 | 底部固定 | 系统设置 | Impostazioni | `settings` | — |

四字命名例外（按 `AGENTS.md` §5.2 登记）：`应用`、`回收站`、`AI 聊天记录` 为用户指定的入口名称，不凑四字；其余一级入口与子项均为四字。

子项归属说明：`智能收银` 从一级入口下沉为「订单履约」子项，`库存管理`、`物料库存`、`生产工单`、`采购订单` 归入「库存管理」子项，`内容素材`、`店铺设置`、`店铺预览` 归入「店铺内容」子项——均保留原能力，不删减功能。

窄屏（`lg:hidden`）水平导航同步**新增** `AI 聊天记录`、`最近动态`、`回收站` 入口，保证同等可达；该水平导航仍属于电脑端应用的窄屏形态，不是手机 Web 应用导航。

已删除入口：`切换手机端`（`navigateToAppTarget('merchant-admin-mobile')`）。手机 Web 仍可通过自身 URL 直接访问。

## 4. 顶部品牌

- 左侧固定宽度区域显示 `currentMerchant.companyLegalName || currentMerchant.name`，单行截断，完整值放在 `title` 与 `aria-label`。
- 保留原有搜索、店铺前台、店铺预览、通知、GPTmoda 按钮；不新增品牌装饰。
- 公司名过长时截断而不换行，禁止挤压搜索框（`min-w-0` + `truncate`）。

## 5. 新增能力与 API 契约

所有接口均使用 `requireMerchantTenant`，`merchantId` 只取自已验证的商家 JWT，不接受客户端传入的 `merchantId`。

### 5.1 `GET /api/merchant/activity`

- 用途：当前商家的最近业务动态聚合（只读）。
- 权限：`requireMerchantTenant` + `requireAnyEmployeePermission('sales.order.create','product.publish','production.report')`（员工至少具备一项业务读权限；商家本人不受限）。
- 查询参数：`limit`（1–100，默认 40）。
- 数据来源（并行查询，各取 `limit` 条）：
  - `Product`：创建（`createdAt`）与更新（`updatedAt`，与创建相差 < 60 秒时视为创建，避免重复）。
  - `InventoryMovement`：`merchantId` 命中，关联变体与商品，校验 `variant.product.merchantId === merchantId`。
  - `Order`：`merchantId` 命中，取 `timeline` 最后一条作为状态/节点事实，时间缺失时回退 `updatedAt`。
  - `EmployeeAuditLog`：`entityType='App'` 且 `action ∈ {APP_INSTALLED, APP_ENABLED, APP_DISABLED, APP_UNINSTALLED}`，`metadata.appId` 解析应用名。
- 响应：`{ success: true, generatedAt, activities: [{ id, type, category, occurredAt, data, target }] }`，按 `occurredAt` 倒序、`id` 兜底排序后截断。
  - `type`：`product_created` | `product_updated` | `inventory_changed` | `order_updated` | `app_installed` | `app_enabled` | `app_disabled` | `app_uninstalled`
  - `target`：`{ tab, productId?, orderId?, search? }`，用于前端跳转到对应业务页。
- 错误：`401 MERCHANT_AUTH_REQUIRED`、`403 EMPLOYEE_PERMISSION_REQUIRED`、`500`（内部错误，不返回堆栈）。
- 幂等：只读，无副作用。

### 5.2 `GET /api/merchant/recycle-bin`

- 用途：回收站列表，当前被归档的商品。
- 权限：`requireMerchantTenant` + `requireAnyEmployeePermission('sales.order.create','product.publish','production.report')`，与 `GET /api/merchant/products` 对齐。
- 查询参数：`search`（款式号/名称，可选）、`limit`（1–100，默认 50）。
- 数据来源：`Product` 中 `merchantId` 命中且 `lifecycleStatus='archived'`，`orderBy updatedAt desc`。
- 响应：`{ success: true, products: [{ id, styleNo, name, category, images, archivedAt, lifecycleStatus }] }`。

### 5.3 `POST /api/merchant/recycle-bin/products/:id/restore`

- 权限：`requireMerchantTenant` + `requireEmployeePermission('product.publish','store_manager')` + `requireMerchantProductEditingEnabled()`。
- 行为：仅 `lifecycleStatus='archived'` 的商品可恢复，恢复为 `draft`（**不自动上架**，避免绕过发布流程）；重复调用返回 409 `RECYCLE_BIN_PRODUCT_NOT_ARCHIVED`；跨租户 404 `PRODUCT_NOT_FOUND`。
- 审计：`logAudit(merchantName, 'merchant', 'PRODUCT_RESTORED', 'Product', id, 'archived', 'draft')`。
- 响应：`{ success: true, product: { id, lifecycleStatus } }`。

### 5.4 `GET /api/merchant/assistant/history`

- 用途：跨页面上下文的 AI 会话列表（仅当前商家 + 当前操作者）。
- 权限：`requireMerchantTenant`（与既有 `/api/merchant/assistant/conversations` 一致，仅本人可见）。
- 查询参数：`search`（标题或消息内容模糊匹配，不区分大小写）、`limit`（1–50，默认 30）。
- 响应：`{ success: true, conversations: [{ id, title, updatedAt, messageCount, lastMessage, lastContext }] }`。
- 与既有会话列表的区别：不按 `context:scope` 过滤；不新增表。

### 5.5 `GET /api/merchant/assistant/history/:id`

- 用途：查看某会话的完整对话（跨上下文），供「AI 聊天记录」详情与继续对话。
- 权限：`requireMerchantTenant` + `actorId` 匹配；跨商家/跨操作者 404 `ASSISTANT_CONVERSATION_NOT_FOUND`。
- 响应：`{ success: true, conversation: { id, title, updatedAt }, messages: [{ id, role, content, context, createdAt }] }`，最多 200 条，按时间正序。

### 5.6 继续对话（复用既有 `POST /api/merchant/assistant/query`）

- 新增可选入参 `includeFullHistory: boolean`：为 `true` 时，服务端把该会话**所有上下文**的历史消息纳入模型上下文；不传时保持原行为（只取当前 `context:scope`）。
- 其余规则不变：`Idempotency-Key`、限流、订阅额度、ModaUI 开关、审计与用量记录全部沿用。
- 前端在「AI 聊天记录」详情里继续对话时，带 `conversationId` + 该会话最后一条消息的 `context` + `includeFullHistory: true`。

## 6. 权限与租户边界

| 能力 | 商家本人 | 员工 |
|---|---|---|
| 最近动态 | 可读（全部为自己商家数据） | 需要 `sales.order.create` / `product.publish` / `production.report` 之一 |
| 回收站列表 | 可读 | 同上 |
| 回收站恢复 | 可写 | 需要 `product.publish`；且商家未开启商品编辑锁 |
| AI 聊天记录 | 可读自己的会话 | 只读自己的会话（`actorId`） |
| 继续对话 | 可用 | 受既有 ModaUI 开关/额度/限流约束 |

所有查询都带 `merchantId`（会话另加 `actorId`），日志与响应不包含其他商家数据。

## 7. 界面状态与错误处理

| 页面 | 加载 | 空 | 错误 | 无权限 |
|---|---|---|---|---|
| 最近动态 | 骨架行 | 「暂无动态」 | 错误说明 + 重试按钮 | `403` 提示「无权限查看动态」 |
| 回收站 | 骨架行 | 「回收站为空」 | 错误说明 + 重试 | 列表 403 提示；恢复 403 提示「无权限恢复商品」 |
| AI 聊天记录 | 列表骨架 + 详情占位 | 「暂无聊天记录」；搜索无结果「没有匹配的聊天」 | 列表/详情分别提示 + 重试 | 401 由既有客户端统一跳登录 |
| 继续对话 | 发送中禁用输入 | — | 行内失败提示，保留用户输入 | 提示该功能未开放 |

- 所有可点击行提供 `aria-label`，键盘可聚焦；时间显示相对时间并提供完整时间 `title`。
- 不展示任何内部堆栈或数据库信息。

## 8. 复用与影响范围

| 文件 | 变更 |
|---|---|
| `src/apps/merchant-admin-web/MerchantPortal.tsx` | 顶部公司名、侧栏 14 项结构、选中态中性色、移除「切换手机端」、接入三个新面板与水平导航新增项 |
| `src/apps/merchant-admin-common/components/merchant/MerchantActivityFeed.tsx` | 新增：最近动态 |
| `src/apps/merchant-admin-common/components/merchant/MerchantAiChatHistory.tsx` | 新增：AI 聊天记录 |
| `src/apps/merchant-admin-common/components/merchant/MerchantRecycleBin.tsx` | 新增：回收站 |
| `src/i18n/uiCopyCatalog.ts` | 新增本轮文案词条 |
| `server.ts` | 5 个新接口 + `includeFullHistory` 可选参数 |
| `tests/merchant-admin-desktop-navigation.test.ts` | 新增：导航结构、四字标签、公司名、接口契约静态检查 |

不改动：`merchant-admin-mobile`、`merchant-miniprogram`、数据库 schema（无迁移）、订单/商品/权限规则。

## 9. 测试与验收

自动化：

1. `npm run lint`（`tsc --noEmit`）。
2. `npm run test:unit`：新增桌面导航测试 + 既有 `merchant-mobile-navigation`、`ui-translation-copy` 等。
3. `npm run build:app:merchant-admin-web`。
4. `.agents/skills/impeccable/scripts/impeccable detect src/apps/merchant-admin-common/components/merchant src/apps/merchant-admin-web`。

真实页面验收（登录商家会话后）：

1. 1440×900：顶部显示公司法定名称；左侧 14 项（ModaUI 关闭时 13 项）；底部固定「智能员工 / 系统设置」；无「切换手机端」。
2. 点击「应用 → 应用商店 / 回收站」分别进入既有应用商店与回收站；回收站恢复后商品回到「商品管理 → 商品列表（草稿）」。
3. 「AI 聊天记录」能搜索、查看完整对话、继续对话并收到真实模型回复。
4. 「最近动态」显示真实商品/库存/订单/应用事件，点击可跳转到对应页面。
5. 用第二个商家账号验证看不到第一家商家的任何动态、会话或回收站商品。
6. 1024 宽与窄屏水平导航：新增三项可达，无横向溢出。

未取得真实登录截图时，相关条目只能标记「代码检查完成，视觉待验收」。

## 10. 回滚

- 代码：`git revert` 本次提交即可恢复旧导航；不含数据库迁移，无数据回滚。
- 新增接口均为只读聚合 + 一个字段状态写回（`lifecycleStatus`），回滚后既有商品/订单/会话数据不受影响。
- 若「最近动态」接口造成查询压力，可先在前端下线入口（`recent_activity` 项），接口无外部依赖。

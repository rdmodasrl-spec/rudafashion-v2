# 商家手机端导航与消息中心

状态：部分完成（消息中心、ModaUI 默认隐藏导航/细拖柄/9 项分组菜单/四个常驻快捷胶囊已在电脑 Web、手机 Web 与生产真实会话验收；套餐目录已修复上线；小程序视觉与真机触控仍待验收）

## 1. 问题与目标

商家手机端（`merchant-admin-mobile`）首页右上角现有两个圆形图标：AI 助手与一个“订单提醒”铃铛。铃铛点击后跳到订单页，既不展示真实未读消息，也不能查看系统通知、授权/库存类消息；AI 入口位于顶部工具栏，无法在其他页面直接回到助手。

目标：

- 右上角只保留一个消息图标，点击进入统一消息中心，展示当前商家的真实消息（系统通知、订单消息、库存/商品提醒及其他已有业务通知）。
- 消息图标显示真实未读数；无未读时不显示徽标。
- 修复原铃铛跳转到订单页的错误逻辑，“更多 → 通知中心”也进入同一消息中心，不再跳到“经营设置”。
- AI 助手入口移到底部导航中间，名称固定为 `ModaUI`；点击进入既有 `MerchantAiHome`，不新建 AI 页面。

非目标：

- 不新增消息表、消息接口、消息订阅或推送通道；只使用既有 `NotificationEvent` 与既有接口。
- 不改微信小程序页面（`merchant-miniprogram/pages/dashboard`、`pages/workspace?id=notifications` 已是同一用途，作为内容基准）。
- 不改电脑端 `MerchantPortal` 的通知设置页与侧栏导航。
- 不新增“标记已处理/删除消息”能力（后端只有读取与已读接口，详见 §4）。
- 不改变首页其他区块、更多页其他入口与订单业务逻辑。

## 2. 防重复检查（新增前置）

| 能力 | 现有实现 | 结论 |
|---|---|---|
| 通知数据 | 服务端 `GET /api/merchant/notifications`（`NotificationEvent`，`channel='in_app'`、`status='sent'`，按商家 `contactEmail` 过滤，返回 `unread` + 最近 100 条） | 直接复用，不新增接口或缓存表 |
| 已读 | `POST /api/merchant/notifications/:id/read`（按 `recipient` 限定商家） | 直接复用；不新增“全部已读”接口 |
| 读取组件 | `MerchantNotificationBell`（共享，下拉式，含轮询与未读计算） | 抽取数据逻辑为共享 hook，铃铛与消息中心共用一份实现，避免两套轮询/未读口径 |
| 消息中心（手机） | 无。原铃铛跳订单页；“更多 → 通知中心”跳“经营设置-运营” | 新增手机端消息中心视图，同时修正两处错误跳转 |
| 小程序消息 | `merchant-miniprogram/pages/workspace?id=notifications`：标题取 `payload.title`（缺省“商家通知”），副文案 `未读/待处理/重要 + payload.message|body + 时间`，筛选 全部/未读/待处理 | 作为内容口径基准，不修改小程序 |
| AI 助手 | `MerchantAiHome`（共享，`ai_home` 视图，含 ModaUI 品牌、会话、创作、知识库） | 直接复用；仅改变入口位置，不改组件 |
| 底部导航配置 | `merchantMobilePrimaryTabs`（4 项） | 扩展为 5 项并把 `ai_home` 放在正中；移除“更多 → 智能工具”里的重复 AI 入口 |
| 其它通知中心 | `PWANotificationsCenter`（未被任何页面引用，面向买家推送权限） | 不复用、不修改，避免把买家推送状态引入商家端 |

检索关键字：`/api/merchant/notifications`、`MerchantNotificationBell`、`notificationEvent`、`通知中心`、`ai_home`、`merchantMobilePrimaryTabs`、`ModaUI`。

## 3. 导航结构

底部导航（5 项，从左到右）：

| 顺序 | id | 中文 | 意大利语 | 图标 | 说明 |
|---|---|---|---|---|---|
| 1 | `dashboard` | 首页 | Home | Home | 原有 |
| 2 | `products` | 商品 | Prodotti | Package | 原有 |
| 3 | `ai_home` | ModaUI | ModaUI | Sparkles | 新增，位于正中，进入既有 AI 助手 |
| 4 | `orders` | 订单 | Ordini | Truck | 原有，保留待处理徽标 |
| 5 | `more` | 更多 | Altro | Ellipsis | 原有 |

规则：

- `ModaUI` 是产品规定的固定名称，属于“导航名称四个汉字”规则的**登记例外**（与小程序 ModaGPT 品牌一致），中/意两语均显示 `ModaUI`；`merchantMobileMoreGroups` 内的分组与条目仍保持四字规范。
- `ai_home` 不再出现在“更多 → 智能工具”，避免同一功能出现两个入口；“智能员工”保留。
- `MerchantAiHome` 仍在全屏层（`fixed`，`z-[60]`）内渲染；商家底部导航在 `ai_home` 时默认隐藏（`translate-y-full` + `pointer-events-none` + `aria-hidden`），由输入框下方 3px 细拖柄点击或上下拖动展开/收起，导航层级为 `z-[70]`。
- 拖柄是唯一开关：`aria-expanded` 反映展开状态，`aria-controls="merchant-bottom-navigation"` 指向真实导航；输入框获得焦点时自动收起，避免键盘与导航叠加。展开时 AI 内容区底部让出导航高度，收起时让出 `visualViewport` 键盘 inset；安全区内边距统一用内联 `style={{ paddingBottom: 'max(...)' }}` 计算，不再使用 `pb-[max(...)]` 任意值类，避免构建后失效。
- 快捷胶囊行末尾的圆形“创作设置”按钮（`SlidersHorizontal`，`aria-label="创作设置"`，`aria-expanded` 绑定 `modeSheetOpen`，仅在当前创作模式带设置项时出现）打开底部设置面板：`role="dialog"`、`aria-modal="true"`、标题“创作设置 / Impostazioni creazione”、`max-h-[78%]` 且 `overscroll-contain`，底部留安全区，右上角“完成 / Fatto”关闭；点击遮罩、`Escape` 或再次点击按钮关闭。
- 三点菜单中的“执行任务 / Esegui attività”是 `role="menuitemcheckbox"` + `aria-checked` 的勾选项，勾选态显示黑底白色对勾方块与“已开启 / Attivo”角标；开启后输入框占位文案切换为任务描述文案，并在输入框上方显示可关闭的“任务模式 / Modalità attività”胶囊（`aria-label="关闭任务模式"`，点击即退出任务模式）。任务模式与创作模式互斥：开启任务模式会清空 `fashionMode` 并关闭设置面板；点击任一快捷胶囊或菜单创作项会先 `setTaskMode(false)`，避免“胶囊显示虚拟试衣、发送却走任务预览”的状态冲突。
- 顶部右侧只保留一个竖排三点菜单，点击打开右对齐紧凑面板（分组：对话 2 项 / 创作工具 4 项 / 其他 3 项，共 9 项；`max-h-[min(calc(100dvh-88px),520px)]`，244px 宽；标准 390×844 下 `scrollHeight=394 / clientHeight=394`，无内层滚动，最后一项“退出登录”可见）。点击遮罩、按 `Escape` 或选择任一条目后关闭；不再使用整屏抽屉；标题居中显示当前分区名称。
- 输入框上方固定四个等宽快捷胶囊（服装设计 / 图片生成 / 虚拟试衣 / 设计灵感），不再只在空会话显示；采用 4 列网格，320px 宽度下每项仍完整可见（实测 12–101、105–193、197–286、290–378，无横向溢出）。重复的核心创作入口不再放进三点菜单。当前创作模式带设置项时，胶囊行末尾追加一个圆形“创作设置”按钮（图标按钮、无文字），此时四个胶囊改为纯文字、隐藏前置图标以保留可读宽度：320px 下实测行宽 296=296，四胶囊各 60px 加 32px 设置按钮，标签完整显示且无横向溢出。
- 历史抽屉可见标题与无障碍名称统一为“聊天历史 / Cronologia chat”。
- 电脑网页端复用同一组件；宽度在 `lg` 断点扩展到 880px，不再以 430px 手机宽度居中显示，菜单、消息与输入区保持同一内容宽度上限。
- AI 页返回（`onExit`）回到进入前的页签（`copilotOriginTabRef`），不再固定跳“店铺”。
- POS 全屏收银仍隐藏底部导航与页面头部。
- 小程序 `pages/assistant` 采用同一信息结构：左返回、中标题、右更多菜单，底部输入区下缘提供细拖柄；进入页面默认隐藏自定义 tab bar（`custom-tab-bar.setHidden(true)`，原生 tab bar 作为回退），拖柄展开时显示，离开时恢复。菜单分组为“对话 / 创作工具 / 其他”，行高 68rpx、面板 `max-height: 70vh`；有消息且未激活创作模式时，输入区上方显示四个等宽快捷胶囊（服装设计 / 图片生成 / 虚拟试衣 / 设计灵感）。拖柄为整行按钮（`.nav-handle` 高 64rpx，约 32px 触控高度，细杠 64rpx×6rpx），支持点击与上下拖动：`onNavTouchStart` 记录起点，`onNavTouchEnd` 判断纵向位移，超过 18px 才调用 `setNavigationOpen(delta > 0)`，拖动过程不切换状态；`navigationOpen` 变化同时驱动 `setHidden`，避免拖拽中反复开合。该页当前仍因审核开关不注册，故不出现第二套导航。

## 4. 消息中心

数据来源：`useMerchantNotifications`（`src/apps/merchant-admin-common/components/merchant/merchantNotifications.ts`）。

- 请求：`GET /api/merchant/notifications`（商家会话，服务端按 `contactEmail` 隔离）。
- 轮询：页面可见时每 30 秒刷新；首页或消息中心打开时才启用，避免常驻请求。
- 已读：`POST /api/merchant/notifications/:id/read`，成功后本地更新 `readAt` 并把未读数减一。
- 后端**没有** `/resolve` 与批量已读接口，因此不提供“标记已处理”“全部已读”，也不伪造状态；原共享铃铛中对 `/resolve` 的调用一并移除（该路由在 `server.ts` 中不存在）。

字段与展示：

- 标题：`payload.title`；缺失时按分类兜底文案（订单消息 / 库存提醒 / 系统通知 / 业务通知）。
- 正文：`payload.message` → `payload.body` → `payload.description`，均缺失时不显示正文行。
- 时间：`createdAt` 按当前语言 `getIntlLocale` 格式化。
- 分类标签由 `eventType` 推导：订单/履约/付款/约定/银行转账 → 订单；库存/商品/预留/物料 → 库存商品；商家/企业/账号/系统 → 系统；其余 → 业务。分类只用于展示，不改变后端数据。
- 重要标记：`priority === 'high'` 显示“重要”。
- 未读：`readAt === null` 显示圆点；点击整行标记已读（不跳转到其他页面，因为消息不携带可信跳转目标）。
- 筛选：`全部` / `未读` / `待处理`（`businessStatus !== 'resolved'`），与小程序口径一致。

界面：全屏视图（`role="dialog"`，`Esc`/返回按钮关闭，锁定背景滚动），顶部为标题“消息中心”+ 未读数 + 刷新按钮，下面是筛选条与列表；加载、空列表、错误（可重试）三种状态分别展示，不使用占位假消息。

库存预警说明：当前后端未产生库存类 `NotificationEvent`（仅有订单、履约、付款、授权、注册/审核等）。消息中心的分类与筛选已支持库存/商品类事件，但**不会**用前端模拟库存预警；后续后端接入库存事件后自动显示。

## 5. 权限与租户边界

- 消息接口使用既有 `requireMerchantTenant`：服务端按登录商家的 `contactEmail` 限定，前端不传 `merchantId`。
- 未读数量与列表来自同一响应，避免两套口径。
- 前端不做“按角色隐藏消息”的假设；员工账号权限仍由既有服务端校验决定接口是否返回 401/403，界面在错误态提示重试，不显示假数据。
- 不缓存消息到 localStorage，切换商家后重新拉取。

## 6. 验收标准

- 首页右上角只有消息图标（AI 图标已移除），无未读时不显示徽标；有未读时显示真实数量（>99 显示 `99+`）。
- 点击消息图标打开消息中心，显示真实标题/正文/时间/分类；点击未读行后该行变已读、未读数减一，返回首页徽标同步减少。
- 消息中心“更多 → 通知中心”进入同一视图，不再打开“经营设置”。
- 底部导航为 5 项，`ModaUI` 位于正中；点击进入既有 `MerchantAiHome`，返回后回到进入前的页签。
- `ai_home` 时底部导航默认隐藏；输入框下方细拖柄点击或上拖可展开，下拖或再次点击可收起；输入框聚焦时导航收起。
- 顶部右侧三点菜单打开紧凑分组面板，点击遮罩、`Escape`、任一条目均关闭；面板在 320px 宽与 60dvh 高度下不溢出，超出部分可滚动。
- `ai_home` 不在“更多 → 智能工具”中重复出现。
- 320×720 与 390×844 下消息列表、筛选条、导航 5 项不溢出、不截断关键文案；AI 输入区、拖柄、导航互不遮挡。
- 不改变其他页面数据与业务逻辑；无新增接口、数据库或权限。

## 7. 验证方式

- 规则测试 `tests/merchant-mobile-message-center.test.ts`：真实接口来源（无模拟消息数组）、铃铛打开消息中心而非订单、未读徽标来自接口、导航 5 项且 ModaUI 居中、AI 入口唯一、AI 页导航默认收起且由拖柄控制、文案目录齐备。
- 导航回归 `tests/merchant-mobile-navigation.test.ts`（更新为 5 项口径）。
- 小程序 UI 回归 `tests/merchant-miniprogram-ui.test.ts`：紧凑分组菜单、返回/标题/更多结构、细拖柄与 `hideTabBar/showTabBar` 接线。
- 定向 `tsc` + `merchant-admin-mobile` / `merchant-admin-web` 独立构建（`scripts/build-app.ts`，不发布）。
- 320/390 组件级渲染截图；真实商家会话与真机另行验收。

## 8. 验证结果（2026-10-26）

| 项目 | 命令 / 方式 | 结果 |
|---|---|---|
| 新增规则测试 | `node --import tsx --test tests/merchant-mobile-message-center.test.ts tests/merchant-mobile-navigation.test.ts` | 10/10 通过 |
| 名片回归 | `node --import tsx --test tests/merchant-business-card.test.ts`（合并运行） | 16/16 通过 |
| 定向类型检查 | `npx tsc -p tsconfig.message-center-check.json` | EXIT 0 |
| 商家手机端构建 | `tsx .tmp-build-message-center.mts`（mobile + web 双目标，输出 `/tmp/ruda-message-center-build`） | `BUILD_EXIT:0`，两个目标均 `BUILD_OK` |
| 文案目录测试 | `node --import tsx --test tests/ui-translation-copy.test.ts` | 仍失败，仅剩本任务前已存在的未收录文案（`MerchantMobileApp.tsx` 等改动前已有条目）；`MerchantMessageCenter.tsx`、`merchantNotifications.ts`、`MerchantNotificationBell.tsx` 无缺失 |
| 渲染检查 390×844（中文） | 预览页：首页 → 消息中心 → 已读 → 关闭 → ModaUI | 底栏 5 个按钮；铃铛 `aria-label="消息中心，2 条未读"`；列表 4 条；点击未读后头部变 1 条未读；Esc 关闭；`pageOverflow=0`、`dialogOverflow=0`；AI 页底栏可见（nav 787–844，AI 内容底 783） |
| 渲染检查 320×720 | 同上 | 无横向溢出；标签不截断；底栏 5 项完整 |
| 渲染检查 390×844（意大利语） | `?lang=it` | 标题 `Centro messaggi`、筛选 `Tutte/Non lette/Da gestire`、时间本地化，均无溢出 |
| 更多页入口 | 预览页：更多 → 通知中心 | 不再出现“智能助手”重复入口；“智能员工”保留；通知中心打开同一消息中心 |
| 截图 | `/tmp/ruda-verify-message-center/*.png` | 首页、消息中心（读前/读后）、ModaUI 页、更多页 |

### 8.1 ModaUI 折叠导航与紧凑菜单（2026-10-26 追加）

| 项目 | 命令 / 方式 | 结果 |
|---|---|---|
| 定向 UI 回归 | `node --import tsx --test tests/merchant-miniprogram-ui.test.ts tests/merchant-mobile-message-center.test.ts tests/ui-translation-copy.test.ts tests/merchant-mobile-navigation.test.ts` | 26/26 通过 |
| 全量单元测试 | `npm run test:unit` | 936/936 通过 |
| 类型检查 | `npx tsc --noEmit -p tsconfig.json` | EXIT 0 |
| 商家手机端构建 | `npx tsx scripts/build-app.ts merchant-admin-mobile` | EXIT 0，release `dist/apps/merchant-admin-mobile/releases/…` |
| 商家 Web 构建 | `npx tsx scripts/build-app.ts merchant-admin-web` | EXIT 0，release `dist/apps/merchant-admin-web/releases/…` |
| 小程序语法 | `node --check merchant-miniprogram/pages/assistant/index.js`、`custom-tab-bar/index.js` | 通过 |
| 小程序 tabbar 回归 | `node --import tsx --test tests/merchant-miniprogram-tabbar.test.ts` | 4/4 通过（含 `setHidden` 与 `.tab-bar-hidden`） |
| 组件级浏览器渲染 390×844（Playwright） | 临时组件预览（仅替换 `useB2B` 文案/退出与 API 响应；共享 `MerchantAiHome` 与真实手机壳层 CSS） | 关闭态导航 `aria-hidden=true`、`top=844`；拖柄点击/上拖后导航 `top=781` 且 `aria-hidden=false`；输入框聚焦后自动收起；下拖可再次收起；菜单 248×380，`right=378`，滚动区 486/378；`Escape` 关闭；横向溢出 0；`pageerror/console error` 为空 |
| 组件级浏览器渲染 320×720（Playwright） | 同上 | 菜单 248×380，`left=60/right=308`，滚动区 486/378；导航关闭/展开与焦点收起一致；横向溢出 0 |
| 意大利语文案（Playwright，320×720） | `?lang=it` | 分组与 9 个条目均为意语/既有品牌名，菜单 248×380，滚动区 518/378，横向溢出 0 |
| 截图 | `/tmp/ruda-ai-preview/01-390-chat-closed.png`、`02-390-menu.png`、`03-390-nav-open.png`、`04-320-menu.png`、`05-390-it-menu.png` | 组件级布局与交互证据；非真实商家会话 |
| 小程序视觉/触控 | 未执行（页面仍受 `AI_FEATURES_ENABLED=false` 与 `app.json` 未注册限制，环境无微信开发者工具会话） | 待验收 |
| 真实商家会话浏览器页面 | 未执行（当前环境无商家登录态；上述 Playwright 为隔离组件预览） | 待验收 |

### 8.2 最终改版验收（2026-10-26，真实商家会话 + 构建产物）

构建：`npx tsx scripts/build-app.ts merchant-admin-mobile` → `20261026155832195-6e94dc1f`；`merchant-admin-web` → `20261026155832213-ea4987c7`。

| 项目 | 命令 / 方式 | 结果 |
|---|---|---|
| 底部导航默认隐藏 | Playwright 390×844，真实 `ruda_merchant_jwt` 会话 | `aria-hidden=true`、`translate-y-full`、`pointer-events:none`；导航 top=844（视口外），内容区 bottom=844，无预留高度 |
| 拖柄展开/收起 | 同上，点击与上下拖 | 点击后导航 top=781、内容区 bottom=783；上拖 46px 展开，下拖收起；输入框聚焦后自动收起 |
| 快捷胶囊 | 390/320 宽度实测 | 4 项全部完整：390 下宽 89px（12–101、105–193、197–286、290–378）；320 下无横向溢出；点击“服装设计”写入设计提示词并显示“多方案概念图” |
| 三点菜单 | 390×844 打开菜单 | 9 项：新建对话、历史对话、创作中心、我的作品、服装换色、商业模特、店铺知识库、套餐与额度、退出登录；面板 244×396，`scrollHeight=394 / clientHeight=394`，`innerScroll=false`，最后一项可见；分组标题为“对话 / 创作工具 / 其他” |
| 历史抽屉 | 聊天后打开 | 可见标题“聊天历史”，会话列表包含当前对话；无接口错误 |
| 真实对话 | `Rispondi soltanto con OK.` | 1530–4532ms 返回，[aria-live] 有回复，无 `role=alert` |
| 键盘 inset | `visualViewport` 合成 500px 高 | 内容区 bottom=500、输入框 bottom=439，均位于键盘上方；导航保持隐藏 |
| 电脑端宽度 | Playwright 1440×900 / 1024×768 | 输入区所属 `main` 宽 880px（`lg:max-w-[880px]`），无横向溢出；1024 下输入框 bottom=749、视口 768；菜单 9 项，最后一项“退出登录”可见 |
| 单元测试 | `npm run test:unit` | 936/936 通过 |
| 定向测试 | `node --import tsx --test tests/merchant-modagpt-layout.test.ts tests/merchant-miniprogram-ui.test.ts tests/merchant-miniprogram-tabbar.test.ts tests/merchant-mobile-navigation.test.ts tests/merchant-mobile-message-center.test.ts` | 24/24 通过 |
| 类型检查 | `npx tsc --noEmit -p tsconfig.json` | EXIT 0 |
| 小程序语法 | `node --check pages/assistant/index.js`、`custom-tab-bar/index.js` | 通过 |
| 截图 | `var/phase2-evidence/mobile-390-initial.png`、`mobile-390-menu.png`、`mobile-320-initial.png`、`mobile-390-quick-actions.png`、`mobile-390-quick-design.png`、`desktop-1440-modaui-menu.png` | 真实构建产物与真实会话 |
| 套餐目录接口 | `GET /api/merchant/modagpt/plans` | 2026-10-27 已修复并上线：服务端目录查询限定 `modaGptPlanCodes`，生产真实商家会话返回 **200** 与 5 个套餐；详见 `modagpt-billing-catalog.md` |

### 8.3 生产发布验收（2026-10-27）

- 全量构建：六端全部重建并激活；商家手机端 `20261027032557941-e7a339d8`，商家 Web `20261027032548102-b180f0f5`。
- 服务端：`dist/server.cjs` 重建，`node --check` 通过；PM2 `ruda-fashion` 重启并 `pm2 save`。
- 回归：`npm run test:unit` **966/966**；`npx tsc --noEmit -p tsconfig.json` **EXIT 0**；`npm run smoke:post-deploy`（`SMOKE_BASE_URL=https://modaui.com`）通过。
- 真实生产会话（Playwright，真实 `ruda_merchant_jwt`）：
  - 手机端 390×844：`data-ruda-app=merchant-admin-mobile`，无横向溢出，拖柄与输入框存在；打开“套餐与额度”后完整渲染 5 档套餐。
  - 电脑端 1440×900：`data-ruda-app=merchant-admin-web`，侧栏存在，无横向溢出。
  - 无 5xx 响应；桌面端 4 个失败请求均为既有演示图片 `https://b2b.ruda.fashion/demo-products/*`，与本次发布无关。
- 截图：`/tmp/ruda-prod-mobile-390.png`、`/tmp/ruda-prod-mobile-pricing.png`、`/tmp/ruda-prod-desktop-1440.png`。
- 小程序：环境仍无微信上传密钥/CI，未上传、未发布；仅保留代码与语法回归结果，视觉/触控待真机验收。

## 9. 风险与回滚

- 风险：底部导航由 4 项变 5 项，窄屏标签宽度收紧；已在 320/360/390/430 实测无横向溢出。
- 风险：AI 页导航改为默认收起，若拖柄命中区过小会影响可发现性；当前命中区 `h-10 w-24`（40×96px），视觉条仅 3px；浏览器点击与上下拖动已通过，真机手感仍待确认。
- 风险：小程序自定义 tab bar 通过 `setHidden` 控制隐藏；未注册为 tab 页时拖柄按 `navigationAvailable` 隐藏，避免出现无响应的假控件。恢复注册后必须在开发者工具/真机确认自定义 tab bar 的隐藏/显示与页面底部留白。
- 回滚：恢复 `MerchantMobileApp.tsx` 的 `aiNavigationOpen` 接线与 `MerchantAiHome` 顶部菜单/页脚拖柄、恢复 4 项 `merchantMobilePrimaryTabs`、恢复小程序旧抽屉结构即可；无接口与数据变更，无需数据回滚。

## 10. 遗留与待验收

- 消息中心真实未读数与已读写入仍需单独回归；本轮 ModaUI 验收使用真实商家会话，但未专门覆盖消息中心写入。
- ModaUI 默认隐藏导航、细拖柄、9 项分组菜单与四个快捷胶囊：`tsc`、全量单测 936/936、双端构建、电脑/手机真实会话 Playwright 已通过；小程序开发者工具/真机视觉与触控仍待验收。
- 套餐目录 `GET /api/merchant/modagpt/plans` 已于 2026-10-27 修复上线：生产返回 200 与 5 个套餐；管理端目录使用同一 ID 限定查询，管理员完整鉴权后的 200 仍待管理员会话验收。
- 商家小程序未上传发布：当前环境无微信上传密钥/CI；`pages/assistant` 仍受 `AI_FEATURES_ENABLED=false` 与 `app.json` 未注册 tab 限制，开发者工具/真机视觉与触控待验收。
- 后端没有库存类 `NotificationEvent` 与 `resolve` 接口：界面不提供“标记已处理”，也不生成库存预警；如后端后续新增，现有分类与筛选可直接展示。
- 首页右上角消息入口按需求只出现在首页（其他页签无顶部工具栏）；若后续需要在所有页签展示，应扩展页头而非再复制入口。


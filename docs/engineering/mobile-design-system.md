# RUDA 手机端统一设计系统

- 文档状态：部分完成（代码与构建已落地，端侧视觉按真实会话逐页验收）
- 日期：2026-10-25
- 适用范围：`frontend-mobile`、`merchant-admin-mobile`、`platform-admin-mobile`
- 关联文档：[`architecture.md`](./architecture.md)、[`modules/merchant-admin-ui-audit.md`](./modules/merchant-admin-ui-audit.md)

## 1. 问题与目标

手机端此前没有唯一的样式事实来源：

- 全局基础层把按钮和输入框强制为 `2px` 圆角，商家手机端样式又分别声明了 `6px`、`8px`、`10px`、`12px`；页面内还散落 `rounded-lg`、`rounded-xl`、`rounded-2xl`、`rounded-3xl`、`rounded-full` 和 `rounded-[20px]`。
- 商家手机端按钮存在 `36px`、`40px`、`44px`、`48px`、`py-3` 多种高度，卡片圆角存在 `8px`、`12px`、`16px`、`24px`，同类页面视觉不一致。
- 图标被全局限制为 `14px`，底部导航声明的 `20–22px` 实际不生效；各页面又混用 `h-3.5`、`h-4`、`h-5`。
- 商品编辑浮层把“AI 智能补全”按钮放在标题行并设置 `w-full`，形成无意义的长条按钮。
- 平台手机端完全没有引用商家手机端令牌，卡片 `rounded-lg` / `rounded-xl` 混用。

目标：在不改变业务功能、路由、权限、API、数据与页面结构的前提下，让三个手机端构建目标共用一套按钮、卡片、图标、输入框、弹窗和标签规范，并让规范可自动检查。

## 2. 非目标

- 不改变 Web 端以 `2px` 直角为主的现有 RUDA 视觉；令牌默认值保持 `2px`，仅在三个手机端目标覆盖。
- 不修改微信小程序、Flutter 或商家独立站的业务实现。小程序使用独立 WXSS/rpx 体系，本轮只登记现状与待验收项，详见 §7。
- 不改任何服务端、数据库、认证、租户、权限、订单、库存或计费逻辑。
- 不以“全部按钮等宽”为目标。宽度由用途决定：搜索框和确实需要整行展示的主要操作可以全宽，成对操作按内容分配，普通操作按钮不得无意义拉满整行。

## 3. 令牌（唯一来源）

令牌定义在 `src/index.css` 的 Tailwind `@theme` 中，默认值与 Web 保持一致；`src/apps/shared/mobile-design-system.css` 只对三个手机端 `html[data-ruda-app]` 覆盖。

| 令牌 | Web 默认 | 手机端 | 用途 |
|---|---:|---:|---|
| `--radius-ruda-control` | 2px | 6px | 按钮、分段控件、图标按钮 |
| `--radius-ruda-card` | 2px | 8px | 卡片、列表容器、统计块 |
| `--radius-ruda-input` | 2px | 6px | 输入框、下拉框、文本域、搜索框 |
| `--radius-ruda-modal` | 2px | 10px | 弹窗、底部抽屉 |
| `--radius-ruda-tag` | 2px | 4px | 状态标签、计数标签 |

尺寸规范：

- 普通按钮：`36px` 高；主要操作：`40px` 高；成对操作栏中的次要按钮与主按钮同高。
- 图标按钮：`36×36px`，圆角 6px，不使用圆形背景作为普通按钮。
- 输入框 / 搜索框：`40px` 高。
- 卡片：内边距 `12px`，卡片间距 `10–12px`；不使用 16px 以上大圆角。
- 图标：常规 `18px`，底部导航 `20px`（前台 22px），表格和辅助操作 `16–18px`，全站线性图标统一 `stroke-width: 1.7`。
- 状态标签：高 `22px`，4px 圆角；仅状态标签允许胶囊形，普通按钮和卡片不允许。

## 4. 组件规则

### 4.1 按钮

1. 统一引用 `.ruda-btn-primary`、`.ruda-btn-secondary`、`.ruda-btn-icon`，或使用同一个按钮基础规则；不得在页面内重新声明圆角。
2. 主按钮黑底白字，次按钮白底灰边框，禁用态统一降低透明度；不新增装饰色。
3. 按钮宽度由文字和场景决定。只有搜索框、表单单列主操作和确需整行的主要操作使用 `w-full`；成对操作使用 `flex-1` / `flex-[2]`；导航、工具、行内操作不得拉满整行。
4. 禁止胶囊按钮、16px 以上圆角按钮和不一致的高度。

### 4.2 卡片

1. 普通卡片 8px 圆角、12px 内边距、白底浅灰边框，不使用渐变装饰和大阴影。
2. 卡片直接承载内容；不需要卡片语义的字段使用紧凑列表行，不把每个字段单独装卡。
3. 列表、订单、统计卡可有不同内部结构，但必须复用同一圆角、边框、内边距和间距。
4. 弹窗 / 底部抽屉使用 10px 圆角；页面级浮层不再使用 `rounded-3xl`。

### 4.3 图标

1. 只使用 `lucide-react` 现有一致线性图标，不混入实心、彩色、立体或不同线宽图标。
2. 常规功能图标 18px；底部导航 20–22px；密集表格辅助图标 16–18px。
3. 图标与文字间距使用 `gap-1` / `gap-1.5`；不为每个图标增加圆形背景、边框或独立大卡片。
4. 现有通知按钮、状态图标等确有强调需求的容器可以保留，但圆角遵循按钮令牌。

### 4.4 ModaUI 聊天壳层

1. 顶栏固定 56px：左侧返回、居中当前分区标题、右侧单个竖排三点菜单；不再并列设置入口和模型入口。
2. 详细操作放在右对齐紧凑面板，按“对话 / 创作 / 其他”分组；面板宽度不超过 `248px` 或视口减 24px，高度不超过 `min(60dvh, 380px)`，超出滚动。
3. 商家底部导航在 ModaUI 页默认收起；输入区下方提供 3px 视觉条、40×96px 命中区的拖柄，展开后导航从底部滑入，动效 `cubic-bezier(0.22,1,0.36,1)`、300ms，并尊重 `prefers-reduced-motion`。
4. 输入区聚焦时导航收起；键盘弹起使用 `visualViewport` inset，避免输入框、拖柄和导航互相遮挡。

## 5. 实现

- `src/index.css`：新增 `--radius-ruda-*` 主题令牌；全局按钮、输入框、`.ui-card`、`.ui-tab`、空状态和基础按钮组件改为引用令牌，默认值保持 Web 现状。
- `src/apps/shared/mobile-design-system.css`：手机端令牌覆盖、图标尺寸、卡片/弹窗圆角归一、卡片内边距归一、底部导航图标尺寸。被三个手机端 `styles.css` 在基础样式之后引入。
- `src/apps/merchant-admin-mobile/styles.css`：`ruda-btn-*`、`ruda-card`、`ruda-input`、`ruda-search-bar`、`ruda-tag`、`ruda-tab-pill` 改为引用令牌并统一高度。
- `MerchantMobileApp.tsx` / `MerchantMobileOrderWorkspace.tsx` / `MerchantMobileProductCreateForm.tsx`：修正长条 AI 按钮、退出登录按钮、面辅料披露按钮、商品浮层和底部操作栏的尺寸与圆角；给弹窗增加 `ruda-modal` 语义类。
- `PlatformAdminMobile.tsx`：移除全宽次要按钮、补足顶部按钮最小高度，压缩顶部操作文案，卡片统一由手机端令牌接管。
- `MobileBottomNav.tsx`：前台手机底部导航选中态由金色改为 `neutral-950`，与黑白设计系统一致。
- 小程序不引用该 CSS，因此不会被本次修改影响；其独立规范仍待后续任务。

## 6. 页面检查范围

| 运行面 | 页面 | 当前状态 |
|---|---|---|
| 商家手机 | 首页、商品、库存、订单、POS、客户、供应商、生产链、ModaGPT、通知、搜索、员工工作台、更多、设置 | 代码与构建已覆盖；真实会话逐页视觉验收见 §7 |
| 平台手机 | 总览、商家、客户、商品审核、库存预警、订单、财务、审计、通知、设置、ModaGPT、应用商店、风险、数据库 | 代码与构建已覆盖；需管理员真实会话复验 |
| 前台手机 | 首页、找店、商品详情、购物车、结算、账户、消息、ModaGPT | 共用组件受令牌影响；需真实前台会话复验 |

## 7. 验收状态

### 7.1 已执行并通过

- 构建：
  - `npm run build:app:merchant-admin-mobile` → `20261025162903158-c58a0875`
  - `npm run build:app:frontend-mobile` → `20261025162716793-884782c9`
  - `npm run build:app:platform-admin-mobile` → `20261025162720208-99b039da`
- 测试：`node --import tsx --test tests/mobile-design-system.test.ts tests/duplication-guards.test.ts tests/app-target.test.ts tests/admin-navigation.test.ts`，18/18 通过。
- 真实会话 Playwright（隔离 PostgreSQL 16，端口 55432；开发服务端口 4599；测试账号只存在于隔离库）：
  - 商家手机 390×844：首页、商品、订单、更多；320×700：首页。`overflow=0`，按钮圆角全部 `6px`，图标 `18/20px`，`PAGEERRORS: []`。
  - 平台手机 390×844：总览；头部“采购 / 电脑端”不再换行，`overflow=0`，图标 `18px`，`PAGEERRORS: []`。
  - 前台手机 390×844：首页；`overflow=0`，图标 `18/22px`，`PAGEERRORS: []`。
  - 前台 Web 1440×900 回归：按钮、卡片、输入框仍为 `2px`，图标 `14px`，`overflow=0`，确认手机端令牌未污染 Web。
- 截图（真实运行）：
  - 整改前（来自本次改动前的线上手机截图）：[首页](../assets/mobile-design-system/before-merchant-home-390.png) / [商品](../assets/mobile-design-system/before-merchant-products-390.png)
  - 整改后商家手机：[首页 390](../assets/mobile-design-system/after-merchant-home-390.png) / [商品](../assets/mobile-design-system/after-merchant-products-390.png) / [订单](../assets/mobile-design-system/after-merchant-orders-390.png) / [更多](../assets/mobile-design-system/after-merchant-more-390.png) / [首页 320](../assets/mobile-design-system/after-merchant-home-320.png)
  - 平台手机：[总览 390](../assets/mobile-design-system/after-platform-home-390.png)
  - 前台手机：[首页 390](../assets/mobile-design-system/after-frontend-home-390.png)
  - Web 回归：[首页 1440](../assets/mobile-design-system/after-web-home-1440.png)
- 真实会话下确认：退出登录按钮已从 48px 整行降为 36px 紧凑按钮；商品编辑“AI 智能补全与诊断”不再位于标题行拉满宽度；订单详情“打印发票 / 分享单据”统一为 40px；平台顶部次级操作不再全宽。

### 7.1.1 ModaUI 聊天壳层（2026-10-26 追加）

- `npx tsc --noEmit -p tsconfig.json`：EXIT 0。
- `npm run test:unit`：936/936 通过；定向 UI 26/26、ModaGPT 布局 3/3。
- `npx tsx scripts/build-app.ts merchant-admin-mobile`、`merchant-admin-web`：均 EXIT 0。
- `merchant-miniprogram/pages/assistant/index.js`：`node --check` 通过。
- 组件级 Playwright（390×844、320×720、意大利语）：导航关闭/点击与拖拽展开/聚焦收起、菜单 `Escape` 关闭、横向溢出 0、控制台错误 0；证据 `/tmp/ruda-ai-preview/*.png`。该预览替换了 `useB2B` 与 API 响应，不是真实商家会话。
- 待验收：商家登录态下 320/390 宽度的真实页面、键盘弹起、拖拽手感，以及小程序开发者工具/真机。

### 7.2 待验证与未修改

- 商家手机其余嵌套页（客户、库存、生产、通知、设置、内容、员工、POS、ModaGPT）已复用同一套令牌并做过代码与二次点击抽查，但未逐页形成完整截图矩阵；状态标记为“待逐页视觉复验”。
- 平台手机 32 个页面仅验证总览与全局令牌，其余页面待管理员逐页复验。
- 小程序与 Flutter 未修改：`miniprogram/` 存在 `2rpx`–`40rpx`、`50%`、`999rpx` 等独立圆角体系；`merchant-miniprogram/` 存在 `999rpx` 胶囊按钮与 `0–26rpx` 混用。需要各自设计令牌、真实构建与真机验收。
- 仓库级 `npx tsc --noEmit` 仍因内存耗尽（>16GB）无法完成，类型门禁未在本轮恢复；三个手机端生产构建均已通过。
- 本轮未发布任何应用，生产 `current.json` 未切换。


## 8. 回滚

本次仅修改样式与展示结构，不涉及 API、数据库、权限和生产数据。回滚方式：

1. 回退 `src/index.css`、`src/apps/shared/mobile-design-system.css`、三个手机端样式/页面文件。
2. 重新构建并发布对应手机端应用 release；生产 `current.json` 未切换前不影响线上。

## 9. 自动检查

`tests/mobile-design-system.test.ts` 固定以下事实：

- 三个手机端目标均声明同一组圆角令牌。
- 令牌默认值保持 Web 的 `2px`。
- 商家手机组件类不再使用 `rounded-full` 或 `10px` 以上按钮圆角。
- `rounded-xl/2xl/3xl` 由手机端 CSS 统一映射为卡片 8px，弹窗由 `.ruda-modal` 使用 10px。
- 页面源码不再保留 44px 商品表单按钮、整行退出按钮或拉满标题行的 AI 按钮。

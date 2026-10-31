# RUDA 设计值唯一权威表

- 文档状态：已完成（数值取自现有代码，逐项标注来源）
- 更新日期：2026-10-31
- 适用范围：`.agents/skills/impeccable/`、`.agents/skills/redesign-existing-projects/`、`.agents/skills/landing-page-design/` 三个技能，以及所有前端任务。
- 冲突处理：**本文件优先于任何技能文件**。技能内的 Design Values 是执行摘要；若与本文件不一致，以本文件为准，并修正技能文件。

> 本文件只记录**已经存在**的设计值，不提出新方案。新增令牌需要单独的架构决策，不得在本文件里"顺手"发明。

## 1. 字体

来源：`src/index.css` `@theme`。

| 令牌 | 值 | 允许范围 |
| --- | --- | --- |
| `--font-sans` | `"Manrope Variable", "Manrope", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif` | 全站默认字体 |
| `--font-serif` | `"Bodoni Moda Variable", "Bodoni Moda", "Didot", "Bodoni 72", "Noto Serif CJK SC", "Songti SC", "SimSun", Georgia, serif` | 仅买家侧前台展示（`.portal-theme-buyer`） |
| `--font-editorial` | `"Cormorant Garamond Variable", "Cormorant Garamond", "Noto Serif CJK SC", "Songti SC", "SimSun", Georgia, serif` | 仅买家侧主题/趋势页 |
| `.font-brand-display` | `Didot, "Bodoni 72", "Bodoni Moda Variable", …` | 品牌字标 |

约束：

- 商家、员工、平台后台的 theme 已把 `--font-serif` / `--font-editorial` 回落为 `--font-sans`：**后台一律 sans**。
- 已安装字体只有 `@fontsource-variable/{manrope,bodoni-moda,cormorant-garamond,playfair-display,inter}`。**不新增字体包。**
- 不使用斜体（现存 `not-italic` 是抵消浏览器默认，不视为斜体）。字重上限 bold（700），禁止 800/900 用于新代码。
- `Inter` 只在 `src/apps/shared/components/frontend/mobileEditorialHome.css` 中出现，属 `.impeccable/config.json` 已登记的字体豁免；新代码不得再引入 Inter。

## 2. 颜色

来源：`src/index.css` `@theme` + `:root` + `.portal-theme-*`。

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--ruda-paper` / `neutral-50` | `#fbfaf8` | 页面底色、卡片底 |
| `neutral-100` | `#f5f3ef` | 次级填充、accent-soft、hover 面 |
| `--ruda-line` / `neutral-200` | `#e9e6df` | 边框、分隔线 |
| `neutral-300` | `#d9d5cc` | 强分隔、禁用底（**不可作文字色**） |
| `neutral-400` | `#aaa49a` | 占位符、禁用文字（**不可作正文或标题**） |
| `--ruda-focus` / `neutral-500` | `#777167` | 次要文字、焦点环 |
| `neutral-600` | `#5e594f` | 弱化正文 |
| `neutral-700` | `#454139` | 强次要文字 |
| `neutral-800` | `#302d27` | 近主文字 |
| `--portal-accent` / `neutral-900` | `#201e1a` | 唯一强调色、主文字 |
| `--ruda-ink` / `neutral-950` | `#12110f` | 标题、深色面 |

约束：

- **唯一强调色** `#201e1a`，配套 `--portal-accent-soft #f5f3ef`、`--portal-accent-contrast #ffffff`。
- **无深色主题**，不用 `prefers-color-scheme` 分支。深色只用于页脚、主按钮、Logo 底。
- **禁止**金色、古铜、紫蓝渐变等第二强调色。
- **禁止**渐变背景与渐变文字（唯一现存例外：`FashionTrendsView` 中一处图片遮罩渐变，属既有实现，不得扩散）。
- 深底上的文字最低用 `neutral-300`（`#d9d5cc`，对 `#12110f` 约 7:1）；新建或修改时不得继续用 `neutral-500` 压深底（3.90:1，不达 AA）。
- 冷灰 `#222222`、`#DDDDDD`、`#E5E5E5`、`#555555` 等硬编码值属于待收敛的历史实现，新代码一律改用 `neutral-*`。

## 3. 字号与文字样式

基准：Tailwind v4 默认字号（`src/index.css` 未覆盖 `--text-*`）。

| 用途 | Tailwind | 尺寸 / 行高 | 字重 |
| --- | --- | --- | --- |
| 买家侧展示标题 | `text-5xl` / `sm:text-7xl` + `font-serif` | 48/1 → 72/1 | bold |
| 页面标题 H1 | `text-3xl` | 30 / 36 | semibold |
| 区块标题 H2 | `text-2xl` | 24 / 32 | semibold |
| 次级标题 H3 | `text-xl` | 20 / 28 | semibold |
| 卡片/列表标题 | `text-base` | 16 / 24 | medium |
| 正文 | `text-sm` | 14 / 20 | regular |
| 辅助说明 | `text-xs` | 12 / 16 | regular |
| 按钮 | `text-sm` | 14 / 20 | semibold |
| 角标 / 元数据 | `text-xs` | 12 / 16 | medium |

**硬底线：新写或修改的前端代码中，正文与标签不得小于 12px。** 禁止 `text-[8px]` / `text-[9px]` / `text-[10px]` / `text-[11px]`。历史存量不批量清理（AGENTS.md §3.5），但改动到某处时必须顺手改到 12px 以上。

## 4. 间距

Tailwind 默认刻度：`0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`（px）。不发明中间值。

| 场景 | 值 |
| --- | --- |
| 主按钮内边距 | 8px 纵向 / 12px 横向 |
| 手机端按钮高度 | 默认 36px，主操作 40px |
| 手机端输入框/搜索框 | 40px |
| 手机端卡片 | 内边距 12px，间距 10–12px |
| 图标按钮 | 36×36px |
| 分区纵向间距 | 移动 48–64px，桌面 80–96px |
| 营销页内容最大宽度 | 1200–1440px；首屏文字 ≤680px |

## 5. 圆角

来源：`src/index.css`（Web 默认）与 `src/apps/shared/mobile-design-system.css`（三个手机端目标覆盖）。

| 令牌 | Web | 手机端 | 用途 |
| --- | ---: | ---: | --- |
| `--radius-ruda-control` | 2px | 6px | 按钮、分段控件、图标按钮 |
| `--radius-ruda-card` | 2px | 8px | 卡片、列表容器 |
| `--radius-ruda-input` | 2px | 6px | 输入框、下拉、搜索 |
| `--radius-ruda-modal` | 2px | 10px | 弹窗、底部抽屉 |
| `--radius-ruda-tag` | 2px | 4px | 状态标签 |

嵌套形状间距小于 32px 时：`内圆角 = 外圆角 − 间距`，结果必须大于 2 才应用。只有状态标签允许胶囊形。

现状偏差（待收敛，不作为标准）：`rounded-full` 189 处、`rounded-lg` 142 处、`rounded-xl` 133 处、`rounded-2xl` 67 处（前台组件统计）。

## 6. 图标

- 唯一图标库：`lucide-react`（`package.json` 已安装）。
- 线宽：`stroke-width: 1.7`。
- 尺寸：常规 18px；底部导航 20–22px（前台 22px）；密集表格 16–18px。
- 图标按钮 36×36px，圆角用 `--radius-ruda-control`。
- 不为普通操作加圆形底衬；不混用实心/彩色/立体图标。

## 7. 动效

| 场景 | 值 |
| --- | --- |
| 基础曲线 | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 导航 / 面板位移 | 300ms |
| 入场（卡片、列表） | 480–520ms |
| 颜色 / 透明度 | 200–300ms，不低于 200ms |
| 滚动显现 | 仅营销面，`IntersectionObserver` |

约束：只动 `transform` 与 `opacity`；禁止 `window.addEventListener('scroll')` 驱动动画；必须处理 `prefers-reduced-motion`（现有实现均为 `animation: none` 或直接终态）。

## 8. 响应式基线

- 验证宽度：390px（手机）、820px（平板）、1440px（桌面）。
- 手机端与 Web 使用同一份字段与业务口径，允许不同布局。
- 触控目标不小于 24×24 CSS px（WCAG 2.5.8）；新写代码按 32px 以上设计。
- 390px 下不得出现横向滚动。

## 9. 机械检查

`tests/design-skills-consistency.test.ts` 校验以下事实在三处保持一致：

1. 本文件的字体栈、强调色、圆角令牌、动效曲线；
2. `.agents/skills/redesign-existing-projects/SKILL.md` 与 `.agents/skills/landing-page-design/SKILL.md` 的 Design Values 摘要；
3. `src/index.css` 与 `src/apps/shared/mobile-design-system.css` 的真实令牌值。

任一处改动而未同步，测试失败。

## 10. 修订记录

| 日期 | 变更 | 依据 |
| --- | --- | --- |
| 2026-10-31 | 建立本文件；作为三个技能的唯一权威值来源 | 前台 Web 审计（`docs/engineering/redesign-skill.md` 同批） |

---
name: landing-page-design
description: "RUDA 适配版落地页与转化页设计系统。Part A：一次一个诉求、一个受众、一个主操作的结构与文案方法（适用于商家入驻、采购商注册、活动页、商家独立站首页）。Part B：RUDA 真实排版、间距、圆角、状态与动效规则，适用于任何前端页面。用于新建转化页、编写页面文案、评审层级与转化路径，以及给组件和状态定值。RUDA 工程铁规与本文件冲突时以铁规为准；本技能不授权重做既有页面。"
metadata:
  version: 1.0.0-ruda
  upstream: https://github.com/elayadesign/ai-design-skills
  adapted: 2026-10-31
---

# Landing Page Design（RUDA 适配版）

A landing page is not a homepage. A homepage serves multiple intents. A landing page wins one intent:

**one offer → one audience → one primary action.**

This skill has two halves. **Part A** decides what the page says and how it is structured. **Part B** gives the visual values. Work through A before touching B.

Adapted from [`elayadesign/ai-design-skills`](https://github.com/elayadesign/ai-design-skills) (MIT). Upstream values were replaced with RUDA's real design system; see `docs/engineering/design-values.md` for the authoritative table.

## 适用范围与优先级（先读）

冲突时按此顺序，本技能不得越过：

1. `AGENTS.md`（全站工程铁规），尤其 §5 UI/文字、§15 商家三端联动与 §15.5 后台 UI 锁定、§16 前端任务技能调用。
2. `docs/engineering/design-values.md`（令牌与刻度唯一权威）。
3. `docs/engineering/mobile-design-system.md`、`docs/engineering/modules/merchant-admin-ui-audit.md`。
4. 现有代码中的设计系统实现（`src/index.css` 的 `@theme`、共享组件）。
5. 本技能条款。

**Part A（策略与结构）** 只用于**新建**转化页：商家入驻、采购商注册、活动/投放页、商家独立店铺首页、独立站落地页。既有页面不得为了套 Part A 而增删板块。

**Part B（视觉值）** 作为工艺规则适用于任何前端改动，但只约束**本次新建或修改的代码**，不批量清理历史写法。

## 硬性禁止（覆盖上游条款）

- **不推翻现有页面结构**：不重排首页分区、不替换后台外壳、不移动导航层级与 AI 助手栏（§15.5）。
- **不换字体、不换主题色、不加第二强调色**：无金色、无紫蓝 AI 渐变、无深色主题。
- **不引入新依赖**：图标固定 `lucide-react`，动效固定现有 `cubic-bezier(0.22,1,0.36,1)`；不加字体包、图标包、动画库、CSS 框架。
- **不新建第二套工具类体系**：不引入 `heading-1` / `body-4` 之类的新 class；B1 的文字样式用下表映射到现有 Tailwind 类。
- **不加渐变**：背景与标题都不用渐变（上游的 hero 渐变文字规则在此作废）。
- **不做浮动毛玻璃导航**：门户与后台导航保持现状。
- **不强制新增强调段落**：上游 B11「必选 tagline reveal」只允许用于新建营销页，不得插进既有首页或后台。

---

# PART A — 策略与结构

## A1. 开工前一次性问清（缺什么问什么，不要逐条追问）

**目的**
- 这页唯一的主操作是什么（入驻申请 / 注册询价 / 预订 / 下载）。
- 具体给出什么（现货目录？报价？开店？）。
- 什么算转化（提交表单 / 进入目录 / 完成认证）。

**受众与场景**
- 目标客户是谁（采购商 / 商家 / 员工）。
- 现在卡在哪一步（没有认证？不知道价格？怕押货？）。
- 流量来自哪里（搜索 / 广告 / 商家分享 / 小程序跳转）。
- 到达时他们已经知道什么。

**证据与素材**
- 可用的真实证据：商家数、SKU 数、交付时效、认证、真实评价。
- 截图、目录页、视频素材。
- 保障条款：正规发票、退换、最低起订、样品政策。

**约束**
- 文案语言（默认简体中文；面向意大利/欧洲买家时为意大利语）。
- 是否需要被搜索引擎收录。

问不到就**写下假设并继续**，不要卡住，也不得编造数字。

## A2. 页面结构

**首屏（必需）**
1. 标题：结果 + 受众（例：「意大利现货女装，按整包起订」）
2. 副标题：怎么做到 + 一个具体数字
3. 主操作按钮：动词 + 得到什么（「申请批发商账号」「查看现货目录」）
4. 一个信任信号：认证徽标、商家数、真实评价
5. 主视觉：真实现货/门店/工厂照片，不用抽象插画

**中段（论证）**
6. 问题 → 方案（一段）
7. 收益 3–5 条，写清对买家的结果
8. 怎么开始，三步
9. 证明：真实商家、真实案例

**底部（消除顾虑）**
10. 常见问题 6–12 条
11. 风险反转：免费认证、无押金、可退换
12. 结尾主操作，与首屏一致

## A3. 版式选择（选一个并说明理由）

| 类型 | 什么时候用 |
|---|---|
| **A. 经典首屏 + 分区** | 产品本身一眼能懂，最常见 |
| **B. 长文叙事** | 需要教育市场、消除怀疑（如「为什么要做 B2B 认证」） |
| **C. 极简转化页** | 高意向流量（商家邀请、员工内推） |
| **D. 对比页** | 搜索词含替代方案（「批发平台对比」） |

## A4. 转化规则

- **首屏只有一个主操作**，不得并列两个同等重量的 CTA。
- **收益优先于功能**：功能是「有什么」，收益是「对他意味着什么」。
- **写具体**：❌「提升效率」 ✅「选款到下单 3 步，报价 24 小时内回复」。
- **降低风险**：至少给出一个保障（免费认证 / 无押金 / 支持退换 / 正规发票）。
- **证明贴着主张放**，不要全部堆在页面底部。

## A5. 文案

**标题公式**
- 「{结果}，{限定条件}」
- 「{品类}的{受众}平台」
- 「{时间}拿到{结果}」

**副标题**：一到两句，说明是什么、给谁用。

**主操作**：动词 + 得到什么。禁止「了解更多」「提交」。

**收益条目**：加粗收益，后接具体证据。

**中文风格**（替代上游的英文规则）
- 句子用陈述句，不用感叹号。
- 禁止空话：「赋能」「一站式解决方案」「极致体验」「颠覆」「重新定义」。
- 禁止在标题下方重复解释标题。
- 同一业务对象全站同一名称；商家 AI 员工只叫 **ModaUI**。

## A6. 构建顺序

一次只做一个分区：首屏 → 收益 → 怎么开始 → 证明 → 常见问题 → 结尾 CTA。不要每次重写整页，保持 diff 可审查。

## A7. SEO 与 AEO

- 投放专用、限时页：`noindex`。
- 常青页：真实 `<title>`、description、内链、问答式 FAQ（便于 AEO）。
- 结构化数据按现有 SEO 实现（`src/shared/seo.ts`）扩展，不新建第二套。

## A8. 常见失误

首屏多个 CTA、价值主张空泛、功能列表没有结果、证明压在底部、手机端排版崩坏、没有明确的下一步。

---

# PART B — RUDA 视觉系统

所有具体数值以 `docs/engineering/design-values.md` 为准。以下为执行摘要。

## B1. 排版

**字体（只能这三套，均已安装）**

| 用途 | 字体 | 范围 |
|---|---|---|
| 正文与界面 | `--font-sans`（Manrope Variable + CJK 回退） | 全站默认 |
| 品牌展示 | `--font-serif`（Bodoni Moda Variable） | 仅买家侧前台 |
| 编辑体 | `--font-editorial`（Cormorant Garamond Variable） | 仅买家侧主题页 |

商家、员工、平台后台的主题已把 serif 回落到 sans：**后台一律 sans**。不使用斜体；字重上限 bold（700），禁止 800/900。

**文字样式映射**（不新建工具类，直接用这些 Tailwind 类）

| 用途 | Tailwind | 尺寸/行高 | 字重 |
|---|---|---|---|
| 买家侧展示标题 | `text-5xl` / `sm:text-7xl` + `font-serif` | 48→72 | bold |
| 页面标题 H1 | `text-3xl` | 30/36 | semibold |
| 区块标题 H2 | `text-2xl` | 24/32 | semibold |
| 次级标题 H3 | `text-xl` | 20/28 | semibold |
| 卡片标题 | `text-base` | 16/24 | medium |
| 正文 | `text-sm` | 14/20 | regular |
| 辅助说明 | `text-xs` | 12/16 | regular |
| 按钮 | `text-sm` | 14/20 | semibold |
| 角标/元数据 | `text-xs` | 12/16 | medium |

**硬底线：新写或修改的代码中正文与标签不得小于 12px。** 禁止 `text-[8px]`、`text-[9px]`、`text-[10px]`、`text-[11px]`；历史存量按 §3.5 不批量清理。数据界面启用 `tabular-nums`。

**文案排版**
- 标题 `text-wrap: balance`，正文 `text-wrap: pretty`，避免孤立单字。
- 中文正文每行 30–40 字为宜；拉丁文案行宽约 65 字符。
- 英文标签不用全大写长串；中文标签不加空格。

## B2. 间距

使用 Tailwind 默认刻度（2/4/8/12/16/20/24/32/40/48/64/80/96），不发明中间值。

- 按钮：主按钮高 36–40px，内边距 8px/12px。
- 手机端：默认按钮 36px、主操作 40px、输入框 40px、卡片内边距 12px、卡片间距 10–12px。
- 分区纵向间距：移动 48–64px，桌面 80–96px。

## B3. 圆角

只用 RUDA 令牌，不用 Tailwind 的 `rounded-lg/xl/2xl` 作为默认值。

| 令牌 | Web | 手机端 |
|---|---:|---:|
| `--radius-ruda-control` | 2px | 6px |
| `--radius-ruda-card` | 2px | 8px |
| `--radius-ruda-input` | 2px | 6px |
| `--radius-ruda-modal` | 2px | 10px |
| `--radius-ruda-tag` | 2px | 4px |

嵌套形状间距小于 32px 时：`内圆角 = 外圆角 − 间距`，结果大于 2 才应用。只有状态标签允许胶囊形。

## B4. 边框与背景

- 卡片边框四周闭合或完全不用，禁止只给单边。
- 背景一律纯色，禁止渐变（含标题文字渐变）。
- 表面色只用中性色阶：`#fbfaf8`（纸）、`#f5f3ef`、`#e9e6df`（线）、`#ffffff`（卡）；文字与唯一强调色用 `#12110f` / `#201e1a`。
- 深色只用于页脚、主按钮、Logo 底，不做深色主题。

## B5. 首屏

- 标题与副标题最大宽度 680px，按语义断行。
- 首屏必须能读到：一句定位、一个主操作、一个信任信号。
- 买家侧可用全幅影像，但必须有文字层；不得只有图和导航。

## B6. 图标

只用 `lucide-react`，线宽 `1.7`。常规 18px，底部导航 20–22px，密集表格 16–18px。图标按钮 36×36px。禁止圆形底衬作为普通按钮、禁止实心/彩色图标混用。

## B7. 动效

- 基础曲线 `cubic-bezier(0.22, 1, 0.36, 1)`；面板与导航位移 300ms，入场 480–520ms，颜色/透明度 200–300ms。
- 只动 `transform` 与 `opacity`；禁止动 `top/left/width/height`。
- 滚动显现只用 `IntersectionObserver`，且只用于营销面；禁止未节流的 `scroll` 监听。
- 必须处理 `prefers-reduced-motion`。

## B8. 内容真实感

- **禁止编造事实**：价格、商家数、评价、时效必须来自真实数据；缺失时用显式占位（`{{价格}}`）而不是编一个。
- **公开端不得出现演示数据**：`【演示】`、`DEMO ·`、`€0.00`、`+39 000 000 0000` 一律视为缺陷。
- 照片用真实服装、面料、门店、工厂图；不使用与业务无关的模特图。
- 系统提示语平静、具体；错误说明失败原因和下一步；不用感叹号。

## B9. 状态

每个可交互元素都要有完整状态：hover、active（`scale(0.98)` 或 `translateY(1px)`）、focus（可见焦点环，`--ruda-focus`）、loading（骨架屏，不用圆形转圈）、empty（有下一步的引导视图）、error（就近、具体）、无权限（说明原因和申请路径）。

禁止 `#` 死链、禁止 `window.alert()`、当前导航项必须可见区分、提交中禁用主操作并展示服务端真实结果。

## B10. 上线必备

法务链接、品牌 404、客户端表单校验（服务端仍要校验）、跳转正文链接、Cookie 同意、favicon、`<title>`/description/`og:image`、图片 alt、语义标签（`nav/main/article/aside/section`）、每页可返回、390px 宽度无横向滚动且主操作在首屏可见。

## B11. 强调段落（仅新建营销页可选）

上游要求每个落地页必须有逐词点亮的标语段。RUDA 的处理：

- **只允许用于新建营销/投放页**，不得插进既有首页、目录、后台。
- 文案至少两行，写成收益句，不是分区标题。
- 实现用 `IntersectionObserver` 逐词从 30% 不透明度过渡到全色，基础曲线。
- `prefers-reduced-motion` 下直接显示最终态。
- 与现有 `homepage-card-enter` 等入场动画风格保持一致，不引入新库。

---

# 输出格式

新建落地页时，先给方案再写代码：

1. 页面结构（分区与顺序）
2. 首屏文案（标题 / 副标题 / 主操作 / 信任信号）
3. 收益 3–5 条
4. 怎么开始 3 步
5. 常见问题 6–12 条
6. SEO 建议（是否收录 + title/description）
7. 版式类型 A/B/C/D 及理由

然后按 A6 逐段实现。

---

# 检查清单

**策略**
- [ ] 一个诉求、一个受众、一个主操作
- [ ] 首屏没有并列 CTA
- [ ] 数字具体，没有空泛动词
- [ ] 至少一个风险反转
- [ ] 证明贴着主张
- [ ] 版式类型是主动选的

**视觉**
- [ ] 只用已安装的三套字体，无斜体、无 800/900
- [ ] 新代码正文 ≥12px，尺寸落在 Tailwind 刻度
- [ ] 间距来自默认刻度
- [ ] 圆角用 RUDA 令牌，嵌套半径按公式
- [ ] 无单边边框、无渐变
- [ ] 首屏文字 ≤680px 宽且断行合理
- [ ] 图标只用 lucide，线宽 1.7
- [ ] 动效用基础曲线，滚动显现用 IntersectionObserver
- [ ] `prefers-reduced-motion` 有处理
- [ ] 390px 无横向溢出

**内容与上线**
- [ ] 真实文案与真实数据，无「【演示】」
- [ ] hover/active/focus/loading/empty/error/无权限 齐全
- [ ] 无死链、当前导航项有标识
- [ ] 404、法务链接、表单校验、favicon、meta、alt 齐全

---

## Credits

Adapted from [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills) `landing-page-design` (MIT, © 2026 Elaya), which in turn adapts content realism and motion ideas from [taste-skill](https://github.com/Leonxlnx/taste-skill) by Leon Lin (MIT). See `LICENSE.md` in this directory.

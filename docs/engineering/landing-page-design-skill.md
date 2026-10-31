# Landing Page Design 技能接入与设计技能分工

- 文档状态：已完成（技能已安装并改写为 RUDA 设计值；试点页面待用户确认后推广）
- 执行日期：2026-10-31
- 上游：[`elayadesign/ai-design-skills`](https://github.com/elayadesign/ai-design-skills)（MIT，© 2026 Elaya）
- 涉及路径：`.agents/skills/landing-page-design/`、`.claude/skills/landing-page-design/`、`docs/engineering/design-values.md`、`AGENTS.md` §5.6 / §16、本文件。
- 不涉及：运行时代码、API、数据库、权限、部署。

## 1. 仓库检查结论

克隆后完整读取（`git clone --depth 1`，2026-10-31）：

```
README.md
LICENSE
skills/landing-page-design/SKILL.md     479 行
scripts/validate_skills.py             128 行（上游自用校验，未安装）
tests/test_validate_skills.py          126 行（上游自测，未安装）
.github/workflows/validate-skills.yml  （上游 CI，未安装）
```

- 仓库当前**只有 1 个技能**：`landing-page-design`。没有其他可挑选的候选，因此"只装适合的"等于"装这一个"。
- 该技能分两半：**Part A**（一次性问清 → 页面结构 → 版式选择 → 转化规则 → 文案 → SEO）与 **Part B**（文字样式、间距、圆角、背景、首屏、图标、动效、状态、上线必备、标语段）。
- 上游自带的 `scripts/` 与 `tests/` 只校验上游仓库自身的 SKILL.md 结构，对 RUDA 无价值，不安装（避免在仓库里引入第二套技能校验器）。

## 2. 选择与取舍

| 上游内容 | 处理 | 理由 |
| --- | --- | --- |
| Part A 全部（A1–A8） | **保留**，改为 RUDA 语境（多商户 B2B、简体中文/意大利语、商家入驻与采购商注册） | 这是本仓库最缺的能力：转化页的诉求收敛与文案纪律 |
| B1 字体（Geist/Poppins，禁 Inter） | **改写**为 `--font-sans` / `--font-serif` / `--font-editorial` | RUDA 已安装 Manrope + 两套展示衬线；换字体等于换品牌 |
| B1「全站只用一种字体」 | **改写** | 买家侧 Manrope + 衬线是既有品牌表达，不视为违规 |
| B1 文字样式名（`heading-1`…） | **改写**为「风格 → 现有 Tailwind 类」映射表 | 新建 `heading-1` 类等于引入第二套设计系统，违反 SSOT |
| B2 间距（2/4/8/12/16…） | **改写**为 Tailwind 默认刻度 | 仓库没有那套间距令牌，不能凭空造 |
| B3 圆角（Tailwind 刻度） | **改写**为 `--radius-ruda-*`（Web 2px / 手机 6-8-6-10-4） | 与 `mobile-design-system.md` 保持唯一来源 |
| B4 深色模式色板 | **删除**，改为暖中性色阶 + 无深色主题 | RUDA 没有深色主题 |
| B5 标题渐变文字 | **删除** | `AGENTS.md` §5.1 禁止渐变 |
| B6 图标（Phosphor/Solar/Iconamoon） | **改写**为 `lucide-react` + 线宽 1.7 | 仓库已锁定 lucide，新增图标库属于新依赖 |
| B7 浮动毛玻璃导航 | **删除** | `AGENTS.md` §15.5 锁定后台外壳与导航，前台导航也不重做 |
| B11 必选标语段 | **降级为可选**，且只用于新建营销页 | 强制给既有首页加板块即"推翻现有结构" |
| B8 内容真实感 | **保留并强化**：新增"公开端不得出现 `【演示】`/`DEMO ·`/`€0.00`" | 与 2026-10-31 前台审计发现一致 |
| B9 / B10 状态与上线必备 | **保留**，补 `无权限态`、双端校验、390px 检查 | 与既有铁规一致 |
| `scripts/`、`tests/`、CI | **不安装** | 与 RUDA 现有 `tests/*.test.ts` 体系重复 |

## 3. 与既有技能的整合（避免重复与冲突）

三个技能分工明确、互不重复：

| 技能 | 唯一职责 | 不做 |
| --- | --- | --- |
| `impeccable` | 设计工作流与命令（`audit`/`critique`/`polish`/`animate`…）+ 确定性检测器 `impeccable detect` | 不定义 RUDA 具体数值 |
| `redesign-existing-projects` | **既有页面**的诊断清单（Scan → Diagnose → Fix）与修复优先级 | 不做转化策略与文案结构 |
| `landing-page-design`（本技能） | **新建转化页**的诉求收敛、结构与文案（Part A）；所有前端改动的工艺值（Part B） | 不诊断既有页面，不重排既有结构 |

冲突消解规则（写进三个技能的显式条款）：

1. `AGENTS.md` > `docs/engineering/design-values.md` > 模块文档 > 现有代码 > 技能。
2. 具体数值（字体、色值、圆角、动效）只在 `design-values.md` 维护一份；两个技能里的 Design Values 是摘要，并在文件内注明权威来源。
3. 同一页面同时适用时：先跑 `redesign-existing-projects` 诊断，再按 `landing-page-design` Part B 取值，最后用 `impeccable detect` 验收。
4. 明确不重复的内容：不用 `landing-page-design` 重新诊断页面（那是 redesign 的活），不用 `redesign-existing-projects` 决定转化结构（那是本技能的活）。

## 4. 安装内容

| 路径 | 内容 |
| --- | --- |
| `.agents/skills/landing-page-design/SKILL.md` | RUDA 适配版技能（`version: 1.0.0-ruda`） |
| `.agents/skills/landing-page-design/LICENSE.md` | 上游 MIT 许可 |
| `.claude/skills/landing-page-design/` | 与 `.agents` 完全一致的副本 |
| `docs/engineering/design-values.md` | **设计值唯一权威表**（三个技能共同引用） |
| `tests/design-skills-consistency.test.ts` | 机械校验技能与令牌不漂移 |

纯 Markdown，无脚本、无二进制、无 npm 依赖、不写系统级配置。

## 5. 使用方式（以后必须主动调用）

前端任务开始时按下表路由，不需要用户提醒：

| 任务 | 必读 |
| --- | --- |
| 新建落地页 / 入驻页 / 注册页 / 活动页 / 独立站首页 | `landing-page-design` Part A → B |
| 修改既有页面、说"很廉价/很 AI/不统一" | `redesign-existing-projects`（先诊断）+ Part B |
| 任何前端 UI 实现 | `impeccable`（工作流）+ `design-values.md` |
| 交付前 | `impeccable detect <改动目录>` |

## 6. 验证

- 已执行：`git clone` 与逐文件阅读上游；三份技能 Design Values 与 `src/index.css`、`mobile-design-system.css` 逐项比对；frontmatter YAML 可解析；`.agents` 与 `.claude` 副本 `diff -q` 一致。
- 已执行：`tests/design-skills-consistency.test.ts`（新增，见第 9 节）。
- 未执行：任何页面的视觉改动。本批只做技能研究、适配、安装与文档；试点页面另行提交，验收后再推广。

## 7. 渐进式优化流程（写进 §16）

```
Scan → Diagnose → Prioritize → Improve → Verify
```

- **Scan**：定位现有实现、设计令牌、相邻页面、影响端。
- **Diagnose**：只记录真实缺陷，不把"和上游不一样"当缺陷。
- **Prioritize**：明显缺陷 > 低质量细节 > 观感微调；已经合格的页面不动。
- **Improve**：一次一个分区/组件，小步 diff。
- **Verify**：`tsc` + 相关测试 + 真实截图（桌面 1440 / 平板 820 / 手机 390）+ `impeccable detect`。

## 8. 风险与回滚

- 风险：代理可能把上游的"重做首页 / 换图标库 / 加渐变 / 加浮动导航"当授权。已通过「硬性禁止」章节与 `AGENTS.md` §5.6 双重约束。
- 风险：三个技能同时输出建议导致重复劳动。已用第 3 节分工表与第 5 节路由表限定。
- 风险：数值漂移。已用 `tests/design-skills-consistency.test.ts` 机械拦截。
- 回滚：删除 `.agents/skills/landing-page-design/`、`.claude/skills/landing-page-design/`，撤销 `AGENTS.md` §5.6、§16 对应条款、本文件与一致性测试即可，无运行时影响。

## 9. 视觉试点（第一批）

按 `AGENTS.md` §16.5「先试点、确认效果后再推广」，本批只动前台首页相关组件，覆盖两个构建目标（`frontend-web` / `frontend-mobile`，同一 `MobileEditorialHome` 组件）。

| 项 | 改动 | 对应审计问题 |
| --- | --- | --- |
| 裂图回落 | `ProductImage` 的 `FALLBACK_IMAGE` 由 `/pwa-512x512.png`（黑底金色 R）改为中性 SVG 占位（`#f5f3ef` 底 + `#d9d5cc` 线框） | 审计 #2：生产 8 张商品卡中 4 张显示品牌图标 |
| 桌面栅格 | `mobileEditorialHome.css` 新增 `@media (min-width: 1024px)`：中等块 4 列、大块 2 列；单张「大图」块用 `:has(> :only-child)` 转 16:9 横向版位 | 审计 #1：1376px 单图 + 4px 缝隙 + 三档视口同一栅格 |
| 商品卡文案 | `EditorialProduct` 补渲染商家名、商品名、批发价、起订量（复用 CSS 中已有但未使用的 `__details/__brand/__name/__price/__moq`） | 审计 #3：首页商品卡零文字 |
| 手机端间距 | 中等块 `gap: 10px 4px` → `24px 10px` | 审计 #1 的移动端表现 |
| 字号底线 | 卡片商家名 12px、商品名 14px、起订量 12px（原 9/12/10px） | 审计 #5：8–11px 泛滥 |
| 文案兜底 | `getLocalizedProductName` 清理 `【】〔〕[]`，清空后回落 `Articolo RUDA`；价格 ≤0 时显示「价格面议 / Prezzo su richiesta」 | 上线后发现 demo 商品渲染成 `【】 | €0.00`，属既有 i18n 清理漏洞 |
| 主导航 | `Header` 导航项 `text-[10px] tracking-[0.16em]` → `text-xs tracking-[0.08em]` + `pt-1`（命中区 ≥24px） | 审计 #4 / 触控目标 |

验证（本地 `PORT=4100 npm run dev`，真实数据库只读）：

- 1440：中等块 `4×329px`、沟槽 `32/20px`；大块单图 `16/9`。
- 1024：中等块 `4×225px`；无导航溢出。
- 390：中等块 `2×161px`、沟槽 `24/10px`；卡片文案完整。
- 导航 12px、10 项、无横向溢出，桌面端 10 个目标均 ≥24px。

**未做**（留待确认后第二批）：

- 首页可见 H1 与品牌主张、首屏 CTA（涉及文案决策，不擅自新增）。
- `HomeView` 中 690 行 `hidden` 旧首页下线。
- 目录/找店/趋势/About 页的对比度、颜色收敛与多语言。
- 商家后台核心页与商家手机端试点（生产 `INDUSTRY_DEMO_LOGIN_ENABLED` 未开启，缺少可登录的测试商家账号）。

### 9.1 商家后台试点（第三端，未发布）

按 `AGENTS.md` §15.5「改动前先记录基准截图」，已取得可识别的旧版基准：`evidence/design-pilot-2026-10-31/merchant-admin-baseline-{desktop,mobile}.png`（生产 `ruda.fashion/merchant`，演示商家 001）。

| 项 | 改动 | 依据 |
| --- | --- | --- |
| 侧边栏/头部商家 Logo | `MerchantPortal.tsx` 两处 `<img src={merchantLogo}>` 补 `onError` 回落 `DEFAULT_MERCHANT_LOGO`，与商家手机端 `MerchantMobileApp.tsx:2086` 的既有写法一致 | 基准截图显示桌面端 Logo 为浏览器裂图图标，手机端已正确显示品牌默认图；三端必须一致 |

- **不改**：仪表盘布局、胶囊型搜索/快捷操作/KPI 卡片、侧边栏层级、AI 助手栏。§15.5 明确锁定这些既有风格，任何胶囊↔直角、圆角与阴影的调整需产品单独确认后再做。
- 验证：`tsc` 通过；商家手机端在本地 `PORT=4100` 实测渲染正常、0 张裂图。
- **待验证**：商家电脑端本地开发环境存在与本次改动无关的 `crypto.randomUUID is not a function` 渲染错误（http 非安全上下文导致），加上发布范围只授权了前台，**商家后台未发布、桌面端视觉未在线上验证**。

### 9.2 发布范围与回滚

- 已发布：`frontend-web`、`frontend-mobile` 两个 release（`scripts/publish-app.ts` 切换 `current.json`，保留 `current.previous.json`）。
- 未发布：`merchant-admin-*`、`platform-admin-*`，服务端 `dist/server.cjs` 未重建。
- 回滚：把 `dist/apps/<target>/current.previous.json` 复制回 `current.json`，或重新 `publish-app` 上一版本 releaseId；无数据库变更。

## 10. 机械检查说明

`tests/design-skills-consistency.test.ts` 断言：

1. `design-values.md` 的圆角表与 `src/index.css` / `mobile-design-system.css` 实际值一致；
2. 两个技能文件均出现 `cubic-bezier(0.22, 1, 0.36, 1)`、`#201e1a`、`lucide-react`、`--radius-ruda-card`；
3. 任一技能文件不得出现被禁用的上游值（`Phosphor`、`Iconamoon`、`#131209`、`heading-1` 新类名）；
4. 两个技能文件与 `docs/engineering/design-values.md` 都存在且非空。

执行：`node --import tsx --test tests/design-skills-consistency.test.ts`。

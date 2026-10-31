---
name: redesign-existing-projects
description: "Audits and upgrades EXISTING RUDA interfaces in place: diagnoses generic AI design patterns, missing states and sloppy frontend code, then applies targeted fixes inside the current stack. Use when the user says a page, screen or component looks cheap, generic, AI made, unfinished or inconsistent. Real RUDA design values (fonts, neutral palette, radius tokens, lucide icons, motion curve) are baked into the Design Values section, and RUDA engineering rules override this skill wherever they conflict. Not for backend-only tasks."
metadata:
  version: 1.0.0-ruda
  upstream: https://github.com/elayadesign/redesign-skill
  adapted: 2026-10-31
---

# Redesign Existing Projects（RUDA 适配版）

This skill is a **diagnostic**. It finds what is wrong with an existing interface and fixes it in place.

This is the RUDA-adapted fork of [`elayadesign/redesign-skill`](https://github.com/elayadesign/redesign-skill). The audit structure is upstream; **the Design Values section below was replaced with RUDA's real tokens** (from `src/index.css`, `src/apps/shared/mobile-design-system.css`, `docs/engineering/mobile-design-system.md`). Nothing here authorises redesigning RUDA.

## RUDA 覆盖规则（优先级最高）

冲突时按以下顺序处理，本技能不得越过：

1. `AGENTS.md`（全站工程铁规），特别是 §5 UI/文字、§15 商家三端联动与 §15.5 七行业后台 UI 锁定、§16 前端任务自动调用 Impeccable。
2. `docs/engineering/mobile-design-system.md`（手机端令牌）、`docs/engineering/modules/merchant-admin-ui-audit.md` 等现有 UI 权威文档。
3. 现有代码中的设计系统实现（`src/index.css` 的 `@theme`、共享组件）。
4. 本技能的审计条款。

由此产生的硬性限制：

- **禁止重做界面**：不得更换主题、重排导航、替换后台外壳、改写首页结构。§15.5 锁定的顶部栏、侧边导航层级、主内容区和右侧 AI 助手栏必须原样保留。
- **禁止引入新依赖**：不新增字体包、图标包、动画库或 CSS 框架；只用 `package.json` 已有依赖。
- **禁止擅自新增颜色**：RUDA 只有一套黑白/暖中性灰 + 单一深色 accent；不得出现金色、紫色/蓝色 AI 渐变或第二个强调色。
- **禁止批量重排历史代码**：仓库里已有大量历史 `text-[13px]` 一类写法与例外；本技能只约束**本次新写或改动的代码**，不得做全仓格式化、批量替换或顺手重构。
- **必须使用 `lucide-react`**：不得按上游“替换 Lucide”条款换图标库。
- **先诊断、后修改**：先输出诊断清单让用户确认范围，再按修复优先级动手。
- 小程序（`merchant-miniprogram/`、`miniprogram/`）使用 WXSS/rpx 体系，令牌按 rpx 等价换算，不引入 Web 构建产物。

## Design values

**权威来源**：`docs/engineering/design-values.md`。本文件末尾的 Design Values 是执行摘要；若与文档不一致，以文档为准并修正本文件（`tests/design-skills-consistency.test.ts` 会拦截漂移）。

All concrete values (fonts, colors, spacing, radius, icons, motion timing) live in the **Design Values** section at the bottom of this file. The audit below tells you *what to look for*; Design Values tells you *what to replace it with*.

**与其它技能的边界**：本技能只做「既有页面诊断 + 原地修复」。新建落地页的诉求收敛、结构与文案用 `.agents/skills/landing-page-design/SKILL.md`（Part A）；工作流与确定性检测用 `.agents/skills/impeccable/`。不要在本技能里重复转化策略，也不要在 landing 技能里重复诊断。

Never invent a font, hex value, spacing number, radius, or easing curve that is not in Design Values. If a situation is not covered there, ask rather than guessing.

To adapt this skill to a different design system, edit only the Design Values section. The entire audit follows it automatically.

## How this works

1. **Scan** — Read the codebase. Identify the target app (there are six Web build targets plus two mini programs), the styling method (`src/index.css` Tailwind v4 `@theme`, portal CSS, or WXSS), and the current patterns. Check `git status` first and preserve uncommitted work.
2. **Diagnose** — Run the full audit below. List every generic pattern, weak point, and missing state you find. Report before fixing.
3. **Fix** — Apply targeted upgrades inside the existing stack, in the Fix Priority order. Do not rewrite from scratch. Improve what is there.

---

# Design audit

## Typography

- **Browser default fonts, or a font outside the approved stack.** Use the RUDA font stack from Design Values; never add a new `@fontsource` package to change a look.
- **Italic type anywhere.** Avoid it; use weight, size, or colour for emphasis. Existing `italic` occurrences outside your change are legacy, not a target.
- **Ultra bold weights (800, 900, black) in new or changed code.** Cap at semibold or bold.
- **Only Regular (400) and Bold (700) in use.** Introduce Medium (500) and SemiBold (600) for finer hierarchy.
- **Headlines lack presence on marketing surfaces.** Increase display size and tighten letter spacing so headlines feel intentional, but keep portal/dashboard headings at their existing hierarchy.
- **Body text too wide.** Cap paragraph measure at roughly 65 characters (Chinese copy: about 30–40 characters per line on mobile).
- **Numbers in a proportional font.** Enable `font-variant-numeric: tabular-nums` for prices, quantities, inventory and any data table.
- **Missing letter spacing adjustments.** Negative tracking on large headings, positive tracking on small uppercase labels.
- **All caps subheaders everywhere.** Switch to sentence case; Chinese labels stay as they are.
- **Arbitrary or off-scale font sizes in new or changed code.** Resolve new sizes to the Tailwind type scale in Design Values. Do not "fix" historical `text-[Npx]` usages that you did not otherwise touch.
- **Buttons with off-scale type.** Main buttons `text-base` semibold; header and toolbar buttons `text-sm` semibold.
- **Chinese text rendered without a CJK fallback.** Always keep the CJK fallbacks from Design Values so text never falls back to a Latin-only face.

## Color and surfaces

- **Background colours outside the approved neutral scale.** RUDA is a light warm-paper system (`#fbfaf8` base). Snap surfaces to the approved values; never substitute `#fff`, `#f3f4f6`, `#0a0a0a` or a tinted navy.
- **Gradient backgrounds of any kind.** Backgrounds are flat. Remove linear, radial and mesh background gradients.
- **Gradient text on headings.** RUDA has no gradient text. Upstream's "hero heading gradient" rule does not apply here; achieve presence with size, weight and spacing.
- **The purple and blue "AI gradient" aesthetic.** The most common AI fingerprint. Replace with the flat neutral base and the single RUDA accent.
- **More than one accent colour.** RUDA has exactly one accent (`#201e1a`) plus semantic status colours. Remove decorative extras.
- **Gold, metallic or brand-adjacent invented colours.** Never introduce them.
- **Colour used to encode status without text.** Status must stay readable in text and in the status tag pattern, not colour alone.
- **Mixing warm and cool grays.** The RUDA neutral ramp is warm; commit to it.
- **Generic `box-shadow`.** Shadows stay subtle and tinted toward the warm background; no large ambient glow, no coloured shadow.
- **Dark sections dropped into a light page.** Avoid them unless the page already uses one deliberately.
- **Low-contrast secondary text.** `#777167` on `#fbfaf8` is the floor for body text; do not go lighter for information the user needs.
- **A random dark surface inside a portal page.** Portals stay on paper; only fixed dark utility elements already in the design (primary buttons, logo mark) may be dark.

## Layout

- **Everything centered and symmetrical on marketing pages.** Break symmetry with offset margins, mixed aspect ratios, or a left aligned header over centered content.
- **Three equal card columns as the feature row.** The most generic AI layout. Three to five benefits is correct as *content*; the *layout* should be a two column zig zag, an asymmetric grid, or horizontal scroll.
- **`height: 100vh` on full screen sections.** Replace with `min-height: 100dvh` to stop layout jump on iOS Safari and in the Capacitor shells.
- **Complex flexbox percentage math.** Replace with CSS Grid.
- **No max width container on marketing pages.** Constrain around 1200 to 1440px with auto margins; hero heading and subheading cap at 680px.
- **Cards forced to equal height by flexbox.** Allow variable heights when content length varies; align the shared elements instead (see below).
- **Radius chosen by feel.** Every radius comes from the RUDA radius tokens. When a shape sits inside another and the gap is under 32px, the inner radius equals the outer radius minus the gap, applied only when the result is greater than 2 and the value exists in the token set.
- **Spacing values invented ad hoc.** Every margin, padding and gap resolves to the approved spacing scale.
- **Symmetrical vertical padding.** Adjust optically; bottom padding usually needs slightly more.
- **Missing whitespace.** Step up one level on the spacing scale and let it breathe on marketing surfaces. Dense layouts suit data dashboards, not marketing pages.
- **Buttons not bottom aligned in card groups.** Pin CTAs to the bottom of each card so they form one clean horizontal line.
- **Feature lists starting at different vertical positions.** In pricing and comparison columns, lists must start at the same Y position.
- **Inconsistent vertical rhythm across side by side elements.** Align titles, descriptions, prices and buttons across all items.
- **Mathematical alignment that looks optically wrong.** Icons beside text, play buttons in circles, and text in buttons often need one or two pixels of optical correction.
- **Restructuring the merchant portal shell.** Forbidden. Dashboard-sidebar "improvements" from upstream (top navigation, floating command menu) do not apply to `merchant-admin-*` or `platform-admin-*`; see `AGENTS.md` §15.5.

## Interactivity and states

- **Default easing curves.** `ease`, `linear` and `ease-in-out` make motion feel mechanical. Use the RUDA base curve from Design Values.
- **Durations under 200ms.** Movement 300–520ms, colour and opacity 200–300ms.
- **Content that is simply there on scroll on marketing pages.** Marketing sections may rise a short distance and fade in once as they enter the viewport; dashboards should not animate every panel.
- **Scroll listeners driving animation.** Replace `window.addEventListener('scroll')` with `IntersectionObserver` or `whileInView`; per frame listeners cost real performance on mobile.
- **A nav bar welded to the top edge on marketing pages.** Marketing nav may float slightly; portal and admin navigation keeps its locked structure.
- **A menu icon that swaps instantly.** Animate the change between open and closed states on the base curve.
- **No reduced motion handling.** Under `prefers-reduced-motion`, swap movement for a plain fade or none. Existing RUDA animations already do this; keep the pattern.
- **No hover states on buttons.** Add a background shift, slight scale, or translate.
- **No active or pressed feedback.** Add `scale(0.98)` or `translateY(1px)` on press.
- **Missing focus ring.** RUDA's focus colour is in Design Values; visible focus indicators are an accessibility requirement, not a style choice.
- **No loading states.** Use skeleton loaders shaped like the real layout instead of circular spinners.
- **No empty states.** Design a composed "getting started" view instead of a blank panel.
- **No error states.** Inline, specific errors. Never `window.alert()`, never raw API messages or stack traces.
- **No permission state.** RUDA has real role and tenant boundaries: pages must show a clear no-permission state instead of a broken or empty screen.
- **Dead links.** Buttons pointing at `#`. Link them or visually disable them.
- **No current page indicator in navigation.** Style the active link distinctly, using the existing navigation components.
- **Scroll jumping.** Add `scroll-behavior: smooth` for anchor navigation (already global; do not re-declare per page).
- **Animating `top`, `left`, `width` or `height`.** Switch to `transform` and `opacity`.
- **Double submitting forms.** Disable the primary action while a request is in flight and surface the server result, not an optimistic guess.

## Content

- **Placeholder people and samples.** No "Acme", "张三示例", Lorem Ipsum or obviously fake data in shipped UI; use realistic RUDA domain copy (面料、尺码、批次、价格).
- **Suspiciously round numbers.** Real metrics carry decimals and odd final digits; real prices look like real pricing.
- **Filler marketing words.** Cut "revolutionize", "supercharge", "cutting edge", "effortless", and Chinese equivalents such as「赋能」「一站式解决方案」「极致体验」. Say what the product actually does.
- **Vague value propositions.** "Streamline" and "optimize" say nothing. Replace with a measurable outcome.
- **Features listed with no outcome.** Every feature line should state what it means for the user.
- **Weak CTAs.** Never "Learn more" or "Submit". Use a verb plus what they get.
- **Competing CTAs above the fold.** One primary action per page.
- **Loud or cute system messages.** Confirmations should be calm and specific; errors should name what failed and the next step. No exclamation marks.
- **Passive voice.** Name who did what.
- **Placeholder text.** Any "Your headline here" or Latin filler is a blocker.
- **Extra introductory copy.** RUDA forbids filler intros and repeated explanations under a title; if the title already says what the section is, do not restate it.
- **Inconsistent terminology.** One name per business object, status and action across all ends. The merchant AI employee is always **ModaUI** (never the retired product name). Admin navigation levels use the confirmed four-character names.
- **Mixed languages.** User-facing copy stays Simplified Chinese unless the product explicitly ships another locale.

## Component patterns

- **Generic card look: border plus shadow plus white background.** Drop to background colour alone, or spacing alone. Cards exist only where elevation communicates hierarchy.
- **Border on a single side of a card.** Never. Borders go all the way around or not at all.
- **Always one filled button plus one ghost button.** Introduce text links or tertiary styles to cut visual noise.
- **Pill shaped "New" and "Beta" badges.** Only status tags may be pill shaped (and only where the existing pattern is); prefer square badges or plain labels.
- **Accordion FAQ.** If an FAQ is needed, keep six to twelve questions and consider a side by side list or inline progressive disclosure.
- **Three card carousel testimonials with dots.** Replace with a masonry wall, embedded social posts, or one rotating quote.
- **Pricing table with three towers.** Emphasize the recommended tier with weight, not extra height.
- **Modals for everything.** Use inline editing, slide over panels, or expandable sections for simple actions.
- **Avatar circles exclusively.** Try squircles or rounded squares.
- **Light and dark toggle as a sun and moon switch.** Not applicable: RUDA has no dark theme. Do not add one.
- **Four column footer link farm.** Simplify to main paths plus legally required links.
- **Duplicating a shared component.** Search `src/apps/shared/`, `src/apps/merchant-admin-common/`, `src/apps/platform-admin-common/` first; extend the shared component instead of forking it per module.

## Iconography and imagery

- **Icon sets other than `lucide-react`.** RUDA standardises on lucide; do not introduce Phosphor, Solar, Iconamoon, Material or emoji as functional icons.
- **Inconsistent stroke widths.** RUDA line icons use `stroke-width: 1.7`; sizes follow Design Values.
- **Icons with circular backgrounds for ordinary actions.** The existing pattern is a square control at the control radius.
- **Rocketship for "Launch", shield for "Security".** Replace cliche metaphors with bolt, fingerprint, spark, vault.
- **Missing favicon / app icon.** Always ship a branded one per build target.
- **Stock "diverse team" photos.** Use real product photos (garments, fabric, workshop) or one consistent illustration style.
- **Missing alt text.** Every `<img>` needs meaningful alt; decorative images use `alt=""`.

## Code quality

- **Div soup.** Use `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`.
- **Inline styles mixed with classes.** Move everything into the project's styling system (Tailwind utilities, shared CSS, or WXSS).
- **Hardcoded pixel widths.** Use `%`, `rem`, `em`, `max-width`, or rpx in mini programs.
- **Arbitrary z index like `9999`.** Establish the value in the theme.
- **Commented out dead code and debug artifacts.** Remove them from the files you touch.
- **Import hallucinations.** Verify every import exists in the project dependencies before using it.
- **A second API client, auth flow or data source.** Forbidden. Use `src/api/client.ts` and the existing services; a redesign never justifies a parallel implementation.
- **Duplicate business rules in the UI.** Order state, stock availability, pricing and permissions come from the server; do not recompute them per page.
- **Missing meta tags.** Add `<title>`, description, `og:image` and social tags where the build target supports them.

## Strategic omissions

What AI builds typically forget entirely:

- **No legal links.** Privacy policy and terms in the footer where the surface requires them.
- **No back navigation.** Every page needs a way out.
- **No custom 404.** Design a branded, helpful one.
- **No form validation.** Client side checks for required fields and formats, with server-side enforcement kept intact.
- **No skip to content link.** Important for keyboard users on dense portals.
- **No cookie consent.** Add a compliant banner where the jurisdiction requires it.

---

# Fix priority

Maximum visual impact, minimum risk, in this order:

1. **Font and token compliance** — snap to the RUDA stack and tokens, lowest risk
2. **Colour and surface cleanup** — approved neutrals, remove invented colours and gradients
3. **Hover, active and focus states** — makes the interface feel alive
4. **Layout and spacing** — grid, max width, spacing scale, nested radius formula
5. **Motion pass** — base easing curve, tasteful reveals, reduced-motion coverage
6. **Replace generic components** — swap cliche patterns for the alternatives above
7. **Loading, empty, error and no-permission states** — makes it feel finished
8. **Copy pass** — remove cliches, add specificity, fix CTAs, keep terminology consistent
9. **Type scale polish** — the premium final touch

---

# Rules

- Work with the existing tech stack (React 19, Tailwind v4 via `@tailwindcss/vite`, portal CSS, WXSS). Do not migrate frameworks or styling libraries.
- Do not break existing functionality. Test after every change.
- Report the diagnosis before applying fixes. Let the user veto items.
- Check `package.json` before importing any new library; adding a dependency requires explicit approval.
- Tailwind is v4: theme values live in `src/index.css` under `@theme`; do not create a `tailwind.config.js`.
- Any change to merchant code must cover web, mobile and mini program (see `AGENTS.md` §15); a single-end fix is an incomplete fix.
- Keep changes reviewable and focused. Small targeted improvements over big rewrites.
- Never invent a design value. If it is not in Design Values, ask.
- After finishing UI edits, run `.agents/skills/impeccable/scripts/impeccable detect <changed dirs>` and require a clean result or a documented, justified exemption.

---

# Design values

The single source of truth for this skill. These are RUDA's real values; edit only with evidence from the design system.

**Fonts (only what is installed):**

| Token | Family | Where |
| --- | --- | --- |
| `--font-sans` | `Manrope Variable`, Manrope, Noto Sans CJK SC, PingFang SC, Microsoft YaHei | All portals, all body copy |
| `--font-serif` | `Bodoni Moda Variable`, Bodoni Moda, Didot, Noto Serif CJK SC, Songti SC | Buyer-facing display only |
| `--font-editorial` | `Cormorant Garamond Variable`, Cormorant Garamond, Noto Serif CJK SC, Songti SC | Buyer-facing editorial only |

Merchant, employee and platform-admin portal themes force `--font-serif` and `--font-editorial` back to the sans stack: back office text is always sans. No italics. No weights above bold. Never re-introduce Inter except in the already-exempted `src/apps/shared/components/frontend/mobileEditorialHome.css`.

**Surfaces and text (warm neutral ramp):**

| Token | Value | Use |
| --- | --- | --- |
| `neutral-50` / `--ruda-paper` | `#fbfaf8` | Page and card background |
| `neutral-100` | `#f5f3ef` | Subtle fill, accent-soft, hover surface |
| `neutral-200` / `--ruda-line` | `#e9e6df` | Borders, dividers |
| `neutral-300` | `#d9d5cc` | Strong divider, disabled fill |
| `neutral-400` | `#aaa49a` | Disabled text, placeholder |
| `neutral-500` / `--ruda-focus` | `#777167` | Secondary text, focus ring |
| `neutral-600` | `#5e594f` | Muted body |
| `neutral-700` | `#454139` | Strong secondary |
| `neutral-800` | `#302d27` | Near-primary text |
| `neutral-900` / `--portal-accent` | `#201e1a` | Primary text and the single accent |
| `neutral-950` / `--ruda-ink` | `#12110f` | Headlines |

**Accent:** exactly one, `#201e1a`, with `--portal-accent-soft #f5f3ef` and `--portal-accent-contrast #ffffff`. Status colours are semantic only. No gold, no purple/blue gradient, no second accent. No dark theme exists; do not add one.

**Gradients:** none. Backgrounds and headings are flat.

**Spacing:** Tailwind default scale. Buttons on mobile: 36px default, 40px primary. Inputs and search: 40px. Cards: 12px padding, 10–12px gap. Main buttons on web: 8px vertical, 12px horizontal padding, 36–40px height.

**Radius:** the RUDA token set only.

| Token | Web | Mobile |
| --- | ---: | ---: |
| `--radius-ruda-control` | 2px | 6px |
| `--radius-ruda-card` | 2px | 8px |
| `--radius-ruda-input` | 2px | 6px |
| `--radius-ruda-modal` | 2px | 10px |
| `--radius-ruda-tag` | 2px | 4px |

Nested shapes under a 32px gap use `inner = outer − gap`, applied only when the result exceeds 2. Never use `rounded-xl`/`rounded-3xl` or invented radii; only status tags may be pill shaped.

**Icons:** `lucide-react` only, `stroke-width: 1.7`. Sizes: 18px default, 20–22px bottom navigation, 16–18px dense tables. Icon buttons 36×36px at the control radius.

**Motion:** base curve `cubic-bezier(0.22, 1, 0.36, 1)`. 300ms for navigation and panel movement, 480–520ms for entrance animations, 200–300ms for colour and opacity. Scroll reveals on marketing surfaces only, via `IntersectionObserver`. Always respect `prefers-reduced-motion`. Never animate `top`, `left`, `width` or `height`.

**Type scale:** Tailwind default.

| Class | Size | Line height |
|---|---|---|
| `text-xs` | 12px | 16px |
| `text-sm` | 14px | 20px |
| `text-base` | 16px | 24px |
| `text-lg` | 18px | 28px |
| `text-xl` | 20px | 28px |
| `text-2xl` | 24px | 32px |
| `text-3xl` | 30px | 36px |
| `text-4xl` | 36px | 40px |
| `text-5xl` | 48px | 1 |
| `text-6xl` | 60px | 1 |
| `text-7xl` | 72px | 1 |
| `text-8xl` | 96px | 1 |
| `text-9xl` | 128px | 1 |

---

## Credits

Adapted from [elayadesign/redesign-skill](https://github.com/elayadesign/redesign-skill) (MIT, © 2026 Elaya); its design values were replaced with RUDA's own tokens. Upstream in turn adapted parts of [taste-skill](https://github.com/Leonxlnx/taste-skill) by Leon Lin (MIT). See `LICENSE.md` in this directory for both licences.

<details>
<summary>taste-skill license</summary>

```
MIT License

Copyright (c) 2026 Leonxlnx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
</details>

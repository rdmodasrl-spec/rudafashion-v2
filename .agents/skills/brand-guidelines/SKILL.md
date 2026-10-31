---
name: brand-guidelines
description: "RUDA 品牌应用规则：把已确定的字体、中性色阶、单一强调色、圆角与图标体系落到具体产物的使用方式上（用在哪里、比例多少、什么时候不该用）。数值不在此文件维护，统一以 docs/engineering/design-values.md 为准。用于新建页面、商家店铺模板、对外文档与物料时确认「这是不是 RUDA」。"
license: Apache-2.0（见同目录 LICENSE.txt）
metadata:
  version: 1.0.0-ruda
  upstream: https://github.com/anthropics/skills
  upstream_skill: brand-guidelines
  adapted: 2026-10-31
---

# RUDA Brand Guidelines

Adapted from Anthropic's `brand-guidelines` (Apache-2.0). 上游固定写死的 Anthropic 配色与字体已全部删除（Poppins / Lora / `#d97757` / `#141413`），**这些值对 RUDA 一律不适用**。 This adaptation keeps the *structure* — "brand identity is applied, not reinvented" — and replaces every value with RUDA's own.

## 数值来源

**不在本文件复制色值表。** 唯一权威：

- `docs/engineering/design-values.md` —— 字体栈、中性色阶、字号、间距、圆角、图标、动效、响应式基线。
- `src/index.css` 的 `@theme` —— 运行时令牌。
- `PRODUCT.md` —— 产品事实（用户、定位、约束、品牌承诺），**不是**视觉规范。

本文件回答的是「怎么用」，不是「用什么值」。两者冲突时以 `design-values.md` 与代码为准。

## 品牌是什么

- **RUDA** 是意大利多商户时装批发平台，服务采购商、商家与平台运营。
- 品牌承诺：正规、可核验、有审美。不是"潮流""炫技""AI 感"。
- 视觉基调：**暖中性纸感 + 墨黑**。黑白为主，灰是暖灰，强调色只有一个深墨色；靠排版、留白与真实图片建立高级感，不靠颜色与特效。
- 唯一对外产品名：商家 AI 员工叫 **ModaUI**。

## 颜色使用规则

| 角色 | 规则 |
| --- | --- |
| 纸（页面底） | 默认；任何页面不得整块换成纯白或冷灰 |
| 墨（文字/主色） | 标题、主按钮、Logo 底。唯一强调色 |
| 线（边框/分割） | 只用于结构，不用于装饰性描边 |
| 灰阶文字 | 次要信息可用，但必须满足对比度（深底不用 `neutral-500` 压字） |
| 状态色 | 仅语义（成功/警告/失败/缺货），不做装饰 |

禁止：金色、古铜、紫蓝渐变、第二强调色、渐变背景、渐变文字、深色主题。

**例外与边界**：商家独立店铺的「豪华版 · 黑金」模板（`luxury_black_gold`，`#c9a96e`）是商家可选的产品能力，金色**只能存在于该店铺页面范围内**，不得外溢到平台其他页面、后台或全局组件。

## 字体使用规则

- 正文与界面：`--font-sans`（Manrope + CJK 回退）。后台一律用它。
- 买家侧展示：`--font-serif`（Bodoni Moda）用于标题与品牌字标。
- 编辑体：`--font-editorial`（Cormorant Garamond）只用于买家侧主题内容。
- 不换字体、不加字体包、不用斜体、不用 800/900。

## 版面与形状

- 圆角只用 `--radius-ruda-*`（Web 2px / 手机 6-8-6-10-4）。**不新建 `rounded-2xl` 风格**。
- 卡片只在表达层级时出现；不做"每个字段一张卡"。
- 边框四周闭合或不用；禁止单边描边。
- 间距用 Tailwind 默认刻度；正文与标签 ≥12px。

## 图标与影像

- 图标只用 `lucide-react`，线宽 1.7，尺寸 18 / 20–22 / 16–18。
- 影像只用真实服装、面料、门店、工厂；不用无关模特图、不用 AI 生成图冒充实拍。
- 空状态、错误状态按 `design-values.md` 第 5 节处理。

## 文案声音

- 简体中文为默认；面向欧洲买家用意大利语。同一页面不得混排（已知缺陷见审计报告）。
- 陈述句，不用感叹号；不用「赋能」「一站式解决方案」「极致体验」。
- 错误说清原因与下一步；确认语平静具体。
- 术语全站统一；同一业务对象只有一个名字。

## 应用检查

在交付前回答：

1. 这个界面**只**用了上面列出的颜色、字体、圆角、图标吗？
2. 拿掉颜色之后，层级还成立吗（靠字号/字重/间距）？
3. 有任何一个元素是为了"显得高级"而加的装饰吗？删掉它会不会更好？
4. 深底上的每一个字都读得清吗？
5. 商家店铺模板里的金色是否只出现在该店铺？

任何一项答不上来，就不要声称"符合品牌规范"。

## Credits

Adapted from [anthropics/skills](https://github.com/anthropics/skills) `brand-guidelines`, Apache License 2.0 (© Anthropic, PBC). All Anthropic-owned brand values were removed; RUDA values come from this repository.

# Redesign 设计审计技能接入（redesign-existing-projects）

- 文档状态：部分完成（技能已安装并改写到 RUDA 设计令牌；尚无真实页面的审计执行记录）
- 执行日期：2026-10-31
- 适用范围：仓库根 `.agents/skills/redesign-existing-projects/`、`.claude/skills/redesign-existing-projects/`、`AGENTS.md` §5.5、本文件。
- 不涉及：运行时代码、构建目标、API、数据库、权限、部署。

## 1. 问题与目标

现有 Impeccable 技能解决「有没有设计方法」和「有没有确定性检测」，但缺少一套面向**已有界面**的逐项审计清单（字体、颜色、布局、状态、文案、组件套路、代码质量）。上游 [`elayadesign/redesign-skill`](https://github.com/elayadesign/redesign-skill)（MIT）提供了这份清单。

目标：

1. 在仓库内提供可被 AI 代理读取的 `redesign-existing-projects` 技能。
2. 把上游的「Design Values」（深色调色板、Inter 替换、标题渐变、Phosphor 图标、Tailwind 刻度强约束）替换为 RUDA 真实令牌，避免代理按上游默认值改坏黑白/暖中性灰体系。
3. 明确写死 RUDA 覆盖规则，使该技能不能作为重做 UI、重排导航、引入新依赖的依据。

非目标：

- 不引入新的设计系统，不改 `src/index.css` 令牌，不批量重写页面。
- 不替代 `docs/engineering/mobile-design-system.md`、`docs/engineering/modules/merchant-admin-ui-audit.md`、`AGENTS.md` §5/§15.5/§16。
- 不改 `package.json`、构建脚本或 CI。
- 不做全仓 `text-[Npx]`、`italic`、`font-black` 的批量清理（历史存量，非本任务范围）。

## 2. 复用与防重复

| 检索项 | 结论 |
| --- | --- |
| 既有设计技能 | 复用 `.agents/skills/impeccable/`（24 个命令 + 确定性检测器）作为工作流与门禁；本技能只补充审计清单，不复制其命令体系 |
| 既有设计规范 | 复用 `docs/engineering/mobile-design-system.md`、`docs/engineering/modules/merchant-admin-ui-audit.md`、`AGENTS.md` §5；不新建第二套视觉规范 |
| 既有令牌 | 复用 `src/index.css` 的 `@theme`（`--font-*`、`--color-neutral-*`、`--radius-ruda-*`）与 `src/apps/shared/mobile-design-system.css` 的手机端覆盖 |
| 关键词检索 | `redesign-skill`、`redesign-existing-projects`、`design audit` 在本仓库无既有实现；`.agents/skills/` 下仅有 `impeccable` |
| 为什么新建 | Impeccable 是生成式设计工作流，不带「已有界面逐项审计」清单；上游清单需要按 RUDA 令牌改写后才能安全使用 |

## 3. 安装内容

| 路径 | 内容 |
| --- | --- |
| `.agents/skills/redesign-existing-projects/SKILL.md` | 改写后的技能（审计清单 + RUDA 覆盖规则 + RUDA Design Values） |
| `.agents/skills/redesign-existing-projects/LICENSE.md` | 上游 MIT 许可（© 2026 Elaya），taste-skill 许可已在 SKILL.md 内保留 |
| `.claude/skills/redesign-existing-projects/` | 与 `.agents` 完全相同的 `SKILL.md` + `LICENSE.md`，供 Claude Code 读取 |

- 技能只有 Markdown，无脚本、无 npm 依赖、无二进制，不写系统级配置。
- 两个目录内容必须保持一致；后续修改先改 `.agents`，再同步 `.claude`。

## 4. Design Values 改写记录

上游默认值与 RUDA 冲突，逐项替换（证据均为现有代码与文档）：

| 上游默认 | RUDA 实际 | 来源 |
| --- | --- | --- |
| Geist / Manrope / Poppins，禁 Inter | `Manrope Variable` 为全站 sans，CJK 回退 Noto Sans CJK SC / PingFang SC；Bodoni Moda、Cormorant Garamond 仅前台展示用；商户/员工/平台后台强制 sans | `src/index.css` `@theme` + `.portal-theme-*` |
| 深色调色板 `#000000`…`#131209` | 暖中性灰 `#fbfaf8` → `#12110f`，accent `#201e1a` | `src/index.css` 中性色阶与 portal 变量 |
| 标题渐变文字 | 无渐变；标题靠字号/字重/间距建立层级 | `AGENTS.md` §5.1，仓库内无 gradient 用法 |
| Tailwind 圆角刻度（`rounded-2xl` 等） | `--radius-ruda-control/card/input/modal/tag`，Web 2px、手机 6/8/6/10/4px | `src/index.css`、`src/apps/shared/mobile-design-system.css` |
| Phosphor / Solar / Iconamoon | `lucide-react` 唯一图标库，`stroke-width: 1.7`，18 / 20–22 / 16–18px | `docs/engineering/mobile-design-system.md` §4.3，`package.json` |
| 深色/浅色双主题 | 只有浅色纸感主题，无 dark mode | `src/index.css` 无 `.dark` / `prefers-color-scheme` |
| 可自由变更布局（含「后台别用左侧栏」） | 后台外壳、侧边导航、AI 助手栏锁定，禁止重排 | `AGENTS.md` §15.5 |
| 全量字体/尺寸规范化 | 只约束新写与本次改动的代码，历史 `text-[Npx]` 不批量清理 | `AGENTS.md` §0 小范围修改、§3.5 |

## 5. 使用方式

1. UI 任务的常规入口仍是 Impeccable：先读 `.agents/skills/impeccable/SKILL.md`，运行 `scripts/impeccable context`（见 `AGENTS.md` §16）。
2. 当用户说「这段界面很廉价/很 AI/不统一/帮我审计现有页面」时，追加读取 `.agents/skills/redesign-existing-projects/SKILL.md`，按 Scan → Diagnose → Fix 执行。
3. 诊断结果先报告，得到确认后按 Fix Priority 修改；冲突条款一律以 `AGENTS.md` §5/§15.5/§16 与既有设计文档为准。
4. 修改完成后仍必须运行 `.agents/skills/impeccable/scripts/impeccable detect <改动目录>`。

## 6. 验证

- 已执行：`git diff --check`（无空白错误）；两个目录 `SKILL.md` 内容一致；文档内引用路径均存在（`src/index.css`、`src/apps/shared/mobile-design-system.css`、`.agents/skills/impeccable/scripts/impeccable`）。
- 未执行：真实页面审计。该技能的产出依赖具体页面，本轮只安装与改写，未对任何应用执行审计，故状态为「部分完成」。
- 未执行：任何 UI 改动，因此未运行 `impeccable detect`（无改动目录可检测）。

## 7. 风险与回滚

- 风险：代理可能把上游条款（渐变标题、换图标库、重排后台外壳）当成授权。已通过「RUDA 覆盖规则」章节与 `AGENTS.md` §5.5 双重约束。
- 风险：两个技能同时被调用时重复输出诊断。约定 Impeccable 负责工作流与门禁，本技能只提供审计清单。
- 回滚：删除 `.agents/skills/redesign-existing-projects/` 与 `.claude/skills/redesign-existing-projects/`，并撤销 `AGENTS.md` §5.5 与本文件即可，无运行时影响。

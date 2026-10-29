# Impeccable 前端 UI 质量技能接入

状态：部分完成（已安装并通过 CLI 检测验证；代理内命令与 hooks 的实际触发待各工具内验收）。
执行日期：2026-10-28。
范围：仓库根 `.agents/skills/impeccable/`、`.claude/skills/impeccable/`、`.claude/settings.local.json`、`.codex/hooks.json`（如生成）、`.gitignore`、`AGENTS.md`。不涉及运行时代码、构建产物、API、数据库和部署。

## 1. 问题与目标

AI 代理写前端界面时容易复现同一批模板化痕迹（到处 Inter、紫蓝渐变、卡片套卡片、彩色底上的灰字、侧边色条），且缺少统一的设计评审词汇。RUDA 有六个 Web 构建目标、两个小程序和商家三端联动要求，UI 改动必须同时满足现有黑白/中性灰方向、四字导航、租户权限和跨端一致性。

目标：

1. 在仓库内提供一份可被 AI 代理读取的设计技能（24 个命令：`polish`、`audit`、`critique`、`distill`、`animate`、`bolder` 等）。
2. 提供一个不依赖大模型和 API Key 的确定性检测器，能对 `src/apps/**` 的 JSX/TSX/CSS 做 UI 反模式检查，并可作为改动后的自检门禁。
3. 把这些能力写进 `AGENTS.md`，让任何代理在改动前端 UI 前先读技能、改完先跑检测，而不是依赖某个编辑器是否自动加载。

非目标：

- 不引入新的设计系统、不改现有设计令牌、不批量重写现有页面样式。
- 不替代 `docs/engineering/mobile-design-system.md`、`docs/engineering/modules/merchant-admin-ui-audit.md` 等既有 UI 规范；本工具只提供评审方法与检测，RUDA 的视觉决定仍以现有文档和代码为准。
- 不接入 CI 强制门禁（检测结果先作为开发期自检，是否升级为 CI 阻断需单独评审）。
- 不引入运行时依赖，不改 `package.json` 运行脚本。

## 2. 复用与防重复

| 检索项 | 结论 |
| --- | --- |
| 既有设计规范 | 复用 `docs/engineering/mobile-design-system.md`、`docs/engineering/modules/merchant-admin-ui-audit.md`、`AGENTS.md` 第 5 节；不新建第二套视觉规范 |
| 既有共享组件 | 复用 `src/apps/shared/`、`src/apps/merchant-admin-common/`、`src/apps/platform-admin-common/`；工具只做检查，不生成平行组件 |
| 既有检测/门禁 | 仓库无 UI 反模式检测器；`npm run lint` 为 `tsc --noEmit`，与本工具职责不同，不合并 |
| 关键词检索 | `impeccable`、`anti-slop`、`design skill` 在本仓库无既有实现；`.agents/`、`.codex/` 检索时为空的占位目录 |
| 为什么新建 | 现有门禁只能发现类型错误，无法发现 UI 反模式；现有文档只有规范条文，没有可执行的确定性检查 |

## 3. 安装内容与边界

- 安装命令（2026-10-28 实际执行，工作目录为仓库根）：

```bash
npx --yes impeccable@latest install -y --scope=project --providers=agents,claude
```

- 技能版本 `4.8.0`，引擎 `0.1.18`（linux-x64）。npm 包 `impeccable`；项目级安装，只写入仓库内代理目录，不写系统级配置。
- 只安装 `.agents`（跨工具通用 Agent Skills 目录，Codex 等读取）与 `.claude`（Claude Code）两个 provider，避免 7 个 provider 各复制一份 23 MB 引擎二进制。
- 实际生成：`.agents/skills/impeccable/`、`.claude/skills/impeccable/`、`.claude/agents/impeccable-*.md`（4 个）、`.claude/settings.local.json`、`.codex/hooks.json`；每个技能目录约 24 MB，其中 `scripts/bin/` 为 23 MB 引擎，已加入 `.gitignore` 由首次运行自动下载。
- 技能自带自包含引擎二进制（linux-x64），不新增 npm 依赖到 `package.json`。
- 检测器默认尊重 `.impeccable/config.json` / `.impeccable/config.local.json` 的 `detector.ignoreRules`、`ignoreFiles`、`ignoreValues`。本项目在该配置中只登记了一条文件级豁免：`src/apps/shared/components/frontend/mobileEditorialHome.css`。原因是该文件的两处 `overused-font`（`font-family: Inter`）来自 RUDA 既有设计系统，Inter 是全站正文无衬线字体，按 `AGENTS.md` §5.4「工具建议与现有设计系统冲突时以设计系统为准」处理；豁免仅覆盖这一个文件，其他目录的 `overused-font` 仍然会被报告。撤销方式：删除 `.impeccable/config.json` 中的 `ignoreFiles` 条目。
- 遥测：CLI 提供 `npx impeccable telemetry off|on|status`。为避免公司项目信息外发，安装后关闭匿名遥测（仅匿名使用统计，不含源码）。

## 4. 使用方式

在任意代理会话中：

1. 先运行 `.agents/skills/impeccable/scripts/impeccable context`，它会读取根目录 `PRODUCT.md` 并输出平台、设计文件状态与提示。`PRODUCT.md` 是产品事实的唯一权威记录（用户、定位、运营场景、约束、品牌承诺、产品原则），产品事实变化时更新它，不要把它当作视觉规范。
2. UI 任务开始前读 `.agents/skills/impeccable/SKILL.md` 及对应 `reference/<command>.md`（例如 `polish.md`、`audit.md`、`critique.md`、`craft-floor.md`）。不支持 skills 自动加载的工具（如 Cline、Kilo）由代理按本节主动读取，这是本项目的主要使用方式。
3. 改动后运行确定性检测（两种等价方式，优先用仓库内启动器，避免每次走 npx）：

```bash
.agents/skills/impeccable/scripts/impeccable detect src/apps/merchant-admin-web
.agents/skills/impeccable/scripts/impeccable detect --json src/apps/shared
.agents/skills/impeccable/scripts/impeccable detect --list-rules   # 查看 62 条规则目录

# 或使用 npm 层 CLI（需联网解析包）
npx impeccable detect src/apps/merchant-admin-web
```

4. 退出码：`0` 无主要问题；`2` 有主要问题；`1` 至少一个目标无法扫描。
5. 误报处理：使用行内注释 `/* impeccable-disable <rule-id>: 原因 */`，或在 `.impeccable/config.json` 配置 `detector.ignoreRules`，禁止直接删除规则或删除检查脚本。
6. `DESIGN.md`（根目录）：未创建。视觉事实仍以 `docs/engineering/mobile-design-system.md` 与 `src/apps/**` 现有实现为准；运行 `/impeccable document` 前必须与这些既有文档核对，禁止生成冲突的第二份设计说明。

## 5. RUDA 约束（使用本工具时必须同时遵守）

- 视觉方向以现有黑白/中性灰为准；工具给出的 `colorize`、`bolder`、`overdrive` 建议不得擅自引入金色或其他主题。
- 后台导航一级/二级/三级名称必须是四个汉字，工具不改变该规则。
- 商家相关 UI 改动仍按 `AGENTS.md` 第 15 节联动 `merchant-admin-web`、`merchant-admin-mobile`、`merchant-miniprogram`，检测通过不等于三端已验证。
- 检测器结果只是证据之一，不能替代真实浏览器/手机/小程序验收；未实际查看的页面仍标记“视觉待验收”。

## 6. 验证记录（2026-10-28 实测）

| 命令 / 检查 | 结果 |
| --- | --- |
| `npx --yes impeccable@latest install -y --scope=project --providers=agents,claude` | `EXIT 0`；安装到 `.agents`、`.claude`；引擎 0.1.18 写入两处 |
| `.agents/skills/impeccable/scripts/impeccable --version` | `4.8.0`，`EXIT 0`（安装后的本地启动器可执行，无需 npx） |
| `... detect --json src/apps/merchant-admin-web` | `EXIT 2`，1 条：`ai-color-palette`，`src/apps/merchant-admin-web/MerchantPortal.tsx:7488`（`text-violet-950 on heading`） |
| `... detect --json src/apps` | `EXIT 2`，15 条：`ai-color-palette` 12、`overused-font` 2、`gray-on-color` 1；涉及 10 个文件，集中在 `src/apps/shared/components/` 与 `merchant-admin-*` |
| `git check-ignore -v` | `scripts/bin/` 与 `.claude/settings.local.json` 命中新增规则（`.gitignore` 第 22、23、25 行） |
| `... telemetry status` → `off` → `status` | 初始为 `on`；执行后为 `off`，写入用户级 `/home/moda/.impeccable/config.json`（不入库） |
| `PRODUCT.md` + `... context` | `context` `EXIT 0`，输出 `productPath: PRODUCT.md`、`platform: web`、`designPath: null`；技能能正确读取产品事实 |

说明：

- 检测退出码 `2` 表示存在主要问题，本次为既有代码基线，不是安装失败；本轮未修改任何页面样式，15 条发现留待各页面单独任务处理。
- 检测只覆盖 `src/apps`；小程序（WXML）、Flutter（`fu/`）不在检测器支持范围，仍需人工与真机验收。
- `EXIT 2` 的规则命中需逐条判断，例如 `text-violet-950` 可能是业务状态色而非 AI 模板色，修复前须核对页面上下文，禁止为清零而改配色。

## 7. 回滚

```bash
rm -rf .agents/skills/impeccable .claude/skills/impeccable .claude/agents/impeccable* 
rm -f .claude/settings.local.json .codex/hooks.json
```

并撤销 `.gitignore` 与 `AGENTS.md` 中对应的新增条目；除上述文件外无其他改动。

## 8. 未完成 / 待验证

1. 各代理工具内的斜杠命令（`/impeccable polish` 等）是否被识别，取决于工具对 skills 的支持，需在对应工具内实测；本机 VS Code 环境未验证自动加载，当前以“代理主动读 SKILL.md + 手动跑检测”为准。
2. hooks 自动检查是否在编辑 UI 文件时触发，需在支持 hooks 的工具（Claude Code / Codex）内确认；未确认前以手动 `detect` 为准。关闭方式：删除 `.claude/settings.local.json` 中的 `hooks` 段或 `.codex/hooks.json`；也可在 `.impeccable/config.json` 设置 `hook.enabled: false`。
3. 15 条基线发现（12 `ai-color-palette`、2 `overused-font`、1 `gray-on-color`）未修复，需按页面单独评审；其中 `text-violet-950` 可能是业务状态色，不得为清零而改配色。
4. `DESIGN.md` 未创建，也未运行 `/impeccable document`；建立前需确认不与现有设计文档形成第二套事实来源。
5. 未对全站页面做视觉验收；本轮只做安装、规则接入与基线检测。
6. 未接入 CI；是否把 `detect` 作为 PR 阻断门禁需单独评审（会受既有 15 条基线影响）。

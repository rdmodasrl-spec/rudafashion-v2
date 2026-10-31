# Anthropic Skills 接入：技能清单、许可证与重复能力分析

- 文档状态：已完成（研究、筛选、适配、安装、文档）；本批**不改任何生产页面**
- 执行日期：2026-10-31
- 上游：[`anthropics/skills`](https://github.com/anthropics/skills)
- 涉及路径：`.agents/skills/{frontend-design,webapp-testing,brand-guidelines}/`、`.claude/skills/`（镜像）、`AGENTS.md` §5.7 / §16、`docs/engineering/README.md`、`tests/design-skills-consistency.test.ts`
- 不涉及：运行时代码、API、数据库、权限、构建目标、部署

## 1. 仓库完整清单（19 个技能）

克隆 `--depth 1` 后逐目录读取 `SKILL.md` 与 `LICENSE.txt`（2026-10-31）。

| # | 技能 | 体积 | 许可证 | 用途 | 结论 |
| --- | --- | ---: | --- | --- | --- |
| 1 | `frontend-design` | 9.4 KB | Apache-2.0 | 有意图的视觉方向、排版、反模板化评审 | **安装（适配）** |
| 2 | `webapp-testing` | 3.9 KB + 脚本 | Apache-2.0 | Playwright 交互/截图/日志做功能验证 | **安装（适配）** |
| 3 | `brand-guidelines` | 2.2 KB | Apache-2.0 | 品牌落地规则 | **安装（适配）** |
| 4 | `theme-factory` | 3.1 KB | Apache-2.0 | 10 套预设幻灯/物料主题（含 PDF 样板） | 拒绝：会引入 10 套外来配色 |
| 5 | `web-artifacts-builder` | 3.1 KB | Apache-2.0 | 构建独立 HTML artifact（CDN React） | 拒绝：与 RUDA 构建链无关 |
| 6 | `canvas-design` | 11.9 KB | Apache-2.0 | 海报/画布视觉设计 | 拒绝：非产品 UI |
| 7 | `algorithmic-art` | 19.8 KB | Apache-2.0 | 生成式艺术（p5.js） | 拒绝：非产品 UI |
| 8 | `slack-gif-creator` | 7.8 KB | Apache-2.0 | Slack 动图 | 拒绝：无使用场景 |
| 9 | `skill-creator` | 33.2 KB | Apache-2.0 | 创建新技能的元流程 | 拒绝（本轮）：RUDA 技能已成型，33KB 流程成本高于收益 |
| 10 | `mcp-builder` | 11.1 KB | Apache-2.0 | 构建 MCP 服务器 | 拒绝：非前端 UI/UX |
| 11 | `claude-api` | 105.1 KB | Apache-2.0 | Anthropic API 使用指南 | 拒绝：RUDA 有自有 AI 供应商层 |
| 12 | `internal-comms` | 1.5 KB | Apache-2.0 | 内部沟通写作 | 拒绝：非前端 |
| 13 | `academy-guide` | 7.8 KB | Apache-2.0 | 教学材料写法 | 拒绝：非前端 |
| 14 | `discernment-nudge` | 10.6 KB | Apache-2.0 | 判断力提示词 | 拒绝：非前端 |
| 15 | `doc-coauthoring` | 15.8 KB | **source-available** | 文档协作 | 拒绝：许可证 + 非前端 |
| 16 | `docx` | 6.9 KB | **source-available** | Word 文档处理 | 拒绝：许可证 |
| 17 | `pdf` | 8.1 KB | **source-available** | PDF 处理 | 拒绝：许可证 |
| 18 | `pptx` | 20.8 KB | **source-available** | PPT 处理 | 拒绝：许可证 |
| 19 | `xlsx` | 8.6 KB | **source-available** | Excel 处理 | 拒绝：许可证 |

## 2. 许可证检查（重点）

逐目录 `head -3 LICENSE.txt` 实测结果：

- **Apache-2.0（14 个）**：`academy-guide`、`algorithmic-art`、`brand-guidelines`、`canvas-design`、`claude-api`、`discernment-nudge`、`frontend-design`、`internal-comms`、`mcp-builder`、`skill-creator`、`slack-gif-creator`、`theme-factory`、`webapp-testing`、`web-artifacts-builder`。可修改、可分发，需保留许可证与版权声明。
- **Source-available / 保留所有权利（5 个）**：`docx`、`pdf`、`pptx`、`xlsx`、`doc-coauthoring`。文件头写明 `© 2025 Anthropic, PBC. All rights reserved.` + 使用条款。**不得复制进本仓库**。
- 仓库根目录**没有**总 LICENSE 文件；许可证是**按技能目录**给出的，因此「整仓安装」在法律上不可行，只能逐个判断。

安装的三个技能均保留了上游 `LICENSE.txt` 原文（Apache-2.0），并在 `SKILL.md` frontmatter 与 Credits 中标明来源与修改事实，符合 Apache-2.0 第 4 条（保留声明、注明变更）。

## 3. 重复能力分析

现有 4 个技能：`impeccable`、`redesign-existing-projects`、`landing-page-design`、`webapp-testing`（新增）。逐项比对：

| 能力 | 现有技能是否已有 | Anthropic 技能是否重复 | 处理 |
| --- | --- | --- | --- |
| 设计工作流命令（audit/critique/polish）+ 确定性检测器 | `impeccable` 有 | 不重复 | 保留 impeccable 为唯一工作流与门禁 |
| 既有页面诊断清单、修复优先级 | `redesign-existing-projects` 有 | 不重复 | 保留 |
| 转化页结构/文案（Part A） | `landing-page-design` 有 | `frontend-design` 部分重叠（都谈首屏与文案） | 分工：landing 决定「说什么、什么顺序」，frontend-design 只判断「做出来像不像模板」 |
| 具体令牌与数值 | `design-values.md` 有 | `brand-guidelines` 上游是**另一套品牌**（Poppins/Lora/`#d97757`） | 改写为 RUDA 版，并**明确不复制数值**，只写应用规则 |
| 动效规则、状态清单、上线必备 | `landing-page-design` B7/B9/B10 有 | `frontend-design` 有重叠 | 数值仍以 design-values 为准；frontend-design 只保留"反模板化"判断 |
| Playwright 自动化、截图、日志 | 无（仓库只有零散的临时脚本） | 不重复 | **新增**，这是本轮最大增益 |
| 品牌资产/主题套件 | 无 | `theme-factory` 提供 10 套外来主题 | 拒绝 |

结论：**新增 3 个技能，均不与现有技能职能重叠**；不重复安装任何已有能力。四技能最终分工见 `AGENTS.md` §16.1 路由表。

## 4. 适配记录（上游 → RUDA）

### 4.1 `frontend-design`

| 上游 | RUDA 处理 |
| --- | --- |
| 要求"像设计总监一样发明独特视觉身份" | **删除发明授权**，改为在既有品牌内做取舍判断 |
| 允许为每个客户选择新配色/字体 | 明确禁止；品牌与令牌已定 |
| 10 条 AI 生成痕迹（暖米色+砖红、荧光强调、等宽卡片…） | 保留，逐条改写为 RUDA 语境（砖红/金色=跑偏、圆角必须用令牌、eyebrow 标签在中文界面即"·分隔符·元信息"） |
| 首屏、排版、结构装置、动效、文案判断 | 保留，补充 RUDA 的 12px 底线、`tabular-nums`、买家侧/后台区分 |
| 「先计划再自评」两遍法 | 保留，与 §16.4 的 Scan→Diagnose→Prioritize→Improve→Verify 对齐 |

### 4.2 `webapp-testing`

| 上游 | RUDA 处理 |
| --- | --- |
| Python Playwright + `with_server.py` | 改为 **Node Playwright**（仓库已装 `playwright`），并改写出 `scripts/with-server.mjs`（启动服务、等端口、跑脚本、回收进程） |
| 通用决策树 | 保留，补 RUDA 的真实约束：按 hostname 选构建目标、`--host-resolver-rules`、非安全上下文 `crypto.randomUUID` 限制 |
| 通用示例 | 补「视口矩阵 390/820/1024/1440」「无横向滚动」「裂图检测」「触控 24px」 |
| 无 | **新增** 商家独立店铺三套模板的 5 项功能测试配方（视觉落地/真实预览/响应式/切换持久化/切换后不回归） |
| 无 | **新增** 生产安全边界：禁止对生产做写操作；`INDUSTRY_DEMO_LOGIN_ENABLED` 不得擅自开启 |

### 4.3 `brand-guidelines`

| 上游 | RUDA 处理 |
| --- | --- |
| Anthropic 专属色（`#141413`/`#faf9f5`/`#d97757`） | 全部删除 |
| Poppins / Lora | 全部删除，改为 `--font-sans` / `--font-serif` / `--font-editorial` |
| python-pptx 的 RGBColor 应用细节 | 删除（与 RUDA 无关） |
| — | 新增：颜色**使用规则**（何时用纸/墨/线）、金色仅在黑金店铺模板内、文案声音、交付前 5 问 |

## 5. 商家独立店铺三套模板（重点）

现状（代码事实，未改动）：

| 模板 id | 名称 | 声明配色 |
| --- | --- | --- |
| `fashion_monochrome` | 时尚版 · 黑白 | `#ffffff` / `#111111` / `#e5e5e5` |
| `luxury_black_gold` | 豪华版 · 黑金 | `#11100e` / `#c9a96e` / `#29251f` |
| `ecommerce_standard` | 标准版 · 电商 | `#f3f5f7` / `#2563eb` / `#ffffff` |

- 定义：`src/shared/merchantStorefrontTemplate.ts`；渲染：`MerchantStoreView.tsx` 的 `data-storefront-template` 属性。
- 商家入口：`MerchantPortal.tsx`（Web）与 `MerchantMobileApp.tsx`（手机端）均有一键应用；「店铺预览/店铺链接」跳转公开店铺页。

**三套模板的风险点（供后续批次）**：

1. `luxury_black_gold` 的金色 `#c9a96e` 与 `AGENTS.md` §5.1「不擅自引入金色」的边界需要在文档层明确：**只允许在该店铺范围内生效**，不得写进全局令牌（已在 `brand-guidelines` 中固化）。
2. `ecommerce_standard` 的蓝色 `#2563eb` 是第二强调色，同样必须是店铺局部作用域。
3. 三套模板必须共用同一份商品数据与同一套权限/API，只换视觉；不得各自复制业务逻辑（§3.5 单一事实来源）。
4. 模板切换必须**服务端持久化**，不能只改前端状态。

**本轮不修改任何模板代码**；`webapp-testing` 已写入三套模板的 5 项验收配方，供后续按 §15 三端联动执行。

## 6. 安装内容

| 路径 | 内容 | 许可证 |
| --- | --- | --- |
| `.agents/skills/frontend-design/{SKILL.md,LICENSE.txt}` | RUDA 适配版 | Apache-2.0 |
| `.agents/skills/webapp-testing/{SKILL.md,scripts/with-server.mjs,LICENSE.txt}` | RUDA 适配版（Node） | Apache-2.0 |
| `.agents/skills/brand-guidelines/{SKILL.md,LICENSE.txt}` | RUDA 适配版 | Apache-2.0 |
| `.claude/skills/<同上三套>` | 逐字节镜像 | Apache-2.0 |

三个技能均无 npm 依赖、无二进制、不写系统级配置。

## 7. 统一调用规则（摘要，权威见 `AGENTS.md` §16.1）

| 任务 | 技能 |
| --- | --- |
| 任何前端改动 | `impeccable` + `design-values.md` |
| 新建落地/转化页 | `landing-page-design` Part A → B |
| 既有页面诊断 | `redesign-existing-projects` |
| 判断"像不像模板/够不够高级" | `frontend-design` |
| 确认"还是不是 RUDA"（配色/字体/图标越界） | `brand-guidelines` |
| 验证真实行为、截图、模板切换回归 | `webapp-testing` |

执行顺序固定：**先诊断（redesign/frontend-design）→ 再取值（design-values / landing B）→ 写代码 → 用 webapp-testing 实测 → impeccable detect 门禁**。

## 8. 验证

- 已执行：上游 19 个技能逐个读取 `SKILL.md` + `LICENSE.txt`；三份 `SKILL.md` frontmatter 可解析；`.agents` 与 `.claude` 副本 `diff -r` 一致；`with-server.mjs --help` 可运行。
- 已执行：`tests/design-skills-consistency.test.ts` 扩展为覆盖 5 个技能（镜像一致、权威值引用、禁用上游值、许可证存在）。
- 未执行：任何页面改动、任何模板测试。本批只做研究、筛选、适配、安装与文档，符合用户「不修改现有生产页面」的要求。

## 9. 风险与回滚

- 风险：`frontend-design` 被误当成"重做授权"。已在文件头部写死「品牌固定、结构固定、产出是判断不是新方案」。
- 风险：`brand-guidelines` 被当成第二份令牌表。已明确「不复制数值，只写应用规则」。
- 风险：`webapp-testing` 被指向生产做写操作。已写死本地/只读边界与演示登录禁令。
- 回滚：删除 `.agents/skills/{frontend-design,webapp-testing,brand-guidelines}/` 与 `.claude` 镜像，撤销 `AGENTS.md` §5.7 与 §16 对应行、本文件、一致性测试中的相应断言即可；无运行时影响。

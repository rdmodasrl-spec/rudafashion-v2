# RUDA 前端设计与测试技能注册表

- 文档状态：已完成（登记 6 个已安装技能 + 3 个上游基线）
- 日期：2026-10-31
- 适用范围：所有前端任务；项目二（`P2-STORE-TEMPLATES`）的设计、审查与浏览器验收必须按本表调用。
- 安装检查只做一次：**本表即安装检查结果**，后续无需重复核验；技能文件内容变化时更新本表。

## 1. 已安装技能（6 个）

所有技能同时存在于 `.agents/skills/<name>/` 与 `.claude/skills/<name>/`，两处内容逐字节一致（`tests/design-skills-consistency.test.ts` 守卫）。

| # | 技能 | 来源 | 版本 | 许可证 | 调用条件 | RUDA 适配内容 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `impeccable` | npm `impeccable@4.8.0`（第三方） | 4.8.0 + 引擎 0.1.18 | 上游商用条款（随包） | **所有前端任务的主工作流**；`audit`/`critique`/`polish`/`harden` 与 `impeccable detect` 门禁 | 不改技能本体；用 `.impeccable/config.json` 登记唯一字体豁免；冲突时以 RUDA 规范为准 |
| 2 | `redesign-existing-projects` | [elayadesign/redesign-skill](https://github.com/elayadesign/redesign-skill) `main@7df13f6a289f` | 1.0.0-ruda | MIT（© 2026 Elaya） | **只**用于现有页面与**原有三套服装模板**的审查与渐进改进 | Design Values 全部替换为 RUDA 令牌；新增覆盖规则章节 |
| 3 | `landing-page-design` | [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills) `main@4fdcdd52f15e` | 1.0.0-ruda | MIT（© 2026 Elaya） | 品牌官网、营销首页、页面叙事（项目二 A/B 型模板） | Part A 保留，Part B 改为 RUDA 值；删除渐变/浮动导航/必选标语段 |
| 4 | `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `main@ca45fc496a34` | 1.0.0-ruda | **Apache-2.0**（保留上游 `LICENSE.txt`） | 判断「像不像模板」「够不够高级」，输出判断而非新品牌 | 删除「发明新视觉身份」授权；痕迹清单改写为 RUDA 语境 |
| 5 | `webapp-testing` | 同上 | 1.0.0-ruda | **Apache-2.0** | **所有前端验收**：真实浏览器操作、截图、console/网络错误、模板切换回归 | Python → Node Playwright；新增主机名路由、视口矩阵、店铺模板验收配方、生产只读边界 |
| 6 | `brand-guidelines` | 同上 | 1.0.0-ruda | **Apache-2.0** | 确认配色/字体/图标是否越界；项目二每套模板配色评审 | 删除 Anthropic 配色与 Poppins/Lora；改为 RUDA 应用规则；**不复制数值** |

## 2. 许可证分类（逐个 `LICENSE` 实测）

| 类别 | 技能/内容 | 允许的处理 |
| --- | --- | --- |
| **MIT** | `redesign-existing-projects`、`landing-page-design` | 可改、可分发，需保留版权与许可声明 |
| **Apache-2.0** | `frontend-design`、`webapp-testing`、`brand-guidelines` | 可改、可分发，需保留 `LICENSE.txt`、注明变更 |
| **上游商用条款** | `impeccable` | 仅按原样使用，不复制其内部实现到 RUDA 源码 |
| **Source-available（禁止复制）** | anthropics/skills 的 `docx`、`pdf`、`pptx`、`xlsx`、`doc-coauthoring` | **不得**复制进本仓库 |

Anthropic 仓库**根目录没有 LICENSE**，许可证按技能目录单独给出，因此只能逐技能判断——这一点已写入 `docs/engineering/anthropic-skills.md`。

## 3. 拒绝安装的技能（避免重复评估）

| 技能/资源 | 拒绝原因 |
| --- | --- |
| `theme-factory`、`web-artifacts-builder`、`canvas-design`、`algorithmic-art`、`slack-gif-creator`、`mcp-builder`、`claude-api`、`internal-comms`、`academy-guide`、`discernment-nudge` | 与前端产品 UI 无关，或会引入外来配色/第二套构建链 |
| `skill-creator` | 33 KB 元流程，成本高于收益 |
| 5 个 source-available 技能 | 许可证禁止 |
| `@tremor/react` | **peer 要求 React ^18，不支持 19** |
| Storefront UI（npm） | 自带令牌与 Tailwind 预设，与 RUDA 冲突 |
| Tailwind Plus / Untitled UI Pro | 商业许可，且是整页模板 |
| Aceternity UI | 装饰性动效与 RUDA「克制」方向冲突 |

## 4. 职责分工（避免重复指令）

| 场景 | 唯一负责技能 | 其它技能不做 |
| --- | --- | --- |
| 工作流编排 + 确定性检测 | `impeccable` | 其余技能不重复跑 detect |
| 既有页面/旧模板诊断 | `redesign-existing-projects` | `landing-page-design` 不诊断 |
| 新页面结构、营销叙事、文案 | `landing-page-design` Part A | `frontend-design` 不写页面结构 |
| 视觉取舍与反模板判断 | `frontend-design` | 不定义令牌 |
| 品牌边界（配色/字体/图标） | `brand-guidelines` | 数值仍以 `design-values.md` 为准 |
| 浏览器实测与截图取证 | `webapp-testing` | 其余技能不声称已验收 |

调用顺序固定：**诊断 → 取值（`design-values.md` / `storefront-design-system.md`）→ 实现 → `webapp-testing` 实测 → `impeccable detect` → 截图留证**。

## 5. 项目二的强制调用要求

- 每套模板设计前：`landing-page-design`（结构）+ `frontend-design`（差异化判断）。
- 每套模板视觉定稿前：`brand-guidelines`（配色是否越界，含商家品牌色的允许范围）。
- 每套模板交付前：`webapp-testing`（预览、切换、授权、三档视口、console/网络错误）。
- 现有 6 套服装模板：只用 `redesign-existing-projects` 做诊断，**不得**用新模板替换。

技能必须真正参与设计与验收：没有 `webapp-testing` 截图与操作记录的模板，一律视为未验收。

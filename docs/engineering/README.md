# RUDA 工程文档中心

这里是 RUDA 全站工程事实和决策的维护入口。新增模块前，先搜索现有文档，更新已有文档优先于创建重复文档。

## 当前权威文档

- [`AGENTS.md`](../../AGENTS.md)：全仓开发规则，VS Code/Copilot 工作区根级指令入口。
- [`architecture.md`](./architecture.md)：跨运行面架构基线；应用构建和边界细节继续以现有 [`docs/application-boundaries.md`](../application-boundaries.md) 为准，避免维护两份冲突的构建清单。
- [`module-registry.md`](./module-registry.md)：按当前源码建立的模块目录；状态表示代码证据级别，不替代模块规格或业务验收。
- [`duplication-audit.md`](./duplication-audit.md)：全站版块重复数字/重复入口审计记录、已修复项、数据口径核查与未验证范围。
- [`ide-workspace-config.md`](./ide-workspace-config.md)：VS Code / TypeScript 索引边界（`tsconfig.json` 与 `.vscode/settings.json` 排除项）、OOM 处理记录、保留的源码索引范围与回滚方式。
- [`deployments.md`](./deployments.md)：生产发布记录（构建范围、数据库迁移、应用 release、验证结果与回滚方式）。
- [`mobile-design-system.md`](./mobile-design-system.md)：三个手机端构建目标的按钮、卡片、图标、圆角、输入框与弹窗令牌，页面验收状态和截图证据。
- [`miniprogram-wxml-directives.md`](./miniprogram-wxml-directives.md)：两个小程序的 WXML `wx:if`/`wx:elif`/`wx:else` 相邻性规则、`Bad attr wx:else` 编译错误成因、检查脚本与 2026-10-28 修复记录。
- [`../admin-business-closure-audit.md`](../admin-business-closure-audit.md)：平台总后台 32 个页面的闭环状态、证据、断点及未完成验证项。
- [`audit/2026-10-26-full-closure-audit.md`](./audit/2026-10-26-full-closure-audit.md)：全站功能闭环审计（重点营销推广与智能营销）：总后台与商家端的实际接缝、权限缺口、死接口、P0/P1/P2 整改计划与待决策项。与上一条的分工是：上一条只覆盖平台后台页面，本条覆盖跨端业务链路。
- [`archive/2026-10-26-unwired-wip/`](./archive/2026-10-26-unwired-wip/README.md)：2026-10-26 类型收口时移出的未接入 WIP 代码（ModaGPT 图片任务子系统、商家推广/推荐奖励）及其原因、恢复步骤和待决策项。归档文件以 `.ts.txt` / `.sql.txt` 后缀保存，不参与类型检查与构建。
- `templates/`：新增模块、API 契约、架构和 ADR 文档的模板。
- 既有 `docs/audit-2026-10-06/`、`docs/真实功能知识库总览.md` 等保留为各自审计/领域文档，不复制成第二套总体架构或契约。

## 文档治理规则

1. `AGENTS.md` 是跨全仓开发行为的强制规则。
2. `architecture.md` 记录全站架构基线；已存在的详细权威文档按主题链接维护，不重复复制。
3. `modules/` 保存各业务模块的规格、依赖和验收标准；每个模块使用稳定的 module-id。
4. `api/`（如项目采用 OpenAPI 或其他契约源，则使用项目既有位置）保存 API 契约，不得维护两份互相冲突的权威定义。
5. `adr/` 保存重要技术决策，记录背景、备选方案、决策和后果。
6. `templates/` 提供文档模板，新增模块前复制并填完必填项。
7. `module-registry.md` 登记模块 ID、源码路径、路由、API、数据实体、依赖、测试和状态；未知事实明确标注待确认。

## 文档先于代码

新业务模块、跨端功能、API、数据库、权限、认证、事件、后台任务、第三方集成、公共组件或构建/部署边界变更，必须先创建/更新设计文档与验收标准，随后再写功能代码。开发过程中设计变化时先更新文档，再实现。

文档必须真实反映当前代码；不确定的内容标为“待确认”，未实现的能力标为“未实现/待接入”。禁止将推测写成事实。

## 现有自动检查

- `tests/app-target.test.ts` 检查六个应用目标唯一且每个目标入口存在，同时验证域名/路径/视口解析。
- `tests/admin-navigation.test.ts` 检查后台可见路由不重复、均归属四大版块且菜单名称符合现行规则。
- `tests/duplication-guards.test.ts` 固定已确认的重复数字/重复入口清理结果，防止商家后台 Web/手机端与生产链概览重新引入同屏重复。
- `node scripts/check-wxml-directives.mjs` 与 `tests/miniprogram-wxml-directives.test.ts` 检查两个小程序 WXML 条件指令相邻性、`wx:if`+`wx:for` 同元素和标签平衡。
- `tests/mobile-design-system.test.ts` 固定手机端圆角令牌、按钮/卡片/图标规范、共享样式引入和禁止回退的 44px/整行长按钮。
- 执行方式：`node --import tsx --test tests/app-target.test.ts tests/admin-navigation.test.ts tests/duplication-guards.test.ts tests/mobile-design-system.test.ts`。
- 构建脚本分别写入 `dist/apps/<target>/releases/`；正式发布必须单独调用发布脚本，不将构建成功视为已发布。

以上是目前能确认的守门范围，不代表认证去重、API 契约、租户隔离、所有页面或所有应用发布流程都已有自动检查。后续按高风险和可判定性逐步补齐，不新增重复测试框架。

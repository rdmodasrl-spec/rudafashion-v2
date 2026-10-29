# VS Code / TypeScript 工作区索引配置

状态：已完成（仅配置层，未改运行时代码、未改构建、未部署）。执行日期：2026-10-26。
范围：仓库根 [`tsconfig.json`](../../tsconfig.json)、[`.vscode/settings.json`](../../.vscode/settings.json)。

## 1. 问题与结论

VS Code 提示：

> 若要启用项目范围内的 JavaScript/TypeScript 语言功能，请排除包含不需要处理的源文件的大型文件夹。

结论：**提示来自仓库根 `tsconfig.json` 未限定范围**。该文件没有 `include`/`exclude`，且 `compilerOptions.allowJs = true`，TypeScript 默认按 `**/*` 收进工作区全部 `.js/.ts`，把 `dist/apps/*/releases/**` 的历史构建产物、`fu` 等其他工程和 `public` 静态资源一并纳入语言服务，导致 tsserver 项目体积失控。

实测证据：

| 检查 | 结果 |
| --- | --- |
| `npx tsc -p tsconfig.json --listFilesOnly`（修改前） | `EXIT 134`，Node 堆上限 4,144 MB 时 `Allocation failure` / Mark-Compact 后仍 OOM |
| VS Code `TypeScript.log`（本机） | 历史累计 2,220 条 `TSServer exited`，其中 2,216 条为 `SIGABRT`；本次会话 02:09:33–02:10:29 连续 5 次 `SIGABRT`（堆内存崩溃后每 14 秒重启一次） |
| `npx tsc -p tsconfig.json --listFilesOnly`（修改后） | `EXIT 0`，4,453 个文件 |

`SIGABRT` 与 OOM 是同一原因，不是编辑器或扩展故障；用户级设置 `~/.config/Code/User/settings.json` 中没有 TypeScript 相关覆盖项，仓库也没有 `jsconfig.json` 或其他 `tsconfig*.json`。

## 2. 仓库目录体积盘点（2026-10-26 实测）

| 目录 | 体积 | `.js/.ts` 文件数 | 性质 | 处理 |
| --- | --- | --- | --- | --- |
| `dist/` | 3.0 GB | 50,543 | 构建产物，`dist/apps` 下 6 个应用共 448 个历史 release（其中 `merchant-admin-web` 1.6 GB / 175 个 release） | 完全排除 |
| `node_modules/` | 2.1 GB | 126,169 | 依赖 | TypeScript 默认排除；VS Code 监视/搜索排除 |
| `fu/` | 3.4 GB | 2 | Flutter（Fluxstore）独立工程，`fu/build` 3.2 GB、1,804 个 `.dart` | 排除出 TS 项目；`fu/build`、`fu/.dart_tool` 不监视；`fu/lib` 仍可在资源管理器与搜索中查看 |
| `public/` | 865 MB | 1 | 静态资源，`downloads` 547 MB、`fashion` 280 MB、`videos` 35 MB | 媒体目录不监视/不搜索（源码无关） |
| `release/` | 863 MB | 4 | 发布备份包（已 gitignore） | 完全排除 |
| `logs/`、`var/` | 3.9 MB / 8 KB | 0 | 运行日志、运行数据 | 排除 |
| `src/` | 7.5 MB | 331 | **RUDA 业务源码** | 保留索引 |
| `tests/` | 1.5 MB | 194 | 测试 | 保留索引 |
| `miniprogram/` | 952 KB | 29 | 微信小程序（买家端） | 保留索引 |
| `merchant-miniprogram/` | 1.7 MB | 30（不含其 `node_modules`） | 微信小程序（商家端） | 保留索引 |
| `server.ts` | 2.0 MB | 1 | 后端入口与主要业务实现 | 保留索引 |
| `.server-appstore-release.ts` | 1.9 MB | 1 | 未跟踪的 `server.ts` 旧快照备份，无任何源码引用（仅出现在历史 pm2 日志） | 排除出 TS 项目，文件保留不删除 |

## 3. 配置变更

### 3.1 `tsconfig.json`

保留全部原有 `compilerOptions`，只新增 `exclude`：

```json
"exclude": [
  "node_modules",
  "dist",
  "release",
  "logs",
  "var",
  "fu",
  "fashion-ingestion",
  "public/uploads",
  "public/downloads",
  "**/.tmp-*",
  ".server-appstore-release.ts"
]
```

说明：

- 不新增 `include`，继续使用默认 `**/*` 再减去 `exclude`。这样 `src/apps` 下新增的应用目录、`tests/`、`scripts/`、根级配置脚本会自动进入项目，不需要每次新应用上线都改 `tsconfig`。
- 未开启 `checkJs`、未修改 `strict`、未修改 `paths`，类型检查口径与原来一致。
- `module`/`isolatedModules`/`moduleResolution` 等均保持不变，不影响 `vite`、`scripts/build-app.ts`、`tsx server.ts` 与 `tsc --noEmit`。

### 3.2 `.vscode/settings.json`

保留原有两项（`python.terminal.useEnvFile`、`css.lint.unknownAtRules`），新增：

| 配置 | 作用 |
| --- | --- |
| `files.exclude` | 资源管理器隐藏根级 `dist`、`release`、`logs`、`var`、`fu/build`、`fu/.dart_tool`（纯展示层，文件仍在磁盘，可用 “显示排除的文件” 临时查看） |
| `files.watcherExclude` | 不监视依赖、构建产物、发布备份、日志、Flutter 构建目录、`public` 媒体目录与临时目录 |
| `search.exclude` | 全局搜索跳过上述目录、压缩产物、锁文件 |
| `typescript.tsserver.maxTsServerMemory: 4096` | 与编辑器默认 `--max-old-space-size=4096` 对齐；排除后项目只需其中一小部分 |
| `typescript.disableAutomaticTypeAcquisition: true` | 项目已通过 `devDependencies` 与 `compilerOptions.types` 显式提供类型，关闭自动 `@types` 抓取可减少对 `node_modules/@types` 的扫描 |

**没有**设置 `typescript.validate.enable: false`、`javascript.validate.enable: false` 等会削弱语言功能的开关；跳转、补全、错误检查、重命名与重构仍由 tsserver 提供。

补充事实：`files.watcherExclude` 含 `**/node_modules/**` 时，VS Code 的 TypeScript 扩展会按官方逻辑改用自己的 Node 文件监视器（日志：`Falling back to legacy node.js based file watching because of user settings.`）。这是扩展的既定行为，不是配置错误；由于同时排除了 `dist`/`release`/`fu/build`，监视面仍远小于原状。


## 4. 保留的语言能力（逐项核对）

修改后 TypeScript 项目（`tsc --listFilesOnly`，4,453 个文件）构成：

| 区域 | 文件数 |
| --- | --- |
| `src/`（含六个应用、`src/server`、`src/shared`、`src/api`） | 331 |
| `tests/` | 194 |
| `merchant-miniprogram/` | 30 |
| `miniprogram/` | 29 |
| `scripts/` | 24 |
| 根级入口与配置（`server.ts`、`vite.config.ts`、`capacitor.config.ts`、`ecosystem.config.cjs` 等） | 5 |
| `node_modules` 中被真实依赖引用的 `.d.ts` | 3,839 |

抽查（均在项目内，可跳转/补全/重命名）：

- 商家后台：`src/apps/merchant-admin-common`（39 个文件）、`src/apps/merchant-admin-mobile`、`src/apps/merchant-admin-web`
- 平台后台：`src/apps/platform-admin-*`
- 小程序：`miniprogram/`、`merchant-miniprogram/`
- ModaGPT：`src/shared/modagptImageIntent.ts`、`src/api/modagptImageTasks.ts`、`src/apps/*/components/**/ModaGpt*.tsx`、`src/server/modagpt*`、`server.ts` 内相关实现

另有 156 个“git 已跟踪但工作区不存在”的文件未进入项目（`src` 114 个、`MODAGPT/` 42 个）：它们在工作区已被删除（`git status` 显示为删除），不是被 `exclude` 排除，属于本任务之外的既有状态。

## 5. 验证记录

| 命令 / 检查 | 结果 |
| --- | --- |
| `npx tsc -p tsconfig.json --listFilesOnly`（修改前） | `EXIT 134`：`AllocateInYoungGeneration` 失败，4,144 MB 堆上限耗尽 |
| 同上（修改后） | `EXIT 0`，4,453 个文件 |
| 项目内 `dist/` 路径计数 | 0（`node_modules` 内部的 `dist/*.d.ts` 仍正常参与） |
| 项目内 `fu/` 路径计数 | 0 |
| `.server-appstore-release.ts` 计数 | 0 |
| `npx tsc -p tsconfig.json --noEmit` | 可完整跑完（此前只能 OOM 中断），`EXIT 2`，63 个**既有**类型错误，见第 6 节 |
| `python3 -m json.tool tsconfig.json` / `.vscode/settings.json` | 均通过 |
| VS Code 重启后的 tsserver | 02:10:37、02:14:47 两次重启后无 `SIGABRT`；空闲时单进程 RSS 约 160 MB（旧配置下语义进程约 1.19 GB 且仍在增长） |

## 6. 排除构建产物后暴露的既有类型错误（不在本任务修复范围）

`tsc --noEmit` 现在能跑完，因此过去被 OOM 掩盖的 63 个错误变得可见：

| 文件 | 错误数 |
| --- | --- |
| `src/server/modagptImageTaskWorker.ts` | 24 |
| `tests/modagpt-image-task-lifecycle.test.ts` | 14 |
| `src/server/merchantPromotions.ts` | 8 |
| `src/server/modagptImageTaskService.ts` | 6 |
| `server.ts` | 5 |
| `src/apps/shared/components/frontend/CheckoutView.tsx` | 2 |
| `tests/modagpt-image-task.test.ts` | 1 |
| `src/server/modagptImageTask.ts` | 1 |
| `src/apps/shared/components/consumer/ConsumerAuth.tsx` | 1 |
| `scripts/seed-miniprogram-demo-employee.ts` | 1 |

这些是代码层的既有类型/契约不一致（例如 `ModaGptImageTaskBillingData` 缺字段、`WechatMessagePushVerification` 联合类型未收窄），与本次 `exclude` 无因果关系：被排除的只有构建产物与其他工程，上述文件在修改前后都在项目内。**未在本轮改动任何业务代码**，需单独任务修复；修复前 `npm run lint` 仍为失败状态，不能标记为通过。

## 7. 残余负担与后续建议

1. `server.ts` 为 2 MB 单文件，本身即语言服务大头；它是后端入口，必须索引，不建议排除。真正拆分它是独立重构任务。
2. `tests/` 194 个文件仍在项目内。若后续仍觉得编辑器慢，可再拆 `tsconfig.tests.json` 供 CLI 门禁使用，编辑器只保留 `src`；本轮不做，避免影响现有 `npm run lint` 口径。
3. 六个前端应用共用一份根 `tsconfig.json`，仓库内无 per-app `tsconfig`，`scripts/build-app.ts` 通过 Vite 构建，因此不存在“多套 TS 配置需要分别处理”的情况；不要为单个应用另建平行 TS 配置。
4. `dist/apps/*/releases/` 会持续累积历史 release。建议后续在发布流程中增加保留策略（例如仅保留最近 N 个），该动作涉及发布脚本，需单独评审。

## 8. 调整与回滚

- 临时查看被隐藏的构建产物：资源管理器设置里关闭 “排除的文件”（Show Excluded Files），或临时注释 `files.exclude` 对应项；不要提交临时改动。
- 临时分析被排除的文件（例如排查发布包）：把文件复制到未排除目录，或临时从 `tsconfig.json` 的 `exclude` 移除该项后再恢复。
- 回滚：
  ```bash
  cp tsconfig.json.bak-20261026 tsconfig.json
  cp .vscode/settings.json.bak-20261026 .vscode/settings.json
  ```
  两个备份为 2026-10-26 修改前的原文件（未跟踪），确认新配置稳定后可删除。

## 9. 未完成 / 待验证

1. 未在 VS Code 窗口内做人工验收（F12 跳转、补全、重命名、错误波浪线、打开 `ModaUI` 等页面文件后的响应速度），需重载窗口并打开 `src/main.tsx` 或任一 `.tsx` 后确认。
2. 提示是否消失需重载窗口观察一次；配置层原因（项目文件数 50k+ → 4.4k）已消除，但编辑器 UI 行为未截图记录。
3. 未改构建、未发布、未触碰数据库；`dist/` 仍按原样存在，构建脚本输出路径未变。

## 10. 编辑器 strict-null 诊断与 `server.ts` 类型收口（2026-10-28）

现象：VS Code 在 `server.ts` 报 5 类 7 处 TypeScript 诊断，而仓库 `tsconfig.json` **未开启** `strict` / `strictNullChecks`，`node_modules/.bin/tsc --noEmit` 退出码 0。

复现方式：`node_modules/.bin/tsc --noEmit --strictNullChecks` 可复现同批错误（`server.ts` 从 147 处降到修复后的 140 处，减少的正是本次 7 处）。因此判断为编辑器语言服务按更严格的空值语义检查，而项目构建配置不检查。

处理原则：**不通过放宽/收紧 `tsconfig` 来消除编辑器波浪线**，而是把代码写成在两种模式下都成立的写法。

| 位置 | 诊断码 | 原因 | 修法 |
| --- | --- | --- | --- |
| `rateLimit()`（原 2102 行） | TS18048 | `Parameters<typeof createExpressRateLimit>[0]` 含 `undefined` | 形参默认值 `= {}` |
| `ipKeyGenerator(req.ip)` × 5（鉴权/微程序鉴权/商家注册/招商 AI 限流） | TS2345 | `req.ip` 为 `string \| undefined` | 新增 `rateLimitIpKey(req)`：`req.ip ?? req.socket.remoteAddress ?? 'unknown'` |
| `db.showrooms = showrooms.map(...)` | TS2322 | Prisma 可空列是 `string \| null`，`Showroom` 用可选字段 | 映射函数标注 `(row): Showroom`，`city_it/city_zh/openingHours_it/openingHours_zh/capacity_it/capacity_zh` 统一 `?? undefined` |
| `/api/auth/register/company` 的 `roles` / `categories`；`/api/merchant/onboarding` 的 `categories` | TS2322/2769 | `Array.isArray(req.body.x)` 的元素类型被推成 `unknown`，`(role: string) =>` 这类显式标注回调匹配不到数组重载 | 新增 `toStringList(value: unknown): string[]` 与 `toUpperStringList(value: unknown): string[]` 两个归一函数，入参固定 `unknown`、返回值显式 `string[]`；调用点去掉 `(role: string)` 标注改为推断 |
| `roles.map((role: string) => ...)`（注册写 `businessRoles`） | TS2345 | 同上：`roles` 被判成 `unknown[]` 时，显式标注的回调与 `(value: unknown, index: number, array: unknown[])` 不兼容 | 去掉 `(role: string)` 标注，元素类型统一由 `string[]` 推断 |
| `POST /api/admin/growth/missions` 的 `input` | TS2322/18047 | `let input: GrowthMissionInput \| null = null` 的收窄不会带进 `$transaction(async tx => ...)` 闭包，`...input` 因此展开出 `string \| undefined` | try 内新增 `const missionInput: GrowthMissionInput = input`，create、计划构建、审计日志全部改用 `missionInput`；catch 仍用可空 `input` 比对幂等冲突 |

验证（2026-10-28）：

| 命令 | 结果 |
| --- | --- |
| `node_modules/.bin/tsc --noEmit` | 退出码 0，无输出 |
| `node_modules/.bin/tsc --noEmit --strictNullChecks` | 累计修复 12 处（147 → 135）；`server.ts` 余 135 处为既有 strict-only 问题，不在本任务范围 |
| `node_modules/.bin/tsc --noEmit --strict` | 累计修复 5 处（67 → 62） |
| `node_modules/.bin/esbuild server.ts --bundle --platform=node --format=cjs --packages=external` | 成功（3.6 MB） |
| `node --import tsx --test tests/*.test.ts` | 1060 通过 / 2 失败；失败项为既有问题（`growth-migrations.test.ts` 迁移计数 147≠148、`ui-translation-copy.test.ts` FashionTrendsView 文案目录缺项），与本次改动无调用关系 |

运行时行为不变：限流键在 `req.ip` 缺失时改为回退到 socket 地址（原来会抛错变成 500），`roles/categories` 仍是大写去重数组，`db.showrooms` 的可空列由 `null` 变为缺省字段（所有前端消费点均使用 `||` 兜底）。

`growth/missions` 那条不改运行时行为：`validateGrowthMissionInput` 从不返回 `null`（非法入参直接抛 `GROWTH_MISSION_INPUT_INVALID`，由既有 catch 映射为 400），`let input: GrowthMissionInput | null = null` 只是过度放宽的标注；`missionInput` 与 `input` 指向同一对象。

## 11. 未完成 / 待验证（新增）

1. 编辑器波浪线需在 VS Code 中执行 “TypeScript: Restart TS Server” 后确认消失；本机未截图。
2. 剩余 135 处（`--strictNullChecks`）/ 62 处（`--strict`）strict-only 诊断属于全仓严格模式改造，需单独立项，不在本次范围。
3. 编辑器诊断若持续指向已被修改的行（行号与磁盘内容对不上、`modelVersionId` 不随保存递增），说明该文件缓冲区未随磁盘重载（常见于文件有未保存修改）。先确认标签页没有未保存改动，再 “TypeScript: Restart TS Server”；若仍不刷新，直接对该文件执行 “File: Revert File”。

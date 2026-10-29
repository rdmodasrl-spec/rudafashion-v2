# 未接入的 WIP 模块归档（2026-10-26 类型收口）

本目录保存 2026-10-26“全站错误排查/修复”阶段从工作区移出的**未接入、且无法通过类型检查**的进行中代码。它们从未提交到 Git（`HEAD 9a85ac9` 中不存在），也没有被 `server.ts` 或任何 `src/` 页面调用，因此移除不影响任何线上/已交付功能。

文件后缀保留为 `.ts.txt` / `.sql.txt`，目的是让 `tsc --noEmit` 不再把它们当作源码编译；恢复时去掉 `.txt` 后缀并放回原路径即可。

## 1. ModaGPT 图片任务子系统（4 个服务端文件 + 2 个测试）

| 归档文件 | 原路径 |
| --- | --- |
| `modagptImageTask.ts.txt` | `src/server/modagptImageTask.ts` |
| `modagptImageTaskService.ts.txt` | `src/server/modagptImageTaskService.ts` |
| `modagptImageTaskWorker.ts.txt` | `src/server/modagptImageTaskWorker.ts` |
| `modagptImageTaskCleanup.ts.txt` | `src/server/modagptImageTaskCleanup.ts` |
| `modagpt-image-task.test.ts.txt` | `tests/modagpt-image-task.test.ts` |
| `modagpt-image-task-lifecycle.test.ts.txt` | `tests/modagpt-image-task-lifecycle.test.ts` |

移出原因（均为编译期事实）：

- `modagptImageTaskWorker.ts` 从 `./modagptTaskQueue` 导入 `modagptImageTaskQueue`、`markImageTask*` 等不存在的导出。
- `modagptImageTaskService.ts` / `modagptImageTaskCleanup.ts` 引用了 `prisma.modaGptImageTask` 上不存在的字段（`resultStorageKey`、`cleanupAttemptCount` 等），`prisma/schema.prisma` 中也没有对应模型。
- `modagptImageTask.ts` 依赖 `modagptEntitlements` 中不存在的 `ModaGptImageRequest` 类型。
- 无任何路由：`server.ts` 中不存在 `/api/**/image-tasks*` 端点，模块全链路未被引用。

保留未动：`src/api/modagptImageTasks.ts` 与其测试 `tests/modagpt-image-task-client.test.ts`（可正常编译通过，仅缺服务端端点），作为后续接入时的前端契约。

## 2. 商家推广/推荐奖励模块（1 个服务端文件 + 1 个测试 + 1 个迁移）

| 归档文件 | 原路径 |
| --- | --- |
| `merchantPromotions.ts.txt` | `src/server/merchantPromotions.ts` |
| `merchant-promotions.test.ts.txt` | `tests/merchant-promotions.test.ts` |
| `referral-migration.sql.txt` | `prisma/migrations/20261020150000_merchant_trial_referral_rewards/migration.sql` |

移出原因：

- `merchantPromotions.ts` 使用 `prisma.merchantPromotionBenefit`、`prisma.merchantGrowthReferral`、`prisma.partnerMerchantReferral`，而 `prisma/schema.prisma`（HEAD 与工作区均如此）**没有**这三个模型，编译失败。
- 迁移 `20261020150000_merchant_trial_referral_rewards` 在工作区磁盘上存在但**未被 Git 跟踪**，说明数据库侧脚本与 Prisma schema 已出现漂移。
- 该模块未被 `server.ts` 或任何 `src/` 文件引用，推广/推荐奖励功能当前未上线。

**待决策（需业务方确认，本阶段不擅自处理）**：请确认该功能是否在本迭代交付范围。若交付，需要补齐 `prisma/schema.prisma` 中三个模型并执行 `prisma generate`，同步补写模块规格与 API 契约文档后，再把本目录文件恢复回原路径；若不交付，则连同未跟踪的迁移目录一并清理，避免 schema 与迁移长期漂移。

## 恢复步骤

```bash
cd /www/wwwroot/ruda.fashion
# 示例：恢复商家推广模块
cp docs/engineering/archive/2026-10-26-unwired-wip/merchantPromotions.ts.txt src/server/merchantPromotions.ts
cp docs/engineering/archive/2026-10-26-unwired-wip/merchant-promotions.test.ts.txt tests/merchant-promotions.test.ts
npx tsc --noEmit   # 恢复前必须先用 prisma generate 补齐缺失模型，否则会重新报错
```

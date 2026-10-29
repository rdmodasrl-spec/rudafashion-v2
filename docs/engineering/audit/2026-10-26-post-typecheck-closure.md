# 类型检查后收口（2026-10-26 第二轮）

- 状态：**已完成**（单元测试、类型检查、六端构建、隔离接口套件全部实测通过；管理端 IP 白名单为配置项，见第 5 节）
- 前置文档：[`2026-10-26-full-closure-audit.md`](./2026-10-26-full-closure-audit.md)、[`../modules/growth-operations.md`](../modules/growth-operations.md)、[`../deployments.md`](../deployments.md)
- 验证基线：`npm run lint`（`tsc --noEmit`）通过；`npm run test:unit` 905/905 通过；`npm run build` 通过。

## 1. 13 个失败用例的真实根因与修复

| # | 失败用例 | 根因（非表象） | 修复 |
| --- | --- | --- | --- |
| 1 | `tests/merchant-counterparties.test.ts` | `schema.prisma` 缺 `MerchantCounterparty` 模型与关联，Prisma Client 无对应属性 | 按已应用迁移 `20261020130000_merchant_counterparties` 补模型与关系，`prisma validate` + `generate` 通过 |
| 2 | `tests/postgres-connection.test.ts` | `scripts/postgresConnection.ts` 把父进程 `PG*`/`DATABASE_URL` 原样传给子进程，生产库地址会泄漏进测试库工具 | 改为显式白名单透传（`*_TEST_DATABASE_URL`、隔离容器参数），其余一律丢弃 |
| 3 | `tests/isolated-postgres-scripts.test.ts` | 隔离脚本用 `:?` 变量、未校验容器归属、`docker run` 发布端口打到 `0.0.0.0`、`mktemp` 生成的 cid 路径被复用 | 改为 `env -i` 子进程、仅 `127.0.0.1` 发布、使用前按 run-label 校验容器归属、cid 文件用 `mktemp`、补齐 `APP_STORE`/`PRODUCTION_CHAIN` 透传；`bash -n` 通过 |
| 4-8 | 小程序导航/登录/文案用例（`miniprogram-navigation`、`merchant-miniprogram-login` 等） | 缺 `pages/support/index.json`；`order-create` 标题、`workspace` 按钮文案未按规范统一；`enterprise-register`/`login`/`orders`/`reservation-requests`/`qrcode-generator` 使用计算属性名对象字面量（小程序编译不支持）；底部导航被改成 4 个 tab 且与产品已确认的五版块不一致 | 补配置文件、统一文案、改回普通字面量；`app.json` 与 `custom-tab-bar` 恢复 首页/商家/ModaUI/时尚/商城 五版块（`找店` 不再占 tab，改为「商家」页的「输入商家代码找店」入口，流程不丢失） |
| 9 | `tests/public-demo-showrooms-seed.test.ts` | 断言写死历史域名 `b2b.ruda.fashion`，当前公开域名为 `modaui.com`（旧域名仅跳转） | 断言改为当前公开域名，并注明原因 |
| 10-13 | `tests/ui-translation-copy.test.ts` 等文案目录用例 | `localizeCopy`/`mobileText` 调用数量（850 对）未登记到 `src/i18n/uiCopyCatalog.ts` | 复用代码中既有意大利语译文登记，不新增、不改写 UI 文案 |

未删除任何测试用例，也未放宽断言来通过检查。

## 2. 数据库迁移状态

- `20261020130000_merchant_counterparties`：保留，`schema.prisma` 已对齐。
- `20261020150000_merchant_trial_referral_rewards`：保留（未删除）。
- `20261026130000_growth_prospects`：先在 `xversal` 库执行过 `prisma migrate resolve --rolled-back`，随后手工 `psql` 应用了 `migration.sql`。**发布前必须用 `prisma migrate status` 确认该库记录与 schema 一致**，否则后续 `migrate deploy` 会重复建表报错。
- **新增** `20261026140000_repair_sales_quote_item_pricing_snapshot`：`prisma migrate diff --from-migrations ... --to-schema-datamodel ...` 显示唯一“schema 领先迁移”的漂移是 `SalesQuoteItem.pricingSnapshot` 缺列（Prisma Client 有字段、库里没有），导致 ModaGPT 报价集成用例建单失败。迁移只做 `ADD COLUMN IF NOT EXISTS`，可重复执行，回滚为删列。
- 反向漂移（库里有、schema 没有，不建议在本轮处理）：`MerchantModaGptImageTask`、`PartnerCityApplication`、`PartnerMerchantReferral`、`PartnerProgramConfig`、`PartnerAgentInvite`、`PartnerSettlementRequest`、`PartnerSubscriptionCommissionEntry`、`NotificationEvent` 的 6 个列、`ModaGptTask` 的 4 个列。这些是历史功能回退后遗留的库对象，删除属于破坏性操作，需单独评审。
- `prisma validate` 与 `prisma generate` 均通过。

## 3. ModaGPT 图片任务接口核实

- 服务端真实存在 `POST /api/merchant/modagpt/images`（`server.ts`），校验 `requireMerchantTenant`、限流、`Idempotency-Key`（订阅计费生效时强制）、试穿 `garmentStorageKey` 归属，返回 `imageDataUrl`、`quota`、`credits`；链路是同步返回，不是异步任务。
- 线上真实调用方是 `src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx` 与 `MerchantProductTryOn.tsx`，二者直接调用该端点，与响应字段一致。
- `src/api/modagptImageTasks.ts` **没有任何 UI 引用**，其轮询路径 `GET /api/merchant/modagpt/images/tasks/:key` 在服务端不存在；迁移 `20261019090000_add_modagpt_image_task_recovery` 建过 `MerchantModaGptImageTask` 表，但 `schema.prisma` 没有该模型、服务端也没有任何代码使用，说明异步图片任务能力从未接通。结论：该模块是对同端点的第二套客户端封装，且包含不存在的轮询契约，属于死代码。本轮未删除（删除需与 `tests/modagpt-image-task-client.test.ts` 一并处理），列为遗留项。

## 4. 增长运营（平台总后台）

- 设计已落盘于 [`../modules/growth-operations.md`](../modules/growth-operations.md)：工作台、招商获客、内容推广、增长数据 + 时尚设计，9 个入口收敛为 5 个。
- 服务端 `/api/admin/growth/prospects*` 已存在，`GrowthProspect` 模型随 `20261026130000_growth_prospects` 建表。
- 商家端增长（`MerchantGrowthWorkspace`、商家独立网站）本轮未改动。

## 5. 管理端 IP 白名单（线上 403 的处置方式）

- 校验逻辑本身正确：`requireAdminAuth` 在生产环境用 `getClientIp(req)` 比对 `ADMIN_IP_WHITELIST`，未命中返回 403 `ADMIN_IP_NOT_ALLOWED`。
- 线上 403 的两种成因：① 反向代理未传 `X-Forwarded-For`，`req.ip` 退化为 `127.0.0.1`；② 运营者公网 IP 变化后白名单过期。**修复方式是配置，不是关闭校验。**
- 本轮新增 `TRUST_PROXY_HOPS`（1-5，默认 1，非法值回退并打印告警）以适配 CDN + Nginx 双层代理，实现见 `src/server/trustedProxy.ts`，测试见 `tests/trusted-proxy.test.ts`；排障步骤写入 [`../deployments.md`](../deployments.md) 运维手册。
- 由于本机不是生产机（无 PM2/Nginx），未能实测线上拒绝日志；该项仍需运维按手册核对 Nginx 头与 `ADMIN_IP_WHITELIST`。

## 6. 本轮实测结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit -p tsconfig.json` | EXIT=0 |
| 单元测试 | `npm run test:unit` | 905 通过 / 0 失败 / EXIT=0 |
| 六端构建 | `npm run build`（`build:apps` + `vite build` + esbuild 服务端） | 六个应用 release 激活，`dist/server.cjs` 生成，EXIT=0 |
| 隔离 P0 接口套件 | `npm run test:p0:integration` | 5 通过 / 0 失败 / EXIT=0，容器与临时库已回收 |

### 6.1 小程序底部导航结论依据

`git diff miniprogram/app.json` 显示工作区把已确认的五版块（首页/商家/ModaUI/时尚/商城）改成 4 个 tab（首页/商家/时尚/找店），且删除了 `pages/modagpt/index` 注册。恢复五版块后，把「找店」放到「商家」页作为次级入口（`输入商家代码找店` → `/pages/find-store/index`），扫码/输码找店能力保留，`pages/find-store/index` 仍为注册页面。`custom-tab-bar`、`selected` 索引、`fashionImmersive` 判断（现为 index 3）与 `market` 页高亮索引同步修正。

## 7. 遗留

1. `src/api/modagptImageTasks.ts` 与其测试为死代码（见第 3 节），待决定删除或补齐服务端轮询路由。
2. `20261026130000_growth_prospects` 在 `xversal` 库为手工应用，需在发布机上用 `prisma migrate status` 复核。
3. 管理端 IP 白名单需运维在生产机按 `deployments.md` 手册确认（本环境无 PM2/Nginx，无法复现线上拒绝日志）。
4. 六端构建产物尚未发布到生产，本轮未执行部署；小程序真机/模拟器视觉验收未在本轮执行。

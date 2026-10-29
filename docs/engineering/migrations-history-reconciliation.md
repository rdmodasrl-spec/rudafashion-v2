# 迁移历史分叉处置记录（2026-10-28）

本记录对应 `docs/engineering/modules/fashion-community-upgrade.md` 阶段二工程风险第 1 项。所有结论均来自生产库 `_prisma_migrations` 与实际表结构的核对，不依赖报告转述。

## 1. 核对结果

| 迁移 | 生产历史记录 | 数据库结构 | 仓库文件（核对前） | 结论 |
| --- | --- | --- | --- | --- |
| `20261023130000_store_access_credentials` | 已应用（2026-10-23 05:39） | `StoreAccessCredential` 表存在，唯一索引与商户外键齐全 | 缺失 | 历史与结构一致，文件缺失 |
| `20261023140000_link_fashion_posts_to_products` | 已应用（2026-10-23 06:40） | `FashionCommunityPost.productId`、索引、`ON DELETE SET NULL` 外键存在 | 缺失 | 历史与结构一致，文件缺失；Prisma schema 未声明该列 |
| `20261026140000_repair_sales_quote_item_pricing_snapshot` | 未记录 | `SalesQuoteItem.pricingSnapshot` 列已存在 | 存在 | 结构已修复但历史缺失 |
| `20261028120000_fashion_community_views` | 未记录 | `FashionCommunityView` 表存在 | 存在 | 阶段一手工执行，历史缺失 |
| `20261028180000_fashion_community_stage2` | 未记录 | 4 张新表、评论回复列均存在 | 存在 | 本轮手工执行，历史缺失 |

## 2. 已执行的处置

1. 补齐两个缺失的基线迁移文件，SQL 均使用 `IF NOT EXISTS` 与约束存在性判断，可重复执行：
   - `prisma/migrations/20261023130000_store_access_credentials/migration.sql`
   - `prisma/migrations/20261023140000_link_fashion_posts_to_products/migration.sql`
2. Prisma schema 补声明历史列 `FashionCommunityPost.productId`（仅保持结构一致，API 不使用；多商品关联走 `FashionCommunityPostProduct`）。
3. 对三个已经在数据库中生效、但缺少历史记录的迁移执行 `prisma migrate resolve --applied`（不执行 SQL，仅登记既有事实）：
   - `20261026140000_repair_sales_quote_item_pricing_snapshot`
   - `20261028120000_fashion_community_views`
   - `20261028180000_fashion_community_stage2`
4. 执行 `npx prisma migrate status`，结果：`Database schema is up to date!`（145 个迁移）。

## 3. 新环境与回滚

- 新环境执行 `npx prisma migrate deploy` 可按顺序建立上述结构；补齐的基线文件保证了 `StoreAccessCredential` 与 `FashionCommunityPost.productId` 不会缺失。
- 本轮变更均为新增表/列，未删除或重写生产数据。代码回滚不要求回滚数据库。
- 若必须回滚结构：先确认没有代码读取对应结构，再按“删表/删列”单独审批；`FashionCommunityPost.productId` 与 `StoreAccessCredential` 属历史结构，不在阶段二回滚范围。
- 执行前已备份时尚相关数据（`/tmp/backup-FashionCommunity*.csv`，共 14 条作品、2 个账号；评论/互动/观看当时为空）。生产库 `dist/server.cjs` 备份为 `dist/server.cjs.bak-20261028-0820`。

## 4. 仍需注意

- 仓库不再缺失上述迁移文件，但历史上其他手工执行的迁移若未登记，可能再次出现同类分叉。上线流程仍应禁止手工改库；确需热修复时，必须同步执行 `migrate resolve --applied` 并记录原因。
- `prisma migrate status` 不校验已应用迁移的文件校验和；如后续修改已应用迁移文件，应新建迁移而不是改写历史文件。
## 5. 重复时间戳处置（2026-10-28 复核）

`prisma/migrations` 存在两个已应用的重复时间戳对：`20261023130000` 与
`20261028120000`。两对目录均不得重命名，否则已部署环境会把既有迁移误判为待应用。

核对生产库 `_prisma_migrations`（只读查询，2026-10-28）：

| 迁移目录 | `finished_at` | `rolled_back_at` |
| --- | --- | --- |
| `20261023130000_app_store_email_domain_scope` | 已应用 | 未回滚 |
| `20261023130000_store_access_credentials` | 已应用 | 未回滚 |
| `20261028120000_fashion_community_views` | 已应用 | 未回滚 |
| `20261028120000_merchant_industry_stores_pos` | 已应用 | 未回滚 |

后续只读核对 `_prisma_migrations` 再次确认第二对均为 `finished_at IS NOT NULL` 且未回滚。
处置决定：**不重命名任何一方**。迁移目录名同时是 `_prisma_migrations.migration_name` 的主键，
重命名已应用的目录会让现有环境（含生产）出现「该迁移未应用」，`prisma migrate deploy`
随后会把幂等 SQL 再执行一次并插入重复历史记录，风险高于收益。

替代保障：

1. `tests/growth-migrations.test.ts` 保留「时间戳唯一」语义，仅将这两对已应用目录登记为例外；
   任何**新增**的重复时间戳仍会失败，例外清单与磁盘不一致（改名、增删）同样失败。
2. 新环境按完整目录名升序执行；两对内顺序分别为 `app_store_...` → `store_access_...`、
   `fashion_community_...` → `merchant_industry_...`。两对迁移均已在生产应用，当前不重放。
3. 时间戳规则仍按 `YYYYMMDDHHMMSS` 14 位，新建迁移必须使用未占用的时间戳。

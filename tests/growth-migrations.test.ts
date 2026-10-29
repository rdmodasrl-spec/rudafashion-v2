import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationsDirectory = path.join(process.cwd(), 'prisma', 'migrations');
const migrationDirectories = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{14}_/.test(entry.name))
  .map(entry => entry.name);

/**
 * 生产库已应用的重复时间戳：20261023130000 的 app_store/store_access，
 * 以及 20261028120000 的 fashion_community/merchant_industry。
 * 迁移目录名是 `_prisma_migrations` 记录的主键，重命名已应用目录会让生产环境
 * 出现「未应用迁移」并触发重复登记，因此保留原名并显式登记；新增重复时间戳仍失败。
 * 详见 docs/engineering/migrations-history-reconciliation.md §5。
 */
const KNOWN_DUPLICATE_TIMESTAMPS: Readonly<Record<string, readonly string[]>> = {
  '20261023130000': [
    '20261023130000_app_store_email_domain_scope',
    '20261023130000_store_access_credentials'
  ],
  '20261028120000': [
    '20261028120000_fashion_community_views',
    '20261028120000_merchant_industry_stores_pos'
  ]
};

test('Prisma migration timestamps are unique so deployment order is deterministic', () => {
  const timestamps = migrationDirectories.map(name => name.slice(0, 14));
  const duplicatedTimestamps = [...new Set(
    timestamps.filter((value, index) => timestamps.indexOf(value) !== index)
  )];
  // 除登记过的历史例外外，不允许出现任何新的重复时间戳。
  assert.deepEqual(duplicatedTimestamps.sort(), Object.keys(KNOWN_DUPLICATE_TIMESTAMPS).sort());
  // 例外清单必须与磁盘现状完全一致：改名或新增同名迁移都会让这里失败。
  for (const [timestamp, expected] of Object.entries(KNOWN_DUPLICATE_TIMESTAMPS)) {
    assert.deepEqual(
      migrationDirectories.filter(name => name.startsWith(`${timestamp}_`)).sort(),
      [...expected].sort()
    );
  }
});

test('Growth time-window indexes match Prisma schema and additive SQL migrations', () => {
  const schema = readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
  const expected = [
    { model: 'PartnerReferralClick', field: 'clickedAt', migration: '20261005051000_growth_daily_metrics_indexes' },
    { model: 'PartnerReferral', field: 'registeredAt', migration: '20261005051000_growth_daily_metrics_indexes' },
    { model: 'PartnerReferral', field: 'firstPaidAt', migration: '20261005051000_growth_daily_metrics_indexes' },
    { model: 'SupportRequest', field: 'createdAt', migration: '20261005051000_growth_daily_metrics_indexes' },
    { model: 'Customer', field: 'createdAt', migration: '20261005180000_growth_customer_created_at_index' }
  ] as const;

  for (const { model, field, migration: migrationName } of expected) {
    const migration = readFileSync(path.join(migrationsDirectory, migrationName, 'migration.sql'), 'utf8');
    assert.match(schema, new RegExp(`model ${model} \\{[\\s\\S]*?@@index\\(\\[${field}\\]\\)[\\s\\S]*?\\n\\}`));
    assert.match(migration, new RegExp(`CREATE INDEX "${model}_${field}_idx" ON "${model}"\\("${field}"\\);`));
  }
});

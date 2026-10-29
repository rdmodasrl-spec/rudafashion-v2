import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => existsSync(path.join(root, relativePath));

const serverSource = read('server.ts');
const schema = read('prisma/schema.prisma');
const migration = read('prisma/migrations/20261028220000_fashion_governance/migration.sql');
const sharedLimiter = read('src/server/fashionRateLimit.ts');
const reportSource = read('src/apps/platform-admin-common/components/admin/AdminFashionReports.tsx');
const taxonomySource = read('src/apps/platform-admin-common/components/admin/AdminFashionTaxonomy.tsx');
const userActionsSource = read('src/apps/platform-admin-common/components/admin/AdminFashionUserActions.tsx');
const mediaSource = read('src/apps/platform-admin-common/components/admin/AdminFashionMediaMonitor.tsx');
const webSource = read('src/apps/shared/components/frontend/FashionTrendsView.tsx');
const miniApiSource = read('miniprogram/utils/api.js');
const miniPageSource = read('miniprogram/pages/fashion/index.js');

test('governance migration is additive and creates the four new tables', () => {
  for (const table of ['FashionTaxonomyTerm', 'FashionCommunityAccountRestriction', 'FashionMediaEvent', 'RateLimitCounter']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`), `missing ${table}`);
    assert.match(schema, new RegExp(`model ${table} \\{`), `schema missing ${table}`);
  }
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
  assert.match(schema, /model FashionTaxonomyTerm[\s\S]*@@unique\(\[kind, name\]\)/);
  assert.match(schema, /model FashionCommunityAccountRestriction[\s\S]*@@index\(\[accountId, status\]\)/);
  assert.match(schema, /model FashionMediaEvent[\s\S]*@@index\(\[status, createdAt\]\)/);
});

test('shared rate limiting uses one atomic PostgreSQL upsert and keeps a fallback', () => {
  assert.match(sharedLimiter, /INSERT INTO "RateLimitCounter"/);
  assert.match(sharedLimiter, /ON CONFLICT \("key"\) DO UPDATE SET/);
  assert.match(sharedLimiter, /RETURNING "count"/);
  assert.match(serverSource, /import \{ consumeSharedRateLimit, purgeExpiredRateLimits \}/);
  assert.match(serverSource, /return await consumeSharedRateLimit\(prisma, key, limit, windowMs\)/);
  assert.match(serverSource, /consumeFashionRateLimitLocal\(key, limit, windowMs\)/);
});

test('every fashion rate limit call awaits the shared limiter', () => {
  const calls = serverSource.match(/consumeFashionRateLimit\(`/g) || [];
  const awaited = serverSource.match(/\(await consumeFashionRateLimit\(`/g) || [];
  assert.ok(calls.length >= 10, `expected at least 10 call sites, found ${calls.length}`);
  assert.equal(calls.length, awaited.length, 'all call sites must await the async limiter');
});
test('taxonomy API supports list, create, update, merge and public read', () => {
  assert.match(serverSource, /app\.get\('\/api\/fashion\/taxonomy'/);
  assert.match(serverSource, /app\.get\('\/api\/admin\/fashion\/taxonomy'/);
  assert.match(serverSource, /app\.post\('\/api\/admin\/fashion\/taxonomy'/);
  assert.match(serverSource, /app\.patch\('\/api\/admin\/fashion\/taxonomy\/:id'/);
  assert.match(serverSource, /app\.post\('\/api\/admin\/fashion\/taxonomy\/:id\/merge'/);
  assert.match(serverSource, /array_replace\("hashtags"/);
  assert.match(serverSource, /FASHION_TAXONOMY_TERM_EXISTS/);
  assert.match(serverSource, /fashionTaxonomyCache = null/);
});

test('publish and feed paths validate against the live taxonomy', () => {
  assert.match(serverSource, /const isFashionCategoryAllowed = async/);
  assert.match(serverSource, /if \(!\(await isFashionCategoryAllowed\(String\(category\)\)\)\)/);
  assert.match(serverSource, /requestedCategory !== undefined[\s\S]{0,200}await isFashionCategoryAllowed\(requestedCategory\)/);
});

test('account restrictions are enforced server-side and audited', () => {
  assert.match(serverSource, /const getActiveFashionRestriction = async/);
  assert.match(serverSource, /FASHION_ACCOUNT_RESTRICTED/);
  assert.match(serverSource, /app\.post\('\/api\/admin\/fashion\/accounts\/:id\/restrictions'/);
  assert.match(serverSource, /app\.post\('\/api\/admin\/fashion\/restrictions\/:id\/lift'/);
  assert.match(serverSource, /FASHION_ACCOUNT_RESTRICTED', 'FashionCommunityAccountRestriction'/);
  const checks = serverSource.match(/getActiveFashionRestriction\(/g) || [];
  assert.ok(checks.length >= 6, `expected restriction checks in comment/post/edit handlers, found ${checks.length}`);
});

test('media anomalies are recorded from real failure paths and retried against storage', () => {
  assert.match(serverSource, /const recordFashionMediaEvent = async/);
  assert.match(serverSource, /FASHION_MEDIA_OBJECT_MISSING/);
  assert.match(serverSource, /FASHION_MEDIA_READ_FAILED/);
  assert.match(serverSource, /FASHION_POST_VIDEO_PERSIST_FAILED/);
  assert.match(serverSource, /app\.get\('\/api\/admin\/fashion\/media-events'/);
  assert.match(serverSource, /app\.post\('\/api\/admin\/fashion\/media-events\/:id\/retry'/);
  assert.match(serverSource, /fashionAssetExists\(key\)/);
  assert.match(serverSource, /MISSING_OBJECTS/);
});
test('admin console exposes the three governance modules in one tabbed surface', () => {
  assert.ok(exists('src/apps/platform-admin-common/components/admin/AdminFashionTaxonomy.tsx'));
  assert.ok(exists('src/apps/platform-admin-common/components/admin/AdminFashionUserActions.tsx'));
  assert.ok(exists('src/apps/platform-admin-common/components/admin/AdminFashionMediaMonitor.tsx'));
  assert.match(reportSource, /<AdminFashionTaxonomy \/>/);
  assert.match(reportSource, /<AdminFashionUserActions \/>/);
  assert.match(reportSource, /<AdminFashionMediaMonitor \/>/);
  assert.match(reportSource, /setTab\('users'\)/);
  assert.match(taxonomySource, /\/api\/admin\/fashion\/taxonomy/);
  assert.match(userActionsSource, /\/restrictions/);
  assert.match(mediaSource, /media-events\/\$\{event\.id\}\/retry/);
});

test('recommendation ranking uses watch sequence, tags, skips, repeats and creator caps', () => {
  assert.match(serverSource, /const tagAffinity = new Map<string, number>\(\)/);
  assert.match(serverSource, /const repeatPostIds = new Set/);
  assert.match(serverSource, /const skippedPostIds = new Set/);
  assert.match(serverSource, /const hasViewerSignals =/);
  assert.match(serverSource, /const creatorPageCap = Math\.max\(2, Math\.ceil\(limit \/ 4\)\)/);
  assert.match(serverSource, /const skipPenalty = skippedPostIds\.has\(row\.id\) \? 15 : 0/);
});

test('web and mini program read the admin taxonomy with static fallback', () => {
  assert.match(webSource, /apiGet<\{ success: boolean; categories: Array<\{ name: string \}> \}>\('\/api\/fashion\/taxonomy'/);
  assert.match(webSource, /const categoryOptions = useMemo/);
  assert.match(webSource, /categoryOptions\.map\(tag =>/);
  assert.match(miniApiSource, /function getFashionTaxonomy\(\)/);
  assert.match(miniApiSource, /getFashionTaxonomy,/);
  assert.match(miniPageSource, /async loadTaxonomy\(\)/);
  assert.match(miniPageSource, /this\.data\.postCategories \|\| postCategories/);
});



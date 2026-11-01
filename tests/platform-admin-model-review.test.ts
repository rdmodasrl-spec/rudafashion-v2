/**
 * 平台后台「模型审核 / 权限管理」守卫。
 *
 * 检查的是真实接缝而不是观感：
 * 1) 两条新接口存在且带正确守卫（admin 鉴权 + 权限键）；
 * 2) 权限分配接口拒绝未登记权限键、拒绝把自己降权到无法再管理权限；
 * 3) 权限变更与审核都必须写审计；
 * 4) 页面只消费真实接口，不出现假数据或前端自建审核状态。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const server = read('server.ts');
const modelReviewPage = read('src/apps/platform-admin-common/components/admin/AdminModelReview.tsx');
const permissionPage = read('src/apps/platform-admin-common/components/admin/AdminPermissionManager.tsx');
const nav = read('src/apps/platform-admin-common/components/admin/adminNavigation.ts');
const webApp = read('src/apps/platform-admin-web/PlatformAdmin.tsx');
const mobileApp = read('src/apps/platform-admin-mobile/PlatformAdminMobile.tsx');

test('模型审核清单只读接口存在且要求 products.review', () => {
  assert.match(
    server,
    /app\.get\('\/api\/admin\/model-reviews', requireAdminAuth, requireAdminPermission\('products\.review'\)/
  );
  assert.match(server, /parseStoredJson<Array<Record<string, any>>>\(row\.media, \[\]\)/);
});

test('审核写入仍然只有一个入口，且凭证取自数据库管理员主键', () => {
  const approveRoutes = server.match(/app\.(?:put|post)\('[^']*model-review'/g) || [];
  assert.equal(approveRoutes.length, 1, '不允许出现第二个模型批准入口');
  assert.match(server, /const reviewerId = admin\?\.accountId;/);
  assert.doesNotMatch(server, /reviewStatus \|\| 'approved'/);
});

test('管理员清单与权限分配接口受 accounts.manage 保护', () => {
  assert.match(
    server,
    /app\.get\('\/api\/admin\/accounts', requireAdminAuth, requireAnyAdminPermission\(\['accounts\.manage'\]\)/
  );
  assert.match(
    server,
    /app\.put\('\/api\/admin\/accounts\/:id\/permissions', requireAdminAuth, requireAnyAdminPermission\(\['accounts\.manage'\]\)/
  );
});

test('权限分配拒绝未登记键与通配符，并阻止自我锁死', () => {
  assert.match(server, /if \(key === ADMIN_SUPER_PERMISSION \|\| !isKnownAdminPermission\(key\)\)/);
  assert.match(server, /ADMIN_PERMISSION_UNKNOWN/);
  assert.match(server, /ADMIN_PERMISSION_SELF_LOCKOUT/);
  assert.match(server, /const isSelf = operator\?\.accountId === target\.id;/);
  assert.match(server, /prisma\.\$transaction\(async tx => \{[\s\S]{0,600}'ADMIN_PERMISSION_UPDATE'/);
});

test('权限变更与模型审核都写审计', () => {
  assert.match(server, /'ADMIN_PERMISSION_UPDATE'/);
  assert.match(server, /'PRODUCT_MODEL_REVIEW'/);
  assert.match(server, /logAuditAndWait\([\s\S]{0,400}tx\)/);
});

test('模型审核页只消费真实接口，并提供通过/驳回/预览三种操作', () => {
  assert.match(modelReviewPage, /apiGet<\{ items: ModelReviewItem\[\]; counts: typeof counts \}>\(/);
  assert.match(modelReviewPage, /\/api\/admin\/model-reviews\?status=\$\{nextStatus\}&limit=100/);
  assert.match(modelReviewPage, /apiPut\(`\/api\/admin\/products\/\$\{item\.productId\}\/media\/\$\{item\.mediaId\}\/model-review`/);
  assert.match(modelReviewPage, /预览模型/);
  assert.match(modelReviewPage, /驳回原因（必填）/);
  assert.doesNotMatch(modelReviewPage, /mock|假数据|setTimeout\(/i);
});

test('权限管理页使用共享权限目录，不自造第二份权限清单', () => {
  assert.match(permissionPage, /import \{ ADMIN_PERMISSION_GROUPS \} from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/adminPermissions';/);
  assert.match(permissionPage, /apiGet<\{ accounts: AdminAccount\[\] \}>\('\/api\/admin\/accounts'\)/);
  assert.match(permissionPage, /apiPut\(`\/api\/admin\/accounts\/\$\{selected\.id\}\/permissions`/);
  assert.doesNotMatch(permissionPage, /const PERMISSIONS = \[/);
});

test('两个页面都挂进导航，并在电脑端和手机端渲染', () => {
  assert.match(nav, /\{ key: 'model_review', label: '模型审核' \}/);
  assert.match(nav, /\{ key: 'permission_manager', label: '权限管理' \}/);
  for (const app of [webApp, mobileApp]) {
    assert.match(app, /adminTab === 'model_review' && <AdminModelReview \/>|activeTab === 'model_review' && <AdminModelReview \/>/);
    assert.match(app, /adminTab === 'permission_manager' && <AdminPermissionManager \/>|activeTab === 'permission_manager' && <AdminPermissionManager \/>/);
  }
});

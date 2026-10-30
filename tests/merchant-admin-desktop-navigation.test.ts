import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const portal = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
const server = read('server.ts');

const desktopNavIdOrder = [
  'merchant-sidebar-tab-dashboard',
  'merchant-sidebar-tab-orders',
  'merchant-sidebar-tab-products',
  'merchant-sidebar-tab-inventory',
  'merchant-sidebar-tab-customers',
  'merchant-sidebar-tab-growth',
  'merchant-sidebar-tab-modagpt',
  'merchant-sidebar-tab-store-content',
  'merchant-sidebar-tab-finance',
  'merchant-sidebar-tab-apps',
  'merchant-sidebar-tab-ai-chat-history',
  'merchant-sidebar-tab-recent-activity',
  'merchant-sidebar-tab-ai-employees',
  'merchant-sidebar-tab-settings'
];

test('desktop merchant navigation keeps exactly 14 first-level entries in the agreed order', () => {
  const positions = desktopNavIdOrder.map(id => {
    const index = portal.indexOf(`id="${id}"`);
    assert.ok(index >= 0, `${id} must exist in the desktop sidebar`);
    return index;
  });
  assert.deepEqual([...positions].sort((left, right) => left - right), positions, 'navigation order drifted');
  assert.equal(positions.length, 14);
  for (const id of desktopNavIdOrder) {
    assert.equal(portal.split(`id="${id}"`).length - 1, 1, `${id} must be declared once`);
  }
});

test('desktop navigation keeps the bottom action group fixed outside the scrolling middle', () => {
  const navStart = portal.indexOf('merchant-web-sidebar-nav');
  const navClose = portal.indexOf('</nav>', navStart);
  const bottomGroupStart = portal.indexOf('id="merchant-sidebar-tab-ai-employees"');
  assert.ok(navStart > 0 && navClose > navStart);
  assert.ok(bottomGroupStart > navClose, 'AI staff and settings must sit outside the scrolling nav');
  assert.ok(portal.includes('id="merchant-sidebar-tab-settings"'));
});

test('desktop top bar shows the real merchant company name instead of the platform placeholder', () => {
  assert.ok(portal.includes('currentMerchant.companyLegalName || currentMerchant.name'));
  assert.ok(portal.includes('{merchantCompanyName}'));
  assert.equal(portal.includes('<span className="text-sm">RUDA</span>'), false, 'platform brand must be gone');
  assert.equal(portal.includes('>企业中心</span>'), false, 'placeholder subtitle must be gone');
  assert.equal(portal.includes('切换手机端'), false, 'mobile switch entry must be gone from desktop navigation');
});

test('desktop navigation labels follow the four-character rule with registered exceptions', () => {
  const labels = [
    '经营主页', '订单履约', '商品管理', '库存管理', '客户管理', '营销增长',
    '创作空间', '店铺内容', '财务结算', '智能员工', '系统设置',
    '商品列表', '店铺分类', '款式规格', '库存台账', '物料库存', '生产工单', '采购订单',
    '授权申请', '增长概览', '智能运营', '营销活动', '内容对象', '菜单管理', '博客文章',
    '内容页面', '内容素材', '店铺设置', '店铺预览', '应用商店'
  ];
  for (const label of labels) {
    assert.equal([...label].length, 4, `${label} must be four characters`);
    assert.ok(
      UI_COPY_CATALOG.some(copy => copy.zh === label),
      `${label} must be registered in the shared UI copy catalog`
    );
  }
  for (const exception of ['应用', '回收站', 'AI 聊天记录', '最近动态']) {
    assert.ok(portal.includes(exception), `${exception} stays as the user-facing entry name`);
  }
});

test('desktop navigation wires the three new destinations to real panels', () => {
  for (const component of ['MerchantRecycleBin', 'MerchantAiChatHistory', 'MerchantActivityFeed']) {
    assert.ok(portal.includes(`<${component}`), `${component} must be rendered by the portal`);
  }
  assert.ok(portal.includes("activeTab === 'recycle_bin'"));
  assert.ok(portal.includes("activeTab === 'ai_chat_history'"));
  assert.ok(portal.includes("activeTab === 'recent_activity'"));
  assert.ok(portal.includes("import('../merchant-admin-common/components/merchant/MerchantRecycleBin')"));
  assert.ok(portal.includes("import('../merchant-admin-common/components/merchant/MerchantAiChatHistory')"));
  assert.ok(portal.includes("import('../merchant-admin-common/components/merchant/MerchantActivityFeed')"));
});

test('new merchant endpoints are tenant-scoped and read from existing authoritative tables', () => {
  const activityStart = server.indexOf("'/api/merchant/activity'");
  assert.ok(activityStart > 0, 'activity endpoint must exist');
  assert.ok(
    server.slice(activityStart, activityStart + 400).includes('requireMerchantTenant'),
    'activity endpoint must be tenant scoped'
  );
  assert.ok(server.includes("app.get('/api/merchant/recycle-bin', requireMerchantTenant"));
  assert.ok(server.includes("'/api/merchant/recycle-bin/products/:id/restore'"));
  assert.ok(server.includes("app.get('/api/merchant/assistant/history', requireMerchantTenant"));
  assert.ok(server.includes("app.get('/api/merchant/assistant/history/:id', requireMerchantTenant"));
  assert.ok(server.includes('const includeFullHistory = req.body?.includeFullHistory === true;'));
  // 租户边界：活动与回收站查询必须带 merchantId，会话查询必须同时带 actorId。
  assert.ok(server.includes('prisma.inventoryMovement.findMany({\n            where: { merchantId }'));
  assert.ok(server.includes("lifecycleStatus: 'archived'"));
  assert.ok(server.includes('where: { id: req.params.id, merchantId, actorId }'));
});

test('recycle bin restore never auto-publishes and is audited', () => {
  const restoreStart = server.indexOf("'/api/merchant/recycle-bin/products/:id/restore'");
  assert.ok(restoreStart > 0);
  const restoreBlock = server.slice(restoreStart, restoreStart + 2200);
  assert.ok(restoreBlock.includes("data: { lifecycleStatus: 'draft' }"));
  assert.ok(restoreBlock.includes('PRODUCT_RESTORED'));
  assert.ok(restoreBlock.includes("requireEmployeePermission('product.publish', 'store_manager')"));
  assert.ok(restoreBlock.includes('RECYCLE_BIN_PRODUCT_NOT_ARCHIVED'));
});

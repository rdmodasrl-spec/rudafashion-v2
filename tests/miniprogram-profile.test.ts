import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromTest = createRequire(import.meta.url);
const orderSummary = requireFromTest('../miniprogram/utils/order-summary.js');
const miniRoot = new URL('../miniprogram/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, miniRoot), 'utf8');
const app = JSON.parse(read('app.json'));
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const profileWxml = read('pages/profile/index.wxml');
const profileJs = read('pages/profile/index.js');
const apiJs = read('utils/api.js');

function sliceFrom(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle} after ${startNeedle}`);
  return source.slice(start, end);
}

test('底部第五项是「我的」，其余四项不变', () => {
  assert.deepEqual(
    app.tabBar.list.map((item: { text: string }) => item.text),
    ['首页', '商家', 'ModaUI', '时尚', '我的']
  );
  assert.deepEqual(
    app.tabBar.list.map((item: { pagePath: string }) => item.pagePath),
    [
      'pages/home/index',
      'pages/merchants/index',
      'pages/modagpt/index',
      'pages/fashion/index',
      'pages/profile/index'
    ]
  );
  const tabBar = read('custom-tab-bar/index.js');
  assert.match(tabBar, /pagePath: '\/pages\/profile\/index', text: '我的'/);
  assert.equal(tabBar.includes("text: '商城'"), false, '商城 tab 必须由「我的」取代，而不是新增第六项');
  assert.ok(app.pages.includes('pages/market/index'), '商城页面保留为普通页面');
});

test('「我的」及其子页面已注册且四个源文件齐备', () => {
  for (const pagePath of ['pages/profile/index', 'pages/authorizations/index', 'pages/notifications/index']) {
    assert.ok(app.pages.includes(pagePath), `${pagePath} must be registered`);
    const directory = new URL(`${pagePath.replace(/\/index$/, '')}/`, miniRoot);
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(existsSync(new URL(`index.${extension}`, directory)), true, `${pagePath} needs index.${extension}`);
    }
  }
});

test('订单速览按服务端状态聚合，未登录不返回伪造数字', () => {
  const orders = [
    { id: 'o1', status: 'placed', paymentStatus: 'unpaid' },
    { id: 'o2', status: 'confirmed', paymentStatus: 'paid' },
    { id: 'o3', status: 'picking', paymentStatus: 'paid' },
    { id: 'o4', status: 'shipped', paymentStatus: 'paid' },
    { id: 'o5', status: 'returned', paymentStatus: 'paid' },
    { id: 'o6', status: 'cancelled', paymentStatus: 'unpaid' },
    { id: 'o7', status: 'placed', paymentStatus: 'paid', currentTasks: { buyer: { action: 'pay_balance' } } }
  ];
  assert.deepEqual(orderSummary.summarizeBuyerOrders(orders), {
    total: 7,
    pendingPayment: 2,
    toShip: 2,
    shipping: 1,
    afterSales: 1
  });
  assert.equal(orderSummary.summarizeBuyerOrders(null), null);
  assert.equal(orderSummary.summarizeBuyerOrders(undefined), null);
  assert.deepEqual(
    orderSummary.filterBuyerOrders(orders, 'shipping').map((order: { id: string }) => order.id),
    ['o4']
  );
  assert.equal(orderSummary.filterBuyerOrders(orders, 'all').length, 7);
  assert.equal(orderSummary.orderFilterLabel('pendingPayment'), '待付款');
});

test('授权码只接受 6 位数字，格式错误不发请求', () => {
  assert.deepEqual(orderSummary.normalizeStoreCode(' 123456 '), { code: '123456', error: '' });
  assert.equal(orderSummary.normalizeStoreCode('12345').code, '');
  assert.match(orderSummary.normalizeStoreCode('RUDA-ABC').error, /6 位数字/);
  assert.equal(orderSummary.normalizeStoreCode('').error, '请输入商家提供的授权码');
  assert.deepEqual(orderSummary.normalizeStoreCode(null), { code: '', error: '请输入商家提供的授权码' });
});

test('「我的」只渲染真实可用入口，不伪造收藏/关注/浏览/地址', () => {
  for (const label of ['我的收藏', '关注的商家', '浏览记录', '收货地址']) {
    assert.equal(profileWxml.includes(label), false, `${label} 没有后端实现，不得渲染入口`);
  }
  for (const handler of [
    'bindtap="openCodeModal"',
    'bindtap="openAuthorizations"',
    'bindtap="openNotifications"',
    'bindtap="openSettings"',
    'bindtap="openSupport"',
    'bindtap="openPrivacy"',
    'bindtap="openTerms"'
  ]) {
    assert.ok(profileWxml.includes(handler), `缺少入口 ${handler}`);
  }
  assert.match(profileWxml, /登录后查看订单与状态/);
});

test('授权码找店弹窗复用服务端验证并给出可读错误', () => {
  assert.match(profileWxml, /授权码找店/);
  assert.match(profileWxml, /请输入商家提供的授权码/);
  assert.match(profileWxml, /验证并进入店铺/);
  assert.match(profileWxml, /catchtap="noop"/, '点击遮罩关闭需要阻止冒泡到内容区');
  assert.match(profileJs, /getStoreByLookupCode/);
  assert.match(profileJs, /normalizeStoreCode/);
  assert.match(profileJs, /MERCHANT_STORE_NOT_FOUND/);
  assert.match(profileJs, /pages\/store\/index\?storeSlug=/);
  assert.equal(profileJs.includes('/api/vault/store-access/redeem'), false, '不得调用不存在的核销接口');
});

test('三个新包装函数与服务端路由一致', () => {
  assert.match(apiJs, /function getBuyerAuthorizations\(\)[\s\S]{0,80}'\/api\/vault\/authorizations'/);
  assert.match(apiJs, /function getBuyerNotifications\(limit\)[\s\S]{0,80}'\/api\/notifications'/);
  assert.match(apiJs, /function markBuyerNotificationRead\(notificationId\)[\s\S]{0,160}\/api\/notifications\//);
  for (const exported of ['getBuyerAuthorizations,', 'getBuyerNotifications,', 'markBuyerNotificationRead,']) {
    assert.ok(apiJs.includes(exported), `api.js 必须导出 ${exported}`);
  }
});

test('买家授权列表路由按令牌隔离且不接受客户端身份', () => {
  const route = sliceFrom(serverSource, "app.get('/api/vault/authorizations'", '// 3. 商家后台 API');
  assert.match(route, /requireBuyerAuth/);
  assert.match(route, /const customerId = req\.buyer\?\.customerId/);
  assert.match(route, /where: \{ customerId \}/);
  assert.match(route, /Cache-Control', 'no-store'/);
  assert.match(route, /isActiveVaultAuthorization/);
  assert.match(route, /isPublicStorefront/);
  assert.equal(route.includes('req.query.customerId'), false);
  assert.equal(route.includes('req.body.customerId'), false);
});

test('登录后可从「我的」返回，订单页支持按状态筛选', () => {
  assert.match(read('pages/login/index.js'), /'merchants', 'settings', 'profile'/);
  assert.match(read('pages/login/index.js'), /returnTab === 'profile'[\s\S]{0,80}switchTab/);
  const ordersJs = read('pages/orders/index.js');
  assert.match(ordersJs, /filterBuyerOrders\(orders, this\.data\.filter\)/);
  assert.match(read('pages/orders/index.wxml'), /wx:for="\{\{visibleOrders\}\}"/);
});

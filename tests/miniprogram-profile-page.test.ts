import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const requireFromTest = createRequire(import.meta.url);
const root = process.cwd();
const pageSource = readFileSync(path.join(root, 'miniprogram/pages/profile/index.js'), 'utf8');
const orderSummary = requireFromTest('../miniprogram/utils/order-summary.js');

type HarnessOptions = {
  session?: Record<string, any> | null;
  orders?: Array<Record<string, any>>;
  authorizations?: Array<Record<string, any>>;
  unread?: number;
  lookup?: (code: string) => Promise<any>;
};

function createHarness(options: HarnessOptions = {}) {
  const navigations: string[] = [];
  const lookups: string[] = [];
  let definition: Record<string, any> | undefined;
  const orderRows = options.orders || [
    { id: 'o1', status: 'placed', paymentStatus: 'unpaid' },
    { id: 'o2', status: 'shipped', paymentStatus: 'paid' }
  ];
  const authorizationRows = options.authorizations || [
    { id: 'a1', merchantId: 'm1', merchantName: 'Atelier Alba', status: 'approved', storeSlug: 'ruda-demo-03' },
    { id: 'a2', merchantId: 'm2', merchantName: '002', status: 'pending', storeSlug: null }
  ];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(id: string) {
      if (id === '../../utils/api') {
        return {
          getAuthProfile: async () => ({ success: true }),
          getBuyerAuthorizations: async () => ({ success: true, authorizations: authorizationRows }),
          getBuyerNotifications: async () => ({ success: true, unread: options.unread ?? 0, notifications: [] }),
          getBuyerOrders: async () => ({ success: true, orders: orderRows }),
          getStoreByLookupCode: async (code: string) => {
            lookups.push(code);
            if (options.lookup) return options.lookup(code);
            return { success: true, storeSlug: 'modaui' };
          }
        };
      }
      if (id === '../../utils/auth') {
        return {
          getAuthSession: () => options.session ?? null,
          clearAuthSession() {}
        };
      }
      if (id === '../../utils/order-summary') return orderSummary;
      throw new Error(`Unexpected require: ${id}`);
    },
    wx: {
      navigateTo(input: { url: string }) {
        navigations.push(input.url);
      },
      switchTab(input: { url: string }) {
        navigations.push(input.url);
      },
      stopPullDownRefresh() {},
      showToast() {}
    },
    console
  };
  vm.runInNewContext(pageSource, context, { filename: 'miniprogram/pages/profile/index.js' });
  assert.ok(definition, 'profile page must call Page()');

  const page: Record<string, any> = Object.assign({}, definition);
  page.data = JSON.parse(JSON.stringify(definition!.data));
  page.setData = (patch: Record<string, any>) => {
    Object.keys(patch).forEach(key => {
      page.data[key] = patch[key];
    });
  };
  page.getTabBar = () => undefined;
  return { page, navigations, lookups };
}

const buyerSession = {
  role: 'buyer',
  token: 'buyer-token',
  profile: { contactPerson: 'Anna Rossi', companyName: 'Rossi Boutique', city: 'Milano', status: 'approved' }
};

test('买家会话渲染真实身份、资质状态与订单速览', async () => {
  const { page } = createHarness({ session: buyerSession, unread: 3 });
  page.refreshIdentity();
  assert.equal(page.data.isLoggedIn, true);
  assert.equal(page.data.isBuyer, true);
  assert.equal(page.data.displayName, 'Anna Rossi');
  assert.equal(page.data.identityMeta, 'Rossi Boutique · Milano');
  assert.equal(page.data.statusLabel, '企业资质已通过');
  assert.equal(page.data.statusTone, 'approved');

  await page.loadOverview();
  assert.deepEqual(page.data.orderSummary, { total: 2, pendingPayment: 1, toShip: 0, shipping: 1, afterSales: 0 });
  assert.equal(page.data.unreadCount, 3);
  assert.equal(page.data.approvedAuthorizationCount, 1);
  assert.equal(page.data.orderError, '');
});

test('未登录不显示伪造数字，订单与授权入口先引导登录', () => {
  const { page, navigations } = createHarness({ session: null });
  page.refreshIdentity();
  assert.equal(page.data.isLoggedIn, false);
  page.loadOverview();
  assert.equal(page.data.orderSummary, null);
  assert.equal(page.data.overviewNote, '登录后查看订单与状态');
  page.openOrders({ currentTarget: { dataset: { filter: 'pendingPayment' } } });
  page.openAuthorizations();
  page.openIdentity();
  assert.deepEqual(navigations, [
    '/pages/login/index?returnTab=profile',
    '/pages/login/index?returnTab=profile',
    '/pages/login/index?returnTab=profile'
  ]);
});

test('授权码弹窗：格式错误不发请求，有效码进入真实店铺', async () => {
  const { page, navigations, lookups } = createHarness({ session: buyerSession });
  page.openCodeModal();
  assert.equal(page.data.codeModalOpen, true);

  page.onCodeInput({ detail: { value: '12345' } });
  await page.submitCode();
  assert.match(page.data.codeError, /6 位数字/);
  assert.deepEqual(lookups, []);
  assert.equal(page.data.codeModalOpen, true);

  page.onCodeInput({ detail: { value: '000001' } });
  await page.submitCode();
  assert.deepEqual(lookups, ['000001']);
  assert.equal(page.data.codeModalOpen, false);
  assert.deepEqual(navigations, ['/pages/store/index?storeSlug=modaui']);
  assert.equal(page.data.codeInput, '');
});

test('授权码不存在时在弹窗内提示并允许修改重试', async () => {
  const { page, navigations, lookups } = createHarness({
    session: buyerSession,
    lookup: async () => {
      const error: any = new Error('MERCHANT_STORE_NOT_FOUND');
      error.status = 404;
      error.code = 'MERCHANT_STORE_NOT_FOUND';
      throw error;
    }
  });
  page.openCodeModal();
  page.onCodeInput({ detail: { value: '000002' } });
  await page.submitCode();
  assert.equal(page.data.codeError, '未找到该授权码对应的公开店铺');
  assert.equal(page.data.codeModalOpen, true);
  assert.equal(page.data.codeLoading, false);
  assert.deepEqual(lookups, ['000002']);
  assert.deepEqual(navigations, []);

  page.onCodeInput({ detail: { value: '000003' } });
  assert.equal(page.data.codeError, '', '修改输入后应立即清除错误提示');
});

test('商家会话显示商家身份且不加载买家订单', () => {
  const { page, navigations } = createHarness({
    session: { role: 'merchant', token: 'merchant-token', profile: { name: 'Owner' }, merchant: { name: 'Atelier Alba' } }
  });
  page.refreshIdentity();
  assert.equal(page.data.hasMerchantAccess, true);
  assert.equal(page.data.isBuyer, false);
  assert.equal(page.data.displayName, 'Atelier Alba');
  page.loadOverview();
  assert.equal(page.data.orderSummary, null);
  assert.equal(page.data.overviewNote, '商家订单请在商家中心处理');
  page.openIdentity();
  assert.deepEqual(navigations, ['/pages/settings/index']);
});


import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = process.cwd();
const pageSource = readFileSync(
  path.join(root, 'merchant-miniprogram', 'pages', 'counterparties', 'index.js'),
  'utf8'
);

function createPageHarness() {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ path: string; options: Record<string, any> }> = [];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(id: string) {
      if (id === '../../utils/api') {
        return {
          request: async (requestPath: string, options: Record<string, any> = {}) => {
            calls.push({ path: requestPath, options });
            if (requestPath === '/api/merchant/counterparties') return { counterparties: [] };
            if (requestPath === '/api/merchant/customers') return { customers: [] };
            if (requestPath === '/api/merchant/suppliers') return { suppliers: [] };
            if (requestPath === '/api/merchant/orders') {
              return {
                orders: [
                  { id: 'order-1', customerId: 'customer-1', createdAt: '2026-06-12', totalAmount: 100 },
                  { id: 'order-2', customerId: 'customer-1', createdAt: '2026-06-20', totalAmount: 250 }
                ]
              };
            }
            return { success: true };
          }
        };
      }
      if (id === '../../utils/page-auth') {
        return { requireMerchantSession: async () => ({ session: { role: 'merchant' }, response: {} }) };
      }
      if (id === '../../utils/permissions') {
        return {
          canAccessPermissions: (_auth: unknown, permissions: string[]) =>
            permissions.includes('sales.order.create') || permissions.includes('purchase.manage')
        };
      }
      throw new Error(`Unexpected module: ${id}`);
    },
    wx: {
      showToast() {},
      stopPullDownRefresh() {}
    },
    Promise,
    console
  };
  vm.runInNewContext(pageSource, context, { filename: 'counterparties-page.js' });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(values: Record<string, unknown>) {
      Object.assign(this.data, values);
    }
  });
  return { page, calls };
}

test('counterparties page is registered in the mini-program routes', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'merchant-miniprogram', 'app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/counterparties/index'));
  const morePage = readFileSync(path.join(root, 'merchant-miniprogram', 'pages', 'more', 'index.js'), 'utf8');
  assert.match(morePage, /wx\.navigateTo\(\{ url: '\/pages\/counterparties\/index' \}\)/);
});

test('home and More company cards open a shareable business card page', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'merchant-miniprogram', 'app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/business-card/index'));
  const cardConfig = JSON.parse(readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'business-card', 'index.json'),
    'utf8'
  ));
  assert.equal('enableShareAppMessage' in cardConfig, false);
  const dashboardMarkup = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'dashboard', 'index.wxml'),
    'utf8'
  );
  const moreMarkup = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'more', 'index.wxml'),
    'utf8'
  );
  const dashboardLogic = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'dashboard', 'index.js'),
    'utf8'
  );
  const moreLogic = readFileSync(path.join(root, 'merchant-miniprogram', 'pages', 'more', 'index.js'), 'utf8');
  const cardMarkup = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'business-card', 'index.wxml'),
    'utf8'
  );
  const cardLogic = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'business-card', 'index.js'),
    'utf8'
  );
  const cardStyles = readFileSync(
    path.join(root, 'merchant-miniprogram', 'pages', 'business-card', 'index.wxss'),
    'utf8'
  );
  assert.match(dashboardMarkup, /bindtap="openBusinessCard"/);
  assert.match(moreMarkup, /bindtap="openBusinessCard"/);
  assert.match(dashboardLogic, /\/pages\/business-card\/index/);
  assert.match(moreLogic, /\/pages\/business-card\/index/);
  assert.match(cardMarkup, /open-type="share"/);
  assert.doesNotMatch(cardMarkup, /class="contact-label"/);
  for (const icon of ['icon-address', 'icon-phone', 'icon-email', 'icon-website', 'icon-tax', 'icon-bank']) {
    assert.ok(cardMarkup.includes(icon), `${icon} is available without a text label`);
  }
  assert.match(cardStyles, /\.card-popup[\s\S]*?width:\s*680rpx/);
  assert.match(cardStyles, /height:\s*560rpx/);
  assert.match(cardStyles, /max-height:\s*78vh/);
  assert.match(cardStyles, /\.card-overlay[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center/);
  assert.match(cardStyles, /\.company-name[\s\S]*?font-size:\s*30rpx/);
  assert.match(cardStyles, /\.contact-value[\s\S]*?font-size:\s*20rpx/);
  assert.match(cardMarkup, /<\/view>\s*<view class="card-actions">/);
  assert.match(cardMarkup, /open-type="share">分享<\/button>/);
  assert.match(cardMarkup, /bindtap="saveContact">保存<\/button>/);
  assert.match(cardStyles, /page\s*\{\s*background:\s*transparent/);
  assert.match(cardStyles, /\.card-overlay[\s\S]*?background:\s*rgba\(23,\s*22,\s*20,\s*\.38\)/);
  assert.match(cardMarkup, /<image wx:if="\{\{logoUrl\}\}" class="brand-logo"/);
  assert.match(cardMarkup, /<image wx:else class="brand-logo" src="\/assets\/default-merchant-logo\.jpg"/);
  assert.match(cardStyles, /\.card-actions[\s\S]*?justify-content:\s*center/);
  assert.match(cardStyles, /\.action-button[\s\S]*?width:\s*180rpx[\s\S]*?height:\s*72rpx/);
  assert.match(cardStyles, /\.action-button[\s\S]*?background:\s*#fff/);
  assert.match(cardLogic, /onShareAppMessage\(\)/);
  assert.match(cardLogic, /\/api\/merchants\/store\//);
});

test('customer and supplier searches are independent and retained when switching tabs', () => {
  const { page } = createPageHarness();
  page.data.customers = [
    { id: 'customer-1', companyName: 'Roma Boutique', phone: '+39 111' },
    { id: 'customer-2', companyName: 'Milano Store', phone: '+39 222' }
  ];
  page.data.suppliers = [
    { id: 'supplier-1', name: 'Tessuti Roma', phone: '+39 333' },
    { id: 'supplier-2', name: 'Bottoni Milano', phone: '+39 444' }
  ];
  page.onSearch({ currentTarget: { dataset: { role: 'customers' } }, detail: { value: 'roma' } });
  page.onSearch({ currentTarget: { dataset: { role: 'suppliers' } }, detail: { value: 'bottoni' } });
  assert.deepEqual(page.data.visibleCustomers.map((item: any) => item.id), ['customer-1']);
  assert.deepEqual(page.data.visibleSuppliers.map((item: any) => item.id), ['supplier-2']);

  page.selectTab({ currentTarget: { dataset: { tab: 'suppliers' } } });
  page.selectTab({ currentTarget: { dataset: { tab: 'customers' } } });
  assert.equal(page.data.customerQuery, 'roma');
  assert.equal(page.data.supplierQuery, 'bottoni');
});

test('adding a second role links the existing shared counterparty instead of duplicating its profile', async () => {
  const { page, calls } = createPageHarness();
  page.data.canManageCustomer = true;
  page.data.canManageSupplier = true;
  page.data.counterparties = [{
    id: 'shared-id',
    companyName: 'Tessuti Roma',
    contactName: 'Luca',
    phone: '+39 123',
    supplier: null,
    customerLink: null
  }];
  page.openCreateCustomer();
  page.onLinkCandidateChange({ detail: { value: 1 } });
  assert.equal(page.data.form.counterpartyId, 'shared-id');
  assert.equal(page.data.form.name, 'Tessuti Roma');

  page.data.form.phone = '+39 123';
  page.data.formRole = 'customer';
  page.data.editorMode = 'create';
  await page.saveCounterparty();

  const createCall = calls.find(call => call.path === '/api/merchant/customers' && call.options.method === 'POST');
  assert.ok(createCall);
  assert.equal(createCall.options.data.counterpartyId, 'shared-id');
  assert.equal(createCall.options.data.companyName, 'Tessuti Roma');
});

test('customer detail summary is calculated from that customer’s real orders', async () => {
  const { page } = createPageHarness();
  page.data.customers = [{ id: 'customer-1', companyName: 'Roma Boutique' }];

  await page.openDetail({ currentTarget: { dataset: { role: 'customers', id: 'customer-1' } } });

  assert.deepEqual(JSON.parse(JSON.stringify(page.data.detailStats)), [
    { label: '累计订单', value: '2' },
    { label: '累计金额', value: '€350.00' },
    { label: '最近下单', value: '2026-06-20' }
  ]);
});

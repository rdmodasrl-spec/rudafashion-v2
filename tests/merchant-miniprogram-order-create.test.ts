import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const pageSource = readFileSync(new URL('../merchant-miniprogram/pages/order-create/index.js', import.meta.url), 'utf8');
const pageMarkup = readFileSync(new URL('../merchant-miniprogram/pages/order-create/index.wxml', import.meta.url), 'utf8');

function createPage(request: (path: string, options?: Record<string, unknown>) => Promise<unknown> = async () => ({})) {
  let definition: Record<string, any> | undefined;
  const toasts: string[] = [];
  let lastRequest: { path: string; options?: Record<string, unknown> } | undefined;
  runInNewContext(pageSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') {
        return {
          request: async (path: string, options?: Record<string, unknown>) => {
            lastRequest = { path, options };
            return request(path, options);
          },
          getAssetUrl: (value: string) => value
        };
      }
      if (specifier === '../../utils/page-auth') return { requireMerchantSession: async () => null };
      if (specifier === '../../utils/permissions') return { canAccessPermissions: () => true, canAccessTab: () => true };
      if (specifier === '../../utils/tabbar') return { syncTabBar: () => undefined };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      showToast: (options: { title: string }) => toasts.push(options.title),
      showModal: (options: { success: () => void }) => options.success(),
      navigateBack: () => undefined
    },
    Date,
    Math,
    console
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return { page, toasts, getLastRequest: () => lastRequest };
}

test('order creation keeps inventory and preorder quantities separate and totals the real customer price', () => {
  const { page } = createPage();
  const product = {
    id: 'product-1',
    name: 'Jacket',
    styleNo: 'RD-1',
    moq: 5,
    packSize: 5,
    wholesalePrice: 45,
    skus: [{ sku: 'RD-1-BLK-M', stockCentral: 8, reserved: 1, color: 'Black', size: 'M' }]
  };
  page.data.mode = 'wholesale';
  page.data.products = [product];
  page.data.selectedProduct = product;
  page.data.selectedCustomer = { id: 'customer-1', discountRate: 0.8 };
  page.data.skuDrafts = [{ sku: 'RD-1-BLK-M', color: 'Black', size: 'M', quantityInput: '10', preorderInput: '3', availableQuantity: 7 }];

  page.confirmSkuSelection();

  assert.equal(page.data.lines.length, 1);
  assert.equal(page.data.lines[0].quantity, 10);
  assert.equal(page.data.lines[0].inStockQuantity, 7);
  assert.equal(page.data.lines[0].preorderQuantity, 3);
  assert.equal(page.data.lines[0].unitPrice, 36);
  assert.equal(page.data.lines[0].lineAmount, '360.00');
  assert.equal(page.data.totalQuantity, 10);
  assert.equal(page.data.totalAmount, '360.00');
});

test('order creation rejects a wholesale SKU whose stock split exceeds available inventory', () => {
  const { page, toasts } = createPage();
  const product = { id: 'product-1', name: 'Jacket', styleNo: 'RD-1', moq: 1, packSize: 1, wholesalePrice: 45, skus: [] };
  page.data.mode = 'wholesale';
  page.data.products = [product];
  page.data.selectedProduct = product;
  page.data.selectedCustomer = { id: 'customer-1', discountRate: 1 };
  page.data.skuDrafts = [{ sku: 'RD-1-BLK-M', color: 'Black', size: 'M', quantityInput: '5', preorderInput: '2', availableQuantity: 2 }];

  page.confirmSkuSelection();

  assert.equal(page.data.lines.length, 0);
  assert.match(toasts[0], /现货最多 2 件/);
});

test('POS order uses the real employee-order API and does not claim payment by default', async () => {
  const { page, getLastRequest } = createPage(async () => ({
    success: true,
    order: { orderNo: 'POS-TEST-1', totalAmount: 30 }
  }));
  page.data.mode = 'pos';
  page.data.paymentMethod = 'bank_transfer';
  page.data.lines = [{
    lineKey: 'product-1:SKU-1',
    productId: 'product-1',
    sku: 'SKU-1',
    color: 'Black',
    size: 'M',
    quantity: 2,
    inStockQuantity: 2,
    preorderQuantity: 0
  }];

  await page.submitOrder();

  const submitted = getLastRequest();
  assert.equal(submitted?.path, '/api/merchant/employee-orders');
  const body = JSON.parse(JSON.stringify(submitted?.options?.data));
  assert.equal(body.source, 'pos');
  assert.equal(body.paymentMethod, 'bank_transfer');
  assert.equal(body.paymentConfirmed, undefined);
  assert.deepEqual(body.items[0], {
    productId: 'product-1',
    sku: 'SKU-1',
    color: 'Black',
    size: 'M',
    quantity: 2,
    inStockQuantity: 2,
    preorderQuantity: 0
  });
});

test('order creation markup includes the compact customer, SKU, review and payment steps', () => {
  for (const marker of ['添加商品', '选择客户', '数量', '订货', '核对订单', 'POS 快速开单', '银行转账不会将订单标记为已付款']) {
    assert.ok(pageMarkup.includes(marker), `missing order workflow section: ${marker}`);
  }
});

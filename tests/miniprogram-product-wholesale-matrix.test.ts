import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const productPageSource = readFileSync(new URL('../miniprogram/pages/product/index.js', import.meta.url), 'utf8');

function createProductPage(productOverrides: Record<string, any> = {}) {
  let definition: Record<string, any> | undefined;
  const cartItems: Array<Record<string, any>> = [];
  const navigations: string[] = [];
  const toasts: string[] = [];
  const modals: Array<{ title: string; content: string }> = [];
  const supportDrafts: Array<Record<string, string>> = [];
  const product = {
    id: 'coat-1',
    name: 'Coat',
    name_zh: '外套',
    styleNo: 'COAT-1',
    merchantId: 'merchant-1',
    merchantName: 'Test Merchant',
    wholesalePrice: 32,
    wholesalePrice100: 30,
    bulkPriceMinimumQuantity: 100,
    moq: 1,
    packSize: 1,
    images: [],
    media: [],
    skus: [
      { sku: 'COAT-WHITE-S', color: 'White', colorCode: '#ffffff', size: 'S', stockCentral: 10, reserved: 3, isActive: true },
      { sku: 'COAT-WHITE-M', color: 'White', colorCode: '#ffffff', size: 'M', stockCentral: 20, reserved: 5, isActive: true },
      { sku: 'COAT-BLACK-S', color: 'Black', colorCode: '#111111', size: 'S', stockCentral: 8, reserved: 2, isActive: true }
    ],
    ...productOverrides
  };
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          getAssetUrl: (value: string) => value,
          getProduct: async () => ({ product })
        };
      }
      if (specifier === '../../utils/auth') return { getAuthSession: () => ({ role: 'buyer' }) };
      if (specifier === '../../utils/cart') {
        return {
          addCartItem(item: Record<string, any>) { cartItems.push(item); },
          readCart: () => cartItems
        };
      }
      if (specifier === '../../utils/preferences') {
        return { formatEurAmount: (value: number) => `€${Number(value).toFixed(2)}` };
      }
      throw new Error(`Unexpected module ${specifier}`);
    },
    wx: {
      showToast(options: { title: string }) { toasts.push(options.title); },
      showModal(options: { title: string; content: string }) { modals.push(options); },
      showLoading() {},
      hideLoading() {},
      navigateTo(options: { url: string }) { navigations.push(options.url); },
      showActionSheet(options: { itemList: string[]; success: (result: { tapIndex: number }) => void }) {
        options.success({ tapIndex: 0 });
      },
      setStorageSync(key: string, value: Record<string, string>) {
        if (key === 'rudaProductSupportDraft') supportDrafts.push(value);
      }
    },
    console: { warn() {}, error() {} }
  };
  runInNewContext(productPageSource, context);
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: { ...definition.data },
    setData(changes: Record<string, any>) { Object.assign(this.data, changes); }
  });
  return { page, cartItems, navigations, toasts, modals, supportDrafts };
}

test('product matrix loads dynamic options, keeps stock separate, and allows backorder quantities', async () => {
  const { page } = createProductPage();
  await page.onLoad({ productId: 'coat-1' });

  assert.deepEqual(Array.from(page.data.selectedColors), ['White']);
  assert.deepEqual(Array.from(page.data.matrixRows[0].cells, (cell: any) => cell.size), ['S', 'M']);
  assert.equal(page.data.matrixRows.some((row: any) => row.color === 'Black'), false);
  assert.equal(page.data.skus.find((sku: any) => sku.sku === 'COAT-WHITE-S').stockCentral, 7);
  assert.equal(page.data.matrixRows.find((row: any) => row.color === 'White').cells[0].stock, 7);
  page.onMatrixQuantityInput({
    currentTarget: { dataset: { sku: 'COAT-WHITE-S' } },
    detail: { value: '12' }
  });
  assert.equal(page.data.skus.find((sku: any) => sku.sku === 'COAT-WHITE-S').quantity, 12);
  assert.equal(page.data.selectedSkuSummary, '白色 / S × 12');
  page.toggleColor({ currentTarget: { dataset: { color: 'Black' } } });
  assert.equal(page.data.matrixRows.some((row: any) => row.color === 'Black'), true);
  assert.equal(page.data.matrixRows.find((row: any) => row.color === 'Black').cells.length, 1);
  assert.equal(page.data.expandedColor, 'Black');
  assert.equal(page.data.selectedQuantity, 12);
});

test('a SKU explicitly disabled for backorders remains capped at available stock', async () => {
  const { page } = createProductPage({
    skus: [
      { sku: 'COAT-BLACK-M', color: 'Black', colorCode: '#111111', size: 'M', stockCentral: 5, reserved: 2, allowBackorder: false, isActive: true }
    ]
  });
  await page.onLoad({ productId: 'coat-1' });
  page.onMatrixQuantityInput({
    currentTarget: { dataset: { sku: 'COAT-BLACK-M' } },
    detail: { value: '9' }
  });
  assert.equal(page.data.skus[0].quantity, 3);
});

test('no-size SKUs display as 均码 without hard-coded size choices', async () => {
  const { page } = createProductPage({
    skus: [
      { sku: 'SCARF-ONE', color: 'Stone', colorCode: '#aaa', size: 'ONE SIZE', stockCentral: 10, reserved: 0, isActive: true }
    ]
  });
  await page.onLoad({ productId: 'coat-1' });

  assert.deepEqual(Array.from(page.data.colorOptions, (option: any) => option.color), ['Stone']);
  assert.equal(page.data.matrixRows[0].cells.length, 1);
  assert.equal(page.data.matrixRows[0].cells[0].size, '均码');
});
test('submit-order action adds selected SKU lines to the cart and opens checkout', async () => {
  const { page, cartItems, navigations } = createProductPage();
  await page.onLoad({ productId: 'coat-1' });
  page.onMatrixQuantityInput({
    currentTarget: { dataset: { sku: 'COAT-BLACK-S' } },
    detail: { value: '3' }
  });
  await page.orderNow();

  assert.equal(cartItems.length, 1);
  assert.equal(cartItems[0].sku, 'COAT-BLACK-S');
  assert.equal(cartItems[0].quantity, 3);
  assert.equal(navigations[0], '/pages/checkout/index');
});

test('customer service draft carries current product and selected SKU details', async () => {
  const { page, navigations, supportDrafts } = createProductPage();
  await page.onLoad({ productId: 'coat-1' });
  page.onMatrixQuantityInput({
    currentTarget: { dataset: { sku: 'COAT-WHITE-M' } },
    detail: { value: '4' }
  });
  page.openCustomerService();

  assert.equal(navigations[0], '/pages/support/index?source=product');
  assert.ok(supportDrafts[0].subject.includes('询库存'));
  assert.ok(supportDrafts[0].message.includes('COAT-1'));
  assert.ok(supportDrafts[0].message.includes('白色 / M：4 件'));
});

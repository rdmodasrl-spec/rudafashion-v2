import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = process.cwd();
const pageSource = readFileSync(
  path.join(root, 'merchant-miniprogram', 'pages', 'workspace', 'index.js'),
  'utf8'
);

function createPageHarness() {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ path: string; options: Record<string, any> }> = [];
  const toasts: string[] = [];
  const categories = [{ id: 'category-1', name: 'Outerwear', slug: 'outerwear', isActive: true }];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(id: string) {
      if (id === '../../utils/api') {
        return {
          request: async (requestPath: string, options: Record<string, any> = {}) => {
            calls.push({ path: requestPath, options });
            const method = options.method || 'GET';
            if (requestPath === '/api/merchant/store-categories' && method === 'GET') {
              return { categories: categories.map(item => ({ ...item })) };
            }
            if (requestPath === '/api/merchant/store-categories' && method === 'POST') {
              categories.push({ id: 'category-2', slug: 'new-name', name: options.data.name, isActive: true });
              return { success: true };
            }
            const categoryMatch = requestPath.match(/^\/api\/merchant\/store-categories\/(.+)$/);
            if (categoryMatch && method === 'PUT') {
              const category = categories.find(item => item.id === categoryMatch[1]);
              if (category) category.name = options.data.name;
              return { success: true };
            }
            if (categoryMatch && method === 'DELETE') {
              const index = categories.findIndex(item => item.id === categoryMatch[1]);
              if (index >= 0) categories.splice(index, 1);
              return { success: true };
            }
            throw new Error(`Unexpected API request: ${method} ${requestPath}`);
          }
        };
      }
      if (id === '../../utils/page-auth') {
        return {
          requireMerchantSession: async () => ({ session: { role: 'merchant' }, response: { merchant: {} } })
        };
      }
      if (id === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      if (id === '../../utils/permissions') return { canAccessWorkspace: () => true };
      throw new Error(`Unexpected module: ${id}`);
    },
    wx: {
      showToast(options: { title: string }) {
        toasts.push(options.title);
      },
      showModal(options: { success: (result: { confirm: boolean }) => void }) {
        options.success({ confirm: true });
      }
    },
    Promise,
    console
  };
  vm.runInNewContext(pageSource, context, { filename: 'workspace-page.js' });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(values: Record<string, unknown>) {
      Object.assign(this.data, values);
    }
  });
  return { page, calls, toasts, categories };
}

test('workspace re-fetches backend records when shown again', async () => {
  const { page, calls, categories } = createPageHarness();
  page.onLoad({ id: 'site_content' });
  await new Promise(resolve => setImmediate(resolve));

  categories[0].name = 'Updated by admin';
  await page.onShow();

  assert.equal(page.data.items[0].title, 'Updated by admin');
  assert.equal(
    calls.filter(call => call.path === '/api/merchant/store-categories').length,
    2
  );
});

test('store category changes use the shared backend create, update and delete APIs', async () => {
  const { page, calls, toasts, categories } = createPageHarness();
  page.onLoad({ id: 'site_content' });
  await new Promise(resolve => setImmediate(resolve));

  page.editCategory({ currentTarget: { dataset: { id: 'category-1' } } });
  assert.equal(page.data.editingCategoryId, 'category-1');
  page.setData({ quickValue: 'Premium Outerwear' });
  await page.createCategory();
  assert.ok(calls.some(call => call.path === '/api/merchant/store-categories/category-1'
    && call.options.method === 'PUT'
    && call.options.data.name === 'Premium Outerwear'));
  assert.equal(categories[0].name, 'Premium Outerwear');

  await page.deleteCategory({ currentTarget: { dataset: { id: 'category-1' } } });
  assert.ok(calls.some(call => call.path === '/api/merchant/store-categories/category-1'
    && call.options.method === 'DELETE'));
  assert.equal(categories.length, 0);
  assert.ok(toasts.includes('分类已更新'));
  assert.ok(toasts.includes('分类已删除'));
});

test('workspace record search and status filters use real source records', () => {
  const { page } = createPageHarness();
  page.data.id = 'procurement';
  page.data.items = [
    {
      title: 'PO-1001',
      meta: '采购单 · ordered · Tessuti Roma',
      source: {
        id: 'order-1',
        purchaseOrderNo: 'PO-1001',
        status: 'ordered',
        totalAmount: 300,
        items: [
          { orderedQuantity: 10, receivedQuantity: 4, unitCost: 20 },
          { orderedQuantity: 5, receivedQuantity: 2, unitCost: 20 }
        ]
      },
      statusLabel: '已下单'
    },
    {
      title: 'PO-1002',
      meta: '采购单 · received · Tessuti Milano',
      source: { id: 'order-2', purchaseOrderNo: 'PO-1002', status: 'received' },
      statusLabel: '已收货'
    }
  ];
  page.data.query = 'roma';
  page.data.statusFilter = 'pending';
  page.applyRecordFilter();
  assert.deepEqual(page.data.visibleItems.map((item: any) => item.source.id), ['order-1']);

  page.openPurchaseOrder({ currentTarget: { dataset: { id: 'order-1' } } });
  assert.equal(page.data.selectedPurchaseOrder.purchaseOrderNo, 'PO-1001');
  assert.equal(page.data.selectedPurchaseOrder.statusLabel, '已下单');
  assert.equal(page.data.selectedPurchaseOrder.detailTotalAmount, '300.00');
  assert.equal(page.data.selectedPurchaseOrder.receivedAmount, '120.00');
  assert.equal(page.data.selectedPurchaseOrder.receivedPercent, 40);

  page.closePurchaseOrder();
  assert.equal(page.data.selectedPurchaseOrder, null);
});

test('materials workspace keeps its editor collapsed and filters real reorder levels', () => {
  const { page } = createPageHarness();
  page.data.id = 'materials';
  page.data.items = [
    { title: 'Silk · FAB-01', meta: '可用 5 · 补货点 4', source: { availableQuantity: 5, reorderPoint: 4 } },
    { title: 'Cotton · FAB-02', meta: '可用 3 · 补货点 4', source: { availableQuantity: 3, reorderPoint: 4 } }
  ];
  page.data.statusFilter = 'low';

  page.applyRecordFilter();

  assert.equal(page.data.showMaterialForm, false);
  assert.deepEqual(page.data.visibleItems.map((item: any) => item.title), ['Cotton · FAB-02']);

  page.toggleMaterialForm();
  assert.equal(page.data.showMaterialForm, true);
});

test('merchant settings keep profile editing collapsed until explicitly opened', () => {
  const { page } = createPageHarness();

  assert.equal(page.data.showSettingsEditor, false);
  page.toggleSettingsEditor();
  assert.equal(page.data.showSettingsEditor, true);
  page.toggleSettingsEditor();
  assert.equal(page.data.showSettingsEditor, false);
});

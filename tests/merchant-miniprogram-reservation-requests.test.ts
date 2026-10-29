import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const pageSource = readFileSync(new URL('../merchant-miniprogram/pages/reservation-requests/index.js', import.meta.url), 'utf8');

function createPageHarness() {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ path: string; options?: Record<string, any> }> = [];
  const toasts: string[] = [];
  let modalAction: Promise<void> | undefined;
  const requests = [{
    id: 'request-1',
    requestNo: 'PR-TEST-001',
    status: 'pending',
    totalQty: 3,
    totalAmount: 96,
    createdAt: '2026-10-24',
    customer: { companyName: 'Buyer Ltd' },
    product: { name: 'Coat', styleNo: 'COAT-1' },
    items: [{ sku: 'COAT-BLACK-M', color: 'Black', size: 'M', quantity: 3 }]
  }];
  const context = {
    Page(value: Record<string, any>) { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          request: async (path: string, options?: Record<string, any>) => {
            calls.push({ path, options });
            if (path === '/api/merchant/product-reservation-requests') return { requests };
            return { success: true };
          }
        };
      }
      if (specifier === '../../utils/page-auth') return { requireMerchantSession: async () => ({}) };
      if (specifier === '../../utils/permissions') return { canAccessPermissions: () => true };
      throw new Error(`Unexpected module ${specifier}`);
    },
    wx: {
      showToast(options: { title: string }) { toasts.push(options.title); },
      showModal(options: { success: (result: { confirm: boolean }) => Promise<void> }) {
        modalAction = options.success({ confirm: true });
      },
      stopPullDownRefresh() {}
    }
  };
  runInNewContext(pageSource, context);
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: { ...definition.data },
    setData(changes: Record<string, any>) { Object.assign(this.data, changes); }
  });
  return { page, calls, toasts, get modalAction() { return modalAction; } };
}

test('merchant reservation inbox loads exact SKU intent lines', async () => {
  const { page, calls } = createPageHarness();
  await page.loadRequests();
  assert.equal(calls[0].path, '/api/merchant/product-reservation-requests');
  assert.equal(page.data.requests[0].lines[0].sku, 'COAT-BLACK-M');
  assert.equal(page.data.requests[0].displayAmount, '€96.00');
});

test('merchant confirmation uses the decision API and explains no stock is held', async () => {
  const harness = createPageHarness();
  const { page, calls, toasts } = harness;
  await page.loadRequests();
  page.decideRequest({ currentTarget: { dataset: { id: 'request-1', status: 'confirmed' } } });
  await harness.modalAction;

  const decision = calls.find(call => call.options?.method === 'POST');
  assert.equal(decision?.path, '/api/merchant/product-reservation-requests/request-1/decision');
  assert.equal(decision?.options?.data.status, 'confirmed');
  assert.ok(toasts.includes('意向已确认'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { hasEmployeePermission } from '../src/server/employeePermissions';
import {
  merchantAssistantCapabilityRegistryVersion,
  resolveMerchantAssistantDataAccess
} from '../src/server/merchantAssistantCapabilityRegistry';
import {
  asksAboutInventoryMovements,
  asksAboutMerchantPromotions,
  asksAboutStockTransfers,
  asksForMerchantProductAudit,
  asksForMerchantPromotionReport,
  asksForMerchantRefundAnalysis,
  asksForMerchantRegionalOrderBreakdown,
  asksForSalesAndOrderMetrics,
  hasMerchantCustomerLookupCriteria
} from '../src/server/merchantAssistantIntent';
import { getMerchantAssistantDateRange } from '../src/server/merchantAssistantDateRange';

test('capability registry is versioned and uses effective employee permissions', () => {
  assert.match(merchantAssistantCapabilityRegistryVersion, /^\d+\.\d+\.\d+$/);

  const accessFor = (role: string, permissions?: string[]) => resolveMerchantAssistantDataAccess(
    permission => hasEmployeePermission(role, permissions, permission),
    false
  );

  assert.deepEqual(accessFor('sales'), {
    orders: true, inventory: false, materials: false, production: false,
    products: true, customers: true, finance: false, profile: false
  });
  assert.deepEqual(accessFor('warehouse'), {
    orders: true, inventory: true, materials: false, production: false,
    products: false, customers: false, finance: false, profile: false
  });
  assert.deepEqual(accessFor('knowledge_manager'), {
    orders: false, inventory: false, materials: false, production: false,
    products: false, customers: false, finance: false, profile: false
  });
  assert.equal(accessFor('sales', []).orders, false);
  assert.ok(Object.values(resolveMerchantAssistantDataAccess(() => false, true)).every(Boolean));
});

test('versioned natural-language regression cases route only known read intents', () => {
  const cases = [
    ['sales and order totals', ['看一下本月订单数和销售额', 'Show sales revenue and order counts this month', 'Mostrami ricavi e numero degli ordini questo mese'], asksForSalesAndOrderMetrics],
    ['inventory movement history', ['查询库存流水', 'show inventory history', 'mostra lo storico delle scorte'], asksAboutInventoryMovements],
    ['stock transfer history', ['看一下库存调拨记录', 'show stock transfers history', 'mostra i trasferimenti di magazzino'], asksAboutStockTransfers],
    ['current promotions', ['目前有哪些折扣活动？', 'show current discount promotions', 'quali promozioni sono attive?'], asksAboutMerchantPromotions],
    ['promotion redemption report', ['统计优惠活动核销情况', 'show discount redemption report', 'mostra il report dei riscatti promozione'], asksForMerchantPromotionReport],
    ['refund totals', ['退款金额统计', 'show total refund amount this month', 'mostra l’importo totale dei rimborsi'], asksForMerchantRefundAnalysis],
    ['regional order breakdown', ['按国家分析订单分布', 'show sales by country breakdown', 'mostra la distribuzione delle vendite per paese'], asksForMerchantRegionalOrderBreakdown],
    ['product content audit', ['找出缺少图片的商品', 'find products without images', 'trova prodotti senza immagini'], asksForMerchantProductAudit],
    ['customer lookup', ['找米兰 VIP 客户', 'find VIP customers in Milan', 'trova clienti VIP a Milano'], hasMerchantCustomerLookupCriteria]
  ] as const;

  for (const [capability, utterances, evaluate] of cases) {
    for (const utterance of utterances) {
      assert.equal(evaluate(utterance), true, `${capability}: ${utterance}`);
    }
  }
  assert.equal(asksForMerchantPromotionReport('design a new discount campaign'), false);
  assert.equal(asksForMerchantRefundAnalysis('cancel and refund this order'), false);
});

test('merchant analytics date intent resolves Chinese, Italian, and English periods', () => {
  const now = new Date('2026-10-04T10:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('本月销售', now).start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('sales this month', now).start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('ricavi questo mese', now).start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('mese scorso', now).start.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('ultimi 7 giorni', now).start.toISOString(), '2026-09-27T10:00:00.000Z');
  assert.equal(getMerchantAssistantDateRange('oggi', now).start.toISOString(), '2026-10-04T00:00:00.000Z');
});

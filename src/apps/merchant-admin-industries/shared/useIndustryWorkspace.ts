/**
 * 行业工作区共享数据装配：真实 API 读取 + 统一 KPI 口径。
 * 不含行业分支；行业差异由 capability 与页面组合决定。
 */
import { useEffect, useMemo, useState } from 'react';
import type { MerchantIndustryCapability } from '../../../constants/merchantIndustryCapabilities';
import {
  fetchMerchantSettings,
  useIndustryMerchant,
  useRemoteList,
  type IndustryInventoryBalance,
  type IndustryPurchaseOrder,
  type IndustryPosSale
} from './data';

export function useIndustryWorkspace(capability: MerchantIndustryCapability) {
  const base = useIndustryMerchant();
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMerchantSettings()
      .then(snapshot => { if (alive) setEditingEnabled(snapshot.productEditingEnabled); })
      .catch(() => undefined)
      .finally(() => { if (alive) setSettingsReady(true); });
    return () => { alive = false; };
  }, []);

  const inventory = useRemoteList<IndustryInventoryBalance>('/api/merchant/inventory/balances?pageSize=300', 'balances');
  const purchaseOrders = useRemoteList<IndustryPurchaseOrder>(
    capability.features.procurement ? '/api/merchant/purchase-orders' : null,
    'purchaseOrders'
  );
  const posSales = useRemoteList<IndustryPosSale>(
    capability.features.pos ? '/api/merchant/pos/sales' : null,
    'sales'
  );

  const metrics = useMemo(() => {
    const { products, orders } = base;
    const pendingOrders = orders.filter(order => ['pending', 'placed', 'confirmed', 'picking'].includes(order.status));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthOrders = orders.filter(order => {
      const stamp = Date.parse(String(order.createdAt || order.date || ''));
      return Number.isFinite(stamp) && stamp >= monthStart.getTime() && order.status !== 'cancelled';
    });
    const monthSales = monthOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const publishedProducts = products.filter(product => (product.lifecycleStatus || 'published') === 'published');
    const stockTotal = products.reduce(
      (sum, product) => sum + Number((product.skus || []).reduce((skuSum, sku) => skuSum + Number(sku.stockCentral || 0), 0)),
      0
    );
    const lowStockSkus = inventory.items.filter(item => item.availableQuantity <= 5).length;
    const pendingPurchases = purchaseOrders.items.filter(order => ['draft', 'ordered', 'partially_received'].includes(order.status)).length;
    const posSalesTotal = posSales.items.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    return {
      pendingOrders: pendingOrders.length,
      monthSales,
      publishedProducts: publishedProducts.length,
      productCount: products.length,
      stockTotal,
      lowStockSkus,
      pendingPurchases,
      posSalesTotal,
      posSalesCount: posSales.items.length
    };
  }, [base.products, base.orders, inventory.items, purchaseOrders.items, posSales.items]);

  return {
    ...base,
    editingEnabled,
    settingsReady,
    inventory,
    purchaseOrders,
    posSales,
    metrics
  };
}

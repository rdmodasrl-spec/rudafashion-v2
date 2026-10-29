/**
 * 贸易批发商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'trading_wholesale',
  title: '贸易批发',
  summary: '多品牌多品类采购与批发分销',
  metrics: [
    { key: 'pendingOrders', label: '待确认订单', suffix: '单', emphasis: true },
    { key: 'pendingVaultRequests', label: '授权申请', suffix: '条' },
    { key: 'lowStockSkus', label: '待补货 SKU', suffix: '个' },
    { key: 'totalProducts', label: '商品数', suffix: '个' }
  ],
  actions: [
    { id: 'create-product', label: '新增商品', description: '品牌、品类与规格', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单管理', description: '确认与发货', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'procurement', label: '采购订货', description: '采购单与到货', icon: 'procurement', module: 'procurement', permission: 'purchase.manage', target: { type: 'workspace', module: 'procurement' } },
    { id: 'suppliers', label: '供应商', description: '供货价与交期', icon: 'boxes', module: 'suppliers', permission: 'purchase.manage', target: { type: 'workspace', module: 'counterparties' } },
    { id: 'inventory', label: '库存管理', description: '通用库存调整', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'vault', label: '授权申请', description: '品牌授权审批', icon: 'vault', module: 'customers', permission: 'pricing.approve', target: { type: 'workspace', module: 'vault' } }
  ],
  productFieldKeys: ['brand', 'category', 'spec', 'unit'],
  inventoryNote: '商品不区分颜色尺码时按单 SKU 记账，可售数即实际库存。',
  orderNote: '订单可跨品牌合并，库存按商品维度占用与扣减。'
};

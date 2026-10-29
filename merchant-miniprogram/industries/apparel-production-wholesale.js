/**
 * 服装生产批发商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'apparel_production_wholesale',
  title: '服装生产批发',
  summary: '款式 / 颜色尺码 SKU、成品库存与原料领用',
  metrics: [
    { key: 'pendingOrders', label: '待确认订单', suffix: '单', emphasis: true },
    { key: 'pickingOrders', label: '拣货中', suffix: '单' },
    { key: 'lowStockSkus', label: '低库存 SKU', suffix: '个' },
    { key: 'totalProducts', label: '款式数', suffix: '款' }
  ],
  actions: [
    { id: 'create-product', label: '新建款式', description: '款号、颜色尺码与成品库存', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单履约', description: '确认、拣货、发货', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'inventory', label: '成品库存', description: '按 SKU 盘点与调整', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'materials', label: '原料领用', description: '面辅料台账与领料', icon: 'materials', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'materials' } },
    { id: 'production', label: '生产工单', description: '排产、报工与质检', icon: 'production', module: 'orders', permission: 'production.report', target: { type: 'workspace', module: 'production' } },
    { id: 'procurement', label: '采购补货', description: '采购单与到货入库', icon: 'procurement', module: 'procurement', permission: 'purchase.manage', target: { type: 'workspace', module: 'procurement' } }
  ],
  productFieldKeys: ['styleNo', 'fabric', 'composition', 'season'],
  inventoryNote: '成品按颜色 / 尺码 SKU 记账；原料独立台账，不并入成品可售库存。',
  orderNote: '订单确认后占用成品库存，发货后扣减；取消订单释放占用与已出库数量。'
};

/**
 * 百货批发商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'department_wholesale',
  title: '百货批发',
  summary: '多品类、规格与计量单位、箱规批发',
  metrics: [
    { key: 'pendingOrders', label: '待确认订单', suffix: '单', emphasis: true },
    { key: 'pickingOrders', label: '待发货', suffix: '单' },
    { key: 'lowStockSkus', label: '缺货品类', suffix: '个' },
    { key: 'totalProducts', label: '百货商品', suffix: '个' }
  ],
  actions: [
    { id: 'create-product', label: '新增百货', description: '品类、规格与包装', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单管理', description: '确认、拣货与发货', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'catalog', label: '商品目录', description: '按品类检索库存', icon: 'catalog', module: 'products', permission: 'product.catalog.read', target: { type: 'tab', url: '/pages/products/index' } },
    { id: 'inventory', label: '库存盘点', description: '按 SKU 调整数量', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'procurement', label: '采购补货', description: '缺货品类补单', icon: 'procurement', module: 'procurement', permission: 'purchase.manage', target: { type: 'workspace', module: 'procurement' } },
    { id: 'suppliers', label: '供应商', description: '供货与到货记录', icon: 'boxes', module: 'suppliers', permission: 'purchase.manage', target: { type: 'workspace', module: 'counterparties' } }
  ],
  productFieldKeys: ['barcode', 'category', 'spec', 'unit', 'packaging'],
  inventoryNote: '库存按规格 / 计量单位记账，整箱出货以包装规格换算。',
  orderNote: '确认订单占用库存，发货后扣减；缺货部分按正式规则拆分或拒绝。'
};

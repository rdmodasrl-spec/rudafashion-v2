/**
 * 服装批发商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'apparel_wholesale',
  title: '服装批发',
  summary: '款号、颜色尺码、批发价与起订量',
  metrics: [
    { key: 'pendingOrders', label: '待确认订单', suffix: '单', emphasis: true },
    { key: 'pickingOrders', label: '待发货', suffix: '单' },
    { key: 'lowStockSkus', label: '低库存 SKU', suffix: '个' },
    { key: 'totalProducts', label: '在售款数', suffix: '款' }
  ],
  actions: [
    { id: 'create-product', label: '新增商品', description: '款号、颜色尺码与批发价', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单管理', description: '确认与发货', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'catalog', label: '商品目录', description: '搜索款号与可售件数', icon: 'catalog', module: 'products', permission: 'product.catalog.read', target: { type: 'tab', url: '/pages/products/index' } },
    { id: 'inventory', label: '库存盘点', description: '按 SKU 调整可售数量', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'customers', label: '客户管理', description: '批发客户与授权价', icon: 'counterparties', module: 'customers', permission: 'sales.order.create', target: { type: 'workspace', module: 'customers' } },
    { id: 'procurement', label: '采购补货', description: '缺货款补单', icon: 'procurement', module: 'procurement', permission: 'purchase.manage', target: { type: 'workspace', module: 'procurement' } }
  ],
  productFieldKeys: ['styleNo', 'fabric', 'composition', 'season'],
  inventoryNote: '同款不同颜色 / 尺码独立记账，可售数以 SKU 为准。',
  orderNote: '确认订单占用库存；发货前必须完成收款确认（按协议条款）。'
};

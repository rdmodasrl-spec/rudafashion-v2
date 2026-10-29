/**
 * 综合零售商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'general_retail',
  title: '综合零售',
  summary: '条码零售、门店收银与库存盘点',
  metrics: [
    { key: 'todaySales', label: '今日销售额', suffix: '€', emphasis: true },
    { key: 'totalOrders', label: '累计订单', suffix: '单' },
    { key: 'lowStockSkus', label: '低库存 SKU', suffix: '个' },
    { key: 'totalProducts', label: '在售商品', suffix: '个' }
  ],
  actions: [
    { id: 'pos', label: '收银台', description: '扫码销售、退货与交班', icon: 'pos', module: 'pos', permission: 'sales.order.create', target: { type: 'workspace', module: 'pos' } },
    { id: 'create-product', label: '新增商品', description: '商品编码、条码与零售价', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'catalog', label: '商品目录', description: '按条码检索与改价', icon: 'catalog', module: 'products', permission: 'product.catalog.read', target: { type: 'tab', url: '/pages/products/index' } },
    { id: 'orders', label: '订单管理', description: '线上订单履约', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'inventory', label: '库存盘点', description: '按 SKU 调整数量', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'customers', label: '客户管理', description: '会员与零售客户', icon: 'counterparties', module: 'customers', permission: 'sales.order.create', target: { type: 'workspace', module: 'customers' } }
  ],
  productFieldKeys: ['styleNo', 'barcode', 'category', 'unit'],
  inventoryNote: '单店库存按 SKU 记账，收银销售即时扣减，退货回补。',
  orderNote: '线上订单与门店收银共用同一库存，取消订单会释放占用。'
};

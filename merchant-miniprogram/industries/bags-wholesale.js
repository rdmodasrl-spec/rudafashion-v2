/**
 * 箱包批发商 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'bags_wholesale',
  title: '箱包批发',
  summary: '材质、尺寸与箱包 SKU 库存',
  metrics: [
    { key: 'pendingOrders', label: '待确认订单', suffix: '单', emphasis: true },
    { key: 'pickingOrders', label: '待发货', suffix: '单' },
    { key: 'lowStockSkus', label: '低库存 SKU', suffix: '个' },
    { key: 'totalProducts', label: '箱包款数', suffix: '款' }
  ],
  actions: [
    { id: 'create-product', label: '新增箱包', description: '材质、颜色尺寸与条码', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单管理', description: '确认与发货', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'catalog', label: '商品目录', description: '按款号与尺寸检索', icon: 'catalog', module: 'products', permission: 'product.catalog.read', target: { type: 'tab', url: '/pages/products/index' } },
    { id: 'inventory', label: '库存盘点', description: '按颜色 / 尺寸调整', icon: 'stock', module: 'inventory', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'customers', label: '客户管理', description: '批发客户与授权价', icon: 'counterparties', module: 'customers', permission: 'sales.order.create', target: { type: 'workspace', module: 'customers' } },
    { id: 'procurement', label: '采购补货', description: '缺货款补单', icon: 'procurement', module: 'procurement', permission: 'purchase.manage', target: { type: 'workspace', module: 'procurement' } }
  ],
  productFieldKeys: ['styleNo', 'material', 'dimensions'],
  inventoryNote: '箱包按颜色 / 尺寸 SKU 记账，条码用于扫码出入库。',
  orderNote: '确认订单占用库存，发货后扣减；取消订单释放已占用数量。'
};

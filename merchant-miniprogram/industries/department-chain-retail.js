/**
 * 百货连锁店 · 小程序行业配置（仅界面编排；能力与字段以服务端上下文为准）。
 */
module.exports = {
  templateId: 'department_chain_retail',
  title: '百货连锁',
  summary: '多门店、门店库存、调拨与门店收银',
  metrics: [
    { key: 'todaySales', label: '今日销售额', suffix: '€', emphasis: true },
    { key: 'pendingOrders', label: '待处理订单', suffix: '单' },
    { key: 'lowStockSkus', label: '低库存 SKU', suffix: '个' },
    { key: 'totalProducts', label: '在售商品', suffix: '个' }
  ],
  actions: [
    { id: 'stores', label: '门店管理', description: '门店信息与门店库存', icon: 'store', module: 'stores', permission: 'employees.manage', target: { type: 'workspace', module: 'store' } },
    { id: 'transfers', label: '门店调拨', description: '门店间库存调拨', icon: 'stock', module: 'transfers', permission: 'warehouse.review', target: { type: 'workspace', module: 'inventory' } },
    { id: 'pos', label: '门店收银', description: '销售、退货与交班', icon: 'pos', module: 'pos', permission: 'sales.order.create', target: { type: 'workspace', module: 'pos' } },
    { id: 'create-product', label: '新增商品', description: '零售品类与条码', icon: 'plus_light', module: 'products', permission: 'product.publish', target: { type: 'page', url: '/pages/product-form/index' } },
    { id: 'orders', label: '订单管理', description: '线上订单履约', icon: 'orders', module: 'orders', permission: 'sales.order.create', target: { type: 'tab', url: '/pages/orders/index' } },
    { id: 'team', label: '员工权限', description: '门店员工与角色', icon: 'team', module: 'team', permission: 'employees.manage', target: { type: 'workspace', module: 'team' } }
  ],
  productFieldKeys: ['styleNo', 'barcode', 'category', 'spec'],
  inventoryNote: '库存归属具体门店，调拨需门店双方确认；总库存为门店合计。',
  orderNote: '门店订单由所属门店履约；跨店订单需调拨后发货。'
};

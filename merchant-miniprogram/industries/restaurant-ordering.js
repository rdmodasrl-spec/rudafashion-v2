/**
 * Restaurant · 小程序行业配置（仅入口编排；能力与数据以服务端上下文为准）。
 */
module.exports = {
  templateId: 'restaurant_ordering',
  title: '餐饮工作台',
  summary: '维护餐饮菜单与菜品草稿',
  metrics: [],
  actions: [
    {
      id: 'restaurant-menu',
      label: '菜单管理',
      description: '维护菜单与菜品草稿',
      icon: 'catalog',
      module: 'restaurant_menu',
      permission: 'product.import.draft',
      target: { type: 'page', url: '/pages/restaurant-menu/index' }
    },
    {
      id: 'restaurant-tables',
      label: '桌台管理',
      description: '维护门店桌号与座位数',
      icon: 'store',
      module: 'restaurant_tables',
      permission: 'employees.manage',
      target: { type: 'page', url: '/pages/restaurant-tables/index' }
    }
  ],
  productFieldKeys: [],
  inventoryNote: '餐饮原料库存使用独立配方与库存能力；当前工作台不展示商品库存。',
  orderNote: 'Restaurant POS、顾客下单与厨房出单尚未开放。'
};

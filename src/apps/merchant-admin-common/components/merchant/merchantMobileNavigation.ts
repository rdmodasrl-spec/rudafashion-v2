export const merchantMobilePrimaryTabs = [
  { id: 'dashboard', zh: '首页', it: 'Home' },
  { id: 'products', zh: '商品', it: 'Prodotti' },
  { id: 'ai_home', zh: 'ModaUI', it: 'ModaUI' },
  { id: 'orders', zh: '订单', it: 'Ordini' },
  { id: 'more', zh: '更多', it: 'Altro' }
] as const;

export const merchantMobileMoreGroups = [
  {
    id: 'counterparties',
    zh: '客户交易',
    it: 'Clienti',
    items: [
      { id: 'counterparties', zh: '往来单位', it: 'Controparti', descriptionZh: '客户及供应商', descriptionIt: 'Clienti e fornitori', icon: 'customers' },
      { id: 'procurement', zh: '采购管理', it: 'Acquisti', descriptionZh: '跟进采购到货', descriptionIt: 'Ordini e ricezioni', icon: 'procurement' },
      { id: 'finance', zh: '财务结算', it: 'Finanza', descriptionZh: '查看收款账户', descriptionIt: 'Pagamenti e saldo', icon: 'finance' },
      { id: 'vault', zh: '授权申请', it: 'Accessi', descriptionZh: '审核商品授权', descriptionIt: 'Richieste accesso', icon: 'customers' }
    ]
  },
  {
    id: 'supply',
    zh: '商品仓储',
    it: 'Magazzino',
    items: [
      { id: 'materials', zh: '面料库存', it: 'Materiali', descriptionZh: '面辅料库存', descriptionIt: 'Tessuti e accessori', icon: 'materials' },
      { id: 'inventory', zh: '库存预警', it: 'Scorte', descriptionZh: '库存与预警', descriptionIt: 'Scorte e avvisi', icon: 'inventory' },
      { id: 'production', zh: '生产工单', it: 'Produzione', descriptionZh: '查看生产进度', descriptionIt: 'Avanzamento ordini', icon: 'production' }
    ]
  },
  {
    id: 'store',
    zh: '店铺渠道',
    it: 'Negozio',
    items: [
      { id: 'store', zh: '店铺管理', it: 'Negozio', descriptionZh: '店铺资料维护', descriptionIt: 'Profilo negozio', icon: 'store' },
      { id: 'domains', zh: '店铺域名', it: 'Dominio', descriptionZh: '查看店铺链接', descriptionIt: 'Link del negozio', icon: 'domains' },
      { id: 'site_content', zh: '页面设置', it: 'Pagine', descriptionZh: '编辑店铺页面', descriptionIt: 'Pagine negozio', icon: 'content' },
      { id: 'media', zh: '内容素材', it: 'Contenuti', descriptionZh: '管理店铺图片', descriptionIt: 'Immagini negozio', icon: 'content' }
    ]
  },
  {
    id: 'company',
    zh: '员工系统',
    it: 'Team',
    items: [
      { id: 'team', zh: '员工管理', it: 'Dipendenti', descriptionZh: '账号权限管理', descriptionIt: 'Account e permessi', icon: 'team' },
      { id: 'notifications', zh: '通知中心', it: 'Notifiche', descriptionZh: '业务消息待办', descriptionIt: 'Avvisi e attività', icon: 'notifications' },
      { id: 'app_store', zh: '应用商店', it: 'App store', descriptionZh: '安装与管理应用', descriptionIt: 'Installa e gestisci le app', icon: 'store' },
      { id: 'settings', zh: '系统设置', it: 'Impostazioni', descriptionZh: '经营资料偏好', descriptionIt: 'Preferenze aziendali', icon: 'settings' },
      { id: 'support', zh: '帮助反馈', it: 'Assistenza', descriptionZh: '商家问题反馈', descriptionIt: 'Aiuto per i negozi', icon: 'support' }
    ]
  },
  {
    id: 'privacy',
    zh: '信息保护',
    it: 'Privacy',
    items: [
      { id: 'privacy', zh: '隐私指引', it: 'Privacy', descriptionZh: '信息收集说明', descriptionIt: 'Uso dei dati', icon: 'privacy' }
    ]
  },
  {
    id: 'tools',
    zh: '智能工具',
    it: 'Strumenti smart',
    items: [
      { id: 'ai_employees', zh: '智能员工', it: 'Team AI', descriptionZh: '管理智能员工', descriptionIt: 'Assistenti aziendali', icon: 'ai' }
    ]
  },
  {
    id: 'insights',
    zh: '经营分析',
    it: 'Analisi',
    items: [
      { id: 'growth', zh: '经营增长', it: 'Crescita', descriptionZh: '分析销售活动', descriptionIt: 'Vendite e campagne', icon: 'growth' }
    ]
  }
] as const;

export type MerchantMobileMoreItemId =
  (typeof merchantMobileMoreGroups)[number]['items'][number]['id'];

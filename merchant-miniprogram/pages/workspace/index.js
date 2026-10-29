const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessWorkspace } = require('../../utils/permissions');
const { PUBLIC_SITE_URL } = require('../../utils/constants');

const storefrontTemplates = [
  { id: 'fashion_monochrome', label: '时尚版 · 黑白', description: '简洁留白，突出品牌大片与新品。', colors: ['#ffffff', '#111111', '#e5e5e5'] },
  { id: 'luxury_black_gold', label: '豪华版 · 黑金', description: '深色背景搭配香槟金细节。', colors: ['#11100e', '#c9a96e', '#29251f'] },
  { id: 'ecommerce_standard', label: '标准版 · 电商', description: '清晰商品目录，方便选款和下单。', colors: ['#f3f5f7', '#2563eb', '#ffffff'] }
];

const titles = {
  counterparties: '往来单位',
  customers: '客户管理',
  vault: '授权申请',
  procurement: '采购管理',
  finance: '财务结算',
  growth: '营销增长',
  materials: '材料库存',
  production: '生产工单',
  inventory: '库存管理',
  store: '店铺管理',
  domains: '店铺域名',
  site_content: '页面设置',
  media: '内容素材',
  ai_employees: '智能员工',
  team: '员工管理',
  notifications: '通知中心',
  settings: '系统设置',
  support: '帮助反馈',
  pos: '收银管理',
  returns: '售后管理'
};

function record(title, meta, source) {
  const statusLabels = {
    draft: '草稿',
    ordered: '已下单',
    partially_received: '部分到货',
    received: '已收货',
    cancelled: '已取消',
    released: '待生产',
    in_progress: '生产中',
    qc_hold: '待质检',
    resolved: '已处理',
    pending: '待处理'
  };
  const data = source || {};
  return {
    title: String(title || '—'),
    meta: String(meta || ''),
    source: data,
    statusLabel: statusLabels[data.status] || data.status || ''
  };
}

function fromList(rows, getTitle, getMeta) {
  return (Array.isArray(rows) ? rows : []).map(item => record(getTitle(item), getMeta(item), item));
}

function withField(target, field, value) {
  const result = Object.assign({}, target);
  result[field] = value;
  return result;
}

Page({
  data: {
    id: '',
    title: '',
    loading: false,
    error: '',
    items: [],
    visibleItems: [],
    selectedPurchaseOrder: null,
    query: '',
    filterOptions: [],
    statusFilter: 'all',
    metrics: [],
    editingCategoryId: '',
    showCategoryForm: false,
    showBankForm: false,
    showMaterialForm: false,
    selectedBalance: null,
    adjustmentQuantity: '',
    adjustmentNote: '',
    quickValue: '',
    supportMessage: '',
    supportSubject: '',
    supportReply: '',
    supportConversation: null,
    supportMessages: [],
    categories: [],
    bankHolder: '',
    bankIban: '',
    materialInbound: null,
    materialQuantity: '',
    materialNote: '',
    purchaseSuppliers: [],
    purchaseProducts: [],
    purchaseSupplierRecords: [],
    purchaseSupplierIndex: 0,
    purchaseProductIndex: 0,
    purchaseSkuIndex: 0,
    purchaseQuantity: '1',
    purchaseUnitCost: '',
    supplierName: '',
    supplierContact: '',
    supplierEmail: '',
    supplierLeadTime: '14',
    receiptOrder: null,
    receiptItem: null,
    showSupplierForm: false,
    showPurchaseForm: false,
    showEmployeeForm: false,
    showStorefrontEditor: false,
    showSettingsEditor: false,
    receiptQuantity: '',
    receiptUnitCost: '',
    posShift: null,
    posSettings: {},
    posProducts: [],
    posCart: [],
    posTotal: '0.00',
    paymentMethod: 'cash',
    paymentMethods: [
      { id: 'cash', label: '现金' },
      { id: 'credit_card', label: '银行卡' },
      { id: 'bank_transfer', label: '银行转账' },
      { id: 'wechat_pay', label: '微信支付' },
      { id: 'alipay', label: '支付宝' }
    ],
    openingCash: '',
    closingCash: '',
    cashMovementAmount: '',
    cashMovementNote: '',
    posSaving: false,
    merchantSettings: {},
    storefrontDraft: {
      template: 'fashion_monochrome',
      templateIndex: 0,
      selectedTemplate: storefrontTemplates[0],
      templates: storefrontTemplates,
      shippingPolicy: '',
      returnsPolicy: '',
      seoTitle: '',
      seoDescription: '',
      tagline: '',
      description: ''
    },
    materialDraft: {
      code: '', name: '', category: 'fabric', unit: 'meter',
      unitCost: '0', reorderPoint: '0', leadTimeDays: '0', notes: ''
    },
    materialCategories: [
      { id: 'fabric', label: '面料' }, { id: 'lining', label: '里料' },
      { id: 'trim', label: '辅料' }, { id: 'label', label: '标签' },
      { id: 'packaging', label: '包装' }, { id: 'other', label: '其他' }
    ],
    materialUnits: [
      { id: 'meter', label: '米' }, { id: 'piece', label: '件' },
      { id: 'kg', label: '千克' }, { id: 'roll', label: '卷' }
    ],
    materialCategoryIndex: 0,
    materialUnitIndex: 0,
    employeeDraft: { name: '', email: '', password: '', role: 'sales' },
    employeeRoleIndex: 0,
    employeeEditDraft: { id: '', name: '', role: 'sales', roleLabel: '销售' },
    employeeEditRoleIndex: 0,
    employeePermissionState: {},
    employeeRoles: [
      { id: 'sales', label: '销售', permissions: ['sales.order.create', 'product.catalog.read', 'pricing.request'] },
      { id: 'warehouse', label: '仓库', permissions: ['warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'] },
      { id: 'production', label: '生产', permissions: ['production.report'] },
      { id: 'pos_cashier', label: '收银员', permissions: ['sales.order.create'] },
      { id: 'knowledge_manager', label: '知识库管理员', permissions: ['brain.read', 'brain.write', 'brain.knowledge.review'] },
      {
        id: 'store_manager',
        label: '店长',
        permissions: [
          'sales.order.create', 'sales.quote.manage', 'business.analytics.read', 'product.catalog.read',
          'product.import.draft', 'product.publish', 'product.publish.approve', 'product.cost.view',
          'pricing.request', 'pricing.approve', 'warehouse.pick', 'warehouse.review', 'warehouse.pack',
          'warehouse.ship', 'production.report', 'purchase.manage', 'return.manage', 'employees.manage'
        ]
      }
    ],
    employeePermissionOptions: [
      { id: 'sales.order.create', label: '创建销售订单' },
      { id: 'sales.quote.manage', label: '管理报价' },
      { id: 'business.analytics.read', label: '查看经营分析' },
      { id: 'product.catalog.read', label: '查看商品' },
      { id: 'product.import.draft', label: '导入商品草稿' },
      { id: 'product.publish', label: '管理商品' },
      { id: 'product.publish.approve', label: '审批商品发布' },
      { id: 'product.cost.view', label: '查看商品成本' },
      { id: 'pricing.request', label: '申请改价' },
      { id: 'pricing.approve', label: '审批改价' },
      { id: 'warehouse.pick', label: '拣货' },
      { id: 'warehouse.review', label: '复核' },
      { id: 'warehouse.pack', label: '打包' },
      { id: 'warehouse.ship', label: '出库发货' },
      { id: 'production.report', label: '生产跟进与报工' },
      { id: 'purchase.manage', label: '管理采购' },
      { id: 'return.manage', label: '处理退货退款' },
      { id: 'employees.manage', label: '管理员工与权限' },
      { id: 'brain.read', label: '查看 ModaUI 知识库' },
      { id: 'brain.write', label: '编辑 ModaUI 知识库' },
      { id: 'brain.knowledge.review', label: '审核知识库内容' }
    ]
  },

  onLoad(options) {
    const id = options && options.id ? options.id : '';
    if (!canAccessWorkspace({ session: { role: 'merchant' } }, id)) {
      this.setData({ error: '该功能将在小程序审核通过后开放。' });
      return;
    }
    this._pendingPosBarcode = id === 'pos' && options && options.barcode ? options.barcode : '';
    const title = titles[id];
    if (!title) {
      this.setData({ error: '未找到此商家模块。' });
      return;
    }
    this.setData({
      id,
      title,
      showSupplierForm: false,
      showPurchaseForm: false,
      showEmployeeForm: false,
      showStorefrontEditor: false,
      showSettingsEditor: false,
      showCategoryForm: false,
      showBankForm: false,
      showMaterialForm: false
    });
    this.loadWorkspace();
  },

  onPullDownRefresh() {
    this.loadWorkspace().finally(() => wx.stopPullDownRefresh());
  },

  onShow() {
    if (this._workspaceHasLoaded) return this.loadWorkspace();
  },

  async loadWorkspace() {
    if (this.data.loading) return;
    this.setData({
      loading: true,
      error: '',
      items: [],
      visibleItems: [],
      selectedPurchaseOrder: null,
      metrics: [],
      filterOptions: [],
      query: '',
      statusFilter: 'all'
    });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!canAccessWorkspace(auth, this.data.id)) {
        this.setData({ error: '当前账号没有此工作区权限。' });
        return;
      }
      await this.loadModuleData(auth);
      this.applyRecordFilter();
      if (this.data.id === 'pos' && this._pendingPosBarcode) this.addScannedPosItem();
    } catch (error) {
      this.setData({ error: error.message || '此工作区暂时无法加载，请重试。' });
    } finally {
      this._workspaceHasLoaded = true;
      this.setData({ loading: false });
    }
  },

  async loadModuleData(auth) {
    const id = this.data.id;
    if (id === 'inventory') {
      const result = await request('/api/merchant/inventory/balances?pageSize=500');
      const balances = result.balances || [];
      this.setData({
        items: fromList(balances, item => `${item.product && item.product.name || '商品'} · ${item.sku}`, item =>
          `${item.color || ''} ${item.size || ''} · 可售 ${item.availableQuantity} · 在库 ${item.onHandQuantity} · 占用 ${item.reservedQuantity}`),
        filterOptions: [
          { id: 'all', label: '全部' },
          { id: 'available', label: '有库存' },
          { id: 'out', label: '无库存' }
        ],
        metrics: [
          { label: '库存 SKU', value: String(result.total ?? balances.length) },
          { label: '已加载可售', value: String(balances.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0)) },
          { label: '已加载缺货', value: String(balances.filter(item => Number(item.availableQuantity || 0) <= 0).length) }
        ]
      });
    } else if (id === 'customers') {
      const result = await request('/api/merchant/customers');
      this.setData({ items: fromList(result.customers, item => item.companyName || item.name, item =>
        [item.contactName, item.phone, item.email, item.country, item.status].filter(Boolean).join(' · ')) });
    } else if (id === 'counterparties') {
      const result = await request('/api/merchant/counterparties');
      this.setData({ items: fromList(result.counterparties, item => item.companyName || item.name, item =>
        [item.contactName, item.phone, item.email, item.customerLink && '客户', item.supplier && '供应商'].filter(Boolean).join(' · ')) });
    } else if (id === 'vault') {
      const result = await request('/api/merchant/vault-requests');
      this.setData({ items: fromList(result.requests, item => item.buyerCompanyName || item.companyName || '客户授权申请', item =>
        [item.status, item.note, item.createdAt].filter(Boolean).join(' · ')) });
    } else if (id === 'procurement') {
      const procurementResults = await Promise.all([
        request('/api/merchant/suppliers'),
        request('/api/merchant/purchase-orders'),
        request('/api/merchant/products')
      ]);
      const supplierResult = procurementResults[0];
      const orderResult = procurementResults[1];
      const productResult = procurementResults[2];
      const suppliers = fromList(supplierResult.suppliers, item => item.name, item =>
        ['供应商', item.contactName, item.status, item.leadTimeDays ? `交期 ${item.leadTimeDays} 天` : ''].filter(Boolean).join(' · '));
      const orders = fromList(orderResult.purchaseOrders, item => item.purchaseOrderNo, item =>
        [`采购单 · ${item.status}`, item.supplier && item.supplier.name, item.expectedAt && `预计 ${item.expectedAt}`].filter(Boolean).join(' · '));
      const purchaseOrders = orderResult.purchaseOrders || [];
      const pendingOrders = purchaseOrders.filter(item => ['draft', 'ordered', 'partially_received'].includes(item.status)).length;
      const receivingOrders = purchaseOrders.filter(item => ['ordered', 'partially_received'].includes(item.status)).length;
      const receivedOrders = purchaseOrders.filter(item => item.status === 'received').length;
      const purchaseSuppliers = supplierResult.suppliers || [];
      const purchaseProducts = (productResult.products || []).filter(item =>
        item.lifecycleStatus !== 'archived' && Array.isArray(item.skus) && item.skus.length > 0);
      this.setData({
        items: orders,
        purchaseSupplierRecords: suppliers,
        filterOptions: [
          { id: 'all', label: '全部' },
          { id: 'pending', label: '待处理' },
          { id: 'receiving', label: '进行中' },
          { id: 'received', label: '已完成' }
        ],
        metrics: [
          { label: '采购单', value: String(purchaseOrders.length) },
          { label: '待处理', value: String(pendingOrders) },
          { label: '已完成', value: String(receivedOrders) }
        ],
        purchaseSuppliers,
        purchaseProducts,
        purchaseSupplierIndex: 0,
        purchaseProductIndex: 0,
        purchaseSkuIndex: 0
      });
    } else if (id === 'finance') {
      const financeResults = await Promise.all([
        request('/api/merchant/finance'),
        request('/api/merchant/bank-accounts')
      ]);
      const finance = financeResults[0];
      const accounts = financeResults[1];
      const summary = finance.summary || {};
      const metrics = [
        { label: '累计销售额', value: `€${Number(summary.totalGross || 0).toFixed(2)}` },
        { label: '待结算净额', value: `€${Number(summary.totalNet || 0).toFixed(2)}` },
        { label: '平台费用', value: `€${Number(summary.totalFees || 0).toFixed(2)}` },
        { label: '退款', value: `€${Number(summary.totalRefunds || 0).toFixed(2)}` }
      ];
      const payouts = fromList(finance.payouts, item => `结算 ${item.period || item.id}`, item =>
        `状态 ${item.status} · 净额 €${Number(item.netPayout || 0).toFixed(2)} · 收款账户 ${item.bankAccount || '未记录'}`);
      const bankAccounts = fromList(accounts.accounts, item => item.accountHolder || '收款账户', item =>
        `${item.iban || ''} · ${item.status}`);
      this.setData({ metrics, items: payouts.concat(bankAccounts) });
    } else if (id === 'growth') {
      const growthResults = await Promise.all([
        request('/api/merchant/operations/intelligence'),
        request('/api/merchant/growth/referrals')
      ]);
      const operations = growthResults[0];
      const referrals = growthResults[1];
      const summary = operations.summary || {};
      this.setData({
        metrics: [
          { label: '近 30 日成交', value: `€${Number(summary.gmv30d || 0).toFixed(2)}` },
          { label: '订单数', value: String(summary.orders30d || 0) },
          { label: '低库存 SKU', value: String(summary.lowStockSkus || 0) },
          { label: '待处理退货', value: String(summary.pendingReturns || 0) }
        ],
        items: fromList(operations.alerts, item => item.severity === 'critical' ? '紧急提醒' : '经营提醒', item => item.message)
          .concat(fromList(referrals.referrals, item => item.code || item.name || '增长计划', item => `${item.status || ''} · ${item.reward || ''}`))
      });
    } else if (id === 'materials') {
      const result = await request('/api/merchant/materials');
      const materials = result.materials || [];
      this.setData({
        items: fromList(materials, item => `${item.name} · ${item.code}`, item =>
          `${item.category} · 在库 ${item.onHandQuantity} ${item.unit} · 可用 ${item.availableQuantity} ${item.unit} · 补货点 ${item.reorderPoint}`),
        filterOptions: [
          { id: 'all', label: '全部' },
          { id: 'low', label: '需补货' }
        ],
        metrics: [
          { label: '材料种类', value: String(materials.length) },
          { label: '需补货', value: String(materials.filter(item =>
            Number(item.availableQuantity || 0) <= Number(item.reorderPoint || 0)).length) }
        ]
      });
    } else if (id === 'production') {
      const result = await request('/api/merchant/production/work-orders');
      this.setData({ items: fromList(result.workOrders, item => `${item.workOrderNo} · ${item.product && item.product.name || ''}`, item =>
        `${item.status} · ${item.variant && item.variant.sku || ''} · 完成 ${item.completedQuantity}/${item.plannedQuantity} · ${item.dueDate || ''}`) });
    } else if (id === 'store' || id === 'settings') {
      const storeResults = await Promise.all([
        request('/api/merchant/settings'),
        request('/api/merchant/store-categories')
      ]);
      const settings = storeResults[0];
      const categories = storeResults[1];
      const merchant = settings.merchant || auth.response.merchant || {};
      const storefrontTemplate = storefrontTemplates.some(template => template.id === merchant.storefrontTemplate)
        ? merchant.storefrontTemplate
        : 'fashion_monochrome';
      this.setData({
        items: [record(merchant.name || merchant.companyLegalName || '店铺资料', [merchant.contactPerson, merchant.contactPhone, merchant.contactEmail].filter(Boolean).join(' · '), merchant)]
          .concat(fromList(categories.categories, item => item.name, item => `店铺分类 · ${item.slug || ''}`)),
        merchantSettings: Object.assign({
          name: '', companyLegalName: '', vatNumber: '', country: '', city: '', showroomAddress: '',
          contactPerson: '', contactPhone: '', contactEmail: '', moq: 6, defaultPaymentTerm: 'prepaid',
          shippingNote: '', notifyOrders: true, notifyPayouts: true, notifyVault: true, notifyMarketing: false,
        }, settings.settings || {}),
        storefrontDraft: {
          template: storefrontTemplate,
          templateIndex: storefrontTemplates.findIndex(template => template.id === storefrontTemplate),
          selectedTemplate: storefrontTemplates.find(template => template.id === storefrontTemplate),
          templates: storefrontTemplates,
          shippingPolicy: merchant.storefrontShippingPolicy || '',
          returnsPolicy: merchant.storefrontReturnsPolicy || '',
          seoTitle: merchant.storefrontSeoTitle || '',
          seoDescription: merchant.storefrontSeoDescription || '',
          tagline: merchant.tagline || '',
          description: merchant.description || ''
        }
      });
    } else if (id === 'domains') {
      const merchant = auth.response.merchant || auth.session.merchant || {};
      this.setData({
        items: [record(merchant.storeSlug || '尚未分配店铺域名', merchant.storeSlug
          ? `${PUBLIC_SITE_URL}/shop/${encodeURIComponent(merchant.storeSlug)}` : '请联系 RUDA 支持开通店铺链接', merchant)]
      });
    } else if (id === 'site_content') {
      const result = await request('/api/merchant/store-categories');
      this.setData({ categories: result.categories || [], items: fromList(result.categories, item => item.name, item =>
        `${item.slug || ''} · ${item.isActive === false ? '已停用' : '展示中'}`) });
    } else if (id === 'media' || id === 'pos') {
      const products = await request('/api/merchant/products');
      if (id === 'media') {
        this.setData({ items: fromList(products.products, item => item.name, item =>
          `${item.styleNo} · ${item.lifecycleStatus} · ${(item.images || []).length} 张图片`) });
      } else {
        const posResults = await Promise.all([
          request('/api/merchant/orders'),
          request('/api/merchant/customers'),
          request('/api/merchant/pos/settings'),
          request('/api/merchant/pos/shifts/current')
        ]);
        const orders = posResults[0];
        const customers = posResults[1];
        const settings = posResults[2];
        const shift = posResults[3];
        this.setData({
          metrics: [
            { label: '可选商品', value: String((products.products || []).length) },
            { label: '客户', value: String((customers.customers || []).length) }
          ],
          items: fromList(orders.orders, item => item.orderNo, item =>
            `${item.status} · ${item.companyName || ''} · €${Number(item.totalAmount || 0).toFixed(2)}`),
          posSettings: settings.settings || {},
          posShift: shift.shift || null,
          posProducts: (products.products || [])
            .filter(item => item.lifecycleStatus === 'published')
            .map(product => {
              const skus = (product.skus || []).filter(sku => sku.isActive !== false);
              return Object.assign({}, product, {
                skus,
                selectedSkuIndex: Math.max(0, skus.findIndex(sku =>
                  Number(sku.stockCentral || 0) > Number(sku.reserved || 0)))
              });
            })
            .filter(product => product.skus.length > 0)
        });
      }
    } else if (id === 'ai_employees') {
      const result = await request('/api/merchant/ai-employees');
      const employees = result.employees || [];
      this.setData({
        metrics: [
          { label: 'AI 员工目录', value: String(employees.length) },
          { label: '本店已开通', value: String(employees.filter(item => item.installation).length) }
        ],
        items: fromList(employees, item => item.name, item =>
          `${item.department} · ${item.installation ? item.installation.status : item.status} · ${item.description}`)
      });
    } else if (id === 'team') {
      const teamResults = await Promise.all([
        request('/api/merchant/employees'),
        request('/api/merchant/employee-audit')
      ]);
      const employees = teamResults[0];
      const audit = teamResults[1];
      const staff = fromList(employees.employees, item => item.name, item =>
        `${item.email} · ${item.role} · ${item.active ? '启用' : '已停用'}`);
      const logs = fromList(audit.logs, item => item.action, item =>
        `${item.employee && item.employee.name || '员工'} · ${item.entityType} · ${item.createdAt}`);
      const employeeRows = employees.employees || [];
      this.setData({
        items: staff.concat(logs),
        filterOptions: [
          { id: 'all', label: '全部' },
          { id: 'active', label: '在职' },
          { id: 'disabled', label: '已停用' }
        ],
        metrics: [
          { label: '员工总数', value: String(employeeRows.length) },
          { label: '在职员工', value: String(employeeRows.filter(item => item.active).length) }
        ]
      });
    } else if (id === 'notifications') {
      const result = await request('/api/merchant/notifications');
      const notifications = result.notifications || [];
      this.setData({
        items: fromList(notifications, item => {
        const payload = item.payload || {};
        return payload.title || '商家通知';
      }, item => {
        const payload = item.payload || {};
        const priority = item.priority === 'high' ? '重要' : '';
        const businessStatus = item.businessStatus === 'resolved' ? '已处理' : '待处理';
        return `${item.readAt ? '已读' : '未读'} · ${businessStatus} · ${priority} · ${payload.message || payload.body || ''} · ${item.createdAt || ''}`;
        }),
        filterOptions: [
          { id: 'all', label: '全部' },
          { id: 'unread', label: '未读' },
          { id: 'pending', label: '待处理' }
        ],
        metrics: [
          { label: '通知总数', value: String(notifications.length) },
          { label: '未读', value: String(notifications.filter(item => !item.readAt).length) },
          { label: '待处理', value: String(notifications.filter(item => item.businessStatus !== 'resolved').length) }
        ]
      });
    } else if (id === 'support') {
      const result = await request('/api/merchant/support/conversations');
      this.setData({ items: fromList(result.conversations, item => item.title || item.subject || '支持会话', item =>
        `${item.status || ''} · ${item.updatedAt || item.createdAt || ''}`) });
    } else if (id === 'returns') {
      const result = await request('/api/merchant/returns');
      this.setData({ items: fromList(result.returns, item => item.orderNo || `退货 ${item.id}`, item =>
        `${item.status} · 退款 €${Number(item.refundAmount || 0).toFixed(2)}`) });
    }
  },

  onAdjustmentInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'quantity' || field === 'note') {
      const targetField = field === 'quantity' ? 'adjustmentQuantity' : 'adjustmentNote';
      this.setData(withField({}, targetField, event.detail.value));
    }
  },

  onRecordSearch(event) {
    this.setData({ query: event.detail && event.detail.value || '' });
    this.applyRecordFilter();
  },

  onRecordFilterChange(event) {
    const statusFilter = event.currentTarget.dataset.filter;
    if (!statusFilter) return;
    this.setData({ statusFilter });
    this.applyRecordFilter();
  },

  applyRecordFilter() {
    const query = String(this.data.query || '').trim().toLocaleLowerCase();
    const filter = this.data.statusFilter || 'all';
    const visibleItems = (this.data.items || []).filter(item => {
      const source = item.source || {};
      const matchesQuery = !query
        || `${item.title || ''} ${item.meta || ''}`.toLocaleLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (filter === 'all') return true;
      if (this.data.id === 'procurement') {
        if (filter === 'pending') return ['draft', 'ordered', 'partially_received'].includes(source.status);
        if (filter === 'receiving') return ['ordered', 'partially_received'].includes(source.status);
        if (filter === 'received') return source.status === 'received';
      }
      if (this.data.id === 'inventory') {
        if (filter === 'available') return Number(source.availableQuantity || 0) > 0;
        if (filter === 'out') return Number(source.availableQuantity || 0) <= 0;
      }
      if (this.data.id === 'materials' && filter === 'low') {
        return Number(source.availableQuantity || 0) <= Number(source.reorderPoint || 0);
      }
      if (this.data.id === 'team') {
        if (!source.email) return false;
        if (filter === 'active') return Boolean(source.active);
        if (filter === 'disabled') return !source.active;
      }
      if (this.data.id === 'notifications') {
        if (filter === 'unread') return !source.readAt;
        if (filter === 'pending') return source.businessStatus !== 'resolved';
      }
      return true;
    });
    this.setData({ visibleItems });
  },

  toggleSupplierForm() {
    this.setData({ showSupplierForm: !this.data.showSupplierForm });
  },

  togglePurchaseForm() {
    this.setData({ showPurchaseForm: !this.data.showPurchaseForm });
  },

  toggleEmployeeForm() {
    this.setData({ showEmployeeForm: !this.data.showEmployeeForm });
  },

  toggleCategoryForm() {
    if (this.data.editingCategoryId) {
      this.cancelCategoryEdit();
      return;
    }
    this.setData({ showCategoryForm: !this.data.showCategoryForm, quickValue: '' });
  },

  toggleBankForm() {
    this.setData({ showBankForm: !this.data.showBankForm });
  },

  toggleMaterialForm() {
    this.setData({ showMaterialForm: !this.data.showMaterialForm });
  },

  toggleStorefrontEditor() {
    this.setData({ showStorefrontEditor: !this.data.showStorefrontEditor });
  },

  toggleSettingsEditor() {
    this.setData({ showSettingsEditor: !this.data.showSettingsEditor });
  },

  openPurchaseOrder(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.items.find(item => item.source.id === id);
    if (row) {
      const items = Array.isArray(row.source.items) ? row.source.items : [];
      const orderedQuantity = items.reduce((sum, item) => sum + Number(item.orderedQuantity || 0), 0);
      const receivedQuantity = items.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);
      const receivedAmount = items.reduce((sum, item) =>
        sum + Number(item.receivedQuantity || 0) * Number(item.unitCost || 0), 0);
      const totalAmount = row.source.totalAmount === undefined || row.source.totalAmount === null
        ? items.reduce((sum, item) => sum + Number(item.orderedQuantity || 0) * Number(item.unitCost || 0), 0)
        : Number(row.source.totalAmount);
      this.setData({
        selectedPurchaseOrder: Object.assign({}, row.source, {
          items,
          statusLabel: row.statusLabel,
          detailTotalAmount: totalAmount.toFixed(2),
          receivedAmount: receivedAmount.toFixed(2),
          receivedPercent: orderedQuantity > 0
            ? Math.min(100, Math.round(receivedQuantity / orderedQuantity * 100))
            : 0
        })
      });
    }
  },

  closePurchaseOrder() {
    this.setData({ selectedPurchaseOrder: null });
  },

  selectInventory(event) {
    const id = event.currentTarget.dataset.id;
    const balance = (this.data.items || []).find(item => item.source.id === id);
    if (balance) this.setData({ selectedBalance: balance.source, adjustmentQuantity: '', adjustmentNote: '' });
  },

  async submitInventoryAdjustment() {
    const balance = this.data.selectedBalance;
    const quantity = Number(this.data.adjustmentQuantity);
    const note = this.data.adjustmentNote.trim();
    if (!balance || !Number.isInteger(quantity) || quantity === 0 || !note) {
      wx.showToast({ title: '请输入非零整数和调整原因', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/inventory/adjustments', {
        method: 'POST',
        data: {
          balanceId: balance.id,
          variantId: balance.variantId,
          locationId: balance.location && balance.location.id,
          version: balance.version,
          quantity,
          note
        }
      });
      wx.showToast({ title: '库存已调整', icon: 'success' });
      this.setData({ selectedBalance: null });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '库存调整失败', icon: 'none' });
    }
  },

  async itemAction(event) {
    const { id, action } = event.currentTarget.dataset;
    if (!id || !action) return;
    const confirm = action === 'approve' || action === 'reject'
      || action === 'ack' || action === 'archive' || action === 'receive';
    if (confirm) {
      const modal = await new Promise(resolve => wx.showModal({
        title: '确认操作',
        content: action === 'approve' ? (this.data.id === 'returns' ? '批准此退货申请？' : '批准此客户授权申请？')
          : action === 'reject' ? (this.data.id === 'returns' ? '拒绝此退货申请？' : '拒绝此客户授权申请？')
            : action === 'ack' ? '确认已核对这笔结算？'
              : action === 'receive' ? '确认已收到退回商品？确认后将继续处理退款和库存。'
                : action === 'archive' && this.data.id === 'procurement' ? '取消此采购单？' : '确认归档？',
        success: resolve
      }));
      if (!modal.confirm) return;
    }
    try {
      if (this.data.id === 'vault') {
        await request(`/api/merchant/vault-requests/${encodeURIComponent(id)}/review`, {
          method: 'PUT', data: { status: action === 'approve' ? 'approved' : 'rejected' }
        });
      } else if (this.data.id === 'finance') {
        await request(`/api/merchant/payouts/${encodeURIComponent(id)}/status`, {
          method: 'PUT', data: { status: 'acknowledged' }
        });
      } else if (this.data.id === 'production') {
        const status = ({ release: 'released', start: 'in_progress', qc: 'qc_hold', resume: 'in_progress' })[action];
        if (!status) return;
        await request(`/api/merchant/production/work-orders/${encodeURIComponent(id)}/status`, { method: 'PUT', data: { status } });
      } else if (this.data.id === 'procurement') {
        const status = action === 'order' ? 'ordered' : 'cancelled';
        await request(`/api/merchant/purchase-orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', data: { status } });
      } else if (this.data.id === 'notifications') {
        const notification = this.data.items.find(item => item.source.id === id);
        if (!notification) return;
        if (action === 'resolve') {
          await request(`/api/merchant/notifications/${encodeURIComponent(id)}/resolve`, { method: 'POST', data: {} });
        } else {
          await request(`/api/merchant/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', data: {} });
          if (action === 'open') {
            const source = notification.source;
            const entityType = source.relatedEntityType || (source.payload && source.payload.relatedEntityType);
            if (entityType === 'order') {
              wx.setStorageSync('merchantOrdersSearchQuery', source.payload && source.payload.orderNo || '');
              wx.switchTab({ url: '/pages/orders/index' });
              return;
            }
            if (entityType === 'product' || entityType === 'inventory') {
              const productId = source.relatedEntityId || source.payload && (source.payload.productId || source.payload.referenceId);
              if (productId) wx.navigateTo({ url: `/pages/product-detail/index?id=${encodeURIComponent(productId)}` });
              return;
            }
            if (entityType === 'purchase') {
              wx.navigateTo({ url: '/pages/workspace/index?id=procurement' });
              return;
            }
            if (entityType === 'customer') {
              wx.navigateTo({ url: '/pages/workspace/index?id=customers' });
              return;
            }
          }
        }
      } else if (this.data.id === 'customers') {
        await request(`/api/merchant/customers/${encodeURIComponent(id)}/status`, {
          method: 'PATCH', data: { status: action === 'suspend' ? 'suspended' : 'active' }
        });
      } else if (this.data.id === 'team') {
        await request(`/api/merchant/employees/${encodeURIComponent(id)}/status`, {
          method: 'PATCH', data: { active: action === 'enable' }
        });
      } else if (this.data.id === 'ai_employees') {
        const row = this.data.items.find(item => item.source.id === id);
        const installation = row && row.source.installation;
        if (action === 'request') {
          await request('/api/merchant/ai-employees', { method: 'POST', data: { definitionId: id } });
        } else if (installation && ['enable', 'suspend'].includes(action)) {
          await request(`/api/merchant/ai-employees/${encodeURIComponent(installation.id)}/status`, {
            method: 'PATCH', data: { active: action === 'enable' }
          });
        } else {
          return;
        }
      } else if (this.data.id === 'returns') {
        if (action === 'receive') {
          await request(`/api/merchant/returns/${encodeURIComponent(id)}/receive`, { method: 'POST', data: {} });
        } else {
          await request(`/api/merchant/returns/${encodeURIComponent(id)}/review`, {
            method: 'PUT', data: { status: action === 'approve' ? 'approved' : 'rejected' }
          });
        }
      } else {
        return;
      }
      wx.showToast({ title: '操作已完成', icon: 'success' });
      this.setData({ selectedPurchaseOrder: null });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败，请重试。', icon: 'none' });
    }
  },

  onQuickValue(event) {
    this.setData({ quickValue: event.detail.value });
  },

  async createCategory() {
    const name = this.data.quickValue.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    try {
      const editingCategoryId = this.data.editingCategoryId;
      await request(editingCategoryId
        ? `/api/merchant/store-categories/${encodeURIComponent(editingCategoryId)}`
        : '/api/merchant/store-categories', {
        method: editingCategoryId ? 'PUT' : 'POST',
        data: { name }
      });
      this.setData({ quickValue: '', editingCategoryId: '', showCategoryForm: false });
      wx.showToast({ title: editingCategoryId ? '分类已更新' : '分类已创建', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '分类保存失败', icon: 'none' });
    }
  },

  editCategory(event) {
    const id = event.currentTarget.dataset.id;
    const category = this.data.categories.find(item => item.id === id);
    if (!category) return;
    this.setData({ editingCategoryId: category.id, quickValue: category.name, showCategoryForm: true });
  },

  cancelCategoryEdit() {
    this.setData({ editingCategoryId: '', quickValue: '', showCategoryForm: false });
  },

  async deleteCategory(event) {
    const id = event.currentTarget.dataset.id;
    const category = this.data.categories.find(item => item.id === id);
    if (!category) return;
    const confirmation = await new Promise(resolve => wx.showModal({
      title: '删除店铺分类',
      content: `确认删除“${category.name}”？正在使用的分类无法删除。`,
      success: resolve
    }));
    if (!confirmation.confirm) return;
    try {
      await request(`/api/merchant/store-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (this.data.editingCategoryId === id) this.cancelCategoryEdit();
      wx.showToast({ title: '分类已删除', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '分类删除失败', icon: 'none' });
    }
  },

  onSupportInput(event) {
    this.setData({ supportMessage: event.detail.value });
  },

  onSupportSubjectInput(event) {
    this.setData({ supportSubject: event.detail.value });
  },

  onSupportReplyInput(event) {
    this.setData({ supportReply: event.detail.value });
  },

  async openSupportConversation(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    try {
      const result = await request(`/api/merchant/support/conversations/${encodeURIComponent(id)}`);
      const conversation = result.conversation;
      this.setData({
        supportConversation: conversation,
        supportMessages: conversation.messages || [],
        supportReply: ''
      });
    } catch (error) {
      wx.showToast({ title: error.message || '支持会话加载失败', icon: 'none' });
    }
  },

  closeSupportConversation() {
    this.setData({ supportConversation: null, supportMessages: [], supportReply: '' });
    this.loadWorkspace();
  },

  async replySupportConversation() {
    const conversation = this.data.supportConversation;
    const content = this.data.supportReply.trim();
    if (!conversation || !content) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    try {
      const result = await request(`/api/merchant/support/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: 'POST',
        data: { content }
      });
      this.setData({
        supportConversation: result.conversation,
        supportMessages: result.conversation.messages || [],
        supportReply: ''
      });
      wx.showToast({ title: '回复已发送', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '回复发送失败', icon: 'none' });
    }
  },

  onBankInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'bankHolder' || field === 'bankIban') {
      this.setData(withField({}, field, event.detail.value));
    }
  },

  async addBankAccount() {
    const accountHolder = this.data.bankHolder.trim();
    const iban = this.data.bankIban.replace(/\s+/g, '').toUpperCase();
    if (accountHolder.length < 2 || !iban) {
      wx.showToast({ title: '请填写账户名和 IBAN', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/bank-accounts', { method: 'POST', data: { accountHolder, iban } });
      this.setData({ bankHolder: '', bankIban: '', showBankForm: false });
      wx.showToast({ title: '收款账户已提交审核', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '收款账户提交失败', icon: 'none' });
    }
  },

  selectMaterial(event) {
    const recordId = event.currentTarget.dataset.id;
    const material = this.data.items.find(item => item.source.id === recordId);
    if (material) this.setData({ materialInbound: material.source, materialQuantity: '', materialNote: '' });
  },

  onMaterialInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'quantity' || field === 'note') {
      const targetField = field === 'quantity' ? 'materialQuantity' : 'materialNote';
      this.setData(withField({}, targetField, event.detail.value));
    }
  },

  async submitMaterialInbound() {
    const material = this.data.materialInbound;
    const quantity = Number(this.data.materialQuantity);
    if (!material || !Number.isFinite(quantity) || quantity <= 0) {
      wx.showToast({ title: '请输入大于 0 的入库数量', icon: 'none' });
      return;
    }
    try {
      await request(`/api/merchant/materials/${encodeURIComponent(material.id)}/inbound`, {
        method: 'POST',
        data: {
          quantity,
          locationCode: 'central',
          note: this.data.materialNote.trim(),
          idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`
        }
      });
      wx.showToast({ title: '材料已入库', icon: 'success' });
      this.setData({ materialInbound: null });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '材料入库失败', icon: 'none' });
    }
  },

  onMaterialDraftInput(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['code', 'name', 'unitCost', 'reorderPoint', 'leadTimeDays', 'notes'];
    if (allowed.includes(field)) {
      this.setData({ materialDraft: withField(this.data.materialDraft, field, event.detail.value) });
    }
  },

  onMaterialCategoryChange(event) {
    const index = Number(event.detail.value);
    if (this.data.materialCategories[index]) {
      this.setData({
        materialCategoryIndex: index,
        materialDraft: withField(this.data.materialDraft, 'category', this.data.materialCategories[index].id)
      });
    }
  },

  onMaterialUnitChange(event) {
    const index = Number(event.detail.value);
    if (this.data.materialUnits[index]) {
      this.setData({
        materialUnitIndex: index,
        materialDraft: withField(this.data.materialDraft, 'unit', this.data.materialUnits[index].id)
      });
    }
  },

  async createMaterial() {
    const draft = this.data.materialDraft;
    if (!draft.code.trim() || !draft.name.trim()) {
      wx.showToast({ title: '请填写材料编码和名称', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/materials', {
        method: 'POST',
        data: Object.assign({}, draft, {
          code: draft.code.trim().toUpperCase(),
          name: draft.name.trim(),
          unitCost: Number(draft.unitCost),
          reorderPoint: Number(draft.reorderPoint),
          leadTimeDays: Number(draft.leadTimeDays),
          notes: draft.notes.trim()
        })
      });
      wx.showToast({ title: '材料已创建', icon: 'success' });
      this.setData({
        showMaterialForm: false,
        materialDraft: {
          code: '', name: '', category: 'fabric', unit: 'meter',
          unitCost: '0', reorderPoint: '0', leadTimeDays: '0', notes: ''
        },
        materialCategoryIndex: 0,
        materialUnitIndex: 0
      });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '材料创建失败', icon: 'none' });
    }
  },

  onPurchaseInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'quantity' || field === 'unitCost') {
      const targetField = field === 'quantity' ? 'purchaseQuantity' : 'purchaseUnitCost';
      this.setData(withField({}, targetField, event.detail.value));
    }
  },

  onSupplierInput(event) {
    const field = event.currentTarget.dataset.field;
    const fields = {
      name: 'supplierName',
      contact: 'supplierContact',
      email: 'supplierEmail',
      leadTime: 'supplierLeadTime'
    };
    if (fields[field]) this.setData({ [fields[field]]: event.detail.value });
  },

  async createSupplier() {
    const name = this.data.supplierName.trim();
    if (!name) {
      wx.showToast({ title: '请输入供应商名称', icon: 'none' });
      return;
    }
    try {
      const result = await request('/api/merchant/suppliers', {
        method: 'POST',
        data: {
          name,
          contactName: this.data.supplierContact.trim(),
          email: this.data.supplierEmail.trim(),
          leadTimeDays: Number(this.data.supplierLeadTime || 14)
        }
      });
      this.setData({
        supplierName: '',
        supplierContact: '',
        supplierEmail: '',
        showSupplierForm: false,
        purchaseSuppliers: this.data.purchaseSuppliers.concat([result.supplier]),
        purchaseSupplierIndex: this.data.purchaseSuppliers.length
      });
      wx.showToast({ title: '供应商已添加', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '供应商创建失败', icon: 'none' });
    }
  },

  onPurchaseSupplierChange(event) {
    this.setData({ purchaseSupplierIndex: Number(event.detail.value) });
  },

  onPurchaseProductChange(event) {
    this.setData({ purchaseProductIndex: Number(event.detail.value), purchaseSkuIndex: 0 });
  },

  onPurchaseSkuChange(event) {
    this.setData({ purchaseSkuIndex: Number(event.detail.value) });
  },

  async createPurchaseOrder() {
    const supplier = this.data.purchaseSuppliers[this.data.purchaseSupplierIndex];
    const product = this.data.purchaseProducts[this.data.purchaseProductIndex];
    const sku = product && (product.skus || [])[this.data.purchaseSkuIndex];
    const quantity = Number(this.data.purchaseQuantity);
    const unitCost = Number(this.data.purchaseUnitCost);
    if (!supplier || !product || !sku || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) {
      wx.showToast({ title: '请选择供应商、商品和 SKU，并填写数量及单价', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/purchase-orders', {
        method: 'POST',
        data: {
          supplierId: supplier.id,
          idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          items: [{ productId: product.id, sku: sku.sku, quantity, unitCost }]
        }
      });
      wx.showToast({ title: '采购单已创建', icon: 'success' });
      this.setData({ showPurchaseForm: false });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '采购单创建失败', icon: 'none' });
    }
  },

  beginReceipt(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.items.find(item => item.source.id === id);
    const order = row && row.source;
    const firstOpenItem = order && (order.items || []).find(item => Number(item.orderedQuantity) > Number(item.receivedQuantity || 0));
    if (!order || !firstOpenItem) {
      wx.showToast({ title: '没有待收货的采购明细', icon: 'none' });
      return;
    }
    this.setData({
      selectedPurchaseOrder: null,
      receiptOrder: order,
      receiptItem: firstOpenItem,
      receiptQuantity: String(firstOpenItem.orderedQuantity - (firstOpenItem.receivedQuantity || 0)),
      receiptUnitCost: String(firstOpenItem.unitCost || '')
    });
  },

  cancelReceipt() {
    this.setData({ receiptOrder: null, receiptItem: null, receiptQuantity: '', receiptUnitCost: '' });
  },

  onReceiptInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'quantity' || field === 'unitCost') {
      const targetField = field === 'quantity' ? 'receiptQuantity' : 'receiptUnitCost';
      this.setData(withField({}, targetField, event.detail.value));
    }
  },

  async submitReceipt() {
    const { receiptOrder, receiptItem } = this.data;
    const quantity = Number(this.data.receiptQuantity);
    const unitCost = Number(this.data.receiptUnitCost);
    if (!receiptOrder || !receiptItem || !Number.isInteger(quantity) || quantity <= 0
      || !Number.isFinite(unitCost) || unitCost < 0) {
      wx.showToast({ title: '请输入有效的收货数量和单价', icon: 'none' });
      return;
    }
    try {
      await request(`/api/merchant/purchase-orders/${encodeURIComponent(receiptOrder.id)}/receipts`, {
        method: 'POST',
        data: {
          idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          note: '小程序采购到货验收',
          items: [{ purchaseOrderItemId: receiptItem.id, quantity, unitCost }]
        }
      });
      wx.showToast({ title: '收货记录已保存', icon: 'success' });
      this.setData({ receiptOrder: null, receiptItem: null });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '采购收货失败', icon: 'none' });
    }
  },

  onPosSkuChange(event) {
    const id = event.currentTarget.dataset.id;
    const index = Number(event.detail.value);
    this.setData({
      posProducts: this.data.posProducts.map(product => product.id === id
        ? Object.assign({}, product, { selectedSkuIndex: index })
        : product)
    });
  },

  addPosItem(event) {
    const product = this.data.posProducts.find(item => item.id === event.currentTarget.dataset.id);
    const sku = product && product.skus[product.selectedSkuIndex];
    if (!product || !sku) return;
    this.addPosSku(product, sku);
  },

  addScannedPosItem() {
    const barcode = String(this._pendingPosBarcode || '').trim().toLocaleLowerCase();
    this._pendingPosBarcode = '';
    if (!barcode) return;
    const product = this.data.posProducts.find(item =>
      item.skus.some(sku => String(sku.barcode || '').toLocaleLowerCase() === barcode
        || String(sku.sku || '').toLocaleLowerCase() === barcode));
    const sku = product && product.skus.find(item =>
      String(item.barcode || '').toLocaleLowerCase() === barcode
      || String(item.sku || '').toLocaleLowerCase() === barcode);
    if (!product || !sku) {
      wx.showToast({ title: '没有找到此条码商品', icon: 'none' });
      return;
    }
    this.addPosSku(product, sku);
  },

  addPosSku(product, sku) {
    const available = Number(sku.stockCentral || 0) - Number(sku.reserved || 0);
    const existing = this.data.posCart.find(item => item.sku === sku.sku);
    if (available < (existing ? existing.quantity : 0) + 1) {
      wx.showToast({ title: '可售库存不足', icon: 'none' });
      return;
    }
    const posCart = existing
      ? this.data.posCart.map(item => item.sku === sku.sku
        ? Object.assign({}, item, { quantity: item.quantity + 1 })
        : item)
      : this.data.posCart.concat([{
        productId: product.id,
        name: product.name,
        sku: sku.sku,
        quantity: 1,
        unitPrice: Number(product.rrpPrice || product.wholesalePrice),
        available
      }]);
    this.setData({
      posCart,
      posTotal: posCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    });
    this._posSaleIdempotencyKey = '';
  },

  changePosQuantity(event) {
    const { sku, delta } = event.currentTarget.dataset;
    const current = this.data.posCart.find(item => item.sku === sku);
    if (current && Number(delta) > 0 && current.quantity >= current.available) {
      wx.showToast({ title: '已达到此 SKU 的可售库存', icon: 'none' });
      return;
    }
    const posCart = this.data.posCart.map(item => item.sku === sku
      ? Object.assign({}, item, { quantity: Math.max(0, item.quantity + Number(delta)) })
      : item).filter(item => item.quantity > 0);
    this.setData({
      posCart,
      posTotal: posCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    });
    this._posSaleIdempotencyKey = '';
  },

  onOpeningCash(event) {
    this.setData({ openingCash: event.detail.value });
  },

  async openPosShift() {
    const openingCash = Number(this.data.openingCash || 0);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      wx.showToast({ title: '请输入有效的备用金金额', icon: 'none' });
      return;
    }
    try {
      const result = await request('/api/merchant/pos/shifts', {
        method: 'POST',
        data: { openingCash, note: '小程序开班' }
      });
      this.setData({ posShift: result.shift, openingCash: '' });
      wx.showToast({ title: 'POS 班次已开启', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '无法开启 POS 班次', icon: 'none' });
    }
  },

  async submitPosSale() {
    if (!this.data.posCart.length || this.data.posSaving) return;
    if (this.data.posSettings.requireOpenShift && !this.data.posShift) {
      wx.showToast({ title: '请先开启 POS 班次', icon: 'none' });
      return;
    }
    if (!this._posSaleIdempotencyKey) {
      this._posSaleIdempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    this.setData({ posSaving: true });
    try {
      const result = await request('/api/merchant/employee-orders', {
        method: 'POST',
        data: {
          idempotencyKey: this._posSaleIdempotencyKey,
          source: 'pos',
          paymentMethod: this.data.paymentMethod,
          posShiftId: this.data.posShift && this.data.posShift.id,
          paymentConfirmed: true,
          items: this.data.posCart.map(item => ({
            productId: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            inStockQuantity: item.quantity,
            preorderQuantity: 0
          }))
        }
      });
      this._posSaleIdempotencyKey = '';
      this.setData({ posCart: [], posTotal: '0.00' });
      wx.showModal({
        title: '销售已完成',
        content: `${result.order.orderNo} · €${Number(result.order.totalAmount || 0).toFixed(2)}`,
        showCancel: false
      });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || 'POS 销售提交失败', icon: 'none' });
    } finally {
      this.setData({ posSaving: false });
    }
  },

  onPaymentMethodChange(event) {
    const method = event.currentTarget.dataset.method;
    if (this.data.paymentMethods.some(item => item.id === method)) {
      this._posSaleIdempotencyKey = '';
      this.setData({ paymentMethod: method });
    }
  },

  onNotificationPreference(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['notifyOrders', 'notifyPayouts', 'notifyVault', 'notifyMarketing'];
    if (!allowed.includes(field)) return;
    this.setData({
      merchantSettings: withField(this.data.merchantSettings, field, Boolean(event.detail.value))
    });
  },

  onPosCashInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'closingCash' || field === 'movementAmount' || field === 'movementNote') {
      const targetField = field === 'closingCash'
        ? 'closingCash'
        : field === 'movementAmount' ? 'cashMovementAmount' : 'cashMovementNote';
      this.setData(withField({}, targetField, event.detail.value));
    }
  },

  async addPosCashMovement(event) {
    const shift = this.data.posShift;
    const direction = event.currentTarget.dataset.direction;
    const amount = Number(this.data.cashMovementAmount);
    if (!shift || !['in', 'out'].includes(direction) || !Number.isFinite(amount) || amount <= 0) {
      wx.showToast({ title: '请填写有效的备用金金额', icon: 'none' });
      return;
    }
    try {
      await request(`/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/cash-movements`, {
        method: 'POST',
        data: {
          direction,
          amount,
          note: this.data.cashMovementNote.trim(),
          idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`
        }
      });
      this.setData({ cashMovementAmount: '', cashMovementNote: '' });
      wx.showToast({ title: '现金流水已记录', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '现金流水记录失败', icon: 'none' });
    }
  },

  async closePosShift() {
    const shift = this.data.posShift;
    const closingCash = Number(this.data.closingCash);
    if (!shift || !Number.isFinite(closingCash) || closingCash < 0) {
      wx.showToast({ title: '请输入盘点后的现金金额', icon: 'none' });
      return;
    }
    const confirmation = await new Promise(resolve => wx.showModal({
      title: '关闭 POS 班次',
      content: '关闭后将登记现金盘点和差额，确认继续？',
      success: resolve
    }));
    if (!confirmation.confirm) return;
    try {
      const result = await request(`/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/close`, {
        method: 'POST',
        data: { closingCash, note: '小程序交班' }
      });
      this.setData({ posShift: null, closingCash: '' });
      wx.showModal({
        title: '班次已关闭',
        content: `系统应有 €${Number(result.shift.expectedCash || 0).toFixed(2)} · 现金差额 €${Number(result.shift.cashDifference || 0).toFixed(2)}`,
        showCancel: false
      });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '关闭班次失败', icon: 'none' });
    }
  },

  onEmployeeInput(event) {
    const field = event.currentTarget.dataset.field;
    if (['name', 'email', 'password'].includes(field)) {
      this.setData({ employeeDraft: withField(this.data.employeeDraft, field, event.detail.value) });
    }
  },

  onEmployeeRoleChange(event) {
    const index = Number(event.detail.value);
    const role = this.data.employeeRoles[index];
    if (role) this.setData({
      employeeRoleIndex: index,
      employeeDraft: withField(this.data.employeeDraft, 'role', role.id)
    });
  },

  editEmployeePermissions(event) {
    const id = event.currentTarget.dataset.id;
    const row = this.data.items.find(item => item.source.id === id && item.source.email);
    if (!row) return;
    const roleIndex = this.data.employeeRoles.findIndex(role => role.id === row.source.role);
    const role = roleIndex >= 0 ? this.data.employeeRoles[roleIndex] : null;
    if (!role) {
      this.setData({ error: '员工岗位数据无效，暂时无法编辑。' });
      return;
    }
    let permissions;
    if (row.source.permissions == null) {
      permissions = role.permissions.slice();
    } else {
      try {
        permissions = typeof row.source.permissions === 'string'
          ? JSON.parse(row.source.permissions)
          : row.source.permissions;
      } catch (error) {
        this.setData({ error: '员工权限数据格式异常，暂时无法编辑。' });
        return;
      }
    }
    if (!Array.isArray(permissions) || permissions.some(permission => typeof permission !== 'string')) {
      this.setData({ error: '员工权限数据无效，暂时无法编辑。' });
      return;
    }
    const permissionState = {};
    permissions.forEach(permission => {
      permissionState[permission] = true;
    });
    this.setData({
      error: '',
      employeeEditDraft: {
        id,
        name: row.source.name,
        role: role.id,
        roleLabel: role.label
      },
      employeeEditRoleIndex: roleIndex,
      employeePermissionState: permissionState
    });
  },

  onEmployeeEditName(event) {
    this.setData({
      employeeEditDraft: withField(this.data.employeeEditDraft, 'name', event.detail.value)
    });
  },

  onEmployeeEditRoleChange(event) {
    const role = this.data.employeeRoles[Number(event.detail.value)];
    if (!role) return;
    const permissionState = {};
    role.permissions.forEach(permission => {
      permissionState[permission] = true;
    });
    this.setData({
      employeeEditRoleIndex: Number(event.detail.value),
      employeeEditDraft: Object.assign({}, this.data.employeeEditDraft, { role: role.id, roleLabel: role.label }),
      employeePermissionState: permissionState
    });
  },

  onEmployeePermissionsChange(event) {
    const permissionState = {};
    (event.detail.value || []).forEach(permission => {
      permissionState[permission] = true;
    });
    this.setData({ employeePermissionState: permissionState });
  },

  async saveEmployeeAccess() {
    const employee = this.data.employeeEditDraft;
    if (!employee.id || !employee.name.trim()) {
      wx.showToast({ title: '请填写员工姓名', icon: 'none' });
      return;
    }
    const permissions = this.data.employeePermissionOptions
      .filter(option => this.data.employeePermissionState[option.id])
      .map(option => option.id);
    try {
      await request(`/api/merchant/employees/${encodeURIComponent(employee.id)}`, {
        method: 'PATCH',
        data: { name: employee.name.trim(), role: employee.role }
      });
      try {
        await request(`/api/merchant/employees/${encodeURIComponent(employee.id)}/permissions`, {
          method: 'PATCH',
          data: { permissions }
        });
      } catch (error) {
        await this.loadWorkspace();
        throw new Error(`角色已保存，但权限未保存：${error.message || '请重试'}`);
      }
      wx.showToast({ title: '员工资料和权限已保存', icon: 'success' });
      this.setData({
        employeeEditDraft: { id: '', name: '', role: 'sales', roleLabel: '销售' },
        employeeEditRoleIndex: 0,
        employeePermissionState: {}
      });
      await this.loadWorkspace();
    } catch (error) {
      this.setData({ error: error.message || '员工权限保存失败，请重试。' });
    }
  },

  cancelEmployeeEdit() {
    this.setData({
      employeeEditDraft: { id: '', name: '', role: 'sales', roleLabel: '销售' },
      employeeEditRoleIndex: 0,
      employeePermissionState: {}
    });
  },

  async createEmployee() {
    const employee = this.data.employeeDraft;
    if (!employee.name.trim() || !employee.email.trim() || employee.password.length < 8) {
      wx.showToast({ title: '请填写姓名、邮箱和至少 8 位初始密码', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/employees', {
        method: 'POST',
        data: {
          name: employee.name.trim(),
          email: employee.email.trim(),
          password: employee.password,
          role: employee.role
        }
      });
      this.setData({
        employeeDraft: { name: '', email: '', password: '', role: 'sales' },
        employeeRoleIndex: 0
      });
      wx.showToast({ title: '员工账号已创建', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '员工创建失败', icon: 'none' });
    }
  },

  onMerchantSettingInput(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['name', 'companyLegalName', 'vatNumber', 'country', 'city', 'showroomAddress', 'contactPerson', 'contactPhone', 'contactEmail', 'moq', 'shippingNote'];
    if (!allowed.includes(field)) return;
    const value = field === 'moq' ? Number(event.detail.value) : event.detail.value;
    this.setData({ merchantSettings: withField(this.data.merchantSettings, field, value) });
  },

  onStorefrontInput(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['shippingPolicy', 'returnsPolicy', 'seoTitle', 'seoDescription', 'tagline', 'description'];
    if (allowed.includes(field)) {
      this.setData({ storefrontDraft: withField(this.data.storefrontDraft, field, event.detail.value) });
    }
  },

  onStorefrontTemplateChange(event) {
    const templateIndex = Number(event.detail.value);
    const template = storefrontTemplates[templateIndex];
    if (!template) return;
    this.setData({
      storefrontDraft: Object.assign({}, this.data.storefrontDraft, {
        template: template.id,
        templateIndex,
        selectedTemplate: template
      })
    });
  },

  async applyStorefrontTemplate() {
    if (!storefrontTemplates.some(template => template.id === this.data.storefrontDraft.template)) {
      wx.showToast({ title: '请选择有效的店铺模板', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/storefront', {
        method: 'PUT',
        data: { storefrontTemplate: this.data.storefrontDraft.template }
      });
      wx.showToast({ title: '网站模板已一键应用', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '模板应用失败，请重试', icon: 'none' });
    }
  },

  async saveStorefront() {
    const draft = this.data.storefrontDraft;
    try {
      await request('/api/merchant/storefront', {
        method: 'PUT',
        data: {
          storefrontTemplate: draft.template,
          storefrontShippingPolicy: draft.shippingPolicy,
          storefrontReturnsPolicy: draft.returnsPolicy,
          storefrontSeoTitle: draft.seoTitle,
          storefrontSeoDescription: draft.seoDescription,
          tagline: draft.tagline,
          description: draft.description
        }
      });
      wx.showToast({ title: '店铺页面内容已保存', icon: 'success' });
      this.setData({ showStorefrontEditor: false });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '店铺页面内容保存失败', icon: 'none' });
    }
  },

  async saveMerchantSettings() {
    const settings = this.data.merchantSettings;
    if (!settings.name.trim() || !settings.companyLegalName.trim() || !String(settings.contactEmail || '').includes('@')) {
      wx.showToast({ title: '请填写店铺名称、公司名称和有效联系邮箱', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/settings', { method: 'PUT', data: settings });
      wx.showToast({ title: '商家设置已保存', icon: 'success' });
      this.setData({ showSettingsEditor: false });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '商家设置保存失败', icon: 'none' });
    }
  },

  async sendSupportRequest() {
    const message = this.data.supportMessage.trim();
    const subject = this.data.supportSubject.trim();
    if (!message) {
      wx.showToast({ title: '请先填写问题描述', icon: 'none' });
      return;
    }
    if (subject.length < 2) {
      wx.showToast({ title: '请输入至少 2 个字符的问题主题', icon: 'none' });
      return;
    }
    try {
      await request('/api/merchant/support/conversations', {
        method: 'POST',
        data: { subject, message }
      });
      this.setData({ supportMessage: '', supportSubject: '' });
      wx.showToast({ title: '支持会话已创建', icon: 'success' });
      await this.loadWorkspace();
    } catch (error) {
      wx.showToast({ title: error.message || '反馈提交失败', icon: 'none' });
    }
  }
});

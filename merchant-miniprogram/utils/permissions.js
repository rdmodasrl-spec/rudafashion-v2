const ownerEmployeePermissions = [
  'sales.order.create',
  'product.catalog.read',
  'warehouse.pick',
  'warehouse.review',
  'warehouse.pack',
  'warehouse.ship'
];
const { isWorkspaceEnabled } = require('./review-features');

const workspacePermissions = {
  customers: ['sales.order.create'],
  counterparties: ['sales.order.create', 'purchase.manage'],
  procurement: ['purchase.manage'],
  vault: ['pricing.approve'],
  growth: ['business.analytics.read'],
  finance: ['employees.manage', 'business.analytics.read'],
  materials: ['warehouse.review'],
  production: ['production.report'],
  inventory: ['warehouse.pick', 'warehouse.review'],
  site_content: ['product.publish'],
  media: ['product.catalog.read', 'product.publish'],
  store: ['employees.manage'],
  domains: ['product.catalog.read'],
  notifications: [
    'sales.order.create', 'product.catalog.read', 'purchase.manage',
    'warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship',
    'production.report', 'return.manage', 'pricing.approve'
  ],
  settings: ['employees.manage'],
  support: ['employees.manage'],
  ai_employees: ['employees.manage'],
  team: ['employees.manage'],
  pos: ['sales.order.create'],
  returns: ['return.manage'],
  ai_home: ['brain.read'],
  ai_tools: ['ai.tools.use'],
  tryon: ['brain.read']
};

const tabPermissions = {
  products: ['sales.order.create', 'product.catalog.read', 'production.report', 'product.publish'],
  orders: ['sales.order.create', 'warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'],
  assistant: ['brain.read']
};

const employeeRoleLabels = {
  sales: '销售',
  warehouse: '仓库员工',
  production: '生产员工',
  pos_cashier: '收银员',
  knowledge_manager: '知识库管理员',
  store_manager: '店长'
};

function employeePermissions(auth) {
  const employee = auth && auth.response && auth.response.employee;
  const permissions = employee && employee.permissions;
  if (Array.isArray(permissions)) return permissions;
  return [];
}

function isEmployeeWorkMode(auth) {
  return Boolean(auth && auth.session && (
    auth.session.role === 'employee'
    || (auth.session.role === 'merchant' && auth.session.workMode === 'employee')
  ));
}

function hasPermission(auth, permission) {
  if (!auth || !auth.session) return false;
  if (auth.session.role === 'merchant' && auth.session.workMode !== 'employee') return true;
  const permissions = auth.session.role === 'merchant'
    ? ownerEmployeePermissions
    : employeePermissions(auth);
  return permissions.includes('*') || permissions.includes(permission);
}

function canAccessPermissions(auth, requiredPermissions) {
  if (!auth || !auth.session) return false;
  if (auth.session.role === 'merchant' && auth.session.workMode !== 'employee') return true;
  return requiredPermissions.some(permission => hasPermission(auth, permission));
}

function canAccessWorkspace(auth, id) {
  if (!isWorkspaceEnabled(id) || !auth || !auth.session) return false;
  if (auth.session.role === 'merchant' && auth.session.workMode !== 'employee') return true;
  const requiredPermissions = workspacePermissions[id];
  return Array.isArray(requiredPermissions) && canAccessPermissions(auth, requiredPermissions);
}

function canAccessTab(auth, id) {
  if (id === 'assistant' && !isWorkspaceEnabled('ai_home')) return false;
  const requiredPermissions = tabPermissions[id];
  return Array.isArray(requiredPermissions) && canAccessPermissions(auth, requiredPermissions);
}

function visibleGroups(groups, auth) {
  const featureFilteredGroups = groups.map(group => ({
    id: group.id,
    title: group.title,
    items: group.items.filter(item => isWorkspaceEnabled(item.id))
  })).filter(group => group.items.length > 0);
  if (auth && auth.session && auth.session.role === 'merchant' && auth.session.workMode !== 'employee') return featureFilteredGroups;
  return featureFilteredGroups.map(group => ({
    id: group.id,
    title: group.title,
    items: group.items.filter(item => canAccessWorkspace(auth, item.id))
  })).filter(group => group.items.length > 0);
}

function roleLabel(auth) {
  if (!auth || !auth.session) return '';
  if (auth.session.role === 'merchant') {
    return auth.session.workMode === 'employee' ? '员工工作台' : '老板工作台';
  }
  const employee = auth.response && auth.response.employee;
  return employeeRoleLabels[employee && employee.role] || '员工工作台';
}

module.exports = {
  canAccessPermissions,
  canAccessTab,
  canAccessWorkspace,
  employeePermissions,
  isEmployeeWorkMode,
  roleLabel,
  visibleGroups
};

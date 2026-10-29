import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, LogOut, Minus, Package, Plus, Search, Settings, ShoppingCart, UserRound, Wifi, WifiOff } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet, apiPatch, apiPost, apiPut } from '../../../../api/client';
import { ProductImage } from '../../../shared/components/common/ProductImage';
import { PasswordInput } from '../../../shared/components/common/PasswordInput';
import { PWAInstallModal } from '../../../shared/components/pwa/PWAInstallModal';
import { usePWAInstall } from '../../../../hooks/usePWAInstall';
import type { Product, WholesaleCustomer } from '../../../../types/b2b';

type SalesLine = { product: Product; sku: string; color: string; size: string; quantity: number };
type PickingOrder = {
  id: string;
  orderNo: string;
  companyName: string;
  status: string;
  items: Array<{ id: string; styleNo: string; productName: string; sku: string; color: string; size: string; quantity: number; pickedQuantity: number }>;
  workflow?: Array<{ action: string; reviewed?: boolean; quantities?: Array<{ orderItemId: string; quantity: number; exception?: string }> }>;
};
type EmployeeInventoryBalance = {
  id: string;
  variantId: string;
  sku: string;
  color: string;
  size: string;
  product: { id: string; styleNo: string; name: string };
  location: { id: string; code: string; name: string };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  version: number;
};
type EmployeeWarehouseLocation = { id: string; code: string; name: string };
type EmployeeWorkOrder = {
  id: string;
  workOrderNo: string;
  status: string;
  plannedQuantity: number;
  completedQuantity: number;
  rejectedQuantity?: number;
  dueDate?: string | null;
  priority?: string;
  product?: { id?: string; styleNo: string; name: string };
  variant?: { sku: string; color?: string; size?: string };
};
type EmployeeProductionVariant = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  product: { id: string; styleNo: string; name: string };
};
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export const MerchantEmployeeMobileApp: React.FC = () => {
  const { authMerchantId, addNotification, logout } = useB2B();
  const [view, setView] = useState<'dashboard' | 'sale' | 'orders' | 'inventory' | 'production' | 'profile'>('dashboard');
  const [query, setQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [lines, setLines] = useState<SalesLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'net_30'>('bank_transfer');
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ orderNo: string; totalAmount: number; id: string } | null>(null);
  const [employee, setEmployee] = useState<{ name: string; role: string; id?: string; permissions?: string[] } | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; orderNo: string; companyName: string; totalAmount: number; status: string }>>([]);
  const [workOrders, setWorkOrders] = useState<EmployeeWorkOrder[]>([]);
  const [productionVariants, setProductionVariants] = useState<EmployeeProductionVariant[]>([]);
  const [employeeProducts, setEmployeeProducts] = useState<Product[]>([]);
  const [employeeCustomers, setEmployeeCustomers] = useState<WholesaleCustomer[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<EmployeeInventoryBalance[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<EmployeeWarehouseLocation[]>([]);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryAdjustment, setInventoryAdjustment] = useState<{ balance: EmployeeInventoryBalance; quantity: string; note: string } | null>(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [productionForm, setProductionForm] = useState({ variantId: '', outputLocationId: '', plannedQuantity: '', dueDate: '', priority: 'normal', notes: '' });
  const [productionBusy, setProductionBusy] = useState(false);
  const [employeeReady, setEmployeeReady] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState('');
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '', role: 'sales' });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({});
  const [reportingWorkOrder, setReportingWorkOrder] = useState<string | null>(null);
  const [goodQuantity, setGoodQuantity] = useState('');
  const [rejectedQuantity, setRejectedQuantity] = useState('');
  const [reworkQuantity, setReworkQuantity] = useState('0');
  const [reportNote, setReportNote] = useState('');
  const [defectReason, setDefectReason] = useState('');
  const [shortageNote, setShortageNote] = useState('');
  const [inventoryCount, setInventoryCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [teamEmployees, setTeamEmployees] = useState<Array<{ id: string; name: string; email: string; role: string; permissions: string; active: boolean }>>([]);
  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>([]);
  const [pricingApprovals, setPricingApprovals] = useState<Array<{ id: string; productId: string; sku: string; requestedUnitPrice: number; status: string; requester?: { name: string } }>>([]);
  const [approvalIds, setApprovalIds] = useState<Record<string, string>>({});
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('ruda-xs-order-sound') === 'on');
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activePickingOrder, setActivePickingOrder] = useState<string | null>(null);
  const [pickQuantities, setPickQuantities] = useState<Record<string, string>>({});
  const [pickExceptions, setPickExceptions] = useState<Record<string, string>>({});
  const [pickNote, setPickNote] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [discountLine, setDiscountLine] = useState<SalesLine | null>(null);
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountSubmitting, setDiscountSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerStream = useRef<MediaStream | null>(null);
  const knownOrderIds = useRef<Set<string> | null>(null);
  const { showInstallPromptModal, setShowInstallPromptModal, dismissPrompt } = usePWAInstall('ruda_xs_employee');
  const permissionOptions = [
    ['sales.order.create', '创建销售单'],
    ['pricing.request', '提交改价申请'],
    ['pricing.approve', '审批改价'],
    ['warehouse.pick', '拣货与差异登记'],
    ['warehouse.review', '复核'],
    ['warehouse.pack', '打包'],
    ['warehouse.ship', '出库'],
    ['production.report', '报工与质量记录'],
    ['employees.manage', '员工与权限管理'],
    ['brain.read', '查看 ModaUI 知识库'],
    ['brain.write', '添加知识库文档'],
    ['brain.knowledge.review', '审核知识库文档']
  ] as const;

  const playOrderAlert = () => {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  };

  const loadOrders = async (notify = false) => {
    if (!canViewOrders) {
      setRecentOrders([]);
      return;
    }
    try {
      const result = await apiGet<{ success: true; orders: Array<{ id: string; orderNo: string; companyName: string; totalAmount: number; status: string }> }>('/api/merchant/orders');
      const orders = result.orders.slice(0, 30);
      const ids = new Set(orders.map(order => order.id));
      if (knownOrderIds.current && [...ids].some(id => !knownOrderIds.current?.has(id))) {
        const newCount = [...ids].filter(id => !knownOrderIds.current?.has(id)).length;
        setUnreadOrders(count => count + newCount);
        if (notify) {
          playOrderAlert();
          if ('Notification' in window && Notification.permission === 'granted') new Notification('RUDA XS · 新订单', { body: `${newCount} 张订单已进入待处理队列` });
        }
      }
      knownOrderIds.current = ids;
      setRecentOrders(orders);
    } catch (error) {
      if (notify) addNotification('warning', '订单同步失败', error instanceof Error ? error.message : '请检查网络');
    }
  };

  const hasPermission = (permission: string, permissions = employee?.permissions || []) =>
    Boolean(permissions.includes('*') || permissions.includes(permission));
  const canSell = hasPermission('sales.order.create');
  const canRequestPrice = hasPermission('pricing.request');
  const canApprovePrice = hasPermission('pricing.approve');
  const canPick = hasPermission('warehouse.pick');
  const canReviewInventory = hasPermission('warehouse.review');
  const canReviewPick = hasPermission('warehouse.review');
  const canPack = hasPermission('warehouse.pack');
  const canShip = hasPermission('warehouse.ship');
  const canUseWarehouse = canPick || canReviewPick || canPack || canShip;
  const canReportProduction = hasPermission('production.report');
  const canManageEmployees = hasPermission('employees.manage');
  const canViewOrders = canSell || canUseWarehouse;
  const filteredInventory = inventoryBalances.filter(balance =>
    `${balance.product.styleNo} ${balance.product.name} ${balance.sku} ${balance.color} ${balance.size}`
      .toLowerCase().includes(inventoryQuery.trim().toLowerCase())
  );

  const loadRoleData = async (permissions = employee?.permissions || []) => {
    const has = (permission: string) => hasPermission(permission, permissions);
    const roleDataTasks: Promise<void>[] = [];
    if (has('sales.order.create')) {
      roleDataTasks.push((async () => {
        const [productResult, customerResult] = await Promise.all([
          apiGet<{ success: true; products: Product[] }>('/api/merchant/products'),
          apiGet<{ success: true; customers: WholesaleCustomer[] }>('/api/merchant/customers')
        ]);
        setEmployeeProducts(productResult.products);
        setEmployeeCustomers(customerResult.customers);
      })());
    }
    if (has('warehouse.pick') || has('warehouse.review')) {
      roleDataTasks.push((async () => {
        const balances = await apiGet<{ success: true; total: number; balances: EmployeeInventoryBalance[] }>('/api/merchant/inventory/balances?pageSize=100');
        setInventoryCount(Number(balances.total || 0));
        setInventoryBalances(balances.balances);
      })());
    }
    if (has('warehouse.pick') || has('warehouse.review') || has('warehouse.pack') || has('warehouse.ship')) {
      roleDataTasks.push((async () => {
        const picking = await apiGet<{ success: true; orders: PickingOrder[] }>('/api/merchant/employee-picking');
        setPickingOrders(picking.orders);
      })());
    }
    if (has('production.report')) {
      roleDataTasks.push((async () => {
        const [result, locations] = await Promise.all([
          apiGet<{ success: true; workOrders: EmployeeWorkOrder[]; variants: EmployeeProductionVariant[] }>('/api/merchant/production/work-orders'),
          apiGet<{ success: true; locations: EmployeeWarehouseLocation[] }>('/api/merchant/warehouse-locations')
        ]);
        setWorkOrders(result.workOrders.filter(order => !['completed', 'cancelled'].includes(order.status)).slice(0, 100));
        setProductionVariants(result.variants);
        setWarehouseLocations(locations.locations);
        setProductionForm(current => ({ ...current, outputLocationId: current.outputLocationId || locations.locations[0]?.id || '' }));
      })());
    }
    if (has('employees.manage')) {
      roleDataTasks.push((async () => {
        const result = await apiGet<{ success: true; employees: typeof teamEmployees }>('/api/merchant/employees');
        setTeamCount(result.employees.filter(item => item.active).length);
        setTeamEmployees(result.employees);
      })());
    }
    if (has('pricing.request') || has('pricing.approve')) {
      roleDataTasks.push((async () => {
        const result = await apiGet<{ success: true; requests: typeof pricingApprovals }>('/api/merchant/pricing-approvals');
        setPricingApprovals(result.requests);
      })());
    }
    const results = await Promise.allSettled(roleDataTasks);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  };

  const createTeamEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingEmployee || !newEmployee.name.trim() || !newEmployee.email.trim() || newEmployee.password.length < 8) return;
    setCreatingEmployee(true);
    try {
      await apiPost('/api/merchant/employees', newEmployee);
      const result = await apiGet<{ success: true; employees: typeof teamEmployees }>('/api/merchant/employees');
      setTeamEmployees(result.employees);
      setTeamCount(result.employees.filter(item => item.active).length);
      setNewEmployee({ name: '', email: '', password: '', role: 'sales' });
      addNotification('success', '员工账号已创建', '员工可以使用企业邮箱和初始密码登录员工端');
    } catch (error) {
      addNotification('warning', '员工创建失败', error instanceof Error ? error.message : '请检查邮箱后重试');
    } finally {
      setCreatingEmployee(false);
    }
  };

  const setTeamEmployeeActive = async (member: typeof teamEmployees[number], active: boolean) => {
    try {
      await apiPatch(`/api/merchant/employees/${encodeURIComponent(member.id)}/status`, { active });
      const result = await apiGet<{ success: true; employees: typeof teamEmployees }>('/api/merchant/employees');
      setTeamEmployees(result.employees);
      setTeamCount(result.employees.filter(item => item.active).length);
      addNotification('success', active ? '员工账号已启用' : '员工账号已停用', member.name);
    } catch (error) {
      addNotification('warning', '员工状态更新失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const submitInventoryAdjustment = async () => {
    if (!inventoryAdjustment || inventoryBusy) return;
    const desiredQuantity = Number(inventoryAdjustment.quantity);
    const delta = desiredQuantity - inventoryAdjustment.balance.onHandQuantity;
    if (!Number.isInteger(desiredQuantity) || desiredQuantity < inventoryAdjustment.balance.reservedQuantity || !inventoryAdjustment.note.trim()) {
      addNotification('warning', '盘点数据无效', '现有库存不能低于已预留数量，并且必须填写调整原因');
      return;
    }
    if (!delta) {
      setInventoryAdjustment(null);
      return;
    }
    setInventoryBusy(true);
    try {
      await apiPost('/api/merchant/inventory/adjustments', {
        balanceId: inventoryAdjustment.balance.id,
        variantId: inventoryAdjustment.balance.variantId,
        locationId: inventoryAdjustment.balance.location.id,
        version: inventoryAdjustment.balance.version,
        quantity: delta,
        note: inventoryAdjustment.note.trim()
      });
      setInventoryAdjustment(null);
      await loadRoleData();
      addNotification('success', '盘点调整已保存', `${inventoryAdjustment.balance.sku} 库存已更新并记录操作日志`);
    } catch (error) {
      addNotification('warning', '盘点调整失败', error instanceof Error ? error.message : '库存可能已变化，请刷新后重试');
    } finally {
      setInventoryBusy(false);
    }
  };

  const createProductionWorkOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (productionBusy) return;
    const variant = productionVariants.find(item => item.id === productionForm.variantId);
    const plannedQuantity = Number(productionForm.plannedQuantity);
    if (!variant || !Number.isInteger(plannedQuantity) || plannedQuantity < 1 || !warehouseLocations.some(location => location.id === productionForm.outputLocationId)) {
      addNotification('warning', '工单信息不完整', '选择 SKU、填写计划数量，并确认中央仓库可用');
      return;
    }
    setProductionBusy(true);
    try {
      await apiPost('/api/merchant/production/work-orders', {
        productId: variant.product.id,
        variantId: variant.id,
        outputLocationId: productionForm.outputLocationId,
        plannedQuantity,
        priority: productionForm.priority,
        dueDate: productionForm.dueDate || undefined,
        notes: productionForm.notes.trim()
      });
      setProductionForm({ variantId: '', outputLocationId: warehouseLocations[0]?.id || '', plannedQuantity: '', dueDate: '', priority: 'normal', notes: '' });
      await loadRoleData();
      addNotification('success', '生产工单已创建', '工单已加入生产队列，可继续释放并报工');
    } catch (error) {
      addNotification('warning', '工单创建失败', error instanceof Error ? error.message : '请检查物料和 SKU 配置');
    } finally {
      setProductionBusy(false);
    }
  };

  const refreshEmployeeData = async () => {
    try {
      await Promise.all([loadRoleData(), loadOrders(true)]);
      setEmployeeLoadError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '请检查网络后重试';
      setEmployeeLoadError(message);
      addNotification('warning', '工作数据同步失败', message);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('ruda-xs-sale-draft');
    if (saved) {
      try { setLines(JSON.parse(saved) as SalesLine[]); } catch { localStorage.removeItem('ruda-xs-sale-draft'); }
    }
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void apiGet<{ success: true; employee: { name: string; role: string; id?: string; permissions?: string[] } }>('/api/auth/me/employee').then(result => {
      setEmployee(result.employee);
      return loadRoleData(result.employee.permissions || []);
    }).then(() => {
      setEmployeeLoadError('');
    }).catch(error => {
      setEmployeeLoadError(error instanceof Error ? error.message : '员工数据加载失败，请重试');
      addNotification('warning', '员工工作数据加载失败', error instanceof Error ? error.message : '请检查网络后重试');
    }).finally(() => setEmployeeReady(true));
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      scannerStream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('ruda-xs-sale-draft', JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    if (view !== 'orders' && view !== 'dashboard' && view !== 'inventory' && view !== 'production') return;
    if (view === 'orders') setUnreadOrders(0);
    void loadOrders();
    if (view === 'dashboard' || view === 'orders' || view === 'inventory' || view === 'production') {
      void loadRoleData().catch(error => addNotification('warning', '工作数据同步失败', error instanceof Error ? error.message : '请稍后重试'));
    }
  }, [view, addNotification, employee?.permissions]);

  useEffect(() => {
    const timer = window.setInterval(() => { void loadOrders(true); }, 30000);
    return () => window.clearInterval(timer);
  }, [soundEnabled, canViewOrders]);

  const enableSound = async () => {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    setSoundEnabled(true);
    localStorage.setItem('ruda-xs-order-sound', 'on');
    playOrderAlert();
  };

  const closeScanner = () => {
    scannerStream.current?.getTracks().forEach(track => track.stop());
    scannerStream.current = null;
    setScannerOpen(false);
  };

  const openScanner = async () => {
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      addNotification('info', '设备不支持摄像头扫码', '请使用扫码枪或在搜索框输入条码');
      return;
    }
    try {
      scannerStream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setScannerOpen(true);
      window.setTimeout(() => {
        if (videoRef.current && scannerStream.current) {
          videoRef.current.srcObject = scannerStream.current;
          void videoRef.current.play();
        }
      }, 0);
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });
      const scan = async () => {
        if (!videoRef.current || !scannerStream.current) return;
        try {
          const matches = await detector.detect(videoRef.current);
          const value = matches[0]?.rawValue;
          if (value) {
            setQuery(value);
            closeScanner();
            addNotification('success', '扫码成功', `已搜索条码 ${value}`);
            return;
          }
        } catch {
          // Camera permissions and unsupported formats are surfaced by the fallback notice.
        }
        window.setTimeout(() => void scan(), 350);
      };
      void scan();
    } catch (error) {
      addNotification('warning', '无法打开摄像头', error instanceof Error ? error.message : '请检查浏览器摄像头权限');
      closeScanner();
    }
  };

  const merchantProducts = employeeProducts.filter(product => product.merchantId === authMerchantId && product.lifecycleStatus === 'published');
  const visibleProducts = merchantProducts.filter(product =>
    `${product.styleNo} ${product.name} ${product.category} ${product.brand} ${product.skus.map(sku => sku.sku).join(' ')} ${product.skus.map(sku => sku.barcode || '').join(' ')}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ).slice(0, 60);
  const customers = employeeCustomers.filter(customer =>
    customer.status === 'approved' &&
    `${customer.companyName} ${customer.contactPerson} ${customer.email} ${customer.vatNumber}`.toLowerCase().includes(customerQuery.trim().toLowerCase())
  ).slice(0, 30);
  const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.product.wholesalePrice, 0);
  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  const pendingOrders = recentOrders.filter(order => ['pending', 'placed', 'confirmed'].includes(order.status)).length;
  const salesTotal = recentOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const roleLabel: Record<string, string> = {
    sales: '销售开单',
    warehouse: '仓库履约',
    production: '生产执行',
    pos_cashier: 'POS 收银',
    knowledge_manager: 'ModaUI 知识库管理',
    store_manager: '店长管理'
  };
  const viewTabs: Array<{ id: typeof view; label: string }> = [
    { id: 'dashboard', label: '工作台' },
    ...(canSell ? [{ id: 'sale' as const, label: '开单' }] : []),
    ...(canViewOrders ? [{ id: 'orders' as const, label: '订单' }] : []),
    ...(canPick || canReviewInventory ? [{ id: 'inventory' as const, label: '库存' }] : []),
    ...(canReportProduction ? [{ id: 'production' as const, label: '生产' }] : []),
    { id: 'profile', label: '我的' }
  ];

  const addLine = (product: Product) => {
    const selectedSku = selectedSkus[product.id] || product.skus[0]?.sku;
    const sku = product.skus.find(item => item.sku === selectedSku);
    if (!sku) return addNotification('warning', '商品没有 SKU', '请先在电脑版商品管理中建立 SKU');
    const quantity = Math.max(product.moq, product.packSize);
    const available = Math.max(0, sku.stockCentral - (sku.reserved || 0));
    if (available < quantity) return addNotification('warning', '该规格库存不足', `${sku.sku} 当前可售 ${available} 件`);
    setLines(previous => {
      const existing = previous.find(line => line.product.id === product.id && line.sku === sku.sku);
      if (existing) {
        if (existing.quantity + product.packSize > available) {
          addNotification('warning', '超出可售库存', `${sku.sku} 当前可售 ${available} 件`);
          return previous;
        }
        return previous.map(line => line === existing ? { ...line, quantity: line.quantity + product.packSize } : line);
      }
      return [...previous, { product, sku: sku.sku, color: sku.color, size: sku.size, quantity }];
    });
  };

  const changeQuantity = (line: SalesLine, delta: number) => {
    setLines(previous => previous.flatMap(item => {
      if (item !== line) return [item];
      const quantity = item.quantity + delta;
      const currentSku = item.product.skus.find(sku => sku.sku === item.sku);
      const available = Math.max(0, (currentSku?.stockCentral || 0) - (currentSku?.reserved || 0));
      if (quantity > available) {
        addNotification('warning', '超出可售库存', `${item.sku} 当前可售 ${available} 件`);
        return [item];
      }
      if (approvalIds[`${item.product.id}:${item.sku}`]) {
        setApprovalIds(current => {
          const next = { ...current };
          delete next[`${item.product.id}:${item.sku}`];
          return next;
        });
      }
      return quantity >= item.product.moq ? [{ ...item, quantity }] : [];
    }));
  };

  const submitSale = async () => {
    if (!canSell || !selectedCustomer || lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await apiPost<{ success: true; order: { orderNo: string; totalAmount: number }; orderId: string }>('/api/merchant/employee-orders', {
        customerId: selectedCustomer.id,
        paymentMethod,
        items: lines.map(line => ({ productId: line.product.id, sku: line.sku, color: line.color, size: line.size, quantity: line.quantity, approvalRequestId: approvalIds[`${line.product.id}:${line.sku}`] })),
        idempotencyKey: crypto.randomUUID()
      });
      setLastOrder({ ...result.order, id: result.orderId });
      setLines([]);
      addNotification('success', '销售订单已生成', `${result.order.orderNo} 已写入商家订单中心`);
    } catch (error) {
      addNotification('warning', '出单失败', error instanceof Error ? error.message : '库存或客户授信可能已变化');
    } finally {
      setSubmitting(false);
    }
  };

  const saveQuote = async () => {
    if (!selectedCustomer || !lines.length) return;
    try {
      const result = await apiPost<{ success: true; quote: { id: string; quoteNo: string; totalAmount: number } }>('/api/merchant/quotes', {
        customerId: selectedCustomer.id,
        items: lines.map(line => ({ productId: line.product.id, sku: line.sku, color: line.color, size: line.size, quantity: line.quantity, approvalRequestId: approvalIds[`${line.product.id}:${line.sku}`] }))
      });
      addNotification('success', '报价单已保存', `${result.quote.quoteNo} 有效期 7 天`);
      window.open(`/api/merchant/quotes/${result.quote.id}/print`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      addNotification('warning', '报价单保存失败', error instanceof Error ? error.message : '请先完成价格审批');
    }
  };

  const openDiscountForm = (line: SalesLine) => {
    if (!selectedCustomer) {
      addNotification('warning', '请先选择客户', '折扣审批必须绑定已认证客户');
      return;
    }
    setDiscountLine(line);
    setDiscountPrice('');
    setDiscountReason('');
  };

  const requestDiscount = async () => {
    if (!discountLine || !selectedCustomer || discountSubmitting) return;
    const requestedUnitPrice = Number(discountPrice);
    const reason = discountReason.trim();
    if (!Number.isFinite(requestedUnitPrice) || requestedUnitPrice <= 0) {
      addNotification('warning', '审批单价无效', '请输入大于 0 的单价');
      return;
    }
    if (!reason) {
      addNotification('warning', '申请原因不能为空', '请说明客户报价或折扣原因');
      return;
    }
    setDiscountSubmitting(true);
    try {
      const result = await apiPost<{ success: true; request: { id: string } }>('/api/merchant/pricing-approvals', {
        customerId: selectedCustomer.id, productId: discountLine.product.id, sku: discountLine.sku, quantity: discountLine.quantity,
        requestedUnitPrice, reason
      });
      setApprovalIds(current => ({ ...current, [`${discountLine.product.id}:${discountLine.sku}`]: result.request.id }));
      setDiscountLine(null);
      addNotification('success', '折扣申请已提交', '等待店长审批后才能按申请价开单');
    } catch (error) {
      addNotification('warning', '折扣申请失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setDiscountSubmitting(false);
    }
  };

  const decideApproval = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await apiPut(`/api/merchant/pricing-approvals/${requestId}`, { status });
      await loadRoleData();
      addNotification('success', status === 'approved' ? '审批已通过' : '审批已驳回', '销售端将同步最新审批状态');
    } catch (error) {
      addNotification('warning', '审批操作失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const advanceWorkOrder = async (workOrder: typeof workOrders[number]) => {
    const nextStatus: Record<string, string> = { draft: 'released', released: 'in_progress', in_progress: 'qc_hold', qc_hold: 'in_progress' };
    const status = nextStatus[workOrder.status];
    if (!status) return;
    try {
      await apiPut(`/api/merchant/production/work-orders/${workOrder.id}/status`, { status });
      setWorkOrders(current => current.map(item => item.id === workOrder.id ? { ...item, status } : item));
      addNotification('success', '工单状态已更新', `${workOrder.workOrderNo} → ${status}`);
    } catch (error) {
      addNotification('warning', '工单更新失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const submitProductionReport = async (workOrder: typeof workOrders[number]) => {
    const good = Number(goodQuantity);
    const rejected = Number(rejectedQuantity || 0);
    const rework = Number(reworkQuantity || 0);
    if (!Number.isInteger(good) || good < 0 || !Number.isInteger(rejected) || rejected < 0 || !Number.isInteger(rework) || rework < 0 || rework > rejected || good + rejected <= 0 || (rejected > 0 && !defectReason.trim())) {
      addNotification('warning', '报工数量无效', '请输入合格数量或不合格数量');
      return;
    }
    try {
      await apiPost(`/api/merchant/production/work-orders/${workOrder.id}/reports`, {
        goodQuantity: good,
        rejectedQuantity: rejected,
        reworkQuantity: rework,
        defectReason: defectReason.trim(),
        shortageNote: shortageNote.trim(),
        note: reportNote.trim(),
        idempotencyKey: crypto.randomUUID()
      });
      addNotification('success', '生产报工已提交', `${workOrder.workOrderNo} 已同步库存和质检流程`);
      setReportingWorkOrder(null);
      setGoodQuantity('');
      setRejectedQuantity('');
      setReworkQuantity('0');
      setDefectReason('');
      setShortageNote('');
      setReportNote('');
      await loadRoleData();
    } catch (error) {
      addNotification('warning', '生产报工失败', error instanceof Error ? error.message : '工单数量可能已被其他员工更新');
    }
  };

  const openPicking = (order: PickingOrder) => {
    setActivePickingOrder(order.id);
    setPickQuantities(Object.fromEntries(order.items.map(item => [item.id, String(item.pickedQuantity)])));
    setPickExceptions({});
    setPickNote('');
  };

  const updatePicking = async (order: PickingOrder, action: 'pick' | 'update' | 'review' | 'pack' | 'ship') => {
    const requiredPermission: Record<typeof action, string> = {
      pick: 'warehouse.pick',
      update: 'warehouse.pick',
      review: 'warehouse.review',
      pack: 'warehouse.pack',
      ship: 'warehouse.ship'
    };
    if (!hasPermission(requiredPermission[action])) {
      addNotification('warning', '没有此项仓库权限', '请联系店长调整员工权限后重试');
      return;
    }
    const items = order.items.map(item => ({
      orderItemId: item.id,
      quantity: Number(pickQuantities[item.id] ?? item.pickedQuantity),
      exception: pickExceptions[item.id] || ''
    }));
    if (['update', 'review'].includes(action) && items.some(item => {
      const orderedQuantity = order.items.find(source => source.id === item.orderItemId)!.quantity;
      return !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > orderedQuantity || (item.quantity < orderedQuantity && !item.exception.trim());
    })) {
      addNotification('warning', '数量无效', '已拣数量不能超过订单数量；少拣时请填写缺货/差异说明');
      return;
    }
    try {
      await apiPut(`/api/merchant/employee-picking/${order.id}`, { action, items, carrier, trackingNumber, note: pickNote });
      addNotification('success', ({ pick: '已开始拣货', update: '拣货数量已保存', review: '复核已完成', pack: '订单已打包', ship: '已完成出库确认' } as Record<string, string>)[action], `${order.orderNo} 已同步到履约中心`);
      if (action === 'ship') {
        setCarrier('');
        setTrackingNumber('');
        setActivePickingOrder(null);
      }
      await loadRoleData();
      await loadOrders();
    } catch (error) {
      addNotification('warning', '仓库操作失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  if (!employeeReady) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-sm font-semibold text-neutral-600">正在同步员工工作台…</div>;
  }

  return (
    <div className="portal-theme-employee min-h-screen bg-neutral-100 pb-24 text-neutral-900">
      <PWAInstallModal
        isOpen={showInstallPromptModal}
        onClose={() => {
          dismissPrompt();
          setShowInstallPromptModal(false);
        }}
        storageKey="ruda_xs_employee"
      />
      {discountLine && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 sm:items-center sm:justify-center" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget && !discountSubmitting) setDiscountLine(null);
        }}>
          <form className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onSubmit={event => { event.preventDefault(); void requestDiscount(); }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">申请调价</h2>
                <p className="mt-1 text-xs text-neutral-500">{discountLine.product.styleNo} · 原价 €{discountLine.product.wholesalePrice.toFixed(2)}</p>
              </div>
              <button type="button" className="rounded px-2 py-1 text-lg text-neutral-500" onClick={() => setDiscountLine(null)} disabled={discountSubmitting} aria-label="关闭">×</button>
            </div>
            <label className="mt-4 block text-xs font-semibold">
              审批单价 (€)
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                autoFocus
                value={discountPrice}
                onChange={event => setDiscountPrice(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                placeholder="请输入客户报价单价"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold">
              申请原因
              <textarea
                required
                minLength={2}
                maxLength={200}
                value={discountReason}
                onChange={event => setDiscountReason(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                placeholder="例如：客户批量采购，申请阶梯报价"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setDiscountLine(null)} disabled={discountSubmitting} className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-sm font-semibold">取消</button>
              <button type="submit" disabled={discountSubmitting} className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{discountSubmitting ? '提交中…' : '提交审批'}</button>
            </div>
          </form>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-neutral-950 px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white font-serif text-sm font-black text-neutral-950">R</div><div><p className="text-xs font-black tracking-widest">RUDA XS</p><p className="mt-1 text-[10px] text-neutral-400">{employee?.name || '员工'} · {roleLabel[employee?.role || 'sales'] || '员工'}</p></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void enableSound()} className={`rounded-full px-2 py-1 text-[10px] font-bold ${soundEnabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-neutral-300'}`}>{soundEnabled ? '🔔 已开' : '🔕 开启提示音'}</button><div className={`rounded-full px-2 py-1 text-[10px] font-bold ${online ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{online ? <><Wifi className="mr-1 inline h-3 w-3" />实时同步</> : <><WifiOff className="mr-1 inline h-3 w-3" />离线草稿</>}</div></div>
        </div>
      </header>
      <main className="space-y-3 p-4">
        {employeeLoadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><span>工作数据同步失败：{employeeLoadError}</span><button type="button" onClick={() => void refreshEmployeeData()} className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 font-bold text-white">重试</button></div>}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1">
          {viewTabs.map(tab => (
            <button key={tab.id} type="button" onClick={() => setView(tab.id)} className={`relative shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${view === tab.id ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>
              {tab.id === 'sale' && <ShoppingCart className="mr-1 inline h-3.5 w-3.5" />}
              {tab.id === 'orders' && <Package className="mr-1 inline h-3.5 w-3.5" />}
              {tab.label}
              {tab.id === 'orders' && unreadOrders > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{unreadOrders}</span>}
            </button>
          ))}
        </div>
        {view === 'dashboard' ? (
          <section className="space-y-3">
            <div className="rounded-2xl bg-neutral-950 p-5 text-white shadow-sm"><p className="text-xs text-neutral-400">今日员工工作台</p><h1 className="mt-1 text-xl font-black">{employee?.name || '员工'} · {roleLabel[employee?.role || 'sales'] || '员工'}</h1></div>
            <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-[10px] text-neutral-500">同步订单</span><strong className="mt-1 block text-2xl">{recentOrders.length}</strong></div><div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-[10px] text-neutral-500">待处理</span><strong className="mt-1 block text-2xl text-amber-600">{pendingOrders}</strong></div><div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-[10px] text-neutral-500">{canUseWarehouse ? '库存 SKU' : canReportProduction ? '进行中工单' : canManageEmployees ? '员工人数' : '订单金额'}</span><strong className="mt-1 block text-lg">{canUseWarehouse ? inventoryCount : canReportProduction ? workOrders.length : canManageEmployees ? teamCount : `€${salesTotal.toFixed(2)}`}</strong></div><div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-[10px] text-neutral-500">网络状态</span><strong className={`mt-1 block text-sm ${online ? 'text-emerald-600' : 'text-amber-600'}`}>{online ? '实时在线' : '离线草稿'}</strong></div></div>
            {canReportProduction && <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-sm font-bold">生产工单</h2><div className="mt-2 space-y-2">{workOrders.slice(0, 5).map(order => <div key={order.id} className="rounded-lg border p-3"><div className="flex items-center justify-between"><div><b className="block text-xs">{order.workOrderNo}</b><span className="text-[10px] text-neutral-500">{order.product?.styleNo} · {order.status} · {order.completedQuantity}/{order.plannedQuantity}</span></div><button type="button" onClick={() => void advanceWorkOrder(order)} className="rounded-lg bg-neutral-950 px-2 py-1 text-[10px] font-bold text-white">推进</button></div>{['released', 'in_progress', 'qc_hold'].includes(order.status) && <button type="button" onClick={() => setReportingWorkOrder(order.id)} className="mt-2 w-full rounded-lg border py-2 text-[10px] font-bold">填写报工 / 质检</button>}{reportingWorkOrder === order.id && <div className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-2"><div className="grid grid-cols-2 gap-2"><input value={goodQuantity} onChange={event => setGoodQuantity(event.target.value)} inputMode="numeric" placeholder="合格数量" className="rounded border p-2 text-xs" /><input value={rejectedQuantity} onChange={event => setRejectedQuantity(event.target.value)} inputMode="numeric" placeholder="不合格数量" className="rounded border p-2 text-xs" /></div><div className="grid grid-cols-2 gap-2"><input value={reworkQuantity} onChange={event => setReworkQuantity(event.target.value)} inputMode="numeric" placeholder="返工数量" className="rounded border p-2 text-xs" /><input value={defectReason} onChange={event => setDefectReason(event.target.value)} placeholder="不良原因（不良时必填）" className="rounded border p-2 text-xs" /></div><input value={shortageNote} onChange={event => setShortageNote(event.target.value)} placeholder="缺料/异常说明（可选）" className="w-full rounded border p-2 text-xs" /><input value={reportNote} onChange={event => setReportNote(event.target.value)} placeholder="质检备注（可选）" className="w-full rounded border p-2 text-xs" /><div className="flex gap-2"><button type="button" onClick={() => void submitProductionReport(order)} className="flex-1 rounded bg-emerald-600 py-2 text-[10px] font-bold text-white">提交报工</button><button type="button" onClick={() => setReportingWorkOrder(null)} className="rounded border px-3 py-2 text-[10px]">取消</button></div></div>}</div>)}</div><button type="button" onClick={() => setView('production')} className="mt-3 w-full rounded-xl border py-2 text-xs font-bold">打开生产中心</button></div>}
            {canUseWarehouse &&             <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-sm font-bold">仓库操作</h2><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setView('orders')} className="rounded-xl bg-neutral-950 py-3 text-xs font-bold text-white">订单拣货队列</button>{(canPick || canReviewInventory) && <button type="button" onClick={() => setView('inventory')} className="rounded-xl border py-3 text-xs font-bold">库存盘点</button>}</div></div>}
            {canApprovePrice && <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-sm font-bold">改价审批</h2><p className="mt-2 text-[11px] text-neutral-500">折扣需他人审批</p><div className="mt-3 space-y-2">{pricingApprovals.filter(item => item.status === 'pending').map(item => <div key={item.id} className="rounded-lg border p-2"><div className="flex justify-between text-[10px]"><span>{item.requester?.name || '销售'} · {item.sku}</span><b>€{Number(item.requestedUnitPrice).toFixed(2)}</b></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => void decideApproval(item.id, 'approved')} className="flex-1 rounded bg-emerald-600 py-1.5 text-[10px] font-bold text-white">批准</button><button type="button" onClick={() => void decideApproval(item.id, 'rejected')} className="flex-1 rounded border py-1.5 text-[10px] font-bold">驳回</button></div></div>)}{pricingApprovals.filter(item => item.status === 'pending').length === 0 && <p className="text-[10px] text-neutral-500">暂无待审批改价。</p>}</div></div>}
            <div className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-sm font-bold">快速操作</h2><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!canSell} onClick={() => setView('sale')} className="rounded-xl bg-neutral-950 px-3 py-3 text-xs font-bold text-white disabled:opacity-30">新建销售单</button><button type="button" disabled={!canViewOrders} onClick={() => setView('orders')} className="rounded-xl border border-neutral-200 px-3 py-3 text-xs font-bold disabled:opacity-40">查看待处理订单</button></div></div>
            {!canSell && <div className="rounded-xl bg-blue-50 p-3 text-[11px] text-blue-800">无开单权限，请联系店长</div>}
          </section>
        ) : view === 'sale' ? (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold">1. 认证客户</h2>{selectedCustomer && <button type="button" onClick={() => setSelectedCustomer(null)} className="text-[10px] text-neutral-500">更换</button>}</div>
              {selectedCustomer ? <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><UserRound className="h-5 w-5 text-emerald-700" /><div><p className="text-xs font-bold">{selectedCustomer.companyName}</p><p className="text-[10px] text-emerald-800">{selectedCustomer.contactPerson} · {selectedCustomer.tier}</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" /></div> : <><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" /><input value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} placeholder="搜索公司、联系人或 VAT" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs" /></div><div className="mt-2 space-y-1">{customers.slice(0, 5).map(customer => <button type="button" key={customer.id} onClick={() => setSelectedCustomer(customer)} className="flex w-full items-center justify-between rounded-lg border border-neutral-100 p-2.5 text-left"><span><strong className="block text-xs">{customer.companyName}</strong><small className="text-[10px] text-neutral-500">{customer.contactPerson} · {customer.city}</small></span><ChevronRight className="h-4 w-4 text-neutral-400" /></button>)}{customers.length === 0 && <p className="p-2 text-center text-[10px] text-neutral-500">仅限已认证客户</p>}</div></>}
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-bold">2. 选择商品</h2>
              <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="扫码枪输入条码 / 搜索款号、品名" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs" /></div><button type="button" onClick={() => void openScanner()} className="rounded-lg bg-neutral-950 px-3 text-xs font-bold text-white">扫码</button></div>
              <div className="mt-2 grid grid-cols-2 gap-2">{visibleProducts.slice(0, 12).map(product => {
                const selectedSku = product.skus.find(item => item.sku === selectedSkus[product.id]) || product.skus[0];
                const available = selectedSku ? Math.max(0, selectedSku.stockCentral - (selectedSku.reserved || 0)) : 0;
                return <div key={product.id} className="rounded-xl border border-neutral-200 p-2">
                  <ProductImage src={product.images[0]} alt={product.name} contain className="h-24 w-full rounded-lg bg-neutral-50" />
                  <strong className="mt-1 block truncate text-[11px]">{product.styleNo}</strong>
                  <span className="block truncate text-[10px] text-neutral-500">{product.name}</span>
                  <span className="mt-1 block text-[10px] font-bold">€{product.wholesalePrice.toFixed(2)} · 起订 {product.moq}</span>
                  <select
                    aria-label={`${product.styleNo} SKU`}
                    value={selectedSku?.sku || ''}
                    onChange={event => setSelectedSkus(current => ({ ...current, [product.id]: event.target.value }))}
                    className="mt-2 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-[10px]"
                  >
                    {product.skus.map(sku => <option key={sku.sku} value={sku.sku}>{sku.color} / {sku.size} · 可售 {Math.max(0, sku.stockCentral - (sku.reserved || 0))}</option>)}
                  </select>
                  <button type="button" disabled={!selectedSku || available < Math.max(product.moq, product.packSize)} onClick={() => addLine(product)} className="mt-2 w-full rounded-lg bg-neutral-950 py-2 text-[10px] font-bold text-white disabled:opacity-40">加入销售单</button>
                </div>;
              })}</div>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-sm font-bold">3. 订单明细</h2><span className="text-[10px] text-neutral-500">{totalQty} 件</span></div>
              <div className="mt-2 space-y-2">{lines.map(line => <div key={`${line.product.id}-${line.sku}`} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2"><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{line.product.styleNo} · {line.product.name}</strong><span className="text-[10px] text-neutral-500">{line.color} / {line.size} · MOQ {line.product.moq}</span>              {canRequestPrice && <button type="button" onClick={() => openDiscountForm(line)} className="mt-1 block text-[10px] font-bold text-amber-700">{approvalIds[`${line.product.id}:${line.sku}`] ? '已提交审批' : '申请折扣 / 改价'}</button>}</div><button type="button" onClick={() => changeQuantity(line, -line.product.packSize)} className="rounded bg-neutral-100 p-1"><Minus className="h-3 w-3" /></button><span className="w-8 text-center text-xs font-bold">{line.quantity}</span><button type="button" onClick={() => changeQuantity(line, line.product.packSize)} className="rounded bg-neutral-100 p-1"><Plus className="h-3 w-3" /></button></div>)}{lines.length === 0 && <p className="py-5 text-center text-xs text-neutral-500">选商品加单</p>}</div>
              <div className="mt-3 flex items-center gap-2"><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)} className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="bank_transfer">银行转账 / 预付款</option><option value="net_30">Net 30 账期</option></select><strong className="text-sm">€{totalAmount.toFixed(2)}</strong></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!selectedCustomer || lines.length === 0} onClick={() => void saveQuote()} className="rounded-xl border border-neutral-300 py-3 text-xs font-bold disabled:opacity-40">保存报价单</button><button type="button" disabled={!selectedCustomer || lines.length === 0 || submitting} onClick={() => void submitSale()} className="rounded-xl bg-neutral-950 py-3 text-xs font-bold text-white disabled:opacity-40">{submitting ? '正在生成订单...' : '确认出单并扣减库存'}</button></div>
              {lastOrder && <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-center text-[10px] text-emerald-800"><p className="font-semibold">已生成 {lastOrder.orderNo} · €{Number(lastOrder.totalAmount).toFixed(2)}</p><div className="mt-2 flex justify-center gap-2"><a target="_blank" rel="noreferrer" href={`/api/merchant/orders/${lastOrder.id}/print`} className="rounded bg-white px-2 py-1 font-bold">打印销售单</a><a target="_blank" rel="noreferrer" href={`/api/merchant/orders/${lastOrder.id}/invoice`} className="rounded bg-white px-2 py-1 font-bold">开票/发票</a></div></div>}
            </section>
          </>
        ) : view === 'orders' ? <section className="space-y-3">
          {canUseWarehouse && <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">仓库作业</h2><span className="text-[10px] text-neutral-500">{pickingOrders.length} 笔待处理</span></div><div className="space-y-3">{pickingOrders.map(order => { const active = activePickingOrder === order.id; const latestWorkflow = order.workflow?.[order.workflow.length - 1]; const reviewed = Boolean(latestWorkflow?.reviewed); const packed = latestWorkflow?.action === 'pack'; const canStartPick = canPick && order.status !== 'picking'; const canOpenPick = canPick && order.status === 'picking'; return <div key={order.id} className="rounded-xl border border-neutral-100 p-3"><div className="flex items-center justify-between"><div><strong className="block text-xs">{order.orderNo}</strong><span className="text-[10px] text-neutral-500">{order.companyName} · {order.status} · {reviewed ? '已复核' : '待复核'}{packed ? ' · 已打包' : ''}</span></div>{!active && (canStartPick || canOpenPick) && <button type="button" onClick={() => canOpenPick ? openPicking(order) : void updatePicking(order, 'pick')} className="rounded-lg bg-neutral-950 px-2 py-1 text-[10px] font-bold text-white">{canOpenPick ? '处理订单' : '开始拣货'}</button>}{!active && !canStartPick && !canOpenPick && <button type="button" onClick={() => openPicking(order)} className="rounded-lg border px-2 py-1 text-[10px] font-bold">查看订单</button>}</div><div className="mt-2 space-y-1">{order.items.map(item => active ? <div key={item.id} className="rounded-lg bg-neutral-50 p-2"><div className="flex justify-between text-[10px] text-neutral-600"><span>{item.styleNo} · {item.sku} · {item.color}/{item.size}</span><b>{item.pickedQuantity}/{item.quantity}</b></div><div className="mt-1 grid grid-cols-2 gap-1">{canPick ? <input value={pickQuantities[item.id] ?? ''} onChange={event => setPickQuantities(current => ({ ...current, [item.id]: event.target.value }))} inputMode="numeric" aria-label={`${item.sku} 已拣数量`} className="rounded border p-1.5 text-xs" placeholder="已拣数量" /> : null}{canPick ? <input value={pickExceptions[item.id] ?? ''} onChange={event => setPickExceptions(current => ({ ...current, [item.id]: event.target.value }))} aria-label={`${item.sku} 缺货或差异说明`} className="rounded border p-1.5 text-xs" placeholder="缺货/差异说明" /> : null}</div></div> : <div key={item.id} className="flex justify-between text-[10px] text-neutral-600"><span>{item.styleNo} · {item.sku} · {item.color}/{item.size}</span><b>{item.pickedQuantity}/{item.quantity}</b></div>)}</div>{active && <div className="mt-2 space-y-2">{(canPick || canReviewPick) && <input value={pickNote} onChange={event => setPickNote(event.target.value)} aria-label="仓库备注" className="w-full rounded border p-2 text-xs" placeholder="复核或差异备注（可选）" />}<div className="grid grid-cols-2 gap-1">{canPick && <button type="button" onClick={() => void updatePicking(order, 'update')} className="rounded border py-2 text-[10px] font-bold">保存数量</button>}{canReviewPick && <button type="button" onClick={() => void updatePicking(order, 'review')} className="rounded bg-amber-500 py-2 text-[10px] font-bold text-white">完成复核</button>}{canPack && <button type="button" disabled={!reviewed} onClick={() => void updatePicking(order, 'pack')} className="rounded bg-blue-600 py-2 text-[10px] font-bold text-white disabled:opacity-40">确认打包</button>}{canShip && packed && <><input value={carrier} onChange={event => setCarrier(event.target.value)} aria-label="物流承运商" className="rounded border p-2 text-xs" placeholder="承运商" /><input value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} aria-label="物流单号" className="rounded border p-2 text-xs" placeholder="物流单号" /><button type="button" onClick={() => void updatePicking(order, 'ship')} className="rounded bg-neutral-950 py-2 text-[10px] font-bold text-white">确认出库</button></>}</div><button type="button" onClick={() => setActivePickingOrder(null)} className="w-full rounded border py-1.5 text-[10px]">关闭</button></div>}</div>; })}{pickingOrders.length === 0 && <p className="py-6 text-center text-xs text-neutral-500">暂无待拣货订单。</p>}</div></div>}
          <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">已开订单</h2></div><div className="space-y-2">{recentOrders.map(order => <div key={order.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3"><div><strong className="block text-xs">{order.orderNo}</strong><span className="text-[10px] text-neutral-500">{order.companyName} · {order.status}</span></div><b className="text-xs">€{Number(order.totalAmount).toFixed(2)}</b></div>)}{recentOrders.length === 0 && <p className="py-6 text-center text-xs text-neutral-500">暂无订单</p>}</div></div>
        </section> : view === 'inventory' ? (
          <section className="space-y-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div><h2 className="text-sm font-bold">库存盘点</h2><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>可售=现有-预留</span><span>调整记录留痕</span></div></div>
                <strong className="text-xs">{inventoryBalances.length} SKU</strong>
              </div>
              <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" /><input value={inventoryQuery} onChange={event => setInventoryQuery(event.target.value)} placeholder="搜索款号、商品、SKU、颜色或尺码" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs" /></div>
            </div>
            {filteredInventory.map(balance => (
              <article key={balance.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><strong className="block truncate text-xs">{balance.product.styleNo} · {balance.product.name}</strong><p className="mt-1 text-[10px] text-neutral-500">{balance.sku} · {balance.color} / {balance.size} · {balance.location.name}</p></div>
                  <div className="shrink-0 text-right"><strong className="block text-sm">{balance.availableQuantity} 可售</strong><span className="text-[10px] text-neutral-500">{balance.onHandQuantity} 现有 · {balance.reservedQuantity} 预留</span></div>
                </div>
                {canReviewInventory && <button type="button" onClick={() => setInventoryAdjustment({ balance, quantity: String(balance.onHandQuantity), note: '' })} className="mt-3 w-full rounded-lg border border-neutral-200 py-2 text-xs font-bold">盘点 / 调整库存</button>}
                {inventoryAdjustment?.balance.id === balance.id && (
                  <div className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3">
                    <label className="block text-[10px] font-semibold">盘点后的现有件数<input type="number" min={balance.reservedQuantity} step="1" value={inventoryAdjustment.quantity} onChange={event => setInventoryAdjustment(current => current ? { ...current, quantity: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs" /></label>
                    <label className="block text-[10px] font-semibold">调整原因（必填）<input maxLength={500} value={inventoryAdjustment.note} onChange={event => setInventoryAdjustment(current => current ? { ...current, note: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs" placeholder="例如：实物盘点差异 / 破损报废" /></label>
                    <div className="flex gap-2"><button type="button" disabled={inventoryBusy} onClick={() => void submitInventoryAdjustment()} className="flex-1 rounded-lg bg-neutral-950 py-2 text-xs font-bold text-white disabled:opacity-50">{inventoryBusy ? '保存中…' : '确认盘点'}</button><button type="button" onClick={() => setInventoryAdjustment(null)} className="rounded-lg border px-4 py-2 text-xs font-semibold">取消</button></div>
                  </div>
                )}
              </article>
            ))}
            {filteredInventory.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-xs text-neutral-500">暂无库存记录</div>}
          </section>
        ) : view === 'production' ? (
          <section className="space-y-3">
            <form onSubmit={event => void createProductionWorkOrder(event)} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <div><h2 className="text-sm font-bold">新增工单</h2><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>关联 SKU</span><span>释放预留 BOM</span></div></div>
              <label className="block text-[10px] font-semibold">生产款式 / SKU
                <select required value={productionForm.variantId} onChange={event => setProductionForm(current => ({ ...current, variantId: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                  <option value="">选择商品 SKU</option>
                  {productionVariants.map(variant => <option key={variant.id} value={variant.id}>{variant.product.styleNo} · {variant.sku} · {variant.color || '-'}/{variant.size || '-'}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold">计划件数<input required min="1" max="1000000" type="number" step="1" value={productionForm.plannedQuantity} onChange={event => setProductionForm(current => ({ ...current, plannedQuantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
                <label className="text-[10px] font-semibold">计划交期<input type="date" value={productionForm.dueDate} onChange={event => setProductionForm(current => ({ ...current, dueDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
                <label className="text-[10px] font-semibold">优先级<select value={productionForm.priority} onChange={event => setProductionForm(current => ({ ...current, priority: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
                <label className="text-[10px] font-semibold">完工入库仓库<select required value={productionForm.outputLocationId} onChange={event => setProductionForm(current => ({ ...current, outputLocationId: event.target.value }))} disabled={warehouseLocations.length === 0} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">{warehouseLocations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              </div>
              <label className="block text-[10px] font-semibold">生产要求 / 备注<textarea maxLength={2000} value={productionForm.notes} onChange={event => setProductionForm(current => ({ ...current, notes: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" rows={2} /></label>
              <button type="submit" disabled={productionBusy || !warehouseLocations.length || !productionVariants.length} className="w-full rounded-xl bg-neutral-950 py-3 text-xs font-bold text-white disabled:opacity-40">{productionBusy ? '创建中…' : '新增工单'}</button>
            </form>
            <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">生产任务</h2><span className="text-[10px] text-neutral-500">{workOrders.length} 个进行中</span></div>
              <div className="space-y-2">{workOrders.map(order => <article key={order.id} className="rounded-xl border border-neutral-100 p-3">
                <div className="flex items-start justify-between gap-2"><div><strong className="block text-xs">{order.workOrderNo}</strong><p className="mt-1 text-[10px] text-neutral-500">{order.product?.styleNo} · {order.variant?.sku} · {order.status}</p><p className="mt-1 text-[10px] text-neutral-600">计划 {order.plannedQuantity} · 合格 {order.completedQuantity} · 不合格 {order.rejectedQuantity || 0}{order.dueDate ? ` · 交期 ${new Date(order.dueDate).toLocaleDateString()}` : ''}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${order.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>{order.priority || 'normal'}</span></div>
                <div className="mt-3 flex gap-2">
                  {['draft', 'released', 'in_progress', 'qc_hold'].includes(order.status) && <button type="button" onClick={() => void advanceWorkOrder(order)} className="flex-1 rounded-lg bg-neutral-950 py-2 text-[10px] font-bold text-white">{({ draft: '释放工单', released: '开始生产', in_progress: '进入质检', qc_hold: '恢复生产' } as Record<string, string>)[order.status]}</button>}
                  {['released', 'in_progress', 'qc_hold'].includes(order.status) && <button type="button" onClick={() => { setReportingWorkOrder(order.id); setGoodQuantity(''); setRejectedQuantity(''); setReworkQuantity('0'); setDefectReason(''); setShortageNote(''); setReportNote(''); }} className="flex-1 rounded-lg border py-2 text-[10px] font-bold">报工 / 质检</button>}
                </div>
                {reportingWorkOrder === order.id && <div className="mt-3 space-y-2 rounded-lg bg-neutral-50 p-2"><div className="grid grid-cols-2 gap-2"><input value={goodQuantity} onChange={event => setGoodQuantity(event.target.value)} inputMode="numeric" placeholder="合格数量" className="rounded border p-2 text-xs" /><input value={rejectedQuantity} onChange={event => setRejectedQuantity(event.target.value)} inputMode="numeric" placeholder="不合格数量" className="rounded border p-2 text-xs" /></div><div className="grid grid-cols-2 gap-2"><input value={reworkQuantity} onChange={event => setReworkQuantity(event.target.value)} inputMode="numeric" placeholder="返工数量" className="rounded border p-2 text-xs" /><input value={defectReason} onChange={event => setDefectReason(event.target.value)} placeholder="不良原因（不良时必填）" className="rounded border p-2 text-xs" /></div><input value={shortageNote} onChange={event => setShortageNote(event.target.value)} placeholder="缺料/异常说明（可选）" className="w-full rounded border p-2 text-xs" /><input value={reportNote} onChange={event => setReportNote(event.target.value)} placeholder="质检备注（可选）" className="w-full rounded border p-2 text-xs" /><div className="flex gap-2"><button type="button" onClick={() => void submitProductionReport(order)} className="flex-1 rounded bg-emerald-600 py-2 text-[10px] font-bold text-white">提交报工</button><button type="button" onClick={() => setReportingWorkOrder(null)} className="rounded border px-3 py-2 text-[10px]">取消</button></div></div>}
              </article>)}
              {workOrders.length === 0 && <p className="py-6 text-center text-xs text-neutral-500">暂无生产任务，可在上方创建工单。</p>}</div>
            </div>
          </section>
        ) : <section className="space-y-3">
          <div className="rounded-2xl bg-neutral-950 p-5 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-neutral-950"><UserRound className="h-6 w-6" /></div>
              <div className="min-w-0"><p className="truncate text-base font-black">{employee?.name || '员工'}</p><p className="mt-1 text-[11px] text-neutral-300">{roleLabel[employee?.role || ''] || '执行员工'} · RUDA XS</p></div>
              <span className={`ml-auto rounded-full px-2 py-1 text-[10px] font-bold ${online ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{online ? '在线' : '离线'}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Settings className="h-4 w-4 text-neutral-500" /><h2 className="text-sm font-bold">工作权限</h2></div>
            <p className="mt-1 text-[10px] text-neutral-500">按权限显示</p>
            <div className="mt-3 space-y-2">{permissionOptions.filter(([key]) => hasPermission(key)).map(([, permission]) => <div key={permission} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800"><CheckCircle2 className="h-3.5 w-3.5" />{permission}</div>)}</div>
            {employee?.permissions?.length ? <p className="mt-3 border-t border-neutral-100 pt-3 text-[10px] text-neutral-500">自定义权限 {employee.permissions.length} 项</p> : null}
          </div>
          {canManageEmployees && <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">新增员工</h2>
            <form onSubmit={event => void createTeamEmployee(event)} className="mt-3 grid grid-cols-2 gap-2">
              <input required maxLength={100} value={newEmployee.name} onChange={event => setNewEmployee(current => ({ ...current, name: event.target.value }))} placeholder="员工姓名" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
              <input required type="email" maxLength={200} value={newEmployee.email} onChange={event => setNewEmployee(current => ({ ...current, email: event.target.value }))} placeholder="企业邮箱" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
              <PasswordInput required minLength={8} maxLength={128} value={newEmployee.password} onChange={event => setNewEmployee(current => ({ ...current, password: event.target.value }))} placeholder="初始密码（至少 8 位）" className="w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-xs" />
              <select value={newEmployee.role} onChange={event => setNewEmployee(current => ({ ...current, role: event.target.value }))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="sales">销售</option><option value="warehouse">仓库</option><option value="production">生产</option><option value="pos_cashier">POS 收银</option><option value="knowledge_manager">知识库管理员（ModaUI）</option><option value="store_manager">店长</option></select>
              <button type="submit" disabled={creatingEmployee} className="col-span-2 rounded-lg bg-neutral-950 py-2.5 text-xs font-bold text-white disabled:opacity-50">{creatingEmployee ? '创建中…' : '创建员工并同步权限'}</button>
            </form>
          </div>}
          {canManageEmployees && <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">员工权限</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>员工单独授权</span><span>保存后生效</span></div>
            <div className="mt-3 space-y-3">{teamEmployees.map(member => {
              let permissions: string[] = [];
              try { permissions = JSON.parse(member.permissions || '[]') as string[]; } catch { permissions = []; }
              return <div key={member.id} className="rounded-xl border border-neutral-100 p-3">
                <div className="flex items-center justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{member.name}</strong><span className="text-[10px] text-neutral-500">{member.email} · {member.role}</span></div><button type="button" onClick={() => void setTeamEmployeeActive(member, !member.active)} className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${member.active ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{member.active ? '停用账号' : '重新启用'}</button></div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">{permissionOptions.map(([key, label]) => <label key={key} className="flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2 py-2 text-[10px] text-neutral-700"><input type="checkbox" checked={permissions.includes(key)} onChange={event => setTeamEmployees(current => current.map(item => item.id === member.id ? { ...item, permissions: JSON.stringify(event.target.checked ? [...permissions, key] : permissions.filter(permission => permission !== key)) } : item))} className="h-3.5 w-3.5 accent-neutral-900" />{label}</label>)}</div>
                <button type="button" onClick={async () => { let selected: string[] = []; try { selected = JSON.parse(teamEmployees.find(item => item.id === member.id)?.permissions || '[]') as string[]; } catch { selected = []; } try { await apiPatch(`/api/merchant/employees/${encodeURIComponent(member.id)}/permissions`, { permissions: selected }); addNotification('success', '权限已保存', `${member.name} 的权限已同步`); } catch (error) { addNotification('warning', '权限保存失败', error instanceof Error ? error.message : '请稍后重试'); } }} className="mt-2 w-full rounded-lg bg-neutral-900 py-2 text-[10px] font-bold text-white">保存 {member.name} 权限</button>
              </div>;
            })}</div>
          </div>}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">设备设置</h2>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 py-3"><div><span className="block text-xs font-semibold">新订单提示音</span><span className="text-[10px] text-neutral-500">有新订单时播放提示</span></div><button type="button" onClick={() => { const next = !soundEnabled; setSoundEnabled(next); localStorage.setItem('ruda-xs-order-sound', next ? 'on' : 'off'); if (next) void enableSound(); }} role="switch" aria-checked={soundEnabled} className={`relative h-6 w-11 rounded-full ${soundEnabled ? 'bg-emerald-600' : 'bg-neutral-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
            <div className="flex items-center justify-between border-t border-neutral-100 py-3"><div><span className="block text-xs font-semibold">数据同步状态</span><span className="text-[10px] text-neutral-500">订单、库存和工单使用实时接口</span></div><strong className={online ? 'text-xs text-emerald-600' : 'text-xs text-amber-600'}>{online ? '实时在线' : '离线草稿'}</strong></div>
            <button type="button" onClick={() => void refreshEmployeeData()} className="mt-2 w-full rounded-xl border border-neutral-200 py-2.5 text-xs font-bold">立即同步工作数据</button>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">账户操作</h2>
            <button type="button" onClick={() => logout()} className="mt-3 flex w-full items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-left text-xs font-bold text-rose-700"><span className="flex items-center gap-2"><LogOut className="h-4 w-4" />安全退出员工账户</span><ChevronRight className="h-4 w-4" /></button>
          </div>
        </section>}
      </main>
      {scannerOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-5"><div className="w-full max-w-sm rounded-2xl bg-white p-3"><div className="mb-2 flex items-center justify-between"><b className="text-sm">扫描条码 / QR</b><button type="button" onClick={closeScanner} className="text-xs font-bold">关闭</button></div><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover" /><p className="p-2 text-center text-[10px] text-neutral-500">对准条码自动识别</p></div></div>}
      <nav aria-label="员工工作导航" className="fixed inset-x-0 bottom-0 z-50 flex gap-1 overflow-x-auto border-t border-neutral-200 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {viewTabs.map(tab => <button key={tab.id} type="button" onClick={() => setView(tab.id)} className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold ${view === tab.id ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>{tab.label}</button>)}
      </nav>
    </div>
  );
};

import { getIntlLocale } from '../../i18n/translations';
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Package, 
  Boxes, 
  Layers,
  Truck, 
  Users, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  Check,
  XCircle, 
  AlertTriangle, 
  Search, 
  Plus, 
  Lock, 
  Unlock, 
  Eye, 
  ShieldCheck, 
  ArrowRightLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  LogOut,
  Home,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  X,
  Ellipsis,
  Globe,
  Loader2,
  Info,
  Pencil,
  Sparkles,
  Download,
  Printer,
  FileText,
  History,
  Wallet,
  Share2,
  Bell,
  Volume2,
  ContactRound,
  ShoppingCart,
  Receipt,
  WalletCards,
  Factory,
  Store,
  PanelsTopLeft,
  Settings,
  CircleHelp,
  ScanLine
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PasswordInput } from '../shared/components/common/PasswordInput';
import { useB2B } from '../../context/B2BContext';
import { useModuleAvailability } from '../shared/moduleAvailability';
import { LanguagePicker } from '../shared/components/common/LanguagePicker';
import { ProductImage } from '../shared/components/common/ProductImage';
import { OrderChatPanel } from '../shared/components/common/OrderChatPanel';
import { SmartMediaUploader } from '../merchant-admin-common/components/merchant/SmartMediaUploader';
import { MerchantMobileOrderWorkspace } from './MerchantMobileOrderWorkspace';
import { MerchantMobileProductCreateForm } from './MerchantMobileProductCreateForm';
import type { ContentKind } from '../merchant-admin-common/components/merchant/MerchantContentWorkspace';
import type { GrowthSection } from '../merchant-admin-common/components/merchant/MerchantGrowthWorkspace';
import {
  MerchantSettingsNote,
  MerchantSettingsScopeList,
  MerchantSettingsStatusChip
} from '../merchant-admin-common/components/merchant/MerchantSettingsPanel';
import { MerchantBusinessCard } from '../merchant-admin-common/components/merchant/MerchantBusinessCard';
import { MerchantMessageCenter } from '../merchant-admin-common/components/merchant/MerchantMessageCenter';
import { useMerchantNotifications } from '../merchant-admin-common/components/merchant/merchantNotifications';
import { MerchantStoreView } from '../shared/components/frontend/MerchantStoreView';
import { MERCHANT_STOREFRONT_TEMPLATES, type MerchantStorefrontTemplate } from '../../shared/merchantStorefrontTemplate';
import { ApiError, apiGet, apiPost, apiPut, apiRequest } from '../../api/client';
import { DEFAULT_MERCHANT_LOGO, merchantMediaUrl } from '../../utils/merchantMedia';
import { parseCsvRecords } from '../../utils/csv';
import { getProductZone, getProductZoneUpdates, type ProductZone } from '../../utils/productZone';
import { isLowStockProduct } from '../../shared/productInventory';
import {
  countMerchantProductQuickFilters,
  countMerchantProductZones,
  filterMerchantProducts,
  type MerchantProductQuickFilter,
  type MerchantProductZoneFilter
} from '../../shared/merchantProductBrowse';
import {
  buildMerchantProductSalesIndex,
  type MerchantProductSalesRecord,
  type MerchantProductSalesSummary
} from '../../shared/merchantProductSales';
import { PRODUCT_CATEGORIES, getProductCategoryLabel } from '../../constants/productCategories';
import {
  buildMerchantProduct,
  createMerchantProductDraft,
  validateMerchantProductDraft,
  type MerchantProductDraft
} from '../../shared/merchantProductCreation';
import { createMerchantProductFormPageContext, type MerchantCopilotPageContext } from '../../shared/merchantCopilotContext';
import { isMerchantMobileDefaultTab, isModaGptEntryRequest } from '../../shared/merchantMobileSettings';
import { merchantStorefrontOrigin, merchantStorefrontUrl } from '../../shared/merchantStoreUrl';
import { merchantMobileMoreGroups, merchantMobilePrimaryTabs, type MerchantMobileMoreItemId } from '../merchant-admin-common/components/merchant/merchantMobileNavigation';
import type { MerchantIndustryModuleKey } from '../../constants/merchantIndustryCapabilities';
import type { IndustryWorkspaceModuleProps } from '../merchant-admin-industries/shared/IndustryWorkspaceShell';
import {
  merchantMobileIndustrySectionByTab,
  merchantMobileTabByIndustrySection,
  shouldRenderIndustryWorkspaceForTab
} from '../merchant-admin-industries/shared/legacyNavigation';
import type { MerchantMobileWorkspaceTab } from '../../shared/portalDomains';
import type { CustomerLevel, Order, OrderAgreementTerms, Product, WholesaleCustomer } from '../../types/b2b';

const MerchantSmartPos = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantSmartPos').then(module => ({ default: module.MerchantSmartPos }))
);

const MerchantSupportChat = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantSupportChat').then(module => ({ default: module.MerchantSupportChat }))
);

const MerchantProcurementWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantProcurementWorkspace').then(module => ({ default: module.MerchantProcurementWorkspace }))
);

const MerchantContentWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantContentWorkspace').then(module => ({ default: module.MerchantContentWorkspace }))
);

const MerchantGrowthWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantGrowthWorkspace').then(module => ({ default: module.MerchantGrowthWorkspace }))
);

const ModaUIWorkbench = lazy(() =>
  import('../merchant-admin-common/components/merchant/modaui/ModaUIWorkbench').then(module => ({ default: module.ModaUIWorkbench }))
);

const MerchantAiEmployees = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantAiEmployees').then(module => ({ default: module.MerchantAiEmployees }))
);
const MerchantAiTools = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantAiTools').then(module => ({ default: module.MerchantAiTools }))
);
const MerchantAppStore = lazy(() =>
  import('../merchant-admin-common/components/merchant/AppStore').then(module => ({ default: module.AppStore }))
);
const MerchantEmailDomains = lazy(() =>
  import('../merchant-admin-common/components/merchant/EmailApp').then(module => ({ default: module.EmailApp }))
);
const MerchantProductionChain = lazy(() =>
  import('../merchant-admin-common/components/merchant/ProductionChain').then(module => ({ default: module.ProductionChain }))
);

const orderStateLabel = (order: Order) => {
  if (order.status === 'draft') return '草稿';
  if (order.orderNo.startsWith('POS-') && order.paymentStatus === 'paid') return '已完成';
  if (order.refundStatus === 'requested') return '退货待处理';
  if (order.status === 'delivered') return order.paymentStatus === 'paid' ? '已完成' : '已送达·待结款';
  if (order.status === 'shipped') return '运输中';
  if (order.status === 'picking') return '备货中';
  if (order.status === 'confirmed') return '处理中';
  if (order.status === 'cancelled') return '已取消';
  if (order.status === 'returned') return '已退货';
  if (order.currentTasks?.merchant.label) return order.currentTasks.merchant.label;
  return '待确认';
};

const paymentLabel = (order: Order) => {
  if (order.paymentStatus === 'paid') return '已付';
  if (Number(order.paidAmount || 0) > 0) return '部分';
  return '未付';
};

interface MerchantMobileAppProps {
  onSwitchToDesktop?: () => void;
  initialTab?: MerchantMobileWorkspaceTab;
  industryWorkspace?: React.ElementType<IndustryWorkspaceModuleProps>;
}

interface MerchantInventoryBalance {
  id: string;
  sku: string;
  product: { id: string; styleNo: string; name: string };
  location: { code: string; name: string };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  inTransitQuantity: number;
  updatedAt: string;
}

interface MerchantShipment {
  id: string;
  shipmentNo: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  status: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

interface MerchantOrderTrackingShipment {
  id: string;
  shipmentNo: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  status: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  trackingEvents: Array<{
    id: string;
    status: string;
    location?: string | null;
    description?: string | null;
    occurredAt: string;
  }>;
}

interface MobileMaterial {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  reorderPoint: number;
  leadTimeDays: number;
  status: string;
  unitLocked: boolean;
  notes?: string | null;
  onHandQuantity: number;
  availableQuantity: number;
}

interface MobileWorkOrder {
  id: string;
  workOrderNo: string;
  plannedQuantity: number;
  completedQuantity: number;
  rejectedQuantity: number;
  status: string;
  priority: string;
  dueDate?: string | null;
  product: { styleNo: string; name: string };
  variant: { sku: string; color?: string | null; size?: string | null };
  outputLocation: { code: string; name: string };
}

interface MobileBankAccount {
  id: string;
  accountHolder: string;
  iban: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string | null;
}

interface MobileMerchantProfile {
  name: string;
  companyLegalName: string;
  vatNumber: string;
  country: string;
  city: string;
  showroomAddress: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

interface MobileEmployee {
  id: string;
  name: string;
  email: string;
  role: 'sales' | 'warehouse' | 'production' | 'pos_cashier' | 'knowledge_manager' | 'store_manager';
  permissions?: string;
  active: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface MobileEmployeeAudit {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
}

interface MobileOperationsIntelligence {
  generatedAt?: string;
  summary: {
    gmv30d: number;
    orders30d: number;
    pendingFulfillment: number;
    pendingReturns: number;
    lowStockSkus: number;
    slowMoverSkus?: number;
    gmvTrend?: number;
    recentGmv?: number;
    previousGmv?: number;
  };
  replenishment: Array<{ productId?: string; variantId?: string; styleNo: string; name?: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null; suggestedQuantity: number }>;
  slowMovers?: Array<{ variantId: string; styleNo: string; name: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null }>;
  alerts: Array<{ severity: 'critical' | 'warning' | 'info'; type: string; message: string }>;
}

interface MobileFinanceSummary {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  totalRefunds: number;
  commissionRate: string;
  paymentFeeRate: string;
}

interface MobilePayout {
  id: string;
  period: string;
  grossSales: number;
  platformFeeAmount: number;
  paymentProcessingFee: number;
  refunds: number;
  netPayout: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  bankAccount: string;
  merchantAcknowledgedAt?: string | null;
  settlementReference?: string | null;
  settlementProof?: string | null;
  settledAt?: string | null;
  settledBy?: string | null;
}

export const MerchantMobileApp: React.FC<MerchantMobileAppProps> = ({ onSwitchToDesktop, initialTab, industryWorkspace: IndustryWorkspace }) => {
  const { 
    merchants,
    selectedMerchantId,
    logout,
    products,
    addProduct,
    updateProduct,
    orders,
    merchantFulfillOrder,
    syncOrderFromServer,
    approveReturn,
    rejectReturn,
    vaultRequests,
    approveVaultAccess,
    rejectVaultAccess,
    allCustomers,
    addNotification,
    replaceOrderFromServer,
    replaceMerchantProductsFromServer,
    updateMerchant,
    localizeCopy,
    lang,
  } = useB2B();
  // 平台全局 ModaUI 总闸：关闭时隐藏 ai_home 标签并显示统一提示。
  const { modauiEnabled } = useModuleAvailability();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'store' | 'profile' | 'ai_home' | 'pos' | 'finance' | 'growth' | 'production' | 'procurement' | 'content' | 'more' | 'ai_employees' | 'ai_tools' | 'support'>(() =>
    initialTab || (isModaGptEntryRequest(window.location.search) ? 'ai_home' : 'dashboard')
  );
  const [industrySection, setIndustrySection] = useState<MerchantIndustryModuleKey>('dashboard');
  const pendingIndustrySectionRef = React.useRef<MerchantIndustryModuleKey | null>(null);
  const industryPanelActive = Boolean(
    IndustryWorkspace && shouldRenderIndustryWorkspaceForTab(activeTab, industrySection, merchantMobileIndustrySectionByTab)
  );
  useEffect(() => {
    if (!IndustryWorkspace) return;
    const pendingSection = pendingIndustrySectionRef.current;
    if (pendingSection) {
      pendingIndustrySectionRef.current = null;
      setIndustrySection(pendingSection);
      return;
    }
    const section = merchantMobileIndustrySectionByTab[activeTab];
    if (section) setIndustrySection(section);
  }, [activeTab, IndustryWorkspace]);
  const [returnToMore, setReturnToMore] = useState(false);
  const [moreReturnTitle, setMoreReturnTitle] = useState('');
  const [showMerchantStoreQr, setShowMerchantStoreQr] = useState(false);
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const [visualViewportInset, setVisualViewportInset] = useState(0);
  const {
    notifications: merchantNotifications,
    unread: merchantUnreadNotifications,
    error: merchantNotificationsError,
    loading: merchantNotificationsLoading,
    reload: reloadMerchantNotifications,
    markRead: markMerchantNotificationRead
  } = useMerchantNotifications({ enabled: activeTab === 'dashboard' || messageCenterOpen, scopeKey: selectedMerchantId ?? undefined });
  const copilotOriginTabRef = React.useRef<'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'store' | 'profile' | 'pos' | 'finance' | 'growth' | 'production' | 'procurement' | 'content'>('dashboard');
  const [mobileContentSection, setMobileContentSection] = useState<ContentKind>('metaobject');
  const [mobileGrowthSection, setMobileGrowthSection] = useState<GrowthSection>('overview');
  useEffect(() => {
    if (activeTab !== 'ai_home' && activeTab !== 'more' && activeTab !== 'ai_employees' && activeTab !== 'ai_tools' && activeTab !== 'support') {
      copilotOriginTabRef.current = activeTab;
    }
  }, [activeTab]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewportInset = () => {
      setVisualViewportInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    };
    updateViewportInset();
    viewport.addEventListener('resize', updateViewportInset);
    viewport.addEventListener('scroll', updateViewportInset);
    return () => {
      viewport.removeEventListener('resize', updateViewportInset);
      viewport.removeEventListener('scroll', updateViewportInset);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [productQuickFilter, setProductQuickFilter] = useState<MerchantProductQuickFilter>('all');
  const [productSalesSummary, setProductSalesSummary] = useState<MerchantProductSalesSummary | null>(null);
  const [productSalesLoading, setProductSalesLoading] = useState(false);
  const [productSalesError, setProductSalesError] = useState<string | null>(null);
  const [productZoneFilter, setProductZoneFilter] = useState<MerchantProductZoneFilter>('new');
  const [productCategory, setProductCategory] = useState('all');
  const [productSort, setProductSort] = useState<'updated' | 'stock' | 'price'>('updated');
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [productSelectionMode, setProductSelectionMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productEditUnlocked, setProductEditUnlocked] = useState(false);
  const [productEditPermissionLoaded, setProductEditPermissionLoaded] = useState(false);
  const [canManageProductEditPermission, setCanManageProductEditPermission] = useState(false);
  const [productEditPermissionBusy, setProductEditPermissionBusy] = useState(false);
  const [productDraft, setProductDraft] = useState<Partial<Product> | null>(null);
  const [creatingProductDraft, setCreatingProductDraft] = useState<MerchantProductDraft | null>(null);
  const [creatingProductMode, setCreatingProductMode] = useState<'quick' | 'full'>('quick');
  const [canManageProductCosts, setCanManageProductCosts] = useState(false);
  const [productDraftBusy, setProductDraftBusy] = useState(false);
  const [productMediaBusy, setProductMediaBusy] = useState(false);
  const [creatingProductBusy, setCreatingProductBusy] = useState(false);
  const [creatingProductDefaultsBusy, setCreatingProductDefaultsBusy] = useState(false);
  const [productSmartBusy, setProductSmartBusy] = useState(false);
  const [productSmartAdvice, setProductSmartAdvice] = useState<string[]>([]);
  const [posReturnTab, setPosReturnTab] = useState<'dashboard' | 'orders'>('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormBusy, setProductFormBusy] = useState(false);
  const [productForm, setProductForm] = useState({
    styleNo: '',
    name: '',
    category: 'Abbigliamento 服装',
    subCategory: '',
    brand: '',
    season: '2026/27 FW',
    wholesalePrice: '',
    rrpPrice: '',
    costPrice: '',
    moq: '6',
    packSize: '6',
    fabric: '',
    origin: 'Made in Italy',
    description: '',
    status: 'new' as Product['status'],
    inventoryStatus: 'in_stock' as Product['inventoryStatus'],
    visibility: 'public' as Product['visibility'],
    lifecycleStatus: 'draft' as Product['lifecycleStatus'],
    defaultColor: 'Nero 黑',
    defaultSize: 'M',
    defaultStock: '30'
  });
  const [productBusyId, setProductBusyId] = useState<string | null>(null);
  const [selectedOrderToFulfill, setSelectedOrderToFulfill] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [orderEditUnlocked, setOrderEditUnlocked] = useState(false);
  const [orderEditDraft, setOrderEditDraft] = useState<Order | null>(null);
  const [orderEditTerms, setOrderEditTerms] = useState<OrderAgreementTerms | null>(null);
  const [orderEditPrepaymentMode, setOrderEditPrepaymentMode] = useState<'amount' | 'percent'>('amount');
  const [orderEditPrepaymentValue, setOrderEditPrepaymentValue] = useState('0');
  const [orderEditBusy, setOrderEditBusy] = useState(false);
  const [orderDocumentBusy, setOrderDocumentBusy] = useState(false);
  const [carrier, setCarrier] = useState('DHL Express');
  const [trackingNo, setTrackingNo] = useState('');
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);
  const [shipments, setShipments] = useState<MerchantShipment[]>([]);
  const [orderTrackingShipments, setOrderTrackingShipments] = useState<MerchantOrderTrackingShipment[]>([]);
  const [orderTrackingLoading, setOrderTrackingLoading] = useState(false);
  const [shipmentQuantities, setShipmentQuantities] = useState<Record<string, number>>({});
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [inventoryBalances, setInventoryBalances] = useState<MerchantInventoryBalance[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryRefreshNonce, setInventoryRefreshNonce] = useState(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | CustomerLevel>('all');
  const [customerSort, setCustomerSort] = useState<'latest' | 'value' | 'orders' | 'risk'>('latest');
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [mobileCustomers, setMobileCustomers] = useState<WholesaleCustomer[]>([]);
  const [showCustomerActions, setShowCustomerActions] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerFormBusy, setCustomerFormBusy] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    companyName: '', contactPerson: '', email: '', vatNumber: '', address: '',
    city: '', country: 'Italy', phone: '', businessType: 'Boutique', customerLevel: 'new_customer' as CustomerLevel, notes: ''
  });
  const [mobileSettings, setMobileSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ruda-merchant-mobile-settings') || '{"alerts":true,"compact":false,"sound":true}') as { alerts: boolean; compact: boolean; sound: boolean };
    } catch {
      return { alerts: true, compact: false, sound: true };
    }
  });
  const [merchantSettings, setMerchantSettings] = useState({
    name: '', companyLegalName: '', vatNumber: '', country: '', city: '', showroomAddress: '',
    contactPerson: '', contactPhone: '', contactEmail: '', moq: 6, defaultPaymentTerm: 'prepaid',
    shippingNote: '', notifyOrders: true, notifyPayouts: true, notifyVault: true, notifyMarketing: false,
    mobileDefaultTab: 'dashboard', mobileLanguage: 'auto'
  });
  const [merchantSettingsBusy, setMerchantSettingsBusy] = useState(false);
  const [storefrontPolicies, setStorefrontPolicies] = useState({ shipping: '', returns: '', returnAddress: '' });
  const [storefrontPoliciesBusy, setStorefrontPoliciesBusy] = useState(false);
  const [storefrontTemplate, setStorefrontTemplate] = useState<MerchantStorefrontTemplate>('fashion_monochrome');
  const [storefrontTemplateBusy, setStorefrontTemplateBusy] = useState(false);
  const [lastSettingsSync, setLastSettingsSync] = useState<Date | null>(null);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState('');
  const [settingsSyncNonce, setSettingsSyncNonce] = useState(0);
  const [settingsSection, setSettingsSection] = useState<'operations' | 'store' | 'finance' | 'team' | 'apps' | null>(null);
  const [activeStoreAppId, setActiveStoreAppId] = useState<string | null>(null);
  const [merchantProfileUnlocked, setMerchantProfileUnlocked] = useState(false);
  const [merchantProfileLoaded, setMerchantProfileLoaded] = useState(false);
  const [smartCardBusy, setSmartCardBusy] = useState(false);
  const [teamEmployees, setTeamEmployees] = useState<MobileEmployee[]>([]);
  const [teamAudit, setTeamAudit] = useState<MobileEmployeeAudit[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [teamBusyId, setTeamBusyId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', password: '', role: 'sales' as MobileEmployee['role'] });
  const [employeeCreateBusy, setEmployeeCreateBusy] = useState(false);
  const [bankAccountForm, setBankAccountForm] = useState({ accountHolder: '', iban: '' });
  const [bankAccountBusy, setBankAccountBusy] = useState(false);
  useEffect(() => {
    setProductEditPermissionLoaded(false);
    setCanManageProductEditPermission(false);
    setProductEditUnlocked(false);
    void apiGet<{
      success: true;
      settings: Partial<typeof merchantSettings> & { mobileAlerts?: boolean; mobileCompact?: boolean; productEditingEnabled?: boolean };
      updatedAt?: string | null;
      canManageProductEditing: boolean;
      merchant: MobileMerchantProfile | null
    }>('/api/merchant/settings')
      .then(result => {
        setSettingsUpdatedAt(String(result.updatedAt || ''));
        const next = { alerts: result.settings.mobileAlerts ?? true, compact: result.settings.mobileCompact ?? false, sound: mobileSettings.sound ?? true };
        setMobileSettings(next);
        localStorage.setItem('ruda-merchant-mobile-settings', JSON.stringify(next));
        setProductEditUnlocked(result.settings.productEditingEnabled === true);
        setCanManageProductEditPermission(result.canManageProductEditing);
        setProductEditPermissionLoaded(true);
        setMerchantSettings(previous => ({
          ...previous,
          ...result.settings,
          name: result.merchant?.name ?? currentMerchant?.name ?? previous.name,
          companyLegalName: result.merchant?.companyLegalName ?? currentMerchant?.companyLegalName ?? previous.companyLegalName,
          vatNumber: result.merchant?.vatNumber ?? currentMerchant?.vatNumber ?? previous.vatNumber,
          country: result.merchant?.country ?? currentMerchant?.country ?? previous.country,
          city: result.merchant?.city ?? currentMerchant?.city ?? previous.city,
          showroomAddress: result.merchant?.showroomAddress ?? currentMerchant?.showroomAddress ?? previous.showroomAddress,
          contactPerson: result.merchant?.contactPerson ?? currentMerchant?.contactPerson ?? previous.contactPerson,
          contactPhone: result.merchant?.contactPhone ?? currentMerchant?.contactPhone ?? previous.contactPhone,
          contactEmail: result.merchant?.contactEmail ?? currentMerchant?.contactEmail ?? previous.contactEmail
        }));
        setLastSettingsSync(new Date());
        setMerchantProfileLoaded(true);
        if (!initialTab && !isModaGptEntryRequest(window.location.search) && isMerchantMobileDefaultTab(result.settings.mobileDefaultTab)) {
          setActiveTab(result.settings.mobileDefaultTab);
        }
      })
      .catch(error => addNotification('warning', '设置加载失败', error instanceof Error ? error.message : '请检查网络后重试'));
  }, [selectedMerchantId, addNotification, settingsSyncNonce]);

  const [factoryMaterials, setFactoryMaterials] = useState<MobileMaterial[]>([]);
  const [showMaterialManager, setShowMaterialManager] = useState(false);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialUnitLocked, setEditingMaterialUnitLocked] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    code: '', name: '', category: 'fabric', unit: 'meter', unitCost: '0',
    reorderPoint: '0', leadTimeDays: '0', status: 'active', notes: ''
  });
  const [materialInbound, setMaterialInbound] = useState({ materialId: '', quantity: '', note: '' });
  const [factoryWorkOrders, setFactoryWorkOrders] = useState<MobileWorkOrder[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(false);
  const [factoryBusyId, setFactoryBusyId] = useState<string | null>(null);
  const [reportingWorkOrder, setReportingWorkOrder] = useState<MobileWorkOrder | null>(null);
  const [reportForm, setReportForm] = useState({ goodQuantity: '', rejectedQuantity: '0', note: '' });
  const [reportBusy, setReportBusy] = useState(false);
  const [mobileBankAccounts, setMobileBankAccounts] = useState<MobileBankAccount[]>([]);
  const [operationsIntelligence, setOperationsIntelligence] = useState<MobileOperationsIntelligence | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [financeSummary, setFinanceSummary] = useState<MobileFinanceSummary | null>(null);
  const [financePayouts, setFinancePayouts] = useState<MobilePayout[]>([]);
  const [financeBusyId, setFinanceBusyId] = useState<string | null>(null);

  const currentMerchantId = selectedMerchantId || 'mch-prato';
  const currentMerchant = merchants.find(m => m.id === currentMerchantId) || merchants[0];

  // 「已售出」入口使用真实成交明细汇总；每次进入商品页重新读取，避免展示过期数字。
  const loadProductSalesSummary = async () => {
    setProductSalesLoading(true);
    setProductSalesError(null);
    try {
      const result = await apiGet<{
        success: true;
        count: number;
        totalSoldUnits: number;
        products: MerchantProductSalesRecord[];
      }>('/api/merchant/products/sales-summary');
      setProductSalesSummary({ products: result.products, totalSoldUnits: result.totalSoldUnits });
    } catch (error) {
      setProductSalesSummary(null);
      setProductSalesError(error instanceof Error ? error.message : '读取失败');
      addNotification('warning', '已售出数据读取失败', error instanceof Error ? error.message : '请检查网络后重试');
    } finally {
      setProductSalesLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab !== 'products') return;
    void loadProductSalesSummary();
    // 只在进入商品页或切换商家时重新统计一次，依赖真实权限范围内的订单数据。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentMerchantId]);
  useEffect(() => {
    setStorefrontPolicies({
      shipping: currentMerchant?.storefrontShippingPolicy || '',
      returns: currentMerchant?.storefrontReturnsPolicy || '',
      returnAddress: currentMerchant?.storefrontReturnAddress || ''
    });
    setStorefrontTemplate(currentMerchant?.storefrontTemplate || 'fashion_monochrome');
  }, [currentMerchant?.id, currentMerchant?.storefrontShippingPolicy, currentMerchant?.storefrontReturnsPolicy, currentMerchant?.storefrontReturnAddress, currentMerchant?.storefrontTemplate]);
  useEffect(() => {
    let active = true;
    setCanManageProductCosts(false);
    void apiGet<{ success: true; canManageCosts?: boolean }>('/api/merchant/products')
      .then(result => { if (active) setCanManageProductCosts(result.canManageCosts === true); })
      .catch(error => console.error('[merchant-mobile-cost-permission]', error));
    return () => { active = false; };
  }, [currentMerchantId]);
  const mobileItalian = lang === 'it';
  const mobileText = (zh: string, it: string) => localizeCopy(zh, it);
  // 首页「网站」直接打开商家实际对外展示的店铺：使用数据库已分配并绑定的店铺二级域名（storeSlug），
  // 不拼接任何模拟域名；仅在未分配时才退回应用内店铺视图。
  const merchantStoreHref = currentMerchant?.storeSlug
    ? merchantStorefrontUrl(currentMerchant.storeSlug, mobileItalian ? 'it' : 'zh')
    : null;
  const openMoreItem = (itemId: MerchantMobileMoreItemId) => {
    const item = merchantMobileMoreGroups.flatMap(group => [...group.items] as Array<{ id: MerchantMobileMoreItemId; zh: string; it: string }>).find(entry => entry.id === itemId);
    setReturnToMore(itemId !== 'privacy');
    setMoreReturnTitle(item ? mobileText(item.zh, item.it) : mobileText('更多', 'Altro'));
    setSettingsSection(null);
    switch (itemId) {
      case 'counterparties':
      case 'vault':
        setActiveTab('customers');
        break;
      case 'materials':
        setShowMaterialManager(true);
        setActiveTab('dashboard');
        break;
      case 'procurement':
        setActiveTab('procurement');
        break;
      case 'production':
        setActiveTab('production');
        break;
      case 'inventory':
        setActiveTab('inventory');
        break;
      case 'finance':
        setActiveTab('finance');
        break;
      case 'growth':
        setMobileGrowthSection('overview');
        setActiveTab('growth');
        break;
      case 'store':
      case 'domains':
        setActiveTab('store');
        break;
      case 'site_content':
        setMobileContentSection('page');
        setActiveTab('content');
        break;
      case 'media':
        setMobileContentSection('metaobject');
        setActiveTab('content');
        break;
      case 'ai_employees':
        setActiveTab('ai_employees');
        break;
      case 'ai_tools':
        setActiveTab('ai_tools');
        break;
      case 'team':
        setSettingsSection('team');
        setActiveTab('profile');
        break;
      case 'notifications':
        setMessageCenterOpen(true);
        break;
      case 'app_store':
        setSettingsSection('apps');
        setActiveTab('profile');
        break;
      case 'settings':
        setSettingsSection(null);
        setActiveTab('profile');
        break;
      case 'support':
        setActiveTab('support');
        break;
      case 'privacy':
        setReturnToMore(false);
        window.location.assign('/about#privacy');
        break;
    }
  };
  const navigateIndustrySection = (section: MerchantIndustryModuleKey) => {
    const targetTab = merchantMobileTabByIndustrySection[section];
    setIndustrySection(section);
    pendingIndustrySectionRef.current = targetTab === activeTab ? null : section;
    switch (targetTab) {
      case 'dashboard':
        setReturnToMore(false);
        setMoreReturnTitle('');
        setActiveTab('dashboard');
        break;
      case 'products':
        setReturnToMore(false);
        setMoreReturnTitle('');
        setActiveTab('products');
        break;
      case 'orders':
        setReturnToMore(false);
        setMoreReturnTitle('');
        setActiveTab('orders');
        break;
      case 'inventory':
        openMoreItem('inventory');
        break;
      case 'customers':
        openMoreItem('counterparties');
        break;
      case 'procurement':
        openMoreItem('procurement');
        break;
      case 'pos':
        setPosReturnTab('dashboard');
        setActiveTab('pos');
        break;
      case 'profile':
        openMoreItem(section === 'team' ? 'team' : 'settings');
        break;
    }
  };
  const returnFromMoreChild = () => {
    setShowMaterialManager(false);
    setSettingsSection(null);
    setReturnToMore(false);
    setMoreReturnTitle('');
    setActiveTab('more');
  };
  const merchantProfileValue = (key: keyof MobileMerchantProfile) => merchantProfileLoaded
    ? merchantSettings[key]
    : merchantSettings[key] || currentMerchant?.[key] || '';

  // 严格商户数据隔离
  const merchantProducts = products.filter(p => p.merchantId === currentMerchantId);
  const merchantProductIds = new Set(merchantProducts.map(p => p.id));
  const merchantOrders = orders.flatMap(order => {
    if (order.merchantId === currentMerchantId) return [order];
    if (order.subOrders?.length) {
      return order.subOrders.filter(subOrder => subOrder.merchantId === currentMerchantId);
    }

    const merchantItems = order.items.filter(item => merchantProductIds.has(item.productId));
    if (merchantItems.length === 0) return [];

    return [{
      ...order,
      items: merchantItems,
      totalQty: merchantItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: Number(merchantItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
      merchantId: currentMerchantId,
      merchantName: currentMerchant?.name || 'RUDA Merchant'
    }];
  });
  const merchantVaultRequests = vaultRequests.filter(vr => vr.merchantId === currentMerchantId);
  const merchantCustomerIds = new Set([
    ...merchantOrders.map(order => order.customerId),
    ...merchantVaultRequests.map(request => request.customerId)
  ]);
  const merchantCustomers = [...allCustomers.filter(customer => merchantCustomerIds.has(customer.id)), ...mobileCustomers]
    .filter((customer, index, customers) => customers.findIndex(item => item.id === customer.id) === index);
  const customerMetrics = merchantCustomers.map(customer => {
    const customerOrders = merchantOrders.filter(order => order.customerId === customer.id);
    const orderValue = customerOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const lastOrder = customerOrders
      .slice()
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))[0];
    const creditUsed = Number(customer.usedCredit || 0);
    const creditLimit = Number(customer.creditLimit || 0);
    return {
      customer,
      orders: customerOrders,
      orderValue,
      lastOrder,
      creditUsed,
      creditLimit,
      creditRatio: creditLimit > 0 ? creditUsed / creditLimit : 0,
      vaultRequest: merchantVaultRequests.find(request => request.customerId === customer.id)
    };
  });
  const filteredMerchantCustomers = customerMetrics.filter(({ customer, creditRatio }) => {
    const query = customerQuery.trim().toLowerCase();
    const matchesQuery = !query || `${customer.companyName} ${customer.contactPerson} ${customer.email} ${customer.phone} ${customer.city} ${customer.vatNumber}`.toLowerCase().includes(query);
    const matchesFilter = customerFilter === 'all'
      || (customer.customerLevel || 'new_customer') === customerFilter;
    return matchesQuery && matchesFilter;
  }).sort((left, right) => {
    if (customerSort === 'orders') return right.orders.length - left.orders.length;
    if (customerSort === 'risk') return right.creditRatio - left.creditRatio;
    if (customerSort === 'latest') return String(right.lastOrder?.date || '').localeCompare(String(left.lastOrder?.date || ''));
    return right.orderValue - left.orderValue;
  });
  const goodCustomerCount = merchantCustomers.filter(customer => customer.customerLevel === 'good_customer').length;
  const overdueCustomerCount = merchantCustomers.filter(customer => customer.customerLevel === 'overdue_customer').length;
  const customerRevenue = filteredMerchantCustomers.reduce((sum, metric) => sum + metric.orderValue, 0);
  const customerLevelLabel: Record<CustomerLevel, string> = {
    good_customer: '好客户',
    regular_customer: '熟客户',
    new_customer: '新客户',
    standard_customer: '普通客户',
    overdue_customer: '欠钱客户'
  };

  const createMobileCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (customerFormBusy) return;
    setCustomerFormBusy(true);
    try {
      const result = await apiPost<{ success: true; customer: WholesaleCustomer }>('/api/merchant/customers', customerForm);
      setMobileCustomers(previous => [result.customer, ...previous.filter(customer => customer.id !== result.customer.id)]);
      setCustomerForm({ companyName: '', contactPerson: '', email: '', vatNumber: '', address: '', city: '', country: 'Italy', phone: '', businessType: 'Boutique', customerLevel: 'new_customer', notes: '' });
      setShowCustomerForm(false);
      addNotification('success', '客户已加入档案', `${result.customer.companyName} 已建立商家客户关系，等待平台认证`);
    } catch (error) {
      addNotification('warning', '客户添加失败', error instanceof Error ? error.message : '请检查客户资料');
    } finally {
      setCustomerFormBusy(false);
    }
  };

  const importMobileCustomers = async (file: File) => {
    try {
      const records = parseCsvRecords(await file.text()).filter(record => record.some(value => value.trim() !== ''));
      if (records.length < 2) throw new Error('CSV_FILE_EMPTY');
      const headers = records[0].map(value => value.trim().toLowerCase());
      const aliases: Record<string, string> = { company: 'companyName', companyname: 'companyName', contact: 'contactPerson', contactperson: 'contactPerson', email: 'email', vat: 'vatNumber', vatnumber: 'vatNumber', address: 'address', city: 'city', country: 'country', phone: 'phone', businesstype: 'businessType', type: 'businessType' };
      const imported: WholesaleCustomer[] = [];
      let failed = 0;
      for (const values of records.slice(1, 201)) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => { const field = aliases[header]; if (field) row[field] = (values[index] || '').trim(); });
        try {
          if (!row.companyName || !row.email) throw new Error('CSV_CUSTOMER_REQUIRED_FIELDS');
          const result = await apiPost<{ success: true; customer: WholesaleCustomer }>('/api/merchant/customers', {
            companyName: row.companyName, contactPerson: row.contactPerson, email: row.email, vatNumber: row.vatNumber,
            address: row.address, city: row.city, country: row.country || 'Italy', phone: row.phone,
            businessType: row.businessType || 'Boutique', notes: 'Imported from CSV'
          });
          imported.push(result.customer);
        } catch { failed += 1; }
      }
      setMobileCustomers(previous => [...imported, ...previous.filter(customer => !imported.some(item => item.id === customer.id))]);
      addNotification(imported.length ? 'success' : 'warning', '客户导入完成', `成功 ${imported.length} 条，失败 ${failed} 条；失败记录请修正后重新导入`);
    } catch (error) {
      addNotification('warning', '客户导入失败', error instanceof Error && error.message === 'CSV_FILE_EMPTY'
        ? 'CSV 文件没有可导入记录'
        : error instanceof Error && error.message === 'CSV_UNCLOSED_QUOTE'
          ? 'CSV 引号未闭合，请修正文件后重新导入'
          : '请使用包含表头且格式正确的 CSV 文件');
    }
  };

  const openCustomerEditor = (customer: WholesaleCustomer) => {
    setCustomerForm({
      companyName: customer.companyName, contactPerson: customer.contactPerson, email: customer.email,
      vatNumber: customer.vatNumber, address: customer.address, city: customer.city, country: customer.country,
      phone: customer.phone, businessType: customer.businessType, customerLevel: customer.customerLevel || 'new_customer', notes: ''
    });
    setEditingCustomerId(customer.id);
    setSelectedCustomer(null);
    setShowCustomerForm(true);
  };

  const saveMobileCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCustomerId || customerFormBusy) return;
    setCustomerFormBusy(true);
    try {
      const result = await apiPut<{ success: true; customer: WholesaleCustomer }>(`/api/merchant/customers/${encodeURIComponent(editingCustomerId)}`, customerForm);
      setMobileCustomers(previous => [result.customer, ...previous.filter(customer => customer.id !== result.customer.id)]);
      setShowCustomerForm(false);
      setEditingCustomerId(null);
      addNotification('success', '客户资料已更新', `${result.customer.companyName} 的资料已同步到商家端和 App`);
    } catch (error) {
      addNotification('warning', '客户资料更新失败', error instanceof Error ? error.message : '请检查资料后重试');
    } finally {
      setCustomerFormBusy(false);
    }
  };

  const updateMobileSetting = async (key: 'alerts' | 'compact' | 'sound', value: boolean) => {
    const next = { ...mobileSettings, [key]: value };
    setMobileSettings(next);
    localStorage.setItem('ruda-merchant-mobile-settings', JSON.stringify(next));
    if (key === 'sound') return;
    try {
      const result = await apiPut<{ success: true; updatedAt?: string | null }>('/api/merchant/settings', {
        ...merchantSettings,
        mobileAlerts: next.alerts,
        mobileCompact: next.compact,
        expectedUpdatedAt: settingsUpdatedAt || undefined
      });
      setSettingsUpdatedAt(String(result.updatedAt || ''));
      addNotification('success', '手机设置已保存', key === 'alerts' ? (value ? '已开启运营提醒' : '已关闭运营提醒') : (value ? '已开启紧凑显示' : '已关闭紧凑显示'));
    } catch (error) {
      setMobileSettings(previous => ({ ...previous, [key]: !value }));
      localStorage.setItem('ruda-merchant-mobile-settings', JSON.stringify({ ...mobileSettings, [key]: !value }));
      if (error instanceof ApiError && error.code === 'MERCHANT_SETTINGS_CONFLICT') {
        setSettingsSyncNonce(previous => previous + 1);
        addNotification('warning', '设置已在其他端更新', '已加载最新设置，请重新操作。');
        return;
      }
      addNotification('warning', '手机设置保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  const saveMerchantSettings = async () => {
    if (merchantSettingsBusy) return;
    if (!merchantSettings.name.trim() || !merchantSettings.companyLegalName.trim() || !merchantSettings.contactEmail.includes('@')) {
      addNotification('warning', '资料校验失败', '请填写店铺名称、法定主体和有效邮箱');
      return;
    }
    setMerchantSettingsBusy(true);
    try {
      const result = await apiPut<{ success: true; settings: typeof merchantSettings; updatedAt?: string | null; merchant: MobileMerchantProfile }>('/api/merchant/settings', {
        ...merchantSettings,
        mobileAlerts: mobileSettings.alerts,
        mobileCompact: mobileSettings.compact,
        expectedUpdatedAt: settingsUpdatedAt || undefined
      });
      setSettingsUpdatedAt(String(result.updatedAt || ''));
      setMerchantSettings(previous => ({ ...previous, ...result.settings, ...result.merchant }));
      setMerchantProfileLoaded(true);
      addNotification('success', '商家设置已保存', '手机端和 Web 端已同步');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MERCHANT_SETTINGS_CONFLICT') {
        setSettingsSyncNonce(previous => previous + 1);
        addNotification('warning', '设置已在其他端更新', '已加载最新设置，请确认后重新保存。');
        return;
      }
      addNotification('warning', '商家设置保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setMerchantSettingsBusy(false);
    }
  };
  const saveStorefrontPolicies = async () => {
    if (!currentMerchant || storefrontPoliciesBusy) return;
    setStorefrontPoliciesBusy(true);
    try {
      const result = await apiPut<{ success: true; merchant: typeof currentMerchant }>('/api/merchant/storefront', {
        storefrontShippingPolicy: storefrontPolicies.shipping,
        storefrontReturnsPolicy: storefrontPolicies.returns,
        storefrontReturnAddress: storefrontPolicies.returnAddress
      });
      await updateMerchant(currentMerchant.id, result.merchant);
      addNotification('success', '网店政策已发布', '配送与退换货说明已同步到公开店铺');
    } catch (error) {
      addNotification('warning', '网店政策保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setStorefrontPoliciesBusy(false);
    }
  };
  const applyStorefrontTemplate = async () => {
    if (!currentMerchant || storefrontTemplateBusy) return;
    setStorefrontTemplateBusy(true);
    try {
      const result = await apiPut<{ success: true; merchant: typeof currentMerchant }>('/api/merchant/storefront', {
        storefrontTemplate
      });
      await updateMerchant(currentMerchant.id, result.merchant);
      addNotification('success', '网站模板已应用', '公开网站、手机端和小程序已同步切换');
    } catch (error) {
      addNotification('warning', '网站模板应用失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setStorefrontTemplateBusy(false);
    }
  };
  const smartCardText = () => [
    `BEGIN:VCARD`, `VERSION:3.0`,
    `FN:${merchantProfileValue('name') || 'RUDA Merchant'}`,
    `ORG:${merchantProfileValue('companyLegalName')}`,
    `TEL:${merchantProfileValue('contactPhone')}`,
    `EMAIL:${merchantProfileValue('contactEmail')}`,
    `ADR:;;${merchantProfileValue('showroomAddress')};${merchantProfileValue('city')};;${merchantProfileValue('country')}`,
    `URL:${window.location.origin}`, `END:VCARD`
  ].join('\r\n');
  const downloadSmartCard = (extension: 'vcf' | 'html') => {
    const title = merchantProfileValue('name') || 'RUDA Merchant';
    const content = extension === 'vcf' ? smartCardText() : `<!doctype html><html><meta charset="utf-8"><title>${title}</title><body style="font:16px Arial;max-width:560px;margin:40px auto;padding:24px;border:1px solid #ddd;border-radius:20px"><h1>${title}</h1><p>${merchantProfileValue('companyLegalName')}</p><p>${merchantProfileValue('contactPhone')}<br>${merchantProfileValue('contactEmail')}</p><p>${merchantProfileValue('showroomAddress')}<br>${merchantProfileValue('city')}, ${merchantProfileValue('country')}</p></body></html>`;
    const blob = new Blob([content], { type: extension === 'vcf' ? 'text/vcard;charset=utf-8' : 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9-_]+/gi, '-') || 'merchant-card'}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const shareSmartCard = async () => {
    setSmartCardBusy(true);
    try {
      const title = merchantProfileValue('name') || 'RUDA Merchant';
      const text = `${title} · ${merchantProfileValue('contactPhone')}`;
      if (navigator.share) await navigator.share({ title, text, url: window.location.origin });
      else { await navigator.clipboard.writeText(window.location.origin); addNotification('success', '名片链接已复制', '可以发送给朋友或客户'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) addNotification('warning', '分享名片失败', error instanceof Error ? error.message : '请稍后重试');
    } finally { setSmartCardBusy(false); }
  };
  const orderActionCount = merchantOrders.filter(order =>
    ['placed', 'pending', 'confirmed', 'picking'].includes(order.status)
    && !(order.orderNo.startsWith('POS-') && order.paymentStatus === 'paid')
  ).length;
  const previousOrderActionCount = React.useRef(orderActionCount);
  useEffect(() => {
    if (previousOrderActionCount.current === orderActionCount) return;
    if (orderActionCount > previousOrderActionCount.current && mobileSettings.alerts) {
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (mobileSettings.sound && AudioContextClass) {
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.06, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.22);
        }
      } catch {
        // Audio is optional and may be blocked until the user interacts with the page.
      }
      addNotification('success', '订单有新进展', `当前有 ${orderActionCount} 笔订单需要处理`);
    }
    previousOrderActionCount.current = orderActionCount;
  }, [addNotification, mobileSettings.alerts, mobileSettings.sound, orderActionCount]);
  const lowMaterialCount = factoryMaterials.filter(material => material.availableQuantity <= material.reorderPoint).length;
  const activeWorkOrders = factoryWorkOrders.filter(workOrder => !['completed', 'cancelled'].includes(workOrder.status));

  const openOrderDocument = (order: Order, document: 'invoice' | 'picking' | 'packing') => {
    window.open(`/api/merchant/orders/${encodeURIComponent(order.id)}/print?document=${document}`, '_blank', 'noopener,noreferrer');
  };
  const shareOrderDocument = async (order: Order, scope: 'order' | 'invoice' = 'invoice') => {
    setOrderDocumentBusy(true);
    try {
      const result = await apiPost<{ success: true; shareUrl: string }>('/api/merchant/orders/' + encodeURIComponent(order.id) + '/share', { scope });
      if (navigator.share) {
        await navigator.share({ title: `${order.orderNo} · RUDA`, url: result.shareUrl });
      } else {
        await navigator.clipboard.writeText(result.shareUrl);
        addNotification('success', '单据链接已复制', '可发送给客户或保存到其他应用');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) addNotification('warning', '分享单据失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setOrderDocumentBusy(false);
    }
  };
  const sendOrderDocument = async (order: Order) => {
    const recipient = window.prompt('请输入客户邮箱', '');
    if (recipient === null) return;
    setOrderDocumentBusy(true);
    try {
      await apiPost(`/api/merchant/orders/${encodeURIComponent(order.id)}/documents/send`, { recipient });
      addNotification('success', '单据已发送', `已发送至 ${recipient}`);
    } catch (error) {
      addNotification('warning', '单据发送失败', error instanceof Error ? error.message : '请检查邮箱后重试');
    } finally {
      setOrderDocumentBusy(false);
    }
  };
  const startOrderEdit = (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    const terms = agreement?.terms || {
      paymentPlan: 'full_prepayment' as const,
      paymentMethod: order.paymentMethod,
      prepaymentAmount: order.totalAmount,
      remainingBalanceTrigger: 'before_shipment' as const,
      remainingBalanceDueAt: null,
      customPaymentCondition: null,
      supplyMode: 'partial_shipments' as const,
      expectedDeliveryAt: null,
      deliveryType: order.deliveryType,
      pickupLocation: order.pickupLocation || null,
      shippingAddress: order.shippingAddress,
      items: order.items.map(item => ({ orderItemId: item.id, quantity: item.quantity, unitPrice: item.unitPrice })),
      shippingFee: order.shippingFee || 0,
      discountAmount: order.discountAmount || 0,
      totalAmount: order.totalAmount,
      currency: 'EUR' as const
    };
    setOrderEditUnlocked(true);
    setOrderEditDraft(JSON.parse(JSON.stringify(order)) as Order);
    setOrderEditTerms(JSON.parse(JSON.stringify(terms)) as OrderAgreementTerms);
    setOrderEditPrepaymentMode('amount');
    setOrderEditPrepaymentValue(String(terms.prepaymentAmount || 0));
  };
  const saveOrderEdit = async () => {
    if (!orderEditDraft || !orderEditTerms || orderEditBusy) return;
    setOrderEditBusy(true);
    try {
      const currentAgreement = [...(orderEditDraft.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
      const prepaymentValue = Number(orderEditPrepaymentValue);
      const terms = {
        ...orderEditTerms,
        paymentMethod: orderEditDraft.paymentMethod,
        deliveryType: orderEditDraft.deliveryType,
        pickupLocation: orderEditDraft.pickupLocation || null,
        shippingAddress: orderEditDraft.shippingAddress,
        shippingFee: Number(orderEditTerms.shippingFee),
        discountAmount: Number(orderEditTerms.discountAmount),
        items: orderEditDraft.items.map(item => ({ orderItemId: item.id, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
        ...(orderEditTerms.paymentPlan === 'partial_prepayment'
          ? orderEditPrepaymentMode === 'percent'
            ? { prepaymentPercent: prepaymentValue, prepaymentAmount: undefined }
            : { prepaymentAmount: prepaymentValue, prepaymentPercent: undefined }
          : orderEditTerms.paymentPlan === 'custom'
            ? { prepaymentAmount: prepaymentValue > 0 ? prepaymentValue : undefined }
            : { prepaymentAmount: undefined })
      };
      const comparableTerms = (value: typeof terms | OrderAgreementTerms) => JSON.stringify({
        paymentPlan: value.paymentPlan,
        paymentMethod: value.paymentMethod,
        prepaymentAmount: value.prepaymentAmount,
        prepaymentPercent: 'prepaymentPercent' in value ? value.prepaymentPercent : undefined,
        remainingBalanceTrigger: value.remainingBalanceTrigger,
        remainingBalanceDueAt: value.remainingBalanceDueAt,
        customPaymentCondition: value.customPaymentCondition,
        supplyMode: value.supplyMode,
        expectedDeliveryAt: value.expectedDeliveryAt,
        deliveryType: value.deliveryType,
        pickupLocation: value.pickupLocation,
        shippingAddress: value.shippingAddress,
        shippingFee: value.shippingFee,
        discountAmount: value.discountAmount,
        items: value.items
      });
      const termsChanged = !currentAgreement || comparableTerms(terms) !== comparableTerms(currentAgreement.terms);
      const result = await apiPut<{
        success: true;
        order?: Order;
        agreement?: { version: number };
        awaitingBuyerConfirmation?: boolean;
      }>(`/api/merchant/orders/${encodeURIComponent(orderEditDraft.id)}/edit`, {
        companyName: orderEditDraft.companyName,
        deliveryType: orderEditDraft.deliveryType,
        pickupLocation: orderEditDraft.pickupLocation,
        paymentMethod: orderEditDraft.paymentMethod,
        shippingAddress: orderEditDraft.shippingAddress,
        notes: orderEditDraft.notes,
        proposeAgreement: termsChanged,
        agreementId: currentAgreement?.id,
        terms,
        items: orderEditDraft.items.map(item => ({ id: item.id, quantity: item.quantity, unitPrice: item.unitPrice }))
      });
      if (result.awaitingBuyerConfirmation) {
        const refreshed = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
        refreshed.orders.forEach(replaceOrderFromServer);
        const updatedOrder = refreshed.orders.find(order => order.id === orderEditDraft.id);
        if (updatedOrder) setSelectedOrderDetail(updatedOrder);
        setOrderEditDraft(null);
        setOrderEditTerms(null);
        setOrderEditUnlocked(false);
        addNotification('success', '交易方案已发送', `约定版本 ${result.agreement?.version || ''} 等待客户确认；确认前不会按新条件付款或发货。`);
        return;
      }
      if (!result.order) throw new Error('ORDER_EDIT_RESPONSE_INVALID');
      setSelectedOrderDetail(result.order);
      replaceOrderFromServer(result.order);
      setOrderEditDraft(null);
      setOrderEditTerms(null);
      setOrderEditUnlocked(false);
      addNotification('success', '订单资料已保存', `${result.order.orderNo} 的非交易资料已同步`);
    } catch (error) {
      addNotification('warning', '订单保存失败', error instanceof Error ? error.message : '请检查订单资料后重试');
    } finally {
      setOrderEditBusy(false);
    }
  };
  const refreshSelectedMerchantOrder = async (orderId: string) => {
    const result = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
    result.orders.forEach(replaceOrderFromServer);
    const order = result.orders.find(item => item.id === orderId);
    if (order) setSelectedOrderDetail(order);
  };
  const confirmMobileOrderAgreement = async (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    if (!agreement || order.currentTasks?.merchant.action !== 'review_agreement') return;
    try {
      await apiPost(`/api/merchant/orders/${encodeURIComponent(order.id)}/agreements/${encodeURIComponent(agreement.id)}/confirm`, {});
      await refreshSelectedMerchantOrder(order.id);
      addNotification('success', '交易约定已确认', `订单 ${order.orderNo} 将按双方确认的版本继续处理。`);
    } catch (error) {
      addNotification('warning', '确认约定失败', error instanceof Error ? error.message : '请刷新订单后重试');
    }
  };
  const triggerMobileCustomBalance = async (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    if (!agreement || order.currentTasks?.merchant.action !== 'trigger_balance') return;
    const note = window.prompt('请填写满足自定义余款条件的核实依据')?.trim();
    if (!note || note.length < 3) return;
    try {
      await apiPost(`/api/merchant/orders/${encodeURIComponent(order.id)}/agreements/${encodeURIComponent(agreement.id)}/trigger-balance`, { note });
      await refreshSelectedMerchantOrder(order.id);
      addNotification('success', '余款任务已解锁', `${order.orderNo} 的核实记录已保存并通知客户。`);
    } catch (error) {
      addNotification('warning', '核实余款条件失败', error instanceof Error ? error.message : '请刷新订单后重试');
    }
  };

  const refreshFinanceData = async () => {
    const result = await apiGet<{ success: true; summary: MobileFinanceSummary; payouts: MobilePayout[] }>('/api/merchant/finance');
    setFinanceSummary(result.summary);
    setFinancePayouts(result.payouts);
  };

  const refreshOperationsIntelligence = async () => {
    setGrowthLoading(true);
    try {
      const result = await apiGet<MobileOperationsIntelligence & { success: true }>('/api/merchant/operations/intelligence');
      setOperationsIntelligence(result);
    } finally {
      setGrowthLoading(false);
    }
  };

  const refreshFactoryData = async () => {
    if (factoryLoading) return;
    setFactoryLoading(true);
    try {
      const results = await Promise.allSettled([
        apiGet<{ success: true; materials: MobileMaterial[] }>('/api/merchant/materials'),
        apiGet<{ success: true; workOrders: MobileWorkOrder[] }>('/api/merchant/production/work-orders'),
        apiGet<{ success: true; accounts: MobileBankAccount[] }>('/api/merchant/bank-accounts'),
        apiGet<MobileOperationsIntelligence & { success: true }>('/api/merchant/operations/intelligence'),
        apiGet<{ success: true; summary: MobileFinanceSummary; payouts: MobilePayout[] }>('/api/merchant/finance')
      ]);
      const [materialsResult, workOrdersResult, bankResult, intelligenceResult, financeResult] = results;
      const failed: string[] = [];
      if (materialsResult.status === 'fulfilled') setFactoryMaterials(materialsResult.value.materials);
      else failed.push('材料');
      if (workOrdersResult.status === 'fulfilled') setFactoryWorkOrders(workOrdersResult.value.workOrders);
      else failed.push('工单');
      if (bankResult.status === 'fulfilled') setMobileBankAccounts(bankResult.value.accounts);
      else failed.push('收款账户');
      if (intelligenceResult.status === 'fulfilled') setOperationsIntelligence(intelligenceResult.value);
      else failed.push('经营分析');
      if (financeResult.status === 'fulfilled') {
        setFinanceSummary(financeResult.value.summary);
        setFinancePayouts(financeResult.value.payouts);
      } else failed.push('财务');
      if (failed.length) {
        addNotification('warning', '部分经营数据加载失败', `未更新：${[...new Set(failed)].join('、')}。其他数据仍以服务端为准。`);
      }
    } finally {
      setFactoryLoading(false);
    }
  };

  const refreshFactoryMaterials = async () => {
    const result = await apiGet<{ success: true; materials: MobileMaterial[] }>('/api/merchant/materials');
    setFactoryMaterials(result.materials);
    if (!result.materials.some(material => material.id === materialInbound.materialId && material.status === 'active')) {
      setMaterialInbound(previous => ({ ...previous, materialId: result.materials.find(material => material.status === 'active')?.id || '' }));
    }
  };

  const openMaterialEditor = (material?: MobileMaterial) => {
    if (!material) {
      setEditingMaterialId(null);
      setEditingMaterialUnitLocked(false);
      setMaterialForm({ code: '', name: '', category: 'fabric', unit: 'meter', unitCost: '0', reorderPoint: '0', leadTimeDays: '0', status: 'active', notes: '' });
      return;
    }
    setEditingMaterialId(material.id);
    setEditingMaterialUnitLocked(material.unitLocked);
    setMaterialForm({
      code: material.code,
      name: material.name,
      category: material.category,
      unit: material.unit,
      unitCost: String(material.unitCost),
      reorderPoint: String(material.reorderPoint),
      leadTimeDays: String(material.leadTimeDays),
      status: material.status,
      notes: material.notes || ''
    });
    setShowMaterialManager(true);
  };

  const saveFactoryMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (materialBusy) return;
    const unitCost = Number(materialForm.unitCost);
    const reorderPoint = Number(materialForm.reorderPoint);
    const leadTimeDays = Number(materialForm.leadTimeDays);
    if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(reorderPoint) || reorderPoint < 0 || !Number.isInteger(leadTimeDays) || leadTimeDays < 0) {
      addNotification('warning', '物料资料不正确', '成本、安全库存需为非负数，交期需为非负整数');
      return;
    }
    setMaterialBusy(true);
    try {
      const payload = { ...materialForm, code: materialForm.code.trim().toUpperCase(), name: materialForm.name.trim(), unitCost, reorderPoint, leadTimeDays };
      if (editingMaterialId) {
        await apiPut(`/api/merchant/materials/${encodeURIComponent(editingMaterialId)}`, payload);
      } else {
        await apiPost('/api/merchant/materials', payload);
      }
      await refreshFactoryMaterials();
      setMaterialForm({ code: '', name: '', category: 'fabric', unit: 'meter', unitCost: '0', reorderPoint: '0', leadTimeDays: '0', status: 'active', notes: '' });
      setEditingMaterialId(null);
      setEditingMaterialUnitLocked(false);
      addNotification('success', editingMaterialId ? '物料资料已更新' : '物料已创建', `${payload.code} · ${payload.name}`);
    } catch (error) {
      addNotification('warning', editingMaterialId ? '物料更新失败' : '物料创建失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setMaterialBusy(false);
    }
  };

  const receiveFactoryMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(materialInbound.quantity);
    if (!materialInbound.materialId || !Number.isFinite(quantity) || quantity <= 0) {
      addNotification('warning', '入库资料不完整', '请选择启用的面辅料并填写大于 0 的收货数量');
      return;
    }
    setMaterialBusy(true);
    try {
      await apiPost(`/api/merchant/materials/${encodeURIComponent(materialInbound.materialId)}/inbound`, {
        quantity,
        locationCode: 'central',
        note: materialInbound.note,
        idempotencyKey: crypto.randomUUID()
      });
      await refreshFactoryMaterials();
      setMaterialInbound(previous => ({ ...previous, quantity: '', note: '' }));
      addNotification('success', '面辅料已入库', '库存已更新，可用于 BOM 备料和生产预留');
    } catch (error) {
      addNotification('warning', '面辅料入库失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setMaterialBusy(false);
    }
  };

  const refreshTeamSettings = async () => {
    if (teamLoading) return;
    setTeamLoading(true);
    setTeamLoadError(null);
    try {
      const result = await apiGet<{ success: true; employees: MobileEmployee[] }>('/api/merchant/employees');
      setTeamEmployees(result.employees);
      try {
        const auditResult = await apiGet<{ success: true; logs: MobileEmployeeAudit[] }>('/api/merchant/employee-audit');
        setTeamAudit(auditResult.logs);
      } catch (error) {
        setTeamAudit([]);
        addNotification('warning', '审计记录加载失败', error instanceof Error ? error.message : '请稍后重试');
      }
    } catch (error) {
      setTeamLoadError(error instanceof Error ? error.message : '当前账户没有员工管理权限');
      setTeamEmployees([]);
    } finally {
      setTeamLoading(false);
    }
  };

  const createTeamEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (employeeCreateBusy) return;
    setEmployeeCreateBusy(true);
    try {
      await apiPost('/api/merchant/employees', employeeForm);
      setEmployeeForm({ name: '', email: '', password: '', role: 'sales' });
      addNotification('success', '员工账号已创建', '员工可以使用邮箱和初始密码登录');
      await refreshTeamSettings();
    } catch (error) {
      addNotification('warning', '员工创建失败', error instanceof Error ? error.message : '请检查资料后重试');
    } finally {
      setEmployeeCreateBusy(false);
    }
  };

  const setTeamEmployeeActive = async (employee: MobileEmployee) => {
    setTeamBusyId(employee.id);
    try {
      await apiRequest(`/api/merchant/employees/${encodeURIComponent(employee.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !employee.active })
      });
      setTeamEmployees(previous => previous.map(item => item.id === employee.id ? { ...item, active: !employee.active } : item));
      addNotification('success', employee.active ? '员工账号已停用' : '员工账号已启用', employee.name);
      void refreshTeamSettings();
    } catch (error) {
      addNotification('warning', '员工状态更新失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setTeamBusyId(null);
    }
  };

  const submitBankAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (bankAccountBusy) return;
    setBankAccountBusy(true);
    try {
      await apiPost('/api/merchant/bank-accounts', bankAccountForm);
      setBankAccountForm({ accountHolder: '', iban: '' });
      const result = await apiGet<{ success: true; accounts: MobileBankAccount[] }>('/api/merchant/bank-accounts');
      setMobileBankAccounts(result.accounts);
      addNotification('success', '收款账户已提交', '平台财务核验通过后即可用于结算');
    } catch (error) {
      addNotification('warning', '账户提交失败', error instanceof Error ? error.message : '请检查账户资料后重试');
    } finally {
      setBankAccountBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && settingsSection === 'team') void refreshTeamSettings();
  }, [activeTab, settingsSection, currentMerchantId]);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'profile' || activeTab === 'production') void refreshFactoryData();
    if (activeTab === 'finance') void refreshFinanceData().catch(error => {
      addNotification('warning', '财务数据加载失败', error instanceof Error ? error.message : '请稍后重试');
    });
  }, [activeTab, currentMerchantId]);

  useEffect(() => {
    if (activeTab === 'growth') {
      void refreshOperationsIntelligence().catch(error => {
        addNotification('warning', '经营分析加载失败', error instanceof Error ? error.message : '请稍后重试');
      });
    }
  }, [activeTab, currentMerchantId]);

  useEffect(() => {
    if (!currentMerchantId) return;
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown }>).detail?.resources;
      if (!Array.isArray(resources) || !resources.every(resource => typeof resource === 'string')) return;
      if ((activeTab === 'dashboard' || activeTab === 'profile' || activeTab === 'finance' || activeTab === 'growth' || activeTab === 'production')
        && resources.some(resource => ['production', 'finance', 'settings', 'products', 'orders', 'inventory', 'growth'].includes(resource))) {
        if (activeTab === 'finance' && resources.includes('finance')) {
          void refreshFinanceData().catch(error => addNotification('warning', '财务数据刷新失败', error instanceof Error ? error.message : '请稍后重试'));
        } else if (activeTab === 'growth' && resources.some(resource => ['products', 'orders', 'inventory', 'growth'].includes(resource))) {
          void refreshOperationsIntelligence().catch(error => addNotification('warning', '经营分析刷新失败', error instanceof Error ? error.message : '请稍后重试'));
        } else {
          void refreshFactoryData();
        }
      }
      if (activeTab === 'inventory' && resources.includes('inventory')) {
        setInventoryRefreshNonce(value => value + 1);
      }
      if (resources.includes('settings')) {
        setSettingsSyncNonce(value => value + 1);
      }
      if (activeTab === 'profile' && settingsSection === 'team' && resources.includes('settings')) {
        void refreshTeamSettings();
      }
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
  }, [activeTab, currentMerchantId, settingsSection]);

  const advanceWorkOrder = async (workOrder: MobileWorkOrder) => {
    const nextStatus: Record<string, string> = { draft: 'released', released: 'in_progress', in_progress: 'qc_hold', qc_hold: 'in_progress' };
    const status = nextStatus[workOrder.status];
    if (!status || factoryBusyId) return;
    setFactoryBusyId(workOrder.id);
    try {
      const result = await apiPut<{ success: true; workOrder: MobileWorkOrder }>(`/api/merchant/production/work-orders/${encodeURIComponent(workOrder.id)}/status`, { status });
      setFactoryWorkOrders(previous => previous.map(item => item.id === workOrder.id ? result.workOrder : item));
      addNotification('success', '生产状态已更新', `${workOrder.workOrderNo} → ${status}`);
    } catch (error) {
      addNotification('warning', '生产状态更新失败', error instanceof Error ? error.message : '请在电脑端检查工单');
    } finally {
      setFactoryBusyId(null);
    }
  };

  const acknowledgePayout = async (payout: MobilePayout) => {
    if (financeBusyId) return;
    setFinanceBusyId(payout.id);
    try {
      await apiPut(`/api/merchant/payouts/${encodeURIComponent(payout.id)}/status`, { status: 'acknowledged' });
      await refreshFinanceData();
      addNotification('success', '结算单已确认', '平台运营可据此核对并手动记录后续结算；系统不会自动转账。');
    } catch (error) {
      addNotification('warning', '结算确认失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setFinanceBusyId(null);
    }
  };

  const submitProductionReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reportingWorkOrder || reportBusy) return;
    const goodQuantity = Number(reportForm.goodQuantity);
    const rejectedQuantity = Number(reportForm.rejectedQuantity || 0);
    if (!Number.isInteger(goodQuantity) || goodQuantity < 0 || !Number.isInteger(rejectedQuantity) || rejectedQuantity < 0 || goodQuantity + rejectedQuantity <= 0) {
      addNotification('warning', '报产数量无效', '请输入合格数量和不合格数量，合计必须大于 0');
      return;
    }
    setReportBusy(true);
    try {
      await apiPost(`/api/merchant/production/work-orders/${encodeURIComponent(reportingWorkOrder.id)}/reports`, {
        goodQuantity,
        rejectedQuantity,
        note: reportForm.note,
        idempotencyKey: crypto.randomUUID()
      });
      setFactoryWorkOrders(previous => previous.map(order => order.id === reportingWorkOrder.id
        ? { ...order, completedQuantity: order.completedQuantity + goodQuantity, rejectedQuantity: order.rejectedQuantity + rejectedQuantity }
        : order));
      addNotification('success', '生产报产已入账', `${reportingWorkOrder.workOrderNo} 已将 ${goodQuantity} 件合格品计入成品库存`);
      setReportingWorkOrder(null);
      setReportForm({ goodQuantity: '', rejectedQuantity: '0', note: '' });
    } catch (error) {
      addNotification('warning', '生产报产失败', error instanceof Error ? error.message : '工单数据可能已变化，请刷新后重试');
    } finally {
      setReportBusy(false);
    }
  };
  const productCategories = Array.from(new Set(merchantProducts.map(product => product.category).filter(Boolean))).sort();
  // 已售出索引来自真实订单成交明细汇总；未读取完成时为空集合，入口显示“—”而不是 0。
  const { soldProductIds, soldUnitsByProduct } = useMemo(
    () => buildMerchantProductSalesIndex(productSalesSummary),
    [productSalesSummary]
  );
  // 两层筛选的全部数量都基于当前商家权限范围内的真实商品一次算出，避免分层筛选后重复计数。
  const productQuickFilterCounts = countMerchantProductQuickFilters(merchantProducts, { soldProductIds });
  const productZoneCounts = countMerchantProductZones(merchantProducts);
  const visibleProducts = filterMerchantProducts(merchantProducts, {
    query: searchQuery,
    quickFilter: productQuickFilter,
    zoneFilter: productZoneFilter,
    category: productCategory,
    soldProductIds
  }).sort((left, right) => {
    if (productSort === 'price') return right.wholesalePrice - left.wholesalePrice;
    if (productSort === 'stock') {
      const stock = (product: Product) => product.skus.reduce((sum, sku) => sum + sku.stockCentral, 0);
      return stock(left) - stock(right);
    }
    return String(right.styleNo).localeCompare(String(left.styleNo));
  });

  const updateProductZone = async (product: Product, zone: ProductZone) => {
    if (productBusyId) return;
    setProductBusyId(product.id);
    try {
      const updates = getProductZoneUpdates(zone);
      await updateProduct(product.id, updates);
      addNotification('success', '商品展示区已更新', `${product.styleNo} 已调整为${zone === 'private' ? '授权区' : zone === 'clearance' ? '折扣市场' : '现货区'}`);
      setSelectedProduct(previous => previous?.id === product.id ? { ...previous, ...updates } : previous);
    } catch (error) {
      addNotification('warning', '商品权限更新失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setProductBusyId(null);
    }
  };

  const toggleProductSetting = async (
    product: Product,
    setting: 'published' | 'wholesale' | 'private',
    enabled: boolean
  ) => {
    if (productBusyId) return;
    setProductBusyId(product.id);
    const nextVisibility = setting === 'private'
      ? (enabled ? 'private' : 'public')
      : setting === 'wholesale'
        ? (enabled ? 'wholesale' : 'public')
        : product.visibility;
    const nextLifecycleStatus = setting === 'published'
      ? (enabled ? 'published' : 'draft')
      : product.lifecycleStatus;
    try {
      await updateProduct(product.id, {
        visibility: nextVisibility,
        lifecycleStatus: nextLifecycleStatus,
        isExclusiveProtected: nextVisibility === 'private',
        protectionLevel: nextVisibility === 'private' ? 'exclusive_vault' : 'public'
      });
      setSelectedProduct(previous => previous?.id === product.id
        ? {
            ...previous,
            visibility: nextVisibility,
            lifecycleStatus: nextLifecycleStatus,
            isExclusiveProtected: nextVisibility === 'private',
            protectionLevel: nextVisibility === 'private' ? 'exclusive_vault' : 'public'
          }
        : previous);
      addNotification('success', '商品设置已更新', `${product.styleNo} ${setting === 'published' ? (enabled ? '已上架' : '已下架') : enabled ? '已开启' : '已关闭'}`);
    } catch (error) {
      addNotification('warning', '商品设置保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setProductBusyId(null);
    }
  };

  const toggleProductEditingPermission = async () => {
    if (!productEditPermissionLoaded || !canManageProductEditPermission || productEditPermissionBusy) return;
    const enabled = !productEditUnlocked;
    setProductEditPermissionBusy(true);
    try {
      const result = await apiPut<{ success: true; productEditingEnabled: boolean }>('/api/merchant/settings/product-editing', { enabled });
      setProductEditUnlocked(result.productEditingEnabled);
      addNotification('success', '商品编辑权限已更新', result.productEditingEnabled ? '已开启：可以编辑商品' : '已关闭：商品仅可查看');
    } catch (error) {
      addNotification('warning', '商品编辑权限更新失败', error instanceof Error ? error.message : '权限未保存，请稍后重试');
    } finally {
      setProductEditPermissionBusy(false);
    }
  };

  const openProductEditor = (product: Product) => {
    if (!productEditUnlocked) return;
    setProductDraft({ ...product });
  };

  const saveNewProduct = async (
    event: React.FormEvent<HTMLFormElement>,
    action: 'draft' | 'publish',
    mode: 'quick' | 'full'
  ) => {
    event.preventDefault();
    if (!creatingProductDraft || creatingProductBusy) return;
    const validationError = validateMerchantProductDraft(creatingProductDraft, action, mode, {
      allowOptionalFullDetails: true,
      requireImageOnPublish: true,
      validateVariantPrices: action === 'publish'
    });
    if (validationError) {
      addNotification('warning', '商品资料不完整或无效', validationError);
      return;
    }
    if (!currentMerchant) {
      addNotification('warning', '商家资料未加载', '请刷新后重试商品发布');
      return;
    }
    setCreatingProductBusy(true);
    try {
      await addProduct({
        ...buildMerchantProduct(creatingProductDraft, currentMerchantId, currentMerchant.name, { persistVariantPricing: true }),
        creationRequestKey: creatingProductDraft.creationRequestKey,
        lifecycleStatus: action === 'publish' ? 'published' : 'draft'
      });
      setCreatingProductDraft(null);
      addNotification('success', action === 'publish' ? '商品发布成功' : '商品草稿已保存',
        action === 'publish' ? `${creatingProductDraft.styleNo} 已进入现有商品目录` : `${creatingProductDraft.styleNo || '未命名'} 已保存为草稿`);
    } catch (error) {
      addNotification('warning', '商品发布失败', error instanceof Error ? error.message : '服务器未接受商品发布，请稍后重试');
    } finally {
      setCreatingProductBusy(false);
    }
  };

  const beginMobileProductCreation = async (mode: 'quick' | 'full') => {
    if (creatingProductDefaultsBusy) return;
    setCreatingProductDefaultsBusy(true);
    try {
      const result = await apiGet<{ success: true; settings: Partial<typeof merchantSettings> }>('/api/merchant/settings');
      const draft = createMerchantProductDraft(result.settings.moq);
      setMerchantSettings(previous => ({ ...previous, moq: draft.moq }));
      setCreatingProductMode(mode);
      setCreatingProductDraft(draft);
    } catch (error) {
      addNotification('warning', '商品创建表单加载失败', error instanceof Error ? error.message : '无法读取店铺默认起订量，请稍后重试');
    } finally {
      setCreatingProductDefaultsBusy(false);
    }
  };

  const saveProductDraft = async () => {
    if (!productDraft || productDraftBusy || productMediaBusy) return;
    if (!productDraft.id) {
      addNotification('warning', '无法编辑商品', '请关闭表单后重新选择要编辑的商品');
      return;
    }
    const productId = productDraft.id;
    const productMedia = productDraft.media?.length
      ? productDraft.media
      : (productDraft.images || []).map((url, index) => ({ id: `legacy-${index}`, type: 'image' as const, url }));
    setProductDraftBusy(true);
    try {
      const updates: Partial<Product> = {
        styleNo: productDraft.styleNo,
        name: productDraft.name,
        category: productDraft.category,
        wholesalePrice100: productDraft.wholesalePrice100 ?? null,
        subCategory: productDraft.subCategory,
        brand: productDraft.brand,
        wholesalePrice: Number(productDraft.wholesalePrice) || 0,
        moq: Number(productDraft.moq) || 1,
        packSize: Number(productDraft.packSize) || 1,
        fabric: productDraft.fabric,
        description: productDraft.description,
        media: productMedia,
        images: productMedia.filter(item => item.type === 'image').map(item => item.url),
        ...getProductZoneUpdates(getProductZone(productDraft))
      };
      await updateProduct(productId, updates);
      setSelectedProduct(previous => {
        if (!previous || previous.id !== productId) return previous;
        return { ...previous, ...updates };
      });
      setProductDraft(null);
      addNotification('success', '商品资料已保存', `${updates.styleNo || '商品'} 已同步`);
    } catch (error) {
      addNotification('warning', '商品资料保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setProductDraftBusy(false);
    }
  };

  const runProductSmartAssistant = () => {
    if (!productDraft || productSmartBusy) return;
    setProductSmartBusy(true);
    setProductSmartAdvice([]);
    window.setTimeout(() => {
      const name = String(productDraft.name || '').trim();
      const category = String(productDraft.category || '').trim();
      const fabric = String(productDraft.fabric || '').trim();
      const description = String(productDraft.description || '').trim();
      const price = Number(productDraft.wholesalePrice) || 0;
      const wholesalePrice100 = Number(productDraft.wholesalePrice100) || 0;
      const suggestions: string[] = [];
      const updates: Partial<Product> = {};
      if (!name) {
        updates.name = `${category || '意式时装'} · 2026 秋冬系列`;
        suggestions.push('已根据商品分类生成商品名称');
      }
      if (!category) {
        suggestions.push('请在产品分类中选择上衣、裤子或裙子');
      }
      if (!fabric) {
        updates.fabric = '高品质混纺面料';
        suggestions.push('已补充面料描述，建议发布前按吊牌成分核对');
      }
      if (!description) {
        updates.description = `RUDA 精选${String(updates.name || name || '时装')}，适合精品店与买手店陈列。版型利落，适合秋冬多场景搭配，支持 B2B 批发采购。`;
        suggestions.push('已生成适合买手浏览的商品描述');
      }
      if (price > 0 && wholesalePrice100 > 0 && wholesalePrice100 <= price) {
        suggestions.push('100件起订时将自动应用该量大批发价');
      } else {
        suggestions.push('请填写不高于基础批发价的100件批发价');
      }
      setProductDraft(previous => previous ? { ...previous, ...updates } : previous);
      setProductSmartAdvice(suggestions);
      setProductSmartBusy(false);
    }, 350);
  };

  const productQualityScore = selectedProduct
    ? Math.round(([selectedProduct.name, selectedProduct.category, selectedProduct.subCategory, selectedProduct.brand, selectedProduct.fabric, selectedProduct.description, selectedProduct.images?.length ? 'image' : '', selectedProduct.wholesalePrice > 0 ? 'price' : ''].filter(Boolean).length / 8) * 100)
    : 0;
  const productMargin = selectedProduct && selectedProduct.wholesalePrice100 != null && selectedProduct.wholesalePrice > 0
    ? Math.round(((selectedProduct.wholesalePrice - selectedProduct.wholesalePrice100) / selectedProduct.wholesalePrice) * 100)
    : null;

  useEffect(() => {
    if (activeTab !== 'inventory') return;
    let active = true;
    setInventoryLoading(true);
    setInventoryError(null);
    void apiGet<{ success: true; balances: MerchantInventoryBalance[] }>('/api/merchant/inventory/balances?pageSize=500')
      .then(result => {
        if (active) setInventoryBalances(result.balances);
      })
      .catch(error => {
        if (active) {
          setInventoryBalances([]);
          setInventoryError(error instanceof Error ? error.message : '库存加载失败');
        }
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, currentMerchantId, inventoryRefreshNonce]);

  const inventoryByProduct = useMemo(() => {
    const grouped = new Map<string, {
      product: MerchantInventoryBalance['product'];
      balances: MerchantInventoryBalance[];
    }>();
    inventoryBalances.forEach(balance => {
      const existing = grouped.get(balance.product.id);
      if (existing) existing.balances.push(balance);
      else grouped.set(balance.product.id, { product: balance.product, balances: [balance] });
    });
    return Array.from(grouped.values()).filter(({ product }) => {
      const query = searchQuery.trim().toLowerCase();
      return !query || `${product.styleNo} ${product.name}`.toLowerCase().includes(query);
    });
  }, [inventoryBalances, searchQuery]);

  const recentProducts = useMemo(() => [...merchantProducts]
    .sort((left, right) => {
      const leftUpdated = Date.parse(left.updatedAt || left.createdAt || '') || 0;
      const rightUpdated = Date.parse(right.updatedAt || right.createdAt || '') || 0;
      return rightUpdated - leftUpdated;
    })
    .slice(0, 4), [merchantProducts]);
  const availableProductStock = merchantProducts.reduce((total, product) => total +
    product.skus.reduce((skuTotal, sku) => skuTotal + Math.max(0, Number(sku.stockCentral || 0) - Number(sku.reserved || 0)), 0), 0);
  const lowStockProductCount = merchantProducts.filter(product => isLowStockProduct(product.skus)).length;
  const pendingCustomerVaultCount = merchantVaultRequests.filter(vr => vr.status === 'pending').length;

  const selectedOrder = selectedOrderToFulfill
    ? merchantOrders.find(order => order.id === selectedOrderToFulfill)
    : undefined;
  const nextFulfillmentAction = selectedOrder?.status === 'placed' || selectedOrder?.status === 'pending'
    ? { status: 'confirmed' as const, label: '确认订单' }
    : selectedOrder?.status === 'confirmed'
      ? { status: 'picking' as const, label: '开始配货' }
      : selectedOrder?.status === 'picking'
        ? { status: 'shipped' as const, label: '确认发货' }
        : null;

  useEffect(() => {
    if (!selectedOrderToFulfill || !selectedOrder || selectedOrder.status !== 'picking') {
      setShipments([]);
      setShipmentQuantities({});
      return;
    }
    let active = true;
    setShipmentsLoading(true);
    void apiGet<{ success: true; shipments: MerchantShipment[] }>(
      `/api/merchant/orders/${encodeURIComponent(selectedOrderToFulfill)}/shipments`
    ).then(result => {
      if (!active) return;
      setShipments(result.shipments);
      const shipped = new Map<string, number>();
      result.shipments.forEach(shipment => shipment.items.forEach(item => {
        shipped.set(item.orderItemId, (shipped.get(item.orderItemId) || 0) + item.quantity);
      }));
      setShipmentQuantities(Object.fromEntries(selectedOrder.items.map(item => [
        item.id,
        Math.max(0, item.quantity - (shipped.get(item.id) || 0))
      ])));
    }).catch(error => {
      if (active) {
        setShipments([]);
        setShipmentQuantities({});
        addNotification('warning', '包裹加载失败', error instanceof Error ? error.message : '请稍后重试');
      }
    }).finally(() => {
      if (active) setShipmentsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedOrderToFulfill, selectedOrder?.status]);

  useEffect(() => {
    const order = selectedOrderDetail;
    if (!order || order.orderNo.startsWith('POS-') || order.status === 'draft') {
      setOrderTrackingShipments([]);
      setOrderTrackingLoading(false);
      return;
    }
    let active = true;
    setOrderTrackingLoading(true);
    void apiGet<{ success: true; shipments: MerchantOrderTrackingShipment[] }>(
      `/api/merchant/orders/${encodeURIComponent(order.id)}/shipments`
    ).then(result => {
      if (active) setOrderTrackingShipments(result.shipments);
    }).catch(error => {
      if (active) {
        setOrderTrackingShipments([]);
        addNotification('warning', '物流记录加载失败', error instanceof Error ? error.message : '请稍后重试');
      }
    }).finally(() => {
      if (active) setOrderTrackingLoading(false);
    });
    return () => { active = false; };
  }, [addNotification, selectedOrderDetail?.id, selectedOrderDetail?.orderNo, selectedOrderDetail?.status]);

  const handleQuickFulfill = async () => {
    if (!selectedOrder || !nextFulfillmentAction || fulfillmentBusy) return;
    setFulfillmentBusy(true);
    if (nextFulfillmentAction.status === 'shipped') {
      const items = selectedOrder.items
        .map(item => ({ orderItemId: item.id, quantity: Number(shipmentQuantities[item.id] || 0) }))
        .filter(item => item.quantity > 0);
      if (items.length === 0) {
        addNotification('warning', '无法创建包裹', '请至少填写一件本次发货数量');
        setFulfillmentBusy(false);
        return;
      }
      if (!carrier.trim() || !trackingNo.trim()) {
        addNotification('warning', '物流信息不完整', '确认发货前请填写真实承运商和物流单号');
        setFulfillmentBusy(false);
        return;
      }
      try {
        const result = await apiPost<{ success: true; order: Order; shipment: MerchantShipment }>(
          `/api/merchant/orders/${encodeURIComponent(selectedOrder.id)}/shipments`,
          {
            items,
            carrier,
            trackingNumber: trackingNo.trim()
          }
        );
        syncOrderFromServer(result.order);
        addNotification('success', '包裹已创建', `${result.shipment.shipmentNo} 已登记并通知买手`);
        setSelectedOrderToFulfill(null);
        setTrackingNo('');
      } catch (error) {
        addNotification('warning', '包裹创建失败', error instanceof Error ? error.message : '服务端未接受本次发货');
      } finally {
        setFulfillmentBusy(false);
      }
      return;
    }
    const fulfilled = await merchantFulfillOrder(
      selectedOrder.id,
      nextFulfillmentAction.status,
      undefined,
      undefined,
      `商家手机端：${nextFulfillmentAction.label}`
    );
    setFulfillmentBusy(false);
    if (fulfilled) {
      addNotification('success', nextFulfillmentAction.label, `订单 ${selectedOrder.orderNo} 已更新`);
      setSelectedOrderToFulfill(null);
      setTrackingNo('');
    }
  };

  const primaryTabIcons = {
    dashboard: Home,
    products: Package,
    orders: Truck,
    ai_home: Sparkles,
    more: Ellipsis
  } as const;
  const moreItemIcons = {
    customers: ContactRound,
    procurement: ShoppingCart,
    finance: WalletCards,
    materials: Layers,
    inventory: AlertTriangle,
    production: Factory,
    store: Store,
    domains: Globe,
    content: PanelsTopLeft,
    ai: Sparkles,
    team: Users,
    notifications: Bell,
    settings: Settings,
    support: CircleHelp,
    privacy: ShieldCheck,
    growth: TrendingUp
  } as const;
  const tabs = merchantMobilePrimaryTabs.map(tab => ({
    ...tab,
    icon: primaryTabIcons[tab.id],
    badge: tab.id === 'orders' && orderActionCount > 0 ? orderActionCount : undefined
  })).filter(tab => modauiEnabled || tab.id !== 'ai_home');
  const getMobileCopilotContext = (tab: 'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'store' | 'profile' | 'pos' | 'finance' | 'growth' | 'production' | 'procurement' | 'content') => {
    const route = tab === 'store' ? 'profile' : tab;
    const context = tab === 'pos' ? 'orders' : route;
    const scope = tab === 'finance' ? 'finance'
      : tab === 'growth' ? mobileGrowthSection
      : tab === 'production' ? 'work-orders'
      : tab === 'procurement' ? 'purchase-orders'
      : tab === 'content' ? mobileContentSection
      : tab === 'dashboard' ? 'home'
      : tab === 'products' ? creatingProductDraft ? 'create' : 'catalog'
        : tab === 'orders' ? 'orders' : 'overview';
    const task = tab === 'products'
      ? creatingProductDraft ? 'create_product' : 'manage_products'
      : tab === 'orders' || tab === 'pos' ? 'manage_orders'
        : tab === 'inventory' ? 'manage_inventory'
          : tab === 'customers' ? 'manage_customers'
            : tab === 'finance' ? 'manage_finance'
              : tab === 'growth' ? 'analyze_growth'
                : tab === 'production' ? 'manage_production'
                  : tab === 'procurement' ? 'manage_procurement'
                    : tab === 'content' ? 'manage_content'
            : tab === 'store' ? 'manage_store'
              : tab === 'profile' ? 'manage_settings' : 'overview';
    const pageContext: MerchantCopilotPageContext = {
      route,
      section: scope,
      task,
      selectedObjectId: tab === 'products' ? selectedProduct?.id || null : null,
      filters: {}
    };
    if (tab === 'products' && creatingProductDraft) {
      pageContext.form = createMerchantProductFormPageContext(creatingProductDraft, creatingProductMode).form;
    }
    return { context, scope, pageContext };
  };
  const mobilePosCopilotContext = getMobileCopilotContext('pos');
  const selectedOrderAgreement = [...(selectedOrderDetail?.agreementVersions || [])]
    .sort((left, right) => right.version - left.version)[0];
  const selectedOrderIsPos = selectedOrderDetail?.orderNo.startsWith('POS-') || false;
  const selectedOrderProgress = !selectedOrderDetail ? 0
    : selectedOrderDetail.status === 'delivered' || (selectedOrderIsPos && selectedOrderDetail.paymentStatus === 'paid') ? 4
      : selectedOrderDetail.status === 'shipped' ? 3
        : ['confirmed', 'picking'].includes(selectedOrderDetail.status) ? 2
          : selectedOrderAgreement?.status === 'pending_buyer' || selectedOrderAgreement?.status === 'pending_merchant' ? 1 : 0;
  const canStartMobileFulfillment = Boolean(selectedOrderDetail
    && !selectedOrderIsPos
    && ['confirmed', 'picking'].includes(selectedOrderDetail.status)
    && (!selectedOrderAgreement || selectedOrderAgreement.status === 'active')
    && (selectedOrderDetail.status === 'picking'
      ? selectedOrderDetail.canShipOrder !== false
      : selectedOrderDetail.canBeginPreparation !== false));
  const canReviewLegacyOrder = Boolean(selectedOrderDetail
    && !selectedOrderIsPos
    && ['placed', 'pending'].includes(selectedOrderDetail.status)
    && !selectedOrderAgreement);
  const showMoreReturnHeader = returnToMore && activeTab !== 'more' && activeTab !== 'ai_home' && activeTab !== 'pos';

  return (
    <div id="merchant-mobile-app-root" className={`min-h-screen bg-[#f5f5f7] text-neutral-900 ${activeTab === 'pos' || activeTab === 'ai_home' ? 'overflow-hidden' : 'pb-20'} select-none antialiased`}>
      {!currentMerchant?.isVerified && !currentMerchant?.storefrontEnabled && activeTab !== 'pos' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-xs font-semibold">{mobileText('后台已开通，店铺尚未公开', 'Workspace attivo, negozio non ancora pubblico')}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] leading-4 text-amber-900"><span>{mobileText('资质待验证', 'Verifica aziendale richiesta')}</span><span>{mobileText('店铺商品暂不公开', 'Negozio e prodotti nascosti')}</span><span>{mobileText('暂不可销售', 'Vendita non disponibile')}</span></div>
        </div>
      )}
      {(showMoreReturnHeader || (activeTab !== 'store' && activeTab !== 'pos' && activeTab !== 'ai_home' && activeTab !== 'products' && activeTab !== 'orders')) && (
        <header className="sticky top-0 z-40 flex items-center bg-[#f5f5f7]/95 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-xl">
          {showMoreReturnHeader ? (
            <div className="relative flex h-10 w-full items-center">
              <button type="button" onClick={returnFromMoreChild} aria-label={mobileText('返回更多', 'Torna ad Altro')} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl pr-3 text-sm font-medium text-neutral-700 transition-transform active:scale-[0.98]">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span>{mobileText('更多', 'Altro')}</span>
              </button>
              <span className="absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate text-sm font-semibold text-neutral-900">{moreReturnTitle}</span>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                {activeTab === 'dashboard' && <button type="button" onClick={() => setShowBusinessCard(true)} aria-label={mobileText('打开商家名片', 'Apri scheda negozio')} className="flex min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 text-left transition active:scale-[0.99] active:bg-neutral-200/60">
                  {currentMerchant?.logo ? <img src={merchantMediaUrl(currentMerchant.logo, DEFAULT_MERCHANT_LOGO)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_MERCHANT_LOGO; }} /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">{(currentMerchant?.name || 'R').slice(0, 1).toUpperCase()}</span>}
                  <span className="max-w-[min(44vw,200px)] truncate text-[16px] font-semibold tracking-tight text-neutral-950">{currentMerchant?.name || 'RUDA'}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                </button>}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {activeTab === 'dashboard' && <button type="button" aria-label={merchantUnreadNotifications > 0 ? mobileText(`消息中心，${merchantUnreadNotifications} 条未读`, `Centro messaggi, ${merchantUnreadNotifications} non lette`) : mobileText('消息中心', 'Centro messaggi')} title={mobileText('消息中心', 'Centro messaggi')} onClick={() => setMessageCenterOpen(true)} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-transform active:scale-[0.98]">
                  <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                  {merchantUnreadNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-semibold leading-4 text-white">{merchantUnreadNotifications > 99 ? '99+' : merchantUnreadNotifications}</span>}
                </button>}
              </div>
            </>
          )}
        </header>
      )}
      {showBusinessCard && currentMerchant && (
        <MerchantBusinessCard merchant={currentMerchant} onClose={() => setShowBusinessCard(false)} />
      )}
      <MerchantMessageCenter
        open={messageCenterOpen}
        notifications={merchantNotifications}
        unread={merchantUnreadNotifications}
        loading={merchantNotificationsLoading}
        error={merchantNotificationsError}
        onClose={() => setMessageCenterOpen(false)}
        onMarkRead={markMerchantNotificationRead}
        onReload={reloadMerchantNotifications}
      />
      {activeTab !== 'pos' && <nav
        id="merchant-bottom-navigation"
        aria-label={mobileText('商家导航', 'Navigazione')}
        aria-hidden={activeTab === 'ai_home' ? true : undefined}
        className={`ruda-bottom-nav fixed inset-x-0 bottom-0 ${activeTab === 'ai_home' ? 'z-[70]' : 'z-50'} border-t border-neutral-200/70 bg-white/95 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.035)] backdrop-blur-2xl ${
          activeTab === 'ai_home'
            ? 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none pointer-events-none translate-y-full'
            : ''
        }`}
      >
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                tabIndex={activeTab === 'ai_home' ? -1 : 0}
                onClick={() => { setReturnToMore(false); setMoreReturnTitle(''); setActiveTab(tab.id); }}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors active:scale-95 ${
                  isActive ? 'text-neutral-900' : 'text-neutral-400'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                <span className={`truncate text-[10px] leading-3 ${isActive ? 'font-bold' : 'font-medium'}`}>{mobileText(tab.zh, tab.it)}</span>
                {tab.badge !== undefined && (
                  <span className="absolute right-1 top-0 min-w-[17px] rounded-full bg-rose-500 px-1 text-center text-[9px] font-black text-white">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>}

      <div className={activeTab === 'pos' || activeTab === 'ai_home' ? 'p-0' : `ruda-mobile-content px-4 pt-2 ${mobileSettings.compact ? 'space-y-2.5' : 'space-y-3'} pb-28`}>
        {industryPanelActive && IndustryWorkspace ? (
          <IndustryWorkspace
            mobileMode
            embedded
            activeSection={industrySection}
            onSectionChange={navigateIndustrySection}
          />
        ) : (
        <>
        {activeTab === 'more' && (
          <div className="space-y-4 animate-fadeIn">
            <section className="ruda-mobile-surface rounded-2xl border border-neutral-200 bg-white p-3 text-center shadow-[0_1px_4px_rgba(0,0,0,0.035)]">
              <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                {currentMerchant?.logo
                  ? <img src={merchantMediaUrl(currentMerchant.logo, DEFAULT_MERCHANT_LOGO)} alt="" className="h-full w-full object-cover" />
                  : <img src={DEFAULT_MERCHANT_LOGO} alt="" className="h-full w-full object-cover" />}
              </div>
              <h1 className="mt-3 truncate text-[17px] font-semibold text-neutral-950">{currentMerchant?.name || mobileText('商家账户', 'Account negozio')}</h1>
              <button
                type="button"
                onClick={() => {
                  if (currentMerchant?.storefrontEnabled) setShowMerchantStoreQr(true);
                  else addNotification('warning', mobileText('店铺暂未公开', 'Negozio non pubblico'), mobileText('启用店铺后即可分享二维码。', 'Attiva il negozio per condividere il QR code.'));
                }}
                className="mx-auto mt-2 inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-neutral-600 active:bg-neutral-50"
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {mobileText('店铺二维码', 'QR negozio')}
              </button>
            </section>
            {merchantMobileMoreGroups.map(group => (
              <section key={group.id} className="ruda-more-group space-y-1.5">
                <h2 className="px-1 text-[11px] font-semibold tracking-[0.08em] text-neutral-500">{mobileText(group.zh, group.it)}</h2>
                <div className="ruda-mobile-surface overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.025)]">
                  {group.items.map(item => {
                    const Icon = moreItemIcons[item.icon];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openMoreItem(item.id)}
                        className="ruda-more-row flex min-h-[70px] w-full items-center gap-3 border-b border-neutral-100 px-3.5 py-2.5 text-left last:border-b-0 active:bg-neutral-50"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 text-neutral-800">
                          <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-neutral-900">{mobileText(item.zh, item.it)}</span>
                          <span className="mt-0.5 block truncate text-[11px] leading-4 text-neutral-500">{mobileText(item.descriptionZh, item.descriptionIt)}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <footer className="space-y-3 pt-2">
              <div className="py-2 text-center">
                <div className="text-[13px] font-semibold tracking-[0.2em] text-neutral-500">RUDA FASHION</div>
                <div className="mt-1 text-[10px] tracking-[0.16em] text-neutral-400">BUSINESS PORTAL</div>
              </div>
              <button type="button" onClick={logout} className="mx-auto flex h-9 min-w-28 items-center justify-center rounded-[6px] border border-neutral-200 bg-white px-5 text-[13px] font-semibold text-neutral-700 active:bg-neutral-50">
                {mobileText('退出登录', 'Esci')}
              </button>
            </footer>
            {showMerchantStoreQr && currentMerchant && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={() => setShowMerchantStoreQr(false)}>
                <section role="dialog" aria-modal="true" aria-label={mobileText('店铺二维码', 'QR negozio')} className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={event => event.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">{mobileText('店铺二维码', 'QR negozio')}</h2>
                    <button type="button" onClick={() => setShowMerchantStoreQr(false)} aria-label={mobileText('关闭', 'Chiudi')} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mx-auto inline-flex rounded-xl border border-neutral-100 bg-white p-3">
                    <QRCodeSVG value={merchantStorefrontOrigin(currentMerchant.storeSlug || currentMerchant.slug || currentMerchant.id)} size={220} level="M" includeMargin />
                  </div>
                  <p className="mt-3 break-all text-xs text-neutral-500">{merchantStorefrontOrigin(currentMerchant.storeSlug || currentMerchant.slug || currentMerchant.id)}</p>
                  <a href={merchantStorefrontOrigin(currentMerchant.storeSlug || currentMerchant.slug || currentMerchant.id)} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white">
                    {mobileText('打开店铺', 'Apri negozio')}
                  </a>
                </section>
              </div>
            )}
          </div>
        )}
        {activeTab === 'support' && (
          <Suspense fallback={<div className="rounded-2xl bg-white p-8 text-center text-xs text-neutral-500">{mobileText('正在打开帮助反馈…', 'Caricamento assistenza…')}</div>}>
            <MerchantSupportChat />
          </Suspense>
        )}
        {activeTab === 'ai_employees' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('正在打开智能员工', 'Caricamento team AI')}</div>}>
            <MerchantAiEmployees isIt={mobileItalian} />
          </Suspense>
        )}
        {activeTab === 'ai_tools' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('正在打开工具中心', 'Caricamento centro strumenti')}</div>}>
            <MerchantAiTools />
          </Suspense>
        )}
        {activeTab === 'ai_home' && (modauiEnabled ? (
          <div
            className="fixed inset-x-0 top-0 z-[60] bg-white pt-[env(safe-area-inset-top)]"
            style={{ bottom: visualViewportInset }}
          >
            <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-neutral-500">{mobileText('ModaUI 正在加载…', 'Caricamento di ModaUI…')}</div>}>
              {/* 与电脑端同一个单页工作台：五项能力、推理中枢与结果检查都在这一页，不再渲染旧 AI 首页。 */}
              <ModaUIWorkbench
                key={currentMerchantId}
                isIt={mobileItalian}
                merchantId={currentMerchantId}
                merchantName={currentMerchant?.name || ''}
                onExit={() => {
                  const nextUrl = new URL(window.location.href);
                  nextUrl.searchParams.delete('workspace');
                  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
                  setActiveTab(copilotOriginTabRef.current || 'dashboard');
                }}
              />
            </Suspense>
          </div>
        ) : (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white px-6 text-center">
            <div className="w-full max-w-sm">
              <p className="text-base font-semibold text-neutral-950">{mobileText('该功能暂未开放', 'Questa funzione non è al momento disponibile')}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{mobileText('当前已由平台关闭。历史内容与数据均已保留，重新开启后可继续使用。', 'La funzione è stata disattivata dalla piattaforma. I contenuti restano salvati e torneranno disponibili alla riattivazione.')}</p>
              <button type="button" onClick={() => setActiveTab('dashboard')} className="mt-6 border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white">{mobileText('返回首页', 'Torna alla home')}</button>
            </div>
          </div>
        ))}
        {activeTab === 'pos' && currentMerchant && (
          <div className="fixed inset-0 z-[60] flex flex-col bg-[#f5f5f7] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3">
            <button type="button" onClick={() => setActiveTab(posReturnTab)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-700">
              <ChevronLeft className="h-4 w-4" />{mobileText('返回', 'Indietro')}
            </button>
            <span className="max-w-[55%] truncate text-xs font-semibold text-neutral-800">{currentMerchant.name}</span>
            <span className="w-14" aria-hidden="true" />
          </div>
          <div className="min-h-0 flex-1">
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-neutral-500">{mobileText('POS 正在加载…', 'Caricamento POS…')}</div>}>
            <MerchantSmartPos
            mobileMode
            merchantId={currentMerchant.id}
            products={merchantProducts}
            customers={merchantCustomers}
            orders={merchantOrders}
            operationsIntelligence={null}
            merchantName={currentMerchant.name}
            merchantLocation={{
              city: mobileItalian ? currentMerchant.city_it || currentMerchant.city : currentMerchant.city_zh || currentMerchant.city,
              country: mobileItalian ? currentMerchant.country_it || currentMerchant.country : currentMerchant.country_zh || currentMerchant.country,
              address: currentMerchant.showroomAddress
            }}
            isIt={mobileItalian}
            onOrderCreated={async (orderNo) => {
              const orderResult = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
              orderResult.orders.forEach(replaceOrderFromServer);
              if (orderNo) {
                const createdOrder = orderResult.orders.find(order => order.orderNo === orderNo);
                if (createdOrder) {
                  setSelectedOrderDetail(createdOrder);
                  setActiveTab('orders');
                }
              }
              const productResult = await apiGet<{ success: true; products: Product[] }>('/api/merchant/products');
              replaceMerchantProductsFromServer(currentMerchant.id, productResult.products);
            }}
            onRefreshProducts={async () => {
              const result = await apiGet<{ success: true; products: Product[] }>('/api/merchant/products');
              replaceMerchantProductsFromServer(currentMerchant.id, result.products);
            }}
            onNotify={addNotification}
            onAskAI={async (question, onReply) => {
              try {
                const result = await apiPost<{ reply: string }>('/api/merchant/assistant/query', {
                  question,
                  ...mobilePosCopilotContext
                }, 30_000, { 'Idempotency-Key': `assistant-${crypto.randomUUID()}` });
                onReply(result.reply);
                return true;
              } catch (error) {
                addNotification('warning', 'POS AI 分析失败', error instanceof Error ? error.message : '请稍后重试');
                return false;
              }
            }}
            onOpenMerchantSettings={section => {
              setSettingsSection(section === 'staff' ? 'team' : 'store');
              setActiveTab('profile');
            }}
            />
          </Suspense>
          </div>
          </div>
        )}
        {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <form onSubmit={event => { event.preventDefault(); setActiveTab('products'); }} className="ruda-home-search flex h-12 items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
            <Search className="ml-2 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={mobileText('搜索商品、款号、SKU', 'Cerca prodotto, modello, SKU')}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            <button type="submit" aria-label={mobileText('搜索商品', 'Cerca prodotti')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white active:scale-95">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
          <div className="ruda-home-action-grid grid grid-cols-5 gap-1.5" role="group" aria-label={mobileText('快捷入口', 'Azioni rapide')}>
            {([
              { label: mobileText('开单', 'Ordine'), icon: ShoppingCart, featured: true, action: () => { setPosReturnTab('dashboard'); setActiveTab('pos'); } },
              { label: mobileText('网站', 'Sito'), icon: Globe, href: merchantStoreHref ?? undefined, action: () => setActiveTab('store') },
              { label: mobileText('客户', 'Clienti'), icon: Users, action: () => setActiveTab('customers') },
              { label: mobileText('库存', 'Scorte'), icon: Boxes, action: () => setActiveTab('inventory') },
              { label: mobileText('新增', 'Nuovo'), icon: Plus, action: () => void beginMobileProductCreation('quick') }
            ] as Array<{ label: string; icon: typeof ShoppingCart; featured?: boolean; href?: string; action: () => void }>).map(item => {
              const Icon = item.icon;
              const actionClassName = 'ruda-home-enter ruda-home-quick-action flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-neutral-800';
              const actionBody = (
                <>
                  <span className={`ruda-home-quick-action-icon grid h-8 w-8 place-items-center rounded-lg ${item.featured ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate text-[10px] font-medium leading-3 tracking-tight">{item.label}</span>
                </>
              );
              return item.href
                ? <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={actionClassName}>{actionBody}</a>
                : <button key={item.label} type="button" onClick={item.action} className={actionClassName}>{actionBody}</button>;
            })}
          </div>
        </div>
        )}

        {(activeTab === 'inventory' || activeTab === 'customers') && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={activeTab === 'customers' ? customerQuery : searchQuery}
              onChange={(e) => activeTab === 'customers' ? setCustomerQuery(e.target.value) : setSearchQuery(e.target.value)}
              placeholder={activeTab === 'customers' ? '搜索公司、联系人...' : '搜索款号...'}
              className="w-full pl-10 pr-4 py-3 bg-white text-[14px] rounded-2xl border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-neutral-900/5 placeholder:text-neutral-400"
            />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <section className="ruda-home-stat-grid grid grid-cols-3 gap-2">
              <div className="ruda-home-surface ruda-home-enter rounded-xl border px-2.5 py-3">
                <span className="block truncate text-[11px] text-neutral-500">{mobileText('商品', 'Prodotti')}</span>
                <strong className="mt-1 block text-[21px] font-semibold leading-6 tabular-nums tracking-tight text-neutral-950">{merchantProducts.length}</strong>
              </div>
              <div className="ruda-home-surface ruda-home-enter rounded-xl border px-2.5 py-3">
                <span className="block truncate text-[11px] text-neutral-500">{mobileText('SKU 现货', 'Disponibili')}</span>
                <strong className="mt-1 block text-[21px] font-semibold leading-6 tabular-nums tracking-tight text-neutral-950">{availableProductStock.toLocaleString(getIntlLocale(lang))}</strong>
              </div>
              <div className="ruda-home-surface ruda-home-enter rounded-xl border px-2.5 py-3">
                <span className="block truncate text-[11px] text-neutral-500">{mobileText('待处理订单', 'Ordini aperti')}</span>
                <strong className="mt-1 block text-[21px] font-semibold leading-6 tabular-nums tracking-tight text-neutral-950">{orderActionCount}</strong>
              </div>
            </section>

            <section className="ruda-home-surface ruda-home-enter overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between px-3.5 py-3">
                <h2 className="text-sm font-semibold text-neutral-950">{mobileText('近期商品', 'Prodotti recenti')}</h2>
                <button type="button" onClick={() => setActiveTab('products')} className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-neutral-600">
                  {mobileText('全部', 'Tutti')}<ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {recentProducts.length > 0 ? <div className="divide-y divide-neutral-100 px-3.5">
                {recentProducts.map(product => {
                  const available = product.skus.reduce((total, sku) => total + Math.max(0, Number(sku.stockCentral || 0) - Number(sku.reserved || 0)), 0);
                  return <button key={product.id} type="button" onClick={() => { setSelectedProduct(product); setActiveTab('products'); }} className="ruda-home-list-row flex min-h-14 w-full items-center gap-3 py-2.5 text-left">
                    <ProductImage src={product.images[0]} alt={product.name} contain className="h-11 w-11 shrink-0 rounded-md bg-neutral-50" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-neutral-900">{product.styleNo}</span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">{product.name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-medium tabular-nums text-neutral-900">€{product.wholesalePrice.toFixed(2)}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{available} {mobileText('件', 'pz')}</span>
                    </span>
                  </button>;
                })}
              </div> : <div className="flex min-h-20 items-center justify-center px-4 text-xs text-neutral-500">
                {mobileText('暂无商品', 'Nessun prodotto')}
              </div>}
            </section>

            <section className="ruda-home-surface ruda-home-enter overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between px-3.5 py-3">
                <h2 className="text-sm font-semibold text-neutral-950">{mobileText('待办事项', 'Da fare')}</h2>
              </div>
              <div className="divide-y divide-neutral-100 px-3.5">
                {lowStockProductCount > 0 && <button type="button" onClick={() => { setProductQuickFilter('low_stock'); setProductZoneFilter('all'); setActiveTab('products'); }} className="ruda-home-list-row flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-neutral-700" aria-hidden="true" />
                  <span className="flex-1 text-xs font-medium text-neutral-800">{mobileText('低库存商品', 'Scorte basse')}</span>
                  <strong className="text-sm font-semibold tabular-nums text-neutral-950">{lowStockProductCount}</strong>
                  <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                </button>}
                {pendingCustomerVaultCount > 0 && <button type="button" onClick={() => setActiveTab('customers')} className="ruda-home-list-row flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <Users className="h-5 w-5 shrink-0 text-neutral-700" aria-hidden="true" />
                  <span className="flex-1 text-xs font-medium text-neutral-800">{mobileText('待审核客户', 'Clienti da verificare')}</span>
                  <strong className="text-sm font-semibold tabular-nums text-neutral-950">{pendingCustomerVaultCount}</strong>
                  <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                </button>}
                {lowStockProductCount === 0 && pendingCustomerVaultCount === 0 && (
                  <p className="py-3 text-xs text-neutral-400">{mobileText('暂无待办', 'Nessuna attività')}</p>
                )}
              </div>
            </section>

            <details className="ruda-home-surface ruda-home-enter overflow-hidden rounded-xl border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-neutral-600" aria-hidden="true" />
                  <span>{mobileText('生产运营', 'Produzione')}</span>
                </div>
                <span className="text-xs font-normal text-neutral-500">{lowMaterialCount > 0 || activeWorkOrders.length > 0 ? `${lowMaterialCount} ${mobileText('物料预警', 'Materiali')} · ${activeWorkOrders.length} ${mobileText('工单', 'lavori')}` : mobileText('暂无生产预警', 'Nessun avviso')}</span>
              </summary>
              <div className="border-t border-neutral-100">
              <div className="flex justify-end px-3 pt-2">
                <button type="button" onClick={() => void refreshFactoryData()} disabled={factoryLoading} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-neutral-600 disabled:opacity-40">
                  <Loader2 className={`h-3.5 w-3.5 ${factoryLoading ? 'animate-spin' : ''}`} />
                  {factoryLoading ? mobileText('同步中', 'Sync') : mobileText('刷新', 'Refresh')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-4">
                <div className={`rounded-2xl p-3.5 ${lowMaterialCount ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                  <span className={`block text-[10px] font-medium ${lowMaterialCount ? 'text-rose-500' : 'text-emerald-600'}`}>{mobileText('物料预警', 'Materiali')}</span>
                  <strong className={`mt-1 block text-[22px] font-black ${lowMaterialCount ? 'text-rose-700' : 'text-emerald-700'}`}>{lowMaterialCount}</strong>
                </div>
                <div className="rounded-2xl p-3.5 bg-indigo-50 border border-indigo-100">
                  <span className="block text-[10px] font-medium text-indigo-500">{mobileText('进行工单', 'Lavori')}</span>
                  <strong className="mt-1 block text-[22px] font-black text-indigo-700">{activeWorkOrders.length}</strong>
                </div>
              </div>
              {(lowMaterialCount > 0 || activeWorkOrders.length > 0) && (
                <div className="space-y-2 border-t border-neutral-100 p-3.5">
                  {factoryMaterials.filter(m => m.availableQuantity <= m.reorderPoint).slice(0, 2).map(material => (
                    <div key={material.id} className="flex items-center justify-between rounded-2xl bg-rose-50 px-3 py-2.5">
                      <span className="truncate pr-2 text-[11px]"><strong className="text-rose-800">{material.code}</strong> <span className="text-rose-700/70">· {material.name}</span></span>
                      <span className="shrink-0 text-[11px] font-bold text-rose-700">{material.availableQuantity.toFixed(0)}/{material.reorderPoint.toFixed(0)}</span>
                    </div>
                  ))}
                  {activeWorkOrders.slice(0, 2).map(workOrder => (
                    <div key={workOrder.id} className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-50 px-3 py-2.5">
                      <span className="min-w-0 truncate text-[11px]"><strong className="text-indigo-800">{workOrder.workOrderNo}</strong> <span className="text-indigo-700/70">· {workOrder.product.styleNo}</span></span>
                      <div className="flex gap-1.5 shrink-0">
                        <button type="button" onClick={() => void advanceWorkOrder(workOrder)} disabled={!['draft', 'released', 'in_progress', 'qc_hold'].includes(workOrder.status) || factoryBusyId === workOrder.id} className="rounded-xl bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40 active:scale-95">
                          {factoryBusyId === workOrder.id ? '...' : workOrder.status === 'draft' ? mobileText('释放', 'Rilascia') : workOrder.status === 'released' ? mobileText('开工', 'Avvia') : workOrder.status === 'in_progress' ? mobileText('质检', 'QC') : mobileText('继续', 'Vai')}
                        </button>
                        {['released', 'in_progress', 'qc_hold'].includes(workOrder.status) && (
                          <button type="button" onClick={() => setReportingWorkOrder(workOrder)} className="rounded-xl border border-indigo-300 bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700 active:scale-95">{mobileText('报产', 'Report')}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-neutral-100 p-3.5">
                <button type="button" onClick={() => { setShowMaterialManager(value => !value); if (!showMaterialManager) void refreshFactoryMaterials(); }} className="flex w-full items-center justify-between rounded-[8px] border border-neutral-200 bg-white px-3 py-2 text-left text-[11px] font-bold text-neutral-800 active:bg-neutral-50">
                  <span>{showMaterialManager ? '收起' : '管理面辅料'}</span><ChevronRight className={`h-4 w-4 transition-transform ${showMaterialManager ? 'rotate-90' : ''}`} />
                </button>
                {showMaterialManager && <div className="mt-3 space-y-3">
                  <form onSubmit={event => void saveFactoryMaterial(event)} className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-2"><strong className="text-[11px]">{editingMaterialId ? '编辑面辅料资料' : '创建面料 / 辅料档案'}</strong>{editingMaterialId && <button type="button" onClick={() => openMaterialEditor()} className="text-[10px] font-semibold text-neutral-500">取消编辑</button>}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input required maxLength={80} value={materialForm.code} onChange={event => setMaterialForm(previous => ({ ...previous, code: event.target.value }))} placeholder="物料编码" className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                      <input required maxLength={200} value={materialForm.name} onChange={event => setMaterialForm(previous => ({ ...previous, name: event.target.value }))} placeholder="面料 / 辅料名称" className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                      <select value={materialForm.category} onChange={event => setMaterialForm(previous => ({ ...previous, category: event.target.value }))} className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]"><option value="fabric">面料</option><option value="lining">里料</option><option value="trim">辅料 / 配件</option><option value="label">标签 / 标牌</option><option value="packaging">包装材料</option><option value="other">其他</option></select>
                      <select value={materialForm.unit} disabled={editingMaterialUnitLocked} onChange={event => setMaterialForm(previous => ({ ...previous, unit: event.target.value }))} className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] disabled:bg-neutral-100"><option value="meter">米</option><option value="piece">件 / 个</option><option value="kg">千克</option><option value="roll">卷</option></select>
                      <input type="number" min="0" step="0.0001" value={materialForm.unitCost} onChange={event => setMaterialForm(previous => ({ ...previous, unitCost: event.target.value }))} placeholder="单位成本 (€)" className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                      <input type="number" min="0" step="0.001" value={materialForm.reorderPoint} onChange={event => setMaterialForm(previous => ({ ...previous, reorderPoint: event.target.value }))} placeholder="安全库存" className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                      <input type="number" min="0" step="1" value={materialForm.leadTimeDays} onChange={event => setMaterialForm(previous => ({ ...previous, leadTimeDays: event.target.value }))} placeholder="采购交期（天）" className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                      <select value={materialForm.status} onChange={event => setMaterialForm(previous => ({ ...previous, status: event.target.value }))} className="min-w-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]"><option value="active">启用</option><option value="suspended">停用</option></select>
                      <textarea maxLength={2000} rows={2} value={materialForm.notes} onChange={event => setMaterialForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="规格备注：成分、克重、幅宽、颜色号等" className="col-span-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px]" />
                    </div>
                    {editingMaterialUnitLocked && <p className="text-[10px] text-neutral-500">已关联 · 单位锁定</p>}
                    <button type="submit" disabled={materialBusy} className="ruda-btn-primary w-full text-[13px]">{materialBusy ? '保存中…' : editingMaterialId ? '保存物料修改' : '创建物料'}</button>
                  </form>
                  <form onSubmit={event => void receiveFactoryMaterial(event)} className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <strong className="block text-[11px] text-emerald-900">收货入库</strong>
                    <select value={materialInbound.materialId} onChange={event => setMaterialInbound(previous => ({ ...previous, materialId: event.target.value }))} className="w-full rounded-lg border border-emerald-100 bg-white px-2.5 py-2 text-[11px]">
                      <option value="">选择启用中的面辅料</option>
                      {factoryMaterials.filter(material => material.status === 'active').map(material => <option key={material.id} value={material.id}>{material.code} · {material.name}（{material.unit}）</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2"><input required type="number" min="0.001" step="0.001" value={materialInbound.quantity} onChange={event => setMaterialInbound(previous => ({ ...previous, quantity: event.target.value }))} placeholder={`收货数量 ${factoryMaterials.find(material => material.id === materialInbound.materialId)?.unit || ''}`} className="min-w-0 rounded-lg border border-emerald-100 bg-white px-2.5 py-2 text-[11px]" /><input maxLength={500} value={materialInbound.note} onChange={event => setMaterialInbound(previous => ({ ...previous, note: event.target.value }))} placeholder="送货单 / 备注" className="min-w-0 rounded-lg border border-emerald-100 bg-white px-2.5 py-2 text-[11px]" /></div>
                    <button type="submit" disabled={materialBusy || !factoryMaterials.some(material => material.id === materialInbound.materialId && material.status === 'active')} className="w-full rounded-lg bg-emerald-700 py-2.5 text-[11px] font-bold text-white disabled:opacity-50">{materialBusy ? '处理中…' : '确认收货入库'}</button>
                  </form>
                  <div className="space-y-2">
                    {factoryMaterials.map(material => <div key={material.id} className="rounded-xl border border-neutral-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-[11px]">{material.code} · {material.name}</strong><span className="mt-1 block text-[10px] text-neutral-500">{material.category} · {material.unit} · 成本 €{material.unitCost.toFixed(4)} · 安全库存 {material.reorderPoint} · {material.status === 'active' ? '启用' : '停用'}</span><span className="mt-1 block text-[10px] font-semibold text-emerald-700">可用 {material.availableQuantity.toFixed(3)} / 现有 {material.onHandQuantity.toFixed(3)} {material.unit}</span></div><button type="button" onClick={() => openMaterialEditor(material)} className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-bold text-neutral-700">编辑</button></div>
                    </div>)}
                    {factoryMaterials.length === 0 && <p className="rounded-lg bg-neutral-50 p-3 text-center text-[10px] text-neutral-500">先建物料再收货</p>}
                  </div>
                </div>}
              </div>
              {factoryMaterials.length === 0 && factoryWorkOrders.length === 0 && !factoryLoading && (
                <div className="border-t border-neutral-100 px-4 py-4 text-[11px] text-neutral-400 text-center">{mobileText('暂无生产数据', 'Nessun dato produzione')}</div>
              )}
              </div>
            </details>

          </div>
        )}

        {activeTab === 'products' && (
          <div className="ruda-products-page -mx-4 -mt-2 min-h-[calc(100dvh-150px)] bg-white pb-[calc(60px+env(safe-area-inset-bottom))]">
            {/* 固定顶部：标题与上传、搜索、快捷筛选、商品分区 */}
            <div className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1.5 backdrop-blur-xl">
              <div className="flex h-10 items-center justify-between gap-3">
                <h1 className="truncate text-[19px] font-semibold tracking-tight text-neutral-950">{mobileText('商品', 'Prodotti')}</h1>
                <button
                  type="button"
                  disabled={creatingProductDefaultsBusy}
                  onClick={() => void beginMobileProductCreation(null as any)}
                  className="inline-flex h-8 shrink-0 items-center rounded-md bg-neutral-950 px-3 text-[12px] font-medium text-white disabled:opacity-50"
                >
                  {mobileText('上传商品', 'Carica prodotto')}
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder={mobileText('搜索款号、商品名称或 SKU', 'Cerca codice, nome o SKU')}
                  aria-label={mobileText('搜索款号、商品名称或 SKU', 'Cerca codice, nome o SKU')}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[13px] outline-none focus:border-neutral-500"
                />
              </div>

              {/* 快捷筛选：商品 / 低库存 / 新款 / 已售出，数量来自当前权限内的真实数据 */}
              <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label={mobileText('快捷筛选', 'Filtri rapidi')}>
                {([
                  { filter: 'all' as MerchantProductQuickFilter, label: mobileText('商品', 'Prodotti'), Icon: Boxes },
                  { filter: 'low_stock' as MerchantProductQuickFilter, label: mobileText('低库存', 'Scorte basse'), Icon: AlertTriangle },
                  { filter: 'new_arrival' as MerchantProductQuickFilter, label: mobileText('新款', 'Novità'), Icon: Sparkles },
                  { filter: 'sold' as MerchantProductQuickFilter, label: mobileText('已售出', 'Venduti'), Icon: Receipt }
                ]).map(({ filter, label, Icon }) => {
                  const isActive = productQuickFilter === filter;
                  const soldPending = filter === 'sold' && !productSalesSummary;
                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={isActive}
                      aria-busy={filter === 'sold' ? productSalesLoading : undefined}
                      title={soldPending && productSalesError ? mobileText('已售出数据读取失败，点击重试', 'Vendite non disponibili, tocca per riprovare') : undefined}
                      onClick={() => {
                        setProductQuickFilter(filter);
                        if (filter === 'sold' && !productSalesSummary && !productSalesLoading) void loadProductSalesSummary();
                      }}
                      className={`flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[6px] transition-colors ${isActive ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                    >
                      <span className="flex min-w-0 items-center gap-1 leading-none">
                        <Icon aria-hidden="true" />
                        <span className="truncate text-[11px]">{label}</span>
                      </span>
                      <span className={`text-[10px] leading-none tabular-nums ${isActive ? 'text-white/65' : 'text-neutral-400'}`}>
                        {soldPending ? '—' : productQuickFilterCounts[filter]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 商品分区：现货 / 折扣 / 授权，一件商品只归属一个分区 */}
              <div className="mt-1 flex items-center gap-4 overflow-x-auto scrollbar-hide" role="group" aria-label={mobileText('商品分区', 'Reparti prodotto')}>
                {([
                  ['new', mobileText('现货', 'Pronta consegna')],
                  ['clearance', mobileText('折扣', 'Mercato outlet')],
                  ['private', mobileText('授权', 'Area autorizzata')]
                ] as const).map(([zone, label]) => {
                  const isActive = productZoneFilter === zone;
                  return (
                    <button
                      key={zone}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setProductZoneFilter(zone)}
                      className={`inline-flex h-8 shrink-0 items-center gap-1 border-b-2 text-[12px] ${isActive ? 'border-neutral-950 font-semibold text-neutral-950' : 'border-transparent text-neutral-500'}`}
                    >
                      <span>{label}</span>
                      <span className="tabular-nums text-neutral-400">{productZoneCounts[zone]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 工具栏：批量选择与类目/排序筛选，随列表滚动 */}
            <div className="flex h-9 items-center justify-between border-b border-neutral-100 px-4 text-[12px]">
              <span className="text-neutral-400">
                {(searchQuery.trim() || productQuickFilter !== 'all' || productCategory !== 'all') ? `筛选结果 ${visibleProducts.length} 件` : ''}
              </span>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => { setProductSelectionMode(value => !value); setSelectedProductIds(new Set()); }} className="font-medium text-neutral-600">
                  {productSelectionMode ? `已选 ${selectedProductIds.size}` : '批量选择'}
                </button>
                <button type="button" onClick={() => setShowProductFilters(value => !value)} className="font-medium text-neutral-600">
                  筛选
                </button>
              </div>
            </div>

            {showProductFilters && (
              <div className="grid grid-cols-2 gap-2 border-b border-neutral-200 px-4 py-2">
                <select aria-label="商品分类筛选" value={productCategory} onChange={event => setProductCategory(event.target.value)} className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-xs">
                  <option value="all">全部类目</option>
                  {productCategories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
                <select aria-label="商品排序" value={productSort} onChange={event => setProductSort(event.target.value as typeof productSort)} className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-xs">
                  <option value="updated">最新款号</option>
                  <option value="stock">库存低→高</option>
                  <option value="price">价格高→低</option>
                </select>
              </div>
            )}

            {/* 商品列表 */}
            <div className="divide-y divide-neutral-100 px-4">
              {visibleProducts.map(product => (
              <div key={product.id} className="ruda-product-row flex h-[94px] items-center gap-3 py-2">
                  {productSelectionMode && (
                    <input
                      type="checkbox"
                      aria-label={`选择 ${product.name}`}
                      checked={selectedProductIds.has(product.id)}
                      onChange={event => setSelectedProductIds(previous => {
                        const next = new Set(previous);
                        if (event.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        return next;
                      })}
                      className="h-4 w-4 shrink-0 accent-neutral-900"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => productSelectionMode ? setSelectedProductIds(previous => {
                      const next = new Set(previous);
                      if (next.has(product.id)) next.delete(product.id);
                      else next.add(product.id);
                      return next;
                    }) : setSelectedProduct(product)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ProductImage src={product.images[0]} alt={product.name} contain className="h-[78px] w-16 shrink-0 rounded-[6px] bg-neutral-50" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-950">{product.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[12px] text-neutral-400">{product.styleNo}</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-sm font-semibold tabular-nums text-neutral-950">€{product.wholesalePrice.toFixed(2)}</span>
                        <span className="text-[12px] text-neutral-400">{new Set(product.skus.map(sku => sku.color).filter(Boolean)).size}色 · {new Set(product.skus.map(sku => sku.size).filter(Boolean)).size}码</span>
                      </div>
                      {productQuickFilter === 'sold' && (
                        <span className="mt-0.5 block text-[11px] text-neutral-500">
                          {mobileText('已售', 'Venduto')} {soldUnitsByProduct.get(product.id) || 0}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end justify-between self-stretch py-1">
                    <span className={`text-[12px] ${product.lifecycleStatus === 'published' || !product.lifecycleStatus ? 'text-emerald-600' : 'text-neutral-400'}`}>
                      {product.lifecycleStatus === 'published' || !product.lifecycleStatus ? '出售中' : '已下架'}
                    </span>
                    <button type="button" aria-label={`商品操作 ${product.name}`} onClick={() => setSelectedProduct(product)} className="flex h-8 w-8 items-center justify-center text-neutral-400">
                      <Ellipsis className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
              {visibleProducts.length === 0 && (
                merchantProducts.length === 0
                  ? <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-neutral-400"><Boxes className="h-10 w-10 stroke-1" /><span className="text-sm">暂无商品</span></div>
                  : <div className="flex min-h-28 items-center justify-center text-sm text-neutral-400">
                      {(searchQuery.trim() || productQuickFilter !== 'all' || productCategory !== 'all') ? '暂无匹配商品' : mobileText('该分区暂无商品', 'Nessun prodotto in questo reparto')}
                    </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h1 className="text-[15px] font-bold text-neutral-900">{mobileText('库存', 'Scorte')}</h1>
              <button
                type="button"
                onClick={() => setInventoryRefreshNonce(value => value + 1)}
                disabled={inventoryLoading}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-semibold text-neutral-700 shadow-sm disabled:opacity-50"
              >
                <Loader2 className={`h-3.5 w-3.5 ${inventoryLoading ? 'animate-spin' : ''}`} />
                {mobileText('刷新', 'Aggiorna')}
              </button>
            </div>
            {inventoryLoading && (
              <div className="rounded-3xl bg-white p-8 text-center text-[12px] text-neutral-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {mobileText('读取库存中...', 'Caricamento scorte...')}
              </div>
            )}
            {inventoryError && !inventoryLoading && (
              <div className="rounded-3xl bg-rose-50 border border-rose-100 p-4 text-[12px] text-rose-700">
                ⚠️ {inventoryError}
              </div>
            )}
            {!inventoryLoading && !inventoryError && inventoryByProduct.length === 0 && (
              <div className="rounded-3xl bg-white p-10 text-center text-[12px] text-neutral-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {mobileText('暂无库存数据', 'Nessuna scorta')}
              </div>
            )}
            <div className="space-y-3">
              {inventoryByProduct.map(({ product, balances }) => {
                const totalStock = balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
                const totalAvailable = balances.reduce((sum, balance) => sum + balance.availableQuantity, 0);
                const isLow = totalStock < 30;
                const productImage = merchantProducts.find(item => item.id === product.id)?.images[0];

                return (
                  <div key={product.id} className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <ProductImage src={productImage} alt={product.name} contain className="w-12 h-12 rounded-2xl bg-neutral-50 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[13px] font-black text-neutral-900 tracking-tight">{product.styleNo}</div>
                          <div className="text-[11px] text-neutral-500 truncate mt-0.5">{product.name}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-medium text-neutral-400">{mobileText('可售/在库', 'Disp./Tot.')}</div>
                        <div className={`text-[15px] font-black ${isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {totalAvailable}<span className="text-neutral-300 text-[11px] font-bold">/{totalStock}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-100">
                      {balances.map(balance => (
                        <div key={balance.id} className="rounded-2xl bg-neutral-50 p-2.5 text-center">
                          <span className="text-[9px] font-medium text-neutral-400 block truncate">{balance.location.name}</span>
                          <span className="font-bold text-[13px] text-neutral-800 block">{balance.availableQuantity}</span>
                          {balance.inTransitQuantity > 0 && (
                            <span className="text-[9px] font-bold text-blue-600 block mt-0.5">+{balance.inTransitQuantity} {mobileText('在途', 'transito')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <MerchantMobileOrderWorkspace
            orders={merchantOrders}
            products={merchantProducts}
            customers={merchantCustomers}
            onOpenOrder={setSelectedOrderDetail}
            onOpenPos={() => { setPosReturnTab('orders'); setActiveTab('pos'); }}
            onRefreshOrders={async () => {
              const result = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
              result.orders.forEach(replaceOrderFromServer);
              return result.orders;
            }}
            onNotify={addNotification}
          />
        )}

        {activeTab === 'growth' && mobileGrowthSection === 'overview' && (
          <div className="space-y-4 animate-fadeIn">
            <section className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-5 text-white shadow-xl shadow-indigo-950/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-white/60">{mobileText('增长与经营分析', 'Crescita e analisi')}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/50"><span>{mobileText('订单近 30 日', 'Ordini ultimi 30 gg')}</span><span>{mobileText('库存为当前值', 'Scorte attuali')}</span></div>
                </div>
                <button
                  type="button"
                  aria-label={mobileText('刷新经营分析', 'Aggiorna analisi')}
                  onClick={() => void refreshOperationsIntelligence().catch(error => addNotification('warning', '经营分析刷新失败', error instanceof Error ? error.message : '请稍后重试'))}
                  disabled={growthLoading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-50"
                >
                  <Loader2 className={`h-4 w-4 ${growthLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <nav aria-label={localizeCopy('增长子页面', 'Sezioni crescita')} className="mt-4 flex gap-1 rounded-xl bg-white/10 p-1">
                {([
                  ['overview', localizeCopy('增长概览', 'Panoramica')],
                  ['autopilot', 'Autopilot'],
                  ['campaigns', localizeCopy('宣传活动', 'Campagne')]
                ] as const).map(([section, label]) => (
                  <button
                    key={section}
                    type="button"
                    aria-current={mobileGrowthSection === section ? 'page' : undefined}
                    onClick={() => setMobileGrowthSection(section)}
                    className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-semibold ${mobileGrowthSection === section ? 'bg-white text-neutral-900' : 'text-white/75'}`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {operationsIntelligence ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/10 p-3">
                      <span className="block text-[9px] text-white/50">{mobileText('近 30 日成交', 'Vendite ultimi 30 giorni')}</span>
                      <strong className="mt-1 block text-[17px] font-black">€{operationsIntelligence.summary.gmv30d.toLocaleString(getIntlLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <span className="block text-[9px] text-white/50">{mobileText('近 30 日订单', 'Ordini ultimi 30 giorni')}</span>
                      <strong className="mt-1 block text-[17px] font-black">{operationsIntelligence.summary.orders30d}</strong>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <span className="block text-[9px] text-white/50">{mobileText('近 7 日成交变化', 'Variazione ultimi 7 giorni')}</span>
                      <strong className={`mt-1 block text-[17px] font-black ${(operationsIntelligence.summary.gmvTrend || 0) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {(operationsIntelligence.summary.gmvTrend || 0) > 0 ? '+' : ''}{operationsIntelligence.summary.gmvTrend || 0}%
                      </strong>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <span className="block text-[9px] text-white/50">{mobileText('待履约 / 待退货', 'Da evadere / resi')}</span>
                      <strong className="mt-1 block text-[17px] font-black">{operationsIntelligence.summary.pendingFulfillment} / {operationsIntelligence.summary.pendingReturns}</strong>
                    </div>
                  </div>
                  {operationsIntelligence.generatedAt && (
                    <p className="mt-3 text-[9px] text-white/40">
                      {mobileText('数据更新于', 'Aggiornato')} {new Date(operationsIntelligence.generatedAt).toLocaleString(getIntlLocale(lang))}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-5 rounded-xl bg-white/10 p-3 text-[11px] text-white/70">
                  {growthLoading ? mobileText('正在读取经营数据…', 'Caricamento dati…') : mobileText('暂时没有经营分析数据。', 'Dati di analisi non disponibili.')}
                </p>
              )}
            </section>

            {operationsIntelligence && (
              <>
                <section className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-[13px] font-bold text-neutral-900">{mobileText('经营提醒', 'Avvisi operativi')}</h2>
                      <p className="mt-1 text-[10px] text-neutral-500">{mobileText('根据订单、退货与库存生成', 'Generati da ordini, resi e inventario')}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{operationsIntelligence.alerts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {operationsIntelligence.alerts.map((alert, index) => (
                      <div key={`${alert.type}-${index}`} className={`flex items-start gap-2 rounded-xl p-3 text-[10px] leading-4 ${
                        alert.severity === 'critical' ? 'bg-rose-50 text-rose-800'
                          : alert.severity === 'warning' ? 'bg-amber-50 text-amber-800'
                            : 'bg-blue-50 text-blue-800'
                      }`}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{alert.message}</span>
                      </div>
                    ))}
                    {operationsIntelligence.alerts.length === 0 && (
                      <p className="rounded-xl bg-emerald-50 p-3 text-[10px] text-emerald-800">{mobileText('暂无待办提醒', 'Nessun avviso in sospeso')}</p>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-[13px] font-bold text-neutral-900">{mobileText('补货建议', 'Suggerimenti di riordino')}</h2>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{mobileText('仅供建议', 'Solo suggerimenti')}</span><span>{mobileText('不自动下采购单', 'Nessun ordine automatico')}</span></div>
                    </div>
                    <button type="button" onClick={() => setActiveTab('inventory')} className="text-[10px] font-bold text-indigo-700">{mobileText('查看库存', 'Inventario')} →</button>
                  </div>
                  {operationsIntelligence.replenishment.length > 0 ? (
                    <div className="divide-y divide-neutral-100">
                      {operationsIntelligence.replenishment.slice(0, 10).map(item => (
                        <div key={item.variantId || item.sku} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-neutral-900">{item.name || item.styleNo}</p>
                            <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-500">{item.styleNo} · {item.sku}</p>
                            <p className="mt-1 text-[9px] text-neutral-500">
                              {mobileText('可售', 'Disponibile')} {item.availableQuantity} · {mobileText('30 日销量', 'Vendite 30 gg')} {item.sold30d}
                              {item.daysCover !== null ? ` · ${mobileText('可售天数', 'Copertura')} ${item.daysCover}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9px] text-neutral-500">{mobileText('建议补货', 'Riordino suggerito')}</p>
                            <strong className="text-[15px] font-black text-indigo-700">{item.suggestedQuantity}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-emerald-50 p-3 text-[10px] text-emerald-800">{mobileText('无优先补货 SKU', 'Nessun riordino prioritario')}</p>
                  )}
                </section>

                <section className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-[13px] font-bold text-neutral-900">{mobileText('滞销库存', 'Scorte lente')}</h2>
                      <p className="mt-1 text-[10px] text-neutral-500">{mobileText('复核促销、选品、采购', 'Rivedi promozioni e acquisti')}</p>
                    </div>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">{operationsIntelligence.slowMovers?.length || 0}</span>
                  </div>
                  {operationsIntelligence.slowMovers?.length ? (
                    <div className="divide-y divide-neutral-100">
                      {operationsIntelligence.slowMovers.slice(0, 8).map(item => (
                        <div key={item.variantId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-neutral-900">{item.name}</p>
                            <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-500">{item.styleNo} · {item.sku}</p>
                          </div>
                          <div className="shrink-0 text-right text-[10px]">
                            <p className="font-semibold text-neutral-800">{item.availableQuantity} {mobileText('件在库', 'disponibili')}</p>
                            <p className="mt-0.5 text-neutral-500">{item.sold30d} {mobileText('件 / 30 日', 'venduti / 30 gg')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-sky-50 p-3 text-[10px] text-sky-800">{mobileText('暂无低动销库存', 'Nessuna scorta lenta')}</p>
                  )}
                </section>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setActiveTab('orders')} className="rounded-2xl bg-neutral-900 px-3 py-3 text-[11px] font-bold text-white">{mobileText('处理待履约订单', 'Gestisci ordini')} →</button>
                  <button type="button" onClick={() => setActiveTab('products')} className="rounded-2xl bg-white px-3 py-3 text-[11px] font-bold text-neutral-800 shadow-sm">{mobileText('查看商品', 'Prodotti')} →</button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'growth' && mobileGrowthSection !== 'overview' && currentMerchant && currentMerchantId && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('增长工作区正在加载…', 'Caricamento crescita…')}</div>}>
            <MerchantGrowthWorkspace
              merchantId={currentMerchantId}
              merchantName={currentMerchant.name}
              merchantSharePath={merchantStorefrontOrigin(currentMerchant.storeSlug || currentMerchant.slug || currentMerchant.id)}
              products={merchantProducts}
              orders={merchantOrders}
              customers={merchantCustomers.map(customer => ({
                id: customer.id,
                companyName: customer.companyName,
                country: customer.country,
                status: customer.status,
                registrationDate: customer.appliedAt
              }))}
              isIt={mobileItalian}
              section={mobileGrowthSection}
              onSectionChange={setMobileGrowthSection}
              generateCopy={async prompt => {
                const result = await apiPost<{ reply: string }>('/api/merchant/assistant/query', {
                  question: prompt,
                  context: 'growth',
                  scope: mobileGrowthSection,
                  pageContext: {
                    route: 'growth',
                    section: mobileGrowthSection,
                    task: 'prepare_growth_campaign',
                    selectedObjectId: null,
                    filters: {}
                  }
                }, 30_000, { 'Idempotency-Key': `assistant-${crypto.randomUUID()}` });
                return result.reply;
              }}
              addNotification={addNotification}
            />
          </Suspense>
        )}

        {activeTab === 'production' && (
          <div className="space-y-4 animate-fadeIn">
            <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-5 text-white shadow-xl shadow-emerald-950/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-white/60">{mobileText('生产工作台', 'Produzione')}</p>
                  <p className="mt-1 text-[10px] text-white/50">{mobileText('工单进度与报工', 'Avanzamento e report')}</p>
                </div>
                <button
                  type="button"
                  aria-label={mobileText('刷新生产工单', 'Aggiorna ordini di produzione')}
                  onClick={() => void refreshFactoryData()}
                  disabled={factoryLoading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-50"
                >
                  <Loader2 className={`h-4 w-4 ${factoryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/10 p-3">
                  <span className="block text-[9px] text-white/50">{mobileText('进行中', 'In corso')}</span>
                  <strong className="mt-1 block text-[20px] font-black">{activeWorkOrders.length}</strong>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <span className="block text-[9px] text-white/50">{mobileText('待生产', 'Da avviare')}</span>
                  <strong className="mt-1 block text-[20px] font-black">{factoryWorkOrders.filter(item => ['draft', 'released'].includes(item.status)).length}</strong>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <span className="block text-[9px] text-white/50">{mobileText('物料预警', 'Materiali')}</span>
                  <strong className={`mt-1 block text-[20px] font-black ${lowMaterialCount ? 'text-rose-300' : 'text-emerald-300'}`}>{lowMaterialCount}</strong>
                </div>
              </div>
            </section>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-[10px] leading-5 text-blue-900">
              {mobileText('报产提交后，服务端会校验工单数量并按现有流程登记合格品与质检数量；状态更新和报产都需要生产权限。', 'Dopo l’invio, il server verifica le quantità e registra i pezzi conformi e gli scarti. Servono i permessi di produzione.')}
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[13px] font-bold text-neutral-900">{mobileText('生产工单', 'Ordini di produzione')}</h2>
                <span className="text-[10px] font-semibold text-neutral-400">{factoryWorkOrders.length} {mobileText('单', 'tot.')}</span>
              </div>
              {factoryLoading && factoryWorkOrders.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('正在读取生产工单…', 'Caricamento ordini di produzione…')}</div>
              ) : factoryWorkOrders.map(workOrder => {
                const progress = workOrder.plannedQuantity > 0
                  ? Math.min(100, Math.round((workOrder.completedQuantity + workOrder.rejectedQuantity) / workOrder.plannedQuantity * 100))
                  : 0;
                const statusLabel = workOrder.status === 'draft' ? mobileText('草稿', 'Bozza')
                  : workOrder.status === 'released' ? mobileText('待开工', 'Da avviare')
                    : workOrder.status === 'in_progress' ? mobileText('生产中', 'In produzione')
                      : workOrder.status === 'qc_hold' ? mobileText('质检中', 'Controllo qualità')
                        : workOrder.status === 'completed' ? mobileText('已完成', 'Completato')
                          : workOrder.status === 'cancelled' ? mobileText('已取消', 'Annullato') : workOrder.status;
                return (
                  <article key={workOrder.id} className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] font-bold text-neutral-900">{workOrder.workOrderNo}</p>
                        <p className="mt-1 truncate text-[12px] font-semibold text-neutral-800">{workOrder.product.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-neutral-500">{workOrder.product.styleNo} · {workOrder.variant.sku}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${
                        workOrder.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                          : workOrder.status === 'cancelled' ? 'bg-neutral-100 text-neutral-500'
                            : workOrder.status === 'qc_hold' ? 'bg-amber-50 text-amber-700'
                              : 'bg-indigo-50 text-indigo-700'
                      }`}>{statusLabel}</span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[9px] text-neutral-500">
                        <span>{mobileText('生产进度', 'Avanzamento')}</span>
                        <span>{workOrder.completedQuantity + workOrder.rejectedQuantity} / {workOrder.plannedQuantity} · {progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-neutral-500">
                        <span>{mobileText('合格', 'Conformi')}: {workOrder.completedQuantity}</span>
                        <span className="text-right">{mobileText('不合格', 'Scarti')}: {workOrder.rejectedQuantity}</span>
                        <span>{mobileText('成品仓', 'Magazzino')}: {workOrder.outputLocation.name}</span>
                        <span className="text-right">{workOrder.dueDate ? `${mobileText('交期', 'Scadenza')}: ${new Date(workOrder.dueDate).toLocaleDateString(getIntlLocale(lang))}` : mobileText('未设交期', 'Nessuna scadenza')}</span>
                      </div>
                    </div>
                    {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                      <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
                        <button
                          type="button"
                          onClick={() => void advanceWorkOrder(workOrder)}
                          disabled={!['draft', 'released', 'in_progress', 'qc_hold'].includes(workOrder.status) || factoryBusyId === workOrder.id}
                          className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-[10px] font-bold text-white disabled:opacity-40"
                        >
                          {factoryBusyId === workOrder.id ? mobileText('更新中…', 'Aggiornamento…')
                            : workOrder.status === 'draft' ? mobileText('释放工单', 'Rilascia')
                              : workOrder.status === 'released' ? mobileText('开始生产', 'Avvia produzione')
                                : workOrder.status === 'in_progress' ? mobileText('提交质检', 'Invia al controllo') : mobileText('继续生产', 'Riprendi')}
                        </button>
                        {['released', 'in_progress', 'qc_hold'].includes(workOrder.status) && (
                          <button
                            type="button"
                            onClick={() => { setReportForm({ goodQuantity: '', rejectedQuantity: '0', note: '' }); setReportingWorkOrder(workOrder); }}
                            className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-[10px] font-bold text-indigo-700"
                          >{mobileText('报产入库', 'Registra produzione')}</button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
              {!factoryLoading && factoryWorkOrders.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">
                  {mobileText('暂无生产工单。', 'Nessun ordine di produzione.')}
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={() => { setShowMaterialManager(true); setActiveTab('dashboard'); }}
              className="flex w-full items-center justify-between rounded-2xl bg-neutral-900 px-4 py-3 text-left text-[11px] font-bold text-white"
            >
              <span>{mobileText('打开物料台账与入库管理', 'Apri materiali e carichi')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === 'procurement' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('采购工作区正在加载…', 'Caricamento acquisti…')}</div>}>
            <MerchantProcurementWorkspace products={merchantProducts} isIt={mobileItalian} />
          </Suspense>
        )}

        {activeTab === 'content' && currentMerchant && currentMerchantId && (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                ['metaobject', mobileText('元对象', 'Metaoggetti')],
                ['page', mobileText('页面', 'Pagine')],
                ['blog', mobileText('博客文章', 'Articoli del blog')],
                ['menu', mobileText('菜单', 'Menu')]
              ] as const).map(([section, label]) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => setMobileContentSection(section)}
                  className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-semibold ${mobileContentSection === section ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500">{mobileText('内容工作台正在加载…', 'Caricamento contenuti…')}</div>}>
              <MerchantContentWorkspace
                merchantId={currentMerchantId}
                merchantName={currentMerchant.name}
                isIt={mobileItalian}
                section={mobileContentSection}
                generateCopy={async prompt => {
                  const result = await apiPost<{ reply: string }>('/api/merchant/assistant/query', {
                    question: prompt,
                    context: 'content',
                    scope: mobileContentSection,
                    pageContext: {
                      route: 'content',
                      section: mobileContentSection,
                      task: 'create_content_draft',
                      selectedObjectId: null,
                      filters: {}
                    }
                  }, 30_000, { 'Idempotency-Key': `assistant-${crypto.randomUUID()}` });
                  return result.reply;
                }}
                addNotification={addNotification}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-5 text-white shadow-xl shadow-neutral-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-white/60">{mobileText('财务与结算', 'Finanza e liquidazioni')}</p>
                  <p className="mt-1 text-[10px] text-white/50">{mobileText('平台结算批次', 'Liquidazioni piattaforma')}</p>
                </div>
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              {financeSummary ? (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {[
                    [mobileText('销售总额', 'Vendite lorde'), financeSummary.totalGross],
                    [mobileText('退款扣减', 'Rimborsi'), financeSummary.totalRefunds],
                    [mobileText('平台与支付费用', 'Commissioni'), financeSummary.totalFees],
                    [mobileText('结算净额', 'Netto liquidato'), financeSummary.totalNet]
                  ].map(([label, amount]) => (
                    <div key={label as string} className="rounded-2xl bg-white/10 p-3">
                      <span className="block text-[9px] text-white/50">{label}</span>
                      <strong className="mt-1 block text-[16px] font-black">€{Number(amount).toLocaleString(getIntlLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-white/10 p-3 text-[11px] text-white/70">{mobileText('正在读取结算数据…', 'Caricamento dati finanziari…')}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-5 text-amber-900"><span>{mobileText('无自动转账', 'Nessun bonifico automatico')}</span><span>{mobileText('结算人工登记', 'Registrazione manuale')}</span><span>{mobileText('确认对账不转账', 'La conferma non trasferisce fondi')}</span></div>

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[13px] font-bold text-neutral-900">{mobileText('结算', 'Liquidazioni')}</h2>
                <span className="text-[10px] font-semibold text-neutral-400">{financePayouts.length} {mobileText('笔', 'tot.')}</span>
              </div>
              {financePayouts.map(payout => (
                <article key={payout.id} className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-bold text-neutral-900">{payout.id}</p>
                      <p className="mt-1 text-[10px] text-neutral-500">{payout.period}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${
                      payout.status === 'paid' ? 'bg-emerald-50 text-emerald-700'
                        : payout.status === 'failed' ? 'bg-rose-50 text-rose-700'
                          : payout.status === 'processing' ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                    }`}>
                      {payout.status === 'paid' ? mobileText('已登记结算', 'Liquidato')
                        : payout.status === 'failed' ? mobileText('结算记录失败', 'Pagamento non riuscito')
                          : payout.status === 'processing' ? mobileText('人工处理中', 'In elaborazione')
                            : payout.merchantAcknowledgedAt ? mobileText('已确认对账', 'Riconciliazione confermata')
                              : mobileText('待对账', 'Da riconciliare')}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-[10px]">
                    <span className="text-neutral-500">{mobileText('销售总额', 'Vendite lorde')}</span>
                    <span className="text-right font-semibold text-neutral-800">€{payout.grossSales.toFixed(2)}</span>
                    <span className="text-neutral-500">{mobileText('平台抽佣', 'Commissione piattaforma')}</span>
                    <span className="text-right text-neutral-700">−€{payout.platformFeeAmount.toFixed(2)}</span>
                    <span className="text-neutral-500">{mobileText('支付手续费', 'Commissioni di pagamento')}</span>
                    <span className="text-right text-neutral-700">−€{payout.paymentProcessingFee.toFixed(2)}</span>
                    <span className="text-neutral-500">{mobileText('退款扣减', 'Rimborsi')}</span>
                    <span className="text-right text-neutral-700">−€{payout.refunds.toFixed(2)}</span>
                    <span className="font-bold text-neutral-900">{mobileText('结算净额', 'Netto liquidato')}</span>
                    <span className="text-right font-black text-neutral-900">€{payout.netPayout.toFixed(2)}</span>
                    <span className="text-neutral-500">{mobileText('收款账户（掩码）', 'Conto (mascherato)')}</span>
                    <span className="text-right font-mono text-neutral-700">{payout.bankAccount}</span>
                  </div>
                  {payout.status === 'paid' && (payout.settlementReference || payout.settlementProof) && (
                    <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-900">
                      {payout.settlementReference && <p>{mobileText('参考号', 'Riferimento')}: {payout.settlementReference}</p>}
                      {payout.settlementProof && <p className="break-all">{mobileText('结算凭证', 'Prova di pagamento')}: {payout.settlementProof}</p>}
                      {payout.settledBy && <p>{payout.settledBy}{payout.settledAt ? ` · ${new Date(payout.settledAt).toLocaleString(getIntlLocale(lang))}` : ''}</p>}
                    </div>
                  )}
                  {payout.status === 'pending' && !payout.merchantAcknowledgedAt && (
                    <button
                      type="button"
                      onClick={() => void acknowledgePayout(payout)}
                      disabled={financeBusyId !== null}
                      className="ruda-btn-primary ruda-btn-inline mt-3 px-4 text-[13px]"
                    >
                      {financeBusyId === payout.id ? mobileText('确认中…', 'Conferma…') : mobileText('确认对账', 'Conferma riconciliazione')}
                    </button>
                  )}
                  {payout.status === 'processing' && <p className="mt-3 text-[10px] text-neutral-500">{mobileText('平台人工处理中', 'Elaborazione manuale')}</p>}
                  {payout.status === 'failed' && <p className="mt-3 text-[10px] text-rose-700">{mobileText('联系客服核实', 'Contatta l’assistenza')}</p>}
                </article>
              ))}
              {financePayouts.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center text-[11px] text-neutral-500 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <span>{mobileText('暂无结算批次', 'Nessuna liquidazione')}</span><span className="mx-1">·</span><span>{mobileText('平台登记后显示', 'Visibile dopo la registrazione')}</span>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h1 className="text-lg font-semibold tracking-tight text-neutral-950">{mobileText('客户', 'Clienti')}</h1>
              <button type="button" onClick={() => setShowCustomerActions(true)} className="flex h-9 items-center gap-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white">
                <Plus className="w-3.5 h-3.5" />{mobileText('新增', 'Nuovo')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <span className="block text-[10px] text-neutral-500">{mobileText('客户数', 'Clienti')}</span>
                <strong className="mt-1 block text-lg font-semibold tabular-nums text-neutral-950">{filteredMerchantCustomers.length}</strong>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <span className="block text-[10px] text-neutral-500">{mobileText('订单金额', 'Ordini')}</span>
                <strong className="mt-1 block truncate text-lg font-semibold tabular-nums text-neutral-950">€{customerRevenue.toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <details className="group rounded-xl border border-neutral-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-neutral-800 marker:hidden">
                  {mobileText('筛选', 'Filtri')}
                  {customerFilter !== 'all' && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tabular-nums text-neutral-600">1</span>}
                  <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-neutral-200 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ['all', mobileText('全部', 'Tutti')],
                      ['good_customer', mobileText('好客户', 'Buoni clienti')],
                      ['regular_customer', mobileText('熟客户', 'Clienti abituali')],
                      ['new_customer', mobileText('新客户', 'Nuovi clienti')],
                      ['overdue_customer', mobileText('欠钱客户', 'Clienti insolventi')]
                    ].map(([filter, label]) => (
                      <button type="button" key={filter as string} onClick={() => setCustomerFilter(filter as typeof customerFilter)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${customerFilter === filter ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                        {label as string}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-600">
                    排序
                    <select value={customerSort} onChange={event => setCustomerSort(event.target.value as typeof customerSort)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-medium text-neutral-800">
                      <option value="latest">最近交易</option>
                      <option value="value">采购额最高</option>
                      <option value="orders">订单最多</option>
                      <option value="risk">风险优先</option>
                    </select>
                  </label>
                  <p className="text-[10px] text-neutral-500">{mobileText(`好客户 ${goodCustomerCount} 位 · 欠款客户 ${overdueCustomerCount} 位`, `${goodCustomerCount} buoni · ${overdueCustomerCount} insolventi`)}</p>
                </div>
              </details>
            </div>

            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-neutral-900">{mobileText('客户列表', 'Clienti')}</h2>
            </div>

            {showCustomerActions && (
              <div className="fixed inset-0 z-[75] flex items-end justify-center bg-neutral-950/50 p-0 sm:items-center sm:p-4" onClick={() => setShowCustomerActions(false)}>
                <div className="ruda-modal w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
                  <div className="flex items-center justify-between"><h3 className="text-base font-bold text-neutral-950">客户操作</h3><button type="button" onClick={() => setShowCustomerActions(false)} className="rounded-full bg-neutral-100 p-2 text-neutral-500"><X className="h-4 w-4" /></button></div>
                  <div className="mt-5 grid gap-2">
                    <button type="button" onClick={() => { setShowCustomerActions(false); setEditingCustomerId(null); setShowCustomerForm(true); }} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:border-neutral-900"><strong className="block text-sm text-neutral-900">新建客户</strong><span className="mt-1 block text-xs text-neutral-500">公司 · 联系人 · VAT</span></button>
                    <label className="cursor-pointer rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:border-neutral-900"><strong className="block text-sm text-neutral-900">导入客户</strong><span className="mt-1 block text-xs text-neutral-500">CSV 导入 · 重复邮箱/VAT 跳过</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; setShowCustomerActions(false); if (file) void importMobileCustomers(file); }} /></label>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredMerchantCustomers.map(({ customer, orders: customerOrders, orderValue, lastOrder, creditRatio, vaultRequest }) => (
                <button type="button" key={customer.id} onClick={() => setSelectedCustomer(customer)} className="w-full rounded-3xl bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
                        <span className="text-[14px] font-semibold text-neutral-700">{(customer.companyName || customer.contactPerson || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-neutral-900 truncate">{customer.companyName}</span>
                        <span className="block text-[11px] text-neutral-500 truncate mt-0.5">{customer.contactPerson || '未填写联系人'} · {customer.city || customer.country || '未填写地区'}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black ${customer.status === 'approved' ? 'bg-neutral-900 text-white' : customer.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {customer.status === 'approved' ? mobileText('已认证', 'OK') : customer.status === 'rejected' ? mobileText('拒绝', 'NO') : mobileText('待审', 'Attesa')}
                      </span>
                      <span className="text-[9px] font-bold text-neutral-500">{customerLevelLabel[customer.customerLevel || 'new_customer']}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-neutral-50">
                    <div className="text-center">
                      <span className="block text-[9px] font-medium text-neutral-400 mb-0.5">{mobileText('订单', 'Ordini')}</span>
                      <span className="text-[15px] font-black text-neutral-900">{customerOrders.length}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[9px] font-medium text-neutral-400 mb-0.5">{mobileText('采购', 'Acquisti')}</span>
                      <span className="text-[13px] font-black text-neutral-900">€{orderValue.toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[9px] font-medium text-neutral-400 mb-0.5">{mobileText('跟进', 'Stato')}</span>
                      <span className={`text-[10px] font-bold ${creditRatio >= 0.8 ? 'text-rose-600' : vaultRequest?.status === 'pending' ? 'text-neutral-700' : vaultRequest?.status === 'approved' ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {creditRatio >= 0.8 ? mobileText('风险', 'Rischio') : vaultRequest?.status === 'pending' ? mobileText('看货', 'Vault') : vaultRequest?.status === 'approved' ? mobileText('已授权', 'OK') : mobileText('正常', 'OK')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredMerchantCustomers.length === 0 && <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-center text-xs text-neutral-500">
                {merchantCustomers.length === 0 ? <div className="space-y-2"><p className="font-semibold text-neutral-800">暂无客户</p><p>新增客户或等待首笔订单</p><button type="button" onClick={() => { setEditingCustomerId(null); setShowCustomerForm(true); }} className="mt-1 rounded-lg bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white">新增客户</button></div> : <div className="space-y-2"><p>没有符合条件的客户</p><button type="button" onClick={() => { setCustomerQuery(''); setCustomerFilter('all'); }} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700">清除筛选</button></div>}
              </div>}
            </div>

            {selectedCustomer && (() => {
              const metric = customerMetrics.find(item => item.customer.id === selectedCustomer.id);
              const request = metric?.vaultRequest;
              return (
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-950/50 p-0 sm:items-center sm:p-4" onClick={() => setSelectedCustomer(null)}>
                  <div className="ruda-modal max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
                    <div className="flex items-start justify-between">
                      <div><h3 className="text-base font-bold text-neutral-950">{selectedCustomer.companyName}</h3><p className="mt-1 text-xs text-neutral-500">{selectedCustomer.contactPerson} · {selectedCustomer.businessType}</p></div>
                      <button type="button" onClick={() => setSelectedCustomer(null)} className="rounded-full bg-neutral-100 p-2 text-neutral-500"><X className="h-4 w-4" /></button>
                    </div>
                    <button type="button" onClick={() => openCustomerEditor(selectedCustomer)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 text-xs font-bold text-neutral-800"><Pencil className="h-3.5 w-3.5" />编辑客户资料</button>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-neutral-50 p-3"><span className="text-[10px] text-neutral-500">累计采购额</span><strong className="mt-1 block text-lg">€{(metric?.orderValue || 0).toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</strong></div>
                      <div className="rounded-xl bg-neutral-50 p-3"><span className="text-[10px] text-neutral-500">订单数量</span><strong className="mt-1 block text-lg">{metric?.orders.length || 0}</strong></div>
                    </div>
                    <div className="mt-4 space-y-2 text-xs">
                      <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3"><Mail className="h-4 w-4 text-neutral-500" />{selectedCustomer.email}</a>
                      <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3"><Phone className="h-4 w-4 text-neutral-500" />{selectedCustomer.phone}</a>
                      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3"><MapPin className="h-4 w-4 text-neutral-500" />{selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.country}</div>
                      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3"><CreditCard className="h-4 w-4 text-neutral-500" />信用额度 €{Number(selectedCustomer.creditLimit || 0).toLocaleString(getIntlLocale(lang))} · 已用 €{Number(selectedCustomer.usedCredit || 0).toLocaleString(getIntlLocale(lang))}</div>
                    </div>
                    {request?.status === 'pending' && (
                      <div className="mt-4 flex gap-2 border-t border-neutral-100 pt-4">
                        <button type="button" onClick={() => { void approveVaultAccess(request.id); setSelectedCustomer(null); }} className="flex-1 rounded-lg bg-neutral-950 py-2.5 text-xs font-bold text-white">授权私密货盘</button>
                        <button type="button" onClick={() => { void rejectVaultAccess(request.id); setSelectedCustomer(null); }} className="flex-1 rounded-lg bg-neutral-100 py-2.5 text-xs font-semibold text-neutral-700">拒绝申请</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {showCustomerForm && (
              <div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-950/50 p-0 sm:items-center sm:p-4" onClick={() => setShowCustomerForm(false)}>
                <form onSubmit={editingCustomerId ? saveMobileCustomer : createMobileCustomer} className="ruda-modal max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
                  <div className="flex items-start justify-between">
                    <div><h3 className="text-base font-bold text-neutral-950">{editingCustomerId ? '编辑客户资料' : '新增合作客户'}</h3></div>
                    <button type="button" onClick={() => { setShowCustomerForm(false); setEditingCustomerId(null); }} className="rounded-full bg-neutral-100 p-2 text-neutral-500"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {[
                      ['companyName', '公司名称 *', 'Milano Boutique'],
                      ['phone', '电话 *', '+39 ...'],
                      ['contactPerson', '联系人', '负责人姓名'],
                      ['email', '联系邮箱', 'buyer@example.com'],
                      ['vatNumber', 'VAT / P.IVA', 'IT01234567890'],
                      ['address', '公司地址', '完整地址']
                    ].map(([key, label, placeholder]) => (
                      <label key={key} className={key === 'address' ? 'col-span-2 text-[11px] font-semibold text-neutral-600' : 'text-[11px] font-semibold text-neutral-600'}>
                        {label}
                        <input required={key === 'companyName' || key === 'phone'} value={customerForm[key as keyof typeof customerForm]} onChange={event => setCustomerForm(previous => ({ ...previous, [key]: event.target.value }))} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-500" />
                      </label>
                    ))}
                    <label className="text-[11px] font-semibold text-neutral-600">国家
                      <select value={customerForm.country} onChange={event => setCustomerForm(previous => ({ ...previous, country: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal">
                        {['Italy', 'France', 'Germany', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'United Kingdom', 'Other'].map(country => <option key={country}>{country}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-neutral-600">城市
                      <select value={customerForm.city} onChange={event => setCustomerForm(previous => ({ ...previous, city: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal">
                        <option value="">选择城市（可选）</option>
                        {['Milano', 'Prato', 'Firenze', 'Roma', 'Torino', 'Bologna', 'Parigi', 'Lione', 'Berlino', 'Madrid', 'Lisboa', 'Amsterdam', '其他'].map(city => <option key={city}>{city}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-neutral-600">经营类型
                      <select value={customerForm.businessType} onChange={event => setCustomerForm(previous => ({ ...previous, businessType: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal">
                        <option>Boutique</option><option>Retail Store</option><option>Online Store</option><option>Department Store</option><option>Wholesale Buyer</option><option>Distributor</option><option>Brand</option><option>Stylist / Atelier</option><option>Other</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-neutral-600">客户等级
                      <select value={customerForm.customerLevel} onChange={event => setCustomerForm(previous => ({ ...previous, customerLevel: event.target.value as CustomerLevel }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal">
                        <option value="good_customer">好客户</option>
                        <option value="regular_customer">熟客户</option>
                        <option value="new_customer">新客户</option>
                        <option value="overdue_customer">欠钱客户</option>
                      </select>
                    </label>
                    <label className="col-span-2 text-[11px] font-semibold text-neutral-600">合作备注
                      <textarea value={customerForm.notes} onChange={event => setCustomerForm(previous => ({ ...previous, notes: event.target.value }))} maxLength={2000} placeholder="客户采购偏好、合作条件或跟进记录" className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal" />
                    </label>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-neutral-100 pt-4">
                    <button type="submit" disabled={customerFormBusy} className="flex-1 rounded-lg bg-neutral-950 py-2.5 text-xs font-bold text-white disabled:opacity-50">{customerFormBusy ? '保存中...' : editingCustomerId ? '保存客户资料' : '保存客户档案'}</button>
                    <button type="button" onClick={() => { setShowCustomerForm(false); setEditingCustomerId(null); }} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700">取消</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'store' && (
          currentMerchant
            ? <div className="-mx-4 -mt-2 animate-fadeIn"><MerchantStoreView embeddedInMerchantApp merchantId={currentMerchant.id} /></div>
            : <div className="rounded-3xl bg-white p-5 text-center text-[11px] text-neutral-500">{mobileText('当前没有可显示的商家网店。', 'Nessun negozio disponibile.')}</div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-5 text-white shadow-xl shadow-neutral-900/10">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
                  {currentMerchant?.logo ? (
                    <img
                      src={merchantMediaUrl(currentMerchant.logo, DEFAULT_MERCHANT_LOGO)}
                      alt={currentMerchant.name}
                      className="h-full w-full object-cover"
                      onError={event => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = DEFAULT_MERCHANT_LOGO;
                      }}
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-neutral-900" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-2xl font-black leading-tight sm:text-[26px]">{merchantProfileValue('name') || 'RUDA Merchant'}</p>
                  {merchantProfileValue('city') && (
                    <p className="text-[12px] text-white/60 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{merchantProfileValue('city')}, {merchantProfileValue('country') || 'IT'}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setMerchantProfileUnlocked(previous => !previous)} className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-bold ${merchantProfileUnlocked ? 'bg-white text-neutral-900' : 'bg-white/10 text-white'}`}>
                  {merchantProfileUnlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {merchantProfileUnlocked ? mobileText('编辑中', 'Modifica') : mobileText('解锁资料', 'Sblocca')}
                </button>
              </div>
              {!merchantProfileUnlocked && (
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-4 text-[10px]">
                  <p className="col-span-2 text-white/75">{merchantProfileValue('companyLegalName') || mobileText('未填法定公司名', 'Ragione sociale non indicata')}</p>
                  {merchantProfileValue('contactPerson') && <p className="text-white/60">{merchantProfileValue('contactPerson')}</p>}
                  <p className="truncate text-white/60">{merchantProfileValue('contactPhone') || mobileText('未填写电话', 'Telefono non indicato')}</p>
                  <p className="col-span-2 truncate text-white/60">{merchantProfileValue('contactEmail') || mobileText('未填写邮箱', 'Email non indicata')}</p>
                  {merchantProfileValue('vatNumber') && <p className="col-span-2 text-white/60">VAT · {merchantProfileValue('vatNumber')}</p>}
                  <p className="col-span-2 text-white/60">{merchantProfileValue('showroomAddress') || mobileText('尚未填写展厅地址', 'Indirizzo showroom non indicato')}</p>
                </div>
              )}
              {merchantProfileUnlocked && (
                <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                  {([
                    ['name', mobileText('店铺名称', 'Nome negozio')],
                    ['companyLegalName', mobileText('法定公司名', 'Ragione sociale')],
                    ['vatNumber', mobileText('VAT 税号', 'Partita IVA')],
                    ['contactPerson', mobileText('负责人', 'Referente')],
                    ['contactEmail', mobileText('联系邮箱', 'Email')],
                    ['contactPhone', mobileText('联系电话', 'Telefono')],
                    ['country', mobileText('国家', 'Paese')],
                    ['city', mobileText('城市', 'Città')],
                    ['showroomAddress', mobileText('展厅地址', 'Indirizzo showroom')]
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block text-[10px] font-semibold text-white/60">
                      {label}
                      <input value={merchantSettings[key]} onChange={event => setMerchantSettings(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 h-9 w-full rounded-xl border-0 bg-white/10 px-3 text-[12px] text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
                    </label>
                  ))}
                  <button type="button" onClick={() => void saveMerchantSettings()} disabled={merchantSettingsBusy} className="h-10 w-full rounded-xl bg-white text-[11px] font-bold text-neutral-900 disabled:opacity-50">
                    {merchantSettingsBusy ? mobileText('保存中...', 'Salvando...') : mobileText('保存店铺资料', 'Salva profilo')}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10">
                <div className="text-center">
                  <span className="block text-[9px] text-white/50 mb-0.5">{mobileText('30日成交', '30gg')}</span>
                  <span className="text-[16px] font-black">€{(operationsIntelligence?.summary.gmv30d || 0).toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[9px] text-white/50 mb-0.5">{mobileText('待发货', 'Spedire')}</span>
                  <span className="text-[16px] font-black text-amber-400">{operationsIntelligence?.summary.pendingFulfillment || 0}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[9px] text-white/50 mb-0.5">{mobileText('低库存', 'Scorte')}</span>
                  <span className={`text-[16px] font-black ${operationsIntelligence?.summary.lowStockSkus ? 'text-rose-400' : 'text-emerald-400'}`}>{operationsIntelligence?.summary.lowStockSkus || 0}</span>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-white">{mobileText('商务名片', 'Biglietto da visita')}</p>
                  </div>
                  <Share2 className="h-4 w-4 text-white/60" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" disabled={smartCardBusy} onClick={() => void shareSmartCard()} className="rounded-xl bg-white py-2.5 text-[10px] font-bold text-neutral-900 disabled:opacity-50"><Share2 className="mx-auto mb-1 h-4 w-4" />分享</button>
                  <button type="button" onClick={() => downloadSmartCard('vcf')} className="rounded-xl bg-white/10 py-2.5 text-[10px] font-bold text-white"><Download className="mx-auto mb-1 h-4 w-4" />联系人卡片</button>
                  <button type="button" onClick={() => downloadSmartCard('html')} className="rounded-xl bg-white/10 py-2.5 text-[10px] font-bold text-white"><Download className="mx-auto mb-1 h-4 w-4" />资料页</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={onSwitchToDesktop} className="flex items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-neutral-700" />
                </div>
                <div>
                  <span className="block text-[12px] font-bold text-neutral-900">{mobileText('电脑版', 'Desktop')}</span>
                  <span className="mt-1 block text-[10px] text-neutral-500">{mobileText('切换到桌面端管理', 'Passa alla gestione desktop')}</span>
                </div>
              </button>
            </div>

            {settingsSection === null && (
            <div className="rounded-3xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-[13px] font-bold text-neutral-900">{mobileText('设置中心', 'Impostazioni')}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">{mobileText('按业务模块管理 App 和店铺', 'Gestisci app e negozio per area')}</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-bold text-neutral-500">PRO</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ['operations', mobileText('运营偏好', 'Operatività'), `${mobileSettings.alerts ? mobileText('提醒已开', 'Avvisi attivi') : mobileText('提醒已关', 'Avvisi spenti')} · ${mobileSettings.compact ? mobileText('紧凑显示', 'Compatto') : mobileText('标准显示', 'Standard')}`],
                  ['store', mobileText('店铺运营规则', 'Regole negozio'), `MOQ ${merchantSettings.moq} · ${merchantSettings.defaultPaymentTerm === 'prepaid' ? mobileText('预付', 'Prepagato') : merchantSettings.defaultPaymentTerm.replace('net_', 'Net ')}`],
                  ['finance', mobileText('收款与账期', 'Pagamenti'), `${mobileBankAccounts.length} ${mobileText('个收款账户', 'conti')}`],
                  ['team', mobileText('团队与安全', 'Team e sicurezza'), `${teamEmployees.length} ${mobileText('名员工', 'dipendenti')}`],
                  ['apps', mobileText('应用管理', 'App'), mobileText('应用商店', 'App store')]
                ] as const).map(([key, label, description]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSettingsSection(key)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${settingsSection === key ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-900'}`}
                  >
                    <span className="block text-[12px] font-bold">{label}</span>
                    <span className={`mt-1 block text-[10px] ${settingsSection === key ? 'text-white/60' : 'text-neutral-500'}`}>{description}</span>
                  </button>
                ))}
              </div>
            </div>
            )}

            {settingsSection !== null && (() => {
              const meta = {
                operations: {
                  title: mobileText('运营偏好', 'Operatività'),
                  summary: mobileText('提醒、语言与通知偏好。', 'Avvisi, lingua e notifiche.'),
                  status: { label: mobileText('可用', 'Disponibile'), tone: 'ready' as const }
                },
                store: {
                  title: mobileText('店铺运营规则', 'Regole negozio'),
                  summary: mobileText('商品默认值、网店模板与公开政策。', 'Default prodotto, tema e policy.'),
                  status: { label: mobileText('可用', 'Disponibile'), tone: 'ready' as const }
                },
                finance: {
                  title: mobileText('收款与账期', 'Pagamenti'),
                  summary: mobileText('收款账户与结算记录。', 'Conti di incasso e incassi.'),
                  status: { label: mobileText('需人工', 'Manuale'), tone: 'manual' as const }
                },
                team: {
                  title: mobileText('团队与安全', 'Team e sicurezza'),
                  summary: mobileText('员工账号、角色与最近安全操作。', 'Dipendenti, ruoli e attività recenti.'),
                  status: { label: mobileText('可用', 'Disponibile'), tone: 'ready' as const }
                },
                apps: {
                  title: mobileText('应用管理', 'App'),
                  summary: mobileText('浏览已接入的应用。', 'App disponibili.'),
                  status: { label: mobileText('可用', 'Disponibile'), tone: 'ready' as const }
                }
              }[settingsSection];
              return (
                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setSettingsSection(null)} className="shrink-0 text-[11px] font-bold text-neutral-700">← {mobileText('返回设置中心', 'Impostazioni')}</button>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[11px] font-bold text-neutral-800">{meta.title}</span>
                      <MerchantSettingsStatusChip label={meta.status.label} tone={meta.status.tone} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">{meta.summary}</p>
                </div>
              );
            })()}
            {settingsSection === 'apps' && (
              <div className="fixed inset-0 z-[70] overflow-y-auto bg-white">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
                  <button type="button" onClick={() => { setSettingsSection(null); setActiveStoreAppId(null); }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700">返回设置</button>
                  <span className="text-sm font-bold text-neutral-900">{activeStoreAppId === 'ruda-production-chain' ? '智能生产链' : activeStoreAppId ? '应用管理' : '应用商店'}</span>
                  <span className="w-16" />
                </div>
                <Suspense fallback={<div className="p-6 text-sm text-neutral-500">应用商店正在加载…</div>}>
                  {activeStoreAppId === 'ruda-business-email'
                    ? <MerchantEmailDomains onBack={() => setActiveStoreAppId(null)} />
                    : activeStoreAppId === 'ruda-production-chain'
                      ? <MerchantProductionChain onBack={() => setActiveStoreAppId(null)} />
                      : <MerchantAppStore onOpenApp={setActiveStoreAppId} />}
                </Suspense>
              </div>
            )}

            {settingsSection === 'operations' && <div className="rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-neutral-50 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-neutral-700" />{mobileText('手机设置', 'Impostazioni')}
                </span>
              </div>
              {[
                { key: 'alerts' as const, label: mobileText('运营提醒', 'Notifiche'), enabled: mobileSettings.alerts },
                { key: 'sound' as const, label: mobileText('订单提示音', 'Suono ordini'), enabled: mobileSettings.sound },
                { key: 'compact' as const, label: mobileText('紧凑显示', 'Compatto'), enabled: mobileSettings.compact }
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-50 last:border-b-0">
                  <span className="text-[13px] font-semibold text-neutral-800">{item.label}</span>
                  <button type="button" role="switch" aria-checked={item.enabled} onClick={() => updateMobileSetting(item.key, !item.enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${item.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
              <div className="px-4 py-3.5 border-b border-neutral-50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-semibold text-neutral-600 mb-1">{mobileText('首页', 'Home')}</span>
                    <select value={merchantSettings.mobileDefaultTab} onChange={event => setMerchantSettings(previous => ({ ...previous, mobileDefaultTab: event.target.value }))} className="w-full h-9 rounded-xl bg-neutral-50 px-2.5 text-[11px] text-neutral-800 outline-none border-0">
                      <option value="dashboard">{mobileText('首页', 'Dashboard')}</option>
                      <option value="products">{mobileText('商品', 'Prodotti')}</option>
                      <option value="orders">{mobileText('订单', 'Ordini')}</option>
                      <option value="inventory">{mobileText('库存', 'Scorte')}</option>
                      <option value="finance">{mobileText('财务', 'Finanza')}</option>
                      <option value="growth">{mobileText('增长', 'Crescita')}</option>
                      <option value="production">{mobileText('生产', 'Produzione')}</option>
                      <option value="procurement">{mobileText('采购', 'Acquisti')}</option>
                      <option value="content">{mobileText('内容', 'Contenuti')}</option>
                      <option value="customers">{mobileText('客户', 'Clienti')}</option>
                      <option value="store">{mobileText('网店', 'Negozio')}</option>
                      <option value="profile">{mobileText('我的', 'Profilo')}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-600">{mobileText('语言', 'Lingua')}</span>
                    <LanguagePicker placement="top" />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3.5 border-b border-neutral-50">
                <p className="mb-2 text-[11px] font-bold text-neutral-600">{mobileText('业务通知', 'Avvisi operativi')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['notifyOrders', mobileText('新订单', 'Nuovi ordini')],
                    ['notifyPayouts', mobileText('收款到账', 'Pagamenti')],
                    ['notifyVault', mobileText('私密款申请', 'Richieste private')],
                    ['notifyMarketing', mobileText('营销消息', 'Marketing')]
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5 text-[11px] font-semibold text-neutral-700">
                      <span>{label}</span>
                      <input type="checkbox" checked={merchantSettings[key]} onChange={event => setMerchantSettings(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-neutral-900" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3.5">
                <button type="button" onClick={() => void saveMerchantSettings()} disabled={merchantSettingsBusy} className="w-full h-10 rounded-2xl bg-neutral-900 text-white text-[12px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform shadow-md shadow-neutral-900/10">
                  {merchantSettingsBusy ? mobileText('保存中...', 'Salvando...') : mobileText('保存设置', 'Salva')}
                </button>
              </div>
            </div>}

            {settingsSection === 'operations' && (
              <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-bold text-neutral-800">{mobileText('能力与边界', 'Copertura')}</p>
                <div className="mt-2">
                  <MerchantSettingsScopeList items={[
                    { label: mobileText('提醒与显示', 'Avvisi e display'), state: mobileText('可用', 'Disponibile'), tone: 'ready' },
                    { label: mobileText('业务通知', 'Avvisi operativi'), state: mobileText('可用', 'Disponibile'), tone: 'ready' },
                    { label: mobileText('客户事件', 'Eventi clienti'), state: mobileText('未接入', 'Non attivo'), tone: 'unavailable', detail: mobileText('在电脑版设置', 'Solo desktop') },
                    { label: mobileText('自定义数据', 'Dati personalizzati'), state: mobileText('未接入', 'Non attivo'), tone: 'unavailable' },
                    { label: mobileText('隐私与同意', 'Privacy e consensi'), state: mobileText('需人工', 'Manuale'), tone: 'manual' }
                  ]} />
                </div>
                <div className="mt-3">
                  <MerchantSettingsNote>{mobileText('客户事件、自定义数据与隐私导出在电脑版设置中处理。', 'Eventi clienti, dati personalizzati ed export privacy solo su desktop.')}</MerchantSettingsNote>
                </div>
              </div>
            )}

            {settingsSection === 'finance' && <div className="rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-neutral-50 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-neutral-700" />{mobileText('收款与结算', 'Pagamenti e incassi')}
                </span>
              </div>
              <div className="px-4 py-4">
                {financeSummary && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-neutral-50 p-2.5"><span className="block text-[9px] text-neutral-500">{mobileText('总交易', 'Lordo')}</span><strong className="mt-1 block text-[12px]">€{financeSummary.totalGross.toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</strong></div>
                    <div className="rounded-xl bg-neutral-50 p-2.5"><span className="block text-[9px] text-neutral-500">{mobileText('费用', 'Commissioni')}</span><strong className="mt-1 block text-[12px]">€{financeSummary.totalFees.toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</strong></div>
                    <div className="rounded-xl bg-emerald-50 p-2.5"><span className="block text-[9px] text-emerald-700">{mobileText('净结算', 'Netto')}</span><strong className="mt-1 block text-[12px] text-emerald-800">€{financeSummary.totalNet.toLocaleString(getIntlLocale(lang), { maximumFractionDigits: 0 })}</strong></div>
                  </div>
                )}
                <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-relaxed text-neutral-500"><span>{mobileText('IBAN 加密保存', 'IBAN cifrato')}</span><span>{mobileText('页面仅脱敏', 'Solo dati mascherati')}</span><span>{mobileText('换户需审核', 'Cambio soggetto a verifica')}</span><span>{mobileText('平台财务审核', 'Verifica finanziaria')}</span></div>
                {mobileBankAccounts.length === 0 ? (
                  <p className="rounded-2xl bg-amber-50 p-3 text-[11px] text-amber-700">{mobileText('尚未提交收款账户', 'IBAN non configurato')}</p>
                ) : mobileBankAccounts.map(account => (
                  <div key={account.id} className="mb-2 rounded-2xl bg-neutral-50 p-3 last:mb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><span className="block truncate text-[11px] font-semibold text-neutral-700">{account.accountHolder}</span><span className="mt-0.5 block font-mono text-[10px] text-neutral-500">{account.iban}</span></div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${account.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : account.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                        {account.status === 'verified' ? mobileText('已核验', 'Verificato') : account.status === 'rejected' ? mobileText('需更新', 'Da aggiornare') : mobileText('审核中', 'In verifica')}
                      </span>
                    </div>
                    {account.status === 'rejected' && account.rejectionReason && <p className="mt-2 text-[10px] text-rose-700">{account.rejectionReason}</p>}
                  </div>
                ))}
                <form onSubmit={submitBankAccount} className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                  <p className="text-[11px] font-bold text-neutral-700">{mobileText('添加收款账户', 'Aggiungi conto')}</p>
                  <input required minLength={2} maxLength={160} value={bankAccountForm.accountHolder} onChange={event => setBankAccountForm(previous => ({ ...previous, accountHolder: event.target.value }))} placeholder={mobileText('账户持有人（法定主体）', 'Intestatario del conto')} className="h-10 w-full rounded-xl bg-neutral-50 px-3 text-[11px] outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  <input required autoComplete="off" value={bankAccountForm.iban} onChange={event => setBankAccountForm(previous => ({ ...previous, iban: event.target.value.toUpperCase() }))} placeholder="IBAN" className="h-10 w-full rounded-xl bg-neutral-50 px-3 font-mono text-[11px] uppercase outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  <button type="submit" disabled={bankAccountBusy} className="ruda-btn-primary w-full text-[13px]">{bankAccountBusy ? mobileText('提交中...', 'Invio...') : mobileText('提交审核', 'Invia per verifica')}</button>
                </form>
              </div>
            </div>}

            {settingsSection === 'finance' && (
              <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-bold text-neutral-800">{mobileText('能力与边界', 'Copertura')}</p>
                <div className="mt-2">
                  <MerchantSettingsScopeList items={[
                    { label: mobileText('收款账户', 'Conti di incasso'), state: mobileText('可用', 'Disponibile'), tone: 'ready', detail: mobileText('提交后由平台审核', 'Verifica della piattaforma') },
                    { label: mobileText('结算流水', 'Incassi'), state: mobileText('需人工', 'Manuale'), tone: 'manual', detail: mobileText('财务页查看', 'Nella pagina Finanza') },
                    { label: mobileText('套餐与账单', 'Piano e fatture'), state: mobileText('未接入', 'Non attivo'), tone: 'unavailable', detail: mobileText('无订阅账单', 'Nessuna fatturazione') },
                    { label: mobileText('退款与争议', 'Rimborsi e contestazioni'), state: mobileText('需人工', 'Manuale'), tone: 'manual', detail: mobileText('平台财务处理', 'Gestiti dalla piattaforma') }
                  ]} />
                </div>
                <div className="mt-3">
                  <MerchantSettingsNote>{mobileText('平台收款与商家收款分别处理；退款与争议由平台财务审核。', 'Incassi piattaforma e merchant separati; rimborsi e contestazioni verificati dalla piattaforma.')}</MerchantSettingsNote>
                </div>
              </div>
            )}

            {settingsSection === 'store' && <div className="rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-neutral-50 flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-700" />{mobileText('店铺运营规则', 'Regole negozio')}
                </span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-1">{mobileText('新商品默认 MOQ', 'MOQ predefinito')}</label>
                    <input type="number" min="1" max="100000" value={merchantSettings.moq} onChange={event => setMerchantSettings(previous => ({ ...previous, moq: Number(event.target.value) }))} className="w-full h-10 rounded-xl bg-neutral-50 px-3 text-[12px] text-neutral-800 outline-none border-0" />
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{mobileText('仅预填新商品', 'Solo nuovi prodotti')}</span><span>{mobileText('已有商品不变', 'Esistenti invariati')}</span></div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 mb-1">{mobileText('账期', 'Termini')}</label>
                    <select value={merchantSettings.defaultPaymentTerm} onChange={event => setMerchantSettings(previous => ({ ...previous, defaultPaymentTerm: event.target.value }))} className="w-full h-10 rounded-xl bg-neutral-50 px-3 text-[12px] text-neutral-800 outline-none border-0">
                      <option value="prepaid">{mobileText('预付', 'Prepagato')}</option>
                      <option value="net_15">Net 15</option>
                      <option value="net_30">Net 30</option>
                      <option value="net_60">Net 60</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 mb-1">{mobileText('发货说明', 'Note di spedizione')}</label>
                  <textarea value={merchantSettings.shippingNote} onChange={event => setMerchantSettings(previous => ({ ...previous, shippingNote: event.target.value }))} rows={3} maxLength={500} placeholder={mobileText('例如：订单确认后 2–3 个工作日内发货', 'Tempi e condizioni di spedizione')} className="w-full resize-none rounded-xl bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-800 outline-none border-0 focus:ring-2 focus:ring-neutral-900/5" />
                </div>
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  <div>
                    <p className="text-[11px] font-bold text-neutral-800">{mobileText('网店展示模板', 'Tema del negozio')}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{mobileText('应用后立即生效', 'Applicazione immediata')}</span><span>{mobileText('不改商品订单', 'Prodotti e ordini invariati')}</span></div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {MERCHANT_STOREFRONT_TEMPLATES.map(template => {
                      const selected = storefrontTemplate === template.id;
                      return (
                        <button key={template.id} type="button" aria-pressed={selected} onClick={() => setStorefrontTemplate(template.id)} className={`flex items-center gap-2 rounded-xl border p-2 text-left ${selected ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900/10' : 'border-neutral-200 bg-white'}`}>
                          <span className="flex h-9 w-12 shrink-0 overflow-hidden rounded border border-black/5">
                            {template.colors.map(color => <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />)}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-bold text-neutral-800">{template.name}</span>
                            <span className="mt-0.5 block text-[9px] leading-3 text-neutral-500">{selected ? mobileText('当前选择', 'Selezionato') : mobileText('点击选择', 'Seleziona')}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => void applyStorefrontTemplate()} disabled={storefrontTemplateBusy || !currentMerchant} className="h-10 w-full rounded-2xl bg-neutral-900 text-[11px] font-bold text-white disabled:opacity-50">
                    {storefrontTemplateBusy ? mobileText('正在应用…', 'Applicazione...') : mobileText('一键应用到公开网店', 'Applica al negozio')}
                  </button>
                </div>
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  <div>
                    <p className="text-[11px] font-bold text-neutral-800">{mobileText('公开网店政策', 'Policy pubbliche del negozio')}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{mobileText('公开展示', 'Visibile al pubblico')}</span><span>{mobileText('不自动算运费', 'Nessun calcolo spedizione')}</span><span>{mobileText('退货资格另核', 'Resi da verificare')}</span></div>
                  </div>
                  <label className="block text-[10px] font-semibold text-neutral-500">
                    {mobileText('配送与运费政策', 'Spedizione e costi')}
                    <textarea value={storefrontPolicies.shipping} onChange={event => setStorefrontPolicies(previous => ({ ...previous, shipping: event.target.value }))} rows={3} maxLength={2000} placeholder={mobileText('区域 · 时效 · 运费', 'Zone · tempi · costi')} className="mt-1 w-full resize-none rounded-xl bg-neutral-50 px-3 py-2.5 text-[12px] font-normal text-neutral-800 outline-none focus:ring-2 focus:ring-neutral-900/5" />
                  </label>
                  <label className="block text-[10px] font-semibold text-neutral-500">
                    {mobileText('退换货政策', 'Resi e cambi')}
                    <textarea value={storefrontPolicies.returns} onChange={event => setStorefrontPolicies(previous => ({ ...previous, returns: event.target.value }))} rows={3} maxLength={2000} placeholder={mobileText('时限 · 商品状态 · 处理方式', 'Termini · condizioni · modalità')} className="mt-1 w-full resize-none rounded-xl bg-neutral-50 px-3 py-2.5 text-[12px] font-normal text-neutral-800 outline-none focus:ring-2 focus:ring-neutral-900/5" />
                  </label>
                  <label className="block text-[10px] font-semibold text-neutral-500">
                    {mobileText('退货地址（下单前公开展示）', 'Indirizzo per i resi (pubblico prima dell’ordine)')}
                    <textarea value={storefrontPolicies.returnAddress} onChange={event => setStorefrontPolicies(previous => ({ ...previous, returnAddress: event.target.value }))} rows={3} maxLength={500} placeholder={mobileText('填写完整退货地址', 'Indirizzo di reso completo')} className="mt-1 w-full resize-none rounded-xl bg-neutral-50 px-3 py-2.5 text-[12px] font-normal text-neutral-800 outline-none focus:ring-2 focus:ring-neutral-900/5" />
                    <span className="mt-1 flex flex-wrap gap-2 font-normal leading-4"><span>{mobileText('普通撤回', 'Recesso ordinario')}</span><span>{mobileText('买家承担运费', 'Spese a carico buyer')}</span><span>{mobileText('瑕疵或法律例外', 'Eccezioni di legge')}</span></span>
                  </label>
                  <button type="button" onClick={() => void saveStorefrontPolicies()} disabled={storefrontPoliciesBusy} className="h-10 w-full rounded-2xl border border-neutral-300 bg-white text-[11px] font-bold text-neutral-800 disabled:opacity-50">
                    {storefrontPoliciesBusy ? mobileText('保存中...', 'Salvataggio...') : mobileText('保存并发布政策', 'Salva e pubblica le policy')}
                  </button>
                </div>
                <button type="button" onClick={() => void saveMerchantSettings()} disabled={merchantSettingsBusy} className="w-full h-10 rounded-2xl bg-neutral-900 text-white text-[12px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform mt-1">
                  {mobileText('保存店铺', 'Salva negozio')}
                </button>
              </div>
            </div>}

            {settingsSection === 'store' && (
              <div className="mt-3 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-bold text-neutral-800">{mobileText('能力与边界', 'Copertura')}</p>
                <div className="mt-2">
                  <MerchantSettingsScopeList items={[
                    { label: mobileText('商品默认值', 'Valori predefiniti'), state: mobileText('可用', 'Disponibile'), tone: 'ready', detail: mobileText('MOQ 与账期', 'MOQ e termini') },
                    { label: mobileText('网店模板', 'Tema negozio'), state: mobileText('可用', 'Disponibile'), tone: 'ready' },
                    { label: mobileText('公开政策', 'Policy pubbliche'), state: mobileText('可用', 'Disponibile'), tone: 'ready' },
                    { label: mobileText('税费与运费', 'Tasse e spedizione'), state: mobileText('未接入', 'Non attivo'), tone: 'unavailable', detail: mobileText('不自动计算', 'Nessun calcolo') },
                    { label: mobileText('门店地点', 'Sedi'), state: mobileText('需人工', 'Manuale'), tone: 'manual', detail: mobileText('在电脑版维护', 'Su desktop') },
                    { label: mobileText('域名与渠道', 'Domini e canali'), state: mobileText('需人工', 'Manuale'), tone: 'manual', detail: mobileText('在电脑版维护', 'Su desktop') }
                  ]} />
                </div>
                <div className="mt-3">
                  <MerchantSettingsNote>{mobileText('手机端不自动计税或计算运费；地点、域名与销售渠道在电脑版设置。', 'Su mobile nessun calcolo di tasse o spedizione; sedi, domini e canali su desktop.')}</MerchantSettingsNote>
                </div>
              </div>
            )}

            {settingsSection === 'team' && <div className="space-y-3">
              <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-neutral-900"><Users className="h-4 w-4" />{mobileText('员工账号管理', 'Gestione dipendenti')}</span>
                  <button type="button" onClick={() => void refreshTeamSettings()} disabled={teamLoading} className="text-[10px] font-semibold text-neutral-500 disabled:opacity-50">{teamLoading ? mobileText('同步中...', 'Aggiornamento...') : mobileText('刷新', 'Aggiorna')}</button>
                </div>
                {teamLoadError ? <div className="p-4 text-[11px] text-rose-700">{mobileText('无法读取团队数据：', 'Impossibile caricare il team:')}{teamLoadError}</div> : (
                  <div className="divide-y divide-neutral-100">
                    {teamLoading && teamEmployees.length === 0 ? <p className="p-4 text-[11px] text-neutral-500">{mobileText('正在加载员工...', 'Caricamento dipendenti...')}</p> : null}
                    {!teamLoading && teamEmployees.length === 0 ? <p className="p-4 text-[11px] text-neutral-500">{mobileText('暂无员工账号。创建员工后，可在员工 App 中调整其具体权限。', 'Nessun dipendente. Crea un account e configura i permessi nell’app dipendenti.')}</p> : null}
                    {teamEmployees.map(employee => (
                      <div key={employee.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-neutral-800">{employee.name}</p>
                          <p className="truncate text-[10px] text-neutral-500">{employee.email} · {employee.role}</p>
                          <p className="mt-0.5 text-[9px] text-neutral-400">{employee.lastLoginAt ? `${mobileText('最近登录', 'Ultimo accesso')} ${new Date(employee.lastLoginAt).toLocaleDateString()}` : mobileText('尚未登录', 'Mai effettuato l’accesso')}</p>
                        </div>
                        <button type="button" onClick={() => void setTeamEmployeeActive(employee)} disabled={teamBusyId === employee.id} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold disabled:opacity-50 ${employee.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {teamBusyId === employee.id ? mobileText('处理中', 'Attendere') : employee.active ? mobileText('启用中 · 停用', 'Attivo · Disattiva') : mobileText('已停用 · 启用', 'Disattivo · Attiva')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <a href="/employee" className="flex items-center justify-between border-t border-neutral-100 px-4 py-3.5 text-[11px] font-semibold text-neutral-700 active:bg-neutral-50">
                  {mobileText('打开员工端设置权限', 'Configura permessi dipendenti')}<ChevronRight className="h-4 w-4 text-neutral-400" />
                </a>
              </div>

              <form onSubmit={createTeamEmployee} className="space-y-2 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <h3 className="text-[12px] font-bold text-neutral-900">{mobileText('新增员工', 'Aggiungi dipendente')}</h3>
                <input required maxLength={100} value={employeeForm.name} onChange={event => setEmployeeForm(previous => ({ ...previous, name: event.target.value }))} placeholder={mobileText('员工姓名', 'Nome dipendente')} className="h-10 w-full rounded-xl bg-neutral-50 px-3 text-[11px] outline-none focus:ring-2 focus:ring-neutral-900/10" />
                <input required type="email" maxLength={160} autoComplete="email" value={employeeForm.email} onChange={event => setEmployeeForm(previous => ({ ...previous, email: event.target.value }))} placeholder={mobileText('员工邮箱', 'Email dipendente')} className="h-10 w-full rounded-xl bg-neutral-50 px-3 text-[11px] outline-none focus:ring-2 focus:ring-neutral-900/10" />
                <PasswordInput required minLength={8} autoComplete="new-password" value={employeeForm.password} onChange={event => setEmployeeForm(previous => ({ ...previous, password: event.target.value }))} placeholder={mobileText('初始密码（至少 8 位）', 'Password iniziale (min. 8 caratteri)')} className="h-10 w-full rounded-xl bg-neutral-50 px-3 pr-10 text-[11px] outline-none focus:ring-2 focus:ring-neutral-900/10" />
                <select value={employeeForm.role} onChange={event => setEmployeeForm(previous => ({ ...previous, role: event.target.value as MobileEmployee['role'] }))} className="h-10 w-full rounded-xl bg-neutral-50 px-3 text-[11px] outline-none">
                  <option value="sales">{mobileText('销售', 'Vendite')}</option><option value="warehouse">{mobileText('仓库', 'Magazzino')}</option><option value="production">{mobileText('生产', 'Produzione')}</option><option value="pos_cashier">{mobileText('POS 收银', 'Cassa POS')}</option><option value="knowledge_manager">{mobileText('ModaUI 知识库管理员', 'Responsabile conoscenza ModaUI')}</option><option value="store_manager">{mobileText('店铺经理', 'Responsabile negozio')}</option>
                </select>
                <button type="submit" disabled={employeeCreateBusy} className="ruda-btn-primary w-full text-[13px]">{employeeCreateBusy ? mobileText('创建中...', 'Creazione...') : mobileText('新增员工', 'Aggiungi dipendente')}</button>
                <div className="flex flex-wrap gap-2 text-[9px] leading-relaxed text-neutral-400"><span>{mobileText('密码请安全告知', 'Comunica la password in modo sicuro')}</span><span>{mobileText('停用后无法登录', 'Accesso disattivato')}</span><span>{mobileText('权限可单独配置', 'Permessi configurabili')}</span></div>
              </form>

              <div className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-bold text-neutral-800">{mobileText('能力与边界', 'Copertura')}</p>
                <div className="mt-2">
                  <MerchantSettingsScopeList items={[
                    { label: mobileText('员工账号', 'Account dipendenti'), state: mobileText('可用', 'Disponibile'), tone: 'ready' },
                    { label: mobileText('角色权限', 'Ruoli e permessi'), state: mobileText('需人工', 'Manuale'), tone: 'manual', detail: mobileText('在员工端配置', 'Nell’app dipendenti') },
                    { label: mobileText('登录安全', 'Accesso'), state: mobileText('可用', 'Disponibile'), tone: 'ready', detail: mobileText('停用立即生效', 'Effetto immediato') },
                    { label: mobileText('安全审计', 'Audit'), state: mobileText('可用', 'Disponibile'), tone: 'ready', detail: mobileText('最近 10 条', 'Ultime 10') }
                  ]} />
                </div>
                <div className="mt-3">
                  <MerchantSettingsNote>{mobileText('角色权限在员工端配置；停用员工后其登录立即失效。', 'I permessi si configurano nell’app dipendenti; la disattivazione blocca subito l’accesso.')}</MerchantSettingsNote>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="border-b border-neutral-100 px-4 py-3.5 text-[12px] font-bold text-neutral-900">{mobileText('最近安全操作', 'Attività recenti')}</div>
                {teamAudit.length === 0 ? <p className="p-4 text-[10px] text-neutral-500">{mobileText('暂无操作记录', 'Nessuna attività recente')}</p> : teamAudit.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-center justify-between gap-3 border-b border-neutral-50 px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0"><p className="truncate text-[10px] font-semibold text-neutral-700">{log.action.replaceAll('_', ' ')}</p><p className="text-[9px] text-neutral-400">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}</p></div>
                    <time className="shrink-0 text-[9px] text-neutral-400">{new Date(log.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { logout(); }} className="w-full flex items-center justify-between px-4 py-3.5 active:bg-rose-50 transition-colors">
                <span className="flex items-center gap-3 text-[13px] font-bold text-rose-600">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center"><LogOut className="w-4 h-4 text-rose-600" /></div>
                  {mobileText('退出账户', 'Esci')}
                </span>
                <ChevronRight className="w-4 h-4 text-rose-300" />
              </button>
            </div>}
          </div>
        )}
        </>
        )}
      </div>

      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4 animate-ruda-fade" onClick={() => setSelectedOrderDetail(null)}>
          <div className="ruda-modal flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[90vh] sm:max-h-[90vh] animate-ruda-slide" onClick={event => event.stopPropagation()}>
            {/* 顶部栏 */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl px-4 pt-5 pb-4 border-b border-neutral-100 z-10">
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setSelectedOrderDetail(null)} className="flex items-center gap-1 text-[13px] font-medium text-neutral-600">
                  <ChevronLeft className="h-4 w-4" />返回
                </button>
                <h3 className="text-[15px] font-semibold text-neutral-900">订单详情</h3>
                <div className="w-12" /> {/* 占位 */}
              </div>
              
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-neutral-950">{selectedOrderDetail.orderNo}</span>
                    <span className="ruda-tag ruda-tag-neutral h-[20px] px-1.5 text-[10px]">
                      {selectedOrderIsPos ? 'POS' : '批发'}
                    </span>
                    <span className={`ruda-tag ${
                      selectedOrderDetail.status === 'delivered' ? 'ruda-tag-success' : 
                      selectedOrderDetail.status === 'shipped' ? 'ruda-tag-info' :
                      selectedOrderDetail.status === 'cancelled' ? 'ruda-tag-neutral' : 'ruda-tag-warning'
                    }`}>
                      {orderStateLabel(selectedOrderDetail)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="text-[24px] font-bold tabular-nums text-neutral-950">€{selectedOrderDetail.totalAmount.toFixed(2)}</strong>
                    <span className="text-[12px] text-neutral-500 font-medium">{paymentLabel(selectedOrderDetail)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => orderEditUnlocked ? void saveOrderEdit() : startOrderEdit(selectedOrderDetail)} 
                    disabled={orderEditBusy} 
                    className="ruda-btn-secondary h-[36px] px-3 text-[12px]"
                  >
                    {orderEditUnlocked ? '发送方案' : '编辑条款'}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* 主进度线 */}
              <section className="ruda-card py-5">
                <div className="relative flex justify-between px-2">
                  <div className="absolute left-[10%] right-[10%] top-[11px] h-[1px] bg-neutral-100" />
                  {['确认', '执行', '运输', '送达'].map((label, index) => {
                    const isCompleted = index < selectedOrderProgress;
                    const isCurrent = index === selectedOrderProgress;
                    return (
                      <div key={label} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-colors ${
                          isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' :
                          isCurrent ? 'bg-neutral-950 border-neutral-950 text-white' :
                          'bg-white border-neutral-200 text-neutral-300'
                        }`}>
                          {isCompleted ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                        </div>
                        <span className={`text-[12px] ${isCurrent ? 'font-semibold text-neutral-950' : 'text-neutral-500'}`}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 当前任务卡片 */}
              <section className="ruda-card border-l-[4px] border-l-neutral-950 bg-neutral-50/30">
                <p className="text-[12px] font-medium text-neutral-500">当前任务</p>
                <h4 className="mt-1 text-[16px] font-semibold text-neutral-900">
                  {selectedOrderDetail.currentTasks?.merchant.task || (selectedOrderIsPos && selectedOrderDetail.paymentStatus === 'paid' ? '门店销售已完成' : '查看订单记录')}
                </h4>
                
                <div className="mt-4">
                  {selectedOrderDetail.currentTasks?.merchant.action === 'review_agreement' && selectedOrderAgreement?.status === 'pending_merchant' && (
                    <button type="button" onClick={() => void confirmMobileOrderAgreement(selectedOrderDetail)} className="ruda-btn-primary w-full">确认交易约定</button>
                  )}
                  {canReviewLegacyOrder && (
                    <button type="button" onClick={() => { setSelectedOrderToFulfill(selectedOrderDetail.id); setSelectedOrderDetail(null); }} className="ruda-btn-primary w-full">审核订单</button>
                  )}
                  {selectedOrderDetail.currentTasks?.merchant.action === 'trigger_balance' && (
                    <button type="button" onClick={() => void triggerMobileCustomBalance(selectedOrderDetail)} className="ruda-btn-primary w-full">核实余款条件</button>
                  )}
                  {canStartMobileFulfillment && (
                    <button type="button" onClick={() => { setSelectedOrderToFulfill(selectedOrderDetail.id); setSelectedOrderDetail(null); }} className="ruda-btn-primary w-full">
                      {selectedOrderDetail.status === 'picking' ? '确认发货' : selectedOrderDetail.status === 'confirmed' ? '开始备货' : '处理任务'}
                    </button>
                  )}
                </div>
              </section>

              {/* 订单聊天 */}
              {!selectedOrderIsPos && (
                <section className="ruda-card overflow-hidden p-0">
                  <OrderChatPanel key={selectedOrderDetail.id} orderId={selectedOrderDetail.id} orderNo={selectedOrderDetail.orderNo} role="merchant" />
                </section>
              )}

              {/* 商品明细 */}
              <details className="ruda-card p-0 overflow-hidden" open>
                <summary className="ruda-accordion list-none">
                  <span>商品明细 · {selectedOrderDetail.items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
                  <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="divide-y divide-neutral-50">
                  {selectedOrderDetail.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 active:bg-neutral-50">
                      {item.image && (
                        <ProductImage 
                          src={item.image} 
                          alt={item.productName || ''} 
                          className="w-[48px] h-[58px] rounded-[6px] object-cover bg-neutral-50"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-neutral-900 truncate">{item.productName || item.styleNo}</p>
                        <p className="mt-0.5 text-[12px] text-neutral-500">
                          {item.color || '-'} / {item.size || '-'} · {item.sku}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-semibold text-neutral-950">×{item.quantity}</p>
                        <p className="text-[11px] text-neutral-500">€{item.unitPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              {/* 交易约定、付款和物流 (折叠行) */}
              <div className="space-y-2">
                {selectedOrderAgreement && (
                  <details className="ruda-card p-0 overflow-hidden">
                    <summary className="ruda-accordion list-none">
                      <div className="flex items-center gap-2">
                        <FileText className="h-[18px] w-[18px] text-neutral-600" />
                        <span>交易约定 · v{selectedOrderAgreement.version}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-neutral-500">{selectedOrderAgreement.status === 'active' ? '已生效' : '待确认'}</span>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                      </div>
                    </summary>
                    <div className="bg-neutral-50/50 px-4 py-3 space-y-2">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-neutral-500">付款计划</span>
                        <span className="font-medium text-neutral-900">{selectedOrderAgreement.terms.paymentPlan}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-neutral-500">余款条件</span>
                        <span className="font-medium text-neutral-900">{selectedOrderAgreement.terms.customPaymentCondition || selectedOrderAgreement.terms.remainingBalanceTrigger}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-neutral-500">供货方式</span>
                        <span className="font-medium text-neutral-900">{selectedOrderAgreement.terms.supplyMode === 'partial_shipments' ? '允许分批' : '齐货发货'}</span>
                      </div>
                    </div>
                  </details>
                )}

                <details className="ruda-card p-0 overflow-hidden">
                  <summary className="ruda-accordion list-none">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-[18px] w-[18px] text-neutral-600" />
                      <span>付款记录</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] ${selectedOrderDetail.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-neutral-500'}`}>
                        {paymentLabel(selectedOrderDetail)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                  </summary>
                  <div className="bg-neutral-50/50 px-4 py-3 space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-neutral-500">已收金额</span>
                      <span className="font-semibold text-neutral-950">€{Number(selectedOrderDetail.paidAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-neutral-500">付款方式</span>
                      <span className="font-medium text-neutral-900">{selectedOrderDetail.paymentMethod}</span>
                    </div>
                  </div>
                </details>

                <details className="ruda-card p-0 overflow-hidden">
                  <summary className="ruda-accordion list-none">
                    <div className="flex items-center gap-2">
                      <Truck className="h-[18px] w-[18px] text-neutral-600" />
                      <span>发货与物流</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </summary>
                  <div className="bg-neutral-50/50 px-4 py-3 space-y-3">
                    {!selectedOrderIsPos && (
                      <div className="text-[12px] text-neutral-700 space-y-1">
                        <p className="font-semibold">{selectedOrderDetail.shippingAddress.recipient}</p>
                        <p>{selectedOrderDetail.shippingAddress.phone}</p>
                        <p className="text-neutral-500">{selectedOrderDetail.shippingAddress.street}, {selectedOrderDetail.shippingAddress.city}</p>
                      </div>
                    )}
                    {selectedOrderIsPos ? (
                      <p className="text-[12px] text-neutral-500">门店销售无需物流。</p>
                    ) : (
                      <div className="space-y-2">
                        {orderTrackingShipments.length > 0 ? (
                          orderTrackingShipments.map(shipment => (
                            <div key={shipment.id} className="rounded-[8px] border border-neutral-100 bg-white p-2.5">
                              <p className="text-[12px] font-semibold text-neutral-900">{shipment.shipmentNo} · {shipment.status}</p>
                              <p className="mt-1 text-[11px] text-neutral-500">{shipment.carrier} {shipment.trackingNumber}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-neutral-500">暂无物流单号</p>
                        )}
                      </div>
                    )}
                  </div>
                </details>

                <details className="ruda-card p-0 overflow-hidden">
                  <summary className="ruda-accordion list-none">
                    <div className="flex items-center gap-2">
                      <History className="h-[18px] w-[18px] text-neutral-600" />
                      <span>订单历史</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </summary>
                  <div className="bg-neutral-50/50 px-4 py-3">
                    <div className="space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-200">
                      {selectedOrderDetail.timeline.slice(-5).reverse().map((event, index) => (
                        <div key={`${event.status}-${event.time}-${index}`} className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-white bg-neutral-300" />
                          <p className="text-[12px] font-medium text-neutral-900">{event.title}</p>
                          <p className="text-[11px] text-neutral-500">{event.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              {/* 订单操作按钮 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => openOrderDocument(selectedOrderDetail, 'invoice')} className="ruda-btn-secondary h-10">打印发票</button>
                <button type="button" onClick={() => void shareOrderDocument(selectedOrderDetail)} className="ruda-btn-primary h-10">分享单据</button>
              </div>
            </div>

            <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button type="button" onClick={() => setSelectedOrderDetail(null)} className="ruda-btn-secondary w-full border-neutral-300">关闭</button>
            </div>
          </div>
        </div>
      )}

      {creatingProductDraft && (
        <MerchantMobileProductCreateForm
              value={creatingProductDraft}
              mode={creatingProductMode!}
              onChange={setCreatingProductDraft}
              onSubmit={(event, action, mode) => { void saveNewProduct(event, action, mode); }}
              onCancel={() => setCreatingProductDraft(null)}
              busy={creatingProductBusy}
              isItalian={mobileItalian}
              canManageCosts={canManageProductCosts}
            />
      )}

      {productDraft && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={() => !productDraftBusy && !productMediaBusy && setProductDraft(null)}>
          <form
            className="ruda-modal max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
            onSubmit={event => { event.preventDefault(); void saveProductDraft(); }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">🔓 商品编辑</p>
                <h3 className="mt-1 text-lg font-black text-neutral-900">编辑全部商品资料</h3>
              </div>
              <button type="button" disabled={productDraftBusy || productMediaBusy} onClick={() => setProductDraft(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-neutral-100 text-neutral-500 disabled:opacity-50"><X className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={runProductSmartAssistant} disabled={productSmartBusy} className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-[6px] bg-neutral-900 px-3 text-xs font-bold text-white disabled:opacity-50">
              <Sparkles className="h-3.5 w-3.5" /> {productSmartBusy ? '智能分析中...' : '✨ AI 智能补全与诊断'}
            </button>
            {productSmartAdvice.length > 0 && (
              <div className="space-y-1 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">
                {productSmartAdvice.map(advice => <p key={advice}>· {advice}</p>)}
              </div>
            )}

            {([
              ['styleNo', '款号'],
              ['name', '商品名称'],
              ['subCategory', '子分类'],
              ['brand', '品牌'],
              ['fabric', '面料材质']
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-xs font-bold text-neutral-600">
                {label}
                <input
                  value={String(productDraft[key] ?? '')}
                  onChange={event => setProductDraft(previous => previous ? { ...previous, [key]: event.target.value } : previous)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-900"
                />
              </label>
            ))}
            <label className="block text-xs font-bold text-neutral-600">
              产品分类
              <select required value={String(productDraft.category ?? '')} onChange={event => setProductDraft(previous => previous ? { ...previous, category: event.target.value } : previous)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-900">
                {!PRODUCT_CATEGORIES.some(category => category.value === productDraft.category) && productDraft.category && <option value={String(productDraft.category)}>{getProductCategoryLabel(String(productDraft.category), mobileItalian)}</option>}
                <option value="">请选择产品分类</option>
                {PRODUCT_CATEGORIES.map(category => <option key={category.value} value={category.value}>{getProductCategoryLabel(category.value, mobileItalian)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['wholesalePrice', '批发价 (€)'],
                ['wholesalePrice100', '量大批发价（100件起，€ / 件）'],
                ['moq', 'MOQ'],
                ['packSize', '箱规']
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-bold text-neutral-600">
                  {label}
                  <input
                    type="number"
                    min={key === 'wholesalePrice' || key === 'wholesalePrice100' ? '0.01' : '1'}
                    step={key === 'wholesalePrice' || key === 'wholesalePrice100' ? '0.01' : '1'}
                    value={String(productDraft[key] ?? '')}
                    onChange={event => setProductDraft(previous => previous ? {
                      ...previous,
                      [key]: event.target.value === '' && key === 'wholesalePrice100' ? null : Number(event.target.value)
                    } : previous)}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-900"
                  />
                </label>
              ))}
            </div>
            <label className="block text-xs font-bold text-neutral-600">
              商品展示区
            <select value={getProductZone(productDraft)} onChange={event => setProductDraft(previous => previous ? { ...previous, ...getProductZoneUpdates(event.target.value as ProductZone) } : previous)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-900">
              <option value="new">现货区</option>
              <option value="clearance">折扣市场</option>
                <option value="private">授权区</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-neutral-600">
              商品描述
              <textarea rows={4} value={String(productDraft.description ?? '')} onChange={event => setProductDraft(previous => previous ? { ...previous, description: event.target.value } : previous)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-neutral-900" />
            </label>
            <SmartMediaUploader
              value={(productDraft.media?.length ? productDraft.media : (productDraft.images || []).map((url, index) => ({ id: `legacy-${index}`, type: 'image' as const, url }))) as NonNullable<Product['media']>}
              maxItems={32}
              capture
              compact
              onBusyChange={setProductMediaBusy}
              onChange={media => setProductDraft(previous => previous ? { ...previous, media, images: media.filter(item => item.type === 'image').map(item => item.url) } : previous)}
            />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={productDraftBusy || productMediaBusy} className="flex-1 rounded-xl bg-neutral-900 py-3 text-xs font-black text-white disabled:opacity-50">{productMediaBusy ? '媒体上传中...' : productDraftBusy ? '保存中...' : '保存全部修改'}</button>
              <button type="button" disabled={productDraftBusy || productMediaBusy} onClick={() => setProductDraft(null)} className="rounded-xl bg-neutral-100 px-4 py-3 text-xs font-bold text-neutral-700 disabled:opacity-50">取消</button>
            </div>
          </form>
        </div>
      )}

      {reportingWorkOrder && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-2xs sm:items-center" onClick={() => setReportingWorkOrder(null)}>
          <form onSubmit={submitProductionReport} className="ruda-modal w-full max-w-md space-y-4 bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div><p className="font-mono text-xs font-bold text-neutral-500">{reportingWorkOrder.workOrderNo}</p><h3 className="mt-1 text-base font-bold text-neutral-900">生产报产 / 质检</h3><p className="mt-1 text-[11px] text-neutral-500">{reportingWorkOrder.product.styleNo} · {reportingWorkOrder.variant.sku} · 计划 {reportingWorkOrder.plannedQuantity} 件</p></div>
              <button type="button" onClick={() => setReportingWorkOrder(null)} className="rounded-full bg-neutral-100 p-2 text-neutral-500"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-neutral-600">本次合格数量 *
                <input required type="number" min="0" value={reportForm.goodQuantity} onChange={event => setReportForm(previous => ({ ...previous, goodQuantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">本次不合格数量
                <input type="number" min="0" value={reportForm.rejectedQuantity} onChange={event => setReportForm(previous => ({ ...previous, rejectedQuantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-neutral-600">质检备注
              <textarea value={reportForm.note} onChange={event => setReportForm(previous => ({ ...previous, note: event.target.value }))} maxLength={2000} placeholder="记录批次、瑕疵原因或车间备注" className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs" />
            </label>
            <div className="flex flex-wrap gap-2 rounded-lg bg-amber-50 p-2.5 text-[10px] leading-4 text-amber-800"><span>合格入成品库存</span><span>不合格记入质检</span><span>报产不可重复</span></div>
            <div className="flex gap-2"><button type="submit" disabled={reportBusy} className="flex-1 rounded-lg bg-neutral-950 py-2.5 text-xs font-bold text-white disabled:opacity-50">{reportBusy ? '提交中...' : '确认报产入库'}</button><button type="button" onClick={() => setReportingWorkOrder(null)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700">取消</button></div>
          </form>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSelectedProduct(null)}>
          <div className="ruda-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-slideUp" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl px-5 pt-5 pb-4 border-b border-neutral-100 z-10">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-[11px] font-black text-neutral-500 tracking-wide">{selectedProduct.styleNo}</p>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                      (selectedProduct.lifecycleStatus || 'published') === 'published' ? 'bg-emerald-50 text-emerald-700' :
                      selectedProduct.lifecycleStatus === 'draft' ? 'bg-neutral-100 text-neutral-600' :
                      selectedProduct.lifecycleStatus === 'archived' ? 'bg-neutral-100 text-neutral-500' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {(selectedProduct.lifecycleStatus || 'published') === 'published' ? mobileText('上架', 'Online') : selectedProduct.lifecycleStatus === 'draft' ? mobileText('草稿', 'Bozza') : selectedProduct.lifecycleStatus === 'archived' ? mobileText('归档', 'Archiviato') : mobileText('审核', 'Revisione')}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                      selectedProduct.inventoryStatus === 'low_stock' ? 'bg-rose-50 text-rose-700' :
                      selectedProduct.inventoryStatus === 'pre_order' ? 'bg-amber-50 text-amber-700' :
                      selectedProduct.inventoryStatus === 'coming_soon' ? 'bg-blue-50 text-blue-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {selectedProduct.inventoryStatus === 'low_stock' ? mobileText('低库存', 'Poca scorta') : selectedProduct.inventoryStatus === 'pre_order' ? mobileText('预售', 'Preordine') : selectedProduct.inventoryStatus === 'coming_soon' ? mobileText('新品', 'Nuovo') : mobileText('有库存', 'Disponibile')}
                    </span>
                  </div>
                  <h3 className="mt-1 text-[16px] font-black text-neutral-900 leading-tight line-clamp-2">{selectedProduct.name}</h3>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{selectedProduct.brand || selectedProduct.category} · {selectedProduct.subCategory || '-'}</p>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="w-9 h-9 -mr-1 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-500 active:scale-95 transition-transform"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-100 to-neutral-50">
                <ProductImage src={selectedProduct.images[0]} alt={selectedProduct.name} contain className="h-56 w-full" />
                {selectedProduct.visibility === 'private' && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-violet-600/95 backdrop-blur-sm text-white text-[10px] font-black">
                    <Lock className="w-3 h-3 inline mr-1" />{mobileText('授权区', 'Area autorizzata')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-neutral-50 p-3.5"><span className="block text-[10px] font-semibold text-neutral-500 mb-1">{mobileText('批发价', 'Ingrosso')}</span><strong className="text-[19px] font-black text-neutral-900">€{selectedProduct.wholesalePrice.toFixed(2)}</strong></div>
                <div className="rounded-2xl bg-neutral-50 p-3.5"><span className="block text-[10px] font-semibold text-neutral-500 mb-1">100件起批价</span><strong className="text-[19px] font-black text-neutral-600">{selectedProduct.wholesalePrice100 == null ? '未设置' : `€${selectedProduct.wholesalePrice100.toFixed(2)}`}</strong></div>
                <div className="rounded-2xl bg-neutral-50 p-3.5"><span className="block text-[10px] font-semibold text-neutral-500 mb-1">MOQ / {mobileText('箱规', 'Cartone')}</span><strong className="text-[15px] font-black text-neutral-900">{selectedProduct.moq} / {selectedProduct.packSize}</strong></div>
                <div className="rounded-2xl bg-neutral-50 p-3.5"><span className="block text-[10px] font-semibold text-neutral-500 mb-1">SKU</span><strong className="text-[19px] font-black text-neutral-900">{selectedProduct.skus.length}</strong></div>
              </div>

              <div className="rounded-3xl border border-neutral-100 overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-[12px] font-black text-neutral-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {mobileText('商品管理', 'Gestione')}
                  </span>
                  {productBusyId === selectedProduct.id && <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{mobileText('同步中', 'Salvando')}</span>}
                </div>
                <div className="px-4 py-2.5 border-b border-neutral-50">
                  {/* 商品编辑锁：只在商品详情页，列表页不放置 */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-neutral-600">
                      {productEditUnlocked ? <Unlock className="h-3.5 w-3.5 shrink-0" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">
                        {mobileText('商品编辑锁', 'Blocco modifica')} · {productEditUnlocked ? mobileText('已开启', 'Attivo') : mobileText('已关闭', 'Chiuso')}
                      </span>
                    </span>
                    {canManageProductEditPermission && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={productEditUnlocked}
                        aria-label={mobileText('商品编辑锁', 'Blocco modifica')}
                        disabled={!productEditPermissionLoaded || productEditPermissionBusy}
                        onClick={() => void toggleProductEditingPermission()}
                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${productEditUnlocked ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${productEditUnlocked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    )}
                  </div>
                  {productEditUnlocked && (
                    <button type="button" onClick={() => openProductEditor(selectedProduct)} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 py-2.5 text-[11px] font-black text-white">
                      <Pencil className="h-3.5 w-3.5" /> 编辑全部商品资料
                    </button>
                  )}
                  <span className="block text-[10px] font-semibold text-neutral-500 mb-1.5">{mobileText('商品展示区', 'Zona prodotto')}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'new', label: mobileText('现货区', 'Pronta consegna'), icon: <Globe className="w-3.5 h-3.5" /> },
                      { value: 'clearance', label: mobileText('折扣市场', 'Mercato outlet'), icon: <Users className="w-3.5 h-3.5" /> },
                      { value: 'private', label: mobileText('授权区', 'Area autorizzata'), icon: <Lock className="w-3.5 h-3.5" /> }
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!productEditUnlocked || productBusyId === selectedProduct.id}
                        onClick={() => void updateProductZone(selectedProduct, opt.value)}
                        className={`h-10 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                          getProductZone(selectedProduct) === opt.value
                            ? 'bg-neutral-900 text-white shadow-md shadow-neutral-900/15'
                            : 'bg-neutral-100 text-neutral-600 active:scale-[0.97]'
                        } disabled:opacity-50`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { key: 'published' as const, label: mobileText('上架销售', 'In vendita'), enabled: (selectedProduct.lifecycleStatus || 'published') === 'published' }
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-[13px] font-bold text-neutral-800">{setting.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.enabled}
                      disabled={!productEditUnlocked || productBusyId === selectedProduct.id}
                      onClick={() => void toggleProductSetting(selectedProduct, setting.key, !setting.enabled)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${setting.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${setting.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 px-4 pb-3 text-[10px] leading-4 text-neutral-500"><span>{mobileText('开启后网店展示', 'Visibile nel negozio')}</span><span>{mobileText('买手端可见', 'Visibile ai buyer')}</span></div>
              </div>

              <div className="rounded-3xl border border-neutral-100 overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-[12px] font-black text-neutral-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    {mobileText('库存明细', 'Scorte SKU')}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400">{selectedProduct.skus.length} {mobileText('个规格', 'Varianti')}</span>
                </div>
                <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
                  {selectedProduct.skus.slice(0, 12).map(sku => {
                    const total = sku.stockCentral;
                    return (
                      <div key={sku.sku} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${total <= 3 ? 'bg-rose-50' : 'bg-neutral-100'}`}>
                            <Package className={`w-3.5 h-3.5 ${total <= 3 ? 'text-rose-600' : 'text-neutral-500'}`} />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-neutral-800">{sku.color || '-'} / {sku.size || '-'}</div>
                            <div className="font-mono text-[9px] text-neutral-400 tracking-wide">{sku.sku}</div>
                          </div>
                        </div>
                        <strong className={`text-[14px] font-black ${total <= 3 ? 'text-rose-600' : 'text-neutral-900'}`}>{total}</strong>
                      </div>
                    );
                  })}
                  {selectedProduct.skus.length > 12 && <div className="px-4 py-3 text-[10px] text-neutral-400 text-center">{mobileText('还有', 'Altri')} {selectedProduct.skus.length - 12} {mobileText('个规格', 'varianti')}</div>}
                </div>
              </div>

              {selectedProduct.fabric && (
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 flex items-start gap-2.5">
                  <Info className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-neutral-500">{mobileText('面料', 'Tessuto')}</div>
                    <div className="text-[12px] font-bold text-neutral-700 mt-0.5">{selectedProduct.fabric}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl px-5 py-4 border-t border-neutral-100">
              <div className="flex justify-end">
                <button type="button" onClick={() => setSelectedProduct(null)} className="h-11 px-5 rounded-2xl bg-neutral-100 text-neutral-700 text-[13px] font-bold active:scale-[0.98] transition-transform">{mobileText('关闭', 'Chiudi')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Fulfill Modal for Mobile */}
      {selectedOrderToFulfill && selectedOrder && nextFulfillmentAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/50 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">{nextFulfillmentAction.label}</h3>
              <button onClick={() => setSelectedOrderToFulfill(null)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            {nextFulfillmentAction.status === 'shipped' && (
              <div className="space-y-2 text-xs">
                {shipmentsLoading ? (
                  <div className="rounded-lg bg-neutral-50 p-3 text-neutral-500">正在读取已发包裹...</div>
                ) : (
                  <>
                    {shipments.length > 0 && (
                      <div className="rounded-lg bg-blue-50 p-3 text-blue-800">
                        <div className="flex flex-wrap gap-2"><span>已创建 {shipments.length} 个包裹</span><span>仅填剩余数量</span></div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-neutral-600 font-medium block">本次发货明细</label>
                      {selectedOrder.items.map(item => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="flex-1 truncate text-neutral-700">{item.styleNo} / {item.color} / {item.size}</span>
                          <span className="text-[10px] text-neutral-400">共 {item.quantity}</span>
                          <input
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={shipmentQuantities[item.id] ?? 0}
                            onChange={(event) => setShipmentQuantities(previous => ({
                              ...previous,
                              [item.id]: Math.min(item.quantity, Math.max(0, Number(event.target.value) || 0))
                            }))}
                            className="w-16 rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <label className="text-neutral-600 font-medium block">快递承运商</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-lg border border-neutral-300"
                >
                  <option value="DHL Express">DHL Express 欧洲特快</option>
                  <option value="UPS Express">UPS Express Saver</option>
                  <option value="GLS Italy">GLS Italy 现货快线</option>
                  <option value="TNT / FedEx">TNT / FedEx 专线</option>
                </select>

                <label className="text-neutral-600 font-medium block pt-1">快递单号（可自动生成）</label>
                <input
                  type="text"
                  placeholder="例如: IT-DHL-8890214"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  className="w-full p-2 bg-neutral-50 rounded-lg border border-neutral-300"
                />
              </div>
            )}

            <button
              onClick={() => void handleQuickFulfill()}
              disabled={fulfillmentBusy}
              className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl"
            >
              {fulfillmentBusy ? '提交中...' : `${nextFulfillmentAction.label}并通知买手`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

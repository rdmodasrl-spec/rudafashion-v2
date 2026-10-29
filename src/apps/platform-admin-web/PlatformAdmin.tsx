import { getIntlLocale } from '../../i18n/translations';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Layers, 
  Package, 
  Building2, 
  Truck, 
  Users, 
  Calendar, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Search, 
  Plus, 
  Filter, 
  BarChart3, 
  ShoppingBag, 
  ArrowUpRight,
  ShieldCheck,
  Store,
  RefreshCw,
  FileText,
  Lock,
  Unlock,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  Receipt,
  FileSpreadsheet,
  Boxes,
  Smartphone,
  Globe,
  UserCheck
  ,KeyRound, Bot, MessageCircle, Headphones, FolderOpen, Film, Eye, EyeOff, BrainCircuit, Megaphone, Database, ExternalLink
} from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { PasswordInput } from '../shared/components/common/PasswordInput';
import { OrderStatus, CustomerTier, Product, Merchant, Appointment } from '../../types/b2b';
import { PaymentSettingsCard } from '../shared/components/common/PaymentSettingsCard';
import { PasswordChangeForm } from '../shared/components/auth/PasswordChangeForm';
import { apiGet, apiPost, apiPut, ApiError } from '../../api/client';
import type { MediaBackupRun } from '../../shared/mediaBackup';
import { AdminSupportRequests } from '../platform-admin-common/components/admin/AdminSupportRequests';
import { AdminMerchantSupport } from '../platform-admin-common/components/admin/AdminMerchantSupport';
import { AdminGrowthWorkbench } from '../platform-admin-common/components/admin/AdminGrowthWorkbench';
import { AdminGrowthAcquisition } from '../platform-admin-common/components/admin/AdminGrowthAcquisition';
import { AdminGrowthContent } from '../platform-admin-common/components/admin/AdminGrowthContent';
import { AdminGrowthAnalytics } from '../platform-admin-common/components/admin/AdminGrowthAnalytics';
import { AdminFashionContentHub } from '../platform-admin-common/components/admin/AdminFashionContentHub';
import { AdminAiControlCenter } from '../platform-admin-common/components/admin/AdminAiControlCenter';
import { AdminModaGptOperator } from '../platform-admin-common/components/admin/AdminModaGptOperator';
import { AdminDatabaseCenter } from '../platform-admin-common/components/admin/AdminDatabaseCenter';
import { AdminRiskMonitor } from '../platform-admin-common/components/admin/AdminRiskMonitor';
import { AdminInventoryCenter } from '../platform-admin-common/components/admin/AdminInventoryCenter';
import { AdminNotificationEvents } from '../platform-admin-common/components/admin/AdminNotificationEvents';
import { AdminModaGptBilling } from '../platform-admin-common/components/admin/AdminModaGptBilling';
import { AdminFeatureFlags } from '../platform-admin-common/components/admin/AdminFeatureFlags';
import { AdminAppStoreMgmt } from '../platform-admin-common/components/admin/AdminAppStoreMgmt';
import { AdminPageHeader } from '../platform-admin-common/components/admin/AdminPageHeader';
import { AdminMerchantCenter } from '../platform-admin-common/components/admin/AdminMerchantCenter';
import { countryOptions, getCityOptions } from '../../constants/countries';
import { ADMIN_AREAS, ADMIN_AREA_ITEMS, getAdminAreaForTab, normalizeAdminTab, type AdminArea, type AdminTab } from '../platform-admin-common/components/admin/adminNavigation';

const isStorefrontEnabled = (merchant: Pick<Merchant, 'isVerified' | 'storefrontEnabled'>) =>
  merchant.storefrontEnabled === true || (merchant.storefrontEnabled == null && merchant.isVerified);

export const PlatformAdmin: React.FC<{ initialTab?: AdminTab }> = ({ initialTab = 'overview' }) => {
  const { 
    products = [], 
    orders = [], 
    customers = [], 
    showrooms = [], 
    appointments = [], 
    merchants = [],
    addMerchant,
    updateMerchant,
    updateProduct,
    replaceProductFromServer,
    vaultRequests = [],
    approveVaultAccess,
    rejectVaultAccess,
    adminReviewVaultRequest,
    transfers = [],
    auditLogs = [],
    updatePayoutStatus,
    approveReturn,
    rejectReturn,
    transferStock, 
      adminUpdateOrderStatus,
    reviewCustomer, 
    setCustomerTier,
    adminUpdateAppointmentStatus,
    addNotification,
    assumeMerchantFromAdmin,
    handleAdminSessionExpired,
    setCurrentView,
    setPortalMode,
    setActiveMerchantId,
    setSelectedMerchantId,
    setAuthMerchantId,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';

  const [adminTab, setAdminTab] = useState<AdminTab>(normalizeAdminTab(initialTab));
  const [adminArea, setAdminArea] = useState<AdminArea>(() => getAdminAreaForTab(initialTab));
  const [auditVisibleCount, setAuditVisibleCount] = useState(50);
  const selectAdminTab = (tab: AdminTab) => {
    const resolvedTab = normalizeAdminTab(tab);
    setAdminTab(resolvedTab);
    setAdminArea(getAdminAreaForTab(resolvedTab));
    if (resolvedTab === 'audit_logs') setAuditVisibleCount(50);
  };
  const selectAdminArea = (area: AdminArea) => {
    const firstItem = ADMIN_AREA_ITEMS[area][0];
    if (firstItem) selectAdminTab(firstItem.key);
  };
  type NotificationConfig = {
    email: { enabled: boolean; provider: string; from: string; configured: boolean };
    sms: { enabled: boolean; provider: string; from: string; accountSid: string; configured: boolean };
    whatsapp: { enabled: boolean; provider: string; from: string; accountSid: string; configured: boolean };
  };
  type FooterConfig = {
    companyName: string;
    phone: string;
    address: string;
    email: string;
    instagram: string;
    brandName: string;
    brandBadge: string;
    descriptionZh: string;
    descriptionIt: string;
    complianceZh: string;
    complianceIt: string;
    servicesTitleZh: string;
    servicesTitleIt: string;
    catalogLabelZh: string;
    catalogLabelIt: string;
    registerLabelZh: string;
    registerLabelIt: string;
    ordersLabelZh: string;
    ordersLabelIt: string;
    termsLabelZh: string;
    termsLabelIt: string;
    directoryTitleZh: string;
    directoryTitleIt: string;
    directoryDescriptionZh: string;
    directoryDescriptionIt: string;
    mediaTitleZh: string;
    mediaTitleIt: string;
    mediaDisclaimerZh: string;
    mediaDisclaimerIt: string;
    legalDocumentLabelZh: string;
    legalDocumentLabelIt: string;
    legalTagline: string;
    legalLocations: string;
    sectionCatalogZh: string;
    sectionCatalogIt: string;
    sectionShowroomsZh: string;
    sectionShowroomsIt: string;
    sectionFashionZh: string;
    sectionFashionIt: string;
    sectionAboutZh: string;
    sectionAboutIt: string;
    sectionRegisterZh: string;
    sectionRegisterIt: string;
    mediaLinks: Array<{ name: string; url: string }>;
  };
  type HomepageVideoConfig = { videoUrl: string };
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | null>(null);
  const [notificationConfigError, setNotificationConfigError] = useState('');
  const [notificationConfigLoading, setNotificationConfigLoading] = useState(false);
  const [footerConfig, setFooterConfig] = useState<FooterConfig | null>(null);
  const [footerSaving, setFooterSaving] = useState(false);
  const [homepageVideoUrl, setHomepageVideoUrl] = useState('/videos/ruda-home.mp4');
  const [homepageVideoSaving, setHomepageVideoSaving] = useState(false);
  const [homepageVideoUploading, setHomepageVideoUploading] = useState(false);
  type IntegrationStatus = { configured: boolean; mode: string; callbackUrl?: string | null; callbackUrlError?: string | null };
  type ObjectStorageStatus = IntegrationStatus & {
    endpoint: string; region: string; bucket: string; publicBaseUrl: string;
    forcePathStyle: boolean; accessKeyIdConfigured: boolean; secretAccessKeyConfigured: boolean;
    mediaBackup?: {
      enabled: boolean; configured: boolean; endpoint: string; region: string; bucket: string; prefix: string;
      forcePathStyle: boolean; accessKeyIdConfigured: boolean; secretAccessKeyConfigured: boolean;
    };
    mediaBackupRuns?: MediaBackupRun[];
  };
  const [integrationStatus, setIntegrationStatus] = useState<Record<'google' | 'wechat' | 'facebook' | 'sharing', IntegrationStatus> & { objectStorage?: ObjectStorageStatus } | null>(null);
  const [integrationError, setIntegrationError] = useState('');
  const [integrationSecrets, setIntegrationSecrets] = useState({ googleClientId: '', googleClientSecret: '', wechatAppId: '', wechatAppSecret: '', facebookAppId: '', facebookAppSecret: '', facebookLoginConfigId: '', sharingSecret: '' });
  const [objectStorageForm, setObjectStorageForm] = useState({ endpoint: '', region: 'auto', bucket: '', accessKeyId: '', secretAccessKey: '', publicBaseUrl: '', forcePathStyle: false });
  const [mediaBackupForm, setMediaBackupForm] = useState({ enabled: false, endpoint: '', region: 'auto', bucket: '', prefix: 'media-backups', accessKeyId: '', secretAccessKey: '', forcePathStyle: false });
  const [mediaBackupStarting, setMediaBackupStarting] = useState(false);
  const [mediaBackupRestoring, setMediaBackupRestoring] = useState<string | null>(null);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationTesting, setIntegrationTesting] = useState<string | null>(null);
  const [notificationSecrets, setNotificationSecrets] = useState({ emailApiKey: '', smsAuthToken: '', whatsappAuthToken: '' });
  const [notificationSaving, setNotificationSaving] = useState(false);
  type RegistrationConfig = { requireVerification: boolean; allowedMethods: Array<'email' | 'phone' | 'google'>; codeTtlMinutes: number; resendCooldownSeconds: number; maxAttempts: number };
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig | null>(null);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [notificationTest, setNotificationTest] = useState({ channel: 'email', recipient: '' });
  const [merchantQuery, setMerchantQuery] = useState('');
  const [merchantForm, setMerchantForm] = useState({
    name: '', companyLegalName: '', vatNumber: '', industry: '', contactPerson: '', contactEmail: '', contactPhone: '',
    country: 'Italy', city: 'Milan', showroomAddress: '', password: ''
  });
  const [merchantCreating, setMerchantCreating] = useState(false);
  const [merchantPasswordTarget, setMerchantPasswordTarget] = useState<Merchant | null>(null);
  const [merchantPassword, setMerchantPassword] = useState('');
  const [merchantPasswordConfirm, setMerchantPasswordConfirm] = useState('');
  const [showMerchantPassword, setShowMerchantPassword] = useState(false);
  const [showMerchantPasswordConfirm, setShowMerchantPasswordConfirm] = useState(false);
  const [merchantPasswordSaving, setMerchantPasswordSaving] = useState(false);
  type ModaGptAdminSnapshot = {
    plan: 'free' | 'pro';
    expiresAt: string | null;
    quotas: { chat: number; imageGeneration: number; tryOn: number };
    usage: { chat: number; imageGeneration: number; tryOn: number };
    remaining: { chat: number; imageGeneration: number; tryOn: number };
  };
  const [modagptPlanTarget, setModagptPlanTarget] = useState<Merchant | null>(null);
  const [modagptPlanSnapshot, setModagptPlanSnapshot] = useState<ModaGptAdminSnapshot | null>(null);
  const [modagptPlanDraft, setModagptPlanDraft] = useState<'free' | 'pro'>('free');
  const [modagptPlanExpiry, setModagptPlanExpiry] = useState('');
  const [modagptPlanBusy, setModagptPlanBusy] = useState(false);
  type AccountReviewGroup = {
    email: string;
    accounts: Array<{
      id: string;
      role: string;
      identityId: string | null;
      emailVerifiedAt: string | null;
      lastLoginAt: string | null;
      merchantId: string | null;
      companyId: string | null;
      customerId: string | null;
    }>;
  };
  const [accountReviewGroups, setAccountReviewGroups] = useState<AccountReviewGroup[]>([]);
  const [accountReviewLoading, setAccountReviewLoading] = useState(false);
  const [accountReviewTab, setAccountReviewTab] = useState<'identities' | 'customers'>('identities');
  const [accountIdentityTarget, setAccountIdentityTarget] = useState<AccountReviewGroup | null>(null);
  const [accountIdentityPassword, setAccountIdentityPassword] = useState('');
  const [accountIdentityPasswordConfirm, setAccountIdentityPasswordConfirm] = useState('');
  const [showAccountIdentityPassword, setShowAccountIdentityPassword] = useState(false);
  const [showAccountIdentityPasswordConfirm, setShowAccountIdentityPasswordConfirm] = useState(false);
  const [accountIdentitySaving, setAccountIdentitySaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productStatus, setProductStatus] = useState<'all' | NonNullable<Product['lifecycleStatus']>>('all');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerStatus, setCustomerStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [ledgerCustomerId, setLedgerCustomerId] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState<'all' | OrderStatus>('all');

  // POS simulation state
  const [posShowroom, setPosShowroom] = useState<'central'>('central');
  const [posSku, setPosSku] = useState('');
  const [posQty, setPosQty] = useState<number>(2);
  const [posReceipt, setPosReceipt] = useState('');
  const [posError, setPosError] = useState('');
  const [posSaving, setPosSaving] = useState(false);
  const [posRequestId, setPosRequestId] = useState('');
  const [posRequestSignature, setPosRequestSignature] = useState('');
  const [appointmentRescheduleId, setAppointmentRescheduleId] = useState<string | null>(null);
  const [appointmentRescheduleDrafts, setAppointmentRescheduleDrafts] = useState<Record<string, { date: string; time: string }>>({});
  const [appointmentOverrides, setAppointmentOverrides] = useState<Record<string, Appointment>>({});
  const [appointmentRescheduleError, setAppointmentRescheduleError] = useState('');
  const [appointmentRescheduleBusy, setAppointmentRescheduleBusy] = useState(false);
  type IntelligenceData = {
    summary: { critical: number; warning: number; info: number };
    alerts: Array<{ severity: 'critical' | 'warning' | 'info'; type: string; entityId: string; message: string }>;
    analytics?: { recentGmv: number; previousGmv: number; gmvTrend: number; recentOrders: number; previousOrders: number };
    replenishment?: Array<{ productId: string; styleNo: string; name: string; stock: number; sold30d: number; daysCover: number | null; suggestedQty: number }>;
    merchantHealth?: Array<{ merchantId: string; merchantName: string; score: number; sales30d: number; orders30d: number; lowStockProducts: number }>;
  };
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);
  const [intelligenceStale, setIntelligenceStale] = useState(false);
  const [twoFactorConfigured, setTwoFactorConfigured] = useState<boolean | null>(null);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauthUrl: string; recoveryCodes: string[] } | null>(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [health, setHealth] = useState<{ status: string; database: { status: string; latencyMs: number }; risks: Record<string, number> } | null>(null);
  const [healthError, setHealthError] = useState('');
  const [healthLoading, setHealthLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<Array<{ id: string; entryType: string; amount: number; balanceAfter: number; note?: string }>>([]);
  const [stockRows, setStockRows] = useState<Array<{ id: string; sku: string; quantity: number; movementType: string; createdAt: string }>>([]);
  const [refundRows, setRefundRows] = useState<Array<{ id: string; orderId: string; amount: number; status: string; retryCount: number; provider?: string }>>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerErrors, setLedgerErrors] = useState<{ ledger: string; stock: string; refunds: string }>({ ledger: '', stock: '', refunds: '' });
  type FinancePayout = {
    id: string; merchantName: string; period: string; grossSales: number; platformFeeRate?: number; platformFeeAmount: number;
    paymentProcessingFee?: number; refunds?: number; netPayout: number; status: 'pending' | 'processing' | 'paid' | 'failed'; bankAccount: string;
    merchantAcknowledgedAt?: string | null;
    settlementReference?: string | null; settlementProof?: string | null; settledAt?: string | null; settledBy?: string | null;
    allocations: Array<{ orderId: string; grossAmount: number; refundAmount: number; netAmount: number; order?: { orderNo: string; date: string } }>;
  };
  const [financePayouts, setFinancePayouts] = useState<FinancePayout[] | null>(null);
  const [payoutLoadError, setPayoutLoadError] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [settlementEvidence, setSettlementEvidence] = useState<Record<string, { reference: string; proof: string }>>({});
  const payoutRows = financePayouts ?? [];
  const nextOrderStatus: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'confirmed',
    placed: 'confirmed',
    confirmed: 'picking',
    picking: 'shipped',
    shipped: 'delivered'
  };

  const enterMerchantPortal = async (merchant: typeof merchants[number]) => {
    const entered = await assumeMerchantFromAdmin(merchant.id);
    if (entered) addNotification('success', '已进入生产商后台', `当前操作对象：${merchant.name}`);
  };
  const openModaGptPlan = async (merchant: Merchant) => {
    setModagptPlanTarget(merchant);
    setModagptPlanSnapshot(null);
    setModagptPlanBusy(true);
    try {
      const snapshot = await apiGet<{ success: true } & ModaGptAdminSnapshot>(
        `/api/admin/merchants/${encodeURIComponent(merchant.id)}/modagpt-plan`
      );
      setModagptPlanSnapshot(snapshot);
      setModagptPlanDraft(snapshot.plan);
      setModagptPlanExpiry(snapshot.expiresAt ? snapshot.expiresAt.slice(0, 10) : '');
    } catch (error) {
      setModagptPlanTarget(null);
      addNotification('warning', 'ModaUI 套餐读取失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setModagptPlanBusy(false);
    }
  };
  const saveModaGptPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modagptPlanTarget || modagptPlanBusy) return;
    setModagptPlanBusy(true);
    try {
      const snapshot = await apiPut<{ success: true } & ModaGptAdminSnapshot>(
        `/api/admin/merchants/${encodeURIComponent(modagptPlanTarget.id)}/modagpt-plan`,
        {
        plan: modagptPlanDraft,
        expiresAt: modagptPlanDraft === 'pro' && modagptPlanExpiry
          ? `${modagptPlanExpiry}T23:59:59.999Z`
          : null
        }
      );
      setModagptPlanSnapshot(snapshot);
      setModagptPlanDraft(snapshot.plan);
      setModagptPlanExpiry(snapshot.expiresAt ? snapshot.expiresAt.slice(0, 10) : '');
      addNotification('success', 'ModaUI 套餐已更新', `${modagptPlanTarget.name} 已设置为 ${snapshot.plan === 'pro' ? '高级版' : '基础版'}`);
    } catch (error) {
      addNotification('warning', 'ModaUI 套餐更新失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setModagptPlanBusy(false);
    }
  };
  const resetMerchantPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!merchantPasswordTarget || merchantPasswordSaving) return;
    if (merchantPassword.length < 12 || merchantPassword.trim().length < 12) {
      addNotification('warning', '密码长度不足', '新密码至少需要 12 个字符');
      return;
    }
    if (merchantPassword !== merchantPasswordConfirm) {
      addNotification('warning', '两次密码不一致', '请确认两次输入的新密码完全相同');
      return;
    }

    setMerchantPasswordSaving(true);
    try {
      await apiPut(`/api/admin/merchants/${encodeURIComponent(merchantPasswordTarget.id)}/password`, {
        password: merchantPassword
      });
      addNotification('success', '商家密码已重置', `${merchantPasswordTarget.name} 的老板账号密码已更新`);
      setMerchantPasswordTarget(null);
      setMerchantPassword('');
      setMerchantPasswordConfirm('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAdminSessionExpired();
      } else if (error instanceof ApiError && error.code === 'MERCHANT_LOGIN_ACCOUNT_CONFLICT') {
        addNotification('warning', '商家密码重置失败', '该生产商存在多个登录账号，数据存在冲突，请联系技术人员核实后再试');
      } else if (error instanceof ApiError && error.code === 'MERCHANT_LOGIN_EMAIL_IN_USE') {
        addNotification('warning', '商家密码重置失败', '该生产商的联系邮箱已被其他账号占用，请先修改联系邮箱');
      } else if (error instanceof ApiError && error.code === 'ADMIN_PERMISSION_REQUIRED') {
        addNotification('warning', '商家密码重置失败', '当前管理员账号没有该操作权限，请联系超级管理员开通');
      } else {
        addNotification('warning', '商家密码重置失败', error instanceof Error ? error.message : '请稍后重试');
      }
    } finally {
      setMerchantPasswordSaving(false);
    }
  };
  const loadAccountIdentityReviews = async () => {
    setAccountReviewLoading(true);
    try {
      const result = await apiGet<{ reviewGroups: AccountReviewGroup[] }>('/api/admin/account-identities/review');
      setAccountReviewGroups(result.reviewGroups);
    } catch (error) {
      addNotification('warning', '统一账号审核列表加载失败', error instanceof Error ? error.message : '请检查账号管理权限');
    } finally {
      setAccountReviewLoading(false);
    }
  };
  useEffect(() => {
    if (adminTab === 'account_identities') void loadAccountIdentityReviews();
  }, [adminTab]);
  const linkAccountIdentity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountIdentityTarget || accountIdentitySaving) return;
    if (accountIdentityPassword.length < 12 || accountIdentityPassword.trim().length < 12) {
      addNotification('warning', '密码长度不足', '统一登录密码至少需要 12 个字符');
      return;
    }
    if (accountIdentityPassword !== accountIdentityPasswordConfirm) {
      addNotification('warning', '两次密码不一致', '请确认两次输入完全相同');
      return;
    }
    setAccountIdentitySaving(true);
    try {
      await apiPut('/api/admin/account-identities/link', {
        accountIds: accountIdentityTarget.accounts.map(account => account.id),
        password: accountIdentityPassword
      });
      addNotification('success', '账号已统一', `${accountIdentityTarget.email} 已使用同一组登录凭据`);
      setAccountIdentityTarget(null);
      setAccountIdentityPassword('');
      setAccountIdentityPasswordConfirm('');
      setShowAccountIdentityPassword(false);
      setShowAccountIdentityPasswordConfirm(false);
      await loadAccountIdentityReviews();
    } catch (error) {
      addNotification('warning', '账号统一失败', error instanceof Error ? error.message : '请检查账号状态后重试');
    } finally {
      setAccountIdentitySaving(false);
    }
  };
  const normalizeQuery = (value: string) => value.trim().toLocaleLowerCase();
  const filteredMerchants = useMemo(() => {
    const query = normalizeQuery(merchantQuery);
    return merchants.filter(merchant => !query || [merchant.name, merchant.code, merchant.companyLegalName, merchant.city, merchant.country, merchant.contactEmail].some(value => value?.toLocaleLowerCase().includes(query)));
  }, [merchants, merchantQuery]);
  const filteredProducts = useMemo(() => {
    const query = normalizeQuery(productQuery);
    return products.filter(product => (!query || [product.styleNo, product.name, product.brand, product.category].some(value => value?.toLocaleLowerCase().includes(query))) && (productStatus === 'all' || (product.lifecycleStatus || 'published') === productStatus));
  }, [products, productQuery, productStatus]);
  const filteredCustomers = useMemo(() => {
    const query = normalizeQuery(customerQuery);
    return customers.filter(customer => (!query || [customer.companyName, customer.contactPerson, customer.vatNumber, customer.email, customer.city, customer.country].some(value => value?.toLocaleLowerCase().includes(query))) && (customerStatus === 'all' || customer.status === customerStatus));
  }, [customers, customerQuery, customerStatus]);
  const filteredOrders = useMemo(() => {
    const query = normalizeQuery(orderQuery);
    return orders.filter(order => (!query || [order.orderNo, order.companyName, order.customerCompanyName, order.merchantName, order.shippingAddress?.city, order.shippingAddress?.country].some(value => value?.toLocaleLowerCase().includes(query))) && (orderStatus === 'all' || order.status === orderStatus));
  }, [orders, orderQuery, orderStatus]);
  const [aiSupportConfig, setAiSupportConfig] = useState({ enabled: true, welcomeMessage: '', fallbackMessage: '', quickQuestions: '' });
  const [aiSupportSaving, setAiSupportSaving] = useState(false);

  const refreshFinanceLedgers = async () => {
    setLedgerLoading(true);
    const customerId = ledgerCustomerId || customers[0]?.id;
    const [stockResult, refundsResult, ledgerResult] = await Promise.allSettled([
      apiGet<{ success: boolean; movements: typeof stockRows }>('/api/admin/inventory/movements?limit=30'),
      apiGet<{ success: boolean; refunds: typeof refundRows }>('/api/admin/refunds'),
      customerId ? apiGet<{ success: boolean; entries: typeof ledgerRows }>(`/api/admin/credit-ledger/${encodeURIComponent(customerId)}`) : Promise.resolve(null)
    ]);
    const errorMessage = (result: PromiseSettledResult<unknown>, fallback: string) => (
      result.status === 'rejected'
        ? result.reason instanceof Error ? result.reason.message : fallback
        : ''
    );
    const stockOk = stockResult.status === 'fulfilled' && stockResult.value.success && Array.isArray(stockResult.value.movements);
    const refundsOk = refundsResult.status === 'fulfilled' && refundsResult.value.success && Array.isArray(refundsResult.value.refunds);
    const ledgerOk = ledgerResult.status === 'fulfilled' && (ledgerResult.value === null || (ledgerResult.value.success && Array.isArray(ledgerResult.value.entries)));
    if (stockOk && stockResult.status === 'fulfilled') {
      setStockRows(stockResult.value.movements);
    } else {
      setStockRows([]);
    }
    if (refundsOk && refundsResult.status === 'fulfilled') {
      setRefundRows(refundsResult.value.refunds);
    } else {
      setRefundRows([]);
    }
    if (ledgerOk && ledgerResult.status === 'fulfilled' && ledgerResult.value !== null) {
      setLedgerRows(ledgerResult.value.entries);
    } else {
      setLedgerRows([]);
    }
    setLedgerErrors({
      stock: errorMessage(stockResult, '库存流水加载失败') || (!stockOk ? '库存流水接口返回的数据格式无效' : ''),
      refunds: errorMessage(refundsResult, '退款记录加载失败') || (!refundsOk ? '退款记录接口返回的数据格式无效' : ''),
      ledger: errorMessage(ledgerResult, '客户台账加载失败') || (!ledgerOk ? '客户台账接口返回的数据格式无效' : '')
    });
    setLedgerLoading(false);
  };

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const data = await apiGet<{ status: string; database: { status: string; latencyMs: number }; risks: Record<string, number> }>('/api/admin/health');
      setHealth(data);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : '后台健康状态加载失败，请重试');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === 'finance') {
      void refreshFinanceLedgers();
      void refreshPayouts();
    }
  }, [adminTab, customers.length, ledgerCustomerId]);

  const refreshPayouts = async () => {
    setPayoutLoading(true);
    setPayoutLoadError('');
    try {
      const data = await apiGet<{ success: boolean; payouts: FinancePayout[] }>('/api/admin/payouts');
      if (!data.success || !Array.isArray(data.payouts)) throw new Error('结算记录接口返回的数据格式无效');
      setFinancePayouts(data.payouts);
    } catch (error) {
      setPayoutLoadError(error instanceof Error ? error.message : '结算记录加载失败，请重试');
    } finally {
      setPayoutLoading(false);
    }
  };

  const generatePayoutDrafts = async () => {
    const period = new Date().toISOString().slice(0, 7);
    setPayoutBusy(true);
    try {
      const data = await apiPost<{ count: number }>('/api/admin/payouts/generate', { period });
      await refreshPayouts();
      addNotification('success', '结算草稿已生成', `${period} 已创建 ${data.count} 份可审计结算草稿`);
    } catch (error) {
      addNotification('warning', '生成结算草稿失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setPayoutBusy(false);
    }
  };

  const updateFinancePayoutStatus = async (payoutId: string, status: FinancePayout['status'], evidence?: { reference: string; proof: string }) => {
    setPayoutBusy(true);
    try {
      await apiPut(`/api/admin/payouts/${encodeURIComponent(payoutId)}/status`, {
        status,
        ...(evidence ? { settlementReference: evidence.reference, settlementProof: evidence.proof } : {})
      });
      await refreshPayouts();
      if (status === 'paid') setSettlementEvidence(current => ({ ...current, [payoutId]: { reference: '', proof: '' } }));
      addNotification('success', status === 'paid' ? '人工结算记录已保存' : '结算状态已更新', status === 'paid' ? `批次 ${payoutId} 的人工结算凭证、操作员和时间已记录。系统没有执行资金转账。` : `批次 ${payoutId} 状态已更新。`);
    } catch (error) {
      addNotification('warning', status === 'paid' ? '人工结算记录失败' : '结算状态更新失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setPayoutBusy(false);
    }
  };

  const refreshIntelligence = async (): Promise<{ success: boolean; retryAfter?: number }> => {
    setIntelligenceLoading(true);
    try {
      const data = await apiGet<{ success: true } & IntelligenceData>('/api/admin/operations/intelligence');
      setIntelligence({
        summary: data.summary,
        alerts: data.alerts,
        analytics: data.analytics,
        replenishment: data.replenishment,
        merchantHealth: data.merchantHealth
      });
      setIntelligenceStale(false);
      return { success: true };
    } catch (error) {
      setIntelligenceStale(true);
      if (!(error instanceof ApiError && error.status === 429)) {
        console.error('[admin-intelligence]', error);
      }
      return {
        success: false,
        ...(error instanceof ApiError && error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {})
      };
    } finally {
      setIntelligenceLoading(false);
    }
  };

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    if (adminTab !== 'overview') return;
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    let retryDelay = 60_000;

    const schedule = (delay: number) => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), delay);
    };

    const refresh = async () => {
      if (cancelled || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      const result = await refreshIntelligence();
      inFlight = false;
      if (cancelled) return;
      if (result.success) {
        retryDelay = 60_000;
        schedule(retryDelay);
      } else {
        retryDelay = Math.min(15 * 60_000, Math.max(retryDelay * 2, (result.retryAfter ?? 0) * 1000));
        schedule(retryDelay);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timer !== undefined) window.clearTimeout(timer);
        void refresh();
      } else if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refresh();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [adminTab]);

  const saveIntegrationSecrets = async () => {
    setIntegrationSaving(true);
    try {
      const objectStoragePayload: Record<string, string | boolean> = { forcePathStyle: objectStorageForm.forcePathStyle };
      if (objectStorageForm.endpoint.trim()) objectStoragePayload.endpoint = objectStorageForm.endpoint.trim();
      if (objectStorageForm.region.trim()) objectStoragePayload.region = objectStorageForm.region.trim();
      if (objectStorageForm.bucket.trim()) objectStoragePayload.bucket = objectStorageForm.bucket.trim();
      if (objectStorageForm.accessKeyId.trim()) objectStoragePayload.accessKeyId = objectStorageForm.accessKeyId.trim();
      if (objectStorageForm.secretAccessKey.trim()) objectStoragePayload.secretAccessKey = objectStorageForm.secretAccessKey.trim();
      if (objectStorageForm.publicBaseUrl.trim()) objectStoragePayload.publicBaseUrl = objectStorageForm.publicBaseUrl.trim();
      const mediaBackupPayload: Record<string, string | boolean> = {
        enabled: mediaBackupForm.enabled,
        forcePathStyle: mediaBackupForm.forcePathStyle,
        endpoint: mediaBackupForm.endpoint.trim(),
        region: mediaBackupForm.region.trim(),
        bucket: mediaBackupForm.bucket.trim(),
        prefix: mediaBackupForm.prefix.trim()
      };
      if (mediaBackupForm.accessKeyId.trim()) mediaBackupPayload.accessKeyId = mediaBackupForm.accessKeyId.trim();
      if (mediaBackupForm.secretAccessKey.trim()) mediaBackupPayload.secretAccessKey = mediaBackupForm.secretAccessKey.trim();
      await apiPut('/api/admin/settings/integrations', {
        google: { clientId: integrationSecrets.googleClientId, clientSecret: integrationSecrets.googleClientSecret },
        wechat: { appId: integrationSecrets.wechatAppId, appSecret: integrationSecrets.wechatAppSecret },
        facebook: { appId: integrationSecrets.facebookAppId, appSecret: integrationSecrets.facebookAppSecret, loginConfigId: integrationSecrets.facebookLoginConfigId },
        sharing: { secret: integrationSecrets.sharingSecret },
        objectStorage: objectStoragePayload,
        mediaBackupS3: mediaBackupPayload
      });
      setIntegrationSecrets({ googleClientId: '', googleClientSecret: '', wechatAppId: '', wechatAppSecret: '', facebookAppId: '', facebookAppSecret: '', facebookLoginConfigId: '', sharingSecret: '' });
      setObjectStorageForm(previous => ({ ...previous, accessKeyId: '', secretAccessKey: '' }));
      setMediaBackupForm(previous => ({ ...previous, accessKeyId: '', secretAccessKey: '' }));
      addNotification('success', '第三方配置已加密保存', '密钥不会回显到页面');
      const status = await apiGet<Record<'google' | 'wechat' | 'facebook' | 'sharing', IntegrationStatus> & { objectStorage?: ObjectStorageStatus }>('/api/admin/settings/integrations');
      setIntegrationStatus(status);
    } catch (error) {
      addNotification('warning', '第三方配置保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const testIntegration = async (provider: string) => {
    setIntegrationTesting(provider);
    try {
      await apiPost('/api/admin/settings/integrations/test', { provider });
      addNotification('success', '连接测试成功', `${provider} API 已响应`);
    } catch (error) {
      addNotification('warning', '连接测试失败', error instanceof Error ? error.message : '请检查凭证和回调配置');
    } finally {
      setIntegrationTesting(null);
    }
  };

  const startMediaBackup = async () => {
    if (!integrationStatus?.objectStorage?.mediaBackup?.enabled) {
      addNotification('warning', '媒体备份尚未启用', '请先保存独立的媒体备份 Bucket 配置');
      return;
    }
    if (window.prompt('此操作会把所有当前媒体对象复制到独立备份 Bucket，并产生云存储费用。请输入“开始媒体备份”继续：') !== '开始媒体备份') return;
    setMediaBackupStarting(true);
    try {
      await apiPost('/api/admin/settings/integrations/media-backup/start', { confirm: true });
      const status = await apiGet<Record<'google' | 'wechat' | 'facebook' | 'sharing', IntegrationStatus> & { objectStorage?: ObjectStorageStatus }>('/api/admin/settings/integrations');
      setIntegrationStatus(status);
      addNotification('success', '媒体备份已启动', '后台正在复制并校验对象；可在本面板查看进度。');
    } catch (error) {
      addNotification('warning', '媒体备份启动失败', error instanceof Error ? error.message : '请检查备份存储配置');
    } finally {
      setMediaBackupStarting(false);
    }
  };

  const restoreMissingMedia = async (runId: string) => {
    if (window.prompt('只会恢复当前 Bucket 中缺失的对象，不会覆盖已有文件。请输入“恢复缺失媒体”继续：') !== '恢复缺失媒体') return;
    setMediaBackupRestoring(runId);
    try {
      const result = await apiPost<{
        restored: { restoredObjects: number; alreadyPresentObjects: number; restoredBytes: number };
      }>('/api/admin/settings/integrations/media-backup/restore-missing', { runId, confirm: true }, 30 * 60 * 1000);
      addNotification(
        'success',
        '媒体恢复验证完成',
        `恢复 ${result.restored.restoredObjects} 个对象；${result.restored.alreadyPresentObjects} 个对象已存在且未覆盖。`
      );
    } catch (error) {
      addNotification('warning', '媒体恢复失败', error instanceof Error ? error.message : '请检查备份清单和对象存储权限');
    } finally {
      setMediaBackupRestoring(null);
    }
  };

  useEffect(() => {
    if (adminTab !== 'ai_support') return;
    apiGet<{ success: boolean; config: { enabled: boolean; welcomeMessage: string; fallbackMessage: string; quickQuestions: string[] } }>('/api/admin/ai-support/config')
      .then(data => setAiSupportConfig({ ...data.config, quickQuestions: data.config.quickQuestions.join('\n') }))
      .catch(error => addNotification('warning', 'AI 客服配置读取失败', error instanceof Error ? error.message : '请稍后重试'));
  }, [adminTab]);

  const refreshNotificationConfig = useCallback(async () => {
    setNotificationConfigLoading(true);
    setNotificationConfigError('');
    try {
      const result = await apiGet<{ success: true; config: NotificationConfig }>('/api/admin/notifications/config');
      setNotificationConfig(result.config);
    } catch (error) {
      setNotificationConfigError(error instanceof Error ? error.message : '通知配置读取失败，请重试');
    } finally {
      setNotificationConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab !== 'notifications' && adminTab !== 'settings') return;
    void refreshNotificationConfig();
  }, [adminTab, refreshNotificationConfig]);

  useEffect(() => {
    if (adminTab !== 'settings') return;
    apiGet<{ success: true; config: FooterConfig }>('/api/admin/footer-config')
      .then(result => setFooterConfig(result.config))
      .catch(error => addNotification('warning', '页脚信息读取失败', error instanceof Error ? error.message : '请稍后重试'));
    apiGet<{ success: true; config: HomepageVideoConfig }>('/api/admin/homepage-video-config')
      .then(result => setHomepageVideoUrl(result.config.videoUrl))
      .catch(error => addNotification('warning', '首页视频配置读取失败', error instanceof Error ? error.message : '请稍后重试'));
    apiGet<{ success: true; config: RegistrationConfig }>('/api/admin/settings/registration')
      .then(result => setRegistrationConfig(result.config))
      .catch(error => addNotification('warning', '注册策略读取失败', error instanceof Error ? error.message : '请稍后重试'));
  }, [adminTab]);

  const saveRegistrationSettings = async () => {
    if (!registrationConfig) return;
    setRegistrationSaving(true);
    try {
      const result = await apiPut<{ success: true; config: RegistrationConfig }>('/api/admin/settings/registration', registrationConfig);
      setRegistrationConfig(result.config);
      addNotification('success', '注册策略已保存', '联系方式验证规则已更新');
    } catch (error) {
      addNotification('warning', '注册策略保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setRegistrationSaving(false);
    }
  };

  const saveFooterSettings = async () => {
    if (!footerConfig) return;
    setFooterSaving(true);
    try {
      const result = await apiPut<{ success: true; config: FooterConfig }>('/api/admin/footer-config', footerConfig);
      setFooterConfig(result.config);
      addNotification('success', '页脚信息已保存', '前台页脚刷新后会显示最新公司信息');
    } catch (error) {
      addNotification('warning', '页脚信息保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setFooterSaving(false);
    }
  };

  const saveHomepageVideo = async (videoUrl = homepageVideoUrl) => {
    setHomepageVideoSaving(true);
    try {
      const result = await apiPut<{ success: true; config: HomepageVideoConfig }>('/api/admin/homepage-video-config', { videoUrl });
      setHomepageVideoUrl(result.config.videoUrl);
      addNotification('success', '首页视频已发布', '首页刷新后将播放最新视频');
    } catch (error) {
      addNotification('warning', '首页视频保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setHomepageVideoSaving(false);
    }
  };

  const uploadHomepageVideo = async (file: File) => {
    const extension = file.name.toLowerCase().split('.').pop();
    const contentType = file.type || (extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : '');
    if (!['video/mp4', 'video/webm'].includes(contentType)) {
      addNotification('warning', '视频格式不支持', '请选择 MP4 或 WebM 视频');
      return;
    }
    if (file.size === 0 || file.size > 200 * 1024 * 1024) {
      addNotification('warning', '视频大小不符合要求', '视频需大于 0 且不超过 200MB');
      return;
    }

    setHomepageVideoUploading(true);
    try {
      const uploadConfig = await apiPost<{ success: true; uploadUrl: string; publicUrl: string }>('/api/admin/homepage-video/presign', { contentType });
      const upload = await fetch(uploadConfig.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public,max-age=31536000,immutable' },
        body: file
      });
      if (!upload.ok) throw new Error('视频上传失败，请检查对象存储 CORS 配置');
      await saveHomepageVideo(uploadConfig.publicUrl);
    } catch (error) {
      addNotification('warning', '首页视频上传失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setHomepageVideoUploading(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!notificationConfig) return;
    setNotificationSaving(true);
    try {
      const result = await apiPut<{ success: true; config: NotificationConfig }>('/api/admin/notifications/config', {
        email: { enabled: notificationConfig.email.enabled, from: notificationConfig.email.from, apiKey: notificationSecrets.emailApiKey },
        sms: { enabled: notificationConfig.sms.enabled, from: notificationConfig.sms.from, accountSid: notificationConfig.sms.accountSid, authToken: notificationSecrets.smsAuthToken },
        whatsapp: { enabled: notificationConfig.whatsapp.enabled, from: notificationConfig.whatsapp.from, accountSid: notificationConfig.whatsapp.accountSid, authToken: notificationSecrets.whatsappAuthToken }
      });
      setNotificationConfig(result.config);
      setNotificationSecrets({ emailApiKey: '', smsAuthToken: '', whatsappAuthToken: '' });
      addNotification('success', '通知配置已保存', '外部渠道配置已更新，密钥不会回显');
    } catch (error) {
      addNotification('warning', '通知配置保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setNotificationSaving(false);
    }
  };

  const sendNotificationTest = async () => {
    try {
      await apiPost('/api/admin/notifications/test', notificationTest);
      addNotification('success', '测试通知已发送', `已向 ${notificationTest.recipient} 发出 ${notificationTest.channel} 测试`);
    } catch (error) {
      addNotification('warning', '测试通知失败', error instanceof Error ? error.message : '请检查渠道配置和收件地址');
    }
  };

  const saveAiSupportConfig = async () => {
    setAiSupportSaving(true);
    try {
      const data = await apiPut<{ success: boolean; config: { enabled: boolean; welcomeMessage: string; fallbackMessage: string; quickQuestions: string[] } }>('/api/admin/ai-support/config', {
        ...aiSupportConfig,
        quickQuestions: aiSupportConfig.quickQuestions.split('\n').map(item => item.trim()).filter(Boolean)
      });
      setAiSupportConfig({ ...data.config, quickQuestions: data.config.quickQuestions.join('\n') });
      addNotification('success', 'AI 客服设置已保存', '首页客服入口会立即使用新配置');
    } catch (error) {
      addNotification('warning', 'AI 客服保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setAiSupportSaving(false);
    }
  };

  const refreshTwoFactorStatus = useCallback(async () => {
    setTwoFactorError('');
    try {
      const data = await apiGet<{ configured: boolean }>('/api/admin/2fa');
      setTwoFactorConfigured(Boolean(data.configured));
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : '2FA 状态读取失败');
    }
  }, []);

  useEffect(() => {
    void refreshTwoFactorStatus();
  }, [refreshTwoFactorStatus]);

  const refreshIntegrationStatus = useCallback(async (syncForms = false) => {
    try {
      const status = await apiGet<Record<'google' | 'wechat' | 'facebook' | 'sharing', IntegrationStatus> & { objectStorage?: ObjectStorageStatus }>('/api/admin/settings/integrations');
      setIntegrationStatus(status);
      setIntegrationError('');
      if (syncForms && status.objectStorage) {
        setObjectStorageForm(previous => ({
          ...previous,
          endpoint: status.objectStorage!.endpoint || previous.endpoint,
          region: status.objectStorage!.region || previous.region,
          bucket: status.objectStorage!.bucket || previous.bucket,
          publicBaseUrl: status.objectStorage!.publicBaseUrl || previous.publicBaseUrl,
          forcePathStyle: status.objectStorage!.forcePathStyle
        }));
        setMediaBackupForm(previous => ({
          ...previous,
          enabled: status.objectStorage!.mediaBackup?.enabled ?? false,
          endpoint: status.objectStorage!.mediaBackup?.endpoint || previous.endpoint,
          region: status.objectStorage!.mediaBackup?.region || previous.region,
          bucket: status.objectStorage!.mediaBackup?.bucket || previous.bucket,
          prefix: status.objectStorage!.mediaBackup?.prefix || previous.prefix,
          forcePathStyle: status.objectStorage!.mediaBackup?.forcePathStyle ?? false
        }));
      }
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : '集成状态加载失败，请重试');
    }
  }, []);

  useEffect(() => {
    void refreshIntegrationStatus(true);
  }, [refreshIntegrationStatus]);

  useEffect(() => {
    if (integrationStatus?.objectStorage?.mediaBackupRuns?.[0]?.status !== 'RUNNING') return;
    const timer = window.setInterval(() => {
      void refreshIntegrationStatus();
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [
    refreshIntegrationStatus,
    integrationStatus?.objectStorage?.mediaBackupRuns?.[0]?.id,
    integrationStatus?.objectStorage?.mediaBackupRuns?.[0]?.status
  ]);

  const setupTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      const data = await apiPost<{ success: true; secret: string; otpauthUrl: string; recoveryCodes: string[] }>('/api/admin/2fa/setup', { currentPassword: twoFactorPassword });
      setTwoFactorSetup(data);
      setTwoFactorPassword('');
    } catch (error) {
      addNotification('warning', '2FA 初始化失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      await apiPost<{ success: true }>('/api/admin/2fa/enable', { code: twoFactorCode });
      setTwoFactorConfigured(true);
      setTwoFactorCode('');
      addNotification('success', '管理员 2FA 已启用', '以后登录总后台必须输入动态验证码');
    } catch (error) {
      addNotification('warning', '2FA 验证失败', error instanceof Error ? error.message : '请检查验证码');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  // Platform Metrics
  const totalGmv = orders.reduce((sum, o) => sum + (o?.totalAmount || 0), 0);
  const platformRevenue = orders.reduce((sum, order) => {
    const merchant = merchants.find(item => item.id === (order.merchantId || order.items[0]?.merchantId));
    return sum + (order.totalAmount || 0) * (merchant?.platformFeeRate ?? 0.08);
  }, 0);
  const totalUnitsOrdered = orders.reduce((sum, o) => sum + (o?.totalQty || 0), 0);
  const pendingCustomerAudits = customers.filter(c => c?.status === 'pending');
  const pendingOrders = orders.filter(o => o?.status === 'placed' || o?.status === 'picking');

  let totalCentralStock = 0;
  let totalMestreStock = 0;
  let totalMilanoStock = 0;
  products.forEach(p => {
    (p?.skus || []).forEach(s => {
      totalCentralStock += s?.stockCentral || 0;
      totalMestreStock += s?.stockMestre || 0;
      totalMilanoStock += s?.stockMilano || 0;
    });
  });
  const grandTotalStock = totalCentralStock + totalMestreStock + totalMilanoStock;
  const adminAreaItems = ADMIN_AREA_ITEMS[adminArea];
  const getAdminNavBadge = (key: AdminTab): number | null => {
    if (key === 'merchants') return merchants.length;
    if (key === 'account_identities') return accountReviewGroups.length + pendingCustomerAudits.length;
    if (key === 'customers') return pendingCustomerAudits.length;
    if (key === 'orders') return orders.length;
    if (key === 'products') return products.length;
    if (key === 'vault_requests') return vaultRequests.filter(request => request.status === 'pending').length;
    if (key === 'audit_logs') return auditLogs.length;
    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 text-neutral-900 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-sm font-bold tracking-tight">RUDA</span>
          <span className="text-xs text-neutral-500">平台后台</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('merchant_portal')}
            className="flex h-8 items-center gap-1.5 border border-neutral-200 px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:px-3"
          >
            <Building2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">商家后台</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            aria-label="采购商城，外部跳转"
            title="外部跳转到共享采购商城"
            className="flex h-8 items-center gap-1.5 bg-neutral-950 px-2.5 text-[11px] font-semibold text-white transition hover:bg-neutral-800 sm:px-3"
          >
            <ShoppingBag className="h-3.5 w-3.5" /><span>采购商城</span><span className="inline-flex items-center gap-0.5 border border-white/30 px-1 text-[9px]"><ExternalLink className="h-2.5 w-2.5" />外部</span>
          </button>
        </div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] w-full max-w-[1800px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] flex-col overflow-hidden border-r border-neutral-200 bg-neutral-50 p-3 lg:flex">
          <div className="grid grid-cols-2 gap-1 border-b border-neutral-200 pb-3">
            {ADMIN_AREAS.map(area => (
              <button
                key={area.key}
                type="button"
                aria-pressed={adminArea === area.key}
                onClick={() => selectAdminArea(area.key)}
                className={`px-2 py-2 text-[11px] font-bold transition ${
                  adminArea === area.key ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {area.label}
              </button>
            ))}
          </div>
          <nav aria-label={`${ADMIN_AREAS.find(area => area.key === adminArea)?.label}导航`} className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 pb-3">
            {adminAreaItems.map(item => {
              const active = adminTab === item.key;
              const badge = getAdminNavBadge(item.key);
              return (
                <button
                  key={item.key}
                  id={`admin-sidebar-${item.key}`}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectAdminTab(item.key)}
                  className={`inline-flex w-full items-center px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    active ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-white hover:text-neutral-950'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {badge !== null && badge > 0 && <span className="min-w-5 rounded-full bg-white/80 px-1.5 py-0.5 text-center text-[9px] font-bold text-neutral-500">{badge > 99 ? '99+' : badge}</span>}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <nav aria-label="后台分类" className="sticky top-12 z-40 grid grid-cols-2 gap-1 border-b border-neutral-200 bg-white px-2 pt-2 lg:hidden">
            {ADMIN_AREAS.map(area => (
              <button
                key={area.key}
                type="button"
                aria-pressed={adminArea === area.key}
                onClick={() => selectAdminArea(area.key)}
                className={`px-3 py-2 text-xs font-bold ${
                  adminArea === area.key ? 'border-b-2 border-neutral-950 text-neutral-950' : 'text-neutral-500'
                }`}
              >
                {area.label}
              </button>
            ))}
          </nav>
          <nav aria-label={`${ADMIN_AREAS.find(area => area.key === adminArea)?.label}快速导航`} className="sticky top-24 z-40 flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2 scrollbar-none lg:hidden">
            {adminAreaItems.map(item => (
              <button
                key={item.key}
                type="button"
                aria-current={adminTab === item.key ? 'page' : undefined}
                onClick={() => selectAdminTab(item.key)}
                className={`shrink-0 px-3 py-2 text-[11px] font-semibold transition ${
                  adminTab === item.key ? 'border-b-2 border-neutral-950 text-neutral-950' : 'text-neutral-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <main className="min-w-0 space-y-4 bg-neutral-100/70 px-3 py-4 sm:px-5 lg:min-h-[calc(100vh-3.5rem)] lg:px-6 lg:py-5">
      {/* 3. TAB CONTENT */}

      {adminTab === 'overview' && <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="平台经营指标">
        {[
          { label: '全平台交易额', value: `€${totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign },
          { label: '平台佣金收益', value: `€${platformRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: TrendingUp },
          { label: '入驻生产商', value: `${merchants.length} 家`, icon: Building2 },
          { label: '全网在售款式', value: `${products.length} 款`, icon: Package },
          { label: '全网现货库存', value: `${grandTotalStock.toLocaleString()} 件`, icon: Boxes },
          { label: '待审零售商', value: `${pendingCustomerAudits.length} 家`, icon: Users }
        ].map(metric => {
          const Icon = metric.icon;
          return <article key={metric.label} className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-neutral-500 sm:text-[11px]">
              <span>{metric.label}</span><Icon className="h-4 w-4 shrink-0 text-emerald-700" />
            </div>
            <div className="mt-2 truncate text-base font-bold tracking-tight text-neutral-950 sm:text-lg">{metric.value}</div>
          </article>;
        })}
      </section>}

      {adminTab === 'fashion_content' && <AdminFashionContentHub initialSection={initialTab === 'gallery' ? 'gallery' : initialTab === 'website_collector' ? 'collector' : 'community'} />}
      {adminTab === 'support_requests' && <AdminSupportRequests />}
      {adminTab === 'merchant_support' && <AdminMerchantSupport />}
      {adminTab === 'merchant_support_settings' && <AdminMerchantSupport mode="settings" />}
      {adminTab === 'growth_workbench' && <AdminGrowthWorkbench onOpenTool={tool => selectAdminTab(tool === 'acquisition' ? 'growth_acquisition' : tool === 'content' ? 'growth_content' : tool === 'fashion' ? 'fashion_content' : 'growth_analytics')} />}
      {adminTab === 'growth_acquisition' && <AdminGrowthAcquisition />}
      {adminTab === 'growth_content' && <AdminGrowthContent />}
      {adminTab === 'growth_analytics' && <AdminGrowthAnalytics />}
      {adminTab === 'ai_center' && <AdminAiControlCenter view="agents" />}
      {adminTab === 'ai_provider_settings' && <AdminAiControlCenter view="models" />}
      {adminTab === 'modagpt_operator' && <AdminModaGptOperator merchants={merchants.map(merchant => ({ id: merchant.id, name: merchant.name }))} />}
      {adminTab === 'modagpt_billing' && <AdminModaGptBilling />}
      {adminTab === 'feature_flags' && <AdminFeatureFlags />}
      {adminTab === 'database_center' && <AdminDatabaseCenter />}
      {adminTab === 'risk_monitor' && <AdminRiskMonitor />}
      {adminTab === 'app_store_mgmt' && <AdminAppStoreMgmt />}

      {adminTab === 'settings' && (
        <section className="space-y-5">
          <PasswordChangeForm audience="admin" />
          <div className="bg-neutral-950 text-white rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-neutral-300" /><h2 className="text-base font-bold">平台设置</h2></div>
            <p className="text-xs text-neutral-400 mt-2">平台所有系统级配置统一入口。敏感凭证只保留在服务端，不会在页面回显。</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Receipt className="h-4 w-4" />支付渠道设置</h3>
              <p className="mb-4 mt-1 text-xs text-neutral-500">平台级支付集成配置；财务模块只保留结算与付款业务操作。</p>
              <PaymentSettingsCard audience="admin" isIt={isIt} />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">管理员 2FA 安全设置</h3>
                <span className="ml-auto rounded-full border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-700">{twoFactorConfigured === null ? '检查中…' : twoFactorConfigured ? '已启用' : '未启用'}</span>
              </div>
              {twoFactorError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800">
                <span>2FA 状态读取失败：{twoFactorError}</span>
                <button type="button" onClick={() => void refreshTwoFactorStatus()} className="rounded border border-amber-300 px-2.5 py-1.5 font-semibold hover:bg-amber-50">重试读取</button>
              </div>}
              {twoFactorConfigured === false && <div className="mt-4 space-y-3">
                {!twoFactorSetup ? <div className="flex gap-2">
                  <PasswordInput value={twoFactorPassword} onChange={event => setTwoFactorPassword(event.target.value)} placeholder="输入当前管理员密码" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-xs" />
                  <button type="button" onClick={() => void setupTwoFactor()} disabled={twoFactorBusy || !twoFactorPassword} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">生成 2FA</button>
                </div> : <div className="space-y-2 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">
                  <div>Secret：<code className="select-all font-mono">{twoFactorSetup.secret}</code></div>
                  <div className="break-all">扫码地址：<code className="select-all font-mono">{twoFactorSetup.otpauthUrl}</code></div>
                  <div>恢复码（请立即保存）：<code className="select-all font-mono">{twoFactorSetup.recoveryCodes.join(' ')}</code></div>
                  <div className="flex gap-2 pt-1">
                    <input value={twoFactorCode} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="输入 6 位动态码" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs tracking-widest" />
                    <button type="button" onClick={() => void enableTwoFactor()} disabled={twoFactorBusy || twoFactorCode.length !== 6} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">启用</button>
                  </div>
                </div>}
              </div>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs md:col-span-2">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-sm">账户注册验证策略</h3><p className="text-xs text-neutral-500 mt-1">控制新批发商、零售商和生产商注册时的验证方式、验证码安全和 Google 免验证流程。</p></div><span className="text-xs font-semibold text-emerald-700">运营规则</span></div>
              {registrationConfig ? <div className="mt-4 space-y-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700"><input type="checkbox" checked={registrationConfig.requireVerification} onChange={event => setRegistrationConfig({ ...registrationConfig, requireVerification: event.target.checked })} />强制邮箱或手机号验证</label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(['email', 'phone', 'google'] as const).map(method => <label key={method} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2"><input type="checkbox" checked={registrationConfig.allowedMethods.includes(method)} onChange={event => setRegistrationConfig({ ...registrationConfig, allowedMethods: event.target.checked ? [...new Set([...registrationConfig.allowedMethods, method])] : registrationConfig.allowedMethods.filter(item => item !== method) })} />{method === 'email' ? '邮箱' : method === 'phone' ? '手机号' : 'Google'}</label>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    ['codeTtlMinutes', '验证码有效期（分钟）'],
                    ['resendCooldownSeconds', '重发冷却（秒）'],
                    ['maxAttempts', '最大错误次数']
                  ] as Array<[keyof RegistrationConfig, string]>).map(([key, label]) => <label key={key} className="text-xs font-semibold text-neutral-700">{label}<input type="number" min={1} value={registrationConfig[key] as number} onChange={event => setRegistrationConfig({ ...registrationConfig, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs" /></label>)}
                </div>
                <button type="button" onClick={() => void saveRegistrationSettings()} disabled={registrationSaving} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{registrationSaving ? '保存中…' : '保存注册策略'}</button>
              </div> : <p className="mt-4 text-xs text-neutral-500">读取中...</p>}
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs md:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2"><Film className="w-4 h-4" />首页大屏视频</h3>
                  <p className="text-xs text-neutral-500 mt-1">上传 MP4/WebM（最大 200MB），或粘贴已授权的视频直链；保存后首页会使用新视频。</p>
                </div>
                <span className="text-xs font-semibold text-neutral-500">首页媒体</span>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl bg-neutral-950">
                  <video key={homepageVideoUrl} src={homepageVideoUrl} controls preload="metadata" className="aspect-video w-full object-contain" />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-neutral-700">视频地址
                    <input
                      type="text"
                      value={homepageVideoUrl}
                      onChange={event => setHomepageVideoUrl(event.target.value)}
                      placeholder="https://… 或 /videos/ruda-home.mp4"
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveHomepageVideo()}
                      disabled={homepageVideoSaving || homepageVideoUploading}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {homepageVideoSaving ? '保存中…' : '保存视频地址'}
                    </button>
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 ${homepageVideoUploading ? 'pointer-events-none opacity-50' : 'hover:bg-neutral-50'}`}>
                      <Film className="h-3.5 w-3.5" />
                      {homepageVideoUploading ? '上传并发布中…' : '上传并发布视频'}
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        disabled={homepageVideoUploading}
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void uploadHomepageVideo(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-[11px] leading-5 text-neutral-500">上传视频需要配置平台对象存储。为了避免未授权素材上线，请只使用自有或已取得公开许可的视频。</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs md:col-span-2">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />页脚公司信息</h3><p className="text-xs text-neutral-500 mt-1">修改前台底部显示的公司名称、电话、地址、邮箱和 Instagram。</p></div><span className="text-xs font-semibold text-neutral-500">公开信息</span></div>
              {footerConfig ? <div className="mt-4 space-y-5">
                {([
                  ['companyName', '公司名称'], ['phone', '电话'], ['address', '地址'], ['email', '邮箱'], ['instagram', 'Instagram'],
                  ['brandName', '页脚品牌名'], ['brandBadge', '品牌标签']
                ] as Array<[keyof FooterConfig, string]>).map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-neutral-700">{label}
                    <input value={footerConfig[key] as string} onChange={event => setFooterConfig(previous => previous ? { ...previous, [key]: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />
                  </label>
                ))}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    ['descriptionZh', '中文品牌介绍'], ['descriptionIt', '意大利语品牌介绍'],
                    ['complianceZh', '中文合规提示'], ['complianceIt', '意大利语合规提示'],
                    ['servicesTitleZh', '中文采购服务标题'], ['servicesTitleIt', '意大利语采购服务标题'],
                    ['catalogLabelZh', '中文目录入口'], ['catalogLabelIt', '意大利语目录入口'],
                    ['registerLabelZh', '中文入驻入口'], ['registerLabelIt', '意大利语入驻入口'],
                    ['ordersLabelZh', '中文订单入口'], ['ordersLabelIt', '意大利语订单入口'],
                    ['termsLabelZh', '中文合作准则入口'], ['termsLabelIt', '意大利语合作准则入口'],
                    ['directoryTitleZh', '中文版块目录标题'], ['directoryTitleIt', '意大利语版块目录标题'],
                    ['directoryDescriptionZh', '中文版块目录说明'], ['directoryDescriptionIt', '意大利语版块目录说明'],
                    ['mediaTitleZh', '中文媒体标题'], ['mediaTitleIt', '意大利语媒体标题'],
                    ['mediaDisclaimerZh', '中文媒体免责声明'], ['mediaDisclaimerIt', '意大利语媒体免责声明'],
                    ['legalDocumentLabelZh', '中文法律文档入口'], ['legalDocumentLabelIt', '意大利语法律文档入口'],
                    ['legalTagline', '底部品牌标语'], ['legalLocations', '底部城市信息'],
                    ['sectionCatalogZh', '中文目录按钮'], ['sectionCatalogIt', '意大利语目录按钮'],
                    ['sectionShowroomsZh', '中文展厅按钮'], ['sectionShowroomsIt', '意大利语展厅按钮'],
                    ['sectionFashionZh', '中文时尚按钮'], ['sectionFashionIt', '意大利语时尚按钮'],
                    ['sectionAboutZh', '中文我们按钮'], ['sectionAboutIt', '意大利语我们按钮'],
                    ['sectionRegisterZh', '中文入驻按钮'], ['sectionRegisterIt', '意大利语入驻按钮']
                  ] as Array<[keyof FooterConfig, string]>).map(([key, label]) => (
                    <label key={key} className="text-xs font-semibold text-neutral-700">{label}
                      {key.toLowerCase().includes('description') || key.toLowerCase().includes('disclaimer') ? <textarea rows={3} value={footerConfig[key] as string} onChange={event => setFooterConfig(previous => previous ? { ...previous, [key]: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-5 outline-none focus:border-black" /> : <input value={footerConfig[key] as string} onChange={event => setFooterConfig(previous => previous ? { ...previous, [key]: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />}
                    </label>
                  ))}
                </div>
                <label className="block text-xs font-semibold text-neutral-700">媒体链接（每行：名称 | URL）
                  <textarea
                    rows={8}
                    value={footerConfig.mediaLinks.map(item => `${item.name} | ${item.url}`).join('\n')}
                    onChange={event => setFooterConfig(previous => previous ? { ...previous, mediaLinks: event.target.value.split('\n').map(line => { const [name, ...urlParts] = line.split('|'); return { name: (name || '').trim(), url: urlParts.join('|').trim() }; }).filter(item => item.name && item.url) } : previous)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-5 outline-none focus:border-black"
                  />
                </label>
                <button type="button" onClick={() => void saveFooterSettings()} disabled={footerSaving} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{footerSaving ? '保存中…' : '保存全部页脚设置'}</button>
              </div> : <p className="mt-4 text-xs text-neutral-500">读取中...</p>}
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" />通知渠道</h3><p className="text-xs text-neutral-500 mt-1">Email、短信、WhatsApp 和发送测试</p></div><span className={`text-xs font-semibold ${notificationConfig && (notificationConfig.email.configured || notificationConfig.sms.configured || notificationConfig.whatsapp.configured) ? 'text-emerald-700' : 'text-amber-700'}`}>{notificationConfig ? (notificationConfig.email.configured || notificationConfig.sms.configured || notificationConfig.whatsapp.configured ? '部分已配置' : '待配置') : notificationConfigLoading ? '检查中…' : notificationConfigError ? '读取失败' : '待读取'}</span></div>
              {notificationConfigError && <p role="alert" className="mt-2 text-xs text-amber-800">通知状态读取失败：{notificationConfigError} <button type="button" onClick={() => void refreshNotificationConfig()} className="font-semibold underline">重试</button></p>}
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => selectAdminTab('notifications')} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">管理通知渠道</button></div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-sm flex items-center gap-2"><Bot className="w-4 h-4" />AI 客服</h3><p className="text-xs text-neutral-500 mt-1">欢迎语、兜底回复和快捷问题</p></div><span className={`text-xs font-semibold ${aiSupportConfig.enabled ? 'text-emerald-700' : 'text-neutral-500'}`}>{aiSupportConfig.enabled ? '已启用' : '已停用'}</span></div>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => selectAdminTab('ai_support')} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">管理 AI 客服</button></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-bold text-sm flex items-center gap-2"><Smartphone className="w-4 h-4" />第三方登录与分享</h3><p className="text-xs text-neutral-500 mt-1">检查服务端登录凭证与公众号网页授权回调配置状态。</p></div>
              <span className="text-[11px] text-neutral-500">仅显示状态，不显示密钥</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {([
                ['google', 'Google 登录', 'GOOGLE_CLIENT_ID'],
                ['wechat', '微信公众号网页授权登录', 'WECHAT_APP_ID / WECHAT_APP_SECRET'],
                ['facebook', 'Facebook 登录 App', 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET（内容 OAuth 另需 Config ID）'],
                ['sharing', '分享链接', 'SHARE_LINK_SECRET']
              ] as const).map(([key, label, envName]) => {
                const status = integrationStatus?.[key];
                return (
                  <div key={key} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-neutral-900">{label}</span><span className={`text-[10px] font-semibold ${status?.configured ? 'text-emerald-700' : 'text-amber-700'}`}>{status?.configured ? '已配置' : '待配置'}</span></div>
                    <div className="mt-2 text-[10px] text-neutral-500 break-words">{envName}</div>
                    <div className="mt-2 text-[10px] text-neutral-600">{status?.configured ? '服务端凭证已就绪' : '申请 API 后加入服务端环境配置'}</div>
                  </div>
                );
              })}
            </div>
            {integrationError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span>集成状态读取失败：{integrationError}</span>
              <button type="button" onClick={() => void refreshIntegrationStatus(true)} className="rounded border border-amber-300 px-2.5 py-1.5 font-semibold hover:bg-amber-100">重试读取</button>
            </div>}
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
            <div><h3 className="font-bold text-sm">第三方 API 凭证</h3><p className="text-xs text-neutral-500 mt-1">填写后保存到服务端加密文件；留空字段表示保持原值。</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['googleClientId', 'Google Client ID'], ['googleClientSecret', 'Google Client Secret'],
                ['wechatAppId', '微信 App ID'], ['wechatAppSecret', '微信 App Secret'],
                ['facebookAppId', 'Facebook App ID'], ['facebookAppSecret', 'Facebook App Secret'],
                ['facebookLoginConfigId', 'Meta Login for Business Config ID'],
                ['sharingSecret', '分享签名密钥']
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-semibold text-neutral-700">{label}
                  <PasswordInput value={integrationSecrets[key]} onChange={event => setIntegrationSecrets(previous => ({ ...previous, [key]: event.target.value }))} placeholder="留空表示不修改" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 pr-10 text-xs outline-none focus:border-black" />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveIntegrationSecrets()} disabled={integrationSaving} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{integrationSaving ? '保存中…' : '加密保存 API'}</button>
              {(['google', 'wechat', 'facebook', 'sharing'] as const).map(provider => <button key={provider} type="button" onClick={() => void testIntegration(provider)} disabled={integrationTesting !== null} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">{integrationTesting === provider ? '测试中…' : `测试 ${provider}`}</button>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-neutral-600">
              <div className="rounded-lg bg-neutral-50 p-3">Google 回调/来源：{window.location.origin}</div>
              <div className="rounded-lg bg-neutral-50 p-3">微信公众号网页授权回调地址：{integrationStatus?.wechat.callbackUrl || (integrationStatus?.wechat.callbackUrlError ? 'APP_URL 必须设置为有效的公网 HTTPS 网站地址' : '正在读取…')}</div>
              <div className="rounded-lg bg-neutral-50 p-3">Facebook 登录回调地址：{window.location.origin}/api/auth/callback/facebook</div>
              <div className="rounded-lg bg-neutral-50 p-3">Meta Page/Instagram 内容授权回调地址：{window.location.origin}/api/admin/growth/meta/callback（以智能获客页显示的 APP_URL 为准）</div>
              <div className="rounded-lg bg-neutral-50 p-3">分享落地追踪：utm_source / utm_campaign / ref</div>
            </div>
            <p className="text-[11px] leading-5 text-neutral-600">Meta 内容接入需 Business 类型 App 和 Facebook Login for Business 配置（选择 User access token，并在 Meta 控制台配置所需 Page/Instagram 权限与资产）。Instagram 由 Business Manager 分配的 Page 角色可能还要求额外 Ads 权限；本平台目前不会请求或调用广告投放接口。</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-bold text-sm flex items-center gap-2"><Globe className="w-4 h-4" />云存储（图片 / 视频，S3 兼容，如 Cloudflare R2）</h3><p className="text-xs text-neutral-500 mt-1">配置后，商品图片、时尚社区视频等媒体文件将自动上传到云端而非服务器本地磁盘，并可配合 CDN 加速全球访问。</p></div>
              <span className={`text-[11px] font-semibold shrink-0 ${integrationStatus?.objectStorage?.configured ? 'text-emerald-700' : 'text-amber-700'}`}>{integrationStatus?.objectStorage?.configured ? '已配置' : '待配置'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-neutral-700">Endpoint（如 https://&lt;账号ID&gt;.r2.cloudflarestorage.com）
                <input value={objectStorageForm.endpoint} onChange={event => setObjectStorageForm(previous => ({ ...previous, endpoint: event.target.value }))} placeholder={integrationStatus?.objectStorage?.endpoint || '留空表示不修改'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">存储桶 Bucket 名称
                <input value={objectStorageForm.bucket} onChange={event => setObjectStorageForm(previous => ({ ...previous, bucket: event.target.value }))} placeholder={integrationStatus?.objectStorage?.bucket || '留空表示不修改'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">区域 Region
                <input value={objectStorageForm.region} onChange={event => setObjectStorageForm(previous => ({ ...previous, region: event.target.value }))} placeholder="auto" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">公开访问域名 / CDN 域名
                <input value={objectStorageForm.publicBaseUrl} onChange={event => setObjectStorageForm(previous => ({ ...previous, publicBaseUrl: event.target.value }))} placeholder={integrationStatus?.objectStorage?.publicBaseUrl || 'https://cdn.ruda.fashion 或 xxx.r2.dev'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-black" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">Access Key ID
                <PasswordInput value={objectStorageForm.accessKeyId} onChange={event => setObjectStorageForm(previous => ({ ...previous, accessKeyId: event.target.value }))} placeholder={integrationStatus?.objectStorage?.accessKeyIdConfigured ? '已保存，留空保持不变' : '粘贴 Access Key ID'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 pr-10 text-xs outline-none focus:border-black" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">Secret Access Key
                <PasswordInput value={objectStorageForm.secretAccessKey} onChange={event => setObjectStorageForm(previous => ({ ...previous, secretAccessKey: event.target.value }))} placeholder={integrationStatus?.objectStorage?.secretAccessKeyConfigured ? '已保存，留空保持不变' : '粘贴 Secret Access Key'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 pr-10 text-xs outline-none focus:border-black" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input type="checkbox" checked={objectStorageForm.forcePathStyle} onChange={event => setObjectStorageForm(previous => ({ ...previous, forcePathStyle: event.target.checked }))} className="accent-neutral-900 w-4 h-4" />
              使用路径样式访问（Path-style，MinIO 等自建存储需要勾选；Cloudflare R2 不需要）
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveIntegrationSecrets()} disabled={integrationSaving} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{integrationSaving ? '保存中…' : '加密保存云存储配置'}</button>
              <button type="button" onClick={() => void testIntegration('objectStorage')} disabled={integrationTesting !== null} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">{integrationTesting === 'objectStorage' ? '测试中…' : '测试云存储连接'}</button>
            </div>
            <p className="text-[11px] leading-5 text-neutral-600">只需要粘贴 Cloudflare R2（或其他 S3 兼容存储）的 Access Key ID 和 Secret Access Key 等参数并点击保存，密钥会加密保存在服务器上，不会在页面回显；无需登录服务器修改任何文件。</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><Database className="w-4 h-4" />图片 / 视频异地备份</h3>
                <p className="text-xs text-neutral-500 mt-1">配置一次独立备份 Bucket；启用每日数据库备份计划后，媒体快照会自动跟随运行，也可按需立即备份。</p>
              </div>
              <span className={`text-[11px] font-semibold ${integrationStatus?.objectStorage?.mediaBackup?.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                {integrationStatus?.objectStorage?.mediaBackup?.configured ? '备份目标已配置' : '备份目标待配置'}
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={mediaBackupForm.enabled}
                onChange={event => setMediaBackupForm(previous => ({ ...previous, enabled: event.target.checked }))}
                className="accent-neutral-900 w-4 h-4"
              />
              启用手动媒体备份
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-neutral-700">备份 Endpoint
                <input value={mediaBackupForm.endpoint} onChange={event => setMediaBackupForm(previous => ({ ...previous, endpoint: event.target.value }))} placeholder="https://s3.example.com" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">独立备份 Bucket（不能与媒体源 Bucket 相同）
                <input value={mediaBackupForm.bucket} onChange={event => setMediaBackupForm(previous => ({ ...previous, bucket: event.target.value }))} placeholder="ruda-media-backup" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">Region
                <input value={mediaBackupForm.region} onChange={event => setMediaBackupForm(previous => ({ ...previous, region: event.target.value }))} placeholder="auto" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">对象前缀
                <input value={mediaBackupForm.prefix} onChange={event => setMediaBackupForm(previous => ({ ...previous, prefix: event.target.value }))} placeholder="media-backups" className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">备份 Access Key ID
                <PasswordInput autoComplete="new-password" value={mediaBackupForm.accessKeyId} onChange={event => setMediaBackupForm(previous => ({ ...previous, accessKeyId: event.target.value }))} placeholder={integrationStatus?.objectStorage?.mediaBackup?.accessKeyIdConfigured ? '已保存，留空保持不变' : '粘贴备份专用 Access Key ID'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 pr-10 text-xs" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">备份 Secret Access Key
                <PasswordInput autoComplete="new-password" value={mediaBackupForm.secretAccessKey} onChange={event => setMediaBackupForm(previous => ({ ...previous, secretAccessKey: event.target.value }))} placeholder={integrationStatus?.objectStorage?.mediaBackup?.secretAccessKeyConfigured ? '已保存，留空保持不变' : '粘贴备份专用 Secret Access Key'} className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 pr-10 text-xs" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input type="checkbox" checked={mediaBackupForm.forcePathStyle} onChange={event => setMediaBackupForm(previous => ({ ...previous, forcePathStyle: event.target.checked }))} className="accent-neutral-900 w-4 h-4" />
              备份端点使用路径样式（MinIO 等）
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveIntegrationSecrets()} disabled={integrationSaving} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{integrationSaving ? '保存中…' : '加密保存媒体备份配置'}</button>
              <button type="button" onClick={() => void testIntegration('mediaBackup')} disabled={integrationTesting !== null} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">{integrationTesting === 'mediaBackup' ? '测试中…' : '测试源和备份 Bucket'}</button>
              <button type="button" onClick={() => void startMediaBackup()} disabled={mediaBackupStarting || !integrationStatus?.objectStorage?.mediaBackup?.configured || !integrationStatus?.objectStorage?.mediaBackup?.enabled || integrationStatus?.objectStorage?.mediaBackupRuns?.[0]?.status === 'RUNNING'} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{mediaBackupStarting ? '启动中…' : '立即创建媒体快照'}</button>
            </div>
            {integrationStatus?.objectStorage?.mediaBackupRuns?.map(run => (
              <div key={run.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-800">
                    {run.status === 'RUNNING' ? '备份进行中' : run.status === 'SUCCEEDED' ? '备份已验证' : run.status === 'INTERRUPTED' ? '备份中断' : '备份失败'}
                    {' · '}{new Date(run.startedAt).toLocaleString(getIntlLocale(lang))}
                  </span>
                  {run.status === 'SUCCEEDED' && (
                    <button type="button" onClick={() => void restoreMissingMedia(run.id)} disabled={mediaBackupRestoring !== null} className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 font-semibold text-neutral-700 disabled:opacity-50">
                      {mediaBackupRestoring === run.id ? '恢复中…' : '恢复缺失对象'}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-neutral-600">
                  {run.status === 'RUNNING' && !run.objectCount
                    ? '正在扫描媒体对象…'
                    : `对象 ${run.copiedObjects}${run.objectCount ? ` / ${run.objectCount}` : ''} · 已复制 ${(run.copiedBytes / 1024 / 1024).toFixed(1)} MB · ${run.sourceBucket} → ${run.destinationBucket}`}
                </p>
                {run.error && <p className="mt-1 text-rose-700">错误：{run.error}</p>}
              </div>
            ))}
            <p className="text-[11px] leading-5 text-neutral-600">目标桶必须与媒体源桶分开。系统将以流式方式复制、逐对象核对大小，并在备份桶写入清单；系统不删除远程快照。恢复仅补回缺失对象，不覆盖已有对象。为控制长期存储费用，可在云服务商设置生命周期保留策略。</p>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900">
            <div className="font-bold">配置原则</div>
            <div className="mt-1 leading-relaxed">申请到 API 后，直接进入对应设置页填写即可。保存后先发送测试通知，再启用渠道；支付和通知的密钥不会出现在前端、日志或接口返回中。</div>
          </div>
        </section>
      )}

      {adminTab === 'vault_requests' && (
        <section className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2"><Lock className="w-4 h-4" /> 专属授权</h2>
                <p className="text-xs text-neutral-500 mt-1">统一监管批发商访问生产商私密商品专区的申请，平台审批结果会写入审计日志。</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                待处理 {vaultRequests.filter(request => request.status === 'pending').length} 笔
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">申请时间</th>
                    <th className="py-3 px-4">生产商</th>
                    <th className="py-3 px-4">批发商</th>
                    <th className="py-3 px-4">联系人 / 电话</th>
                    <th className="py-3 px-4">申请说明</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4 text-right">审核</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {vaultRequests.map(request => (
                    <tr key={request.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 text-neutral-500">{request.appliedAt || request.requestedAt || '—'}</td>
                      <td className="py-3 px-4 font-semibold">{request.merchantName}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{request.companyName || request.customerCompanyName}</div>
                        <div className="text-[11px] text-neutral-500">{request.businessType}</div>
                      </td>
                      <td className="py-3 px-4">{request.contactPerson}<div className="text-[11px] text-neutral-500">{request.phone}</div></td>
                      <td className="py-3 px-4 max-w-xs truncate" title={request.note}>{request.note || '未填写'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          request.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {request.status === 'approved' ? '已通过' : request.status === 'rejected' ? '已驳回' : '待审核'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {request.status === 'pending' ? (
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => void adminReviewVaultRequest(request.id, 'approved')} className="px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer">通过</button>
                            <button type="button" onClick={() => void adminReviewVaultRequest(request.id, 'rejected')} className="px-2.5 py-1 rounded border border-neutral-300 text-neutral-700 text-[11px] cursor-pointer">驳回</button>
                          </div>
                        ) : <span className="text-neutral-400">已处理</span>}
                      </td>
                    </tr>
                  ))}
                  {vaultRequests.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-xs text-neutral-400">暂无授权申请</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {adminTab === 'notifications' && notificationConfig && (
        <section className="space-y-5">
          {notificationConfigError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>通知渠道配置刷新失败，当前显示最近一次成功读取的数据：{notificationConfigError}</span>
            <button type="button" onClick={() => void refreshNotificationConfig()} disabled={notificationConfigLoading} className="rounded border border-amber-300 px-2.5 py-1.5 font-semibold hover:bg-amber-100 disabled:opacity-50">重试读取</button>
          </div>}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">消息通知</h2>
            <p className="text-xs text-neutral-500 mt-1">配置外部通知渠道。密钥仅在服务端加密保存，页面不会回显密钥。</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(['email', 'sms', 'whatsapp'] as const).map(channel => {
              const config = notificationConfig[channel];
              const accountSid = 'accountSid' in config ? config.accountSid : '';
              const secretKey = channel === 'email' ? 'emailApiKey' : channel === 'sms' ? 'smsAuthToken' : 'whatsappAuthToken';
              return (
                <div key={channel} className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{channel === 'email' ? 'Email · Resend' : channel === 'sms' ? '短信 · Twilio' : 'WhatsApp · Twilio'}</h3>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={config.enabled} onChange={event => setNotificationConfig(previous => previous ? { ...previous, [channel]: { ...previous[channel], enabled: event.target.checked } } : previous)} />启用</label>
                  </div>
                  <div className={`text-[11px] font-semibold ${config.configured ? 'text-emerald-700' : 'text-amber-700'}`}>{config.configured ? '已配置凭证' : '未配置凭证'}</div>
                  <label className="block text-xs text-neutral-600">发送地址 / From<input value={config.from} onChange={event => setNotificationConfig(previous => previous ? { ...previous, [channel]: { ...previous[channel], from: event.target.value } } : previous)} placeholder={channel === 'email' ? 'RUDA <noreply@your-domain.com>' : '+393331234567'} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
                  {channel !== 'email' && <label className="block text-xs text-neutral-600">Twilio Account SID<input value={accountSid} onChange={event => setNotificationConfig(previous => previous ? { ...previous, [channel]: { ...previous[channel], accountSid: event.target.value } } : previous)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>}
                  <label className="block text-xs text-neutral-600">{channel === 'email' ? 'Resend API Key' : 'Twilio Auth Token'}<PasswordInput value={notificationSecrets[secretKey]} onChange={event => setNotificationSecrets(previous => ({ ...previous, [secretKey]: event.target.value }))} placeholder={config.configured ? '已保存，留空保持不变' : '输入服务密钥'} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-xs" /></label>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold">发送测试通知</h3>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <select value={notificationTest.channel} onChange={event => setNotificationTest(previous => ({ ...previous, channel: event.target.value }))} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs"><option value="email">Email</option><option value="sms">短信</option><option value="whatsapp">WhatsApp</option></select>
              <input value={notificationTest.recipient} onChange={event => setNotificationTest(previous => ({ ...previous, recipient: event.target.value }))} placeholder="收件邮箱或国际手机号" className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
              <button type="button" onClick={() => void sendNotificationTest()} disabled={!notificationTest.recipient} className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">发送测试</button>
              <button type="button" onClick={() => void saveNotificationSettings()} disabled={notificationSaving} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{notificationSaving ? '保存中...' : '保存全部设置'}</button>
            </div>
          </div>
        </section>
      )}
      {adminTab === 'notifications' && !notificationConfig && (
        <div role={notificationConfigError ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-700">
          <span>{notificationConfigLoading ? '正在加载通知渠道配置…' : `通知渠道配置暂不可用：${notificationConfigError || '尚未读取到配置'}`}</span>
          {!notificationConfigLoading && <button type="button" onClick={() => void refreshNotificationConfig()} className="rounded border border-neutral-300 px-2.5 py-1.5 font-semibold hover:bg-neutral-50">重试读取</button>}
        </div>
      )}
      {adminTab === 'notifications' && <AdminNotificationEvents />}

      {adminTab === 'ai_support' && (
        <section className="space-y-5">
          <div className="bg-neutral-950 text-white rounded-xl p-5 sm:p-6 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-400" /><h2 className="text-base font-bold">客服助手</h2></div>
              <p className="text-xs text-neutral-400 mt-2">管理首页客服入口的开关、欢迎语、兜底回复和快捷问题。</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input type="checkbox" checked={aiSupportConfig.enabled} onChange={event => setAiSupportConfig(previous => ({ ...previous, enabled: event.target.checked }))} className="h-4 w-4 accent-emerald-500" />
              已启用
            </label>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
            <label className="block"><span className="text-xs font-bold text-neutral-800">欢迎语</span><textarea value={aiSupportConfig.welcomeMessage} onChange={event => setAiSupportConfig(previous => ({ ...previous, welcomeMessage: event.target.value }))} rows={3} className="mt-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm outline-none focus:border-black" /></label>
            <label className="block"><span className="text-xs font-bold text-neutral-800">无法匹配时的默认回复</span><textarea value={aiSupportConfig.fallbackMessage} onChange={event => setAiSupportConfig(previous => ({ ...previous, fallbackMessage: event.target.value }))} rows={3} className="mt-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm outline-none focus:border-black" /></label>
            <label className="block"><span className="text-xs font-bold text-neutral-800">快捷问题</span><span className="block text-[11px] text-neutral-500 mt-1">每行一个，最多 8 个</span><textarea value={aiSupportConfig.quickQuestions} onChange={event => setAiSupportConfig(previous => ({ ...previous, quickQuestions: event.target.value }))} rows={5} className="mt-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm outline-none focus:border-black" /></label>
            <div className="flex justify-end"><button type="button" onClick={() => void saveAiSupportConfig()} disabled={aiSupportSaving} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50"><MessageCircle className="w-3.5 h-3.5" />{aiSupportSaving ? '保存中...' : '保存 AI 客服设置'}</button></div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 1. OVERVIEW */}
      {/* ======================================================== */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-[11px] text-neutral-500">系统状态</div>
              <div className={`mt-1 text-lg font-bold ${health?.status === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>{health?.status === 'healthy' ? '正常运行' : '待检查'}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-[11px] text-neutral-500">数据库延迟</div>
              <div className="mt-1 text-lg font-bold text-neutral-900">{health ? `${health.database.latencyMs} ms` : '--'}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-[11px] text-neutral-500">失败通知</div>
              <div className="mt-1 text-lg font-bold text-rose-600">{health?.risks.failedNotifications ?? '--'}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-[11px] text-neutral-500">异常退款</div>
              <div className="mt-1 text-lg font-bold text-rose-600">{health?.risks.failedRefunds ?? '--'}</div>
            </div>
          </section>
          {healthError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>后台健康状态读取失败{health ? '，页面保留最近一次成功数据' : ''}：{healthError}</span>
            <button type="button" onClick={() => void refreshHealth()} disabled={healthLoading} className="rounded border border-amber-300 px-2.5 py-1.5 font-semibold hover:bg-amber-100 disabled:opacity-50">{healthLoading ? '读取中…' : '重试读取'}</button>
          </div>}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h2 className="text-sm font-bold text-neutral-900">风险概览</h2>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {localizeCopy('服务端实时发现支付、库存、退款和履约异常。', 'Avvisi server-side per pagamenti, stock, rimborsi e fulfillment.')}
                  {intelligenceStale && intelligence && <span className="ml-2 text-amber-700">显示最近一次成功数据，刷新暂不可用</span>}
                </p>
              </div>
              <button type="button" onClick={() => void refreshIntelligence()} disabled={intelligenceLoading} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer">
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${intelligenceLoading ? 'animate-spin' : ''}`} />
                {localizeCopy('刷新', 'Aggiorna')}
              </button>
            </div>
            {intelligence ? (
              <>
                <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-50 border-b border-neutral-100">
                  <div className="rounded-lg bg-rose-50 border border-rose-100 p-3"><div className="text-[11px] text-rose-700">Critical</div><div className="text-xl font-bold text-rose-700">{intelligence.summary.critical}</div></div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3"><div className="text-[11px] text-amber-700">Warning</div><div className="text-xl font-bold text-amber-700">{intelligence.summary.warning}</div></div>
                  <div className="rounded-lg bg-sky-50 border border-sky-100 p-3"><div className="text-[11px] text-sky-700">Info</div><div className="text-xl font-bold text-sky-700">{intelligence.summary.info}</div></div>
                </div>
                {intelligence.analytics && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-neutral-100">
                    <div className="rounded-lg border border-neutral-200 bg-white p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500">近30日 GMV</div><div className="mt-1 text-lg font-bold text-neutral-950">€{intelligence.analytics.recentGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div><div className={`text-[11px] font-semibold ${intelligence.analytics.gmvTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{intelligence.analytics.gmvTrend >= 0 ? '+' : ''}{intelligence.analytics.gmvTrend}% 环比</div></div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500">近30日订单</div><div className="mt-1 text-lg font-bold text-neutral-950">{intelligence.analytics.recentOrders}</div><div className="text-[11px] text-neutral-500">前30日 {intelligence.analytics.previousOrders} 单</div></div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500">补货建议</div><div className="mt-1 text-lg font-bold text-amber-700">{intelligence.replenishment?.length || 0}</div><div className="text-[11px] text-neutral-500">款 SKU 进入预测池</div></div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500">生产商健康度</div><div className="mt-1 text-lg font-bold text-indigo-700">{intelligence.merchantHealth?.length || 0}</div><div className="text-[11px] text-neutral-500">家生产商已评分</div></div>
                  </div>
                )}
                {((intelligence.replenishment?.length || 0) > 0 || (intelligence.merchantHealth?.length || 0) > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-neutral-100">
                    <div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-neutral-800">智能补货预测</h3><span className="text-[10px] text-neutral-400">按可售天数排序</span></div><div className="space-y-2">{(intelligence.replenishment || []).slice(0, 4).map(item => <div key={item.productId} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2 text-xs"><div className="min-w-0"><div className="font-bold truncate">{item.styleNo}</div><div className="text-[10px] text-neutral-500">库存 {item.stock} · 30日售 {item.sold30d}</div></div><span className="shrink-0 font-bold text-amber-700">补 {item.suggestedQty}</span></div>)}</div></div>
                    <div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-neutral-800">生产商健康评分</h3><span className="text-[10px] text-neutral-400">销售 · 认证 · 库存</span></div><div className="space-y-2">{(intelligence.merchantHealth || []).slice(0, 4).map(item => <div key={item.merchantId} className="flex items-center justify-between gap-3 rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2 text-xs"><div className="min-w-0"><div className="font-bold truncate">{item.merchantName}</div><div className="text-[10px] text-neutral-500">€{item.sales30d.toFixed(0)} · {item.orders30d} 单 · 低库存 {item.lowStockProducts}</div></div><span className={`shrink-0 font-bold ${item.score >= 80 ? 'text-emerald-700' : item.score >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>{item.score}</span></div>)}</div></div>
                  </div>
                )}
                <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                  {intelligence.alerts.length === 0 ? (
                    <div className="p-5 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {localizeCopy('当前没有待处理运营异常。', 'Nessuna eccezione operativa.')}</div>
                  ) : intelligence.alerts.slice(0, 12).map(alert => (
                    <div key={`${alert.type}-${alert.entityId}`} className="px-5 py-3 flex items-center gap-3 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${alert.severity === 'critical' ? 'bg-rose-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                      <span className="text-neutral-700 flex-1">{alert.message}</span>
                      <span className="text-[10px] uppercase text-neutral-400">{alert.type}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-5 text-sm text-neutral-500">{localizeCopy('智能运营数据暂时不可用，请检查管理员会话。', 'Intelligence non disponibile.')}</div>
            )}
          </section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                待办事项
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div 
                  onClick={() => selectAdminTab('customers')}
                  className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-rose-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-rose-600" />
                      待核验零售商执照 (Kbis / Visura)
                    </div>
                    <div className="text-neutral-600">{pendingCustomerAudits.length} 家海外零售商等待开启采购权限</div>
                  </div>
                  <span className="text-base font-bold text-rose-700">{pendingCustomerAudits.length}</span>
                </div>

                <div 
                  onClick={() => selectAdminTab('merchants')}
                  className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      合作工坊与入驻生产商
                    </div>
                    <div className="text-neutral-600">{merchants.length} 家品牌工坊已接入多租户结算</div>
                  </div>
                  <span className="text-base font-bold text-indigo-700">{merchants.length}</span>
                </div>
              </div>

              {/* Recent Orders Overview across all merchants */}
              <div className="pt-3 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    全网最新交易流水 (跨生产商)
                  </h3>
                  <button 
                    onClick={() => selectAdminTab('orders')}
                    className="text-xs text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
                  >
                    查看全部订单 →
                  </button>
                </div>
                <div className="divide-y divide-neutral-100 text-xs">
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-900 flex items-center gap-2">
                          <span>{o.orderNo}</span>
                          <span className="text-neutral-400">·</span>
                          <span className="font-medium text-neutral-700">{o.companyName}</span>
                        </div>
                        <div className="text-neutral-500 text-[11px] mt-0.5">
                          {o.date} · {o.totalQty} 件商品 · 结算方式: {o.paymentMethod.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-neutral-900">€{o.totalAmount.toFixed(2)}</div>
                        <div className="text-[11px] font-semibold text-emerald-600">平台抽佣 €{(o.totalAmount * (merchants.find(item => item.id === (o.merchantId || o.items[0]?.merchantId))?.platformFeeRate ?? 0.08)).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {adminTab === 'account_identities' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">账号审核</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              统一处理账号核验与采购商申请；账号关联只核实重复登录身份，不合并企业、门店或采购资料。
            </p>
            <div className="mt-4 flex gap-2 border-b border-neutral-200" role="tablist" aria-label="账号审核类别">
              <button type="button" role="tab" aria-selected={accountReviewTab === 'identities'} onClick={() => setAccountReviewTab('identities')} className={`border-b-2 px-3 py-2 text-xs font-semibold ${accountReviewTab === 'identities' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500'}`}>账号核验</button>
              <button type="button" role="tab" aria-selected={accountReviewTab === 'customers'} onClick={() => setAccountReviewTab('customers')} className={`border-b-2 px-3 py-2 text-xs font-semibold ${accountReviewTab === 'customers' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500'}`}>采购审核<span className="ml-1 text-neutral-500">({pendingCustomerAudits.length})</span></button>
            </div>
            {accountReviewTab === 'identities' && <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">邮箱</th>
                    <th className="px-4 py-3">待核实账号</th>
                    <th className="px-4 py-3">邮箱验证状态</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {accountReviewLoading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">正在加载账号审核列表…</td></tr>
                  ) : accountReviewGroups.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">没有需要人工核实的重复邮箱账号。</td></tr>
                  ) : accountReviewGroups.map(group => (
                    <tr key={group.email}>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{group.email}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {group.accounts.map(account => {
                          const roleLabel = account.role === 'buyer' ? '买家' : account.role === 'company' ? '企业老板' : '生产商老板';
                          const recordId = account.customerId || account.companyId || account.merchantId || account.id;
                          return <div key={account.id}>{roleLabel} · {recordId}</div>;
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {group.accounts.every(account => account.emailVerifiedAt)
                          ? <span className="font-semibold text-emerald-700">已验证</span>
                          : <span className="font-semibold text-amber-700">需要人工确认</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountIdentityPassword('');
                            setAccountIdentityPasswordConfirm('');
                            setAccountIdentityTarget(group);
                          }}
                          className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700"
                        >
                          核实并统一登录
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>}
            {accountReviewTab === 'customers' && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-4 py-3">采购企业</th>
                      <th className="px-4 py-3">税号</th>
                      <th className="px-4 py-3">地区</th>
                      <th className="px-4 py-3">联系人</th>
                      <th className="px-4 py-3">资质文件</th>
                      <th className="px-4 py-3 text-right">审核操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {pendingCustomerAudits.length === 0
                      ? <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">暂无待审核采购商申请。</td></tr>
                      : pendingCustomerAudits.map(customer => (
                        <tr key={customer.id}>
                          <td className="px-4 py-3 font-semibold text-neutral-900">{customer.companyName}</td>
                          <td className="px-4 py-3">{customer.vatNumber}</td>
                          <td className="px-4 py-3">{customer.city}, {customer.country}</td>
                          <td className="px-4 py-3">{customer.contactPerson}<div className="text-neutral-500">{customer.email}</div></td>
                          <td className="px-4 py-3">{customer.documents?.length || 0} 份</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <button type="button" onClick={() => {
                                reviewCustomer(customer.id, 'approved', 'tier_vip');
                                addNotification('success', '审核通过', `已核准 ${customer.companyName} 并授予 VIP 级别`);
                              }} className="rounded bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white">准予通过</button>
                              <button type="button" onClick={() => {
                                reviewCustomer(customer.id, 'rejected');
                                addNotification('info', '已驳回', `已驳回 ${customer.companyName} 的批发申请`);
                              }} className="rounded border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700">驳回</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. MERCHANTS MANAGEMENT */}
      {/* ======================================================== */}
      {adminTab === 'merchants' && <AdminMerchantCenter onEnterMerchant={({ id }) => {
        const merchant = merchants.find(item => item.id === id);
        if (merchant) return enterMerchantPortal(merchant);
      }} />}
      {adminTab === 'merchants' && false && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">商家管理</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              管控生产商认证状态、展厅面积、独立结算佣金率与数据访问权限
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-semibold text-neutral-600">品牌名称 *
                <input value={merchantForm.name} onChange={event => setMerchantForm(previous => ({ ...previous, name: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="例如：Milano Atelier" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">法定公司名称 *
                <input value={merchantForm.companyLegalName} onChange={event => setMerchantForm(previous => ({ ...previous, companyLegalName: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="公司注册全称" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">生产商税号 / VAT *
                <input value={merchantForm.vatNumber} onChange={event => setMerchantForm(previous => ({ ...previous, vatNumber: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="IT12345678901" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">商家行业 *
                <select required value={merchantForm.industry} onChange={event => setMerchantForm(previous => ({ ...previous, industry: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black">
                  <option value="">请选择行业</option>
                  <option value="FASHION_COMPANY">服装公司</option>
                  <option value="FASHION_WHOLESALE">服装批发</option>
                  <option value="DEPARTMENT_STORE">百货公司</option>
                  <option value="RETAIL_STORE">零售店</option>
                  <option value="TRADING_COMPANY">贸易公司</option>
                  <option value="WHOLESALE_COMPANY">批发公司</option>
                  <option value="RESTAURANT">餐馆</option>
                  <option value="OTHER">其他</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-600">联系邮箱 *
                <input type="email" value={merchantForm.contactEmail} onChange={event => setMerchantForm(previous => ({ ...previous, contactEmail: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="merchant@example.com" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">生产商登录密码 *
                <PasswordInput minLength={8} value={merchantForm.password} onChange={event => setMerchantForm(previous => ({ ...previous, password: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 pr-10 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="至少 8 位" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">联系人
                <input value={merchantForm.contactPerson} onChange={event => setMerchantForm(previous => ({ ...previous, contactPerson: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="负责人姓名" />
              </label>
              <label className="text-xs font-semibold text-neutral-600">电话
                <input value={merchantForm.contactPhone} onChange={event => setMerchantForm(previous => ({ ...previous, contactPhone: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black" placeholder="+39 ..." />
              </label>
              <label className="text-xs font-semibold text-neutral-600">国家 *
                <select required value={merchantForm.country} onChange={event => {
                  const country = event.target.value;
                  setMerchantForm(previous => ({ ...previous, country, city: getCityOptions(country)[0] || '' }));
                }} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black">
                  {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-600">城市
                <select required value={merchantForm.city} onChange={event => setMerchantForm(previous => ({ ...previous, city: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none focus:ring-2 focus:ring-black">
                  {getCityOptions(merchantForm.country).map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <button type="button" disabled={merchantCreating || !merchantForm.name.trim() || !merchantForm.companyLegalName.trim() || !merchantForm.vatNumber.trim() || !merchantForm.industry || !merchantForm.contactEmail.trim() || merchantForm.password.length < 8} onClick={async () => {
                setMerchantCreating(true);
                try {
                  const draft: Omit<Merchant, 'id'> & { password: string } = {
                    name: merchantForm.name.trim(), companyLegalName: merchantForm.companyLegalName.trim(), vatNumber: merchantForm.vatNumber.trim(), businessType: 'brand_supplier', industry: merchantForm.industry, code: '', country: merchantForm.country, city: merchantForm.city.trim(), showroomAddress: merchantForm.showroomAddress.trim(), showroomArea: '待完善', showroomImage: '', logo: '', banner: '', tagline: '', description: '', specialties: [], foundedYear: new Date().getFullYear(), contactPerson: merchantForm.contactPerson.trim(), contactPhone: merchantForm.contactPhone.trim(), contactEmail: merchantForm.contactEmail.trim(), isVerified: false, rating: 5, publicProductsCount: 0, protectedVaultCount: 0, merchantZone: 'iolo', password: merchantForm.password
                  };
                  await addMerchant(draft);
                  setMerchantForm({ name: '', companyLegalName: '', vatNumber: '', industry: '', contactPerson: '', contactEmail: '', contactPhone: '', country: 'Italy', city: 'Milan', showroomAddress: '', password: '' });
                } catch (error) {
                  addNotification('warning', '生产商创建失败', error instanceof Error ? error.message : '请稍后重试');
                } finally {
                  setMerchantCreating(false);
                }
              }} className="ui-primary-button self-start sm:self-end disabled:cursor-not-allowed disabled:opacity-50">{merchantCreating ? '保存中' : '新建生产商'}</button>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input value={merchantQuery} onChange={event => setMerchantQuery(event.target.value)} placeholder="搜索品牌、代码、法定公司、城市或邮箱" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-black focus:bg-white" />
              </div>
              <span className="self-center text-[11px] text-neutral-500">显示 {filteredMerchants.length} / {merchants.length} 家</span>
            </div>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-neutral-800">客户信用台账</h3>
                  <select
                    value={ledgerCustomerId || customers[0]?.id || ''}
                    onChange={event => setLedgerCustomerId(event.target.value)}
                    className="max-w-[180px] rounded border border-neutral-200 bg-white px-2 py-1 text-[11px]"
                    aria-label="选择信用台账客户"
                  >
                    {customers.length === 0 && <option value="">暂无客户</option>}
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => void refreshFinanceLedgers()} disabled={ledgerLoading} aria-label="刷新财务台账" className="text-neutral-500 hover:text-neutral-900 cursor-pointer disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} /></button>
              </div>
              <div className="space-y-2 max-h-52 overflow-auto">
                {ledgerErrors.ledger ? <div role="alert" className="text-xs text-amber-800">台账读取失败：{ledgerErrors.ledger}</div> : ledgerRows.length === 0 ? <div className="text-xs text-neutral-400">{ledgerLoading ? '正在加载台账…' : '暂无台账记录'}</div> : ledgerRows.slice(0, 8).map(row => (
                  <div key={row.id} className="flex justify-between gap-2 text-[11px] border-b border-neutral-100 pb-1">
                    <span className="text-neutral-600">{row.entryType} · {row.note || '-'}</span>
                    <span className={row.amount >= 0 ? 'text-rose-700' : 'text-emerald-700'}>{row.amount >= 0 ? '+' : ''}{row.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold text-neutral-800 mb-3">库存流水（最近 30 条）</h3>
              <div className="space-y-2 max-h-52 overflow-auto">
                {ledgerErrors.stock ? <div role="alert" className="text-xs text-amber-800">库存流水读取失败：{ledgerErrors.stock}</div> : stockRows.length === 0 ? <div className="text-xs text-neutral-400">{ledgerLoading ? '正在加载库存流水…' : '暂无库存流水'}</div> : stockRows.slice(0, 8).map(row => (
                  <div key={row.id} className="flex justify-between gap-2 text-[11px] border-b border-neutral-100 pb-1">
                    <span className="text-neutral-600">{row.sku} · {row.movementType}</span>
                    <span className={row.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{row.quantity >= 0 ? '+' : ''}{row.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
              <h3 className="text-xs font-bold text-neutral-800 mb-3">退款异常与重试</h3>
              <div className="space-y-2 max-h-52 overflow-auto">
                {ledgerErrors.refunds ? <div role="alert" className="text-xs text-amber-800">退款记录读取失败：{ledgerErrors.refunds}</div> : refundRows.length === 0 ? <div className="text-xs text-neutral-400">{ledgerLoading ? '正在加载退款记录…' : '暂无异常退款'}</div> : refundRows.slice(0, 8).map(row => (
                  <div key={row.id} className="flex items-center justify-between gap-2 text-[11px] border-b border-neutral-100 pb-1">
                    <span className="text-neutral-600">订单 {row.orderId} · €{row.amount.toFixed(2)} · {row.provider || 'unknown'} · {row.status}</span>
                    {['manual', 'paypal', 'solana_pay'].includes(row.provider || '') ? (
                      <button type="button" onClick={async () => {
                        const reference = window.prompt('请先在对应支付渠道完成退款，再录入外部退款凭证号 / 交易参考号：')?.trim();
                        if (!reference) return;
                        try {
                          await apiPost(`/api/admin/refunds/${row.id}/confirm-manual`, { reference });
                          await refreshFinanceLedgers();
                          addNotification('success', '人工退款已登记', `订单 ${row.orderId} · 凭证 ${reference}`);
                        } catch (error) {
                          addNotification('warning', '登记人工退款失败', error instanceof Error ? error.message : '请稍后重试');
                        }
                      }} className="text-emerald-700 font-semibold cursor-pointer">登记已退款</button>
                    ) : (
                      <button type="button" onClick={async () => {
                      try {
                        await apiPost(`/api/admin/refunds/${row.id}/retry`, {});
                        await refreshFinanceLedgers();
                        addNotification('success', '退款已重新提交', `订单 ${row.orderId} 的退款已进入重试流程`);
                      } catch (error) {
                        addNotification('warning', '退款重试失败', error instanceof Error ? error.message : '请稍后重试');
                      }
                    }} className="text-amber-700 font-semibold cursor-pointer">重试({row.retryCount})</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">生产商代码 / 品牌名称</th>
                    <th className="py-3 px-4">邮箱账号</th>
                    <th className="py-3 px-4">法定公司名称 (Legal Entity)</th>
                    <th className="py-3 px-4">工坊城市 / 国家</th>
                    <th className="py-3 px-4">展厅规模</th>
                    <th className="py-3 px-4">商务对接人</th>
                    <th className="py-3 px-4">平台抽佣比率</th>
                    <th className="py-3 px-4">认证状态</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredMerchants.map(m => (
                    <tr key={m.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img src={m.logo} alt={m.name} className="w-9 h-9 rounded object-cover border border-neutral-200" />
                          <button
                            type="button"
                            onClick={() => enterMerchantPortal(m)}
                            className="text-left cursor-pointer"
                          >
                            <div className="font-bold text-neutral-900 hover:text-black">{m.name}</div>
                            <div className="font-mono text-[10px] text-neutral-400">ID: {m.id}</div>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-800">
                        <div className="text-[11px] text-neutral-700">{m.contactEmail || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-800">{m.companyLegalName}</td>
                      <td className="py-3 px-4">{m.city}, {m.country}</td>
                      <td className="py-3 px-4 text-neutral-600">{m.showroomArea}</td>
                      <td className="py-3 px-4">
                        <div>{m.contactPerson}</div>
                        <div className="text-[11px] text-neutral-400">{m.contactPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={((m.platformFeeRate ?? 0.08) * 100).toFixed(1)}
                          onBlur={async event => {
                            const percentage = Number(event.currentTarget.value);
                            if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
                              event.currentTarget.value = ((m.platformFeeRate ?? 0.08) * 100).toFixed(1);
                              addNotification('warning', '佣金比例无效', '请输入 0 到 100 之间的百分比');
                              return;
                            }
                            try {
                              await updateMerchant(m.id, { platformFeeRate: percentage / 100 });
                              addNotification('success', '佣金比例已更新', `${m.name} 当前平台抽佣 ${percentage.toFixed(1)}%`);
                            } catch (error) {
                              addNotification('warning', '佣金比例保存失败', error instanceof Error ? error.message : '请稍后重试');
                            }
                          }}
                          className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs font-bold"
                        />%
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {isStorefrontEnabled(m) ? (m.isVerified ? '已认证 · 营业中' : '已开放销售') : m.isVerified ? '已暂停销售' : '待审核'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => enterMerchantPortal(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-black bg-black text-white rounded transition-colors hover:bg-neutral-800 cursor-pointer"
                          >
                            <Store className="w-3.5 h-3.5" />
                            进入生产商后台
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMerchantPassword('');
                              setMerchantPasswordConfirm('');
                              setShowMerchantPassword(false);
                              setShowMerchantPasswordConfirm(false);
                              setMerchantPasswordTarget(m);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-amber-300 text-amber-900 bg-amber-50 rounded transition-colors hover:bg-amber-100 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            重置密码
                          </button>
                          <button
                            type="button"
                            onClick={() => void openModaGptPlan(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-violet-300 text-violet-900 bg-violet-50 rounded transition-colors hover:bg-violet-100 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            AI 套餐
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const enabled = isStorefrontEnabled(m);
                                await updateMerchant(m.id, { storefrontEnabled: !enabled });
                                addNotification('success', '销售状态已更新', `已${enabled ? '暂停' : '启用'}店铺 ${m.name}`);
                              } catch (error) {
                                addNotification('warning', '生产商审核失败', error instanceof Error ? error.message : '请稍后重试');
                              }
                            }}
                            className="px-2.5 py-1 text-xs border border-neutral-300 hover:bg-neutral-100 text-neutral-800 rounded transition-colors cursor-pointer"
                          >
                            {isStorefrontEnabled(m) ? '暂停销售' : '启用销售'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PLATFORM PRODUCTS CENTER */}
      {/* ======================================================== */}
      {adminTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">商品管理</h2>
            <p className="text-xs text-neutral-500 mt-0.5">全平台所有生产商的款式统一大盘 · 支持首页推荐、特价市场运营与授权订做款合规巡查</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="搜索款号、商品名、品牌或分类" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-black focus:bg-white" />
              </div>
              <select value={productStatus} onChange={event => setProductStatus(event.target.value as typeof productStatus)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部审核状态</option><option value="draft">草稿</option><option value="pending_review">待审核</option><option value="published">已发布</option><option value="rejected">已驳回</option><option value="archived">已归档</option>
              </select>
              <span className="self-center text-[11px] text-neutral-500">显示 {filteredProducts.length} / {products.length} 款</span>
            </div>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-900">特价市场运营</h3>
                <p className="mt-1 text-xs text-rose-800">共有 {products.filter(product => product.status === 'clearance' && product.visibility !== 'private' && !product.isExclusiveProtected).length} 款公开特价商品。可在商品行标记「特色大图」，前台会单独展示；未标记商品进入普通两列商品流。商品归属、库存、发货及结算仍由原生产商处理。</p>
              </div>
              <span className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">平台统一销售运营</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">款号 / 款式名称</th>
                    <th className="py-3 px-4">所属生产商</th>
                    <th className="py-3 px-4">出厂批发价</th>
                    <th className="py-3 px-4">建议零售价 (RRP)</th>
                    <th className="py-3 px-4">起订量 MOQ</th>
                    <th className="py-3 px-4">可见性级别</th>
                    <th className="py-3 px-4">审核状态</th>
                    <th className="py-3 px-4">特价市场</th>
                    <th className="py-3 px-4">特色大图</th>
                    <th className="py-3 px-4">首页精选推荐</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded object-cover border border-neutral-200 shrink-0" />
                          <div>
                            <div className="font-bold text-neutral-900">{p.styleNo}</div>
                            <div className="text-neutral-600 line-clamp-1 max-w-xs">{p.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-800">{p.brand}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">€{p.wholesalePrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-neutral-500">€{p.rrpPrice.toFixed(2)}</td>
                      <td className="py-3 px-4">{p.moq} 件</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.visibility === 'private' || p.isExclusiveProtected
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}>
                          {p.visibility === 'private' || p.isExclusiveProtected ? '🔒 私密爆款' : '🌐 公开看货'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={p.lifecycleStatus || 'published'}
                          onChange={event => {
                            const lifecycleStatus = event.target.value as Product['lifecycleStatus'];
                            updateProduct(p.id, { lifecycleStatus });
                            addNotification('success', '商品审核状态已更新', `${p.styleNo} 已标记为 ${lifecycleStatus}`);
                          }}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                        >
                          <option value="draft">草稿</option>
                          <option value="pending_review">待审核</option>
                          <option value="published">已发布</option>
                          <option value="rejected">已驳回</option>
                          <option value="archived">已归档</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {p.status === 'clearance' && p.visibility !== 'private' && !p.isExclusiveProtected
                          ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">已同步特价市场</span>
                          : <span className="text-[11px] text-neutral-400">未参加</span>}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            void updateProduct(p.id, { featuredOnSale: !p.featuredOnSale }).catch(error => {
                              addNotification('warning', '特色大图分类未保存', error instanceof Error ? error.message : '请重试');
                            });
                          }}
                          aria-pressed={Boolean(p.featuredOnSale)}
                          className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                            p.featuredOnSale ? 'bg-rose-100 text-rose-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {p.featuredOnSale ? '大图精选中' : '设为大图精选'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            updateProduct(p.id, { featuredOnHome: !p.featuredOnHome });
                            addNotification('success', '推荐状态更新', `已将 ${p.styleNo} ${p.featuredOnHome ? '移出' : '设为'} 首页置顶推荐`);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                            p.featuredOnHome ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {p.featuredOnHome ? '⭐ 首页置顶中' : '设为推荐'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. CUSTOMERS & CREDIT LIMITS */}
      {/* ======================================================== */}
      {adminTab === 'customers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">客户管理</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              审核法国/意大利等零售商营业执照与增值税证书，配置折扣等级 (VIP 9折 / Major 8.25折) 与信用额度
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} placeholder="搜索企业、联系人、VAT、城市或邮箱" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-black focus:bg-white" />
              </div>
              <select value={customerStatus} onChange={event => setCustomerStatus(event.target.value as typeof customerStatus)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option>
              </select>
              <span className="self-center text-[11px] text-neutral-500">显示 {filteredCustomers.length} / {customers.length} 家</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">零售商名称</th>
                    <th className="py-3 px-4">增值税号 (P.IVA / VAT)</th>
                    <th className="py-3 px-4">国家 / 城市</th>
                    <th className="py-3 px-4">审核状态</th>
                    <th className="py-3 px-4">零售商级别与折扣</th>
                    <th className="py-3 px-4">Net 30 信用额度</th>
                    <th className="py-3 px-4">资质执照</th>
                    <th className="py-3 px-4 text-right">审核操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900">{c.companyName}</div>
                        <div className="text-neutral-400 text-[11px]">联络人: {c.contactPerson}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{c.vatNumber}</td>
                      <td className="py-3 px-4">{c.city}, {c.country}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {c.status === 'approved' ? '已核准 (Approved)' : '待审核 (Pending)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={c.tier}
                          onChange={(e) => {
                            setCustomerTier(c.id, e.target.value as CustomerTier);
                            addNotification('success', '客户等级更新', `已将 ${c.companyName} 等级设为 ${e.target.value}`);
                          }}
                          className="bg-white border border-neutral-300 rounded px-2 py-1 text-[11px]"
                        >
                          <option value="tier_standard">Standard 标准批发 (100%)</option>
                          <option value="tier_vip">VIP 核心零售商 (90% - 9折)</option>
                          <option value="tier_major">Major 战略大客户 (82.5% - 82.5折)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900">
                        €{c.creditLimit.toLocaleString()}
                        <div className="text-[10px] text-neutral-400">已用: €{c.usedCredit}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-neutral-600">
                          {c.documents?.length || 0} 份文件已上传
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.status === 'pending' ? (
                          <button type="button" onClick={() => {
                            setAccountReviewTab('customers');
                            selectAdminTab('account_identities');
                          }} className="rounded border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700">前往审核</button>
                        ) : (
                          <span className="text-emerald-700 text-[11px] font-medium">资质有效</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PLATFORM ORDERS */}
      {/* ======================================================== */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <h2 className="text-base font-bold text-neutral-900">订单管理</h2>
            <p className="text-xs text-neutral-500 mt-0.5">跨生产商、跨仓库发货与多币种对账总揽</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input value={orderQuery} onChange={event => setOrderQuery(event.target.value)} placeholder="搜索订单号、批发商、生产商或收货地" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-black focus:bg-white" />
              </div>
              <select value={orderStatus} onChange={event => setOrderStatus(event.target.value as typeof orderStatus)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部履约状态</option><option value="placed">已下单</option><option value="pending">待确认</option><option value="confirmed">已确认</option><option value="picking">拣货中</option><option value="shipped">已发货</option><option value="delivered">已送达</option><option value="cancelled">已取消</option>
              </select>
              <span className="self-center text-[11px] text-neutral-500">显示 {filteredOrders.length} / {orders.length} 笔</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">订单号 / 日期</th>
                    <th className="py-3 px-4">采购批发商</th>
                    <th className="py-3 px-4">收货地址</th>
                    <th className="py-3 px-4">订购总量</th>
                    <th className="py-3 px-4">订单总金额</th>
                    <th className="py-3 px-4">支付方式 / 状态</th>
                    <th className="py-3 px-4">全网履约状态</th>
                    <th className="py-3 px-4 text-right">履约操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900">{o.orderNo}</div>
                        <div className="text-[11px] text-neutral-400">{o.date}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-900">{o.companyName}</td>
                      <td className="py-3 px-4 text-neutral-600">{o.shippingAddress?.city}, {o.shippingAddress?.country}</td>
                      <td className="py-3 px-4 font-bold">{o.totalQty} 件</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">€{o.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className="capitalize">{o.paymentMethod.replace('_', ' ')}</span>
                        <div className="text-[10px] text-emerald-600 font-semibold">{o.paymentStatus}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          o.status === 'shipped' || o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {o.status.toUpperCase()}
                        </span>
                        {o.trackingNumber && (
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            {o.trackingNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {nextOrderStatus[o.status] && (
                            <button
                              type="button"
                              onClick={async () => {
                                const status = nextOrderStatus[o.status]!;
                                const trackingNumber = status === 'shipped'
                                  ? window.prompt('请输入物流单号（可选）', o.trackingNumber || '') || undefined
                                  : undefined;
                                await adminUpdateOrderStatus(o.id, status, trackingNumber);
                              }}
                              className="px-2.5 py-1 bg-black text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              推进至 {nextOrderStatus[o.status]}
                            </button>
                          )}
                          {o.refundStatus === 'requested' && (
                            <>
                              <button type="button" onClick={() => approveReturn(o.id, o.refundAmount)} className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer">
                                批准退款
                              </button>
                              <button type="button" onClick={() => rejectReturn(o.id)} className="px-2.5 py-1 border border-neutral-300 text-neutral-700 rounded text-[11px] cursor-pointer">
                                拒绝退款
                              </button>
                            </>
                          )}
                          {o.refundStatus === 'approved' && <span className="text-emerald-700 text-[11px] font-medium">退款已批准</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. GLOBAL WMS & INVENTORY */}
      {/* ======================================================== */}
      {adminTab === 'inventory' && (
        <AdminInventoryCenter />
      )}

      {/* ======================================================== */}
      {/* 7. SHOWROOMS & APPOINTMENTS */}
      {/* ======================================================== */}
      {(adminTab === 'showrooms' || adminTab === 'appointments') && (
        <div className="space-y-6">
          {adminTab === 'showrooms' && <>
            <h2 className="text-xl font-bold text-neutral-900">展厅管理</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {showrooms.map(sh => (
                <div key={sh.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs flex flex-col">
                  <img src={sh.image} alt={sh.name} className="h-40 w-full object-cover" />
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900">{sh.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1">{sh.address}</p>
                      <p className="text-xs text-neutral-600 mt-2 font-medium">{sh.capacity}</p>
                    </div>
                    <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-500 flex justify-between">
                      <span>电话: {sh.phone}</span>
                      <span className="text-emerald-700 font-semibold">营业中</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>}
          {adminTab === 'appointments' && <>
            <h2 className="text-xl font-bold text-neutral-900">预约管理</h2>
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-neutral-200 font-bold text-xs text-neutral-700">
                预约接待名录 · {appointments.length} 场
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">预约号</th>
                      <th className="py-3 px-4">接待展厅</th>
                      <th className="py-3 px-4">预约时间</th>
                      <th className="py-3 px-4">批发商公司 / 姓名</th>
                      <th className="py-3 px-4">联系电话</th>
                      <th className="py-3 px-4">状态</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {appointments.map(app => {
                    const row = appointmentOverrides[app.id] ?? app;
                    const scheduleDraft = appointmentRescheduleDrafts[app.id] ?? { date: row.date, time: row.time };
                    const reschedule = async () => {
                      if (!window.confirm(`确认将预约 ${row.appointmentNo} 改为 ${scheduleDraft.date} ${scheduleDraft.time}？`)) return;
                      setAppointmentRescheduleBusy(true);
                      setAppointmentRescheduleError('');
                      try {
                        const result = await apiPut<{ success: true; appointment: Appointment }>(`/api/admin/appointments/${encodeURIComponent(row.id)}/reschedule`, scheduleDraft);
                        setAppointmentOverrides(current => ({ ...current, [row.id]: result.appointment }));
                        setAppointmentRescheduleId(null);
                        addNotification('success', '预约已改期', `${row.appointmentNo} 已更新为 ${scheduleDraft.date} ${scheduleDraft.time}`);
                      } catch (cause) {
                        setAppointmentRescheduleError(cause instanceof Error ? cause.message : '预约改期失败，请刷新后重试');
                      } finally {
                        setAppointmentRescheduleBusy(false);
                      }
                    };
                    return (
                    <tr key={row.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">{row.appointmentNo}</td>
                      <td className="py-3 px-4 font-semibold">{row.showroomName}</td>
                      <td className="py-3 px-4">{row.date} · {row.timeSlot ?? row.time}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{row.companyName}</div>
                        <div className="text-neutral-500">{row.contactPerson}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{row.phone}</td>
                      <td className="py-3 px-4">
                        <span className="rounded border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                          {{ pending: '待确认', confirmed: '已确认接待', completed: '已完成', cancelled: '已取消', no_show: '爽约' }[row.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {row.status === 'pending' && (
                            <button
                              onClick={() => void adminUpdateAppointmentStatus(row.id, 'confirmed')}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              确认接待
                            </button>
                          )}
                          {row.status === 'confirmed' && (
                            <button
                              onClick={() => void adminUpdateAppointmentStatus(row.id, 'completed')}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              标记完成
                            </button>
                          )}
                          {row.status === 'confirmed' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`确认将预约 ${row.appointmentNo} 标记为爽约？`)) void adminUpdateAppointmentStatus(row.id, 'no_show');
                              }}
                              className="px-2.5 py-1 border border-neutral-400 text-neutral-800 rounded text-[11px] cursor-pointer"
                            >
                              标记爽约
                            </button>
                          )}
                          {(row.status === 'pending' || row.status === 'confirmed') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAppointmentRescheduleError('');
                                setAppointmentRescheduleDrafts(current => ({ ...current, [row.id]: { date: row.date, time: row.time.slice(0, 5) } }));
                                setAppointmentRescheduleId(current => current === row.id ? null : row.id);
                              }}
                              className="px-2.5 py-1 border border-neutral-400 text-neutral-800 rounded text-[11px] cursor-pointer"
                            >
                              改期
                            </button>
                          )}
                          {(row.status === 'pending' || row.status === 'confirmed') && (
                            <button
                              onClick={() => void adminUpdateAppointmentStatus(row.id, 'cancelled')}
                              className="px-2.5 py-1 border border-neutral-300 text-neutral-700 rounded text-[11px] cursor-pointer"
                            >
                              取消
                            </button>
                          )}
                        </div>
                        {appointmentRescheduleId === row.id && <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <input aria-label="改期日期" type="date" value={scheduleDraft.date} onChange={event => setAppointmentRescheduleDrafts(current => ({ ...current, [row.id]: { ...scheduleDraft, date: event.target.value } }))} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs" />
                          <input aria-label="改期时间" type="time" value={scheduleDraft.time} onChange={event => setAppointmentRescheduleDrafts(current => ({ ...current, [row.id]: { ...scheduleDraft, time: event.target.value } }))} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs" />
                          <button type="button" onClick={() => void reschedule()} disabled={appointmentRescheduleBusy || !scheduleDraft.date || !scheduleDraft.time} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{appointmentRescheduleBusy ? '保存中…' : '确认改期'}</button>
                        </div>}
                        {appointmentRescheduleError && appointmentRescheduleId === row.id && <p role="alert" className="mt-2 text-right text-[11px] text-neutral-700">{appointmentRescheduleError}</p>}
                      </td>
                    </tr>
                  );                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>}
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. POS SIMULATION */}
      {/* ======================================================== */}
      {adminTab === 'pos' && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5 shadow-xs max-w-2xl">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-neutral-800" />
              展厅收银
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              登记现场销售并扣减总仓库存。此操作记录库存销售流水，不会自动收款或生成支付回执。
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">选择现场展厅</label>
              <select
                value={posShowroom}
                onChange={(e) => setPosShowroom(e.target.value as any)}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-medium"
              >
                <option value="central">RUDA 总仓</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">扫描或输入 SKU 条形码</label>
              <input
                list="pos-sku-options"
                value={posSku}
                onChange={(e) => setPosSku(e.target.value)}
                placeholder="可使用扫码枪扫描，或输入 SKU"
                className="w-full bg-white border border-neutral-300 rounded-lg p-2.5 font-mono"
              />
              <datalist id="pos-sku-options">
                {products.flatMap(product => product.skus.map(item => (
                  <option key={`${product.id}-${item.sku}`} value={item.sku}>{product.styleNo} · {item.color} / {item.size}</option>
                )))}
              </datalist>
            </div>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">现场拿取件数</label>
              <input
                type="number"
                value={posQty}
                onChange={(e) => setPosQty(Number(e.target.value))}
                min="1"
                step="1"
                className="w-full bg-white border border-neutral-300 rounded-lg p-2.5 font-bold"
              />
            </div>

            <button
              type="button"
              disabled={posSaving || !posSku.trim() || !Number.isInteger(posQty) || posQty <= 0}
              onClick={async () => {
                if (!window.confirm(`确认登记 SKU ${posSku.trim()} 销售出库 ${posQty} 件？`)) return;
                setPosSaving(true);
                setPosError('');
                try {
                  const signature = JSON.stringify([posSku.trim(), posShowroom, posQty]);
                  const referenceId = posRequestSignature === signature && posRequestId ? posRequestId : `POS-${crypto.randomUUID()}`;
                  setPosRequestId(referenceId);
                  setPosRequestSignature(signature);
                  const result = await apiPost<{ success: true; product: Product }>('/api/admin/inventory/pos-sale', {
                    sku: posSku.trim(),
                    location: posShowroom,
                    quantity: posQty,
                    referenceId
                  });
                  replaceProductFromServer(result.product);
                  setPosReceipt(referenceId);
                  setPosRequestId('');
                  setPosRequestSignature('');
                  addNotification('success', '销售出库已登记', `${posSku.trim()} 已扣减 ${posQty} 件，凭证 ${referenceId}`);
                } catch (error) {
                  const message = error instanceof Error ? error.message : '销售出库失败，请刷新库存后重试';
                  setPosError(message);
                  addNotification('warning', '销售出库失败', message);
                } finally {
                  setPosSaving(false);
                }
              }}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {posSaving ? '正在登记…' : '确认销售出库'}
            </button>
            {posReceipt && <p role="status" className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">最近出库凭证：{posReceipt}。可在库存流水中查询。</p>}
            {posError && <p role="alert" className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">{posError}</p>}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. PLATFORM FINANCE */}
      {/* ======================================================== */}
      {adminTab === 'finance' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-bold text-neutral-900">财务结算</h2><p className="mt-1 text-xs text-neutral-500">本页仅处理结算核对与凭证登记；支付渠道和管理员 2FA 表单仅在平台设置中。</p></div>
              <button type="button" onClick={() => selectAdminTab('settings')} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">前往平台设置</button>
            </div>
          </section>
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-neutral-700" />
                结算记录
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                全平台 GMV、平台技术服务净佣金池与各入驻工坊结算记录
              </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => void refreshPayouts()} disabled={payoutLoading} className="px-3 py-2 border border-neutral-300 text-neutral-800 rounded-lg text-xs font-semibold disabled:opacity-50">
                  {payoutLoading ? '读取中…' : '刷新结算记录'}
                </button>
                <button type="button" onClick={() => void generatePayoutDrafts()} disabled={payoutBusy} className="px-3 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  生成本月结算草稿
                </button>
              </div>
            </div>
            {payoutLoadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>结算记录读取失败{financePayouts ? '，当前显示最近一次成功数据' : ''}：{payoutLoadError}</span>
              <button type="button" onClick={() => void refreshPayouts()} disabled={payoutLoading} className="rounded border border-amber-300 px-2.5 py-1.5 font-semibold hover:bg-amber-100 disabled:opacity-50">{payoutLoading ? '读取中…' : '重试读取'}</button>
            </div>}
            <p className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-700">
              当前未集成自动资金转账。进入“人工结算处理中”只更新平台记录；结算完成后必须登记外部参考号和凭证说明/链接。系统不会执行或验证银行转账。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="text-neutral-500">全网累计 GMV</div>
                <div className="text-xl font-bold text-neutral-900 mt-1">
                  €{totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="text-neutral-600 font-semibold">平台净抽佣收入（按生产商配置）</div>
                <div className="text-xl font-bold text-neutral-900 mt-1">
                  €{platformRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="text-neutral-500">尚未登记结算总额</div>
                <div className="text-xl font-bold text-neutral-900 mt-1">
                  {financePayouts === null ? '—' : `€${payoutRows.filter(p => p.status !== 'paid' || !p.settlementReference || !p.settlementProof).reduce((acc, p) => acc + p.netPayout, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-neutral-200 font-bold text-xs uppercase text-neutral-700">
              全平台生产商人工结算记录
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">单号</th>
                    <th className="py-3 px-4">生产商品牌</th>
                    <th className="py-3 px-4">结算周期</th>
                    <th className="py-3 px-4">销售总额</th>
                    <th className="py-3 px-4">平台抽佣（按生产商比例）</th>
                    <th className="py-3 px-4">退款 / 通道费</th>
                    <th className="py-3 px-4">应结算净额</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4">生产商对账</th>
                    <th className="py-3 px-4">收款账户（掩码）</th>
                    <th className="py-3 px-4">结算凭证与审计</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {payoutRows.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-xs text-neutral-500">{financePayouts === null && payoutLoading ? '正在加载结算记录…' : financePayouts === null && payoutLoadError ? '结算记录暂不可用，请重试读取' : '暂无结算记录'}</td></tr>}
                  {payoutRows.map(p => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 font-mono font-bold">{p.id}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{p.merchantName}</td>
                      <td className="py-3 px-4 text-neutral-600">{p.period}</td>
                      <td className="py-3 px-4 font-semibold">€{p.grossSales.toFixed(2)}</td>
                      <td className="py-3 px-4 text-neutral-700 font-semibold">+€{p.platformFeeAmount.toFixed(2)} <span className="text-[10px] text-neutral-500">({((p.platformFeeRate ?? 0.08) * 100).toFixed(1)}%)</span></td>
                      <td className="py-3 px-4 text-neutral-600">-€{(p.refunds ?? 0).toFixed(2)} / -€{(p.paymentProcessingFee ?? 0).toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">€{p.netPayout.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className="border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                          {p.status === 'paid' ? (p.settlementReference && p.settlementProof ? '已登记人工结算' : '历史结算状态待核验') : p.status === 'processing' ? '人工结算处理中' : p.status === 'failed' ? '人工结算失败' : '待处理'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-neutral-600">{p.merchantAcknowledgedAt ? '已确认' : '待生产商确认'}</td>
                      <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">{p.bankAccount}</td>
                      <td className="max-w-64 py-3 px-4 text-[11px] text-neutral-600">
                        {p.status === 'paid' && p.settlementReference && p.settlementProof ? (
                          <div className="space-y-1 break-words">
                            <div>参考号：{p.settlementReference || '—'}</div>
                            <div>凭证：{p.settlementProof || '—'}</div>
                            <div>{p.settledBy || '—'} · {p.settledAt ? new Date(p.settledAt).toLocaleString(getIntlLocale(lang)) : '—'}</div>
                          </div>
                        ) : <span>{p.status === 'paid' ? '历史记录没有结算凭证' : '完成后需登记人工凭证'}</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === 'pending' && (
                          <button type="button" disabled={payoutBusy} onClick={() => void updateFinancePayoutStatus(p.id, 'processing')} className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold cursor-pointer disabled:opacity-50">
                            标记人工处理中
                          </button>
                        )}
                        {p.status === 'processing' && (
                          <form className="min-w-56 space-y-1.5 text-left" onSubmit={event => {
                            event.preventDefault();
                            const evidence = settlementEvidence[p.id] || { reference: '', proof: '' };
                            void updateFinancePayoutStatus(p.id, 'paid', evidence);
                          }}>
                            <input aria-label="人工结算外部参考号" required minLength={2} maxLength={200} value={settlementEvidence[p.id]?.reference || ''} onChange={event => setSettlementEvidence(current => ({ ...current, [p.id]: { reference: event.target.value, proof: current[p.id]?.proof || '' } }))} placeholder="外部参考号" className="w-full border border-neutral-300 bg-white px-2 py-1.5 text-[11px]" />
                            <textarea aria-label="人工结算凭证说明或链接" required minLength={5} maxLength={2000} rows={2} value={settlementEvidence[p.id]?.proof || ''} onChange={event => setSettlementEvidence(current => ({ ...current, [p.id]: { reference: current[p.id]?.reference || '', proof: event.target.value } }))} placeholder="凭证说明或安全文件链接" className="w-full resize-y border border-neutral-300 bg-white px-2 py-1.5 text-[11px]" />
                            <button type="submit" disabled={payoutBusy} className="w-full bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                              记录人工结算完成
                            </button>
                          </form>
                        )}
                        {p.status === 'failed' && (
                          <button type="button" disabled={payoutBusy} onClick={() => {
                            void updateFinancePayoutStatus(p.id, 'processing');
                          }} className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold cursor-pointer disabled:opacity-50">
                            重新开始人工结算
                          </button>
                        )}
                        {p.status === 'paid' && (!p.settlementReference || !p.settlementProof) && (
                          <form className="mt-2 min-w-56 space-y-1.5 text-left" onSubmit={event => {
                            event.preventDefault();
                            const evidence = settlementEvidence[p.id] || { reference: '', proof: '' };
                            void updateFinancePayoutStatus(p.id, 'paid', evidence);
                          }}>
                            <input aria-label="历史人工结算外部参考号" required minLength={2} maxLength={200} value={settlementEvidence[p.id]?.reference || ''} onChange={event => setSettlementEvidence(current => ({ ...current, [p.id]: { reference: event.target.value, proof: current[p.id]?.proof || '' } }))} placeholder="外部参考号" className="w-full border border-neutral-300 bg-white px-2 py-1.5 text-[11px]" />
                            <textarea aria-label="历史人工结算凭证说明或链接" required minLength={5} maxLength={2000} rows={2} value={settlementEvidence[p.id]?.proof || ''} onChange={event => setSettlementEvidence(current => ({ ...current, [p.id]: { reference: current[p.id]?.reference || '', proof: event.target.value } }))} placeholder="凭证说明或安全文件链接" className="w-full resize-y border border-neutral-300 bg-white px-2 py-1.5 text-[11px]" />
                            <button type="submit" disabled={payoutBusy} className="w-full bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                              保存历史结算审计凭证
                            </button>
                          </form>
                        )}
                        {p.status === 'paid' && p.settlementReference && p.settlementProof && <span className="text-neutral-700 text-[11px] font-medium">人工结算凭证已登记</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. AUDIT LOGS */}
      {/* ======================================================== */}
      {adminTab === 'audit_logs' && (
        <div className="space-y-4">
          <AdminPageHeader title="操作记录" />

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">操作时间</th>
                    <th className="py-3 px-4">操作人员 / 角色</th>
                    <th className="py-3 px-4">动作类型</th>
                    <th className="py-3 px-4">涉及实体</th>
                    <th className="py-3 px-4">变更前</th>
                    <th className="py-3 px-4">变更后</th>
                    <th className="py-3 px-4">来源地址</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-mono text-[11px]">
                  {auditLogs.slice(0, auditVisibleCount).map(log => (
                    <tr key={log.id} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 text-neutral-500">{log.timestamp}</td>
                      <td className="py-2.5 px-4 font-sans font-bold text-neutral-900">
                        {log.userName}
                        <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-neutral-100 text-neutral-600">
                          {log.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-neutral-800">{log.action}</td>
                      <td className="py-2.5 px-4 text-neutral-600">{log.entity}: {log.entityId}</td>
                      <td className="py-2.5 px-4 text-neutral-400 max-w-xs truncate">{log.oldValue || '-'}</td>
                      <td className="py-2.5 px-4 font-bold text-neutral-900 max-w-xs truncate">{log.newValue}</td>
                      <td className="py-2.5 px-4 text-neutral-400">{log.ip || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
              <span>显示 {Math.min(auditVisibleCount, auditLogs.length)} / {auditLogs.length} 条</span>
              {auditVisibleCount < auditLogs.length && <button type="button" onClick={() => setAuditVisibleCount(count => count + 50)} className="min-h-8 border border-neutral-300 px-3 font-semibold text-neutral-800">加载更多</button>}
            </div>
          </div>
        </div>
      )}
      {modagptPlanTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !modagptPlanBusy) {
              setModagptPlanTarget(null);
              setModagptPlanSnapshot(null);
            }
          }}
        >
          <form
            onSubmit={saveModaGptPlan}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            aria-labelledby="modagpt-plan-title"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-800"><Sparkles className="h-5 w-5" /></div>
              <div>
                <h2 id="modagpt-plan-title" className="text-base font-bold text-neutral-900">套餐管理</h2>
                <p className="mt-1 text-xs text-neutral-500">{modagptPlanTarget.name}</p>
              </div>
            </div>
            {modagptPlanBusy && !modagptPlanSnapshot
              ? <p className="py-6 text-center text-sm text-neutral-500">正在读取套餐…</p>
              : <>
                {modagptPlanSnapshot && <div className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-800">
                    当前：{modagptPlanSnapshot.plan === 'pro' ? '高级版' : '基础版'}
                    {modagptPlanSnapshot.expiresAt
                      ? ` · 到期 ${new Date(modagptPlanSnapshot.expiresAt).toLocaleDateString()}`
                      : modagptPlanSnapshot.plan === 'pro' ? ' · 不限期' : ''}
                  </p>
                  <p className="mt-2">本月用量 · 聊天 {modagptPlanSnapshot.usage.chat}/{modagptPlanSnapshot.quotas.chat} · 出图 {modagptPlanSnapshot.usage.imageGeneration}/{modagptPlanSnapshot.quotas.imageGeneration} · 换衣 {modagptPlanSnapshot.usage.tryOn}/{modagptPlanSnapshot.quotas.tryOn}</p>
                </div>}
                <label className="mb-3 block text-xs font-semibold text-neutral-700">
                  目标套餐
                  <select
                    value={modagptPlanDraft}
                    onChange={event => setModagptPlanDraft(event.target.value as 'free' | 'pro')}
                    className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="free">基础版 · 聊天 500 次/月</option>
                    <option value="pro">高级版 · 聊天 5000 次/月、出图 30 次/月、换衣 10 次/月</option>
                  </select>
                </label>
                {modagptPlanDraft === 'pro' && <label className="mb-3 block text-xs font-semibold text-neutral-700">
                  高级版到期日（留空表示不限期）
                  <input
                    type="date"
                    value={modagptPlanExpiry}
                    onChange={event => setModagptPlanExpiry(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-normal"
                  />
                </label>}
                <p className="rounded-lg bg-violet-50 p-3 text-[11px] leading-5 text-violet-900">
                  套餐按 UTC 自然月计量；此处只管理权益，不配置或暴露 DeepSeek/Fal 密钥。
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={modagptPlanBusy}
                    onClick={() => { setModagptPlanTarget(null); setModagptPlanSnapshot(null); }}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={modagptPlanBusy || !modagptPlanSnapshot}
                    className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {modagptPlanBusy ? '保存中…' : '保存套餐'}
                  </button>
                </div>
              </>}
          </form>
        </div>
      )}
      {merchantPasswordTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !merchantPasswordSaving) {
              setMerchantPasswordTarget(null);
            }
          }}
        >
          <form
            onSubmit={resetMerchantPassword}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            aria-labelledby="merchant-password-reset-title"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 id="merchant-password-reset-title" className="text-base font-bold text-neutral-900">重置老板登录密码</h2>
                <p className="mt-1 text-xs text-neutral-500">{merchantPasswordTarget.name} · {merchantPasswordTarget.contactEmail || '未设置联系邮箱'}</p>
              </div>
            </div>
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              此操作会同步更新该商家的企业老板账号和老板工作台密码，不会更改员工个人密码。请通过安全渠道将新密码告知商家。
            </p>
            <label className="mb-3 block text-xs font-semibold text-neutral-700">
              新密码（至少 12 个字符）
              <span className="relative mt-1.5 block">
                <input
                  autoComplete="new-password"
                  type={showMerchantPassword ? 'text' : 'password'}
                  minLength={12}
                  required
                  value={merchantPassword}
                  onChange={event => setMerchantPassword(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm font-normal outline-none focus:border-amber-600"
                />
                <button
                  type="button"
                  onClick={() => setShowMerchantPassword(visible => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-900"
                  aria-label={showMerchantPassword ? '隐藏新密码' : '显示新密码'}
                  aria-pressed={showMerchantPassword}
                >
                  {showMerchantPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <label className="block text-xs font-semibold text-neutral-700">
              确认新密码
              <span className="relative mt-1.5 block">
                <input
                  autoComplete="new-password"
                  type={showMerchantPasswordConfirm ? 'text' : 'password'}
                  minLength={12}
                  required
                  value={merchantPasswordConfirm}
                  onChange={event => setMerchantPasswordConfirm(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm font-normal outline-none focus:border-amber-600"
                />
                <button
                  type="button"
                  onClick={() => setShowMerchantPasswordConfirm(visible => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-900"
                  aria-label={showMerchantPasswordConfirm ? '隐藏确认密码' : '显示确认密码'}
                  aria-pressed={showMerchantPasswordConfirm}
                >
                  {showMerchantPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={merchantPasswordSaving}
                onClick={() => setMerchantPasswordTarget(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={merchantPasswordSaving || merchantPassword.length < 12 || merchantPassword !== merchantPasswordConfirm}
                className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {merchantPasswordSaving ? '保存中…' : '确认重置密码'}
              </button>
            </div>
          </form>
        </div>
      )}
      {accountIdentityTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !accountIdentitySaving) {
              setAccountIdentityTarget(null);
            }
          }}
        >
          <form
            onSubmit={linkAccountIdentity}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            aria-labelledby="account-identity-link-title"
          >
            <h2 id="account-identity-link-title" className="text-base font-bold text-neutral-900">人工核实并统一账号</h2>
            <p className="mt-1 text-xs text-neutral-500">{accountIdentityTarget.email}</p>
            <p className="my-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              请先通过平台规定的方式核实邮箱持有人。确认后，所选买家与企业/老板账号将共享此处设置的新密码；员工与管理员账号不受影响。
            </p>
            <label className="mb-3 block text-xs font-semibold text-neutral-700">
              统一登录密码（至少 12 个字符）
              <span className="relative mt-1.5 block">
                <input
                  autoComplete="new-password"
                  type={showAccountIdentityPassword ? 'text' : 'password'}
                  minLength={12}
                  required
                  value={accountIdentityPassword}
                  onChange={event => setAccountIdentityPassword(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm font-normal outline-none focus:border-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => setShowAccountIdentityPassword(value => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-900"
                  aria-label={showAccountIdentityPassword ? '隐藏统一登录密码' : '显示统一登录密码'}
                >
                  {showAccountIdentityPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <label className="block text-xs font-semibold text-neutral-700">
              确认统一登录密码
              <span className="relative mt-1.5 block">
                <input
                  autoComplete="new-password"
                  type={showAccountIdentityPasswordConfirm ? 'text' : 'password'}
                  minLength={12}
                  required
                  value={accountIdentityPasswordConfirm}
                  onChange={event => setAccountIdentityPasswordConfirm(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm font-normal outline-none focus:border-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => setShowAccountIdentityPasswordConfirm(value => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-900"
                  aria-label={showAccountIdentityPasswordConfirm ? '隐藏确认密码' : '显示确认密码'}
                >
                  {showAccountIdentityPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={accountIdentitySaving}
                onClick={() => setAccountIdentityTarget(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={accountIdentitySaving || accountIdentityPassword.length < 12 || accountIdentityPassword !== accountIdentityPasswordConfirm}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {accountIdentitySaving ? '同步中…' : '确认并同步账号'}
              </button>
            </div>
          </form>
        </div>
      )}
          </main>
        </div>
      </div>
    </div>
  );
};

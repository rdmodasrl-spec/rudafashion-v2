import { getIntlLocale } from '../../i18n/translations';
import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  Truck, 
  Sparkles, 
  AlertTriangle, 
  Calendar, 
  Bell, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Monitor, 
  Boxes,
  FolderOpen,
  Film,
  Settings2,
  RefreshCw,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { AdminFashionContentHub } from '../platform-admin-common/components/admin/AdminFashionContentHub';
import { apiGet, apiPost, ApiError } from '../../api/client';
import { AdminDatabaseCenter } from '../platform-admin-common/components/admin/AdminDatabaseCenter';
import { AdminRiskMonitor } from '../platform-admin-common/components/admin/AdminRiskMonitor';
import { AdminNotificationEvents } from '../platform-admin-common/components/admin/AdminNotificationEvents';
import { AdminMerchantSupport } from '../platform-admin-common/components/admin/AdminMerchantSupport';
import { AdminAiControlCenter } from '../platform-admin-common/components/admin/AdminAiControlCenter';
import { AdminAppStoreMgmt } from '../platform-admin-common/components/admin/AdminAppStoreMgmt';
import { AdminGrowthWorkbench } from '../platform-admin-common/components/admin/AdminGrowthWorkbench';
import { AdminGrowthAcquisition } from '../platform-admin-common/components/admin/AdminGrowthAcquisition';
import { AdminGrowthContent } from '../platform-admin-common/components/admin/AdminGrowthContent';
import { AdminGrowthAnalytics } from '../platform-admin-common/components/admin/AdminGrowthAnalytics';
import { AdminModaGptBilling } from '../platform-admin-common/components/admin/AdminModaGptBilling';
import { AdminFeatureFlags } from '../platform-admin-common/components/admin/AdminFeatureFlags';
import { AdminModaGptOperator } from '../platform-admin-common/components/admin/AdminModaGptOperator';
import { AdminSupportRequests } from '../platform-admin-common/components/admin/AdminSupportRequests';
import { AdminMerchantCenter } from '../platform-admin-common/components/admin/AdminMerchantCenter';
import { ADMIN_AREAS, ADMIN_AREA_ITEMS, getAdminAreaForTab, type AdminArea, type AdminTab } from '../platform-admin-common/components/admin/adminNavigation';
import type { OrderStatus, Product } from '../../types/b2b';

type MobileAdminTab =
  | 'orders' | 'merchants' | 'customers' | 'product_audit' | 'inventory_alert' | 'appointments' | 'notifications' | 'vault_requests' | 'pos'
  | 'fashion_content' | 'gallery' | 'fashion_community' | 'finance' | 'settings' | 'audit_logs' | 'database_center' | 'risk_monitor'
  | 'merchant_support_settings' | 'overview' | 'showrooms' | 'growth' | 'ai_center' | 'modagpt_operator' | 'partners'
  | 'marketing_attribution' | 'promotions' | 'bi_dashboard' | 'merchant_support' | 'support_requests'
  | 'growth_workbench' | 'growth_acquisition' | 'growth_content' | 'growth_analytics'
  | 'ai_provider_settings' | 'modagpt_billing' | 'app_store_mgmt' | 'feature_flags';

function getMobileTab(tab: AdminTab): MobileAdminTab | null {
  const tabs: Partial<Record<AdminTab, MobileAdminTab>> = {
    overview: 'overview',
    merchants: 'merchants',
    customers: 'customers',
    products: 'product_audit',
    vault_requests: 'vault_requests',
    orders: 'orders',
    inventory: 'inventory_alert',
    showrooms: 'showrooms',
    appointments: 'appointments',
    pos: 'pos',
    finance: 'finance',
    notifications: 'notifications',
    settings: 'settings',
    audit_logs: 'audit_logs',
    fashion_content: 'fashion_content',
    gallery: 'fashion_content',
    fashion_community: 'fashion_content',
    website_collector: 'fashion_content',
    risk_monitor: 'risk_monitor',
    database_center: 'database_center',
    merchant_support_settings: 'merchant_support_settings',
    growth: 'growth_workbench',
    growth_workbench: 'growth_workbench',
    growth_acquisition: 'growth_acquisition',
    growth_content: 'growth_content',
    growth_analytics: 'growth_analytics',
    ai_center: 'ai_center',
    modagpt_operator: 'modagpt_operator',
    partners: 'growth_acquisition',
    marketing_attribution: 'growth_analytics',
    promotions: 'growth_content',
    bi_dashboard: 'growth_analytics',
    merchant_support: 'merchant_support',
    support_requests: 'support_requests',
    ai_provider_settings: 'ai_provider_settings',
    modagpt_billing: 'modagpt_billing',
    app_store_mgmt: 'app_store_mgmt',
    feature_flags: 'feature_flags'
  };
  return tabs[tab] ?? null;
}

const nextMobileOrderStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  placed: 'confirmed',
  confirmed: 'picking',
  picking: 'shipped',
  shipped: 'delivered'
};

interface PlatformAdminMobileProps {
  initialTab?: AdminTab;
  onSwitchToDesktop?: (tab?: AdminTab) => void;
}

export const PlatformAdminMobile: React.FC<PlatformAdminMobileProps> = ({ initialTab = 'overview', onSwitchToDesktop }) => {
  const { 
    orders = [], 
    merchants = [], 
    customers = [], 
    products = [], 
    showrooms = [],
    appointments = [], 
    adminUpdateOrderStatus,
    adminUpdateAppointmentStatus,
    adminReviewVaultRequest,
    vaultRequests = [],
    replaceProductFromServer,
    reviewCustomer,
    updateProduct,
    approveReturn,
    rejectReturn,
    addNotification,
    assumeMerchantFromAdmin,
    setCurrentView
  , lang} = useB2B();

  // Tabs: 概览 / 订单 / 商家 / 客户 / 商品 / 库存 / 展厅 / 预约 / 收银 / 通知
  const [activeTab, setActiveTab] = useState<MobileAdminTab>(() => getMobileTab(initialTab) ?? 'overview');
  const [adminArea, setAdminArea] = useState<AdminArea>(() => getAdminAreaForTab(initialTab));
  const [selectedAdminTab, setSelectedAdminTab] = useState<AdminTab>(initialTab);
  const [productReviewSaving, setProductReviewSaving] = useState(false);
  const [productReviewError, setProductReviewError] = useState('');
  const [orderStatusSavingId, setOrderStatusSavingId] = useState<string | null>(null);
  const [appointmentStatusSavingId, setAppointmentStatusSavingId] = useState<string | null>(null);
  const [vaultReviewSavingId, setVaultReviewSavingId] = useState<string | null>(null);
  const [posSku, setPosSku] = useState('');
  const [posQuantity, setPosQuantity] = useState(1);
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState('');
  const [posReceipt, setPosReceipt] = useState('');
  const [posRequestId, setPosRequestId] = useState('');
  const [posRequestSignature, setPosRequestSignature] = useState('');
  useEffect(() => {
    if (!getMobileTab(initialTab)) onSwitchToDesktop?.(initialTab);
  }, [initialTab, onSwitchToDesktop]);

  const selectMobileArea = (area: AdminArea) => {
    const defaultTab = ADMIN_AREA_ITEMS[area].find(item => getMobileTab(item.key))?.key
      ?? ADMIN_AREA_ITEMS[area][0]?.key
      ?? 'overview';
    const mobileTab = getMobileTab(defaultTab);
    if (!mobileTab) {
      onSwitchToDesktop?.(defaultTab);
      return;
    }
    setAdminArea(area);
    setSelectedAdminTab(defaultTab);
    setActiveTab(mobileTab);
  };
  type MobilePayout = {
    id: string;
    merchantName: string;
    period: string;
    grossSales: number;
    netPayout: number;
    status: string;
    bankAccount: string;
    settlementReference?: string | null;
    settlementProof?: string | null;
    settledAt?: string | null;
    settledBy?: string | null;
    createdAt: string;
  };
  type MobileAuditLog = {
    id: string;
    userName: string;
    role: string;
    action: string;
    entity: string;
    entityId: string;
    timestamp: string;
    ip?: string | null;
  };
  const [mobilePayouts, setMobilePayouts] = useState<MobilePayout[]>([]);
  const [mobileAuditLogs, setMobileAuditLogs] = useState<MobileAuditLog[]>([]);
  const [mobileAuditVisibleCount, setMobileAuditVisibleCount] = useState(30);
  const [advancedSectionLoading, setAdvancedSectionLoading] = useState(false);
  const [advancedSectionError, setAdvancedSectionError] = useState('');
  const [advancedRefreshKey, setAdvancedRefreshKey] = useState(0);
  const [intelligence, setIntelligence] = useState<{
    summary: { critical: number; warning: number; info: number };
    alerts: Array<{ severity: 'critical' | 'warning' | 'info'; type: string; message: string; entityId?: string | null }>;
  } | null>(null);
  const [intelligenceStale, setIntelligenceStale] = useState(false);
  const [focusedAlert, setFocusedAlert] = useState<{
    severity: 'critical' | 'warning' | 'info';
    type: string;
    message: string;
    entityId?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    let retryDelay = 60_000;
    const schedule = (delay: number) => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), delay);
    };
    const load = async () => {
      if (cancelled || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const data = await apiGet<{ success: boolean; summary: { critical: number; warning: number; info: number }; alerts: Array<{ severity: 'critical' | 'warning' | 'info'; type: string; message: string; entityId?: string | null }> }>('/api/admin/operations/intelligence');
        if (!cancelled && data.success) {
          setIntelligence(data);
          setIntelligenceStale(false);
          retryDelay = 60_000;
        }
      } catch (error) {
        if (!cancelled) setIntelligenceStale(true);
        if (!(error instanceof ApiError && error.status === 429)) {
          console.error('[admin-mobile-intelligence]', error);
        }
        retryDelay = Math.min(
          15 * 60_000,
          Math.max(retryDelay * 2, (error instanceof ApiError ? error.retryAfter ?? 0 : 0) * 1000)
        );
      } finally {
        inFlight = false;
      }
      schedule(retryDelay);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timer !== undefined) window.clearTimeout(timer);
        void load();
      } else if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void load();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'finance' && activeTab !== 'audit_logs') return;
    let cancelled = false;
    setAdvancedSectionLoading(true);
    setAdvancedSectionError('');
    const request = activeTab === 'finance'
      ? apiGet<{ payouts: MobilePayout[] }>('/api/admin/payouts').then(result => {
          if (!cancelled) setMobilePayouts(result.payouts);
        })
      : apiGet<{ logs: MobileAuditLog[] }>('/api/admin/audit-logs').then(result => {
          if (!cancelled) {
            setMobileAuditLogs(result.logs);
            setMobileAuditVisibleCount(30);
          }
        });
    request.catch(error => {
      if (!cancelled) setAdvancedSectionError(error instanceof Error ? error.message : '管理数据读取失败');
    }).finally(() => {
      if (!cancelled) setAdvancedSectionLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, advancedRefreshKey]);

  const pendingOrders = orders.filter(order => nextMobileOrderStatus[order.status] !== undefined);
  const pendingCustomers = customers.filter(c => c.status === 'pending');
  const pendingMerchants = merchants.filter(m => !m.isVerified && m.storefrontEnabled !== true);
  const pendingProducts = products.filter(p => p.lifecycleStatus === 'pending_review');
  const lowStockSkuCount = products.reduce((count, product) => count + product.skus.filter(sku => (sku.stockCentral - (sku.reserved || 0)) < 15).length, 0);
  const reviewProduct = async (productId: string, lifecycleStatus: 'published' | 'rejected') => {
    if (productReviewSaving) return;
    setProductReviewSaving(true);
    setProductReviewError('');
    try {
      await updateProduct(productId, { lifecycleStatus });
    } catch (error) {
      setProductReviewError(error instanceof Error ? error.message : '商品审核未保存，请重试');
    } finally {
      setProductReviewSaving(false);
    }
  };
  const updateMobileOrderStatus = async (orderId: string, status: OrderStatus) => {
    setOrderStatusSavingId(orderId);
    try {
      await adminUpdateOrderStatus(orderId, status);
    } catch (error) {
      addNotification('warning', '订单状态更新失败', error instanceof Error ? error.message : '请重试');
    } finally {
      setOrderStatusSavingId(null);
    }
  };
  const updateMobileAppointmentStatus = async (appointmentId: string, status: Parameters<typeof adminUpdateAppointmentStatus>[1]) => {
    setAppointmentStatusSavingId(appointmentId);
    try {
      await adminUpdateAppointmentStatus(appointmentId, status);
    } catch (error) {
      addNotification('warning', '预约状态更新失败', error instanceof Error ? error.message : '请重试');
    } finally {
      setAppointmentStatusSavingId(null);
    }
  };
  const reviewMobileVaultRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setVaultReviewSavingId(requestId);
    try {
      await adminReviewVaultRequest(requestId, status);
    } catch (error) {
      addNotification('warning', '授权申请审核失败', error instanceof Error ? error.message : '请重试');
    } finally {
      setVaultReviewSavingId(null);
    }
  };
  const submitMobilePosSale = async () => {
    const sku = posSku.trim();
    if (!sku || !Number.isInteger(posQuantity) || posQuantity <= 0 || posSaving) return;
    if (!window.confirm(`确认登记 SKU ${sku} 销售出库 ${posQuantity} 件？`)) return;
    setPosSaving(true);
    setPosError('');
    try {
      const signature = JSON.stringify([sku, 'central', posQuantity]);
      const referenceId = posRequestSignature === signature && posRequestId ? posRequestId : `POS-${crypto.randomUUID()}`;
      setPosRequestId(referenceId);
      setPosRequestSignature(signature);
      const result = await apiPost<{ success: true; product: Product }>('/api/admin/inventory/pos-sale', {
        sku,
        location: 'central',
        quantity: posQuantity,
        referenceId
      });
      replaceProductFromServer(result.product);
      setPosReceipt(referenceId);
      setPosRequestId('');
      setPosRequestSignature('');
      addNotification('success', '销售出库已登记', `${sku} 已扣减 ${posQuantity} 件，凭证 ${referenceId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '销售出库失败，请刷新库存后重试';
      setPosError(message);
      addNotification('warning', '销售出库失败', message);
    } finally {
      setPosSaving(false);
    }
  };

  return (
    <div id="platform-admin-mobile-root" className="min-h-screen bg-neutral-100 text-neutral-900 pb-20 select-none">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-neutral-900 text-white px-4 py-3 shadow-md flex items-center justify-between safe-area-top">
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 shrink-0 rounded-[6px] bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200 font-bold text-xs">
            ADM
          </div>
          <span className="truncate text-xs font-black tracking-widest font-mono text-white">RUDA</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            aria-label="采购商城，外部跳转"
            title="外部跳转到共享采购商城"
            className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap border border-neutral-700 bg-neutral-800 px-2 text-[10px] font-medium text-neutral-200"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>采购</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
          </button>
          {onSwitchToDesktop && (
            <button
              onClick={() => onSwitchToDesktop()}
              className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>电脑端</span>
            </button>
          )}
        </div>
      </header>

      <nav aria-label="总后台分区" className="sticky top-[58px] z-30 grid grid-cols-2 gap-1 border-b border-neutral-200 bg-white p-2">
        {ADMIN_AREAS.map(area => (
          <button
            key={area.key}
            type="button"
            aria-pressed={adminArea === area.key}
            onClick={() => selectMobileArea(area.key)}
            className={`min-h-9 rounded-[6px] px-2 py-2 text-xs font-bold ${adminArea === area.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
          >
            {area.label}
          </button>
        ))}
      </nav>
      <nav aria-label={`${ADMIN_AREAS.find(area => area.key === adminArea)?.label}目录`} className="sticky top-[106px] z-30 flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-1 scrollbar-none">
        {ADMIN_AREA_ITEMS[adminArea].map(item => {
          const mobileTab = getMobileTab(item.key);
          const isActive = selectedAdminTab === item.key;
          const badge = item.key === 'orders' ? pendingOrders.length
            : item.key === 'merchants' ? pendingMerchants.length
              : item.key === 'customers' ? pendingCustomers.length
                : item.key === 'products' ? pendingProducts.length
                  : item.key === 'vault_requests' ? vaultRequests.filter(request => request.status === 'pending').length
                  : item.key === 'inventory' ? lowStockSkuCount : 0;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (mobileTab) {
                  setAdminArea(getAdminAreaForTab(item.key));
                  setSelectedAdminTab(item.key);
                  setActiveTab(mobileTab);
                } else {
                  onSwitchToDesktop?.(item.key);
                }
              }}
              className={`flex shrink-0 items-center gap-2 px-3 py-2 text-[11px] font-semibold ${isActive ? 'border-b-2 border-neutral-950 text-neutral-950' : 'text-neutral-500'}`}
            >
              {item.label}
              {badge > 0 && <span className="rounded-full bg-neutral-200 px-1.5 text-[9px] text-neutral-700">{badge > 99 ? '99+' : badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Main Tab Content */}
      <div className="p-4 space-y-3">
        {activeTab === 'overview' && (
          <section className="grid grid-cols-2 gap-2">
            {[
              { label: '待处理订单', value: pendingOrders.length, tab: 'orders' as const },
              { label: '待审商家', value: pendingMerchants.length, tab: 'merchants' as const },
              { label: '待审客户', value: pendingCustomers.length, tab: 'customers' as const },
              { label: '待审商品', value: pendingProducts.length, tab: 'product_audit' as const }
            ].map(item => (
              <button key={item.label} type="button" onClick={() => setActiveTab(item.tab)} className="border border-neutral-200 bg-white p-3 text-left">
                <span className="block text-[11px] text-neutral-500">{item.label}</span>
                <span className="mt-1 block text-lg font-semibold tabular-nums text-neutral-950">{item.value}</span>
              </button>
            ))}
          </section>
        )}
        {activeTab === 'growth_workbench' && <AdminGrowthWorkbench onOpenTool={tool => setActiveTab(tool === 'acquisition' ? 'growth_acquisition' : tool === 'content' ? 'growth_content' : tool === 'fashion' ? 'fashion_content' : 'growth_analytics')} />}
        {activeTab === 'growth_acquisition' && <AdminGrowthAcquisition />}
        {activeTab === 'growth_content' && <AdminGrowthContent />}
        {activeTab === 'growth_analytics' && <AdminGrowthAnalytics />}
        {activeTab === 'ai_center' && <AdminAiControlCenter view="agents" />}
        {activeTab === 'ai_provider_settings' && <AdminAiControlCenter view="models" />}
        {activeTab === 'modagpt_operator' && <AdminModaGptOperator merchants={merchants.map(merchant => ({ id: merchant.id, name: merchant.name }))} />}
        {activeTab === 'fashion_content' && <AdminFashionContentHub />}
        {activeTab === 'merchant_support' && <AdminMerchantSupport />}
        {activeTab === 'support_requests' && <AdminSupportRequests />}
        {activeTab === 'database_center' && <AdminDatabaseCenter />}
        {activeTab === 'merchant_support_settings' && <AdminMerchantSupport mode="settings" />}
        {activeTab === 'modagpt_billing' && <AdminModaGptBilling />}
        {activeTab === 'feature_flags' && <AdminFeatureFlags />}
        {activeTab === 'app_store_mgmt' && <AdminAppStoreMgmt />}
        {activeTab === 'risk_monitor' && <AdminRiskMonitor />}
        {(activeTab === 'finance' || activeTab === 'audit_logs') && (
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-neutral-700">
              {activeTab === 'finance' ? '结算记录' : activeTab === 'audit_logs' ? '操作记录' : '通知记录'}
            </span>
            <button
              type="button"
              onClick={() => setAdvancedRefreshKey(current => current + 1)}
              className="inline-flex items-center gap-1 text-neutral-600"
              aria-label="刷新"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${advancedSectionLoading ? 'animate-spin' : ''}`} />
              {advancedSectionLoading ? '读取中' : '刷新'}
            </button>
          </div>
        )}
        {advancedSectionError && (activeTab === 'finance' || activeTab === 'audit_logs') && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-100 p-3 text-xs text-neutral-800">{advancedSectionError}</div>
        )}
        {activeTab === 'finance' && (
          <section className="space-y-2">
            <p className="rounded-lg border border-neutral-200 bg-white p-3 text-[11px] leading-5 text-neutral-600">仅记录人工结算，不会触发转账或核验到账。</p>
            {mobilePayouts.map(payout => (
              <article key={payout.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-neutral-900">{payout.merchantName}</div>
                    <div className="mt-1 text-[10px] text-neutral-500">{payout.period} · {new Date(payout.createdAt).toLocaleDateString(getIntlLocale(lang))}</div>
                  </div>
                  <span className="border border-neutral-300 bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-700">{payout.status === 'paid' ? (payout.settlementReference && payout.settlementProof ? '已登记人工结算' : '历史状态待核验') : payout.status === 'processing' ? '人工结算处理中' : payout.status === 'failed' ? '人工结算记录失败' : '待结算'}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded bg-neutral-50 p-2"><div className="text-neutral-500">销售额</div><div className="mt-1 font-bold">€{payout.grossSales.toFixed(2)}</div></div>
                  <div className="rounded bg-neutral-50 p-2"><div className="text-neutral-500">应结金额</div><div className="mt-1 font-bold text-neutral-900">€{payout.netPayout.toFixed(2)}</div></div>
                </div>
                {payout.status === 'paid' && payout.settlementReference && payout.settlementProof && <div className="mt-2 break-words border-t border-neutral-100 pt-2 text-[10px] text-neutral-600">参考号：{payout.settlementReference}<br />凭证：{payout.settlementProof}<br />{payout.settledBy || '—'} · {payout.settledAt ? new Date(payout.settledAt).toLocaleString(getIntlLocale(lang)) : '—'}</div>}
                {payout.status === 'paid' && (!payout.settlementReference || !payout.settlementProof) && <p className="mt-2 border-t border-neutral-100 pt-2 text-[10px] text-neutral-600">此历史记录没有人工结算凭证，请在桌面财务页核对。</p>}
              </article>
            ))}
            {!advancedSectionLoading && !advancedSectionError && mobilePayouts.length === 0 && <p className="rounded-xl bg-white p-4 text-center text-xs text-neutral-500">暂无结算记录</p>}
          </section>
        )}
        {activeTab === 'audit_logs' && (
          <section className="space-y-2">
            {mobileAuditLogs.slice(0, mobileAuditVisibleCount).map(log => (
              <article key={log.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-bold text-neutral-900">{log.action}</div>
                  <time className="shrink-0 text-[10px] text-neutral-500">{new Date(log.timestamp).toLocaleString(getIntlLocale(lang))}</time>
                </div>
                <div className="mt-1 text-[10px] text-neutral-600">{log.userName} · {log.role} · {log.entity}</div>
                <div className="mt-1 break-all font-mono text-[10px] text-neutral-500">{log.entityId || '—'}{log.ip ? ` · ${log.ip}` : ''}</div>
              </article>
            ))}
            {!advancedSectionLoading && !advancedSectionError && mobileAuditLogs.length === 0 && <p className="rounded-xl bg-white p-4 text-center text-xs text-neutral-500">暂无操作记录</p>}
            {mobileAuditVisibleCount < mobileAuditLogs.length && <button type="button" onClick={() => setMobileAuditVisibleCount(count => count + 30)} className="mx-auto flex h-9 items-center justify-center border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-800">加载更多</button>}
          </section>
        )}
        {activeTab === 'notifications' && (
          <AdminNotificationEvents />
        )}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Settings2 className="h-4 w-4" />系统配置</div>
              <p className="mt-2 text-xs leading-5 text-neutral-600">支付渠道与管理员安全等平台级配置统一在平台设置中心管理。移动页面不重复展示配置表单；敏感凭证只在服务端处理。</p>
              {onSwitchToDesktop && <button type="button" onClick={() => onSwitchToDesktop('settings')} className="mt-3 inline-flex h-9 items-center justify-center rounded-[6px] bg-neutral-900 px-3 text-xs font-semibold text-white">打开完整平台设置</button>}
            </section>
          </div>
        )}
        {activeTab === 'overview' && intelligence && (
          <section className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                <AlertTriangle className="w-3.5 h-3.5 text-neutral-800" /> 经营待办提醒
              </div>
              {intelligenceStale && <span className="text-[10px] text-neutral-500">数据延迟，显示上次结果</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="rounded-lg bg-neutral-200 p-2 text-center"><div className="text-[10px] text-neutral-900">严重</div><div className="font-bold text-neutral-900">{intelligence.summary.critical}</div></div>
              <div className="rounded-lg bg-neutral-100 p-2 text-center"><div className="text-[10px] text-neutral-700">预警</div><div className="font-bold text-neutral-700">{intelligence.summary.warning}</div></div>
              <div className="rounded-lg bg-neutral-50 p-2 text-center"><div className="text-[10px] text-neutral-600">待办</div><div className="font-bold text-neutral-600">{intelligence.summary.info}</div></div>
            </div>
            {intelligence.alerts.slice(0, 5).map(alert => (
              <button
                type="button"
                key={`${alert.type}-${alert.entityId || alert.message}`}
                onClick={() => {
                  setFocusedAlert(alert);
                  if (alert.type === 'low_stock' || alert.type === 'inventory_stockout') setActiveTab('inventory_alert');
                  else if (alert.type === 'customer_review') setActiveTab('customers');
                  else if (alert.type === 'merchant_review') setActiveTab('merchants');
                  else if (alert.type === 'order' || alert.type === 'refund' || alert.type === 'fulfillment' || alert.type === 'payment_failed') setActiveTab('orders');
                  else if (alert.type === 'payout' || alert.type === 'settlement_anomaly') setActiveTab('notifications');
                }}
                className="flex w-full items-center gap-2 py-1.5 border-t border-neutral-100 text-[11px] text-left hover:bg-neutral-50"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${alert.severity === 'critical' ? 'bg-neutral-950' : alert.severity === 'warning' ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
                <span className="text-neutral-700 truncate">{alert.message}</span>
                {alert.entityId && <span className="ml-auto shrink-0 text-[10px] text-neutral-400">处理</span>}
              </button>
            ))}
            {focusedAlert && (
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-neutral-900">已定位待办对象</span>
                  <button type="button" onClick={() => setFocusedAlert(null)} className="text-neutral-500">关闭</button>
                </div>
                <p className="mt-1 text-neutral-700">{focusedAlert.message}</p>
                {focusedAlert.entityId && <p className="mt-1 font-mono text-[10px] text-neutral-500">对象 ID: {focusedAlert.entityId}</p>}
                <p className="mt-1 text-neutral-500">已进入对应处理界面，请核对对象后使用现有审核/状态操作。</p>
              </div>
            )}
          </section>
        )}
        {/* 1. 订单 */}
        {activeTab === 'orders' && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="text-xs font-bold text-neutral-600">订单列表 · {orders.length}</div>
            {orders.map((o) => (
              <article key={o.id} className={`space-y-2 rounded-xl border bg-white p-3 shadow-2xs ${focusedAlert?.entityId === o.id ? 'border-neutral-950 ring-2 ring-neutral-200' : 'border-neutral-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-neutral-900">{o.orderNo}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                    {{ placed: '待处理', pending: '待处理', confirmed: '已确认', picking: '配货中', shipped: '已发货', delivered: '已签收', return_requested: '退货申请', returned: '已退货', cancelled: '已取消' }[o.status]}
                  </span>
                </div>
                <div className="text-xs text-neutral-600 flex justify-between">
                  <span>批发商: {o.companyName}</span>
                  <span className="font-bold text-neutral-900">€{o.totalAmount.toFixed(2)}</span>
                </div>
                {o.trackingNumber && <p className="text-[10px] text-neutral-500">物流单号：{o.trackingNumber}</p>}
                {nextMobileOrderStatus[o.status] && (
                  <button
                    type="button"
                    disabled={orderStatusSavingId === o.id}
                    onClick={async () => {
                      const nextStatus = nextMobileOrderStatus[o.status];
                      if (!nextStatus) return;
                      await updateMobileOrderStatus(o.id, nextStatus);
                    }}
                    className="min-h-9 w-full rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {orderStatusSavingId === o.id ? '正在更新…' : `推进至 ${nextMobileOrderStatus[o.status]}`}
                  </button>
                )}
                {o.refundStatus === 'requested' && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => approveReturn(o.id, o.refundAmount)} className="flex-1 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-lg cursor-pointer">批准退款</button>
                    <button onClick={() => rejectReturn(o.id)} className="flex-1 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-lg cursor-pointer">拒绝退货</button>
                  </div>
                )}
              </article>
            ))}
            {orders.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无订单</p>}
          </div>
        )}
        {activeTab === 'showrooms' && (
          <section className="space-y-2">
            <h1 className="text-base font-semibold text-neutral-950">展厅管理</h1>
            {showrooms.map(showroom => (
              <article key={showroom.id} className="border border-neutral-200 bg-white p-3">
                {showroom.image && <img src={showroom.image} alt="" className="mb-3 h-36 w-full object-cover" />}
                <h2 className="text-sm font-semibold text-neutral-900">{showroom.name}</h2>
                <p className="mt-1 text-xs text-neutral-600">{showroom.address}</p>
                <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  <span>{showroom.capacity}</span>
                  <span>{showroom.phone}</span>
                  <span>营业中</span>
                </div>
              </article>
            ))}
            {showrooms.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无展厅</p>}
          </section>
        )}

        {/* 2. 生产商审核 */}
        {activeTab === 'merchants' && <AdminMerchantCenter compact onEnterMerchant={async merchant => {
          const entered = await assumeMerchantFromAdmin(merchant.id);
          if (!entered) addNotification('warning', '进入商家后台失败', `无法进入 ${merchant.name}，请检查权限后重试`);
        }} />}
        {activeTab === 'merchants' && false && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="text-xs font-bold text-neutral-600">商家列表 · {merchants.length}</div>
            {merchants.map((m) => (
              <div key={m.id} className="bg-white rounded-xl p-3 border border-neutral-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-3">
                  <img src={m.logo} alt={m.name} className="w-10 h-10 rounded-lg object-cover bg-neutral-100" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-neutral-900 block truncate">{m.name}</span>
                    <span className="text-[11px] text-neutral-500 block">{m.city}, {m.country} · {m.showroomArea}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                    正常经营
                  </span>
                </div>
              </div>
            ))}
            {merchants.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无商家</p>}
          </div>
        )}

        {/* 3. 客户审核 */}
        {activeTab === 'customers' && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="text-xs font-bold text-neutral-600">零售商注册审批 ({customers.length})</div>
            {customers.map((c) => (
              <div key={c.id} className={`bg-white rounded-xl p-3 border shadow-2xs space-y-2 ${focusedAlert?.entityId === c.id ? 'border-neutral-950 ring-2 ring-neutral-200' : 'border-neutral-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-neutral-900">{c.companyName}</span>
                    <span className="text-[11px] text-neutral-500 block">税号: {c.vatNumber} ({c.country})</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    c.status === 'approved' ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-200 text-neutral-900'
                  }`}>
                    {c.status === 'approved' ? '已通过认证' : '待合规审核'}
                  </span>
                </div>

                {c.status === 'pending' && (
                  <div className="flex gap-2 pt-1 border-t border-neutral-100">
                    <button
                      onClick={() => reviewCustomer(c.id, 'approved', 'tier_vip')}
                      className="flex-1 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-lg"
                    >
                      通过审核并授信
                    </button>
                  </div>
                )}
              </div>
            ))}
            {customers.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无客户</p>}
          </div>
        )}

        {activeTab === 'vault_requests' && (
          <section className="space-y-2.5">
            {vaultRequests.map(request => (
              <article key={request.id} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs font-bold text-neutral-900">{request.companyName}</h2>
                    <p className="mt-1 text-[11px] text-neutral-600">{request.merchantName} · {request.contactPerson}</p>
                  </div>
                  <span className="shrink-0 rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-700">
                    {{ pending: '待审核', approved: '已通过', rejected: '已驳回' }[request.status]}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600">{request.businessType} · {request.phone}</p>
                {request.note && <p className="break-words border-t border-neutral-100 pt-2 text-[11px] text-neutral-600">{request.note}</p>}
                {request.status === 'pending' && (
                  <div className="flex gap-2 border-t border-neutral-100 pt-2">
                    <button
                      type="button"
                      disabled={vaultReviewSavingId === request.id}
                      onClick={() => void reviewMobileVaultRequest(request.id, 'approved')}
                      className="min-h-9 flex-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {vaultReviewSavingId === request.id ? '保存中…' : '通过授权'}
                    </button>
                    <button
                      type="button"
                      disabled={vaultReviewSavingId === request.id}
                      onClick={() => void reviewMobileVaultRequest(request.id, 'rejected')}
                      className="min-h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                    >
                      驳回申请
                    </button>
                  </div>
                )}
              </article>
            ))}
            {vaultRequests.length === 0 && <p className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无授权申请</p>}
          </section>
        )}

        {activeTab === 'pos' && (
          <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-bold text-neutral-900">展厅收银</h2>
            <p className="text-[11px] leading-5 text-neutral-600">登记现场销售并扣减总仓库存；不会自动收款或生成支付回执。</p>
            <label className="block text-xs font-semibold text-neutral-700">
              SKU
              <input
                list="mobile-pos-sku-options"
                value={posSku}
                onChange={event => setPosSku(event.target.value)}
                placeholder="扫码或输入 SKU"
                className="mt-1 min-h-10 w-full rounded-lg border border-neutral-300 px-3 font-mono text-xs"
              />
              <datalist id="mobile-pos-sku-options">
                {products.flatMap(product => product.skus.map(item => (
                  <option key={`${product.id}-${item.sku}`} value={item.sku}>{product.styleNo} · {item.color} / {item.size}</option>
                )))}
              </datalist>
            </label>
            <label className="block text-xs font-semibold text-neutral-700">
              销售数量
              <input
                type="number"
                min="1"
                step="1"
                value={posQuantity}
                onChange={event => setPosQuantity(Number(event.target.value))}
                className="mt-1 min-h-10 w-full rounded-lg border border-neutral-300 px-3 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={posSaving || !posSku.trim() || !Number.isInteger(posQuantity) || posQuantity <= 0}
              onClick={() => void submitMobilePosSale()}
              className="min-h-10 w-full rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {posSaving ? '正在登记…' : '确认销售出库'}
            </button>
            {posReceipt && <p role="status" className="break-all rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">出库凭证：{posReceipt}</p>}
            {posError && <p role="alert" className="break-words rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-[11px] text-neutral-800">{posError}</p>}
          </section>
        )}

        {/* 4. 新品审核 */}
        {activeTab === 'product_audit' && (
          <div className="space-y-2.5 animate-fadeIn">
            {productReviewError && <p role="alert" className="border border-neutral-300 bg-white p-3 text-xs text-neutral-800">{productReviewError}</p>}
            {pendingProducts.map((p) => (
              <article key={p.id} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <img src={p.images[0]} alt={p.name} className="h-12 w-12 rounded-lg bg-neutral-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-bold text-neutral-900">{p.styleNo}</span>
                    <span className="block truncate text-[11px] text-neutral-600">{p.name}</span>
                    <span className="text-[10px] font-semibold text-neutral-500">{p.brand}</span>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-neutral-100 pt-2">
                  <button
                    type="button"
                    disabled={productReviewSaving}
                    onClick={() => void reviewProduct(p.id, 'published')}
                    className="min-h-9 flex-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {productReviewSaving ? '保存中…' : '审核通过'}
                  </button>
                  <button
                    type="button"
                    disabled={productReviewSaving}
                    onClick={() => void reviewProduct(p.id, 'rejected')}
                    className="min-h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                  >
                    驳回
                  </button>
                </div>
              </article>
            ))}
            {pendingProducts.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无待审核商品</p>}
          </div>
        )}

        {/* 5. 库存预警 */}
        {activeTab === 'inventory_alert' && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-3 text-xs text-neutral-900">
              <span className="font-bold block">现货库存断码预警雷达</span>
              <span className="text-[11px] text-neutral-700">以下 {lowStockSkuCount} 个 SKU 总可用库存已低于安全线 (15件)。</span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-neutral-200 shadow-2xs space-y-2">
              {products.flatMap(product => product.skus
                .filter(sku => (sku.stockCentral - (sku.reserved || 0)) < 15)
                .slice(0, 10)
                .map(sku => (
                  <div key={sku.sku} className={`flex justify-between text-xs font-bold ${focusedAlert?.entityId === product.id ? 'rounded bg-neutral-100 px-1' : ''}`}>
                    <span>{product.styleNo} · {sku.sku}</span>
                    <span className="text-neutral-700">可售 {Math.max(0, sku.stockCentral - (sku.reserved || 0))} 件</span>
                  </div>
                )))}
              {lowStockSkuCount === 0 && <p className="text-xs text-neutral-600">当前没有低库存 SKU。</p>}
            </div>
          </div>
        )}

        {/* 6. 预约 */}
        {activeTab === 'appointments' && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="text-xs font-bold text-neutral-600">展厅到店看货预约</div>
            {appointments.map((a) => (
              <article key={a.id} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs">
                <div className="flex justify-between text-xs font-bold">
                  <span>{a.companyName}</span>
                  <span className="text-neutral-500">{a.date} {a.timeSlot ?? a.time}</span>
                </div>
                <div className="text-[11px] text-neutral-600">预约展厅: {a.showroomName} ({a.visitorCount}人)</div>
                <span className="inline-flex rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-700">{{ pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消', no_show: '爽约' }[a.status]}</span>
                {(a.status === 'pending' || a.status === 'confirmed') && (
                  <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-2">
                    {a.status === 'pending' && (
                      <button
                        type="button"
                        disabled={appointmentStatusSavingId === a.id}
                        onClick={() => void updateMobileAppointmentStatus(a.id, 'confirmed')}
                        className="min-h-9 flex-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        确认接待
                      </button>
                    )}
                    {a.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          disabled={appointmentStatusSavingId === a.id}
                          onClick={() => void updateMobileAppointmentStatus(a.id, 'completed')}
                          className="min-h-9 flex-1 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          标记完成
                        </button>
                        <button
                          type="button"
                          disabled={appointmentStatusSavingId === a.id}
                          onClick={() => void updateMobileAppointmentStatus(a.id, 'no_show')}
                          className="min-h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                        >
                          标记爽约
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={appointmentStatusSavingId === a.id}
                      onClick={() => void updateMobileAppointmentStatus(a.id, 'cancelled')}
                      className="min-h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                )}
              </article>
            ))}
            {appointments.length === 0 && <p className="border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">暂无预约</p>}
          </div>
        )}

      </div>
    </div>
  );
};

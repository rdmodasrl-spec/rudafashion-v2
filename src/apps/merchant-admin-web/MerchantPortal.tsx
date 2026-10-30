import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createModaCoreLife } from '../merchant-admin-common/components/merchant/modaui/modaCoreLife';
import { ModaCoreAnchor, ModaCoreStageProvider } from '../merchant-admin-common/components/merchant/modaui/ModaCoreStage';
import AssistantReplyActions from '../merchant-admin-common/components/merchant/AssistantReplyActions';
import { assistantReplyFrameInterval, buildAssistantReplyFrames } from '../../shared/assistantReplyReveal';

import { 
  Building2, 
  Package, 
  ShoppingBag, 
  Truck, 
  Layers, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Search, 
  Plus, 
  Home,
  ArrowRight,
  ArrowRightLeft, 
  Clock, 
  UserCheck, 
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Barcode,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  Globe,
  SlidersHorizontal,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  Maximize2,
  Minimize2,
  Send,
  X,
  Boxes,
  ClipboardCheck,
  Receipt,
  FolderOpen,
  MessageCircle,
  Pencil,
  Trash2,
  ImagePlus,
  Bell,
  Store,
  BarChart3,
  UserRound,
  Grid2X2,
  List,
  Menu,
  MoreHorizontal,
  BookOpen,
  FileText,
  ShoppingCart,
  Bot
} from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { useModuleAvailability } from '../shared/moduleAvailability';
import { PasswordChangeForm } from '../shared/components/auth/PasswordChangeForm';
import { LanguagePicker } from '../shared/components/common/LanguagePicker';
import { OrderProgressSummary } from '../shared/components/common/OrderProgressSummary';
import { OrderChatPanel } from '../shared/components/common/OrderChatPanel';
import { LANGUAGE_OPTIONS, getIntlLocale } from '../../i18n/translations';
import { PasswordInput } from '../shared/components/common/PasswordInput';
import { Product, SKUItem, Order, OrderAgreementTerms, VaultAccessRequest, StockTransferRecord } from '../../types/b2b';
import { merchantStorefrontOrigin } from '../../shared/merchantStoreUrl';
import { PaymentSettingsCard } from '../shared/components/common/PaymentSettingsCard';
import { ShareButton } from '../shared/components/common/ShareButton';
import { getProductZone, getProductZoneUpdates } from '../../utils/productZone';
import { PRODUCT_CATEGORIES, getProductCategoryLabel } from '../../constants/productCategories';
import { SmartMediaUploader } from '../merchant-admin-common/components/merchant/SmartMediaUploader';
import { MerchantProductCreateForm } from '../merchant-admin-common/components/merchant/MerchantProductCreateForm';
import { MerchantGallery } from '../merchant-admin-common/components/merchant/MerchantGallery';
import {
  MerchantSettingsCard,
  MerchantSettingsFacts,
  MerchantSettingsNote,
  MerchantSettingsScopeList,
  MerchantSettingsSummary,
  merchantSettingsPrimaryButtonClass,
  merchantSettingsSecondaryButtonClass,
  type MerchantSettingsFact,
  type MerchantSettingsScopeItem,
  type MerchantSettingsTone
} from '../merchant-admin-common/components/merchant/MerchantSettingsPanel';
import { MerchantAiEmployees } from '../merchant-admin-common/components/merchant/MerchantAiEmployees';
import { MerchantAiTools } from '../merchant-admin-common/components/merchant/MerchantAiTools';
import { MerchantTeamManagement } from '../merchant-admin-common/components/merchant/MerchantTeamManagement';
import { MERCHANT_STOREFRONT_TEMPLATES } from '../../shared/merchantStorefrontTemplate';
import { MerchantAiReports } from '../merchant-admin-common/components/merchant/MerchantAiReports';
import { MerchantAiOrderDrafts } from '../merchant-admin-common/components/merchant/MerchantAiOrderDrafts';
import { MerchantBusinessCard } from '../merchant-admin-common/components/merchant/MerchantBusinessCard';
import type { GrowthSection } from '../merchant-admin-common/components/merchant/MerchantGrowthWorkspace';
import type { ContentKind } from '../merchant-admin-common/components/merchant/MerchantContentWorkspace';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../api/client';
import { DEFAULT_MERCHANT_BANNER, DEFAULT_MERCHANT_LOGO, merchantMediaUrl } from '../../utils/merchantMedia';
import { parseCsvRecords } from '../../utils/csv';
import { getProductWholesalePriceForQuantity } from '../../shared/productPricing';
import {
  buildMerchantProduct,
  createMerchantProductDraft,
  normalizeMerchantProductDefaultMoq,
  validateMerchantProductDraft,
  type MerchantProductDraft
} from '../../shared/merchantProductCreation';
import { createMerchantProductFormPageContext, type MerchantCopilotPageContext } from '../../shared/merchantCopilotContext';
import { navigateToAppTarget } from '../shared/navigateToAppTarget';
import type { ModaCoreVisualState } from '../merchant-admin-common/components/merchant/modaui/modaCoreEngine';
import type { MerchantIndustryModuleKey } from '../../constants/merchantIndustryCapabilities';
import type { IndustryWorkspaceModuleProps } from '../merchant-admin-industries/shared/IndustryWorkspaceShell';
import {
  merchantPortalIndustrySectionByTab,
  merchantPortalTabByIndustrySection,
  shouldRenderIndustryWorkspaceForTab
} from '../merchant-admin-industries/shared/legacyNavigation';

const MerchantGrowthWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantGrowthWorkspace').then(module => ({ default: module.MerchantGrowthWorkspace }))
);
const MerchantContentWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantContentWorkspace').then(module => ({ default: module.MerchantContentWorkspace }))
);
const MerchantProcurementWorkspace = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantProcurementWorkspace').then(module => ({ default: module.MerchantProcurementWorkspace }))
);
const MerchantSmartPos = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantSmartPos').then(module => ({ default: module.MerchantSmartPos }))
);
const ModaUIWorkbench = lazy(() =>
  import('../merchant-admin-common/components/merchant/modaui/ModaUIWorkbench').then(module => ({ default: module.ModaUIWorkbench }))
);
const MerchantAppStore = lazy(() =>
  import('../merchant-admin-common/components/merchant/AppStore').then(module => ({ default: module.AppStore }))
);
const MerchantRecycleBin = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantRecycleBin').then(module => ({ default: module.MerchantRecycleBin }))
);
const MerchantAiChatHistory = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantAiChatHistory').then(module => ({ default: module.MerchantAiChatHistory }))
);
const MerchantActivityFeed = lazy(() =>
  import('../merchant-admin-common/components/merchant/MerchantActivityFeed').then(module => ({ default: module.MerchantActivityFeed }))
);
const MerchantEmailDomains = lazy(() =>
  import('../merchant-admin-common/components/merchant/EmailApp').then(module => ({ default: module.EmailApp }))
);
const MerchantProductionChain = lazy(() =>
  import('../merchant-admin-common/components/merchant/ProductionChain').then(module => ({ default: module.ProductionChain }))
);

type MerchantSettingsEntryId =
  | 'general' | 'plan' | 'billing' | 'users' | 'roles' | 'security' | 'payments'
  | 'checkout' | 'customer-accounts' | 'shipping' | 'taxes' | 'locations' | 'apps'
  | 'sales-channels' | 'domains' | 'customer-events' | 'notifications' | 'custom-data'
  | 'languages' | 'privacy' | 'policies';

type MerchantSettingsNotice = { title: string; body: string; distinction?: string };
type MerchantPaymentStatus = {
  provider: 'manual' | 'stripe' | 'adyen' | 'custom';
  enabled: boolean;
  credentialsConfigured: boolean;
  supportsPayments: boolean;
  supportsRefunds: boolean;
  mode: 'placeholder' | 'configured';
  onlineCheckoutEnabled: boolean;
};
type MerchantPayPalStatus = {
  configured: boolean;
  enabled: boolean;
  environment: 'sandbox' | 'live' | null;
  clientIdHint: string | null;
};
type MerchantStripeStatus = {
  configured: boolean;
  enabled: boolean;
  accountId: string | null;
  livemode: boolean | null;
};
type MerchantSolanaStatus = {
  configured: boolean;
  enabled: boolean;
  walletAddress: string | null;
};

const LazyPrivySolanaWalletButton = lazy(() => import('../merchant-admin-common/components/merchant/PrivySolanaWalletButton'));

const MerchantWorkspaceHeader: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, action }) => (
  <header className="merchant-home-intro flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-3">
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-neutral-950">{title}</h1>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

export const MerchantPortal: React.FC<{
  industryWorkspace?: React.ElementType<IndustryWorkspaceModuleProps>;
}> = ({ industryWorkspace: IndustryWorkspace }) => {
  const { 
    merchants,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    vaultRequests,
    allCustomers,
    transfers = [],
    payouts = [],
    addNotification,
    updateMerchant,
    setCurrentView,
    authMerchantId,
    lang,
    languagePreference,
    t, localizeCopy
  } = useB2B();
  // 平台全局 ModaUI 总闸：关闭时隐藏「创作空间」入口并显示统一提示。
  const { modauiEnabled } = useModuleAvailability();

  const isIt = lang === 'it';
  // 电脑端侧栏与窄屏水平导航统一使用黑白/中性灰：白底、选中浅灰，不引入彩色高亮。
  const navItemClass = (active: boolean) => `inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold tracking-wide transition-all cursor-pointer ${
    active
      ? 'bg-neutral-100 text-neutral-950'
      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950'
  }`;
  const settingsSubItemClass = (active: boolean) => `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold transition ${active ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950'}`;

  // Active sub-tab inside Merchant Portal
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'pos' | 'products' | 'sku_matrix' | 'materials' | 'production' | 'inventory' | 'procurement' | 'orders' | 'vault_requests' | 'customers' | 'growth' | 'content' | 'finance' | 'profile' | 'settings' | 'gallery' | 'ai_employees' | 'ai_tools' | 'fashion_studio' | 'modagpt' | 'app_store' | 'recycle_bin' | 'ai_chat_history' | 'recent_activity'
  >('dashboard');
  const [industrySection, setIndustrySection] = useState<MerchantIndustryModuleKey>('dashboard');
  const pendingIndustrySectionRef = useRef<MerchantIndustryModuleKey | null>(null);
  const industryPanelActive = Boolean(
    IndustryWorkspace && shouldRenderIndustryWorkspaceForTab(activeTab, industrySection, merchantPortalIndustrySectionByTab)
  );
  useEffect(() => {
    if (!IndustryWorkspace) return;
    const pendingSection = pendingIndustrySectionRef.current;
    if (pendingSection) {
      pendingIndustrySectionRef.current = null;
      setIndustrySection(pendingSection);
      return;
    }
    const section = merchantPortalIndustrySectionByTab[activeTab];
    if (section) setIndustrySection(section);
  }, [activeTab, IndustryWorkspace]);
  const navigateIndustrySection = (section: MerchantIndustryModuleKey) => {
    const targetTab = merchantPortalTabByIndustrySection[section];
    setIndustrySection(section);
    if (targetTab === activeTab) {
      pendingIndustrySectionRef.current = null;
      return;
    }
    pendingIndustrySectionRef.current = section;
    setActiveTab(targetTab);
  };
  const [fashionStudioInitialMode, setFashionStudioInitialMode] = useState<'design' | 'tryon' | 'productLaunch' | 'edit' | null>(null);
  const [dashboardNavSection, setDashboardNavSection] = useState<'home' | 'analytics'>('home');
  const [growthSection, setGrowthSection] = useState<GrowthSection>('overview');
  const [contentSection, setContentSection] = useState<ContentKind>('metaobject');
  const [assistantUsesPageContext, setAssistantUsesPageContext] = useState(true);
  const [sidebarNavExpanded, setSidebarNavExpanded] = useState<'dashboard' | 'orders' | 'products' | 'supply' | 'customers' | 'growth' | 'store' | 'apps' | 'settings' | null>(null);
  const [moreNavExpanded, setMoreNavExpanded] = useState(false);
  const [settingsSubsection, setSettingsSubsection] = useState<'general' | 'rules' | 'payments' | 'notifications' | 'mobile' | 'team' | 'roles' | 'language' | 'info'>('general');
  const [activeSettingsEntry, setActiveSettingsEntry] = useState<MerchantSettingsEntryId>('general');
  const [activeStoreAppId, setActiveStoreAppId] = useState<string | null>(null);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsNotice, setSettingsNotice] = useState<MerchantSettingsNotice | null>(null);
  const [merchantPaymentStatus, setMerchantPaymentStatus] = useState<MerchantPaymentStatus | null>(null);
  const [merchantPaymentStatusLoading, setMerchantPaymentStatusLoading] = useState(false);
  const [merchantPaymentStatusError, setMerchantPaymentStatusError] = useState('');
  const [merchantPaymentStatusRefresh, setMerchantPaymentStatusRefresh] = useState(0);
  const [merchantPayPalStatus, setMerchantPayPalStatus] = useState<MerchantPayPalStatus | null>(null);
  const [paypalCredentialsForm, setPaypalCredentialsForm] = useState({ clientId: '', clientSecret: '', environment: 'sandbox' as 'sandbox' | 'live' });
  const [paypalCredentialsBusy, setPaypalCredentialsBusy] = useState(false);
  const [merchantStripeStatus, setMerchantStripeStatus] = useState<MerchantStripeStatus | null>(null);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeCredentialsBusy, setStripeCredentialsBusy] = useState(false);
  const [merchantSolanaStatus, setMerchantSolanaStatus] = useState<MerchantSolanaStatus | null>(null);
  const [solanaWalletAddress, setSolanaWalletAddress] = useState('');
  const [solanaConfigBusy, setSolanaConfigBusy] = useState(false);
  const openSidebarNav = (section: NonNullable<typeof sidebarNavExpanded>) => setSidebarNavExpanded(section);
  const toggleSidebarNav = (section: NonNullable<typeof sidebarNavExpanded>) => setSidebarNavExpanded(current => current === section ? null : section);
  const productNavIsExpanded = sidebarNavExpanded === 'products';
  const supplyNavIsExpanded = sidebarNavExpanded === 'supply';
  const orderNavIsExpanded = sidebarNavExpanded === 'orders';
  const customerNavIsExpanded = sidebarNavExpanded === 'customers';
  const growthNavIsExpanded = sidebarNavExpanded === 'growth';
  const storeNavIsExpanded = sidebarNavExpanded === 'store';
  const appsNavIsExpanded = sidebarNavExpanded === 'apps';
  const dashboardNavIsExpanded = sidebarNavExpanded === 'dashboard';
  const moreNavIsExpanded = moreNavExpanded;
  const appsNavIsActive = ['app_store', 'recycle_bin'].includes(activeTab);
  const productNavIsActive = ['products', 'sku_matrix'].includes(activeTab);
  const supplyNavIsActive = ['inventory', 'production', 'materials', 'procurement'].includes(activeTab);
  const customerNavIsActive = activeTab === 'customers' || activeTab === 'vault_requests';
  const storeNavIsActive = ['content', 'gallery', 'profile'].includes(activeTab);
  const [orderView, setOrderView] = useState<'orders' | 'drafts'>('orders');
  const [productWorkspaceSection, setProductWorkspaceSection] = useState<'catalog' | 'categories'>('catalog');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  useEffect(() => {
    if (['products', 'sku_matrix'].includes(activeTab)) openSidebarNav('products');
    else if (['inventory', 'production', 'materials', 'procurement'].includes(activeTab)) openSidebarNav('supply');
    else if (activeTab === 'pos') openSidebarNav('orders');
    else if (activeTab === 'vault_requests') openSidebarNav('customers');
    else if (activeTab === 'growth') openSidebarNav('growth');
    else if (['gallery', 'profile', 'content'].includes(activeTab)) openSidebarNav('store');
    else if (['app_store', 'recycle_bin'].includes(activeTab)) openSidebarNav('apps');
    else if (activeTab === 'settings') setSidebarNavExpanded(null);
    else if (activeTab === 'dashboard' && dashboardNavSection === 'analytics') openSidebarNav('dashboard');
    if (['sku_matrix', 'inventory', 'production', 'materials', 'procurement', 'vault_requests', 'content', 'gallery', 'ai_employees', 'settings', 'profile', 'recycle_bin', 'ai_chat_history', 'recent_activity'].includes(activeTab)
      || (activeTab === 'dashboard' && dashboardNavSection === 'analytics')) setMoreNavExpanded(true);
  }, [activeTab, dashboardNavSection, growthSection]);
  const industryAssistantLabels: Readonly<Record<MerchantIndustryModuleKey, string>> = {
    dashboard: '经营主页',
    products: '商品管理',
    inventory: '库存管理',
    orders: '订单履约',
    customers: '客户管理',
    suppliers: '供应商管理',
    procurement: '采购管理',
    pos: '收银',
    pos_sales: '销售记录',
    pos_shifts: '班次管理',
    stores: '门店管理',
    transfers: '库存调拨',
    team: '员工权限',
    messages: '消息中心',
    settings: '系统设置'
  };
  const assistantContextLabel = industryPanelActive
    ? industryAssistantLabels[industrySection]
    : activeTab === 'dashboard'
    ? dashboardNavSection === 'analytics' ? (localizeCopy('经营分析', 'Analisi')) : (localizeCopy('经营主页', 'Home'))
    : ({
      products: isAddingProduct
        ? localizeCopy('商品创建', 'Creazione prodotto')
        : productWorkspaceSection === 'categories' ? localizeCopy('店铺分类', 'Categorie negozio') : localizeCopy('商品管理', 'Prodotti'),
      pos: localizeCopy('智能收银', 'POS intelligente'),
      sku_matrix: localizeCopy('规格管理', 'Varianti SKU'),
      materials: localizeCopy('物料库存', 'Materiali'),
      procurement: localizeCopy('成衣采购', 'Acquisti'),
      production: localizeCopy('生产管理', 'Produzione'),
      inventory: localizeCopy('库存管理', 'Scorte'),
      orders: localizeCopy('订单履约', 'Ordini'),
      vault_requests: localizeCopy('商品授权', 'Richieste private'),
      customers: localizeCopy('客户管理', 'Clienti'),
      growth: localizeCopy('营销增长', 'Crescita'),
      content: localizeCopy('内容管理', 'Contenuti'),
      finance: localizeCopy('财务结算', 'Finanza'),
      profile: localizeCopy('店铺设置', 'Vetrina'),
      settings: localizeCopy('系统设置', 'Impostazioni'),
      gallery: localizeCopy('内容素材', 'Contenuti media'),
      ai_employees: localizeCopy('智能员工', 'Team AI'),
      ai_tools: localizeCopy('工具中心', 'Centro strumenti'),
      app_store: localizeCopy('应用', 'App'),
      recycle_bin: localizeCopy('回收站', 'Cestino'),
      ai_chat_history: localizeCopy('AI 聊天记录', 'Cronologia AI'),
      recent_activity: localizeCopy('最近动态', 'Attività recenti'),
      fashion_studio: localizeCopy('创作空间', 'ModaUI Fashion Studio'),
      modagpt: localizeCopy('创作空间', 'ModaUI Fashion Studio')
    } as const)[activeTab];
  const assistantContextScope = industryPanelActive
    ? industrySection
    : activeTab === 'dashboard'
    ? dashboardNavSection
    : activeTab === 'content'
      ? contentSection
      : activeTab === 'products'
        ? isAddingProduct ? 'create' : productWorkspaceSection
    : activeTab === 'growth'
      ? growthSection
      : activeTab === 'orders'
          ? orderView
          : 'overview';
  const assistantScopeLabel = industryPanelActive
    ? industryAssistantLabels[industrySection]
    : activeTab === 'content'
    ? ({ metaobject: '元对象', page: '页面', blog: '博客', menu: '菜单' } as const)[contentSection]
    : activeTab === 'products'
      ? isAddingProduct ? '商品创建' : productWorkspaceSection === 'categories' ? '店铺分类' : '商品目录'
    : activeTab === 'growth'
      ? ({ overview: '增长概览', autopilot: 'Autopilot', campaigns: '宣传活动' } as const)[growthSection]
      : activeTab === 'orders'
        ? orderView === 'drafts' ? '草稿订单' : '订单列表'
        : activeTab === 'dashboard' && dashboardNavSection === 'analytics' ? '经营分析' : '';
  const assistantRequestContext = assistantUsesPageContext && industryPanelActive
    ? ({
      dashboard: 'dashboard',
      products: 'products',
      inventory: 'inventory',
      orders: 'orders',
      customers: 'customers',
      suppliers: 'materials',
      procurement: 'materials',
      pos: 'orders',
      pos_sales: 'orders',
      pos_shifts: 'orders',
      stores: 'inventory',
      transfers: 'inventory',
      team: 'settings',
      messages: 'dashboard',
      settings: 'settings'
    } as const)[industrySection]
    : assistantUsesPageContext
    ? activeTab === 'dashboard'
      ? dashboardNavSection === 'analytics' ? 'analytics' : 'dashboard'
      : activeTab === 'ai_employees'
        ? 'dashboard'
      : activeTab === 'procurement'
        ? 'materials'
        : activeTab === 'pos'
          ? 'orders'
        : ['app_store', 'recycle_bin', 'ai_chat_history', 'recent_activity'].includes(activeTab)
          ? 'dashboard'
        : activeTab
    : 'dashboard';
  const assistantRequestScope = assistantUsesPageContext ? assistantContextScope : 'overview';
  const assistantContextKey = `${assistantRequestContext}:${assistantRequestScope}`;
  const defaultAssistantSuggestions = isIt
    ? activeTab === 'pos'
      ? ['Scansiona un codice a barre e prepara una vendita', 'Trova articoli disponibili in magazzino', 'Controlla sconti e plafond del cliente']
      : activeTab === 'orders'
      ? ['Quali ordini sono ancora da evadere?', 'Riassumi pagamenti e spedizioni in sospeso', 'Prepara una bozza di risposta per un reso']
      : activeTab === 'inventory'
        ? ['Quali SKU sono sotto scorta?', 'Quali articoli sono fermi da più tempo?', 'Suggerisci quantità di riordino da verificare']
        : activeTab === 'finance'
          ? ['Riassumi i saldi e i payout recenti', 'Quali payout sono in attesa?', 'Quali dati mancano per verificare il conto?']
          : activeTab === 'customers'
            ? ['Chi sono i clienti più importanti?', 'Quali clienti abituali non ordinano da 60 giorni?', 'Prepara un messaggio per i clienti inattivi']
            : activeTab === 'growth'
              ? ['Analizza le vendite degli ultimi 30 giorni', 'Suggerisci tattiche di crescita basate sui miei prodotti', 'Scrivi una bozza per i nuovi arrivi']
              : activeTab === 'content'
                ? ['Progetta i campi per una scheda materiale', 'Prepara una bozza per la pagina Chi siamo', 'Suggerisci una struttura di menu per il negozio']
                : activeTab === 'products' && isAddingProduct
                  ? ['Quali dati devo verificare prima di pubblicare un prodotto?', 'Quali colori, taglie e SKU dovrei configurare?', 'Prepara una bozza di descrizione usando solo i dati che ti fornisco']
                  : activeTab === 'products' && productWorkspaceSection === 'categories'
                  ? ['Elenca le collezioni e il numero di prodotti', 'Trova le collezioni vuote', 'Quali prodotti non sono assegnati a una collezione?']
                  : activeTab === 'products'
                    ? ['Cerca un prodotto per codice', 'Quali prodotti hanno dati incompleti?', 'Prepara una descrizione prodotto da verificare']
                  : activeTab === 'sku_matrix'
                    ? ['Come strutturare colori e taglie?', 'Controlla il formato degli SKU', 'Quali campi includere in una variante?']
                    : activeTab === 'production'
                      ? ['Quali ordini di produzione sono aperti?', 'Riassumi la produzione in corso', 'Spiegami come registrare un controllo qualità']
                      : activeTab === 'materials'
                        ? ['Quali materiali sono sotto la scorta minima?', 'Prepara una lista di materiali da riordinare', 'Spiegami i movimenti di magazzino materiali']
                        : activeTab === 'vault_requests'
                          ? ['Quali richieste di accesso attendono revisione?', 'Riassumi i criteri di una revisione sicura', 'Prepara una risposta per un acquirente']
                          : activeTab === 'profile'
                            ? ['Migliora la presentazione del negozio', 'Prepara una descrizione breve del brand', 'Quali informazioni mancano nella vetrina?']
                            : activeTab === 'settings'
                              ? ['Dove gestisco regole e notifiche?', 'Quali impostazioni sono solo per la vista mobile?', 'Spiega i ruoli e i permessi del team']
                              : ['Riassumi l’andamento recente del negozio', 'Quali sono le priorità operative?', 'Quali dati posso analizzare qui?']
    : activeTab === 'pos'
      ? ['扫描商品条码并快速开单', '按在售库存寻找可售商品', '查看客户折扣和账期额度']
      : activeTab === 'orders'
      ? ['列出待处理和待发货订单', '总结未付款订单与履约状态', '为退货申请准备一份回复草稿']
      : activeTab === 'inventory'
        ? ['哪些 SKU 库存偏低？', '哪些商品近期滞销？', '按近期销量给出待确认的补货建议']
        : activeTab === 'finance'
          ? ['总结近期结算和销售款', '有哪些结算款待处理？', '收款账户审核还缺什么？']
          : activeTab === 'customers'
            ? ['本店消费最高的客户是谁？', '找出 60 天没回购的老客户', '为沉睡客户准备一封回访草稿']
            : activeTab === 'growth'
              ? ['分析近 30 天本店营收', '根据热销商品准备增长战术', '为新品写一份营销文案草稿']
              : activeTab === 'content'
                ? ['为材质说明设计元对象字段', '起草一页关于我们页面', '规划店铺顶部菜单和页脚链接']
                : activeTab === 'products' && isAddingProduct
                  ? ['发布商品前需要核对哪些资料？', '颜色、尺码和 SKU 应该如何配置？', '根据我提供的资料准备商品描述草稿']
                  : activeTab === 'products' && productWorkspaceSection === 'categories'
                  ? ['列出店铺分类和商品数', '找出空分类或未归类商品', '检查分类中的商品资料']
                  : activeTab === 'products'
                    ? ['按款号或 SKU 查询商品', '哪些商品资料或图片不完整？', '为商品准备一段待审核的描述草稿']
                  : activeTab === 'sku_matrix'
                    ? ['颜色和尺码应该如何拆分 SKU？', '检查某款 SKU 规格完整性', '条码和 SKU 的区别是什么？']
                    : activeTab === 'production'
                      ? ['有哪些未完成的生产工单？', '总结当前生产进度和异常', '生产报产后库存如何变化？']
                      : activeTab === 'materials'
                        ? ['哪些面辅料低于安全库存？', '生成一份待确认的补料清单', '解释这批物料库存流水']
                        : activeTab === 'vault_requests'
                          ? ['有哪些授权申请待审核？', '审核授权申请时要核对什么？', '为买手准备一份授权结果通知']
                          : activeTab === 'profile'
                            ? ['帮我润色店铺品牌介绍', '为店铺写一个简短标语', '检查店铺展示信息完整性']
                            : activeTab === 'settings'
                              ? ['员工权限在哪里管理？', '订单和授权通知在哪里设置？', '哪些设置会影响手机端首页？']
                              : activeTab === 'gallery'
                                ? ['为这组商品图片写简短说明', '制定品牌素材分类标签', '写一份素材使用说明草稿']
                                : ['总结近期经营表现', '今天有哪些待处理事项？', '我可以让 AI 帮忙完成哪些工作？'];
  const assistantSuggestions = isIt
    ? activeTab === 'orders' && orderView === 'drafts'
      ? ['Rivedi i preventivi in bozza e dimmi quali dati mancano', 'Prepara una risposta per inviare un preventivo', 'Quali controlli fare prima di condividere una bozza?']
      : activeTab === 'growth' && growthSection === 'autopilot'
        ? ['Prepara una tattica email da approvare, senza inviarla', 'Quali dati dovrei controllare prima di approvare una campagna?', 'Scrivi un oggetto e un testo per il pubblico scelto']
        : activeTab === 'growth' && growthSection === 'campaigns'
          ? ['Prepara tre varianti di testo per la campagna', 'Adatta questo messaggio a un pubblico B2B', 'Crea una checklist per verificare una campagna']
          : activeTab === 'content' && contentSection === 'metaobject'
            ? ['Progetta i campi per scheda materiale e istruzioni di cura', 'Quali campi dovrebbero essere obbligatori?', 'Crea un esempio di voce con dati da completare']
            : activeTab === 'content' && contentSection === 'page'
              ? ['Scrivi una pagina Chi siamo senza inventare la storia del brand', 'Prepara una FAQ con i fatti che devo confermare', 'Ottimizza titolo e descrizione SEO della pagina']
              : activeTab === 'content' && contentSection === 'blog'
                ? ['Crea una scaletta per un articolo di moda B2B', 'Prepara una bozza articolo usando solo i fatti forniti', 'Suggerisci titolo, sommario e meta description']
                : activeTab === 'content' && contentSection === 'menu'
                  ? ['Progetta un menu per negozio e footer', 'Organizza queste categorie in una gerarchia chiara', 'Rivedi le etichette del menu per chiarezza']
                  : defaultAssistantSuggestions
    : activeTab === 'orders' && orderView === 'drafts'
      ? ['检查草稿报价中缺少哪些信息', '为客户准备一段发送报价时的说明', '分享草稿前需要核对哪些项目？']
      : activeTab === 'growth' && growthSection === 'autopilot'
        ? ['准备一条待审批的邮件营销战术，不要发送', '批准营销活动前应该先核对什么？', '为指定受众写邮件标题和正文草稿']
        : activeTab === 'growth' && growthSection === 'campaigns'
          ? ['为这次活动准备三种文案方向', '把这段文案改成适合 B2B 买手的版本', '为活动生成上线前检查清单']
          : activeTab === 'content' && contentSection === 'metaobject'
            ? ['为材质与护理说明设计字段结构', '哪些字段应该设置为必填？', '生成一条带待补充项的示例条目']
            : activeTab === 'content' && contentSection === 'page'
              ? ['写一页关于我们，但不要编造品牌历史', '根据已确认信息起草常见问题页面', '为当前页面生成 SEO 标题与描述']
              : activeTab === 'content' && contentSection === 'blog'
                ? ['生成一篇时尚 B2B 文章大纲', '仅用我提供的事实起草文章', '生成文章标题、摘要和 SEO 描述']
                : activeTab === 'content' && contentSection === 'menu'
                  ? ['规划店铺主导航和页脚菜单', '把这些商品分类整理成清晰层级', '检查菜单名称是否容易理解']
                  : defaultAssistantSuggestions;
  const assistantInputPlaceholder = isIt
    ? `Scrivi cosa vuoi fare in ${assistantContextLabel.toLocaleLowerCase()}…`
    : activeTab === 'products' && isAddingProduct
      ? '告诉我想检查或完善这份商品草稿的哪一部分…'
      : activeTab === 'products' && productWorkspaceSection === 'categories'
      ? '告诉我想查哪个分类或商品…'
      : activeTab === 'products'
        ? '告诉我想查找、筛选或完善哪款商品…'
        : activeTab === 'orders'
          ? '告诉我想查找或处理什么订单…'
          : activeTab === 'customers'
            ? '告诉我想查询、筛选或跟进哪类客户…'
            : `告诉我在「${assistantContextLabel}」版块想完成什么…`;
  const [operationsIntelligence, setOperationsIntelligence] = useState<{
    summary: {
      gmv30d: number;
      orders30d: number;
      pendingFulfillment: number;
      pendingReturns: number;
      pendingTransfers: number;
      lowStockSkus: number;
      slowMoverSkus?: number;
      recentGmv?: number;
      previousGmv?: number;
      gmvTrend?: number;
    };
    replenishment: Array<{ variantId: string; styleNo: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null; suggestedQuantity: number }>;
    slowMovers?: Array<{ variantId: string; styleNo: string; name: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null }>;
    alerts: Array<{ severity: 'critical' | 'warning' | 'info'; type: string; message: string }>;
  } | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Array<{
    id: string; accountHolder: string; iban: string; status: 'pending' | 'verified' | 'rejected'; rejectionReason?: string | null;
  }>>([]);
  const [bankAccountForm, setBankAccountForm] = useState({ accountHolder: '', iban: '' });
  const [bankAccountBusy, setBankAccountBusy] = useState(false);
  type ProductionBalance = {
    variantId: string; sku: string; product: { id: string; styleNo: string; name: string };
    location: { id: string; code: string; name: string };
  };
  type ProductionWorkOrder = {
    id: string; workOrderNo: string; plannedQuantity: number; completedQuantity: number; rejectedQuantity: number;
    status: string; priority: string; dueDate?: string | null;
    product: { styleNo: string; name: string }; variant: { sku: string; color?: string | null; size?: string | null };
    outputLocation: { code: string; name: string };
  };
  const [productionBalances, setProductionBalances] = useState<ProductionBalance[]>([]);
  const [productionWorkOrders, setProductionWorkOrders] = useState<ProductionWorkOrder[]>([]);
  const [productionBusy, setProductionBusy] = useState(false);
  const [productionForm, setProductionForm] = useState({ variantId: '', outputLocationId: '', plannedQuantity: 100, priority: 'normal', dueDate: '' });
  type Material = {
    id: string; code: string; name: string; category: string; unit: string; unitCost: number; reorderPoint: number;
    leadTimeDays: number; status: string; unitLocked: boolean; notes?: string | null; supplier?: { id: string; name: string } | null;
    onHandQuantity: number; availableQuantity: number;
    balances: Array<{ location: { code: string; name: string }; onHandQuantity: number; reservedQuantity: number }>;
  };
  type MaterialMovement = {
    id: string;
    quantity: number;
    movementType: string;
    referenceType?: string | null;
    referenceId?: string | null;
    operatorId?: string | null;
    note?: string | null;
    createdAt: string;
    material: { code: string; name: string; unit: string };
    location: { code: string; name: string };
  };
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialMovements, setMaterialMovements] = useState<MaterialMovement[]>([]);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialInbound, setMaterialInbound] = useState({ materialId: '', quantity: '', locationCode: 'central', note: '' });
  const emptyMaterialForm = {
    code: '', name: '', category: 'fabric', unit: 'meter', unitCost: '0',
    reorderPoint: '0', leadTimeDays: '0', status: 'active', notes: ''
  };
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialUnitLocked, setEditingMaterialUnitLocked] = useState(false);
  type AssistantAction = { label: string; target: 'products' | 'sku_matrix' | 'inventory' | 'materials' | 'production' | 'orders' | 'vault_requests' | 'customers' | 'growth' | 'content' | 'finance' | 'profile' | 'settings' | 'gallery' };
  type AssistantSummary = {
    gmv30d?: number; recentGmv?: number; previousGmv?: number; gmvTrend?: number; averageOrderValue?: number;
    periodLabel?: string; topSellingSkus?: Array<[string, number]>;
    pendingOrders?: number; stockouts?: number; openWorkOrders?: number; overdueWorkOrders?: number;
    pendingReturns?: number; pendingTransfers?: number; products?: number; customers?: number;
    pendingVaultRequests?: number; pendingPayouts?: number; bankAccountVerified?: boolean;
  };
  type AssistantProductCard = {
    id: string;
    styleNo: string;
    name: string;
    image: string;
    wholesalePrice: number;
    wholesalePrice100?: number | null;
    rrpPrice: number;
    moq: number;
    packSize: number;
    lifecycleStatus: string;
  };
  type AssistantTurn = { role: 'user' | 'assistant'; text: string; id?: string; product?: AssistantProductCard };
  type AssistantConversation = { id: string; title: string; updatedAt: string; messageCount: number };
  type AssistantMemory = { id: string; content: string; updatedAt: string };
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantTaskMode, setAssistantTaskMode] = useState(false);
  const [assistantTaskPreview, setAssistantTaskPreview] = useState<{
    message: string;
    workflow: string;
    goal: string;
    agents: string[];
    tools: string[];
    summary: string;
    sideEffects: string;
    requiresApprovalForSensitiveActions: boolean;
  } | null>(null);
  const [assistantPanelOpen, setAssistantPanelOpen] = useState(false);
  const [assistantPanelExpanded, setAssistantPanelExpanded] = useState(false);
  const assistantCoreLevelRef = useRef(0);
  const assistantCorePulseRef = useRef(0);
  const assistantCoreSuccessTimerRef = useRef<number | null>(null);
  const [assistantCoreSuccessFlash, setAssistantCoreSuccessFlash] = useState(false);
  const [assistantCoreFailed, setAssistantCoreFailed] = useState(false);
  // 同一个事件通道：桌面助手面板的输入、真实请求、真实回答片段与语音生命周期共用。
  const assistantCoreLife = useMemo(() => createModaCoreLife(), []);
  const assistantRevealTimerRef = useRef<number | null>(null);
  const assistantRevealRef = useRef<{ messageId: string; full: string; onDone: () => void } | null>(null);
  const assistantCoreState: ModaCoreVisualState = assistantCoreFailed
    ? 'error'
    : assistantBusy
      ? 'thinking'
      : assistantCoreSuccessFlash
        ? 'success'
        : 'idle';
  const flashAssistantCoreSuccess = () => {
    setAssistantCoreFailed(false);
    setAssistantCoreSuccessFlash(true);
    if (assistantCoreSuccessTimerRef.current !== null) window.clearTimeout(assistantCoreSuccessTimerRef.current);
    assistantCoreSuccessTimerRef.current = window.setTimeout(() => {
      setAssistantCoreSuccessFlash(false);
      assistantCoreSuccessTimerRef.current = null;
    }, 1600);
  };
  useEffect(() => () => {
    if (assistantCoreSuccessTimerRef.current !== null) window.clearTimeout(assistantCoreSuccessTimerRef.current);
    if (assistantRevealTimerRef.current !== null) window.clearInterval(assistantRevealTimerRef.current);
    assistantCoreLife.dispose();
  }, []);

  const finishAssistantReveal = (flush: boolean) => {
    if (assistantRevealTimerRef.current !== null) {
      window.clearInterval(assistantRevealTimerRef.current);
      assistantRevealTimerRef.current = null;
    }
    const reveal = assistantRevealRef.current;
    assistantRevealRef.current = null;
    if (!reveal) return;
    if (flush) {
      setAssistantHistory(current => current.map(turn => turn.id === reveal.messageId ? { ...turn, text: reveal.full } : turn));
      assistantCoreLife.emit({ type: 'response:complete' });
      reveal.onDone();
    } else {
      assistantCoreLife.emit({ type: 'response:abort' });
    }
  };

  /**
   * 真实回复文本的渐进呈现（服务端整包返回，无 SSE）：只按节奏显示同一段真实文本，
   * 并把每个片段作为真实事件交给粒子核心，不生成任何额外文案。
   */
  const revealAssistantAnswer = (messageId: string, reply: string, onDone: () => void) => {
    finishAssistantReveal(false);
    if (!reply) {
      assistantCoreLife.emit({ type: 'response:complete' });
      onDone();
      return;
    }
    const frames = buildAssistantReplyFrames(reply);
    let frameIndex = 0;
    assistantRevealRef.current = { messageId, full: reply, onDone };
    assistantCoreLife.emit({ type: 'response:start' });
    assistantRevealTimerRef.current = window.setInterval(() => {
      const reveal = assistantRevealRef.current;
      if (!reveal) return;
      const frame = frames[frameIndex];
      frameIndex += 1;
      if (frame) {
        setAssistantHistory(current => current.map(turn => turn.id === reveal.messageId ? { ...turn, text: reveal.full.slice(0, frame.end) } : turn));
        assistantCoreLife.emit({ type: 'response:chunk', chars: frame.delta });
      }
      if (!frame || frame.end >= reveal.full.length) finishAssistantReveal(true);
    }, assistantReplyFrameInterval(reply));
  };
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);
  const orderDetailHistoryActive = useRef(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderActionMenuId, setOrderActionMenuId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [merchantQuotes, setMerchantQuotes] = useState<Array<{
    id: string; quoteNo: string; customerId: string; status: string; validUntil: string | null;
    totalQty: number; totalAmount: number; notes: string | null; createdAt: string; shareUrl: string;
    items: Array<{ id: string; productId: string; sku: string; styleNo: string; productName: string; color: string; size: string; quantity: number; unitPrice: number }>;
  }>>([]);
  const [merchantQuotesLoading, setMerchantQuotesLoading] = useState(false);
  const [merchantQuotesRefresh, setMerchantQuotesRefresh] = useState(0);
  const [draftQuoteOpen, setDraftQuoteOpen] = useState(false);
  const [draftQuoteBusy, setDraftQuoteBusy] = useState(false);
  const [draftQuoteCustomerId, setDraftQuoteCustomerId] = useState('');
  const [draftQuoteNotes, setDraftQuoteNotes] = useState('');
  const [draftQuoteItems, setDraftQuoteItems] = useState<Array<{ productId: string; sku: string; quantity: number }>>([]);
  const [assistedOrderOpen, setAssistedOrderOpen] = useState(false);
  const [assistedOrderBusy, setAssistedOrderBusy] = useState(false);
  const [assistedOrderIdempotencyKey, setAssistedOrderIdempotencyKey] = useState('');
  const [assistedOrderCustomerId, setAssistedOrderCustomerId] = useState('');
  const [assistedOrderCustomerSearch, setAssistedOrderCustomerSearch] = useState('');
  const [assistedOrderProductSearch, setAssistedOrderProductSearch] = useState('');
  const [assistedOrderInviteBusy, setAssistedOrderInviteBusy] = useState(false);
  const [assistedOrderNewCustomerOpen, setAssistedOrderNewCustomerOpen] = useState(false);
  const [assistedOrderNewCustomerBusy, setAssistedOrderNewCustomerBusy] = useState(false);
  const [assistedOrderNewCustomer, setAssistedOrderNewCustomer] = useState({
    companyName: '', contactPerson: '', email: '', phone: '', address: '', city: '', country: ''
  });
  const [assistedOrderAddressMode, setAssistedOrderAddressMode] = useState<'profile' | 'custom'>('profile');
  const [assistedOrderShippingFee, setAssistedOrderShippingFee] = useState('0');
  const [assistedOrderAdditionalFees, setAssistedOrderAdditionalFees] = useState('0');
  const [assistedOrderAdditionalFeesDescription, setAssistedOrderAdditionalFeesDescription] = useState('');
  const assistedOrderFormRef = useRef<HTMLFormElement>(null);
  const [assistedOrderAddress, setAssistedOrderAddress] = useState({
    street: '', city: '', country: '', zip: '', recipient: '', phone: ''
  });
  const [assistedOrderTerms, setAssistedOrderTerms] = useState({
    paymentPlan: 'full_prepayment' as OrderAgreementTerms['paymentPlan'],
    paymentMethod: 'bank_transfer',
    prepaymentMode: 'percent' as 'percent' | 'amount',
    prepaymentValue: '30',
    remainingBalanceTrigger: 'before_shipment' as OrderAgreementTerms['remainingBalanceTrigger'],
    remainingBalanceDueAt: '',
    customPaymentCondition: '',
    supplyMode: 'partial_shipments' as OrderAgreementTerms['supplyMode'],
    expectedDeliveryAt: ''
  });
  const [assistedOrderItems, setAssistedOrderItems] = useState<Array<{ productId: string; sku: string; quantity: string }>>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'needs_action' | 'in_progress' | 'logistics_exception' | 'complete'>('all');
  const [orderDateRange, setOrderDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<'all' | 'paid' | 'partially_refunded' | 'unpaid' | 'pending_credit' | 'pending_refund' | 'refunded'>('all');
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState<'all' | 'shipping' | 'showroom_pickup'>('all');
  const [orderSort, setOrderSort] = useState<'date' | 'amount' | 'quantity'>('date');
  const [orderSortDirection, setOrderSortDirection] = useState<'asc' | 'desc'>('desc');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(20);
  const [orderEditOpen, setOrderEditOpen] = useState(false);
  const [orderEditTargetId, setOrderEditTargetId] = useState<string | null>(null);
  const [orderEditBusy, setOrderEditBusy] = useState(false);
  const [orderEditForm, setOrderEditForm] = useState({
    street: '',
    city: '',
    country: '',
    zip: '',
    notes: '',
    items: [] as Array<{ id: string; quantity: string; unitPrice: string }>,
    paymentPlan: 'full_prepayment' as OrderAgreementTerms['paymentPlan'],
    paymentMethod: 'bank_transfer',
    prepaymentMode: 'percent' as 'percent' | 'amount',
    prepaymentValue: '30',
    remainingBalanceTrigger: 'before_shipment' as OrderAgreementTerms['remainingBalanceTrigger'],
    remainingBalanceDueAt: '',
    customPaymentCondition: '',
    supplyMode: 'partial_shipments' as OrderAgreementTerms['supplyMode'],
    expectedDeliveryAt: '',
    shippingFee: '0',
    discountAmount: '0'
  });

  useEffect(() => {
    if (!selectedOrderDetailId) return;
    const previousOverflow = document.body.style.overflow;
    const previousScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    if (!orderDetailHistoryActive.current) {
      window.history.pushState({ ...window.history.state, rudaOrderDetailOpen: true }, '');
      orderDetailHistoryActive.current = true;
    }
    const closeOnHistoryBack = () => {
      orderDetailHistoryActive.current = false;
      setSelectedOrderDetailId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (orderDetailHistoryActive.current) window.history.back();
      else setSelectedOrderDetailId(null);
    };
    window.addEventListener('popstate', closeOnHistoryBack);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, previousScrollY);
      window.removeEventListener('popstate', closeOnHistoryBack);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedOrderDetailId]);
  const [assistantConversationId, setAssistantConversationId] = useState<string | null>(null);
  const [assistantConversations, setAssistantConversations] = useState<AssistantConversation[]>([]);
  const [assistantConversationMenuOpen, setAssistantConversationMenuOpen] = useState(false);
  const [assistantSettingsOpen, setAssistantSettingsOpen] = useState(false);
  const [assistantPromptMenuOpen, setAssistantPromptMenuOpen] = useState(false);
  const [assistantMemories, setAssistantMemories] = useState<AssistantMemory[]>([]);
  const [assistantMemoryDraft, setAssistantMemoryDraft] = useState('');
  const [assistantMemoriesLoading, setAssistantMemoriesLoading] = useState(false);
  const [assistantMemorySaving, setAssistantMemorySaving] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState<AssistantTurn[]>([]);
  const assistantContextKeyRef = useRef(assistantContextKey);
  assistantContextKeyRef.current = assistantContextKey;
  const assistantMessagesEndRef = useRef<HTMLDivElement>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [dashboardProductSearch, setDashboardProductSearch] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState<{
    reply: string;
    actions: AssistantAction[];
    summary?: AssistantSummary;
    product?: AssistantProductCard;
  } | null>(null);
  const [assistantFocusedProductId, setAssistantFocusedProductId] = useState<string | null>(null);
  const [serverProducts, setServerProducts] = useState<Product[] | null>(null);
  const [canManageProductCosts, setCanManageProductCosts] = useState(false);
  const [serverOrders, setServerOrders] = useState<Order[] | null>(null);
  const [serverTransfers, setServerTransfers] = useState<StockTransferRecord[] | null>(null);
  const [serverVaultRequests, setServerVaultRequests] = useState<VaultAccessRequest[] | null>(null);
  type MerchantCustomer = {
    id: string; companyName: string; vatNumber: string; address: string; city: string; country: string;
    contactPerson: string; phone: string; email: string; businessType: string;
    tier: string; discountRate: number; creditLimit: number; usedCredit: number; status: 'pending' | 'approved' | 'rejected';
    customerLevel?: string; registrationDate?: string; createdAt?: string; updatedAt?: string;
    merchantNotes?: string; merchantTags?: string[];
    buyerAccountLinked?: boolean;
  };
  type MerchantReturn = {
    id: string; orderId: string; reason: string; status: 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';
    requestedQty: number; approvedQty: number | null; refundAmount: number | null; createdAt: string;
    order: { orderNo: string; companyName: string };
  };
  type MerchantPayout = {
    id: string; period: string; grossSales: number; platformFeeRate?: number; platformFeeAmount: number;
    paymentProcessingFee: number; refunds?: number; netPayout: number; status: 'pending' | 'processing' | 'paid' | 'failed';
    bankAccount: string; merchantAcknowledgedAt?: string | null;
    settlementReference?: string | null; settlementProof?: string | null; settledAt?: string | null; settledBy?: string | null;
    allocations?: Array<{ orderId: string; grossAmount: number; refundAmount: number; netAmount: number; order?: { orderNo: string; date: string } }>;
  };
  const [serverCustomers, setServerCustomers] = useState<MerchantCustomer[] | null>(null);
  const [customerEditor, setCustomerEditor] = useState<MerchantCustomer | null>(null);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [customerEditorBusy, setCustomerEditorBusy] = useState(false);
  const [customerForm, setCustomerForm] = useState({ companyName: '', contactPerson: '', email: '', vatNumber: '', address: '', city: '', country: 'Italy', phone: '', businessType: 'Boutique', merchantNotes: '', merchantTags: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [customerCountryFilter, setCustomerCountryFilter] = useState('all');
  const [customerSegment, setCustomerSegment] = useState<'all' | 'repeat' | 'new' | 'at-risk' | 'no-orders'>('all');
  const [customerMinOrders, setCustomerMinOrders] = useState('');
  const [customerLookbackDays, setCustomerLookbackDays] = useState('');
  const [customerSavedSegments, setCustomerSavedSegments] = useState<Array<{
    id: string; name: string; search: string; status: string; country: string; segment: 'all' | 'repeat' | 'new' | 'at-risk' | 'no-orders'; minOrders: string; lookbackDays: string;
  }>>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [customerBatchTag, setCustomerBatchTag] = useState('');
  const [customerBatchBusy, setCustomerBatchBusy] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<MerchantCustomer | null>(null);
  const [customerAiBusy, setCustomerAiBusy] = useState(false);
  const [serverReturns, setServerReturns] = useState<MerchantReturn[] | null>(null);
  const [serverPayouts, setServerPayouts] = useState<MerchantPayout[] | null>(null);
  type StoreCategory = { id: string; name: string; slug: string; sortOrder: number };
  type ProductViewPreset = {
    id: string;
    name: string;
    search: string;
    lifecycle: string;
    zone: string;
    category: string;
    sort: string;
    quickView: 'all' | 'published' | 'draft' | 'archived' | 'low-stock' | 'under-five' | 'no-image' | 'clearance' | 'private';
  };
  const [savedProductViews, setSavedProductViews] = useState<ProductViewPreset[]>([]);
  const [selectedProductView, setSelectedProductView] = useState('');
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [editingStoreCategoryId, setEditingStoreCategoryId] = useState<string | null>(null);
  const [categoryMembershipId, setCategoryMembershipId] = useState('');
  const [categoryMembershipSearch, setCategoryMembershipSearch] = useState('');
  const [categoryMembershipProductIds, setCategoryMembershipProductIds] = useState<string[]>([]);
  const [categoryMembershipBusy, setCategoryMembershipBusy] = useState(false);
  type InventoryBalance = {
    id: string; variantId: string; sku: string; color?: string | null; size?: string | null;
    product: { id: string; styleNo: string; name: string };
    location: { id: string; code: string; name: string };
    onHandQuantity: number; reservedQuantity: number; availableQuantity: number;
    inTransitQuantity: number; version: number; updatedAt: string;
  };
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [inventoryBalancesLoaded, setInventoryBalancesLoaded] = useState(false);
  type InventoryMovement = {
    id: string; quantity: number; movementType: string; note?: string | null; createdAt: string;
    variant: { sku: string; color?: string | null; size?: string | null; product: { styleNo: string; name: string } };
    location: { code: string; name: string };
  };
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryAdjustment, setInventoryAdjustment] = useState<{ balance: InventoryBalance; quantity: string; note: string } | null>(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);

  // Merchant tenant identity is determined by the authenticated session only.
  const currentMerchantId = authMerchantId;
  const isDemoMerchant = Boolean(currentMerchantId?.startsWith('demo-industry-'));
  const currentMerchant = currentMerchantId ? merchants.find(m => m.id === currentMerchantId) : undefined;
  const updateMerchantProduct = async (productId: string, updates: Partial<Product>) => {
    await updateProduct(productId, updates);
    setServerProducts(previous => previous?.map(product =>
      product.id === productId ? { ...product, ...updates } : product
    ) || previous);
  };
  const deleteMerchantProduct = async (productId: string) => {
    await deleteProduct(productId);
    setServerProducts(previous => previous?.filter(product => product.id !== productId) || previous);
  };
  useEffect(() => {
    setSelectedProductView('');
    if (!currentMerchantId) {
      setInventoryBalancesLoaded(false);
      setSavedProductViews([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`ruda-product-views:${currentMerchantId}`);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) throw new Error('INVALID_PRODUCT_VIEW_STORAGE');
      const validViews = parsed.filter((item): item is ProductViewPreset =>
        Boolean(item && typeof item === 'object'
          && typeof item.id === 'string'
          && typeof item.name === 'string'
          && typeof item.search === 'string'
          && typeof item.lifecycle === 'string'
          && typeof item.zone === 'string'
          && typeof item.category === 'string'
          && typeof item.sort === 'string'
          && ['all', 'published', 'draft', 'low-stock', 'clearance', 'private'].includes(item.quickView))
      ).slice(0, 20);
      setSavedProductViews(validViews);
    } catch (error) {
      setSavedProductViews([]);
      addNotification('warning', '已保存商品视图读取失败', '请刷新页面重试。');
    }
  }, [currentMerchantId]);
  useEffect(() => {
    if (!currentMerchantId) {
      setCustomerSavedSegments([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`ruda-customer-segments:${currentMerchantId}`);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) throw new Error('INVALID_CUSTOMER_SEGMENT_STORAGE');
      setCustomerSavedSegments(parsed.filter((segment): segment is typeof customerSavedSegments[number] =>
        Boolean(segment && typeof segment === 'object'
          && typeof segment.id === 'string' && typeof segment.name === 'string'
          && typeof segment.search === 'string' && typeof segment.status === 'string'
          && typeof segment.country === 'string' && typeof segment.minOrders === 'string'
          && typeof segment.lookbackDays === 'string'
          && ['all', 'repeat', 'new', 'at-risk', 'no-orders'].includes(segment.segment))
      ).slice(0, 20));
    } catch (error) {
      setCustomerSavedSegments([]);
      addNotification('warning', '已保存客户筛选读取失败', '请刷新页面重试。');
    }
  }, [currentMerchantId]);
  useEffect(() => {
    setAssistantMemories([]);
  }, [currentMerchantId]);
  useEffect(() => {
    setAssistantHistory([]);
    setAssistantAnswer(null);
    setAssistantQuestion('');
    setAssistantConversationId(null);
    setAssistantConversations([]);
    if (!currentMerchantId) return;
    let active = true;
    const query = new URLSearchParams({ context: assistantRequestContext, scope: assistantRequestScope });
    void apiGet<{ success: true; conversations: AssistantConversation[] }>(`/api/merchant/assistant/conversations?${query}`)
      .then(result => { if (active) setAssistantConversations(result.conversations); })
      .catch(error => {
        if (active) addNotification('warning', '助手历史加载失败', error instanceof Error ? error.message : '请稍后重试');
      });
    return () => { active = false; };
  }, [currentMerchantId, assistantRequestContext, assistantRequestScope]);
  useEffect(() => {
      if (!assistantSettingsOpen || !currentMerchantId) return;
      let active = true;
      setAssistantMemoriesLoading(true);
      void apiGet<{ success: true; memories: AssistantMemory[] }>('/api/merchant/assistant/memories')
        .then(result => { if (active) setAssistantMemories(result.memories); })
        .catch(error => {
          if (active) addNotification('warning', '助手偏好记忆加载失败', error instanceof Error ? error.message : '请稍后重试');
        })
        .finally(() => { if (active) setAssistantMemoriesLoading(false); });
      return () => { active = false; };
  }, [assistantSettingsOpen, currentMerchantId]);
  const [storefrontForm, setStorefrontForm] = useState({
    storefrontTemplate: 'fashion_monochrome' as typeof MERCHANT_STOREFRONT_TEMPLATES[number]['id'],
    logo: '', banner: '', showroomImage: '', showroomPanoramicImages: [] as string[],
    storefrontVideo: '',
    storefrontSeoTitle: '', storefrontSeoDescription: '',
    storefrontShippingPolicy: '', storefrontReturnsPolicy: '', storefrontReturnAddress: '',
    tagline: '', tagline_zh: '', tagline_it: '', description: '', description_zh: '', description_it: '',
    specialties: [] as string[]
  });
  const [storefrontVideoFile, setStorefrontVideoFile] = useState<File | null>(null);
  const [storefrontVideoPreview, setStorefrontVideoPreview] = useState('');
  const [storefrontBusy, setStorefrontBusy] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState('');
  const defaultMobileSettings = { mobileAlerts: true, mobileCompact: false, mobileDefaultTab: 'dashboard', mobileLanguage: 'auto' };
  const [settingsForm, setSettingsForm] = useState({
    name: '', companyLegalName: '', vatNumber: '', country: '', city: '', showroomAddress: '',
    contactPerson: '', contactPhone: '', contactEmail: '', websiteUrl: '', mapLatitude: '', mapLongitude: '', moq: 6, defaultPaymentTerm: 'prepaid',
    shippingNote: '', notifyOrders: true, notifyPayouts: true, notifyVault: true, notifyMarketing: false
    , mobileAlerts: true, mobileCompact: false, mobileDefaultTab: 'dashboard', mobileLanguage: 'auto'
  });
  const [merchantDefaultMoq, setMerchantDefaultMoq] = useState(6);
  const [settingsSyncNonce, setSettingsSyncNonce] = useState(0);
  type TeamEmployee = {
    id: string;
    name: string;
    email: string;
    role: 'sales' | 'warehouse' | 'production' | 'pos_cashier' | 'knowledge_manager' | 'store_manager';
    permissions: string[];
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
  const employeePermissionOptions = [
    ['sales.order.create', '创建销售单'],
    ['product.publish', '创建和管理商品及分类'],
    ['product.cost.view', '查看及管理商品成本'],
    ['pricing.request', '提交改价申请'],
    ['pricing.approve', '审批改价'],
    ['warehouse.pick', '拣货与差异登记'],
    ['warehouse.review', '复核库存与订单'],
    ['warehouse.pack', '打包'],
    ['warehouse.ship', '出库与发货'],
    ['production.report', '生产报工与质检'],
    ['purchase.manage', '管理成衣采购订单'],
    ['return.manage', '审核退货与退款'],
    ['employees.manage', '创建员工与管理权限'],
    ['brain.read', '查看 ModaUI 知识库'],
    ['brain.write', '添加知识库文档'],
    ['brain.knowledge.review', '审核与失效知识库文档']
  ] as const;
  const rolePermissionDefaults: Record<TeamEmployee['role'], string[]> = {
    sales: ['sales.order.create', 'pricing.request'],
    warehouse: ['warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'],
    production: ['production.report'],
    pos_cashier: ['sales.order.create'],
    knowledge_manager: ['brain.read', 'brain.write', 'brain.knowledge.review'],
    store_manager: employeePermissionOptions
      .filter(([permission]) => !permission.startsWith('brain.'))
      .map(([permission]) => permission)
  };
  const employeeRoleLabels: Record<TeamEmployee['role'], string> = {
    sales: '销售',
    warehouse: '仓库',
    production: '生产',
    pos_cashier: 'POS 收银',
    knowledge_manager: '知识库管理员',
    store_manager: '店长'
  };
  const employeeRoleDescriptions: Record<TeamEmployee['role'], string> = {
    sales: '可开销售单 · 改价需审批',
    warehouse: '拣货 · 复核 · 打包 · 出库',
    production: '报工 · 质检',
    pos_cashier: '仅销售开单 · 无员工管理权',
    knowledge_manager: '知识库管理 · 无商品权 · 无库存权 · 无财务权',
    store_manager: '含员工管理 · 含岗位权限 · 不含知识库 · 限可信管理员'
  };
  const [teamEmployees, setTeamEmployees] = useState<TeamEmployee[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState('');
  useEffect(() => {
    if (!currentMerchant) return;
    setStorefrontForm({
      storefrontTemplate: currentMerchant.storefrontTemplate || 'fashion_monochrome',
      logo: currentMerchant.logo || '',
      banner: currentMerchant.banner || '',
      showroomImage: currentMerchant.showroomImage || '',
      showroomPanoramicImages: currentMerchant.showroomPanoramicImages || [],
      storefrontVideo: currentMerchant.storefrontVideo || '',
      storefrontSeoTitle: currentMerchant.storefrontSeoTitle || '',
      storefrontSeoDescription: currentMerchant.storefrontSeoDescription || '',
      storefrontShippingPolicy: currentMerchant.storefrontShippingPolicy || '',
      storefrontReturnsPolicy: currentMerchant.storefrontReturnsPolicy || '',
      storefrontReturnAddress: currentMerchant.storefrontReturnAddress || '',
      tagline: currentMerchant.tagline || '',
      tagline_zh: currentMerchant.tagline_zh || '',
      tagline_it: currentMerchant.tagline_it || '',
      description: currentMerchant.description || '',
      description_zh: currentMerchant.description_zh || '',
      description_it: currentMerchant.description_it || '',
      specialties: currentMerchant.specialties || []
    });
    setStorefrontVideoFile(null);
  }, [currentMerchant]);
  useEffect(() => {
    if (!storefrontVideoFile) {
      setStorefrontVideoPreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(storefrontVideoFile);
    setStorefrontVideoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [storefrontVideoFile]);
  useEffect(() => {
    if (activeTab !== 'settings' || !currentMerchantId || !currentMerchant) return;
    let active = true;
    void apiGet<{ success: true; settings: Partial<typeof settingsForm>; updatedAt?: string | null }>('/api/merchant/settings').then(result => {
      if (!active) return;
      setSettingsUpdatedAt(String(result.updatedAt || ''));
      setMerchantDefaultMoq(normalizeMerchantProductDefaultMoq(result.settings.moq));
      setSettingsForm(previous => ({ ...previous, ...result.settings, mapLatitude: String(result.settings.mapLatitude ?? ''), mapLongitude: String(result.settings.mapLongitude ?? ''), name: currentMerchant.name, companyLegalName: currentMerchant.companyLegalName, vatNumber: currentMerchant.vatNumber || '', country: currentMerchant.country, city: currentMerchant.city, showroomAddress: currentMerchant.showroomAddress, contactPerson: currentMerchant.contactPerson, contactPhone: currentMerchant.contactPhone, contactEmail: currentMerchant.contactEmail }));
    }).catch(error => addNotification('warning', '设置加载失败', error instanceof Error ? error.message : '请稍后重试'));
    return () => { active = false; };
  }, [activeTab, currentMerchant, currentMerchantId, settingsSyncNonce]);
  useEffect(() => {
    if (activeTab !== 'settings' || settingsSubsection !== 'payments' || !currentMerchantId) return;
    let active = true;
    setMerchantPaymentStatusLoading(true);
    setMerchantPaymentStatusError('');
    void apiGet<{ success: true; payment: MerchantPaymentStatus; paypal: MerchantPayPalStatus; stripe: MerchantStripeStatus; solana: MerchantSolanaStatus }>('/api/merchant/payment-config')
      .then(result => {
        if (active) {
          setMerchantPaymentStatus(result.payment);
          setMerchantPayPalStatus(result.paypal);
          setMerchantStripeStatus(result.stripe);
          setMerchantSolanaStatus(result.solana);
          setSolanaWalletAddress(result.solana.walletAddress || '');
          if (result.paypal.environment) setPaypalCredentialsForm(previous => ({ ...previous, environment: result.paypal.environment! }));
        }
      })
      .catch(error => {
        if (active) {
          setMerchantPaymentStatus(null);
          setMerchantPaymentStatusError(error instanceof Error ? error.message : '付款状态读取失败');
        }
      })
      .finally(() => {
        if (active) setMerchantPaymentStatusLoading(false);
      });
    return () => { active = false; };
  }, [activeTab, currentMerchantId, merchantPaymentStatusRefresh, settingsSubsection]);
  useEffect(() => {
    if (activeTab !== 'settings' || !currentMerchantId) return;
    let active = true;
    setTeamLoading(true);
    setTeamLoadError('');
    void apiGet<{ success: true; employees: Array<Omit<TeamEmployee, 'permissions'> & { permissions: string }> }>('/api/merchant/employees')
      .then(result => {
        if (!active) return;
        setTeamEmployees(result.employees.map(employee => {
          let permissions: string[] = [];
          try {
            const parsed: unknown = JSON.parse(employee.permissions || '[]');
            if (Array.isArray(parsed)) permissions = parsed.filter((permission): permission is string => typeof permission === 'string');
          } catch {
            permissions = [];
          }
          return { ...employee, permissions };
        }));
      })
      .catch(error => {
        if (!active) return;
        setTeamLoadError(error instanceof Error ? error.message : '当前账号没有员工管理权限');
        setTeamEmployees([]);
      })
      .finally(() => {
        if (active) setTeamLoading(false);
      });
    return () => { active = false; };
  }, [activeTab, currentMerchantId]);
  const saveStripeCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stripeCredentialsBusy) return;
    setStripeCredentialsBusy(true);
    try {
      const result = await apiPut<{ success: true; stripe: MerchantStripeStatus }>('/api/merchant/payment-config/stripe', { secretKey: stripeSecretKey });
      setMerchantStripeStatus(result.stripe);
      setStripeSecretKey('');
      addNotification('success', 'Stripe 已连接', `${result.stripe.livemode ? 'Live 正式环境' : 'Test 测试环境'}密钥已验证并加密保存`);
    } catch (error) {
      addNotification('warning', 'Stripe 连接失败', error instanceof Error ? error.message : '密钥验证或保存失败，请检查后重试');
    } finally {
      setStripeCredentialsBusy(false);
    }
  };
  const disconnectStripe = async () => {
    if (!merchantStripeStatus?.configured || stripeCredentialsBusy) return;
    if (!window.confirm('断开 Stripe 后，顾客将无法使用此商家的 Stripe 在线卡付款。确认继续？')) return;
    setStripeCredentialsBusy(true);
    try {
      await apiDelete('/api/merchant/payment-config/stripe');
      setMerchantStripeStatus({ configured: false, enabled: false, accountId: null, livemode: null });
      addNotification('success', 'Stripe 已断开', '该商家的 Stripe 密钥已从 RUDA 删除');
    } catch (error) {
      addNotification('warning', 'Stripe 断开失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setStripeCredentialsBusy(false);
    }
  };
  const saveSolanaWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (solanaConfigBusy) return;
    setSolanaConfigBusy(true);
    try {
      const result = await apiPut<{ success: true; solana: MerchantSolanaStatus }>('/api/merchant/payment-config/solana', {
        walletAddress: solanaWalletAddress
      });
      setMerchantSolanaStatus(result.solana);
      setSolanaWalletAddress(result.solana.walletAddress || '');
      addNotification('success', 'Solana 钱包已绑定', '顾客支付的 USDC 或 EURC 将直接转入此公钥地址。');
    } catch (error) {
      addNotification('warning', 'Solana 钱包保存失败', error instanceof Error ? error.message : '请检查钱包地址并重试');
    } finally {
      setSolanaConfigBusy(false);
    }
  };
  const disconnectSolanaWallet = async () => {
    if (!merchantSolanaStatus?.configured || solanaConfigBusy) return;
    if (!window.confirm('断开钱包后，顾客将无法创建新的 Solana Pay 付款。已创建的订单仍按其原收款地址核验。确认继续？')) return;
    setSolanaConfigBusy(true);
    try {
      await apiDelete('/api/merchant/payment-config/solana');
      setMerchantSolanaStatus({ configured: false, enabled: false, walletAddress: null });
      setSolanaWalletAddress('');
      addNotification('success', 'Solana 钱包已断开', '该钱包不会再用于新订单；已创建付款仍保留原收款地址供链上核对。');
    } catch (error) {
      addNotification('warning', 'Solana 钱包断开失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSolanaConfigBusy(false);
    }
  };
  const savePayPalCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (paypalCredentialsBusy) return;
    setPaypalCredentialsBusy(true);
    try {
      const result = await apiPut<{ success: true; paypal: MerchantPayPalStatus }>('/api/merchant/payment-config/paypal', paypalCredentialsForm);
      setMerchantPayPalStatus(result.paypal);
      setPaypalCredentialsForm(previous => ({ ...previous, clientId: '', clientSecret: '' }));
      addNotification('success', 'PayPal 已连接', `${result.paypal.environment === 'live' ? '正式环境' : '沙盒环境'}凭证已通过验证并加密保存`);
    } catch (error) {
      addNotification('warning', 'PayPal 连接失败', error instanceof Error ? error.message : '凭证验证或保存失败，请检查后重试');
    } finally {
      setPaypalCredentialsBusy(false);
    }
  };
  const disconnectPayPal = async () => {
    if (!merchantPayPalStatus?.configured || paypalCredentialsBusy) return;
    if (!window.confirm('断开 PayPal 后，顾客将无法使用此商家的 PayPal 结账。确认继续？')) return;
    setPaypalCredentialsBusy(true);
    try {
      await apiDelete('/api/merchant/payment-config/paypal');
      setMerchantPayPalStatus({ configured: false, enabled: false, environment: null, clientIdHint: null });
      addNotification('success', 'PayPal 已断开', '该商家的 PayPal 凭证已从 RUDA 删除');
    } catch (error) {
      addNotification('warning', 'PayPal 断开失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setPaypalCredentialsBusy(false);
    }
  };
  const saveSettings = async () => {
    if (settingsBusy) return;
    if (!settingsForm.name.trim() || !settingsForm.contactEmail.includes('@')) {
      addNotification('warning', '资料校验失败', '请填写店铺名称和有效邮箱');
      return;
    }
    setSettingsBusy(true);
    try {
      const result = await apiPut<{ success: true; settings: Partial<typeof settingsForm>; updatedAt?: string | null; merchant: typeof currentMerchant }>('/api/merchant/settings', {
        ...settingsForm,
        expectedUpdatedAt: settingsUpdatedAt || undefined
      });
      setSettingsUpdatedAt(String(result.updatedAt || ''));
      setMerchantDefaultMoq(normalizeMerchantProductDefaultMoq(result.settings.moq));
      if (currentMerchant && result.merchant) await updateMerchant(currentMerchant.id, result.merchant);
      addNotification('success', '设置已保存', '店铺资料、交易规则和通知偏好已更新');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MERCHANT_SETTINGS_CONFLICT') {
        addNotification('warning', '设置已在其他端更新', '为避免覆盖其他端的修改，本次保存未提交。请重新打开设置后再编辑。');
        return;
      }
      addNotification('warning', '设置保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
    finally { setSettingsBusy(false); }
  };
  const resetMobileSettings = () => {
    setSettingsForm(previous => ({ ...previous, ...defaultMobileSettings }));
    addNotification('success', '手机端设置已恢复默认', '点击“保存设置”后才会写入商户配置');
  };
  const readStorefrontImage = (file: File, callback: (value: string) => void) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
      addNotification('warning', '图片不符合要求', '仅支持 JPG、PNG、WebP，单张不超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && callback(reader.result);
    reader.onerror = () => addNotification('warning', '图片读取失败', '请重新选择图片');
    reader.readAsDataURL(file);
  };
  const uploadStorefrontMedia = async (value: string, field: string) => {
    if (!value.startsWith('data:')) return { url: value, asset: undefined };
    const match = value.match(/^data:([^;]+);base64,/);
    if (!match) throw new Error('图片数据格式无效');
    const contentType = match[1];
    const binary = Uint8Array.from(atob(value.slice(value.indexOf(',') + 1)), character => character.charCodeAt(0));
    if (binary.byteLength > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB');
    const presignResponse = await fetch('/api/merchant/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contentType, fileSize: binary.byteLength })
    });
    if (presignResponse.status === 503) return { url: value, asset: undefined };
    const presign = await presignResponse.json() as { success?: boolean; uploadUrl?: string; publicUrl?: string; key?: string; error?: string; contentType?: string; sizeBytes?: number };
    if (!presignResponse.ok || !presign.success || !presign.uploadUrl || !presign.publicUrl) {
      throw new Error(presign.error || '媒体上传授权失败');
    }
    const upload = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public,max-age=31536000,immutable' },
      body: binary
    });
    if (!upload.ok) throw new Error('媒体上传失败，请检查对象存储 CORS 配置');
    if (!presign.contentType || presign.sizeBytes !== binary.byteLength) throw new Error('媒体上传元数据校验失败');
    return {
      url: presign.publicUrl,
      asset: {
        field,
        url: presign.publicUrl,
        storageKey: presign.key,
        contentType: presign.contentType,
        sizeBytes: presign.sizeBytes
      }
    };
  };
  const uploadStorefrontVideo = async (file: File) => {
    if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 100 * 1024 * 1024) {
      throw new Error('店铺视频仅支持 MP4/WebM，单个文件最大 100MB');
    }
    const presignResponse = await fetch('/api/merchant/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ contentType: file.type, fileSize: file.size })
    });
    const presign = await presignResponse.json() as { success?: boolean; uploadUrl?: string; publicUrl?: string; error?: string };
    if (!presignResponse.ok || !presign.success || !presign.uploadUrl || !presign.publicUrl) {
      throw new Error(presign.error || '店铺视频上传授权失败，请确认对象存储已配置');
    }
    const upload = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'Cache-Control': 'public,max-age=31536000,immutable' },
      body: file
    });
    if (!upload.ok) throw new Error('店铺视频上传失败，请检查对象存储 CORS 配置');
    return presign.publicUrl;
  };
  const saveStorefront = async () => {
    if (!currentMerchant || storefrontBusy) return;
    setStorefrontBusy(true);
    try {
      const uploaded = await Promise.all([
        uploadStorefrontMedia(storefrontForm.logo, 'logo'),
        uploadStorefrontMedia(storefrontForm.banner, 'banner'),
        uploadStorefrontMedia(storefrontForm.showroomImage, 'showroomImage'),
        ...storefrontForm.showroomPanoramicImages.map((image, index) => uploadStorefrontMedia(image, `showroomPanoramicImages:${index}`))
      ]);
      const [logo, banner, showroomImage, ...gallery] = uploaded.map(item => item.url);
      const storefrontMediaItems = uploaded.flatMap(item => item.asset ? [item.asset] : []);
      const storefrontVideo = storefrontVideoFile
        ? await uploadStorefrontVideo(storefrontVideoFile)
        : storefrontForm.storefrontVideo;
      const result = await apiPut<{ success: true; merchant: typeof currentMerchant }>('/api/merchant/storefront', {
        ...storefrontForm, logo, banner, showroomImage, showroomPanoramicImages: gallery, storefrontVideo, storefrontMediaItems
      });
      await updateMerchant(currentMerchant.id, result.merchant);
      setStorefrontVideoFile(null);
      addNotification('success', '店铺装修已发布', '店铺模板、图片、文案和特色标签已更新');
    } catch (error) {
      addNotification('warning', '店铺装修保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setStorefrontBusy(false);
    }
  };
  useEffect(() => {
    if (!currentMerchantId) {
      setOperationsIntelligence(null);
      return;
    }
    let active = true;
    const loadIntelligence = async () => {
      try {
        const result = await apiGet<{ success: true } & NonNullable<typeof operationsIntelligence>>('/api/merchant/operations/intelligence');
        if (active) setOperationsIntelligence(result);
      } catch (error) {
        console.error('[merchant-operations-intelligence]', error);
        if (active) setOperationsIntelligence(null);
      }
    };
    void loadIntelligence();
    const interval = window.setInterval(() => void loadIntelligence(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentMerchantId]);
  const refreshMerchantOperations = async (notifyOnFailure = true) => {
    // Each collection is independent. A 403/network failure in one endpoint must
    // not discard products, orders or settings that the server did return.
    const results = await Promise.allSettled([
      apiGet<{ success: true; products: Product[]; canManageCosts?: boolean }>('/api/merchant/products'),
      apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders'),
      apiGet<{ success: true; transfers: StockTransferRecord[] }>('/api/merchant/transfers'),
      apiGet<{ success: true; requests: VaultAccessRequest[] }>('/api/merchant/vault-requests'),
      apiGet<{ success: true; customers: MerchantCustomer[] }>('/api/merchant/customers'),
      apiGet<{ success: true; returns: MerchantReturn[] }>('/api/merchant/returns'),
      apiGet<{ success: true; payouts: MerchantPayout[] }>('/api/merchant/finance'),
      apiGet<{ success: true; categories: StoreCategory[] }>('/api/merchant/store-categories')
    ]);
    const [productResult, orderResult, transferResult, vaultResult, customerResult, returnResult, financeResult, categoryResult] = results;
    const failed: string[] = [];
    if (productResult.status === 'fulfilled') {
      setServerProducts(productResult.value.products);
      setCanManageProductCosts(productResult.value.canManageCosts === true);
    } else failed.push('商品');
    if (orderResult.status === 'fulfilled') setServerOrders(orderResult.value.orders);
    else failed.push('订单');
    if (transferResult.status === 'fulfilled') setServerTransfers(transferResult.value.transfers);
    else failed.push('调拨');
    if (vaultResult.status === 'fulfilled') setServerVaultRequests(vaultResult.value.requests);
    else failed.push('看货申请');
    if (customerResult.status === 'fulfilled') setServerCustomers(customerResult.value.customers);
    else failed.push('客户');
    if (returnResult.status === 'fulfilled') setServerReturns(returnResult.value.returns);
    else failed.push('退货');
    if (financeResult.status === 'fulfilled') setServerPayouts(financeResult.value.payouts);
    else failed.push('结算');
    if (categoryResult.status === 'fulfilled') setStoreCategories(categoryResult.value.categories);
    else failed.push('店铺分类');
    if (failed.length && notifyOnFailure) {
      addNotification('warning', '部分商家数据刷新失败', `未更新：${[...new Set(failed)].join('、')}。已获取的数据仍以服务端为准。`);
    }
    return [...new Set(failed)];
  };
  useEffect(() => {
    if (!currentMerchantId) {
      setServerProducts(null);
      setCanManageProductCosts(false);
      setServerOrders(null);
      setServerTransfers(null);
      setServerVaultRequests(null);
      setServerCustomers(null);
      setServerReturns(null);
      setServerPayouts(null);
      setStoreCategories([]);
      return;
    }
    void refreshMerchantOperations();
  }, [currentMerchantId]);
  useEffect(() => {
    if (!currentMerchantId) return;
    const merchantProductsFromContext = products.filter(product => product.merchantId === currentMerchantId);
    setServerProducts(previous => previous === null ? previous : [
      ...previous.filter(product => product.merchantId !== currentMerchantId),
      ...merchantProductsFromContext
    ]);
  }, [products, currentMerchantId]);
  useEffect(() => {
    if (activeTab !== 'orders' || orderView !== 'drafts' || !currentMerchantId) return;
    let active = true;
    setMerchantQuotesLoading(true);
    void apiGet<{ success: true; quotes: Array<{
      id: string; quoteNo: string; customerId: string; status: string; validUntil: string | null;
      totalQty: number; totalAmount: number; notes: string | null; createdAt: string; shareUrl: string;
      items: Array<{ id: string; productId: string; sku: string; styleNo: string; productName: string; color: string; size: string; quantity: number; unitPrice: number }>;
    }> }>('/api/merchant/quotes')
      .then(result => {
        if (active) setMerchantQuotes(result.quotes.map(quote => ({ ...quote, totalAmount: Number(quote.totalAmount), items: quote.items.map(item => ({ ...item, unitPrice: Number(item.unitPrice) })) })));
      })
      .catch(error => {
        if (active) addNotification('warning', '草稿订单读取失败', error instanceof Error ? error.message : '请稍后重试');
      })
      .finally(() => { if (active) setMerchantQuotesLoading(false); });
    return () => { active = false; };
  }, [activeTab, orderView, currentMerchantId, merchantQuotesRefresh]);
  useEffect(() => {
    if (activeTab !== 'finance' || !currentMerchantId) return;
    let active = true;
    void apiGet<{ success: true; accounts: typeof bankAccounts }>('/api/merchant/bank-accounts')
      .then(result => { if (active) setBankAccounts(result.accounts); })
      .catch(error => console.error('[merchant-bank-accounts]', error));
    return () => { active = false; };
  }, [activeTab, currentMerchantId]);
  useEffect(() => {
    if (!currentMerchantId) return;
    let active = true;
    setInventoryLoading(true);
    void Promise.all([
      apiGet<{ success: true; balances: InventoryBalance[] }>('/api/merchant/inventory/balances?pageSize=500'),
      activeTab === 'inventory'
        ? apiGet<{ success: true; movements: InventoryMovement[] }>('/api/merchant/inventory/movements?limit=100')
        : Promise.resolve({ movements: [] as InventoryMovement[] })
    ])
      .then(([balanceResult, movementResult]) => { if (active) { setInventoryBalances(balanceResult.balances); setInventoryBalancesLoaded(true); if (activeTab === 'inventory') setInventoryMovements(movementResult.movements); } })
      .catch(error => { console.error('[merchant-inventory-balances]', error); if (active) addNotification('warning', '库存加载失败', '请稍后重试'); })
      .finally(() => { if (active) setInventoryLoading(false); });
    return () => { active = false; };
  }, [activeTab, currentMerchantId]);
  const visibleInventoryBalances = inventoryBalances.filter(balance => {
    const query = inventorySearch.trim().toLowerCase();
    return !query || `${balance.product.styleNo} ${balance.product.name} ${balance.sku} ${balance.color || ''} ${balance.size || ''} ${balance.location.name}`.toLowerCase().includes(query);
  });
  const submitInventoryAdjustment = async () => {
    if (!inventoryAdjustment || inventoryBusy) return;
    const desiredQuantity = Number(inventoryAdjustment.quantity);
    const quantity = desiredQuantity - inventoryAdjustment.balance.onHandQuantity;
    if (!Number.isInteger(desiredQuantity) || desiredQuantity < 0 || !inventoryAdjustment.note.trim()) {
      addNotification('warning', '商品件数信息不完整', '请输入不小于 0 的整数件数和调整原因');
      return;
    }
    if (quantity === 0) {
      setInventoryAdjustment(null);
      return;
    }
    setInventoryBusy(true);
    try {
      const result = await apiPost<{ success: true; balance: InventoryBalance }>('/api/merchant/inventory/adjustments', {
        balanceId: inventoryAdjustment.balance.id,
        variantId: inventoryAdjustment.balance.variantId,
        locationId: inventoryAdjustment.balance.location.id,
        version: inventoryAdjustment.balance.version,
        quantity,
        note: inventoryAdjustment.note
      });
      setInventoryBalances(previous => previous.map(balance => balance.id === result.balance.id ? result.balance : balance));
      setInventoryMovements(previous => [{
        id: `local-${Date.now()}`, quantity, movementType: 'adjustment', note: inventoryAdjustment.note,
        createdAt: new Date().toISOString(),
        variant: { sku: result.balance.sku, color: result.balance.color, size: result.balance.size, product: result.balance.product },
        location: { code: result.balance.location.code, name: result.balance.location.name }
      }, ...previous]);
      setInventoryAdjustment(null);
      addNotification('success', '库存已更新', `${result.balance.sku} 当前可用库存 ${result.balance.availableQuantity} 件`);
    } catch (error) {
      addNotification('warning', '库存更新失败', error instanceof Error ? error.message : '库存版本可能已变化，请刷新后重试');
    } finally {
      setInventoryBusy(false);
    }
  };
  const uploadOrderDocument = async (order: Order, documentType: string, file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 6 * 1024 * 1024) {
      addNotification('warning', '文件不符合要求', '支持 PDF、JPG、PNG、WebP，单个文件不超过 6MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      try {
        await apiPost(`/api/merchant/orders/${encodeURIComponent(order.id)}/documents`, {
          documentType, fileName: file.name, mimeType: file.type, storageUrl: reader.result
        });
        addNotification('success', '单据已上传', `${file.name} 已归档到订单 ${order.orderNo}`);
      } catch (error) {
        addNotification('warning', '单据上传失败', error instanceof Error ? error.message : '请稍后重试');
      }
    };
    reader.onerror = () => addNotification('warning', '文件读取失败', '请重新选择文件');
    reader.readAsDataURL(file);
  };
  const sendOrderDocument = async (order: Order) => {
    const recipient = window.prompt('发送到邮箱', order.companyName ? '' : '');
    if (!recipient) return;
    try {
      const result = await apiPost<{ success: true; shareUrl: string }>(`/api/merchant/orders/${encodeURIComponent(order.id)}/documents/send`, { recipient });
      await navigator.clipboard?.writeText(result.shareUrl);
      addNotification('success', '单据已发送', '邮件已发送，分享链接也已复制');
    } catch (error) {
      addNotification('warning', '单据发送失败', error instanceof Error ? error.message : '请检查邮件配置');
    }
  };
  const createOrderInvoice = async (order: Order) => {
    try {
      const result = await apiGet<{ success: true; invoice: { invoiceNo: string } }>(`/api/merchant/orders/${encodeURIComponent(order.id)}/invoice`);
      addNotification('success', '发票已开具', result.invoice.invoiceNo);
    } catch (error) {
      addNotification('warning', '开票失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  const renderOrderActionMenu = (order: Order) => {
    const isOpen = orderActionMenuId === order.id;
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          aria-label={`操作 ${order.orderNo}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setOrderActionMenuId(current => current === order.id ? null : order.id)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOrderActionMenuId(null);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          操作<MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {isOpen && (
          <div role="menu" aria-label={`订单 ${order.orderNo} 操作`} className="absolute right-0 top-full z-30 mt-1 min-w-28 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-left shadow-lg">
            <button type="button" role="menuitem" onClick={() => {
              setOrderActionMenuId(null);
              window.open(`/api/merchant/orders/${encodeURIComponent(order.id)}/print?document=invoice`, '_blank', 'noopener,noreferrer');
            }} className="block w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">打印</button>
            <button type="button" role="menuitem" onClick={() => {
              setOrderActionMenuId(null);
              void createOrderInvoice(order);
            }} className="block w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">开票</button>
            <button type="button" role="menuitem" onClick={() => {
              setOrderActionMenuId(null);
              void sendOrderDocument(order);
            }} className="block w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">发送</button>
          </div>
        )}
      </div>
    );
  };
  const refreshMaterials = async () => {
    const [result, movementResult] = await Promise.all([
      apiGet<{ success: true; materials: Material[] }>('/api/merchant/materials'),
      apiGet<{ success: true; movements: MaterialMovement[] }>('/api/merchant/material-movements?limit=100')
    ]);
    setMaterials(result.materials);
    setMaterialsLoaded(true);
    setMaterialMovements(movementResult.movements);
    if (!result.materials.some(material => material.id === materialInbound.materialId && material.status === 'active')) {
      const firstActive = result.materials.find(material => material.status === 'active');
      setMaterialInbound(previous => ({ ...previous, materialId: firstActive?.id || '' }));
    }
  };
  const openMaterialEditor = (material?: Material) => {
    if (!material) {
      setEditingMaterialId(null);
      setEditingMaterialUnitLocked(false);
      setMaterialForm(emptyMaterialForm);
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
  };
  const saveMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (materialBusy) return;
    const unitCost = Number(materialForm.unitCost);
    const reorderPoint = Number(materialForm.reorderPoint);
    const leadTimeDays = Number(materialForm.leadTimeDays);
    if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(reorderPoint) || reorderPoint < 0
      || !Number.isInteger(leadTimeDays) || leadTimeDays < 0) {
      addNotification('warning', '物料资料不正确', '成本、安全库存需为非负数，交期需为非负整数');
      return;
    }
    setMaterialBusy(true);
    try {
      const payload = {
        ...materialForm,
        code: materialForm.code.trim().toUpperCase(),
        name: materialForm.name.trim(),
        unitCost,
        reorderPoint,
        leadTimeDays
      };
      if (editingMaterialId) {
        await apiPut(`/api/merchant/materials/${encodeURIComponent(editingMaterialId)}`, payload);
      } else {
        await apiPost('/api/merchant/materials', payload);
      }
      await refreshMaterials();
      setMaterialForm(emptyMaterialForm);
      setEditingMaterialId(null);
      setEditingMaterialUnitLocked(false);
      addNotification('success', editingMaterialId ? '物料资料已更新' : '物料已创建', `${payload.code} · ${payload.name}`);
    } catch (error) {
      addNotification('warning', editingMaterialId ? '物料更新失败' : '物料创建失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setMaterialBusy(false);
    }
  };
  useEffect(() => {
    if (activeTab !== 'materials' || !currentMerchantId) return;
    void refreshMaterials().catch(error => {
      console.error('[merchant-materials]', error);
      addNotification('warning', '面辅料数据读取失败', '请稍后重试');
    });
  }, [activeTab, currentMerchantId]);
  useEffect(() => {
    if (activeTab !== 'dashboard' || !currentMerchantId || materialsLoaded) return;
    void apiGet<{ success: true; materials: Material[] }>('/api/merchant/materials')
      .then(result => {
        setMaterials(result.materials);
        setMaterialsLoaded(true);
      })
      .catch(error => {
        console.error('[merchant-dashboard-material-alerts]', error);
        addNotification('warning', '物料库存读取失败', '请稍后重试');
      });
  }, [activeTab, currentMerchantId, materialsLoaded, addNotification]);
  const askOperatingAssistant = async (question: string, options: { openPanel?: boolean; onReply?: (reply: string) => void; formatReply?: (reply: string) => string; context?: string; scope?: string; forcePageContext?: boolean } = {}) => {
    if (!question.trim() || assistantBusy) return false;
    const requestContext = options.context || (options.forcePageContext
      ? activeTab === 'dashboard'
        ? dashboardNavSection === 'analytics' ? 'analytics' : 'dashboard'
        : activeTab
      : assistantRequestContext);
    const requestScope = options.scope || (options.forcePageContext ? assistantContextScope : assistantRequestScope);
    const requestContextKey = `${requestContext}:${requestScope}`;
    if (options.openPanel !== false) {
      setAssistantPanelOpen(true);
      setAssistantPanelExpanded(true);
      setAssistantConversationMenuOpen(false);
      setAssistantSettingsOpen(false);
      setAssistantPromptMenuOpen(false);
    }
    setAssistantBusy(true);
    setAssistantCoreFailed(false);
    assistantCoreLife.emit({ type: 'message:submit' });
    assistantCoreLife.emit({ type: 'response:start' });
    try {
      const result = await apiPost<{
        success: true;
        reply: string;
        actions: AssistantAction[];
        summary?: AssistantSummary;
        dataBasis?: string[];
        product?: AssistantProductCard;
        conversationId: string;
        conversationTitle: string;
        conversationUpdatedAt: string;
        messageCount: number;
        messageId: string;
      }>('/api/merchant/assistant/query', {
        question,
        conversationId: assistantContextKeyRef.current === requestContextKey ? assistantConversationId : null,
        context: requestContext,
        scope: requestScope,
        pageContext: assistantUsesPageContext || options.forcePageContext ? createCurrentPageContext() : undefined
      }, 30_000, { 'Idempotency-Key': `assistant-${crypto.randomUUID()}` });
      const reply = options.formatReply?.(result.reply) || result.reply;
      options.onReply?.(reply);
      if (assistantContextKeyRef.current !== requestContextKey) return true;
      setAssistantConversationId(result.conversationId);
      setAssistantAnswer({ reply, actions: result.actions, summary: result.summary, product: result.product });
      setAssistantHistory([
        ...assistantHistory.slice(-98),
        { role: 'user', text: question.trim() },
        { role: 'assistant', id: result.messageId, text: '', product: result.product }
      ]);
      revealAssistantAnswer(result.messageId, reply, () => flashAssistantCoreSuccess());
      setAssistantConversations(current => [
        {
          id: result.conversationId,
          title: result.conversationTitle,
          updatedAt: result.conversationUpdatedAt,
          messageCount: result.messageCount
        },
        ...current.filter(conversation => conversation.id !== result.conversationId)
      ].slice(0, 30));
      setAssistantQuestion('');
      return true;
    } catch (error) {
      assistantCoreLife.emit({ type: 'response:error' });
      setAssistantCoreFailed(true);
      addNotification('warning', '经营助手暂时不可用', error instanceof Error ? error.message : '请稍后重试');
      return false;
    } finally {
      setAssistantBusy(false);
    }
  };
  const submitAssistantTask = async (message: string) => {
    if (!message.trim() || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantQuestion('');
    try {
      const preview = await apiPost<{
        success: true;
        workflow: string;
        goal: string;
        agents: string[];
        tools: string[];
        summary: string;
        sideEffects: string;
        requiresApprovalForSensitiveActions: boolean;
      }>('/api/merchant/modagpt/task/preview', { message: message.trim() });
      setAssistantTaskPreview({ message: message.trim(), ...preview });
    } catch (error) {
      addNotification('warning', '无法准备 ModaUI 任务', error instanceof Error ? error.message : '请检查任务内容和权限');
    } finally {
      setAssistantBusy(false);
    }
  };

  const confirmAssistantTask = async () => {
    const preview = assistantTaskPreview;
    if (!preview || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantTaskPreview(null);
    setAssistantTaskMode(false);
    setAssistantHistory(current => [...current, { role: 'user', text: preview.message }]);
    try {
      const created = await apiPost<{
        success: true;
        taskId: string;
        status: string;
        summary: string;
      }>('/api/merchant/modagpt/task', {
        message: preview.message,
        conversationId: assistantConversationId || undefined,
        inputs: {}
      }, 30_000, { 'Idempotency-Key': `merchant-task-${crypto.randomUUID()}` });
      setAssistantHistory(current => [...current, {
        role: 'assistant',
        text: `任务已提交到服务端队列（${created.taskId}），当前状态：${created.status}。队列接收不代表业务操作已完成。`
      }]);
      let latest: {
        runtimeStatus: string;
        status: string;
        summary: string | null;
        approvalId: string | null;
        errors: string[];
      } | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        const task = await apiGet<{
          success: true;
          runtimeStatus: string;
          status: string;
          summary: string | null;
          approvalId: string | null;
          errors: string[];
        }>(`/api/merchant/modagpt/task/${encodeURIComponent(created.taskId)}`);
        latest = task;
        if (['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(task.runtimeStatus)) break;
      }
      if (!latest) throw new Error('MODAGPT_TASK_STATUS_INVALID');
      const taskMessage = latest.runtimeStatus === 'waiting_approval'
        ? `任务已等待商家审批${latest.approvalId ? `（审批编号 ${latest.approvalId}）` : ''}，尚未执行需审批的操作。${latest.summary || ''}`
        : ['failed', 'dead_letter', 'cancelled'].includes(latest.runtimeStatus)
          ? `任务未完成（${latest.runtimeStatus}）：${latest.errors.join('、') || '请检查任务状态后重试。'}`
          : latest.runtimeStatus === 'completed'
            ? `任务已完成：${latest.summary || latest.status}。`
            : `任务仍在处理中，任务编号：${created.taskId}。`;
      setAssistantHistory(current => [...current, { role: 'assistant', text: taskMessage }]);
    } catch (error) {
      addNotification('warning', 'ModaUI 任务未能确认', error instanceof Error ? error.message : '请检查任务状态后重试');
    } finally {
      setAssistantBusy(false);
    }
  };
  const showAssistantLocalReply = (question: string, reply: string) => {
    setAssistantPanelOpen(true);
    setAssistantPanelExpanded(true);
    setAssistantQuestion('');
    setAssistantAnswer({ reply, actions: [] });
    setAssistantHistory(current => [
      ...current.slice(-98),
      { role: 'user', text: question.trim() },
      { role: 'assistant', text: reply }
    ]);
  };
  useEffect(() => {
    if (assistantPanelOpen && assistantPanelExpanded) {
      assistantMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [assistantHistory, assistantBusy, assistantPanelOpen, assistantPanelExpanded]);
  const openAssistantProduct = (productId: string) => {
    setProductViewMode('pos');
    setProductWorkspaceSection('catalog');
    setActiveTab('products');
    setProductSearch('');
    setProductLifecycleFilter('all');
    setProductZoneFilter('all');
    setProductCategoryFilter('all');
    setProductQuickView('all');
    setAssistantFocusedProductId(productId);
    window.setTimeout(() => {
      document.getElementById(`merchant-product-${productId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    window.setTimeout(() => setAssistantFocusedProductId(current => current === productId ? null : current), 2600);
  };
  const startNewAssistantConversation = () => {
    if (assistantBusy) return;
    setAssistantConversationId(null);
    setAssistantHistory([]);
    setAssistantAnswer(null);
    setAssistantQuestion('');
    setAssistantConversationMenuOpen(false);
    setAssistantSettingsOpen(false);
    setAssistantPromptMenuOpen(false);
  };
  const openAssistantConversation = async (conversationId: string) => {
    const requestContextKey = assistantContextKeyRef.current;
    try {
      const result = await apiGet<{
        success: true;
        conversation: {
          id: string;
          title: string;
          messages: Array<{
            id: string;
            role: string;
            text: string;
            actions?: AssistantAction[];
            summary?: AssistantSummary;
            product?: AssistantProductCard;
          }>;
        };
      }>(`/api/merchant/assistant/conversations/${encodeURIComponent(conversationId)}?${new URLSearchParams({ context: assistantRequestContext, scope: assistantRequestScope })}`);
      if (assistantContextKeyRef.current !== requestContextKey) return;
      const messages = result.conversation.messages;
      setAssistantConversationId(result.conversation.id);
      setAssistantHistory(messages.flatMap(message =>
        message.role === 'user' || message.role === 'assistant'
          ? [{ role: message.role, text: message.text, id: message.id, product: message.product }]
          : []
      ));
      const lastAssistantMessage = [...messages].reverse().find(message => message.role === 'assistant');
      setAssistantAnswer(lastAssistantMessage ? {
        reply: lastAssistantMessage.text,
        actions: lastAssistantMessage.actions || [],
        summary: lastAssistantMessage.summary,
        product: lastAssistantMessage.product
      } : null);
      setAssistantPanelOpen(true);
      setAssistantPanelExpanded(true);
      setAssistantConversationMenuOpen(false);
      setAssistantSettingsOpen(false);
    } catch (error) {
      addNotification('warning', '无法打开助手历史', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  /** 删除只移除选中的这条 AI 回复；最新回复的汇总卡片一并撤下，避免留下无来源数据。 */
  const removeAssistantTurn = (index: number) => {
    if (index === assistantHistory.length - 1) setAssistantAnswer(null);
    setAssistantHistory(current => current.filter((_, currentIndex) => currentIndex !== index));
  };
  const deleteAssistantConversation = async (conversationId: string) => {
    if (assistantBusy || !window.confirm(localizeCopy('确定删除这段 GPTmoda 对话及其历史记录吗？', 'Eliminare questa conversazione e la cronologia?'))) return;
    try {
      await apiDelete(`/api/merchant/assistant/conversations/${encodeURIComponent(conversationId)}`);
      setAssistantConversations(current => current.filter(conversation => conversation.id !== conversationId));
      if (assistantConversationId === conversationId) startNewAssistantConversation();
    } catch (error) {
      addNotification('warning', '删除助手历史失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  const saveAssistantMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = assistantMemoryDraft.trim();
    if (!content || assistantMemorySaving) return;
    setAssistantMemorySaving(true);
    try {
      const result = await apiPost<{ success: true; memory: AssistantMemory }>('/api/merchant/assistant/memories', { content });
      setAssistantMemories(current => [result.memory, ...current]);
      setAssistantMemoryDraft('');
      addNotification('success', '已保存助手偏好', '此偏好将用于你后续的 GPTmoda 对话');
    } catch (error) {
      addNotification('warning', '保存助手偏好失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setAssistantMemorySaving(false);
    }
  };
  const deleteAssistantMemory = async (memoryId: string) => {
    try {
      await apiDelete(`/api/merchant/assistant/memories/${encodeURIComponent(memoryId)}`);
      setAssistantMemories(current => current.filter(memory => memory.id !== memoryId));
    } catch (error) {
      addNotification('warning', '删除助手偏好失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  const refreshProduction = async () => {
    const [workOrders, balances] = await Promise.all([
      apiGet<{ success: true; workOrders: ProductionWorkOrder[] }>('/api/merchant/production/work-orders'),
      apiGet<{ success: true; balances: ProductionBalance[] }>('/api/merchant/inventory/balances?pageSize=500')
    ]);
    setProductionWorkOrders(workOrders.workOrders);
    setProductionBalances(balances.balances);
    const first = balances.balances[0];
    if (first) setProductionForm(previous => ({
      ...previous,
      variantId: previous.variantId || first.variantId,
      outputLocationId: previous.outputLocationId || first.location.id
    }));
  };
  useEffect(() => {
    setInventoryBalances([]);
    setInventoryBalancesLoaded(false);
  }, [currentMerchantId]);
  useEffect(() => {
    if (activeTab !== 'production' || !currentMerchantId) return;
    void refreshProduction().catch(error => {
      console.error('[merchant-production]', error);
      addNotification('warning', '生产数据加载失败', '请稍后刷新重试');
    });
  }, [activeTab, currentMerchantId]);
  useEffect(() => {
    if (!currentMerchantId) return;
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown }>).detail?.resources;
      if (!Array.isArray(resources) || !resources.every(resource => typeof resource === 'string')) return;
      if (resources.some(resource => ['products', 'orders', 'inventory', 'customers', 'finance', 'content'].includes(resource))) {
        void refreshMerchantOperations();
      }
      if (resources.includes('settings')) {
        setSettingsSyncNonce(value => value + 1);
      }
      if (resources.includes('production')) {
        if (activeTab === 'production') {
          void refreshProduction().catch(error => console.error('[merchant-production-sync]', error));
        }
        if (activeTab === 'materials') {
          void refreshMaterials().catch(error => console.error('[merchant-materials-sync]', error));
        }
      }
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
  }, [currentMerchantId, activeTab]);
  const [businessCardOpen, setBusinessCardOpen] = useState(false);
  if (!currentMerchantId || !currentMerchant) {
    return null;
  }
  const merchantSubdomainUrl = merchantStorefrontOrigin(currentMerchant.storeSlug || currentMerchant.slug || currentMerchant.id);
  const merchantSharePath = merchantSubdomainUrl;
  const merchantLogo = merchantMediaUrl(currentMerchant.logo, DEFAULT_MERCHANT_LOGO);

  // 严格数据隔离：只筛选属于该商家的商品
  const merchantProducts = serverProducts ?? products.filter(p => p.merchantId === currentMerchantId);
  const [productSearch, setProductSearch] = useState('');
  const [productLifecycleFilter, setProductLifecycleFilter] = useState('all');
  const [productZoneFilter, setProductZoneFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSort, setProductSort] = useState('updated');
  const [productQuickView, setProductQuickView] = useState<'all' | 'published' | 'draft' | 'archived' | 'low-stock' | 'under-five' | 'no-image' | 'clearance' | 'private'>('all');
  const standardInventoryLoaded = inventoryBalancesLoaded;
  const productStock = new Map<string, number>();
  const productAvailableStock = new Map<string, number>();
  const skuStock = new Map<string, number>();
  inventoryBalances.forEach(balance => {
    productStock.set(balance.product.id, (productStock.get(balance.product.id) || 0) + balance.onHandQuantity);
    productAvailableStock.set(balance.product.id, (productAvailableStock.get(balance.product.id) || 0) + balance.onHandQuantity - balance.reservedQuantity);
    skuStock.set(balance.sku, (skuStock.get(balance.sku) || 0) + balance.onHandQuantity);
  });
  const getProductStock = (product: Product) => standardInventoryLoaded
    ? (productStock.get(product.id) || 0)
    : (product.skus || []).reduce((sum, sku) => sum + (sku.stockCentral || 0), 0);
  const getProductAvailableStock = (product: Product) => standardInventoryLoaded
    ? (productAvailableStock.get(product.id) || 0)
    : getProductStock(product);
  const visibleMerchantProducts = merchantProducts
    .filter(product => {
      const query = productSearch.trim().toLocaleLowerCase();
      const matchesSearch = !query || [
        product.styleNo,
        product.name,
        product.name_zh,
        product.name_it,
        product.category,
        product.subCategory,
        product.brand,
        product.fabric,
        ...(product.skus || []).flatMap(sku => [sku.sku, sku.barcode, sku.color, sku.size])
      ].some(value => value?.toLocaleLowerCase().includes(query));
      const matchesLifecycle = productLifecycleFilter === 'all' || (product.lifecycleStatus || 'published') === productLifecycleFilter;
      const zone = getProductZone(product);
      const matchesZone = productZoneFilter === 'all' || zone === productZoneFilter;
      const matchesCategory = productCategoryFilter === 'all' || product.category === productCategoryFilter;
      const stock = getProductStock(product);
      const matchesQuickView = productQuickView === 'all'
        || (productQuickView === 'published' && product.lifecycleStatus === 'published')
        || (productQuickView === 'draft' && product.lifecycleStatus === 'draft')
        || (productQuickView === 'archived' && product.lifecycleStatus === 'archived')
        || (productQuickView === 'low-stock' && stock < 20)
        || (productQuickView === 'under-five' && getProductAvailableStock(product) < 5)
        || (productQuickView === 'no-image' && !(product.media?.some(media => media.type === 'image' && Boolean(media.url)) || product.images?.some(Boolean)))
        || (productQuickView === 'clearance' && zone === 'clearance')
        || (productQuickView === 'private' && zone === 'private');
      return matchesSearch && matchesLifecycle && matchesZone && matchesCategory && matchesQuickView;
    })
    .sort((left, right) => {
      if (productSort === 'name') return left.name.localeCompare(right.name);
      if (productSort === 'price-asc') return left.wholesalePrice - right.wholesalePrice;
      if (productSort === 'price-desc') return right.wholesalePrice - left.wholesalePrice;
      if (productSort === 'stock-asc') return getProductStock(left) - getProductStock(right);
      return (right.updatedAt || right.createdAt || '').localeCompare(left.updatedAt || left.createdAt || '');
    });
  const merchantProductIds = new Set(merchantProducts.map(p => p.id));
  const merchantStyleNos = new Set(merchantProducts.map(p => p.styleNo));
  const categoryMembershipCategory = storeCategories.find(category => category.id === categoryMembershipId) || null;
  const visibleStoreCategories = storeCategories.filter(category =>
    category.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase())
  );
  const categoryMembershipVisibleProducts = merchantProducts.filter(product => {
    const query = categoryMembershipSearch.trim().toLocaleLowerCase();
    return !query || [product.styleNo, product.name, product.name_zh, product.name_it, ...(product.skus || []).map(sku => sku.sku)]
      .some(value => value?.toLocaleLowerCase().includes(query));
  });

  // 严格数据隔离：只筛选包含该商家款式的订单
  const fallbackMerchantOrders = orders.flatMap(order => {
    if (order.merchantId === currentMerchantId) return [order];
    if (order.subOrders?.length) {
      return order.subOrders.filter(subOrder => subOrder.merchantId === currentMerchantId);
    }

    const merchantItems = order.items.filter(item => merchantProductIds.has(item.productId) || merchantStyleNos.has(item.styleNo));
    if (merchantItems.length === 0) return [];

    return [{
      ...order,
      items: merchantItems,
      totalQty: merchantItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: Number(merchantItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
      merchantId: currentMerchantId,
      merchantName: currentMerchant.name
    }];
  });
  const merchantOrders = serverOrders ?? fallbackMerchantOrders;
  const productSales30d = new Map<string, { quantity: number; amount: number }>();
  for (const order of merchantOrders) {
    const createdAt = new Date(order.createdAt || `${order.date}T00:00:00`);
    if (!Number.isFinite(createdAt.getTime()) || Date.now() - createdAt.getTime() > 30 * 24 * 60 * 60 * 1000) continue;
    for (const item of order.items) {
      const key = item.productId || item.styleNo;
      const current = productSales30d.get(key) || { quantity: 0, amount: 0 };
      current.quantity += item.quantity;
      current.amount += item.quantity * item.unitPrice;
      productSales30d.set(key, current);
    }
  }
  const productSalesRank = merchantProducts
    .map(product => ({
      product,
      sales: productSales30d.get(product.id) || productSales30d.get(product.styleNo) || { quantity: 0, amount: 0 }
    }))
    .filter(entry => entry.sales.quantity > 0)
    .sort((left, right) => right.sales.quantity - left.sales.quantity)
    .slice(0, 5);
  const productUnderFiveCount = merchantProducts.filter(product =>
    getProductAvailableStock(product) < 5
  ).length;

  // 严格数据隔离：买手向该商家发起的看货申请
  const merchantVaultRequests = serverVaultRequests ?? vaultRequests.filter(vr => vr.merchantId === currentMerchantId);

  const merchantCustomerIds = new Set([
    ...merchantOrders.map(order => order.customerId),
    ...merchantVaultRequests.map(request => request.customerId)
  ]);
  const merchantCustomers: MerchantCustomer[] = serverCustomers ?? allCustomers
    .filter(customer => merchantCustomerIds.has(customer.id))
    .map(customer => ({ ...customer, registrationDate: customer.appliedAt, createdAt: customer.appliedAt }));
  const assistedOrderCustomers = merchantCustomers.filter(customer => customer.status === 'approved' || customer.status === 'pending');
  const assistedOrderVisibleCustomers = assistedOrderCustomers.filter(customer =>
    `${customer.companyName} ${customer.contactPerson} ${customer.email}`.toLocaleLowerCase()
      .includes(assistedOrderCustomerSearch.trim().toLocaleLowerCase())
  );
  const assistedOrderProducts = merchantProducts.filter(product =>
    product.lifecycleStatus === 'published' && product.skus.some(sku => sku.isActive !== false)
  );
  const assistedOrderVisibleProducts = assistedOrderProducts.filter(product =>
    `${product.styleNo} ${product.name}`.toLocaleLowerCase().includes(assistedOrderProductSearch.trim().toLocaleLowerCase())
  );
  const assistedOrderSelectedCustomer = assistedOrderCustomers.find(customer => customer.id === assistedOrderCustomerId);
  const assistedOrderSubtotal = assistedOrderItems.reduce((sum, line) => {
    const product = merchantProducts.find(candidate => candidate.id === line.productId);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity)) return sum;
    const styleQuantity = assistedOrderItems
      .filter(item => item.productId === line.productId)
      .reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    const unitPrice = Number((
      getProductWholesalePriceForQuantity(product.wholesalePrice, product.wholesalePrice100, styleQuantity, product.bulkPriceMinimumQuantity)
      * (assistedOrderSelectedCustomer?.discountRate ?? 1)
    ).toFixed(2));
    return sum + unitPrice * quantity;
  }, 0);
  const assistedOrderItemCount = assistedOrderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const assistedOrderEstimatedTotal = assistedOrderSubtotal
    + (Number(assistedOrderShippingFee) || 0)
    + (Number(assistedOrderAdditionalFees) || 0);
  const customerOrderStats = new Map<string, { orders: Order[]; spend: number; latestOrderAt: number | null; recentOrderCount: number }>();
  for (const order of merchantOrders) {
    const current = customerOrderStats.get(order.customerId) || { orders: [], spend: 0, latestOrderAt: null, recentOrderCount: 0 };
    const timestamp = new Date(order.createdAt || `${order.date}T00:00:00`).getTime();
    current.orders.push(order);
    current.spend += order.totalAmount;
    if (Number.isFinite(timestamp)) {
      current.latestOrderAt = current.latestOrderAt === null ? timestamp : Math.max(current.latestOrderAt, timestamp);
      if (timestamp >= Date.now() - 90 * 24 * 60 * 60 * 1000 && timestamp <= Date.now()) current.recentOrderCount += 1;
    }
    customerOrderStats.set(order.customerId, current);
  }
  const getCustomerOrderStats = (customerId: string) =>
    customerOrderStats.get(customerId) || { orders: [], spend: 0, latestOrderAt: null, recentOrderCount: 0 };
  const getCustomerOrderCountWithin = (customerId: string, days: number) => getCustomerOrderStats(customerId).orders.filter(order => {
    const timestamp = new Date(order.createdAt || `${order.date}T00:00:00`).getTime();
    return Number.isFinite(timestamp) && timestamp >= Date.now() - days * 24 * 60 * 60 * 1000 && timestamp <= Date.now();
  }).length;
  const customerCountryOptions = [...new Set(merchantCustomers.map(customer => customer.country).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const customerMatchesCountry = (country: string, filter: string) => filter === 'all'
    || (filter === '__italy__' ? /^(italy|italia)$/i.test(country) : country === filter);
  const visibleMerchantCustomers = merchantCustomers.filter(customer => {
    const query = customerSearch.trim().toLocaleLowerCase();
    if (query && ![customer.companyName, customer.contactPerson, customer.email, customer.phone, customer.vatNumber, customer.city, customer.country, ...(customer.merchantTags || [])]
      .some(value => value?.toLocaleLowerCase().includes(query))) return false;
    if (customerStatusFilter !== 'all' && customer.status !== customerStatusFilter) return false;
    if (!customerMatchesCountry(customer.country, customerCountryFilter)) return false;
    const stats = getCustomerOrderStats(customer.id);
    if (customerSegment === 'repeat' && stats.orders.length < 2) return false;
    if (customerSegment === 'new') {
      const created = new Date(customer.registrationDate || customer.createdAt || '').getTime();
      if (!Number.isFinite(created) || created < Date.now() - 30 * 24 * 60 * 60 * 1000) return false;
    }
    if (customerSegment === 'at-risk' && (stats.orders.length < 2 || stats.latestOrderAt === null || stats.latestOrderAt > Date.now() - 60 * 24 * 60 * 60 * 1000)) return false;
    if (customerSegment === 'no-orders' && stats.orders.length > 0) return false;
    const minimumOrders = Number(customerMinOrders);
    if (customerMinOrders && (!Number.isInteger(minimumOrders) || getCustomerOrderCountWithin(customer.id, Number(customerLookbackDays) || 90) < minimumOrders)) return false;
    const lookbackDays = Number(customerLookbackDays);
    if (customerLookbackDays && (stats.latestOrderAt === null || stats.latestOrderAt < Date.now() - lookbackDays * 24 * 60 * 60 * 1000)) return false;
    return true;
  }).sort((left, right) =>
    (getCustomerOrderStats(right.id).latestOrderAt ?? -Infinity) -
    (getCustomerOrderStats(left.id).latestOrderAt ?? -Infinity)
  );
  const activeCustomerFilterCount = [
    customerStatusFilter !== 'all',
    customerCountryFilter !== 'all',
    customerSegment !== 'all',
    Boolean(customerMinOrders),
    Boolean(customerLookbackDays)
  ].filter(Boolean).length;
  const visibleCustomerTotalSpend = visibleMerchantCustomers.reduce(
    (total, customer) => total + getCustomerOrderStats(customer.id).spend,
    0
  );
  const customerTotalSpend = [...customerOrderStats.values()].reduce((total, stats) => total + stats.spend, 0);
  const customerRepeatCount = merchantCustomers.filter(customer => getCustomerOrderStats(customer.id).orders.length >= 2).length;
  const customerAtRiskCount = merchantCustomers.filter(customer => {
    const stats = getCustomerOrderStats(customer.id);
    return stats.orders.length >= 2 && stats.latestOrderAt !== null && stats.latestOrderAt <= Date.now() - 60 * 24 * 60 * 60 * 1000;
  }).length;
  const customerRecentCount = merchantCustomers.filter(customer => {
    const created = new Date(customer.registrationDate || customer.createdAt || '').getTime();
    return Number.isFinite(created) && created >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;
  const customerRegionRank = [...merchantCustomers.reduce((regions, customer) => {
    const region = customer.country || '未填写国家';
    regions.set(region, (regions.get(region) || 0) + 1);
    return regions;
  }, new Map<string, number>())].sort((left, right) => right[1] - left[1]).slice(0, 5);
  const nonDemoMerchantOrders = merchantOrders.filter(order => !order.notes?.includes('[RUDA_DEMO]'));
  const ordersInSelectedDateRange = orderDateRange === 'all'
    ? nonDemoMerchantOrders
    : nonDemoMerchantOrders.filter(order => {
      const orderDate = new Date(order.createdAt || `${order.date}T00:00:00`);
      const orderAge = Date.now() - orderDate.getTime();
      return Number.isFinite(orderDate.getTime()) && orderAge >= 0 && orderAge <= Number(orderDateRange) * 24 * 60 * 60 * 1000;
    });
  const visibleMerchantOrders = ordersInSelectedDateRange
    .filter(order => {
      if (orderStatusFilter === 'needs_action' && !order.currentTasks?.merchant.action) return false;
      if (orderStatusFilter === 'in_progress' && !['confirmed', 'picking', 'shipped'].includes(order.status)) return false;
      if (orderStatusFilter === 'logistics_exception' && !order.hasLogisticsException) return false;
      if (orderStatusFilter === 'complete' && !['delivered', 'returned', 'cancelled'].includes(order.status)) return false;
      if (orderPaymentFilter !== 'all' && order.paymentStatus !== orderPaymentFilter) return false;
      if (orderDeliveryFilter !== 'all' && order.deliveryType !== orderDeliveryFilter) return false;
      const query = orderSearch.trim().toLocaleLowerCase();
      if (!query) return true;
      const customer = merchantCustomers.find(candidate => candidate.id === order.customerId);
      return [
        order.orderNo, order.companyName, order.shippingAddress?.city, order.shippingAddress?.country, order.carrier, order.trackingNumber,
        order.notes, customer?.contactPerson, customer?.email, customer?.phone,
        ...order.items.flatMap(item => [item.styleNo, item.sku, item.productName])
      ].some(value => String(value || '').toLocaleLowerCase().includes(query));
    })
    .sort((left, right) => {
      const direction = orderSortDirection === 'asc' ? 1 : -1;
      if (orderSort === 'amount') return (left.totalAmount - right.totalAmount) * direction;
      if (orderSort === 'quantity') return (left.totalQty - right.totalQty) * direction;
      return (new Date(left.createdAt || `${left.date}T00:00:00`).getTime() - new Date(right.createdAt || `${right.date}T00:00:00`).getTime()) * direction;
    });
  const orderPageCount = Math.max(1, Math.ceil(visibleMerchantOrders.length / orderPageSize));
  const currentOrderPage = Math.min(orderPage, orderPageCount);
  const paginatedMerchantOrders = visibleMerchantOrders.slice((currentOrderPage - 1) * orderPageSize, currentOrderPage * orderPageSize);
  const selectedVisibleOrderCount = visibleMerchantOrders.filter(order => selectedOrderIds.includes(order.id)).length;
  useEffect(() => {
    setOrderPage(1);
    setSelectedOrderIds([]);
  }, [orderSearch, orderStatusFilter, orderDateRange, orderPaymentFilter, orderDeliveryFilter, orderSort, orderSortDirection]);
  useEffect(() => {
    if (orderPage !== currentOrderPage) setOrderPage(currentOrderPage);
  }, [orderPage, currentOrderPage]);
  const runOrderAiQuery = (question: string) => {
    const query = question.trim();
    if (!query || assistantBusy) return;
    if (/未付款|待付款|尚未付款|unpaid/i.test(query)) {
      setOrderPaymentFilter('unpaid');
      setOrderStatusFilter('all');
    } else if (/未发货|未履约|待发货|unfulfilled|not shipped/i.test(query)) {
      setOrderStatusFilter('in_progress');
      setOrderPaymentFilter('all');
    }
    const matchingCustomer = merchantCustomers
      .flatMap(customer => [customer.companyName, customer.contactPerson, customer.email])
      .filter((value): value is string => Boolean(value && value.length > 2 && query.toLocaleLowerCase().includes(value.toLocaleLowerCase())))
      .sort((left, right) => right.length - left.length)[0];
    const matchingOrder = merchantOrders.find(order => order.orderNo && query.toLocaleLowerCase().includes(order.orderNo.toLocaleLowerCase()));
    const matchingProduct = merchantOrders.flatMap(order => order.items)
      .map(item => item.styleNo || item.sku || item.productName)
      .filter((value): value is string => Boolean(value && value.length > 2 && query.toLocaleLowerCase().includes(value.toLocaleLowerCase())))
      .sort((left, right) => right.length - left.length)[0];
    const matchingCountry = [...new Set(merchantOrders.map(order => order.shippingAddress?.country).filter((value): value is string => Boolean(value && value.length > 2)))]
      .filter(country => query.toLocaleLowerCase().includes(country.toLocaleLowerCase()))
      .sort((left, right) => right.length - left.length)[0];
    const searchTerm = matchingOrder?.orderNo || matchingCustomer || matchingProduct || matchingCountry;
    if (searchTerm) setOrderSearch(searchTerm);
    void askOperatingAssistant(query, { openPanel: false, forcePageContext: true });
  };
  const openOrderDetail = (orderId: string) => {
    setAssistantPanelOpen(false);
    setSelectedOrderDetailId(orderId);
  };
  const getAssistedOrderErrorMessage = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      ASSISTED_ORDER_INPUT_INVALID: '收件信息、金额或费用信息不完整',
      ASSISTED_ORDER_ITEMS_INVALID: '商品或采购数量无效',
      ASSISTED_ORDER_DUPLICATE_SKU: '同一 SKU 请合并数量后再提交',
      ASSISTED_ORDER_CUSTOMER_NOT_AVAILABLE: '所选客户不属于当前商家或已不可用',
      ASSISTED_ORDER_CUSTOMER_EMAIL_REQUIRED: '该客户尚未绑定账户，请补充有效邮箱后再创建订单',
      ASSISTED_ORDER_PRODUCT_NOT_AVAILABLE: '所选商品已下架或不可用',
      ASSISTED_ORDER_SKU_NOT_AVAILABLE: '所选 SKU 已停用或不可用',
      ASSISTED_ORDER_MOQ_OR_PACK_SIZE_INVALID: '商品数量不符合 MOQ 或箱规',
      ASSISTED_ORDER_PRICE_INVALID: '商品价格数据无效，请刷新后重试',
      ASSISTED_ORDER_TOTAL_INVALID: '订单总金额无效，请核对商品和费用',
      ASSISTED_ORDER_BACKORDER_NOT_ALLOWED: '所选 SKU 现货不足，且商品规则不允许订货',
      ORDER_ITEM_SUPPLY_UNAVAILABLE: 'SKU 供货数据已变化，请与客户重新确认供货方案',
      IDEMPOTENCY_KEY_CONFLICT: '订单内容已变化，请返回列表重新创建',
      INVALID_ORDER_PAYMENT_METHOD: '当前订单链暂不支持该付款方式',
      INVALID_ORDER_PAYMENT_PLAN: '付款方案无效',
      PARTIAL_PREPAYMENT_VALUE_REQUIRED: '部分预付款请填写比例或金额',
      INVALID_PREPAYMENT_PERCENT: '预付款比例必须大于 0 且小于 100%',
      INVALID_PREPAYMENT_AMOUNT: '预付款金额必须小于订单总额',
      CUSTOM_PAYMENT_CONDITION_REQUIRED: '请填写自定义付款条件',
      REMAINING_BALANCE_DATE_REQUIRED: '请选择余款日期',
      INVALID_ORDER_TERMS_DATE: '预计交期或余款日期无效',
      EMAIL_ALREADY_EXISTS: '该邮箱已有平台账户，请让客户使用现有账户登录',
      BUYER_PROFILE_LINK_AMBIGUOUS: '该邮箱对应多个客户档案，需先由平台人工核验',
      BUYER_PROFILE_LINK_CONFLICT: '账户或客户资料已发生变化，请刷新后重试',
      EMAIL_VERIFICATION_NOT_CONFIGURED: '邮箱验证服务暂不可用，请联系平台管理员',
      EMAIL_DELIVERY_FAILED: '验证码邮件发送失败，请稍后重试'
    };
    return messages[message] || message || fallback;
  };
  const closeOrderDetail = () => {
    if (orderDetailHistoryActive.current) window.history.back();
    else setSelectedOrderDetailId(null);
  };
  const selectedOrderDetail = merchantOrders.find(order => order.id === selectedOrderDetailId) || null;
  const selectedOrderDetailIsDemo = Boolean(selectedOrderDetail?.notes?.includes('[RUDA_DEMO]'));
  const selectedOrderForAiEdit = selectedOrderIds.length === 1
    ? merchantOrders.find(order => order.id === selectedOrderIds[0]) || null
    : null;
  const selectedOrderDetailCustomer = selectedOrderDetail
    ? merchantCustomers.find(customer => customer.id === selectedOrderDetail.customerId)
    : undefined;
  const openDraftQuoteForm = (request = '') => {
    const normalizedRequest = request.toLocaleLowerCase();
    const approvedCustomers = merchantCustomers.filter(customer => customer.status === 'approved');
    const requestedCustomer = approvedCustomers
      .filter(customer => [customer.companyName, customer.contactPerson, customer.email].some(value => value && normalizedRequest.includes(value.toLocaleLowerCase())))
      .sort((left, right) => Math.max(right.companyName.length, right.contactPerson.length) - Math.max(left.companyName.length, left.contactPerson.length))[0];
    setDraftQuoteCustomerId(requestedCustomer?.id || approvedCustomers[0]?.id || '');
    const publishedProducts = merchantProducts.filter(product => product.lifecycleStatus === 'published');
    const requestedProduct = publishedProducts
      .filter(product => [product.styleNo, product.name, product.name_zh, product.name_it].some(value => value && normalizedRequest.includes(value.toLocaleLowerCase())))
      .sort((left, right) => Math.max(right.styleNo.length, right.name.length) - Math.max(left.styleNo.length, left.name.length))[0];
    const firstProduct = requestedProduct || publishedProducts[0];
    const requestedQuantity = Number(request.match(/(\d+)\s*(?:件|个|pcs|pieces)/i)?.[1]);
    setDraftQuoteItems(firstProduct ? [{
      productId: firstProduct.id,
      sku: firstProduct.skus[0]?.sku || '',
      quantity: Math.max(
        Math.ceil(firstProduct.moq / Math.max(1, firstProduct.packSize)),
        Number.isFinite(requestedQuantity) && requestedQuantity > 0
          ? Math.ceil(requestedQuantity / Math.max(1, firstProduct.packSize))
          : 0
      ) * Math.max(1, firstProduct.packSize)
    }] : []);
    setDraftQuoteNotes('');
    setDraftQuoteOpen(true);
  };
  const prepareOrderEdit = (order: Order) => {
    const currentTerms = order.agreementVersions?.at(-1)?.terms;
    setOrderEditTargetId(order.id);
    setOrderEditForm({
      street: order.shippingAddress?.street || '',
      city: order.shippingAddress?.city || '',
      country: order.shippingAddress?.country || '',
      zip: order.shippingAddress?.zip || '',
      notes: order.notes || '',
      items: order.items.map(item => ({
        id: item.id,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice)
      })),
      paymentPlan: currentTerms?.paymentPlan
        || (['net_30', 'net_30_days'].includes(order.paymentMethod) ? 'ship_before_payment' : 'full_prepayment'),
      paymentMethod: currentTerms?.paymentMethod || order.paymentMethod,
      prepaymentMode: 'percent',
      prepaymentValue: currentTerms?.paymentPlan === 'partial_prepayment' && order.totalAmount > 0
        ? String(Number((currentTerms.prepaymentAmount / order.totalAmount * 100).toFixed(2)))
        : '30',
      remainingBalanceTrigger: currentTerms?.remainingBalanceTrigger || 'before_shipment',
      remainingBalanceDueAt: currentTerms?.remainingBalanceDueAt?.slice(0, 10) || '',
      customPaymentCondition: currentTerms?.customPaymentCondition || '',
      supplyMode: currentTerms?.supplyMode || 'partial_shipments',
      expectedDeliveryAt: currentTerms?.expectedDeliveryAt?.slice(0, 10) || '',
      shippingFee: String(currentTerms?.shippingFee ?? order.shippingFee ?? 0),
      discountAmount: String(currentTerms?.discountAmount ?? order.discountAmount ?? 0)
    });
    setOrderEditOpen(true);
  };
  const saveOrderEdit = async (event: React.FormEvent, order: Order) => {
    event.preventDefault();
    if (orderEditBusy) return;
    setOrderEditBusy(true);
    try {
      const result = await apiPut<{
        success: true;
        order?: Order;
        agreement?: { version: number };
        awaitingBuyerConfirmation?: boolean;
      }>(`/api/merchant/orders/${encodeURIComponent(order.id)}/edit`, {
        companyName: order.companyName,
        deliveryType: order.deliveryType,
        paymentMethod: orderEditForm.paymentMethod,
        pickupLocation: order.pickupLocation,
        shippingAddress: orderEditForm,
        notes: orderEditForm.notes,
        proposeAgreement: true,
        items: orderEditForm.items.map(item => ({
          id: item.id,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        })),
        terms: {
          paymentPlan: orderEditForm.paymentPlan,
          paymentMethod: orderEditForm.paymentMethod,
          ...(orderEditForm.paymentPlan === 'partial_prepayment'
            ? orderEditForm.prepaymentMode === 'percent'
              ? { prepaymentPercent: Number(orderEditForm.prepaymentValue) }
              : { prepaymentAmount: Number(orderEditForm.prepaymentValue) }
            : orderEditForm.paymentPlan === 'custom' && orderEditForm.prepaymentValue
              ? { prepaymentAmount: Number(orderEditForm.prepaymentValue) }
              : {}),
          remainingBalanceTrigger: orderEditForm.remainingBalanceTrigger,
          remainingBalanceDueAt: orderEditForm.remainingBalanceDueAt || null,
          customPaymentCondition: orderEditForm.customPaymentCondition || null,
          supplyMode: orderEditForm.supplyMode,
          expectedDeliveryAt: orderEditForm.expectedDeliveryAt || null,
          shippingFee: Number(orderEditForm.shippingFee),
          discountAmount: Number(orderEditForm.discountAmount)
        },
        agreementId: [...(order.agreementVersions || [])]
          .sort((left, right) => right.version - left.version)[0]?.id
      });
      setOrderEditOpen(false);
      setOrderEditTargetId(null);
      if (result.awaitingBuyerConfirmation) {
        await refreshMerchantOperations();
        addNotification(
          'success',
          '已提交交易约定',
          `约定版本 ${result.agreement?.version || ''} 已发送给客户，确认前订单不会进入付款或发货。`
        );
        return;
      }
      const updatedOrder = result.order;
      if (!updatedOrder) throw new Error('ORDER_EDIT_RESPONSE_INVALID');
      setServerOrders(current => (current || merchantOrders).map(currentOrder => currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder));
      addNotification('success', '订单信息已更新', `${updatedOrder.orderNo} 的备注已保存`);
    } catch (error) {
      addNotification('warning', '订单信息保存失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setOrderEditBusy(false);
    }
  };
  const openCustomerEditor = (customer?: MerchantCustomer) => {
    setCustomerForm(customer ? {
      companyName: customer.companyName, contactPerson: customer.contactPerson, email: customer.email,
      vatNumber: customer.vatNumber, address: customer.address, city: customer.city, country: customer.country,
      phone: customer.phone, businessType: customer.businessType,
      merchantNotes: customer.merchantNotes || '', merchantTags: (customer.merchantTags || []).join(', ')
    } : { companyName: '', contactPerson: '', email: '', vatNumber: '', address: '', city: '', country: 'Italy', phone: '', businessType: 'Boutique', merchantNotes: '', merchantTags: '' });
    setCustomerEditor(customer || null);
    setCustomerEditorOpen(true);
  };
  const saveCustomerEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (customerEditorBusy) return;
    setCustomerEditorBusy(true);
    try {
      const payload = {
        ...customerForm,
        notes: customerForm.merchantNotes,
        merchantTags: [...new Set(customerForm.merchantTags.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 30)
      };
      const result = customerEditor
        ? await apiPut<{ success: true; customer: MerchantCustomer }>(`/api/merchant/customers/${encodeURIComponent(customerEditor.id)}`, payload)
        : await apiPost<{ success: true; customer: MerchantCustomer }>('/api/merchant/customers', payload);
      setServerCustomers(previous => {
        const current = previous || [];
        return [result.customer, ...current.filter(customer => customer.id !== result.customer.id)];
      });
      setCustomerEditor(null);
      setCustomerEditorOpen(false);
      if (customerDetail?.id === result.customer.id) setCustomerDetail(result.customer);
      addNotification('success', customerEditor ? '客户资料已更新' : '合作客户已新增', `${result.customer.companyName} 已同步到企业中心和 App`);
    } catch (error) {
      addNotification('warning', customerEditor ? '客户资料更新失败' : '客户新增失败', error instanceof Error ? error.message : '请检查客户资料后重试');
    } finally {
      setCustomerEditorBusy(false);
    }
  };
  const saveCustomerSegment = () => {
    if (!currentMerchantId) return;
    const name = window.prompt('为当前客户条件命名（例如：90 天内复购的意大利客户）')?.trim();
    if (!name) return;
    const preset = {
      id: crypto.randomUUID(),
      name: name.slice(0, 40),
      search: customerSearch,
      status: customerStatusFilter,
      country: customerCountryFilter,
      segment: customerSegment,
      minOrders: customerMinOrders,
      lookbackDays: customerLookbackDays
    };
    const nextSegments = [...customerSavedSegments.filter(segment => segment.name !== preset.name), preset].slice(-20);
    try {
      window.localStorage.setItem(`ruda-customer-segments:${currentMerchantId}`, JSON.stringify(nextSegments));
      setCustomerSavedSegments(nextSegments);
      addNotification('success', '客户筛选已保存', '此筛选仅保存在此设备，不会自动更新或用于发送营销活动。');
    } catch (error) {
      addNotification('warning', '客户筛选保存失败', '设备可用空间不足，请清理空间后重试。');
    }
  };
  const applyCustomerSegment = (id: string) => {
    const segment = customerSavedSegments.find(item => item.id === id);
    if (!segment) return;
    setCustomerSearch(segment.search);
    setCustomerStatusFilter(segment.status);
    setCustomerCountryFilter(segment.country);
    setCustomerSegment(segment.segment);
    setCustomerMinOrders(segment.minOrders);
    setCustomerLookbackDays(segment.lookbackDays);
  };
  const exportMerchantCustomers = () => {
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '').replace(/^[\t\r ]*[=+\-@]/, prefix => `'${prefix}`);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const customersToExport = selectedCustomerIds.length
      ? merchantCustomers.filter(customer => selectedCustomerIds.includes(customer.id))
      : visibleMerchantCustomers;
    const rows = [
      ['公司名称', '联系人', '邮箱', '电话', '国家', '城市', '客户状态', '订单数', '累计订单金额(EUR)', '最近下单', '标签'],
      ...customersToExport.map(customer => {
        const stats = getCustomerOrderStats(customer.id);
        return [
          customer.companyName, customer.contactPerson, customer.email, customer.phone, customer.country, customer.city,
          customer.status, stats.orders.length, stats.spend.toFixed(2),
          stats.latestOrderAt ? new Date(stats.latestOrderAt).toISOString().slice(0, 10) : '',
          (customer.merchantTags || []).join('; ')
        ];
      })
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruda-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const updateSelectedCustomerTag = async (mode: 'add' | 'remove') => {
    const tag = customerBatchTag.trim();
    const customers = merchantCustomers.filter(customer => selectedCustomerIds.includes(customer.id));
    if (!tag || !customers.length || customerBatchBusy) return;
    if (customers.length > 500) {
      addNotification('warning', '一次最多批量更新 500 位客户', '请减少选择后重试');
      return;
    }
    if (!window.confirm(`${mode === 'add' ? '为' : '从'} ${customers.length} 位已选客户${mode === 'add' ? '添加' : '移除'}标签“${tag}”吗？`)) return;
    setCustomerBatchBusy(true);
    try {
      const result = await apiPut<{ success: true; customerIds: string[] }>('/api/merchant/customers/batch/tags', {
        customerIds: customers.map(customer => customer.id),
        tag,
        mode
      });
      const updatedIds = new Set(result.customerIds);
      if (serverCustomers === null) {
        try {
          await refreshMerchantOperations();
        } catch (error) {
          addNotification('warning', '客户标签已保存，但列表刷新失败', error instanceof Error ? error.message : '请刷新页面确认结果');
          return;
        }
      } else {
        setServerCustomers(previous => previous?.map(customer => {
          if (!updatedIds.has(customer.id)) return customer;
          const currentTags = customer.merchantTags || [];
          const merchantTags = mode === 'add'
            ? [...new Set([...currentTags, tag])]
            : currentTags.filter(currentTag => currentTag !== tag);
          return { ...customer, merchantTags };
        }) || previous);
      }
      addNotification('success', mode === 'add' ? '客户标签已添加' : '客户标签已移除', `已更新 ${result.customerIds.length} 位客户`);
    } catch (error) {
      addNotification('warning', '批量客户标签更新失败', error instanceof Error ? error.message : '请刷新页面确认结果');
    } finally {
      setCustomerBatchBusy(false);
    }
  };
  const runCustomerAiQuery = (question: string) => {
    const query = question.trim();
    if (!query || customerAiBusy) return;
    if (/新增客户|创建客户|录入客户|add customer|create customer/i.test(query)) {
      const extract = (pattern: RegExp) => query.match(pattern)?.[1]?.trim() || '';
      const email = query.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
      const phone = query.match(/(?:电话|手机|phone)\s*[：:]?\s*([+()\d][+()\d\s.-]{5,})/i)?.[1]?.trim() || '';
      const vatNumber = query.match(/(?:VAT|P\.IVA|税号)\s*[：:]?\s*([A-Z0-9-]{5,})/i)?.[1]?.trim() || '';
      const form = {
        companyName: extract(/(?:公司名称|公司|企业名称|企业)\s*[：:]?\s*([^，,；;\n]+)/),
        contactPerson: extract(/(?:联系人|买手)\s*[：:]?\s*([^，,；;\n]+)/),
        email,
        vatNumber,
        phone,
        city: extract(/(?:城市|市)\s*[：:]?\s*([^，,；;\n]+)/),
        country: extract(/(?:国家|地区)\s*[：:]?\s*([^，,；;\n]+)/),
        address: extract(/(?:地址)\s*[：:]?\s*([^，,；;\n]+)/),
        businessType: 'Boutique',
        merchantNotes: '',
        merchantTags: ''
      };
      setCustomerForm(form);
      setCustomerEditor(null);
      setCustomerEditorOpen(true);
      const reply = '已从你提供的文字中提取明确填写的客户资料并预填表单；未提供的必填信息请自行补齐。检查无误后再点击保存。';
      showAssistantLocalReply(query, reply);
      setCustomerAiBusy(false);
      return;
    }
    setCustomerAiBusy(true);
    const normalized = query.toLocaleLowerCase();
    let nextSegment = customerSegment;
    let nextCountry = customerCountryFilter;
    let nextMinOrders = customerMinOrders;
    let nextLookbackDays = customerLookbackDays;
    let nextSearch = customerSearch;
    let nextStatus = customerStatusFilter;
    if (/挽回|流失|at.risk|churn|60\s*天没|60天没有/i.test(query)) {
      nextSegment = 'at-risk';
      nextMinOrders = '';
      nextLookbackDays = '';
    } else if (/首次购买|新客户|新客|最近新增|recent new|new customer/i.test(query)) {
      nextSegment = 'new';
      nextMinOrders = '';
      nextLookbackDays = '';
    } else if (/订阅.{0,8}(?:邮件|电子邮件)|邮件.{0,8}订阅|email opt.in/i.test(query)) {
      showAssistantLocalReply(query, '当前商家批发客户资料没有邮件营销订阅状态字段，无法准确筛选订阅客户；为避免误判，没有应用该筛选。');
      setCustomerAiBusy(false);
      return;
    } else if (/复购|回头客|买过两次|repeat/i.test(query)) {
      nextSegment = 'repeat';
      nextMinOrders = '';
      nextLookbackDays = '';
    } else if (/没有下过单|未下单|没下过单|无订单/i.test(query)) {
      nextSegment = 'no-orders';
      nextMinOrders = '';
      nextLookbackDays = '';
    } else if (/消费最多|消费最高|高价值|top customer|highest spending/i.test(query)) {
      nextSegment = 'all';
      nextMinOrders = '';
      nextLookbackDays = '';
    }

    const countryMatch = query.match(/意大利|意国|Italy|Italia/i);
    if (countryMatch) nextCountry = '__italy__';
    const lookbackMatch = query.match(/(?:过去|最近|近)\s*(\d+)\s*天/) || query.match(/(?:last|past)\s*(\d+)\s*days?/i);
    if (lookbackMatch) nextLookbackDays = lookbackMatch[1];
    const minOrderMatch = query.match(/(?:买过|购买|下单|订单|消费)\s*(\d+|两|二|三|四|五)\s*次/);
    if (minOrderMatch) nextMinOrders = ({ '两': '2', '二': '2', '三': '3', '四': '4', '五': '5' } as Record<string, string>)[minOrderMatch[1]] || minOrderMatch[1];
    if (countryMatch || lookbackMatch || minOrderMatch) {
      nextSegment = 'all';
      nextSearch = '';
      nextStatus = 'all';
      setCustomerSearch('');
      setCustomerStatusFilter('all');
    }
    setCustomerSegment(nextSegment);
    setCustomerCountryFilter(nextCountry);
    setCustomerMinOrders(nextMinOrders);
    setCustomerLookbackDays(nextLookbackDays);

    const matchedCustomer = merchantCustomers.find(customer =>
      [customer.companyName, customer.contactPerson, customer.email, customer.phone, customer.vatNumber]
        .some(value => value && normalized.includes(value.toLocaleLowerCase()))
    );
    if (matchedCustomer) {
      nextSegment = 'all';
      nextCountry = 'all';
      nextMinOrders = '';
      nextLookbackDays = '';
      nextSearch = matchedCustomer.companyName;
      nextStatus = 'all';
      setCustomerSearch(matchedCustomer.companyName);
      setCustomerStatusFilter('all');
      setCustomerSegment('all');
      setCustomerCountryFilter('all');
      setCustomerMinOrders('');
      setCustomerLookbackDays('');
    }
    const previewCount = merchantCustomers.filter(customer => {
      if (nextStatus !== 'all' && customer.status !== nextStatus) return false;
      if (!customerMatchesCountry(customer.country, nextCountry)) return false;
      const activeSearch = nextSearch.trim().toLocaleLowerCase();
      if (activeSearch && ![customer.companyName, customer.contactPerson, customer.email, customer.phone, customer.vatNumber, customer.city, customer.country, ...(customer.merchantTags || [])]
        .some(value => value?.toLocaleLowerCase().includes(activeSearch))) return false;
      const stats = getCustomerOrderStats(customer.id);
      if (nextSegment === 'repeat' && stats.orders.length < 2) return false;
      if (nextSegment === 'new') {
        const created = new Date(customer.registrationDate || customer.createdAt || '').getTime();
        if (!Number.isFinite(created) || created < Date.now() - 30 * 24 * 60 * 60 * 1000) return false;
      }
      if (nextSegment === 'at-risk' && (stats.orders.length < 2 || stats.latestOrderAt === null || stats.latestOrderAt > Date.now() - 60 * 24 * 60 * 60 * 1000)) return false;
      if (nextSegment === 'no-orders' && stats.orders.length > 0) return false;
      if (nextMinOrders && getCustomerOrderCountWithin(customer.id, Number(nextLookbackDays) || 90) < Number(nextMinOrders)) return false;
      if (nextLookbackDays && (stats.latestOrderAt === null || stats.latestOrderAt < Date.now() - Number(nextLookbackDays) * 24 * 60 * 60 * 1000)) return false;
      return true;
    }).length;
    const renderAnswer = () => {
      const latestCustomers = [...merchantCustomers].sort((left, right) =>
        new Date(right.registrationDate || right.createdAt || 0).getTime() - new Date(left.registrationDate || left.createdAt || 0).getTime()
      );
      const topCustomers = [...merchantCustomers].sort((left, right) => getCustomerOrderStats(right.id).spend - getCustomerOrderStats(left.id).spend).slice(0, 5);
      let response: string;
      if (matchedCustomer) {
        const stats = getCustomerOrderStats(matchedCustomer.id);
        setCustomerDetail(matchedCustomer);
        response = `找到客户「${matchedCustomer.companyName}」（${matchedCustomer.contactPerson}）。本店订单 ${stats.orders.length} 单，订单金额合计 €${stats.spend.toFixed(2)}；${stats.latestOrderAt ? `最近下单 ${new Date(stats.latestOrderAt).toLocaleDateString()}` : '本店订单记录中没有找到该客户的订单'}。`;
      } else if (/流失|挽回|at.risk|churn|60\s*天/i.test(query)) {
        setCustomerSegment('at-risk');
        const atRiskCustomers = merchantCustomers.filter(customer => {
          const stats = getCustomerOrderStats(customer.id);
          return stats.orders.length >= 2 && stats.latestOrderAt !== null && stats.latestOrderAt <= Date.now() - 60 * 24 * 60 * 60 * 1000;
        });
        response = `找到 ${atRiskCustomers.length} 位至少下过 2 单且最近下单距今超过 60 天的客户。可先核对其历史订单，再考虑发送个性化回访；系统不会代发邮件。`;
      } else if (/最近新增|新客|新客户|new customer/i.test(query)) {
        setCustomerSegment('new');
        response = `本店近 30 天新增 ${customerRecentCount} 位客户。${latestCustomers.slice(0, 5).map(customer => `${customer.companyName}（${customer.registrationDate || '登记日期未知'}）`).join('、') || '目前没有客户资料'}。`;
      } else if (/地区|国家|分布|region|country/i.test(query)) {
        response = `客户地区分布：${customerRegionRank.map(([region, count]) => `${region} ${count} 位`).join('；') || '暂无客户数据'}。`;
      } else if (/复购|回头|比例|repeat/i.test(query)) {
        response = `当前客户中有 ${customerRepeatCount} 位存在至少 2 笔本店订单${merchantCustomers.length ? `，约占 ${Math.round(customerRepeatCount / merchantCustomers.length * 100)}%` : ''}。统计基于已加载的本店订单记录。`;
      } else if (countryMatch || lookbackMatch || minOrderMatch) {
        const matching = merchantCustomers.filter(customer => {
          if (nextStatus !== 'all' && customer.status !== nextStatus) return false;
          if (!customerMatchesCountry(customer.country, nextCountry)) return false;
          if (nextSearch && ![customer.companyName, customer.contactPerson, customer.email, customer.phone, customer.vatNumber, customer.city, customer.country, ...(customer.merchantTags || [])]
            .some(value => value?.toLocaleLowerCase().includes(nextSearch.toLocaleLowerCase()))) return false;
          const stats = getCustomerOrderStats(customer.id);
          if (nextMinOrders && getCustomerOrderCountWithin(customer.id, Number(nextLookbackDays) || 90) < Number(nextMinOrders)) return false;
          if (nextLookbackDays && (stats.latestOrderAt === null || stats.latestOrderAt < Date.now() - Number(nextLookbackDays) * 24 * 60 * 60 * 1000)) return false;
          return true;
        });
        response = `符合条件的客户有 ${matching.length} 位${nextCountry !== 'all' ? `（国家：${nextCountry === '__italy__' ? '意大利' : nextCountry}` : ''}${nextLookbackDays ? `，最近 ${nextLookbackDays} 天内有下单` : ''}${nextMinOrders ? `，该期间至少 ${nextMinOrders} 单` : ''}${nextCountry !== 'all' ? '）' : '。'}${matching.length ? `\n${matching.slice(0, 8).map(customer => `${customer.companyName} · ${getCustomerOrderStats(customer.id).orders.length} 单 · €${getCustomerOrderStats(customer.id).spend.toFixed(2)}`).join('\n')}` : ''}`;
      } else if (/消费最多|消费最高|高价值|top customer|highest spending/i.test(query)) {
        response = `按本店订单金额排序：${topCustomers.map((customer, index) => `${index + 1}. ${customer.companyName} €${getCustomerOrderStats(customer.id).spend.toFixed(2)}（${getCustomerOrderStats(customer.id).orders.length} 单）`).join('；') || '暂无订单数据'}。这只是本店订单金额汇总，不代表客户终身价值。`;
      } else if (/邮件|营销|文案|email|campaign/i.test(query)) {
        return;
      } else {
        response = `当前商家客户档案 ${merchantCustomers.length} 位，订单金额合计 €${customerTotalSpend.toFixed(2)}。可查询客户姓名/邮箱、消费排行、近期新增、复购、流失风险、地区分布，或描述筛选条件（如「过去 90 天买过两次以上的意大利客户」）。`;
      }
      const reply = `${response}\n\n筛选结果 ${previewCount} 位。保存的筛选仅保存在此设备，不会自动更新或用于发送营销活动。`;
      showAssistantLocalReply(query, reply);
      setCustomerAiBusy(false);
    };
    if (/邮件|营销文案|写.*(?:邮件|营销)|email|campaign/i.test(query)) {
      void askOperatingAssistant(`请为商家起草营销邮件文案，商家需求：${query}。当前页面筛选命中 ${previewCount} 位客户。不要接收或复述任何客户姓名、邮箱或其他个人资料；只写通用草稿，不声称已发送邮件，不要虚构客户事实、折扣或订单数据。`, {
        openPanel: false,
        forcePageContext: true
      }).finally(() => setCustomerAiBusy(false));
      return;
    }
    renderAnswer();
  };
  const merchantReturnsByOrderId = new Map<string, MerchantReturn>();
  for (const returnRequest of serverReturns ?? []) {
    if (!merchantReturnsByOrderId.has(returnRequest.orderId)) {
      merchantReturnsByOrderId.set(returnRequest.orderId, returnRequest);
    }
  }

  // 严格数据隔离：该商家的调拨记录
  const merchantTransfers = serverTransfers ?? transfers.filter(t => t.merchantId === currentMerchantId);

  // 严格数据隔离：该商家的财务结算
  const merchantPayouts = serverPayouts ?? payouts.filter(p => p.merchantId === currentMerchantId);

  // 计算看板指标
  const totalSales = merchantOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const pendingOrders = merchantOrders.filter(o => o.status === 'placed' || o.status === 'picking');
  const orderActionCount = merchantOrders.filter(order => ['placed', 'pending', 'confirmed', 'picking'].includes(order.status)).length;
  const pendingVaultCount = merchantVaultRequests.filter(vr => vr.status === 'pending').length;
  const normalizedGlobalSearch = globalSearch.trim().toLocaleLowerCase();
  const globalSearchResults = normalizedGlobalSearch ? [
    ...merchantOrders
      .filter(order => {
        const customer = merchantCustomers.find(candidate => candidate.id === order.customerId);
        return [
          order.orderNo, order.companyName, order.shippingAddress?.city, order.shippingAddress?.country,
          order.carrier, order.trackingNumber, customer?.contactPerson, customer?.email, customer?.phone,
          ...order.items.flatMap(item => [item.styleNo, item.sku, item.productName])
        ].some(value => String(value || '').toLocaleLowerCase().includes(normalizedGlobalSearch));
      })
      .slice(0, 4)
      .map(order => ({ key: `order-${order.id}`, title: order.orderNo, detail: `${order.companyName} · ${order.status}`, target: 'orders' as const, icon: Truck })),
    ...merchantProducts
      .filter(product => `${product.styleNo} ${product.name} ${product.name_zh || ''} ${product.category} ${product.skus.map(sku => sku.sku).join(' ')}`.toLocaleLowerCase().includes(normalizedGlobalSearch))
      .slice(0, 4)
      .map(product => ({ key: `product-${product.id}`, title: `${product.styleNo} · ${product.name_zh || product.name}`, detail: product.skus.map(sku => sku.sku).join(' · ') || product.category, target: 'products' as const, icon: Package })),
    ...merchantCustomers
      .filter(customer => `${customer.companyName} ${customer.contactPerson} ${customer.email}`.toLocaleLowerCase().includes(normalizedGlobalSearch))
      .slice(0, 4)
      .map(customer => ({ key: `customer-${customer.id}`, title: customer.companyName, detail: customer.contactPerson, target: 'customers' as const, icon: UserCheck }))
  ].slice(0, 8) : [];
  const openFirstGlobalSearchResult = () => {
    const result = globalSearchResults[0];
    if (!result) return;
    setActiveTab(result.target);
    if (result.target === 'products') setProductSearch(result.title.split(' · ')[0]);
    if (result.target === 'orders') setOrderSearch(globalSearch);
    setGlobalSearch('');
  };
  const dashboardProductResults = dashboardProductSearch.trim()
    ? merchantProducts.filter(product => {
      const query = dashboardProductSearch.trim().toLocaleLowerCase();
      return [
        product.styleNo,
        product.name,
        product.name_zh,
        product.name_it,
        ...product.skus.flatMap(sku => [sku.sku, sku.barcode])
      ].some(value => value?.toLocaleLowerCase().includes(query));
    }).slice(0, 6)
    : [];
  const openDashboardProduct = (product: Product) => {
    setProductSearch(product.styleNo);
    openProductCatalog();
    setDashboardProductSearch('');
  };

  let lowStockCount = 0;
  let totalStockCount = 0;
  merchantProducts.forEach(p => {
    (p.skus || []).forEach(s => {
      const total = standardInventoryLoaded ? (skuStock.get(s.sku) || 0) : (s.stockCentral || 0);
      totalStockCount += total;
      if (total < 15) lowStockCount++;
    });
  });

  const nowTimestamp = Date.now();
  const recentSales = merchantOrders.filter(order => nowTimestamp - new Date(order.date).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const previousSales = merchantOrders.filter(order => {
    const orderAge = nowTimestamp - new Date(order.date).getTime();
    return orderAge > 7 * 24 * 60 * 60 * 1000 && orderAge <= 14 * 24 * 60 * 60 * 1000;
  });
  const recentSalesQty = recentSales.reduce((sum, order) => sum + order.totalQty, 0);
  const previousSalesQty = previousSales.reduce((sum, order) => sum + order.totalQty, 0);
  const salesTrendPercent = previousSalesQty > 0 ? Math.round(((recentSalesQty - previousSalesQty) / previousSalesQty) * 100) : recentSalesQty > 0 ? 100 : 0;
  const productSales = new Map<string, number>();
  merchantOrders.forEach(order => order.items.forEach(item => productSales.set(item.productId, (productSales.get(item.productId) || 0) + item.quantity)));
  const replenishmentRecommendations = merchantProducts.map(product => {
    const stock = getProductStock(product);
    const sold = productSales.get(product.id) || 0;
    const dailyDemand = sold / 30;
    const daysCover = dailyDemand > 0 ? Math.round(stock / dailyDemand) : null;
    return { product, stock, sold, daysCover, suggestedQty: Math.max(0, Math.ceil(dailyDemand * 30 - stock)) };
  }).sort((left, right) => {
    if (left.daysCover === null) return 1;
    if (right.daysCover === null) return -1;
    return left.daysCover - right.daysCover;
  });
  const smartRecommendations = [...replenishmentRecommendations]
    .sort((left, right) => right.sold - left.sold)
    .slice(0, 3);

  // State for adding new product
  const [editingProductImages, setEditingProductImages] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productViewMode, setProductViewMode] = useState<'table' | 'pos'>('table');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchProductBusy, setBatchProductBusy] = useState(false);
  const [productImportBusy, setProductImportBusy] = useState(false);
  const [productBatchPriceOpen, setProductBatchPriceOpen] = useState(false);
  const [productBatchPriceBusy, setProductBatchPriceBusy] = useState(false);
  const [productBatchPrices, setProductBatchPrices] = useState({ wholesalePrice: '', wholesalePrice100: '' });
  const [productAiDescriptionDraft, setProductAiDescriptionDraft] = useState('');
  const [productCreationMode, setProductCreationMode] = useState<'quick' | 'full'>('quick');
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingProductImages, setSavingProductImages] = useState(false);
  const [newProdData, setNewProdData] = useState<MerchantProductDraft>(() => createMerchantProductDraft());
  const [productDraftLoading, setProductDraftLoading] = useState(false);
  const beginProductCreation = async () => {
    if (productDraftLoading) return false;
    setProductDraftLoading(true);
    try {
      const result = await apiGet<{ success: true; settings: Partial<typeof settingsForm> }>('/api/merchant/settings');
      const defaultMoq = normalizeMerchantProductDefaultMoq(result.settings.moq);
      setMerchantDefaultMoq(defaultMoq);
      setNewProdData(createMerchantProductDraft(defaultMoq));
      setProductAiDescriptionDraft('');
      setIsAddingProduct(true);
      return true;
    } catch (error) {
      addNotification('warning', '商品创建表单加载失败', error instanceof Error ? error.message : '无法读取店铺默认起订量，请稍后重试');
      return false;
    } finally {
      setProductDraftLoading(false);
    }
  };
  const createCurrentPageContext = (): MerchantCopilotPageContext => {
    const task = activeTab === 'products'
      ? isAddingProduct ? 'create_product' : productWorkspaceSection === 'categories' ? 'manage_categories' : 'manage_products'
      : activeTab === 'orders'
        ? orderView === 'drafts' ? 'prepare_quote' : 'manage_orders'
        : activeTab === 'inventory' || activeTab === 'sku_matrix' ? 'manage_inventory'
          : activeTab === 'customers' || activeTab === 'vault_requests' ? 'manage_customers'
            : activeTab === 'content' || activeTab === 'gallery' || activeTab === 'profile' ? 'manage_content'
              : activeTab === 'settings' ? 'manage_settings' : 'overview';
    const selectedObjectId = activeTab === 'products'
      ? editingProduct?.id || assistantFocusedProductId
      : activeTab === 'orders'
        ? selectedOrderDetailId || (selectedOrderIds.length === 1 ? selectedOrderIds[0] : null)
        : null;
    const filters: Record<string, string> = {};
    if (activeTab === 'products' && !isAddingProduct) {
      filters.productLifecycle = productLifecycleFilter;
      filters.productZone = productZoneFilter;
      filters.productCategory = productCategoryFilter;
    } else if (activeTab === 'orders') {
      filters.orderStatus = orderStatusFilter;
      filters.orderPayment = orderPaymentFilter;
      filters.orderDate = orderDateRange;
    }
    const pageContext: MerchantCopilotPageContext = {
      route: activeTab,
      section: String(assistantContextScope),
      task,
      selectedObjectId,
      filters
    };
    if (activeTab === 'products' && isAddingProduct) {
      pageContext.form = createMerchantProductFormPageContext(newProdData, productCreationMode).form;
    }
    return pageContext;
  };

  // State for SKU Matrix Generator
  const [skuTargetStyleNo, setSkuTargetStyleNo] = useState(merchantProducts[0]?.styleNo || '');
  const [selectedColors, setSelectedColors] = useState([
    { name: '极夜黑', code: 'BLK', colorCode: '#111111', checked: true },
    { name: '象牙白', code: 'WHT', colorCode: '#F8F9FA', checked: true },
    { name: '皇室驼', code: 'CML', colorCode: '#C19A6B', checked: true },
    { name: '勃艮第酒红', code: 'RED', colorCode: '#722F37', checked: false }
  ]);
  const [selectedSizes, setSelectedSizes] = useState([
    { size: 'S', checked: true },
    { size: 'M', checked: true },
    { size: 'L', checked: true },
    { size: 'XL', checked: false }
  ]);
  const [skuBasePrice, setSkuBasePrice] = useState(merchantProducts[0]?.wholesalePrice || 0);
  const [skuCostPrice, setSkuCostPrice] = useState<number | ''>(merchantProducts[0]?.costPrice ?? '');
  const [generatedSkusList, setGeneratedSkusList] = useState<SKUItem[]>([]);
  const skuTargetProduct = merchantProducts.find(product => product.styleNo === skuTargetStyleNo);

  // State for Fulfillment Modal
  const [selectedOrderForFulfill, setSelectedOrderForFulfill] = useState<Order | null>(null);
  const [fulfillCarrier, setFulfillCarrier] = useState('');
  const [fulfillTracking, setFulfillTracking] = useState('');
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [fulfillShipments, setFulfillShipments] = useState<Array<{ id: string; shipmentNo: string; carrier?: string | null; trackingNumber?: string | null; status: string; items: Array<{ orderItemId: string; quantity: number }> }>>([]);
  const [fulfillQuantities, setFulfillQuantities] = useState<Record<string, number>>({});
  const [merchantOrderShipments, setMerchantOrderShipments] = useState<Array<{
    id: string;
    shipmentNo: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    status: string;
    updatedAt: string;
    items: Array<{ orderItemId: string; quantity: number }>;
    trackingEvents: Array<{ id: string; status: string; location?: string | null; description?: string | null; occurredAt: string }>;
  }>>([]);
  const [merchantOrderShipmentsLoading, setMerchantOrderShipmentsLoading] = useState(false);
  const [fulfillShipmentsLoading, setFulfillShipmentsLoading] = useState(false);
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<Array<{ id: string; status: string; location?: string | null; description?: string | null; occurredAt: string }>>([]);
  const [trackingEventForm, setTrackingEventForm] = useState({ status: '运输中', location: '', description: '' });

  // State for Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    styleNo: merchantProducts[0]?.styleNo || 'DRS-2026-0088',
    sku: merchantProducts[0]?.skus[0]?.sku || '',
    fromLocation: 'central',
    toLocation: 'central',
    quantity: 20,
    notes: '单仓模式不支持库存调拨'
  });

  // Generate SKU Matrix
  const handleGenerateSKUs = () => {
    if (!skuTargetProduct) {
      addNotification('warning', '请选择款式', '请先选择本店商品款式');
      return;
    }

    const activeColors = selectedColors.filter(c => c.checked);
    const activeSizes = selectedSizes.filter(s => s.checked);

    if (activeColors.length === 0 || activeSizes.length === 0) {
      addNotification('warning', '变体配置不足', '请至少勾选一种颜色与一种尺码以生成矩阵');
      return;
    }

    const skus: SKUItem[] = [];
    activeColors.forEach(color => {
      activeSizes.forEach(size => {
        const skuCode = `${skuTargetStyleNo}-${color.code}-${size.size}`;
        skus.push({
          sku: skuCode,
          color: color.name,
          colorCode: color.colorCode,
          size: size.size,
          stockCentral: 0,
          stockMestre: 0,
          stockMilano: 0,
          ...(skuCostPrice === '' ? {} : { cost: skuCostPrice }),
          wholesalePrice: skuBasePrice,
          rrp: skuTargetProduct.rrpPrice,
          weight: skuTargetProduct.weight
        });
      });
    });

    setGeneratedSkusList(skus);
    addNotification('success', 'SKU 已生成', `共 ${skus.length} 个规格组合`);
  };

  // Save generated SKUs to selected product
  const handleSaveSkusToProduct = async () => {
    const targetProd = merchantProducts.find(p => p.styleNo === skuTargetStyleNo);
    if (!targetProd) {
      addNotification('warning', '未找到目标款式', '请核对款号是否属于本店商品');
      return;
    }

    try {
      await updateMerchantProduct(targetProd.id, {
        skus: [...(targetProd.skus || []), ...generatedSkusList]
      });
      addNotification('success', 'SKU 已写入款式库', `已将 ${generatedSkusList.length} 个 SKU 变体并入款号 ${skuTargetStyleNo}`);
      setGeneratedSkusList([]);
    } catch (error) {
      addNotification('warning', 'SKU 保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  // Submit new product
  const handleCreateProduct = async (
    e: React.FormEvent<HTMLFormElement>,
    action: 'draft' | 'publish',
    mode: 'quick' | 'full'
  ) => {
    e.preventDefault();
    if (savingProduct) return;
    const validationError = validateMerchantProductDraft(newProdData, action, mode);
    if (validationError) {
      addNotification('warning', '商品资料不完整或无效', validationError);
      return;
    }
    setSavingProduct(true);

    try {
      const createdProduct = await addProduct({
        ...buildMerchantProduct(newProdData, currentMerchant.id, currentMerchant.name),
        creationRequestKey: newProdData.creationRequestKey,
        lifecycleStatus: action === 'publish' ? 'published' : 'draft'
      });
      setServerProducts(previous => previous ? [createdProduct, ...previous.filter(product => product.id !== createdProduct.id)] : previous);

      addNotification('success', action === 'publish' ? '商品发布成功' : '商品草稿已保存',
        action === 'publish' ? `款式 ${newProdData.styleNo} 已进入现有网店和买手端商品目录` : `款式 ${newProdData.styleNo || '未命名'} 已保存为草稿`);
      setIsAddingProduct(false);
      setProductAiDescriptionDraft('');
      setNewProdData(createMerchantProductDraft(merchantDefaultMoq));
    } catch (error) {
      addNotification('warning', '商品发布失败', error instanceof Error ? error.message : '服务端未接受商品发布，请稍后重试');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleBatchProductLifecycle = async (lifecycleStatus: 'published' | 'draft') => {
    if (!selectedProductIds.length || batchProductBusy) return;
    const activeProductIds = selectedProductIds.filter(id => merchantProducts.some(product => product.id === id && product.lifecycleStatus !== 'archived'));
    if (!activeProductIds.length) {
      addNotification('warning', '没有可批量更新的商品', '已归档商品不能通过批量上下架操作修改');
      return;
    }
    setBatchProductBusy(true);
    try {
      await apiPut('/api/merchant/products/batch', { productIds: activeProductIds, lifecycleStatus });
      await refreshMerchantOperations();
      setSelectedProductIds([]);
      addNotification('success', lifecycleStatus === 'published' ? '商品已批量上架' : '商品已批量下架',
        `已更新 ${activeProductIds.length} 款商品的销售状态`);
    } catch (error) {
      addNotification('warning', '批量上下架失败', error instanceof Error ? error.message : '请刷新后重试');
    } finally {
      setBatchProductBusy(false);
    }
  };
  const handleBatchProductZone = async (zone: 'new' | 'clearance' | 'private') => {
    if (!selectedProductIds.length || batchProductBusy) return;
    const activeProductIds = selectedProductIds.filter(id => merchantProducts.some(product => product.id === id && product.lifecycleStatus !== 'archived'));
    if (!activeProductIds.length) {
      addNotification('warning', '没有可调整的商品', '已归档商品不能通过批量展示区操作修改');
      return;
    }
    const zoneLabel = zone === 'private' ? '授权区' : zone === 'clearance' ? '折扣市场' : '现货区';
    if (!window.confirm(`确定将选中的 ${activeProductIds.length} 款商品批量移动到${zoneLabel}吗？`)) return;
    setBatchProductBusy(true);
    try {
      await apiPut('/api/merchant/products/batch', { productIds: activeProductIds, zone });
      await refreshMerchantOperations();
      setSelectedProductIds([]);
      addNotification('success', '商品展示区已批量更新', `${activeProductIds.length} 款商品已移至${zoneLabel}`);
    } catch (error) {
      addNotification('warning', '批量更新展示区失败', error instanceof Error ? error.message : '请刷新后重试');
    } finally {
      setBatchProductBusy(false);
    }
  };
  const exportMerchantProducts = (productsToExport: Product[]) => {
    const escapeCsv = (value: unknown) => {
      const normalized = String(value ?? '');
      const safe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ['款号', '名称', '分类slug', '子分类', '批发价EUR', '100件起批价EUR', '成本EUR', 'MOQ', '箱规', '展示区', '可见性', '状态', '库存件数', 'SKU列表', '图片URL'],
      ...productsToExport.map(product => [
        product.styleNo, product.name_zh || product.name, product.category, product.subCategory,
        product.wholesalePrice, product.wholesalePrice100 ?? '', product.costPrice || 0, product.moq, product.packSize,
        getProductZone(product), product.visibility, product.lifecycleStatus, getProductStock(product),
        (product.skus || []).map(sku => sku.sku).join(' | '), product.images.join(' | ')
      ])
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruda-products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadProductImportTemplate = () => {
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['styleNo', 'name', 'category', 'subCategory', 'wholesalePrice', 'wholesalePrice100', 'costPrice', 'moq', 'packSize', 'origin', 'fabric', 'description', 'visibility'],
      ['STY-2026-0001', '意式棉质衬衫', storeCategories[0]?.slug || '请替换为店铺分类', '衬衫', '22', '20', '12', '6', '6', 'Made in Italy', 'Cotton', '请核对商品描述', 'wholesale']
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ruda-product-import-template.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importMerchantProducts = async (file: File) => {
    if (productImportBusy) return;
    if (!file.name.toLocaleLowerCase().endsWith('.csv') || file.size > 2 * 1024 * 1024) {
      addNotification('warning', '商品 CSV 文件不符合要求', '请选择不超过 2MB 的 .csv 文件');
      return;
    }
    setProductImportBusy(true);
    try {
      const records = parseCsvRecords(await file.text()).filter(record => record.some(value => value.trim()));
      if (records.length < 2) throw new Error('CSV 至少需要标题行和一行商品数据');
      const headers = records[0].map(header => header.trim());
      const requiredHeaders = ['styleNo', 'name', 'category', 'wholesalePrice', 'wholesalePrice100'];
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length) throw new Error(`缺少必需列：${missingHeaders.join('、')}`);
      const rows = records.slice(1);
      if (rows.length > 500) throw new Error('单次最多导入 500 款商品');
      const productsToImport = rows.map((row, rowIndex) => {
        const values = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || '']));
        const styleNo = String(values.styleNo || '').toUpperCase();
        const name = String(values.name || '');
        const category = String(values.category || '');
        const wholesalePrice = Number(values.wholesalePrice);
        const wholesalePrice100 = Number(values.wholesalePrice100);
        const costPrice = values.costPrice ? Number(values.costPrice) : 0;
        const moq = values.moq ? Number(values.moq) : 1;
        const packSize = values.packSize ? Number(values.packSize) : 1;
        if (!styleNo || !name || !category || !Number.isFinite(wholesalePrice) || wholesalePrice <= 0 || !Number.isFinite(wholesalePrice100) || wholesalePrice100 <= 0 || wholesalePrice100 > wholesalePrice || !Number.isFinite(costPrice) || costPrice < 0 || !Number.isInteger(moq) || moq < 1 || !Number.isInteger(packSize) || packSize < 1) {
          throw new Error(`第 ${rowIndex + 2} 行资料无效；请检查款号、名称、分类及价格、MOQ、箱规`);
        }
        return {
          styleNo, name, category,
          subCategory: String(values.subCategory || ''),
          wholesalePrice, wholesalePrice100, rrpPrice: 0, costPrice, moq, packSize,
          origin: String(values.origin || ''),
          fabric: String(values.fabric || ''),
          description: String(values.description || ''),
          visibility: ['public', 'wholesale', 'private'].includes(String(values.visibility)) ? String(values.visibility) : 'wholesale'
        };
      });
      if (new Set(productsToImport.map(product => product.styleNo)).size !== productsToImport.length) {
        throw new Error('CSV 中款号重复，请先修正后再导入');
      }
      const result = await apiPost<{ success: true; count: number; products: Product[] }>('/api/merchant/products/batch', { products: productsToImport });
      setServerProducts(current => [...(current || merchantProducts), ...result.products]);
      addNotification('success', 'CSV 商品已导入为草稿', `${result.count} 款已创建；请补充商品图片与 SKU 后再上架`);
    } catch (error) {
      addNotification('warning', '商品 CSV 导入失败', error instanceof Error ? error.message : '请检查模板列名、分类 slug 与商品数据');
    } finally {
      setProductImportBusy(false);
    }
  };
  const saveProductBatchPrices = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProductIds.length || productBatchPriceBusy) return;
    const wholesalePrice = Number(productBatchPrices.wholesalePrice);
    const wholesalePrice100 = Number(productBatchPrices.wholesalePrice100);
    if (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0 || !Number.isFinite(wholesalePrice100) || wholesalePrice100 <= 0 || wholesalePrice100 > wholesalePrice) {
      addNotification('warning', '商品价格无效', '100件批发价必须大于 0 且不高于基础批发价');
      return;
    }
    if (!window.confirm(`将 ${selectedProductIds.length} 款已选商品的基础批发价和100件批发价统一设置为 €${wholesalePrice.toFixed(2)} / €${wholesalePrice100.toFixed(2)}？`)) return;
    setProductBatchPriceBusy(true);
    const results = await Promise.allSettled(selectedProductIds.map(id => apiPut(`/api/merchant/products/${encodeURIComponent(id)}`, { wholesalePrice, wholesalePrice100 })));
    const updatedCount = results.filter(result => result.status === 'fulfilled').length;
    try {
      await refreshMerchantOperations();
    } catch (error) {
      addNotification('warning', '商品已提交更新，但列表刷新失败', error instanceof Error ? error.message : '请刷新页面确认结果');
    }
    setProductBatchPriceBusy(false);
    if (updatedCount === results.length) {
      setProductBatchPriceOpen(false);
      setSelectedProductIds([]);
      addNotification('success', '批量价格已更新', `已更新 ${updatedCount} 款商品`);
    } else {
      const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : []);
      addNotification('warning', '部分商品价格未更新', `${updatedCount}/${results.length} 款已更新。${errors[0] || '请检查权限或重试失败商品'}`);
    }
  };
  const archiveSelectedProducts = async () => {
    if (!selectedProductIds.length || batchProductBusy) return;
    if (!window.confirm(`确定归档选中的 ${selectedProductIds.length} 款商品吗？商品与历史记录会保留，但不再公开展示。`)) return;
    setBatchProductBusy(true);
    const ids = [...selectedProductIds];
    const results = await Promise.allSettled(ids.map(id => apiDelete(`/api/merchant/products/${encodeURIComponent(id)}`)));
    const archivedCount = results.filter(result => result.status === 'fulfilled').length;
    try {
      await refreshMerchantOperations();
    } catch (error) {
      addNotification('warning', '商品已提交归档，但列表刷新失败', error instanceof Error ? error.message : '请刷新页面确认结果');
    }
    setBatchProductBusy(false);
    if (archivedCount === ids.length) {
      setSelectedProductIds([]);
      addNotification('success', '商品已批量归档', `已归档 ${archivedCount} 款商品`);
    } else {
      const failedCount = ids.length - archivedCount;
      addNotification('warning', '部分商品归档失败', `${archivedCount} 款已归档，${failedCount} 款未成功；请刷新后核对列表`);
    }
  };
  const runProductAiQuery = (question: string) => {
    const query = question.trim();
    if (!query || assistantBusy) return;
    setSelectedProductView('');
    const lowerQuery = query.toLocaleLowerCase();
    if (/缺图片|没有图片|无图片|没图片|missing image|no image/i.test(query)) {
      setProductQuickView('no-image');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else if (/库存.{0,8}(?:低于|少于|不足)\s*5|(?:低于|少于|不足)\s*5\s*(?:件|个)?库存|stock.{0,8}<\s*5/i.test(query)) {
      setProductQuickView('under-five');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else if (/低库存|缺货|库存偏低|low stock|out of stock/i.test(query)) {
      setProductQuickView('low-stock');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else if (/草稿|draft/i.test(query)) {
      setProductQuickView('draft');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else if (/已归档|archived/i.test(query)) {
      setProductQuickView('archived');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else if (/在售|已上架|published/i.test(query)) {
      setProductQuickView('published');
      setProductSearch('');
      setProductLifecycleFilter('all');
      setProductZoneFilter('all');
      setProductCategoryFilter('all');
    } else {
      const matchedProduct = merchantProducts.find(product =>
        [product.styleNo, product.name, product.name_zh, product.name_it, ...(product.skus || []).flatMap(sku => [sku.sku, sku.barcode])]
          .some(value => value && lowerQuery.includes(value.toLocaleLowerCase()))
      );
      if (matchedProduct) {
        setProductQuickView('all');
        setProductLifecycleFilter('all');
        setProductZoneFilter('all');
        setProductCategoryFilter('all');
        setProductSearch(matchedProduct.styleNo);
      }
    }
    void askOperatingAssistant(query, { openPanel: false, forcePageContext: true });
  };
  const runProductSeriesAiQuery = (question: string) => {
    const query = question.trim();
    if (!query || assistantBusy) return;
    const normalized = query.toLocaleLowerCase();
    const matchedCategory = storeCategories.find(category =>
      normalized.includes(category.name.toLocaleLowerCase()) || normalized.includes(category.slug.toLocaleLowerCase())
    );
    const isCreateRequest = /新建|创建|新增|建一个|create|new collection|new category/i.test(query)
      && /系列|分类|collection|category/i.test(query);
    const isRenameRequest = /改名|重命名|rename/i.test(query) && Boolean(matchedCategory);
    const isContentRequest = /写|生成|撰写|优化|文案|描述|seo|搜索引擎|write|generate/i.test(query)
      && /描述|文案|seo|搜索引擎|description|title/i.test(query);

    if (isCreateRequest || isRenameRequest || isContentRequest) {
      const assistantPrompt = isContentRequest
        ? `请根据商家的要求，为店铺分类${matchedCategory ? `「${matchedCategory.name}」` : ''}准备一份文案草稿。商家要求：${query}。当前只保存分类名称；如商家请求描述、SEO 或封面，请说明尚未支持，且不要声称已更新店铺。按商家要求使用中文、意大利语或英语。`
        : `商家希望${isRenameRequest ? `将店铺分类「${matchedCategory?.name}」改名` : '新建一个店铺分类'}。商家的需求：${query}。请提炼一个简洁、适合店铺导航的名称。只输出一行，格式必须为：分类名称：<名称>。不要声称已创建或已修改。`;
      const renameTarget = isRenameRequest ? matchedCategory : undefined;
      void askOperatingAssistant(assistantPrompt, {
        openPanel: false,
        forcePageContext: true,
        onReply: reply => {
          const suggestedName = reply.match(/(?:分类|系列)名称\s*[：:]\s*([^\n]+)/)?.[1]?.trim().replace(/^["'“”*]+|["'“”*]+$/g, '');
          if (suggestedName) {
            setNewCategoryName(suggestedName.slice(0, 40));
            setEditingStoreCategoryId(renameTarget?.id || null);
            setCategoryFormOpen(true);
            addNotification('success', '分类名称已填入', '核对后保存');
          }
        },
        formatReply: reply => `${reply}\n\n${isCreateRequest || isRenameRequest
          ? '名称已填入表单，尚未保存。'
          : '这是文案草稿，尚未保存到店铺。'}`
      });
      return;
    }

    const hasImage = (product: Product) => Boolean(
      product.media?.some(media => media.type === 'image' && Boolean(media.url))
      || product.images?.some(Boolean)
    );
    const categoryProducts = storeCategories.map(category => ({
      category,
      products: merchantProducts.filter(product => product.storeCategorySlug === category.slug)
    }));
    const unassignedProducts = merchantProducts.filter(product =>
      !storeCategories.some(category => category.slug === product.storeCategorySlug)
    );
    let answer = '';
    let resultProducts: Product[] = [];

    if (/空系列|空分类|没有商品的系列|empty collection|empty categor/i.test(query)) {
      const emptyCategories = categoryProducts.filter(item => item.products.length === 0);
      answer = emptyCategories.length
        ? `找到 ${emptyCategories.length} 个空分类：${emptyCategories.map(item => item.category.name).join('、')}。`
        : '没有空分类。';
    } else if (/没有系列|未归类|未分类|不属于任何系列|unassigned|uncategorized/i.test(query)) {
      resultProducts = unassignedProducts;
      answer = `找到 ${unassignedProducts.length} 款商品未归入店铺分类。`;
    } else if (/系列|分类/.test(query) && /图片/.test(query) && /描述/.test(query) && /缺|没有|无/.test(query)) {
      const missingImageProducts = merchantProducts.filter(product => !hasImage(product));
      const missingDescriptionProducts = merchantProducts.filter(product => !product.description?.trim());
      const affectedCategories = categoryProducts.filter(item =>
        item.products.some(product => !hasImage(product) || !product.description?.trim())
      );
      resultProducts = [...new Map([...missingImageProducts, ...missingDescriptionProducts]
        .filter(product => storeCategories.some(category => category.slug === product.storeCategorySlug))
        .map(product => [product.id, product])).values()];
      answer = `${affectedCategories.length} 个分类含有缺图或缺描述的商品：${affectedCategories.map(item => item.category.name).join('、') || '无'}。下方列出需补充资料的商品。`;
    } else if (/系列.{0,8}(?:没有图片|缺图片|无图片)|分类.{0,8}(?:没有图片|缺图片|无图片)|collection.{0,12}no image/i.test(query)) {
      const affected = categoryProducts.filter(item => item.products.length > 0 && item.products.some(product => !hasImage(product)));
      resultProducts = affected.flatMap(item => item.products.filter(product => !hasImage(product)));
      answer = `有 ${affected.length} 个分类含有缺少图片的商品，共 ${resultProducts.length} 款：${affected.map(item => item.category.name).join('、') || '无'}。`;
    } else if (/系列.{0,8}(?:没有描述|缺描述|无描述)|分类.{0,8}(?:没有描述|缺描述|无描述)|collection.{0,12}no description/i.test(query)) {
      const affected = categoryProducts.filter(item => item.products.length > 0 && item.products.some(product => !product.description?.trim()));
      resultProducts = affected.flatMap(item => item.products.filter(product => !product.description?.trim()));
      answer = `有 ${affected.length} 个分类含有缺少描述的商品，共 ${resultProducts.length} 款：${affected.map(item => item.category.name).join('、') || '无'}。`;
    } else if (/产品.{0,12}(?:属于|在哪|所属)|(?:属于|在哪个).{0,12}系列|product.{0,12}collection/i.test(query)) {
      const matchedProduct = merchantProducts.find(product =>
        [product.styleNo, product.name, product.name_zh, product.name_it, ...(product.skus || []).flatMap(sku => [sku.sku, sku.barcode])]
          .some(value => Boolean(value) && normalized.includes(value!.toLocaleLowerCase()))
      );
      if (matchedProduct) {
        const memberships = storeCategories.filter(category => category.slug === matchedProduct.storeCategorySlug);
        answer = memberships.length
          ? `${matchedProduct.styleNo} · ${matchedProduct.name_zh || matchedProduct.name} 属于「${memberships.map(category => category.name).join('、')}」。`
          : `${matchedProduct.styleNo} · ${matchedProduct.name_zh || matchedProduct.name} 没有匹配到现有店铺分类。`;
        resultProducts = [matchedProduct];
      } else {
        answer = '没有从问题中识别到确切的款号、SKU、条码或商品名称。请补充其中一项，我会按本店商品资料查询。';
      }
    } else if (/建议|规划|recommend|plan/i.test(query) && /系列|分类|商品|产品|collection|categor/i.test(query)) {
      const groups = new Map<string, number>();
      merchantProducts.forEach(product => {
        const group = product.subCategory?.trim() || product.category?.trim();
        if (group) groups.set(group, (groups.get(group) || 0) + 1);
      });
      const recommendations = [...groups.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
      answer = recommendations.length
        ? `按商品品类建议以下店铺分类：${recommendations.map(([name, count]) => `${name}（${count} 款）`).join('、')}。建议不会自动创建，可在页面中手动新增。`
        : '当前商品资料没有可用于分组的品类。';
    } else if (matchedCategory) {
      const productsInCategory = merchantProducts.filter(product => product.storeCategorySlug === matchedCategory.slug);
      resultProducts = productsInCategory;
      answer = `「${matchedCategory.name}」包含 ${productsInCategory.length} 款商品。${productsInCategory.length ? `商品：${productsInCategory.slice(0, 12).map(product => `${product.styleNo} ${product.name_zh || product.name}`).join('、')}${productsInCategory.length > 12 ? '…' : ''}` : ''}`;
    } else if (/系列|分类|collection|category|手动|智能|规则/i.test(query)) {
      const listing = categoryProducts.map(({ category, products: items }) => `${category.name}（${items.length} 款）`);
      answer = `店铺分类 ${storeCategories.length} 个。${listing.length ? `\n${listing.join('；')}` : ''}`;
    } else {
      answer = '可以查询分类商品数、未归类商品，或让我拟定分类名称。';
    }
    const matchedProducts = resultProducts.slice(0, 20).map(product => `${product.styleNo} · ${product.name_zh || product.name}`).join('\n');
    showAssistantLocalReply(query, matchedProducts ? `${answer}\n\n${matchedProducts}` : answer);
  };
  const submitAssistantQuestion = (question: string) => {
    const query = question.trim();
    if (!query || assistantBusy) return;
    if (assistantTaskMode) {
      void submitAssistantTask(query);
      return;
    }
    setAssistantPanelOpen(true);
    setAssistantPanelExpanded(true);
    setAssistantQuestion('');
    if (activeTab === 'products') {
      if (isAddingProduct) {
        void askOperatingAssistant(query, { forcePageContext: true });
      } else if (productWorkspaceSection === 'categories') runProductSeriesAiQuery(query);
      else if (/新增商品|创建商品|发布新商品|add product|create product/i.test(query)) {
        void beginProductCreation().then(opened => {
          if (opened) showAssistantLocalReply(query, '已打开商品创建表单，起订量已使用店铺默认值。请核对商品资料、SKU、价格和库存后保存或发布。');
        });
      } else runProductAiQuery(query);
      return;
    }
    if (activeTab === 'orders') {
      if (/准备|新建|创建|新增|prepare|create/i.test(query) && /报价|quote/i.test(query)) {
        openDraftQuoteForm(query);
        showAssistantLocalReply(query, '已打开草稿报价表单，请核对客户、商品和数量后再保存。');
      } else if (/预填|编辑所选订单|prepare.*order/i.test(query) && selectedOrderForAiEdit) {
        openOrderDetail(selectedOrderForAiEdit.id);
        prepareOrderEdit(selectedOrderForAiEdit);
        showAssistantLocalReply(query, '已打开所选订单的资料编辑表单。请核对信息后再保存。');
      } else runOrderAiQuery(query);
      return;
    }
    if (activeTab === 'customers') {
      runCustomerAiQuery(query);
      return;
    }
    void askOperatingAssistant(query, { forcePageContext: true });
  };
  const saveCategoryMembership = async () => {
    const category = storeCategories.find(item => item.id === categoryMembershipId);
    if (!category || categoryMembershipBusy) return;
    const productsToMove = categoryMembershipProductIds.filter(id =>
      merchantProducts.some(      product => product.id === id && product.storeCategorySlug !== category.slug)
    );
    if (!productsToMove.length) {
      addNotification('warning', '没有需要调整的商品', '所选商品已属于此分类');
      return;
    }
    if (productsToMove.length > 500) {
      addNotification('warning', '一次最多调整 500 款', '请分批选择后保存');
      return;
    }
    if (!window.confirm(`将 ${productsToMove.length} 款商品归入「${category.name}」？这会替换它们当前的店铺分类。`)) return;
    setCategoryMembershipBusy(true);
    try {
      const result = await apiPut<{ success: true; count: number; products: Product[] }>('/api/merchant/products/batch', { productIds: productsToMove, storeCategorySlug: category.slug });
      if (serverProducts === null) {
        try {
          await refreshMerchantOperations();
        } catch (error) {
          addNotification('warning', '分类已保存，列表刷新失败', error instanceof Error ? error.message : '请刷新页面确认结果');
          return;
        }
      } else {
        setServerProducts(previous => previous?.map(product => result.products.find(updated => updated.id === product.id) || product) || previous);
      }
      setCategoryMembershipProductIds(previous => [...new Set([...previous, ...result.products.map(product => product.id)])]);
      addNotification('success', '店铺分类已更新', `${result.count} 款已归入「${category.name}」`);
    } catch (error) {
      addNotification('warning', '店铺分类更新失败', error instanceof Error ? error.message : '请刷新页面确认商品归属');
    } finally {
      setCategoryMembershipBusy(false);
    }
  };
  const saveCurrentProductView = () => {
    if (!currentMerchantId) return;
    const name = window.prompt('为当前商品筛选视图命名（例如：冬季低库存）')?.trim();
    if (!name) return;
    const preset: ProductViewPreset = {
      id: crypto.randomUUID(),
      name: name.slice(0, 40),
      search: productSearch,
      lifecycle: productLifecycleFilter,
      zone: productZoneFilter,
      category: productCategoryFilter,
      sort: productSort,
      quickView: productQuickView
    };
    const nextViews = [...savedProductViews.filter(view => view.name !== preset.name), preset].slice(-20);
    try {
      window.localStorage.setItem(`ruda-product-views:${currentMerchantId}`, JSON.stringify(nextViews));
      setSavedProductViews(nextViews);
      setSelectedProductView(preset.id);
      addNotification('success', '商品视图已保存', '此视图仅保存在此设备，并按商家账号区分。');
    } catch (error) {
      addNotification('warning', '商品视图保存失败', '设备可用空间不足，请清理空间后重试。');
    }
  };
  const applySavedProductView = (viewId: string) => {
    setSelectedProductView(viewId);
    const view = savedProductViews.find(item => item.id === viewId);
    if (!view) return;
    setProductSearch(view.search);
    setProductLifecycleFilter(view.lifecycle);
    setProductZoneFilter(view.zone);
    setProductCategoryFilter(view.category);
    setProductSort(view.sort);
    setProductQuickView(view.quickView);
  };
  const deleteSavedProductView = () => {
    if (!currentMerchantId || !selectedProductView) return;
    const nextViews = savedProductViews.filter(view => view.id !== selectedProductView);
    try {
      window.localStorage.setItem(`ruda-product-views:${currentMerchantId}`, JSON.stringify(nextViews));
      setSavedProductViews(nextViews);
      setSelectedProductView('');
    } catch (error) {
      addNotification('warning', '商品视图删除失败', '请刷新页面后重试。');
    }
  };

  // Submit stock transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/merchant/transfers', {
        fromLocation: transferData.fromLocation,
        toLocation: transferData.toLocation,
        styleNo: transferData.styleNo,
        sku: transferData.sku,
        quantity: Number(transferData.quantity),
        notes: transferData.notes
      });
      await refreshMerchantOperations();
      addNotification('success', '调拨申请已提交', `已向仓储中心提交 ${transferData.quantity} 件商品的调拨申请`);
      setIsTransferModalOpen(false);
    } catch (error) {
      addNotification('warning', '调拨申请失败', error instanceof Error ? error.message : '请核对库存与仓库信息');
    }
  };

  const handleReturnReview = async (returnRequest: MerchantReturn, status: 'approved' | 'rejected') => {
    try {
      await apiPut(`/api/merchant/returns/${encodeURIComponent(returnRequest.id)}/review`, { status });
      await refreshMerchantOperations();
      addNotification(
        status === 'approved' ? 'success' : 'info',
        status === 'approved' ? '退货申请已批准' : '退货申请已拒绝',
        `${returnRequest.order.orderNo} 的售后状态已更新`
      );
    } catch (error) {
      addNotification('warning', '退货审核失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const handleReturnReceive = async (returnRequest: MerchantReturn) => {
    try {
      await apiPost(`/api/merchant/returns/${encodeURIComponent(returnRequest.id)}/receive`, {});
      await refreshMerchantOperations();
      addNotification('success', '已登记退货收货', `${returnRequest.order.orderNo}：已入库并提交退款处理；实际退款以支付渠道回执为准`);
    } catch (error) {
      addNotification('warning', '退货收货登记失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  // Order fulfillment submission
  const openOrderFulfillment = (order: Order) => {
    setSelectedOrderForFulfill(order);
    setFulfillCarrier('');
    setFulfillTracking('');
    setFulfillNotes('');
    setFulfillQuantities(Object.fromEntries(order.items.map(item => [item.id, item.quantity])));
    setSelectedOrderDetailId(null);
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForFulfill) return;
    try {
      const nextStatus = selectedOrderForFulfill.status === 'placed' || selectedOrderForFulfill.status === 'pending'
        ? 'confirmed'
        : selectedOrderForFulfill.status === 'confirmed' ? 'picking' : null;
      if (nextStatus) {
        await apiPut(`/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/fulfill`, {
          status: nextStatus,
          notes: fulfillNotes || (nextStatus === 'confirmed' ? '商家已接受订单并确认供货安排，等待买家付款' : '商家已开始配货')
        });
      } else if (selectedOrderForFulfill.status === 'picking') {
        if (!fulfillCarrier.trim() || !fulfillTracking.trim()) {
          throw new Error('请填写真实承运商和物流单号后再创建包裹');
        }
        const alreadyShippedByItem = new Map<string, number>();
        fulfillShipments
          .filter(shipment => ['shipped', 'delivered', 'exception'].includes(shipment.status))
          .forEach(shipment => shipment.items.forEach(item => {
            alreadyShippedByItem.set(item.orderItemId, (alreadyShippedByItem.get(item.orderItemId) || 0) + item.quantity);
          }));
        const items = selectedOrderForFulfill.items
          .map(item => ({ orderItemId: item.id, quantity: Number(fulfillQuantities[item.id] || 0) }))
          .filter(item => item.quantity > 0);
        if (!items.length) throw new Error('请至少填写一个本次发货 SKU 数量');
        if (items.some(requested => {
          const orderedItem = selectedOrderForFulfill.items.find(item => item.id === requested.orderItemId);
          return !orderedItem || requested.quantity > orderedItem.quantity - (alreadyShippedByItem.get(requested.orderItemId) || 0);
        })) {
          throw new Error('本次发货数量超过订单剩余未发数量');
        }
        await apiPost(`/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments`, {
          items,
          carrier: fulfillCarrier,
          trackingNumber: fulfillTracking.trim(),
        });
      } else {
        throw new Error('ORDER_NOT_READY_FOR_FULFILLMENT');
      }
      await refreshMerchantOperations();
      addNotification('success', nextStatus === 'confirmed' ? '订单已确认' : nextStatus === 'picking' ? '订单已进入配货' : '包裹已创建', `订单 ${selectedOrderForFulfill.orderNo} 履约状态已更新`);
      setSelectedOrderForFulfill(null);
      setFulfillTracking('');
      setFulfillNotes('');
    } catch (error) {
      addNotification('warning', '订单发货失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const handleConfirmBankTransfer = async (order: Order) => {
    const paymentReference = order.bankTransferReference?.trim();
    if (!paymentReference || !window.confirm(`请核对订单 ${order.orderNo} 的实际到账金额，再确认银行转账已收款。`)) return;
    try {
      await apiPost(`/api/merchant/orders/${encodeURIComponent(order.id)}/confirm-bank-transfer`, { paymentReference });
      await refreshMerchantOperations();
      addNotification('success', '已确认银行到账', `${order.orderNo} 已标记付款完成，可以开始备货。`);
    } catch (error) {
      addNotification('warning', '确认收款失败', error instanceof Error ? error.message : '请核对参考号和到账记录后重试');
    }
  };

  const handleTriggerCustomBalance = async (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    if (!agreement || agreement.status !== 'active') return;
    const note = window.prompt('请记录已满足的余款条件及核实依据：')?.trim();
    if (!note || note.length < 3) return;
    try {
      await apiPost(
        `/api/merchant/orders/${encodeURIComponent(order.id)}/agreements/${encodeURIComponent(agreement.id)}/trigger-balance`,
        { note }
      );
      await refreshMerchantOperations();
      addNotification('success', '余款任务已解锁', `约定版本 ${agreement.version} 的核实记录已保存并通知客户。`);
    } catch (error) {
      addNotification('warning', '余款条件核实失败', error instanceof Error ? error.message : '请刷新订单后重试');
    }
  };

  const updateShipmentStatus = async (shipment: (typeof fulfillShipments)[number], status: 'shipped' | 'exception' | 'cancelled') => {
    if (!selectedOrderForFulfill) return;
    try {
      await apiPut(`/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments/${encodeURIComponent(shipment.id)}`, {
        status,
        note: status === 'exception'
          ? '商家标记包裹物流异常'
          : status === 'cancelled'
            ? '商家取消未发出的包裹'
            : shipment.status === 'packed'
              ? '商家确认包裹已交承运商；运输节点以承运商记录为准'
              : '商家确认包裹恢复运输'
      });
      const result = await apiGet<{ success: true; shipments: typeof fulfillShipments }>(
        `/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments`
      );
      setFulfillShipments(result.shipments);
      await refreshMerchantOperations();
      addNotification(status === 'exception' ? 'warning' : 'success', status === 'exception' ? '包裹已标记异常' : status === 'cancelled' ? '包裹已取消' : '包裹已恢复履约', shipment.shipmentNo);
    } catch (error) {
      addNotification('warning', '包裹状态更新失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  const loadTrackingEvents = async (shipmentId: string) => {
    if (!selectedOrderForFulfill) return;
    try {
      const result = await apiGet<{ success: true; events: typeof trackingEvents }>(`/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments/${encodeURIComponent(shipmentId)}/tracking`);
      setTrackingShipmentId(shipmentId);
      setTrackingEvents(result.events);
    } catch (error) {
      addNotification('warning', '物流轨迹读取失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };
  const openProductCategories = () => {
    openSidebarNav('products');
    setProductWorkspaceSection('categories');
    setActiveTab('products');
  };
  const openProductCatalog = () => {
    setProductWorkspaceSection('catalog');
    setActiveTab('products');
  };
  const openContentSection = (section: ContentKind) => {
    setContentSection(section);
    setActiveTab('content');
    openSidebarNav('store');
  };
  const openMerchantHome = () => {
    setDashboardNavSection('home');
    setActiveTab('dashboard');
    setSidebarNavExpanded(null);
    window.requestAnimationFrame(() => document.getElementById('merchant-dashboard-home')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openMerchantSettings = () => {
    setSidebarNavExpanded(null);
    setSettingsSubsection('general');
    setActiveSettingsEntry('general');
    setSettingsNotice(null);
    setSettingsSearch('');
    setAssistantPanelOpen(false);
    setAssistantPanelExpanded(false);
    setActiveTab('settings');
  };
  const openMerchantAnalytics = () => {
    openSidebarNav('dashboard');
    setDashboardNavSection('analytics');
    setActiveTab('dashboard');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('merchant-analytics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };
  const openTeamSettings = (section: 'team' | 'roles' = 'team') => {
    setSidebarNavExpanded(null);
    setSettingsSubsection(section);
    setActiveSettingsEntry(section === 'team' ? 'users' : 'roles');
    setActiveTab('settings');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('merchant-team-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };
  const openSettingsSection = (section: 'general' | 'rules' | 'notifications' | 'mobile' | 'team' | 'storefront') => {
    if (section === 'storefront') {
      setActiveTab('profile');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById('merchant-storefront-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return;
    }
    const sectionIds = {
      general: 'merchant-settings-general',
      rules: 'merchant-settings-rules',
      notifications: 'merchant-settings-notifications',
      mobile: 'merchant-settings-mobile',
      team: 'merchant-team-settings'
    } as const;
    setSidebarNavExpanded(null);
    if (section === 'rules') setActiveSettingsEntry('checkout');
    else if (section === 'notifications') setActiveSettingsEntry('notifications');
    else if (section === 'team') setActiveSettingsEntry('users');
    setSettingsSubsection(section);
    setActiveTab('settings');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(sectionIds[section])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };
  const merchantSettingsGroups = [
    {
      label: localizeCopy('店铺账户', 'Negozio e account'),
      entries: [
        ['general', localizeCopy('常规设置', 'Generale'), localizeCopy('店铺资料、地址和联系人。', 'Profilo, indirizzo e contatti.')],
        ['plan', localizeCopy('套餐管理', 'Piano'), localizeCopy('RUDA 套餐管理尚未开放。', 'Piani self-service non disponibili.')],
        ['billing', localizeCopy('账单结算', 'Fatturazione'), localizeCopy('查看 RUDA 结算与收款账户。', 'Saldo e liquidazioni RUDA.')],
        ['users', localizeCopy('用户管理', 'Utenti'), localizeCopy('员工账号及其后台访问。', 'Account dei dipendenti.')],
        ['roles', localizeCopy('角色权限', 'Ruoli'), localizeCopy('配置员工岗位权限。', 'Permessi per ruolo.')],
        ['security', localizeCopy('安全设置', 'Sicurezza'), localizeCopy('商家登录保护尚无独立配置页。', 'Protezione account non gestita qui.')]
      ] as const
    },
    {
      label: localizeCopy('销售交付', 'Vendite e consegna'),
      entries: [
        ['payments', localizeCopy('支付设置', 'Pagamenti'), localizeCopy('结算账户与收款状态；线下 POS 需人工确认。', 'Liquidazioni e incassi manuali.')],
        ['checkout', localizeCopy('结账规则', 'Checkout'), localizeCopy('MOQ、默认账期和运费说明。', 'Regole ordine e termini.')],
        ['customer-accounts', localizeCopy('客户账户', 'Account clienti'), localizeCopy('管理已认证的 B2B 客户账户。', 'Clienti B2B verificati.')],
        ['shipping', localizeCopy('配送设置', 'Spedizione e consegna'), localizeCopy('订单履约、物流与自提处理。', 'Ordini, ritiro e spedizioni.')],
        ['taxes', localizeCopy('税务设置', 'Imposte e dazi'), localizeCopy('商家资料中的 VAT/税号。', 'Dati fiscali nel profilo.')],
        ['locations', localizeCopy('仓库地点', 'Sedi'), localizeCopy('门店地址与 RUDA 中心仓。', 'Indirizzo negozio e magazzino centrale.')]
      ] as const
    },
    {
      label: localizeCopy('渠道内容', 'Canali e contenuti'),
      entries: [
        ['apps', localizeCopy('应用管理', 'App'), localizeCopy('浏览和管理可用应用。', 'Gestisci le app disponibili.')],
        ['sales-channels', localizeCopy('销售渠道', 'Canali di vendita'), localizeCopy('RUDA 网店与店铺链接。', 'Vetrina RUDA e link negozio.')],
        ['domains', localizeCopy('店铺域名', 'Domini'), localizeCopy('查看 RUDA 店铺链接；暂不支持自定义域名。', 'URL RUDA assegnato.')],
        ['languages', localizeCopy('语言设置', 'Lingue'), localizeCopy('企业中心语言与多语言店铺内容。', 'Lingua account e contenuti.')],
        ['notifications', localizeCopy('通知设置', 'Notifiche'), localizeCopy('订单、结算和授权申请提醒。', 'Preferenze avvisi merchant.')]
      ] as const
    },
    {
      label: localizeCopy('数据合规', 'Dati e conformità'),
      entries: [
        ['customer-events', localizeCopy('客户事件', 'Eventi cliente'), localizeCopy('经营分析；客户行为像素尚未接入。', 'Analisi operativa; pixel non collegati.')],
        ['custom-data', localizeCopy('字段管理', 'Metacampi e metaoggetti'), localizeCopy('管理网店元对象内容。', 'Contenuti metaoggetto.')],
        ['privacy', localizeCopy('客户隐私', 'Privacy clienti'), localizeCopy('客户同意及跟踪设置尚未接入。', 'Consenso e pixel non configurabili.')],
        ['policies', localizeCopy('店铺政策', 'Policy'), localizeCopy('网店配送、退货等公开政策。', 'Policy vetrina pubblica.')]
      ] as const
    }
  ];
  const openSettingsPanel = (entry: MerchantSettingsEntryId) => {
    setActiveSettingsEntry(entry);
    setSettingsNotice(null);
    setSidebarNavExpanded(null);
    setSettingsSubsection('info');
    setActiveTab('settings');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('merchant-settings-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };
  const runMerchantSettingsEntry = (entry: MerchantSettingsEntryId) => {
    setActiveSettingsEntry(entry);
    setSettingsNotice(null);
    switch (entry) {
      case 'general':
        openSettingsSection('general');
        break;
      case 'plan':
        openSettingsPanel('plan');
        break;
      case 'billing':
        openSettingsPanel('billing');
        break;
      case 'users':
      case 'roles':
        openTeamSettings(entry === 'users' ? 'team' : 'roles');
        break;
      case 'security':
        openSettingsPanel('security');
        break;
      case 'payments':
        setSidebarNavExpanded(null);
        setActiveTab('settings');
        setSettingsSubsection('payments');
        break;
      case 'checkout':
        openSettingsSection('rules');
        break;
      case 'customer-accounts':
        openSettingsPanel('customer-accounts');
        break;
      case 'shipping':
        openSettingsPanel('shipping');
        break;
      case 'taxes':
        openSettingsPanel('taxes');
        break;
      case 'locations':
        openSettingsPanel('locations');
        break;
      case 'apps':
        setSidebarNavExpanded(null);
        setActiveTab('settings');
        setSettingsSubsection('info');
        setSettingsNotice(null);
        setActiveStoreAppId(null);
        break;
      case 'sales-channels':
        openSettingsPanel('sales-channels');
        break;
      case 'domains':
        openSettingsPanel('domains');
        break;
      case 'customer-events':
        openSettingsPanel('customer-events');
        break;
      case 'notifications':
        openSettingsSection('notifications');
        break;
      case 'custom-data':
        openSettingsPanel('custom-data');
        break;
      case 'languages':
        setSidebarNavExpanded(null);
        setSettingsSubsection('language');
        setActiveTab('settings');
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById('merchant-settings-language')?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
        break;
      case 'privacy':
        openSettingsPanel('privacy');
        break;
      case 'policies':
        openSettingsPanel('policies');
        break;
    }
  };
  const merchantSettingsEntryLabel = (entry: MerchantSettingsEntryId): string => {
    for (const group of merchantSettingsGroups) {
      for (const [id, label] of group.entries) {
        if (id === entry) return label;
      }
    }
    return localizeCopy('设置', 'Impostazioni');
  };
  const copyMerchantStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(merchantSharePath);
      addNotification('success', localizeCopy('店铺链接已复制', 'Link del negozio copiato'), merchantSharePath);
    } catch {
      addNotification('warning', localizeCopy('复制失败', 'Copia non riuscita'), localizeCopy('请手动选择并复制店铺链接。', 'Seleziona e copia il link manualmente.'));
    }
  };
  type MerchantSettingsInfoPanel = {
    summary: string;
    status: { label: string; tone: MerchantSettingsTone };
    scopeLabel: string;
    scope: MerchantSettingsScopeItem[];
    factsLabel?: string;
    facts?: MerchantSettingsFact[];
    note?: { text: string; tone?: 'neutral' | 'warning' };
    actions?: React.ReactNode;
  };
  const leaveSettingsFor = (tab: 'finance' | 'orders' | 'customers' | 'inventory', notice: MerchantSettingsNotice) => {
    setSidebarNavExpanded(null);
    setSettingsNotice(notice);
    setActiveTab(tab);
  };
  const getMerchantSettingsInfoPanel = (): MerchantSettingsInfoPanel | null => {
    const stateReady = localizeCopy('可用', 'Disponibile');
    const stateOff = localizeCopy('未接入', 'Non collegato');
    const defaultPaymentTerm = settingsForm.defaultPaymentTerm === 'prepaid'
      ? localizeCopy('预付', 'Anticipato')
      : settingsForm.defaultPaymentTerm.replace('net_', 'Net ');
    const approvedCustomerCount = merchantCustomers.filter(customer => customer.status === 'approved').length;
    const pendingCustomerCount = merchantCustomers.filter(customer => customer.status === 'pending').length;
    const rejectedCustomerCount = merchantCustomers.filter(customer => customer.status === 'rejected').length;
    const scopeLabel = localizeCopy('可用能力', 'Funzioni disponibili');
    const factsLabel = localizeCopy('当前资料', 'Dati attuali');
    const secondaryClass = merchantSettingsSecondaryButtonClass;
    const primaryClass = merchantSettingsPrimaryButtonClass;

    switch (activeSettingsEntry) {
      case 'plan':
        return {
          summary: localizeCopy('当前账户未开放自助套餐管理，店铺、商品和订单能力不受影响。', 'La gestione self-service del piano non è attiva; negozio, prodotti e ordini restano disponibili.'),
          status: { label: localizeCopy('未开放', 'Non disponibile'), tone: 'unavailable' },
          scopeLabel,
          scope: [
            { label: localizeCopy('套餐订阅与续费', 'Piano e rinnovo'), state: stateOff, tone: 'unavailable', detail: localizeCopy('后台不读取套餐价格、周期或续费日期。', 'Prezzo, periodo e rinnovo non sono letti dal portale.') },
            { label: localizeCopy('员工、应用与存储配额', 'Quote team, app e spazio'), state: stateOff, tone: 'unavailable', detail: localizeCopy('后台不按套餐限制员工数或应用安装。', 'Il portale non applica limiti di piano a team o app.') },
            { label: localizeCopy('店铺经营能力', 'Operatività del negozio'), state: stateReady, tone: 'ready', detail: localizeCopy('商品、订单、客户与结算不受本页影响。', 'Prodotti, ordini, clienti e liquidazioni non dipendono da questa pagina.') }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('店铺名称', 'Nome negozio'), value: currentMerchant.name },
            { label: localizeCopy('结算记录', 'Liquidazioni'), value: localizeCopy('在财务页查看', 'Nella sezione finanze') }
          ],
          note: { text: localizeCopy('套餐订阅与 RUDA 结算流水是两种数据；本页不推测套餐状态。', 'Piano e liquidazioni RUDA sono dati distinti; questa pagina non mostra stati stimati.') },
          actions: <>
            <button type="button" onClick={() => runMerchantSettingsEntry('billing')} className={secondaryClass}>{localizeCopy('查看账单与结算', 'Apri fatturazione')}</button>
            <button type="button" onClick={() => runMerchantSettingsEntry('apps')} className={primaryClass}>{localizeCopy('打开应用管理', 'Apri app')}</button>
          </>
        };
      case 'billing':
        return {
          summary: localizeCopy('RUDA 向商家的结算记录在财务页；商家对平台的订阅账单不在后台生成。', 'Le liquidazioni RUDA sono nella sezione finanze; le fatture di abbonamento non sono generate qui.'),
          status: { label: localizeCopy('只读', 'Sola lettura'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('结算余额与流水', 'Saldo e movimenti'), state: stateReady, tone: 'ready', detail: localizeCopy('在财务页查看 RUDA 结算记录。', 'Movimenti RUDA nella sezione finanze.') },
            { label: localizeCopy('收款账户', 'Conto di accredito'), state: stateReady, tone: 'ready', detail: localizeCopy('在支付设置中查看收款状态。', 'Stato incassi nelle impostazioni pagamenti.') },
            { label: localizeCopy('订阅账单与发票', 'Fatture abbonamento'), state: stateOff, tone: 'unavailable', detail: localizeCopy('后台不生成或下载订阅发票。', 'Il portale non genera né scarica fatture di abbonamento.') }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('店铺名称', 'Nome negozio'), value: currentMerchant.name },
            { label: localizeCopy('结算记录', 'Liquidazioni'), value: localizeCopy('财务页', 'Sezione finanze') },
            { label: localizeCopy('订阅账单', 'Fatture abbonamento'), value: localizeCopy('未生成', 'Non generate') }
          ],
          note: { text: localizeCopy('这里只说明数据结构，不展示商户对平台的扣费。', 'Qui sono descritti solo i dati; nessun addebito piattaforma è mostrato.') },
          actions: <button type="button" onClick={() => leaveSettingsFor('finance', { title: localizeCopy('账单与结算', 'Fatturazione e liquidazioni'), body: localizeCopy('此页管理商家收款账户及 RUDA 结算记录。', 'Questa pagina mostra saldo merchant, conto di accredito e liquidazioni RUDA.'), distinction: localizeCopy('这是 RUDA 向商家的结算，不是平台向商家开具的订阅账单。', 'Sono liquidazioni RUDA, non fatture di abbonamento.') })} className={primaryClass}>{localizeCopy('打开财务与结算', 'Apri finanze')}</button>
        };
      case 'security':
        return {
          summary: localizeCopy('账号密码可在此修改；登录设备、双因素认证和会话撤销尚未接入。', 'La password è modificabile qui; dispositivi, 2FA e revoca sessioni non sono collegati.'),
          status: { label: localizeCopy('密码可改', 'Password modificabile'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('修改登录密码', 'Modifica password'), state: stateReady, tone: 'ready', detail: localizeCopy('新密码立即生效，至少 12 个字符。', 'Attiva subito, minimo 12 caratteri.') },
            { label: localizeCopy('双因素认证', 'Autenticazione a due fattori'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('登录设备与会话', 'Dispositivi e sessioni'), state: stateOff, tone: 'unavailable', detail: localizeCopy('当前不能查看或撤销其他登录。', 'Non è possibile vedere o revocare altri accessi.') },
            { label: localizeCopy('员工账号与权限', 'Account e permessi staff'), state: stateReady, tone: 'ready', detail: localizeCopy('在用户管理中维护。', 'Gestiti nella sezione utenti.') }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('登录邮箱', 'Email di accesso'), value: currentMerchant.contactEmail || localizeCopy('未填写', 'Non indicata') },
            { label: localizeCopy('账号类型', 'Tipo account'), value: localizeCopy('商家管理员', 'Amministratore merchant') }
          ],
          actions: <button type="button" onClick={() => runMerchantSettingsEntry('users')} className={secondaryClass}>{localizeCopy('打开用户管理', 'Apri utenti')}</button>
        };
      case 'customer-accounts':
        return {
          summary: localizeCopy('客户账户由客户页管理；后台用户是商家员工，不属于客户账户。', 'Gli account clienti sono gestiti nella pagina clienti; gli utenti del portale sono staff.'),
          status: { label: localizeCopy('客户页管理', 'Gestione clienti'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('客户审核与资料', 'Verifica e dati cliente'), state: stateReady, tone: 'ready', detail: localizeCopy('在客户页审核、编辑和查看订单往来。', 'Verifica e modifica nella pagina clienti.') },
            { label: localizeCopy('客户注册开关', 'Attivazione registrazione'), state: stateOff, tone: 'unavailable', detail: localizeCopy('后台没有客户自助注册的独立开关。', 'Nessun interruttore di registrazione autonoma.') },
            { label: localizeCopy('客户登录密码', 'Password clienti'), state: stateOff, tone: 'unavailable', detail: localizeCopy('不在此重置客户密码。', 'Le password clienti non si reimpostano qui.') }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('已认证', 'Approvati'), value: String(approvedCustomerCount) },
            { label: localizeCopy('待审核', 'In attesa'), value: String(pendingCustomerCount) },
            { label: localizeCopy('已拒绝', 'Rifiutati'), value: String(rejectedCustomerCount) }
          ],
          note: { text: localizeCopy('客户账户是采购买家，与后台登录账号不同。', 'Gli account clienti sono acquirenti, non account del portale.') },
          actions: <button type="button" onClick={() => leaveSettingsFor('customers', { title: localizeCopy('客户账户', 'Account clienti'), body: localizeCopy('客户页管理已认证 B2B 买家资料和关系。', 'La pagina clienti gestisce acquirenti B2B verificati e il loro stato.'), distinction: localizeCopy('客户账户是购物买家；后台用户是商家员工。', 'Gli account clienti sono acquirenti; gli utenti del portale sono staff.') })} className={primaryClass}>{localizeCopy('打开客户管理', 'Apri clienti')}</button>
        };
      case 'shipping':
        return {
          summary: localizeCopy('发货在订单履约中登记；运费说明与默认账期在结账规则中维护。', 'Le spedizioni si registrano negli ordini; note di spedizione e termini sono nelle regole ordine.'),
          status: { label: localizeCopy('订单页处理', 'Gestione ordini'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('承运商与物流单号', 'Corriere e tracking'), state: stateReady, tone: 'ready', detail: localizeCopy('在订单履约中登记。', 'Registrati negli ordini.') },
            { label: localizeCopy('物流轨迹', 'Eventi di tracking'), state: stateReady, tone: 'ready', detail: localizeCopy('在订单履约中追加。', 'Aggiunti negli ordini.') },
            { label: localizeCopy('门店自提', 'Ritiro in negozio'), state: stateReady, tone: 'ready', detail: localizeCopy('在订单履约中标记。', 'Indicato negli ordini.') },
            { label: localizeCopy('多仓发货', 'Spedizione multi-sede'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('自动运费计算', 'Calcolo automatico spese'), state: stateOff, tone: 'unavailable', detail: localizeCopy('运费说明是文本，不参与结算计算。', 'Le note sono testo e non calcolano le spese.') }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('运费说明', 'Note di spedizione'), value: settingsForm.shippingNote || localizeCopy('未填写', 'Non indicate') },
            { label: localizeCopy('默认账期', 'Termini predefiniti'), value: defaultPaymentTerm }
          ],
          actions: <>
            <button type="button" onClick={() => leaveSettingsFor('orders', { title: localizeCopy('发货和配送', 'Spedizione e consegna'), body: localizeCopy('在订单履约中登记承运商、物流单号、物流轨迹和门店自提。', 'Gestisci evasione, corrieri, tracking e ritiro dagli ordini.'), distinction: localizeCopy('履约处理具体包裹；MOQ、账期等下单规则在结账规则。', 'Le regole MOQ e pagamento restano nelle regole ordine.') })} className={primaryClass}>{localizeCopy('打开订单履约', 'Apri ordini')}</button>
            <button type="button" onClick={() => runMerchantSettingsEntry('checkout')} className={secondaryClass}>{localizeCopy('编辑结账规则', 'Modifica regole ordine')}</button>
          </>
        };
      case 'taxes':
        return {
          summary: localizeCopy('VAT/税号和法定主体在商家资料中维护；自动计税尚未接入。', 'Partita IVA e ragione sociale sono nel profilo; il calcolo automatico non è collegato.'),
          status: { label: localizeCopy('资料页维护', 'Gestione profilo'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('税号与法定主体', 'Partita IVA e ragione sociale'), state: stateReady, tone: 'ready', detail: localizeCopy('在常规设置中编辑。', 'Modificabili nelle impostazioni generali.') },
            { label: localizeCopy('自动税费计算', 'Calcolo automatico imposte'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('跨境关税', 'Dazi transfrontalieri'), state: stateOff, tone: 'unavailable' }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('法定主体', 'Ragione sociale'), value: currentMerchant.companyLegalName || localizeCopy('未填写', 'Non indicata') },
            { label: localizeCopy('VAT/税号', 'Partita IVA'), value: currentMerchant.vatNumber || localizeCopy('未填写', 'Non indicata') },
            { label: localizeCopy('国家/地区', 'Paese'), value: currentMerchant.country || localizeCopy('未填写', 'Non indicato') },
            { label: localizeCopy('城市', 'Città'), value: currentMerchant.city || localizeCopy('未填写', 'Non indicata') }
          ],
          note: { text: localizeCopy('填写税号不会自动计税，也不会生成税务申报数据。', 'La partita IVA non attiva calcoli fiscali né dichiarazioni.') },
          actions: <button type="button" onClick={() => runMerchantSettingsEntry('general')} className={primaryClass}>{localizeCopy('编辑商家资料', 'Modifica profilo')}</button>
        };
      case 'locations':
        return {
          summary: localizeCopy('门店地址在商家资料中维护；库存统一使用 RUDA 共享中心仓。', 'La sede è nel profilo; le scorte usano il magazzino centrale RUDA.'),
          status: { label: localizeCopy('单仓', 'Sede unica'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('门店地址', 'Indirizzo sede'), state: stateReady, tone: 'ready', detail: localizeCopy('在常规设置中编辑。', 'Modificabile nelle impostazioni generali.') },
            { label: localizeCopy('共享中心仓库存', 'Scorte magazzino centrale'), state: stateReady, tone: 'ready', detail: localizeCopy('在库存页查看与调整。', 'Visibili e gestibili nella pagina scorte.') },
            { label: localizeCopy('多仓与独立库存', 'Più sedi e scorte separate'), state: stateOff, tone: 'unavailable' }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('门店地址', 'Indirizzo sede'), value: currentMerchant.showroomAddress || localizeCopy('未填写', 'Non indicato') },
            { label: localizeCopy('城市', 'Città'), value: currentMerchant.city || localizeCopy('未填写', 'Non indicata') },
            { label: localizeCopy('库存地点', 'Sede scorte'), value: localizeCopy('RUDA 共享中心仓', 'Magazzino centrale RUDA') }
          ],
          actions: <>
            <button type="button" onClick={() => runMerchantSettingsEntry('general')} className={secondaryClass}>{localizeCopy('编辑商家资料', 'Modifica profilo')}</button>
            <button type="button" onClick={() => leaveSettingsFor('inventory', { title: localizeCopy('库存', 'Scorte'), body: localizeCopy('库存页管理共享中心仓的可售与调整记录。', 'La pagina scorte gestisce disponibilità e rettifiche del magazzino centrale.') })} className={primaryClass}>{localizeCopy('打开库存', 'Apri scorte')}</button>
          </>
        };
      case 'sales-channels':
        return {
          summary: localizeCopy('当前销售渠道为 RUDA 网店；第三方平台渠道尚未接入。', 'Il canale attuale è la vetrina RUDA; i marketplace esterni non sono collegati.'),
          status: { label: localizeCopy('RUDA 网店', 'Vetrina RUDA'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('RUDA 网店', 'Vetrina RUDA'), state: stateReady, tone: 'ready', detail: localizeCopy('店铺展示设置管理品牌资料、内容与公开政策。', 'La vetrina gestisce brand, contenuti e policy.') },
            { label: localizeCopy('第三方平台渠道', 'Canali di terze parti'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('渠道商品同步', 'Sincronizzazione prodotti'), state: stateOff, tone: 'unavailable' }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('店铺名称', 'Nome negozio'), value: currentMerchant.name },
            { label: localizeCopy('店铺链接', 'Link negozio'), value: <a href={merchantSharePath} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2">{merchantSharePath}</a> }
          ],
          actions: <>
            <button type="button" onClick={() => void copyMerchantStoreLink()} className={secondaryClass}>{localizeCopy('复制店铺链接', 'Copia link negozio')}</button>
            <button type="button" onClick={() => { setSettingsNotice({ title: localizeCopy('销售渠道', 'Canali di vendita'), body: localizeCopy('店铺展示设置管理 RUDA 网店的品牌资料、内容与公开政策。', 'La vetrina gestisce brand, contenuti e policy pubbliche.') }); openSettingsSection('storefront'); }} className={primaryClass}>{localizeCopy('打开店铺展示', 'Apri vetrina')}</button>
          </>
        };
      case 'domains':
        return {
          summary: localizeCopy('每家店使用 RUDA 分配的独立链接；自定义域名尚未开放。', 'Ogni negozio usa il link RUDA assegnato; i domini personalizzati non sono disponibili.'),
          status: { label: localizeCopy('RUDA 链接', 'Link RUDA'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('RUDA 店铺链接', 'Link negozio RUDA'), state: stateReady, tone: 'ready', detail: localizeCopy('可直接预览和分享。', 'Anteprima e condivisione immediate.') },
            { label: localizeCopy('自定义域名绑定', 'Dominio personalizzato'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('SSL 与解析配置', 'SSL e configurazione DNS'), state: stateOff, tone: 'unavailable' }
          ],
          factsLabel,
          facts: [
            { label: localizeCopy('当前链接', 'Link attuale'), value: <span className="break-all">{merchantSharePath}</span> },
            { label: localizeCopy('显示名称', 'Nome visualizzato'), value: currentMerchant.name }
          ],
          actions: <>
            <button type="button" onClick={() => void copyMerchantStoreLink()} className={secondaryClass}>{localizeCopy('复制店铺链接', 'Copia link negozio')}</button>
            <a href={merchantSharePath} target="_blank" rel="noopener noreferrer" className={primaryClass}>{localizeCopy('预览网店', 'Anteprima negozio')}</a>
          </>
        };
      case 'customer-events':
        return {
          summary: localizeCopy('当前可查看订单、销售和库存汇总；客户行为事件与像素尚未接入。', 'Sono disponibili riepiloghi ordini, vendite e scorte; eventi comportamentali e pixel non sono collegati.'),
          status: { label: localizeCopy('汇总可用', 'Riepiloghi'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('订单、销售与库存汇总', 'Riepilogo ordini, vendite e scorte'), state: stateReady, tone: 'ready', detail: localizeCopy('在经营分析中查看。', 'Disponibili nelle analisi operative.') },
            { label: localizeCopy('页面浏览与加购事件', 'Visualizzazioni e carrelli'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('广告像素与归因', 'Pixel e attribuzione'), state: stateOff, tone: 'unavailable' }
          ],
          note: { text: localizeCopy('接入外部追踪前需完成客户同意与隐私评估。', 'Prima di integrare strumenti esterni servono consenso e valutazione privacy.'), tone: 'warning' },
          actions: <button type="button" onClick={() => { setSettingsNotice({ title: localizeCopy('客户事件', 'Eventi cliente'), body: localizeCopy('客户行为事件尚未接入；经营分析提供订单与销售汇总。', 'Gli eventi comportamentali non sono collegati; le analisi mostrano ordini e vendite.'), distinction: localizeCopy('经营报表不是网站像素事件。', 'Le analisi non sono eventi pixel.') }); openMerchantAnalytics(); }} className={primaryClass}>{localizeCopy('打开经营分析', 'Apri analisi')}</button>
        };
      case 'custom-data':
        return {
          summary: localizeCopy('现有元对象内容在内容工作台维护；元字段结构编辑尚未接入。', 'I contenuti metaoggetto sono gestiti nell’area contenuti; la struttura dei metacampi non è collegata.'),
          status: { label: localizeCopy('内容工作台', 'Area contenuti'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('元对象内容', 'Contenuti metaoggetto'), state: stateReady, tone: 'ready', detail: localizeCopy('在内容工作台维护已提供的元对象。', 'Contenuti disponibili nell’area contenuti.') },
            { label: localizeCopy('元字段与元对象结构', 'Struttura metacampi'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('主题自动绑定', 'Associazione automatica al tema'), state: stateOff, tone: 'unavailable' }
          ],
          actions: <button type="button" onClick={() => { setSettingsNotice({ title: localizeCopy('字段管理', 'Metacampi'), body: localizeCopy('元对象内容在内容工作台维护。', 'I contenuti metaoggetto sono nell’area contenuti.') }); openContentSection('metaobject'); }} className={primaryClass}>{localizeCopy('打开内容工作台', 'Apri contenuti')}</button>
        };
      case 'privacy':
        return {
          summary: localizeCopy('公开隐私说明在网站政策页展示；同意管理和追踪像素尚未接入。', 'L’informativa privacy è pubblica; consenso e pixel non sono collegati.'),
          status: { label: localizeCopy('部分可用', 'Parziale'), tone: 'manual' },
          scopeLabel,
          scope: [
            { label: localizeCopy('公开隐私政策', 'Informativa privacy'), state: stateReady, tone: 'ready', detail: localizeCopy('在网站政策页查看。', 'Consultabile nella pagina policy.') },
            { label: localizeCopy('客户同意管理', 'Gestione consensi'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('数据导出与删除', 'Esportazione e cancellazione'), state: stateOff, tone: 'unavailable', detail: localizeCopy('没有客户自助导出或删除入口。', 'Nessun accesso self-service per export o cancellazione.') },
            { label: localizeCopy('追踪像素', 'Pixel di tracciamento'), state: stateOff, tone: 'unavailable' }
          ],
          note: { text: localizeCopy('公开政策文本在店铺展示设置中维护，与同意管理是两项能力。', 'Le policy pubbliche sono nella vetrina e separate dalla gestione consensi.') },
          actions: <>
            <a href="/about#privacy" target="_blank" rel="noopener noreferrer" className={secondaryClass}>{localizeCopy('查看隐私政策', 'Leggi informativa')}</a>
            <button type="button" onClick={() => runMerchantSettingsEntry('policies')} className={primaryClass}>{localizeCopy('打开店铺政策', 'Apri policy')}</button>
          </>
        };
      case 'policies':
        return {
          summary: localizeCopy('配送、退货等公开政策在店铺展示设置中维护。', 'Le policy pubbliche di spedizione e reso sono gestite nella vetrina.'),
          status: { label: localizeCopy('店铺展示', 'Vetrina'), tone: 'ready' },
          scopeLabel,
          scope: [
            { label: localizeCopy('配送政策', 'Policy di spedizione'), state: stateReady, tone: 'ready', detail: localizeCopy('在店铺展示设置的公开文本中编辑。', 'Testo pubblico modificabile nella vetrina.') },
            { label: localizeCopy('退货政策', 'Policy di reso'), state: stateReady, tone: 'ready', detail: localizeCopy('在店铺展示设置的公开文本中编辑。', 'Testo pubblico modificabile nella vetrina.') },
            { label: localizeCopy('自动计税与运费', 'Imposte e spese automatiche'), state: stateOff, tone: 'unavailable' },
            { label: localizeCopy('退货资格判定', 'Verifica idoneità reso'), state: stateOff, tone: 'unavailable' }
          ],
          note: { text: localizeCopy('公开政策是文本说明，不会自动执行计税、运费或退货规则。', 'Le policy sono testi informativi e non applicano regole automatiche.') },
          actions: <button type="button" onClick={() => { setSettingsNotice({ title: localizeCopy('店铺政策', 'Policy del negozio'), body: localizeCopy('配送与退货政策在店铺展示设置的公开文本中维护。', 'Le policy di spedizione e reso sono nella vetrina.') }); openSettingsSection('storefront'); }} className={primaryClass}>{localizeCopy('打开店铺展示', 'Apri vetrina')}</button>
        };
      default:
        return null;
    }
  };

  const filteredMerchantSettingsGroups = merchantSettingsGroups
    .map(group => ({
      ...group,
      entries: group.entries.filter(([, label, description]) => `${label} ${description}`.toLocaleLowerCase().includes(settingsSearch.trim().toLocaleLowerCase()))
    }))
    .filter(group => group.entries.length > 0);

  const addTrackingEvent = async () => {
    if (!selectedOrderForFulfill || !trackingShipmentId || !trackingEventForm.status.trim()) return;
    try {
      await apiPost(`/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments/${encodeURIComponent(trackingShipmentId)}/tracking`, trackingEventForm);
      setTrackingEventForm({ status: '运输中', location: '', description: '' });
      await loadTrackingEvents(trackingShipmentId);
      addNotification('success', '物流轨迹已记录', '包裹最新状态已保存');
    } catch (error) {
      addNotification('warning', '物流轨迹保存失败', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  useEffect(() => {
    if (!selectedOrderForFulfill) {
      setFulfillShipments([]);
      return;
    }
    let active = true;
    setFulfillShipmentsLoading(true);
    void apiGet<{ success: true; shipments: typeof fulfillShipments }>(
      `/api/merchant/orders/${encodeURIComponent(selectedOrderForFulfill.id)}/shipments`
    ).then(result => {
      if (active) {
        setFulfillShipments(result.shipments);
        const alreadyShippedByItem = new Map<string, number>();
        result.shipments
          .filter(shipment => ['shipped', 'delivered', 'exception'].includes(shipment.status))
          .forEach(shipment => shipment.items.forEach(item => {
            alreadyShippedByItem.set(item.orderItemId, (alreadyShippedByItem.get(item.orderItemId) || 0) + item.quantity);
          }));
        setFulfillQuantities(Object.fromEntries(selectedOrderForFulfill.items.map(item => [
          item.id,
          Math.max(0, item.quantity - (alreadyShippedByItem.get(item.id) || 0))
        ])));
      }
    }).catch(error => {
      if (active) addNotification('warning', '包裹读取失败', error instanceof Error ? error.message : '请稍后重试');
    }).finally(() => {
      if (active) setFulfillShipmentsLoading(false);
    });
    return () => { active = false; };
  }, [selectedOrderForFulfill?.id]);

  useEffect(() => {
    if (!selectedOrderDetailId) {
      setMerchantOrderShipments([]);
      return;
    }
    let active = true;
    setMerchantOrderShipmentsLoading(true);
    void apiGet<{ success: true; shipments: typeof merchantOrderShipments }>(
      `/api/merchant/orders/${encodeURIComponent(selectedOrderDetailId)}/shipments`
    ).then(result => {
      if (active) setMerchantOrderShipments(result.shipments);
    }).catch(error => {
      if (active) {
        setMerchantOrderShipments([]);
        addNotification('warning', '包裹记录读取失败', error instanceof Error ? error.message : '请稍后重试');
      }
    }).finally(() => {
      if (active) setMerchantOrderShipmentsLoading(false);
    });
    return () => { active = false; };
  }, [selectedOrderDetailId]);

  if (activeTab === 'pos' && !IndustryWorkspace) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-neutral-100 text-neutral-900">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-xs font-black text-white">R</span>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-neutral-950">RUDA SMART POS</p>
              <p className="truncate text-[10px] text-neutral-500">{currentMerchant.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <Minimize2 className="h-4 w-4" />
            {localizeCopy('退出 POS', 'Esci dal POS')}
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          {isDemoMerchant && <div role="status" className="mb-4 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-xs font-medium text-neutral-800">演示环境 · 数据仅供功能测试，请勿录入真实业务。</div>}
          {!currentMerchant.isVerified && !currentMerchant.storefrontEnabled && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{localizeCopy('后台已开通，店铺尚未公开', 'Workspace attivo, negozio non ancora pubblico')}</p>
                <div className="flex flex-wrap gap-2 text-xs text-amber-900"><span>{localizeCopy('可完善企业资料', 'Completa il profilo aziendale')}</span><span>{localizeCopy('资质通过前不公开', 'Negozio non pubblico')}</span><span>{localizeCopy('通过前不可销售', 'Vendita non disponibile')}</span></div>
              </div>
              <button type="button" onClick={() => { setActiveTab('settings'); openSettingsSection('general'); }} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100">
                {localizeCopy('完善商家资料', 'Completa il profilo')}
              </button>
            </div>
          )}
          <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-neutral-500">{localizeCopy('智能 POS 正在加载…', 'Caricamento del POS…')}</div>}>
            <MerchantSmartPos
              key={currentMerchant.id}
              merchantId={currentMerchant.id}
              products={merchantProducts}
              customers={merchantCustomers}
              orders={serverOrders ?? []}
              operationsIntelligence={operationsIntelligence}
              merchantName={currentMerchant.name}
              merchantLocation={{
                city: isIt ? currentMerchant.city_it || currentMerchant.city : currentMerchant.city_zh || currentMerchant.city,
                country: isIt ? currentMerchant.country_it || currentMerchant.country : currentMerchant.country_zh || currentMerchant.country,
                address: currentMerchant.showroomAddress
              }}
              isIt={isIt}
              onOrderCreated={async () => { await refreshMerchantOperations(); }}
              onRefreshProducts={async () => {
                const result = await apiGet<{ success: true; products: Product[]; canManageCosts?: boolean }>('/api/merchant/products');
                setServerProducts(result.products);
                setCanManageProductCosts(result.canManageCosts === true);
              }}
              onNotify={addNotification}
              onAskAI={(question, onReply) => askOperatingAssistant(question, {
                openPanel: false,
                context: 'orders',
                scope: 'orders',
                onReply
              })}
              onOpenMerchantSettings={section => {
                setActiveTab('settings');
                if (section === 'staff') openTeamSettings();
                else openSettingsSection('general');
              }}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if ((activeTab === 'modagpt' || activeTab === 'fashion_studio') && currentMerchantId && currentMerchant) {
    if (!modauiEnabled) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white px-5">
          <div className="w-full max-w-md text-center">
            <p className="text-base font-semibold text-neutral-950">{localizeCopy('该功能暂未开放', 'Questa funzione non è al momento disponibile')}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">{localizeCopy('当前已由平台关闭。历史内容与数据均已保留，重新开启后可继续使用。', 'La funzione è stata disattivata dalla piattaforma. I contenuti restano salvati e torneranno disponibili alla riattivazione.')}</p>
            <button type="button" onClick={() => setActiveTab('dashboard')} className="mt-6 border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
              {localizeCopy('返回首页', 'Torna alla home')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-[100] flex flex-col justify-center bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {isDemoMerchant && <div role="status" className="mx-auto w-full max-w-5xl px-4 py-3 text-xs font-medium text-neutral-800">演示环境 · 数据仅供功能测试，请勿录入真实业务。</div>}
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">{localizeCopy('ModaUI 正在加载…', 'Caricamento di ModaUI…')}</div>}>
          {/* 单页工作台：五项创作能力与推理中枢都在这一页，不再有卡片落地页或第二层入口。 */}
          <ModaUIWorkbench
            key={currentMerchantId}
            isIt={isIt}
            merchantId={currentMerchantId}
            merchantName={currentMerchant.name}
            initialCapability={fashionStudioInitialMode
              ? fashionStudioInitialMode === 'productLaunch'
                ? 'studio'
                : fashionStudioInitialMode === 'edit' ? 'recolor' : fashionStudioInitialMode
              : null}
            onExit={() => {
              setFashionStudioInitialMode(null);
              setActiveTab('dashboard');
            }}
          />
        </Suspense>
      </div>
    );
  }

  const ordersAwaitingConfirmation = merchantOrders.filter(order => ['placed', 'pending'].includes(order.status)).length;
  const ordersAwaitingPicking = merchantOrders.filter(order => order.status === 'confirmed').length;
  const ordersAwaitingShipment = merchantOrders.filter(order => order.status === 'picking').length;
  const actionableOrderCount = ordersAwaitingConfirmation + ordersAwaitingPicking + ordersAwaitingShipment;
  const lowStockSkuCount = operationsIntelligence?.summary.lowStockSkus ?? lowStockCount;
  const lowStockMaterials = materialsLoaded
    ? materials.filter(material => material.status === 'active' && material.availableQuantity <= material.reorderPoint)
    : [];
  const lowStockFabricCount = lowStockMaterials.filter(material => ['fabric', 'lining'].includes(material.category)).length;
  const lowStockTrimCount = lowStockMaterials.filter(material => ['trim', 'label', 'packaging'].includes(material.category)).length;
  const inventoryAlerts = (operationsIntelligence?.alerts || []).filter(alert => ['stockout', 'slow_mover'].includes(alert.type));
  // 顶部品牌位显示已登录商家的真实公司名（法定主体优先），不再使用平台占位品牌。
  const merchantCompanyName = (currentMerchant.companyLegalName || currentMerchant.name || '').trim();

  return (
    <div id="merchant-web-layout" className={`merchant-web-layout mx-auto grid min-h-screen w-full max-w-none grid-cols-1 gap-0 lg:gap-0 ${activeTab === 'settings' ? 'lg:grid-cols-1' : assistantPanelOpen && !assistantPanelExpanded ? 'lg:grid-cols-[192px_minmax(0,1fr)_360px]' : 'lg:grid-cols-[192px_minmax(0,1fr)]'}`}>
      <header className="merchant-web-topbar sticky top-0 z-50 col-span-full flex h-14 items-center gap-3 bg-neutral-950 px-3 text-white shadow-sm sm:px-5">
        <div className="flex w-auto min-w-0 shrink-0 items-center gap-2 sm:w-[204px]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-black text-neutral-950">
            {(merchantCompanyName.charAt(0) || 'R').toUpperCase()}
          </span>
          <span
            className="min-w-0 truncate text-sm font-semibold tracking-tight"
            title={merchantCompanyName}
            aria-label={merchantCompanyName}
          >
            {merchantCompanyName}
          </span>
        </div>
        <div className="relative mx-auto hidden min-w-0 max-w-xl flex-1 items-center sm:flex">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" />
          <input
            aria-label={localizeCopy('搜索订单、商品和客户', 'Cerca in tutto il pannello')}
            value={globalSearch}
            onChange={event => {
              const value = event.target.value;
              setGlobalSearch(value);
              if (activeTab === 'orders' && orderView === 'orders') setOrderSearch(value);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') openFirstGlobalSearchResult();
              if (event.key === 'Escape') {
                setGlobalSearch('');
                if (activeTab === 'orders' && orderView === 'orders') setOrderSearch('');
              }
            }}
            placeholder={localizeCopy('搜索订单、商品和客户', 'Cerca ordini, prodotti e clienti')}
            className="h-9 w-full rounded-lg border border-white/10 bg-white/10 pl-9 pr-14 text-xs text-white placeholder:text-neutral-400 focus:border-white/30 focus:bg-white/15 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2.5 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-neutral-400">⌕</kbd>
          {normalizedGlobalSearch && (
            <div className="absolute left-0 right-0 top-11 z-[60] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 text-neutral-900 shadow-xl">
              {globalSearchResults.length ? globalSearchResults.map(result => {
                const ResultIcon = result.icon;
                return (
                  <button
                    type="button"
                    key={result.key}
                    onClick={() => {
                      setActiveTab(result.target);
                      if (result.target === 'orders') setOrderSearch(globalSearch);
                      if (result.target === 'products') setProductSearch(result.title.split(' · ')[0]);
                      setGlobalSearch('');
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
                  >
                    <ResultIcon className="h-4 w-4 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-800">{result.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-neutral-500">{result.detail}</span>
                    </span>
                  </button>
                );
              }) : <p className="px-3 py-3 text-xs text-neutral-500">{localizeCopy('没有找到相关订单、商品或客户', 'Nessun risultato')}</p>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-white/10 sm:px-3">
            <Home className="h-3.5 w-3.5" />{t('navStorefront')}
          </a>
          <a href={merchantSharePath} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-white/10 sm:flex">
            <ExternalLink className="h-3.5 w-3.5" />{localizeCopy('查看店铺', 'Negozio')}
          </a>
          <button type="button" aria-label={localizeCopy('查看待处理订单', 'Ordini da gestire')} onClick={() => setActiveTab('orders')} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white">
            <Bell className="h-4 w-4" />
            {orderActionCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-neutral-950" />}
          </button>
          <button type="button" aria-label={assistantPanelOpen ? (localizeCopy('关闭 GPTmoda 助手', 'Chiudi GPTmoda')) : (localizeCopy('打开 GPTmoda 助手', 'Apri GPTmoda'))} aria-expanded={assistantPanelOpen} onClick={() => setAssistantPanelOpen(open => !open)} className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold transition ${assistantPanelOpen ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-neutral-200 hover:bg-white/10'}`}>
            <UserRound className="h-4 w-4" /><span className="hidden sm:inline">GPTmoda</span>
          </button>
        </div>
      </header>
      {isDemoMerchant && <div role="status" className="col-span-full border-b border-neutral-300 bg-neutral-100 px-4 py-2 text-xs font-medium text-neutral-800 sm:px-6">演示环境 · 数据仅供功能测试，请勿录入真实业务。</div>}
      <aside className={`${activeTab === 'settings' ? 'hidden' : 'hidden lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-3.5rem)] lg:flex-col lg:overflow-hidden'} border-r border-neutral-200 bg-white p-3`}>
        <button
          type="button"
          onClick={() => setBusinessCardOpen(true)}
          aria-label={localizeCopy('打开商家名片', 'Apri scheda negozio')}
          className="flex w-full items-center gap-3 rounded-xl border-b border-neutral-100 px-2 pb-4 pt-2 text-left transition hover:bg-neutral-50 active:bg-neutral-100"
        >
          <img src={merchantLogo} alt="" className="h-10 w-10 rounded-xl border border-neutral-200 object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-neutral-950">{currentMerchant.name}</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        </button>
        <nav aria-label="商家后台导航" className="merchant-web-sidebar-nav mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-dashboard" onClick={openMerchantHome} className={`${navItemClass(activeTab === 'dashboard' && dashboardNavSection === 'home')} flex-1`}><Home className="h-4 w-4" />{localizeCopy('经营主页', 'Home')}</button>
              <button type="button" aria-label={dashboardNavIsExpanded ? '收起主页菜单' : '展开主页菜单'} aria-expanded={dashboardNavIsExpanded} onClick={() => toggleSidebarNav('dashboard')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${dashboardNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {dashboardNavIsExpanded && <button type="button" id="merchant-sidebar-growth-analytics" onClick={openMerchantAnalytics} className={settingsSubItemClass(activeTab === 'dashboard' && dashboardNavSection === 'analytics')}><BarChart3 className="h-3.5 w-3.5" />{localizeCopy('经营分析', 'Analisi')}</button>}
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-orders" onClick={() => { openSidebarNav('orders'); setActiveTab('orders'); }} className={`${navItemClass(activeTab === 'orders')} flex-1`}><Truck className="h-4 w-4" />{localizeCopy('订单履约', 'Ordini')}{orderActionCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-800">{orderActionCount > 99 ? '99+' : orderActionCount}</span>}</button>
              <button type="button" aria-label={orderNavIsExpanded ? '收起订单菜单' : '展开订单菜单'} aria-expanded={orderNavIsExpanded} onClick={() => toggleSidebarNav('orders')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${orderNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {orderNavIsExpanded && <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
              <button type="button" id="merchant-sidebar-tab-pos" onClick={() => setActiveTab('pos')} className={settingsSubItemClass(activeTab === 'pos')}><ShoppingCart className="h-3.5 w-3.5" />{localizeCopy('智能收银', 'Smart POS')}</button>
            </div>}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-products" onClick={() => { openSidebarNav('products'); openProductCatalog(); }} className={`${navItemClass(productNavIsActive)} flex-1`}><Package className="h-4 w-4" />{localizeCopy('商品管理', 'Prodotti')}</button>
              <button type="button" aria-label={productNavIsExpanded ? '收起商品菜单' : '展开商品菜单'} aria-expanded={productNavIsExpanded} onClick={() => toggleSidebarNav('products')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${productNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {productNavIsExpanded && <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
              <button type="button" id="merchant-sidebar-product-list" onClick={openProductCatalog} className={settingsSubItemClass(activeTab === 'products' && productWorkspaceSection === 'catalog')}><Package className="h-3.5 w-3.5" />{localizeCopy('商品列表', 'Catalogo prodotti')}</button>
              <button type="button" id="merchant-sidebar-product-categories" onClick={openProductCategories} className={settingsSubItemClass(activeTab === 'products' && productWorkspaceSection === 'categories')}><Layers className="h-3.5 w-3.5" />{localizeCopy('店铺分类', 'Categorie negozio')}</button>
              <button type="button" id="merchant-sidebar-tab-sku-matrix" onClick={() => setActiveTab('sku_matrix')} className={settingsSubItemClass(activeTab === 'sku_matrix')}><Barcode className="h-3.5 w-3.5" />{localizeCopy('款式规格', 'Varianti SKU')}</button>
            </div>}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-inventory" onClick={() => { openSidebarNav('supply'); setActiveTab('inventory'); }} className={`${navItemClass(supplyNavIsActive)} flex-1`}><Boxes className="h-4 w-4" />{localizeCopy('库存管理', 'Giacenze')}</button>
              <button type="button" aria-label={supplyNavIsExpanded ? '收起库存菜单' : '展开库存菜单'} aria-expanded={supplyNavIsExpanded} onClick={() => toggleSidebarNav('supply')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${supplyNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {supplyNavIsExpanded && <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
              <button type="button" id="merchant-sidebar-tab-inventory-ledger" onClick={() => setActiveTab('inventory')} className={settingsSubItemClass(activeTab === 'inventory')}><Boxes className="h-3.5 w-3.5" />{localizeCopy('库存台账', 'Scorte')}</button>
              <button type="button" id="merchant-sidebar-tab-materials" onClick={() => setActiveTab('materials')} className={settingsSubItemClass(activeTab === 'materials')}><Layers className="h-3.5 w-3.5" />{localizeCopy('物料库存', 'Materiali')}</button>
              <button type="button" id="merchant-sidebar-tab-production" onClick={() => setActiveTab('production')} className={settingsSubItemClass(activeTab === 'production')}><ClipboardCheck className="h-3.5 w-3.5" />{localizeCopy('生产工单', 'Produzione')}{productionWorkOrders.filter(order => !['completed', 'cancelled'].includes(order.status)).length > 0 && <span className="ml-auto text-[10px] text-neutral-400">{productionWorkOrders.filter(order => !['completed', 'cancelled'].includes(order.status)).length}</span>}</button>
              <button type="button" id="merchant-sidebar-tab-procurement" onClick={() => setActiveTab('procurement')} className={settingsSubItemClass(activeTab === 'procurement')}><ClipboardCheck className="h-3.5 w-3.5" />{localizeCopy('采购订单', 'Acquisti')}</button>
            </div>}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-customers" onClick={() => { openSidebarNav('customers'); setActiveTab('customers'); }} className={`${navItemClass(customerNavIsActive)} flex-1`}><UserCheck className="h-4 w-4" />{localizeCopy('客户管理', 'Clienti')}{pendingVaultCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-800">{pendingVaultCount > 99 ? '99+' : pendingVaultCount}</span>}</button>
              <button type="button" aria-label={customerNavIsExpanded ? '收起客户菜单' : '展开客户菜单'} aria-expanded={customerNavIsExpanded} onClick={() => toggleSidebarNav('customers')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${customerNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {customerNavIsExpanded && <button type="button" id="merchant-sidebar-tab-vault" onClick={() => setActiveTab('vault_requests')} className={`${settingsSubItemClass(activeTab === 'vault_requests')} relative`}><Lock className="h-3.5 w-3.5" />{localizeCopy('授权申请', 'Richieste private')}{pendingVaultCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-800">{pendingVaultCount > 99 ? '99+' : pendingVaultCount}</span>}</button>}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-growth" onClick={() => { setGrowthSection('overview'); setActiveTab('growth'); }} className={`${navItemClass(activeTab === 'growth')} flex-1`}><TrendingUp className="h-4 w-4" />{localizeCopy('营销增长', 'Crescita')}</button>
              <button type="button" aria-label={growthNavIsExpanded ? '收起增长菜单' : '展开增长菜单'} aria-expanded={growthNavIsExpanded} onClick={() => toggleSidebarNav('growth')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${growthNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {growthNavIsExpanded && <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
              <button type="button" id="merchant-sidebar-growth-overview" onClick={() => { setGrowthSection('overview'); setActiveTab('growth'); }} className={settingsSubItemClass(activeTab === 'growth' && growthSection === 'overview')}><BarChart3 className="h-3.5 w-3.5" />{localizeCopy('增长概览', 'Panoramica')}</button>
              <button type="button" id="merchant-sidebar-growth-autopilot" onClick={() => { setGrowthSection('autopilot'); setActiveTab('growth'); }} className={settingsSubItemClass(activeTab === 'growth' && growthSection === 'autopilot')}><Sparkles className="h-3.5 w-3.5" />{localizeCopy('智能运营', 'Autopilot')}</button>
              <button type="button" id="merchant-sidebar-growth-campaigns" onClick={() => { setGrowthSection('campaigns'); setActiveTab('growth'); }} className={settingsSubItemClass(activeTab === 'growth' && growthSection === 'campaigns')}><Send className="h-3.5 w-3.5" />{localizeCopy('营销活动', 'Campagne')}</button>
            </div>}
          </div>
          {modauiEnabled && <button type="button" id="merchant-sidebar-tab-modagpt" onClick={() => { setSidebarNavExpanded(null); setActiveTab('fashion_studio'); }} className={navItemClass(activeTab === 'fashion_studio' || activeTab === 'modagpt')}><Sparkles className="h-4 w-4" />{localizeCopy('创作空间', 'Studio ModaUI')}</button>}
          <div>
            <div className="flex items-center gap-1">
              <button type="button" id="merchant-sidebar-tab-store-content" onClick={() => toggleSidebarNav('store')} className={`${navItemClass(storeNavIsActive)} flex-1`}><Store className="h-4 w-4" />{localizeCopy('店铺内容', 'Negozio e contenuti')}</button>
              <button type="button" aria-label={storeNavIsExpanded ? '收起店铺与内容菜单' : '展开店铺与内容菜单'} aria-expanded={storeNavIsExpanded} onClick={() => toggleSidebarNav('store')} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${storeNavIsExpanded ? 'rotate-180' : ''}`} /></button>
            </div>
            {storeNavIsExpanded && <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
              <a href={merchantSharePath} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"><ExternalLink className="h-3.5 w-3.5" />{localizeCopy('店铺预览', 'Negozio online')}</a>
              <button type="button" id="merchant-sidebar-content-metaobject" onClick={() => openContentSection('metaobject')} className={settingsSubItemClass(activeTab === 'content' && contentSection === 'metaobject')}><Layers className="h-3.5 w-3.5" />{localizeCopy('内容对象', 'Metaoggetti')}</button>
              <button type="button" id="merchant-sidebar-content-menu" onClick={() => openContentSection('menu')} className={settingsSubItemClass(activeTab === 'content' && contentSection === 'menu')}><Menu className="h-3.5 w-3.5" />{localizeCopy('菜单管理', 'Menu')}</button>
              <button type="button" id="merchant-sidebar-content-blog" onClick={() => openContentSection('blog')} className={settingsSubItemClass(activeTab === 'content' && contentSection === 'blog')}><BookOpen className="h-3.5 w-3.5" />{localizeCopy('博客文章', 'Articoli del blog')}</button>
              <button type="button" id="merchant-sidebar-content-pages" onClick={() => openContentSection('page')} className={settingsSubItemClass(activeTab === 'content' && contentSection === 'page')}><FileText className="h-3.5 w-3.5" />{localizeCopy('内容页面', 'Pagine')}</button>
              <button type="button" id="merchant-sidebar-tab-gallery" onClick={() => setActiveTab('gallery')} className={settingsSubItemClass(activeTab === 'gallery')}><FolderOpen className="h-3.5 w-3.5" />{localizeCopy('内容素材', 'Contenuti media')}</button>
              <button type="button" id="merchant-sidebar-storefront-settings" onClick={() => openSettingsSection('storefront')} className={settingsSubItemClass(activeTab === 'profile')}><Store className="h-3.5 w-3.5" />{localizeCopy('店铺设置', 'Impostazioni vetrina')}</button>
            </div>}
          </div>
          <button type="button" id="merchant-sidebar-tab-finance" onClick={() => { setSidebarNavExpanded(null); setActiveTab('finance'); }} className={navItemClass(activeTab === 'finance')}><Receipt className="h-4 w-4" />{localizeCopy('财务结算', 'Pagamenti e saldo')}</button>
          <div className="border-t border-neutral-200 pt-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                id="merchant-sidebar-tab-apps"
                onClick={() => { openSidebarNav('apps'); setActiveTab('app_store'); }}
                className={`${navItemClass(appsNavIsActive)} flex-1`}
              >
                <Boxes className="h-4 w-4" />{localizeCopy('应用', 'App')}
              </button>
              <button
                type="button"
                aria-label={appsNavIsExpanded ? '收起应用菜单' : '展开应用菜单'}
                aria-expanded={appsNavIsExpanded}
                onClick={() => toggleSidebarNav('apps')}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${appsNavIsExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {appsNavIsExpanded && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
                <button type="button" id="merchant-sidebar-tab-app-store" onClick={() => setActiveTab('app_store')} className={settingsSubItemClass(activeTab === 'app_store')}><Boxes className="h-3.5 w-3.5" />{localizeCopy('应用商店', 'App store')}</button>
                <button type="button" id="merchant-sidebar-tab-recycle-bin" onClick={() => setActiveTab('recycle_bin')} className={settingsSubItemClass(activeTab === 'recycle_bin')}><Trash2 className="h-3.5 w-3.5" />{localizeCopy('回收站', 'Cestino')}</button>
              </div>
            )}
            <button type="button" id="merchant-sidebar-tab-ai-chat-history" onClick={() => { setSidebarNavExpanded(null); setActiveTab('ai_chat_history'); }} className={`${navItemClass(activeTab === 'ai_chat_history')} mt-1`}><MessageCircle className="h-4 w-4" />{localizeCopy('AI 聊天记录', 'Cronologia AI')}</button>
            <button type="button" id="merchant-sidebar-tab-recent-activity" onClick={() => { setSidebarNavExpanded(null); setActiveTab('recent_activity'); }} className={navItemClass(activeTab === 'recent_activity')}><Clock className="h-4 w-4" />{localizeCopy('最近动态', 'Attività recenti')}</button>
          </div>
        </nav>
        <div className="mt-3 shrink-0 space-y-1 border-t border-neutral-200 pt-3">
          <button type="button" id="merchant-sidebar-tab-ai-employees" onClick={() => { setSidebarNavExpanded(null); setActiveTab('ai_employees'); }} className={`${navItemClass(activeTab === 'ai_employees')} w-full`}><Bot className="h-4 w-4" />{localizeCopy('智能员工', 'Team AI')}</button>
          <button type="button" id="merchant-sidebar-tab-settings" onClick={openMerchantSettings} className={`${navItemClass(activeTab === 'settings')} w-full`}><SlidersHorizontal className="h-4 w-4" />{localizeCopy('系统设置', 'Impostazioni')}</button>
        </div>
      </aside>
      <main id="merchant-content-area" className="merchant-content-area min-w-0 space-y-4 bg-neutral-100/70 px-3 py-4 sm:px-5 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:px-6 lg:py-5">
      {!currentMerchant.isVerified && !currentMerchant.storefrontEnabled && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{localizeCopy('后台已开通，店铺尚未公开', 'Workspace attivo, negozio non ancora pubblico')}</p>
            <div className="flex flex-wrap gap-2 text-xs text-amber-900"><span>{localizeCopy('可完善企业资料', 'Completa il profilo aziendale')}</span><span>{localizeCopy('资质通过前不公开', 'Negozio non pubblico')}</span><span>{localizeCopy('通过前不可销售', 'Vendita non disponibile')}</span></div>
          </div>
          <button type="button" onClick={() => { setActiveTab('settings'); openSettingsSection('general'); }} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100">
            {localizeCopy('完善商家资料', 'Completa il profilo')}
          </button>
        </div>
      )}
      {/* 1. TOP TENANT HEADER & MERCHANT SWITCHER */}
      {activeTab === 'dashboard' && dashboardNavSection === 'analytics' && (
      <>
      <MerchantWorkspaceHeader
        title="经营分析"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        action={<ShareButton
          title={`${currentMerchant.name} · RUDA Fashion B2B`}
          text={localizeCopy("查看 {{RUDA_ARG_0}} 的官方独立店铺、现货货盘与授权系列", "Visita il negozio ufficiale {{RUDA_ARG_0}} e scopri la collezione pronta consegna.", [String(currentMerchant.name)])}
          path={merchantSubdomainUrl}
          source={`merchant-${currentMerchantId}`}
        />}
      />
      <MerchantAiReports />
      </>
      )}

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="merchant-web-horizontal-nav rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-sm lg:hidden">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-neutral-50/80 p-1">
          <button id="merchant-tab-dashboard" type="button" onClick={openMerchantHome} className={navItemClass(activeTab === 'dashboard' && dashboardNavSection === 'home')}><Home className="h-3.5 w-3.5" />{localizeCopy('经营主页', 'Home')}</button>
          <button id="merchant-tab-orders" type="button" onClick={() => setActiveTab('orders')} className={`${navItemClass(activeTab === 'orders')} relative`}><Truck className="h-3.5 w-3.5" />{localizeCopy('订单履约', 'Ordini')}{orderActionCount > 0 && <span className="min-w-4 rounded-full bg-neutral-200 px-1 text-center text-[10px] font-bold text-neutral-800">{orderActionCount > 99 ? '99+' : orderActionCount}</span>}</button>
          {modauiEnabled && <button id="merchant-tab-modagpt" type="button" onClick={() => setActiveTab('fashion_studio')} className={navItemClass(activeTab === 'fashion_studio' || activeTab === 'modagpt')}><Sparkles className="h-3.5 w-3.5" />{localizeCopy('创作空间', 'Studio ModaUI')}</button>}
          <button id="merchant-tab-pos" type="button" onClick={() => setActiveTab('pos')} className={navItemClass(false)}><ShoppingCart className="h-3.5 w-3.5" />{localizeCopy('智能收银', 'Smart POS')}</button>
          <button id="merchant-tab-products" type="button" onClick={openProductCatalog} className={navItemClass(activeTab === 'products')}><Package className="h-3.5 w-3.5" />{localizeCopy('商品管理', 'Prodotti')}</button>
          <button id="merchant-tab-customers" type="button" onClick={() => setActiveTab('customers')} className={navItemClass(activeTab === 'customers')}><UserCheck className="h-3.5 w-3.5" />{localizeCopy('客户管理', 'Clienti')}</button>
          <button id="merchant-tab-growth" type="button" onClick={() => { setGrowthSection('overview'); setActiveTab('growth'); }} className={navItemClass(activeTab === 'growth')}><TrendingUp className="h-3.5 w-3.5" />{localizeCopy('营销增长', 'Crescita')}</button>
          <button id="merchant-tab-finance" type="button" onClick={() => setActiveTab('finance')} className={navItemClass(activeTab === 'finance')}><Receipt className="h-3.5 w-3.5" />{localizeCopy('财务结算', 'Finanza')}</button>
          <button id="merchant-tab-more" type="button" aria-expanded={moreNavIsExpanded} aria-controls="merchant-tab-more-menu" onClick={() => setMoreNavExpanded(expanded => !expanded)} className={navItemClass(moreNavIsExpanded)}><SlidersHorizontal className="h-3.5 w-3.5" />{localizeCopy('更多', 'Altro')}<ChevronDown className={`h-3 w-3 transition-transform ${moreNavIsExpanded ? 'rotate-180' : ''}`} /></button>
        </div>
        {moreNavIsExpanded && <div id="merchant-tab-more-menu" className="mt-2 grid gap-3 rounded-xl border border-neutral-100 bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
          <section>
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('商品库存', 'Prodotti e scorte')}</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 p-2">
                <h3 className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('商品管理', 'Catalogo')}</h3>
                <div className="flex flex-wrap gap-1">
                  <button id="merchant-tab-product-categories" type="button" onClick={openProductCategories} className={navItemClass(false)}><Layers className="h-3.5 w-3.5" />{localizeCopy('店铺分类', 'Categorie negozio')}</button>
                  <button id="merchant-tab-sku-matrix" type="button" onClick={() => setActiveTab('sku_matrix')} className={navItemClass(activeTab === 'sku_matrix')}><Barcode className="h-3.5 w-3.5" />{localizeCopy('款式规格', 'Varianti SKU')}</button>
                </div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2">
                <h3 className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('库存台账', 'Scorte')}</h3>
                <div className="flex flex-wrap gap-1">
                  <button id="merchant-tab-inventory" type="button" onClick={() => setActiveTab('inventory')} className={navItemClass(activeTab === 'inventory')}><Boxes className="h-3.5 w-3.5" />{localizeCopy('库存管理', 'Giacenze')}</button>
                </div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2">
                <h3 className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('生产采购', 'Produzione e approvvigionamento')}</h3>
                <div className="flex flex-wrap gap-1">
                  <button id="merchant-tab-production" type="button" onClick={() => setActiveTab('production')} className={navItemClass(activeTab === 'production')}><ClipboardCheck className="h-3.5 w-3.5" />{localizeCopy('生产工单', 'Produzione')}</button>
                  <button id="merchant-tab-materials" type="button" onClick={() => setActiveTab('materials')} className={navItemClass(activeTab === 'materials')}><Layers className="h-3.5 w-3.5" />{localizeCopy('物料库存', 'Materiali')}</button>
                  <button id="merchant-tab-procurement" type="button" onClick={() => setActiveTab('procurement')} className={navItemClass(activeTab === 'procurement')}><ClipboardCheck className="h-3.5 w-3.5" />{localizeCopy('采购订单', 'Acquisti')}</button>
                </div>
              </div>
            </div>
          </section>
          <section>
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('客户分析', 'Clienti e analisi')}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <button id="merchant-tab-vault" type="button" onClick={() => setActiveTab('vault_requests')} className={`${navItemClass(activeTab === 'vault_requests')} relative`}><Lock className="h-3.5 w-3.5" />{localizeCopy('授权申请', 'Richieste private')}{pendingVaultCount > 0 && <span className="min-w-4 rounded-full bg-neutral-200 px-1 text-center text-[10px] font-bold text-neutral-800">{pendingVaultCount > 99 ? '99+' : pendingVaultCount}</span>}</button>
              <button id="merchant-tab-analytics" type="button" onClick={openMerchantAnalytics} className={navItemClass(activeTab === 'dashboard' && dashboardNavSection === 'analytics')}><BarChart3 className="h-3.5 w-3.5" />{localizeCopy('经营分析', 'Analisi')}</button>
            </div>
          </section>
          <section>
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('店铺帮助', 'Negozio e assistenza')}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <a id="merchant-tab-online-store" href={merchantSharePath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"><Store className="h-3.5 w-3.5" />{localizeCopy('店铺预览', 'Negozio online')}<ExternalLink className="h-3 w-3" /></a>
              <button id="merchant-tab-content-metaobject" type="button" onClick={() => openContentSection('metaobject')} className={navItemClass(activeTab === 'content' && contentSection === 'metaobject')}><Layers className="h-3.5 w-3.5" />{localizeCopy('内容对象', 'Metaoggetti')}</button>
              <button id="merchant-tab-content-menu" type="button" onClick={() => openContentSection('menu')} className={navItemClass(activeTab === 'content' && contentSection === 'menu')}><Menu className="h-3.5 w-3.5" />{localizeCopy('菜单管理', 'Menu')}</button>
              <button id="merchant-tab-content-blog" type="button" onClick={() => openContentSection('blog')} className={navItemClass(activeTab === 'content' && contentSection === 'blog')}><BookOpen className="h-3.5 w-3.5" />{localizeCopy('博客文章', 'Blog')}</button>
              <button id="merchant-tab-content-pages" type="button" onClick={() => openContentSection('page')} className={navItemClass(activeTab === 'content' && contentSection === 'page')}><FileText className="h-3.5 w-3.5" />{localizeCopy('内容页面', 'Pagine')}</button>
              <button id="merchant-tab-gallery" type="button" onClick={() => setActiveTab('gallery')} className={navItemClass(activeTab === 'gallery')}><FolderOpen className="h-3.5 w-3.5" />{localizeCopy('内容素材', 'Contenuti media')}</button>
              <button id="merchant-tab-storefront-settings" type="button" onClick={() => openSettingsSection('storefront')} className={navItemClass(activeTab === 'profile')}><Store className="h-3.5 w-3.5" />{localizeCopy('店铺设置', 'Impostazioni vetrina')}</button>
              <button id="merchant-tab-ai-employees" type="button" onClick={() => setActiveTab('ai_employees')} className={navItemClass(activeTab === 'ai_employees')}><Bot className="h-3.5 w-3.5" />{localizeCopy('智能员工', 'Team AI')}</button>
            </div>
          </section>
          <section>
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('应用记录', 'App e attività')}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <button id="merchant-tab-app-store" type="button" onClick={() => setActiveTab('app_store')} className={navItemClass(activeTab === 'app_store')}><Boxes className="h-3.5 w-3.5" />{localizeCopy('应用商店', 'App store')}</button>
              <button id="merchant-tab-recycle-bin" type="button" onClick={() => setActiveTab('recycle_bin')} className={navItemClass(activeTab === 'recycle_bin')}><Trash2 className="h-3.5 w-3.5" />{localizeCopy('回收站', 'Cestino')}</button>
              <button id="merchant-tab-ai-tools" type="button" onClick={() => setActiveTab('ai_tools')} className={navItemClass(activeTab === 'ai_tools')}><Sparkles className="h-3.5 w-3.5" />{localizeCopy('工具中心', 'Centro strumenti')}</button>
              <button id="merchant-tab-ai-chat-history" type="button" onClick={() => setActiveTab('ai_chat_history')} className={navItemClass(activeTab === 'ai_chat_history')}><MessageCircle className="h-3.5 w-3.5" />{localizeCopy('AI 聊天记录', 'Cronologia AI')}</button>
              <button id="merchant-tab-recent-activity" type="button" onClick={() => setActiveTab('recent_activity')} className={navItemClass(activeTab === 'recent_activity')}><Clock className="h-3.5 w-3.5" />{localizeCopy('最近动态', 'Attività recenti')}</button>
            </div>
          </section>
          <section>
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{localizeCopy('系统设置', 'Impostazioni')}</h2>
            <button type="button" id="merchant-tab-settings" onClick={openMerchantSettings} className={`${navItemClass(activeTab === 'settings')} mt-1`}><SlidersHorizontal className="h-3.5 w-3.5" />{localizeCopy('设置目录', 'Apri impostazioni')}</button>
          </section>
        </div>}
      </div>

      {/* 3. TAB CONTENT */}

      {industryPanelActive && IndustryWorkspace ? (
        <IndustryWorkspace
          embedded
          activeSection={industrySection}
          onSectionChange={navigateIndustrySection}
        />
      ) : (
      <>
      {settingsNotice && activeTab !== 'settings' && (
        <section role="status" className="merchant-home-card rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold text-sky-950">{settingsNotice.title}</h2><p className="mt-1 text-xs leading-5 text-sky-900">{settingsNotice.body}</p>{settingsNotice.distinction && <p className="mt-2 border-t border-sky-200 pt-2 text-[11px] leading-5 text-sky-800">{settingsNotice.distinction}</p>}</div>
            <button type="button" aria-label={localizeCopy('关闭提示', 'Chiudi avviso')} onClick={() => setSettingsNotice(null)} className="rounded-lg p-1 text-sky-700 hover:bg-sky-100"><X className="h-4 w-4" /></button>
          </div>
        </section>
      )}

      {activeTab === 'app_store' && (
        <Suspense fallback={<div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">应用商店正在加载…</div>}>
          <MerchantAppStore onOpenApp={setActiveStoreAppId} />
        </Suspense>
      )}
      {activeTab === 'recycle_bin' && (
        <Suspense fallback={<div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">{localizeCopy('正在加载…', 'Caricamento…')}</div>}>
          <MerchantRecycleBin onOpenProducts={() => { setActiveTab('products'); openProductCatalog(); }} />
        </Suspense>
      )}
      {activeTab === 'ai_chat_history' && (
        <Suspense fallback={<div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">{localizeCopy('正在加载…', 'Caricamento…')}</div>}>
          <MerchantAiChatHistory isIt={isIt} />
        </Suspense>
      )}
      {activeTab === 'recent_activity' && (
        <Suspense fallback={<div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">{localizeCopy('正在加载…', 'Caricamento…')}</div>}>
          <MerchantActivityFeed onOpenTarget={target => {
            setActiveTab(target.tab);
            if (target.tab === 'products') {
              if (target.search) setProductSearch(target.search);
              openProductCatalog();
            }
            if (target.tab === 'orders' && target.search) setOrderSearch(target.search);
          }} />
        </Suspense>
      )}
      {activeTab === 'gallery' && <MerchantGallery onBack={() => setActiveTab('dashboard')} />}
      {activeTab === 'ai_employees' && <MerchantAiEmployees isIt={isIt} />}
      {activeTab === 'ai_tools' && <MerchantAiTools />}
      {/* ======================================================== */}
      {/* SUB-TAB 1: 仪表盘 (OVERVIEW) */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div id="merchant-dashboard-home" className={`space-y-4 ${dashboardNavSection === 'home' ? 'merchant-dashboard-home' : ''}`}>
          {dashboardNavSection === 'home' && (
            <section className="merchant-dashboard-featured space-y-0">
              <section className="mx-auto mt-3 w-full max-w-[832px] space-y-6">
                <h2 aria-label="今天要处理什么？" className="text-center text-[30px] font-semibold leading-tight tracking-tight text-neutral-900">
                  <span aria-hidden="true">{Array.from('今天要处理什么？').map((character, index) => (
                    <span key={`${character}-${index}`} className="merchant-dashboard-prompt__character" style={{ animationDelay: `${index * 70}ms` }}>{character}</span>
                  ))}</span>
                </h2>
                <div className="merchant-dashboard-search relative">
                  <Search className="pointer-events-none absolute left-6 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                  <input
                    aria-label="搜索商品、款号或 SKU"
                    value={dashboardProductSearch}
                    onChange={event => setDashboardProductSearch(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && dashboardProductResults[0]) openDashboardProduct(dashboardProductResults[0]);
                      if (event.key === 'Escape') setDashboardProductSearch('');
                    }}
                    placeholder="搜索商品、款号或 SKU"
                    className="merchant-dashboard-search__input h-[72px] w-full rounded-full border border-neutral-200 bg-white pl-14 pr-[76px] text-base text-neutral-900 shadow-[0_8px_28px_rgba(20,30,50,0.06)] outline-none transition focus:border-neutral-400"
                  />
                  <button type="button" aria-label="搜索" onClick={() => dashboardProductResults[0] && openDashboardProduct(dashboardProductResults[0])} disabled={!dashboardProductResults.length} className="homepage-ai-send merchant-dashboard-search__submit absolute right-3.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-950 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {dashboardProductSearch.trim() && <div className="absolute left-0 right-0 top-20 z-40 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl">
                    {dashboardProductResults.length ? dashboardProductResults.map(product => <button key={product.id} type="button" onClick={() => openDashboardProduct(product)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50">
                        <Package className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-neutral-800">{product.styleNo} · {product.name_zh || product.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-neutral-500">{product.skus.map(sku => sku.sku).filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>) : <p className="px-4 py-3 text-xs text-neutral-500">没有匹配的商品或 SKU</p>}
                  </div>}
                </div>
              </section>

              <nav aria-label="常用功能" className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
                {[
                  { title: '新增商品', Icon: Plus, action: () => { setActiveTab('products'); void beginProductCreation(); } },
                  { title: '客户管理', Icon: UserRound, action: () => setActiveTab('customers') },
                  { title: '批发报价', Icon: FileText, action: () => { setActiveTab('orders'); openDraftQuoteForm(); } },
                  { title: '查库存', Icon: Boxes, action: () => setActiveTab('inventory') },
                  { title: '批发开单', Icon: ShoppingCart, action: () => setActiveTab('pos') },
                  { title: '订单处理', Icon: ClipboardCheck, action: () => setActiveTab('orders') }
                ].map(({ title, Icon, action }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={action}
                    className="merchant-dashboard-shortcut flex h-24 flex-col items-center justify-center gap-3 rounded-md border border-neutral-200 bg-white px-2 text-center text-sm font-medium text-neutral-700 transition duration-150 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500"
                  >
                    <span className="flex h-7 w-7 items-center justify-center">
                      <Icon className="h-6 w-6 shrink-0 text-neutral-500" aria-hidden="true" />
                    </span>
                    {title}
                  </button>
                ))}
              </nav>

              <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: '近30日成交', value: `€${(operationsIntelligence?.summary.gmv30d ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                  { label: '当前现货', value: `${totalStockCount}` },
                  { label: '待处理订单', value: `${actionableOrderCount}` }
                ].map(({ label, value }) => (
                  <div key={label} className="merchant-dashboard-metric flex h-[72px] min-w-0 flex-col justify-center rounded-full border border-neutral-200 bg-white px-6">
                    <dt className="truncate text-[13px] text-neutral-500">{label}</dt>
                    <dd className="mt-1 truncate text-lg font-semibold tabular-nums text-neutral-950 sm:text-[28px]">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
                <section aria-labelledby="merchant-dashboard-products-title" className="merchant-dashboard-panel flex min-h-[170px] min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 id="merchant-dashboard-products-title" className="text-lg font-semibold text-neutral-900">近期商品</h2>
                    <button type="button" onClick={openProductCatalog} className="text-xs font-medium text-neutral-600 transition hover:text-neutral-950">
                      查看全部 <ArrowRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {merchantProducts.length ? (
                    <div>
                      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(70px,0.8fr)_minmax(72px,0.7fr)_minmax(66px,0.7fr)] gap-2 rounded-md bg-neutral-50 px-2 py-2 text-[10px] font-medium text-neutral-500">
                        <span>商品</span><span>款号</span><span className="text-right">批发价</span><span className="text-right">可售数量</span>
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {merchantProducts.slice(0, 4).map(product => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => { setActiveTab('products'); setProductSearch(product.styleNo); }}
                            className="grid min-h-16 w-full grid-cols-[minmax(0,1.7fr)_minmax(70px,0.8fr)_minmax(72px,0.7fr)_minmax(66px,0.7fr)] items-center gap-2 px-2 py-2 text-left transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-neutral-400"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <img
                                src={merchantMediaUrl(product.media?.find(media => media.type === 'image')?.url || product.images[0] || '', DEFAULT_MERCHANT_BANNER)}
                                alt=""
                                loading="lazy"
                                onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_MERCHANT_BANNER; }}
                                className="h-12 w-12 shrink-0 rounded-md bg-neutral-100 object-cover"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-neutral-900">{product.name_zh || product.name}</span>
                                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                                  {[...new Set(product.skus.map(sku => sku.color).filter(Boolean))].join('/') || '—'}
                                  {' · '}
                                  {[...new Set(product.skus.map(sku => sku.size).filter(Boolean))].join('/') || '—'}
                                </span>
                              </span>
                            </span>
                            <span className="truncate text-xs text-neutral-600">{product.styleNo}</span>
                            <span className="truncate text-right text-xs tabular-nums text-neutral-800">€{product.wholesalePrice.toFixed(2)}</span>
                            <span className="truncate text-right text-xs tabular-nums text-neutral-800">{getProductAvailableStock(product)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-20 flex-1 items-center justify-center border-t border-neutral-100 text-xs text-neutral-500">
                      暂无商品
                    </div>
                  )}
                </section>

                <section className="merchant-dashboard-panel flex min-h-[170px] min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900">待办事项</h2>
                    <button type="button" onClick={() => setActiveTab(actionableOrderCount ? 'orders' : 'inventory')} className="text-xs text-neutral-500 hover:text-neutral-900">查看详情</button>
                  </div>
                  <div className="flex flex-1 flex-col space-y-2">
                    {actionableOrderCount > 0 && <>
                      {[
                        { label: '待确认', count: ordersAwaitingConfirmation },
                        { label: '待配货', count: ordersAwaitingPicking },
                        { label: '待发货', count: ordersAwaitingShipment }
                      ].filter(item => item.count > 0).map(item => (
                        <button key={item.label} type="button" onClick={() => setActiveTab('orders')} className="flex min-h-[72px] w-full items-center justify-between rounded-lg border border-neutral-100 px-4 text-left text-sm hover:bg-neutral-50">
                          <span className="text-neutral-700">{item.label}</span><span className="flex items-center gap-3"><strong className="tabular-nums text-neutral-900">{item.count}</strong><ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden="true" /></span>
                        </button>
                      ))}
                    </>}
                    {lowStockSkuCount > 0 && <button type="button" onClick={() => setActiveTab('inventory')} className="flex min-h-[72px] w-full items-center justify-between rounded-lg border border-neutral-100 px-4 text-left text-sm hover:bg-neutral-50">
                      <span className="text-neutral-700">成品低库存</span><span className="flex items-center gap-3"><strong className="tabular-nums text-neutral-900">{lowStockSkuCount}</strong><ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden="true" /></span>
                    </button>}
                    {lowStockFabricCount > 0 && <button type="button" onClick={() => setActiveTab('materials')} className="flex min-h-[72px] w-full items-center justify-between rounded-lg border border-neutral-100 px-4 text-left text-sm hover:bg-neutral-50">
                      <span className="text-neutral-700">面料预警</span><span className="flex items-center gap-3"><strong className="tabular-nums text-neutral-900">{lowStockFabricCount}</strong><ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden="true" /></span>
                    </button>}
                    {lowStockTrimCount > 0 && <button type="button" onClick={() => setActiveTab('materials')} className="flex min-h-[72px] w-full items-center justify-between rounded-lg border border-neutral-100 px-4 text-left text-sm hover:bg-neutral-50">
                      <span className="text-neutral-700">辅料预警</span><span className="flex items-center gap-3"><strong className="tabular-nums text-neutral-900">{lowStockTrimCount}</strong><ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden="true" /></span>
                    </button>}
                    {inventoryAlerts.slice(0, 3).map(alert => <p key={`${alert.type}-${alert.message}`} className="border-t border-neutral-100 pt-2 text-[11px] text-neutral-600">{alert.message}</p>)}
                    {!actionableOrderCount && !lowStockSkuCount && !lowStockFabricCount && !lowStockTrimCount && !inventoryAlerts.length && (
                      <p className="flex flex-1 items-center py-2 text-sm text-neutral-500">暂无待办</p>
                    )}
                  </div>
                </section>
              </div>
            </section>
          )}
          <section id="merchant-analytics" className="space-y-2 scroll-mt-6">
            {!!operationsIntelligence?.replenishment.length && <details className="group rounded-xl border border-neutral-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800">
                补货建议 <span className="text-neutral-500">{operationsIntelligence.replenishment.length}</span>
                <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-neutral-100 px-4 py-3">
                <p className="mb-2 text-[10px] text-neutral-500">按近 30 日销量估算，不自动下单</p>
                <div className="divide-y divide-neutral-100">
                  {operationsIntelligence.replenishment.slice(0, 4).map(item => (
                    <div key={item.variantId} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span><strong>{item.sku}</strong><span className="ml-2 text-neutral-500">可售 {item.availableQuantity} 件</span></span>
                      <span className="font-semibold text-neutral-800">建议补 {item.suggestedQuantity} 件</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setActiveTab('inventory')} className="mt-2 text-xs font-semibold text-neutral-700 underline">查看库存</button>
              </div>
            </details>}
            {operationsIntelligence && <details className="group rounded-xl border border-neutral-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800">
                周转提醒
                <span className={`font-semibold ${(operationsIntelligence.summary.gmvTrend || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {(operationsIntelligence.summary.gmvTrend || 0) >= 0 ? '+' : ''}{operationsIntelligence.summary.gmvTrend || 0}%
                </span>
                <span className="text-[10px] font-normal text-neutral-500">近 7 日对比前 7 日</span>
                <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
              </summary>
              {!!(operationsIntelligence.slowMovers ?? []).length && <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-4 py-1">
                {(operationsIntelligence.slowMovers ?? []).slice(0, 4).map(item => (
                  <div key={item.variantId} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span><strong>{item.sku}</strong><span className="ml-2 text-neutral-500">可售 {item.availableQuantity} 件</span></span>
                    <span className="font-semibold text-neutral-700">{item.sold30d === 0 ? '30 日无销量' : `${item.daysCover} 天库存覆盖`}</span>
                  </div>
                ))}
              </div>}
            </details>}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: 商品管理 (PRODUCTS & 3-TIER VISIBILITY) */}
      {/* ======================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <header className="space-y-4 border-b border-neutral-200 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{productWorkspaceSection === 'catalog' ? '商品' : '店铺分类'}</h1>
              </div>
              {productWorkspaceSection === 'catalog' && <div className="flex flex-wrap gap-2">
                <details className="group relative">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                    <FileSpreadsheet className="h-3.5 w-3.5" />导入 / 导出
                  </summary>
                  <div className="absolute right-0 z-30 mt-1 flex min-w-40 flex-col rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                    <button type="button" onClick={downloadProductImportTemplate} className="rounded-md px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">下载模板</button>
                    <label className={`cursor-pointer rounded-md px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 ${productImportBusy ? 'pointer-events-none opacity-50' : ''}`}>
                      {productImportBusy ? '导入中…' : '导入 CSV'}
                      <input type="file" accept=".csv,text/csv" className="sr-only" disabled={productImportBusy} onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void importMerchantProducts(file);
                        event.currentTarget.value = '';
                      }} />
                    </label>
                    <button type="button" onClick={() => exportMerchantProducts(selectedProductIds.length ? merchantProducts.filter(product => selectedProductIds.includes(product.id)) : visibleMerchantProducts)} disabled={!merchantProducts.length} className="rounded-md px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
                      导出 CSV{selectedProductIds.length ? ` (${selectedProductIds.length})` : ''}
                    </button>
                  </div>
                </details>
                <button type="button" id="merchant-add-product-btn" onClick={() => void beginProductCreation()} disabled={productDraftLoading} className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60">
                  <Plus className="h-4 w-4" />新增商品
                </button>
              </div>}
              {productWorkspaceSection === 'categories' && <div className="flex gap-2">
                <button type="button" onClick={openProductCatalog} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">商品列表</button>
                <button type="button" onClick={() => { setEditingStoreCategoryId(null); setNewCategoryName(''); setCategoryFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700">
                  <Plus className="h-3.5 w-3.5" />新增分类
                </button>
              </div>}
            </div>
          </header>

          {productWorkspaceSection === 'catalog' && <details className="group rounded-xl border border-neutral-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800 marker:hidden">
              销量分析
              <span className="text-[10px] font-normal text-neutral-500">近 30 日 · {[...productSales30d.values()].reduce((sum, sales) => sum + sales.quantity, 0)} 件</span>
              <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-neutral-200 px-4 py-3">
              {productSalesRank.length ? (
                <ol className="space-y-3">
                  {productSalesRank.slice(0, 5).map(({ product, sales }, index) => {
                    const maxSales = productSalesRank[0]?.sales.quantity || 1;
                    return <li key={product.id} className="flex items-center gap-3">
                      <span className="w-5 text-center text-[10px] font-semibold text-neutral-400">0{index + 1}</span>
                      <img src={merchantMediaUrl(product.media?.find(media => media.type === 'image')?.url || product.images[0] || '', DEFAULT_MERCHANT_BANNER)} alt="" className="h-11 w-9 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => { setProductSearch(product.styleNo); setProductQuickView('all'); }} className="truncate text-left text-[10px] font-semibold text-neutral-800 hover:underline">{product.styleNo} · {product.name_zh || product.name}</button><strong className="shrink-0 text-[10px] tabular-nums text-neutral-700">{sales.quantity} 件</strong></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-neutral-800" style={{ width: `${Math.max(5, sales.quantity / maxSales * 100)}%` }} /></div>
                        <p className="mt-1 text-[9px] text-neutral-500">批发额 €{sales.amount.toFixed(2)} · 可售 {getProductAvailableStock(product)} 件</p>
                      </div>
                    </li>;
                  })}
                </ol>
              ) : <p className="py-3 text-center text-xs text-neutral-500">暂无销量</p>}
            </div>
          </details>
          }

          {productWorkspaceSection === 'categories' && <section id="merchant-product-categories" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="搜索分类" className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-neutral-500" />
              </label>
              <p className="text-[10px] text-neutral-500">用于店铺展示；商品品类在商品资料中设置</p>
            </div>
            {categoryFormOpen && <form className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-white p-3" onSubmit={async event => {
                event.preventDefault();
                if (!newCategoryName.trim() || categoryBusy) return;
                setCategoryBusy(true);
                try {
                  if (editingStoreCategoryId) {
                    const result = await apiPut<{ success: true; category: StoreCategory }>(`/api/merchant/store-categories/${encodeURIComponent(editingStoreCategoryId)}`, { name: newCategoryName.trim() });
                    setStoreCategories(previous => previous.map(category => category.id === result.category.id ? result.category : category).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
                    addNotification('success', '分类已更新', '商品归属已保留');
                  } else {
                    const result = await apiPost<{ success: true; category: StoreCategory }>('/api/merchant/store-categories', { name: newCategoryName.trim() });
                    setStoreCategories(previous => [...previous, result.category].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
                    addNotification('success', '分类已新增', '已同步到店铺');
                  }
                  setNewCategoryName('');
                  setEditingStoreCategoryId(null);
                  setCategoryFormOpen(false);
                } catch (error) {
                  addNotification('warning', editingStoreCategoryId ? '分类更新失败' : '分类新增失败', error instanceof Error ? error.message : '请检查分类名称后重试');
                } finally {
                  setCategoryBusy(false);
                }
              }}>
                <input autoFocus value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} maxLength={40} aria-label="分类名称" placeholder="分类名称" className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs sm:max-w-sm" />
                <button type="submit" disabled={categoryBusy || !newCategoryName.trim()} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{categoryBusy ? '保存中…' : '保存'}</button>
                <button type="button" onClick={() => { setCategoryFormOpen(false); setEditingStoreCategoryId(null); setNewCategoryName(''); }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600">取消</button>
              </form>
            }
            <div className="space-y-2">
              {storeCategories.length === 0 ? <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">暂无分类</div>
                : visibleStoreCategories.length === 0
                  ? <div className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">没有匹配分类</div>
                  : visibleStoreCategories.map(category => {
                const categoryProducts = merchantProducts.filter(product => product.storeCategorySlug === category.slug);
                const isManagingProducts = categoryMembershipId === category.id;
                return <article key={category.id} className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-neutral-900">{category.name}</h2><span className="text-[10px] text-neutral-500">{categoryProducts.length} 款</span></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => {
                        setCategoryMembershipId(isManagingProducts ? '' : category.id);
                        setCategoryMembershipProductIds(categoryProducts.map(product => product.id));
                        setCategoryMembershipSearch('');
                      }} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">{isManagingProducts ? '收起' : '管理商品'}</button>
                      <button type="button" onClick={() => { setEditingStoreCategoryId(category.id); setNewCategoryName(category.name); setCategoryFormOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"><Pencil className="h-3 w-3" />编辑</button>
                      <button type="button" onClick={async () => {
                        if (!window.confirm(`删除分类「${category.name}」？分类中有商品时无法删除。`)) return;
                        try {
                          await apiDelete(`/api/merchant/store-categories/${encodeURIComponent(category.id)}`);
                          setStoreCategories(previous => previous.filter(item => item.id !== category.id));
                          if (categoryMembershipId === category.id) setCategoryMembershipId('');
                          addNotification('success', '分类已删除', `已删除“${category.name}”`);
                        } catch (error) {
                          addNotification('warning', '无法删除分类', error instanceof Error ? error.message : '请先调整使用该分类的商品');
                        }
                      }} className="rounded-lg p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-700" title={`删除 ${category.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {isManagingProducts && <div className="mt-3 border-t border-neutral-100 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-neutral-500">仅更新勾选商品，每次最多 500 款</span>
                      <button type="button" disabled={categoryMembershipBusy || !categoryMembershipProductIds.some(id => merchantProducts.some(product => product.id === id && product.storeCategorySlug !== category.slug))} onClick={() => void saveCategoryMembership()} className="rounded-lg bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">{categoryMembershipBusy ? '保存中…' : `归入所选 (${categoryMembershipProductIds.length})`}</button>
                    </div>
                    <label className="relative mt-2 block max-w-sm"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" /><input value={categoryMembershipSearch} onChange={event => setCategoryMembershipSearch(event.target.value)} placeholder="筛选款号、名称或 SKU" className="w-full rounded-lg border border-neutral-200 py-1.5 pl-8 pr-3 text-[10px] outline-none focus:border-neutral-400" /></label>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-neutral-100 bg-neutral-50/60 p-2">
                      {categoryMembershipVisibleProducts.map(product => <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[10px] hover:bg-white">
                        <input type="checkbox" checked={categoryMembershipProductIds.includes(product.id)} onChange={event => setCategoryMembershipProductIds(previous => event.target.checked ? [...new Set([...previous, product.id])] : previous.filter(id => id !== product.id))} className="accent-emerald-700" />
                        <span className="min-w-0 flex-1 truncate text-neutral-700">{product.styleNo} · {product.name_zh || product.name}</span>
                        <span className="shrink-0 text-neutral-400">{storeCategories.find(item => item.slug === product.storeCategorySlug)?.name || '未归类'}</span>
                      </label>)}
                      {!categoryMembershipVisibleProducts.length && <p className="px-2 py-3 text-center text-[10px] text-neutral-400">没有匹配的商品</p>}
                    </div>
                  </div>}
                </article>;
              })}
            </div>
          </section>}

          {productWorkspaceSection === 'catalog' && <>
          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5" aria-label="商品搜索和筛选">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-52 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="搜索款号、名称、SKU" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-neutral-500 focus:bg-white" />
              </label>
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5" aria-label="商品视图">
                <button type="button" aria-label="表格视图" aria-pressed={productViewMode === 'table'} onClick={() => setProductViewMode('table')} className={`rounded-md p-2 transition ${productViewMode === 'table' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
                  <List className="h-4 w-4" />
                </button>
                <button type="button" aria-label="图片视图" title="图片视图" aria-pressed={productViewMode === 'pos'} onClick={() => setProductViewMode('pos')} className={`rounded-md p-2 transition ${productViewMode === 'pos' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
                  <Grid2X2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <details className="group rounded-lg border border-neutral-200">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-semibold text-neutral-700 marker:hidden">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                筛选
                <span className="ml-auto text-[10px] font-normal text-neutral-500">
                  {[
                    productLifecycleFilter !== 'all',
                    productZoneFilter !== 'all',
                    productCategoryFilter !== 'all',
                    productSort !== 'updated',
                    productQuickView !== 'all'
                  ].filter(Boolean).length || '状态、展示区、分类、排序'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-neutral-500 transition group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-1 gap-2 border-t border-neutral-100 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <select aria-label="按销售状态筛选" value={productLifecycleFilter} onChange={event => setProductLifecycleFilter(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部销售状态</option><option value="published">已上架</option><option value="draft">草稿</option><option value="pending_review">待审核</option><option value="rejected">未通过</option><option value="archived">已归档</option>
              </select>
              <select aria-label="按展示区筛选" value={productZoneFilter} onChange={event => setProductZoneFilter(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部展示区</option><option value="new">现货区</option><option value="clearance">折扣市场</option><option value="private">授权区</option>
              </select>
              <select aria-label="按商品品类筛选" value={productCategoryFilter} onChange={event => setProductCategoryFilter(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">全部品类</option>{[...new Set(merchantProducts.map(product => product.category))].map(category => <option key={category} value={category}>{getProductCategoryLabel(category, isIt)}</option>)}
              </select>
              <select aria-label="商品排序方式" value={productSort} onChange={event => setProductSort(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="updated">最近更新</option><option value="name">名称 A–Z</option><option value="price-asc">批发价从低到高</option><option value="price-desc">批发价从高到低</option><option value="stock-asc">库存从低到高</option>
              </select>
              <select aria-label="其他商品条件" value={['all', 'published', 'draft', 'under-five'].includes(productQuickView) ? 'all' : productQuickView} onChange={event => setProductQuickView(event.target.value as typeof productQuickView)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                <option value="all">其他条件</option><option value="archived">已归档</option><option value="no-image">缺少主图</option><option value="low-stock">库存低于 20</option><option value="clearance">折扣市场</option><option value="private">授权区</option>
              </select>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4">
                <select aria-label="已保存的商品视图" value={selectedProductView} onChange={event => applySavedProductView(event.target.value)} className="max-w-48 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs">
                  <option value="">已保存视图{savedProductViews.length ? ` (${savedProductViews.length})` : ''}</option>
                  {savedProductViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
                </select>
                <button type="button" onClick={saveCurrentProductView} className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">保存视图</button>
                {selectedProductView && <button type="button" onClick={deleteSavedProductView} className="rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">删除视图</button>}
                {(productSearch || productLifecycleFilter !== 'all' || productZoneFilter !== 'all' || productCategoryFilter !== 'all' || productQuickView !== 'all') && <button type="button" onClick={() => { setProductSearch(''); setProductLifecycleFilter('all'); setProductZoneFilter('all'); setProductCategoryFilter('all'); setProductQuickView('all'); setSelectedProductView(''); }} className="text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-950">清除筛选</button>}
              </div>
              </div>
            </details>
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
              {([
                ['all', '全部'],
                ['published', '在售'],
                ['draft', '草稿'],
                ['under-five', '低库存']
              ] as const).map(([view, label]) => {
                const count = view === 'all' ? merchantProducts.length
                  : view === 'published' ? merchantProducts.filter(product => product.lifecycleStatus === 'published').length
                    : view === 'draft' ? merchantProducts.filter(product => product.lifecycleStatus === 'draft').length
                      : productUnderFiveCount;
                return <button key={view} type="button" aria-pressed={productQuickView === view} onClick={() => { setProductQuickView(view); if (['all', 'published', 'draft'].includes(view)) setProductLifecycleFilter('all'); setSelectedProductView(''); }} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${productQuickView === view ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'}`}>{label}<span className={`ml-1.5 ${productQuickView === view ? 'text-neutral-300' : 'text-neutral-400'}`}>{count}</span></button>;
              })}
            </div>
          </section>

          {/* Product Table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            {selectedProductIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-emerald-50/70 px-4 py-3 text-xs">
                <span className="font-semibold text-neutral-800">已选择 {selectedProductIds.length} 款商品</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={batchProductBusy || productBatchPriceBusy} onClick={() => {
                    setProductBatchPrices({ wholesalePrice: '', wholesalePrice100: '' });
                    setProductBatchPriceOpen(true);
                  }} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">批量改价格</button>
                  <select aria-label="批量调整商品展示区" disabled={batchProductBusy} defaultValue="" onChange={event => {
                    const zone = event.target.value;
                    if (zone === 'new' || zone === 'clearance' || zone === 'private') void handleBatchProductZone(zone);
                    event.currentTarget.value = '';
                  }} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 disabled:opacity-50">
                    <option value="" disabled>批量调整展示区…</option><option value="new">移动到现货区</option><option value="clearance">移动到折扣市场</option><option value="private">移动到授权区</option>
                  </select>
                  <button type="button" disabled={batchProductBusy} onClick={() => void handleBatchProductLifecycle('published')} className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">批量上架</button>
                  <button type="button" disabled={batchProductBusy} onClick={() => void handleBatchProductLifecycle('draft')} className="rounded-lg bg-neutral-900 px-3 py-1.5 font-semibold text-white disabled:opacity-50">批量下架</button>
                  <button type="button" disabled={batchProductBusy} onClick={() => void archiveSelectedProducts()} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">批量归档</button>
                  <button type="button" onClick={() => setSelectedProductIds([])} className="rounded-lg px-2 py-1.5 font-semibold text-neutral-500 hover:bg-white">清除选择</button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 border-b border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
              {productViewMode === 'pos' && <button type="button" onClick={() => {
                const visibleIds = visibleMerchantProducts.map(product => product.id);
                const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedProductIds.includes(id));
                setSelectedProductIds(previous => allVisibleSelected
                  ? previous.filter(id => !visibleIds.includes(id))
                  : [...new Set([...previous, ...visibleIds])]);
              }} className="rounded-md px-2 py-1 font-semibold text-neutral-700 hover:bg-neutral-100">
                {visibleMerchantProducts.length > 0 && visibleMerchantProducts.every(product => selectedProductIds.includes(product.id)) ? '取消全选当前结果' : '全选当前结果'}
              </button>}
            </div>
            {productViewMode === 'pos' ? (
              <div className="divide-y divide-neutral-200">
                {visibleMerchantProducts.map(product => {
                  const totalQty = getProductStock(product);
                  return (
                    <article id={`merchant-product-${product.id}`} key={product.id} className={`flex flex-col gap-4 p-4 transition-colors hover:bg-neutral-50/70 sm:flex-row sm:items-center sm:gap-5 ${assistantFocusedProductId === product.id ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : ''}`}>
                      <img src={merchantMediaUrl(product.media?.find(media => media.type === 'image')?.url || product.images[0] || '', DEFAULT_MERCHANT_BANNER)} alt={product.name} className="h-56 w-full shrink-0 rounded-lg border border-neutral-200 bg-neutral-100 object-cover sm:h-52 sm:w-40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold text-neutral-950">{product.styleNo}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.lifecycleStatus === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                            {product.lifecycleStatus === 'published' ? '已上架' : product.lifecycleStatus === 'archived' ? '已归档' : '已下架'}
                          </span>
                          {product.visibility === 'private' && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">授权区</span>}
                          {product.status === 'clearance' && product.visibility !== 'private' && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">特价</span>}
                        </div>
                        <h3 className="mt-1 truncate text-sm font-semibold text-neutral-800">{product.name}</h3>
                        <p className="mt-1 text-xs text-neutral-500">{product.category} · {product.subCategory} · {product.origin}</p>
                        <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
                          <div><p className="text-[10px] text-neutral-500">批发价</p><p className="text-xl font-bold text-neutral-950">€{product.wholesalePrice.toFixed(2)}</p></div>
                          <div><p className="text-[10px] text-neutral-500">100件起批价</p><p className="text-sm font-semibold text-neutral-700">{product.wholesalePrice100 == null ? '未设置' : `€${product.wholesalePrice100.toFixed(2)}`}</p></div>
                          <div><p className="text-[10px] text-neutral-500">库存 / SKU</p><p className={`text-sm font-bold ${getProductAvailableStock(product) < 20 ? 'text-rose-600' : 'text-emerald-700'}`}>{getProductAvailableStock(product)} 可售 <span className="font-normal text-neutral-400">· 共 {product.skus?.length || 0} 组</span></p>{standardInventoryLoaded && <p className="mt-0.5 text-[9px] font-normal text-neutral-400">{totalQty} 在手 · {Math.max(0, totalQty - getProductAvailableStock(product))} 已预留</p>}</div>
                          <div><p className="text-[10px] text-neutral-500">起订 / 箱规</p><p className="text-sm font-semibold text-neutral-700">{product.moq} / {product.packSize} 件</p></div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-52 sm:justify-end">
                        <select value={getProductZone(product)} aria-label={`${product.styleNo} 商品展示区`} onChange={async event => {
                          const zone = event.target.value as 'new' | 'clearance' | 'private';
                          try {
                            await updateMerchantProduct(product.id, getProductZoneUpdates(zone));
                            addNotification('success', '商品展示区已更新', `款式 ${product.styleNo} 已调整为：${zone === 'private' ? '授权区' : zone === 'clearance' ? '折扣市场' : '现货区'}`);
                          } catch (error) {
                            addNotification('warning', '商品展示区更新失败', error instanceof Error ? error.message : '请稍后重试');
                          }
                        }} className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs sm:w-auto">
                          <option value="new">现货区</option><option value="clearance">折扣市场</option><option value="private">授权区</option>
                        </select>
                        <button type="button" onClick={() => setSelectedProductIds(previous => previous.includes(product.id) ? previous.filter(id => id !== product.id) : [...previous, product.id])} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selectedProductIds.includes(product.id) ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}>{selectedProductIds.includes(product.id) ? '已选择' : '选择'}</button>
                        <button type="button" onClick={() => setEditingProduct(product)} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"><Pencil className="mr-1 inline h-3.5 w-3.5" />编辑</button>
                        <button type="button" onClick={() => setEditingProductImages(product)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"><ImagePlus className="mr-1 inline h-3.5 w-3.5" />图片</button>
                        <button type="button" onClick={() => { setSkuTargetStyleNo(product.styleNo); setActiveTab('sku_matrix'); }} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">SKU</button>
                        <button type="button" onClick={() => { if (!window.confirm(`确定停用商品“${product.name}”吗？历史订单和数据会保留。`)) return; void deleteMerchantProduct(product.id).catch(() => undefined); }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Trash2 className="mr-1 inline h-3.5 w-3.5" />停用</button>
                      </div>
                    </article>
                  );
                })}
                {visibleMerchantProducts.length === 0 && (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <p className="text-sm text-neutral-500">{merchantProducts.length ? '暂无匹配商品' : '暂无商品'}</p>
                    {!merchantProducts.length && <button type="button" onClick={() => void beginProductCreation()} disabled={productDraftLoading} className="rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">新增商品</button>}
                  </div>
                )}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase tracking-wider border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">
                      <input type="checkbox" aria-label="全选当前筛选结果" checked={visibleMerchantProducts.length > 0 && visibleMerchantProducts.every(product => selectedProductIds.includes(product.id))} onChange={event => {
                        const visibleIds = visibleMerchantProducts.map(product => product.id);
                        setSelectedProductIds(previous => event.target.checked ? [...new Set([...previous, ...visibleIds])] : previous.filter(id => !visibleIds.includes(id)));
                      }} />
                    </th>
                    <th className="py-3 px-4">款号 / 款式名称</th>
                    <th className="py-3 px-4">类目</th>
                    <th className="py-3 px-4">基础批发价</th>
                    <th className="py-3 px-4">100件起批价</th>
                    <th className="py-3 px-4">起订量 / 箱规</th>
                    <th className="py-3 px-4">商品展示区</th>
                    <th className="py-3 px-4">总库存</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {visibleMerchantProducts.map((p) => {
                    const totalQty = getProductStock(p);
                    return (
                      <tr id={`merchant-product-${p.id}`} key={p.id} className={`hover:bg-neutral-50/60 transition-colors ${assistantFocusedProductId === p.id ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : ''}`}>
                        <td className="py-3 px-4 align-top">
                          <input type="checkbox" aria-label={`选择 ${p.styleNo}`} checked={selectedProductIds.includes(p.id)} onChange={event => setSelectedProductIds(previous => event.target.checked ? [...previous, p.id] : previous.filter(id => id !== p.id))} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={merchantMediaUrl(p.media?.find(media => media.type === 'image')?.url || p.images[0] || '', DEFAULT_MERCHANT_BANNER)}
                              alt={p.name}
                              className="h-32 w-24 rounded object-cover border border-neutral-200 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                                {p.styleNo}
                                {p.visibility === 'private' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    🔒 授权区
                                  </span>
                                )}
                              </div>
                              <div className="text-neutral-600 line-clamp-1 max-w-xs">{p.name}</div>
                              <div className="text-[11px] text-neutral-400">{p.origin}</div>
                              <div className={`text-[11px] font-semibold ${p.lifecycleStatus === 'published' ? 'text-emerald-700' : 'text-neutral-500'}`}>
                                {p.lifecycleStatus === 'published' ? '已上架' : p.lifecycleStatus === 'archived' ? '已归档' : '已下架'}
                              </div>
                              {p.status === 'clearance' && p.visibility !== 'private' && !p.isExclusiveProtected && (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  🏷️ 折扣市场 · 已同步两端店铺
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-medium text-neutral-700">{p.category}</span>
                          <div className="text-neutral-400 text-[11px]">{p.subCategory}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-neutral-900">
                          €{p.wholesalePrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-neutral-500">
                          {p.wholesalePrice100 == null ? '未设置' : `€${p.wholesalePrice100.toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4">
                          <div>MOQ: {p.moq} 件</div>
                          <div className="text-neutral-400 text-[11px]">{p.packSize} 件/箱</div>
                        </td>
                        <td className="py-3 px-4">
                          {/* 3-Tier Visibility Selector */}
                          <select
                            id={`visibility-select-${p.id}`}
                            value={getProductZone(p)}
                            onChange={async (e) => {
                              const zone = e.target.value as 'new' | 'clearance' | 'private';
                              try {
                                await updateMerchantProduct(p.id, getProductZoneUpdates(zone));
                                addNotification('success', '商品展示区已更新', `款式 ${p.styleNo} 已调整为：${zone === 'private' ? '授权区' : zone === 'clearance' ? '折扣市场' : '现货区'}`);
                              } catch (error) {
                                addNotification('warning', '商品展示区更新失败', error instanceof Error ? error.message : '请稍后重试');
                              }
                            }}
                            className="text-[11px] font-medium bg-white border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                          >
                            <option value="new">✨ 现货区</option>
                            <option value="clearance">🏷️ 折扣市场</option>
                            <option value="private">🔒 授权区</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-bold ${getProductAvailableStock(p) < 20 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {getProductAvailableStock(p)} 件可售
                          </span>
                          <div className="text-[11px] text-neutral-400">{totalQty} 件在手 · {p.skus?.length || 0} 组 SKU</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1.5 mb-2">
                            <ShareButton
                              compact
                              title={`${p.name} · ${currentMerchant.name}`}
                              text={`查看 ${currentMerchant.name} 的商品 ${p.name}（款号 ${p.styleNo}）`}
                              path={`${window.location.origin}${window.location.pathname}#/product/${p.id}`}
                              source={`product-${p.id}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded transition-colors cursor-pointer mr-1.5"
                          >
                            <Pencil className="mr-1 inline h-3.5 w-3.5" />编辑商品
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProductImages(p)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition-colors cursor-pointer mr-1.5"
                          >
                            <ImagePlus className="mr-1 inline h-3.5 w-3.5" />管理图片
                          </button>
                          <button
                            onClick={() => {
                              setSkuTargetStyleNo(p.styleNo);
                              setActiveTab('sku_matrix');
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded transition-colors cursor-pointer mr-1.5"
                          >
                            SKU 矩阵
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`确定停用商品“${p.name}”吗？历史订单和数据会保留。`)) return;
                              void deleteMerchantProduct(p.id).catch(() => undefined);
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" />停用
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleMerchantProducts.length === 0 && <tr><td colSpan={9} className="p-8 text-center">
                    {merchantProducts.length ? <p className="text-sm text-neutral-500">暂无匹配商品</p> : <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-neutral-500">暂无商品</p>
                      <button type="button" onClick={() => void beginProductCreation()} disabled={productDraftLoading} className="rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">新增商品</button>
                    </div>}
                  </td></tr>}
                </tbody>
              </table>
            </div>
            )}
          </div>
          {productBatchPriceOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm">
              <form onSubmit={event => void saveProductBatchPrices(event)} className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-base font-bold text-neutral-950">批量调整价格</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>设置基础批发价</span><span>设置 100 件价</span><span>逐款保存</span><span>失败逐项提示</span></div></div>
                  <button type="button" disabled={productBatchPriceBusy} onClick={() => setProductBatchPriceOpen(false)} aria-label="关闭批量价格窗口" className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-neutral-700">批发价 (€)<input type="number" required min="0.01" step="0.01" value={productBatchPrices.wholesalePrice} onChange={event => setProductBatchPrices(current => ({ ...current, wholesalePrice: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal outline-none focus:border-neutral-500" /></label>
                  <label className="text-xs font-semibold text-neutral-700">量大批发价（100件起，€ / 件）<input type="number" required min="0.01" max={productBatchPrices.wholesalePrice || undefined} step="0.01" value={productBatchPrices.wholesalePrice100} onChange={event => setProductBatchPrices(current => ({ ...current, wholesalePrice100: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal outline-none focus:border-neutral-500" /></label>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-neutral-100 pt-4">
                  <button type="button" disabled={productBatchPriceBusy} onClick={() => setProductBatchPriceOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">取消</button>
                  <button type="submit" disabled={productBatchPriceBusy || !selectedProductIds.length} className="rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">{productBatchPriceBusy ? '正在更新…' : '确认批量保存'}</button>
                </div>
              </form>
            </div>
          )}
          </>}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: SKU 变体与笛卡尔积批量生成器 */}
      {/* ======================================================== */}
      {activeTab === 'sku_matrix' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader title="规格管理" icon={<Barcode className="h-3.5 w-3.5" />} />
          <div className="merchant-home-card space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">款式</label>
                <select
                  id="sku-matrix-style-selector"
                  value={skuTargetStyleNo}
                  onChange={(e) => {
                    const styleNo = e.target.value;
                    const product = merchantProducts.find(item => item.styleNo === styleNo);
                    setSkuTargetStyleNo(styleNo);
                    setGeneratedSkusList([]);
                    if (product) {
                      setSkuBasePrice(product.wholesalePrice);
                      setSkuCostPrice(product.costPrice ?? '');
                    }
                  }}
                  className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 focus:bg-white"
                >
                  <option value="">选择款式</option>
                  {merchantProducts.map(p => (
                    <option key={p.id} value={p.styleNo}>
                      {p.styleNo} - {p.name.slice(0, 20)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">批发价 (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={skuBasePrice}
                  onChange={(e) => setSkuBasePrice(Number(e.target.value))}
                  className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">成本价（仅内部，€）</label>
                <input
                  type="number"
                  step="0.01"
                  value={skuCostPrice}
                  onChange={(e) => setSkuCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 focus:bg-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  id="generate-skus-btn"
                  onClick={handleGenerateSKUs}
                  disabled={!skuTargetProduct}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 生成 SKU
                </button>
              </div>
            </div>

            {/* Colors and Sizes Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-xs font-bold text-neutral-800 block mb-2">颜色</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedColors.map((color, idx) => (
                    <label key={color.code} className="flex items-center gap-2 p-1.5 bg-white rounded border border-neutral-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={color.checked}
                        onChange={(e) => {
                          const updated = [...selectedColors];
                          updated[idx].checked = e.target.checked;
                          setSelectedColors(updated);
                        }}
                        className="rounded text-neutral-900"
                      />
                      <span className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: color.colorCode }}></span>
                      <span className="text-neutral-800 font-medium">{color.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-xs font-bold text-neutral-800 block mb-2">尺码</span>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {selectedSizes.map((size, idx) => (
                    <label key={size.size} className="flex items-center gap-2 p-2 bg-white rounded border border-neutral-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={size.checked}
                        onChange={(e) => {
                          const updated = [...selectedSizes];
                          updated[idx].checked = e.target.checked;
                          setSelectedSizes(updated);
                        }}
                        className="rounded text-neutral-900"
                      />
                      <span className="font-bold text-neutral-900">{size.size}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generated SKU Preview Table */}
          {generatedSkusList.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900">待写入 SKU（{generatedSkusList.length}）</h3>
                <button
                  id="save-skus-to-product-btn"
                  onClick={handleSaveSkusToProduct}
                  disabled={!skuTargetProduct}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> 写入款式
                </button>
              </div>

              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">SKU 编码</th>
                      <th className="py-2.5 px-3">条形码</th>
                      <th className="py-2.5 px-3">颜色</th>
                      <th className="py-2.5 px-3">尺码</th>
                      <th className="py-2.5 px-3">成本价（内部）</th>
                      <th className="py-2.5 px-3">批发价</th>
                      <th className="py-2.5 px-3">建议零售价</th>
                      <th className="py-2.5 px-3">在库（件）</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {generatedSkusList.map((s, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50">
                        <td className="py-2 px-3 font-mono font-bold text-neutral-900">{s.sku}</td>
                        <td className="py-2 px-3 font-mono text-neutral-500">{s.barcode || '—'}</td>
                        <td className="py-2 px-3 flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border border-neutral-300" style={{ backgroundColor: s.colorCode }}></span>
                          {s.color}
                        </td>
                        <td className="py-2 px-3 font-bold">{s.size}</td>
                        <td className="py-2 px-3 text-neutral-500">{s.cost === undefined ? '—' : `€${s.cost.toFixed(2)}`}</td>
                        <td className="py-2 px-3 font-semibold text-neutral-900">€{s.wholesalePrice?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-neutral-500">€{s.rrp?.toFixed(2)}</td>
                        <td className="py-2 px-3">{s.stockCentral}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Existing SKUs for currently selected style */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">现有 SKU · {skuTargetStyleNo || '—'}</h3>
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">颜色</th>
                    <th className="py-2.5 px-3">尺码</th>
                    <th className="py-2.5 px-3">在库（件）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {skuTargetProduct?.skus.map((s, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{s.sku}</td>
                      <td className="py-2.5 px-3 flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-neutral-300" style={{ backgroundColor: s.colorCode }}></span>
                        {s.color}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{s.size}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.stockCentral}</td>
                    </tr>
                  ))}
                  {!skuTargetProduct?.skus.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-neutral-400">暂无 SKU</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: optional factory tools for merchants with own production */}
      {/* ======================================================== */}
      {activeTab === 'procurement' && currentMerchantId && (
        <Suspense fallback={<div className="rounded-2xl border border-neutral-200 bg-white p-6 text-xs text-neutral-500">正在加载采购工作台…</div>}>
          <MerchantProcurementWorkspace products={merchantProducts} isIt={isIt} />
        </Suspense>
      )}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader
            title="物料"
            icon={<Layers className="h-3.5 w-3.5" />}
            action={<button type="button" onClick={() => void refreshMaterials()} disabled={materialBusy} className="inline-flex items-center gap-2 rounded-xl border border-white/90 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${materialBusy ? 'animate-spin' : ''}`} />刷新</button>}
          />
          <div className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <details open={Boolean(editingMaterialId)} className="group mt-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800 marker:hidden">
                {editingMaterialId ? '编辑物料' : '新增物料'}
                <span className="text-[10px] font-normal text-neutral-500">BOM 关联不可删除 · 停用后不可备料</span>
                <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-neutral-500 transition group-open:rotate-180" />
              </summary>
              <form className="border-t border-neutral-200 p-4" onSubmit={event => void saveMaterial(event)}>
              {editingMaterialId && <div className="mb-3 flex justify-end"><button type="button" onClick={() => openMaterialEditor()} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">取消编辑</button></div>}
              <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <label className="font-semibold text-neutral-700">物料编码<input required maxLength={80} value={materialForm.code} onChange={event => setMaterialForm(previous => ({ ...previous, code: event.target.value }))} placeholder="例如 FAB-COTTON-01" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal uppercase" /></label>
                <label className="font-semibold text-neutral-700">物料名称<input required maxLength={200} value={materialForm.name} onChange={event => setMaterialForm(previous => ({ ...previous, name: event.target.value }))} placeholder="例如 220g 纯棉针织面料" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" /></label>
                <label className="font-semibold text-neutral-700">物料分类<select value={materialForm.category} onChange={event => setMaterialForm(previous => ({ ...previous, category: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal"><option value="fabric">面料</option><option value="lining">里料</option><option value="trim">辅料 / 配件</option><option value="label">标签 / 标牌</option><option value="packaging">包装材料</option><option value="other">其他</option></select></label>
                <label className="font-semibold text-neutral-700">计量单位<select value={materialForm.unit} disabled={editingMaterialUnitLocked} onChange={event => setMaterialForm(previous => ({ ...previous, unit: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal disabled:bg-neutral-100 disabled:text-neutral-500"><option value="meter">米</option><option value="piece">件 / 个</option><option value="kg">千克</option><option value="roll">卷</option></select>{editingMaterialUnitLocked && <span className="mt-1 block font-normal text-neutral-500">已关联 · 单位锁定</span>}</label>
                <label className="font-semibold text-neutral-700">单位成本（€）<input type="number" min="0" step="0.0001" value={materialForm.unitCost} onChange={event => setMaterialForm(previous => ({ ...previous, unitCost: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" /></label>
                <label className="font-semibold text-neutral-700">安全库存（{({ meter: '米', piece: '件', kg: '千克', roll: '卷' } as Record<string, string>)[materialForm.unit] || materialForm.unit}）<input type="number" min="0" step="0.001" value={materialForm.reorderPoint} onChange={event => setMaterialForm(previous => ({ ...previous, reorderPoint: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" /></label>
                <label className="font-semibold text-neutral-700">采购交期（天）<input type="number" min="0" step="1" value={materialForm.leadTimeDays} onChange={event => setMaterialForm(previous => ({ ...previous, leadTimeDays: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" /></label>
                <label className="font-semibold text-neutral-700">物料状态<select value={materialForm.status} onChange={event => setMaterialForm(previous => ({ ...previous, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal"><option value="active">启用</option><option value="suspended">停用</option></select></label>
                <label className="font-semibold text-neutral-700 sm:col-span-2 lg:col-span-4">规格 / 供应备注<textarea maxLength={2000} rows={2} value={materialForm.notes} onChange={event => setMaterialForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="例如：成分、克重、幅宽、颜色号或采购注意事项" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" /></label>
              </div>
              <button type="submit" disabled={materialBusy} className="mt-3 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{materialBusy ? '保存中…' : editingMaterialId ? '保存修改' : '新增物料'}</button>
              </form>
            </details>
            <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">面辅料入库</h3>
            <form className="grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={async event => {
              event.preventDefault();
              const quantity = Number(materialInbound.quantity);
              if (!materialInbound.materialId || !Number.isFinite(quantity) || quantity <= 0) {
                addNotification('warning', '请填写入库数量', '选择物料并输入大于 0 的收货数量');
                return;
              }
              setMaterialBusy(true);
              try {
                await apiPost(`/api/merchant/materials/${encodeURIComponent(materialInbound.materialId)}/inbound`, {
                  quantity, locationCode: materialInbound.locationCode, note: materialInbound.note, idempotencyKey: crypto.randomUUID()
                });
                await refreshMaterials();
                setMaterialInbound(previous => ({ ...previous, quantity: '', note: '' }));
                addNotification('success', '面辅料已入库', '库存已更新，可用于自有工厂的补货生产');
              } catch (error) {
                addNotification('warning', '面辅料入库失败', error instanceof Error ? error.message : '请稍后重试');
              } finally {
                setMaterialBusy(false);
              }
            }}>
              <select value={materialInbound.materialId} onChange={event => setMaterialInbound(previous => ({ ...previous, materialId: event.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs md:col-span-2">
                <option value="">选择面辅料</option>
                {materials.filter(material => material.status === 'active').map(material => <option key={material.id} value={material.id}>{material.code} · {material.name}（{material.unit}）</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={materialInbound.quantity} onChange={event => setMaterialInbound(previous => ({ ...previous, quantity: event.target.value }))} placeholder={`本次收货数量${materials.find(material => material.id === materialInbound.materialId)?.unit ? `（${materials.find(material => material.id === materialInbound.materialId)?.unit}）` : ''}`} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs" />
              <select value={materialInbound.locationCode} onChange={event => setMaterialInbound(previous => ({ ...previous, locationCode: event.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs">
                <option value="central">RUDA 总仓</option>
              </select>
              <button type="submit" disabled={materialBusy || !materials.some(material => material.id === materialInbound.materialId && material.status === 'active')} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{materialBusy ? '入库中...' : '确认入库'}</button>
              <input value={materialInbound.note} onChange={event => setMaterialInbound(previous => ({ ...previous, note: event.target.value }))} maxLength={500} placeholder="备注（选填，如送货单号）" className="border border-neutral-300 rounded-lg px-3 py-2 text-xs md:col-span-5" />
            </form>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">物料库存</h3>
              <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>红色：低于安全库存</span><span>停用与 BOM 关联保留历史</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600"><tr><th className="p-3">物料</th><th className="p-3">分类</th><th className="p-3">成本 / 交期</th><th className="p-3">可用 / 现有</th><th className="p-3">安全库存</th><th className="p-3">仓库明细</th><th className="p-3">状态 / 操作</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">
                  {materials.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-neutral-400">暂无物料档案</td></tr> : materials.map(material => {
                    const lowStock = material.availableQuantity <= material.reorderPoint;
                    return <tr key={material.id} className="hover:bg-neutral-50">
                      <td className="p-3 font-semibold text-neutral-900"><span className="font-mono text-neutral-500">{material.code}</span><span className="block">{material.name}</span></td>
                      <td className="p-3">{({ fabric: '面料', lining: '里料', trim: '辅料 / 配件', label: '标签 / 标牌', packaging: '包装材料', other: '其他' } as Record<string, string>)[material.category] || material.category} · {({ meter: '米', piece: '件 / 个', kg: '千克', roll: '卷' } as Record<string, string>)[material.unit] || material.unit}</td>
                      <td className="p-3">€{material.unitCost.toFixed(4)} / {material.unit}<span className="block text-neutral-500">交期 {material.leadTimeDays} 天</span></td>
                      <td className={`p-3 font-bold ${lowStock ? 'text-rose-700' : 'text-emerald-700'}`}>{material.availableQuantity.toFixed(3)} / {material.onHandQuantity.toFixed(3)}</td>
                      <td className="p-3">{material.reorderPoint.toFixed(3)}</td>
                      <td className="p-3 text-neutral-600">{material.balances.length ? material.balances.map(balance => `${balance.location.name}: ${balance.onHandQuantity.toFixed(3)}（预留 ${balance.reservedQuantity.toFixed(3)}）`).join(' · ') : '暂无库存'}</td>
                      <td className="p-3"><div className="flex flex-col items-start gap-2">{material.status !== 'active' ? <span className="rounded bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600">已停用</span> : lowStock ? <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">需要补货</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">库存正常</span>}<button type="button" onClick={() => openMaterialEditor(material)} className="rounded border border-neutral-300 px-2.5 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-100">编辑</button></div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
            <div className="border-b border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-900">库存流水</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600"><tr><th className="p-3">时间</th><th className="p-3">物料</th><th className="p-3">动作</th><th className="p-3">数量</th><th className="p-3">仓库 / 操作人</th><th className="p-3">关联单据 / 备注</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {materialMovements.map(movement => <tr key={movement.id}>
                    <td className="whitespace-nowrap p-3 text-neutral-500">{new Date(movement.createdAt).toLocaleString()}</td>
                    <td className="p-3"><strong>{movement.material.code}</strong><span className="block text-neutral-500">{movement.material.name}</span></td>
                    <td className="p-3">{({ inbound: '收货入库', reservation: '生产预留', release: '取消释放', consumption: '生产消耗', adjustment: '库存调整' } as Record<string, string>)[movement.movementType] || movement.movementType}</td>
                    <td className="p-3 font-semibold">{movement.quantity > 0 ? '+' : ''}{movement.quantity.toFixed(3)} {movement.material.unit}</td>
                    <td className="p-3">{movement.location.name}<span className="block text-neutral-500">{movement.operatorId || '系统'}</span></td>
                    <td className="p-3 text-neutral-600">{movement.referenceType === 'ProductionWorkOrder' ? `生产工单 ${movement.referenceId || ''}` : movement.referenceType === 'MaterialInbound' ? '面辅料收货' : movement.referenceType || '—'}{movement.note ? <span className="block max-w-xs truncate text-neutral-500">{movement.note}</span> : null}</td>
                  </tr>)}
                  {materialMovements.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-400">暂无库存流水</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: optional production replenishment */}
      {/* ======================================================== */}
      {activeTab === 'production' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader
            title="生产"
            icon={<ClipboardCheck className="h-3.5 w-3.5" />}
            action={<button type="button" onClick={() => void refreshProduction()} disabled={productionBusy} className="inline-flex items-center gap-2 rounded-xl border border-white/90 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${productionBusy ? 'animate-spin' : ''}`} />刷新</button>}
          />
          <div className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            {productionBalances.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">暂无 SKU 库存，请先配置规格并入库。</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <label className="grid gap-1 text-[10px] font-semibold text-neutral-600 md:col-span-2">款式 / SKU<select aria-label="款式 / SKU" value={productionForm.variantId} onChange={event => setProductionForm(previous => ({ ...previous, variantId: event.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs font-normal">
                  {Array.from(new Map(productionBalances.map(balance => [balance.variantId, balance])).values()).map(balance => <option key={balance.variantId} value={balance.variantId}>{balance.product.styleNo} · {balance.sku}</option>)}
                </select></label>
                <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">成品仓<select aria-label="成品仓" value={productionForm.outputLocationId} onChange={event => setProductionForm(previous => ({ ...previous, outputLocationId: event.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs font-normal">
                  {Array.from(new Map(productionBalances.map(balance => [balance.location.id, balance.location])).values()).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select></label>
                <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">计划件数<input aria-label="计划件数" type="number" min="1" value={productionForm.plannedQuantity} onChange={event => setProductionForm(previous => ({ ...previous, plannedQuantity: Number(event.target.value) }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-xs font-normal" /></label>
                <button type="button" disabled={productionBusy} onClick={async () => {
                  const selected = productionBalances.find(balance => balance.variantId === productionForm.variantId);
                  if (!selected) return;
                  setProductionBusy(true);
                  try {
                    await apiPost('/api/merchant/production/work-orders', { ...productionForm, productId: selected.product.id });
                    await refreshProduction();
                    addNotification('success', '生产工单已创建', '请先释放工单，再开始车间报产');
                  } catch (error) {
                    addNotification('warning', '创建生产工单失败', error instanceof Error ? error.message : '请检查输入');
                  } finally { setProductionBusy(false); }
                }} className="bg-neutral-900 text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">创建工单</button>
              </div>
            )}
          </div>
          <div className="merchant-home-card overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-4 border-b border-neutral-200 text-xs font-bold text-neutral-800">工单</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600"><tr><th className="p-3">工单</th><th className="p-3">款式 / SKU</th><th className="p-3">计划 / 合格 / 不合格</th><th className="p-3">成品仓</th><th className="p-3">状态</th><th className="p-3 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">
                  {productionWorkOrders.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-neutral-400">暂无生产工单</td></tr> : productionWorkOrders.map(order => (
                    <tr key={order.id}>
                      <td className="p-3 font-mono font-semibold">{order.workOrderNo}</td>
                      <td className="p-3">{order.product.styleNo}<span className="block text-neutral-500">{order.variant.sku}</span></td>
                      <td className="p-3">{order.plannedQuantity} / {order.completedQuantity} / <span className="text-rose-700">{order.rejectedQuantity}</span></td>
                      <td className="p-3">{order.outputLocation.name}</td>
                      <td className="p-3 font-semibold">{order.status}</td>
                      <td className="p-3 text-right space-x-2">
                        {order.status === 'draft' && <button type="button" onClick={async () => { try { await apiPut(`/api/merchant/production/work-orders/${order.id}/status`, { status: 'released' }); await refreshProduction(); } catch (error) { addNotification('warning', '工单释放失败', error instanceof Error ? error.message : '请重试'); } }} className="text-neutral-900 font-semibold">释放</button>}
                        {['released', 'in_progress', 'qc_hold'].includes(order.status) && <button type="button" onClick={async () => {
                          const value = window.prompt('本次合格报产数量');
                          const goodQuantity = Number(value);
                          if (!Number.isInteger(goodQuantity) || goodQuantity <= 0) return;
                          try {
                            await apiPost(`/api/merchant/production/work-orders/${order.id}/reports`, { goodQuantity, rejectedQuantity: 0, idempotencyKey: crypto.randomUUID() });
                            await refreshProduction();
                            addNotification('success', '报产已入库', `${goodQuantity} 件合格成衣已进入成品仓`);
                          } catch (error) { addNotification('warning', '报产失败', error instanceof Error ? error.message : '请重试'); }
                        }} className="text-emerald-700 font-semibold">报产入库</button>}
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
      {/* SUB-TAB 5: 单仓库存与商品件数 (INVENTORY) */}
      {/* ======================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader title="库存" icon={<Boxes className="h-3.5 w-3.5" />} />

          <div className="merchant-home-card overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">库存台账</h3>
              <input value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} placeholder="搜索款号 / SKU" className="rounded-lg border border-neutral-300 px-3 py-2 text-xs sm:w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr><th className="px-4 py-3">商品 / SKU</th><th className="px-4 py-3">仓库</th><th className="px-4 py-3 text-right">在库</th><th className="px-4 py-3 text-right">预留</th><th className="px-4 py-3 text-right">可用</th><th className="px-4 py-3 text-right">在途</th><th className="px-4 py-3 text-right">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {inventoryLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">正在读取库存...</td></tr> : visibleInventoryBalances.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">暂无库存台账</td></tr> : visibleInventoryBalances.map(balance => (
                    <tr key={balance.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3"><div className="font-semibold text-neutral-900">{balance.product.styleNo} · {balance.product.name}</div><div className="mt-0.5 font-mono text-[11px] text-neutral-500">{balance.sku} {balance.color || ''} {balance.size || ''}</div></td>
                      <td className="px-4 py-3 font-medium">{balance.location.name}</td>
                      <td className="px-4 py-3 text-right font-semibold">{balance.onHandQuantity}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{balance.reservedQuantity}</td>
                      <td className={`px-4 py-3 text-right font-bold ${balance.availableQuantity <= 0 ? 'text-rose-700' : balance.availableQuantity <= 5 ? 'text-amber-700' : 'text-emerald-700'}`}>{balance.availableQuantity}</td>
                      <td className="px-4 py-3 text-right text-indigo-700">{balance.inTransitQuantity}</td>
                      <td className="px-4 py-3 text-right"><button type="button" onClick={() => setInventoryAdjustment({ balance, quantity: String(balance.onHandQuantity), note: '' })} className="rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">调整库存</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className="group rounded-xl border border-neutral-200 bg-white shadow-xs">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-neutral-900 marker:hidden">
              库存流水
              <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">商品 / SKU</th><th className="px-4 py-3">仓库</th><th className="px-4 py-3">作业</th><th className="px-4 py-3 text-right">数量</th><th className="px-4 py-3">备注</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">
                  {inventoryMovements.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">暂无库存流水</td></tr> : inventoryMovements.slice(0, 30).map(movement => (
                    <tr key={movement.id}>
                      <td className="px-4 py-3 text-neutral-500">{new Date(movement.createdAt).toLocaleString(getIntlLocale(lang))}</td>
                      <td className="px-4 py-3"><span className="font-semibold">{movement.variant.product.styleNo}</span><span className="ml-2 font-mono text-neutral-500">{movement.variant.sku}</span></td>
                      <td className="px-4 py-3">{movement.location.name}</td>
                      <td className="px-4 py-3">{({ inbound: '采购/生产入库', purchase_order: '采购在途', reservation: '订单预留', release: '释放预留', sale: '销售出库', return: '退货入库', transfer: '调拨', adjustment: '盘点调整' } as Record<string, string>)[movement.movementType] || movement.movementType}</td>
                      <td className={`px-4 py-3 text-right font-bold ${movement.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-neutral-500">{movement.note || '系统作业'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </details>

          {/* Transfers Table */}
          <details className="group rounded-xl border border-neutral-200 bg-white shadow-xs">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-neutral-900 marker:hidden">
              调拨记录
              <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
            </summary>
            <div className="overflow-hidden border-t border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">调拨单号</th>
                    <th className="py-3 px-4">发起时间</th>
                    <th className="py-3 px-4">款号 / SKU</th>
                    <th className="py-3 px-4">调出仓库</th>
                    <th className="py-3 px-4">调入仓库</th>
                    <th className="py-3 px-4">调拨件数</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4">备注原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {merchantTransfers.map((tr) => (
                    <tr key={tr.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">{tr.transferNo || tr.id}</td>
                      <td className="py-3 px-4 text-neutral-500">{tr.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{tr.styleNo}</div>
                        <div className="text-neutral-500 font-mono text-[11px]">{tr.sku}</div>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium">{tr.fromLocation} 仓</td>
                      <td className="py-3 px-4 capitalize font-medium text-amber-700">{tr.toLocation} 展厅</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{tr.quantity} 件</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          tr.status === 'completed' || tr.status === 'received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tr.status === 'in_transit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}>
                          {({
                            completed: localizeCopy('已完成', 'Completato'),
                            received: localizeCopy('已收货', 'Ricevuto'),
                            in_transit: localizeCopy('运输中', 'In transito'),
                            pending: localizeCopy('待处理', 'In attesa'),
                            cancelled: localizeCopy('已取消', 'Annullato')
                          } as Record<string, string>)[tr.status] || tr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">{tr.notes || '常规调货'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </details>
        </div>
      )}

      {activeTab === 'orders' && (assistedOrderOpen ? (
        <section className="merchant-orders-workspace space-y-4 pb-24" aria-label="创建订单">
          <header className="flex items-center justify-between gap-3 border-b border-neutral-200 py-3">
            <h1 className="text-lg font-semibold tracking-tight text-neutral-950">创建订单</h1>
            <button type="button" disabled={assistedOrderBusy} onClick={() => setAssistedOrderOpen(false)} className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">返回订单列表</button>
          </header>
          <form ref={assistedOrderFormRef} onSubmit={async event => {
            event.preventDefault();
            if (assistedOrderBusy) return;
            setAssistedOrderBusy(true);
            try {
              const customer = assistedOrderCustomers.find(candidate =>
                candidate.id === assistedOrderCustomerId && (candidate.status === 'approved' || candidate.status === 'pending')
              );
              if (!customer) throw new Error('请选择客户');
              if (!assistedOrderItems.length) throw new Error('请至少添加一项商品');
              const skuQuantities = new Map<string, { productId: string; sku: string; quantity: number }>();
              for (const line of assistedOrderItems) {
                const product = merchantProducts.find(candidate => candidate.id === line.productId && candidate.lifecycleStatus === 'published');
                const sku = product?.skus.find(candidate => candidate.sku === line.sku && candidate.isActive !== false);
                const quantity = Number(line.quantity);
                if (!product || !sku) throw new Error('请选择有效的商品和 SKU');
                if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) throw new Error(`${product.styleNo} 数量必须为正整数`);
                const key = `${product.id}:${sku.sku}`;
                const current = skuQuantities.get(key);
                skuQuantities.set(key, { productId: product.id, sku: sku.sku, quantity: (current?.quantity || 0) + quantity });
              }
              const orderItems = [...skuQuantities.values()];
              const quantityByProduct = new Map<string, number>();
              for (const item of orderItems) quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
              for (const [productId, quantity] of quantityByProduct) {
                const product = merchantProducts.find(candidate => candidate.id === productId);
                if (!product || quantity < product.moq || quantity % Math.max(1, product.packSize) !== 0) {
                  throw new Error(`${product?.styleNo || '商品'} 总数量需不少于 MOQ，且为 ${product?.packSize || 1} 件/箱的整数倍`);
                }
              }
              const prepaymentValue = Number(assistedOrderTerms.prepaymentValue);
              const terms = {
                paymentPlan: assistedOrderTerms.paymentPlan,
                paymentMethod: assistedOrderTerms.paymentMethod,
                ...(assistedOrderTerms.paymentPlan === 'partial_prepayment'
                  ? assistedOrderTerms.prepaymentMode === 'percent'
                    ? { prepaymentPercent: prepaymentValue }
                    : { prepaymentAmount: prepaymentValue }
                  : assistedOrderTerms.paymentPlan === 'custom' && assistedOrderTerms.prepaymentValue
                    ? { prepaymentAmount: prepaymentValue }
                    : {}),
                remainingBalanceTrigger: assistedOrderTerms.remainingBalanceTrigger,
                remainingBalanceDueAt: assistedOrderTerms.remainingBalanceDueAt || null,
                customPaymentCondition: assistedOrderTerms.customPaymentCondition.trim() || null,
                supplyMode: assistedOrderTerms.supplyMode,
                expectedDeliveryAt: assistedOrderTerms.expectedDeliveryAt
                  ? new Date(assistedOrderTerms.expectedDeliveryAt).toISOString()
                  : null
              };
              const result = await apiPost<{
                success: true;
                order: { id: string; orderNo: string; totalAmount: number };
                agreement: { status: string };
              }>('/api/merchant/orders/assisted-create', {
                customerId: customer.id,
                items: orderItems,
                shippingAddress: assistedOrderAddress,
                shippingFee: Number(assistedOrderShippingFee),
                additionalFees: Number(assistedOrderAdditionalFees),
                additionalFeesDescription: assistedOrderAdditionalFeesDescription.trim(),
                discountAmount: 0,
                terms,
                idempotencyKey: assistedOrderIdempotencyKey
              });
              let refreshed: { success: true; orders: Order[] };
              try {
                refreshed = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
              } catch (error) {
                console.error('[merchant-assisted-order-refresh]', error);
                addNotification('warning', '订单已创建，列表刷新失败', '请再次提交以安全重试刷新，或返回订单列表后手动刷新');
                return;
              }
              setServerOrders(refreshed.orders);
              setAssistedOrderOpen(false);
              setAssistedOrderIdempotencyKey('');
              setAssistedOrderItems([]);
              addNotification('success', '正式订单已创建', `${result.order.orderNo} · 等待客户确认约定`);
              openOrderDetail(result.order.id);
            } catch (error) {
              addNotification('warning', '开单失败', getAssistedOrderErrorMessage(error, '请检查客户、商品、约定和收货信息'));
            } finally {
              setAssistedOrderBusy(false);
            }
          }} className="space-y-4">
            <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-neutral-900">客户</h2>
                <button type="button" onClick={() => setAssistedOrderNewCustomerOpen(value => !value)} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">{assistedOrderNewCustomerOpen ? '取消登记' : '登记新客户'}</button>
              </div>
              <label className="mt-4 block text-xs font-semibold text-neutral-700">搜索客户
                <input value={assistedOrderCustomerSearch} onChange={event => setAssistedOrderCustomerSearch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" placeholder="公司、联系人或邮箱" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-neutral-700">选择客户
                <select required value={assistedOrderCustomerId} onChange={event => {
                  const customer = assistedOrderCustomers.find(candidate => candidate.id === event.target.value);
                  setAssistedOrderCustomerId(event.target.value);
                  setAssistedOrderAddressMode('profile');
                  setAssistedOrderAddress({
                    street: customer?.address || '',
                    city: customer?.city || '',
                    country: customer?.country || '',
                    zip: '',
                    recipient: customer?.contactPerson || '',
                    phone: customer?.phone || ''
                  });
                }} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-normal">
                  <option value="">{assistedOrderVisibleCustomers.length ? '选择客户' : '没有匹配的客户'}</option>
                  {assistedOrderVisibleCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.companyName} · {customer.contactPerson || customer.email} · {customer.status === 'approved' ? '已审核' : '待审核'}</option>)}
                </select>
              </label>
              {assistedOrderSelectedCustomer && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs">
                  <span className="text-neutral-700">{assistedOrderSelectedCustomer.buyerAccountLinked ? '平台账户已绑定' : '平台账户待绑定'} · 订单仍需客户确认</span>
                  {!assistedOrderSelectedCustomer.buyerAccountLinked && assistedOrderSelectedCustomer.email && !assistedOrderSelectedCustomer.email.endsWith('@ruda.local') && (
                    <button type="button" disabled={assistedOrderInviteBusy} onClick={async () => {
                      setAssistedOrderInviteBusy(true);
                      try {
                        await apiPost<{ success: true }>('/api/auth/register/quick/request', { email: assistedOrderSelectedCustomer.email });
                        addNotification('success', '绑定验证码已发送', '客户需使用邮箱验证码及账户密码完成绑定；此操作不代表客户确认订单');
                      } catch (error) {
                        addNotification('warning', '验证码发送失败', getAssistedOrderErrorMessage(error, '请稍后重试'));
                      } finally {
                        setAssistedOrderInviteBusy(false);
                      }
                    }} className="font-semibold text-neutral-800 underline underline-offset-2 disabled:opacity-50">{assistedOrderInviteBusy ? '发送中…' : '发送绑定验证码'}</button>
                  )}
                </div>
              )}
              {assistedOrderNewCustomerOpen && (
                <div className="mt-4 rounded-xl border border-neutral-200 p-3 sm:p-4">
                  <h3 className="text-xs font-semibold text-neutral-800">新客户档案</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      ['companyName', '公司/店铺名称', true],
                      ['contactPerson', '联系人', true],
                      ['email', '邮箱（用于账户绑定）', true],
                      ['phone', '联系电话', true],
                      ['address', '街道地址', true],
                      ['city', '城市', true],
                      ['country', '国家/地区', true]
                    ] as const).map(([key, label, required]) => (
                      <label key={key} className="text-xs font-medium text-neutral-700">{label}
                        <input required={required} type={key === 'email' ? 'email' : 'text'} value={assistedOrderNewCustomer[key]} onChange={event => setAssistedOrderNewCustomer(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-normal" />
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={assistedOrderNewCustomerBusy} onClick={async () => {
                    if (assistedOrderNewCustomerBusy) return;
                    setAssistedOrderNewCustomerBusy(true);
                    try {
                      const result = await apiPost<{ success: true; customer: MerchantCustomer }>('/api/merchant/customers', {
                        ...assistedOrderNewCustomer,
                        businessType: 'Boutique',
                        customerLevel: 'new_customer'
                      });
                      setServerCustomers(current => [...(current || merchantCustomers).filter(item => item.id !== result.customer.id), result.customer]);
                      setAssistedOrderCustomerId(result.customer.id);
                      setAssistedOrderAddressMode('profile');
                      setAssistedOrderAddress({
                        street: result.customer.address,
                        city: result.customer.city,
                        country: result.customer.country,
                        zip: '',
                        recipient: result.customer.contactPerson,
                        phone: result.customer.phone
                      });
                      setAssistedOrderNewCustomerOpen(false);
                      setAssistedOrderNewCustomer({
                        companyName: '', contactPerson: '', email: '', phone: '', address: '', city: '', country: ''
                      });
                      addNotification('success', '客户档案已登记', '客户账户待绑定，订单提交后仍需客户确认');
                    } catch (error) {
                      addNotification('warning', '客户登记失败', error instanceof Error ? error.message : '请检查客户信息');
                    } finally {
                      setAssistedOrderNewCustomerBusy(false);
                    }
                  }} className="mt-3 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{assistedOrderNewCustomerBusy ? '保存中…' : '保存客户并选择'}</button>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-neutral-900">商品</h2>
                <button type="button" disabled={!assistedOrderVisibleProducts.length} onClick={() => {
                  const product = assistedOrderVisibleProducts[0];
                  const sku = product?.skus.find(candidate => candidate.isActive !== false);
                  if (product && sku) {
                    const packSize = Math.max(1, product.packSize);
                    setAssistedOrderItems(current => [...current, {
                      productId: product.id,
                      sku: sku.sku,
                      quantity: String(Math.ceil(product.moq / packSize) * packSize)
                    }]);
                  }
                }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">添加商品</button>
              </div>
              <label className="mt-4 block text-xs font-semibold text-neutral-700">搜索商品
                <input value={assistedOrderProductSearch} onChange={event => setAssistedOrderProductSearch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" placeholder="商品名称或货号" />
              </label>
              <div className="mt-3 space-y-2">
                {assistedOrderItems.map((line, index) => {
                  const product = merchantProducts.find(candidate => candidate.id === line.productId);
                  const selectableProducts = product && !assistedOrderVisibleProducts.some(candidate => candidate.id === product.id)
                    ? [product, ...assistedOrderVisibleProducts]
                    : assistedOrderVisibleProducts;
                  const sku = product?.skus.find(candidate => candidate.sku === line.sku);
                  const quantity = Number(line.quantity) || 0;
                  const styleQuantity = assistedOrderItems.filter(item => item.productId === line.productId).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  const unitPrice = product ? Number((
                    getProductWholesalePriceForQuantity(product.wholesalePrice, product.wholesalePrice100, styleQuantity, product.bulkPriceMinimumQuantity)
                    * (assistedOrderSelectedCustomer?.discountRate ?? 1)
                  ).toFixed(2)) : 0;
                  const available = Math.max(0, Number(sku?.stockCentral) || 0);
                  const backorderAllowed = sku?.allowBackorder !== false;
                  return (
                    <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_36px] sm:items-end">
                      <div className="flex items-center gap-3 sm:col-span-4">
                        {product?.images?.[0]
                          ? <img src={product.images[0]} alt={product.name} className="h-12 w-12 rounded-lg border border-neutral-200 object-cover" />
                          : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50"><Package className="h-5 w-5 text-neutral-400" /></div>}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-neutral-900">{product?.name || '选择商品'}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">货号 {product?.styleNo || '—'}</p>
                        </div>
                      </div>
                      <label className="text-xs font-medium text-neutral-700">商品
                        <select required value={line.productId} onChange={event => {
                          const nextProduct = assistedOrderVisibleProducts.find(candidate => candidate.id === event.target.value);
                          const nextSku = nextProduct?.skus.find(candidate => candidate.isActive !== false);
                          const packSize = Math.max(1, nextProduct?.packSize || 1);
                          setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? {
                            productId: nextProduct?.id || '',
                            sku: nextSku?.sku || '',
                            quantity: nextProduct ? String(Math.ceil(nextProduct.moq / packSize) * packSize) : ''
                          } : item));
                        }} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 font-normal">
                          <option value="">选择商品</option>
                          {selectableProducts.map(item => <option key={item.id} value={item.id}>{item.styleNo} · {item.name}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-neutral-700">颜色 / 尺码
                        <select required value={line.sku} onChange={event => setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 font-normal">
                          {(product?.skus || []).filter(item => item.isActive !== false).map(item => <option key={item.sku} value={item.sku}>{item.color} / {item.size}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-neutral-700">数量（件）
                        <input required type="number" min="1" max="100000" step="1" value={line.quantity} onChange={event => setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-2 font-normal" />
                      </label>
                      <button type="button" aria-label="移除商品" onClick={() => setAssistedOrderItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><Trash2 className="h-4 w-4" /></button>
                      <p className="text-[11px] text-neutral-600 sm:col-span-4">
                        单价 €{unitPrice.toFixed(2)} · 小计 €{(unitPrice * quantity).toFixed(2)} · 本款 {styleQuantity} 件 · MOQ {product?.moq || 0} / 箱规 {product?.packSize || 1}
                        {sku && available < quantity ? backorderAllowed ? ' · 超出现货部分按订货需求记录' : ' · 现货不足且该 SKU 未开放订货' : ''}
                      </p>
                    </div>
                  );
                })}
                {!assistedOrderItems.length && <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-8 text-center text-xs text-neutral-500">{assistedOrderVisibleProducts.length ? '添加商品和 SKU' : '暂无匹配的已发布商品或可用 SKU'}</p>}
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-neutral-900">收货信息</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2"><input type="radio" checked={assistedOrderAddressMode === 'profile'} onChange={() => {
                  setAssistedOrderAddressMode('profile');
                  setAssistedOrderAddress(current => ({
                    ...current,
                    street: assistedOrderSelectedCustomer?.address || '',
                    city: assistedOrderSelectedCustomer?.city || '',
                    country: assistedOrderSelectedCustomer?.country || '',
                    recipient: assistedOrderSelectedCustomer?.contactPerson || '',
                    phone: assistedOrderSelectedCustomer?.phone || ''
                  }));
                }} />客户档案地址</label>
                <label className="flex items-center gap-2"><input type="radio" checked={assistedOrderAddressMode === 'custom'} onChange={() => setAssistedOrderAddressMode('custom')} />填写本次地址</label>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ['recipient', '收件人', true],
                  ['phone', '联系电话', true],
                  ['street', '街道及门牌', true],
                  ['city', '城市', true],
                  ['country', '国家/地区', true],
                  ['zip', '邮编', true]
                ] as const).map(([key, label, required]) => (
                  <label key={key} className={`text-xs font-medium text-neutral-700 ${key === 'street' ? 'sm:col-span-2' : ''}`}>{label}
                    <input required={required} maxLength={key === 'street' ? 240 : key === 'phone' ? 60 : 120} value={assistedOrderAddress[key]} onChange={event => setAssistedOrderAddress(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-neutral-900">金额与交易约定</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-neutral-700">付款方案
                  <select value={assistedOrderTerms.paymentPlan} onChange={event => {
                    const paymentPlan = event.target.value as OrderAgreementTerms['paymentPlan'];
                    setAssistedOrderTerms(current => ({
                      ...current,
                      paymentPlan,
                      ...(paymentPlan === 'custom' ? { prepaymentMode: 'amount' as const, prepaymentValue: '' } : {}),
                      ...(paymentPlan === 'cash_on_delivery' || paymentPlan === 'ship_before_payment'
                        ? { remainingBalanceTrigger: 'on_delivery' as const }
                        : {})
                    }));
                  }} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-normal">
                    <option value="full_prepayment">全额先付</option><option value="ship_before_payment">先发货后付款</option><option value="partial_prepayment">部分预付款</option><option value="cash_on_delivery">货到付款</option><option value="custom">自定义约定</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-neutral-700">付款方式
                  <select value={assistedOrderTerms.paymentMethod} onChange={event => setAssistedOrderTerms(current => ({ ...current, paymentMethod: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-normal">
                    <option value="bank_transfer">银行转账</option><option value="credit_card">银行卡</option><option value="stripe">Stripe</option>
                  </select>
                </label>
                {(assistedOrderTerms.paymentPlan === 'partial_prepayment' || assistedOrderTerms.paymentPlan === 'custom') && (
                  <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-700">{assistedOrderTerms.paymentPlan === 'partial_prepayment' ? '预付款' : '自定义预付款金额（可留空）'}
                      <div className="mt-1 flex gap-2">
                      {assistedOrderTerms.paymentPlan === 'partial_prepayment' && (
                        <select value={assistedOrderTerms.prepaymentMode} onChange={event => setAssistedOrderTerms(current => ({ ...current, prepaymentMode: event.target.value as 'percent' | 'amount' }))} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2.5">
                          <option value="percent">比例</option><option value="amount">金额（€）</option>
                        </select>
                      )}
                      <input required={assistedOrderTerms.paymentPlan === 'partial_prepayment'} type="number" min="0.01" max={assistedOrderTerms.paymentPlan === 'partial_prepayment' && assistedOrderTerms.prepaymentMode === 'percent' ? '99.99' : undefined} step="0.01" value={assistedOrderTerms.prepaymentValue} onChange={event => setAssistedOrderTerms(current => ({ ...current, prepaymentValue: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" />
                    </div>
                  </label>
                  </div>
                )}
                <label className="text-xs font-medium text-neutral-700">余款条件
                  <select value={assistedOrderTerms.remainingBalanceTrigger} onChange={event => setAssistedOrderTerms(current => ({ ...current, remainingBalanceTrigger: event.target.value as OrderAgreementTerms['remainingBalanceTrigger'] }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-normal">
                    <option value="before_shipment">发货前</option><option value="on_delivery">货到时</option><option value="after_delivery">签收后</option><option value="date">指定日期</option><option value="custom">双方另行确认</option>
                  </select>
                </label>
                {assistedOrderTerms.remainingBalanceTrigger === 'date' && <label className="text-xs font-medium text-neutral-700">余款日期<input required type="date" value={assistedOrderTerms.remainingBalanceDueAt} onChange={event => setAssistedOrderTerms(current => ({ ...current, remainingBalanceDueAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>}
                <label className="text-xs font-medium text-neutral-700">供货与发货
                  <select value={assistedOrderTerms.supplyMode} onChange={event => setAssistedOrderTerms(current => ({ ...current, supplyMode: event.target.value as OrderAgreementTerms['supplyMode'] }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-normal">
                    <option value="in_stock_first">现货优先</option><option value="all_ready">齐货后发</option><option value="partial_shipments">分批发货</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-neutral-700">预计交期（未知时待确认）<input type="date" value={assistedOrderTerms.expectedDeliveryAt} onChange={event => setAssistedOrderTerms(current => ({ ...current, expectedDeliveryAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>
                {(assistedOrderTerms.paymentPlan === 'custom' || assistedOrderTerms.remainingBalanceTrigger === 'custom') && <label className="text-xs font-medium text-neutral-700 sm:col-span-2">自定义付款条件<input required maxLength={500} value={assistedOrderTerms.customPaymentCondition} onChange={event => setAssistedOrderTerms(current => ({ ...current, customPaymentCondition: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>}
                <label className="text-xs font-medium text-neutral-700">运费（€）<input required type="number" min="0" max="1000000" step="0.01" value={assistedOrderShippingFee} onChange={event => setAssistedOrderShippingFee(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>
                <label className="text-xs font-medium text-neutral-700">其他费用（€）<input required type="number" min="0" max="1000000" step="0.01" value={assistedOrderAdditionalFees} onChange={event => setAssistedOrderAdditionalFees(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>
                {Number(assistedOrderAdditionalFees) > 0 && <label className="text-xs font-medium text-neutral-700 sm:col-span-2">其他费用说明<input required maxLength={240} value={assistedOrderAdditionalFeesDescription} onChange={event => setAssistedOrderAdditionalFeesDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" /></label>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 text-xs sm:grid-cols-4">
                <p className="text-neutral-600">商品金额 <strong className="block text-neutral-950">€{assistedOrderSubtotal.toFixed(2)}</strong></p>
                <p className="text-neutral-600">商品件数 <strong className="block text-neutral-950">{assistedOrderItemCount}</strong></p>
                <p className="text-neutral-600">费用 <strong className="block text-neutral-950">€{((Number(assistedOrderShippingFee) || 0) + (Number(assistedOrderAdditionalFees) || 0)).toFixed(2)}</strong></p>
                <p className="text-neutral-600">订单总额 <strong className="block text-neutral-950">€{assistedOrderEstimatedTotal.toFixed(2)}</strong></p>
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">当前为商家提案；客户确认同一版本前，付款与发货条件不会生效。</p>
            </section>
            <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <button type="button" onClick={() => assistedOrderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-lg border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">返回修改</button>
              <button type="submit" disabled={assistedOrderBusy || !assistedOrderCustomers.length || !assistedOrderProducts.length} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">{assistedOrderBusy ? '创建中…' : '创建订单'}</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="merchant-orders-workspace space-y-4" aria-label="订单">
          {orderView === 'drafts' && (
            <header className="merchant-orders-header merchant-home-intro flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-3">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-950">报价</h2>
              </div>
              <button type="button" onClick={() => openDraftQuoteForm()} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700">
                <Plus className="h-4 w-4" />新建报价
              </button>
            </header>
          )}

          {orderView === 'drafts' && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: orderView === 'drafts' ? '草稿报价' : '订单数', value: orderView === 'drafts' ? merchantQuotes.length : ordersInSelectedDateRange.length },
              { label: orderView === 'drafts' ? '草稿件数' : '订购件数', value: `${orderView === 'drafts' ? merchantQuotes.reduce((sum, quote) => sum + quote.totalQty, 0) : ordersInSelectedDateRange.reduce((sum, order) => sum + order.totalQty, 0)} 件` },
              { label: orderView === 'drafts' ? '待客户确认' : '待履约', value: orderView === 'drafts' ? merchantQuotes.filter(quote => ['draft', 'sent'].includes(quote.status)).length : ordersInSelectedDateRange.filter(order => ['placed', 'pending', 'confirmed', 'picking'].includes(order.status)).length },
              { label: orderView === 'drafts' ? '报价总额' : '未付款订单', value: orderView === 'drafts' ? `€${merchantQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0).toFixed(2)}` : ordersInSelectedDateRange.filter(order => order.paymentStatus === 'unpaid').length }
            ].map(metric => (
              <div key={metric.label} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <p className="text-[10px] text-neutral-500">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-950">{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</p>
              </div>
            ))}
          </div>}

          {orderView === 'orders' ? (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200/80 p-3 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                <div className="flex flex-wrap items-center gap-1">
                {([
                  ['all', '全部订单', ordersInSelectedDateRange.length],
                  ['needs_action', '待我处理', ordersInSelectedDateRange.filter(order => Boolean(order.currentTasks?.merchant.action)).length],
                  ['in_progress', '进行中', ordersInSelectedDateRange.filter(order => ['confirmed', 'picking', 'shipped'].includes(order.status)).length],
                  ['logistics_exception', '物流异常', ordersInSelectedDateRange.filter(order => order.hasLogisticsException).length],
                  ['complete', '已完成', ordersInSelectedDateRange.filter(order => ['delivered', 'returned', 'cancelled'].includes(order.status)).length]
                ] as const).map(([filter, label, count]) => (
                  <button key={filter} type="button" onClick={() => setOrderStatusFilter(filter)} className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${orderStatusFilter === filter ? 'bg-neutral-950 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'}`}>
                    {label}<span className={`ml-1.5 ${orderStatusFilter === filter ? 'text-neutral-300' : 'text-neutral-400'}`}>{count}</span>
                  </button>
                ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="订单日期范围" value={orderDateRange} onChange={event => setOrderDateRange(event.target.value as typeof orderDateRange)} className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-neutral-500 focus:outline-none">
                    <option value="7">最近 7 天</option>
                    <option value="30">最近 30 天</option>
                    <option value="90">最近 90 天</option>
                    <option value="all">全部时间</option>
                  </select>
                  <button type="button" onClick={() => {
                    if (!assistedOrderIdempotencyKey) {
                      setAssistedOrderCustomerId('');
                      setAssistedOrderCustomerSearch('');
                      setAssistedOrderProductSearch('');
                      setAssistedOrderAddressMode('profile');
                      setAssistedOrderAddress({ street: '', city: '', country: '', zip: '', recipient: '', phone: '' });
                      setAssistedOrderItems([]);
                      setAssistedOrderShippingFee('0');
                      setAssistedOrderAdditionalFees('0');
                      setAssistedOrderAdditionalFeesDescription('');
                      setAssistedOrderTerms({
                        paymentPlan: 'full_prepayment',
                        paymentMethod: 'bank_transfer',
                        prepaymentMode: 'percent',
                        prepaymentValue: '30',
                        remainingBalanceTrigger: 'before_shipment',
                        remainingBalanceDueAt: '',
                        customPaymentCondition: '',
                        supplyMode: 'partial_shipments',
                        expectedDeliveryAt: ''
                      });
                      setAssistedOrderIdempotencyKey(crypto.randomUUID());
                    }
                    setAssistedOrderOpen(true);
                  }} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700">
                    <Plus className="h-4 w-4" />开单
                  </button>
                  <button
                    type="button"
                    disabled={!visibleMerchantOrders.length}
                    onClick={() => {
                      const ordersToExport = selectedOrderIds.length
                        ? visibleMerchantOrders.filter(order => selectedOrderIds.includes(order.id))
                        : visibleMerchantOrders;
                      const escapeCsv = (value: unknown) => {
                        const normalized = String(value ?? '');
                        const safe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
                        return `"${safe.replaceAll('"', '""')}"`;
                      };
                      const rows = [
                        ['订单号', '日期', '客户', '国家', '商品款数', '件数', '商品金额EUR', '运费EUR', '总金额EUR', '付款状态', '履约状态', '承运商', '物流单号'],
                        ...ordersToExport.map(order => [
                          order.orderNo, order.date, order.companyName, order.shippingAddress?.country,
                          order.items.length, order.totalQty, order.totalAmount, order.shippingFee || 0,
                          order.totalAmount + (order.shippingFee || 0), order.paymentStatus, order.status,
                          order.carrier, order.trackingNumber
                        ])
                      ];
                      const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
                      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `ruda-orders-${new Date().toISOString().slice(0, 10)}.csv`;
                      link.click();
                      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {selectedVisibleOrderCount ? `导出已选 (${selectedVisibleOrderCount})` : '导出订单'}
                  </button>
                </div>
              </div>
              <div className="mt-4 sm:hidden">
                <label className="relative block min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="搜索订单、客户、商品、SKU 或物流" className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-xs outline-none transition focus:border-neutral-400 focus:bg-white" />
                </label>
              </div>
              {(orderSearch || orderPaymentFilter !== 'all' || orderDeliveryFilter !== 'all' || orderStatusFilter !== 'all') && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">当前筛选</span>
                  {orderSearch && <button type="button" onClick={() => setOrderSearch('')} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-neutral-700">“{orderSearch}” ×</button>}
                  {orderPaymentFilter !== 'all' && <button type="button" onClick={() => setOrderPaymentFilter('all')} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-neutral-700">{({ paid: '已付款', partially_refunded: '部分退款', unpaid: '未付款', pending_credit: '账期待结', pending_refund: '退款处理中', refunded: '已退款', all: '全部' } as Record<string, string>)[orderPaymentFilter]} ×</button>}
                  {orderDeliveryFilter !== 'all' && <button type="button" onClick={() => setOrderDeliveryFilter('all')} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-neutral-700">{orderDeliveryFilter === 'shipping' ? '配送发货' : '展厅自提'} ×</button>}
                  <button type="button" onClick={() => { setOrderSearch(''); setOrderStatusFilter('all'); setOrderPaymentFilter('all'); setOrderDeliveryFilter('all'); }} className="text-[10px] font-semibold text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900">清除筛选</button>
                </div>
              )}
              {selectedVisibleOrderCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                  <span className="text-xs font-semibold text-neutral-700">当前筛选中已选择 {selectedVisibleOrderCount} 笔订单</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => {
                      const selected = visibleMerchantOrders.filter(order => selectedOrderIds.includes(order.id));
                      if (!selected.length) return;
                      const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
                      const rows = selected.map(order => `<tr><td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.date)}</td><td>${escapeHtml(order.companyName)}</td><td>${order.totalQty}</td><td>€${order.totalAmount.toFixed(2)}</td><td>${escapeHtml(order.status)}</td></tr>`).join('');
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) {
                        addNotification('warning', '无法打开打印窗口', '请允许此网站打开弹出窗口后重试');
                        return;
                      }
                      printWindow.opener = null;
                      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>订单清单</title><style>body{font:13px Arial,sans-serif;margin:28px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><button onclick="window.print()">打印 / 保存 PDF</button><h1>订单清单</h1><table><thead><tr><th>订单号</th><th>日期</th><th>客户</th><th>件数</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
                      printWindow.document.close();
                    }} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100">打印订单清单</button>
                    <button type="button" onClick={() => setSelectedOrderIds([])} className="rounded-lg px-2 py-1.5 text-[11px] text-neutral-500 hover:bg-white">取消选择</button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
                <thead className="bg-neutral-50 text-[10px] font-semibold text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="选择当前页订单"
                        checked={paginatedMerchantOrders.length > 0 && paginatedMerchantOrders.every(order => selectedOrderIds.includes(order.id))}
                        onChange={event => {
                          const pageOrderIds = paginatedMerchantOrders.map(order => order.id);
                          setSelectedOrderIds(current => event.target.checked
                            ? [...new Set([...current, ...pageOrderIds])]
                            : current.filter(id => !pageOrderIds.includes(id)));
                        }}
                        className="accent-neutral-900"
                      />
                    </th>
                    <th className="px-3 py-3">客户</th>
                    <th className="px-3 py-3">商品</th>
                    <th className="px-3 py-3">金额</th>
                    <th className="px-3 py-3">当前状态</th>
                    <th className="px-3 py-3">待办</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginatedMerchantOrders.map(order => {
                    const statusLabel = ({ placed: '待确认', pending: '待处理', confirmed: '已确认', picking: '配货中', shipped: '已发货', delivered: '已送达', return_requested: '退货申请', returned: '已退货', cancelled: '已取消' } as Record<string, string>)[order.status] || order.status;
                    const customer = merchantCustomers.find(candidate => candidate.id === order.customerId);
                    const productNames = [...new Set(order.items.map(item => item.productName || item.styleNo).filter(Boolean))];
                    const paymentLabel = order.paymentStatus === 'paid'
                      ? '已付'
                      : order.paymentStatus === 'partially_paid' || order.paymentStatus === 'partially_refunded' || (order.paidAmount || 0) > 0
                        ? '部分'
                        : '未付';
                    return (
                      <tr key={order.id} className="group transition-colors hover:bg-neutral-50/80">
                        <td className="px-4 py-3.5">
                          <input aria-label={`选择订单 ${order.orderNo}`} type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={event => setSelectedOrderIds(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))} className="accent-neutral-900" />
                        </td>
                        <td className="max-w-48 px-3 py-3.5">
                          <button type="button" onClick={() => openOrderDetail(order.id)} className="block max-w-full truncate text-left font-medium text-neutral-800 hover:text-neutral-950">{order.companyName}</button>
                          <span className="mt-1 block truncate text-[10px] text-neutral-500">{customer?.country || order.shippingAddress?.country || '—'}</span>
                        </td>
                        <td className="max-w-64 px-3 py-3.5">
                          <span className="block truncate text-neutral-800">{productNames.slice(0, 2).join('、') || '—'}{productNames.length > 2 ? ` 等 ${productNames.length} 款` : ''}</span>
                          <span className="mt-1 block whitespace-nowrap text-[10px] text-neutral-500">{order.totalQty} 件 · {new Set(order.items.map(item => item.sku).filter(Boolean)).size} 个规格</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5">
                          <span className="font-semibold tabular-nums text-neutral-900">€{order.totalAmount.toFixed(2)}</span>
                          <span className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${paymentLabel === '已付' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-950 text-white'}`}>{paymentLabel}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${['shipped', 'delivered', 'cancelled', 'returned'].includes(order.status) ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-950 text-white'}`}>{statusLabel}</span>
                        </td>
                        <td className="max-w-56 px-3 py-3.5">
                          <button type="button" onClick={() => openOrderDetail(order.id)} className="flex max-w-full items-center gap-2 text-left text-[11px] font-medium text-neutral-700 hover:text-neutral-950">
                            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{order.currentTasks?.merchant.task || '查看订单记录'}</span>
                          </button>
                          {order.hasLogisticsException && <span className="mt-1 block text-[10px] font-semibold text-neutral-600">物流异常待处理</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {renderOrderActionMenu(order)}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedMerchantOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-xs text-neutral-500">{nonDemoMerchantOrders.length ? '暂无匹配订单' : '暂无订单'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 border-t border-neutral-100 bg-neutral-50/50 p-3 sm:hidden">
              {paginatedMerchantOrders.map(order => {
                const customer = merchantCustomers.find(candidate => candidate.id === order.customerId);
                const productNames = [...new Set(order.items.map(item => item.productName || item.styleNo).filter(Boolean))];
                const paymentLabel = order.paymentStatus === 'paid'
                  ? '已付'
                  : order.paymentStatus === 'partially_paid' || order.paymentStatus === 'partially_refunded' || (order.paidAmount || 0) > 0
                    ? '部分'
                    : '未付';
                return (
                  <article key={order.id} className="merchant-order-mobile-card rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-start gap-2">
                        <input aria-label={`选择订单 ${order.orderNo}`} type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={event => setSelectedOrderIds(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))} className="mt-1 accent-neutral-900" />
                        <span className="min-w-0">
                          <button type="button" onClick={() => openOrderDetail(order.id)} className="block truncate text-left text-sm font-semibold text-neutral-900">{order.companyName}</button>
                          <span className="mt-1 block truncate text-[10px] text-neutral-500">{customer?.country || order.shippingAddress?.country || '—'}</span>
                        </span>
                      </label>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${['shipped', 'delivered', 'cancelled', 'returned'].includes(order.status) ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-950 text-white'}`}>
                        {({ placed: '待确认', pending: '待处理', confirmed: '已确认', picking: '配货中', shipped: '已发货', delivered: '已送达', return_requested: '退货申请', returned: '已退货', cancelled: '已取消' } as Record<string, string>)[order.status] || order.status}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-xs text-neutral-800">{productNames.slice(0, 2).join('、') || '—'}{productNames.length > 2 ? ` 等 ${productNames.length} 款` : ''}</p>
                    <p className="mt-1 text-[10px] text-neutral-500">{order.totalQty} 件 · {new Set(order.items.map(item => item.sku).filter(Boolean)).size} 个规格</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <strong className="text-sm font-semibold tabular-nums text-neutral-900">€{order.totalAmount.toFixed(2)}</strong>
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${paymentLabel === '已付' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-950 text-white'}`}>{paymentLabel}</span>
                      </div>
                      {renderOrderActionMenu(order)}
                    </div>
                    <button type="button" onClick={() => openOrderDetail(order.id)} className="mt-3 flex w-full items-center gap-2 border-t border-neutral-100 pt-3 text-left text-[11px] font-medium text-neutral-700">
                      <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{order.currentTasks?.merchant.task || '查看订单记录'}</span>
                      {order.hasLogisticsException && <span className="shrink-0 font-semibold">物流异常</span>}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
                <span>显示 {visibleMerchantOrders.length ? (currentOrderPage - 1) * orderPageSize + 1 : 0}–{Math.min(currentOrderPage * orderPageSize, visibleMerchantOrders.length)} / {visibleMerchantOrders.length} 笔</span>
                <label className="inline-flex items-center gap-1.5">
                  每页
                  <select aria-label="每页订单数量" value={orderPageSize} onChange={event => { setOrderPageSize(Number(event.target.value)); setOrderPage(1); }} className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-700">
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  笔
                </label>
              </div>
              <nav aria-label="订单分页" className="flex items-center gap-1 self-end sm:self-auto">
                <button type="button" disabled={currentOrderPage <= 1} onClick={() => setOrderPage(page => Math.max(1, page - 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">上一页</button>
                <span aria-live="polite" className="min-w-16 text-center text-[10px] font-semibold text-neutral-600">{currentOrderPage} / {orderPageCount}</span>
                <button type="button" disabled={currentOrderPage >= orderPageCount} onClick={() => setOrderPage(page => Math.min(orderPageCount, page + 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">下一页</button>
              </nav>
            </div>
          </div>
          ) : (
            <>
            <MerchantAiOrderDrafts
              customers={merchantCustomers.map(customer => ({ id: customer.id, companyName: customer.companyName, status: customer.status }))}
              onQuoteCreated={() => setMerchantQuotesRefresh(value => value + 1)}
            />
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
              <div className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
                客户通过链接确认后转为订单。
              </div>
              {merchantQuotesLoading ? (
                <div role="status" className="px-4 py-12 text-center text-xs text-neutral-500">正在读取草稿订单…</div>
              ) : merchantQuotes.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left text-xs">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-semibold text-neutral-500">
                      <tr><th className="px-4 py-3">报价 / 创建时间</th><th className="px-4 py-3">客户</th><th className="px-4 py-3">商品</th><th className="px-4 py-3">件数</th><th className="px-4 py-3">金额</th><th className="px-4 py-3">状态 / 有效期</th><th className="px-4 py-3 text-right">操作</th></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {merchantQuotes.map(quote => {
                        const quoteCustomer = merchantCustomers.find(customer => customer.id === quote.customerId);
                        const expired = quote.validUntil ? new Date(quote.validUntil).getTime() < Date.now() && ['draft', 'sent'].includes(quote.status) : false;
                        const statusLabel = expired ? '已过期' : ({ draft: '草稿', sent: '已发送', accepted: '客户已确认', rejected: '客户已拒绝', expired: '已过期', converted: '已转为订单' } as Record<string, string>)[quote.status] || quote.status;
                        return (
                          <tr key={quote.id} className="hover:bg-neutral-50/70">
                            <td className="px-4 py-3"><strong className="text-neutral-900">{quote.quoteNo}</strong><span className="mt-1 block text-[10px] text-neutral-500">{new Date(quote.createdAt).toLocaleString(getIntlLocale(lang), { dateStyle: 'medium', timeStyle: 'short' })}</span></td>
                            <td className="px-4 py-3"><strong className="text-neutral-800">{quoteCustomer?.companyName || '客户档案不可用'}</strong>{quoteCustomer?.contactPerson && <span className="mt-1 block text-[10px] text-neutral-500">{quoteCustomer.contactPerson}</span>}</td>
                            <td className="max-w-56 px-4 py-3"><span className="block truncate text-neutral-800">{quote.items.slice(0, 2).map(item => item.productName).join('、')}{quote.items.length > 2 ? ` 等 ${quote.items.length} 款` : ''}</span><span className="mt-1 block text-[10px] text-neutral-500">{quote.items.length} 款商品</span></td>
                            <td className="px-4 py-3 font-semibold tabular-nums text-neutral-800">{quote.totalQty}</td>
                            <td className="px-4 py-3 font-semibold tabular-nums text-neutral-900">€{quote.totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${quote.status === 'converted' ? 'bg-emerald-50 text-emerald-700' : expired ? 'bg-neutral-100 text-neutral-600' : 'bg-amber-50 text-amber-700'}`}>{statusLabel}</span><span className="mt-1 block text-[10px] text-neutral-500">{quote.validUntil ? `有效至 ${new Date(quote.validUntil).toLocaleDateString(getIntlLocale(lang))}` : '未设置有效期'}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {quote.shareUrl && <button type="button" onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(quote.shareUrl);
                                    addNotification('success', '报价链接已复制', `${quote.quoteNo} 的客户确认链接已复制`);
                                  } catch (error) {
                                    addNotification('warning', '报价链接复制失败', error instanceof Error ? error.message : '请检查浏览器剪贴板权限');
                                  }
                                }} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-white">复制客户链接</button>}
                                <button type="button" onClick={() => window.open(`/api/merchant/quotes/${encodeURIComponent(quote.id)}/print`, '_blank', 'noopener,noreferrer')} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-white">打印报价</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-14 text-center">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-3 text-sm font-semibold text-neutral-700">还没有草稿订单</p>
                </div>
              )}
            </div>
            </>
          )}

          {assistedOrderOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/50 p-3 backdrop-blur-sm sm:p-6">
              <form onSubmit={async event => {
                event.preventDefault();
                if (assistedOrderBusy) return;
                setAssistedOrderBusy(true);
                try {
                  const customer = merchantCustomers.find(candidate => candidate.id === assistedOrderCustomerId && candidate.status === 'approved');
                  if (!customer) throw new Error('请选择已审核客户');
                  if (!assistedOrderItems.length) throw new Error('请至少添加一项商品');
                  const skuQuantities = new Map<string, { productId: string; sku: string; quantity: number }>();
                  for (const line of assistedOrderItems) {
                    const product = merchantProducts.find(candidate => candidate.id === line.productId && candidate.lifecycleStatus === 'published');
                    const sku = product?.skus.find(candidate => candidate.sku === line.sku && candidate.isActive !== false);
                    const quantity = Number(line.quantity);
                    if (!product || !sku) throw new Error('请选择有效的商品和 SKU');
                    if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`${product.styleNo} 数量必须为正整数`);
                    const key = `${product.id}:${sku.sku}`;
                    const existing = skuQuantities.get(key);
                    skuQuantities.set(key, { productId: product.id, sku: sku.sku, quantity: (existing?.quantity || 0) + quantity });
                  }
                  const orderItems = [...skuQuantities.values()];
                  const quantityByProduct = new Map<string, number>();
                  for (const item of orderItems) quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
                  for (const [productId, quantity] of quantityByProduct) {
                    const product = merchantProducts.find(candidate => candidate.id === productId && candidate.lifecycleStatus === 'published');
                    if (!product) throw new Error('请选择有效的已发布商品');
                    if (quantity < product.moq || quantity % Math.max(1, product.packSize) !== 0) {
                      throw new Error(`${product.styleNo} 总数量需不少于 MOQ，且为 ${product.packSize} 件/箱的整数倍`);
                    }
                  }
                  const result = await apiPost<{
                    success: true;
                    order: { id: string; orderNo: string; totalAmount: number };
                    agreement: { status: string };
                  }>('/api/merchant/orders/assisted-create', {
                    customerId: customer.id,
                    items: orderItems,
                    shippingAddress: assistedOrderAddress,
                    shippingFee: Number(assistedOrderShippingFee),
                    discountAmount: 0,
                    idempotencyKey: assistedOrderIdempotencyKey
                  });
                  setAssistedOrderOpen(false);
                  setAssistedOrderItems([]);
                  addNotification('success', '正式订单已创建', `${result.order.orderNo} · 等待客户确认约定`);
                  try {
                    const refreshed = await apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders');
                    setServerOrders(refreshed.orders);
                  } catch (error) {
                    console.error('[merchant-assisted-order-refresh]', error);
                    addNotification('warning', '订单已创建，列表刷新失败', '请刷新订单页查看新订单');
                  }
                } catch (error) {
                  addNotification('warning', '开单失败', error instanceof Error ? error.message : '请检查客户、商品和收货信息');
                } finally {
                  setAssistedOrderBusy(false);
                }
              }} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                  <h3 className="text-lg font-bold text-neutral-950">开单</h3>
                  <button type="button" aria-label="关闭" disabled={assistedOrderBusy} onClick={() => setAssistedOrderOpen(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
                </div>
                <label className="mt-4 block text-xs font-semibold text-neutral-700">客户
                  <select required value={assistedOrderCustomerId} onChange={event => {
                    const customerId = event.target.value;
                    const customer = merchantCustomers.find(candidate => candidate.id === customerId);
                    setAssistedOrderCustomerId(customerId);
                    setAssistedOrderAddress({
                      street: customer?.address || '',
                      city: customer?.city || '',
                      country: customer?.country || '',
                      zip: '',
                      recipient: customer?.contactPerson || '',
                      phone: customer?.phone || ''
                    });
                  }} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-500">
                    <option value="">{assistedOrderCustomers.length ? '选择已审核客户' : '暂无已审核客户'}</option>
                    {assistedOrderCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.companyName} · {customer.contactPerson}</option>)}
                  </select>
                </label>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-800">商品清单</h4>
                    <button type="button" disabled={!assistedOrderProducts.length} onClick={() => {
                      const product = assistedOrderProducts[0];
                      const sku = product?.skus.find(candidate => candidate.isActive !== false);
                      if (product && sku) {
                        const packSize = Math.max(1, product.packSize);
                        const quantity = Math.ceil(product.moq / packSize) * packSize;
                        setAssistedOrderItems(current => [...current, { productId: product.id, sku: sku.sku, quantity: String(quantity) }]);
                      }
                    }} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"><Plus className="h-3 w-3" />添加商品</button>
                  </div>
                  <div className="space-y-2">
                    {assistedOrderItems.map((line, index) => {
                      const product = merchantProducts.find(candidate => candidate.id === line.productId);
                      const customer = merchantCustomers.find(candidate => candidate.id === assistedOrderCustomerId);
                      const quantity = Number(line.quantity);
                      const productQuantity = assistedOrderItems.filter(item => item.productId === line.productId).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                      const basePrice = product ? getProductWholesalePriceForQuantity(
                        product.wholesalePrice,
                        product.wholesalePrice100,
                        Number.isInteger(productQuantity) && productQuantity > 0 ? productQuantity : 0,
                        product.bulkPriceMinimumQuantity
                      ) : 0;
                      const unitPrice = Number((basePrice * (customer?.discountRate ?? 1)).toFixed(2));
                      return (
                        <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_32px] sm:items-end">
                          <label className="text-[10px] font-semibold text-neutral-600">商品
                            <select required value={line.productId} onChange={event => {
                              const nextProduct = merchantProducts.find(candidate => candidate.id === event.target.value && candidate.lifecycleStatus === 'published');
                              const nextSku = nextProduct?.skus.find(candidate => candidate.isActive !== false);
                              const nextPackSize = Math.max(1, nextProduct?.packSize || 1);
                              setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? {
                                productId: nextProduct?.id || '',
                                sku: nextSku?.sku || '',
                                quantity: nextProduct ? String(Math.ceil(nextProduct.moq / nextPackSize) * nextPackSize) : ''
                              } : item));
                            }} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal">
                              {merchantProducts.filter(candidate => candidate.lifecycleStatus === 'published' && candidate.skus.some(sku => sku.isActive !== false)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.styleNo} · {candidate.name}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-neutral-600">颜色 / 尺码
                            <select required value={line.sku} onChange={event => setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal">
                              {(product?.skus || []).filter(sku => sku.isActive !== false).map(sku => <option key={sku.sku} value={sku.sku}>{sku.color} / {sku.size}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-neutral-600">数量
                            <input required type="number" min="1" step="1" value={line.quantity} onChange={event => setAssistedOrderItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-normal" />
                          </label>
                          <button type="button" aria-label="移除商品" onClick={() => setAssistedOrderItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><Trash2 className="h-4 w-4" /></button>
                          <p className="text-[10px] text-neutral-500 sm:col-span-4">单价 €{unitPrice.toFixed(2)} · 小计 €{(unitPrice * (Number.isFinite(quantity) ? quantity : 0)).toFixed(2)} · 本款合计 {productQuantity} 件（MOQ {product?.moq || 0} / 箱规 {product?.packSize || 1}）</p>
                        </div>
                      );
                    })}
                    {!assistedOrderItems.length && <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">{assistedOrderProducts.length ? '添加商品和 SKU' : '暂无已发布商品或可用 SKU'}</p>}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-neutral-700 sm:col-span-2">收货地址
                    <input required maxLength={240} value={assistedOrderAddress.street} onChange={event => setAssistedOrderAddress(current => ({ ...current, street: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" placeholder="街道地址" />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700">城市
                    <input required maxLength={100} value={assistedOrderAddress.city} onChange={event => setAssistedOrderAddress(current => ({ ...current, city: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700">国家/地区
                    <input required maxLength={100} value={assistedOrderAddress.country} onChange={event => setAssistedOrderAddress(current => ({ ...current, country: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700 sm:col-span-2">邮编
                    <input maxLength={30} value={assistedOrderAddress.zip} onChange={event => setAssistedOrderAddress(current => ({ ...current, zip: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal sm:max-w-xs" />
                  </label>
                  <label className="text-xs font-semibold text-neutral-700">运费（€）
                    <input required type="number" min="0" max="1000000" step="0.01" value={assistedOrderShippingFee} onChange={event => setAssistedOrderShippingFee(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-normal sm:max-w-xs" />
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-neutral-950">订单合计 €{(assistedOrderItems.reduce((sum, line) => {
                      const product = merchantProducts.find(candidate => candidate.id === line.productId);
                      const customer = merchantCustomers.find(candidate => candidate.id === assistedOrderCustomerId);
                      const quantity = Number(line.quantity);
                      if (!product || !Number.isFinite(quantity)) return sum;
                      const productQuantity = assistedOrderItems.filter(item => item.productId === line.productId).reduce((productSum, item) => productSum + (Number(item.quantity) || 0), 0);
                      const unitPrice = Number((getProductWholesalePriceForQuantity(product.wholesalePrice, product.wholesalePrice100, productQuantity, product.bulkPriceMinimumQuantity) * (customer?.discountRate ?? 1)).toFixed(2));
                      return sum + unitPrice * quantity;
                    }, 0) + (Number(assistedOrderShippingFee) || 0)).toFixed(2)}</p>
                    <p className="mt-1 text-[10px] text-neutral-500">提交后进入现有订单链，等待客户确认约定</p>
                  </div>
                  <button type="submit" disabled={assistedOrderBusy || !assistedOrderCustomers.length || !assistedOrderProducts.length} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">{assistedOrderBusy ? '提交中…' : '确认并创建订单'}</button>
                </div>
              </form>
            </div>
          )}

          {draftQuoteOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/50 p-3 backdrop-blur-sm sm:p-6">
              <form onSubmit={async event => {
                event.preventDefault();
                if (draftQuoteBusy) return;
                setDraftQuoteBusy(true);
                try {
                  const quoteItems = draftQuoteItems.map(item => {
                    const product = merchantProducts.find(candidate => candidate.id === item.productId);
                    const sku = product?.skus.find(candidate => candidate.sku === item.sku);
                    if (!product || !sku) throw new Error('请选择有效的商品和 SKU');
                    if (!Number.isInteger(item.quantity) || item.quantity < product.moq || item.quantity % Math.max(1, product.packSize) !== 0) {
                      throw new Error(`${product.styleNo} 数量需不少于 MOQ，且为 ${product.packSize} 件/箱的整数倍`);
                    }
                    return { productId: product.id, sku: sku.sku, quantity: item.quantity, color: sku.color, size: sku.size };
                  });
                  if (!quoteItems.length) throw new Error('请至少添加一项商品');
                  if (!draftQuoteCustomerId) throw new Error('请选择已审核客户');
                  const result = await apiPost<{
                    success: true;
                    quote: {
                      id: string; quoteNo: string; customerId: string; status: string; validUntil: string | null;
                      totalQty: number; totalAmount: number; notes: string | null; createdAt: string;
                      items: Array<{ id: string; productId: string; sku: string; styleNo: string; productName: string; color: string; size: string; quantity: number; unitPrice: number }>;
                    };
                    shareUrl: string;
                  }>('/api/merchant/quotes', { customerId: draftQuoteCustomerId, items: quoteItems, notes: draftQuoteNotes.trim() });
                  const nextQuote = {
                    ...result.quote,
                    totalAmount: Number(result.quote.totalAmount),
                    items: result.quote.items.map(item => ({ ...item, unitPrice: Number(item.unitPrice) })),
                    shareUrl: result.shareUrl
                  };
                  setMerchantQuotes(current => [nextQuote, ...current.filter(quote => quote.id !== nextQuote.id)]);
                  setDraftQuoteOpen(false);
                  setDraftQuoteItems([]);
                  addNotification('success', '草稿报价已创建', `${nextQuote.quoteNo} · 有效期 7 天`);
                  try {
                    await navigator.clipboard.writeText(result.shareUrl);
                    addNotification('success', '客户确认链接已复制', '可发送给客户查看并确认报价');
                  } catch {
                    addNotification('info', '请从草稿列表复制链接', '报价已创建，浏览器未授予剪贴板权限');
                  }
                } catch (error) {
                  addNotification('warning', '草稿订单创建失败', error instanceof Error ? error.message : '请检查客户和商品信息');
                } finally {
                  setDraftQuoteBusy(false);
                }
              }} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                  <div><h3 className="text-lg font-bold text-neutral-950">新建草稿订单</h3><div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500"><span>生成确认链接</span><span>客户确认转订单</span></div></div>
                  <button type="button" aria-label="关闭" onClick={() => setDraftQuoteOpen(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
                </div>
                <label className="mt-4 block text-xs font-semibold text-neutral-700">已审核客户
                  <select required value={draftQuoteCustomerId} onChange={event => setDraftQuoteCustomerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-500">
                    <option value="">选择客户</option>
                    {merchantCustomers.filter(customer => customer.status === 'approved').map(customer => <option key={customer.id} value={customer.id}>{customer.companyName} · {customer.contactPerson}</option>)}
                  </select>
                </label>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-bold text-neutral-800">商品清单</h4><button type="button" disabled={!merchantProducts.some(product => product.lifecycleStatus === 'published')} onClick={() => {
                    const product = merchantProducts.find(candidate => candidate.lifecycleStatus === 'published');
                    if (product) setDraftQuoteItems(current => [...current, { productId: product.id, sku: product.skus[0]?.sku || '', quantity: Math.ceil(product.moq / Math.max(1, product.packSize)) * Math.max(1, product.packSize) }]);
                  }} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"><Plus className="h-3 w-3" />添加商品</button></div>
                  <div className="space-y-2">
                    {draftQuoteItems.map((line, index) => {
                      const product = merchantProducts.find(candidate => candidate.id === line.productId);
                      return (
                        <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_100px_32px] sm:items-end">
                          <label className="text-[10px] font-semibold text-neutral-600">商品
                            <select value={line.productId} onChange={event => {
                              const nextProduct = merchantProducts.find(candidate => candidate.id === event.target.value);
                              setDraftQuoteItems(current => current.map((item, itemIndex) => itemIndex === index ? {
                                productId: nextProduct?.id || '',
                                sku: nextProduct?.skus[0]?.sku || '',
                                quantity: nextProduct ? Math.ceil(nextProduct.moq / Math.max(1, nextProduct.packSize)) * Math.max(1, nextProduct.packSize) : 1
                              } : item));
                            }} className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal">
                              <option value="">选择商品</option>
                              {merchantProducts.filter(item => item.lifecycleStatus === 'published').map(item => <option key={item.id} value={item.id}>{item.styleNo} · {item.name}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-neutral-600">SKU / 颜色 / 尺码
                            <select value={line.sku} onChange={event => setDraftQuoteItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal">
                              <option value="">选择 SKU</option>
                              {product?.skus.map(sku => <option key={sku.sku} value={sku.sku}>{sku.sku} · {sku.color} / {sku.size}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-neutral-600">数量（件）
                            <input type="number" min={product?.moq || 1} step={product?.packSize || 1} value={line.quantity} onChange={event => setDraftQuoteItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} className="mt-1 block w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-normal" />
                          </label>
                          <button type="button" aria-label="移除商品" disabled={draftQuoteItems.length === 1} onClick={() => setDraftQuoteItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><X className="h-4 w-4" /></button>
                        </div>
                      );
                    })}
                    {!draftQuoteItems.length && <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">添加已上架商品</p>}
                  </div>
                </div>
                <label className="mt-4 block text-xs font-semibold text-neutral-700">给客户的报价备注（选填）
                  <textarea value={draftQuoteNotes} maxLength={2000} onChange={event => setDraftQuoteNotes(event.target.value)} rows={3} className="mt-1.5 block w-full resize-y rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-500" placeholder="交付、包装或报价相关说明" />
                </label>
                {!merchantCustomers.some(customer => customer.status === 'approved') && <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800"><span>暂无已审核客户</span><span>审核后可报价</span></div>}
                <div className="mt-5 flex justify-end gap-2 border-t border-neutral-100 pt-4">
                  <button type="button" onClick={() => setDraftQuoteOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">取消</button>
                  <button type="submit" disabled={draftQuoteBusy || !draftQuoteCustomerId || !draftQuoteItems.length || !merchantCustomers.some(customer => customer.status === 'approved')} className="rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-40">{draftQuoteBusy ? '创建中…' : '创建并复制确认链接'}</button>
                </div>
              </form>
            </div>
          )}
        </section>
      ))}

      {selectedOrderDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/35 p-2 backdrop-blur-[2px] sm:p-5 lg:p-8" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeOrderDetail();
        }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="merchant-order-detail-title" className="flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-2xl bg-neutral-50 shadow-2xl md:h-[90vh] md:max-h-[92vh] md:w-[90vw] md:max-w-[1440px]">
            <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" aria-label="关闭订单详情" onClick={closeOrderDetail} className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50"><X className="h-4 w-4" /></button>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">订单详情</p>
                  <h2 id="merchant-order-detail-title" className="truncate text-base font-bold text-neutral-950">{selectedOrderDetail.orderNo}</h2>
                </div>
                  {selectedOrderDetailIsDemo && <span className="shrink-0 rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold text-neutral-700">演示数据</span>}
                  <span className="hidden truncate text-xs text-neutral-500 sm:inline">{selectedOrderDetail.companyName} · {selectedOrderDetail.totalQty} 件 · €{selectedOrderDetail.totalAmount.toFixed(2)}</span>
                <span className="hidden rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-700 sm:inline-flex">{selectedOrderDetail.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const currentIndex = merchantOrders.findIndex(order => order.id === selectedOrderDetail.id);
                  const previousOrder = currentIndex > 0 ? merchantOrders[currentIndex - 1] : undefined;
                  const nextOrder = currentIndex >= 0 && currentIndex < merchantOrders.length - 1 ? merchantOrders[currentIndex + 1] : undefined;
                  return (
                    <>
                      <button type="button" disabled={!previousOrder} onClick={() => previousOrder && setSelectedOrderDetailId(previousOrder.id)} aria-label="上一笔订单" className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">←</button>
                      <button type="button" disabled={!nextOrder} onClick={() => nextOrder && setSelectedOrderDetailId(nextOrder.id)} aria-label="下一笔订单" className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">→</button>
                    </>
                  );
                })()}
                {!selectedOrderDetailIsDemo && <button type="button" onClick={() => window.open(`/api/merchant/orders/${encodeURIComponent(selectedOrderDetail.id)}/print?document=invoice`, '_blank', 'noopener,noreferrer')} className="hidden rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 sm:inline-flex">打印订单</button>}
              </div>
            </header>

            {selectedOrderDetailIsDemo && (
              <div role="status" className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5 text-xs font-medium text-neutral-700 sm:px-6">
                演示数据：非真实客户订单。此订单不会触发付款、履约、发货或客户消息。
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 lg:overflow-hidden">
              <div className="mx-auto grid w-full gap-4 lg:h-full lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:gap-5">
                <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                  <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:p-5">
                    <OrderProgressSummary order={selectedOrderDetail} compact role="merchant" />
                    {selectedOrderDetail.agreementVersions?.slice(-1).map(agreement => (
                      <div key={agreement.id} className="mt-3 rounded-lg bg-neutral-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-neutral-800">
                          交易约定 v{agreement.version} · {agreement.status === 'pending_merchant'
                            ? '待商家确认'
                            : agreement.status === 'pending_buyer'
                              ? '待客户确认'
                              : agreement.status === 'active' ? '双方已确认' : '历史版本'}
                        </p>
                        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
                          {agreement.terms.paymentPlan === 'partial_prepayment'
                            ? `预付 €${agreement.terms.prepaymentAmount.toFixed(2)} · 余款按约定触发`
                            : agreement.terms.paymentPlan === 'ship_before_payment'
                              ? '先发货后付款'
                              : agreement.terms.paymentPlan === 'cash_on_delivery'
                                ? '送达时付款'
                                : agreement.terms.paymentPlan === 'custom'
                                  ? agreement.terms.customPaymentCondition || '自定义付款条件'
                                  : '全额预付'}
                          {' · '}订单金额 €{agreement.terms.totalAmount.toFixed(2)}
                        </p>
                        <details className="mt-2 text-[10px] text-neutral-600">
                          <summary className="cursor-pointer font-semibold text-neutral-700">查看本版本约定内容</summary>
                          <div className="mt-2 space-y-1 rounded-lg border border-neutral-200 bg-white p-3">
                            <p>运费 €{agreement.terms.shippingFee.toFixed(2)} · 折扣 €{agreement.terms.discountAmount.toFixed(2)} · 供货方式 {agreement.terms.supplyMode}</p>
                            <p>付款方式 {agreement.terms.paymentMethod} · 预付款 €{agreement.terms.prepaymentAmount.toFixed(2)} · 余款条件 {agreement.terms.customPaymentCondition || agreement.terms.remainingBalanceTrigger}</p>
                            <p>预计交期：{agreement.terms.expectedDeliveryAt ? new Date(agreement.terms.expectedDeliveryAt).toLocaleDateString() : '待确认'}</p>
                            <p>收货地址：{[
                              agreement.terms.shippingAddress.street,
                              agreement.terms.shippingAddress.city,
                              agreement.terms.shippingAddress.country,
                              agreement.terms.shippingAddress.zip
                            ].filter(Boolean).join(', ') || '未填写'}</p>
                            <div className="divide-y divide-neutral-100">
                              {agreement.terms.items.map(item => {
                                const orderItem = selectedOrderDetail.items.find(candidate => candidate.id === item.orderItemId);
                                return (
                                  <p key={item.orderItemId} className="py-1">
                                    {orderItem ? `${orderItem.productName} · ${orderItem.sku}` : item.orderItemId}
                                    {' · '}{item.quantity} × €{item.unitPrice.toFixed(2)}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-neutral-500">订单状态</p>
                        <p className="mt-1 text-base font-bold text-neutral-900">{({ placed: '待确认', pending: '待处理', confirmed: '已确认', picking: '配货中', shipped: '已发货', delivered: '已送达', return_requested: '退货申请中', returned: '已退货', cancelled: '已取消' } as Record<string, string>)[selectedOrderDetail.status] || selectedOrderDetail.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-500">付款状态</p>
                        <p className="mt-1 text-sm font-semibold text-neutral-800">{({ paid: '已付款', partially_refunded: '部分退款', unpaid: '未付款', pending_credit: '账期待结', pending_refund: '退款处理中', refunded: '已退款' } as Record<string, string>)[selectedOrderDetail.paymentStatus] || selectedOrderDetail.paymentStatus}</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900">当前任务</p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600">
                            {selectedOrderDetail.agreementVersions?.slice(-1)[0]?.status === 'pending_buyer'
                              ? '等待客户确认本版本；确认前不触发付款或发货。'
                              : selectedOrderDetail.status === 'placed' || selectedOrderDetail.status === 'pending'
                              ? '核对采购内容和交易约定；确认同一版本后订单才继续。'
                              : selectedOrderDetail.status === 'confirmed' && selectedOrderDetail.paymentStatus !== 'paid' && selectedOrderDetail.paymentStatus !== 'pending_credit'
                                ? ['bank_transfer', 'bank_transfer_prepay'].includes(selectedOrderDetail.paymentMethod) && selectedOrderDetail.paymentStatus === 'pending'
                                  ? '买家已登记转账。核对实际到账后再确认收款。'
                                  : selectedOrderDetail.canBeginPreparation
                                    ? '按已确认约定开始备货。'
                                    : '等待约定要求的预付款到账。'
                                : selectedOrderDetail.status === 'confirmed'
                                  ? '按已确认约定开始准备本单商品。'
                                  : selectedOrderDetail.status === 'picking'
                                    ? '按实际可发商品分批创建包裹，填写真实承运商和运单号。'
                                    : selectedOrderDetail.status === 'shipped'
                                      ? '查看各包裹的物流记录；仅使用承运商或平台已记录的信息。'
                                      : selectedOrderDetail.status === 'delivered'
                                        ? '订单已送达，可查看记录或处理售后。'
                                        : selectedOrderDetail.status === 'cancelled'
                                          ? '订单已取消。'
                                          : '查看订单处理记录。'}
                          </p>
                          {selectedOrderDetail.bankTransferReference && selectedOrderDetail.paymentStatus === 'pending' && (
                            <p className="mt-2 break-all text-[11px] text-amber-800">
                              银行转账参考号：<strong className="font-mono">{selectedOrderDetail.bankTransferReference}</strong>
                            </p>
                          )}
                        </div>
                        {!selectedOrderDetailIsDemo && (selectedOrderDetail.status === 'placed' || selectedOrderDetail.status === 'pending')
                          && selectedOrderDetail.agreementVersions?.slice(-1)[0]?.status !== 'pending_buyer' && (
                          <button type="button" onClick={() => openOrderFulfillment(selectedOrderDetail)} className="w-full shrink-0 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto">
                            {selectedOrderDetail.agreementVersions?.slice(-1)[0]?.status === 'pending_merchant' ? '确认当前约定' : '审核并接受订单'}
                          </button>
                        )}
                        {!selectedOrderDetailIsDemo && selectedOrderDetail.status === 'confirmed' && selectedOrderDetail.paymentStatus === 'pending'
                          && ['bank_transfer', 'bank_transfer_prepay'].includes(selectedOrderDetail.paymentMethod)
                          && selectedOrderDetail.bankTransferReference && (
                            <button type="button" onClick={() => void handleConfirmBankTransfer(selectedOrderDetail)} className="w-full shrink-0 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto">
                              核实到账并确认收款
                            </button>
                          )}
                        {!selectedOrderDetailIsDemo && selectedOrderDetail.status === 'confirmed'
                          && selectedOrderDetail.canBeginPreparation && (
                            <button type="button" onClick={() => openOrderFulfillment(selectedOrderDetail)} className="w-full shrink-0 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto">
                              开始备货
                            </button>
                          )}
                        {!selectedOrderDetailIsDemo && selectedOrderDetail.status === 'picking' && selectedOrderDetail.canShipOrder && (
                          <button type="button" onClick={() => openOrderFulfillment(selectedOrderDetail)} className="w-full shrink-0 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto">
                            创建 / 管理包裹
                          </button>
                        )}
                        {!selectedOrderDetailIsDemo && selectedOrderDetail.currentTasks?.merchant.action === 'trigger_balance' && (
                          <button type="button" onClick={() => void handleTriggerCustomBalance(selectedOrderDetail)} className="w-full shrink-0 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto">
                            核实余款条件
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 sm:px-5">
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900">商品明细</h3>
                        <p className="mt-0.5 text-[10px] text-neutral-500">{selectedOrderDetail.items.length} 款 · 共 {selectedOrderDetail.totalQty} 件</p>
                      </div>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {selectedOrderDetail.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                          <img src={merchantMediaUrl(item.image, DEFAULT_MERCHANT_BANNER)} alt="" className="h-14 w-11 shrink-0 rounded-md bg-neutral-100 object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-neutral-900">{item.productName}</p>
                            <p className="mt-1 truncate text-[10px] text-neutral-500">{item.styleNo} · {item.sku} · {item.color} / {item.size}</p>
                            {Number.isInteger(item.inStockQuantity) && Number.isInteger(item.preorderQuantity) && (
                              <p className="mt-1 text-[10px] font-medium text-neutral-600">
                                现货 {item.inStockQuantity} 件 · 订货 {item.preorderQuantity} 件
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[10px] text-neutral-500">
                            <p>{item.quantity} 件 × €{item.unitPrice.toFixed(2)}</p>
                            <p className="mt-1 font-semibold text-neutral-800">€{(item.quantity * item.unitPrice).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 border-t border-neutral-100 px-4 py-4 text-xs sm:px-5">
                      <div className="flex justify-between text-neutral-600"><span>商品小计</span><span>€{selectedOrderDetail.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)}</span></div>
                      <div className="flex justify-between text-neutral-600"><span>运费</span><span>€{(selectedOrderDetail.shippingFee || 0).toFixed(2)}</span></div>
                      {selectedOrderDetail.discountAmount ? <div className="flex justify-between text-neutral-600"><span>折扣</span><span>−€{selectedOrderDetail.discountAmount.toFixed(2)}</span></div> : null}
                      <div className="flex justify-between border-t border-neutral-100 pt-2 text-sm font-bold text-neutral-950"><span>订单总额</span><span>€{selectedOrderDetail.totalAmount.toFixed(2)}</span></div>
                    </div>
                  </section>

                  <details className="rounded-xl border border-neutral-200 bg-white shadow-xs" open={selectedOrderDetail.status === 'shipped'}>
                    <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900">包裹与物流记录</h3>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {merchantOrderShipmentsLoading
                              ? '正在读取包裹…'
                              : `已创建 ${merchantOrderShipments.length} 个包裹 · 物流事件来源为平台记录`}
                          </p>
                        </div>
                      </div>
                    </summary>
                    <div className="border-t border-neutral-100 p-4 sm:px-5">
                      {merchantOrderShipmentsLoading ? (
                        <p className="text-xs text-neutral-500">正在读取包裹记录…</p>
                      ) : merchantOrderShipments.length === 0 ? (
                        <p className="rounded-lg bg-neutral-50 px-3 py-3 text-xs leading-5 text-neutral-500">
                          尚未创建包裹。承运商自动追踪尚未接入；没有扫描事件时不会显示物流地点或预计送达时间。
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {merchantOrderShipments.map(shipment => (
                            <article key={shipment.id} className="rounded-lg border border-neutral-200 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-neutral-900">{shipment.shipmentNo}</p>
                                  <p className="mt-1 break-all text-[11px] text-neutral-600">
                                    {shipment.carrier || '承运商未填写'}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
                                    {' · '}
                                    {({ pending: '待发货', packed: '备货完成', shipped: '运输中', delivered: '已送达', exception: '物流异常', cancelled: '已取消' } as Record<string, string>)[shipment.status] || shipment.status}
                                  </p>
                                </div>
                                <time className="text-[10px] text-neutral-500">
                                  平台更新 · {new Date(shipment.updatedAt).toLocaleString()}
                                </time>
                              </div>
                              <ul className="mt-2 space-y-1">
                                {shipment.items.map(shippedItem => {
                                  const item = selectedOrderDetail.items.find(candidate => candidate.id === shippedItem.orderItemId);
                                  return (
                                    <li key={shippedItem.orderItemId} className="text-[11px] text-neutral-600">
                                      {item ? `${item.productName} · ${item.color} / ${item.size}` : shippedItem.orderItemId}
                                      {' · '}
                                      {shippedItem.quantity} 件
                                    </li>
                                  );
                                })}
                              </ul>
                              {shipment.trackingEvents.length > 0 ? (
                                <ol className="mt-3 space-y-3 border-l border-neutral-200 pl-3">
                                  {[...shipment.trackingEvents]
                                    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
                                    .map(event => (
                                      <li key={event.id} className="relative">
                                        <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-neutral-700" />
                                        <p className="text-xs font-semibold text-neutral-800">{event.status}</p>
                                        {event.location && <p className="mt-0.5 text-[11px] text-neutral-600">{event.location}</p>}
                                        {event.description && <p className="mt-0.5 text-[11px] text-neutral-600">{event.description}</p>}
                                        <time className="mt-1 block text-[10px] text-neutral-400">{new Date(event.occurredAt).toLocaleString()}</time>
                                      </li>
                                    ))}
                                </ol>
                              ) : (
                                <p className="mt-3 text-[11px] text-neutral-500">
                                  暂无承运商扫描节点；当前仅能确认平台登记的包裹信息。
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>

                  <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:p-5">
                    <h3 className="text-sm font-bold text-neutral-900">订单时间线</h3>
                    {selectedOrderDetail.timeline.length ? (
                      <ol className="mt-4 space-y-4">
                        {[...selectedOrderDetail.timeline].reverse().map((event, index) => (
                          <li key={`${event.time}-${event.title}-${index}`} className="relative flex gap-3">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? 'bg-neutral-900' : 'bg-neutral-300'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-xs font-semibold text-neutral-800">{event.title || event.status}</p>
                                <time className="text-[10px] text-neutral-400">{event.time}</time>
                              </div>
                              {event.note && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-neutral-500">{event.note}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="mt-3 text-xs text-neutral-500">暂无操作记录</p>}
                  </section>
                </div>

                <aside className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pl-1">
                  <OrderChatPanel
                    key={selectedOrderDetail.id}
                    orderId={selectedOrderDetail.id}
                    orderNo={selectedOrderDetail.orderNo}
                    role="merchant"
                    disabled={selectedOrderDetailIsDemo}
                    onUnreadCountChange={count => setServerOrders(current => current?.map(order =>
                      order.id === selectedOrderDetail.id ? { ...order, unreadMessageCount: count } : order
                    ) || null)}
                  />
                  <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                    <h3 className="text-sm font-bold text-neutral-900">客户信息</h3>
                    <p className="mt-3 text-xs font-semibold text-neutral-800">{selectedOrderDetail.companyName}</p>
                    {selectedOrderDetailCustomer && (
                      <div className="mt-2 space-y-1 text-[11px] text-neutral-600">
                        {selectedOrderDetailCustomer.contactPerson && <p>联系人：{selectedOrderDetailCustomer.contactPerson}</p>}
                        {selectedOrderDetailCustomer.email && <p className="break-all">邮箱：{selectedOrderDetailCustomer.email}</p>}
                        {selectedOrderDetailCustomer.phone && <p>电话：{selectedOrderDetailCustomer.phone}</p>}
                      </div>
                    )}
                    <div className="mt-3 border-t border-neutral-100 pt-3 text-[11px] leading-5 text-neutral-600">
                      <p className="font-semibold text-neutral-800">收货地址</p>
                      <p>{selectedOrderDetail.shippingAddress?.street}</p>
                      <p>{[selectedOrderDetail.shippingAddress?.city, selectedOrderDetail.shippingAddress?.country, selectedOrderDetail.shippingAddress?.zip].filter(Boolean).join(', ')}</p>
                      {!selectedOrderDetailIsDemo && ['placed', 'pending', 'confirmed'].includes(selectedOrderDetail.status) && (
                        <button type="button" onClick={() => prepareOrderEdit(selectedOrderDetail)} className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10px] font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50">预填并编辑订单资料</button>
                      )}
                      {orderEditOpen && orderEditTargetId === selectedOrderDetail.id && (
                        <form onSubmit={event => void saveOrderEdit(event, selectedOrderDetail)} className="mt-3 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <p className="text-[10px] font-semibold text-neutral-700">新版本待客户确认后生效</p>
                          {([
                            ['street', '街道地址'],
                            ['city', '城市'],
                            ['country', '国家'],
                            ['zip', '邮编']
                          ] as const).map(([field, label]) => (
                            <label key={field} className="block text-[9px] font-semibold text-neutral-600">{label}
                              <input value={orderEditForm[field]} onChange={event => setOrderEditForm(form => ({ ...form, [field]: event.target.value }))} maxLength={field === 'street' ? 240 : field === 'zip' ? 30 : 100} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10px] font-normal text-neutral-800 outline-none focus:border-neutral-500" />
                            </label>
                          ))}
                          <div className="space-y-2 border-t border-neutral-200 pt-3">
                            <p className="text-[10px] font-semibold text-neutral-700">商品、数量与单价</p>
                            {orderEditForm.items.map((editItem, index) => {
                              const item = selectedOrderDetail.items.find(candidate => candidate.id === editItem.id);
                              if (!item) return null;
                              return (
                                <div key={editItem.id} className="grid grid-cols-[minmax(0,1fr)_76px_88px] items-end gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                                  <p className="min-w-0 pb-2 text-[10px] font-medium text-neutral-700">
                                    <span className="block truncate">{item.productName}</span>
                                    <span className="mt-0.5 block truncate text-neutral-500">{item.sku} · {item.color} / {item.size}</span>
                                  </p>
                                  <label className="text-[9px] text-neutral-500">数量
                                    <input
                                      type="number"
                                      min={1}
                                      step={Math.max(1, item.packSize || 1)}
                                      value={editItem.quantity}
                                      onChange={event => setOrderEditForm(form => ({
                                        ...form,
                                        items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: event.target.value } : current)
                                      }))}
                                      className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-[10px] text-neutral-800"
                                    />
                                  </label>
                                  <label className="text-[9px] text-neutral-500">单价 (€)
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={editItem.unitPrice}
                                      onChange={event => setOrderEditForm(form => ({
                                        ...form,
                                        items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, unitPrice: event.target.value } : current)
                                      }))}
                                      className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-[10px] text-neutral-800"
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-2 border-t border-neutral-200 pt-3">
                            <p className="text-[10px] font-semibold text-neutral-700">付款与供货条件</p>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[9px] font-semibold text-neutral-600">付款方式
                                <select value={orderEditForm.paymentMethod} onChange={event => setOrderEditForm(form => ({ ...form, paymentMethod: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal">
                                  <option value="bank_transfer">银行转账</option>
                                  <option value="bank_transfer_prepay">银行转账（预付款）</option>
                                  <option value="credit_card">银行卡</option>
                                </select>
                              </label>
                              <label className="text-[9px] font-semibold text-neutral-600">付款计划
                                <select value={orderEditForm.paymentPlan} onChange={event => setOrderEditForm(form => ({ ...form, paymentPlan: event.target.value as OrderAgreementTerms['paymentPlan'] }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal">
                                  <option value="full_prepayment">全额预付</option>
                                  <option value="ship_before_payment">先发货后付款</option>
                                  <option value="partial_prepayment">部分预付</option>
                                  <option value="cash_on_delivery">送达时付款</option>
                                  <option value="custom">自定义</option>
                                </select>
                              </label>
                            </div>
                            {orderEditForm.paymentPlan === 'partial_prepayment' && (
                              <div className="grid grid-cols-[1fr_84px] gap-2">
                                <label className="text-[9px] font-semibold text-neutral-600">预付款
                                  <input type="number" min="0.01" step="0.01" value={orderEditForm.prepaymentValue} onChange={event => setOrderEditForm(form => ({ ...form, prepaymentValue: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                                </label>
                                <label className="text-[9px] font-semibold text-neutral-600">单位
                                  <select value={orderEditForm.prepaymentMode} onChange={event => setOrderEditForm(form => ({ ...form, prepaymentMode: event.target.value as 'percent' | 'amount' }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal">
                                    <option value="percent">百分比</option>
                                    <option value="amount">欧元</option>
                                  </select>
                                </label>
                              </div>
                            )}
                            {orderEditForm.paymentPlan === 'custom' && (
                              <label className="block text-[9px] font-semibold text-neutral-600">自定义预付款金额 (€，可选)
                                <input type="number" min="0" step="0.01" value={orderEditForm.prepaymentValue} onChange={event => setOrderEditForm(form => ({ ...form, prepaymentValue: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                            )}
                            {orderEditForm.paymentPlan !== 'full_prepayment' && (
                              <label className="block text-[9px] font-semibold text-neutral-600">余款支付条件
                                <select value={orderEditForm.remainingBalanceTrigger} onChange={event => setOrderEditForm(form => ({ ...form, remainingBalanceTrigger: event.target.value as OrderAgreementTerms['remainingBalanceTrigger'] }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal">
                                  <option value="before_shipment">发货前</option>
                                  <option value="on_delivery">货到时</option>
                                  <option value="after_delivery">送达后</option>
                                  <option value="date">指定日期</option>
                                  <option value="custom">自定义条件</option>
                                </select>
                              </label>
                            )}
                            {orderEditForm.remainingBalanceTrigger === 'date' && (
                              <label className="block text-[9px] font-semibold text-neutral-600">余款到期日
                                <input type="date" required value={orderEditForm.remainingBalanceDueAt} onChange={event => setOrderEditForm(form => ({ ...form, remainingBalanceDueAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                            )}
                            {(orderEditForm.paymentPlan === 'custom' || orderEditForm.remainingBalanceTrigger === 'custom') && (
                              <label className="block text-[9px] font-semibold text-neutral-600">自定义付款条件
                                <textarea required value={orderEditForm.customPaymentCondition} onChange={event => setOrderEditForm(form => ({ ...form, customPaymentCondition: event.target.value }))} maxLength={500} rows={2} className="mt-1 w-full resize-y rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[9px] font-semibold text-neutral-600">供货方式
                                <select value={orderEditForm.supplyMode} onChange={event => setOrderEditForm(form => ({ ...form, supplyMode: event.target.value as OrderAgreementTerms['supplyMode'] }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal">
                                  <option value="in_stock_first">现货优先</option>
                                  <option value="all_ready">齐货后发</option>
                                  <option value="partial_shipments">允许分批发货</option>
                                </select>
                              </label>
                              <label className="text-[9px] font-semibold text-neutral-600">预计交期
                                <input type="date" value={orderEditForm.expectedDeliveryAt} onChange={event => setOrderEditForm(form => ({ ...form, expectedDeliveryAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[9px] font-semibold text-neutral-600">运费 (€)
                                <input type="number" min="0" step="0.01" value={orderEditForm.shippingFee} onChange={event => setOrderEditForm(form => ({ ...form, shippingFee: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                              <label className="text-[9px] font-semibold text-neutral-600">折扣 (€)
                                <input type="number" min="0" step="0.01" value={orderEditForm.discountAmount} onChange={event => setOrderEditForm(form => ({ ...form, discountAmount: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-normal" />
                              </label>
                            </div>
                          </div>
                          <label className="block text-[9px] font-semibold text-neutral-600">订单备注
                            <textarea value={orderEditForm.notes} onChange={event => setOrderEditForm(form => ({ ...form, notes: event.target.value }))} maxLength={2000} rows={2} className="mt-1 w-full resize-y rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10px] font-normal text-neutral-800 outline-none focus:border-neutral-500" />
                          </label>
                          <div className="flex gap-2 pt-1">
                            <button type="button" disabled={orderEditBusy} onClick={() => { setOrderEditOpen(false); setOrderEditTargetId(null); }} className="flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] font-semibold text-neutral-600 disabled:opacity-50">取消</button>
                            <button type="submit" disabled={orderEditBusy} className="flex-1 rounded-lg bg-neutral-950 px-2 py-2 text-[10px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">{orderEditBusy ? '正在提交…' : '提交新版本'}</button>
                          </div>
                        </form>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                    <h3 className="text-sm font-bold text-neutral-900">付款与配送</h3>
                    <dl className="mt-3 space-y-2 text-[11px]">
                      <div className="flex justify-between gap-3"><dt className="text-neutral-500">付款方式</dt><dd className="text-right font-medium text-neutral-800">{selectedOrderDetail.paymentMethod.replaceAll('_', ' ')}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-neutral-500">配送方式</dt><dd className="text-right font-medium text-neutral-800">{selectedOrderDetail.deliveryType === 'showroom_pickup' ? '展厅自提' : '配送'}</dd></div>
                      {selectedOrderDetail.pickupLocation && <div className="flex justify-between gap-3"><dt className="text-neutral-500">自提地点</dt><dd className="text-right font-medium text-neutral-800">{selectedOrderDetail.pickupLocation}</dd></div>}
                      {selectedOrderDetail.carrier && <div className="flex justify-between gap-3"><dt className="text-neutral-500">承运商</dt><dd className="text-right font-medium text-neutral-800">{selectedOrderDetail.carrier}</dd></div>}
                      {selectedOrderDetail.trackingNumber && <div className="flex justify-between gap-3"><dt className="text-neutral-500">物流单号</dt><dd className="break-all text-right font-mono font-medium text-neutral-800">{selectedOrderDetail.trackingNumber}</dd></div>}
                    </dl>
                  </section>
                  {selectedOrderDetail.notes && (
                    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                      <h3 className="text-sm font-bold text-neutral-900">订单备注</h3>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{selectedOrderDetail.notes}</p>
                    </section>
                  )}
                  {merchantReturnsByOrderId.get(selectedOrderDetail.id)?.status === 'requested' && (
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-sm font-bold text-amber-950">待审核的售后申请</h3>
                      <p className="mt-2 text-xs leading-5 text-amber-900">{merchantReturnsByOrderId.get(selectedOrderDetail.id)?.reason}</p>
                      <p className="mt-1 text-[10px] text-amber-800">申请退货 {merchantReturnsByOrderId.get(selectedOrderDetail.id)?.requestedQty} 件{merchantReturnsByOrderId.get(selectedOrderDetail.id)?.refundAmount ? ` · 申请退款 €${merchantReturnsByOrderId.get(selectedOrderDetail.id)?.refundAmount?.toFixed(2)}` : ''}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => {
                          const request = merchantReturnsByOrderId.get(selectedOrderDetail.id);
                          if (request) void handleReturnReview(request, 'approved');
                        }} className="flex-1 rounded-lg bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white hover:bg-neutral-700">批准申请</button>
                        <button type="button" onClick={() => {
                          const request = merchantReturnsByOrderId.get(selectedOrderDetail.id);
                          if (request) void handleReturnReview(request, 'rejected');
                        }} className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100">拒绝申请</button>
                      </div>
                    </section>
                  )}
                  {merchantReturnsByOrderId.get(selectedOrderDetail.id)?.status === 'approved' && (
                    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                      <h3 className="text-sm font-bold text-sky-950">退货已批准，等待实物验收</h3>
                      <p className="mt-2 text-xs leading-5 text-sky-900">{merchantReturnsByOrderId.get(selectedOrderDetail.id)?.reason}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-sky-800"><span>先确认收到退货</span><span>登记收货后退款</span><span>仅批准不加库存</span><span>仅批准不退款</span></div>
                      <button type="button" onClick={() => {
                        const request = merchantReturnsByOrderId.get(selectedOrderDetail.id);
                        if (request) void handleReturnReceive(request);
                      }} className="mt-3 w-full rounded-lg bg-neutral-950 px-3 py-2 text-[11px] font-semibold text-white hover:bg-neutral-700">登记已收货并提交退款</button>
                    </section>
                  )}
                  {merchantReturnsByOrderId.get(selectedOrderDetail.id)?.status === 'received' && (
                    <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <h3 className="text-sm font-bold text-violet-950">已收货 · 退款处理中</h3>
                      <p className="mt-2 text-xs leading-5 text-violet-900">{merchantReturnsByOrderId.get(selectedOrderDetail.id)?.reason}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-violet-800"><span>退款以渠道回执</span><span>勿重复退款</span></div>
                    </section>
                  )}
                </aside>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 6: 商品授权申请 */}
      {/* ======================================================== */}
      {activeTab === 'vault_requests' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader title="授权申请" icon={<Lock className="h-3.5 w-3.5" />} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {merchantVaultRequests.length === 0 ? (
              <div className="md:col-span-2 p-8 text-center bg-white rounded-xl border border-neutral-200 text-neutral-500 text-xs">
                暂无授权申请
              </div>
            ) : (
              merchantVaultRequests.map((req) => (
                <article key={req.id} className="merchant-home-card space-y-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-neutral-900">{req.companyName}</h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          req.status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status === 'approved' ? '已授权' : req.status === 'rejected' ? '已拒绝' : '待审核'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {req.contactPerson} · {req.businessType}
                      </div>
                    </div>
                    <time className="shrink-0 text-[11px] text-neutral-400">{req.appliedAt}</time>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-lg text-xs text-neutral-700 border border-neutral-100">
                    <span className="font-semibold text-neutral-900">附言：</span>
                    {req.note || '未填写'}
                  </div>

                  {req.status === 'pending' ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                      <button
                        id={`approve-vault-${req.id}`}
                        onClick={async () => {
                          try {
                            await apiPut(`/api/merchant/vault-requests/${encodeURIComponent(req.id)}/review`, { status: 'approved' });
                            await refreshMerchantOperations();
                            addNotification('success', '已授权看货', `已向 ${req.companyName} 开放本店私密首发货盘`);
                          } catch (error) {
                            addNotification('warning', '授权操作失败', error instanceof Error ? error.message : '请稍后重试');
                          }
                        }}
                        className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 授权
                      </button>
                      <button
                        id={`reject-vault-${req.id}`}
                        onClick={async () => {
                          try {
                            await apiPut(`/api/merchant/vault-requests/${encodeURIComponent(req.id)}/review`, { status: 'rejected' });
                            await refreshMerchantOperations();
                            addNotification('info', '已拒绝看货申请', `已拒绝 ${req.companyName} 的看货申请`);
                          } catch (error) {
                            addNotification('warning', '审核操作失败', error instanceof Error ? error.message : '请稍后重试');
                          }
                        }}
                        className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 拒绝
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 7: 我的买手客户 (MY CUSTOMERS) */}
      {/* ======================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">客户</h1>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportMerchantCustomers} disabled={!visibleMerchantCustomers.length} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40" title={!visibleMerchantCustomers.length ? '没有可导出的客户' : undefined}><FileSpreadsheet className="h-3.5 w-3.5" />导出</button>
              <button type="button" onClick={() => openCustomerEditor()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />新增</button>
            </div>
          </header>

          <section className="space-y-3" aria-label="客户搜索与筛选">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="搜索客户、公司或联系人" aria-label="搜索客户、公司或联系人" className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-neutral-500" />
            </label>
            <details className="group rounded-xl border border-neutral-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800 marker:hidden">
                筛选
                {activeCustomerFilterCount > 0 && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-600">{activeCustomerFilterCount}</span>}
                <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-neutral-200 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <select aria-label="按客户状态筛选" value={customerStatusFilter} onChange={event => setCustomerStatusFilter(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="all">全部审核状态</option><option value="approved">已审核</option><option value="pending">待审核</option><option value="rejected">未通过</option></select>
                  <select aria-label="按国家筛选客户" value={customerCountryFilter} onChange={event => setCustomerCountryFilter(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="all">所有国家 / 地区</option><option value="__italy__">意大利（Italy / Italia）</option>{customerCountryOptions.filter(country => !/^(italy|italia)$/i.test(country)).map(country => <option key={country} value={country}>{country}</option>)}</select>
                  <select aria-label="客户细分条件" value={customerSegment} onChange={event => setCustomerSegment(event.target.value as typeof customerSegment)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"><option value="all">全部客户</option><option value="repeat">回头客户（≥ 2 单）</option><option value="new">近 30 天新增</option><option value="at-risk">流失风险（60 天未回购）</option><option value="no-orders">尚无本店订单</option></select>
                  <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600"><span className="shrink-0">近 90 天订单数 ≥</span><input type="number" min="1" max="100" value={customerMinOrders} onChange={event => setCustomerMinOrders(event.target.value)} className="w-full min-w-0 bg-transparent outline-none" placeholder="不限" /></label>
                  <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600"><span className="shrink-0">最近下单 ≤ 天</span><input type="number" min="1" max="3650" value={customerLookbackDays} onChange={event => setCustomerLookbackDays(event.target.value)} className="w-full min-w-0 bg-transparent outline-none" placeholder="不限" /></label>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                  <select aria-label="已保存客户筛选" defaultValue="" onChange={event => applyCustomerSegment(event.target.value)} className="max-w-56 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">已保存筛选{customerSavedSegments.length ? ` (${customerSavedSegments.length})` : ''}</option>{customerSavedSegments.map(segment => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select>
                  <button type="button" onClick={saveCustomerSegment} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">保存筛选</button>
                  <button type="button" onClick={() => { setCustomerSearch(''); setCustomerStatusFilter('all'); setCustomerCountryFilter('all'); setCustomerSegment('all'); setCustomerMinOrders(''); setCustomerLookbackDays(''); }} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-50">清除条件</button>
                  {(customerSearch.trim() || customerStatusFilter !== 'all' || customerCountryFilter !== 'all' || customerSegment !== 'all' || customerMinOrders || customerLookbackDays) && <span className="ml-auto text-[11px] text-neutral-500">符合 {visibleMerchantCustomers.length} / {merchantCustomers.length} 位</span>}
                </div>
                <p className="text-[10px] text-neutral-500">仅本机保存 · 不同步、不自动更新或发送营销</p>
              </div>
            </details>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
                <div className="text-[11px] text-neutral-600"><span>{visibleMerchantCustomers.length} 位客户</span><span className="mx-2 text-neutral-300">·</span><span>订单金额 €{visibleCustomerTotalSpend.toFixed(2)}</span><span className="mx-2 text-neutral-300">·</span><span>标签仅本店可见</span></div>
                {selectedCustomerIds.length > 0 && <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-neutral-600">已选 {selectedCustomerIds.length} 位</span>
                  <input value={customerBatchTag} onChange={event => setCustomerBatchTag(event.target.value)} maxLength={40} placeholder="标签名称" className="w-28 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] outline-none focus:border-neutral-400" />
                  <button type="button" disabled={customerBatchBusy || !customerBatchTag.trim()} onClick={() => void updateSelectedCustomerTag('add')} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-40">{customerBatchBusy ? '处理中…' : '批量加标签'}</button>
                  <button type="button" disabled={customerBatchBusy || !customerBatchTag.trim()} onClick={() => void updateSelectedCustomerTag('remove')} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-40">批量移除标签</button>
                </div>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600"><tr>
                    <th className="px-4 py-3"><input aria-label="全选当前筛选客户" type="checkbox" checked={visibleMerchantCustomers.length > 0 && visibleMerchantCustomers.every(customer => selectedCustomerIds.includes(customer.id))} onChange={event => setSelectedCustomerIds(previous => event.target.checked ? [...new Set([...previous, ...visibleMerchantCustomers.map(customer => customer.id)])] : previous.filter(id => !visibleMerchantCustomers.some(customer => customer.id === id)))} /></th>
                    <th className="px-4 py-3">企业 / 联系人</th><th className="px-4 py-3">所在地</th><th className="px-4 py-3">状态 / 标签</th><th className="px-4 py-3 text-right">本店订单</th><th className="px-4 py-3 text-right">订单金额</th><th className="px-4 py-3">最近下单</th><th className="px-4 py-3 text-right">操作</th>
                  </tr></thead>
                  <tbody className="divide-y divide-neutral-100">
                    {visibleMerchantCustomers.map(customer => {
                      const stats = getCustomerOrderStats(customer.id);
                      return <tr key={customer.id} className="transition hover:bg-neutral-50/70">
                        <td className="px-4 py-3"><input aria-label={`选择 ${customer.companyName}`} type="checkbox" checked={selectedCustomerIds.includes(customer.id)} onChange={event => setSelectedCustomerIds(previous => event.target.checked ? [...new Set([...previous, customer.id])] : previous.filter(id => id !== customer.id))} /></td>
                        <td className="px-4 py-3"><button type="button" onClick={() => setCustomerDetail(customer)} className="text-left"><strong className="block text-neutral-900 hover:underline">{customer.companyName}</strong><span className="mt-1 block text-[10px] text-neutral-500">{customer.contactPerson} · {customer.email}</span></button></td>
                        <td className="px-4 py-3 text-neutral-600">{customer.city}{customer.city && customer.country ? ', ' : ''}{customer.country}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${customer.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : customer.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{customer.status === 'approved' ? '已审核' : customer.status === 'rejected' ? '未通过' : '待审核'}</span><div className="mt-1 flex max-w-52 flex-wrap gap-1">{(customer.merchantTags || []).map(tag => <span key={tag} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600">{tag}</span>)}</div></td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{stats.orders.length}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">€{stats.spend.toFixed(2)}</td>
                        <td className="px-4 py-3 text-neutral-500">{stats.latestOrderAt ? new Date(stats.latestOrderAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-right"><div className="inline-flex gap-1"><button type="button" onClick={() => setCustomerDetail(customer)} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50">查看</button><button type="button" onClick={() => openCustomerEditor(customer)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"><Pencil className="h-3 w-3" />编辑</button></div></td>
                      </tr>;
                    })}
                    {!visibleMerchantCustomers.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-neutral-500">{merchantCustomers.length ? <div className="space-y-2"><p>没有符合条件的客户</p><button type="button" onClick={() => { setCustomerSearch(''); setCustomerStatusFilter('all'); setCustomerCountryFilter('all'); setCustomerSegment('all'); setCustomerMinOrders(''); setCustomerLookbackDays(''); }} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700">清除筛选</button></div> : <div className="space-y-2"><p className="font-semibold text-neutral-800">暂无客户</p><p>新增客户或等待首笔订单</p><button type="button" onClick={() => openCustomerEditor()} className="rounded-lg bg-neutral-950 px-3 py-1.5 text-[11px] font-semibold text-white">新增客户</button></div>}</td></tr>}
                  </tbody>
                </table>
              </div>
          </section>
            {customerRegionRank.length > 0 && <details className="group rounded-xl border border-neutral-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-neutral-800 marker:hidden">客户地区<ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" /></summary><div className="border-t border-neutral-200 p-4"><div className="flex flex-wrap gap-2">{customerRegionRank.map(([region, count]) => <span key={region} className="rounded-full bg-neutral-50 px-3 py-1.5 text-[10px] text-neutral-600">{region}<strong className="ml-2 text-neutral-900">{count}</strong></span>)}</div><p className="mt-2 text-[9px] text-neutral-500">不代表营销授权</p></div></details>}
            {customerEditorOpen && (
              <CustomerEditorModal title={customerEditor ? '编辑客户资料' : '新增合作客户'} form={customerForm} busy={customerEditorBusy} onChange={setCustomerForm} onSubmit={saveCustomerEditor} onClose={() => { setCustomerEditor(null); setCustomerEditorOpen(false); }} />
            )}
            {customerDetail && (() => {
              const stats = getCustomerOrderStats(customerDetail.id);
              const recentOrders = [...stats.orders].sort((left, right) => new Date(right.createdAt || `${right.date}T00:00:00`).getTime() - new Date(left.createdAt || `${left.date}T00:00:00`).getTime()).slice(0, 8);
              return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCustomerDetail(null); }}>
                <section role="dialog" aria-modal="true" aria-label={`${customerDetail.companyName}客户详情`} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4"><div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-800">本店客户档案</span><h2 className="mt-2 text-lg font-semibold text-neutral-950">{customerDetail.companyName}</h2><p className="mt-1 text-xs text-neutral-500">{customerDetail.contactPerson} · {customerDetail.email} · {customerDetail.phone}</p></div><button type="button" aria-label="关闭客户详情" onClick={() => setCustomerDetail(null)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"><X className="h-4 w-4" /></button></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ label: '本店订单', value: stats.orders.length }, { label: '本店订单金额', value: `€${stats.spend.toFixed(2)}` }, { label: '客户状态', value: customerDetail.status }, { label: '客户时长', value: customerDetail.registrationDate || '未知' }].map(metric => <div key={metric.label} className="rounded-xl bg-neutral-50 p-3"><span className="text-[9px] text-neutral-500">{metric.label}</span><strong className="mt-1 block truncate text-xs text-neutral-900">{metric.value}</strong></div>)}</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-neutral-100 p-3"><h3 className="text-xs font-semibold text-neutral-800">联系方式与地址</h3><p className="mt-2 text-[10px] leading-5 text-neutral-600">{customerDetail.address}<br />{customerDetail.city}, {customerDetail.country}<br />VAT / P.IVA: {customerDetail.vatNumber || '—'}<br />经营类型：{customerDetail.businessType}</p></div><div className="rounded-xl border border-neutral-100 p-3"><h3 className="text-xs font-semibold text-neutral-800">商家私有备注与标签</h3><p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-neutral-600">{customerDetail.merchantNotes || '暂无备注'}</p><div className="mt-2 flex flex-wrap gap-1">{(customerDetail.merchantTags || []).map(tag => <span key={tag} className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] text-neutral-600">{tag}</span>)}</div><button type="button" onClick={() => openCustomerEditor(customerDetail)} className="mt-3 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700">编辑资料与标签</button></div></div>
                  <div className="mt-4 rounded-xl border border-neutral-100 p-3"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-neutral-800">最近本店订单</h3><span className="text-[9px] text-neutral-400">最近 {recentOrders.length} / {stats.orders.length} 笔</span></div>{recentOrders.length ? <div className="mt-2 divide-y divide-neutral-100">{recentOrders.map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[10px]"><span className="font-semibold text-neutral-800">{order.orderNo} · {new Date(order.createdAt || `${order.date}T00:00:00`).toLocaleDateString()}</span><span className="text-neutral-500">{order.status} · €{order.totalAmount.toFixed(2)}</span></div>)}</div> : <p className="mt-2 text-[10px] text-neutral-500">暂无该客户订单</p>}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] leading-4 text-neutral-400"><span>仅显示本店关系</span><span>仅显示本店订单</span><span>完整动态未开放</span></div>
                  <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setCustomerDetail(null); openDraftQuoteForm(customerDetail.companyName); setActiveTab('orders'); setOrderView('drafts'); }} disabled={customerDetail.status !== 'approved'} className="rounded-lg border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-700 disabled:opacity-40">准备草稿报价</button><button type="button" onClick={() => { setCustomerDetail(null); openCustomerEditor(customerDetail); }} className="rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-semibold text-white">编辑客户</button></div>
                </section>
              </div>;
            })()}
          </div>
        )}

        {activeTab === 'content' && currentMerchant && currentMerchantId && (
          <Suspense fallback={<div className="rounded-2xl border border-neutral-200 bg-white p-6 text-xs text-neutral-500">正在加载内容工作台…</div>}>
            <MerchantContentWorkspace
              merchantId={currentMerchantId}
              merchantName={currentMerchant.name}
              isIt={isIt}
              section={contentSection}
              generateCopy={prompt => new Promise(resolve => {
                void askOperatingAssistant(prompt, { openPanel: false, onReply: resolve, context: 'content', scope: contentSection, forcePageContext: true })
                  .then(success => { if (!success) resolve(null); })
                  .catch(() => resolve(null));
              })}
              addNotification={addNotification}
            />
          </Suspense>
        )}

          {activeTab === 'growth' && currentMerchant && currentMerchantId && (
          <Suspense fallback={<div className="rounded-2xl border border-neutral-200 bg-white p-6 text-xs text-neutral-500">正在加载增长工作区…</div>}>
            <MerchantGrowthWorkspace
              merchantId={currentMerchantId}
              merchantName={currentMerchant.name}
              merchantSharePath={merchantSubdomainUrl}
              products={merchantProducts}
              orders={merchantOrders}
              customers={merchantCustomers}
              isIt={isIt}
              section={growthSection}
              onSectionChange={setGrowthSection}
              generateCopy={prompt => new Promise(resolve => {
                void askOperatingAssistant(prompt, { openPanel: false, onReply: resolve, context: 'growth', scope: growthSection, forcePageContext: true })
                  .then(success => { if (!success) resolve(null); })
                  .catch(() => resolve(null));
              })}
              addNotification={addNotification}
            />
          </Suspense>
        )}

      {/* ======================================================== */}
      {/* SUB-TAB 8: 财务结算与分账对账 (FINANCE & PAYOUTS) */}
      {/* ======================================================== */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader title="财务" icon={<Receipt className="h-3.5 w-3.5" />} />
          <PaymentSettingsCard audience="merchant" isIt={isIt} />
          <div className="merchant-home-card space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                收款账户
              </h2>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-500"><span>IBAN 加密保存</span><span>页面仅脱敏</span><span>换户需审核</span><span>平台财务审核</span></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={bankAccountForm.accountHolder} onChange={event => setBankAccountForm(previous => ({ ...previous, accountHolder: event.target.value }))} placeholder="账户持有人（法定主体）" className="border border-neutral-300 rounded-lg px-3 py-2 text-xs" />
              <input value={bankAccountForm.iban} onChange={event => setBankAccountForm(previous => ({ ...previous, iban: event.target.value }))} placeholder="IBAN" className="border border-neutral-300 rounded-lg px-3 py-2 text-xs font-mono" />
              <button type="button" disabled={bankAccountBusy} onClick={async () => {
                setBankAccountBusy(true);
                try {
                  await apiPost('/api/merchant/bank-accounts', bankAccountForm);
                  const result = await apiGet<{ success: true; accounts: typeof bankAccounts }>('/api/merchant/bank-accounts');
                  setBankAccounts(result.accounts);
                  setBankAccountForm({ accountHolder: '', iban: '' });
                  addNotification('success', '收款账户已提交', '平台财务将在核验后启用此账户用于结算');
                } catch (error) {
                  addNotification('warning', '账户提交失败', error instanceof Error ? error.message : '请检查账户信息');
                } finally {
                  setBankAccountBusy(false);
                }
              }} className="bg-neutral-900 text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">提交审核</button>
            </div>
            <div className="space-y-2">
              {bankAccounts.length === 0 ? <div className="text-xs text-neutral-600">尚未提交收款账户；提交并审核后可用于后续人工结算核对。</div> : bankAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-xs">
                  <span className="font-medium text-neutral-900">{account.accountHolder} · <span className="font-mono">{account.iban}</span></span>
                  <span className={account.status === 'verified' ? 'text-emerald-700 font-semibold' : account.status === 'rejected' ? 'text-rose-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {account.status === 'verified' ? '已核验' : account.status === 'rejected' ? `已拒绝：${account.rejectionReason || '请更新资料'}` : '审核中'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="merchant-home-card space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-700" />
                结算明细
              </h2>
              <p className="mt-1 text-xs text-neutral-500">每月 1 日、15 日出账 · 服务费按商户协议 · 净额以账单为准</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">累计销售额</div>
                <div className="text-xl font-bold text-neutral-900 mt-1">
                  €{merchantPayouts.reduce((acc, p) => acc + p.grossSales, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">平台服务费</div>
                <div className="text-xl font-bold text-neutral-700 mt-1">
                  €{merchantPayouts.reduce((acc, p) => acc + p.platformFeeAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">通道手续费</div>
                <div className="text-xl font-bold text-neutral-700 mt-1">
                  €{merchantPayouts.reduce((acc, p) => acc + p.paymentProcessingFee, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs text-neutral-500">退款扣减</div>
                <div className="text-xl font-bold text-neutral-700 mt-1">
                  €{merchantPayouts.reduce((acc, p) => acc + (p.refunds || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs text-neutral-600 font-semibold">应结算净额</div>
                <div className="text-xl font-bold text-neutral-900 mt-1">
                  €{merchantPayouts.reduce((acc, p) => acc + p.netPayout, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Payouts Table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="border-b border-neutral-200 p-4 text-sm font-semibold text-neutral-900">
              结算账单
            </div>
            <p className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-[10px] text-neutral-600">手工登记 · 非银行回执 · 不自动转账</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">结算批次</th>
                    <th className="py-3 px-4">结算周期</th>
                    <th className="py-3 px-4">总销售额 (Gross)</th>
                    <th className="py-3 px-4">平台抽佣（按商户比例）</th>
                    <th className="py-3 px-4">通道手续费</th>
                    <th className="py-3 px-4">退款扣减</th>
                    <th className="py-3 px-4">应结算净额</th>
                    <th className="py-3 px-4">结算状态</th>
                    <th className="py-3 px-4">收款账户（掩码）</th>
                    <th className="py-3 px-4">人工结算凭证</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {merchantPayouts.map(p => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 font-mono font-bold">{p.id}</td>
                      <td className="py-3 px-4 font-semibold text-neutral-900">{p.period}</td>
                      <td className="py-3 px-4 font-semibold">€{p.grossSales.toFixed(2)}</td>
                      <td className="py-3 px-4 text-neutral-600">-€{p.platformFeeAmount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-neutral-600">-€{p.paymentProcessingFee.toFixed(2)}</td>
                      <td className="py-3 px-4 text-neutral-600">-€{(p.refunds || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900 text-sm">€{p.netPayout.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className="border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-800">
                          {p.status === 'paid' ? (p.settlementReference && p.settlementProof ? '已登记人工结算' : '历史结算状态待核验') : p.status === 'processing' ? '人工结算处理中' : p.status === 'failed' ? '人工结算记录失败' : '待结算'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">{p.bankAccount}</td>
                      <td className="max-w-64 py-3 px-4 text-[11px] text-neutral-600">
                        {p.status === 'paid' && p.settlementReference && p.settlementProof ? (
                          <div className="space-y-1 break-words">
                            <div>参考号：{p.settlementReference || '—'}</div>
                            <div>凭证：{p.settlementProof || '—'}</div>
                            <div>{p.settledBy || '—'} · {p.settledAt ? new Date(p.settledAt).toLocaleString(getIntlLocale(lang)) : '—'}</div>
                          </div>
                        ) : p.status === 'paid' ? '历史记录尚无结算凭证' : '完成后显示人工登记的凭证'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === 'pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiPut(`/api/merchant/payouts/${encodeURIComponent(p.id)}/status`, { status: 'acknowledged' });
                                await refreshMerchantOperations();
                                addNotification('success', '结算单已确认', '平台运营可据此核对并手动记录后续结算；系统不会自动转账。');
                              } catch (error) {
                                addNotification('warning', '结算确认失败', error instanceof Error ? error.message : '请稍后重试');
                              }
                            }}
                            className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            确认对账
                          </button>
                        )}
                        {p.status === 'processing' && <span className="text-neutral-600 text-[11px] font-medium">平台正在处理人工结算</span>}
                        {p.status === 'failed' && <span className="text-neutral-600 text-[11px] font-medium">请联系平台客服核实记录</span>}
                        {p.status === 'paid' && <span className="text-neutral-700 text-[11px] font-medium">{p.settlementReference && p.settlementProof ? '详情见人工结算凭证' : '请联系平台核验历史记录'}</span>}
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
      {/* SUB-TAB 9: 商户资料与展厅资质 (MERCHANT PROFILE) */}
      {/* ======================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <MerchantWorkspaceHeader
            title="店铺设置"
            icon={<Store className="h-3.5 w-3.5" />}
            action={<button type="button" onClick={() => void saveStorefront()} disabled={storefrontBusy} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:opacity-50">{storefrontBusy ? '发布中…' : '保存并发布'}</button>}
          />
          <div id="merchant-storefront-settings" className="merchant-home-card scroll-mt-6 space-y-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">选择网店模板</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-500"><span>仅更换网店外观</span><span>商品订单不变</span></div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {MERCHANT_STOREFRONT_TEMPLATES.map(template => {
                const selected = storefrontForm.storefrontTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStorefrontForm(previous => ({ ...previous, storefrontTemplate: template.id }))}
                    className={`overflow-hidden rounded-xl border text-left transition ${selected ? 'border-neutral-950 ring-2 ring-neutral-950/10' : 'border-neutral-200 hover:border-neutral-400'}`}
                  >
                    <div className="h-24 p-2" style={{ backgroundColor: template.colors[0] }}>
                      <div className="flex h-full flex-col overflow-hidden rounded border" style={{ borderColor: `${template.colors[1]}55`, backgroundColor: template.colors[0] }}>
                        <div className="flex h-5 items-center justify-between px-2" style={{ backgroundColor: template.colors[1] }}>
                          <span className="h-1 w-10 rounded-full bg-white/80" />
                          <span className="h-1 w-5 rounded-full bg-white/50" />
                        </div>
                        <div className="flex flex-1 items-end gap-1 p-2">
                          {[0, 1, 2].map(index => <span key={index} className="h-full flex-1 rounded-sm" style={{ backgroundColor: index === 1 ? template.colors[2] : `${template.colors[1]}30` }} />)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div>
                        <span className="block text-xs font-bold text-neutral-900">{template.name}</span>
                        <span className="mt-1 block text-[10px] leading-4 text-neutral-500">{template.description}</span>
                      </div>
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${selected ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{selected ? '已选择' : '选择'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 text-xs">
            {([
              ['logo', '品牌 Logo', '店铺头像与品牌标识'],
              ['banner', '店铺首屏横幅', '建议使用宽幅品牌大片'],
              ['showroomImage', '展厅主图', '用于店铺介绍和展厅入口']
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="space-y-2">
                <label className="font-semibold text-neutral-700">{label}<span className="ml-2 font-normal text-neutral-400">{hint}</span></label>
                <label className="block cursor-pointer overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
                  <div className={`h-36 ${key === 'logo' ? 'p-8' : ''}`}><img src={storefrontForm[key]} alt={label} className="h-full w-full object-cover" /></div>
                  <div className="border-t bg-white px-3 py-2 text-center text-[11px] text-neutral-500">点击更换图片（JPG/PNG/WebP，≤5MB）</div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) readStorefrontImage(file, value => setStorefrontForm(previous => ({ ...previous, [key]: value }))); event.currentTarget.value = ''; }} />
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <label className="font-semibold text-neutral-700">展厅图集（最多 12 张）</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {storefrontForm.showroomPanoramicImages.map((image, index) => <div key={`${image.slice(-20)}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border"><img src={image} alt={`展厅图 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setStorefrontForm(previous => ({ ...previous, showroomPanoramicImages: previous.showroomPanoramicImages.filter((_, itemIndex) => itemIndex !== index) }))} className="absolute right-1 top-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">删除</button></div>)}
              {storefrontForm.showroomPanoramicImages.length < 12 && <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => { const files = Array.from(event.target.files || []); files.forEach(file => readStorefrontImage(file, value => setStorefrontForm(previous => previous.showroomPanoramicImages.length >= 12 ? previous : ({ ...previous, showroomPanoramicImages: [...previous.showroomPanoramicImages, value] })))); event.currentTarget.value = ''; }} /></label>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">网店首页大屏视频</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-relaxed text-neutral-500"><span>网店优先播放</span><span>MP4 / WebM · ≤100MB</span><span>未上传用默认视频</span></div>
              </div>
              <video
                key={storefrontVideoPreview || storefrontForm.storefrontVideo || 'default-storefront-video'}
                src={storefrontVideoPreview || storefrontForm.storefrontVideo || '/videos/ruda-home.mp4'}
                poster={storefrontForm.banner || DEFAULT_MERCHANT_BANNER}
                controls
                muted
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-xl bg-neutral-950 object-cover"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white">
                  {storefrontVideoFile ? '更换视频' : '上传自定义视频'}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file && (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 100 * 1024 * 1024)) {
                        addNotification('warning', '视频不符合要求', '仅支持 MP4/WebM，单个文件最大 100MB');
                      } else if (file) {
                        setStorefrontVideoFile(file);
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {(storefrontVideoFile || storefrontForm.storefrontVideo) && (
                  <button type="button" onClick={() => { setStorefrontVideoFile(null); setStorefrontForm(previous => ({ ...previous, storefrontVideo: '' })); }} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700">
                    恢复默认视频
                  </button>
                )}
                <span className="text-[10px] text-neutral-500">{storefrontVideoFile?.name || (storefrontForm.storefrontVideo ? '已设置自定义视频' : '正在使用默认视频')}</span>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-bold text-neutral-900">图片展示</h3>
              <p className="mt-2 text-[11px] text-neutral-600">视频不可用用横幅</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
            {([
              ['tagline', '品牌短标语（默认）'],
              ['tagline_zh', '中文品牌短标语'],
              ['tagline_it', '意大利语品牌短标语']
            ] as const).map(([key, label]) => <label key={key} className="font-semibold text-neutral-700">{label}<input value={storefrontForm[key]} maxLength={160} onChange={event => setStorefrontForm(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" /></label>)}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
            {([
              ['description', '品牌介绍（默认）'],
              ['description_zh', '中文品牌介绍'],
              ['description_it', '意大利语品牌介绍']
            ] as const).map(([key, label]) => <label key={key} className="font-semibold text-neutral-700">{label}<textarea value={storefrontForm[key]} maxLength={3000} rows={5} onChange={event => setStorefrontForm(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" /></label>)}
          </div>
          <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">网店搜索与交易政策</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>网店与分享预览</span><span>标题≤70 字</span><span>摘要≤320 字</span></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
              <label className="font-semibold text-neutral-700">SEO / 分享标题
                <input value={storefrontForm.storefrontSeoTitle} maxLength={70} onChange={event => setStorefrontForm(previous => ({ ...previous, storefrontSeoTitle: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" placeholder={currentMerchant?.name || '品牌名称 · 官方店铺'} />
              </label>
              <label className="font-semibold text-neutral-700">SEO / 分享摘要
                <textarea value={storefrontForm.storefrontSeoDescription} maxLength={320} rows={3} onChange={event => setStorefrontForm(previous => ({ ...previous, storefrontSeoDescription: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" placeholder="简要介绍店铺、品牌特色和批发货盘。" />
              </label>
              <label className="font-semibold text-neutral-700">配送与运费政策
                <textarea value={storefrontForm.storefrontShippingPolicy} maxLength={2000} rows={5} onChange={event => setStorefrontForm(previous => ({ ...previous, storefrontShippingPolicy: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" placeholder="配送区域、预计时效、运费与偏远地区规则。" />
              </label>
              <label className="font-semibold text-neutral-700">退换货与售后政策
                <textarea value={storefrontForm.storefrontReturnsPolicy} maxLength={2000} rows={5} onChange={event => setStorefrontForm(previous => ({ ...previous, storefrontReturnsPolicy: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" placeholder="申请时限、商品状态要求、处理方式与联系渠道。" />
              </label>
              <label className="font-semibold text-neutral-700">退货地址（消费者下单前公开展示）
                <textarea value={storefrontForm.storefrontReturnAddress} maxLength={500} rows={3} onChange={event => setStorefrontForm(previous => ({ ...previous, storefrontReturnAddress: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" placeholder="收件人/公司、街道门牌、邮编、城市、国家及必要的退货联系信息。" />
                <span className="mt-1 block text-[11px] font-normal leading-5 text-neutral-500">普通撤回退货运费由消费者承担；商品瑕疵或法律另有规定的情形除外。结账开放前必须填写准确且可使用的退货地址。</span>
              </label>
            </div>
          </section>
          <div className="text-xs">
            <label className="font-semibold text-neutral-700">店铺特色标签</label>
            <div className="mt-2 flex flex-wrap gap-2">{storefrontForm.specialties.map(tag => <span key={tag} className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">{tag}<button type="button" onClick={() => setStorefrontForm(previous => ({ ...previous, specialties: previous.specialties.filter(item => item !== tag) }))} className="ml-2 font-bold text-neutral-400">×</button></span>)}</div>
            <form className="mt-2 flex gap-2" onSubmit={event => { event.preventDefault(); const tag = newSpecialty.trim().slice(0, 40); if (tag && !storefrontForm.specialties.includes(tag) && storefrontForm.specialties.length < 12) setStorefrontForm(previous => ({ ...previous, specialties: [...previous.specialties, tag] })); setNewSpecialty(''); }}>
              <input value={newSpecialty} onChange={event => setNewSpecialty(event.target.value)} maxLength={40} placeholder="例如：意大利制造 / 真丝 / 小单快返" className="w-full max-w-sm rounded-lg border border-neutral-300 p-2.5" />
              <button type="submit" className="rounded-lg border border-neutral-300 px-3 font-semibold">添加</button>
            </form>
          </div>
        </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="merchant-settings-workspace grid min-h-full gap-4 lg:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="flex max-h-[48vh] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:sticky lg:top-0 lg:max-h-[calc(100vh-6rem)]">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-4">
              <img src={merchantLogo} alt="" className="h-9 w-9 rounded-lg border border-neutral-200 object-cover" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-neutral-900">{currentMerchant.name}</p>
                <p className="mt-0.5 text-[10px] text-neutral-500">{localizeCopy('商家设置', 'RUDA Impostazioni')}</p>
              </div>
            </div>
            <label className="relative block border-b border-neutral-100 p-3">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input value={settingsSearch} onChange={event => setSettingsSearch(event.target.value)} placeholder={localizeCopy('搜索设置', 'Cerca impostazioni')} aria-label={localizeCopy('搜索设置', 'Cerca impostazioni')} className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-[11px] outline-none focus:border-neutral-400" />
            </label>
            <nav aria-label={localizeCopy('设置导航', 'Impostazioni merchant')} className="merchant-settings-nav min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
              {filteredMerchantSettingsGroups.map(group => <section key={group.label}>
                <h2 className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">{group.label}</h2>
                <div className="space-y-0.5">
                  {group.entries.map(tuple => {
                    const [entry, label] = tuple;
                    return <button key={entry} type="button" onClick={() => runMerchantSettingsEntry(entry)} aria-current={activeSettingsEntry === entry ? 'page' : undefined} className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition duration-200 hover:-translate-y-px hover:shadow-sm ${activeSettingsEntry === entry ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950'}`}>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </button>;
                  })}
                </div>
              </section>)}
              {!filteredMerchantSettingsGroups.length && <p className="px-3 py-4 text-center text-[11px] text-neutral-500">{localizeCopy('没有匹配的设置项。', 'Nessuna impostazione corrispondente.')}</p>}
            </nav>
            <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-[9px] font-bold text-white">R</span>
              <span className="truncate text-[10px] font-semibold text-neutral-600">{currentMerchant.name}</span>
            </div>
          </aside>
          <div id="merchant-settings-content" className="min-w-0 scroll-mt-4 space-y-4">
          {!(settingsSubsection === 'info' && activeSettingsEntry === 'apps') && <MerchantWorkspaceHeader
            title={settingsSubsection === 'info' ? merchantSettingsEntryLabel(activeSettingsEntry) : settingsSubsection === 'general' ? '常规设置' : settingsSubsection === 'rules' ? '经营规则' : settingsSubsection === 'payments' ? '支付设置' : settingsSubsection === 'notifications' ? '通知设置' : settingsSubsection === 'mobile' ? '手机偏好' : settingsSubsection === 'team' ? '用户管理' : settingsSubsection === 'roles' ? '角色权限' : settingsSubsection === 'language' ? '语言设置' : '设置说明'}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            action={<div className="flex gap-2">
              <button type="button" onClick={openMerchantHome} className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700">{localizeCopy('返回工作台', 'Torna al pannello')}</button>
              {['general', 'rules', 'notifications', 'mobile'].includes(settingsSubsection) && <button type="button" onClick={() => void saveSettings()} disabled={settingsBusy} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:opacity-50">{settingsBusy ? '保存中…' : '保存设置'}</button>}
            </div>}
          />}
          {settingsSubsection === 'payments' && <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 p-4 sm:p-5">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">线上支付</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500"><span>线上支付取决于</span><span>平台服务配置</span></div>
                </div>
                <button type="button" onClick={() => setMerchantPaymentStatusRefresh(value => value + 1)} disabled={merchantPaymentStatusLoading} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">
                  <RefreshCw className={`h-3.5 w-3.5 ${merchantPaymentStatusLoading ? 'animate-spin' : ''}`} />刷新状态
                </button>
              </div>
              {merchantPaymentStatusError
                ? <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 sm:m-5">付款状态读取失败：{merchantPaymentStatusError}。请刷新重试；未确认状态前不要向顾客承诺线上付款已开通。</div>
                : <div className="p-4 sm:p-5">
                  <div className={`rounded-xl border p-4 ${merchantPaymentStatus?.onlineCheckoutEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {merchantPaymentStatus?.onlineCheckoutEnabled ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
                        <h3 className="text-sm font-bold text-neutral-900">{merchantPaymentStatusLoading && !merchantPaymentStatus ? '正在读取线上付款状态…' : merchantPaymentStatus?.onlineCheckoutEnabled ? '线上卡付款已启用' : '线上卡付款未启用'}</h3>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${merchantPaymentStatus?.onlineCheckoutEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{merchantPaymentStatus?.onlineCheckoutEnabled ? '可用' : '未启用'}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-700"><span>{merchantPaymentStatus?.onlineCheckoutEnabled ? `RUDA ${merchantPaymentStatus.provider === 'stripe' ? 'Stripe' : merchantPaymentStatus.provider} 已就绪` : 'RUDA 卡支付未启用'}</span><span>可连接 Stripe / PayPal</span></div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-neutral-900">RUDA 线上卡支付</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${merchantPaymentStatus?.onlineCheckoutEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{merchantPaymentStatus?.onlineCheckoutEnabled ? '已就绪' : merchantPaymentStatusLoading && !merchantPaymentStatus ? '读取中' : '未启用'}</span></div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>平台级收款</span><span>与商家 Stripe 分开</span><span>款项进入平台账户</span></div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-4 sm:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-neutral-900">Stripe · 商家自有收款账户</h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${merchantStripeStatus?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{merchantStripeStatus?.enabled ? '已连接' : '未连接'}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>验证 Secret Key</span><span>启用 Stripe Checkout</span><span>卡款直达商家账户</span></div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-amber-700"><span>仅限单商家购物车</span><span>退款走商家 Stripe</span><span>勿填 pk_ / rk_</span></div>
                        </div>
                        {merchantStripeStatus?.configured && <button type="button" onClick={() => void disconnectStripe()} disabled={stripeCredentialsBusy} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-50">{stripeCredentialsBusy ? '处理中…' : '断开 Stripe'}</button>}
                      </div>
                      {merchantStripeStatus?.configured && <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[10px] text-neutral-600">
                        账户：{merchantStripeStatus.accountId || '已验证'} · 环境：{merchantStripeStatus.livemode ? 'Live 正式收款' : 'Test 测试模式'} · Secret Key：加密保存在服务端，不会再次显示。
                      </p>}
                      <form onSubmit={event => void saveStripeCredentials(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-[11px] font-semibold text-neutral-700 sm:col-span-2">Stripe Secret Key
                          <PasswordInput required={!merchantStripeStatus?.configured} minLength={20} maxLength={512} autoComplete="new-password" value={stripeSecretKey} onChange={event => setStripeSecretKey(event.target.value)} placeholder={merchantStripeStatus?.configured ? '留空保留现有密钥；输入新密钥可轮换' : '粘贴 sk_test_… 或 sk_live_…'} className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-10 text-xs font-normal" />
                        </label>
                        <div className="flex items-end">
                          <button type="submit" disabled={stripeCredentialsBusy} className="h-10 w-full rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">{stripeCredentialsBusy ? '验证并保存中…' : merchantStripeStatus?.configured ? '验证并更新密钥' : '验证并连接 Stripe'}</button>
                        </div>
                        <div className="self-center flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>校验账户与环境</span><span>TLS 传输</span><span>AES-GCM 加密</span><span>测试卡不扣款</span></div>
                      </form>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-4 sm:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2"><h3 className="text-xs font-bold text-neutral-900">PayPal · 商家自有收款账户</h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${merchantPayPalStatus?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{merchantPayPalStatus?.enabled ? '已连接' : '未连接'}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>商家自备应用凭证</span><span>授权后服务端捕获</span><span>同步订单状态</span></div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-amber-700"><span>退款需手动处理</span><span>在 PayPal 操作</span><span>不走平台银行卡</span></div>
                        </div>
                        {merchantPayPalStatus?.configured && <button type="button" onClick={() => void disconnectPayPal()} disabled={paypalCredentialsBusy} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-50">{paypalCredentialsBusy ? '处理中…' : '断开 PayPal'}</button>}
                      </div>
                      {merchantPayPalStatus?.configured && <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[10px] text-neutral-600">
                        环境：{merchantPayPalStatus.environment === 'live' ? '正式收款' : '沙盒测试'} · Client ID：••••{merchantPayPalStatus.clientIdHint || '已保存'} · Secret：加密保存在服务端，不会再次显示。
                      </p>}
                      <form onSubmit={event => void savePayPalCredentials(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-[11px] font-semibold text-neutral-700">PayPal Client ID
                          <input required={!merchantPayPalStatus?.configured} minLength={8} maxLength={512} autoComplete="off" value={paypalCredentialsForm.clientId} onChange={event => setPaypalCredentialsForm(previous => ({ ...previous, clientId: event.target.value }))} placeholder={merchantPayPalStatus?.configured ? '留空保留现有 Client ID' : '粘贴 Client ID'} className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs font-normal" />
                        </label>
                        <label className="text-[11px] font-semibold text-neutral-700">PayPal Secret
                          <PasswordInput required={!merchantPayPalStatus?.configured} minLength={8} maxLength={512} autoComplete="new-password" value={paypalCredentialsForm.clientSecret} onChange={event => setPaypalCredentialsForm(previous => ({ ...previous, clientSecret: event.target.value }))} placeholder={merchantPayPalStatus?.configured ? '留空保留现有 Secret' : '粘贴 Secret'} className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-10 text-xs font-normal" />
                        </label>
                        <label className="text-[11px] font-semibold text-neutral-700">PayPal 环境
                          <select value={paypalCredentialsForm.environment} onChange={event => setPaypalCredentialsForm(previous => ({ ...previous, environment: event.target.value as 'sandbox' | 'live' }))} className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs font-normal">
                            <option value="sandbox">沙盒测试（Sandbox）</option><option value="live">正式收款（Live）</option>
                          </select>
                        </label>
                        <div className="flex items-end">
                          <button type="submit" disabled={paypalCredentialsBusy} className="h-10 w-full rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">{paypalCredentialsBusy ? '验证并保存中…' : merchantPayPalStatus?.configured ? '验证并更新凭证' : '验证并连接 PayPal'}</button>
                        </div>
                        <div className="sm:col-span-2 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>保存前验证环境</span><span>留空保留密钥</span><span>填新值可轮换</span><span>TLS 传输</span><span>AES-GCM 加密</span><span>密钥仅用于本店订单</span><span>浏览器不返回密钥</span><span>先 Sandbox 测试</span><span>确认后切 Live</span></div>
                      </form>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 sm:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-neutral-900">Solana Pay · 商家钱包绑定</h3>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${merchantSolanaStatus?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{merchantSolanaStatus?.enabled ? '已连接' : '未连接'}</span>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-neutral-600">仅支持 Solana (SPL) 主网 USDC 或 EURC。可创建并绑定 Privy 嵌入式钱包，也可粘贴其他 Solana 钱包的公开地址；顾客必须从 Solana 网络付款。</p>
                        </div>
                        {merchantSolanaStatus?.configured && <button type="button" onClick={() => void disconnectSolanaWallet()} disabled={solanaConfigBusy} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-50">{solanaConfigBusy ? '处理中…' : '断开钱包'}</button>}
                      </div>
                      {merchantSolanaStatus?.configured && <p className="mt-2 break-all rounded-lg bg-white p-2 text-[10px] text-neutral-600">当前收款公钥：{merchantSolanaStatus.walletAddress}</p>}
                      <form onSubmit={event => void saveSolanaWallet(event)} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                        <label className="text-[11px] font-semibold text-neutral-700 sm:col-span-3">请输入您的 Solana 钱包地址（支持接收 USDC/EURC）
                          <input required minLength={32} maxLength={44} autoComplete="off" spellCheck={false} value={solanaWalletAddress} onChange={event => setSolanaWalletAddress(event.target.value)} placeholder="粘贴 Phantom 或 Solflare 的公开钱包地址" className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs font-normal" />
                        </label>
                        <Suspense fallback={<button type="button" disabled className="h-10 rounded-lg border border-violet-300 bg-white px-4 text-xs font-semibold text-violet-900 opacity-50">加载 Privy 钱包组件…</button>}>
                          <LazyPrivySolanaWalletButton disabled={solanaConfigBusy} onWalletAddress={setSolanaWalletAddress} />
                        </Suspense>
                        <button type="submit" disabled={solanaConfigBusy} className="h-10 rounded-lg bg-violet-800 px-4 text-xs font-semibold text-white disabled:opacity-50">{solanaConfigBusy ? '验证并保存中…' : merchantSolanaStatus?.configured ? '更新钱包地址' : '验证并绑定钱包'}</button>
                        <div className="flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500 sm:col-span-3"><span>仅限 Solana 主网</span><span>仅收 USDC / EURC</span><span>App ID 可公开</span><span>密钥勿提交</span><span>私钥勿提交</span><span>助记词勿提交</span><span>一单一地址</span><span>金额锁定</span></div>
                      </form>
                    </div>
                  </div>
                </div>}
            </section>
            <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs">
              <h2 className="font-bold text-neutral-900">自选支付</h2>
              <div className="mt-1 flex flex-wrap gap-2 leading-5 text-neutral-600"><span>支持 Stripe</span><span>支持 PayPal</span><span>支持 Solana Pay</span><span>支付宝未接入</span><span>微信未接入</span><span>需商户凭证</span><span>需回调验签</span><span>IBAN 线下收款</span><span>非在线密钥</span></div>
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-bold text-neutral-900">付款配置</h2>
              <div className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div><h3 className="text-xs font-semibold text-neutral-900">付款入账方式</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>B2B 转账预付</span><span>审核客户可用账期</span><span>POS 人工登记</span></div></div>
                  <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-800">按订单场景提供</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div><h3 className="text-xs font-semibold text-neutral-900">手动付款方式</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>转账可选</span><span>收款说明未接入</span><span>按订单结算对账</span><span>勿填敏感账户</span></div></div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">说明配置未接入</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div><h3 className="text-xs font-semibold text-neutral-900">付款方式自定义</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>不能切换付款方式</span><span>不能改付款名称</span><span>不能加结账说明</span></div></div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">暂不支持</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div><h3 className="text-xs font-semibold text-neutral-900">礼品卡与钱包</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>礼品卡未开放</span><span>余额核销未开放</span><span>Apple Wallet 未开放</span></div></div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">暂不支持</span>
                </div>
              </div>
            </section>
            <MerchantSettingsNote>{localizeCopy('此页管理顾客付款方式；平台结算在财务页，POS 刷卡仅人工登记。', 'Qui si gestiscono i pagamenti clienti; le liquidazioni sono nella sezione finanze e il POS è registrato manualmente.')}</MerchantSettingsNote>
          </div>}
          {settingsSubsection === 'general' && (
            <div className="space-y-3">
              <MerchantSettingsCard
                id="merchant-settings-general"
                title={localizeCopy('商家资料', 'Profilo negozio')}
                description={localizeCopy('店铺名称和联系邮箱为必填项。', 'Nome negozio ed email sono obbligatori.')}
              >
                <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  {([['name','店铺名称'],['companyLegalName','法定主体'],['vatNumber','VAT/税号'],['country','国家/地区'],['city','城市'],['showroomAddress','店铺地址'],['contactPerson','联系人'],['contactPhone','联系电话'],['contactEmail','联系邮箱'],['websiteUrl','官方网站']] as const).map(([key,label]) => (
                    <label key={key} className="font-semibold text-neutral-700">{label}<input required={['name','contactEmail'].includes(key)} value={settingsForm[key]} onChange={event => setSettingsForm(previous => ({ ...previous, [key]: event.target.value }))} placeholder={key === 'websiteUrl' ? 'https://www.example.com 或 www.example.com' : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900" /></label>
                  ))}
                  <label className="font-semibold text-neutral-700">地图纬度<input inputMode="decimal" value={settingsForm.mapLatitude} onChange={event => setSettingsForm(previous => ({ ...previous, mapLatitude: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900" placeholder="留空时按地址搜索地图" /></label>
                  <label className="font-semibold text-neutral-700">地图经度<input inputMode="decimal" value={settingsForm.mapLongitude} onChange={event => setSettingsForm(previous => ({ ...previous, mapLongitude: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900" placeholder="必须与纬度同时填写" /></label>
                </div>
              </MerchantSettingsCard>
              <div className="grid gap-3 md:grid-cols-2">
                <MerchantSettingsCard title={localizeCopy('商店默认设置', 'Impostazioni predefinite del negozio')}>
                  <MerchantSettingsFacts facts={[
                    { label: localizeCopy('POS 价格币种', 'Valuta prezzi POS'), value: 'EUR (€)' },
                    { label: localizeCopy('库存计量', 'Unità inventario'), value: localizeCopy('件', 'Pezzi') },
                    { label: localizeCopy('店铺时区', 'Fuso orario negozio'), value: localizeCopy('无独立设置', 'Non configurabile') }
                  ]} />
                  <p className="mt-3 text-[11px] leading-5 text-neutral-500">{localizeCopy('币种与计量固定，重量与时区不可单独配置。', 'Valuta e unità fisse; peso e fuso non configurabili.')}</p>
                </MerchantSettingsCard>
                <MerchantSettingsCard
                  title={localizeCopy('订单编号与处理', 'ID ordine e gestione')}
                  actions={<button type="button" onClick={() => { setSidebarNavExpanded(null); setActiveTab('orders'); }} className={merchantSettingsSecondaryButtonClass}>{localizeCopy('打开订单履约', 'Apri ordini')}</button>}
                >
                  <MerchantSettingsScopeList items={[
                    { label: localizeCopy('订单编号', 'ID ordine'), state: localizeCopy('系统生成', 'Generato'), tone: 'ready' },
                    { label: localizeCopy('前缀格式', 'Prefisso'), state: localizeCopy('不可修改', 'Fisso'), tone: 'unavailable' },
                    { label: localizeCopy('订单状态', 'Stato ordine'), state: localizeCopy('订单履约', 'Negli ordini'), tone: 'ready' }
                  ]} />
                </MerchantSettingsCard>
                <MerchantSettingsCard
                  className="md:col-span-2"
                  title={localizeCopy('商店素材与所有权', 'Risorse e proprietà')}
                  actions={<button type="button" onClick={() => runMerchantSettingsEntry('sales-channels')} className={merchantSettingsSecondaryButtonClass}>{localizeCopy('打开店铺展示设置', 'Apri vetrina')}</button>}
                >
                  <MerchantSettingsScopeList items={[
                    { label: localizeCopy('店铺图片与视频', 'Immagini e video'), state: localizeCopy('店铺展示', 'Vetrina'), tone: 'ready' },
                    { label: localizeCopy('所有权转移', 'Trasferimento'), state: localizeCopy('未开放', 'Non disponibile'), tone: 'unavailable' }
                  ]} />
                </MerchantSettingsCard>
              </div>
            </div>
          )}
          {settingsSubsection === 'rules' && (
            <div id="merchant-settings-rules" className="grid scroll-mt-6 gap-3 lg:grid-cols-2">
              <MerchantSettingsCard
                title={localizeCopy('营业与订单规则', 'Regole ordine')}
                description={localizeCopy('保存后作为新订单和新商品的默认值。', 'Valori predefiniti per nuovi ordini e prodotti.')}
              >
                <div className="space-y-3 text-xs">
                  <label className="block font-semibold text-neutral-700">{localizeCopy('全店默认 MOQ（件）', 'MOQ predefinito (pezzi)')}<input type="number" min="1" max="100000" value={settingsForm.moq} onChange={event => setSettingsForm(previous => ({ ...previous, moq: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900" /><span className="mt-1 block font-normal text-neutral-500">{localizeCopy('仅预填新商品', 'Solo precompilazione prodotti')}</span></label>
                  <label className="block font-semibold text-neutral-700">{localizeCopy('默认账期', 'Termini predefiniti')}<select value={settingsForm.defaultPaymentTerm} onChange={event => setSettingsForm(previous => ({ ...previous, defaultPaymentTerm: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900"><option value="prepaid">{localizeCopy('预付', 'Anticipato')}</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option><option value="net_60">Net 60</option></select></label>
                  <label className="block font-semibold text-neutral-700">{localizeCopy('运费说明', 'Note di spedizione')}<textarea maxLength={500} rows={3} value={settingsForm.shippingNote} onChange={event => setSettingsForm(previous => ({ ...previous, shippingNote: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-neutral-900" placeholder={localizeCopy('例如：满 €500 免运费，偏远地区另计', 'Es.: spedizione gratuita oltre €500')} /></label>
                </div>
              </MerchantSettingsCard>
              <MerchantSettingsCard title={localizeCopy('规则边界', 'Limiti delle regole')}>
                <MerchantSettingsScopeList items={[
                  { label: localizeCopy('MOQ 预填', 'MOQ precompilato'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('只影响新商品，不改已发布商品。', 'Solo nuovi prodotti; non modifica quelli pubblicati.') },
                  { label: localizeCopy('默认账期', 'Termini predefiniti'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('作为新订单默认值，可逐单调整。', 'Valore iniziale per nuovi ordini, modificabile.') },
                  { label: localizeCopy('运费说明', 'Note di spedizione'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('文本说明，不参与运费计算。', 'Testo informativo, non calcola le spese.') },
                  { label: localizeCopy('自动计税与运费', 'Imposte e spese automatiche'), state: localizeCopy('未接入', 'Non collegato'), tone: 'unavailable' }
                ]} />
              </MerchantSettingsCard>
            </div>
          )}
          {settingsSubsection === 'notifications' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <MerchantSettingsCard
                id="merchant-settings-notifications"
                title={localizeCopy('通知偏好', 'Preferenze avvisi')}
                description={localizeCopy('按业务类型开启后台提醒。', 'Attiva gli avvisi per tipo di attività.')}
              >
                <div className="space-y-2 text-xs">{([['notifyOrders','订单与发货通知'],['notifyPayouts','结算与收款通知'],['notifyVault','私密货盘申请通知'],['notifyMarketing','平台活动与营销通知']] as const).map(([key,label]) => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-3"><span>{label}</span><input type="checkbox" checked={settingsForm[key]} onChange={event => setSettingsForm(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-neutral-900" /></label>)}</div>
              </MerchantSettingsCard>
              <MerchantSettingsCard title={localizeCopy('通知边界', 'Limiti notifiche')}>
                <MerchantSettingsScopeList items={[
                  { label: localizeCopy('商家后台提醒', 'Avvisi del portale'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('保存后立即应用于当前账号。', 'Attivi subito per questo account.') },
                  { label: localizeCopy('客户邮件模板', 'Template email clienti'), state: localizeCopy('未接入', 'Non collegato'), tone: 'unavailable' },
                  { label: localizeCopy('事件自动化', 'Automazioni eventi'), state: localizeCopy('未接入', 'Non collegato'), tone: 'unavailable' }
                ]} />
                <div className="mt-3"><MerchantSettingsNote>{localizeCopy('这里控制企业中心提醒偏好，不是客户营销群发。', 'Queste sono preferenze interne, non invii marketing ai clienti.')}</MerchantSettingsNote></div>
              </MerchantSettingsCard>
            </div>
          )}
          {settingsSubsection === 'mobile' && (
            <div id="merchant-settings-mobile" className="grid scroll-mt-6 gap-3 lg:grid-cols-2">
              <MerchantSettingsCard
                title={localizeCopy('手机端设置', 'Impostazioni mobile')}
                description={localizeCopy('设置会同步到商家手机端和 PWA，无需逐台手机重复配置。', 'Le impostazioni si sincronizzano su mobile e PWA.')}
              >
                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                  <label className="block font-semibold text-neutral-700">{localizeCopy('手机端首页', 'Pagina iniziale')}<select value={settingsForm.mobileDefaultTab} onChange={event => setSettingsForm(previous => ({ ...previous, mobileDefaultTab: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal outline-none focus:border-neutral-900"><option value="dashboard">{localizeCopy('经营看板', 'Panoramica')}</option><option value="orders">{localizeCopy('订单履约', 'Ordini')}</option><option value="inventory">{localizeCopy('库存', 'Scorte')}</option><option value="customers">{localizeCopy('客户', 'Clienti')}</option><option value="new_styles">{localizeCopy('新品', 'Novità')}</option><option value="profile">{localizeCopy('设置', 'Impostazioni')}</option></select></label>
                  <div className="rounded-xl border border-neutral-200 p-2.5">
                    <span className="block font-semibold text-neutral-700">{localizeCopy('手机端语言', 'Lingua mobile')}</span>
                    <span className="mt-1 block font-normal text-neutral-500">
                      {localizeCopy('跟随商家账户语言', 'Segue la lingua account')}：{languagePreference === 'auto' ? localizeCopy('跟随浏览器', 'Browser') : LANGUAGE_OPTIONS.find(language => language.code === languagePreference)?.nativeName}
                    </span>
                  </div>
                  <div className="space-y-2 md:col-span-2"><label className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-3 font-normal"><span>{localizeCopy('手机运营提醒', 'Avvisi operativi')}</span><input type="checkbox" checked={settingsForm.mobileAlerts} onChange={event => setSettingsForm(previous => ({ ...previous, mobileAlerts: event.target.checked }))} className="h-4 w-4 accent-neutral-900" /></label><label className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-3 font-normal"><span>{localizeCopy('紧凑显示', 'Visualizzazione compatta')}</span><input type="checkbox" checked={settingsForm.mobileCompact} onChange={event => setSettingsForm(previous => ({ ...previous, mobileCompact: event.target.checked }))} className="h-4 w-4 accent-neutral-900" /></label></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigateToAppTarget('merchant-admin-mobile')} className={merchantSettingsSecondaryButtonClass}>{localizeCopy('在当前设备打开手机端', 'Apri versione mobile')}</button>
                  <button type="button" onClick={resetMobileSettings} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">{localizeCopy('恢复手机端默认设置', 'Ripristina impostazioni mobile')}</button>
                </div>
              </MerchantSettingsCard>
              <MerchantSettingsCard title={localizeCopy('同步范围', 'Ambito di sincronizzazione')}>
                <MerchantSettingsScopeList items={[
                  { label: localizeCopy('首页与显示偏好', 'Home e visualizzazione'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('手机端和桌面端共用同一账号设置。', 'Le stesse impostazioni su mobile e desktop.') },
                  { label: localizeCopy('运营提醒', 'Avvisi operativi'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready' },
                  { label: localizeCopy('设备级通知权限', 'Permessi notifiche del dispositivo'), state: localizeCopy('需人工', 'Manuale'), tone: 'manual', detail: localizeCopy('仍需在手机系统设置中允许通知。', 'Richiede autorizzazione nelle impostazioni del telefono.') }
                ]} />
              </MerchantSettingsCard>
            </div>
          )}
          {settingsSubsection === 'language' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <MerchantSettingsCard
                id="merchant-settings-language"
                title={localizeCopy('商家账户语言', 'Lingua dell’account merchant')}
                description={localizeCopy('语言选择应用于整个企业中心。', 'La scelta si applica a tutto il centro aziendale.')}
              >
                <div className="flex justify-end"><LanguagePicker /></div>
              </MerchantSettingsCard>
              <MerchantSettingsCard title={localizeCopy('翻译范围', 'Ambito traduzioni')}>
                <MerchantSettingsScopeList items={[
                  { label: localizeCopy('后台界面语言', 'Interfaccia del portale'), state: localizeCopy('可用', 'Disponibile'), tone: 'ready', detail: localizeCopy('切换后立即应用于当前账号。', 'Attiva subito per questo account.') },
                  { label: localizeCopy('商品标题与描述', 'Titoli e descrizioni prodotto'), state: localizeCopy('需人工', 'Manuale'), tone: 'manual', detail: localizeCopy('需在商品中分别维护语言版本。', 'Versioni linguistiche da gestire nei prodotti.') },
                  { label: localizeCopy('店铺公开文案', 'Testi pubblici della vetrina'), state: localizeCopy('需人工', 'Manuale'), tone: 'manual', detail: localizeCopy('政策与介绍需在店铺展示中单独填写。', 'Policy e testi da compilare nella vetrina.') },
                  { label: localizeCopy('自动翻译', 'Traduzione automatica'), state: localizeCopy('未接入', 'Non collegato'), tone: 'unavailable' }
                ]} />
              </MerchantSettingsCard>
            </div>
          )}
          {settingsSubsection === 'info' && activeSettingsEntry === 'apps' && (
            <Suspense fallback={<div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">应用商店正在加载…</div>}>
              {activeStoreAppId === 'ruda-business-email'
                ? <MerchantEmailDomains onBack={() => setActiveStoreAppId(null)} />
                : activeStoreAppId === 'ruda-production-chain'
                  ? <MerchantProductionChain onBack={() => setActiveStoreAppId(null)} />
                  : <MerchantAppStore onOpenApp={setActiveStoreAppId} />}
            </Suspense>
          )}
          {settingsSubsection === 'info' && activeSettingsEntry !== 'apps' && (() => {
            const panel = getMerchantSettingsInfoPanel();
            if (!panel) return null;
            return (
              <div className="space-y-3">
                <MerchantSettingsSummary summary={panel.summary} status={panel.status} actions={panel.actions} />
                {activeSettingsEntry === 'security' && <PasswordChangeForm audience="merchant" />}
                <div className="grid gap-3 lg:grid-cols-2">
                  <MerchantSettingsCard title={panel.scopeLabel}>
                    <MerchantSettingsScopeList items={panel.scope} />
                  </MerchantSettingsCard>
                  {panel.facts && panel.facts.length > 0 && (
                    <MerchantSettingsCard title={panel.factsLabel}>
                      <MerchantSettingsFacts facts={panel.facts} />
                    </MerchantSettingsCard>
                  )}
                </div>
                {panel.note && <MerchantSettingsNote tone={panel.note.tone}>{panel.note.text}</MerchantSettingsNote>}
              </div>
            );
          })()}
          {settingsSubsection === 'roles' && <section id="merchant-team-settings" className="space-y-4 scroll-mt-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">角色权限</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-5 text-neutral-500"><span>角色是权限模板</span><span>不是登录账号</span><span>固定岗位模板</span><span>逐人可调权限</span></div>
                </div>
                <button type="button" onClick={() => openTeamSettings('team')} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">管理用户权限</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(rolePermissionDefaults) as TeamEmployee['role'][]).map(role => {
                  const roleEmployees = teamEmployees.filter(employee => employee.role === role);
                  return <article key={role} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div><h3 className="text-sm font-semibold text-neutral-900">{employeeRoleLabels[role]}</h3><p className="mt-1 text-[11px] leading-4 text-neutral-500">{employeeRoleDescriptions[role]}</p></div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{teamLoadError ? '人数不可用' : teamLoading ? '加载中…' : `${roleEmployees.length} 人`}</span>
                    </div>
                    <p className="mt-3 text-[10px] font-semibold text-neutral-600">模板权限 · {rolePermissionDefaults[role].length} 项</p>
                    <div className="mt-2 flex flex-wrap gap-1">{rolePermissionDefaults[role].map(permission => <span key={permission} className="rounded-full bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600">{employeePermissionOptions.find(([key]) => key === permission)?.[1] || permission}</span>)}</div>
                    {roleEmployees.length > 0 && <p className="mt-3 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500">当前账号权限可由管理员逐人覆盖模板，以上为新账号默认权限。</p>}
                  </article>;
                })}
              </div>
              {teamLoadError && <div role="alert" className="mt-3 flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><span>用户人数不可读</span><span>岗位模板可查</span><span>请用授权账号查看</span></div>}
              <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900"><span>自定义角色未开放</span><span>固定岗位模板</span><span>POS 仅销售开单</span><span>不含员工管理</span><span>套餐配额未接入</span></div>
            </div>
          </section>}
          {settingsSubsection === 'team' && (
            <div id="merchant-team-settings" className="scroll-mt-6">
              <MerchantTeamManagement notify={addNotification} scopeKey={currentMerchantId} showRolesOverview={false} />
            </div>
          )}
        </div>
        </div>
      )}

      {inventoryAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-bold text-neutral-900">修改商品件数</h3><p className="mt-1 text-xs text-neutral-500">{inventoryAdjustment.balance.product.styleNo} · {inventoryAdjustment.balance.sku} · 当前仓库</p></div>
              <button type="button" onClick={() => setInventoryAdjustment(null)} className="text-xl text-neutral-400">×</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">当前在库</span><strong className="mt-1 block text-lg">{inventoryAdjustment.balance.onHandQuantity}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">当前可用</span><strong className="mt-1 block text-lg text-emerald-700">{inventoryAdjustment.balance.availableQuantity}</strong></div>
            </div>
            <label className="mt-4 block text-xs font-semibold text-neutral-700">修改后商品件数<input type="number" min="0" step="1" value={inventoryAdjustment.quantity} onChange={event => setInventoryAdjustment(previous => previous ? { ...previous, quantity: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" /></label>
            <label className="mt-3 block text-xs font-semibold text-neutral-700">调整原因<textarea value={inventoryAdjustment.note} onChange={event => setInventoryAdjustment(previous => previous ? { ...previous, note: event.target.value } : previous)} maxLength={500} rows={3} placeholder="例如：到货入库、盘点差异、质检报损" className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 font-normal" /></label>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setInventoryAdjustment(null)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold">取消</button><button type="button" onClick={() => void submitInventoryAdjustment()} disabled={inventoryBusy} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{inventoryBusy ? '保存中...' : '确认调整'}</button></div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: 发布新商品 (NEW PRODUCT MODAL) */}
      {/* ======================================================== */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/55 p-0 backdrop-blur-sm sm:p-4">
          <div className="flex h-dvh w-full max-w-[1440px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(900px,calc(100dvh-32px))] sm:rounded-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-6">
              <div>
                <h3 className="text-base font-semibold text-neutral-950">发布商品</h3>
              </div>
              <button type="button" onClick={() => setIsAddingProduct(false)} aria-label="关闭商品创建" className="flex h-10 w-10 items-center justify-center rounded-md text-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900">×</button>
            </div>
            <MerchantProductCreateForm
              value={newProdData}
              mode={productCreationMode}
              onModeChange={setProductCreationMode}
              onChange={value => {
                setNewProdData(value);
                setProductAiDescriptionDraft('');
              }}
              onSubmit={handleCreateProduct}
              onCancel={() => setIsAddingProduct(false)}
              busy={savingProduct}
              isItalian={isIt}
              canManageCosts={canManageProductCosts}
              descriptionDraft={Boolean(productAiDescriptionDraft)}
            />
          </div>
        </div>
      )}

      {editingProductImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">管理商品图片</h3>
                <p className="mt-1 text-xs text-neutral-500">{editingProductImages.styleNo} · {editingProductImages.name}</p>
              </div>
              <button type="button" onClick={() => setEditingProductImages(null)} className="p-1 text-neutral-400 hover:text-neutral-700">✕</button>
            </div>
            <div className="py-4">
              <SmartMediaUploader value={editingProductImages.media || editingProductImages.images.map((url, index) => ({ id: `legacy-${index}`, type: 'image' as const, url }))} maxItems={32} onChange={media => setEditingProductImages(previous => previous ? { ...previous, media, images: media.filter(item => item.type === 'image').map(item => item.url) } : previous)} isIt={isIt} />
              <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-sky-50 p-3 text-[10px] leading-5 text-sky-800"><span>首图为商品主图</span><span>支持组图与 MP4/WebM</span><span>拖拽排序</span><span>删除后需保存</span></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
              <button type="button" onClick={() => setEditingProductImages(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700">取消</button>
              <button type="button" disabled={savingProductImages || editingProductImages.images.length === 0} onClick={async () => {
                setSavingProductImages(true);
                try {
                  await updateMerchantProduct(editingProductImages.id, { images: editingProductImages.images, media: editingProductImages.media });
                  setEditingProductImages(null);
                  addNotification('success', '商品图片已保存', `${editingProductImages.images.length} 张图片已同步到服务器`);
                } catch (error) {
                  addNotification('warning', '图片保存失败', error instanceof Error ? error.message : '请稍后重试');
                } finally {
                  setSavingProductImages(false);
                }
              }} className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingProductImages ? '保存中...' : '保存图片变更'}</button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div><h3 className="text-base font-bold text-neutral-900">编辑商品资料</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{editingProduct.styleNo}</span><span>保存同步网店</span><span>同步分享页</span></div></div>
              <button type="button" onClick={() => setEditingProduct(null)} className="p-1 text-neutral-400 hover:text-neutral-700">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3 py-4 text-xs sm:grid-cols-2">
              <label className="font-semibold text-neutral-700">款号<input value={editingProduct.styleNo} onChange={event => setEditingProduct(previous => previous ? { ...previous, styleNo: event.target.value.toUpperCase() } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700">商品名称<input value={editingProduct.name} onChange={event => setEditingProduct(previous => previous ? { ...previous, name: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700">商品品类<select value={editingProduct.category} onChange={event => setEditingProduct(previous => previous ? { ...previous, category: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal">{!PRODUCT_CATEGORIES.some(category => category.value === editingProduct.category) && <option value={editingProduct.category}>{getProductCategoryLabel(editingProduct.category, isIt)}</option>}{PRODUCT_CATEGORIES.map(category => <option key={category.value} value={category.value}>{getProductCategoryLabel(category.value, isIt)}</option>)}</select></label>
              <label className="font-semibold text-neutral-700">子分类<input value={editingProduct.subCategory} onChange={event => setEditingProduct(previous => previous ? { ...previous, subCategory: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700">商品展示区<select value={getProductZone(editingProduct)} onChange={event => setEditingProduct(previous => {
                if (!previous) return previous;
                const zone = event.target.value as 'new' | 'clearance' | 'private';
                return {
                  ...previous,
                  ...getProductZoneUpdates(zone)
                };
              })} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal"><option value="new">✨ 现货区</option><option value="clearance">🏷️ 折扣市场</option><option value="private">🔒 授权区</option></select><span className="mt-1 block font-normal text-neutral-500">商品发布后会同步到商家端网店和买手端对应分区。</span></label>
              <label className="font-semibold text-neutral-700">批发价 (€)<input type="number" min="0.01" step="0.01" value={editingProduct.wholesalePrice} onChange={event => setEditingProduct(previous => previous ? { ...previous, wholesalePrice: Number(event.target.value) } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700">量大批发价（100件起，€ / 件）<input type="number" min="0.01" max={editingProduct.wholesalePrice} step="0.01" value={editingProduct.wholesalePrice100 ?? ''} onChange={event => setEditingProduct(previous => previous ? { ...previous, wholesalePrice100: event.target.value === '' ? null : Number(event.target.value) } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /><span className="mt-1 block font-normal text-neutral-500">该款商品累计下单达到100件时自动应用。</span></label>
              <label className="font-semibold text-neutral-700">单位成本 (€ · 仅商家内部)<input type="number" min="0" step="0.01" value={editingProduct.costPrice ?? 0} onChange={event => setEditingProduct(previous => previous ? { ...previous, costPrice: Number(event.target.value) } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /><span className="mt-1 block font-normal text-neutral-500">按批发价估算毛利 €{(editingProduct.wholesalePrice - (editingProduct.costPrice || 0)).toFixed(2)} · 毛利率 {editingProduct.wholesalePrice > 0 ? (((editingProduct.wholesalePrice - (editingProduct.costPrice || 0)) / editingProduct.wholesalePrice) * 100).toFixed(1) : '0.0'}%</span></label>
              <label className="font-semibold text-neutral-700">MOQ<input type="number" min="1" step="1" value={editingProduct.moq} onChange={event => setEditingProduct(previous => previous ? { ...previous, moq: Number(event.target.value) } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700">箱规<input type="number" min="1" step="1" value={editingProduct.packSize} onChange={event => setEditingProduct(previous => previous ? { ...previous, packSize: Number(event.target.value) } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700 sm:col-span-2">面料材质<input value={editingProduct.fabric} onChange={event => setEditingProduct(previous => previous ? { ...previous, fabric: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <label className="font-semibold text-neutral-700 sm:col-span-2">商品描述<textarea rows={4} value={editingProduct.description} onChange={event => setEditingProduct(previous => previous ? { ...previous, description: event.target.value } : previous)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 font-normal" /></label>
              <div className="sm:col-span-2"><div className="mb-1 font-semibold text-neutral-700">商品媒体</div><SmartMediaUploader value={editingProduct.media || editingProduct.images.map((url, index) => ({ id: `legacy-${index}`, type: 'image' as const, url }))} maxItems={32} onChange={media => setEditingProduct(previous => previous ? { ...previous, media, images: media.filter(item => item.type === 'image').map(item => item.url) } : previous)} isIt={isIt} /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
              <button type="button" onClick={() => setEditingProduct(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700">取消</button>
              <button type="button" disabled={savingProduct || !editingProduct.name.trim() || !editingProduct.styleNo.trim() || editingProduct.images.length === 0} onClick={async () => {
                setSavingProduct(true);
                try {
                  await updateMerchantProduct(editingProduct.id, {
                    styleNo: editingProduct.styleNo.trim().toUpperCase(),
                    name: editingProduct.name.trim(),
                    category: editingProduct.category,
                    subCategory: editingProduct.subCategory,
                    status: editingProduct.status,
                    wholesalePrice: Number(editingProduct.wholesalePrice),
                    wholesalePrice100: editingProduct.wholesalePrice100 ?? null,
                    costPrice: Number(editingProduct.costPrice || 0),
                    moq: Number(editingProduct.moq),
                    packSize: Number(editingProduct.packSize),
                    visibility: editingProduct.visibility,
                    isExclusiveProtected: editingProduct.visibility === 'private',
                    fabric: editingProduct.fabric,
                    description: editingProduct.description,
                    images: editingProduct.images
                  });
                  setEditingProduct(null);
                  addNotification('success', '商品资料已保存', '商品详情、图片和分享页已同步更新');
                } catch (error) {
                  addNotification('warning', '商品保存失败', error instanceof Error ? error.message : '请检查填写内容后重试');
                } finally {
                  setSavingProduct(false);
                }
              }} className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingProduct ? '保存中...' : '保存全部修改'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: 订单配货发货 (FULFILLMENT MODAL) */}
      {/* ======================================================== */}
      {selectedOrderForFulfill && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                订单配货发货 · {selectedOrderForFulfill.orderNo}
              </h3>
              <button 
                onClick={() => setSelectedOrderForFulfill(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFulfillSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
                <div className="font-bold text-neutral-900">收件客户: {selectedOrderForFulfill.companyName}</div>
                <div className="text-neutral-600">
                  收件地址: {selectedOrderForFulfill.shippingAddress?.street}, {selectedOrderForFulfill.shippingAddress?.city} ({selectedOrderForFulfill.shippingAddress?.country})
                </div>
                <div className="text-neutral-600">订购件数: {selectedOrderForFulfill.totalQty} 件 · 金额: €{selectedOrderForFulfill.totalAmount.toFixed(2)}</div>
                <div className="pt-1 font-semibold text-amber-700">
                  当前状态：{selectedOrderForFulfill.status === 'placed' || selectedOrderForFulfill.status === 'pending'
                    ? '待审核；接受后将确认供货并通知买家付款'
                    : selectedOrderForFulfill.status === 'confirmed'
                      ? selectedOrderForFulfill.paymentStatus === 'paid' || (selectedOrderForFulfill.paymentMethod === 'net_30' && selectedOrderForFulfill.paymentStatus === 'pending_credit')
                        ? '已付款/账期已确认，可进入配货'
                        : '商家已接受，等待买家付款'
                      : selectedOrderForFulfill.status === 'picking'
                        ? '配货中，将创建发货包裹'
                        : selectedOrderForFulfill.status}
                </div>
              </div>

              {selectedOrderForFulfill.status === 'picking' && (
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <h4 className="mb-2 text-xs font-bold text-neutral-900">本次发货 SKU 数量</h4>
                  <p className="mb-3 text-[11px] leading-5 text-neutral-500">输入本包裹实际发出的数量；未发出的 SKU 可在后续包裹中继续发货。</p>
                  <div className="space-y-2">
                    {selectedOrderForFulfill.items.map(item => {
                      const alreadyShipped = fulfillShipments
                        .filter(shipment => ['shipped', 'delivered', 'exception'].includes(shipment.status))
                        .flatMap(shipment => shipment.items)
                        .filter(shippedItem => shippedItem.orderItemId === item.id)
                        .reduce((sum, shippedItem) => sum + shippedItem.quantity, 0);
                      const remaining = Math.max(0, item.quantity - alreadyShipped);
                      return (
                        <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold text-neutral-800">{item.productName}</span>
                            <span className="mt-0.5 block text-[10px] text-neutral-500">{item.sku} · {item.color} / {item.size} · 剩余 {remaining} 件</span>
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            step={1}
                            value={fulfillQuantities[item.id] ?? remaining}
                            onChange={event => setFulfillQuantities(current => ({
                              ...current,
                              [item.id]: event.target.value === '' ? 0 : Number(event.target.value)
                            }))}
                            aria-label={`${item.productName} ${item.color} ${item.size} 本次发货数量`}
                            className="w-20 shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-right text-xs font-semibold"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedOrderForFulfill.status === 'picking' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <div className="font-semibold">包裹与人工维护的物流事件</div>
                  {fulfillShipmentsLoading ? (
                    <div className="mt-1 text-blue-700">正在读取历史包裹...</div>
                  ) : fulfillShipments.length === 0 ? (
                    <div className="mt-1 text-blue-700">尚未创建包裹。可按上方填写的 SKU 数量创建首个包裹。</div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <div>已创建 {fulfillShipments.length} 个包裹：</div>
                      {fulfillShipments.map(shipment => (
                        <div key={shipment.id} className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                          <span>{shipment.shipmentNo} · {shipment.status}</span>
                          <span>{shipment.carrier || '-'} · {shipment.trackingNumber || '无单号'}</span>
                          <span className="flex gap-1">
                            <button type="button" onClick={() => void loadTrackingEvents(shipment.id)} className="rounded bg-sky-100 px-2 py-1 font-sans font-semibold text-sky-700">轨迹</button>
                            {shipment.status === 'packed' && (
                              <button type="button" onClick={() => void updateShipmentStatus(shipment, 'shipped')} className="rounded bg-emerald-100 px-2 py-1 font-sans font-semibold text-emerald-700">确认已交承运商</button>
                            )}
                            {shipment.status === 'shipped' && (
                              <button type="button" onClick={() => void updateShipmentStatus(shipment, 'exception')} className="rounded bg-rose-100 px-2 py-1 font-sans font-semibold text-rose-700">标记异常</button>
                            )}
                            {shipment.status === 'exception' && (
                              <button type="button" onClick={() => void updateShipmentStatus(shipment, 'shipped')} className="rounded bg-emerald-100 px-2 py-1 font-sans font-semibold text-emerald-700">恢复发货</button>
                            )}
                            {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                              <button type="button" onClick={() => void updateShipmentStatus(shipment, 'cancelled')} className="rounded bg-neutral-200 px-2 py-1 font-sans font-semibold text-neutral-700">取消包裹</button>
                            )}
                          </span>
                        </div>
                      ))}
                    {trackingShipmentId && (
                      <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-2 font-sans">
                        <div className="mb-2 font-semibold text-neutral-800">物流轨迹</div>
                        <div className="space-y-1">
                          {trackingEvents.length === 0 ? <div className="text-neutral-500">暂无轨迹，请录入承运商更新。</div> : trackingEvents.map(event => (
                            <div key={event.id} className="border-b border-neutral-100 pb-1 text-[11px]">
                              <div className="flex justify-between font-semibold"><span>{event.status}</span><span>{new Date(event.occurredAt).toLocaleString()}</span></div>
                              <div className="text-neutral-500">{event.location || '未填写地点'} · {event.description || '无备注'}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                          <input value={trackingEventForm.status} onChange={event => setTrackingEventForm(previous => ({ ...previous, status: event.target.value }))} placeholder="状态" className="rounded border border-neutral-300 px-2 py-1 text-[11px]" />
                          <input value={trackingEventForm.location} onChange={event => setTrackingEventForm(previous => ({ ...previous, location: event.target.value }))} placeholder="地点" className="rounded border border-neutral-300 px-2 py-1 text-[11px]" />
                          <input value={trackingEventForm.description} onChange={event => setTrackingEventForm(previous => ({ ...previous, description: event.target.value }))} placeholder="备注" className="rounded border border-neutral-300 px-2 py-1 text-[11px]" />
                        </div>
                        <button type="button" onClick={() => void addTrackingEvent()} className="mt-2 rounded bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white">保存轨迹</button>
                      </div>
                    )}
                    </div>
                  )}
                </div>
              )}

              {selectedOrderForFulfill.status === 'picking' && <div>
                <label className="font-semibold text-neutral-700 block mb-1">实际承运商</label>
                <input
                  type="text"
                  value={fulfillCarrier}
                  onChange={event => setFulfillCarrier(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="填写该包裹实际承运商"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-medium"
                />
                <p className="mt-1 text-[10px] text-neutral-500">RUDA 当前不会自动查询承运商轨迹；请勿填写未实际使用的承运商。</p>
              </div>}

              {selectedOrderForFulfill.status === 'picking' && <div>
                <label className="font-semibold text-neutral-700 block mb-1">国际物流单号 (Waybill / Tracking No.)</label>
                <input
                  type="text"
                  value={fulfillTracking}
                  onChange={(e) => setFulfillTracking(e.target.value)}
                  required
                  placeholder="填写承运商实际提供的运单号"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-mono"
                />
              </div>}

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">装箱打标附言 (Packing Slip Notes)</label>
                <input
                  type="text"
                  value={fulfillNotes}
                  onChange={(e) => setFulfillNotes(e.target.value)}
                  placeholder="例如：已附官方吊牌与原产地溯源码，外箱打气柱保护"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForFulfill(null)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100 font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={selectedOrderForFulfill.status === 'confirmed'
                    && selectedOrderForFulfill.paymentStatus !== 'paid'
                    && !(selectedOrderForFulfill.paymentMethod === 'net_30' && selectedOrderForFulfill.paymentStatus === 'pending_credit')}
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  {selectedOrderForFulfill.status === 'placed' || selectedOrderForFulfill.status === 'pending'
                    ? '接受订单并确认供货'
                    : selectedOrderForFulfill.status === 'confirmed'
                      ? selectedOrderForFulfill.paymentStatus === 'paid' || (selectedOrderForFulfill.paymentMethod === 'net_30' && selectedOrderForFulfill.paymentStatus === 'pending_credit')
                        ? '开始配货'
                        : '等待客户付款'
                      : '创建包裹并通知买手'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: 创建调拨单 (TRANSFER MODAL) */}
      {/* ======================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900">发起多仓调拨单 (TR-000xxx)</h3>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">调拨款式 (Style)</label>
                <select
                  value={transferData.styleNo}
                  onChange={(e) => setTransferData({ ...transferData, styleNo: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5"
                >
                  {merchantProducts.map(p => (
                    <option key={p.id} value={p.styleNo}>{p.styleNo} - {p.name.slice(0, 20)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">调出仓库 (From)</label>
                  <select
                    value={transferData.fromLocation}
                    onChange={(e) => setTransferData({ ...transferData, fromLocation: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-medium"
                  >
                    <option value="central">Prato 主仓枢纽</option>
                    <option value="central">RUDA 总仓</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">调入仓库 (To)</label>
                  <select
                    value={transferData.toLocation}
                    onChange={(e) => setTransferData({ ...transferData, toLocation: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-medium"
                  >
                    <option value="central">RUDA 总仓</option>
                    <option value="central">Prato 主仓中心</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">调拨数量 (件)</label>
                <input
                  type="number"
                  value={transferData.quantity}
                  onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })}
                  required
                  min="1"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">调拨原因说明</label>
                <input
                  type="text"
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  placeholder="例如：补充展厅现货，应对订货会拿样"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100 font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" /> 提交调拨单
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </main>
    {assistantPanelOpen && (
      <aside className={`merchant-web-assistant fixed inset-y-14 right-0 z-40 flex ${assistantPanelExpanded ? 'left-0 w-screen lg:left-[192px] lg:w-auto' : 'w-[min(360px,94vw)]'} flex-col border-l border-neutral-200 bg-white shadow-2xl ${assistantPanelExpanded ? 'lg:fixed lg:right-0 lg:top-14 lg:z-[60] lg:h-[calc(100vh-3.5rem)] lg:shadow-xl' : 'lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-auto lg:shadow-none'}`}>
        <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
          <div className="relative min-w-0">
            <button type="button" aria-expanded={assistantConversationMenuOpen} onClick={() => { setAssistantConversationMenuOpen(open => !open); setAssistantSettingsOpen(false); }} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100">
              <span className="max-w-44 truncate">{assistantConversationId ? assistantConversations.find(conversation => conversation.id === assistantConversationId)?.title || (isIt ? 'Conversazione' : '对话') : (localizeCopy('新对话', 'Nuova conversazione'))}</span><ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
            </button>
            {assistantConversationMenuOpen && (
              <div className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white p-2 text-xs shadow-xl">
                <button type="button" disabled={assistantBusy} onClick={startNewAssistantConversation} className="w-full rounded-lg px-2.5 py-2 text-left font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">{localizeCopy('开始新对话', 'Inizia una nuova conversazione')}</button>
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold text-neutral-500">{localizeCopy('最近对话', 'Conversazioni recenti')}</p>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {assistantConversations.length ? assistantConversations.slice(0, 12).map(conversation => (
                    <div key={conversation.id} className="flex items-center gap-1 rounded-lg hover:bg-neutral-50">
                      <button type="button" disabled={assistantBusy} onClick={() => void openAssistantConversation(conversation.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left disabled:opacity-50">
                        <span className="block truncate font-medium text-neutral-800">{conversation.title}</span>
                        <span className="mt-0.5 block text-[9px] text-neutral-400">{new Date(conversation.updatedAt).toLocaleString(getIntlLocale(lang), { dateStyle: 'short', timeStyle: 'short' })} · {conversation.messageCount}</span>
                      </button>
                      <button type="button" disabled={assistantBusy} aria-label={localizeCopy('删除对话', 'Elimina conversazione')} onClick={() => void deleteAssistantConversation(conversation.id)} className="mr-1 rounded-md p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )) : <p className="px-2.5 py-3 text-[10px] leading-4 text-neutral-400">{localizeCopy('还没有保存的对话。', 'Nessuna conversazione salvata.')}</p>}
                </div>
                <div className="flex flex-wrap gap-2 px-2.5 pb-1 pt-2 text-[9px] leading-4 text-neutral-400"><span>{localizeCopy('仅本店可见', 'Visibile solo al negozio')}</span><span>{localizeCopy('员工本人可见', 'Visibile al dipendente')}</span></div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label={localizeCopy('助手设置', 'Impostazioni assistente')} aria-expanded={assistantSettingsOpen} onClick={() => { setAssistantSettingsOpen(open => !open); setAssistantConversationMenuOpen(false); setAssistantPromptMenuOpen(false); }} className={`rounded-md p-2 hover:bg-neutral-100 ${assistantUsesPageContext ? 'text-neutral-600' : 'text-neutral-400'}`}><SlidersHorizontal className="h-4 w-4" /></button>
            {assistantSettingsOpen && (
              <div className="absolute right-12 top-12 z-50 w-72 rounded-xl border border-neutral-200 bg-white p-3 text-xs shadow-xl">
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-neutral-50">
                  <input type="checkbox" checked={assistantUsesPageContext} onChange={event => setAssistantUsesPageContext(event.target.checked)} className="mt-0.5 accent-neutral-900" />
                  <span><strong className="block text-neutral-800">{localizeCopy('使用当前页面作为上下文', 'Usa la pagina corrente come contesto')}</strong><span className="mt-1 block text-[10px] leading-4 text-neutral-500">{localizeCopy("当前：{{RUDA_ARG_0}}{{RUDA_ARG_1}}。数据仍受账号权限限制。", "Pagina: {{RUDA_ARG_0}}{{RUDA_ARG_1}}. I dati restano limitati ai permessi dell’account.", [String(assistantContextLabel), String(assistantScopeLabel ? ` · ${assistantScopeLabel}` : '')])}</span></span>
                </label>
                <div className="flex flex-wrap gap-2 px-2 pt-1 text-[9px] leading-4 text-neutral-400"><span>{localizeCopy('仅接收模块标识', 'Contesto del modulo')}</span><span>{localizeCopy('不读未加载内容', 'Nessun contenuto non caricato')}</span></div>
                <div className="mt-2 border-t border-neutral-100 pt-2">
                  <p className="px-2 text-[10px] font-semibold text-neutral-700">{localizeCopy('助手记忆与偏好', 'Preferenze da ricordare')}</p>
                  <div className="flex flex-wrap gap-2 px-2 pt-1 text-[9px] leading-4 text-neutral-500"><span>{localizeCopy('手动保存偏好', 'Salva preferenze')}</span><span>{localizeCopy('勿存密码和账户号', 'Non salvare credenziali')}</span></div>
                  <form onSubmit={event => void saveAssistantMemory(event)} className="mt-2 flex gap-1.5">
                    <input value={assistantMemoryDraft} onChange={event => setAssistantMemoryDraft(event.target.value)} maxLength={500} placeholder={localizeCopy('例如：优先用简体中文、回答简洁', 'Es. Rispondi in modo conciso')} className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2 py-2 text-[10px] outline-none focus:border-neutral-500" />
                    <button type="submit" disabled={assistantMemorySaving || !assistantMemoryDraft.trim()} className="rounded-lg bg-neutral-900 px-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{assistantMemorySaving ? '…' : localizeCopy('记住', 'Salva')}</button>
                  </form>
                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {assistantMemoriesLoading
                      ? <p className="px-2 py-2 text-[9px] text-neutral-400">{localizeCopy('正在读取记忆…', 'Caricamento…')}</p>
                      : assistantMemories.length
                        ? assistantMemories.map(memory => <div key={memory.id} className="flex items-start gap-1 rounded-lg bg-neutral-50 px-2 py-1.5"><span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[9px] leading-4 text-neutral-600">{memory.content}</span><button type="button" aria-label={localizeCopy('删除偏好', 'Elimina preferenza')} onClick={() => void deleteAssistantMemory(memory.id)} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3 w-3" /></button></div>)
                        : <p className="px-2 py-2 text-[9px] text-neutral-400">{localizeCopy('暂无保存的偏好。', 'Nessuna preferenza salvata.')}</p>}
                  </div>
                </div>
              </div>
            )}
            <button type="button" aria-label={assistantPanelExpanded ? (localizeCopy('收窄助手面板', 'Riduci pannello')) : (localizeCopy('展开助手面板', 'Espandi pannello'))} onClick={() => setAssistantPanelExpanded(expanded => !expanded)} className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100">{assistantPanelExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button type="button" aria-label={localizeCopy('关闭助手面板', 'Chiudi assistente')} onClick={() => { setAssistantPanelOpen(false); setAssistantPanelExpanded(false); setAssistantConversationMenuOpen(false); setAssistantSettingsOpen(false); setAssistantPromptMenuOpen(false); }} className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <ModaCoreStageProvider
          life={assistantCoreLife}
          state={assistantCoreState}
          levelRef={assistantCoreLevelRef}
          pulseRef={assistantCorePulseRef}
        >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!assistantHistory.length ? (
            <div className="flex min-h-full flex-col items-center justify-center px-6 pb-10 text-center">
              <ModaCoreAnchor
                kind="hero"
                className="aspect-square w-[min(58vw,220px)] shrink-0 sm:w-[260px] lg:w-[300px]"
              />
              <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-tight text-neutral-950">
                <span className="block">{localizeCopy('你好，', 'Ciao,')}</span>
                <span className="block">{localizeCopy('我是 MODAUI。', 'sono ModaUI.')}</span>
              </h1>
              <p className="mt-2 max-w-[19rem] text-xs leading-5 text-neutral-500">
                {localizeCopy('我可以帮你处理商品、订单、库存、数据分析，并提供时尚行业的专业建议。', 'Gestisco prodotti, ordini, magazzino e dati, con consigli dedicati alla moda.')}
              </p>
              <div className="mt-5 grid w-full max-w-[19rem] grid-cols-1 gap-2">
                {[
                  localizeCopy('帮我查一款商品的库存', 'Controlla le scorte di un prodotto'),
                  localizeCopy('今天有哪些订单需要处理', 'Quali ordini gestire oggi'),
                  localizeCopy('分析最近 30 天的销售情况', 'Analizza le vendite degli ultimi 30 giorni'),
                  localizeCopy('帮我生成新品推广文案', 'Crea il testo promo per un nuovo prodotto')
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={assistantBusy}
                    onClick={() => submitAssistantQuestion(suggestion)}
                    className="inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-left text-[11px] font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50"
                  >
                    <span className="truncate">{suggestion}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`space-y-5 px-4 py-5 ${assistantPanelExpanded ? 'mx-auto w-full max-w-3xl sm:px-8 sm:py-8' : ''}`}>
              {assistantHistory.map((turn, index) => {
                // 只有当前这条助手回复承载粒子小头部，历史回复不再各挂一个头像。
                const isActiveReply = turn.role === 'assistant'
                  && !assistantHistory.slice(index + 1).some(next => next.role === 'assistant');
                return (
                <div key={`${index}-${turn.role}`} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[94%] ${turn.role === 'assistant' && assistantPanelExpanded ? 'w-full max-w-none' : ''}`}>
                    <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 ${assistantPanelExpanded ? 'text-sm leading-7' : 'text-xs leading-5'} ${turn.role === 'user' ? 'bg-neutral-100 text-neutral-800' : 'text-neutral-700'}`}>
                      {isActiveReply && <ModaCoreAnchor kind="reply" className="float-left mr-2.5 mt-0.5 h-8 w-8 rounded-full" />}
                      {turn.text}
                    </div>
                    {turn.role === 'assistant' && turn.product && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                        <div className="flex gap-3 p-2.5">
                          {turn.product.image && <img src={turn.product.image} alt={turn.product.name} className="h-24 w-20 shrink-0 rounded-lg bg-neutral-100 object-cover" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-neutral-900">{turn.product.name}</p>
                            <p className="mt-0.5 text-[10px] text-neutral-500">款号 {turn.product.styleNo}</p>
                            <p className="mt-2 text-base font-bold text-neutral-950">€{turn.product.wholesalePrice.toFixed(2)}</p>
                            {turn.product.wholesalePrice100 != null
                              ? <p className="text-[10px] text-neutral-500">100件起批价 €{turn.product.wholesalePrice100.toFixed(2)}</p>
                              : turn.product.rrpPrice > 0
                                ? <p className="text-[10px] text-neutral-500">建议零售价 €{turn.product.rrpPrice.toFixed(2)}</p>
                                : null}
                            <p className="mt-1 text-[10px] text-neutral-500">起订 {turn.product.moq} 件 · {turn.product.packSize} 件/箱</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => turn.product && openAssistantProduct(turn.product.id)} className="flex w-full items-center justify-center gap-1.5 border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[10px] font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800">
                          <Package className="h-3.5 w-3.5" />查看并定位商品
                        </button>
                      </div>
                    )}
                    {turn.role === 'assistant' && (
                      <AssistantReplyActions
                        className="mt-1"
                        text={turn.text}
                        messageId={turn.id}
                        onBeforeDelete={() => { if (turn.id && assistantRevealRef.current?.messageId === turn.id) finishAssistantReveal(false); }}
                        onDeleted={() => removeAssistantTurn(index)}
                        onError={message => addNotification('warning', '删除回答失败', message)}
                      />
                    )}
                  </div>
                </div>
                );
              })}
              {assistantBusy && (
                <div role="status" className="flex items-start gap-2 text-xs leading-5 text-neutral-500">
                  {assistantHistory[assistantHistory.length - 1]?.role !== 'assistant' && <ModaCoreAnchor kind="reply" className="h-8 w-8 shrink-0" />}
                  <span className="pt-1.5">{localizeCopy('正在读取有权限的数据并分析…', 'Sto controllando i dati accessibili…')}</span>
                </div>
              )}
              {assistantAnswer?.summary?.gmv30d !== undefined && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 p-3 text-[10px]">
                  <div><span className="text-neutral-500">{assistantAnswer.summary.periodLabel || (isIt ? 'Periodo' : '所选期间')} GMV</span><strong className="mt-1 block text-xs text-neutral-900">€{assistantAnswer.summary.gmv30d.toFixed(2)}</strong></div>
                  {assistantAnswer.summary.averageOrderValue !== undefined && <div><span className="text-neutral-500">{localizeCopy('平均客单价', 'Valore medio ordine')}</span><strong className="mt-1 block text-xs text-neutral-900">€{assistantAnswer.summary.averageOrderValue.toFixed(2)}</strong></div>}
                  {assistantAnswer.summary.gmvTrend !== undefined && <div><span className="text-neutral-500">{localizeCopy('较上一期间', 'Variazione periodo')}</span><strong className="mt-1 block text-xs text-neutral-900">{assistantAnswer.summary.gmvTrend > 0 ? '+' : ''}{assistantAnswer.summary.gmvTrend}%</strong></div>}
                  {assistantAnswer.summary.topSellingSkus?.length ? <div className="col-span-2 border-t border-neutral-100 pt-2"><span className="text-neutral-500">{localizeCopy('热销 SKU', 'SKU più venduti')}</span><strong className="mt-1 block text-xs text-neutral-900">{assistantAnswer.summary.topSellingSkus.slice(0, 3).map(([sku, quantity]) => `${sku} (${quantity})`).join(' · ')}</strong></div> : null}
                </div>
              )}
              {assistantAnswer?.summary && (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    [localizeCopy('待处理订单', 'Ordini da gestire'), assistantAnswer.summary.pendingOrders],
                    [localizeCopy('缺货 SKU', 'SKU esauriti'), assistantAnswer.summary.stockouts],
                    [localizeCopy('未完成工单', 'Lavori di produzione'), assistantAnswer.summary.openWorkOrders],
                    [localizeCopy('逾期工单', 'Lavori in ritardo'), assistantAnswer.summary.overdueWorkOrders],
                    [localizeCopy('待处理退货', 'Resi in attesa'), assistantAnswer.summary.pendingReturns],
                    [localizeCopy('待处理调拨', 'Trasferimenti in attesa'), assistantAnswer.summary.pendingTransfers],
                    [localizeCopy('商品数', 'Prodotti'), assistantAnswer.summary.products],
                    [localizeCopy('客户数', 'Clienti'), assistantAnswer.summary.customers],
                    [localizeCopy('待审私密商品', 'Richieste private'), assistantAnswer.summary.pendingVaultRequests],
                    [localizeCopy('待结算批次', 'Pagamenti in attesa'), assistantAnswer.summary.pendingPayouts]
                  ] as Array<[string, number | undefined]>).filter(([, value]) => value !== undefined).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-neutral-50 px-3 py-2"><span className="block text-[9px] text-neutral-500">{label}</span><strong className="mt-0.5 block text-xs text-neutral-800">{value}</strong></div>
                  ))}
                </div>
              )}
              {assistantAnswer?.actions.length ? <div><div className="flex flex-wrap gap-2">{assistantAnswer.actions.map(action => <button type="button" key={action.target} onClick={() => setActiveTab(action.target)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:border-emerald-300 hover:bg-emerald-50">{action.label}</button>)}</div></div> : null}
              <div ref={assistantMessagesEndRef} />
            </div>
          )}
        </div>
        </ModaCoreStageProvider>
        <div className="relative shrink-0 bg-gradient-to-t from-white via-white to-white/90 px-3 pb-3 pt-2">
          {assistantTaskPreview && (
            <section aria-label="ModaUI 任务预览" className="mx-auto mb-2 w-full max-w-3xl rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">执行前预览 · {assistantTaskPreview.workflow}</p>
                  <p className="mt-1 text-neutral-700">{assistantTaskPreview.summary}</p>
                </div>
                <button type="button" aria-label="取消任务预览" onClick={() => setAssistantTaskPreview(null)} className="rounded-md p-1 text-neutral-500 hover:bg-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-neutral-700">{assistantTaskPreview.message}</p>
              <p className="mt-2 text-neutral-600">{assistantTaskPreview.sideEffects}</p>
              <p className="mt-1 text-[10px] text-neutral-500">工具：{assistantTaskPreview.tools.join(' · ') || '无'} · 角色：{assistantTaskPreview.agents.join(' · ')}</p>
              {assistantTaskPreview.requiresApprovalForSensitiveActions && <div className="mt-1 flex gap-2 text-[10px] font-medium text-amber-800"><span>敏感操作需审批</span><span>确认不代审批</span></div>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setAssistantTaskPreview(null)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700">取消</button>
                <button type="button" disabled={assistantBusy} onClick={() => void confirmAssistantTask()} className="rounded-lg bg-neutral-900 px-3 py-1.5 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">{assistantBusy ? '提交中…' : '确认并提交任务'}</button>
              </div>
            </section>
          )}
          {assistantPromptMenuOpen && (
            <div className="absolute bottom-[4.5rem] left-3 z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
              <p className="px-2 py-1.5 text-[10px] font-semibold text-neutral-500">{isIt ? 'Esempi per questa pagina' : `关于“${assistantContextLabel}”的示例问题`}</p>
              {assistantSuggestions.map(question => <button type="button" key={question} disabled={assistantBusy} onClick={() => { setAssistantPromptMenuOpen(false); submitAssistantQuestion(question); }} className="block w-full rounded-lg px-2 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{question}</button>)}
            </div>
          )}
          <form onSubmit={event => { event.preventDefault(); submitAssistantQuestion(assistantQuestion); }} className={`flex items-end gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-neutral-400 ${assistantPanelExpanded ? 'mx-auto w-full max-w-3xl' : ''}`}>
            <button type="button" aria-pressed={assistantTaskMode} aria-label={assistantTaskMode ? localizeCopy('关闭任务模式', 'Disattiva modalità attività') : localizeCopy('任务模式', 'Modalità attività')} title={localizeCopy('任务模式', 'Modalità attività')} onClick={() => setAssistantTaskMode(enabled => !enabled)} disabled={assistantBusy} className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${assistantTaskMode ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label={localizeCopy('查看示例问题', 'Mostra esempi di domande')} aria-expanded={assistantPromptMenuOpen} onClick={() => { setAssistantPromptMenuOpen(open => !open); setAssistantSettingsOpen(false); setAssistantConversationMenuOpen(false); }} className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"><Plus className="h-4 w-4" /></button>
            <textarea
              aria-label={localizeCopy('与 GPTmoda 协作', 'Collabora con GPTmoda')}
              value={assistantQuestion}
              onChange={event => {
                setAssistantQuestion(event.target.value);
                // 只在首页大核心阶段（还没有对话）响应按键；回复里的小头部不跟键盘跳动。
                if (!assistantHistory.length) assistantCoreLife.emit({ type: 'input:change', length: event.target.value.length });
              }}
              onFocus={() => { if (!assistantHistory.length) assistantCoreLife.emit({ type: 'input:focus' }); }}
              onBlur={() => assistantCoreLife.emit({ type: 'input:blur' })}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitAssistantQuestion(assistantQuestion); } }}
              rows={1}
              placeholder={assistantInputPlaceholder}
              className="max-h-28 min-h-8 min-w-0 flex-1 resize-y border-0 bg-transparent px-1 py-1.5 text-xs text-neutral-900 outline-none focus:ring-0"
            />
            <button type="submit" aria-label={localizeCopy('发送消息', 'Invia messaggio')} disabled={assistantBusy || !assistantQuestion.trim()} className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40">{assistantBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
          </form>
          <p className="mt-2 text-center text-[9px] text-neutral-400">{assistantTaskMode
            ? '任务将通过服务端工作流执行；发布、发送等敏感操作仍需单独审批。'
            : localizeCopy('助手可能出错；经营数据请核对，具体修改请在业务页面确认。', 'Verifica i dati; le modifiche vanno confermate nelle pagine operative.')}</p>
        </div>
      </aside>
    )}
      {businessCardOpen && (
        <MerchantBusinessCard merchant={currentMerchant} onClose={() => setBusinessCardOpen(false)} />
      )}
    </div>
  );
};

const CustomerEditorModal: React.FC<{
  title: string;
  form: { companyName: string; contactPerson: string; email: string; vatNumber: string; address: string; city: string; country: string; phone: string; businessType: string; merchantNotes: string; merchantTags: string };
  busy: boolean;
  onChange: React.Dispatch<React.SetStateAction<{ companyName: string; contactPerson: string; email: string; vatNumber: string; address: string; city: string; country: string; phone: string; businessType: string; merchantNotes: string; merchantTags: string }>>;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}> = ({ title, form, busy, onChange, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm">
    <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between border-b border-neutral-100 pb-4"><div><h3 className="text-lg font-bold text-neutral-950">{title}</h3><div className="mt-1 flex gap-2 text-[10px] text-neutral-500"><span>同步企业中心</span><span>同步手机端</span></div></div><button type="button" onClick={onClose} className="text-xl text-neutral-400">×</button></div>
      <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        {([['companyName', '公司名称', true], ['contactPerson', '联系人', true], ['email', '联系邮箱', true], ['vatNumber', 'VAT / P.IVA', true], ['phone', '联系电话', true], ['city', '城市', true], ['country', '国家', true], ['address', '公司地址', true]] as const).map(([key, label, required]) => <label key={key} className={`font-semibold text-neutral-700 ${key === 'address' ? 'sm:col-span-2' : ''}`}>{label}<input required={required} value={form[key]} onChange={event => onChange(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 font-normal outline-none focus:border-neutral-900" /></label>)}
        <label className="font-semibold text-neutral-700">经营类型<select value={form.businessType} onChange={event => onChange(previous => ({ ...previous, businessType: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 font-normal"><option>Boutique</option><option>Retail Store</option><option>Online Store</option><option>Distributor</option><option>Other</option></select></label>
        <label className="font-semibold text-neutral-700">商家私有标签（逗号分隔）<input maxLength={1000} value={form.merchantTags} onChange={event => onChange(previous => ({ ...previous, merchantTags: event.target.value }))} placeholder="例如：VIP, 重点跟进" className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 font-normal outline-none focus:border-neutral-900" /></label>
        <label className="font-semibold text-neutral-700 sm:col-span-2">内部备注<textarea maxLength={2000} rows={3} value={form.merchantNotes} onChange={event => onChange(previous => ({ ...previous, merchantNotes: event.target.value }))} placeholder="仅当前商家可见，不会发送给客户。" className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 font-normal outline-none focus:border-neutral-900" /></label>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700">取消</button><button type="submit" disabled={busy} className="rounded-lg bg-neutral-950 px-5 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? '保存中...' : '保存客户资料'}</button></div>
    </form>
  </div>
);

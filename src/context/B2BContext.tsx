import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { 
  Product, 
  CartItem, 
  ProductReservationRequest,
  ProductReservationRequestItem,
  Order, 
  Showroom, 
  Appointment, 
  WholesaleCustomer, 
  SavedCart,
  CustomerTier,
  CustomerDocument,
  CustomSampleInquiry,
  StockInboundRecord,
  StockTransferRecord,
  Merchant,
  VaultAccessRequest,
  AuditLogRecord,
  MerchantPayoutRecord,
  ReorderAnalysis,
  ReorderItemAnalysis,
  VaultAccessAuditLog,
  CartVerificationResult,
  WarehouseCode,
  Consumer,
  ConsumerAddress,
  ConsumerCartItem,
  ConsumerOrder,
  ExtendedB2BView,
  PromotionRule,
  PromotionCalculationResult,
  BuyerRfqView,
  CreateBuyerRfqInput,
  SubmitRfqQuoteInput,
  MessageThreadSummary,
  ChatMessage,
  RiskAlert,
  ExchangeRatesSnapshot,
  SupportedCurrency,
  SolanaTokenSymbol,
} from '../types/b2b';
import { getProductWholesalePriceForQuantity } from '../shared/productPricing';
import { getAvailableSkuStock } from '../shared/productInventory';
import {
  mergePublicProductsPreservingMerchant,
  replaceMerchantProducts
} from '../shared/merchantProductSync';
import { mergePublicMerchantsPreservingWorkspace } from '../shared/merchantWorkspaceSync';
import { 
  Language, 
  TranslationKey, 
  TRANSLATIONS,
  UI_TRANSLATION_CACHE_VERSION,
  getUiCopyId,
  interpolateUiCopy,
  detectBrowserLanguage, 
  detectPreferredBrowserLanguage,
  hasManualLanguagePreference,
  isLanguage,
  isUiTranslationText,
  LANGUAGE_PREFERENCE_KEY,
  translate,
  type UiCopyInput
} from '../i18n/translations';
import { ApiError, apiGet, apiPost, apiPut, apiRequest, clearApiCache, resolveApiUrl } from '../api/client';
import { isSameCartLine } from '../utils/cart';
import { parseLocalizedPath } from '../shared/seo';
import { makeUniqueMerchantStoreSlug } from '../shared/merchantStoreUrl';
import { getPortalZoneForHost } from '../shared/portalDomains';

type AccountPreferences = {
  language: 'auto' | Language;
  currency: SupportedCurrency;
  monochrome: boolean;
};

type CustomerAccount = {
  id: string;
  email: string | null;
  phone: string | null;
};

const maxCachedUiCopiesPerLanguage = 1200;

export type ActiveView = 
  | 'home' 
  | 'catalog' 
  | 'purchase_order'
  | 'orders'
  | 'product_detail' 
  | 'showrooms' 
  | 'merchant_store'
  | 'fashion_trends'
  | 'cart' 
  | 'checkout' 
  | 'account' 
  | 'register_wholesale'
  | 'about'
  | 'admin'
  | 'merchant_portal'
  | 'platform_admin'
  | 'requirement_doc'
  | ExtendedB2BView;

export type AdminTab = 
  | 'dashboard' 
  | 'merchants'
  | 'vault_requests'
  | 'products' 
  | 'inventory' 
  | 'orders' 
  | 'customers' 
  | 'showrooms' 
  | 'pos' 
  | 'spec_document';

interface NotificationToast {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
}

interface B2BContextType {
  // Navigation & Views
  currentView: ActiveView;
  setCurrentView: (view: ActiveView) => void;
  merchantOnboardingPrefill: MerchantOnboardingPrefill | null;
  setMerchantOnboardingPrefill: (prefill: MerchantOnboardingPrefill | null) => void;
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  catalogCategory: string;
  setCatalogCategory: (cat: string) => void;
  catalogSearchQuery: string;
  setCatalogSearchQuery: (query: string) => void;
  catalogFilterStatus: string;
  setCatalogFilterStatus: (status: string) => void;
  quickNavigateToProduct: (productId: string) => void;
  quickSearchStyle: (searchTerm: string) => void;
  singleItemCheckoutToken: string | null;
  setSingleItemCheckoutToken: (token: string | null) => void;

  // Products & SKUs
  products: Product[];
  getProductById: (id: string) => Product | undefined;
  calculateCustomerPrice: (baseWholesalePrice: number) => number;
  addProduct: (productData: Omit<Product, 'id'> & { creationRequestKey?: string }) => Promise<Product>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  replaceProductFromServer: (product: Product) => void;
  replaceMerchantProductsFromServer: (merchantId: string, products: Product[]) => void;
  deleteProduct: (productId: string) => Promise<void>;
  importProductsBatch: (newProducts: Product[]) => Promise<void>;

  // Cart & Drafts
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  addMultipleToCart: (items: Array<Omit<CartItem, 'id'>>) => void;
  createProductReservationRequest: (productId: string, items: ProductReservationRequestItem[]) => Promise<ProductReservationRequest>;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  savedCarts: SavedCart[];
  saveCurrentCartAsDraft: (name: string) => void;
  loadDraftCart: (draftId: string) => void;
  totalCartAmount: number;
  totalCartQty: number;

  // Orders & Reorder
  orders: Order[];
  syncBuyerOrders: () => Promise<void>;
  createOrder: (orderData: {
    deliveryType: 'shipping' | 'showroom_pickup';
    pickupLocation?: string;
    paymentMethod: 'bank_transfer' | 'net_30' | 'credit_card' | 'paypal' | 'stripe' | 'solana_pay' | 'credit_line';
    solanaToken?: SolanaTokenSymbol;
    shippingAddress: { street: string; city: string; country: string; zip: string; recipient?: string; phone?: string; };
    shippingFee?: number;
    notes?: string;
    promotionCode?: string;
    singleItemToken?: string;
  }) => Promise<Order | null>;
  placeOrder: (data: {
    deliveryType: any;
    pickupShowroomId?: string;
    pickupLocation?: string;
    shippingAddress?: any;
    shippingFee?: number;
    paymentMethod: any;
    solanaToken?: SolanaTokenSymbol;
    notes?: string;
    promotionCode?: string;
    singleItemToken?: string;
  }) => Promise<Order | null>;
  reorderHistoricOrder: (orderId: string) => void;
  reorderDirectly: (orderId: string) => void;
  analyzeReorder: (orderId: string) => ReorderAnalysis | null;
  activeReorderAnalysis: ReorderAnalysis | null;
  setActiveReorderAnalysis: (analysis: ReorderAnalysis | null) => void;
  confirmReorderItems: (items: Array<Omit<CartItem, 'id'>>) => void;
  checkCartAvailability: () => { hasErrors: boolean; isValid: boolean; issues: string[] };
  verifyAndAdjustCart: () => CartVerificationResult;
  adminUpdateOrderStatus: (orderId: string, status: Order['status'], trackingNo?: string, note?: string) => Promise<void>;
  replaceOrderFromServer: (order: Order) => void;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;

  // Inventory & WMS
  inboundRecords: StockInboundRecord[];
  transferRecords: StockTransferRecord[];
  createInboundStock: (record: Omit<StockInboundRecord, 'id' | 'batchNo' | 'date'>) => Promise<StockInboundRecord>;
  simulatePosSale: (skuCode: string, location: WarehouseCode, qty?: number) => Promise<boolean>;
  transferStock: (skuCode: string, fromLoc: WarehouseCode, toLoc: WarehouseCode, qty: number) => Promise<boolean>;
  restockSKU: (skuCode: string, location: WarehouseCode, qty: number) => Promise<void>;

  // Customer & Auth & Uploads
  currentCustomer: WholesaleCustomer | null; // null means guest
  allCustomers: WholesaleCustomer[];
  loginAsCustomer: (customerId: string | 'guest') => void;
  submitWholesaleApplication: (formData: Omit<WholesaleCustomer, 'id' | 'status' | 'tier' | 'creditLimit' | 'usedCredit' | 'discountRate' | 'appliedAt'>) => void;
  registerWholesaleCustomer: (formData: any) => void;
  adminApproveCustomer: (customerId: string, tier: CustomerTier, creditLimit: number) => Promise<void>;
  adminRejectCustomer: (customerId: string) => Promise<void>;
  uploadCustomerDocument: (customerId: string, doc: Omit<CustomerDocument, 'id' | 'uploadedAt'>) => void;
  removeCustomerDocument: (customerId: string, docId: string) => void;

  // Custom Sample Inquiries (客人上传样衣打样图纸与定制开发)
  sampleInquiries: CustomSampleInquiry[];
  submitSampleInquiry: (inquiry: Omit<CustomSampleInquiry, 'id' | 'inquiryNo' | 'status' | 'createdAt'>) => CustomSampleInquiry;
  updateSampleInquiryStatus: (inquiryId: string, status: CustomSampleInquiry['status'], quotedPrice?: number, feedback?: string) => void;

  // Showrooms & Appointments
  showrooms: Showroom[];
  appointments: Appointment[];
  bookAppointment: (bookingData: Omit<Appointment, 'id' | 'appointmentNo' | 'status'>) => Promise<Appointment | null>;
  adminUpdateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => Promise<void>;

  // Multi-Merchant & Private Collection Protection (多商户展厅与 Private Collection 专属商品专区)
  merchants: Merchant[];
  selectedMerchantId: string | null;
  setSelectedMerchantId: (id: string | null) => void;
  getMerchantById: (id: string) => Merchant | undefined;
  addMerchant: (merchantData: Omit<Merchant, 'id'> & { password?: string }) => Promise<Merchant>;
  updateMerchant: (merchantId: string, updates: Partial<Merchant>) => Promise<void>;
  deleteMerchant: (merchantId: string) => Promise<void>;
  
  vaultRequests: VaultAccessRequest[];
  requestVaultAccess: (merchantId: string, note?: string) => Promise<void>;
  approveVaultAccess: (requestId: string) => Promise<void>;
  rejectVaultAccess: (requestId: string) => Promise<void>;
  approveVaultRequest: (requestId: string) => Promise<void>;
  rejectVaultRequest: (requestId: string) => Promise<void>;
  adminReviewVaultRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>;
  toggleProductExclusive: (productId: string) => void;
  hasVaultAccess: (merchantId: string, customerId?: string) => boolean;
  getVaultStatus: (merchantId: string, customerId?: string) => 'none' | 'pending' | 'approved' | 'rejected';
  vaultAccessAuditLogs: VaultAccessAuditLog[];
  logVaultAccess: (merchantId: string, collectionName?: string) => boolean;
  getAuthorizedProduct: (productId: string) => {
    product: Product;
    isAuthorized: boolean;
    maskedFields?: string[];
  } | null;

  // Aliases & compatibility properties for Admin Dashboard
  customers: WholesaleCustomer[];
  updateOrderStatus: (orderId: string, status: Order['status'], trackingNo?: string, note?: string) => void;
  reviewCustomer: (customerId: string, status: 'approved' | 'rejected', tier?: CustomerTier) => void;
  setCustomerTier: (customerId: string, tier: CustomerTier) => void;
  confirmAppointment: (appointmentId: string) => void;

  // Portal Mode & Multi-Tenant
  portalMode: 'buyer' | 'merchant' | 'admin';
  setPortalMode: (mode: 'buyer' | 'merchant' | 'admin') => void;
  activeMerchantId: string;
  setActiveMerchantId: (id: string) => void;

  // Transfers & WMS
  transfers: StockTransferRecord[];
  addTransfer: (record: Omit<StockTransferRecord, 'id'>) => StockTransferRecord;
  updateTransferStatus: (id: string, status: StockTransferRecord['status']) => void;

  // Audit Logs & Security
  auditLogs: AuditLogRecord[];
  addAuditLog: (action: string, entity: string, entityId: string, oldValue?: string, newValue?: string) => void;

  // Payouts & Finance
  payouts: MerchantPayoutRecord[];
  merchantFulfillOrder: (orderId: string, status: Order['status'], carrier?: string, trackingNo?: string, notes?: string) => Promise<boolean>;
  syncOrderFromServer: (order: Order) => void;
  updatePayoutStatus: (payoutId: string, status: MerchantPayoutRecord['status']) => void;

  // Favorites & Wishlist
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // Buyer Business Portal State
  activeBuyerTab: 'dashboard' | 'shop' | 'upload_order' | 'orders' | 'reorder' | 'favorites' | 'company' | 'private_vault';
  setActiveBuyerTab: (tab: 'dashboard' | 'shop' | 'upload_order' | 'orders' | 'reorder' | 'favorites' | 'company' | 'private_vault') => void;

  // PWA & Device Adaptive States
  deviceMode: 'responsive' | 'mobile_preview';
  setDeviceMode: (mode: 'responsive' | 'mobile_preview') => void;
  showPWAInstallModal: boolean;
  setShowPWAInstallModal: (show: boolean) => void;
  showPWANotifications: boolean;
  setShowPWANotifications: (show: boolean) => void;
  merchantMobileMode: boolean;
  setMerchantMobileMode: (val: boolean) => void;
  adminMobileMode: boolean;
  setAdminMobileMode: (val: boolean) => void;

  // Internationalization & Language
  lang: Language;
  setLang: (lang: Language) => void;
  setAutoLanguage: () => void;
  languagePreference: 'auto' | Language;
  monochromeMode: boolean;
  setMonochromeMode: (enabled: boolean) => Promise<boolean>;
  accountPreferencesSynced: boolean;
  accountPreferencesSyncError: boolean;
  saveAccountPreferences: (patch: Partial<AccountPreferences>) => Promise<boolean>;
  t: (key: TranslationKey) => string;
  localizeCopy: (zh: string, it: string, values?: readonly (string | number)[]) => string;

  // System & Notifications
  notifications: NotificationToast[];
  addNotification: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
  removeNotification: (id: string) => void;
  isRegisteredWholesale: boolean;

  // Return / Refund lifecycle
  requestReturn: (orderId: string, reason: string, quantity?: number) => void;
  approveReturn: (orderId: string, refundAmount?: number) => void;
  rejectReturn: (orderId: string) => void;
  getCustomerCreditExposure: () => number;
  canCustomerPlaceNet30Order: (amount: number) => boolean;

  // ============ NEW: Real Multi-Portal JWT Authentication ============
  authRole: 'guest' | 'customer' | 'buyer' | 'merchant' | 'company' | 'admin' | 'consumer';
  authCustomerAccount: CustomerAccount | null;
  requestCustomerLoginCode: (channel: 'email' | 'phone', destination: string) => Promise<{ ok: boolean; error?: string; retryAfter?: number }>;
  verifyCustomerLoginCode: (channel: 'email' | 'phone', destination: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  assumeMerchantFromAdmin: (merchantId: string) => Promise<boolean>;
  returnToAdminPortal: () => Promise<boolean>;
  handleAdminSessionExpired: () => void;
  authBuyer: WholesaleCustomer | null;
  authMerchantId: string | null;
  setAuthMerchantId: (id: string | null) => void;
  authMerchant: Merchant | null;
  authCompanyId: string | null;
  authAdminName: string | null;
  showBuyerRegister: boolean;
  setShowBuyerRegister: (v: boolean) => void;
  loginAsBuyer: (email: string, password: string) => Promise<boolean>;
  loginAsCompany: (identifier: string, password: string) => Promise<boolean>;
  loginAsBusiness: (identifier: string, password: string) => Promise<boolean>;
  loginWithGoogle: (credential: string, role: 'buyer' | 'merchant' | 'company' | 'customer') => Promise<boolean>;
  loginAsMerchant: (email: string, password: string) => Promise<boolean>;
  loginAsMerchantDemo: (industryTemplateId: string) => Promise<boolean>;
  requestMerchantRegistrationCode: (email: string) => Promise<{ ok: boolean; error?: string; retryAfter?: number }>;
  verifyMerchantRegistrationCode: (email: string, code: string) => Promise<{ ok: boolean; verificationToken?: string; error?: string }>;
  requestMerchantPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string; retryAfter?: number }>;
  resetMerchantPassword: (email: string, code: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerMerchantQuick: (email: string, password: string, storeName?: string, verificationToken?: string, industry?: string, salesChannels?: string) => Promise<boolean>;
  merchantLoginError: { code: string; retryAfter?: number } | null;
  loginAsAdmin: (username: string, password: string, otp?: string) => Promise<boolean>;
  adminLoginError: string | null;
  registerBuyer: (form: any) => Promise<boolean>;
  registerQuickBuyer: (email: string, code?: string) => Promise<{ sent?: boolean; buyer?: WholesaleCustomer }>;
  logout: () => void;
  initRouteFromURL: () => 'buyer' | 'merchant' | 'employee' | 'admin' | 'guest' | 'consumer';

  // ============ CONSUMER (C端零售) 新增 ============
  authConsumer: Consumer | null;
  authConsumerToken: string | null;
  consumerCart: ConsumerCartItem[];
  consumerOrders: ConsumerOrder[];
  consumerAddresses: ConsumerAddress[];
  consumerRetailProducts: Product[];
  consumerRetailProductsMeta: { total: number; page: number; limit: number } | null;
  consumerRetailProduct: Product | null;
  consumerWishlist: Product[];
  lastPromoCalc: PromotionCalculationResult | null;
  exchangeRates: ExchangeRatesSnapshot | null;
  displayCurrency: SupportedCurrency;
  setDisplayCurrency: (c: SupportedCurrency) => void;
  convertCurrency: (amountEUR: number) => number;
  formatMoney: (amountEUR: number, currency?: SupportedCurrency) => string;
  loginAsConsumer: (email: string, password: string) => Promise<boolean>;
  registerConsumer: (form: Partial<Consumer> & {password: string; acceptedTerms?: boolean; acceptedPrivacy?: boolean; newsletterOptIn?: boolean}) => Promise<boolean>;
  loadConsumerProfile: () => Promise<void>;
  updateConsumerProfile: (patch: Partial<Consumer>) => Promise<boolean>;
  loadConsumerAddresses: () => Promise<void>;
  saveConsumerAddress: (addr: Partial<ConsumerAddress> & {id?: string}) => Promise<boolean>;
  removeConsumerAddress: (id: string) => Promise<void>;
  loadConsumerRetailProducts: (params?: {q?: string; category?: string; sort?: string; page?: number; merchantId?: string; minPrice?: number; maxPrice?: number}) => Promise<void>;
  loadConsumerRetailProduct: (idOrStyleNo: string) => Promise<void>;
  addToConsumerCart: (productId: string, sku: string, qty: number, variant?: any) => boolean;
  removeFromConsumerCart: (cartItemId: string) => void;
  updateConsumerCartQty: (cartItemId: string, qty: number) => void;
  clearConsumerCart: () => void;
  calculateConsumerCartPromo: (couponCode?: string, usePoints?: number) => Promise<PromotionCalculationResult | null>;
  placeConsumerOrder: (payload: {shippingAddress: any; billingAddress?: any; paymentMethod: string; couponCode?: string; usedPoints?: number; giftNote?: string; invoiceRequested?: boolean}) => Promise<{ok: boolean; orderNo?: string; id?: string; error?: string}>;
  loadConsumerOrders: () => Promise<void>;
  toggleConsumerWishlist: (productId: string, add: boolean) => Promise<void>;
  loadConsumerWishlist: () => Promise<void>;

  // ============ PROMOTIONS 促销 ============
  adminPromotions: PromotionRule[];
  loadAdminPromotions: () => Promise<void>;
  saveAdminPromotion: (data: Partial<PromotionRule>) => Promise<void>;
  deleteAdminPromotion: (id: string) => Promise<void>;
  toggleAdminPromotionActive: (id: string, isActive: boolean) => Promise<void>;

  // ============ RFQ 询报价 ============
  buyerRfqs: BuyerRfqView[];
  merchantRfqs: BuyerRfqView[];
  loadBuyerRfqs: () => Promise<void>;
  loadMerchantRfqs: () => Promise<void>;
  createBuyerRfq: (payload: CreateBuyerRfqInput) => Promise<{id?: string; rfqNo?: string; ok: boolean; error?: string}>;
  acceptRfqQuote: (rfqId: string, quoteId: string) => Promise<boolean>;
  submitMerchantRfqQuote: (rfqId: string, payload: SubmitRfqQuoteInput) => Promise<boolean>;

  // ============ MESSAGES / IM 消息中心 ============
  messageThreads: MessageThreadSummary[];
  activeMessageThread: MessageThreadSummary | null;
  activeMessageThreadMessages: any[];
  loadMessageThreads: () => Promise<void>;
  openMessageThread: (id: string | null) => Promise<void>;
  sendMessageReply: (content: string, attachments?: any[]) => Promise<boolean>;
  createMessageThread: (partial: any) => Promise<string | null>;

  // ============ RISK / BI 风控与BI ============
  riskAlerts: RiskAlert[];
  loadRiskAlerts: (status?: 'open' | 'acknowledged', severity?: string) => Promise<void>;
  acknowledgeRiskAlert: (id: string) => Promise<void>;
  biSalesTrend: {
    data: Array<{date: string; gmv: number; ordersCount: number; aov: number; unitsSold: number}>;
    previousData: Array<{date: string; gmv: number; ordersCount: number; aov: number; unitsSold: number}>;
  };
  biCategoryPerformance: Array<{category: string; gmv: number; sharePercent: number; unitsSold: number; previousGmv: number}>;
  biMerchantRanking: {
    data: Array<{merchantId: string; merchantName: string; gmv: number; ordersCount: number; rating: number; previousGmv: number}>;
    previousData: Array<{merchantId: string; merchantName: string; gmv: number; ordersCount: number; rating: number}>;
  };
  loadBISalesTrend: (days?: number) => Promise<void>;
  loadBICategoryPerformance: (days?: number) => Promise<void>;
  loadBIMerchantRanking: (days?: number) => Promise<void>;

  // ============ EXCHANGE RATES / 多货币 ============
  loadExchangeRates: () => Promise<void>;

  // ============ UNREAD COUNTS / 徽标 ============
  unreadMessagesCount: number;
  openRiskAlertsCount: number;
}

export type MerchantOnboardingPrefill = {
  businessTypeIds: string[];
  operatingModeId?: string | null;
  city?: string | null;
};

const B2BContext = createContext<B2BContextType | undefined>(undefined);

export const B2BProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const orderSubmissionInFlight = useRef(false);
  const inventoryActionsInFlight = useRef(new Set<string>());
  const allowLocalBusinessPersistence = import.meta.env.DEV;
  const getLocalBusinessValue = (key: string): string | null => {
    if (!allowLocalBusinessPersistence || typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  };
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const routeLanguage = parseLocalizedPath(window.location.pathname).language;
      if (routeLanguage) return routeLanguage;
    }
    return detectBrowserLanguage();
  });
  const [languagePreference, setLanguagePreferenceState] = useState<'auto' | Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
      return isLanguage(saved) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [aiUiTranslations, setAiUiTranslations] = useState<Partial<Record<Language, Partial<Record<TranslationKey, string>>>>>(() => ({}));
  const [aiUiCopyTranslations, setAiUiCopyTranslations] = useState<Partial<Record<Language, Record<string, string>>>>({});
  const pendingUiCopies = useRef(new Map<Language, Map<string, UiCopyInput>>());
  const uiCopyFlushTimers = useRef(new Map<Language, number>());
  const uiCopyFailureNotified = useRef(new Set<Language>());
  const [monochromeMode, setMonochromeModeState] = useState(() => {
    try { return localStorage.getItem('ruda_monochrome_mode') === 'true'; } catch { return false; }
  });
  const [accountPreferencesSynced, setAccountPreferencesSynced] = useState(false);
  const [accountPreferencesSyncError, setAccountPreferencesSyncError] = useState(false);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    setLanguagePreferenceState(newLang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LANGUAGE_PREFERENCE_KEY, newLang);
        document.documentElement.lang = newLang;
        document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      } catch {}
    }
    void saveAccountPreferences({ language: newLang });
  };

  const setAutoLanguage = () => {
    const browserLanguage = detectPreferredBrowserLanguage();
    setLangState(browserLanguage);
    setLanguagePreferenceState('auto');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
      } catch {}
    }
    void saveAccountPreferences({ language: 'auto' });
  };

  const t = useCallback(
    (key: TranslationKey): string => translate(key, lang, aiUiTranslations[lang]),
    [lang, aiUiTranslations]
  );

  // Sync document language on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('ruda-monochrome', monochromeMode);
    document.body.classList.toggle('ruda-monochrome', monochromeMode);
    try {
      localStorage.setItem('ruda_monochrome_mode', String(monochromeMode));
    } catch (error) {
      console.warn('[account-display-preference]', error);
    }
  }, [monochromeMode]);

  // Follow system/browser language changes unless the user explicitly chose
  // a language in the header. This also handles returning to a suspended tab.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncBrowserLanguage = () => {
      if (hasManualLanguagePreference()) return;
      if (parseLocalizedPath(window.location.pathname).language) return;
      const browserLanguage = detectPreferredBrowserLanguage();
      setLangState((current) => current === browserLanguage ? current : browserLanguage);
    };

    window.addEventListener('languagechange', syncBrowserLanguage);
    document.addEventListener('visibilitychange', syncBrowserLanguage);
    return () => {
      window.removeEventListener('languagechange', syncBrowserLanguage);
      document.removeEventListener('visibilitychange', syncBrowserLanguage);
    };
  }, []);

  const [currentView, setCurrentView] = useState<ActiveView>('home');
  const [merchantOnboardingPrefill, setMerchantOnboardingPrefill] = useState<MerchantOnboardingPrefill | null>(null);
  const [singleItemCheckoutToken, setSingleItemCheckoutToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem('ruda_single_item_checkout') || null;
  });
  useEffect(() => {
    if (singleItemCheckoutToken) {
      window.sessionStorage.setItem('ruda_single_item_checkout', singleItemCheckoutToken);
    } else {
      window.sessionStorage.removeItem('ruda_single_item_checkout');
    }
  }, [singleItemCheckoutToken]);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [catalogFilterStatus, setCatalogFilterStatus] = useState<string>('all');
  const [activeReorderAnalysis, setActiveReorderAnalysis] = useState<ReorderAnalysis | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [authRole, setAuthRole] = useState<'guest' | 'customer' | 'buyer' | 'merchant' | 'company' | 'admin' | 'consumer'>('guest');
  const [authMerchantId, setAuthMerchantId] = useState<string | null>(null);

  // GET responses are keyed by URL only. Never let a cache entry survive an
  // account/tenant transition, otherwise the next merchant can briefly read
  // data cached for the previous session.
  useEffect(() => {
    clearApiCache();
  }, [authRole, authMerchantId]);

  const [merchants, setMerchants] = useState<Merchant[]>([]);

  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>('mch-prato');
  const [activeMerchantId, setActiveMerchantId] = useState<string>('mch-prato');
  const [portalMode, setPortalMode] = useState<'buyer' | 'merchant' | 'admin'>('buyer');

  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const [payouts, setPayouts] = useState<MerchantPayoutRecord[]>([]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    try {
      localStorage.setItem('modahub_transfers', JSON.stringify(transfers));
    } catch {}
  }, [transfers]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    try {
      localStorage.setItem('modahub_audit_logs', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    try {
      localStorage.setItem('modahub_payouts', JSON.stringify(payouts));
    } catch {}
  }, [payouts]);

  const [vaultRequests, setVaultRequests] = useState<VaultAccessRequest[]>([]);

  const [vaultAccessAuditLogs, setVaultAccessAuditLogs] = useState<VaultAccessAuditLog[]>([]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    try {
      localStorage.setItem('ruda_vault_access_logs', JSON.stringify(vaultAccessAuditLogs));
    } catch {}
  }, [vaultAccessAuditLogs]);

  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  
  const [allCustomers, setAllCustomers] = useState<WholesaleCustomer[]>([]);

  // A customer must come from an authenticated server session. Never grant a
  // wholesale identity from seed data or browser storage.
  const [currentCustomer, setCurrentCustomer] = useState<WholesaleCustomer | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = getLocalBusinessValue('ruda_cart') || getLocalBusinessValue('modahub_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [savedCarts, setSavedCarts] = useState<SavedCart[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = getLocalBusinessValue('modahub_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeBuyerTab, setActiveBuyerTab] = useState<'dashboard' | 'shop' | 'upload_order' | 'orders' | 'reorder' | 'favorites' | 'company' | 'private_vault'>('dashboard');

  const [deviceMode, setDeviceMode] = useState<'responsive' | 'mobile_preview'>('responsive');
  const [showPWAInstallModal, setShowPWAInstallModal] = useState<boolean>(false);
  const [showPWANotifications, setShowPWANotifications] = useState<boolean>(false);
  const [merchantMobileMode, setMerchantMobileMode] = useState<boolean>(true);
  const [adminMobileMode, setAdminMobileMode] = useState<boolean>(true);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    try {
      localStorage.setItem('modahub_favorites', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter(id => id !== productId) : [...prev, productId];
      if (!exists) {
        addNotification('info', '已加入心仪收藏', '该款式已放入您的收藏清单，随时可一键智能配码加购');
      } else {
        addNotification('info', '已移除收藏', '已从收藏清单中移除');
      }
      return next;
    });
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const [inboundRecords, setInboundRecords] = useState<StockInboundRecord[]>([]);

  const [transferRecords, setTransferRecords] = useState<StockTransferRecord[]>([]);

  const [sampleInquiries, setSampleInquiries] = useState<CustomSampleInquiry[]>([]);

  const [notifications, setNotifications] = useState<NotificationToast[]>([]);

  // In production, catalog and merchant data come from the server. Local
  // storage is only a development convenience and must never be authoritative.
  useEffect(() => {
    if (allowLocalBusinessPersistence) return;

    let active = true;
    let syncInFlight = false;
    let lastSyncAt = 0;
    let lastFailureSignature = '';

    const loadPublicCatalog = async () => {
      const now = Date.now();
      if (!active || syncInFlight || now - lastSyncAt < 60_000) return;
      syncInFlight = true;
      lastSyncAt = now;

      try {
        const results = await Promise.allSettled([
          apiGet<{ success: true; products: Product[] }>('/api/products', 60000),
          apiGet<{ success: true; merchants: Merchant[] }>('/api/merchants', 60000),
          apiGet<{ success: true; showrooms: Showroom[] }>('/api/showrooms', 60000)
        ]);
        if (!active) return;

        const [productResult, merchantResult, showroomResult] = results;
        const failedCollections: string[] = [];
        if (productResult.status === 'fulfilled' && Array.isArray(productResult.value.products)) {
          setProducts(previous => mergePublicProductsPreservingMerchant(
            productResult.value.products,
            previous,
            authRole === 'merchant' ? authMerchantId : null
          ));
        } else {
          failedCollections.push('商品');
        }
        if (merchantResult.status === 'fulfilled' && Array.isArray(merchantResult.value.merchants)) {
          setMerchants(previous => mergePublicMerchantsPreservingWorkspace(
            merchantResult.value.merchants,
            previous
          ));
        } else {
          failedCollections.push('商家');
        }
        if (showroomResult.status === 'fulfilled' && Array.isArray(showroomResult.value.showrooms)) {
          setShowrooms(showroomResult.value.showrooms);
        } else {
          failedCollections.push('展厅');
        }

        const failureSignature = failedCollections.join(',');
        if (failureSignature && failureSignature !== lastFailureSignature) {
          addNotification(
            'warning',
            translate('catalogSyncFailedTitle', lang),
            translate('catalogSyncFailedMessage', lang)
          );
        }
        lastFailureSignature = failureSignature;
      } finally {
        syncInFlight = false;
      }
    };

    void loadPublicCatalog();
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadPublicCatalog();
    }, 5 * 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadPublicCatalog();
    };
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [allowLocalBusinessPersistence, authMerchantId, authRole, lang]);

  // Sync to local storage
  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_customers', JSON.stringify(allCustomers));
  }, [allCustomers]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_saved_carts', JSON.stringify(savedCarts));
  }, [savedCarts]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_inbound_records', JSON.stringify(inboundRecords));
  }, [inboundRecords]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_transfer_records', JSON.stringify(transferRecords));
  }, [transferRecords]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_sample_inquiries', JSON.stringify(sampleInquiries));
  }, [sampleInquiries]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_merchants', JSON.stringify(merchants));
  }, [merchants]);

  useEffect(() => {
    if (!allowLocalBusinessPersistence) return;
    localStorage.setItem('ruda_vault_requests', JSON.stringify(vaultRequests));
  }, [vaultRequests]);

  const addNotification = useCallback((type: 'success' | 'info' | 'warning', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setNotifications(prev => [...prev, { id, type, title, message }]);
    window.setTimeout(() => setNotifications(prev => prev.filter(notification => notification.id !== id)), 4500);
  }, []);

  const flushUiCopyQueue = useCallback(async (language: Language) => {
    const timer = uiCopyFlushTimers.current.get(language);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      uiCopyFlushTimers.current.delete(language);
    }
    const queued = pendingUiCopies.current.get(language);
    if (!queued?.size) return;
    const copies = [...queued.values()];
    queued.clear();
    const batches: UiCopyInput[][] = [];
    let currentBatch: UiCopyInput[] = [];
    let currentBatchLength = 0;
    for (const copy of copies) {
      const copyLength = copy.zh.length + copy.it.length;
      if (currentBatch.length >= 24 || currentBatchLength + copyLength > 20_000) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchLength = 0;
      }
      currentBatch.push(copy);
      currentBatchLength += copyLength;
    }
    if (currentBatch.length) batches.push(currentBatch);

    let nextBatch = 0;
    const worker = async () => {
      while (nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        if (!batch) return;
        try {
          const bundle = await apiPost<{
            success: true;
            language: Language;
            translations: Record<string, string>;
          }>(`/api/i18n/ui-copies/${language}`, { copies: batch });
          const isComplete = bundle.success
            && bundle.language === language
            && batch.every(copy => typeof bundle.translations?.[copy.id] === 'string'
              && isUiTranslationText(bundle.translations[copy.id], language, 3000));
          if (!isComplete) throw new Error('UI_COPY_TRANSLATION_BUNDLE_INVALID');

          const mergeAndLimit = (existing: Record<string, string>) => {
            const retained = Object.entries(existing)
              .filter(([key]) => !Object.hasOwn(bundle.translations, key));
            return Object.fromEntries([
              ...retained,
              ...Object.entries(bundle.translations)
            ].slice(-maxCachedUiCopiesPerLanguage));
          };
          setAiUiCopyTranslations(previous => ({
            ...previous,
            [language]: mergeAndLimit(previous[language] || {})
          }));
          try {
            const cacheKey = `ruda_ui_copies_${UI_TRANSLATION_CACHE_VERSION}_${language}`;
            const serialized = localStorage.getItem(cacheKey);
            const current = serialized ? JSON.parse(serialized) as Record<string, unknown> : {};
            const cachedEntries: Record<string, string> = {};
            for (const [key, value] of Object.entries(current)) {
              if (
                /^copy_[a-z0-9]+_[a-z0-9]+$/.test(key)
                && isUiTranslationText(value, language, 3000)
              ) {
                cachedEntries[key] = value;
              }
            }
            localStorage.setItem(cacheKey, JSON.stringify(mergeAndLimit(cachedEntries)));
          } catch (error) {
            console.warn('[ui-copy-translation-cache-write]', error);
          }
        } catch (error) {
          console.error('[ui-copy-translation-load]', language, error);
          if (languagePreference === language && !uiCopyFailureNotified.current.has(language)) {
            uiCopyFailureNotified.current.add(language);
            addNotification(
              'warning',
              t('uiTranslationUnavailableTitle'),
              t('uiTranslationUnavailableMessage')
            );
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  }, [addNotification, languagePreference, t]);

  const localizeCopy = useCallback((zh: string, it: string, values: readonly (string | number)[] = []): string => {
    if (lang === 'zh') return interpolateUiCopy(zh, values);
    if (lang === 'it') return interpolateUiCopy(it, values);
    if (typeof window === 'undefined') return interpolateUiCopy(it, values);
    if (zh.length > 2000 || it.length > 2000) {
      console.error('[ui-copy-translation-source-too-large]', lang);
      if (!uiCopyFailureNotified.current.has(lang)) {
        uiCopyFailureNotified.current.add(lang);
        addNotification('warning', t('uiTranslationUnavailableTitle'), t('uiTranslationUnavailableMessage'));
      }
      return interpolateUiCopy(it, values);
    }

    const id = getUiCopyId(zh, it);
    const translated = aiUiCopyTranslations[lang]?.[id];
    if (translated) return interpolateUiCopy(translated, values);

    let queued = pendingUiCopies.current.get(lang);
    if (!queued) {
      queued = new Map<string, UiCopyInput>();
      pendingUiCopies.current.set(lang, queued);
    }
    if (!queued.has(id)) queued.set(id, { id, zh, it });
    if (!uiCopyFlushTimers.current.has(lang)) {
      uiCopyFlushTimers.current.set(lang, window.setTimeout(() => {
        void flushUiCopyQueue(lang);
      }, 1500));
    }
    return interpolateUiCopy(it, values);
  }, [aiUiCopyTranslations, flushUiCopyQueue, lang]);

  useEffect(() => {
    if (lang === 'it' || lang === 'zh') return;
    const cacheKey = `ruda_ui_copies_${UI_TRANSLATION_CACHE_VERSION}_${lang}`;
    try {
      const serialized = localStorage.getItem(cacheKey);
      if (!serialized) return;
      const parsed: unknown = JSON.parse(serialized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const entries = Object.entries(parsed).filter(([key, value]) =>
        /^copy_[a-z0-9]+_[a-z0-9]+$/.test(key)
        && isUiTranslationText(value, lang, 3000)
      );
      if (entries.length) {
        setAiUiCopyTranslations(previous => ({
          ...previous,
          [lang]: Object.fromEntries(entries.slice(-maxCachedUiCopiesPerLanguage))
        }));
      }
    } catch (error) {
      console.warn('[ui-copy-translation-cache-read]', error);
    }
  }, [lang]);

  useEffect(() => {
    if (lang === 'it' || lang === 'zh') return undefined;
    const cacheKey = `ruda_ui_translations_${UI_TRANSLATION_CACHE_VERSION}_${lang}`;
    let hasCachedBundle = false;
    try {
      const serialized = localStorage.getItem(cacheKey);
      if (serialized) {
        const parsed: unknown = JSON.parse(serialized);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed).filter(([key, value]) =>
            Object.hasOwn(TRANSLATIONS.it, key) && isUiTranslationText(value, lang, 2000)
          );
          if (entries.length === Object.keys(TRANSLATIONS.it).length) {
            setAiUiTranslations(previous => ({
              ...previous,
              [lang]: Object.fromEntries(entries) as Partial<Record<TranslationKey, string>>
            }));
            hasCachedBundle = true;
          }
        }
      }
    } catch (error) {
      console.warn('[ui-translation-cache-read]', error);
    }

    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      void fetch(resolveApiUrl(`/api/i18n/translations/${lang}`), { credentials: 'include', signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || `UI_TRANSLATION_HTTP_${response.status}`);
        }
        return response.json() as Promise<{ success: true; language: Language; translations: Partial<Record<TranslationKey, string>> }>;
      })
      .then(bundle => {
        const translations = bundle.translations;
        const isComplete = bundle.success
          && bundle.language === lang
          && Object.keys(TRANSLATIONS.it).every(key =>
            isUiTranslationText(translations[key as TranslationKey], lang, 2000)
          );
        if (!isComplete) throw new Error('UI_TRANSLATION_BUNDLE_INVALID');
        setAiUiTranslations(previous => ({ ...previous, [lang]: translations }));
        try {
          localStorage.setItem(cacheKey, JSON.stringify(translations));
        } catch (error) {
          console.warn('[ui-translation-cache-write]', error);
        }
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('[ui-translation-load]', error);
        if (!hasCachedBundle && languagePreference === lang) {
          addNotification(
            'warning',
            'Translation temporarily unavailable',
            'AI translation is unavailable; translated interface labels are temporarily shown in Italian. Please try again later.'
          );
        }
      });
    }, 1500);

    return () => {
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [lang, addNotification, languagePreference]);

  const removeNotification = (id: string) => {
    setNotifications(prev => (prev || []).filter(n => n.id !== id));
  };

  const isRegisteredWholesale = currentCustomer !== null && currentCustomer.status === 'approved';

  // Calculate pricing based on customer tier
  const calculateCustomerPrice = (baseWholesalePrice: number): number => {
    if (!currentCustomer || currentCustomer.status !== 'approved') {
      return baseWholesalePrice;
    }
    const rate = currentCustomer.discountRate || 1.0;
    return parseFloat((baseWholesalePrice * rate).toFixed(2));
  };

  const getProductById = (id: string) => {
    return products.find(p => p.id === id);
  };

  const applyCartProductPrices = (items: CartItem[]): CartItem[] => {
    const quantities = new Map<string, number>();
    items.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity));
    return items.map(item => {
      const product = getProductById(item.productId);
      if (!product) return item;
      const basePrice = getProductWholesalePriceForQuantity(
        product.wholesalePrice,
        product.wholesalePrice100,
        quantities.get(item.productId) || item.quantity,
        product.bulkPriceMinimumQuantity
      );
      return { ...item, unitPrice: calculateCustomerPrice(basePrice) };
    });
  };

  const quickNavigateToProduct = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentView('product_detail');
    window.history.pushState({}, '', `/product/${encodeURIComponent(productId)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickSearchStyle = (searchTerm: string) => {
    setCatalogSearchQuery(searchTerm);
    setCatalogCategory('all');
    setCurrentView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cart operations
  const addToCart = (item: Omit<CartItem, 'id'>) => {
    const id = 'ci-' + Date.now() + Math.random().toString(36).substring(2, 6);
    // Ensure merchantId and merchantName are populated
    let merchantId = item.merchantId;
    let merchantName = item.merchantName;
    if (!merchantId) {
      const prod = getProductById(item.productId);
      merchantId = prod?.merchantId || 'mch-prato';
      merchantName = prod?.merchantName || merchants.find(m => m.id === merchantId)?.name || 'Merchant';
    }

    const completeItem: Omit<CartItem, 'id'> = {
      ...item,
      merchantId,
      merchantName
    };

    setCart(prev => {
      const existing = prev.find(i => isSameCartLine(i, completeItem));
      if (existing) {
        return applyCartProductPrices(prev.map(i => isSameCartLine(i, completeItem) ? { ...i, quantity: i.quantity + item.quantity } : i));
      }
      return applyCartProductPrices([...prev, { ...completeItem, id }]);
    });
    addNotification('success', '已加入采购车', `款号: ${item.styleNo} | ${item.color} - ${item.size} × ${item.quantity}件`);
  };

  const addMultipleToCart = (items: Array<Omit<CartItem, 'id'>>) => {
    if (items.length === 0) return;

    setCart(prev => {
      const updated = [...prev];
      items.forEach(rawItem => {
        let merchantId = rawItem.merchantId;
        let merchantName = rawItem.merchantName;
        if (!merchantId) {
          const prod = getProductById(rawItem.productId);
          merchantId = prod?.merchantId || 'mch-prato';
          merchantName = prod?.merchantName || merchants.find(m => m.id === merchantId)?.name || 'Merchant';
        }
        const newItem: Omit<CartItem, 'id'> = {
          ...rawItem,
          merchantId,
          merchantName
        };

        const index = updated.findIndex(i => isSameCartLine(i, newItem));
        if (index > -1) {
          updated[index] = {
            ...updated[index],
            quantity: updated[index].quantity + newItem.quantity
          };
        } else {
          updated.push({
            ...newItem,
            id: 'ci-' + Date.now() + Math.random().toString(36).substring(2, 7)
          });
        }
      });
      return applyCartProductPrices(updated);
    });
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    addNotification('success', '批量加入采购车成功', `共计 ${items.length} 个SKU配比规格，总计 ${totalQty} 件`);
  };

  const createProductReservationRequest = async (
    productId: string,
    items: ProductReservationRequestItem[]
  ): Promise<ProductReservationRequest> => {
    if (authRole !== 'buyer') throw new Error('APPROVED_BUYER_REQUIRED');
    if (items.length === 0) throw new Error('RESERVATION_ITEMS_REQUIRED');
    const response = await apiPost<{
      success: true;
      reservationRequest: ProductReservationRequest;
    }>('/api/product-reservation-requests', { productId, items });
    return response.reservationRequest;
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => applyCartProductPrices(prev.map(item => item.id === itemId ? { ...item, quantity } : item)));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => applyCartProductPrices((prev || []).filter(item => item.id !== itemId)));
    addNotification('info', '已移除单项', '已从采购清单中扣除对应SKU');
  };

  const clearCart = () => {
    setCart([]);
  };

  const saveCurrentCartAsDraft = (name: string) => {
    if (cart.length === 0) return;
    const newDraft: SavedCart = {
      id: 'draft-' + Date.now(),
      name: name.trim() || `采购方案草稿 (${new Date().toLocaleDateString()})`,
      createdAt: new Date().toISOString().split('T')[0],
      items: [...cart],
      totalAmount: totalCartAmount,
      totalQty: totalCartQty
    };
    setSavedCarts(prev => [newDraft, ...prev]);
    addNotification('success', '采购清单已保存', `草稿已存入会员中心【Saved Carts】，随时可调出重订`);
  };

  const loadDraftCart = (draftId: string) => {
    const draft = savedCarts.find(d => d.id === draftId);
    if (!draft) return;
    setCart([...draft.items]);
    setCurrentView('cart');
    addNotification('success', '已载入采购清单', `成功还原草稿【${draft.name}】，共计 ${draft.totalQty} 件`);
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Stock deduction & Inventory synchronization
  const deductStockForOrder = (items: CartItem[] = [], deliveryType: 'shipping' | 'showroom_pickup', pickupLoc?: string) => {
    setProducts(prevProducts => {
      return (prevProducts || []).map(product => {
        const matchingItems = (items || []).filter(i => i.productId === product.id);
        if (matchingItems.length === 0) return product;

        const updatedSkus = product.skus.map(skuItem => {
          const matchedItem = matchingItems.find(i => i.sku === skuItem.sku);
          if (!matchedItem) return skuItem;

          const qty = matchedItem.quantity;
          let newCentral = skuItem.stockCentral;
          newCentral = Math.max(0, newCentral - qty);

          return {
            ...skuItem,
            stockCentral: newCentral,
            stockMestre: 0,
            stockMilano: 0
          };
        });

        return {
          ...product,
          skus: updatedSkus
        };
      });
    });
  };

  const getSkuAvailability = (sku: { stockCentral?: number; stockMestre?: number; stockMilano?: number; reserved?: number } | undefined): number => {
    return getAvailableSkuStock(sku);
  };

  const createMerchantPayoutRecord = (order: Order) => {
    const merchantId = order.merchantId || order.items[0]?.merchantId;
    if (!merchantId) return;

    const grossSales = Number(order.totalAmount || 0);
    const platformFeeRate = merchants.find(merchant => merchant.id === merchantId)?.platformFeeRate ?? 0.08;
    const platformFeeAmount = Number((grossSales * platformFeeRate).toFixed(2));
    const paymentProcessingFee = Number((grossSales * 0.02).toFixed(2));
    const netPayout = Number(Math.max(0, grossSales - platformFeeAmount - paymentProcessingFee).toFixed(2));
    const monthLabel = new Date().toISOString().slice(0, 7);

    setPayouts(prev => {
      if (prev.some(p => p.orderIds?.includes(order.id))) return prev;
      const existing = prev.find(p => p.merchantId === merchantId && p.period === monthLabel && p.status !== 'paid');
      if (existing) {
        return prev.map(p => p.id === existing.id ? {
          ...p,
          orderIds: [...(p.orderIds || []), order.id],
          grossSales: Number((p.grossSales + grossSales).toFixed(2)),
          platformFeeAmount: Number((p.platformFeeAmount + platformFeeAmount).toFixed(2)),
          paymentProcessingFee: Number((p.paymentProcessingFee + paymentProcessingFee).toFixed(2)),
          netPayout: Number((p.netPayout + netPayout).toFixed(2)),
          status: 'pending'
        } : p);
      }

      return [{
        id: `payout-${Date.now()}-${merchantId}`,
        orderIds: [order.id],
        merchantId,
        merchantName: order.merchantName || merchants.find(m => m.id === merchantId)?.name || 'Merchant',
        period: monthLabel,
        grossSales,
        platformFeeRate,
        platformFeeAmount,
        paymentProcessingFee,
        refunds: 0,
        netPayout,
        status: 'pending',
        bankAccount: 'IT60 X054 2811 1010 0000 0012 34'
      }, ...prev];
    });
  };

  const restoreStockForOrder = (order: Order) => {
    setProducts(prev => prev.map(product => {
      const matchedItems = order.items.filter(item => item.productId === product.id);
      if (matchedItems.length === 0) return product;

      return {
        ...product,
        skus: product.skus.map(sku => {
          const matched = matchedItems.find(item => item.sku === sku.sku);
          if (!matched) return sku;

          const qty = matched.quantity;
          return {
            ...sku,
            stockCentral: sku.stockCentral + qty,
            stockMestre: 0,
            stockMilano: 0,
            reserved: Math.max(0, (sku.reserved || 0) - qty)
          };
        })
      };
    }));
  };

  // Stock validation before order
  const checkCartAvailability = (): { hasErrors: boolean; isValid: boolean; issues: string[] } => {
    const issues: string[] = [];
    cart.forEach(item => {
      const prod = getProductById(item.productId);
      if (!prod) {
        issues.push(`商品 ${item.styleNo} 已下架或不存在`);
        return;
      }
      if (prod.isPrivateVault) {
        const hasAccess = hasVaultAccess(prod.merchantId || '', currentCustomer?.id);
        if (!hasAccess) {
          issues.push(`款号 ${prod.styleNo} 属于商家专属 Private Collection，当前账号未获授权`);
        }
      }
      const targetSku = prod.skus?.find(s => s.sku === item.sku);
      if (targetSku) {
        const totalAvail = getSkuAvailability(targetSku);
        if (targetSku.allowBackorder === false && item.quantity > totalAvail) {
          issues.push(`款号 ${item.styleNo} (${item.color}/${item.size}) 库存不足: 现存 ${totalAvail} 件，拟采购 ${item.quantity} 件`);
        }
      }
      if (prod.moq && item.quantity < prod.moq) {
        issues.push(`款号 ${item.styleNo} 起订量不足: 须至少订购 ${prod.moq} 件`);
      }
    });
    return {
      hasErrors: issues.length > 0,
      isValid: issues.length === 0,
      issues
    };
  };

  // Real-time Cart Verification & Auto-Adjustment on Checkout (防超卖、价格校准与权限校验)
  const verifyAndAdjustCart = (): CartVerificationResult => {
    const issues: string[] = [];
    const stockAdjustments: CartVerificationResult['stockAdjustments'] = [];
    const priceAdjustments: CartVerificationResult['priceAdjustments'] = [];
    const removedItems: CartVerificationResult['removedItems'] = [];
    let adjustmentsApplied = false;

    const nextCart: CartItem[] = [];
    const quantityByProduct = new Map<string, number>();
    cart.forEach(item => quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) || 0) + item.quantity
    ));

    cart.forEach(item => {
      const prod = getProductById(item.productId);
      if (!prod) {
        removedItems.push({
          styleNo: item.styleNo,
          reason: `款号 ${item.styleNo} 已下架或不存在，已从采购车移出`
        });
        issues.push(`商品 ${item.styleNo} 已下架或不存在`);
        adjustmentsApplied = true;
        return;
      }

      // Check Private Vault access
      if (prod.isExclusiveProtected || prod.visibility === 'private' || prod.isPrivateVault) {
        const hasAccess = hasVaultAccess(prod.merchantId || '', currentCustomer?.id);
        if (!hasAccess) {
          removedItems.push({
            styleNo: item.styleNo,
            reason: `款号 ${item.styleNo} 属于商家专属受保护款，当前账号未获准入授权，已从采购车移出`
          });
          issues.push(`款号 ${prod.styleNo} 属于商家专属 Private Collection，未授权`);
          adjustmentsApplied = true;
          return;
        }
      }

      const currentBasePrice = getProductWholesalePriceForQuantity(
        prod.wholesalePrice,
        prod.wholesalePrice100,
        quantityByProduct.get(item.productId) || item.quantity,
        prod.bulkPriceMinimumQuantity
      );
      const currentEffectivePrice = calculateCustomerPrice(currentBasePrice);
      let adjustedItem = { ...item };

      // Price verification
      if (Math.abs(item.unitPrice - currentEffectivePrice) > 0.01) {
        priceAdjustments.push({
          styleNo: item.styleNo,
          previousPrice: item.unitPrice,
          currentPrice: currentEffectivePrice
        });
        adjustedItem.unitPrice = currentEffectivePrice;
        adjustmentsApplied = true;
        issues.push(`款号 ${item.styleNo} 单价已按实时批发价由 €${item.unitPrice.toFixed(2)} 更新为 €${currentEffectivePrice.toFixed(2)}`);
      }

      // Stock availability check across all warehouse locations
      const targetSku = prod.skus?.find(s => s.sku === item.sku);
      if (targetSku) {
        const totalAvail = getSkuAvailability(targetSku);
        if (targetSku.allowBackorder === false && totalAvail <= 0) {
          removedItems.push({
            styleNo: item.styleNo,
            reason: `款号 ${item.styleNo} (${item.color}/${item.size}) 当前现货已售罄，已从采购车移出`
          });
          issues.push(`款号 ${item.styleNo} 当前已售罄`);
          adjustmentsApplied = true;
          return;
        } else if (targetSku.allowBackorder === false && item.quantity > totalAvail) {
          stockAdjustments.push({
            styleNo: item.styleNo,
            sku: item.sku,
            previousQty: item.quantity,
            adjustedQty: totalAvail,
            reason: `现货库存由加入时的 ${item.quantity} 件变更为 ${totalAvail} 件，可购数已自动调整为 ${totalAvail} 件`
          });
          adjustedItem.quantity = totalAvail;
          adjustmentsApplied = true;
          issues.push(`款号 ${item.styleNo} (${item.color}/${item.size}) 库存现仅存 ${totalAvail} 件，拟采购 ${item.quantity} 件已自动调整为 ${totalAvail} 件`);
        }
      }

      if (prod.moq && adjustedItem.quantity < prod.moq) {
        issues.push(`款号 ${item.styleNo} 当前订购量 (${adjustedItem.quantity} 件) 低于推荐起订量 ${prod.moq} 件`);
      }

      nextCart.push(adjustedItem);
    });

    if (adjustmentsApplied) {
      setCart(nextCart);
      addNotification(
        'warning',
        lang === 'it' ? 'Rettifica Automatica Carrello' : '采购车现货与价格已实时校准',
        lang === 'it'
          ? `Aggiornate giacenze e listini in tempo reale: ${issues.length} modifiche applicate.`
          : `已为您更新最新实时库存与价格，避免因旧采购车造成超卖或价格偏差。`
      );
    }

    return {
      isValid: issues.length === 0,
      hasErrors: issues.length > 0,
      adjustmentsApplied,
      issues,
      stockAdjustments,
      priceAdjustments,
      removedItems
    };
  };

  // Create Order with Multi-Merchant Auto-Splitting (多商户自动分单)
  const persistOrderToServer = async (masterOrder: Order, subOrders: Order[], singleItemToken?: string): Promise<Order | null> => {
    try {
      const result = await apiPost<{ success: true; orders: Order[]; totalQty: number; payment?: { status?: string; checkoutUrl?: string; solana?: Order['solanaPayment'] } }>('/api/orders', { masterOrder, subOrders, singleItemToken });
      if (!result.success) {
        addNotification('warning', '订单未提交', '服务端未接受该采购单，请检查库存与资质后重试');
        return null;
      }
      const authoritativeOrders = result.orders as Order[];
      setOrders(prev => {
        const savedIds = new Set(authoritativeOrders.map(order => order.id));
        return [...authoritativeOrders, ...prev.filter(order => !savedIds.has(order.id))];
      });
      if (!allowLocalBusinessPersistence) {
        clearCart();
      }
      addNotification('success', '订单已提交，等待商家确认', `已提交 ${result.totalQty} 件；商家接受订单前不会锁定库存或要求付款。`);
      if (result.payment?.checkoutUrl) {
        window.location.assign(result.payment.checkoutUrl);
      } else if (masterOrder.paymentMethod === 'credit_card' && result.payment?.status === 'not_configured') {
        addNotification('warning', '在线收款暂不可用', '支付通道尚未配置，请联系商家完成线下付款。');
      } else if (masterOrder.paymentMethod === 'paypal' && result.payment?.status === 'failed') {
        addNotification('warning', 'PayPal 结账暂未创建', '订单已取消且库存已释放；检查 PayPal 配置后，请重新加入购物车下单。');
      } else if (masterOrder.paymentMethod === 'stripe' && result.payment?.status === 'failed') {
        addNotification('warning', 'Stripe 结账暂未创建', '订单已取消且库存已释放；请联系商家检查 Stripe 设置后重新下单。');
      } else if (masterOrder.paymentMethod === 'solana_pay' && result.payment?.status === 'failed') {
        addNotification('warning', 'Solana Pay 付款未创建', '订单已取消且库存已释放；请检查商家钱包与网络配置后重新下单。');
      }
      const savedOrder = authoritativeOrders.find(order => order.orderNo === masterOrder.orderNo) || authoritativeOrders[0] || null;
      return savedOrder && result.payment?.solana
        ? { ...savedOrder, solanaPayment: result.payment.solana }
        : savedOrder;
    } catch (error) {
      addNotification('warning', '订单提交失败', error instanceof Error ? error.message : '网络或服务端暂时不可用，采购车已保留，请稍后重试');
      return null;
    }
  };
  const syncBuyerOrders = async () => {
    try {
      const result = await apiGet<{ success: true; orders: Order[] }>('/api/orders');
      if (result.success && Array.isArray(result.orders)) {
        setOrders(result.orders as Order[]);
      }
    } catch {
      addNotification('warning', '订单同步暂时失败', '当前显示本地缓存订单，网络恢复后可再次同步');
    }
  };

  const replaceOrderFromServer = (order: Order) => {
    setOrders(previous => previous.map(current => current.id === order.id ? order : current));
  };

  const syncMerchantData = async (merchantId: string | null = authMerchantId, notifyOnFailure = true): Promise<boolean> => {
    // Authoritative refreshes must bypass the shared GET TTL cache. Otherwise an
    // SSE event or a foreground resume can immediately read the pre-change body.
    const results = await Promise.allSettled([
      apiGet<{ success: true; products: Product[] }>('/api/merchant/products', 0),
      apiGet<{ success: true; orders: Order[] }>('/api/merchant/orders', 0),
      apiGet<{ success: true; payouts: MerchantPayoutRecord[] }>('/api/merchant/finance', 0),
      apiGet<{ success: true; requests: VaultAccessRequest[] }>('/api/merchant/vault-requests', 0),
      apiGet<{ success: true; transfers: StockTransferRecord[] }>('/api/merchant/transfers', 0),
      apiGet<{ success: true; customers: WholesaleCustomer[] }>('/api/merchant/customers', 0),
      apiGet<{ success: true; returns: Array<{ id: string; orderId: string; status: string; refundAmount?: number }> }>('/api/merchant/returns', 0)
    ]);
    const [productResult, orderResult, financeResult, vaultResult, transferResult, customerResult, returnResult] = results;
    const failedResources: string[] = [];

    if (productResult.status === 'fulfilled' && Array.isArray(productResult.value.products) && merchantId) {
      setProducts(previous => replaceMerchantProducts(previous, merchantId, productResult.value.products));
    } else {
      failedResources.push('商品');
    }
    if (financeResult.status === 'fulfilled' && Array.isArray(financeResult.value.payouts)) setPayouts(financeResult.value.payouts);
    else failedResources.push('结算');
    if (vaultResult.status === 'fulfilled' && Array.isArray(vaultResult.value.requests)) setVaultRequests(vaultResult.value.requests);
    else failedResources.push('看货申请');
    if (transferResult.status === 'fulfilled' && Array.isArray(transferResult.value.transfers)) setTransferRecords(transferResult.value.transfers);
    else failedResources.push('调拨');
    if (customerResult.status === 'fulfilled' && Array.isArray(customerResult.value.customers)) setAllCustomers(customerResult.value.customers);
    else failedResources.push('客户');

    if (orderResult.status === 'fulfilled' && Array.isArray(orderResult.value.orders)) {
      const authoritativeOrders = orderResult.value.orders;
      if (returnResult.status === 'fulfilled' && Array.isArray(returnResult.value.returns)) {
        const returnsByOrder = new Map(returnResult.value.returns.map(item => [item.orderId, item]));
        setOrders(authoritativeOrders.map(order => {
          const returnRequest = returnsByOrder.get(order.id);
          if (!returnRequest) return order;
          return {
            ...order,
            returnRequestId: returnRequest.id,
            refundStatus: returnRequest.status as Order['refundStatus'],
            refundAmount: returnRequest.refundAmount === undefined ? order.refundAmount : Number(returnRequest.refundAmount)
          };
        }));
      } else {
        setOrders(authoritativeOrders);
        failedResources.push('退货');
      }
    } else {
      failedResources.push('订单');
    }

    const uniqueFailures = [...new Set(failedResources)];
    if (uniqueFailures.length && notifyOnFailure) {
      addNotification(
        'warning',
        '部分商家数据同步失败',
        `未更新：${uniqueFailures.join('、')}。已成功读取的数据仍以服务端为准，网络恢复后会自动重试。`
      );
    }
    return uniqueFailures.length === 0;
  };

  useEffect(() => {
    if (allowLocalBusinessPersistence || authRole !== 'merchant' || !authMerchantId) return;
    let active = true;
    let requestInFlight = false;
    let lastSyncFailed = false;
    const syncMerchantCollections = async () => {
      if (!active || document.visibilityState !== 'visible' || requestInFlight) return;
      requestInFlight = true;
      try {
        const succeeded = await syncMerchantData(authMerchantId, false);
        if (active && !succeeded && !lastSyncFailed) {
          addNotification('warning', '商家数据同步暂时失败', '其他设备的最新商品、订单、客户与财务数据可能尚未显示。网络恢复后将自动重试。');
        }
        if (active) lastSyncFailed = !succeeded;
      } finally {
        requestInFlight = false;
      }
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncMerchantCollections();
    };
    const interval = window.setInterval(() => void syncMerchantCollections(), 30_000);
    const eventSource = typeof EventSource === 'undefined'
      ? null
      : new EventSource(resolveApiUrl('/api/merchant/events'), { withCredentials: true });
    // Native EventSource reconnects automatically. Re-read the full server state
    // after every (re)connect so events missed while offline cannot leave stale
    // data on screen.
    eventSource?.addEventListener('open', () => {
      void syncMerchantCollections();
    });
    eventSource?.addEventListener('merchant.changed', event => {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return;
      let resources: unknown;
      try {
        const payload: unknown = JSON.parse(event.data);
        if (payload && typeof payload === 'object' && 'resources' in payload) {
          resources = payload.resources;
        }
      } catch {
        console.error('[merchant-sync-event]', 'invalid event payload');
        return;
      }
      if (!Array.isArray(resources)
        || resources.some(resource => typeof resource !== 'string'
          || !['products', 'orders', 'inventory', 'customers', 'production', 'finance', 'settings', 'content', 'growth'].includes(resource))) {
        console.error('[merchant-sync-event]', 'invalid resource list');
        return;
      }
      void syncMerchantCollections();
      window.dispatchEvent(new CustomEvent('merchant-data-changed', {
        detail: { resources }
      }));
    });
    window.addEventListener('focus', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      eventSource?.close();
      window.removeEventListener('focus', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [allowLocalBusinessPersistence, authRole, authMerchantId]);

  const syncAdminData = async () => {
    const results = await Promise.allSettled([
      apiGet<{ success: true; merchants: Merchant[] }>('/api/admin/merchants', 30000),
      apiGet<{ success: true; products: Product[] }>('/api/admin/products', 30000),
      apiGet<{ success: true; customers: WholesaleCustomer[] }>('/api/admin/customers', 30000),
      apiGet<{ success: true; orders: Order[] }>('/api/admin/orders', 30000),
      apiGet<{ success: true; payouts: MerchantPayoutRecord[] }>('/api/admin/payouts', 30000),
      apiGet<{ success: true; logs: AuditLogRecord[] }>('/api/admin/audit-logs', 30000),
      apiGet<{ success: true; requests: VaultAccessRequest[] }>('/api/admin/vault-requests', 30000)
    ]);

    const [merchantResult, productResult, customerResult, orderResult, payoutResult, auditResult, vaultResult] = results;
    if (merchantResult.status === 'fulfilled' && Array.isArray(merchantResult.value.merchants)) setMerchants(merchantResult.value.merchants);
    if (productResult.status === 'fulfilled' && Array.isArray(productResult.value.products)) setProducts(productResult.value.products);
    if (customerResult.status === 'fulfilled' && Array.isArray(customerResult.value.customers)) setAllCustomers(customerResult.value.customers);
    if (orderResult.status === 'fulfilled' && Array.isArray(orderResult.value.orders)) setOrders(orderResult.value.orders);
    if (payoutResult.status === 'fulfilled' && Array.isArray(payoutResult.value.payouts)) setPayouts(payoutResult.value.payouts);
    if (auditResult.status === 'fulfilled' && Array.isArray(auditResult.value.logs)) setAuditLogs(auditResult.value.logs);
    if (vaultResult.status === 'fulfilled' && vaultResult.value && Array.isArray(vaultResult.value.requests)) {
      setVaultRequests(vaultResult.value.requests);
    }

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const sessionExpired = failures.some(result => result.status === 'rejected'
        && result.reason instanceof ApiError
        && result.reason.status === 401);
      if (sessionExpired) {
        handleAdminSessionExpired();
      } else {
        addNotification('warning', '部分后台数据同步失败', `${failures.length} 个模块暂时无法同步，其余数据已保持最新`);
      }
    }
  };

  const persistReturnRequestToServer = async (order: Order, reason: string, quantity?: number) => {
    let remaining = quantity || order.totalQty;
    const items = order.items.flatMap(item => {
      const returnedQty = Math.min(item.quantity, remaining);
      remaining -= returnedQty;
      return returnedQty > 0 ? [{ productId: item.productId, sku: item.sku, quantity: returnedQty }] : [];
    });

    try {
      const result = await apiPost<{ success: true; returnRequest: { id: string } }>(`/api/orders/${encodeURIComponent(order.id)}/return`, { reason, items });
      setOrders(prev => prev.map(item => item.id === order.id ? { ...item, returnRequestId: result.returnRequest.id } : item));
    } catch (error) {
      addNotification('warning', '退货申请同步失败', error instanceof Error ? error.message : '本地申请已保留，请检查网络后重试');
    }
  };

  const persistReturnReviewToServer = async (order: Order, status: 'approved' | 'rejected') => {
    const returnRequestId = order.returnRequestId;
    if (!returnRequestId) return;
    const endpoint = authRole === 'admin'
      ? `/api/admin/returns/${encodeURIComponent(returnRequestId)}/review`
      : `/api/merchant/returns/${encodeURIComponent(returnRequestId)}/review`;
    try {
      await apiRequest(endpoint, { method: 'PUT', body: JSON.stringify({ status }) });
    } catch (error) {
      addNotification('warning', '退款审核同步失败', error instanceof Error ? error.message : '本地状态已更新，但服务端需要稍后重试');
    }
  };

  const persistPayoutStatusToServer = async (payoutId: string, status: MerchantPayoutRecord['status']) => {
    if (!['processing', 'paid', 'failed'].includes(status)) return;
    const endpoint = authRole === 'admin'
      ? `/api/admin/payouts/${encodeURIComponent(payoutId)}/status`
      : `/api/merchant/payouts/${encodeURIComponent(payoutId)}/status`;
    try {
      await apiRequest(endpoint, { method: 'PUT', body: JSON.stringify({ status }) });
    } catch (error) {
      addNotification('warning', '结算同步失败', error instanceof Error ? error.message : '本地状态已更新，请稍后重试服务端同步');
    }
  };

  const createOrder = async (orderData: {
    deliveryType: 'shipping' | 'showroom_pickup';
    pickupLocation?: string;
    paymentMethod: 'bank_transfer' | 'net_30' | 'credit_card' | 'paypal' | 'stripe' | 'solana_pay' | 'credit_line';
    solanaToken?: SolanaTokenSymbol;
    shippingAddress: { street: string; city: string; country: string; zip: string; recipient?: string; phone?: string; };
    shippingFee?: number;
    notes?: string;
    promotionCode?: string;
    singleItemToken?: string;
  }): Promise<Order | null> => {
    if (authRole !== 'buyer' || !currentCustomer || currentCustomer.status !== 'approved') {
      addNotification(
        'warning',
        '请先完成买手登录与资质审核',
        '正式采购单必须由服务端确认的已审核企业账号提交。'
      );
      return null;
    }
    if (orderSubmissionInFlight.current) {
      addNotification('info', '采购单正在提交', '请勿重复点击，系统正在等待服务端确认。');
      return null;
    }
    orderSubmissionInFlight.current = true;

    const orderBatchId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const orderNum = Date.now().toString(36).toUpperCase();
    const parentOrderNo = `#${orderNum}`;
    const today = new Date().toISOString().split('T')[0];

    // Group cart items by merchantId
    const merchantMap = new Map<string, CartItem[]>();
    cart.forEach(item => {
      const mId = item.merchantId || 'mch-prato';
      const existing = merchantMap.get(mId) || [];
      existing.push(item);
      merchantMap.set(mId, existing);
    });

    const isMultiMerchant = merchantMap.size > 1;

    // Generate Sub-Orders if multi-merchant
    const subOrders: Order[] = [];
    let subOrderIndex = 1;

    merchantMap.forEach((itemsForMerchant, mId) => {
      const merchantObj = merchants.find(m => m.id === mId);
      const mName = merchantObj?.name || itemsForMerchant[0]?.merchantName || 'Prato Fashion Hub';
      const subTotalQty = itemsForMerchant.reduce((s, i) => s + i.quantity, 0);
      const subTotalAmount = itemsForMerchant.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const subOrderNo = isMultiMerchant ? `${parentOrderNo}-${String.fromCharCode(64 + subOrderIndex)}` : parentOrderNo;
      const subOrderShippingFee = subOrderIndex === 1 ? (orderData.shippingFee || 0) : 0;

      const subOrder: Order = {
        id: `ord-${orderBatchId}-${subOrderIndex}`,
        orderNo: subOrderNo,
        parentOrderNo: isMultiMerchant ? parentOrderNo : undefined,
        idempotencyKey: `${orderBatchId}-${subOrderIndex}`,
        merchantId: mId,
        merchantName: mName,
        date: today,
        customerId: currentCustomer ? currentCustomer.id : 'guest-buyer',
        companyName: currentCustomer ? currentCustomer.companyName : 'Wholesale Buyer (Pending VAT)',
        items: itemsForMerchant,
        totalQty: subTotalQty,
        totalAmount: parseFloat((subTotalAmount + subOrderShippingFee).toFixed(2)),
        shippingFee: subOrderShippingFee,
        status: 'pending',
        deliveryType: orderData.deliveryType,
        pickupLocation: orderData.pickupLocation,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: ['credit_card', 'paypal', 'stripe', 'solana_pay'].includes(orderData.paymentMethod) ? 'pending' : 'pending_credit',
        solanaToken: orderData.solanaToken,
        refundStatus: 'none',
        trackingNumber: orderData.deliveryType === 'shipping' ? `IT-DHL-${orderNum}${String.fromCharCode(64 + subOrderIndex)}` : `PU-${mId.toUpperCase().slice(-5)}-${orderNum}`,
        carrier: orderData.deliveryType === 'shipping' ? 'DHL Express Europe' : '到店核销自提',
        notes: orderData.notes,
        timeline: [
          { 
            status: 'pending', 
            title: '商家分单已生成 (Merchant Order Created)', 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            completed: true,
            note: `已派单至供应商 [${mName}] 独立履约系统`
          },
          { status: 'confirmed', title: '商家确认接单 (Confirmed)', time: '-', completed: false },
          { status: 'picking', title: '独立拣选配货中 (Picking)', time: '-', completed: false },
          { status: 'shipped', title: orderData.deliveryType === 'shipping' ? '已发货 (Shipped)' : '到店待提 (Ready for pickup)', time: '-', completed: false },
          { status: 'delivered', title: '已签收 (Delivered)', time: '-', completed: false }
        ],
        shippingAddress: orderData.shippingAddress
      };

      subOrders.push(subOrder);
      subOrderIndex++;
    });

    // Parent Master Order (seen by Buyer & Platform Admin)
    const masterOrder: Order = {
      id: `ord-${orderBatchId}`,
      orderNo: parentOrderNo,
      date: today,
      customerId: currentCustomer ? currentCustomer.id : 'guest-buyer',
      companyName: currentCustomer ? currentCustomer.companyName : 'Wholesale Buyer (Pending VAT)',
      items: [...cart],
      totalQty: totalCartQty,
      totalAmount: parseFloat((totalCartAmount + (orderData.shippingFee || 0)).toFixed(2)),
      shippingFee: orderData.shippingFee || 0,
      promotionCode: orderData.promotionCode || undefined,
      status: 'pending',
      deliveryType: orderData.deliveryType,
      pickupLocation: orderData.pickupLocation,
      paymentMethod: orderData.paymentMethod,
      paymentStatus: ['credit_card', 'paypal', 'stripe', 'solana_pay'].includes(orderData.paymentMethod) ? 'pending' : 'pending_credit',
      solanaToken: orderData.solanaToken,
      refundStatus: 'none',
      trackingNumber: orderData.deliveryType === 'shipping' ? `IT-DHL-${orderNum}X` : `PU-SHOWROOM-${orderNum}`,
      carrier: orderData.deliveryType === 'shipping' ? 'DHL Express Europe' : '到店核销自提',
      notes: orderData.notes,
      timeline: [
        { 
          status: 'pending', 
          title: '总采购单已下单 (Master Order Placed)', 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
          completed: true,
          note: isMultiMerchant ? `系统已按供应商自动拆分为 ${subOrders.length} 笔商家子订单` : '单商户直派订单'
        },
        { status: 'confirmed', title: '各商家确认 (Confirmed)', time: '-', completed: false },
        { status: 'picking', title: '多商户多仓配货 (Picking)', time: '-', completed: false },
        { status: 'shipped', title: orderData.deliveryType === 'shipping' ? '物流发货 (Shipped)' : '到店待提 (Ready for pickup)', time: '-', completed: false },
        { status: 'delivered', title: '已全部签收 (Delivered)', time: '-', completed: false }
      ],
      shippingAddress: orderData.shippingAddress,
      subOrders: isMultiMerchant ? subOrders : undefined,
      idempotencyKey: orderBatchId
    };

    // In production, inventory is authoritative on the server transaction.
    if (allowLocalBusinessPersistence && !orderData.singleItemToken && orderData.paymentMethod !== 'solana_pay') {
      deductStockForOrder(cart, orderData.deliveryType, orderData.pickupLocation);
    }

    // Save orders: Add master order and individual sub-orders for merchant portals
    if (allowLocalBusinessPersistence && !orderData.singleItemToken && orderData.paymentMethod !== 'solana_pay') {
      if (isMultiMerchant) {
        setOrders(prev => [masterOrder, ...subOrders, ...prev]);
      } else {
        setOrders(prev => [masterOrder, ...prev]);
      }
    }
    const merchantNamesStr = Array.from(merchantMap.keys())
      .map(id => merchants.find(m => m.id === id)?.name || id)
      .join(', ');
    if (allowLocalBusinessPersistence && !orderData.singleItemToken && orderData.paymentMethod !== 'solana_pay') {
      void persistOrderToServer(masterOrder, subOrders);
      clearCart();
      orderSubmissionInFlight.current = false;
      addNotification(
        'success',
        `采购单 ${parentOrderNo} 提交成功!`,
        isMultiMerchant
          ? `系统已智能按商家拆分为 ${subOrders.length} 笔子单，分别下发给: ${merchantNamesStr}`
          : '已自动派发给对应商户并锁定实时现货库存。'
      );
      return masterOrder;
    }

    addAuditLog(
      'ORDER_CREATE_SPLIT',
      'Order',
      parentOrderNo,
      '-',
      `Master Order ${parentOrderNo} created with ${merchantMap.size} merchant(s), total €${totalCartAmount.toFixed(2)}`
    );

    try {
      const result = await persistOrderToServer(masterOrder, subOrders, orderData.singleItemToken);
      if (result) setSingleItemCheckoutToken(null);
      return result;
    } finally {
      orderSubmissionInFlight.current = false;
    }
  };

  const placeOrder = async (data: {
    deliveryType: any;
    pickupShowroomId?: string;
    pickupLocation?: string;
    shippingAddress?: any;
    shippingFee?: number;
    paymentMethod: any;
    solanaToken?: SolanaTokenSymbol;
    notes?: string;
    promotionCode?: string;
    singleItemToken?: string;
  }): Promise<Order | null> => {
    const paymentMethod = data.paymentMethod === 'paypal'
      ? 'paypal'
      : data.paymentMethod === 'stripe'
        ? 'stripe'
        : data.paymentMethod === 'solana_pay'
          ? 'solana_pay'
            : (data.paymentMethod === 'net_30_days' || data.paymentMethod === 'net_30')
              ? 'net_30'
              : (data.paymentMethod === 'bank_wire_transfer' || data.paymentMethod === 'bank_transfer_prepay' || data.paymentMethod === 'bank_transfer')
                ? 'bank_transfer'
                : data.paymentMethod === 'credit_line'
                  ? 'credit_line'
                  : 'credit_card';

    if (currentCustomer && paymentMethod === 'net_30' && !data.promotionCode) {
      const orderTotal = totalCartAmount + (data.shippingFee || 0);
      const remainingCredit = Math.max(0, (currentCustomer.creditLimit || 0) - (currentCustomer.usedCredit || 0) - getCustomerCreditExposure());
      if (currentCustomer.status !== 'approved') {
        addNotification('warning', '账期申请未获批准', '当前客户资质未审核通过，不能使用 Net 30 账期下单。');
        return null;
      }
      if (orderTotal > remainingCredit) {
        addNotification('warning', 'Net 30 授信额度不足', `当前剩余额度仅 €${remainingCredit.toFixed(2)}，无法覆盖本订单金额。`);
        return null;
      }
    }

    let finalPickupLoc = data.pickupLocation;
    if (data.pickupShowroomId) {
      const sh = showrooms.find(s => s.id === data.pickupShowroomId);
      if (sh) finalPickupLoc = `${sh.name} (${sh.city})`;
    }
    const rawAddress = data.shippingAddress;
    const formattedAddress: { street: string; city: string; country: string; zip: string } = {
      street: typeof rawAddress === 'string' ? rawAddress : (rawAddress?.street || '14 Rue du Faubourg Saint-Honoré'),
      city: typeof rawAddress === 'object' ? rawAddress?.city || 'Paris' : 'Paris',
      country: typeof rawAddress === 'object' ? rawAddress?.country || 'France' : 'France',
      zip: typeof rawAddress === 'object' ? rawAddress?.zip || '75008' : '75008'
    };
    return createOrder({
      deliveryType: data.deliveryType === 'showroom_pickup' ? 'showroom_pickup' : 'shipping',
      pickupLocation: finalPickupLoc,
      paymentMethod,
      solanaToken: data.solanaToken,
      shippingAddress: formattedAddress,
      shippingFee: data.shippingFee,
      notes: data.notes,
      promotionCode: data.promotionCode,
      singleItemToken: data.singleItemToken
    });
  };

  // Reorder analysis and smart diff (一键复购深度校验)
  const analyzeReorder = (orderId: string): ReorderAnalysis | null => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    let hasPriceChange = false;
    let hasOutOfStock = false;
    let hasPermissionIssue = false;

    const items: ReorderItemAnalysis[] = order.items.map(item => {
      const prod = getProductById(item.productId);
      if (!prod) {
        hasOutOfStock = true;
        return {
          productId: item.productId,
          styleNo: item.styleNo,
          productName: item.productName,
          sku: item.sku,
          color: item.color,
          size: item.size,
          image: item.image,
          orderedQty: item.quantity,
          availableStock: 0,
          originalPrice: item.unitPrice,
          currentPrice: item.unitPrice,
          isAvailable: false,
          isPriceChanged: false,
          hasPermission: true,
          statusNote: '该款式已下架，无法补货',
          merchantId: item.merchantId,
          merchantName: item.merchantName
        };
      }

      // Check Private Collection permission
      let hasPerm = true;
      let permNote = '';
      if (prod.isPrivateVault) {
        hasPerm = hasVaultAccess(prod.merchantId || '', currentCustomer?.id);
        if (!hasPerm) {
          hasPermissionIssue = true;
          permNote = '缺少该商户 Private Collection 访问授权';
        }
      }

      // Check stock
      const targetSku = prod.skus?.find(s => s.sku === item.sku);
      const availStock = targetSku ? targetSku.stockCentral : 0;
      const isStockSufficient = availStock >= item.quantity;
      const canBackorder = targetSku?.allowBackorder !== false;
      if (!isStockSufficient && !canBackorder) hasOutOfStock = true;

      // Price check
      const currentWholesale = calculateCustomerPrice(prod.wholesalePrice);
      const isPriceDiff = Math.abs(currentWholesale - item.unitPrice) > 0.01;
      if (isPriceDiff) hasPriceChange = true;

      let statusNote = '现货充足，可直接复购';
      if (!hasPerm) {
        statusNote = permNote;
      } else if (!isStockSufficient && canBackorder) {
        statusNote = `现货 ${availStock} 件，需商家确认订货 ${item.quantity - availStock} 件`;
      } else if (availStock === 0) {
        statusNote = '目前缺货';
      } else if (!isStockSufficient) {
        statusNote = `库存紧张: 仅剩 ${availStock} 件 (原订 ${item.quantity} 件)`;
      } else if (isPriceDiff) {
        statusNote = `单价变动: 原 €${item.unitPrice.toFixed(2)} -> 现 €${currentWholesale.toFixed(2)}`;
      }

      return {
        productId: prod.id,
        styleNo: prod.styleNo,
        productName: prod.name,
        sku: item.sku,
        color: item.color,
        size: item.size,
        image: item.image || prod.images[0] || '',
        orderedQty: item.quantity,
        availableStock: availStock,
        originalPrice: item.unitPrice,
        currentPrice: currentWholesale,
        isAvailable: (isStockSufficient || canBackorder) && hasPerm,
        isPriceChanged: isPriceDiff,
        hasPermission: hasPerm,
        statusNote,
        merchantId: prod.merchantId || item.merchantId,
        merchantName: prod.merchantName || item.merchantName
      };
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      items,
      hasPriceChange,
      hasOutOfStock,
      hasPermissionIssue
    };
  };

  // Confirm and load reorder items into cart
  const confirmReorderItems = (items: Array<Omit<CartItem, 'id'>>) => {
    const validItems = items.filter(item => {
      const product = getProductById(item.productId);
      if (!product) return false;
      if (product.isPrivateVault && !hasVaultAccess(product.merchantId || '', currentCustomer?.id)) {
        return false;
      }
      const skuMatch = product.skus.find(sku => sku.sku === item.sku);
      if (!skuMatch) return false;
      const availableQty = Math.max(0, (skuMatch.stockCentral || 0) - (skuMatch.reserved || 0));
      return item.quantity > 0 && (skuMatch.allowBackorder !== false || item.quantity <= availableQty);
    });

    if (validItems.length === 0) {
      addNotification('warning', '无法补货至采购车', '当前订单商品缺失或未授权，无法装入采购车。');
      return;
    }

    addMultipleToCart(validItems);
    setActiveReorderAnalysis(null);
    setCurrentView('cart');
    addNotification('success', '补货已装入采购车', `已按历史订单补货 ${validItems.reduce((sum, item) => sum + item.quantity, 0)} 件，进入采购单确认页。`);
  };

  // Reorder feature (核心批发一键补货)
  const reorderHistoricOrder = (orderId: string) => {
    const analysis = analyzeReorder(orderId);
    if (!analysis) return;

    const validItems: Array<Omit<CartItem, 'id'>> = analysis.items
      .filter(i => i.isAvailable)
      .map(i => {
        const prod = getProductById(i.productId);
        return {
          productId: i.productId,
          styleNo: i.styleNo,
          productName: i.productName,
          image: i.image,
          sku: i.sku,
          color: i.color,
          size: i.size,
          quantity: Math.min(i.orderedQty, i.availableStock),
          unitPrice: i.currentPrice,
          packSize: prod?.packSize || 6,
          merchantId: i.merchantId,
          merchantName: i.merchantName
        };
      });

    if (validItems.length === 0) {
      addNotification('warning', '无法一键补货', '该订单中所有款式均已缺货或无权限，请打开复购分析核验。');
      setActiveReorderAnalysis(analysis);
      return;
    }

    confirmReorderItems(validItems);
  };

  const reorderDirectly = (orderId: string) => {
    reorderHistoricOrder(orderId);
  };

  const adminUpdateOrderStatus = async (orderId: string, status: Order['status'], trackingNo?: string, note?: string): Promise<void> => {
    if (!allowLocalBusinessPersistence && authRole === 'admin') {
      try {
        const result = await apiRequest<{ success: true; order: Order }>(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status, trackingNumber: trackingNo, notes: note })
        });
        setOrders(prev => prev.map(order => order.id === orderId ? result.order as Order : order));
        addNotification('info', '订单状态已更新', `订单 ${orderId} 已推进至 [${status}]`);
        return;
      } catch (error) {
        addNotification('warning', '订单状态同步失败', error instanceof Error ? error.message : '网络或服务端暂时不可用，请稍后重试');
        return;
      }
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;

      const updatedTimeline = o.timeline.map(t => {
        if (t.status === status) {
          return {
            ...t,
            completed: true,
            time: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: note || t.note
          };
        }
        return t;
      });

      const nextOrder = {
        ...o,
        status,
        trackingNumber: trackingNo || o.trackingNumber,
        timeline: updatedTimeline
      };

      if (status === 'delivered') {
        createMerchantPayoutRecord(nextOrder);
      }

      return nextOrder;
    }));
    addNotification('info', '订单状态已更新', `订单 ${orderId} 状态已推进至 [${status}]`);
  };

  // POS Store sale simulator: Demonstrates online/offline unified inventory
  const simulatePosSale = async (skuCode: string, location: WarehouseCode = 'central', qty = 1): Promise<boolean> => {
    const actionKey = `pos:${skuCode}:${location}`;
    if (inventoryActionsInFlight.current.has(actionKey)) return false;
    inventoryActionsInFlight.current.add(actionKey);
    try {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiPost<{ success: true; product: Product }>('/api/admin/inventory/pos-sale', { sku: skuCode, location: 'central', quantity: qty });
        setProducts(prev => prev.map(product => product.id === result.product.id ? result.product : product));
        addNotification('warning', 'POS 售出已确认', `${location.toUpperCase()} 门店已扣减 ${skuCode} × ${qty}`);
        return true;
      } catch (error) {
        addNotification('warning', 'POS 售出失败', error instanceof Error ? error.message : '服务端未接受库存扣减');
        return false;
      }
    }
    let success = false;
    let foundProduct: Product | undefined;

    setProducts(prev => {
      return prev.map(p => {
        const targetSku = p.skus.find(s => s.sku === skuCode);
        if (!targetSku) return p;
        foundProduct = p;

        const available = targetSku.stockCentral;
        if (available < qty) {
          return p;
        }

        success = true;
        const updatedSkus = p.skus.map(s => {
          if (s.sku !== skuCode) return s;
          return {
            ...s,
            stockCentral: s.stockCentral - qty
          };
        });

        return { ...p, skus: updatedSkus };
      });
    });

    if (success && foundProduct) {
      addNotification(
        'warning',
        `线下门店 POS 售出出库!`,
        `${location.toUpperCase()} 门店收银扫码售出 SKU: ${skuCode} × ${qty} 件。中央与全网实时库存已自动同频扣减！`
      );
      return true;
    } else {
      addNotification('warning', 'POS 售出失败', `该门店此 SKU 当前库存不足以完成出库扣减`);
      return false;
    }
    } finally {
      inventoryActionsInFlight.current.delete(actionKey);
    }
  };

  // Stock transfer between central warehouse and showrooms
  const transferStock = async (skuCode: string, fromLoc: WarehouseCode, toLoc: WarehouseCode, qty: number): Promise<boolean> => {
    if (qty <= 0) return false;
    addNotification('warning', '单仓模式', '当前只有总仓，不支持跨仓调拨');
    return false;
    const actionKey = `transfer:${skuCode}:${fromLoc}:${toLoc}`;
    if (inventoryActionsInFlight.current.has(actionKey)) return false;
    inventoryActionsInFlight.current.add(actionKey);
    try {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      try {
        const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const result = await apiPost<{ success: true; product: Product }>('/api/admin/inventory/transfer', { sku: skuCode, fromLocation: fromLoc, toLocation: toLoc, quantity: qty, idempotencyKey });
        setProducts(prev => prev.map(product => product.id === result.product.id ? result.product : product));
        addNotification('success', '库存跨仓调拨完成', `从 ${fromLoc.toUpperCase()} 调出 ${qty} 件至 ${toLoc.toUpperCase()}`);
        return true;
      } catch (error) {
        addNotification('warning', '调拨失败', error instanceof Error ? error.message : '服务端未接受库存调拨');
        return false;
      }
    }
    let success = false;

    setProducts(prev => {
      return prev.map(p => {
        const targetSku = p.skus.find(s => s.sku === skuCode);
        if (!targetSku) return p;

        const getStock = (loc: typeof fromLoc) => {
          if (loc === 'central') return targetSku.stockCentral;
          if (loc === 'mestre') return targetSku.stockMestre;
          return targetSku.stockMilano;
        };

        if (getStock(fromLoc) < qty) {
          return p;
        }

        success = true;
        const updatedSkus = p.skus.map(s => {
          if (s.sku !== skuCode) return s;
          let c = s.stockCentral;
          let m = s.stockMestre;
          let mi = s.stockMilano;

          // Deduct from source
          if (fromLoc === 'central') c -= qty;
          else if (fromLoc === 'mestre') m -= qty;
          else mi -= qty;

          // Add to destination
          if (toLoc === 'central') c += qty;
          else if (toLoc === 'mestre') m += qty;
          else mi += qty;

          return { ...s, stockCentral: c, stockMestre: m, stockMilano: mi };
        });

        return { ...p, skus: updatedSkus };
      });
    });

    if (success) {
      addNotification(
        'success',
        '库存跨仓调拨完成',
        `从 [${fromLoc.toUpperCase()}] 调出 ${qty} 件至 [${toLoc.toUpperCase()}] (SKU: ${skuCode})`
      );
      return true;
    } else {
      addNotification('warning', '调拨失败', '调出仓库存不足');
      return false;
    }
    } finally {
      inventoryActionsInFlight.current.delete(actionKey);
    }
  };

  const restockSKU = async (skuCode: string, location: WarehouseCode = 'central', qty: number): Promise<void> => {
    const actionKey = `inbound:${skuCode}:${location}`;
    if (inventoryActionsInFlight.current.has(actionKey)) return;
    inventoryActionsInFlight.current.add(actionKey);
    try {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      const product = products.find(item => item.skus.some(sku => sku.sku === skuCode));
      if (!product) {
        addNotification('warning', '入库失败', '未找到对应 SKU');
        return;
      }
      try {
        const result = await apiPost<{ success: true; product: Product }>('/api/admin/inventory/inbound', { productId: product.id, sku: skuCode, location: 'central', quantity: qty });
        setProducts(prev => prev.map(item => item.id === result.product.id ? result.product : item));
        addNotification('success', '入库入账成功', `SKU ${skuCode} 已入库 ${qty} 件至 ${location.toUpperCase()}`);
      } catch (error) {
        addNotification('warning', '入库失败', error instanceof Error ? error.message : '服务端未接受入库');
      }
      return;
    }
    setProducts(prev => prev.map(p => {
      const target = p.skus.find(s => s.sku === skuCode);
      if (!target) return p;
      return {
        ...p,
        skus: p.skus.map(s => {
          if (s.sku !== skuCode) return s;
          return {
            ...s,
            stockCentral: s.stockCentral + qty,
          };
        })
      };
    }));
    addNotification('success', '入库入账成功', `SKU ${skuCode} 已入库 ${qty} 件至 ${location.toUpperCase()}`);
    } finally {
      inventoryActionsInFlight.current.delete(actionKey);
    }
  };

  // Customer Management & Wholesale Registration
  const loginAsCustomer = (customerId: string | 'guest') => {
    if (customerId === 'guest') {
      setCurrentCustomer(null);
      addNotification('info', '已切换为游客访客模式', '当前仅显示公开商品与建议零售价，需登录审核以获得批发价');
    } else {
      const found = allCustomers.find(c => c.id === customerId);
      if (found) {
        setCurrentCustomer(found);
        addNotification('success', '已切换B2B客户身份', `已登录为: ${found.companyName} (${found.tier === 'tier_major' ? '大客户 82.5折' : 'VIP客户 9折'})`);
      }
    }
  };

  const submitWholesaleApplication = (formData: Omit<WholesaleCustomer, 'id' | 'status' | 'tier' | 'creditLimit' | 'usedCredit' | 'discountRate' | 'appliedAt'>) => {
    const newCust: WholesaleCustomer = {
      ...formData,
      id: 'cust-' + Date.now(),
      status: 'pending',
      tier: 'tier_standard',
      creditLimit: 0,
      usedCredit: 0,
      discountRate: 1.0,
      appliedAt: new Date().toISOString().split('T')[0]
    };
    setAllCustomers(prev => [newCust, ...prev]);
    setCurrentCustomer(newCust);
    setCurrentView('account');
    addNotification(
      'success',
      '企业批发入驻申请已提交!',
      `VAT 增值税号 ${formData.vatNumber} 已进入后台资质审核通道，审核通过后将自动开放B2B批发订货权。`
    );
  };

  const adminApproveCustomer = async (customerId: string, tier: CustomerTier, creditLimit: number): Promise<void> => {
    const discountRate = tier === 'tier_major' ? 0.825 : tier === 'tier_vip' ? 0.90 : 1.0;
    const previousCustomer = allCustomers.find(customer => customer.id === customerId);
    setAllCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const updated = {
        ...c,
        status: 'approved' as const,
        tier,
        creditLimit,
        discountRate,
        approvedAt: new Date().toISOString().split('T')[0]
      };
      if (currentCustomer?.id === customerId) {
        setCurrentCustomer(updated);
      }
      return updated;
    }));
    if (authRole === 'admin') {
      try {
        const result = await apiRequest<{ success: true; customer: WholesaleCustomer }>(`/api/admin/customers/${encodeURIComponent(customerId)}/review`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'approved', tier, creditLimit, discountRate })
        });
        setAllCustomers(prev => prev.map(customer => customer.id === customerId ? result.customer : customer));
        if (currentCustomer?.id === customerId) setCurrentCustomer(result.customer);
      } catch (error) {
        if (previousCustomer) setAllCustomers(prev => prev.map(customer => customer.id === customerId ? previousCustomer : customer));
        addNotification('warning', '客户审核未同步', error instanceof Error ? error.message : '已回滚本地审核状态');
        return;
      }
    }
    addNotification('success', '客户已审核通过', `客户等级赋予: [${tier}]，信用账期授信: €${creditLimit.toLocaleString()}`);
  };

  const adminRejectCustomer = async (customerId: string): Promise<void> => {
    const previousCustomer = allCustomers.find(customer => customer.id === customerId);
    setAllCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: 'rejected' as const } : c));
    if (authRole === 'admin') {
      try {
        const result = await apiRequest<{ success: true; customer: WholesaleCustomer }>(`/api/admin/customers/${encodeURIComponent(customerId)}/review`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'rejected' })
        });
        setAllCustomers(prev => prev.map(customer => customer.id === customerId ? result.customer : customer));
      } catch (error) {
        if (previousCustomer) setAllCustomers(prev => prev.map(customer => customer.id === customerId ? previousCustomer : customer));
        addNotification('warning', '客户驳回未同步', error instanceof Error ? error.message : '已回滚本地驳回状态');
        return;
      }
    }
    addNotification('warning', '已驳回客户申请', `资质审核未通过`);
  };

  // Showrooms & Appointments
  const bookAppointment = async (bookingData: Omit<Appointment, 'id' | 'appointmentNo' | 'status'>): Promise<Appointment | null> => {
    try {
      const result = await apiPost<{ success: true; appointment: Appointment }>('/api/appointments', bookingData);
      setAppointments(prev => [result.appointment, ...prev.filter(item => item.id !== result.appointment.id)]);
      addNotification(
        'success',
        `展厅预约已提交: ${result.appointment.appointmentNo}`,
        `专员将确认 ${bookingData.showroomName} ${bookingData.date} ${bookingData.time}，确认后会更新状态。`
      );
      return result.appointment;
    } catch (error) {
      addNotification('warning', '预约提交失败', error instanceof Error ? error.message : '请稍后重试');
      return null;
    }
  };

  const adminUpdateAppointmentStatus = async (appointmentId: string, status: Appointment['status']): Promise<void> => {
    const previousAppointment = appointments.find(appointment => appointment.id === appointmentId);
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status } : a));
    if (authRole === 'admin') {
      try {
        const result = await apiRequest<{ success: true; appointment: Appointment }>(`/api/admin/appointments/${encodeURIComponent(appointmentId)}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        setAppointments(prev => prev.map(appointment => appointment.id === appointmentId ? result.appointment : appointment));
      } catch (error) {
        if (previousAppointment) setAppointments(prev => prev.map(appointment => appointment.id === appointmentId ? previousAppointment : appointment));
        addNotification('warning', '预约同步失败', error instanceof Error ? error.message : '已回滚本地预约状态');
        return;
      }
    }
    addNotification('info', '预约状态已变更', `预约 ${appointmentId} 状态: ${status}`);
  };

  const reviewCustomer = (customerId: string, status: 'approved' | 'rejected', tier: CustomerTier = 'tier_vip') => {
    if (status === 'approved') {
      adminApproveCustomer(customerId, tier, tier === 'tier_major' ? 50000 : 25000);
    } else {
      adminRejectCustomer(customerId);
    }
  };

  const setCustomerTier = (customerId: string, tier: CustomerTier) => {
    adminApproveCustomer(customerId, tier, tier === 'tier_major' ? 50000 : tier === 'tier_vip' ? 25000 : 10000);
  };

  const confirmAppointment = (appointmentId: string) => {
    adminUpdateAppointmentStatus(appointmentId, 'confirmed');
  };

  // Multi-Merchant & Vault Handlers
  const getMerchantById = (id: string) => {
    return merchants.find(m => m.id === id);
  };

  const addMerchant = async (merchantData: Omit<Merchant, 'id'> & { password?: string }): Promise<Merchant> => {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      const result = await apiRequest<{ success: true; merchant: Merchant }>('/api/admin/merchants', {
        method: 'POST',
        body: JSON.stringify(merchantData)
      });
      setMerchants(prev => [result.merchant, ...prev.filter(merchant => merchant.id !== result.merchant.id)]);
      addNotification('success', '商户创建成功', `${result.merchant.name} 已保存到平台数据库`);
      return result.merchant;
    }
    const storeSlug = makeUniqueMerchantStoreSlug(
      merchantData.storeSlug || merchantData.slug || merchantData.code || merchantData.name,
      merchants.flatMap(merchant => [merchant.storeSlug, merchant.slug, merchant.id]),
      `store-${Date.now().toString(36)}`
    );
    const newMerchant: Merchant = {
      ...merchantData,
      id: 'mch-' + Date.now().toString(36),
      slug: merchantData.slug || storeSlug,
      storeSlug
    };
    setMerchants(prev => [newMerchant, ...prev]);
    addNotification('success', '商家展厅创建成功', `商家 ${newMerchant.name} 已入驻平台并开设专属展厅`);
    return newMerchant;
  };

  const updateMerchant = async (merchantId: string, updates: Partial<Merchant>): Promise<void> => {
    setMerchants(prev => prev.map(m => m.id === merchantId ? { ...m, ...updates } : m));
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiRequest<{ success: true; merchant: Merchant }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/status`, {
          method: 'PUT',
          body: JSON.stringify({
            isVerified: updates.isVerified,
            storefrontEnabled: updates.storefrontEnabled,
            platformFeeRate: updates.platformFeeRate
          })
        });
        setMerchants(prev => prev.map(merchant => merchant.id === merchantId ? result.merchant : merchant));
      } catch (error) {
        addNotification('warning', '商户状态同步失败', error instanceof Error ? error.message : '服务端未接受商户状态变更');
        void syncAdminData();
        return;
      }
    }
    addNotification('info', '商户资料已更新', `商家信息及展厅配置已成功更新`);
  };

  const deleteMerchant = async (merchantId: string): Promise<void> => {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      const result = await apiRequest<{ success: true; merchant: Merchant }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}`, { method: 'DELETE' });
      setMerchants(prev => prev.map(merchant => merchant.id === merchantId ? result.merchant : merchant));
      addNotification('warning', '商户已停用', '商户已归档，历史订单、结算和审计记录保留');
      return;
    }
    setMerchants(prev => prev.map(merchant => merchant.id === merchantId ? { ...merchant, isVerified: false } : merchant));
    addNotification('warning', '商户已停用', '商户已停止公开展示，历史数据保留');
  };

  const hasVaultAccess = (merchantId: string, customerId?: string): boolean => {
    const cId = customerId || currentCustomer?.id;
    if (!cId) return false;
    return vaultRequests.some(r => r.merchantId === merchantId && r.customerId === cId && r.status === 'approved');
  };

  const getVaultStatus = (merchantId: string, customerId?: string): 'none' | 'pending' | 'approved' | 'rejected' => {
    const cId = customerId || currentCustomer?.id;
    if (!cId) return 'none';
    const req = vaultRequests.find(r => r.merchantId === merchantId && r.customerId === cId);
    return req ? req.status : 'none';
  };

  const requestVaultAccess = async (merchantId: string, note?: string): Promise<void> => {
    if (!currentCustomer) {
      addNotification('warning', '请先登录买手账号', '查看商家最新爆款独家专区需要先登录采购资质');
      setCurrentView('register_wholesale');
      return;
    }
    if (currentCustomer.status !== 'approved') {
      addNotification(
        'warning',
        lang === 'it' ? 'Verifica aziendale necessaria' : '请先完成企业认证',
        lang === 'it' ? 'Dopo l’approvazione potrai richiedere l’accesso alle collezioni private.' : '注册后可以浏览公开内容，企业认证通过后才可申请私密货盘权限。'
      );
      return;
    }

    const merchant = getMerchantById(merchantId);
    const existing = vaultRequests.find(r => r.merchantId === merchantId && r.customerId === currentCustomer.id);
    if (existing) {
      if (existing.status === 'pending') {
        addNotification('info', '审核正在进行中', `您对 ${merchant?.name || '商家'} 的最新爆款看货申请已提交，请耐心等待商家同意`);
        return;
      }
      if (existing.status === 'approved') {
        addNotification('success', '已获看货授权', `您已拥有 ${merchant?.name || '商家'} 独家首发新款的看货准入权限`);
        return;
      }
    }

    const newReq: VaultAccessRequest = {
      id: 'req-' + Date.now().toString(36),
      merchantId,
      merchantName: merchant?.name || '认证商家',
      customerId: currentCustomer.id,
      companyName: currentCustomer.companyName,
      contactPerson: currentCustomer.contactPerson,
      phone: currentCustomer.phone,
      businessType: currentCustomer.businessType,
      note: note || '申请查阅最新首发独家爆款样板及大货出厂报价',
      status: 'pending',
      appliedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    if (!allowLocalBusinessPersistence) {
      try {
        const result = await apiPost<{ success: true; request: VaultAccessRequest }>('/api/vault/request', { merchantId, note });
        setVaultRequests(prev => [result.request, ...prev.filter(item => item.id !== result.request.id)]);
        addNotification('success', '申请已送达商家', `已向 ${merchant?.name || '商家'} 递交看货申请`);
      } catch (error) {
        addNotification('warning', '看货申请提交失败', error instanceof Error ? error.message : '服务端未接受申请');
      }
      return;
    }
    setVaultRequests(prev => [newReq, ...prev]);
    addNotification('success', '申请已送达商家', `已向 ${merchant?.name} 递交新款看货申请，待商家同意后即可解锁最新爆款`);
  };

  const approveVaultAccess = async (requestId: string): Promise<void> => {
    if (authRole === 'merchant' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiRequest<{ success: true; request: VaultAccessRequest }>(`/api/merchant/vault-requests/${encodeURIComponent(requestId)}/review`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'approved' })
        });
        setVaultRequests(prev => prev.map(request => request.id === requestId ? result.request : request));
      } catch (error) {
        addNotification('warning', '看货申请审批失败', error instanceof Error ? error.message : '服务端未接受审批');
      }
      return;
    }
    setVaultRequests(prev => prev.map(r => r.id === requestId ? {
      ...r,
      status: 'approved',
      reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    } : r));
    addNotification('success', '已同意看货申请', '买手已获得该商家独家爆款专区看货权限');
  };

  const rejectVaultAccess = async (requestId: string): Promise<void> => {
    if (authRole === 'merchant' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiRequest<{ success: true; request: VaultAccessRequest }>(`/api/merchant/vault-requests/${encodeURIComponent(requestId)}/review`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'rejected' })
        });
        setVaultRequests(prev => prev.map(request => request.id === requestId ? result.request : request));
      } catch (error) {
        addNotification('warning', '看货申请驳回失败', error instanceof Error ? error.message : '服务端未接受驳回');
      }
      return;
    }
    setVaultRequests(prev => prev.map(r => r.id === requestId ? {
      ...r,
      status: 'rejected',
      reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    } : r));
    addNotification('warning', '已驳回专属商品申请', '已拒绝此买手的 Private Collection 专属商品访问请求');
  };

  const approveVaultRequest = approveVaultAccess;
  const rejectVaultRequest = rejectVaultAccess;
  const adminReviewVaultRequest = async (requestId: string, status: 'approved' | 'rejected'): Promise<void> => {
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiRequest<{ success: true; request: VaultAccessRequest }>(`/api/admin/vault-requests/${encodeURIComponent(requestId)}/review`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        setVaultRequests(prev => prev.map(request => request.id === requestId ? result.request : request));
        addNotification(status === 'approved' ? 'success' : 'warning', status === 'approved' ? '授权申请已通过' : '授权申请已驳回', `申请 ${requestId} 已完成平台审核`);
        return;
      } catch (error) {
        addNotification('warning', '授权申请审核失败', error instanceof Error ? error.message : '服务端未接受审核');
        return;
      }
    }
    setVaultRequests(prev => prev.map(request => request.id === requestId ? {
      ...request,
      status,
      reviewedAt: new Date().toISOString()
    } : request));
  };
  const toggleProductExclusive = (productId: string) => {
    const product = products.find(item => item.id === productId);
    if (product) {
      updateProduct(productId, {
        isExclusiveProtected: !product.isExclusiveProtected,
        visibility: product.isExclusiveProtected ? 'public' : 'private'
      });
    }
  };

  const logVaultAccess = (merchantId: string, collectionName?: string): boolean => {
    if (!currentCustomer) return false;
    const merchant = getMerchantById(merchantId);
    const hasAccess = hasVaultAccess(merchantId, currentCustomer.id);
    if (!hasAccess) return false;

    const request = vaultRequests.find(r => r.merchantId === merchantId && r.customerId === currentCustomer.id && r.status === 'approved');

    const logEntry: VaultAccessAuditLog = {
      id: 'val-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      customerId: currentCustomer.id,
      customerName: currentCustomer.contactPerson,
      companyName: currentCustomer.companyName,
      merchantId,
      merchantName: merchant?.name || 'Partner Merchant',
      collectionName: collectionName || 'Private Capsule Collection',
      accessedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      approvedBy: request?.reviewedAt ? `Direzione ${merchant?.name || 'Merchant'}` : 'Platform Security',
      expiresAt: '2026-12-31',
      ipAddress: '194.242.110.12 (PWA Session)'
    };

    setVaultAccessAuditLogs(prev => [logEntry, ...prev.slice(0, 49)]);
    return true;
  };

  const getAuthorizedProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;
    const isPrivate = prod.isExclusiveProtected || prod.visibility === 'private' || prod.isPrivateVault;
    if (!isPrivate) {
      return { product: prod, isAuthorized: true };
    }

    const isAuthorized = hasVaultAccess(prod.merchantId || '', currentCustomer?.id);
    if (isAuthorized) {
      logVaultAccess(prod.merchantId || '', prod.styleNo);
      return { product: prod, isAuthorized: true };
    }

    // Masked product when non-authorized
    const maskedProduct: Product = {
      ...prod,
      wholesalePrice: 0,
      wholesalePrice100: 0,
      fabric: '*** Riservato ai buyer accreditati (专属受保护面料与技术参数) ***',
      composition: '*** Protetto da marcatura anticopia ***',
      images: ['https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=400&auto=format&fit=crop'],
      description: 'Questo capo fa parte della Collezione Riservata del fornitore. Richiedi l\'accesso B2B per visualizzare foto ad alta risoluzione, cartella colori e listino prezzi.',
      description_zh: '该款式属于供应商独家防抄袭首发专区。需向该商家申请准入授权，核验通过后方可查阅高清实拍与大货出厂报价。'
    };

    return {
      product: maskedProduct,
      isAuthorized: false,
      maskedFields: ['wholesalePrice', 'images', 'fabric', 'composition', 'skus']
    };
  };

  const addProduct = async (productData: Omit<Product, 'id'> & { creationRequestKey?: string }): Promise<Product> => {
    if (authRole === 'merchant') {
      const result = await apiPost<{ success: true; product: Product }>('/api/merchant/products', productData);
      setProducts(previous => [
        result.product,
        ...previous.filter(item => item.id !== result.product.id)
      ]);
      return result.product;
    }
    const newProd: Product = {
      ...productData,
      id: 'prod-' + Date.now().toString(36)
    };
    setProducts(prev => [newProd, ...prev]);
    return newProd;
  };

  const updateProduct = async (productId: string, updates: Partial<Product>): Promise<void> => {
    const previousProduct = products.find(product => product.id === productId);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates } : p));
    if (authRole === 'merchant' || authRole === 'admin') {
      const endpoint = authRole === 'merchant' ? `/api/merchant/products/${encodeURIComponent(productId)}` : `/api/admin/products/${encodeURIComponent(productId)}/review`;
      try {
        const expectedUpdatedAt = authRole === 'merchant' ? previousProduct?.updatedAt : undefined;
        const result = await apiRequest<{ success: true; product: Product }>(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          ...updates,
          ...(expectedUpdatedAt ? { expectedUpdatedAt } : {})
        })
        });
        setProducts(prev => prev.map(product => product.id === productId ? result.product : product));
      } catch (error) {
        if (previousProduct) setProducts(prev => prev.map(product => product.id === productId ? previousProduct : product));
        if (error instanceof ApiError && error.code === 'PRODUCT_VERSION_CONFLICT') {
          void syncMerchantData(undefined, false);
          throw new Error('商品已在其他端更新，已重新读取服务端版本，请核对后重试。');
        }
        addNotification('warning', '商品同步失败', error instanceof Error ? error.message : '已回滚本地修改，请稍后重试服务端同步');
        throw error;
      }
    }
    addNotification('info', '商品已更新', '商品信息已同步');
  };

  const replaceMerchantProductsFromServer = (merchantId: string, merchantProducts: Product[]) => {
    setProducts(previous => replaceMerchantProducts(previous, merchantId, merchantProducts));
  };

  const replaceProductFromServer = (product: Product) => {
    setProducts(previous => previous.map(item => item.id === product.id ? product : item));
  };

  const deleteProduct = async (productId: string): Promise<void> => {
    const previousProduct = products.find(product => product.id === productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    if (authRole === 'merchant' || authRole === 'admin') {
      const endpoint = authRole === 'merchant' ? `/api/merchant/products/${encodeURIComponent(productId)}` : `/api/admin/products/${encodeURIComponent(productId)}/review`;
      try {
        await apiRequest(endpoint, {
        method: authRole === 'merchant' ? 'DELETE' : 'PUT',
        body: authRole === 'merchant' ? undefined : JSON.stringify({ lifecycleStatus: 'archived' })
        });
      } catch (error) {
        if (previousProduct) setProducts(prev => [previousProduct, ...prev]);
        addNotification('warning', '商品下架同步失败', error instanceof Error ? error.message : '已恢复本地商品，请稍后重试服务端同步');
        throw error;
      }
    }
    addNotification('warning', '商品已删除', '商品已从目录移除');
  };

  const importProductsBatch = async (newProducts: Product[]) => {
    if (authRole === 'merchant' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiPost<{ success: true; count: number; products: Product[] }>('/api/merchant/products/batch', { products: newProducts });
        setProducts(prev => [...result.products, ...prev]);
        addNotification('success', '批量导入成功', `服务端已确认导入 ${result.count} 款商品`);
      } catch (error) {
        addNotification('warning', '批量导入失败', error instanceof Error ? error.message : '服务端未接受批量导入');
      }
      return;
    }
    setProducts(prev => [...newProducts, ...prev]);
    addNotification('success', '批量导入成功', `成功导入 ${newProducts.length} 款商品`);
  };

  const createInboundStock = async (record: Omit<StockInboundRecord, 'id' | 'batchNo' | 'date'>): Promise<StockInboundRecord> => {
    const newRecord: StockInboundRecord = {
      ...record,
      id: 'inb-' + Date.now(),
      batchNo: 'BATCH-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split('T')[0]
    };
    if (authRole === 'admin' && !allowLocalBusinessPersistence) {
      try {
        for (const item of record.items) {
          const product = products.find(candidate => candidate.styleNo === item.styleNo && candidate.skus.some(sku => sku.sku === item.sku));
          if (!product) throw new Error(`SKU_NOT_FOUND_${item.sku}`);
          await apiPost('/api/admin/inventory/inbound', {
            productId: product.id,
            sku: item.sku,
            location: record.location,
            quantity: item.quantity,
            referenceId: newRecord.batchNo,
            note: record.note
          });
        }
        await syncAdminData();
        addNotification('success', '入库单已生成', `批次 ${newRecord.batchNo} 已由服务端确认`);
        return newRecord;
      } catch (error) {
        addNotification('warning', '入库失败', error instanceof Error ? error.message : '服务端未接受入库单');
        return newRecord;
      }
    }
    setInboundRecords(prev => [newRecord, ...prev]);
    addNotification('success', '入库单已生成', `批次 ${newRecord.batchNo} 已确认`);
    return newRecord;
  };

  const registerWholesaleCustomer = (formData: any) => {
    submitWholesaleApplication(formData);
  };

  const uploadCustomerDocument = (customerId: string, doc: Omit<CustomerDocument, 'id' | 'uploadedAt'>) => {
    const newDoc: CustomerDocument = {
      ...doc,
      id: 'doc-' + Date.now(),
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    setAllCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      documents: [...(c.documents || []), newDoc]
    } : c));
    addNotification('success', '证件已上传', `文件【${newDoc.name}】已提交审核`);
  };

  const removeCustomerDocument = (customerId: string, docId: string) => {
    setAllCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      documents: (c.documents || []).filter(d => d.id !== docId)
    } : c));
  };

  const submitSampleInquiry = (inquiry: Omit<CustomSampleInquiry, 'id' | 'inquiryNo' | 'status' | 'createdAt'>): CustomSampleInquiry => {
    const newInquiry: CustomSampleInquiry = {
      ...inquiry,
      id: 'inq-' + Date.now(),
      inquiryNo: 'INQ-' + Date.now().toString().slice(-6),
      status: 'submitted',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setSampleInquiries(prev => [newInquiry, ...prev]);
    addNotification('success', '样衣打样需求已提交', `打样单号: ${newInquiry.inquiryNo}，商家与工厂将在24小时内提供评估`);
    return newInquiry;
  };

  const updateSampleInquiryStatus = (inquiryId: string, status: CustomSampleInquiry['status'], quotedPrice?: number, feedback?: string) => {
    setSampleInquiries(prev => prev.map(i => i.id === inquiryId ? {
      ...i,
      status,
      quotedPrice: quotedPrice !== undefined ? quotedPrice : i.quotedPrice,
      feedback: feedback !== undefined ? feedback : i.feedback
    } : i));
  };

  const cancelOrder = async (orderId: string, reason?: string): Promise<void> => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !['placed', 'pending', 'confirmed', 'picking'].includes(order.status)) {
      addNotification('warning', '订单无法取消', '订单已进入发货或签收流程，不能直接取消，请提交退货申请');
      return;
    }

    if (!allowLocalBusinessPersistence) {
      try {
        const result = await apiPost<{ success: true; order: Order }>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { reason });
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...result.order } : o));
        addNotification('warning', '订单已取消', reason || '订单已由买家申请取消');
        return;
      } catch (error) {
        addNotification('warning', '取消失败', error instanceof Error ? error.message : '网络或服务端暂时不可用，请稍后重试');
        return;
      }
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      restoreStockForOrder({ ...o, status: 'cancelled' });
      return { ...o, status: 'cancelled', notes: reason ? `${o.notes || ''} ${reason}` : o.notes };
    }));
    addNotification('warning', '订单已取消', reason || '订单已由买家申请取消');
  };

  const addTransfer = (recordData: Omit<StockTransferRecord, 'id'>) => {
    const newRecord: StockTransferRecord = {
      ...recordData,
      id: `tr-${Date.now()}`
    };
    addNotification('warning', '单仓模式', '当前只有 RUDA 总仓，不支持创建调拨单');
    return newRecord;
  };

  const updateTransferStatus = (id: string, status: StockTransferRecord['status']) => {
    void id;
    void status;
    addNotification('warning', '单仓模式', '当前只有 RUDA 总仓，不支持更新调拨状态');
  };

  const addAuditLog = (action: string, entity: string, entityId: string, oldValue?: string, newValue?: string) => {
    const newLog: AuditLogRecord = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: portalMode === 'merchant' ? `usr-${activeMerchantId}` : 'usr-admin-01',
      userName: portalMode === 'merchant' ? (merchants.find(m => m.id === activeMerchantId)?.name || 'Merchant Owner') : 'Platform SuperAdmin (Elena V.)',
      role: portalMode === 'merchant' ? 'merchant' : 'admin',
      action,
      entity,
      entityId,
      oldValue: oldValue || '-',
      newValue: newValue || '-',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: '127.0.0.1 (Secure Console)'
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const merchantFulfillOrder = async (orderId: string, status: Order['status'], carrier?: string, trackingNo?: string, notes?: string): Promise<boolean> => {
    if (authRole === 'merchant' && !allowLocalBusinessPersistence) {
      try {
        const result = await apiRequest<{ success: true; order: Order }>(`/api/merchant/orders/${encodeURIComponent(orderId)}/fulfill`, {
          method: 'PUT',
          body: JSON.stringify({ status, carrier, trackingNumber: trackingNo, notes })
        });
        setOrders(prev => prev.map(order => order.id === orderId ? result.order : order));
        addNotification('success', '履约状态已确认', `订单 ${orderId} 已推进至 ${status}`);
        return true;
      } catch (error) {
        addNotification('warning', '履约操作失败', error instanceof Error ? error.message : '服务端未接受履约状态');
        return false;
      }
    }
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const nextOrder = {
          ...o,
          status,
          carrier: carrier || o.carrier || 'DHL Express Europe',
          trackingNumber: trackingNo || o.trackingNumber,
          notes: notes ? `${o.notes || ''} [履约备忘]: ${notes}` : o.notes
        };

        if (status === 'delivered') {
          createMerchantPayoutRecord(nextOrder);
        }

        return nextOrder;
      }
      return o;
    }));
    addAuditLog(
      'ORDER_FULFILLMENT', 
      'Order', 
      orderId, 
      'status: picking/placed', 
      `status: ${status} (Carrier: ${carrier || 'DHL'}, Tracking: ${trackingNo || '-'})`
    );
    return true;
  };

  const syncOrderFromServer = (order: Order) => {
    setOrders(previous => previous.map(item => item.id === order.id ? order : item));
  };

  const getCustomerCreditExposure = (): number => {
    if (!currentCustomer) return 0;
    return orders
      .filter(o => o.customerId === currentCustomer.id && (o.paymentMethod === 'net_30' || o.paymentStatus === 'pending_credit'))
      .reduce((sum, o) => {
        if (o.status === 'delivered' || o.status === 'returned' || o.status === 'cancelled') {
          return sum;
        }
        return sum + (o.totalAmount || 0);
      }, 0);
  };

  const canCustomerPlaceNet30Order = (amount: number): boolean => {
    if (!currentCustomer) return false;
    const remaining = Math.max(0, currentCustomer.creditLimit - (currentCustomer.usedCredit || 0) - getCustomerCreditExposure());
    return amount <= remaining;
  };

  const requestReturn = (orderId: string, reason: string, quantity?: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'delivered' || (order.refundStatus && order.refundStatus !== 'none')) {
      addNotification('warning', '暂不能申请退货', '只有已签收且未处理退款的订单可以发起退货申请');
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const refundAmount = quantity && quantity > 0 && quantity < o.totalQty
        ? Number((o.totalAmount * (quantity / o.totalQty)).toFixed(2))
        : o.totalAmount;

      return {
        ...o,
        status: 'return_requested',
        refundReason: reason,
        refundAmount,
        refundStatus: 'requested'
      };
    }));

    void persistReturnRequestToServer(order, reason, quantity);

    addNotification('info', '退货申请已提交', '平台已记录退货/退款申请，等待商家与财务审核');
  };

  const approveReturn = (orderId: string, refundAmount?: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.refundStatus !== 'requested') return;
    const amount = refundAmount ?? order.refundAmount ?? order.totalAmount;

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        status: 'returned',
        paymentStatus: 'pending_refund',
        refundAmount: amount,
        refundStatus: 'approved'
      };
    }));

    restoreStockForOrder(order);
    setPayouts(prev => prev.map(p => p.merchantId === (order.merchantId || order.items[0]?.merchantId) && p.status !== 'paid'
      ? {
          ...p,
          refunds: Number((p.refunds + amount).toFixed(2)),
          netPayout: Number(Math.max(0, p.netPayout - amount).toFixed(2))
        }
      : p));
    void persistReturnReviewToServer(order, 'approved');
    addAuditLog('RETURN_APPROVE', 'Order', orderId, 'return_requested', `returned / refund €${amount.toFixed(2)}`);
    addNotification('success', '退货申请已批准', '已生成退款凭证并更新结算流水');
  };

  const rejectReturn = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.refundStatus !== 'requested') return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered', refundStatus: 'rejected', refundReason: `${o.refundReason || '退货申请'} 已拒绝` } : o));
    void persistReturnReviewToServer(order, 'rejected');
    addAuditLog('RETURN_REJECT', 'Order', orderId, 'return_requested', 'delivered / refund rejected');
    addNotification('warning', '退货申请已拒绝', '订单将保持原有收货状态，不进行退款');
  };

  const updatePayoutStatus = (payoutId: string, status: MerchantPayoutRecord['status']) => {
    setPayouts(prev => prev.map(p => p.id === payoutId ? {
      ...p,
      status,
      paidAt: status === 'paid' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : p.paidAt
    } : p));
    addAuditLog('PAYOUT_STATUS', 'MerchantPayout', payoutId, 'status changed', status);
    void persistPayoutStatusToServer(payoutId, status);
    addNotification('success', '结算状态已更新', `批次 ${payoutId} 已标记为 ${status}`);
  };

  // ============================================================
  //  CONSUMER + PROMOTIONS + RFQ + MESSAGES + BI/RISK 新增状态
  // ============================================================
  const CONSUMER_TOKEN_KEY = 'ruda_consumer_token';
  const CONSUMER_CART_KEY = 'ruda_consumer_cart';
  const DISPLAY_CURRENCY_KEY = 'ruda_display_currency';

  const [authConsumer, setAuthConsumer] = useState<Consumer | null>(null);
  const [authConsumerToken, setAuthConsumerToken] = useState<string | null>(null);
  const [consumerCart, setConsumerCart] = useState<ConsumerCartItem[]>(() => {
    try { const raw = localStorage.getItem(CONSUMER_CART_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(CONSUMER_CART_KEY, JSON.stringify(consumerCart)); } catch {} }, [consumerCart]);
  const [consumerOrders, setConsumerOrders] = useState<ConsumerOrder[]>([]);
  const [consumerAddresses, setConsumerAddresses] = useState<ConsumerAddress[]>([]);
  const [consumerRetailProducts, setConsumerRetailProducts] = useState<Product[]>([]);
  const [consumerRetailProductsMeta, setConsumerRetailProductsMeta] = useState<{total: number; page: number; limit: number} | null>(null);
  const [consumerRetailProduct, setConsumerRetailProduct] = useState<Product | null>(null);
  const [consumerWishlist, setConsumerWishlist] = useState<Product[]>([]);
  const [lastPromoCalc, setLastPromoCalc] = useState<PromotionCalculationResult | null>(null);
  const [displayCurrency, setDisplayCurrencyState] = useState<SupportedCurrency>(() => (localStorage.getItem(DISPLAY_CURRENCY_KEY) as any) || 'EUR');
  const setDisplayCurrency = (c: SupportedCurrency) => { void saveAccountPreferences({ currency: c }); };
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesSnapshot | null>(null);
  const [adminPromotions, setAdminPromotions] = useState<PromotionRule[]>([]);
  const [buyerRfqs, setBuyerRfqs] = useState<BuyerRfqView[]>([]);
  const [merchantRfqs, setMerchantRfqs] = useState<BuyerRfqView[]>([]);
  const [messageThreads, setMessageThreads] = useState<MessageThreadSummary[]>([]);
  const [activeMessageThread, setActiveMessageThread] = useState<MessageThreadSummary | null>(null);
  const [activeMessageThreadMessages, setActiveMessageThreadMessages] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [biSalesTrend, setBiSalesTrend] = useState<{data: any[]; previousData: any[]}>({ data: [], previousData: [] });
  const [biCategoryPerformance, setBiCategoryPerformance] = useState<any[]>([]);
  const [biMerchantRanking, setBiMerchantRanking] = useState<{data: any[]; previousData: any[]}>({ data: [], previousData: [] });

  const unreadMessagesCount = messageThreads.reduce((s, t) => {
    const last = (t as any).lastMessage; if (!last) return s;
    const mine = last.senderRole === 'admin' || last.senderRole === (authRole === 'consumer' ? 'consumer' : authRole);
    return s + (!t.participants?.some?.((p: any) => p.role !== 'admin' && p.unreadCount === 0) && !last.isRead && !mine ? 1 : 0);
  }, 0);
  const openRiskAlertsCount = riskAlerts.filter(a => !a.isAcknowledged).length;

  const convertCurrency = (amountEUR: number) => {
    if (!exchangeRates || displayCurrency === 'EUR') return amountEUR;
    return +(amountEUR * (exchangeRates.rates?.[displayCurrency] || 1)).toFixed(2);
  };
  const formatMoney = (amountEUR: number, currency?: SupportedCurrency) => {
    const cur = currency || displayCurrency;
    const val = cur === 'EUR' ? amountEUR : convertCurrency(amountEUR);
    const sym: Record<string, string> = { EUR: '€', USD: '$', CNY: '¥', GBP: '£', CHF: 'CHF ', JPY: '¥' };
    return `${sym[cur] || cur} ${val.toFixed(2)}`;
  };

  // ---------- Consumer 登录注册 ----------
  const loginAsConsumer = async (email: string, password: string): Promise<boolean> => {
    try {
      const d = await apiPost<{token: string; consumer: Consumer}>('/api/consumers/login', { email, password });
      setAuthRole('consumer');
      setAuthConsumer(d.consumer);
      setAuthConsumerToken(d.token);
      try { localStorage.setItem(CONSUMER_TOKEN_KEY, d.token); } catch {}
      setCurrentView('consumer_store');
      addNotification('success', '欢迎回到 RUDA Fashion', `${d.consumer.firstName} ${d.consumer.lastName}`);
      return true;
    } catch (err: any) { addNotification('warning', '登录失败', err?.message || ''); return false; }
  };
  const registerConsumer = async (form: any): Promise<boolean> => {
    try {
      const d = await apiPost<{token: string; consumer: Consumer}>('/api/consumers/register', form);
      setAuthRole('consumer');
      setAuthConsumer(d.consumer);
      setAuthConsumerToken(d.token);
      try { localStorage.setItem(CONSUMER_TOKEN_KEY, d.token); } catch {}
      setCurrentView('consumer_store');
      addNotification('success', '注册成功，欢迎加入 RUDA Fashion', `${d.consumer.firstName} 您已登录`);
      return true;
    } catch (err: any) { addNotification('warning', '注册失败', err?.message || ''); return false; }
  };
  // 挂载时恢复consumer session
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(CONSUMER_TOKEN_KEY);
    } catch (error) {
      console.warn('[consumer-session] unable to read saved token:', error);
    }
    if (token) { setAuthConsumerToken(token); void loadConsumerProfile(token); }
    void loadExchangeRates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConsumerProfile = async (token = authConsumerToken) => {
    if (!token) return;
    try {
      const d = await apiRequest<any>('/api/consumers/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuthConsumer(d); setAuthRole('consumer');
      setConsumerAddresses(d.addresses || []);
    } catch {
      setAuthConsumerToken(null); setAuthConsumer(null);
      try { localStorage.removeItem(CONSUMER_TOKEN_KEY); } catch {}
    }
  };
  const updateConsumerProfile = async (patch: Partial<Consumer>) => {
    if (!authConsumerToken) return false;
    try { await apiRequest('/api/consumers/me', { method: 'PATCH', body: JSON.stringify(patch) }); void loadConsumerProfile(); return true; }
    catch (err: any) { addNotification('warning', '更新失败', err?.message || ''); return false; }
  };
  const loadConsumerAddresses = async () => {
    if (!authConsumerToken) return;
    try { const d = await apiGet<{ success: true; addresses: ConsumerAddress[] }>('/api/consumers/me/addresses'); setConsumerAddresses(d.addresses || []); }
    catch (err: any) { addNotification('warning', '地址读取失败', err?.message || ''); }
  };
  const saveConsumerAddress = async (addr: any) => {
    if (!authConsumerToken) return false;
    try {
      if (addr.id) await apiPut(`/api/consumers/me/addresses/${addr.id}`, addr);
      else await apiPost('/api/consumers/me/addresses', addr);
      void loadConsumerAddresses(); return true;
    } catch (err: any) { addNotification('warning', '地址保存失败', err?.message || ''); return false; }
  };
  const removeConsumerAddress = async (id: string) => {
    if (!authConsumerToken) return;
    try { await apiRequest(`/api/consumers/me/addresses/${id}`, { method: 'DELETE' }); void loadConsumerAddresses(); }
    catch (err: any) { addNotification('warning', '地址删除失败', err?.message || ''); }
  };
  const loadConsumerRetailProducts = async (params?: any) => {
    try {
      const q = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
      const d = await apiGet<any>(`/api/retail/products${q.toString() ? '?' + q.toString() : ''}`);
      setConsumerRetailProducts(d.items || []);
      setConsumerRetailProductsMeta({ total: d.total || 0, page: d.page || 1, limit: d.limit || 24 });
    } catch {}
  };
  const loadConsumerRetailProduct = async (idOrStyleNo: string) => {
    try { const d = await apiGet<Product>(`/api/retail/products/${encodeURIComponent(idOrStyleNo)}`); setConsumerRetailProduct(d); }
    catch { setConsumerRetailProduct(null); }
  };
  const addToConsumerCart = (productId: string, sku: string, qty: number, variant?: any): boolean => {
    const prod = consumerRetailProduct || consumerRetailProducts.find(p => p.id === productId);
    if (!prod) return false;
    const v = variant || prod.skus?.find(s => s.sku === sku);
    if (!v) return false;
    const price = Number(v.rrp ?? prod.rrpPrice ?? 0);
    setConsumerCart(prev => {
      const exist = prev.find(x => x.sku === sku);
      if (exist) return prev.map(x => x.sku === sku ? { ...x, quantity: x.quantity + qty } : x);
      return [...prev, {
        id: `cci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        productId, merchantId: prod.merchantId || '',
        styleNo: prod.styleNo, productName: prod.name, image: (prod.images && prod.images[0]) || '',
        sku, color: v.color, size: v.size, quantity: qty, retailPrice: price,
      }];
    });
    addNotification('success', '已加入购物袋', `${prod.styleNo} ${v.color} / ${v.size} × ${qty}`);
    return true;
  };
  const removeFromConsumerCart = (cartItemId: string) => setConsumerCart(prev => prev.filter(x => x.id !== cartItemId));
  const updateConsumerCartQty = (cartItemId: string, qty: number) => setConsumerCart(prev => prev.map(x => x.id === cartItemId ? { ...x, quantity: Math.max(0, qty) } : x).filter(x => x.quantity > 0));
  const clearConsumerCart = () => setConsumerCart([]);
  const calculateConsumerCartPromo = async (couponCode?: string, usePoints = 0): Promise<PromotionCalculationResult | null> => {
    try {
      const items = consumerCart.map(i => ({ productId: i.productId, sku: i.sku, quantity: i.quantity, unitPrice: i.retailPrice }));
      const r = await apiPost<PromotionCalculationResult & { couponError?: string }>('/api/promotions/calculate/retail', { items, couponCode, usedPoints: usePoints });
      if (r?.couponError) addNotification('warning', '优惠券不可用', r.couponError);
      setLastPromoCalc(r); return r;
    } catch { setLastPromoCalc(null); return null; }
  };
  const placeConsumerOrder = async (_payload: any) => {
    // 消费者结账需要服务端 VAT、按卖家拆单与银行转账核验，尚未开放；此处明确失败而不是调用不存在的接口。
    return { ok: false, error: 'CONSUMER_CHECKOUT_NOT_AVAILABLE' };
  };
  const loadConsumerOrders = async () => {
    if (!authConsumerToken) return;
    try { const d = await apiGet<{ success: true; orders: ConsumerOrder[] }>('/api/consumers/me/orders'); setConsumerOrders(d.orders || []); }
    catch (err: any) { addNotification('warning', '订单读取失败', err?.message || ''); }
  };
  const toggleConsumerWishlist = async (productId: string, add: boolean) => {
    if (!authConsumerToken) { addNotification('info', '请先登录', '登录后可以收藏商品'); return; }
    try {
      await apiRequest(`/api/consumers/me/wishlist/${encodeURIComponent(productId)}`, { method: add ? 'POST' : 'DELETE' });
      void loadConsumerWishlist();
    } catch (err: any) { addNotification('warning', '收藏失败', err?.message || ''); }
  };
  const loadConsumerWishlist = async () => {
    if (!authConsumerToken) return;
    try { const d = await apiGet<{ success: true; items: Product[] }>('/api/consumers/me/wishlist'); setConsumerWishlist(d.items || []); }
    catch (err: any) { addNotification('warning', '收藏读取失败', err?.message || ''); }
  };

  // ---------- PROMOTIONS ----------
  const loadAdminPromotions = async () => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    const result = await apiGet<{ success: true; promotions: PromotionRule[] }>('/api/admin/promotions');
    setAdminPromotions(result.promotions);
  };
  const saveAdminPromotion = async (data: any) => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    if (data.id) await apiPut(`/api/admin/promotions/${encodeURIComponent(data.id)}`, data);
    else await apiPost('/api/admin/promotions', data);
    await loadAdminPromotions();
  };
  const deleteAdminPromotion = async (id: string) => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    await apiRequest(`/api/admin/promotions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadAdminPromotions();
  };
  const toggleAdminPromotionActive = async (id: string, isActive: boolean) => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    await apiPut(`/api/admin/promotions/${encodeURIComponent(id)}`, { isActive });
    await loadAdminPromotions();
  };

  // ---------- RFQ ----------
  const loadBuyerRfqs = async () => { if (authRole !== 'buyer') return; try { setBuyerRfqs(await apiGet<BuyerRfqView[]>('/api/buyer/rfq')); } catch {} };
  const loadMerchantRfqs = async () => { if (authRole !== 'merchant') return; try { setMerchantRfqs(await apiGet<BuyerRfqView[]>('/api/merchant/rfq')); } catch {} };
  const createBuyerRfq = async (payload: CreateBuyerRfqInput) => {
    if (authRole !== 'buyer') return { ok: false };
    try { const d = await apiPost<{ id: string; rfqNo: string }>('/api/buyer/rfq', payload); void loadBuyerRfqs(); return { ok: true, id: d.id, rfqNo: d.rfqNo }; }
    catch (err: any) { return { ok: false, error: err?.message }; }
  };
  const acceptRfqQuote = async (rfqId: string, quoteId: string) => {
    if (authRole !== 'buyer') return false;
    try { await apiPost(`/api/buyer/rfq/${encodeURIComponent(rfqId)}/accept/${encodeURIComponent(quoteId)}`, {}); void loadBuyerRfqs(); return true; }
    catch { return false; }
  };
  const submitMerchantRfqQuote = async (rfqId: string, payload: SubmitRfqQuoteInput) => {
    if (authRole !== 'merchant') return false;
    try { await apiPost(`/api/merchant/rfq/${encodeURIComponent(rfqId)}/quote`, payload); void loadMerchantRfqs(); return true; }
    catch { return false; }
  };

  // ---------- MESSAGES ----------
  const loadMessageThreads = async () => { try { setMessageThreads(await apiGet<MessageThreadSummary[]>('/api/messages/threads')); } catch {} };
  const openMessageThread = async (id: string | null) => {
    if (id === null) { setActiveMessageThread(null); setActiveMessageThreadMessages([]); return; }
    try {
      const d = await apiGet<MessageThreadSummary & { messages: ChatMessage[] }>(`/api/messages/threads/${id}`);
      setActiveMessageThread(d);
      setActiveMessageThreadMessages(d.messages || []);
      void loadMessageThreads();
    } catch {}
  };
  const sendMessageReply = async (content: string, attachments?: any[]) => {
    if (!activeMessageThread) return false;
    try { await apiPost(`/api/messages/threads/${activeMessageThread.id}/messages`, { content, attachments }); void openMessageThread(activeMessageThread.id); return true; }
    catch { return false; }
  };
  const createMessageThread = async (partial: any) => {
    try { const d = await apiPost<any>('/api/messages/threads', partial); void loadMessageThreads(); return d.id || null; }
    catch { return null; }
  };

  // ---------- RISK / BI ----------
  const loadRiskAlerts = async (status?: 'open' | 'acknowledged', severity?: string) => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    const q = new URLSearchParams(); if (status) q.append('status', status); if (severity) q.append('severity', severity);
    setRiskAlerts(await apiGet<RiskAlert[]>(`/api/admin/risk/alerts${q.toString() ? '?'+q : ''}`));
  };
  const acknowledgeRiskAlert = async (id: string) => {
    if (authRole !== 'admin') throw new Error('ADMIN_REQUIRED');
    await apiPost(`/api/admin/risk/alerts/${encodeURIComponent(id)}/acknowledge`, {});
    setRiskAlerts(current => current.map(alert => alert.id === id ? { ...alert, isAcknowledged: true } : alert));
  };
  const loadBISalesTrend = async (days = 30) => {
    if (authRole !== 'admin') return;
    try {
      const report = await apiGet<{data: any[]; previousData: any[]}>(`/api/admin/bi/sales-trend?days=${days}`);
      setBiSalesTrend({ data: report.data || [], previousData: report.previousData || [] });
    } catch {
      setBiSalesTrend({ data: [], previousData: [] });
    }
  };
  const loadBICategoryPerformance = async (days = 30) => {
    if (authRole !== 'admin') return;
    try {
      const report = await apiGet<{data: any[]}>(`/api/admin/bi/category-performance?days=${days}`);
      setBiCategoryPerformance(report.data || []);
    } catch {
      setBiCategoryPerformance([]);
    }
  };
  const loadBIMerchantRanking = async (days = 90) => {
    if (authRole !== 'admin') return;
    try {
      const report = await apiGet<{data: any[]; previousData: any[]}>(`/api/admin/bi/merchant-ranking?days=${days}`);
      setBiMerchantRanking({ data: report.data || [], previousData: report.previousData || [] });
    } catch {
      setBiMerchantRanking({ data: [], previousData: [] });
    }
  };

  // ---------- EXCHANGE RATES ----------
  const loadExchangeRates = async () => { try { setExchangeRates(await apiGet<any>('/api/exchange-rates/latest')); } catch {} };

  // ============================================================
  //  NEW: Multi-Portal Authentication (JWT + URL Routing)
  // ============================================================
  const [authCustomerAccount, setAuthCustomerAccount] = useState<CustomerAccount | null>(null);
  const [authBuyer, setAuthBuyer] = useState<WholesaleCustomer | null>(null);
  const [authCompanyId, setAuthCompanyId] = useState<string | null>(null);
  const [authAdminName, setAuthAdminName] = useState<string | null>(null);
  const [merchantLoginError, setMerchantLoginError] = useState<{ code: string; retryAfter?: number } | null>(null);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [showBuyerRegister, setShowBuyerRegister] = useState<boolean>(false);
  const preferenceMutationVersion = useRef(0);
  const authMerchant = authMerchantId ? merchants.find(m => m.id === authMerchantId) || null : null;
  const preferenceIdentityKey = authRole === 'buyer' && authBuyer?.id
    ? `buyer:${authBuyer.id}`
    : authRole === 'company' && authCompanyId
      ? `company:${authCompanyId}`
      : authRole === 'merchant' && authMerchantId
        ? `merchant:${authMerchantId}`
        : authRole === 'customer' && authCustomerAccount?.id
          ? `customer:${authCustomerAccount.id}`
        : '';
  const preferenceAccountId = authRole === 'buyer'
    ? authBuyer?.id
    : authRole === 'company'
      ? authCompanyId
      : authRole === 'merchant'
        ? authMerchantId
        : authRole === 'customer'
          ? authCustomerAccount?.id
        : null;
  const preferenceIdentityRef = useRef(preferenceIdentityKey);
  preferenceIdentityRef.current = preferenceIdentityKey;

  const applyAccountPreferences = (preferences: AccountPreferences) => {
    const routeLanguage = typeof window !== 'undefined'
      ? parseLocalizedPath(window.location.pathname).language
      : null;
    setLanguagePreferenceState(preferences.language);
    setLangState(routeLanguage || (preferences.language === 'auto' ? detectPreferredBrowserLanguage() : preferences.language));
    setDisplayCurrencyState(preferences.currency);
    setMonochromeModeState(preferences.monochrome);
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('ruda-monochrome', preferences.monochrome);
        document.body.classList.toggle('ruda-monochrome', preferences.monochrome);
      }
      if (preferences.language === 'auto') localStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
      else localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preferences.language);
      localStorage.setItem(DISPLAY_CURRENCY_KEY, preferences.currency);
      localStorage.setItem('ruda_monochrome_mode', String(preferences.monochrome));
    } catch (error) {
      console.warn('[account-preferences-local-cache]', error);
    }
  };

  const saveAccountPreferences = async (patch: Partial<AccountPreferences>): Promise<boolean> => {
    const mutationVersion = ++preferenceMutationVersion.current;
    const targetIdentity = preferenceIdentityKey;
    const previous: AccountPreferences = {
      language: languagePreference,
      currency: displayCurrency,
      monochrome: monochromeMode
    };
    const next = { ...previous, ...patch };
    applyAccountPreferences(next);
    if (!['buyer', 'company', 'merchant', 'customer'].includes(authRole)) {
      setAccountPreferencesSynced(false);
      setAccountPreferencesSyncError(false);
      return false;
    }
    const endpoint = `/api/account/preferences?role=${encodeURIComponent(authRole)}&accountId=${encodeURIComponent(preferenceAccountId || '')}`;
    try {
      const result = await apiPut<{
        preferences: AccountPreferences;
        hasSavedPreferences: boolean;
      }>(endpoint, patch);
      if (mutationVersion !== preferenceMutationVersion.current || targetIdentity !== preferenceIdentityRef.current) return false;
      applyAccountPreferences(result.preferences);
      setAccountPreferencesSynced(true);
      setAccountPreferencesSyncError(false);
      return true;
    } catch (error) {
      if (mutationVersion !== preferenceMutationVersion.current || targetIdentity !== preferenceIdentityRef.current) return false;
      applyAccountPreferences(patch.monochrome === undefined ? previous : { ...previous, ...patch });
      setAccountPreferencesSynced(false);
      setAccountPreferencesSyncError(true);
      addNotification(
        'warning',
        '设置未能同步',
        error instanceof Error ? error.message : '请检查网络连接后重试。'
      );
      return false;
    }
  };

  useEffect(() => {
    if (!preferenceIdentityKey) {
      setAccountPreferencesSynced(false);
      setAccountPreferencesSyncError(false);
      return;
    }
    let cancelled = false;
    const loadVersion = preferenceMutationVersion.current;
    const endpoint = `/api/account/preferences?role=${encodeURIComponent(authRole)}&accountId=${encodeURIComponent(preferenceAccountId || '')}`;
    setAccountPreferencesSynced(false);
    setAccountPreferencesSyncError(false);
    apiGet<{
      preferences: AccountPreferences;
      hasSavedPreferences: boolean;
    }>(endpoint).then(async result => {
      if (cancelled || loadVersion !== preferenceMutationVersion.current) return;
      if (!result.hasSavedPreferences) {
        const saved = await apiPut<{ preferences: AccountPreferences }>(endpoint, {
          language: languagePreference,
          currency: displayCurrency,
          monochrome: monochromeMode
        });
        if (cancelled || loadVersion !== preferenceMutationVersion.current) return;
        applyAccountPreferences(saved.preferences);
      } else {
        applyAccountPreferences(result.preferences);
      }
      setAccountPreferencesSynced(true);
      setAccountPreferencesSyncError(false);
    }).catch(error => {
      if (cancelled || loadVersion !== preferenceMutationVersion.current || preferenceIdentityRef.current !== preferenceIdentityKey) return;
      setAccountPreferencesSyncError(true);
      addNotification(
        'warning',
        '无法读取账户设置',
        error instanceof Error ? error.message : '请稍后重试。'
      );
    });
    return () => { cancelled = true; };
  // Identity is the trigger; local values are used only when this account has no saved preferences yet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferenceIdentityKey]);

  const setMonochromeMode = (enabled: boolean) => saveAccountPreferences({ monochrome: enabled });

  // 管理员会话（4小时）到期后，后续所有需要鉴权的总后台操作都会返回 401。
  // 之前这里只弹出一条容易被忽略的提示，页面仍停留在总后台原样式,
  // 导致管理员看到"改了还是错误"/"点了跳不过去"却不知道其实是登录过期。
  // 现在统一清除管理员登录态,让页面立刻切回登录框,并给出明确提示。
  const handleAdminSessionExpired = () => {
    if (authRole !== 'admin') return;
    setAuthRole('guest');
    setAuthAdminName(null);
    addNotification('warning', '登录已过期', '管理员会话已失效，请重新登录总后台后再试一次');
  };

  const assumeMerchantFromAdmin = async (merchantId: string) => {
    if (authRole !== 'admin') return false;
    try {
      const result = await apiPost<{ success: true; merchant: Merchant }>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/impersonate`, {});
      setAuthRole('merchant');
      setAuthMerchantId(result.merchant.id);
      setActiveMerchantId(result.merchant.id);
      setSelectedMerchantId(result.merchant.id);
      setPortalMode('merchant');
      setCurrentView('merchant_portal');
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAdminSessionExpired();
      } else if (error instanceof ApiError && error.status === 404) {
        addNotification('warning', '进入商家后台失败', '该生产商不存在或已被删除，请刷新商家列表后重试');
      } else {
        addNotification('warning', '进入商家后台失败', error instanceof Error ? error.message : '请稍后重试');
      }
      return false;
    }
  };
  const returnToAdminPortal = async () => {
    try {
      const result = await apiGet<{ success: true; name?: string; username?: string }>('/api/auth/me/admin');
      if (!result.success) return false;
      setAuthRole('admin');
      setAuthAdminName(result.name || result.username || 'SuperAdmin');
      setAuthMerchantId(null);
      setAuthCompanyId(null);
      setPortalMode('admin');
      setCurrentView('platform_admin');
      void syncAdminData();
      return true;
    } catch {
      addNotification('warning', '返回总后台失败', '管理员会话已失效，请重新登录总后台');
      return false;
    }
  };

  const initRouteFromURL = (): 'buyer' | 'merchant' | 'employee' | 'admin' | 'guest' => {
    const localizedPath = parseLocalizedPath(window.location.pathname.toLowerCase());
    const path = localizedPath.pathname;
    if (localizedPath.language) setLangState(localizedPath.language);
    const rawHash = window.location.hash.replace(/^#/, '');
    const hash = rawHash.toLowerCase();
    const p = hash.startsWith('/') ? parseLocalizedPath(hash).pathname : path;
    const zoneFromPath = path.startsWith('/merchant') ? 'merchant'
                         : path.startsWith('/employee') ? 'employee'
                         : (path.startsWith('/admin') || path.startsWith('/super-admin')) ? 'admin' : null;
    const host = window.location.hostname.toLowerCase();
    const domainPortal = getPortalZoneForHost(host);
    const merchantDomainSlug = host.endsWith('.ruda.fashion') && !domainPortal
      ? host.slice(0, -'.ruda.fashion'.length)
      : null;

    try {
      // Dedicated portal domains take precedence over path-based navigation.
      if (domainPortal === 'admin' || zoneFromPath === 'admin') {
        apiGet<any>('/api/auth/me/admin').then(d => {
          if (d && d.success) {
            setAuthRole('admin');
            setAuthAdminName(d.name || d.username || 'SuperAdmin');
            setPortalMode('admin');
            setCurrentView('platform_admin');
            void syncAdminData();
          }
        }).catch(() => {});
        return 'admin';
      }

      if (domainPortal === 'merchant' || zoneFromPath === 'merchant') {
        apiGet<any>('/api/auth/me/merchant').then(d => {
          if (d && d.success && d.merchant) {
            const mId = d.merchant.id || (d.payload && d.payload.merchantId);
            if (mId) {
              setMerchants(previous => [d.merchant, ...previous.filter(merchant => merchant.id !== mId)]);
              setAuthRole('merchant');
              setAuthMerchantId(mId);
              setActiveMerchantId(mId);
              setSelectedMerchantId(mId);
              setPortalMode('merchant');
              setCurrentView('merchant_portal');
              void syncMerchantData(mId);
            }
          }
        }).catch(() => {});
        return 'merchant';
      }

      if (domainPortal === 'employee' || zoneFromPath === 'employee') {
        apiGet<any>('/api/auth/me/employee').then(d => {
          if (d && d.success && d.merchant) {
            const mId = d.merchant.id || (d.payload && d.payload.merchantId);
            if (mId) {
              setMerchants(previous => [d.merchant, ...previous.filter(merchant => merchant.id !== mId)]);
              setAuthRole('merchant');
              setAuthMerchantId(mId);
              setActiveMerchantId(mId);
              setSelectedMerchantId(mId);
              setPortalMode('merchant');
              setCurrentView('merchant_portal');
            }
          }
        }).catch(() => {});
        return 'employee';
      }

      if (merchantDomainSlug) {
        const sharedMerchant = merchants.find(merchant =>
          (merchant.storeSlug || merchant.slug || merchant.id).toLowerCase() === merchantDomainSlug
        );
        if (sharedMerchant) {
          setSelectedMerchantId(sharedMerchant.id);
          setCurrentView('merchant_store');
          return 'guest';
        }
        void apiGet<{ success: true; merchant: Merchant }>(`/api/merchants/store/${encodeURIComponent(merchantDomainSlug)}`)
          .then(result => {
            if (!result.merchant) return;
            setMerchants(previous => [result.merchant, ...previous.filter(merchant => merchant.id !== result.merchant.id)]);
            setSelectedMerchantId(result.merchant.id);
            setCurrentView('merchant_store');
          })
          .catch(() => undefined);
      }

      const productShareMatch = rawHash.match(/^\/product\/([^/?#]+)/i) || path.match(/^\/product\/([^/?#]+)/i);
      if (productShareMatch) {
        const sharedProduct = products.find(product => product.id === decodeURIComponent(productShareMatch[1]));
        if (sharedProduct) {
          setSelectedProductId(sharedProduct.id);
          setCurrentView('product_detail');
        }
      }
      const merchantShareMatch = rawHash.match(/^\/merchant_store\/([^/?#]+)/i);
      if (merchantShareMatch) {
        const sharedMerchant = merchants.find(merchant => merchant.id === decodeURIComponent(merchantShareMatch[1]));
        if (sharedMerchant) {
          setSelectedMerchantId(sharedMerchant.id);
          setCurrentView('merchant_store');
        }
      }
      const storefrontPath = rawHash.match(/^\/shop\/([^/?#]+)/i) || path.match(/^\/shop\/([^/?#]+)/i);
      if (storefrontPath) {
        const storefrontKey = decodeURIComponent(storefrontPath[1]).toLowerCase();
        const sharedMerchant = merchants.find(merchant =>
          (merchant.storeSlug || merchant.slug || merchant.id).toLowerCase() === storefrontKey ||
          (merchant.slug || '').toLowerCase() === storefrontKey ||
          merchant.id.toLowerCase() === storefrontKey ||
          merchant.code.toLowerCase() === storefrontKey
        );
        if (sharedMerchant) {
          setSelectedMerchantId(sharedMerchant.id);
          setCurrentView('merchant_store');
        } else {
          void apiGet<{ success: true; merchant: Merchant }>(`/api/merchants/store/${encodeURIComponent(storefrontKey)}`)
            .then(result => {
              if (!result.merchant) return;
              setMerchants(previous => [result.merchant, ...previous.filter(merchant => merchant.id !== result.merchant.id)]);
              setSelectedMerchantId(result.merchant.id);
              setCurrentView('merchant_store');
            })
            .catch(error => {
              console.error('[merchant-store-route]', error instanceof Error ? error.message : error);
              addNotification(
                'warning',
                '店铺暂不可用',
                error instanceof ApiError && error.status === 404
                  ? '店铺不存在、尚未开放，或当前账号无权访问。'
                  : '店铺加载失败，请检查网络后重试。'
              );
            });
        }
      }
      if (p.startsWith('/catalog')) {
        setCurrentView('catalog');
      } else if (p.startsWith('/about')) {
        setCurrentView('about');
      } else if (p.startsWith('/showrooms') || p.startsWith('/producers') || p.startsWith('/wholesalers') || p.startsWith('/retailers')) {
        setCurrentView('showrooms');
      } else if (p.startsWith('/trends')) {
        setCurrentView('fashion_trends');
      } else if (p.startsWith('/cart')) {
        setCurrentView('cart');
      } else if (p.startsWith('/account')) {
        setCurrentView('account');
      } else if (p.startsWith('/merchant-onboarding')) {
        setCurrentView('register_wholesale');
      } else if (p.startsWith('/register-wholesale')) {
        setCurrentView('register_wholesale');
      } else if (p.startsWith('/purchase-order')) {
        setCurrentView('purchase_order');
      } else if (p.startsWith('/orders')) {
        setCurrentView('orders');
      } else if (p.startsWith('/checkout')) {
        setCurrentView('checkout');
      }
      // Restore signed-in portal sessions on the public storefront without changing
      // the page the user opened. Merchant owners can then reach their workspace.
      void (async () => {
        try {
          const d = await apiGet<any>('/api/auth/me/merchant');
          if (!d?.success || !d.merchant) throw new Error('MERCHANT_SESSION_NOT_FOUND');
          const merchantId = d.merchant.id || d.payload?.merchantId;
          if (!merchantId) throw new Error('MERCHANT_SESSION_INVALID');
          setMerchants(previous => [d.merchant, ...previous.filter(merchant => merchant.id !== merchantId)]);
          setAuthRole('merchant');
          setAuthMerchantId(merchantId);
          setActiveMerchantId(merchantId);
          setSelectedMerchantId(merchantId);
          setPortalMode('merchant');
          void syncMerchantData(merchantId);
          return;
        } catch {}

        try {
          const d = await apiGet<any>('/api/auth/me/company');
          if (!d?.success || !d.company) throw new Error('COMPANY_SESSION_NOT_FOUND');
          setAuthRole('company');
          setAuthCompanyId(d.company.id);
          setPortalMode('buyer');
          return;
        } catch {}

        try {
          const d = await apiGet<any>('/api/auth/me/buyer');
          if (d?.success && d.buyer) {
            setAuthRole('buyer');
            setAuthBuyer(d.buyer);
            setCurrentCustomer(d.buyer);
            setPortalMode('buyer');
            if (!currentCustomer) setCurrentCustomer(d.buyer);
            void syncBuyerOrders();
            return;
          }
        } catch {}

        try {
          const d = await apiGet<{ success: boolean; customer?: CustomerAccount }>('/api/auth/me/customer');
          if (d?.success && d.customer) {
            setAuthRole('customer');
            setAuthCustomerAccount(d.customer);
          }
        } catch {}
      })();
      return 'buyer';
    } catch {}

    return 'guest';
  };

  const logout = () => {
    clearApiCache();
    void apiPost('/api/auth/logout', {}).catch(() => {
      addNotification('warning', '退出请求未完成', '本地登录状态已清除，请关闭当前页面后重新打开。');
    });
    // 清除consumer
    if (authConsumerToken) {
      try { localStorage.removeItem(CONSUMER_TOKEN_KEY); } catch {}
    }
    setAuthRole('guest');
    setAuthCustomerAccount(null);
    setAuthBuyer(null);
    setAuthMerchantId(null);
    setAuthAdminName(null);
    setAuthConsumer(null);
    setAuthConsumerToken(null);
    setConsumerOrders([]);
    setConsumerAddresses([]);
    setShowBuyerRegister(false);
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/super-admin') || path.startsWith('/admin') || path.startsWith('/merchant')) {
      window.location.href = '/';
    } else {
      setCurrentView('home');
    }
    addNotification('info', '已安全退出登录', 'Session 已销毁，再见！');
  };

  const activateCustomerSession = (customer: CustomerAccount) => {
    setAuthRole('customer');
    setAuthCustomerAccount(customer);
    setAuthBuyer(null);
    setAuthCompanyId(null);
    setAuthMerchantId(null);
    setAuthAdminName(null);
    setCurrentView('home');
  };

  const handleLoginFetch = async (endpoint: string, body: any, role: 'buyer' | 'merchant' | 'company' | 'admin' | 'customer'): Promise<boolean> => {
    if (role === 'admin') setAdminLoginError(null);
    if (role === 'merchant') setMerchantLoginError(null);
    try {
      const d = await apiPost<any>(endpoint, body);

      if (role === 'customer') {
        activateCustomerSession(d.customer);
        addNotification('success', '登录成功', '你现在可以浏览 RUDA；正式交易或入驻时再完善商家资料。');
      } else {
        setAuthCustomerAccount(null);
        if (role === 'buyer') {
          void syncBuyerOrders();
          setAuthRole('buyer');
          setAuthBuyer(d.buyer || null);
          if (d.buyer) setCurrentCustomer(d.buyer);
          setPortalMode('buyer');
          setCurrentView(singleItemCheckoutToken ? 'checkout' : 'home');
          addNotification('success', 'B2B 买手登录成功', d.buyer ? `欢迎: ${d.buyer.companyName}` : '');
          setTimeout(() => {
            if (window.location.pathname.startsWith('/merchant') || window.location.pathname.startsWith('/super-admin')) {
              window.location.href = '/';
            }
          }, 0);
        } else if (role === 'merchant') {
          const mId = d.merchant?.id || d.merchantId;
          if (d.merchant && mId) {
            setMerchants(previous => [d.merchant, ...previous.filter(merchant => merchant.id !== mId)]);
          }
          setAuthRole('merchant');
          setAuthMerchantId(mId);
          setActiveMerchantId(mId || 'mch-prato');
          setSelectedMerchantId(mId || 'mch-prato');
          setPortalMode('merchant');
          setCurrentView('merchant_portal');
          void syncMerchantData(mId || null);
          addNotification('success', '商户中心登录成功', d.merchant?.name || '');
        } else if (role === 'company') {
          setAuthRole('company');
          setAuthCompanyId(d.company?.id || d.companyId || null);
          setPortalMode('buyer');
          setCurrentView('home');
          addNotification('success', '企业账户登录成功', d.company?.displayName || '');
        } else {
          setAuthRole('admin');
          setAuthAdminName(d.name || d.username || 'SuperAdmin');
          setPortalMode('admin');
          setCurrentView('platform_admin');
          void syncAdminData();
          addNotification('success', '平台总控登录成功', '全网数据监控中，请谨慎操作');
        }
      }
      return true;
    } catch (error) {
      if (role === 'admin') setAdminLoginError(error instanceof Error ? error.message : 'LOGIN_FAILED');
      if (role === 'merchant') {
        setMerchantLoginError({
          code: error instanceof ApiError ? error.code || error.message : error instanceof Error ? error.message : 'LOGIN_FAILED',
          ...(error instanceof ApiError && error.retryAfter ? { retryAfter: error.retryAfter } : {})
        });
      }
      return false;
    }
  };

  const loginAsBuyer = (email: string, password: string) => handleLoginFetch('/api/auth/login/buyer', { email, password }, 'buyer');
  const loginAsCompany = (identifier: string, password: string) => handleLoginFetch('/api/auth/login/company', { identifier, password }, 'company');
  const loginAsBusiness = async (identifier: string, password: string) => {
    const retailerLogin = await loginAsCompany(identifier, password);
    if (retailerLogin) return true;
    return loginAsBuyer(identifier, password);
  };
  const loginWithGoogle = (credential: string, role: 'buyer' | 'merchant' | 'company' | 'customer') => handleLoginFetch('/api/auth/login/google', { credential, role }, role);
  const requestCustomerLoginCode = async (channel: 'email' | 'phone', destination: string) => {
    try {
      const result = await apiPost<{ retryAfter?: number }>('/api/auth/customer/request-code', { channel, destination });
      return { ok: true, retryAfter: result.retryAfter };
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.code : undefined;
      return {
        ok: false,
        error: errorCode || (error instanceof Error ? error.message : 'VERIFICATION_CODE_REQUEST_FAILED'),
        retryAfter: error instanceof ApiError ? error.retryAfter : undefined
      };
    }
  };
  const verifyCustomerLoginCode = async (channel: 'email' | 'phone', destination: string, code: string) => {
    try {
      const result = await apiPost<{ customer: CustomerAccount }>('/api/auth/customer/verify-code', { channel, destination, code });
      activateCustomerSession(result.customer);
      addNotification('success', '登录成功', '你现在可以浏览 RUDA；正式交易或入驻时再完善商家资料。');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'INVALID_OR_EXPIRED_CODE' };
    }
  };
  const loginAsMerchant = (email: string, password: string) => handleLoginFetch('/api/auth/login/merchant', { email, password }, 'merchant');
  const loginAsMerchantDemo = (industryTemplateId: string) => handleLoginFetch(
    '/api/auth/demo/merchant/login',
    { industryTemplateId },
    'merchant'
  );
  const requestMerchantRegistrationCode = async (email: string) => {
    try {
      await apiPost('/api/auth/register/merchant/email-code', { email });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : 'EMAIL_VERIFICATION_REQUEST_FAILED',
        ...(error instanceof ApiError && error.retryAfter ? { retryAfter: error.retryAfter } : {})
      };
    }
  };
  const verifyMerchantRegistrationCode = async (email: string, code: string) => {
    try {
      const result = await apiPost<{ verificationToken: string }>('/api/auth/register/merchant/email-verify', { email, code });
      return { ok: true, verificationToken: result.verificationToken };
    } catch (error) {
      return { ok: false, error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : 'INVALID_OR_EXPIRED_CODE' };
    }
  };
  const requestMerchantPasswordReset = async (email: string) => {
    try {
      await apiPost('/api/auth/login/merchant/password-reset/request', { email });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : 'PASSWORD_RESET_REQUEST_FAILED',
        ...(error instanceof ApiError && error.retryAfter ? { retryAfter: error.retryAfter } : {})
      };
    }
  };
  const resetMerchantPassword = async (email: string, code: string, password: string) => {
    try {
      await apiPost('/api/auth/login/merchant/password-reset/complete', { email, code, password });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : 'PASSWORD_RESET_FAILED' };
    }
  };
  const registerMerchantQuick = async (email: string, password: string, storeName?: string, verificationToken?: string, industry?: string, salesChannels?: string) => {
    try {
      const result = await apiPost<{
        success?: boolean;
        applicationId?: string;
        applicationNo?: string;
        status?: string;
        merchantLoginAvailable?: boolean;
        merchant?: Merchant;
        merchantId?: string;
      }>('/api/auth/register/merchant/quick', {
        email,
        password,
        storeName,
        verificationToken,
        industry,
        salesChannels
      });
      if (result.applicationId || result.applicationNo || result.merchantLoginAvailable === false) {
        addNotification('warning', '商家后台未开通', '请使用统一企业注册选择行业并直接创建对应后台。');
        setCurrentView('register_wholesale');
        return false;
      }
      const merchant = result.merchant;
      const merchantId = merchant?.id || result.merchantId;
      if (!merchant || !merchantId) throw new Error('MERCHANT_REGISTRATION_RESPONSE_INVALID');
      setMerchants(previous => [merchant, ...previous.filter(item => item.id !== merchantId)]);
      setAuthRole('merchant');
      setAuthMerchantId(merchantId);
      setActiveMerchantId(merchantId);
      setSelectedMerchantId(merchantId);
      setPortalMode('merchant');
      setCurrentView('merchant_portal');
      void syncMerchantData(merchantId);
      addNotification('success', '商家后台已开通', '店铺已开放销售，公司资料可稍后在后台补充。');
      window.location.assign(`${window.location.origin}/merchant`);
      return true;
    } catch (error) {
      addNotification('warning', '商家后台创建失败', error instanceof Error ? error.message : '请稍后重试。');
      return false;
    }
  };
  const loginAsAdmin = (username: string, password: string, otp?: string) => handleLoginFetch('/api/auth/login/admin', { username, password, otp }, 'admin');

  const registerBuyer = async (form: any): Promise<boolean> => {
    try {
      const d = await apiPost<any>('/api/auth/register/buyer', {
        ...form,
        companyName: form.companyLegalName,
        contactName: form.contactPerson
      });
      if (d.success) {
        addNotification('success', '资质申请已提交', d.message || '');
        setShowBuyerRegister(false);
        setAuthRole('buyer');
        setAuthBuyer(d.buyer || null);
        if (d.buyer) setCurrentCustomer(d.buyer);
        setPortalMode('buyer');
        setCurrentView(singleItemCheckoutToken ? 'checkout' : 'home');
        return true;
      }
      addNotification('warning', '申请提交失败', d.error || '请检查表单完整性');
      return false;
    } catch {
      return false;
    }
  };

  const registerQuickBuyer = async (email: string, code?: string, password?: string): Promise<{ sent?: boolean; buyer?: WholesaleCustomer }> => {
    if (code && (!password || password.length < 8)) return {};
    const endpoint = code ? '/api/auth/register/quick/verify' : '/api/auth/register/quick/request';
    try {
      const result = await apiPost<any>(endpoint, code ? { email, code, password } : { email });
      if (code && result.buyer) {
        setAuthRole('buyer');
        setAuthBuyer(result.buyer);
        setCurrentCustomer(result.buyer);
        setPortalMode('buyer');
        setCurrentView('home');
        addNotification('success', '基础账号已开通', '公开内容现在可以浏览，提交企业资料认证后解锁批发权限');
        return { buyer: result.buyer };
      }
      return { sent: true };
    } catch {
      return {};
    }
  };

  // Auto-hydrate customer from authBuyer if currentCustomer becomes null
  useEffect(() => {
    if (authBuyer && (!currentCustomer || currentCustomer.id !== authBuyer.id)) {
      setCurrentCustomer(authBuyer);
    }
  }, [authBuyer]);
  // ============================================================
  //  END: Multi-Portal Authentication
  // ============================================================

  return (
    <B2BContext.Provider
      value={{
        currentView,
        setCurrentView,
        merchantOnboardingPrefill,
        setMerchantOnboardingPrefill,
        adminTab,
        setAdminTab,
        selectedProductId,
        setSelectedProductId,
        catalogCategory,
        setCatalogCategory,
        catalogSearchQuery,
        setCatalogSearchQuery,
        catalogFilterStatus,
        setCatalogFilterStatus,
        quickNavigateToProduct,
        quickSearchStyle,
        singleItemCheckoutToken,
        setSingleItemCheckoutToken,

        // Multi-Merchant & Vault
        merchants,
        selectedMerchantId,
        setSelectedMerchantId,
        getMerchantById,
        addMerchant,
        updateMerchant,
        deleteMerchant,
        vaultRequests,
        requestVaultAccess,
        approveVaultAccess,
        rejectVaultAccess,
        approveVaultRequest,
        rejectVaultRequest,
        adminReviewVaultRequest,
        toggleProductExclusive,
        hasVaultAccess,
        getVaultStatus,
        vaultAccessAuditLogs,
        logVaultAccess,
        getAuthorizedProduct,

        products,
        getProductById,
        calculateCustomerPrice,
        addProduct,
        updateProduct,
        replaceProductFromServer,
        replaceMerchantProductsFromServer,
        deleteProduct,
        importProductsBatch,

        cart,
        addToCart,
        addMultipleToCart,
        createProductReservationRequest,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        savedCarts,
        saveCurrentCartAsDraft,
        loadDraftCart,
        totalCartAmount,
        totalCartQty,

        orders,
        syncBuyerOrders,
        createOrder,
        placeOrder,
        reorderHistoricOrder,
        reorderDirectly,
        analyzeReorder,
        activeReorderAnalysis,
        setActiveReorderAnalysis,
        confirmReorderItems,
        checkCartAvailability,
        verifyAndAdjustCart,
        adminUpdateOrderStatus,
        replaceOrderFromServer,
        updateOrderStatus: adminUpdateOrderStatus,
        cancelOrder,

        inboundRecords,
        transferRecords,
        createInboundStock,
        simulatePosSale,
        transferStock,
        restockSKU,

        currentCustomer,
        allCustomers,
        customers: allCustomers,
        loginAsCustomer,
        submitWholesaleApplication,
        registerWholesaleCustomer,
        adminApproveCustomer,
        adminRejectCustomer,
        reviewCustomer,
        setCustomerTier,
        uploadCustomerDocument,
        removeCustomerDocument,

        sampleInquiries,
        submitSampleInquiry,
        updateSampleInquiryStatus,

        showrooms,
        appointments,
        bookAppointment,
        adminUpdateAppointmentStatus,
        confirmAppointment,

        notifications,
        addNotification,
        removeNotification,
        isRegisteredWholesale,

        // Favorites & Buyer Portal State
        favorites,
        toggleFavorite,
        isFavorite,
        activeBuyerTab,
        setActiveBuyerTab,

        // PWA & Mobile States
        deviceMode,
        setDeviceMode,
        showPWAInstallModal,
        setShowPWAInstallModal,
        showPWANotifications,
        setShowPWANotifications,
        merchantMobileMode,
        setMerchantMobileMode,
        adminMobileMode,
        setAdminMobileMode,

        // Language & Localization
        lang,
        setLang,
        setAutoLanguage,
        languagePreference,
        monochromeMode,
        setMonochromeMode,
        accountPreferencesSynced,
        accountPreferencesSyncError,
        saveAccountPreferences,
        t,
        localizeCopy,

        // Dual Backend & Multi-Tenant Support
        portalMode,
        setPortalMode,
        activeMerchantId,
        setActiveMerchantId,
        transfers,
        addTransfer,
        updateTransferStatus,
        auditLogs,
        addAuditLog,
        payouts,
        merchantFulfillOrder,
        syncOrderFromServer,
        updatePayoutStatus,

        requestReturn,
        approveReturn,
        rejectReturn,
        getCustomerCreditExposure,
        canCustomerPlaceNet30Order,

        // NEW: Auth
        authRole,
        authCustomerAccount,
        requestCustomerLoginCode,
        verifyCustomerLoginCode,
        assumeMerchantFromAdmin,
        returnToAdminPortal,
        handleAdminSessionExpired,
        authBuyer,
        authMerchantId,
        authCompanyId,
        setAuthMerchantId,
        authMerchant,
        authAdminName,
        showBuyerRegister,
        setShowBuyerRegister,
        loginAsBuyer,
        loginAsCompany,
        loginAsBusiness,
        loginWithGoogle,
        loginAsMerchant,
        loginAsMerchantDemo,
        requestMerchantRegistrationCode,
        verifyMerchantRegistrationCode,
        requestMerchantPasswordReset,
        resetMerchantPassword,
        registerMerchantQuick,
        merchantLoginError,
        loginAsAdmin,
        adminLoginError,
        registerBuyer,
        registerQuickBuyer,
        logout,
        initRouteFromURL,

        // CONSUMER
        authConsumer,
        authConsumerToken,
        consumerCart,
        consumerOrders,
        consumerAddresses,
        consumerRetailProducts,
        consumerRetailProductsMeta,
        consumerRetailProduct,
        consumerWishlist,
        lastPromoCalc,
        exchangeRates,
        displayCurrency,
        setDisplayCurrency,
        convertCurrency,
        formatMoney,
        loginAsConsumer,
        registerConsumer,
        loadConsumerProfile,
        updateConsumerProfile,
        loadConsumerAddresses,
        saveConsumerAddress,
        removeConsumerAddress,
        loadConsumerRetailProducts,
        loadConsumerRetailProduct,
        addToConsumerCart,
        removeFromConsumerCart,
        updateConsumerCartQty,
        clearConsumerCart,
        calculateConsumerCartPromo,
        placeConsumerOrder,
        loadConsumerOrders,
        toggleConsumerWishlist,
        loadConsumerWishlist,
        // PROMOTIONS
        adminPromotions,
        loadAdminPromotions,
        saveAdminPromotion,
        deleteAdminPromotion,
        toggleAdminPromotionActive,
        // RFQ
        buyerRfqs,
        merchantRfqs,
        loadBuyerRfqs,
        loadMerchantRfqs,
        createBuyerRfq,
        acceptRfqQuote,
        submitMerchantRfqQuote,
        // MESSAGES
        messageThreads,
        activeMessageThread,
        activeMessageThreadMessages,
        loadMessageThreads,
        openMessageThread,
        sendMessageReply,
        createMessageThread,
        // RISK / BI
        riskAlerts,
        loadRiskAlerts,
        acknowledgeRiskAlert,
        biSalesTrend,
        biCategoryPerformance,
        biMerchantRanking,
        loadBISalesTrend,
        loadBICategoryPerformance,
        loadBIMerchantRanking,
        // EXCHANGE
        loadExchangeRates,
        // COUNTS
        unreadMessagesCount,
        openRiskAlertsCount,
      }}
    >
      {children}
    </B2BContext.Provider>
  );
};

export const useB2B = () => {
  const context = useContext(B2BContext);
  if (!context) {
    throw new Error('useB2B must be used within a B2BProvider');
  }
  return context;
};

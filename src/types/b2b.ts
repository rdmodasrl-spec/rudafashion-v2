import type { MerchantStorefrontTemplate } from '../shared/merchantStorefrontTemplate';

export type ProductVisibility = 'public' | 'wholesale' | 'private';
export type ProductLifecycleStatus = 'published' | 'pending_review' | 'draft' | 'rejected' | 'archived';

export interface SKUItem {
  sku: string;
  variantId?: string;
  color: string;
  colorCode: string;
  size: string;
  stockCentral: number;
  /** @deprecated Retained only to read legacy payloads; runtime inventory uses stockCentral. */
  stockMestre: number;
  /** @deprecated Retained only to read legacy payloads; runtime inventory uses stockCentral. */
  stockMilano: number;
  reserved?: number;
  isActive?: boolean;
  allowBackorder?: boolean;
  barcode?: string;
  cost?: number;
  wholesalePrice?: number;
  rrp?: number;
  weight?: string;
}

export type WarehouseCode = 'central';

export type ProductMediaType = 'image' | 'video';
export type ProductMediaRole = 'main' | 'detail' | 'color';

export interface ProductMedia {
  id: string;
  type: ProductMediaType;
  url: string;
  storageKey?: string;
  contentType?: string;
  sizeBytes?: number;
  role?: ProductMediaRole;
  color?: string;
  source?: 'merchant-upload' | 'ai-try-on';
  reviewStatus?: 'pending' | 'approved';
  poster?: string;
  alt?: string;
}

export interface Product {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  styleNo: string; // 款号 e.g., DRS-2026-0088
  name: string;
  name_it?: string;
  name_zh?: string;
  category: string;
  storeCategorySlug?: string | null;
  subCategory: string; // 连衣裙, 外套, 西装, etc.
  brand: string;
  season: string;
  images: string[];
  media?: ProductMedia[];
  wholesalePrice: number; // 基础批发价 (Tier 1)
  wholesalePrice100?: number | null; // 100 件及以上的批发单价
  bulkPriceMinimumQuantity?: number;
  rrpPrice: number; // 旧商品的建议零售价；新商品不再单独录入
  costPrice?: number; // 出厂成本价 (仅商家和管理员可见)
  moq: number; // 最低起订量 (如 6件)
  packSize: number; // 箱规/每包件数 (如 6件/包 或 12件/箱)
  requiresFullCarton?: boolean;
  status: 'new' | 'hot' | 'clearance' | 'restocked';
  inventoryStatus: 'in_stock' | 'low_stock' | 'pre_order' | 'coming_soon';
  origin: string; // 产地 e.g., "Made in Italy (Prato / Bologna)"
  origin_it?: string;
  origin_zh?: string;
  fabric: string; // 面料 e.g., "100% 意大利双绉丝 / 桑蚕丝"
  fabric_it?: string;
  fabric_zh?: string;
  manufacturingProcess?: string;
  fit?: string;
  composition: string; // 成分比例
  weight: string; // 单件重量
  packaging: string; // 包装规格 e.g., "独立防尘挂装 + 6件外箱"
  washCare: string;
  description: string;
  description_it?: string;
  description_zh?: string;
  skus: SKUItem[];
  colors?: string[];
  sizes?: string[];
  isPrivateVault?: boolean;
  merchantId?: string;
  merchantName?: string;
  isExclusiveProtected?: boolean; // Private Collection 授权买家专属商品 (需商家审核授权方可看货)
  protectionLevel?: 'public' | 'exclusive_vault';
  visibility?: ProductVisibility; // 'public' | 'wholesale' | 'private'
  isLockedForBuyer?: boolean; // 'public' | 'wholesale' | 'private'
  lifecycleStatus?: ProductLifecycleStatus; // 'published' | 'pending_review' | 'draft' | 'rejected' | 'archived'
  featuredOnHome?: boolean;
  featuredOnSale?: boolean;
}

export interface Merchant {
  id: string;
  platformFeeRate?: number;
  merchantZone?: 'iolo' | 'tavoro' | 'leather' | 'boutique_department';
  /** Legacy main-domain storefront slug; prefer the assigned store subdomain. */
  slug?: string;
  /** DNS-safe subdomain assigned to the merchant storefront. */
  storeSlug?: string;
  name: string;
  companyLegalName: string;
  vatNumber?: string;
  businessType?: string;
  industry?: string;
  code: string;
  storeLookupCode?: string;
  country: string;
  country_it?: string;
  country_zh?: string;
  city: string;
  city_it?: string;
  city_zh?: string;
  showroomAddress: string;
  showroomArea: string;
  showroomArea_it?: string;
  showroomArea_zh?: string;
  showroomImage: string;
  showroomPanoramicImages?: string[];
  storefrontMediaItems?: Array<{
    field: string;
    url: string;
    storageKey: string;
    contentType: string;
    sizeBytes: number;
  }>;
  storefrontVideo?: string;
  storefrontTemplate?: MerchantStorefrontTemplate;
  storefrontSeoTitle?: string;
  storefrontSeoDescription?: string;
  storefrontShippingPolicy?: string;
  storefrontReturnsPolicy?: string;
  storefrontReturnAddress?: string;
  logo: string;
  banner: string;
  tagline: string;
  tagline_it?: string;
  tagline_zh?: string;
  description: string;
  description_it?: string;
  description_zh?: string;
  specialties: string[];
  foundedYear: number;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  whatsapp?: string;
  wechat?: string;
  isVerified: boolean;
  storefrontEnabled?: boolean | null;
  rating: number;
  publicProductsCount: number;
  protectedVaultCount: number;
  storeCategories?: MerchantStoreCategory[];
  name_it?: string;
  name_zh?: string;
  bannerImage?: string;
  origin?: string;
  specialtyCategory?: string;
  websiteUrl?: string;
  mapLatitude?: number;
  mapLongitude?: number;
  piva?: string;
  phone?: string;
}

export interface MerchantStoreCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface VaultAccessRequest {
  id: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  businessType: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt?: string;
  approvedBy?: string;
  expiresAt?: string;
  accessLogCount?: number;
  customerCompanyName?: string;
  customerName?: string;
  customerVat?: string;
  requestedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  styleNo: string;
  productName: string;
  image: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  inStockQuantity?: number | null;
  preorderQuantity?: number | null;
  unitPrice: number;
  packSize: number;
  merchantId?: string;
  merchantName?: string;
}

export interface ProductReservationRequestItem {
  sku: string;
  quantity: number;
}

export interface ProductReservationRequest {
  id: string;
  requestNo: string;
  status: string;
  totalQty: number;
  totalAmount: number;
  createdAt: string;
}

export interface SavedCart {
  id: string;
  name: string;
  createdAt: string;
  items: CartItem[];
  totalAmount: number;
  totalQty: number;
}

export type OrderStatus = 'draft' | 'placed' | 'pending' | 'confirmed' | 'picking' | 'shipped' | 'delivered' | 'return_requested' | 'returned' | 'cancelled';
export type DeliveryType = 'shipping' | 'showroom_pickup' | 'express_delivery';
export type PaymentMethod = 'bank_transfer' | 'net_30' | 'credit_card' | 'paypal' | 'stripe' | 'solana_pay' | 'cash' | 'alipay' | 'wechat_pay' | 'net_30_days' | 'bank_wire_transfer' | 'bank_transfer_prepay' | 'credit_line';
export type PaymentStatus = 'paid' | 'partially_paid' | 'partially_refunded' | 'pending_credit' | 'unpaid' | 'pending' | 'payment_required' | 'payment_failed' | 'payment_timeout' | 'pending_refund' | 'refunded';
export type SolanaTokenSymbol = 'USDC' | 'EURC';

export interface SolanaPaymentDetails {
  id: string;
  uri: string;
  tokenSymbol: SolanaTokenSymbol;
  tokenAmount: string;
  eurAmount: string;
  exchangeRate: string;
  exchangeRateSource: string;
  exchangeRateUpdatedAt: string;
  commissionRate: string;
  merchantAmount: string;
  commissionAmount: string;
  quotedAt: string;
  expiresAt: string;
  status: 'pending' | 'paid' | 'expired' | 'late_payment' | 'review';
  signature?: string | null;
}
export type BusinessType = 'Boutique' | 'Retail Store' | 'Online Store' | 'Distributor' | 'Other' | 'boutique' | 'retail_store' | 'online_store' | 'distributor' | 'other';

export interface OrderTimeline {
  status: OrderStatus;
  title: string;
  time: string;
  completed: boolean;
  note?: string;
}

export interface OrderAgreementTerms {
  paymentPlan: 'full_prepayment' | 'ship_before_payment' | 'partial_prepayment' | 'cash_on_delivery' | 'custom';
  paymentMethod: string;
  prepaymentAmount: number;
  remainingBalanceTrigger: 'before_shipment' | 'on_delivery' | 'after_delivery' | 'date' | 'custom';
  remainingBalanceDueAt: string | null;
  customPaymentCondition: string | null;
  supplyMode: 'in_stock_first' | 'all_ready' | 'partial_shipments';
  expectedDeliveryAt: string | null;
  deliveryType: 'shipping' | 'showroom_pickup' | 'express_delivery';
  pickupLocation: string | null;
  shippingAddress: { street: string; city: string; country: string; zip: string; recipient?: string; phone?: string };
  items: Array<{ orderItemId: string; quantity: number; unitPrice: number }>;
  shippingFee: number;
  additionalFees?: number;
  additionalFeesDescription?: string | null;
  discountAmount: number;
  totalAmount: number;
  currency: 'EUR';
}

export interface MerchantAssistedOrderDraft {
  customerId: string | null;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  shippingAddress: OrderAgreementTerms['shippingAddress'];
  shippingFee: number;
  additionalFees: number;
  additionalFeesDescription: string;
  terms: {
    paymentPlan: OrderAgreementTerms['paymentPlan'];
    paymentMethod: string;
    prepaymentAmount?: number;
    prepaymentPercent?: number;
    remainingBalanceTrigger: OrderAgreementTerms['remainingBalanceTrigger'];
    remainingBalanceDueAt: string | null;
    customPaymentCondition: string | null;
    supplyMode: OrderAgreementTerms['supplyMode'];
    expectedDeliveryAt: string | null;
  };
}

export interface OrderAgreementVersion {
  id: string;
  orderId: string;
  version: number;
  status: 'pending_buyer' | 'pending_merchant' | 'active' | 'superseded';
  proposedByRole: 'buyer' | 'merchant';
  createdAt: string;
  terms: OrderAgreementTerms;
  buyerConfirmedAt?: string | null;
  merchantConfirmedAt?: string | null;
  activatedAt?: string | null;
}

export interface Order {
  id: string;
  orderNo: string; // e.g. #10088
  date: string;
  customerId: string;
  companyName: string;
  items: CartItem[];
  totalQty: number;
  totalAmount: number;
  shippingFee?: number;
  additionalFees?: number;
  additionalFeesDescription?: string | null;
  discountAmount?: number;
  promotionCode?: string;
  status: OrderStatus;
  deliveryType: 'shipping' | 'showroom_pickup';
  pickupLocation?: string; // e.g., "Mestre Showroom"
  paymentMethod: PaymentMethod;
  solanaToken?: SolanaTokenSymbol;
  solanaPayment?: SolanaPaymentDetails;
  paymentStatus: PaymentStatus;
  bankTransferReference?: string;
  createdAt?: string;
  customerCompanyName?: string;
  trackingNumber?: string;
  carrier?: string;
  timeline: OrderTimeline[];
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    zip: string;
    recipient?: string;
    phone?: string;
  };
  notes?: string;
  refundReason?: string;
  refundAmount?: number;
  refundStatus?: 'none' | 'requested' | 'approved' | 'rejected';
  returnRequestId?: string;
  hasLogisticsException?: boolean;
  merchantId?: string;
  merchantName?: string;
  parentOrderNo?: string;
  idempotencyKey?: string;
  assistedDraft?: MerchantAssistedOrderDraft | null;
  subOrders?: Order[];
  agreementVersions?: OrderAgreementVersion[];
  paidAmount?: number;
  paymentAmountDue?: number;
  unreadMessageCount?: number;
  pendingMerchantReplyCount?: number;
  canBeginPreparation?: boolean;
  canShipOrder?: boolean;
  currentTasks?: {
    buyer: { phase: number; label: string; task: string; action: string | null };
    merchant: { phase: number; label: string; task: string; action: string | null };
  };
  chainEvents?: Array<{
    id: string;
    eventType: string;
    actorRole: string;
    source: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface Showroom {
  id: string;
  name: string;
  code: string;
  city: string;
  city_it?: string;
  city_zh?: string;
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  openingHours_it?: string;
  openingHours_zh?: string;
  capacity: string;
  capacity_it?: string;
  capacity_zh?: string;
  image: string;
  features: string[];
  features_it?: string[];
  features_zh?: string[];
}

export interface Appointment {
  id: string;
  appointmentNo: string;
  showroomId: string;
  showroomName: string;
  date: string;
  time: string;
  timeSlot?: string;
  visitorCount: number;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  interests: string[];
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

export type CustomerTier = 'tier_standard' | 'tier_vip' | 'tier_major';
export type CustomerLevel = 'good_customer' | 'regular_customer' | 'new_customer' | 'standard_customer' | 'overdue_customer';

export interface CustomerDocument {
  id: string;
  name: string;
  type: 'business_license' | 'vat_cert' | 'storefront_photo' | 'bank_wire_slip' | 'tech_pack' | 'other';
  url: string; // Data URL or Image URL
  size?: string;
  uploadedAt: string;
}

export interface CustomSampleInquiry {
  id: string;
  inquiryNo: string;
  customerId: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  title: string;
  category: string;
  targetQuantity: number;
  targetPriceEur: number;
  fabricRequirements: string;
  notes: string;
  attachments: CustomerDocument[];
  status: 'submitted' | 'under_review' | 'sample_in_production' | 'quoted' | 'closed';
  createdAt: string;
  quotedPrice?: number;
  adminFeedback?: string;
  feedback?: string;
}

export interface StockInboundRecord {
  id: string;
  batchNo: string;
  date: string;
  supplier: string;
  location: WarehouseCode | string;
  items: {
    sku: string;
    styleNo: string;
    productName: string;
    quantity: number;
  }[];
  operator: string;
  note?: string;
}

export interface WholesaleCustomer {
  id: string;
  companyName: string;
  vatNumber: string;
  address: string;
  city: string;
  country: string;
  contactPerson: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  businessType: 'Boutique' | 'Retail Store' | 'Online Store' | 'Distributor' | 'Other';
  customerLevel?: CustomerLevel;
  websiteOrSocial: string;
  status: 'pending' | 'approved' | 'rejected';
  tier: CustomerTier;
  creditLimit: number; // 信用额度 (用于账期支付)
  usedCredit: number;
  discountRate: number; // e.g., 1.0 (无折扣), 0.9 (9折), 0.825 (大客户折)
  appliedAt: string;
  approvedAt?: string;
  documents?: CustomerDocument[]; // 客人自主上传的资质文件 / 门头照片 / 税号证明
  paymentSlips?: CustomerDocument[]; // 付款凭单/电汇水单
}

export interface StockTransferRecord {
  id: string;
  transferNo?: string; // e.g. TR-000128
  date: string;
  fromLocation: WarehouseCode | string;
  toLocation: WarehouseCode | string;
  styleNo: string;
  sku: string;
  quantity: number;
  status: 'requested' | 'approved' | 'picking' | 'in_transit' | 'received' | 'completed';
  operator: string;
  merchantId?: string;
  notes?: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'merchant' | 'system';
  action: string;
  entity: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  ip?: string;
}

export interface MerchantPayoutRecord {
  id: string;
  orderIds?: string[];
  merchantId: string;
  merchantName: string;
  period: string; // e.g. "2026-09 上半月"
  grossSales: number;
  platformFeeRate: number; // e.g. 0.08 (8%)
  platformFeeAmount: number;
  paymentProcessingFee: number;
  refunds: number;
  netPayout: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paidAt?: string;
  settlementReference?: string | null;
  settlementProof?: string | null;
  settledAt?: string | null;
  settledBy?: string | null;
  bankAccount: string;
}

export type PortalMode = 'buyer' | 'merchant' | 'admin';
export type MerchantRole = 'owner' | 'manager' | 'sales' | 'warehouse' | 'finance';

export interface ReorderItemAnalysis {
  productId: string;
  styleNo: string;
  productName: string;
  image: string;
  sku: string;
  color: string;
  size: string;
  orderedQty: number;
  availableStock: number;
  originalPrice?: number;
  currentPrice: number;
  isAvailable: boolean;
  isPriceChanged?: boolean;
  hasPermission?: boolean;
  statusNote?: string;
  merchantId?: string;
  merchantName?: string;
  packSize?: number;
  moq?: number;
  isMoqMet?: boolean;
  hasAccess?: boolean;
  historicalPrice?: number;
  priceChanged?: boolean;
}

export interface ReorderAnalysis {
  orderId: string;
  orderNo: string;
  items: ReorderItemAnalysis[];
  hasPriceChange?: boolean;
  hasOutOfStock?: boolean;
  hasPermissionIssue?: boolean;
  totalOriginalItems?: number;
  availableCount?: number;
  unavailableCount?: number;
  priceChangedCount?: number;
}

export interface VaultAccessAuditLog {
  id: string;
  customerId: string;
  customerName: string;
  companyName: string;
  merchantId: string;
  merchantName: string;
  collectionName: string;
  accessedAt: string;
  approvedBy: string;
  expiresAt: string;
  ipAddress?: string;
}

export interface CartVerificationResult {
  isValid: boolean;
  hasErrors?: boolean;
  adjustmentsApplied: boolean;
  issues: string[];
  stockAdjustments: Array<{
    styleNo: string;
    sku: string;
    previousQty: number;
    adjustedQty: number;
    reason: string;
  }>;
  priceAdjustments: Array<{
    styleNo: string;
    previousPrice: number;
    currentPrice: number;
  }>;
  removedItems: Array<{
    styleNo: string;
    reason: string;
  }>;
}

// ==============================================================
// 🛒 END-CONSUMER (C端消费者零售) — 新增
// ==============================================================
export type ConsumerAccountStatus = 'active' | 'banned' | 'pending_verification';

export interface ConsumerAddress {
  id: string;
  label?: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  country: string;
  zip: string;
  isDefault?: boolean;
}

export interface Consumer {
  id: string;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  firstName: string;
  lastName: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say';
  birthday?: string;
  avatarUrl?: string;
  country?: string;
  preferredLang?: 'zh' | 'it' | 'en';
  currency?: 'EUR' | 'USD' | 'CNY' | 'GBP';
  status?: ConsumerAccountStatus;
  points?: number;
  level?: 'silver' | 'gold' | 'platinum';
  totalSpent?: number;
  ordersCount?: number;
  newsletterOptIn?: boolean;
  createdAt: string;
  addresses?: ConsumerAddress[];
  wishlistProductIds?: string[];
}

export type ConsumerOrderStatus = 'payment_pending' | 'paid' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'return_requested' | 'returned' | 'refunded' | 'cancelled';

export interface ConsumerCartItem {
  id: string;
  productId: string;
  merchantId: string;
  styleNo: string;
  productName: string;
  image: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  retailPrice: number;
  appliedDiscounts?: PromotionBreakdownItem[];
}

export interface ConsumerOrder {
  id: string;
  orderNo: string;
  consumerId: string;
  consumerName: string;
  items: ConsumerCartItem[];
  totalQty: number;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  couponDiscount?: number;
  usedPoints?: number;
  pointsDiscount?: number;
  finalTotal: number;
  currency: string;
  status: ConsumerOrderStatus;
  shippingAddress: ConsumerAddress;
  billingAddress?: ConsumerAddress;
  paymentMethod: 'credit_card' | 'paypal' | 'klarna' | 'bank_transfer';
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'failed';
  carrier?: string;
  trackingNumber?: string;
  trackingEvents?: Array<{time: string; status: string; location?: string; note?: string;}>;
  giftNote?: string;
  invoiceRequested?: boolean;
  returnRequestId?: string;
  createdAt: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  estimatedDeliveryDate?: string;
  // 分佣归属
  merchantBreakdown?: Array<{merchantId: string; merchantName: string; subtotal: number; platformFee: number; netMerchant: number;}>;
}

// ==============================================================
// 🎯 MARKETING / PROMOTIONS 营销促销引擎
// ==============================================================
export type PromotionType = 'percent_discount' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping' | 'tiered_discount' | 'bundle_deal';
export type PromotionScope = 'sitewide' | 'category' | 'product' | 'merchant' | 'consumer_tier';
export type PromotionAppliesOn = 'retail' | 'wholesale' | 'both';

export interface PromotionRule {
  id: string;
  code?: string;
  type: PromotionType;
  scope: PromotionScope;
  appliesOn: PromotionAppliesOn;
  name: string;
  name_it?: string;
  name_zh?: string;
  description?: string;
  // 生效条件
  minSubtotal?: number;
  minQty?: number;
  // 优惠
  percentOff?: number;
  fixedAmountOff?: number;
  // BXGY
  buyQty?: number;
  getQty?: number;
  getPercentOff?: number;
  // 阶梯
  tiers?: Array<{thresholdQty?: number; thresholdAmount?: number; percentOff: number;}>;
  // 范围筛选
  categoryIds?: string[];
  productIds?: string[];
  merchantIds?: string[];
  excludeSaleItems?: boolean;
  // 发放
  usageLimitPerConsumer?: number;
  totalUsageLimit?: number;
  totalUsedCount?: number;
  // 时间
  startsAt: string;
  expiresAt?: string;
  isActive: boolean;
  createdByAdminId?: string;
  createdAt: string;
}

export interface CouponCode {
  id: string;
  code: string;
  promotionId: string;
  isUsed?: boolean;
  usedByConsumerId?: string;
  usedAt?: string;
}

export interface PromotionBreakdownItem {
  promotionId: string;
  promotionName: string;
  promotionType: PromotionType;
  amountSaved: number;
}

export interface PromotionCalculationResult {
  subtotal: number;
  discountTotal: number;
  shippingFee?: number;
  finalTotal: number;
  appliedPromotions: PromotionBreakdownItem[];
  couponApplied?: {code: string; discount: number;};
}

// ==============================================================
// 💬 RFQ 询报价 (买家→卖家 询价 + 商家入驻自助)
// ==============================================================
export type RfqStatus = 'draft' | 'submitted' | 'quoted' | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'converted_to_order';

export interface RfqItem {
  id: string;
  productId?: string;
  styleNoRef?: string;
  productName: string;
  images?: string[];
  category?: string;
  fabricNote?: string;
  targetColors?: string[];
  targetSizes?: string[];
  targetQty: number;
  targetUnitPrice?: number;
  expectedDeliveryDate?: string;
  remarks?: string;
}

export type BuyerRfqViewStatus = 'DRAFT' | 'OPEN' | 'QUOTED' | 'ACCEPTED' | 'CLOSED' | 'EXPIRED';
export type RfqQuoteViewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

export interface RfqQuoteView {
  id: string;
  merchantId: string;
  merchantName: string;
  country?: string;
  unitPrice: number;
  minOrderQty: number;
  leadTimeDays: number;
  validityDays: number;
  notes?: string;
  status: RfqQuoteViewStatus;
  createdAt: string;
}

export interface BuyerRfqView {
  id: string;
  rfqNo: string;
  title: string;
  buyerCompany?: string;
  buyerCountry?: string;
  description?: string;
  category: string;
  targetQuantity: number;
  targetPrice?: number;
  targetCurrency: SupportedCurrency;
  deadlineAt: string;
  preferredCountries: string[];
  productIds: string[];
  status: BuyerRfqViewStatus;
  quotes?: RfqQuoteView[];
  createdAt: string;
}

export interface CreateBuyerRfqInput {
  title: string;
  description: string;
  category: string;
  targetQuantity: number;
  targetPrice: number;
  targetCurrency: SupportedCurrency;
  deadlineAt: string;
  preferredCountries: string[];
  productIds: string[];
}

export interface SubmitRfqQuoteInput {
  unitPrice: number;
  minOrderQty: number;
  leadTimeDays: number;
  validityDays: number;
  notes: string;
}

export interface RfqQuote {
  id: string;
  quotedBy: string;
  quotedByRole: 'merchant' | 'admin';
  unitPrice: number;
  leadTimeDays?: number;
  moq: number;
  validityDays: number;
  quotedAt: string;
  note?: string;
  attachments?: CustomerDocument[];
}

export interface BuyerRfq {
  id: string;
  rfqNo: string;
  title: string;
  buyerCustomerId: string;
  buyerCompanyName: string;
  buyerContactPerson: string;
  buyerPhone: string;
  buyerEmail?: string;
  targetMerchantIds?: string[];
  items: RfqItem[];
  targetBudgetTotal?: number;
  expectedDeliveryDate?: string;
  status: RfqStatus;
  submittedAt?: string;
  expiresAt?: string;
  // 多方报价
  quotes?: RfqQuote[];
  acceptedQuoteId?: string;
  convertedOrderNo?: string;
  createdAt: string;
  lastUpdatedAt: string;
  remarks?: string;
}

// ==============================================================
// 📝 MERCHANT SELF-REGISTRATION 商家自助入驻申请
// ==============================================================
export type MerchantOnboardingStatus = 'submitted' | 'reviewing' | 'additional_info_needed' | 'approved' | 'rejected';
export type MerchantOnboardingZone = 'iolo' | 'tavoro' | 'leather' | 'boutique_department';

export interface MerchantOnboardingApplication {
  id: string;
  applicationNo: string;
  companyLegalName: string;
  tradingName?: string;
  vatNumber: string;
  taxCode?: string;
  country: string;
  city: string;
  address: string;
  zip?: string;
  contactPerson: string;
  contactPosition?: string;
  phone: string;
  email: string;
  whatsapp?: string;
  wechat?: string;
  websiteOrSocial?: string;
  businessType: string;
  merchantZone: MerchantOnboardingZone;
  specialties?: string[];
  categories?: string[];
  yearsInBusiness?: number;
  annualRevenueRange?: string;
  showroomAddress?: string;
  bankName?: string;
  ibanLast4?: string;
  description?: string;
  documents?: CustomerDocument[];
  status: MerchantOnboardingStatus;
  adminReviewNotes?: string;
  reviewedByAdminId?: string;
  reviewedAt?: string;
  approvedMerchantId?: string;
  createdAt: string;
}

// ==============================================================
// 💬 INTERNAL MESSAGING (站内消息 IM)
// ==============================================================
export type MessageThreadType = 'order_support' | 'rfq_discussion' | 'vault_access' | 'general_inquiry' | 'consumer_care';
export type MessageParticipantRole = 'buyer' | 'merchant' | 'admin' | 'consumer' | 'system';

export interface MessageParticipant {
  id: string;
  name: string;
  role: MessageParticipantRole;
  avatar?: string;
  lastReadAt?: string;
  unreadCount?: number;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'file' | 'order_ref' | 'product_ref';
  url?: string;
  refId?: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: MessageParticipantRole;
  senderName: string;
  content: string;
  attachments?: MessageAttachment[];
  createdAt: string;
  isRead?: boolean;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string | null;
  senderRole: 'buyer' | 'merchant' | 'system';
  source: 'human' | 'automatic';
  content: string;
  clientMessageId: string;
  replyToMessageId: string | null;
  requiresMerchantReply: boolean;
  merchantRepliedAt: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface MessageThread {
  id: string;
  type: MessageThreadType;
  subject: string;
  refOrderId?: string;
  refRfqId?: string;
  refMerchantId?: string;
  refBuyerId?: string;
  refConsumerId?: string;
  participants: MessageParticipant[];
  lastMessageAt: string;
  lastMessagePreview?: string;
  isOpen: boolean;
  priority?: 'normal' | 'urgent';
  assigneeAdminId?: string;
  createdAt: string;
}

export interface MessageThreadSummary {
  id: string;
  title: string;
  participantRole: MessageParticipantRole;
  participantId: string;
  unreadCount: number;
  lastMessagePreview?: string;
  updatedAt: string;
  participants?: MessageParticipant[];
  lastMessage?: ChatMessage;
}

// ==============================================================
// 📊 RISK MONITORING / BI 看板扩展
// ==============================================================
export interface RiskAlert {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  type: 'inventory_anomaly' | 'order_frequency' | 'credit_limit' | 'return_rate' | 'login_geo' | 'payment_failure';
  title: string;
  description: string;
  entity?: string;
  entityId?: string;
  metricName?: string;
  metricValue?: number;
  threshold?: number;
  isAcknowledged?: boolean;
  createdAt: string;
}

export interface BISalesTrendPoint {
  date: string;
  gmv: number;
  ordersCount: number;
  aov: number;
  unitsSold: number;
  newBuyers?: number;
  newConsumers?: number;
}

export interface BICategoryPerformance {
  category: string;
  gmv: number;
  sharePercent: number;
  unitsSold: number;
  growthYoY?: number;
}

export interface BIMerchantRanking {
  merchantId: string;
  merchantName: string;
  gmv: number;
  ordersCount: number;
  onTimeShipRate: number;
  returnRate: number;
  rating: number;
}

// ==============================================================
// 🌐 MULTI-CURRENCY / EXCHANGE
// ==============================================================
export type SupportedCurrency = 'EUR' | 'USD' | 'CNY' | 'GBP' | 'JPY' | 'CHF';

export interface ExchangeRatesSnapshot {
  base: SupportedCurrency;
  rates: Record<SupportedCurrency, number>;
  updatedAt: string;
  source: string;
}

// ==============================================================
// 📱 CONSUMER + MESSAGES VIEW 状态枚举扩展
// ==============================================================
export type ExtendedB2BView =
  | 'consumer_store'
  | 'consumer_cart'
  | 'consumer_checkout'
  | 'consumer_orders'
  | 'consumer_account'
  | 'consumer_wishlist'
  | 'consumer_register'
  | 'consumer_login'
  | 'rfq_buyer_list'
  | 'rfq_buyer_create'
  | 'rfq_merchant_list'
  | 'merchant_onboarding'
  | 'ai_team_preview'
  | 'merchant_quick_start'
  | 'messages_center';

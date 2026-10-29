-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "customerId" TEXT,
    "merchantId" TEXT,
    "merchantCode" TEXT,
    "passwordHash" TEXT NOT NULL,
    "require2fa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyLegalName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "country_it" TEXT,
    "country_zh" TEXT,
    "city" TEXT NOT NULL,
    "city_it" TEXT,
    "city_zh" TEXT,
    "showroomAddress" TEXT NOT NULL,
    "showroomArea" TEXT NOT NULL,
    "showroomArea_it" TEXT,
    "showroomArea_zh" TEXT,
    "showroomImage" TEXT NOT NULL,
    "showroomPanoramicImages" TEXT,
    "logo" TEXT NOT NULL,
    "banner" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "tagline_it" TEXT,
    "tagline_zh" TEXT,
    "description" TEXT NOT NULL,
    "description_it" TEXT,
    "description_zh" TEXT,
    "specialties" TEXT NOT NULL,
    "foundedYear" INTEGER NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "whatsapp" TEXT,
    "wechat" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "publicProductsCount" INTEGER NOT NULL DEFAULT 0,
    "protectedVaultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessType" TEXT NOT NULL DEFAULT 'Boutique',
    "websiteOrSocial" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tier" TEXT NOT NULL DEFAULT 'tier_standard',
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usedCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountRate" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "registrationDate" TEXT NOT NULL,
    "approvedAt" TEXT,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'document_check',
    "documents" TEXT,
    "paymentSlips" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "styleNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_it" TEXT,
    "name_zh" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "images" TEXT NOT NULL,
    "wholesalePrice" DECIMAL(10,2) NOT NULL,
    "rrpPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2),
    "moq" INTEGER NOT NULL DEFAULT 1,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "inventoryStatus" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "origin_it" TEXT,
    "origin_zh" TEXT,
    "fabric" TEXT NOT NULL,
    "fabric_it" TEXT,
    "fabric_zh" TEXT,
    "composition" TEXT NOT NULL,
    "weight" TEXT NOT NULL,
    "packaging" TEXT NOT NULL,
    "washCare" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description_it" TEXT,
    "description_zh" TEXT,
    "skus" TEXT NOT NULL,
    "merchantId" TEXT,
    "merchantName" TEXT,
    "isExclusiveProtected" BOOLEAN NOT NULL DEFAULT false,
    "protectionLevel" TEXT NOT NULL DEFAULT 'public',
    "visibility" TEXT NOT NULL DEFAULT 'wholesale',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'published',
    "featuredOnHome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "customerId" TEXT,
    "companyName" TEXT NOT NULL,
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL,
    "pickupLocation" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "timeline" TEXT NOT NULL,
    "shippingStreet" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL,
    "shippingZip" TEXT NOT NULL,
    "notes" TEXT,
    "merchantId" TEXT,
    "merchantName" TEXT,
    "parentOrderNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "styleNo" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "merchantId" TEXT,
    "merchantName" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "city_it" TEXT,
    "city_zh" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "openingHours" TEXT NOT NULL,
    "openingHours_it" TEXT,
    "openingHours_zh" TEXT,
    "capacity" TEXT NOT NULL,
    "capacity_it" TEXT,
    "capacity_zh" TEXT,
    "image" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "features_it" TEXT,
    "features_zh" TEXT,

    CONSTRAINT "Showroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentNo" TEXT NOT NULL,
    "showroomId" TEXT NOT NULL,
    "showroomName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "visitorCount" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "interests" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultAccessRequest" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL,
    "appliedAt" TEXT NOT NULL,
    "reviewedAt" TEXT,
    "approvedBy" TEXT,
    "expiresAt" TEXT,
    "accessLogCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT,
    "date" TEXT NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "styleNo" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "merchantId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantPayout" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "grossSales" DECIMAL(14,2) NOT NULL,
    "platformFeeRate" DECIMAL(6,4) NOT NULL,
    "platformFeeAmount" DECIMAL(14,2) NOT NULL,
    "paymentProcessingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayout" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TEXT,
    "bankAccount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthAccount_role_idx" ON "AuthAccount"("role");

-- CreateIndex
CREATE INDEX "AuthAccount_email_idx" ON "AuthAccount"("email");

-- CreateIndex
CREATE INDEX "AuthAccount_username_idx" ON "AuthAccount"("username");

-- CreateIndex
CREATE INDEX "AuthAccount_merchantId_idx" ON "AuthAccount"("merchantId");

-- CreateIndex
CREATE INDEX "AuthAccount_customerId_idx" ON "AuthAccount"("customerId");

-- CreateIndex
CREATE INDEX "AuthAccount_merchantCode_idx" ON "AuthAccount"("merchantCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_role_email_key" ON "AuthAccount"("role", "email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_role_username_key" ON "AuthAccount"("role", "username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_merchantId_key" ON "AuthAccount"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_merchantCode_key" ON "AuthAccount"("merchantCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_customerId_key" ON "AuthAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_code_key" ON "Merchant"("code");

-- CreateIndex
CREATE INDEX "Merchant_code_idx" ON "Merchant"("code");

-- CreateIndex
CREATE INDEX "Merchant_country_idx" ON "Merchant"("country");

-- CreateIndex
CREATE INDEX "Merchant_city_idx" ON "Merchant"("city");

-- CreateIndex
CREATE INDEX "Merchant_isVerified_idx" ON "Merchant"("isVerified");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_vatNumber_idx" ON "Customer"("vatNumber");

-- CreateIndex
CREATE INDEX "Customer_country_idx" ON "Customer"("country");

-- CreateIndex
CREATE INDEX "Customer_tier_idx" ON "Customer"("tier");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Product_merchantId_idx" ON "Product"("merchantId");

-- CreateIndex
CREATE INDEX "Product_styleNo_idx" ON "Product"("styleNo");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_subCategory_idx" ON "Product"("subCategory");

-- CreateIndex
CREATE INDEX "Product_season_idx" ON "Product"("season");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_inventoryStatus_idx" ON "Product"("inventoryStatus");

-- CreateIndex
CREATE INDEX "Product_lifecycleStatus_idx" ON "Product"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "Product_featuredOnHome_idx" ON "Product"("featuredOnHome");

-- CreateIndex
CREATE INDEX "Product_wholesalePrice_idx" ON "Product"("wholesalePrice");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Order_orderNo_idx" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_merchantId_idx" ON "Order"("merchantId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_date_idx" ON "Order"("date");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_merchantId_idx" ON "OrderItem"("merchantId");

-- CreateIndex
CREATE INDEX "OrderItem_styleNo_idx" ON "OrderItem"("styleNo");

-- CreateIndex
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Showroom_code_key" ON "Showroom"("code");

-- CreateIndex
CREATE INDEX "Showroom_code_idx" ON "Showroom"("code");

-- CreateIndex
CREATE INDEX "Showroom_city_idx" ON "Showroom"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentNo_key" ON "Appointment"("appointmentNo");

-- CreateIndex
CREATE INDEX "Appointment_appointmentNo_idx" ON "Appointment"("appointmentNo");

-- CreateIndex
CREATE INDEX "Appointment_showroomId_idx" ON "Appointment"("showroomId");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "VaultAccessRequest_merchantId_idx" ON "VaultAccessRequest"("merchantId");

-- CreateIndex
CREATE INDEX "VaultAccessRequest_customerId_idx" ON "VaultAccessRequest"("customerId");

-- CreateIndex
CREATE INDEX "VaultAccessRequest_status_idx" ON "VaultAccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo");

-- CreateIndex
CREATE INDEX "StockTransfer_transferNo_idx" ON "StockTransfer"("transferNo");

-- CreateIndex
CREATE INDEX "StockTransfer_merchantId_idx" ON "StockTransfer"("merchantId");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE INDEX "StockTransfer_date_idx" ON "StockTransfer"("date");

-- CreateIndex
CREATE INDEX "MerchantPayout_merchantId_idx" ON "MerchantPayout"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantPayout_period_idx" ON "MerchantPayout"("period");

-- CreateIndex
CREATE INDEX "MerchantPayout_status_idx" ON "MerchantPayout"("status");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAccessRequest" ADD CONSTRAINT "VaultAccessRequest_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAccessRequest" ADD CONSTRAINT "VaultAccessRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPayout" ADD CONSTRAINT "MerchantPayout_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

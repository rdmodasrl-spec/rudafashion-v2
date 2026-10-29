CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "movementType" TEXT NOT NULL,
  "referenceId" TEXT,
  "operatorId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_productId_sku_idx" ON "StockMovement"("productId", "sku");
CREATE INDEX "StockMovement_location_idx" ON "StockMovement"("location");
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");
CREATE INDEX "StockReservation_productId_sku_idx" ON "StockReservation"("productId", "sku");
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");
CREATE INDEX "PaymentTransaction_provider_providerPaymentId_idx" ON "PaymentTransaction"("provider", "providerPaymentId");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

CREATE TABLE "RefundTransaction" (
  "id" TEXT NOT NULL,
  "paymentTransactionId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "providerRefundId" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefundTransaction_orderId_idx" ON "RefundTransaction"("orderId");
CREATE INDEX "RefundTransaction_paymentTransactionId_idx" ON "RefundTransaction"("paymentTransactionId");
CREATE INDEX "RefundTransaction_status_idx" ON "RefundTransaction"("status");

CREATE TABLE "CreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "entryType" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "balanceAfter" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "operatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditLedgerEntry_customerId_createdAt_idx" ON "CreditLedgerEntry"("customerId", "createdAt");
CREATE INDEX "CreditLedgerEntry_orderId_idx" ON "CreditLedgerEntry"("orderId");
CREATE INDEX "CreditLedgerEntry_entryType_idx" ON "CreditLedgerEntry"("entryType");

CREATE TABLE "FulfillmentShipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "shipmentNo" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "status" TEXT NOT NULL,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "proofOfDelivery" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FulfillmentShipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FulfillmentShipment_orderId_shipmentNo_key" ON "FulfillmentShipment"("orderId", "shipmentNo");
CREATE INDEX "FulfillmentShipment_orderId_idx" ON "FulfillmentShipment"("orderId");
CREATE INDEX "FulfillmentShipment_trackingNumber_idx" ON "FulfillmentShipment"("trackingNumber");
CREATE INDEX "FulfillmentShipment_status_idx" ON "FulfillmentShipment"("status");

CREATE TABLE "AdminTwoFactor" (
  "id" TEXT NOT NULL,
  "adminAccountId" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "recoveryCodesHash" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminTwoFactor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminTwoFactor_adminAccountId_key" ON "AdminTwoFactor"("adminAccountId");
CREATE INDEX "AdminTwoFactor_enabled_idx" ON "AdminTwoFactor"("enabled");

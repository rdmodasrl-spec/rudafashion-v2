CREATE TABLE "SalesQuote" (
  "id" TEXT NOT NULL,
  "quoteNo" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "validUntil" TIMESTAMP(3),
  "totalQty" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "convertedOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesQuote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SalesQuoteItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "styleNo" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "approvalRequestId" TEXT,
  CONSTRAINT "SalesQuoteItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesQuote_quoteNo_key" ON "SalesQuote"("quoteNo");
CREATE INDEX "SalesQuote_merchantId_status_createdAt_idx" ON "SalesQuote"("merchantId","status","createdAt");
CREATE INDEX "SalesQuote_customerId_createdAt_idx" ON "SalesQuote"("customerId","createdAt");
CREATE INDEX "SalesQuoteItem_quoteId_idx" ON "SalesQuoteItem"("quoteId");
CREATE INDEX "SalesQuoteItem_productId_sku_idx" ON "SalesQuoteItem"("productId","sku");
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuoteItem" ADD CONSTRAINT "SalesQuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

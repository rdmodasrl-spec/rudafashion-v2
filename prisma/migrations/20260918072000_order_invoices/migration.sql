CREATE TABLE "OrderInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "merchantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "taxRate" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "buyerSnapshot" TEXT NOT NULL,
    "sellerSnapshot" TEXT NOT NULL,
    "itemsSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderInvoice_invoiceNo_key" ON "OrderInvoice"("invoiceNo");
CREATE UNIQUE INDEX "OrderInvoice_orderId_key" ON "OrderInvoice"("orderId");
CREATE INDEX "OrderInvoice_customerId_idx" ON "OrderInvoice"("customerId");
CREATE INDEX "OrderInvoice_merchantId_idx" ON "OrderInvoice"("merchantId");
CREATE INDEX "OrderInvoice_status_idx" ON "OrderInvoice"("status");
CREATE INDEX "OrderInvoice_issueDate_idx" ON "OrderInvoice"("issueDate");
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

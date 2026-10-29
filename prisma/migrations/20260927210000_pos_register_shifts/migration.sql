ALTER TABLE "Order" ADD COLUMN "posShiftId" TEXT;

CREATE TABLE "MerchantPosShift" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "registerCode" TEXT NOT NULL DEFAULT 'main',
    "status" TEXT NOT NULL DEFAULT 'open',
    "openingCash" DECIMAL(12,2) NOT NULL,
    "closingCash" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2),
    "cashDifference" DECIMAL(12,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingNote" TEXT,
    "closingNote" TEXT,
    CONSTRAINT "MerchantPosShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPosCashMovement" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantPosCashMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantPosShift_one_open_register_idx"
ON "MerchantPosShift"("merchantId", "registerCode")
WHERE "status" = 'open';
CREATE INDEX "MerchantPosShift_merchantId_status_openedAt_idx" ON "MerchantPosShift"("merchantId", "status", "openedAt");
CREATE INDEX "MerchantPosShift_employeeId_openedAt_idx" ON "MerchantPosShift"("employeeId", "openedAt");
CREATE UNIQUE INDEX "MerchantPosCashMovement_idempotencyKey_key" ON "MerchantPosCashMovement"("idempotencyKey");
CREATE INDEX "MerchantPosCashMovement_shiftId_createdAt_idx" ON "MerchantPosCashMovement"("shiftId", "createdAt");
CREATE INDEX "MerchantPosCashMovement_merchantId_createdAt_idx" ON "MerchantPosCashMovement"("merchantId", "createdAt");
CREATE INDEX "Order_posShiftId_idx" ON "Order"("posShiftId");

ALTER TABLE "MerchantPosShift"
ADD CONSTRAINT "MerchantPosShift_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPosShift"
ADD CONSTRAINT "MerchantPosShift_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "MerchantEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantPosCashMovement"
ADD CONSTRAINT "MerchantPosCashMovement_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "MerchantPosShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPosCashMovement"
ADD CONSTRAINT "MerchantPosCashMovement_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "MerchantEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order"
ADD CONSTRAINT "Order_posShiftId_fkey"
FOREIGN KEY ("posShiftId") REFERENCES "MerchantPosShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

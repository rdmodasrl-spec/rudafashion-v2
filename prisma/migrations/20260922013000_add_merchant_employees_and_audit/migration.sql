CREATE TABLE "MerchantEmployee" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantEmployee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeAuditLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantEmployee_merchantId_active_idx" ON "MerchantEmployee"("merchantId", "active");
CREATE INDEX "MerchantEmployee_email_idx" ON "MerchantEmployee"("email");
CREATE UNIQUE INDEX "MerchantEmployee_merchantId_email_key" ON "MerchantEmployee"("merchantId", "email");
CREATE INDEX "EmployeeAuditLog_merchantId_createdAt_idx" ON "EmployeeAuditLog"("merchantId", "createdAt");
CREATE INDEX "EmployeeAuditLog_employeeId_createdAt_idx" ON "EmployeeAuditLog"("employeeId", "createdAt");
CREATE INDEX "EmployeeAuditLog_entityType_entityId_idx" ON "EmployeeAuditLog"("entityType", "entityId");

ALTER TABLE "MerchantEmployee" ADD CONSTRAINT "MerchantEmployee_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAuditLog" ADD CONSTRAINT "EmployeeAuditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAuditLog" ADD CONSTRAINT "EmployeeAuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "MerchantEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

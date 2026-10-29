CREATE TABLE "MerchantCounterparty" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantCounterparty_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MerchantCustomerLink" ADD COLUMN "counterpartyId" TEXT;
ALTER TABLE "MerchantCustomerLink" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Supplier" ADD COLUMN "counterpartyId" TEXT;

INSERT INTO "MerchantCustomerLink" (
    "id", "merchantId", "customerId", "notes", "tags", "status", "createdAt", "updatedAt"
)
SELECT
    md5('merchant-business-customer:' || relationship."merchantId" || ':' || relationship."customerId"),
    relationship."merchantId",
    relationship."customerId",
    NULL,
    '[]',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "merchantId", "customerId"
    FROM "Order"
    WHERE "merchantId" IS NOT NULL AND "customerId" IS NOT NULL
    UNION
    SELECT DISTINCT "merchantId", "customerId"
    FROM "VaultAccessRequest"
) AS relationship
WHERE NOT EXISTS (
    SELECT 1
    FROM "MerchantCustomerLink" AS existing
    WHERE existing."merchantId" = relationship."merchantId"
      AND existing."customerId" = relationship."customerId"
);

INSERT INTO "MerchantCounterparty" (
    "id", "merchantId", "companyName", "contactName", "phone", "email",
    "country", "city", "address", "vatNumber", "notes", "createdAt", "updatedAt"
)
SELECT
    md5('merchant-customer-link:' || link."id"),
    link."merchantId",
    customer."companyName",
    customer."contactPerson",
    customer."phone",
    customer."email",
    customer."country",
    customer."city",
    customer."address",
    customer."vatNumber",
    link."notes",
    link."createdAt",
    CURRENT_TIMESTAMP
FROM "MerchantCustomerLink" AS link
JOIN "Customer" AS customer ON customer."id" = link."customerId";

UPDATE "MerchantCustomerLink" AS link
SET "counterpartyId" = md5('merchant-customer-link:' || link."id");

INSERT INTO "MerchantCounterparty" (
    "id", "merchantId", "companyName", "contactName", "phone", "email",
    "country", "notes", "createdAt", "updatedAt"
)
SELECT
    md5('merchant-supplier:' || supplier."id"),
    supplier."merchantId",
    supplier."name",
    supplier."contactName",
    supplier."phone",
    supplier."email",
    supplier."country",
    supplier."notes",
    supplier."createdAt",
    CURRENT_TIMESTAMP
FROM "Supplier" AS supplier;

UPDATE "Supplier" AS supplier
SET "counterpartyId" = md5('merchant-supplier:' || supplier."id");

CREATE UNIQUE INDEX "MerchantCounterparty_id_merchantId_key"
    ON "MerchantCounterparty"("id", "merchantId");
CREATE UNIQUE INDEX "MerchantCustomerLink_counterpartyId_merchantId_key"
    ON "MerchantCustomerLink"("counterpartyId", "merchantId");
CREATE UNIQUE INDEX "Supplier_counterpartyId_merchantId_key"
    ON "Supplier"("counterpartyId", "merchantId");
CREATE INDEX "MerchantCounterparty_merchantId_companyName_idx"
    ON "MerchantCounterparty"("merchantId", "companyName");

ALTER TABLE "MerchantCounterparty"
    ADD CONSTRAINT "MerchantCounterparty_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantCustomerLink"
    ADD CONSTRAINT "MerchantCustomerLink_counterpartyId_merchantId_fkey"
    FOREIGN KEY ("counterpartyId", "merchantId")
    REFERENCES "MerchantCounterparty"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier"
    ADD CONSTRAINT "Supplier_counterpartyId_merchantId_fkey"
    FOREIGN KEY ("counterpartyId", "merchantId")
    REFERENCES "MerchantCounterparty"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

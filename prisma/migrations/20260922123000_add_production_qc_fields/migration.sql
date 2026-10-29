ALTER TABLE "ProductionReport"
  ADD COLUMN "reworkQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "defectReason" TEXT,
  ADD COLUMN "shortageNote" TEXT;

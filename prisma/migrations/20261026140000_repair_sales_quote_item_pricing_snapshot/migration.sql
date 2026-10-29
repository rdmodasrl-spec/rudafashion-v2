-- Backfill the schema/migration drift: Prisma Client exposes SalesQuoteItem.pricingSnapshot
-- but no migration ever created the column, so inserting a quote item failed at runtime.
ALTER TABLE "SalesQuoteItem"
  ADD COLUMN IF NOT EXISTS "pricingSnapshot" TEXT;

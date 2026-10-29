ALTER TABLE "SalesQuote"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "sentRecipient" VARCHAR(320),
ADD COLUMN "sendProvider" VARCHAR(32),
ADD COLUMN "sendProviderMessageId" VARCHAR(160),
ADD COLUMN "deliveryStatus" VARCHAR(24),
ADD COLUMN "sendTaskId" VARCHAR(160),
ADD COLUMN "sendTraceId" VARCHAR(160),
ADD COLUMN "sendResult" TEXT,
ADD COLUMN "sendFailureReason" TEXT,
ADD COLUMN "sendError" TEXT;

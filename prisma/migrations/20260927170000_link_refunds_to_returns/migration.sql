ALTER TABLE "RefundTransaction"
  ADD COLUMN "returnRequestId" TEXT;

CREATE INDEX "RefundTransaction_returnRequestId_idx"
  ON "RefundTransaction"("returnRequestId");

ALTER TABLE "RefundTransaction"
  ADD CONSTRAINT "RefundTransaction_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

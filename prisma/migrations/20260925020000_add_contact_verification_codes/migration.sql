CREATE TABLE "ContactVerificationCode" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactVerificationCode_destination_channel_purpose_expiresAt_idx"
ON "ContactVerificationCode"("destination", "channel", "purpose", "expiresAt");

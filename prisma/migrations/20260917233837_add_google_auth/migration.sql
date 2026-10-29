/*
  Warnings:

  - A unique constraint covering the columns `[googleSub]` on the table `AuthAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AuthAccount" ADD COLUMN     "googleSub" TEXT;

-- CreateIndex
CREATE INDEX "AuthAccount_googleSub_idx" ON "AuthAccount"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_googleSub_key" ON "AuthAccount"("googleSub");

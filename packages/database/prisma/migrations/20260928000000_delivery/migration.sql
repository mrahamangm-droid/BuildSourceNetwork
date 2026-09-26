-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "proofNote" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "recipientName" TEXT;

-- CreateIndex
CREATE INDEX "Delivery_status_scheduledAt_idx" ON "Delivery"("status", "scheduledAt");

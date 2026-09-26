CREATE TYPE "SupplierKind" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER');

ALTER TABLE "Organization"
  ADD COLUMN "supplierKind" "SupplierKind",
  ADD COLUMN "leadTimeDays" INTEGER,
  ADD COLUMN "minOrderNote" TEXT,
  ADD COLUMN "capacityNote" TEXT,
  ADD COLUMN "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_leadTimeDays_range"
  CHECK ("leadTimeDays" IS NULL OR ("leadTimeDays" >= 0 AND "leadTimeDays" <= 365));

CREATE INDEX "Organization_supplierKind_isActive_idx" ON "Organization"("supplierKind", "isActive");

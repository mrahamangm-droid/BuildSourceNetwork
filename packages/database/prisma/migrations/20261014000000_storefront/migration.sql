ALTER TABLE "Organization" ADD COLUMN "tagline" TEXT, ADD COLUMN "policies" TEXT;
ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_orgId_isFeatured_idx" ON "Product"("orgId", "isFeatured");

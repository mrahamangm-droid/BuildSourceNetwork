-- Volume price breaks: a larger quantity unlocks a lower unit price.
CREATE TABLE "PriceBreak" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceBreak_productId_minQty_key" ON "PriceBreak"("productId", "minQty");
CREATE INDEX "PriceBreak_productId_idx" ON "PriceBreak"("productId");

ALTER TABLE "PriceBreak" ADD CONSTRAINT "PriceBreak_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safety net behind the application-level validation.
ALTER TABLE "PriceBreak" ADD CONSTRAINT "PriceBreak_positive_check"
    CHECK ("minQty" > 0 AND "price" > 0);

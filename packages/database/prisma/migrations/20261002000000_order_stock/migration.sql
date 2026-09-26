-- Link order lines to the supplier's products so stock can be reserved, issued and released per order.
CREATE TYPE "OrderStockState" AS ENUM ('NONE', 'RESERVED', 'ISSUED', 'RELEASED');

ALTER TABLE "OrderItem"
    ADD COLUMN "productId" TEXT,
    ADD COLUMN "stockWarehouseId" TEXT,
    ADD COLUMN "stockState" "OrderStockState" NOT NULL DEFAULT 'NONE';

CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

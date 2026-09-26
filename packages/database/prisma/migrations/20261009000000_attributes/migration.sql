-- Manufacturers, brand ownership and structured product attributes. Additive only.
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "website" TEXT,
    "description" TEXT,
    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Manufacturer_slug_key" ON "Manufacturer"("slug");

ALTER TABLE "Brand" ADD COLUMN "manufacturerId" TEXT;
CREATE INDEX "Brand_manufacturerId_idx" ON "Brand"("manufacturerId");
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "manufacturerId" TEXT,
ADD COLUMN "material" TEXT,
ADD COLUMN "grade" TEXT,
ADD COLUMN "size" TEXT,
ADD COLUMN "dimensions" TEXT,
ADD COLUMN "color" TEXT,
ADD COLUMN "finish" TEXT,
ADD COLUMN "application" TEXT,
ADD COLUMN "countryOfOrigin" TEXT;
CREATE INDEX "Product_manufacturerId_isActive_idx" ON "Product"("manufacturerId", "isActive");
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

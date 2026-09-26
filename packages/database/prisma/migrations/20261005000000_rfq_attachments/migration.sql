CREATE TABLE "RfqAttachment" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RfqAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RfqAttachment_size_range" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 4194304)
);

CREATE UNIQUE INDEX "RfqAttachment_storageKey_key" ON "RfqAttachment"("storageKey");
CREATE INDEX "RfqAttachment_rfqId_idx" ON "RfqAttachment"("rfqId");

ALTER TABLE "RfqAttachment" ADD CONSTRAINT "RfqAttachment_rfqId_fkey"
    FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

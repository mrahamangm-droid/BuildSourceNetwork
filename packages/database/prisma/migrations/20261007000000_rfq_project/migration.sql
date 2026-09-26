-- Link an RFQ to the project (BOQ) it was raised from, so a project can show its whole
-- procurement trail: RFQs -> quotes -> orders -> delivery. Nullable and additive: existing RFQs stay unlinked.
ALTER TABLE "Rfq" ADD COLUMN "projectId" TEXT;

CREATE INDEX "Rfq_projectId_idx" ON "Rfq"("projectId");

ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

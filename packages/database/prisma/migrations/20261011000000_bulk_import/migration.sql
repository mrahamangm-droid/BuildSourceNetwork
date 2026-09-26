-- Bulk import engine: staged upload jobs and rows. Additive only.
CREATE TYPE "ImportMode" AS ENUM ('CREATE', 'UPSERT', 'UPDATE');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADING', 'VALIDATING', 'READY', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED', 'ROLLING_BACK', 'ROLLED_BACK');
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'CREATED', 'UPDATED', 'FAILED', 'ROLLED_BACK', 'SKIPPED');

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRODUCTS',
    "filename" TEXT NOT NULL,
    "mode" "ImportMode" NOT NULL DEFAULT 'CREATE',
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADING',
    "headers" JSONB NOT NULL,
    "columnMap" JSONB NOT NULL,
    "options" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportJob_orgId_createdAt_idx" ON "ImportJob"("orgId", "createdAt");
CREATE INDEX "ImportJob_status_updatedAt_idx" ON "ImportJob"("status", "updatedAt");
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "action" TEXT,
    "raw" JSONB,
    "values" JSONB,
    "errors" JSONB,
    "warnings" JSONB,
    "dupKey" TEXT,
    "productId" TEXT,
    "before" JSONB,
    "message" TEXT,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportRow_jobId_rowNumber_key" ON "ImportRow"("jobId", "rowNumber");
CREATE INDEX "ImportRow_jobId_status_rowNumber_idx" ON "ImportRow"("jobId", "status", "rowNumber");
CREATE INDEX "ImportRow_jobId_dupKey_idx" ON "ImportRow"("jobId", "dupKey");
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Projects and bill of quantities (BOQ) for contractors and buyers.
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED');

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "city" TEXT,
    "startDate" TIMESTAMP(3),
    "budget" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unitRate" DECIMAL(14,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_orgId_status_idx" ON "Project"("orgId", "status");
CREATE INDEX "BoqItem_projectId_sortOrder_idx" ON "BoqItem"("projectId", "sortOrder");
CREATE INDEX "BoqItem_orgId_idx" ON "BoqItem"("orgId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safety net behind application validation.
ALTER TABLE "Project" ADD CONSTRAINT "Project_budget_check" CHECK ("budget" IS NULL OR "budget" >= 0);
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_values_check" CHECK (
    "quantity" > 0
    AND "wastePercent" >= 0 AND "wastePercent" <= 100
    AND ("unitRate" IS NULL OR "unitRate" >= 0)
);

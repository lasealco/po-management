-- SRM: per-supplier onboarding checklist (default rows created on first load + seed).

CREATE TYPE "SupplierOnboardingTaskStatus" AS ENUM ('pending', 'done', 'waived');

CREATE TABLE "SupplierOnboardingTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "taskKey" VARCHAR(64) NOT NULL,
    "label" VARCHAR(256) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SupplierOnboardingTaskStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOnboardingTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierOnboardingTask_supplierId_taskKey_key" ON "SupplierOnboardingTask"("supplierId", "taskKey");

CREATE INDEX "SupplierOnboardingTask_tenantId_supplierId_idx" ON "SupplierOnboardingTask"("tenantId", "supplierId");

ALTER TABLE "SupplierOnboardingTask" ADD CONSTRAINT "SupplierOnboardingTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierOnboardingTask" ADD CONSTRAINT "SupplierOnboardingTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SupplierOnboardingTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "taskKey" VARCHAR(64) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "assigneeUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierOnboardingTask_tenantId_supplierId_idx" ON "SupplierOnboardingTask"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierOnboardingTask_tenantId_assigneeUserId_idx" ON "SupplierOnboardingTask"("tenantId", "assigneeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOnboardingTask_supplierId_taskKey_key" ON "SupplierOnboardingTask"("supplierId", "taskKey");

-- AddForeignKey
ALTER TABLE "SupplierOnboardingTask" ADD CONSTRAINT "SupplierOnboardingTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOnboardingTask" ADD CONSTRAINT "SupplierOnboardingTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOnboardingTask" ADD CONSTRAINT "SupplierOnboardingTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

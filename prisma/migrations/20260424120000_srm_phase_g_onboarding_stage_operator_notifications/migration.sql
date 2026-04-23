-- SRM Phase G (post-MVP): operator onboarding stage + in-app notification rows.
-- Rollback: ALTER TABLE "Supplier" DROP COLUMN "srmOnboardingStage";
--           DROP TABLE "SrmOperatorNotification";
--           DROP TYPE "SrmOnboardingStage";

CREATE TYPE "SrmOnboardingStage" AS ENUM ('intake', 'diligence', 'review', 'cleared');

ALTER TABLE "Supplier" ADD COLUMN "srmOnboardingStage" "SrmOnboardingStage" NOT NULL DEFAULT 'intake';

CREATE TABLE "SrmOperatorNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "taskId" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SrmOperatorNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SrmOperatorNotification_tenantId_userId_readAt_idx" ON "SrmOperatorNotification"("tenantId", "userId", "readAt");
CREATE INDEX "SrmOperatorNotification_tenantId_userId_createdAt_idx" ON "SrmOperatorNotification"("tenantId", "userId", "createdAt");

ALTER TABLE "SrmOperatorNotification" ADD CONSTRAINT "SrmOperatorNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmOperatorNotification" ADD CONSTRAINT "SrmOperatorNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrmOperatorNotification" ADD CONSTRAINT "SrmOperatorNotification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SrmOperatorNotification" ADD CONSTRAINT "SrmOperatorNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SupplierOnboardingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SrmOperatorNotification" ADD CONSTRAINT "SrmOperatorNotification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

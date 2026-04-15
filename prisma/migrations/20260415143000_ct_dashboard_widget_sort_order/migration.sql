ALTER TABLE "CtDashboardWidget"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "CtDashboardWidget_tenantId_userId_sortOrder_createdAt_idx"
ON "CtDashboardWidget"("tenantId", "userId", "sortOrder", "createdAt");

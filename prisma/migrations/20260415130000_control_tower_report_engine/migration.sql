-- Control Tower report engine (saved reports + dashboard widgets)

CREATE TABLE "CtSavedReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "configJson" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CtSavedReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CtDashboardWidget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedReportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "layoutJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CtDashboardWidget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtSavedReport_tenantId_userId_createdAt_idx" ON "CtSavedReport"("tenantId", "userId", "createdAt");
CREATE INDEX "CtSavedReport_tenantId_isShared_createdAt_idx" ON "CtSavedReport"("tenantId", "isShared", "createdAt");
CREATE INDEX "CtDashboardWidget_tenantId_userId_createdAt_idx" ON "CtDashboardWidget"("tenantId", "userId", "createdAt");
CREATE INDEX "CtDashboardWidget_savedReportId_idx" ON "CtDashboardWidget"("savedReportId");

ALTER TABLE "CtSavedReport"
ADD CONSTRAINT "CtSavedReport_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CtSavedReport"
ADD CONSTRAINT "CtSavedReport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CtDashboardWidget"
ADD CONSTRAINT "CtDashboardWidget_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CtDashboardWidget"
ADD CONSTRAINT "CtDashboardWidget_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CtDashboardWidget"
ADD CONSTRAINT "CtDashboardWidget_savedReportId_fkey"
FOREIGN KEY ("savedReportId") REFERENCES "CtSavedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

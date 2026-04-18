-- Control Tower: optional email delivery schedule for saved CT reports (cron-driven).

CREATE TYPE "CtReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "CtReportSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedReportId" TEXT NOT NULL,
    "recipientEmail" VARCHAR(320) NOT NULL,
    "frequency" "CtReportScheduleFrequency" NOT NULL,
    "hourUtc" INTEGER NOT NULL,
    "dayOfWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtReportSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CtReportSchedule_hourUtc_range" CHECK ("hourUtc" >= 0 AND "hourUtc" <= 23),
    CONSTRAINT "CtReportSchedule_weekly_day" CHECK (
        ("frequency" = 'WEEKLY'::"CtReportScheduleFrequency" AND "dayOfWeek" IS NOT NULL AND "dayOfWeek" >= 0 AND "dayOfWeek" <= 6)
        OR ("frequency" = 'DAILY'::"CtReportScheduleFrequency" AND "dayOfWeek" IS NULL)
    )
);

CREATE INDEX "CtReportSchedule_tenantId_isActive_hourUtc_idx" ON "CtReportSchedule"("tenantId", "isActive", "hourUtc");

ALTER TABLE "CtReportSchedule" ADD CONSTRAINT "CtReportSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtReportSchedule" ADD CONSTRAINT "CtReportSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtReportSchedule" ADD CONSTRAINT "CtReportSchedule_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "CtSavedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

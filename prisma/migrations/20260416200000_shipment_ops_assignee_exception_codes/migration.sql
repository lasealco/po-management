-- Control Tower: primary ops assignee on shipment; tenant exception type catalog.

ALTER TABLE "Shipment" ADD COLUMN "opsAssigneeUserId" TEXT;
CREATE INDEX "Shipment_opsAssigneeUserId_idx" ON "Shipment"("opsAssigneeUserId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_opsAssigneeUserId_fkey" FOREIGN KEY ("opsAssigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CtExceptionCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "defaultSeverity" "CtAlertSeverity" NOT NULL DEFAULT 'WARN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtExceptionCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CtExceptionCode_tenantId_code_key" ON "CtExceptionCode"("tenantId", "code");
CREATE INDEX "CtExceptionCode_tenantId_isActive_idx" ON "CtExceptionCode"("tenantId", "isActive");

ALTER TABLE "CtExceptionCode" ADD CONSTRAINT "CtExceptionCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CtExceptionCode" ("id", "tenantId", "code", "label", "defaultSeverity", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    t."id",
    v."code",
    v."label",
    v."defaultSeverity"::"CtAlertSeverity",
    v."sortOrder",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (
    VALUES
        ('DELAY_CARRIER', 'Carrier / airline delay', 'WARN', 10),
        ('DELAY_CUSTOMS', 'Customs hold / clearance delay', 'WARN', 20),
        ('DAMAGE', 'Cargo damage', 'CRITICAL', 30),
        ('SHORTAGE', 'Shortage / OS&D', 'CRITICAL', 40),
        ('DOCS_MISSING', 'Documentation incomplete / rejected', 'WARN', 50),
        ('BOOKING_FAILED', 'Booking or allocation failure', 'CRITICAL', 60),
        ('ROLLED_BOOKING', 'Rolled booking / schedule change', 'INFO', 70),
        ('OTHER', 'Other (describe in root cause)', 'WARN', 999)
) AS v("code", "label", "defaultSeverity", "sortOrder");

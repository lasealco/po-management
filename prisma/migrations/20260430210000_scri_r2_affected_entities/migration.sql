-- SCRI R2: internal exposure links (deterministic matching)

CREATE TABLE "ScriEventAffectedEntity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "objectType" VARCHAR(32) NOT NULL,
  "objectId" TEXT NOT NULL,
  "matchType" VARCHAR(64) NOT NULL,
  "matchConfidence" INTEGER NOT NULL DEFAULT 50,
  "impactLevel" VARCHAR(32),
  "rationale" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScriEventAffectedEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScriEventAffectedEntity_eventId_objectType_objectId_matchType_key"
  ON "ScriEventAffectedEntity"("eventId", "objectType", "objectId", "matchType");

CREATE INDEX "ScriEventAffectedEntity_tenantId_objectType_idx" ON "ScriEventAffectedEntity"("tenantId", "objectType");
CREATE INDEX "ScriEventAffectedEntity_eventId_idx" ON "ScriEventAffectedEntity"("eventId");
CREATE INDEX "ScriEventAffectedEntity_tenantId_eventId_idx" ON "ScriEventAffectedEntity"("tenantId", "eventId");

ALTER TABLE "ScriEventAffectedEntity" ADD CONSTRAINT "ScriEventAffectedEntity_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventAffectedEntity" ADD CONSTRAINT "ScriEventAffectedEntity_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

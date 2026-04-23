-- SCRI R5: rule-based recommendations per event (regenerated after R2 match)

CREATE TYPE "ScriRecommendationStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'SNOOZED');

CREATE TABLE "ScriEventRecommendation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "recommendationType" VARCHAR(64) NOT NULL,
  "targetObjectType" VARCHAR(32),
  "targetObjectId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "confidence" INTEGER NOT NULL DEFAULT 60,
  "expectedEffect" TEXT,
  "status" "ScriRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
  "statusNote" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScriEventRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScriEventRecommendation_eventId_recommendationType_key"
  ON "ScriEventRecommendation"("eventId", "recommendationType");

CREATE INDEX "ScriEventRecommendation_eventId_status_idx" ON "ScriEventRecommendation"("eventId", "status");
CREATE INDEX "ScriEventRecommendation_tenantId_idx" ON "ScriEventRecommendation"("tenantId");

ALTER TABLE "ScriEventRecommendation" ADD CONSTRAINT "ScriEventRecommendation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriEventRecommendation" ADD CONSTRAINT "ScriEventRecommendation_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

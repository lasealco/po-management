-- SCRI R1: external events, sources, geographies (docs/SCRI)

CREATE TYPE "ScriEventReviewState" AS ENUM (
  'NEW',
  'UNDER_REVIEW',
  'WATCH',
  'ACTION_REQUIRED',
  'DISMISSED',
  'RESOLVED'
);

CREATE TABLE "ScriExternalEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ingestKey" VARCHAR(256) NOT NULL,
  "clusterKey" VARCHAR(256),
  "eventType" VARCHAR(64) NOT NULL,
  "title" VARCHAR(512) NOT NULL,
  "shortSummary" TEXT,
  "longSummary" TEXT,
  "eventTime" TIMESTAMP(3),
  "discoveredTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "severity" "TwinRiskSeverity" NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "reviewState" "ScriEventReviewState" NOT NULL DEFAULT 'NEW',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "sourceTrustScore" INTEGER,
  "aiSummary" TEXT,
  "structuredPayload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScriExternalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScriExternalEvent_tenantId_ingestKey_key" ON "ScriExternalEvent"("tenantId", "ingestKey");
CREATE INDEX "ScriExternalEvent_tenantId_discoveredTime_idx" ON "ScriExternalEvent"("tenantId", "discoveredTime");
CREATE INDEX "ScriExternalEvent_tenantId_reviewState_discoveredTime_idx" ON "ScriExternalEvent"("tenantId", "reviewState", "discoveredTime");
CREATE INDEX "ScriExternalEvent_tenantId_severity_idx" ON "ScriExternalEvent"("tenantId", "severity");

ALTER TABLE "ScriExternalEvent" ADD CONSTRAINT "ScriExternalEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScriEventSource" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceType" VARCHAR(64) NOT NULL,
  "publisher" VARCHAR(256),
  "url" VARCHAR(2000),
  "headline" VARCHAR(512),
  "publishedAt" TIMESTAMP(3),
  "extractedText" TEXT,
  "extractionConfidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScriEventSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriEventSource_eventId_idx" ON "ScriEventSource"("eventId");

ALTER TABLE "ScriEventSource" ADD CONSTRAINT "ScriEventSource_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScriEventGeography" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "countryCode" VARCHAR(2),
  "region" VARCHAR(128),
  "portUnloc" VARCHAR(8),
  "label" VARCHAR(256),
  "raw" JSONB,

  CONSTRAINT "ScriEventGeography_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriEventGeography_eventId_idx" ON "ScriEventGeography"("eventId");

ALTER TABLE "ScriEventGeography" ADD CONSTRAINT "ScriEventGeography_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ScriExternalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

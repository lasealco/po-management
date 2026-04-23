-- SCRI Phase G (R7): tenant tuning + watchlist rules
-- SCRI Phase H prep: aggregates use existing tables; no extra H tables in this migration

CREATE TABLE "ScriTenantTuning" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceTrustMin" INTEGER,
  "severityHighlightMin" "TwinRiskSeverity",
  "geoAliases" JSONB NOT NULL DEFAULT '{}',
  "automationAutoWatch" BOOLEAN NOT NULL DEFAULT false,
  "automationMinSeverity" "TwinRiskSeverity" NOT NULL DEFAULT 'MEDIUM',
  "automationActorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScriTenantTuning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScriTenantTuning_tenantId_key" ON "ScriTenantTuning"("tenantId");

CREATE TABLE "ScriWatchlistRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "minSeverity" "TwinRiskSeverity",
  "eventTypes" JSONB NOT NULL DEFAULT '[]',
  "countryCodes" JSONB NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScriWatchlistRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScriWatchlistRule_tenantId_isActive_idx" ON "ScriWatchlistRule"("tenantId", "isActive");

ALTER TABLE "ScriTenantTuning" ADD CONSTRAINT "ScriTenantTuning_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriTenantTuning" ADD CONSTRAINT "ScriTenantTuning_automationActorUserId_fkey"
  FOREIGN KEY ("automationActorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScriWatchlistRule" ADD CONSTRAINT "ScriWatchlistRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

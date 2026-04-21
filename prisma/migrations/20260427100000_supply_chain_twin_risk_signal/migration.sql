-- Supply Chain Twin: risk severity enum + tenant-scoped risk signal rows (Slice 22)

CREATE TYPE "TwinRiskSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "SupplyChainTwinRiskSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "TwinRiskSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyChainTwinRiskSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyChainTwinRiskSignal_tenantId_code_key" ON "SupplyChainTwinRiskSignal"("tenantId", "code");

CREATE INDEX "SupplyChainTwinRiskSignal_tenantId_idx" ON "SupplyChainTwinRiskSignal"("tenantId");

CREATE INDEX "SupplyChainTwinRiskSignal_tenantId_severity_idx" ON "SupplyChainTwinRiskSignal"("tenantId", "severity");

ALTER TABLE "SupplyChainTwinRiskSignal" ADD CONSTRAINT "SupplyChainTwinRiskSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

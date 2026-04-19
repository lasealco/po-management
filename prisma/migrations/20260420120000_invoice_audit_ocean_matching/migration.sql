-- Ocean freight invoice matching: POL/POD, equipment, structure hints, charge alias dictionary

ALTER TABLE "invoice_intakes" ADD COLUMN "polCode" VARCHAR(8);
ALTER TABLE "invoice_intakes" ADD COLUMN "podCode" VARCHAR(8);

ALTER TABLE "invoice_lines" ADD COLUMN "equipmentType" VARCHAR(32);
ALTER TABLE "invoice_lines" ADD COLUMN "chargeStructureHint" VARCHAR(24);

CREATE TABLE "invoice_charge_aliases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "pattern" TEXT NOT NULL,
    "canonicalTokens" JSONB NOT NULL,
    "targetKind" VARCHAR(24),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_charge_aliases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_charge_aliases_tenantId_active_priority_idx" ON "invoice_charge_aliases"("tenantId", "active", "priority");

ALTER TABLE "invoice_charge_aliases" ADD CONSTRAINT "invoice_charge_aliases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

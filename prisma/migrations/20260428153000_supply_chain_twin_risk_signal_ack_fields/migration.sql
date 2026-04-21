-- AlterTable
ALTER TABLE "SupplyChainTwinRiskSignal"
ADD COLUMN "acknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedByActorId" TEXT;

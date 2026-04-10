CREATE TYPE "WmsWaveStatus" AS ENUM ('OPEN', 'RELEASED', 'DONE', 'CANCELLED');

CREATE TABLE "WmsWave" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "waveNo" TEXT NOT NULL,
  "status" "WmsWaveStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WmsWave_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WmsTask" ADD COLUMN "waveId" TEXT;

CREATE UNIQUE INDEX "WmsWave_tenantId_waveNo_key" ON "WmsWave"("tenantId", "waveNo");
CREATE INDEX "WmsWave_tenantId_warehouseId_status_idx" ON "WmsWave"("tenantId", "warehouseId", "status");
CREATE INDEX "WmsTask_waveId_idx" ON "WmsTask"("waveId");

ALTER TABLE "WmsWave"
  ADD CONSTRAINT "WmsWave_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsWave"
  ADD CONSTRAINT "WmsWave_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsWave"
  ADD CONSTRAINT "WmsWave_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_waveId_fkey"
  FOREIGN KEY ("waveId") REFERENCES "WmsWave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

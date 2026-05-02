-- BF-60 — offline scan event batch (idempotent replay + cached response)
CREATE TABLE "WmsScanEventBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientBatchId" VARCHAR(128) NOT NULL,
    "deviceClock" VARCHAR(64) NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastStatusCode" INTEGER NOT NULL,
    "lastResponseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsScanEventBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsScanEventBatch_tenantId_clientBatchId_key" ON "WmsScanEventBatch"("tenantId", "clientBatchId");

CREATE INDEX "WmsScanEventBatch_tenantId_createdAt_idx" ON "WmsScanEventBatch"("tenantId", "createdAt");

ALTER TABLE "WmsScanEventBatch" ADD CONSTRAINT "WmsScanEventBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsScanEventBatch" ADD CONSTRAINT "WmsScanEventBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

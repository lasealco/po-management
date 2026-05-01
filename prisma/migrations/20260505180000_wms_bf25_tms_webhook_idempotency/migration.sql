-- BF-25 — TMS webhook idempotency receipts
CREATE TABLE "WmsTmsWebhookReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalEventId" VARCHAR(128) NOT NULL,
    "dockAppointmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsTmsWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsTmsWebhookReceipt_tenantId_externalEventId_key" ON "WmsTmsWebhookReceipt"("tenantId", "externalEventId");
CREATE INDEX "WmsTmsWebhookReceipt_tenantId_dockAppointmentId_idx" ON "WmsTmsWebhookReceipt"("tenantId", "dockAppointmentId");

ALTER TABLE "WmsTmsWebhookReceipt" ADD CONSTRAINT "WmsTmsWebhookReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

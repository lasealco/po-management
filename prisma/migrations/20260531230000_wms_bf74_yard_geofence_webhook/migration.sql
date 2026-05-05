-- BF-74 — yard geofence webhook idempotency rows (tenant + externalEventId).

CREATE TABLE "WmsYardGeofenceWebhookReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalEventId" VARCHAR(128) NOT NULL,
    "dockAppointmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsYardGeofenceWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsYardGeofenceWebhookReceipt_tenantId_externalEventId_key" ON "WmsYardGeofenceWebhookReceipt"("tenantId", "externalEventId");
CREATE INDEX "WmsYardGeofenceWebhookReceipt_tenantId_dockAppointmentId_idx" ON "WmsYardGeofenceWebhookReceipt"("tenantId", "dockAppointmentId");

ALTER TABLE "WmsYardGeofenceWebhookReceipt" ADD CONSTRAINT "WmsYardGeofenceWebhookReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

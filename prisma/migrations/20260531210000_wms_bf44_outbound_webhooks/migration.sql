-- BF-44 — tenant outbound webhook subscriptions + delivery log (HMAC signing; retry fields stub).

CREATE TYPE "WmsOutboundWebhookEventType" AS ENUM ('RECEIPT_CLOSED', 'OUTBOUND_SHIPPED', 'BILLING_EVENT_DISPUTED');

CREATE TYPE "WmsOutboundWebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

CREATE TABLE "WmsOutboundWebhookSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "signingSecret" VARCHAR(256) NOT NULL,
    "signingSecretSuffix" VARCHAR(4) NOT NULL,
    "eventTypes" "WmsOutboundWebhookEventType"[] NOT NULL DEFAULT ARRAY[]::"WmsOutboundWebhookEventType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsOutboundWebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WmsOutboundWebhookDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(256) NOT NULL,
    "eventType" "WmsOutboundWebhookEventType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "WmsOutboundWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastHttpStatus" INTEGER,
    "lastError" VARCHAR(2000),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsOutboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsOutboundWebhookDelivery_subscriptionId_idempotencyKey_key" ON "WmsOutboundWebhookDelivery"("subscriptionId", "idempotencyKey");

CREATE INDEX "WmsOutboundWebhookDelivery_tenantId_status_nextAttemptAt_idx" ON "WmsOutboundWebhookDelivery"("tenantId", "status", "nextAttemptAt");

CREATE INDEX "WmsOutboundWebhookSubscription_tenantId_isActive_idx" ON "WmsOutboundWebhookSubscription"("tenantId", "isActive");

ALTER TABLE "WmsOutboundWebhookSubscription" ADD CONSTRAINT "WmsOutboundWebhookSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsOutboundWebhookDelivery" ADD CONSTRAINT "WmsOutboundWebhookDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsOutboundWebhookDelivery" ADD CONSTRAINT "WmsOutboundWebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WmsOutboundWebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

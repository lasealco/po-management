/**
 * BF-44 — tenant-configurable outbound webhooks: HMAC-SHA256 body signing (same header shape as BF-25 TMS inbound).
 */

import { createHmac } from "node:crypto";

import { Prisma, type WmsOutboundWebhookEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const WMS_OUTBOUND_WEBHOOK_EVENT_TYPES = [
  "RECEIPT_CLOSED",
  "OUTBOUND_SHIPPED",
  "BILLING_EVENT_DISPUTED",
] as const;

export type WmsOutboundWebhookEventTypeConst = (typeof WMS_OUTBOUND_WEBHOOK_EVENT_TYPES)[number];

/** Exponential backoff stub for future retry workers (caps at 5 minutes). */
export function computeOutboundWebhookBackoffMs(attemptIndex: number): number {
  const base = 2000;
  const cap = 300_000;
  return Math.min(cap, base * 2 ** Math.min(Math.max(0, attemptIndex), 8));
}

/** Lowercase hex digest with `sha256=` prefix (matches {@link verifyTmsWebhookBodySignature} verification). */
export function signOutboundWebhookBody(secret: string, rawBodyUtf8: string): string {
  const hex = createHmac("sha256", secret.trim()).update(rawBodyUtf8, "utf8").digest("hex");
  return `sha256=${hex}`;
}

export function signingSecretSuffixFromSecret(secret: string): string {
  const t = secret.trim();
  if (t.length >= 4) return t.slice(-4);
  return "****";
}

export function assertAllowedOutboundWebhookUrl(urlStr: string): URL {
  const u = new URL(urlStr.trim());
  const hostOk =
    u.hostname === "localhost" ||
    u.hostname === "127.0.0.1" ||
    u.hostname === "[::1]";
  if (u.protocol === "https:") return u;
  if (u.protocol === "http:" && hostOk) return u;
  throw new Error("invalid_webhook_url");
}

export function parseOutboundWebhookEventTypes(raw: unknown): WmsOutboundWebhookEventType[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const allowed = new Set<string>(WMS_OUTBOUND_WEBHOOK_EVENT_TYPES);
  const out: WmsOutboundWebhookEventType[] = [];
  for (const x of raw) {
    const s = String(x).trim().toUpperCase();
    if (allowed.has(s)) out.push(s as WmsOutboundWebhookEventType);
  }
  return [...new Set(out)];
}

export async function emitWmsOutboundWebhooks(
  tenantId: string,
  eventType: WmsOutboundWebhookEventType,
  correlationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const subs = await prisma.wmsOutboundWebhookSubscription.findMany({
    where: {
      tenantId,
      isActive: true,
      eventTypes: { has: eventType },
    },
    select: {
      id: true,
      url: true,
      signingSecret: true,
    },
  });
  if (subs.length === 0) return;

  const occurredAt = new Date().toISOString();
  const idempotencyBase = `${eventType}:${correlationId}`;

  for (const sub of subs) {
    const idempotencyKey = `${idempotencyBase}:${sub.id}`;
    let deliveryId: string;
    try {
      const row = await prisma.wmsOutboundWebhookDelivery.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          idempotencyKey,
          eventType,
          payloadJson: {
            schemaVersion: 1,
            event: eventType,
            occurredAt,
            tenantId,
            idempotencyKey,
            correlationId,
            payload,
          } as Prisma.InputJsonValue,
          status: "PENDING",
          attemptCount: 0,
        },
        select: { id: true },
      });
      deliveryId = row.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue;
      }
      throw e;
    }

    const envelope = {
      schemaVersion: 1,
      event: eventType,
      occurredAt,
      tenantId,
      deliveryId,
      idempotencyKey,
      correlationId,
      payload,
    };
    const rawBody = JSON.stringify(envelope);
    const sig = signOutboundWebhookBody(sub.signingSecret, rawBody);

    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WMS-Webhook-Event": eventType,
          "X-WMS-Webhook-Delivery-Id": deliveryId,
          "X-WMS-Webhook-Signature": sig,
        },
        body: rawBody,
        signal: AbortSignal.timeout(12_000),
      });
      const httpStatus = res.status;
      const backoffMs = computeOutboundWebhookBackoffMs(0);
      if (res.ok) {
        await prisma.wmsOutboundWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "DELIVERED",
            attemptCount: 1,
            lastHttpStatus: httpStatus,
            lastError: null,
            nextAttemptAt: null,
          },
        });
      } else {
        const snippet = (await res.text()).slice(0, 500);
        await prisma.wmsOutboundWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "FAILED",
            attemptCount: 1,
            lastHttpStatus: httpStatus,
            lastError: snippet || `HTTP ${httpStatus}`,
            nextAttemptAt: new Date(Date.now() + backoffMs),
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000);
      const backoffMs = computeOutboundWebhookBackoffMs(0);
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "FAILED",
          attemptCount: 1,
          lastHttpStatus: null,
          lastError: msg,
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
    }
  }
}

export function scheduleEmitWmsOutboundWebhooks(
  tenantId: string,
  eventType: WmsOutboundWebhookEventType,
  correlationId: string,
  payload: Record<string, unknown>,
): void {
  queueMicrotask(() => {
    void emitWmsOutboundWebhooks(tenantId, eventType, correlationId, payload).catch(() => {});
  });
}

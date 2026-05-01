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
  "BILLING_INVOICE_POST_DISPUTED",
  "BILLING_CREDIT_MEMO_STUB_CREATED",
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

/** Single HTTP POST attempt for one delivery (BF-44 emit + BF-45 cron retries). */
export async function postOutboundWebhookDeliveryOnce(
  url: string,
  signingSecret: string,
  eventType: WmsOutboundWebhookEventType,
  deliveryId: string,
  envelope: Record<string, unknown>,
): Promise<{ ok: boolean; httpStatus: number | null; errorText: string | null }> {
  const rawBody = JSON.stringify(envelope);
  const sig = signOutboundWebhookBody(signingSecret, rawBody);
  try {
    const res = await fetch(url, {
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
    if (res.ok) return { ok: true, httpStatus, errorText: null };
    const snippet = (await res.text()).slice(0, 500);
    return { ok: false, httpStatus, errorText: snippet || `HTTP ${httpStatus}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000);
    return { ok: false, httpStatus: null, errorText: msg };
  }
}

/** BF-45 — drain FAILED deliveries whose `nextAttemptAt` has passed (cron). */
export async function retryFailedOutboundWebhookDeliveries(limit = 25): Promise<{
  examined: number;
  retried: number;
  delivered: number;
}> {
  const now = new Date();
  const rows = await prisma.wmsOutboundWebhookDelivery.findMany({
    where: {
      status: "FAILED",
      nextAttemptAt: { lte: now },
      attemptCount: { lt: 8 },
    },
    orderBy: [{ nextAttemptAt: "asc" }],
    take: limit,
    include: {
      subscription: { select: { url: true, signingSecret: true, isActive: true } },
    },
  });

  let retried = 0;
  let delivered = 0;

  for (const d of rows) {
    if (!d.subscription.isActive) {
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: d.id },
        data: {
          nextAttemptAt: null,
          lastError: "subscription_inactive",
        },
      });
      continue;
    }

    const pj = d.payloadJson as Record<string, unknown>;
    const envelope = {
      schemaVersion: 1,
      event: d.eventType,
      occurredAt: pj.occurredAt,
      tenantId: pj.tenantId,
      deliveryId: d.id,
      idempotencyKey: pj.idempotencyKey,
      correlationId: pj.correlationId,
      payload: pj.payload,
    };

    retried++;
    const attemptAfter = d.attemptCount + 1;
    const result = await postOutboundWebhookDeliveryOnce(
      d.subscription.url,
      d.subscription.signingSecret,
      d.eventType,
      d.id,
      envelope,
    );

    if (result.ok) {
      delivered++;
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: d.id },
        data: {
          status: "DELIVERED",
          attemptCount: attemptAfter,
          lastHttpStatus: result.httpStatus,
          lastError: null,
          nextAttemptAt: null,
        },
      });
    } else {
      const backoffMs = computeOutboundWebhookBackoffMs(Math.max(0, attemptAfter - 1));
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: d.id },
        data: {
          status: "FAILED",
          attemptCount: attemptAfter,
          lastHttpStatus: result.httpStatus,
          lastError: result.errorText ?? "unknown",
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
    }
  }

  return { examined: rows.length, retried, delivered };
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

    const result = await postOutboundWebhookDeliveryOnce(
      sub.url,
      sub.signingSecret,
      eventType,
      deliveryId,
      envelope,
    );

    const nextAttemptCount = 1;
    const backoffMs = computeOutboundWebhookBackoffMs(Math.max(0, nextAttemptCount - 1));

    if (result.ok) {
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "DELIVERED",
          attemptCount: nextAttemptCount,
          lastHttpStatus: result.httpStatus,
          lastError: null,
          nextAttemptAt: null,
        },
      });
    } else {
      await prisma.wmsOutboundWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "FAILED",
          attemptCount: nextAttemptCount,
          lastHttpStatus: result.httpStatus,
          lastError: result.errorText ?? "unknown",
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

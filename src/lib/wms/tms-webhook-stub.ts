import { createHmac, timingSafeEqual } from "node:crypto";

import { DOCK_TMS_LIMITS, parseDockYardMilestone } from "./dock-appointment";

const EXTERNAL_EVENT_ID_MAX = 128;

/** Bearer compare using timing-safe equality when lengths match. */
export function verifyTmsWebhookBearer(authHeader: string | null | undefined, secret: string): boolean {
  const prefix = "Bearer ";
  if (!authHeader?.startsWith(prefix)) return false;
  const token = authHeader.slice(prefix.length).trim();
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * BF-25 — HMAC-SHA256 over the raw webhook body (UTF-8 string).
 * Header format: `sha256=<64 lowercase hex>` (prefix optional case-sensitive only on literal `sha256=`).
 */
export function verifyTmsWebhookBodySignature(
  signatureHeader: string | null | undefined,
  rawBodyUtf8: string,
  hmacSecret: string,
): boolean {
  const trimmedSecret = hmacSecret.trim();
  if (!trimmedSecret) return false;
  const header = signatureHeader?.trim();
  if (!header) return false;
  const hexPart = header.toLowerCase().startsWith("sha256=") ? header.slice(7).trim().toLowerCase() : header.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hexPart)) return false;
  const expectedHex = createHmac("sha256", trimmedSecret).update(rawBodyUtf8, "utf8").digest("hex");
  const a = Buffer.from(hexPart, "hex");
  const b = Buffer.from(expectedHex, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type ParsedTmsWebhookPayload = {
  dockAppointmentId: string;
  tenantSlug: string;
  externalEventId?: string;
  tmsLoadId: string | null | undefined;
  tmsCarrierBookingRef: string | undefined;
  yardMilestone: ReturnType<typeof parseDockYardMilestone>;
  yardOccurredAt: string | undefined;
};

function trimOpt(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

/** Parses TMS webhook JSON body; returns `null` when invalid (caller maps to 400). */
export function parseTmsWebhookPayload(raw: unknown): ParsedTmsWebhookPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const dockAppointmentId = trimOpt(rec.dockAppointmentId);
  if (!dockAppointmentId) return null;
  const tenantSlugRaw = trimOpt(rec.tenantSlug);
  const tenantSlug = tenantSlugRaw ?? "demo-company";

  let tmsLoadId: string | null | undefined = undefined;
  if ("tmsLoadId" in rec) {
    if (rec.tmsLoadId === null) tmsLoadId = null;
    else {
      const s = trimOpt(rec.tmsLoadId);
      tmsLoadId = s ? s.slice(0, DOCK_TMS_LIMITS.tmsLoadId) : null;
    }
  }

  let tmsCarrierBookingRef: string | undefined = undefined;
  if ("tmsCarrierBookingRef" in rec) {
    if (rec.tmsCarrierBookingRef === null) tmsCarrierBookingRef = "";
    else {
      const s = trimOpt(rec.tmsCarrierBookingRef);
      tmsCarrierBookingRef = s ? s.slice(0, DOCK_TMS_LIMITS.tmsCarrierBookingRef) : "";
    }
  }

  const yardMilestone = parseDockYardMilestone(rec.yardMilestone);
  const yardOccurredAt = trimOpt(rec.yardOccurredAt);

  let externalEventId: string | undefined;
  const rawEvt = trimOpt(rec.externalEventId);
  if (rawEvt) {
    externalEventId = rawEvt.slice(0, EXTERNAL_EVENT_ID_MAX);
  }

  return {
    dockAppointmentId,
    tenantSlug,
    externalEventId,
    tmsLoadId,
    tmsCarrierBookingRef,
    yardMilestone,
    yardOccurredAt,
  };
}

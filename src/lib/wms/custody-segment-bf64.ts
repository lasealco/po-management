/**
 * BF-64 — cold-chain custody segment JSON on `InventoryMovement` / `Shipment`.
 * Documented shape (all optional): minTempC, maxTempC, probeTempC, breached | breach, segmentLabel, note.
 * IoT SDK / probes are out of scope; operators or integrations POST JSON via WMS actions.
 */

import { Prisma } from "@prisma/client";

export const CUSTODY_SEGMENT_JSON_MAX_BYTES = 8192;

export type CustodySegmentParseResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.InputJsonValue }
  | { ok: false; message: string };

/** `undefined` → omit field; `null` → clear; object → set (validated size + plain object). */
export function parseCustodySegmentJsonForPatch(raw: unknown): CustodySegmentParseResult {
  if (raw === undefined) {
    return { ok: true, mode: "omit" };
  }
  if (raw === null) {
    return { ok: true, mode: "clear" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "custodySegmentJson must be a JSON object or null." };
  }
  const str = JSON.stringify(raw);
  if (str.length > CUSTODY_SEGMENT_JSON_MAX_BYTES) {
    return {
      ok: false,
      message: `custodySegmentJson must serialize to at most ${CUSTODY_SEGMENT_JSON_MAX_BYTES} bytes.`,
    };
  }
  return { ok: true, mode: "set", value: raw as Prisma.InputJsonValue };
}

export function custodySegmentIndicatesBreach(obj: unknown): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj as Record<string, unknown>;
  if (r.breached === true || r.breach === true) return true;
  const min = r.minTempC;
  const max = r.maxTempC;
  const probe = r.probeTempC;
  if (typeof min === "number" && typeof max === "number" && typeof probe === "number") {
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(probe)) return false;
    if (probe < min || probe > max) return true;
  }
  return false;
}

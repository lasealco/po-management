/**
 * BF-67 — multi-parcel shipment manifest JSON (vendor-neutral export + validation).
 */

import type { Prisma } from "@prisma/client";

export const OUTBOUND_MANIFEST_SCHEMA_VERSION = "bf67.v1" as const;

export const BF67_MAX_MANIFEST_PARCELS = 50;
export const BF67_MAX_TRACKING_ID_LEN = 128;

/** Normalize persisted JSON to a string list (legacy / bad rows → []). */
export function manifestParcelIdsFromDbJson(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t) out.push(t);
  }
  return out;
}

export function parseManifestParcelIdsInput(
  raw: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "manifestParcelIds required (array of strings)." };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "manifestParcelIds must be an array." };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, error: "Each manifest parcel id must be a string." };
    }
    const t = item.trim();
    if (!t) continue;
    if (t.length > BF67_MAX_TRACKING_ID_LEN) {
      return { ok: false, error: `Parcel tracking id exceeds ${BF67_MAX_TRACKING_ID_LEN} characters.` };
    }
    const key = t.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: "Duplicate parcel tracking id in list." };
    }
    seen.add(key);
    ids.push(t);
  }
  if (ids.length > BF67_MAX_MANIFEST_PARCELS) {
    return { ok: false, error: `At most ${BF67_MAX_MANIFEST_PARCELS} parcel tracking ids allowed.` };
  }
  return { ok: true, ids };
}

function dedupeTrackingPreserveOrder(primary: string | null, manifest: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (primary) {
    const k = primary.toLowerCase();
    seen.add(k);
    out.push(primary);
  }
  for (const t of manifest) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export type OutboundManifestExportV1 = {
  schemaVersion: typeof OUTBOUND_MANIFEST_SCHEMA_VERSION;
  generatedAt: string;
  outbound: {
    id: string;
    outboundNo: string;
    status: string;
    customerRef: string | null;
    asnReference: string | null;
    /** BF-39 primary label tracking when purchased separately. */
    primaryCarrierTrackingNo: string | null;
    carrierLabelAdapterId: string | null;
    carrierLabelPurchasedAt: string | null;
    manifestParcelIds: string[];
    /** Primary label (if any) then manifest ids, deduped case-insensitive. */
    allTrackingNumbers: string[];
  };
  shipTo: {
    name: string | null;
    line1: string | null;
    city: string | null;
    countryCode: string | null;
  };
  warehouse: {
    code: string | null;
    name: string;
  };
  logisticsUnits: Array<{
    id: string;
    scanCode: string;
    kind: string;
    parentUnitId: string | null;
    outboundOrderLineId: string | null;
  }>;
  methodology: string;
};

export type OutboundManifestPrismaRow = {
  id: string;
  outboundNo: string;
  status: string;
  customerRef: string | null;
  asnReference: string | null;
  shipToName: string | null;
  shipToLine1: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  carrierTrackingNo: string | null;
  carrierLabelAdapterId: string | null;
  carrierLabelPurchasedAt: Date | null;
  manifestParcelIds: Prisma.JsonValue | null;
  warehouse: { code: string | null; name: string };
  logisticsUnits: Array<{
    id: string;
    scanCode: string;
    kind: string;
    parentUnitId: string | null;
    outboundOrderLineId: string | null;
  }>;
};

export function buildOutboundManifestExportV1(
  order: OutboundManifestPrismaRow,
  generatedAt: Date,
): OutboundManifestExportV1 {
  const manifestParcelIds = manifestParcelIdsFromDbJson(order.manifestParcelIds);
  const primary = order.carrierTrackingNo?.trim() || null;
  return {
    schemaVersion: OUTBOUND_MANIFEST_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    outbound: {
      id: order.id,
      outboundNo: order.outboundNo,
      status: order.status,
      customerRef: order.customerRef,
      asnReference: order.asnReference,
      primaryCarrierTrackingNo: primary,
      carrierLabelAdapterId: order.carrierLabelAdapterId,
      carrierLabelPurchasedAt: order.carrierLabelPurchasedAt?.toISOString() ?? null,
      manifestParcelIds,
      allTrackingNumbers: dedupeTrackingPreserveOrder(primary, manifestParcelIds),
    },
    shipTo: {
      name: order.shipToName,
      line1: order.shipToLine1,
      city: order.shipToCity,
      countryCode: order.shipToCountryCode,
    },
    warehouse: {
      code: order.warehouse.code,
      name: order.warehouse.name,
    },
    logisticsUnits: order.logisticsUnits.map((u) => ({
      id: u.id,
      scanCode: u.scanCode,
      kind: u.kind,
      parentUnitId: u.parentUnitId,
      outboundOrderLineId: u.outboundOrderLineId,
    })),
    methodology:
      "BF-67 minimal manifest: JSON handoff for multi-parcel bags; primary carrier label (BF-39) merged into allTrackingNumbers when not duplicated.",
  };
}

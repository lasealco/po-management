/**
 * BF-65 — structured damage reports + carrier claim JSON export stub.
 * See `docs/wms/WMS_DAMAGE_CLAIM_BF65.md`.
 */

import { Prisma } from "@prisma/client";

export const DAMAGE_PHOTO_URL_MAX = 12;
export const DAMAGE_PHOTO_URL_MAX_LEN = 2048;
export const DAMAGE_DESCRIPTION_MAX = 4000;
export const DAMAGE_CATEGORY_MAX = 128;
export const DAMAGE_CARRIER_CLAIM_REF_MAX = 256;
export const DAMAGE_EXTRA_DETAIL_JSON_MAX_BYTES = 8192;

export type ParsePhotoUrlsResult =
  | { ok: true; urls: string[] }
  | { ok: false; message: string };

/** Accept `string[]` or newline / comma separated string; normalize https URLs and relative paths. */
export function parseDamagePhotoUrlsForCreate(raw: unknown): ParsePhotoUrlsResult {
  let list: unknown[] = [];
  if (raw === undefined || raw === null) {
    list = [];
  } else if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    list = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    return { ok: false, message: "damagePhotoUrls must be an array of strings or omitted." };
  }

  const urls: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      return { ok: false, message: "Each damage photo URL must be a string." };
    }
    const u = item.trim();
    if (!u) continue;
    if (u.length > DAMAGE_PHOTO_URL_MAX_LEN) {
      return {
        ok: false,
        message: `Each photo URL must be at most ${DAMAGE_PHOTO_URL_MAX_LEN} characters.`,
      };
    }
    const lower = u.toLowerCase();
    if (lower.startsWith("https://") || lower.startsWith("http://") || u.startsWith("/")) {
      urls.push(u);
    } else {
      return {
        ok: false,
        message: "Photo URLs must start with http://, https://, or / (relative path).",
      };
    }
    if (urls.length > DAMAGE_PHOTO_URL_MAX) {
      return {
        ok: false,
        message: `At most ${DAMAGE_PHOTO_URL_MAX} photo URLs.`,
      };
    }
  }
  return { ok: true, urls };
}

export type ParseExtraDetailResult =
  | { ok: true; value: Prisma.InputJsonValue | null }
  | { ok: false; message: string };

/** `null` clears; plain object sets; arrays / primitives rejected. */
export function parseDamageExtraDetailJson(raw: unknown): ParseExtraDetailResult {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "damageExtraDetailJson must be a JSON object or null." };
  }
  const str = JSON.stringify(raw);
  if (str.length > DAMAGE_EXTRA_DETAIL_JSON_MAX_BYTES) {
    return {
      ok: false,
      message: `damageExtraDetailJson must serialize to at most ${DAMAGE_EXTRA_DETAIL_JSON_MAX_BYTES} bytes.`,
    };
  }
  return { ok: true, value: raw as Prisma.InputJsonValue };
}

export const DAMAGE_CLAIM_EXPORT_SCHEMA_VERSION = "bf65.v1" as const;

export type DamageClaimShipmentSummary = {
  id: string;
  shipmentNo: string | null;
  asnReference: string | null;
  carrier: string | null;
  trackingNo: string | null;
  purchaseOrder: { id: string; orderNumber: string } | null;
  lineCount: number;
};

export type DamageClaimOutboundSummary = {
  id: string;
  outboundNo: string;
  asnReference: string | null;
  status: string;
  carrierTrackingNo: string | null;
  shipToName: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  warehouse: { code: string | null; name: string } | null;
  lineCount: number;
};

export function buildCarrierClaimExportV1(args: {
  generatedAt: Date;
  report: {
    id: string;
    context: string;
    status: string;
    damageCategory: string | null;
    description: string | null;
    photoUrls: string[];
    extraDetail: unknown | null;
    carrierClaimReference: string | null;
    shipmentItemId: string | null;
    createdAt: Date;
  };
  inboundShipment: DamageClaimShipmentSummary | null;
  outboundOrder: DamageClaimOutboundSummary | null;
}): Record<string, unknown> {
  const parts: string[] = [];
  parts.push(`Damage report ${args.report.id}`);
  parts.push(`Context: ${args.report.context}`);
  if (args.report.damageCategory) parts.push(`Category: ${args.report.damageCategory}`);
  if (args.inboundShipment) {
    parts.push(
      `Inbound shipment ${args.inboundShipment.shipmentNo ?? args.inboundShipment.id} (PO ${args.inboundShipment.purchaseOrder?.orderNumber ?? "—"})`,
    );
    if (args.inboundShipment.carrier) parts.push(`Carrier: ${args.inboundShipment.carrier}`);
    if (args.inboundShipment.trackingNo) parts.push(`Tracking: ${args.inboundShipment.trackingNo}`);
  }
  if (args.outboundOrder) {
    parts.push(`Outbound ${args.outboundOrder.outboundNo}`);
    if (args.outboundOrder.carrierTrackingNo) {
      parts.push(`Tracking: ${args.outboundOrder.carrierTrackingNo}`);
    }
  }
  if (args.report.description) parts.push(`Description: ${args.report.description}`);
  if (args.report.photoUrls.length > 0) {
    parts.push(`Photos (${args.report.photoUrls.length}): ${args.report.photoUrls.join("; ")}`);
  }

  return {
    schemaVersion: DAMAGE_CLAIM_EXPORT_SCHEMA_VERSION,
    generatedAt: args.generatedAt.toISOString(),
    damageReport: {
      id: args.report.id,
      context: args.report.context,
      status: args.report.status,
      damageCategory: args.report.damageCategory,
      description: args.report.description,
      photoUrls: args.report.photoUrls,
      extraDetail: args.report.extraDetail,
      carrierClaimReference: args.report.carrierClaimReference,
      shipmentItemId: args.report.shipmentItemId,
      createdAt: args.report.createdAt.toISOString(),
    },
    inboundShipment: args.inboundShipment,
    outboundOrder: args.outboundOrder,
    claimNarrative: parts.join("\n"),
  };
}

import type { TariffTransportMode } from "@prisma/client";

import { normalizeEquipmentType } from "@/lib/tariff/rating-engine";
import { TARIFF_TRANSPORT_MODE_SET } from "@/lib/tariff/tariff-enum-sets";

/** Parsed body for POST `/api/tariffs/rate` (operational lane rating). */
export type ParsedTariffLaneRatePostBody = {
  pol: string;
  pod: string;
  equipment: string;
  transportMode: TariffTransportMode;
  asOf: Date;
  providerIds?: string[];
  maxResults?: number;
};

function parseAsOfDate(s: string): Date | null {
  const d = new Date(`${s.trim()}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseTariffLaneRatePostBody(body: unknown):
  | { ok: true; value: ParsedTariffLaneRatePostBody }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected object body." };
  }
  const o = body as Record<string, unknown>;

  const pol = typeof o.pol === "string" ? o.pol.trim() : "";
  const pod = typeof o.pod === "string" ? o.pod.trim() : "";
  const equipmentRaw = typeof o.equipment === "string" && o.equipment.trim() ? o.equipment : "40HC";
  const modeRaw =
    typeof o.transportMode === "string" && o.transportMode.trim()
      ? o.transportMode.trim().toUpperCase()
      : "OCEAN";

  if (!pol || !pod) {
    return { ok: false, error: "pol and pod are required." };
  }
  if (!TARIFF_TRANSPORT_MODE_SET.has(modeRaw)) {
    return { ok: false, error: "Invalid transportMode." };
  }
  const transportMode = modeRaw as TariffTransportMode;

  const asOfStr =
    typeof o.asOf === "string" && o.asOf.trim() ? o.asOf.trim() : new Date().toISOString().slice(0, 10);
  const asOf = parseAsOfDate(asOfStr);
  if (!asOf) {
    return { ok: false, error: "Invalid asOf date." };
  }

  if (o.providerIds != null && !Array.isArray(o.providerIds)) {
    return { ok: false, error: "providerIds must be an array of strings when provided." };
  }
  const providerIds = Array.isArray(o.providerIds)
    ? o.providerIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : undefined;

  let maxResults: number | undefined;
  if (o.maxResults !== undefined && o.maxResults !== null) {
    if (typeof o.maxResults !== "number" || !Number.isFinite(o.maxResults)) {
      return { ok: false, error: "maxResults must be a finite number when provided." };
    }
    maxResults = Math.min(Math.max(Math.floor(o.maxResults), 1), 50);
  }

  return {
    ok: true,
    value: {
      pol,
      pod,
      equipment: normalizeEquipmentType(equipmentRaw),
      transportMode,
      asOf,
      providerIds,
      maxResults,
    },
  };
}

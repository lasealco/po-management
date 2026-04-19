import type { Prisma } from "@prisma/client";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import { parseEquipmentFromText } from "@/lib/invoice-audit/ocean-equipment";

export type SnapshotPriceCandidate = {
  kind: "CONTRACT_RATE" | "CONTRACT_CHARGE" | "RFQ_LINE";
  id: string;
  label: string;
  currency: string;
  amount: number;
  raw: Prisma.JsonValue;
  /** Rate equipment type or charge equipment scope text, for equipment-aware scoring. */
  equipmentHint: string | null;
  unitBasis: string | null;
  originCode: string | null;
  destCode: string | null;
  isIncluded: boolean | null;
  isMandatory: boolean | null;
  rateType: string | null;
};

/** Unique POL/POD codes appearing on contract FCL rates (for snapshot audit demos). */
export function summarizeContractGeographyFromCandidates(
  candidates: SnapshotPriceCandidate[],
): { polCodes: string[]; podCodes: string[] } | null {
  const rates = candidates.filter((c) => c.kind === "CONTRACT_RATE");
  if (rates.length === 0) return null;
  const pol = new Set<string>();
  const pod = new Set<string>();
  for (const r of rates) {
    if (r.originCode) pol.add(r.originCode);
    if (r.destCode) pod.add(r.destCode);
  }
  if (pol.size === 0 && pod.size === 0) return null;
  return { polCodes: [...pol].sort(), podCodes: [...pod].sort() };
}

/** First UN/LOCODE parsed from RFQ quoteRequest origin/destination labels (invoice POL/POD hints). */
export type RfqRouteLocodes = { pol: string | null; pod: string | null };

export type SnapshotCandidatesResult =
  | {
      ok: true;
      candidates: SnapshotPriceCandidate[];
      sourceType: string;
      rfqGrandTotal: number | null;
      /** Contract snapshot `totals.grand` when present (frozen full stack). */
      contractGrandTotal: number | null;
      /** Set for `QUOTE_RESPONSE` snapshots; `null` for contract snapshots. */
      rfqRouteLocodes: RfqRouteLocodes | null;
    }
  | { ok: false; error: string; category: typeof DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function geoCode(g: unknown): string | null {
  if (!isRecord(g)) return null;
  const c = g.code;
  if (typeof c === "string" && c.trim()) return c.trim().toUpperCase().slice(0, 8);
  return null;
}

/** Best-effort UN/LOCODE (5-letter) from free-text RFQ origin/destination labels. */
function locodeFromFreeText(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const m = s.toUpperCase().match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
  return m?.[1] ?? null;
}

/**
 * Reads frozen `breakdownJson` from a booking pricing snapshot into comparable price lines
 * (ocean-aware fields: equipment, unit basis, POL/POD codes on rates, charge flags).
 */
export function extractSnapshotPriceCandidates(breakdownJson: unknown): SnapshotCandidatesResult {
  if (!isRecord(breakdownJson)) {
    return {
      ok: false,
      error: "Snapshot breakdownJson is not an object — cannot audit.",
      category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
    };
  }
  const sourceType = String(breakdownJson.sourceType ?? "");
  const candidates: SnapshotPriceCandidate[] = [];
  let rfqGrandTotal: number | null = null;
  let contractGrandTotal: number | null = null;

  if (breakdownJson.composite === true && breakdownJson.compositeKind === "MULTI_CONTRACT_VERSION" && Array.isArray(breakdownJson.components)) {
    for (const comp of breakdownJson.components) {
      if (!isRecord(comp)) continue;
      const role = String(comp.role ?? "LEG").trim() || "LEG";
      const rateLines = comp.rateLines;
      if (Array.isArray(rateLines)) {
        for (const row of rateLines) {
          if (!isRecord(row) || typeof row.id !== "string") continue;
          const amount = num(row.amount);
          if (amount == null) continue;
          const cur = typeof row.currency === "string" ? row.currency : "USD";
          const labelParts = [`[${role}]`, String(row.rateType ?? ""), String(row.equipmentType ?? ""), String(row.unitBasis ?? "")].filter(
            (x) => typeof x === "string" && x.trim(),
          );
          const eq = typeof row.equipmentType === "string" ? row.equipmentType.trim() : null;
          candidates.push({
            kind: "CONTRACT_RATE",
            id: row.id,
            label: labelParts.filter(Boolean).join(" ") || `Rate ${row.id.slice(0, 6)}`,
            currency: cur.toUpperCase().slice(0, 3),
            amount,
            raw: row as unknown as Prisma.JsonValue,
            equipmentHint: eq || null,
            unitBasis: typeof row.unitBasis === "string" ? row.unitBasis.trim() : null,
            originCode: geoCode(row.originScope),
            destCode: geoCode(row.destinationScope),
            isIncluded: null,
            isMandatory: null,
            rateType: typeof row.rateType === "string" ? row.rateType.trim() : null,
          });
        }
      }
      const chargeLines = comp.chargeLines;
      if (Array.isArray(chargeLines)) {
        for (const row of chargeLines) {
          if (!isRecord(row) || typeof row.id !== "string") continue;
          const amount = num(row.amount);
          if (amount == null) continue;
          const cur = typeof row.currency === "string" ? row.currency : "USD";
          const labelParts = [`[${role}]`, row.rawChargeName, row.normalizedCode].filter(
            (x) => typeof x === "string" && x.trim(),
          );
          const label =
            labelParts.length > 1 ? labelParts.join(" · ") : `[${role}] · Charge ${String(row.id).slice(0, 6)}`;
          const geo = row.geographyScope;
          candidates.push({
            kind: "CONTRACT_CHARGE",
            id: row.id,
            label,
            currency: cur.toUpperCase().slice(0, 3),
            amount,
            raw: row as unknown as Prisma.JsonValue,
            equipmentHint: typeof row.equipmentScope === "string" ? row.equipmentScope.trim() : null,
            unitBasis: typeof row.unitBasis === "string" ? row.unitBasis.trim() : null,
            originCode: geoCode(geo),
            destCode: null,
            isIncluded: typeof row.isIncluded === "boolean" ? row.isIncluded : null,
            isMandatory: typeof row.isMandatory === "boolean" ? row.isMandatory : null,
            rateType: null,
          });
        }
      }
    }
    const merged = breakdownJson.mergedTotals;
    if (isRecord(merged)) {
      const g = num(merged.grand);
      if (g != null) contractGrandTotal = g;
    }
    return {
      ok: true,
      candidates,
      sourceType: "TARIFF_CONTRACT_VERSION",
      rfqGrandTotal: null,
      contractGrandTotal,
      rfqRouteLocodes: null,
    };
  }

  if (sourceType === "TARIFF_CONTRACT_VERSION") {
    const rateLines = breakdownJson.rateLines;
    if (Array.isArray(rateLines)) {
      for (const row of rateLines) {
        if (!isRecord(row) || typeof row.id !== "string") continue;
        const amount = num(row.amount);
        if (amount == null) continue;
        const cur = typeof row.currency === "string" ? row.currency : "USD";
        const labelParts = [
          String(row.rateType ?? ""),
          String(row.equipmentType ?? ""),
          String(row.unitBasis ?? ""),
        ].filter(Boolean);
        const eq = typeof row.equipmentType === "string" ? row.equipmentType.trim() : null;
        candidates.push({
          kind: "CONTRACT_RATE",
          id: row.id,
          label: labelParts.join(" ") || `Rate ${row.id.slice(0, 6)}`,
          currency: cur.toUpperCase().slice(0, 3),
          amount,
          raw: row as unknown as Prisma.JsonValue,
          equipmentHint: eq || null,
          unitBasis: typeof row.unitBasis === "string" ? row.unitBasis.trim() : null,
          originCode: geoCode(row.originScope),
          destCode: geoCode(row.destinationScope),
          isIncluded: null,
          isMandatory: null,
          rateType: typeof row.rateType === "string" ? row.rateType.trim() : null,
        });
      }
    }
    const chargeLines = breakdownJson.chargeLines;
    if (Array.isArray(chargeLines)) {
      for (const row of chargeLines) {
        if (!isRecord(row) || typeof row.id !== "string") continue;
        const amount = num(row.amount);
        if (amount == null) continue;
        const cur = typeof row.currency === "string" ? row.currency : "USD";
        const labelParts = [row.rawChargeName, row.normalizedCode].filter((x) => typeof x === "string" && x.trim());
        const label =
          labelParts.length > 0 ? labelParts.join(" · ") : `Charge ${String(row.id).slice(0, 6)}`;
        const geo = row.geographyScope;
        candidates.push({
          kind: "CONTRACT_CHARGE",
          id: row.id,
          label,
          currency: cur.toUpperCase().slice(0, 3),
          amount,
          raw: row as unknown as Prisma.JsonValue,
          equipmentHint: typeof row.equipmentScope === "string" ? row.equipmentScope.trim() : null,
          unitBasis: typeof row.unitBasis === "string" ? row.unitBasis.trim() : null,
          originCode: geoCode(geo),
          destCode: null,
          isIncluded: typeof row.isIncluded === "boolean" ? row.isIncluded : null,
          isMandatory: typeof row.isMandatory === "boolean" ? row.isMandatory : null,
          rateType: null,
        });
      }
    }
    const totals = breakdownJson.totals;
    if (isRecord(totals)) {
      const g = num(totals.grand);
      if (g != null) contractGrandTotal = g;
    }
    return {
      ok: true,
      candidates,
      sourceType,
      rfqGrandTotal: null,
      contractGrandTotal,
      rfqRouteLocodes: null,
    };
  }

  if (sourceType === "QUOTE_RESPONSE") {
    const lines = breakdownJson.lines;
    if (!Array.isArray(lines)) {
      return {
        ok: false,
        error: "RFQ snapshot breakdown has no lines[] array.",
        category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
      };
    }
    const qr = breakdownJson.quoteRequest;
    const rfqOriginHint = isRecord(qr) ? locodeFromFreeText(qr.originLabel) : null;
    const rfqDestHint = isRecord(qr) ? locodeFromFreeText(qr.destinationLabel) : null;
    for (const row of lines) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      const amount = num(row.amount);
      if (amount == null) continue;
      const cur = typeof row.currency === "string" ? row.currency : "USD";
      const label = String(row.label ?? row.lineType ?? `Line ${row.id.slice(0, 6)}`);
      const notes = typeof row.notes === "string" ? row.notes : "";
      const equipmentHint = parseEquipmentFromText(`${label} ${notes}`);
      candidates.push({
        kind: "RFQ_LINE",
        id: row.id,
        label,
        currency: cur.toUpperCase().slice(0, 3),
        amount,
        raw: row as unknown as Prisma.JsonValue,
        equipmentHint,
        unitBasis: typeof row.unitBasis === "string" ? row.unitBasis.trim() : null,
        originCode: rfqOriginHint,
        destCode: rfqDestHint,
        isIncluded: typeof row.isIncluded === "boolean" ? row.isIncluded : null,
        isMandatory: null,
        rateType: typeof row.lineType === "string" ? row.lineType.trim() : null,
      });
    }
    const totals = breakdownJson.totals;
    if (isRecord(totals)) {
      const g = num(totals.grand);
      if (g != null) rfqGrandTotal = g;
    }
    return {
      ok: true,
      candidates,
      sourceType,
      rfqGrandTotal,
      contractGrandTotal: null,
      rfqRouteLocodes: { pol: rfqOriginHint, pod: rfqDestHint },
    };
  }

  return {
    ok: false,
    error: `Unknown snapshot sourceType in breakdownJson: ${String(sourceType)}`,
    category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
  };
}

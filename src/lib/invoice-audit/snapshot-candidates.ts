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

export type SnapshotCandidatesResult =
  | { ok: true; candidates: SnapshotPriceCandidate[]; sourceType: string; rfqGrandTotal: number | null }
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
    return { ok: true, candidates, sourceType, rfqGrandTotal: null };
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
        originCode: null,
        destCode: null,
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
    return { ok: true, candidates, sourceType, rfqGrandTotal };
  }

  return {
    ok: false,
    error: `Unknown snapshot sourceType in breakdownJson: ${String(sourceType)}`,
    category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
  };
}

import type { Prisma } from "@prisma/client";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";

export type SnapshotPriceCandidate = {
  kind: "CONTRACT_RATE" | "CONTRACT_CHARGE" | "RFQ_LINE";
  id: string;
  label: string;
  currency: string;
  amount: number;
  raw: Prisma.JsonValue;
};

export type SnapshotCandidatesResult =
  | { ok: true; candidates: SnapshotPriceCandidate[] }
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

/**
 * Reads frozen `breakdownJson` from a booking pricing snapshot into comparable price lines.
 */
export function extractSnapshotPriceCandidates(breakdownJson: unknown): SnapshotCandidatesResult {
  if (!isRecord(breakdownJson)) {
    return {
      ok: false,
      error: "Snapshot breakdownJson is not an object — cannot audit.",
      category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
    };
  }
  const sourceType = breakdownJson.sourceType;
  const candidates: SnapshotPriceCandidate[] = [];

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
        candidates.push({
          kind: "CONTRACT_RATE",
          id: row.id,
          label: labelParts.join(" ") || `Rate ${row.id.slice(0, 6)}`,
          currency: cur.toUpperCase().slice(0, 3),
          amount,
          raw: row as unknown as Prisma.JsonValue,
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
        const label = String(row.rawChargeName ?? row.normalizedCode ?? `Charge ${row.id.slice(0, 6)}`);
        candidates.push({
          kind: "CONTRACT_CHARGE",
          id: row.id,
          label,
          currency: cur.toUpperCase().slice(0, 3),
          amount,
          raw: row as unknown as Prisma.JsonValue,
        });
      }
    }
    return { ok: true, candidates };
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
      candidates.push({
        kind: "RFQ_LINE",
        id: row.id,
        label,
        currency: cur.toUpperCase().slice(0, 3),
        amount,
        raw: row as unknown as Prisma.JsonValue,
      });
    }
    return { ok: true, candidates };
  }

  return {
    ok: false,
    error: `Unknown snapshot sourceType in breakdownJson: ${String(sourceType)}`,
    category: DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR,
  };
}

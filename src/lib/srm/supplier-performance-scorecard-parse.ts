import { Prisma } from "@prisma/client";

export type PerformanceScorecardCreateData = {
  periodKey: string;
  onTimeDeliveryPct: Prisma.Decimal | null;
  qualityRating: number | null;
  notes: string | null;
};

export type ParseScorecardCreateResult =
  | { ok: true; data: PerformanceScorecardCreateData }
  | { ok: false; message: string };

export function parsePerformanceScorecardCreateBody(
  o: Record<string, unknown>,
): ParseScorecardCreateResult {
  if (typeof o.periodKey !== "string" || !o.periodKey.trim()) {
    return { ok: false, message: "periodKey is required (e.g. 2026-Q1)." };
  }
  const periodKey = o.periodKey.trim().slice(0, 32);
  if (!periodKey) return { ok: false, message: "periodKey is required." };

  let onTimeDeliveryPct: Prisma.Decimal | null = null;
  if ("onTimeDeliveryPct" in o) {
    const v = o.onTimeDeliveryPct;
    if (v === null) onTimeDeliveryPct = null;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
      onTimeDeliveryPct = new Prisma.Decimal(v.toFixed(2));
    } else if (typeof v === "string" && v.trim()) {
      const n = Number.parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, message: "onTimeDeliveryPct must be between 0 and 100." };
      }
      onTimeDeliveryPct = new Prisma.Decimal(n.toFixed(2));
    } else if (v !== undefined) {
      return { ok: false, message: "Invalid onTimeDeliveryPct." };
    }
  }

  let qualityRating: number | null = null;
  if ("qualityRating" in o) {
    const v = o.qualityRating;
    if (v === null) qualityRating = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) {
      qualityRating = v;
    } else {
      return { ok: false, message: "qualityRating must be an integer 1–5 or null." };
    }
  }

  let notes: string | null = null;
  if ("notes" in o) {
    if (o.notes === null) notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      notes = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid notes." };
    }
  }

  return { ok: true, data: { periodKey, onTimeDeliveryPct, qualityRating, notes } };
}

export type PerformanceScorecardPatchData = {
  onTimeDeliveryPct?: Prisma.Decimal | null;
  qualityRating?: number | null;
  notes?: string | null;
};

export type ParseScorecardPatchResult =
  | { ok: true; data: PerformanceScorecardPatchData }
  | { ok: false; message: string };

export function parsePerformanceScorecardPatchBody(
  o: Record<string, unknown>,
): ParseScorecardPatchResult {
  const data: PerformanceScorecardPatchData = {};
  if ("onTimeDeliveryPct" in o) {
    const v = o.onTimeDeliveryPct;
    if (v === null) data.onTimeDeliveryPct = null;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
      data.onTimeDeliveryPct = new Prisma.Decimal(v.toFixed(2));
    } else if (typeof v === "string" && v.trim()) {
      const n = Number.parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, message: "onTimeDeliveryPct must be between 0 and 100." };
      }
      data.onTimeDeliveryPct = new Prisma.Decimal(n.toFixed(2));
    } else {
      return { ok: false, message: "Invalid onTimeDeliveryPct." };
    }
  }
  if ("qualityRating" in o) {
    const v = o.qualityRating;
    if (v === null) data.qualityRating = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) {
      data.qualityRating = v;
    } else {
      return { ok: false, message: "qualityRating must be an integer 1–5 or null." };
    }
  }
  if ("notes" in o) {
    if (o.notes === null) data.notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      data.notes = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid notes." };
    }
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}

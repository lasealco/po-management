/**
 * BF-84 — optional promo uplift multiplier on `WmsDemandForecastStub` for BF-61 forecast gap hints.
 * See docs/wms/WMS_PROMO_UPLIFT_BF84.md.
 */
import { Prisma } from "@prisma/client";

export const BF84_SCHEMA_VERSION = "bf84.v1" as const;

/** Inclusive — 1 means “no uplift” (stored as JSON null when no promo note). */
export const BF84_MULTIPLIER_MIN = 1;
export const BF84_MULTIPLIER_MAX = 5;

export type ParsedPromoUpliftBf84 = {
  schemaVersion: typeof BF84_SCHEMA_VERSION;
  upliftMultiplier: number;
  promoNote: string | null;
};

export function clampBf84Multiplier(n: number): number {
  return Math.min(BF84_MULTIPLIER_MAX, Math.max(BF84_MULTIPLIER_MIN, n));
}

/** Lenient parse for DB / GET (never throws). */
export function parsePromoUpliftBf84Lenient(raw: unknown): ParsedPromoUpliftBf84 & { parseNotice?: string } {
  if (raw == null) {
    return { schemaVersion: BF84_SCHEMA_VERSION, upliftMultiplier: 1, promoNote: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      schemaVersion: BF84_SCHEMA_VERSION,
      upliftMultiplier: 1,
      promoNote: null,
      parseNotice: "promoUpliftBf84Json ignored (expected object).",
    };
  }
  const o = raw as Record<string, unknown>;
  let mult = 1;
  const um = o.upliftMultiplier;
  if (typeof um === "number" && Number.isFinite(um)) mult = clampBf84Multiplier(um);
  else if (typeof um === "string") {
    const p = Number.parseFloat(um);
    if (Number.isFinite(p)) mult = clampBf84Multiplier(p);
  }
  let promoNote: string | null = null;
  if (typeof o.promoNote === "string") promoNote = o.promoNote.trim().slice(0, 200) || null;
  return {
    schemaVersion: BF84_SCHEMA_VERSION,
    upliftMultiplier: mult,
    promoNote,
  };
}

export function effectiveForecastQtyBf84(baseForecastQty: number, rawPromoJson: unknown): number {
  const p = parsePromoUpliftBf84Lenient(rawPromoJson);
  const eff = new Prisma.Decimal(baseForecastQty)
    .mul(p.upliftMultiplier)
    .toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
  return eff.toNumber();
}

/** Strict POST validation for `promoUpliftBf84` on `upsert_wms_demand_forecast_stub`. */
export function validatePromoUpliftBf84Post(
  body: unknown,
): { ok: true; stored: Record<string, unknown> | null } | { ok: false; error: string } {
  if (body === null) return { ok: false, error: "promoUpliftBf84 cannot be null (use promoUpliftBf84Clear)." };
  if (typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "promoUpliftBf84 must be an object." };
  }
  const o = body as Record<string, unknown>;
  const um = o.upliftMultiplier;
  let mult: number;
  if (typeof um === "number" && Number.isFinite(um)) mult = um;
  else if (typeof um === "string") {
    const p = Number.parseFloat(um);
    if (!Number.isFinite(p)) return { ok: false, error: "upliftMultiplier must be a finite number." };
    mult = p;
  } else return { ok: false, error: "upliftMultiplier is required on promoUpliftBf84." };
  if (mult < BF84_MULTIPLIER_MIN || mult > BF84_MULTIPLIER_MAX) {
    return {
      ok: false,
      error: `upliftMultiplier must be between ${BF84_MULTIPLIER_MIN} and ${BF84_MULTIPLIER_MAX}.`,
    };
  }
  let promoNote: string | undefined;
  if (o.promoNote !== undefined && o.promoNote !== null) {
    if (typeof o.promoNote !== "string") return { ok: false, error: "promoNote must be a string." };
    promoNote = o.promoNote.trim().slice(0, 200) || undefined;
  }
  mult = clampBf84Multiplier(mult);
  if (mult <= 1 && !promoNote) {
    return { ok: true, stored: null };
  }
  const stored: Record<string, unknown> = {
    schemaVersion: BF84_SCHEMA_VERSION,
    upliftMultiplier: mult,
  };
  if (promoNote) stored.promoNote = promoNote;
  return { ok: true, stored };
}

/** Payload fragment for `GET /api/wms` demandForecastStubs rows. */
export function promoUpliftBf84PayloadFromDb(raw: unknown): {
  schemaVersion: typeof BF84_SCHEMA_VERSION;
  upliftMultiplier: number;
  promoNote: string | null;
  parseNotice?: string;
} {
  const p = parsePromoUpliftBf84Lenient(raw);
  const { parseNotice, ...rest } = p;
  return parseNotice ? { ...rest, parseNotice } : rest;
}

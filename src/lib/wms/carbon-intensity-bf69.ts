/**
 * BF-69 — optional CO₂e estimate + transport stubs on `InventoryMovement`; optional product factor.
 * Indicative planning only — not GLEC-certified carbon accounting.
 */

import { Prisma } from "@prisma/client";

export const CO2E_HINT_SCHEMA_VERSION = "bf69.v1";

export const CO2E_HINT_METHODOLOGY =
  "BF-69: optional grams CO₂e per inventory movement from tenant-entered totals plus optional mode/distance stubs; " +
  "product may carry a g·(kg·km)⁻¹ planning factor. Indicative for WMS/assistant narratives — not GLEC-certified.";

export const CO2E_STUB_JSON_MAX_BYTES = 2048;

const MAX_GRAMS = new Prisma.Decimal("1e15");
const MAX_FACTOR = new Prisma.Decimal("1e9");

export type Co2eGramsPatchResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.Decimal }
  | { ok: false; message: string };

export type Co2eStubParseResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.InputJsonValue }
  | { ok: false; message: string };

export type ProductCo2eFactorPatchResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.Decimal }
  | { ok: false; message: string };

function decimalFromInput(raw: string | number): Prisma.Decimal | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return new Prisma.Decimal(String(raw));
  }
  const t = raw.trim();
  if (!t) return null;
  try {
    return new Prisma.Decimal(t);
  } catch {
    return null;
  }
}

/** `undefined` → omit; `null` → clear; number|string → non-negative grams (max sanity bound). */
export function parseCo2eEstimateGramsForPatch(raw: unknown): Co2eGramsPatchResult {
  if (raw === undefined) return { ok: true, mode: "omit" };
  if (raw === null) return { ok: true, mode: "clear" };
  const d =
    typeof raw === "number" || typeof raw === "string" ? decimalFromInput(raw) : null;
  if (!d) {
    return { ok: false, message: "co2eEstimateGrams must be a finite non-negative number, null, or omitted." };
  }
  if (d.isNegative()) {
    return { ok: false, message: "co2eEstimateGrams must be non-negative." };
  }
  if (d.gt(MAX_GRAMS)) {
    return { ok: false, message: "co2eEstimateGrams exceeds maximum allowed value." };
  }
  return { ok: true, mode: "set", value: d };
}

/** `undefined` → omit; `null` → clear; object → set (validated size + allowed keys). */
export function parseCo2eStubJsonForPatch(raw: unknown): Co2eStubParseResult {
  if (raw === undefined) return { ok: true, mode: "omit" };
  if (raw === null) return { ok: true, mode: "clear" };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "co2eStubJson must be a JSON object or null." };
  }
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (r.transportModeStub !== undefined) {
    if (typeof r.transportModeStub !== "string") {
      return { ok: false, message: "co2eStubJson.transportModeStub must be a string when set." };
    }
    const s = r.transportModeStub.trim().slice(0, 64);
    if (!s) {
      return { ok: false, message: "co2eStubJson.transportModeStub cannot be blank." };
    }
    out.transportModeStub = s;
  }
  if (r.distanceKm !== undefined) {
    if (r.distanceKm === null) {
      out.distanceKm = null;
    } else if (typeof r.distanceKm === "number" && Number.isFinite(r.distanceKm)) {
      if (r.distanceKm < 0 || r.distanceKm > 1e7) {
        return { ok: false, message: "co2eStubJson.distanceKm out of allowed range." };
      }
      out.distanceKm = r.distanceKm;
    } else {
      return { ok: false, message: "co2eStubJson.distanceKm must be a finite non-negative number or null." };
    }
  }
  if (r.note !== undefined) {
    if (typeof r.note !== "string") {
      return { ok: false, message: "co2eStubJson.note must be a string when set." };
    }
    const n = r.note.trim().slice(0, 500);
    if (!n) {
      return { ok: false, message: "co2eStubJson.note cannot be blank." };
    }
    out.note = n;
  }
  const extraKeys = Object.keys(r).filter((k) => !["transportModeStub", "distanceKm", "note"].includes(k));
  if (extraKeys.length > 0) {
    return {
      ok: false,
      message: `co2eStubJson has unknown keys: ${extraKeys.slice(0, 6).join(", ")}.`,
    };
  }
  if (Object.keys(out).length === 0) {
    return { ok: false, message: "co2eStubJson must include at least one of transportModeStub, distanceKm, note." };
  }
  const str = JSON.stringify(out);
  if (str.length > CO2E_STUB_JSON_MAX_BYTES) {
    return {
      ok: false,
      message: `co2eStubJson must serialize to at most ${CO2E_STUB_JSON_MAX_BYTES} bytes.`,
    };
  }
  return { ok: true, mode: "set", value: out as Prisma.InputJsonValue };
}

/** Product planning factor: g CO₂e per kg·km. */
export function parseProductWmsCo2eFactorGramsPerKgKmForPatch(raw: unknown): ProductCo2eFactorPatchResult {
  if (raw === undefined) return { ok: true, mode: "omit" };
  if (raw === null) return { ok: true, mode: "clear" };
  const d =
    typeof raw === "number" || typeof raw === "string" ? decimalFromInput(raw) : null;
  if (!d) {
    return {
      ok: false,
      message: "wmsCo2eFactorGramsPerKgKm must be a finite non-negative number, null, or omitted.",
    };
  }
  if (d.isNegative()) {
    return { ok: false, message: "wmsCo2eFactorGramsPerKgKm must be non-negative." };
  }
  if (d.gt(MAX_FACTOR)) {
    return { ok: false, message: "wmsCo2eFactorGramsPerKgKm exceeds maximum allowed value." };
  }
  return { ok: true, mode: "set", value: d };
}

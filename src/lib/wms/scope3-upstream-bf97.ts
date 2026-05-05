/**
 * BF-97 — Scope 3 upstream CO₂e stub (grams per kg of moved quantity) plus optional movement rollup hint grams.
 * Extends BF-69 narratives — indicative cradle-to-gate factor only (not CDP assurance).
 */

import { Prisma } from "@prisma/client";

export const SCOPE3_UPSTREAM_BF97_SCHEMA_NOTE = "bf97.v1" as const;

export const SCOPE3_UPSTREAM_BF97_METHODOLOGY_APPEND =
  " BF-97 adds optional Scope 3 upstream cradle-to-gate grams CO₂e per kg on Supplier and Product plus optional InventoryMovement rollup hint grams " +
  "(manual entry or quantity × resolved per-kg factor when quantity is interpreted as kg-equivalent). Same indicative stance as BF-69 — not CDP assurance.";

const MAX_PER_KG = new Prisma.Decimal("1e9");

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

export type Scope3UpstreamGramsPerKgBf97PatchResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.Decimal }
  | { ok: false; message: string };

/** Supplier/Product upstream factor: g CO₂e per kg of SKU quantity (upstream stub). */
export function parseScope3UpstreamGramsPerKgBf97ForPatch(raw: unknown): Scope3UpstreamGramsPerKgBf97PatchResult {
  if (raw === undefined) return { ok: true, mode: "omit" };
  if (raw === null) return { ok: true, mode: "clear" };
  const d = typeof raw === "number" || typeof raw === "string" ? decimalFromInput(raw) : null;
  if (!d) {
    return {
      ok: false,
      message: "wmsScope3UpstreamCo2eGramsPerKgBf97 must be a finite non-negative number, null, or omitted.",
    };
  }
  if (d.isNegative()) {
    return { ok: false, message: "wmsScope3UpstreamCo2eGramsPerKgBf97 must be non-negative." };
  }
  if (d.gt(MAX_PER_KG)) {
    return { ok: false, message: "wmsScope3UpstreamCo2eGramsPerKgBf97 exceeds maximum allowed value." };
  }
  return { ok: true, mode: "set", value: d };
}

export type MovementScope3UpstreamHintGramsBf97PatchResult =
  | { ok: true; mode: "omit" }
  | { ok: true; mode: "clear" }
  | { ok: true; mode: "set"; value: Prisma.Decimal }
  | { ok: false; message: string };

/** Movement rollup hint reuses BF-69 gram bounds (whole-movement grams CO₂e). */
export function parseMovementScope3UpstreamHintGramsBf97ForPatch(
  raw: unknown,
): MovementScope3UpstreamHintGramsBf97PatchResult {
  if (raw === undefined) return { ok: true, mode: "omit" };
  if (raw === null) return { ok: true, mode: "clear" };
  const d = typeof raw === "number" || typeof raw === "string" ? decimalFromInput(raw) : null;
  if (!d) {
    return {
      ok: false,
      message: "co2eScope3UpstreamHintGramsBf97 must be a finite non-negative number, null, or omitted.",
    };
  }
  if (d.isNegative()) {
    return { ok: false, message: "co2eScope3UpstreamHintGramsBf97 must be non-negative." };
  }
  const MAX_GRAMS = new Prisma.Decimal("1e15");
  if (d.gt(MAX_GRAMS)) {
    return { ok: false, message: "co2eScope3UpstreamHintGramsBf97 exceeds maximum allowed value." };
  }
  return { ok: true, mode: "set", value: d };
}

export function resolveScope3UpstreamGramsPerKgBf97(params: {
  productGramsPerKg: Prisma.Decimal | null | undefined;
  supplierGramsPerKgViaOffice: Prisma.Decimal | null | undefined;
}): Prisma.Decimal | null {
  if (params.productGramsPerKg != null) return params.productGramsPerKg;
  if (params.supplierGramsPerKgViaOffice != null) return params.supplierGramsPerKgViaOffice;
  return null;
}

/** qty × gramsPerKg when both positive (typically qty interpreted as kg for rollup stubs). */
export function multiplyQtyByUpstreamGramsPerKgBf97(
  qty: Prisma.Decimal,
  gramsPerKg: Prisma.Decimal,
): Prisma.Decimal | null {
  if (qty.isNegative()) return null;
  const grams = qty.mul(gramsPerKg);
  const MAX_GRAMS = new Prisma.Decimal("1e15");
  if (grams.gt(MAX_GRAMS)) return null;
  return grams;
}

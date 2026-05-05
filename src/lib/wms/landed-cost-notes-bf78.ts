/**
 * BF-78 — optional landed-cost / FX narrative JSON on `WmsStockTransfer` (not ERP absorption).
 */

import type { Prisma } from "@prisma/client";

export const LANDED_COST_NOTES_BF78_SCHEMA_VERSION = "bf78.v1" as const;

export type LandedCostNotesBf78V1 = {
  schemaVersion: typeof LANDED_COST_NOTES_BF78_SCHEMA_VERSION;
  notes: string | null;
  fxBaseCurrency: string | null;
  fxQuoteCurrency: string | null;
  fxRate: string | null;
  fxRateSourceNarrative: string | null;
};

export const LANDED_COST_NOTES_BF78_JSON_MAX_BYTES = 8192;

const NOTES_MAX = 4000;
const FX_NARRATIVE_MAX = 500;
const FX_RATE_MAX = 32;

const ISO4217 = /^[A-Z]{3}$/;

export type ParsedStoredLandedCostBf78 = {
  doc: LandedCostNotesBf78V1 | null;
  notice: string | null;
};

function normalizeCurrency(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase();
  if (!t.length) return null;
  return ISO4217.test(t) ? t : "__INVALID__";
}

function normalizeNotes(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.length) return null;
  return t.length > NOTES_MAX ? t.slice(0, NOTES_MAX) : t;
}

function normalizeFxRate(raw: string | number | undefined | null): string | null {
  if (raw == null) return null;
  const s = typeof raw === "number" ? String(raw) : raw.trim();
  if (!s.length) return null;
  return s.length > FX_RATE_MAX ? s.slice(0, FX_RATE_MAX) : s;
}

function normalizeFxNarrative(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.length) return null;
  return t.length > FX_NARRATIVE_MAX ? t.slice(0, FX_NARRATIVE_MAX) : t;
}

/** Reads DB JSON → resolved doc or null + optional parse notice. */
export function parseStoredLandedCostNotesBf78Json(raw: unknown): ParsedStoredLandedCostBf78 {
  if (raw == null) return { doc: null, notice: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { doc: null, notice: "Stored landed cost notes JSON was not an object — ignored." };
  }
  const o = raw as Record<string, unknown>;
  const notes = normalizeNotes(typeof o.notes === "string" ? o.notes : null);
  const fxBaseCurrency = normalizeCurrency(typeof o.fxBaseCurrency === "string" ? o.fxBaseCurrency : null);
  const fxQuoteCurrency = normalizeCurrency(typeof o.fxQuoteCurrency === "string" ? o.fxQuoteCurrency : null);
  const fxRate = normalizeFxRate(
    typeof o.fxRate === "string" || typeof o.fxRate === "number" ? o.fxRate : null,
  );
  const fxRateSourceNarrative = normalizeFxNarrative(
    typeof o.fxRateSourceNarrative === "string" ? o.fxRateSourceNarrative : null,
  );

  if (fxBaseCurrency === "__INVALID__" || fxQuoteCurrency === "__INVALID__") {
    return { doc: null, notice: "Stored landed cost notes used invalid currency codes — ignored." };
  }
  if (
    (fxBaseCurrency && !fxQuoteCurrency) ||
    (!fxBaseCurrency && fxQuoteCurrency) ||
    (fxRate && (!fxBaseCurrency || !fxQuoteCurrency))
  ) {
    return { doc: null, notice: "Stored landed cost notes had inconsistent FX fields — ignored." };
  }

  return {
    doc: {
      schemaVersion: LANDED_COST_NOTES_BF78_SCHEMA_VERSION,
      notes,
      fxBaseCurrency,
      fxQuoteCurrency,
      fxRate,
      fxRateSourceNarrative,
    },
    notice: null,
  };
}

export type LandedCostNotesBf78DraftInput = {
  notes?: string | null;
  fxBaseCurrency?: string | null;
  fxQuoteCurrency?: string | null;
  fxRate?: string | number | null;
  fxRateSourceNarrative?: string | null;
};

/** Normalize POST nested object / loose fields into a validated `bf78.v1` doc, or an error message. */
export function validateLandedCostNotesBf78Draft(
  input: LandedCostNotesBf78DraftInput,
): { ok: true; value: LandedCostNotesBf78V1 } | { ok: false; message: string } {
  const notes = normalizeNotes(input.notes ?? null);
  const fxBaseRaw = normalizeCurrency(input.fxBaseCurrency ?? null);
  const fxQuoteRaw = normalizeCurrency(input.fxQuoteCurrency ?? null);
  const fxRate = normalizeFxRate(input.fxRate ?? null);
  const fxRateSourceNarrative = normalizeFxNarrative(input.fxRateSourceNarrative ?? null);

  if (fxBaseRaw === "__INVALID__") return { ok: false, message: "fxBaseCurrency must be a 3-letter ISO 4217 code." };
  if (fxQuoteRaw === "__INVALID__") return { ok: false, message: "fxQuoteCurrency must be a 3-letter ISO 4217 code." };

  const fxBaseCurrency = fxBaseRaw;
  const fxQuoteCurrency = fxQuoteRaw;

  if ((fxBaseCurrency && !fxQuoteCurrency) || (!fxBaseCurrency && fxQuoteCurrency)) {
    return { ok: false, message: "FX pair requires both fxBaseCurrency and fxQuoteCurrency." };
  }
  if (fxRate && (!fxBaseCurrency || !fxQuoteCurrency)) {
    return { ok: false, message: "fxRate requires an FX pair (base + quote currency)." };
  }

  const hasAny = Boolean(
    notes || fxBaseCurrency || fxQuoteCurrency || fxRate || fxRateSourceNarrative,
  );
  if (!hasAny) {
    return { ok: false, message: "Provide notes, an FX pair, fxRate, or fx narrative — or clear with landedCostNotesBf78Clear." };
  }

  const value: LandedCostNotesBf78V1 = {
    schemaVersion: LANDED_COST_NOTES_BF78_SCHEMA_VERSION,
    notes,
    fxBaseCurrency,
    fxQuoteCurrency,
    fxRate,
    fxRateSourceNarrative,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, message: "Could not serialize landed cost notes JSON." };
  }
  if (serialized.length > LANDED_COST_NOTES_BF78_JSON_MAX_BYTES) {
    return {
      ok: false,
      message: `landedCostNotesBf78 must serialize to at most ${LANDED_COST_NOTES_BF78_JSON_MAX_BYTES} bytes.`,
    };
  }

  return { ok: true, value };
}

export function landedCostNotesBf78ToStoredJson(doc: LandedCostNotesBf78V1): Prisma.InputJsonValue {
  return doc as unknown as Prisma.InputJsonValue;
}

/** Coerce unknown POST body fragment into draft fields (invalid shapes yield empty object). */
export function landedCostNotesBf78DraftFromUnknown(raw: unknown): LandedCostNotesBf78DraftInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    notes: typeof o.notes === "string" ? o.notes : o.notes === null ? null : undefined,
    fxBaseCurrency:
      typeof o.fxBaseCurrency === "string" ? o.fxBaseCurrency : o.fxBaseCurrency === null ? null : undefined,
    fxQuoteCurrency:
      typeof o.fxQuoteCurrency === "string" ? o.fxQuoteCurrency : o.fxQuoteCurrency === null ? null : undefined,
    fxRate:
      typeof o.fxRate === "string" || typeof o.fxRate === "number"
        ? o.fxRate
        : o.fxRate === null
          ? null
          : undefined,
    fxRateSourceNarrative:
      typeof o.fxRateSourceNarrative === "string"
        ? o.fxRateSourceNarrative
        : o.fxRateSourceNarrative === null
          ? null
          : undefined,
  };
}

/**
 * Shared validation for supplier service capability API (POST / PATCH).
 * Keeps route handlers thin and logic unit-testable.
 */

const EXPLICIT_MODES = new Set(["OCEAN", "AIR", "ROAD", "RAIL"]);

export type CapabilityParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number };

export type CapabilityCreateInput = {
  mode: string | null;
  subMode: string | null;
  serviceType: string;
  geography: string | null;
  notes: string | null;
};

export type CapabilityPatchInput = {
  mode?: string | null;
  subMode?: string | null;
  serviceType?: string;
  geography?: string | null;
  notes?: string | null;
};

/** POST: mode optional; empty / null → null; must be one of EXPLICIT if set. */
export function parseModeForCreate(v: unknown): string | null | "__invalid__" {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return "__invalid__";
  const u = v.trim().toUpperCase();
  if (u === "") return null;
  if (!EXPLICIT_MODES.has(u)) return "__invalid__";
  return u;
}

/** PATCH: null or "" clears mode; omitted = leave unchanged (caller checks undefined). */
export function parseModeForPatch(v: unknown): string | null | "__invalid__" {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return "__invalid__";
  const u = v.trim().toUpperCase();
  if (!EXPLICIT_MODES.has(u)) return "__invalid__";
  return u;
}

export function parseStringField(
  v: unknown,
  max: number,
  required: boolean,
): string | "__invalid__" | null | undefined {
  if (v === undefined) return undefined;
  if (v == null) return required ? "__invalid__" : null;
  if (typeof v !== "string") return "__invalid__";
  const t = v.trim();
  if (!t) return required ? "__invalid__" : null;
  if (t.length > max) return "__invalid__";
  return t;
}

export function parseNotesField(v: unknown): string | null | "__invalid__" | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return "__invalid__";
  const t = v.trim();
  return t ? t.slice(0, 8000) : null;
}

export function parseCapabilityCreateBody(
  o: Record<string, unknown>,
): CapabilityParseResult<CapabilityCreateInput> {
  const mode = parseModeForCreate(o.mode);
  if (mode === "__invalid__") {
    return { ok: false, message: "mode must be OCEAN, AIR, ROAD, RAIL, or empty." };
  }
  const subMode = parseStringField(o.subMode, 64, false);
  if (subMode === "__invalid__") return { ok: false, message: "Invalid subMode." };
  const serviceType = parseStringField(o.serviceType, 128, true);
  if (serviceType === "__invalid__" || serviceType == null) {
    return { ok: false, message: "serviceType is required (max 128 chars)." };
  }
  const geography = parseStringField(o.geography, 256, false);
  if (geography === "__invalid__") return { ok: false, message: "Invalid geography." };

  let notes: string | null = null;
  if ("notes" in o) {
    const n = parseNotesField(o.notes);
    if (n === "__invalid__") return { ok: false, message: "Invalid notes." };
    notes = n ?? null;
  }

  return {
    ok: true,
    data: {
      mode,
      subMode: subMode ?? null,
      serviceType,
      geography: geography ?? null,
      notes,
    },
  };
}

export function parseCapabilityPatchBody(
  o: Record<string, unknown>,
): CapabilityParseResult<CapabilityPatchInput> {
  const data: CapabilityPatchInput = {};

  if (o.mode !== undefined) {
    const mode = parseModeForPatch(o.mode);
    if (mode === "__invalid__") {
      return { ok: false, message: "mode must be OCEAN, AIR, ROAD, RAIL, or empty." };
    }
    data.mode = mode;
  }
  if (o.subMode !== undefined) {
    const s = parseStringField(o.subMode, 64, false);
    if (s === "__invalid__") return { ok: false, message: "Invalid subMode." };
    data.subMode = s ?? null;
  }
  if (o.serviceType !== undefined) {
    const s = parseStringField(o.serviceType, 128, true);
    if (s === "__invalid__" || s == null) {
      return { ok: false, message: "serviceType invalid." };
    }
    data.serviceType = s;
  }
  if (o.geography !== undefined) {
    const s = parseStringField(o.geography, 256, false);
    if (s === "__invalid__") return { ok: false, message: "Invalid geography." };
    data.geography = s ?? null;
  }
  if (o.notes !== undefined) {
    const n = parseNotesField(o.notes);
    if (n === "__invalid__") return { ok: false, message: "Invalid notes." };
    data.notes = n === undefined ? null : n;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update.", status: 400 };
  }

  return { ok: true, data };
}

import type { Prisma } from "@prisma/client";

/** BF-38 — persisted shape for `WmsDockAppointment.trailerChecklistJson`. */
export type TrailerChecklistItem = {
  id: string;
  label: string;
  required?: boolean;
  done: boolean;
};

export type TrailerChecklistPayload = {
  items: TrailerChecklistItem[];
};

const MAX_ITEMS = 40;
const MAX_ID_LEN = 64;
const MAX_LABEL_LEN = 160;

/** Default checklist applied from UI “Initialize checklist”. */
export function defaultTrailerChecklistPayload(): TrailerChecklistPayload {
  return {
    items: [
      { id: "chocks", label: "Wheel chocks / brakes verified", required: true, done: false },
      { id: "damage", label: "Visible damage walk-around", required: true, done: false },
      { id: "seal", label: "Seal number recorded (if sealed load)", required: false, done: false },
      { id: "bol", label: "BOL / paperwork matches trailer", required: true, done: false },
    ],
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate API/body JSON for Prisma `Json` column; returns Prisma-compatible JSON object. */
export function parseTrailerChecklistJson(
  raw: unknown,
): { ok: true; value: Prisma.InputJsonObject } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "trailerChecklistJson must be a JSON object." };
  }
  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, error: "trailerChecklistJson.items must be an array." };
  }
  if (itemsRaw.length > MAX_ITEMS) {
    return { ok: false, error: `trailerChecklistJson supports at most ${MAX_ITEMS} items.` };
  }
  const items: TrailerChecklistItem[] = [];
  for (let i = 0; i < itemsRaw.length; i += 1) {
    const row = itemsRaw[i];
    if (!isPlainObject(row)) {
      return { ok: false, error: `trailerChecklistJson.items[${i}] must be an object.` };
    }
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!id || id.length > MAX_ID_LEN) {
      return { ok: false, error: `trailerChecklistJson.items[${i}].id invalid.` };
    }
    if (!label || label.length > MAX_LABEL_LEN) {
      return { ok: false, error: `trailerChecklistJson.items[${i}].label invalid.` };
    }
    const done = Boolean(row.done);
    const required = row.required === undefined ? false : Boolean(row.required);
    items.push({ id, label, required, done });
  }
  return { ok: true, value: { items } as unknown as Prisma.InputJsonObject };
}

/** Coerce DB Json into payload; invalid shapes behave like “no checklist”. */
export function trailerChecklistFromDb(raw: unknown): TrailerChecklistPayload | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) return null;
  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) return null;
  const items: TrailerChecklistItem[] = [];
  for (const row of itemsRaw) {
    if (!isPlainObject(row)) continue;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!id || !label) continue;
    items.push({
      id,
      label,
      required: row.required === undefined ? false : Boolean(row.required),
      done: Boolean(row.done),
    });
  }
  return items.length === 0 ? null : { items };
}

/** Whether DEPARTED milestone is allowed given checklist (required rows must be done). */
export function trailerChecklistAllowsDepart(raw: unknown): boolean {
  const parsed = trailerChecklistFromDb(raw);
  if (!parsed) return true;
  for (const it of parsed.items) {
    if (it.required && !it.done) return false;
  }
  return true;
}

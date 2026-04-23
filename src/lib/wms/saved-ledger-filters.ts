import { Prisma } from "@prisma/client";

import { MOVEMENT_LEDGER_TYPES } from "./movement-ledger-query";

const MAX_NAME_LEN = 120;

export type WmsSavedLedgerFiltersNormalized = {
  warehouseId: string | null;
  movementType: string | null;
  sinceIso: string | null;
  untilIso: string | null;
  limit: string | null;
  sortBy: string;
  sortDir: string;
};

function parseOptionalIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") throw new Error("Invalid date value.");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date value.");
  return d.toISOString();
}

function parseLimit(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.min(300, Math.max(1, Math.floor(v))));
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v.trim(), 10);
    if (!Number.isFinite(n)) throw new Error("Invalid limit.");
    return String(Math.min(300, Math.max(1, n)));
  }
  throw new Error("Invalid limit.");
}

function parseSort(sortBy: unknown, sortDir: unknown): { sortBy: string; sortDir: string } {
  const sb = typeof sortBy === "string" ? sortBy : "";
  const sd = typeof sortDir === "string" ? sortDir : "";
  if (sb === "quantity" && (sd === "asc" || sd === "desc")) {
    return { sortBy: "quantity", sortDir: sd };
  }
  if (sb === "createdAt" && (sd === "asc" || sd === "desc")) {
    return { sortBy: "createdAt", sortDir: sd };
  }
  return { sortBy: "createdAt", sortDir: "desc" };
}

/**
 * Parse and normalize ledger filter object for `WmsSavedLedgerView.filtersJson`.
 * `validWarehouseIds` when non-null must contain `warehouseId` if set (tenant scope check).
 */
export function normalizeWmsSavedLedgerFilters(
  input: unknown,
  validWarehouseIds: Set<string> | null,
): WmsSavedLedgerFiltersNormalized {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!o) throw new Error("filters object required");

  const wh = o.warehouseId;
  let warehouseId: string | null = null;
  if (wh === null || wh === undefined || wh === "") {
    warehouseId = null;
  } else if (typeof wh === "string" && wh.trim()) {
    const id = wh.trim();
    if (validWarehouseIds && !validWarehouseIds.has(id)) {
      throw new Error("Unknown warehouse for this tenant.");
    }
    warehouseId = id;
  } else {
    throw new Error("Invalid warehouseId.");
  }

  const mt = o.movementType;
  let movementType: string | null = null;
  if (mt === null || mt === undefined || mt === "") {
    movementType = null;
  } else if (typeof mt === "string" && mt.trim()) {
    const t = mt.trim();
    if (!(MOVEMENT_LEDGER_TYPES as string[]).includes(t)) {
      throw new Error("Invalid movement type.");
    }
    movementType = t;
  } else {
    throw new Error("Invalid movement type.");
  }

  const sinceIso = parseOptionalIso(o.sinceIso);
  const untilIso = parseOptionalIso(o.untilIso);
  const limit = parseLimit(o.limit);
  const sort = parseSort(o.sortBy, o.sortDir);

  return {
    warehouseId,
    movementType,
    sinceIso,
    untilIso,
    limit,
    sortBy: sort.sortBy,
    sortDir: sort.sortDir,
  };
}

export function parseWmsSavedLedgerName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new Error("Name is required.");
  if (s.length > MAX_NAME_LEN) throw new Error(`Name must be at most ${MAX_NAME_LEN} characters.`);
  return s;
}

export function wmsSavedLedgerFiltersToPrismaJson(
  f: WmsSavedLedgerFiltersNormalized,
): Prisma.InputJsonValue {
  return {
    warehouseId: f.warehouseId,
    movementType: f.movementType,
    sinceIso: f.sinceIso,
    untilIso: f.untilIso,
    limit: f.limit,
    sortBy: f.sortBy,
    sortDir: f.sortDir,
  } as Prisma.InputJsonValue;
}

/** Map stored JSON to API / UI shape; tolerant of legacy or partial objects. */
export function wmsSavedLedgerRowToClient(row: {
  id: string;
  name: string;
  filtersJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): {
  id: string;
  name: string;
  filters: WmsSavedLedgerFiltersNormalized;
  createdAt: string;
  updatedAt: string;
} {
  const j = row.filtersJson;
  const o = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  const filters: WmsSavedLedgerFiltersNormalized = {
    warehouseId: typeof o.warehouseId === "string" && o.warehouseId ? o.warehouseId : null,
    movementType: typeof o.movementType === "string" && o.movementType ? o.movementType : null,
    sinceIso: typeof o.sinceIso === "string" && o.sinceIso ? o.sinceIso : null,
    untilIso: typeof o.untilIso === "string" && o.untilIso ? o.untilIso : null,
    limit: typeof o.limit === "string" && o.limit ? o.limit : null,
    sortBy: typeof o.sortBy === "string" && o.sortBy ? o.sortBy : "createdAt",
    sortDir: typeof o.sortDir === "string" && o.sortDir ? o.sortDir : "desc",
  };
  return {
    id: row.id,
    name: row.name,
    filters,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

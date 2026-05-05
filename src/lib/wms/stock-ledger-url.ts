import type { InventoryMovementType } from "@prisma/client";

import { MOVEMENT_LEDGER_TYPES } from "@/lib/wms/movement-ledger-query";

const LEDGER_PARAM_KEYS = ["mvWarehouse", "mvType", "mvSince", "mvUntil", "mvLimit", "mvSortBy", "mvSortDir"] as const;
const LEDGER_PARAM_KEY_SET = new Set<string>(LEDGER_PARAM_KEYS);

export type StockLedgerUrlState = {
  warehouseId: string;
  movementType: "" | InventoryMovementType;
  sinceIso: string;
  untilIso: string;
  limit: string;
  sortBy: "" | "quantity" | "createdAt";
  sortDir: "" | "asc" | "desc";
};

const isMovementType = (v: string): v is InventoryMovementType =>
  (MOVEMENT_LEDGER_TYPES as string[]).includes(v);

/** Stable mv* query string for comparing whether the URL changed, without key-order noise. */
export function normalizeMovementLedgerQueryString(searchParams: URLSearchParams): string {
  const keys = [...new Set([...searchParams.keys()])].filter((k) => LEDGER_PARAM_KEY_SET.has(k)).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v != null && v !== "") parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  }
  return parts.join("&");
}

export function readStockLedgerUrlState(searchParams: URLSearchParams): StockLedgerUrlState {
  const rawType = searchParams.get("mvType")?.trim() ?? "";
  const movementType = rawType && isMovementType(rawType) ? rawType : "";
  const rawSortBy = searchParams.get("mvSortBy")?.trim() ?? "";
  const sortBy = rawSortBy === "quantity" || rawSortBy === "createdAt" ? rawSortBy : "";
  const rawSortDir = searchParams.get("mvSortDir")?.trim() ?? "";
  const sortDir = rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : "";
  return {
    warehouseId: searchParams.get("mvWarehouse")?.trim() ?? "",
    movementType,
    sinceIso: searchParams.get("mvSince")?.trim() ?? "",
    untilIso: searchParams.get("mvUntil")?.trim() ?? "",
    limit: searchParams.get("mvLimit")?.trim() ?? "",
    sortBy,
    sortDir,
  };
}

/** Merge ledger filters into a URLSearchParams clone; preserves unrelated keys (e.g. onHold). */
export function mergeStockLedgerSearchParams(
  current: URLSearchParams,
  ledger: StockLedgerUrlState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const k of LEDGER_PARAM_KEYS as readonly string[]) {
    next.delete(k);
  }
  if (ledger.warehouseId) next.set("mvWarehouse", ledger.warehouseId);
  if (ledger.movementType) next.set("mvType", ledger.movementType);
  if (ledger.sinceIso) next.set("mvSince", ledger.sinceIso);
  if (ledger.untilIso) next.set("mvUntil", ledger.untilIso);
  if (ledger.limit) next.set("mvLimit", ledger.limit);
  if (ledger.sortBy) next.set("mvSortBy", ledger.sortBy);
  if (ledger.sortDir) next.set("mvSortDir", ledger.sortDir);
  return next;
}

/** BF-82 — `GET /api/wms/movement-audit-chain` (chronological order; not UI ledger sort). */
export function buildMovementAuditChainBf82Url(opts: StockLedgerUrlState): string {
  const q = new URLSearchParams();
  if (opts.sinceIso.trim()) q.set("since", opts.sinceIso.trim());
  if (opts.untilIso.trim()) q.set("until", opts.untilIso.trim());
  if (opts.warehouseId.trim()) q.set("warehouseId", opts.warehouseId.trim());
  if (opts.movementType) q.set("movementType", opts.movementType);
  const cap = opts.limit.trim();
  if (cap) q.set("cap", cap);
  const qs = q.toString();
  return qs ? `/api/wms/movement-audit-chain?${qs}` : "/api/wms/movement-audit-chain";
}

/** Populate datetime-local inputs from an ISO string in the browser. */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

import type { InventoryMovementType } from "@prisma/client";

import { MOVEMENT_LEDGER_TYPES } from "@/lib/wms/movement-ledger-query";

const LEDGER_PARAM_KEYS = ["mvWarehouse", "mvType", "mvSince", "mvUntil", "mvLimit"] as const;
const LEDGER_PARAM_KEY_SET = new Set<string>(LEDGER_PARAM_KEYS);

export type StockLedgerUrlState = {
  warehouseId: string;
  movementType: "" | InventoryMovementType;
  sinceIso: string;
  untilIso: string;
  limit: string;
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
  return {
    warehouseId: searchParams.get("mvWarehouse")?.trim() ?? "",
    movementType,
    sinceIso: searchParams.get("mvSince")?.trim() ?? "",
    untilIso: searchParams.get("mvUntil")?.trim() ?? "",
    limit: searchParams.get("mvLimit")?.trim() ?? "",
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
  return next;
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

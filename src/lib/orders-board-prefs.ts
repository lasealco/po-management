export const ORDERS_BOARD_PREF_KEY = "orders_board_v1";

export const BOARD_QUEUE_FILTERS = [
  "all",
  "needs_my_action",
  "waiting_on_me",
  "sla_warning",
  "sla_critical",
  "awaiting_supplier",
  "overdue",
  "due_today",
  "split_pending_buyer",
  "linked_sales_order",
  "logistics_blocked",
] as const;

export type BoardQueueFilter = (typeof BOARD_QUEUE_FILTERS)[number];
export type BoardSortMode = "priority" | "newest";

export function parseQueueFromSearchParam(
  raw: string | string[] | undefined,
): BoardQueueFilter | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || v === "") return null;
  return (BOARD_QUEUE_FILTERS as readonly string[]).includes(v)
    ? (v as BoardQueueFilter)
    : null;
}

export function readBoardPrefsFromJson(raw: unknown): {
  queueFilter: BoardQueueFilter | null;
  sortMode: BoardSortMode | null;
  filterSupplierId: string | null;
  filterRequesterId: string | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { queueFilter: null, sortMode: null, filterSupplierId: null, filterRequesterId: null };
  }
  const o = raw as Record<string, unknown>;
  const q = o.queueFilter;
  const s = o.sortMode;
  const fs = o.filterSupplierId;
  const fr = o.filterRequesterId;
  return {
    queueFilter:
      typeof q === "string" && (BOARD_QUEUE_FILTERS as readonly string[]).includes(q)
        ? (q as BoardQueueFilter)
        : null,
    sortMode: s === "priority" || s === "newest" ? s : null,
    filterSupplierId: typeof fs === "string" && fs.trim() ? fs.trim() : null,
    filterRequesterId: typeof fr === "string" && fr.trim() ? fr.trim() : null,
  };
}

export function defaultBoardQueue(): BoardQueueFilter {
  return "needs_my_action";
}

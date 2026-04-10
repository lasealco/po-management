export const ORDERS_BOARD_PREF_KEY = "orders_board_v1";

export const BOARD_QUEUE_FILTERS = [
  "all",
  "needs_my_action",
  "waiting_on_me",
  "awaiting_supplier",
  "overdue",
  "split_pending_buyer",
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
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { queueFilter: null, sortMode: null };
  }
  const o = raw as Record<string, unknown>;
  const q = o.queueFilter;
  const s = o.sortMode;
  return {
    queueFilter:
      typeof q === "string" && (BOARD_QUEUE_FILTERS as readonly string[]).includes(q)
        ? (q as BoardQueueFilter)
        : null,
    sortMode: s === "priority" || s === "newest" ? s : null,
  };
}

export function defaultBoardQueue(): BoardQueueFilter {
  return "needs_my_action";
}

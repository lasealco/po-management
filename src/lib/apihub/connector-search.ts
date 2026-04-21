import type {
  ApiHubConnectorListSortField,
  ApiHubConnectorListSortOrder,
} from "@/lib/apihub/constants";

/** Max length for `q` on connector list (abuse guard). */
export const APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN = 128;

export type ConnectorNameSearchSortable = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectorListSortOptions = {
  field: ApiHubConnectorListSortField;
  order: ApiHubConnectorListSortOrder;
};

const DEFAULT_SEARCH_SORT: ConnectorListSortOptions = { field: "createdAt", order: "desc" };

export function compareConnectorListSortFields<T extends ConnectorNameSearchSortable>(
  a: T,
  b: T,
  field: ApiHubConnectorListSortField,
  order: ApiHubConnectorListSortOrder,
): number {
  const mul = order === "asc" ? 1 : -1;
  if (field === "name") {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * mul;
  }
  const va = field === "updatedAt" ? a.updatedAt.getTime() : a.createdAt.getTime();
  const vb = field === "updatedAt" ? b.updatedAt.getTime() : b.createdAt.getTime();
  return (va - vb) * mul;
}

/**
 * Search rank for ordering (lower = higher priority): exact name (case-insensitive),
 * then prefix, then substring-only.
 */
export function connectorNameSearchRank(name: string, qTrimmed: string): number {
  const needle = qTrimmed.toLowerCase();
  if (needle.length === 0) {
    return 2;
  }
  const n = name.toLowerCase();
  if (n === needle) {
    return 0;
  }
  if (n.startsWith(needle)) {
    return 1;
  }
  if (n.includes(needle)) {
    return 2;
  }
  return 3;
}

/**
 * When `q` is set: rank exact → prefix → contains, then apply `sort`/`order` within each rank,
 * then stable `id` tie-break (direction matches `order`).
 */
export function sortConnectorListRowsByNameSearch<T extends ConnectorNameSearchSortable>(
  rows: T[],
  qTrimmed: string,
  sort: ConnectorListSortOptions = DEFAULT_SEARCH_SORT,
): T[] {
  const needle = qTrimmed.trim();
  return [...rows].sort((a, b) => {
    const ra = connectorNameSearchRank(a.name, needle);
    const rb = connectorNameSearchRank(b.name, needle);
    if (ra !== rb) {
      return ra - rb;
    }
    const c = compareConnectorListSortFields(a, b, sort.field, sort.order);
    if (c !== 0) {
      return c;
    }
    return sort.order === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
}

/** Max length for `q` on connector list (abuse guard). */
export const APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN = 128;

export type ConnectorNameSearchSortable = {
  id: string;
  name: string;
  createdAt: Date;
};

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

/** Stable sort: rank asc, then newer `createdAt`, then `id` desc for ties. */
export function sortConnectorListRowsByNameSearch<T extends ConnectorNameSearchSortable>(
  rows: T[],
  qTrimmed: string,
): T[] {
  const needle = qTrimmed.trim();
  return [...rows].sort((a, b) => {
    const ra = connectorNameSearchRank(a.name, needle);
    const rb = connectorNameSearchRank(b.name, needle);
    if (ra !== rb) {
      return ra - rb;
    }
    const ca = a.createdAt.getTime();
    const cb = b.createdAt.getTime();
    if (ca !== cb) {
      return cb - ca;
    }
    return b.id.localeCompare(a.id);
  });
}

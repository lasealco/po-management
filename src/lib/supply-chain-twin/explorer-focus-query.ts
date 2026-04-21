const MAX_LEN = 128;

export type ExplorerFocusQueryParse =
  | { kind: "absent" }
  | { kind: "invalid"; message: string }
  | { kind: "ok"; snapshotId: string };

/**
 * Parses `focus` (or any single snapshot id query) for the twin explorer deep link (Slice 76).
 * Values are Prisma snapshot row ids — same shape as `snapshot` on the explorer page.
 */
export function parseExplorerSnapshotFocusQuery(raw: string | string[] | undefined): ExplorerFocusQueryParse {
  if (raw === undefined) {
    return { kind: "absent" };
  }
  const first = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (first === undefined) {
    return { kind: "absent" };
  }
  const s = first.trim();
  if (s.length === 0) {
    return { kind: "invalid", message: "The focus query is empty after trimming." };
  }
  if (s.length > MAX_LEN) {
    return { kind: "invalid", message: `The focus query is too long (max ${MAX_LEN} characters).` };
  }
  return { kind: "ok", snapshotId: s };
}

export function parseExplorerSnapshotQueryParam(raw: string | string[] | undefined): string | null {
  const r = parseExplorerSnapshotFocusQuery(raw);
  return r.kind === "ok" ? r.snapshotId : null;
}

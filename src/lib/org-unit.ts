import type { OrgUnit } from "@prisma/client";

/** Uppercase alphanumerics and hyphen; 2–32 chars. */
export function normalizeOrgUnitCode(raw: string): { ok: true; code: string } | { ok: false; error: string } {
  const t = raw.trim().toUpperCase();
  if (t.length < 2) return { ok: false, error: "Code must be at least 2 characters." };
  if (t.length > 32) return { ok: false, error: "Code must be at most 32 characters." };
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(t)) {
    return { ok: false, error: "Code may only contain A–Z, 0–9, and hyphens (no leading hyphen)." };
  }
  return { ok: true, code: t };
}

type FlatOrg = { id: string; parentId: string | null };

/**
 * `newParentId` must not be `nodeId` and must not be in the subtree of `nodeId`
 * (otherwise the tree would form a cycle).
 */
export function orgUnitReparentIsValid(
  flat: readonly FlatOrg[],
  nodeId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return true;
  if (newParentId === nodeId) return false;
  const byId = new Map(flat.map((o) => [o.id, o]));
  let cur: string | null = newParentId;
  for (let i = 0; i < 500 && cur; i++) {
    if (cur === nodeId) return false;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return true;
}

/**
 * Pre-order for stable UI: children sorted by `sortOrder` then `name` (call site).
 */
export type OrgUnitTreeRow = Pick<OrgUnit, "id" | "parentId" | "name" | "code" | "kind" | "sortOrder"> & {
  depth: number;
};

export function buildOrgUnitTree(
  units: Array<Pick<OrgUnit, "id" | "parentId" | "name" | "code" | "kind" | "sortOrder">>,
): OrgUnitTreeRow[] {
  const byParent = new Map<string | null, typeof units>();
  for (const u of units) {
    const k = u.parentId;
    const list = byParent.get(k) ?? [];
    list.push(u);
    byParent.set(k, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  }
  const out: OrgUnitTreeRow[] = [];
  function walk(p: string | null, depth: number) {
    for (const u of byParent.get(p) ?? []) {
      out.push({ ...u, depth });
      walk(u.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

export function orgUnitBreadcrumb(
  byId: Map<string, Pick<OrgUnit, "id" | "parentId" | "name" | "code">>,
  orgUnitId: string | null,
): string {
  if (!orgUnitId) return "—";
  const parts: string[] = [];
  let cur: string | null = orgUnitId;
  for (let i = 0; i < 50 && cur; i++) {
    const row = byId.get(cur);
    if (!row) break;
    parts.push(row.name);
    cur = row.parentId;
  }
  return parts.length ? parts.reverse().join(" → ") : "—";
}

/**
 * BF-04 — detect whether assigning `parentZoneId` would create a cycle (same warehouse zone DAG).
 */
export function warehouseZoneParentWouldCycle(
  zoneId: string,
  proposedParentId: string | null,
  rows: ReadonlyArray<{ id: string; parentZoneId: string | null }>,
): boolean {
  if (proposedParentId === null) return false;
  if (proposedParentId === zoneId) return true;
  const parentByZoneId = new Map(rows.map((r) => [r.id, r.parentZoneId]));
  parentByZoneId.set(zoneId, proposedParentId);
  let cur: string | null = proposedParentId;
  while (cur) {
    if (cur === zoneId) return true;
    cur = parentByZoneId.get(cur) ?? null;
  }
  return false;
}

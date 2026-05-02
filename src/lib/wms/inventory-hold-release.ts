import { userHasGlobalGrant } from "@/lib/authz";

/** BF-58 — per-balance release: standard holds need full inventory edit; restricted holds need matching grant or full inventory edit. */
export async function canActorReleaseInventoryHold(
  actorId: string,
  balanceHoldReleaseGrant: string | null | undefined,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const hasFull =
    (await userHasGlobalGrant(actorId, "org.wms", "edit")) ||
    (await userHasGlobalGrant(actorId, "org.wms.inventory", "edit"));

  const g = balanceHoldReleaseGrant?.trim() ?? "";
  if (!g) {
    if (!hasFull) {
      return {
        ok: false,
        status: 403,
        message:
          "Forbidden: clearing a standard hold requires org.wms → edit or org.wms.inventory → edit.",
      };
    }
    return { ok: true };
  }

  if (hasFull) return { ok: true };

  const hasSpecific = await userHasGlobalGrant(actorId, g, "edit");
  if (!hasSpecific) {
    return {
      ok: false,
      status: 403,
      message: `Forbidden: this hold requires ${g} → edit to release (or full inventory edit).`,
    };
  }
  return { ok: true };
}

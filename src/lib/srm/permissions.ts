import { getActorUserId, loadGlobalGrantsForUser, viewerHas } from "@/lib/authz";

/**
 * K: `org.suppliers` → **edit** or **approve** (not `view` alone) — shared by API redaction, list/search, and 360.
 */
export function canViewSupplierSensitiveFieldsForGrantSet(grantSet: Set<string>): boolean {
  return viewerHas(grantSet, "org.suppliers", "edit") || viewerHas(grantSet, "org.suppliers", "approve");
}

/**
 * For API routes after `requireApiGrant` passes: whether the current user may see procurement-sensitive
 * supplier data. **False** if there is no actor (should be rare once the gate allows the request through).
 */
export async function getCanViewSupplierSensitiveFieldsForActor(): Promise<boolean> {
  const actorId = await getActorUserId();
  if (!actorId) return false;
  const grantSet = await loadGlobalGrantsForUser(actorId);
  return canViewSupplierSensitiveFieldsForGrantSet(grantSet);
}

export type SrmPermissions = {
  canViewSuppliers: boolean;
  canEditSuppliers: boolean;
  canApproveSuppliers: boolean;
  canViewOrders: boolean;
  /**
   * Phase K: procurement-only fields (e.g. `internalNotes` on supplier) — not for pure
   * `org.suppliers` → `view` without edit/approve.
   */
  canViewSupplierSensitiveFields: boolean;
};

export function resolveSrmPermissions(grantSet: Set<string>): SrmPermissions {
  const canViewSuppliers = viewerHas(grantSet, "org.suppliers", "view");
  const canEditSuppliers = viewerHas(grantSet, "org.suppliers", "edit");
  const canApproveSuppliers = viewerHas(grantSet, "org.suppliers", "approve");
  return {
    canViewSuppliers,
    canEditSuppliers,
    canApproveSuppliers,
    canViewOrders: canViewSuppliers && viewerHas(grantSet, "org.orders", "view"),
    canViewSupplierSensitiveFields: canViewSupplierSensitiveFieldsForGrantSet(grantSet),
  };
}

import { viewerHas } from "@/lib/authz";

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
    canViewSupplierSensitiveFields: canEditSuppliers || canApproveSuppliers,
  };
}

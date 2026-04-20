import { viewerHas } from "@/lib/authz";

export type SrmPermissions = {
  canViewSuppliers: boolean;
  canEditSuppliers: boolean;
  canApproveSuppliers: boolean;
  canViewOrders: boolean;
};

export function resolveSrmPermissions(grantSet: Set<string>): SrmPermissions {
  const canViewSuppliers = viewerHas(grantSet, "org.suppliers", "view");
  return {
    canViewSuppliers,
    canEditSuppliers: viewerHas(grantSet, "org.suppliers", "edit"),
    canApproveSuppliers: viewerHas(grantSet, "org.suppliers", "approve"),
    canViewOrders: canViewSuppliers && viewerHas(grantSet, "org.orders", "view"),
  };
}

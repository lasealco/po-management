import { SupplierApprovalStatus } from "@prisma/client";

/** Suppliers used on POs, as forwarders, etc. must be active and approved. */
export function supplierOperationalBlockReason(s: {
  isActive: boolean;
  approvalStatus: SupplierApprovalStatus;
}): string | null {
  if (!s.isActive) {
    return "Supplier is inactive and cannot be used on new purchase orders or as a forwarder.";
  }
  if (s.approvalStatus === SupplierApprovalStatus.pending_approval) {
    return "Supplier is pending approval and cannot be used on new purchase orders or as a forwarder.";
  }
  if (s.approvalStatus === SupplierApprovalStatus.rejected) {
    return "Supplier was rejected and cannot be used on new purchase orders or as a forwarder.";
  }
  return null;
}

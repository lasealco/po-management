import { SupplierApprovalStatus, SrmSupplierCategory } from "@prisma/client";

import type { SupplierMasterUpsertPayload } from "@/lib/srm/srm-supplier-master-upsert-payload";

/**
 * Result of mapping an already-validated {@link SupplierMasterUpsertPayload} into
 * `Supplier` write shapes. Callers merge into Prisma create/update and enforce tenant auth,
 * onboarding activation rules, and idempotent upsert by `tenantId` + `code`.
 *
 * **Not mapped here:** `entity` (no dedicated column — merge into notes in a future slice if needed).
 */

export type SupplierMasterUpsertMappedFields = {
  /** Maps to `Supplier.code` (per-tenant natural key for matching). */
  code: string;
  legalName?: string;
  registeredCountryCode?: string;
  srmCategory?: SrmSupplierCategory;
  isActive?: boolean;
  approvalStatus?: SupplierApprovalStatus;
};

/**
 * Maps integration payload → fields commonly written on `Supplier`.
 * Omitted keys mean “leave existing DB values unchanged” on PATCH-style upserts.
 */
export function mapSupplierMasterUpsertToSupplierFields(
  p: SupplierMasterUpsertPayload,
): SupplierMasterUpsertMappedFields {
  const out: SupplierMasterUpsertMappedFields = {
    code: p.supplierCode,
  };

  if (p.legalName != null) {
    out.legalName = p.legalName;
  }
  if (p.countryCode != null) {
    out.registeredCountryCode = p.countryCode;
  }
  if (p.srmCategory === "logistics") {
    out.srmCategory = SrmSupplierCategory.logistics;
  } else if (p.srmCategory === "product") {
    out.srmCategory = SrmSupplierCategory.product;
  }

  switch (p.integrationStatus) {
    case null:
      break;
    case "active":
    case "approved":
      out.isActive = true;
      out.approvalStatus = SupplierApprovalStatus.approved;
      break;
    case "inactive":
      out.isActive = false;
      out.approvalStatus = SupplierApprovalStatus.approved;
      break;
    case "pending_approval":
      out.isActive = false;
      out.approvalStatus = SupplierApprovalStatus.pending_approval;
      break;
    case "rejected":
      out.isActive = false;
      out.approvalStatus = SupplierApprovalStatus.rejected;
      break;
    case "suspended":
      out.isActive = false;
      out.approvalStatus = SupplierApprovalStatus.approved;
      break;
    default:
      break;
  }

  return out;
}

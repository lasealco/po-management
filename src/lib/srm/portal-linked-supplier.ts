import type {
  SrmOnboardingStage,
  SrmSupplierCategory,
  SupplierApprovalStatus,
} from "@prisma/client";

import { actorIsSupplierPortalRestricted } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const supplierPortalSelect = {
  id: true,
  code: true,
  name: true,
  legalName: true,
  email: true,
  phone: true,
  approvalStatus: true,
  srmOnboardingStage: true,
  srmCategory: true,
  registeredCity: true,
  registeredRegion: true,
  registeredCountryCode: true,
  website: true,
} as const;

export type PortalLinkedSupplierSummary = {
  id: string;
  code: string | null;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  approvalStatus: SupplierApprovalStatus;
  srmOnboardingStage: SrmOnboardingStage;
  srmCategory: SrmSupplierCategory;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredCountryCode: string | null;
  website: string | null;
};

export type LoadPortalLinkedSupplierResult =
  | { ok: true; supplier: PortalLinkedSupplierSummary }
  | { ok: false; reason: "not_portal" | "not_linked" | "not_found" };

/**
 * Resolves the supplier org for a **Supplier portal** user (`portalLinkedSupplierId`), tenant-safe.
 */
export async function loadPortalLinkedSupplier(
  actorUserId: string,
): Promise<LoadPortalLinkedSupplierResult> {
  if (!(await actorIsSupplierPortalRestricted(actorUserId))) {
    return { ok: false, reason: "not_portal" };
  }
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { tenantId: true, portalLinkedSupplierId: true },
  });
  if (!user?.portalLinkedSupplierId) {
    return { ok: false, reason: "not_linked" };
  }
  const supplier = await prisma.supplier.findFirst({
    where: { id: user.portalLinkedSupplierId, tenantId: user.tenantId },
    select: supplierPortalSelect,
  });
  if (!supplier) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, supplier };
}

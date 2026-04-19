import type { TariffApprovalStatus, TariffContractStatus } from "@prisma/client";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

/** Matches DB trigger: both approval and lifecycle status are APPROVED. */
export function isTariffContractVersionFrozen(version: {
  approvalStatus: TariffApprovalStatus;
  status: TariffContractStatus;
}): boolean {
  return version.approvalStatus === "APPROVED" && version.status === "APPROVED";
}

/** Use before mutating rate lines, charge lines, or free-time rules for a version. */
export function assertTariffVersionAllowsLineMutations(version: {
  approvalStatus: TariffApprovalStatus;
  status: TariffContractStatus;
}): void {
  if (isTariffContractVersionFrozen(version)) {
    throw new TariffRepoError(
      "VERSION_FROZEN",
      "This contract version is approved and frozen; rate lines, charge lines, and free-time rules cannot be changed.",
    );
  }
}

/** Use before updating the contract_versions row (metadata, dates, etc.). */
export function assertTariffVersionRowMutable(version: {
  approvalStatus: TariffApprovalStatus;
  status: TariffContractStatus;
}): void {
  if (isTariffContractVersionFrozen(version)) {
    throw new TariffRepoError(
      "VERSION_FROZEN",
      "This contract version is approved and frozen; the version record cannot be updated.",
    );
  }
}

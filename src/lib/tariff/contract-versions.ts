import type {
  Prisma,
  TariffApprovalStatus,
  TariffContractStatus,
  TariffSourceType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { assertTariffVersionRowMutable } from "@/lib/tariff/version-guards";

const versionSelectForGuard = {
  id: true,
  contractHeaderId: true,
  versionNo: true,
  sourceType: true,
  sourceReference: true,
  sourceFileUrl: true,
  approvalStatus: true,
  status: true,
  validFrom: true,
  validTo: true,
  bookingDateValidFrom: true,
  bookingDateValidTo: true,
  sailingDateValidFrom: true,
  sailingDateValidTo: true,
  comments: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TariffContractVersionRow = Prisma.TariffContractVersionGetPayload<{
  select: typeof versionSelectForGuard;
}>;

/** Version row scoped to tenant via contract header. */
export async function getTariffContractVersionForTenant(params: {
  tenantId: string;
  versionId: string;
}): Promise<TariffContractVersionRow | null> {
  return prisma.tariffContractVersion.findFirst({
    where: { id: params.versionId, contractHeader: { tenantId: params.tenantId } },
    select: versionSelectForGuard,
  });
}

export async function requireTariffContractVersionForTenant(params: {
  tenantId: string;
  versionId: string;
}): Promise<TariffContractVersionRow> {
  const row = await getTariffContractVersionForTenant(params);
  if (!row) throw new TariffRepoError("NOT_FOUND", "Contract version not found for this tenant.");
  return row;
}

/** Fetches version for tenant and ensures it is not frozen (for line mutations or version updates). */
export async function requireMutableTariffContractVersionForTenant(params: {
  tenantId: string;
  versionId: string;
}): Promise<TariffContractVersionRow> {
  const row = await requireTariffContractVersionForTenant(params);
  assertTariffVersionRowMutable(row);
  return row;
}

export async function listTariffContractVersionsForHeader(params: {
  tenantId: string;
  contractHeaderId: string;
}) {
  const header = await prisma.tariffContractHeader.findFirst({
    where: { id: params.contractHeaderId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!header) throw new TariffRepoError("NOT_FOUND", "Contract header not found for this tenant.");

  return prisma.tariffContractVersion.findMany({
    where: { contractHeaderId: params.contractHeaderId },
    orderBy: { versionNo: "desc" },
  });
}

export async function createTariffContractVersion(input: {
  tenantId: string;
  contractHeaderId: string;
  sourceType: TariffSourceType;
  sourceReference?: string | null;
  sourceFileUrl?: string | null;
  approvalStatus?: TariffApprovalStatus;
  status?: TariffContractStatus;
  validFrom?: Date | null;
  validTo?: Date | null;
  bookingDateValidFrom?: Date | null;
  bookingDateValidTo?: Date | null;
  sailingDateValidFrom?: Date | null;
  sailingDateValidTo?: Date | null;
  comments?: string | null;
}) {
  const header = await prisma.tariffContractHeader.findFirst({
    where: { id: input.contractHeaderId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!header) throw new TariffRepoError("NOT_FOUND", "Contract header not found for this tenant.");

  const agg = await prisma.tariffContractVersion.aggregate({
    where: { contractHeaderId: input.contractHeaderId },
    _max: { versionNo: true },
  });
  const nextNo = (agg._max.versionNo ?? 0) + 1;

  return prisma.tariffContractVersion.create({
    data: {
      contractHeaderId: input.contractHeaderId,
      versionNo: nextNo,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference?.trim() || null,
      sourceFileUrl: input.sourceFileUrl?.trim() || null,
      approvalStatus: input.approvalStatus ?? "PENDING",
      status: input.status ?? "DRAFT",
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      bookingDateValidFrom: input.bookingDateValidFrom ?? null,
      bookingDateValidTo: input.bookingDateValidTo ?? null,
      sailingDateValidFrom: input.sailingDateValidFrom ?? null,
      sailingDateValidTo: input.sailingDateValidTo ?? null,
      comments: input.comments?.trim() || null,
    },
  });
}

/** Applies `assertTariffVersionRowMutable` so fully approved versions cannot change. */
export async function updateTariffContractVersion(
  params: { tenantId: string; versionId: string },
  patch: Partial<{
    sourceType: TariffSourceType;
    sourceReference: string | null;
    sourceFileUrl: string | null;
    approvalStatus: TariffApprovalStatus;
    status: TariffContractStatus;
    validFrom: Date | null;
    validTo: Date | null;
    bookingDateValidFrom: Date | null;
    bookingDateValidTo: Date | null;
    sailingDateValidFrom: Date | null;
    sailingDateValidTo: Date | null;
    comments: string | null;
  }>,
) {
  const current = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: params.versionId,
  });
  assertTariffVersionRowMutable(current);

  return prisma.tariffContractVersion.update({
    where: { id: params.versionId },
    data: {
      ...(patch.sourceType != null ? { sourceType: patch.sourceType } : {}),
      ...(patch.sourceReference !== undefined ? { sourceReference: patch.sourceReference?.trim() || null } : {}),
      ...(patch.sourceFileUrl !== undefined ? { sourceFileUrl: patch.sourceFileUrl?.trim() || null } : {}),
      ...(patch.approvalStatus != null ? { approvalStatus: patch.approvalStatus } : {}),
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
      ...(patch.bookingDateValidFrom !== undefined ? { bookingDateValidFrom: patch.bookingDateValidFrom } : {}),
      ...(patch.bookingDateValidTo !== undefined ? { bookingDateValidTo: patch.bookingDateValidTo } : {}),
      ...(patch.sailingDateValidFrom !== undefined ? { sailingDateValidFrom: patch.sailingDateValidFrom } : {}),
      ...(patch.sailingDateValidTo !== undefined ? { sailingDateValidTo: patch.sailingDateValidTo } : {}),
      ...(patch.comments !== undefined ? { comments: patch.comments?.trim() || null } : {}),
    },
  });
}

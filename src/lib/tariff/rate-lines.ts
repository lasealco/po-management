import type { Prisma, TariffLineRateType } from "@prisma/client";
import { Prisma as PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireMutableTariffContractVersionForTenant, requireTariffContractVersionForTenant } from "@/lib/tariff/contract-versions";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { assertTariffVersionAllowsLineMutations } from "@/lib/tariff/version-guards";

export async function listTariffRateLinesForTenantVersion(params: {
  tenantId: string;
  contractVersionId: string;
}) {
  const ok = await prisma.tariffContractVersion.findFirst({
    where: { id: params.contractVersionId, contractHeader: { tenantId: params.tenantId } },
    select: { id: true },
  });
  if (!ok) throw new TariffRepoError("NOT_FOUND", "Contract version not found for this tenant.");

  return prisma.tariffRateLine.findMany({
    where: { contractVersionId: params.contractVersionId },
    orderBy: { id: "asc" },
  });
}

export async function getTariffRateLineForTenant(params: { tenantId: string; id: string }) {
  const row = await prisma.tariffRateLine.findFirst({
    where: {
      id: params.id,
      contractVersion: { contractHeader: { tenantId: params.tenantId } },
    },
    include: { contractVersion: { select: { approvalStatus: true, status: true, id: true } } },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Rate line not found for this tenant.");
  return row;
}

export async function createTariffRateLine(input: {
  tenantId: string;
  contractVersionId: string;
  originScopeId?: string | null;
  destinationScopeId?: string | null;
  rateType: TariffLineRateType;
  equipmentType?: string | null;
  commodityScope?: string | null;
  serviceScope?: string | null;
  unitBasis: string;
  currency: string;
  amount: number | string | PrismaClient.Decimal;
  includedChargeSet?: Prisma.InputJsonValue | null;
  excludedChargeSet?: Prisma.InputJsonValue | null;
  rawRateDescription?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  notes?: string | null;
}) {
  await requireMutableTariffContractVersionForTenant({
    tenantId: input.tenantId,
    versionId: input.contractVersionId,
  });

  const amount =
    typeof input.amount === "object" && input.amount != null && "toFixed" in input.amount
      ? (input.amount as PrismaClient.Decimal)
      : new PrismaClient.Decimal(String(input.amount));

  return prisma.tariffRateLine.create({
    data: {
      contractVersionId: input.contractVersionId,
      originScopeId: input.originScopeId ?? null,
      destinationScopeId: input.destinationScopeId ?? null,
      rateType: input.rateType,
      equipmentType: input.equipmentType?.trim() || null,
      commodityScope: input.commodityScope?.trim() || null,
      serviceScope: input.serviceScope?.trim() || null,
      unitBasis: input.unitBasis.trim(),
      currency: input.currency.trim().toUpperCase().slice(0, 3),
      amount,
      includedChargeSet: input.includedChargeSet ?? undefined,
      excludedChargeSet: input.excludedChargeSet ?? undefined,
      rawRateDescription: input.rawRateDescription?.trim() || null,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateTariffRateLine(
  params: { tenantId: string; id: string },
  patch: Partial<{
    originScopeId: string | null;
    destinationScopeId: string | null;
    rateType: TariffLineRateType;
    equipmentType: string | null;
    commodityScope: string | null;
    serviceScope: string | null;
    unitBasis: string;
    currency: string;
    amount: number | string | PrismaClient.Decimal;
    includedChargeSet: Prisma.InputJsonValue | null;
    excludedChargeSet: Prisma.InputJsonValue | null;
    rawRateDescription: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    notes: string | null;
  }>,
) {
  const row = await getTariffRateLineForTenant(params);
  const version = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: row.contractVersionId,
  });
  assertTariffVersionAllowsLineMutations(version);

  const amount =
    patch.amount != null
      ? typeof patch.amount === "object" && patch.amount != null && "toFixed" in patch.amount
        ? (patch.amount as PrismaClient.Decimal)
        : new PrismaClient.Decimal(String(patch.amount))
      : undefined;

  return prisma.tariffRateLine.update({
    where: { id: params.id },
    data: {
      ...(patch.originScopeId !== undefined ? { originScopeId: patch.originScopeId } : {}),
      ...(patch.destinationScopeId !== undefined ? { destinationScopeId: patch.destinationScopeId } : {}),
      ...(patch.rateType != null ? { rateType: patch.rateType } : {}),
      ...(patch.equipmentType !== undefined ? { equipmentType: patch.equipmentType?.trim() || null } : {}),
      ...(patch.commodityScope !== undefined ? { commodityScope: patch.commodityScope?.trim() || null } : {}),
      ...(patch.serviceScope !== undefined ? { serviceScope: patch.serviceScope?.trim() || null } : {}),
      ...(patch.unitBasis != null ? { unitBasis: patch.unitBasis.trim() } : {}),
      ...(patch.currency != null ? { currency: patch.currency.trim().toUpperCase().slice(0, 3) } : {}),
      ...(amount != null ? { amount } : {}),
      ...(patch.includedChargeSet !== undefined
        ? { includedChargeSet: patch.includedChargeSet === null ? PrismaClient.JsonNull : patch.includedChargeSet }
        : {}),
      ...(patch.excludedChargeSet !== undefined
        ? { excludedChargeSet: patch.excludedChargeSet === null ? PrismaClient.JsonNull : patch.excludedChargeSet }
        : {}),
      ...(patch.rawRateDescription !== undefined ? { rawRateDescription: patch.rawRateDescription?.trim() || null } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    },
  });
}

export async function deleteTariffRateLine(params: { tenantId: string; id: string }) {
  const row = await getTariffRateLineForTenant(params);
  const version = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: row.contractVersionId,
  });
  assertTariffVersionAllowsLineMutations(version);
  await prisma.tariffRateLine.delete({ where: { id: params.id } });
}

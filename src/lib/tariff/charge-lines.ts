import { Prisma as PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  requireMutableTariffContractVersionForTenant,
  requireTariffContractVersionForTenant,
} from "@/lib/tariff/contract-versions";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { assertTariffVersionAllowsLineMutations } from "@/lib/tariff/version-guards";

export async function listTariffChargeLinesForTenantVersion(params: {
  tenantId: string;
  contractVersionId: string;
}) {
  const ok = await prisma.tariffContractVersion.findFirst({
    where: { id: params.contractVersionId, contractHeader: { tenantId: params.tenantId } },
    select: { id: true },
  });
  if (!ok) throw new TariffRepoError("NOT_FOUND", "Contract version not found for this tenant.");

  return prisma.tariffChargeLine.findMany({
    where: { contractVersionId: params.contractVersionId },
    orderBy: { id: "asc" },
    include: {
      normalizedChargeCode: { select: { id: true, code: true, displayName: true } },
    },
  });
}

export async function getTariffChargeLineForTenant(params: { tenantId: string; id: string }) {
  const row = await prisma.tariffChargeLine.findFirst({
    where: {
      id: params.id,
      contractVersion: { contractHeader: { tenantId: params.tenantId } },
    },
    include: {
      contractVersion: { select: { approvalStatus: true, status: true, id: true } },
      normalizedChargeCode: { select: { id: true, code: true, displayName: true } },
    },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Charge line not found for this tenant.");
  return row;
}

export async function createTariffChargeLine(input: {
  tenantId: string;
  contractVersionId: string;
  normalizedChargeCodeId?: string | null;
  rawChargeName: string;
  geographyScopeId?: string | null;
  directionScope?: string | null;
  equipmentScope?: string | null;
  conditionScope?: string | null;
  unitBasis: string;
  currency: string;
  amount: number | string | PrismaClient.Decimal;
  isIncluded?: boolean;
  isMandatory?: boolean;
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

  return prisma.tariffChargeLine.create({
    data: {
      contractVersionId: input.contractVersionId,
      normalizedChargeCodeId: input.normalizedChargeCodeId ?? null,
      rawChargeName: input.rawChargeName.trim(),
      geographyScopeId: input.geographyScopeId ?? null,
      directionScope: input.directionScope?.trim() || null,
      equipmentScope: input.equipmentScope?.trim() || null,
      conditionScope: input.conditionScope?.trim() || null,
      unitBasis: input.unitBasis.trim(),
      currency: input.currency.trim().toUpperCase().slice(0, 3),
      amount,
      isIncluded: input.isIncluded ?? false,
      isMandatory: input.isMandatory ?? true,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateTariffChargeLine(
  params: { tenantId: string; id: string },
  patch: Partial<{
    normalizedChargeCodeId: string | null;
    rawChargeName: string;
    geographyScopeId: string | null;
    directionScope: string | null;
    equipmentScope: string | null;
    conditionScope: string | null;
    unitBasis: string;
    currency: string;
    amount: number | string | PrismaClient.Decimal;
    isIncluded: boolean;
    isMandatory: boolean;
    validFrom: Date | null;
    validTo: Date | null;
    notes: string | null;
  }>,
) {
  const row = await getTariffChargeLineForTenant(params);
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

  return prisma.tariffChargeLine.update({
    where: { id: params.id },
    data: {
      ...(patch.normalizedChargeCodeId !== undefined ? { normalizedChargeCodeId: patch.normalizedChargeCodeId } : {}),
      ...(patch.rawChargeName != null ? { rawChargeName: patch.rawChargeName.trim() } : {}),
      ...(patch.geographyScopeId !== undefined ? { geographyScopeId: patch.geographyScopeId } : {}),
      ...(patch.directionScope !== undefined ? { directionScope: patch.directionScope?.trim() || null } : {}),
      ...(patch.equipmentScope !== undefined ? { equipmentScope: patch.equipmentScope?.trim() || null } : {}),
      ...(patch.conditionScope !== undefined ? { conditionScope: patch.conditionScope?.trim() || null } : {}),
      ...(patch.unitBasis != null ? { unitBasis: patch.unitBasis.trim() } : {}),
      ...(patch.currency != null ? { currency: patch.currency.trim().toUpperCase().slice(0, 3) } : {}),
      ...(amount != null ? { amount } : {}),
      ...(patch.isIncluded !== undefined ? { isIncluded: patch.isIncluded } : {}),
      ...(patch.isMandatory !== undefined ? { isMandatory: patch.isMandatory } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    },
  });
}

export async function deleteTariffChargeLine(params: { tenantId: string; id: string }) {
  const row = await getTariffChargeLineForTenant(params);
  const version = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: row.contractVersionId,
  });
  assertTariffVersionAllowsLineMutations(version);
  await prisma.tariffChargeLine.delete({ where: { id: params.id } });
}

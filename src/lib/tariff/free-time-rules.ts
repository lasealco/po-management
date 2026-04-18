import type { TariffRuleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  requireMutableTariffContractVersionForTenant,
  requireTariffContractVersionForTenant,
} from "@/lib/tariff/contract-versions";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { assertTariffVersionAllowsLineMutations } from "@/lib/tariff/version-guards";

export async function listTariffFreeTimeRulesForTenantVersion(params: {
  tenantId: string;
  contractVersionId: string;
}) {
  const ok = await prisma.tariffContractVersion.findFirst({
    where: { id: params.contractVersionId, contractHeader: { tenantId: params.tenantId } },
    select: { id: true },
  });
  if (!ok) throw new TariffRepoError("NOT_FOUND", "Contract version not found for this tenant.");

  return prisma.tariffFreeTimeRule.findMany({
    where: { contractVersionId: params.contractVersionId },
    orderBy: { id: "asc" },
  });
}

export async function getTariffFreeTimeRuleForTenant(params: { tenantId: string; id: string }) {
  const row = await prisma.tariffFreeTimeRule.findFirst({
    where: {
      id: params.id,
      contractVersion: { contractHeader: { tenantId: params.tenantId } },
    },
    include: { contractVersion: { select: { approvalStatus: true, status: true, id: true } } },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Free-time rule not found for this tenant.");
  return row;
}

export async function createTariffFreeTimeRule(input: {
  tenantId: string;
  contractVersionId: string;
  geographyScopeId?: string | null;
  importExportScope?: string | null;
  equipmentScope?: string | null;
  ruleType: TariffRuleType;
  freeDays: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  notes?: string | null;
}) {
  await requireMutableTariffContractVersionForTenant({
    tenantId: input.tenantId,
    versionId: input.contractVersionId,
  });

  if (!Number.isFinite(input.freeDays) || input.freeDays < 0) {
    throw new TariffRepoError("CONFLICT", "freeDays must be a non-negative integer.");
  }

  return prisma.tariffFreeTimeRule.create({
    data: {
      contractVersionId: input.contractVersionId,
      geographyScopeId: input.geographyScopeId ?? null,
      importExportScope: input.importExportScope?.trim() || null,
      equipmentScope: input.equipmentScope?.trim() || null,
      ruleType: input.ruleType,
      freeDays: Math.floor(input.freeDays),
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateTariffFreeTimeRule(
  params: { tenantId: string; id: string },
  patch: Partial<{
    geographyScopeId: string | null;
    importExportScope: string | null;
    equipmentScope: string | null;
    ruleType: TariffRuleType;
    freeDays: number;
    validFrom: Date | null;
    validTo: Date | null;
    notes: string | null;
  }>,
) {
  const row = await getTariffFreeTimeRuleForTenant(params);
  const version = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: row.contractVersionId,
  });
  assertTariffVersionAllowsLineMutations(version);

  if (patch.freeDays != null && (!Number.isFinite(patch.freeDays) || patch.freeDays < 0)) {
    throw new TariffRepoError("CONFLICT", "freeDays must be a non-negative integer.");
  }

  return prisma.tariffFreeTimeRule.update({
    where: { id: params.id },
    data: {
      ...(patch.geographyScopeId !== undefined ? { geographyScopeId: patch.geographyScopeId } : {}),
      ...(patch.importExportScope !== undefined ? { importExportScope: patch.importExportScope?.trim() || null } : {}),
      ...(patch.equipmentScope !== undefined ? { equipmentScope: patch.equipmentScope?.trim() || null } : {}),
      ...(patch.ruleType != null ? { ruleType: patch.ruleType } : {}),
      ...(patch.freeDays != null ? { freeDays: Math.floor(patch.freeDays) } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    },
  });
}

export async function deleteTariffFreeTimeRule(params: { tenantId: string; id: string }) {
  const row = await getTariffFreeTimeRuleForTenant(params);
  const version = await requireTariffContractVersionForTenant({
    tenantId: params.tenantId,
    versionId: row.contractVersionId,
  });
  assertTariffVersionAllowsLineMutations(version);
  await prisma.tariffFreeTimeRule.delete({ where: { id: params.id } });
}

import type { Prisma, ScriTenantTuning, TwinRiskSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeGeoAliasMap } from "@/lib/scri/geo-alias-map";

export type ScriTuningDto = {
  sourceTrustMin: number | null;
  severityHighlightMin: TwinRiskSeverity | null;
  geoAliases: Record<string, string>;
  automationAutoWatch: boolean;
  automationMinSeverity: TwinRiskSeverity;
  automationActorUserId: string | null;
};

export function tuningRowToDto(row: ScriTenantTuning): ScriTuningDto {
  return {
    sourceTrustMin: row.sourceTrustMin,
    severityHighlightMin: row.severityHighlightMin,
    geoAliases: normalizeGeoAliasMap(row.geoAliases),
    automationAutoWatch: row.automationAutoWatch,
    automationMinSeverity: row.automationMinSeverity,
    automationActorUserId: row.automationActorUserId,
  };
}

export const DEFAULT_SCRI_TUNING_DTO: ScriTuningDto = {
  sourceTrustMin: null,
  severityHighlightMin: null,
  geoAliases: {},
  automationAutoWatch: false,
  automationMinSeverity: "MEDIUM",
  automationActorUserId: null,
};

export async function getScriTuningForTenant(tenantId: string): Promise<{
  row: ScriTenantTuning | null;
  dto: ScriTuningDto;
}> {
  const row = await prisma.scriTenantTuning.findUnique({ where: { tenantId } });
  return { row, dto: row ? tuningRowToDto(row) : DEFAULT_SCRI_TUNING_DTO };
}

export type UpsertScriTuningInput = {
  sourceTrustMin?: number | null;
  severityHighlightMin?: TwinRiskSeverity | null;
  geoAliases?: Record<string, string>;
  automationAutoWatch?: boolean;
  automationMinSeverity?: TwinRiskSeverity;
  automationActorUserId?: string | null;
};

export async function upsertScriTuningForTenant(
  tenantId: string,
  input: UpsertScriTuningInput,
): Promise<ScriTenantTuning> {
  const geoAliases = input.geoAliases != null ? normalizeGeoAliasMap(input.geoAliases) : undefined;
  const data: Prisma.ScriTenantTuningUncheckedUpdateInput = {};
  if (input.sourceTrustMin !== undefined) data.sourceTrustMin = input.sourceTrustMin;
  if (input.severityHighlightMin !== undefined) data.severityHighlightMin = input.severityHighlightMin;
  if (geoAliases !== undefined) data.geoAliases = geoAliases as Prisma.InputJsonValue;
  if (input.automationAutoWatch !== undefined) data.automationAutoWatch = input.automationAutoWatch;
  if (input.automationMinSeverity !== undefined) data.automationMinSeverity = input.automationMinSeverity;
  if (input.automationActorUserId !== undefined) data.automationActorUserId = input.automationActorUserId;

  return prisma.scriTenantTuning.upsert({
    where: { tenantId },
    create: {
      tenantId,
      sourceTrustMin: input.sourceTrustMin ?? null,
      severityHighlightMin: input.severityHighlightMin ?? null,
      geoAliases: (geoAliases ?? {}) as Prisma.InputJsonValue,
      automationAutoWatch: input.automationAutoWatch ?? false,
      automationMinSeverity: input.automationMinSeverity ?? "MEDIUM",
      automationActorUserId: input.automationActorUserId ?? null,
    },
    update: data,
  });
}

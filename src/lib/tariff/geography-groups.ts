import type { Prisma, TariffGeographyType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

/** Exported for unit tests; used by create/update geography group. */
export function assertTariffGeographyValidityWindow(
  validFrom: Date | null | undefined,
  validTo: Date | null | undefined,
): void {
  if (validFrom != null && validTo != null && validFrom.getTime() > validTo.getTime()) {
    throw new TariffRepoError("BAD_INPUT", "validFrom must be on or before validTo.");
  }
}

export async function listTariffGeographyGroups(params?: {
  activeOnly?: boolean;
  take?: number;
}): Promise<Awaited<ReturnType<typeof prisma.tariffGeographyGroup.findMany>>> {
  const take = Math.min(params?.take ?? 200, 500);
  const where: Prisma.TariffGeographyGroupWhereInput = {};
  if (params?.activeOnly) where.active = true;
  return prisma.tariffGeographyGroup.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take,
  });
}

export async function getTariffGeographyGroupById(id: string) {
  const row = await prisma.tariffGeographyGroup.findUnique({
    where: { id },
    include: { members: { orderBy: { memberCode: "asc" } } },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Geography group not found.");
  return row;
}

export async function createTariffGeographyGroup(input: {
  geographyType: TariffGeographyType;
  name: string;
  code?: string | null;
  aliasSource?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  active?: boolean;
}) {
  assertTariffGeographyValidityWindow(input.validFrom ?? null, input.validTo ?? null);
  return prisma.tariffGeographyGroup.create({
    data: {
      geographyType: input.geographyType,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      aliasSource: input.aliasSource?.trim() || null,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      active: input.active ?? true,
    },
  });
}

export async function updateTariffGeographyGroup(
  id: string,
  patch: Partial<{
    geographyType: TariffGeographyType;
    name: string;
    code: string | null;
    aliasSource: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    active: boolean;
  }>,
) {
  const existing = await prisma.tariffGeographyGroup.findUnique({
    where: { id },
    select: { id: true, validFrom: true, validTo: true },
  });
  if (!existing) throw new TariffRepoError("NOT_FOUND", "Geography group not found.");
  const nextFrom = patch.validFrom !== undefined ? patch.validFrom : existing.validFrom;
  const nextTo = patch.validTo !== undefined ? patch.validTo : existing.validTo;
  assertTariffGeographyValidityWindow(nextFrom, nextTo);
  return prisma.tariffGeographyGroup.update({
    where: { id },
    data: {
      ...(patch.geographyType != null ? { geographyType: patch.geographyType } : {}),
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.code !== undefined ? { code: patch.code?.trim() || null } : {}),
      ...(patch.aliasSource !== undefined ? { aliasSource: patch.aliasSource?.trim() || null } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    },
  });
}

export async function deleteTariffGeographyGroup(id: string) {
  const existing = await prisma.tariffGeographyGroup.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new TariffRepoError("NOT_FOUND", "Geography group not found.");
  await prisma.tariffGeographyGroup.delete({ where: { id } });
}

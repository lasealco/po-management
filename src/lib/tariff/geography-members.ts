import type { TariffGeographyType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffGeographyMembersForGroup(geographyGroupId: string) {
  await assertGeographyGroupExists(geographyGroupId);
  return prisma.tariffGeographyMember.findMany({
    where: { geographyGroupId },
    orderBy: { memberCode: "asc" },
  });
}

async function assertGeographyGroupExists(id: string) {
  const g = await prisma.tariffGeographyGroup.findUnique({ where: { id }, select: { id: true } });
  if (!g) throw new TariffRepoError("NOT_FOUND", "Geography group not found.");
}

export async function getTariffGeographyMemberById(id: string) {
  const row = await prisma.tariffGeographyMember.findUnique({ where: { id } });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Geography member not found.");
  return row;
}

export async function createTariffGeographyMember(input: {
  geographyGroupId: string;
  memberCode: string;
  memberName?: string | null;
  memberType: TariffGeographyType;
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  await assertGeographyGroupExists(input.geographyGroupId);
  return prisma.tariffGeographyMember.create({
    data: {
      geographyGroupId: input.geographyGroupId,
      memberCode: input.memberCode.trim(),
      memberName: input.memberName?.trim() || null,
      memberType: input.memberType,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
    },
  });
}

export async function updateTariffGeographyMember(
  id: string,
  patch: Partial<{
    memberCode: string;
    memberName: string | null;
    memberType: TariffGeographyType;
    validFrom: Date | null;
    validTo: Date | null;
  }>,
  scope?: { geographyGroupId: string },
) {
  const row = scope
    ? await prisma.tariffGeographyMember.findFirst({
        where: { id, geographyGroupId: scope.geographyGroupId },
        select: { id: true },
      })
    : await prisma.tariffGeographyMember.findUnique({ where: { id }, select: { id: true } });
  if (!row) {
    throw new TariffRepoError(
      "NOT_FOUND",
      scope ? "Geography member not found for this group." : "Geography member not found.",
    );
  }
  return prisma.tariffGeographyMember.update({
    where: { id },
    data: {
      ...(patch.memberCode != null ? { memberCode: patch.memberCode.trim() } : {}),
      ...(patch.memberName !== undefined ? { memberName: patch.memberName?.trim() || null } : {}),
      ...(patch.memberType != null ? { memberType: patch.memberType } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validTo !== undefined ? { validTo: patch.validTo } : {}),
    },
  });
}

export async function deleteTariffGeographyMember(id: string, scope?: { geographyGroupId: string }) {
  const row = scope
    ? await prisma.tariffGeographyMember.findFirst({
        where: { id, geographyGroupId: scope.geographyGroupId },
        select: { id: true },
      })
    : await prisma.tariffGeographyMember.findUnique({ where: { id }, select: { id: true } });
  if (!row) {
    throw new TariffRepoError(
      "NOT_FOUND",
      scope ? "Geography member not found for this group." : "Geography member not found.",
    );
  }
  await prisma.tariffGeographyMember.delete({ where: { id } });
}

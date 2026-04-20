import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffLegalEntitiesForTenant(params: {
  tenantId: string;
  take?: number;
  cursor?: string;
  status?: string;
}): Promise<{ items: Awaited<ReturnType<typeof prisma.tariffLegalEntity.findMany>>; nextCursor: string | null }> {
  const take = Math.min(params.take ?? 100, 500);
  const where: Prisma.TariffLegalEntityWhereInput = { tenantId: params.tenantId };
  if (params.status != null) where.status = params.status;

  const items = await prisma.tariffLegalEntity.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  let nextCursor: string | null = null;
  if (items.length > take) {
    const last = items.pop()!;
    nextCursor = last.id;
  }
  return { items, nextCursor };
}

export async function getTariffLegalEntityForTenant(params: { tenantId: string; id: string }) {
  const row = await prisma.tariffLegalEntity.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Legal entity not found.");
  return row;
}

export async function createTariffLegalEntity(input: {
  tenantId: string;
  name: string;
  code?: string | null;
  countryCode?: string | null;
  baseCurrency?: string | null;
  status?: string;
}) {
  return prisma.tariffLegalEntity.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      countryCode: input.countryCode?.trim().toUpperCase().slice(0, 2) || null,
      baseCurrency: input.baseCurrency?.trim().toUpperCase().slice(0, 3) || null,
      status: input.status?.trim() || "ACTIVE",
    },
  });
}

export async function updateTariffLegalEntity(
  params: { tenantId: string; id: string },
  patch: Partial<{
    name: string;
    code: string | null;
    countryCode: string | null;
    baseCurrency: string | null;
    status: string;
  }>,
) {
  await getTariffLegalEntityForTenant(params);
  return prisma.tariffLegalEntity.update({
    where: { id: params.id },
    data: {
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.code !== undefined ? { code: patch.code?.trim() || null } : {}),
      ...(patch.countryCode !== undefined
        ? { countryCode: patch.countryCode?.trim().toUpperCase().slice(0, 2) || null }
        : {}),
      ...(patch.baseCurrency !== undefined
        ? { baseCurrency: patch.baseCurrency?.trim().toUpperCase().slice(0, 3) || null }
        : {}),
      ...(patch.status != null ? { status: patch.status.trim() } : {}),
    },
  });
}

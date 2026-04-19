import type { Prisma, TariffProviderType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffProviders(params?: {
  take?: number;
  cursor?: string;
  status?: string;
}): Promise<{ items: Awaited<ReturnType<typeof prisma.tariffProvider.findMany>>; nextCursor: string | null }> {
  const take = Math.min(params?.take ?? 100, 500);
  const where: Prisma.TariffProviderWhereInput = {};
  if (params?.status != null) where.status = params.status;

  const items = await prisma.tariffProvider.findMany({
    where,
    orderBy: [{ legalName: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  let nextCursor: string | null = null;
  if (items.length > take) {
    const last = items.pop()!;
    nextCursor = last.id;
  }
  return { items, nextCursor };
}

export async function getTariffProviderById(id: string) {
  const row = await prisma.tariffProvider.findUnique({ where: { id } });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Tariff provider not found.");
  return row;
}

export async function createTariffProvider(input: {
  legalName: string;
  tradingName?: string | null;
  providerType: TariffProviderType;
  countryCode?: string | null;
  status?: string;
}) {
  return prisma.tariffProvider.create({
    data: {
      legalName: input.legalName.trim(),
      tradingName: input.tradingName?.trim() || null,
      providerType: input.providerType,
      countryCode: input.countryCode?.trim().toUpperCase().slice(0, 2) || null,
      status: input.status?.trim() || "ACTIVE",
    },
  });
}

export async function updateTariffProvider(
  id: string,
  patch: Partial<{
    legalName: string;
    tradingName: string | null;
    providerType: TariffProviderType;
    countryCode: string | null;
    status: string;
  }>,
) {
  await getTariffProviderById(id);
  return prisma.tariffProvider.update({
    where: { id },
    data: {
      ...(patch.legalName != null ? { legalName: patch.legalName.trim() } : {}),
      ...(patch.tradingName !== undefined ? { tradingName: patch.tradingName?.trim() || null } : {}),
      ...(patch.providerType != null ? { providerType: patch.providerType } : {}),
      ...(patch.countryCode !== undefined
        ? { countryCode: patch.countryCode?.trim().toUpperCase().slice(0, 2) || null }
        : {}),
      ...(patch.status != null ? { status: patch.status.trim() } : {}),
    },
  });
}

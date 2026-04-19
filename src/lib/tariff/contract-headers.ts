import type { Prisma, TariffContractStatus, TariffTransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffContractHeadersForTenant(params: {
  tenantId: string;
  take?: number;
  providerId?: string;
}) {
  const take = Math.min(params.take ?? 100, 300);
  const where: Prisma.TariffContractHeaderWhereInput = { tenantId: params.tenantId };
  if (params.providerId) where.providerId = params.providerId;
  return prisma.tariffContractHeader.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take,
    include: { provider: { select: { id: true, legalName: true, tradingName: true } } },
  });
}

export async function getTariffContractHeaderForTenant(params: { tenantId: string; id: string }) {
  const row = await prisma.tariffContractHeader.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    include: {
      provider: true,
      legalEntity: true,
      versions: { orderBy: { versionNo: "desc" }, take: 20 },
    },
  });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Contract header not found for this tenant.");
  return row;
}

export async function createTariffContractHeader(input: {
  tenantId: string;
  legalEntityId?: string | null;
  providerId: string;
  transportMode: TariffTransportMode;
  contractNumber?: string | null;
  title: string;
  tradeScope?: string | null;
  status?: TariffContractStatus;
  ownerUserId?: string | null;
  notes?: string | null;
}) {
  return prisma.tariffContractHeader.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId ?? null,
      providerId: input.providerId,
      transportMode: input.transportMode,
      contractNumber: input.contractNumber?.trim() || null,
      title: input.title.trim(),
      tradeScope: input.tradeScope?.trim() || null,
      status: input.status ?? "DRAFT",
      ownerUserId: input.ownerUserId ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateTariffContractHeader(
  params: { tenantId: string; id: string },
  patch: Partial<{
    legalEntityId: string | null;
    providerId: string;
    transportMode: TariffTransportMode;
    contractNumber: string | null;
    title: string;
    tradeScope: string | null;
    status: TariffContractStatus;
    ownerUserId: string | null;
    notes: string | null;
  }>,
) {
  const existing = await prisma.tariffContractHeader.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!existing) throw new TariffRepoError("NOT_FOUND", "Contract header not found for this tenant.");

  return prisma.tariffContractHeader.update({
    where: { id: params.id },
    data: {
      ...(patch.legalEntityId !== undefined ? { legalEntityId: patch.legalEntityId } : {}),
      ...(patch.providerId != null ? { providerId: patch.providerId } : {}),
      ...(patch.transportMode != null ? { transportMode: patch.transportMode } : {}),
      ...(patch.contractNumber !== undefined ? { contractNumber: patch.contractNumber?.trim() || null } : {}),
      ...(patch.title != null ? { title: patch.title.trim() } : {}),
      ...(patch.tradeScope !== undefined ? { tradeScope: patch.tradeScope?.trim() || null } : {}),
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    },
  });
}

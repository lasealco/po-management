import { prisma } from "@/lib/prisma";
import type { TwinEntityListItem } from "@/lib/supply-chain-twin/entities-catalog";
import { TWIN_ENTITY_KINDS, type TwinEntityKind } from "@/lib/supply-chain-twin/types";

function toTwinEntityKind(value: string): TwinEntityKind {
  return (TWIN_ENTITY_KINDS as readonly string[]).includes(value) ? (value as TwinEntityKind) : "unknown";
}

export type ListForTenantOptions = {
  /** Case-insensitive match on `entityKey` or `entityKind`. */
  q?: string;
  take?: number;
};

/**
 * Lists materialized twin entity rows for a tenant, newest first.
 */
export async function listForTenant(
  tenantId: string,
  options: ListForTenantOptions = {},
): Promise<TwinEntityListItem[]> {
  const take = Math.min(Math.max(options.take ?? 100, 1), 500);
  const q = (options.q ?? "").trim();

  const rows = await prisma.supplyChainTwinEntitySnapshot.findMany({
    where: {
      tenantId,
      ...(q.length > 0
        ? {
            OR: [
              { entityKey: { contains: q, mode: "insensitive" } },
              { entityKind: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { entityKind: true, entityKey: true },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    ref: { kind: toTwinEntityKind(row.entityKind), id: row.entityKey },
  }));
}

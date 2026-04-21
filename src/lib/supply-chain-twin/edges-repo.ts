import { prisma } from "@/lib/prisma";
import { TWIN_ENTITY_KINDS, type TwinEntityKind, type TwinEntityRef } from "@/lib/supply-chain-twin/types";

function toTwinEntityKind(value: string): TwinEntityKind {
  return (TWIN_ENTITY_KINDS as readonly string[]).includes(value) ? (value as TwinEntityKind) : "unknown";
}

const snapshotSelect = { entityKind: true, entityKey: true } as const;

type EdgeRowDb = {
  id: string;
  relation: string | null;
  fromSnapshot: { entityKind: string; entityKey: string };
  toSnapshot: { entityKind: string; entityKey: string };
};

export type TwinEdgeListItem = {
  id: string;
  relation: string | null;
  from: TwinEntityRef;
  to: TwinEntityRef;
};

export type ListEdgesForTenantOptions = {
  fromSnapshotId?: string;
  toSnapshotId?: string;
  take?: number;
};

function mapEdgeRow(row: EdgeRowDb): TwinEdgeListItem {
  return {
    id: row.id,
    relation: row.relation,
    from: { kind: toTwinEntityKind(row.fromSnapshot.entityKind), id: row.fromSnapshot.entityKey },
    to: { kind: toTwinEntityKind(row.toSnapshot.entityKind), id: row.toSnapshot.entityKey },
  };
}

/**
 * Lists directed twin edges for a tenant (newest first). Read-only; empty when no rows.
 */
export async function listEdgesForTenant(
  tenantId: string,
  options: ListEdgesForTenantOptions = {},
): Promise<TwinEdgeListItem[]> {
  const take = Math.min(Math.max(options.take ?? 200, 1), 500);
  const where = {
    tenantId,
    ...(options.fromSnapshotId ? { fromSnapshotId: options.fromSnapshotId } : {}),
    ...(options.toSnapshotId ? { toSnapshotId: options.toSnapshotId } : {}),
  };

  const rows = await prisma.supplyChainTwinEntityEdge.findMany({
    where,
    select: {
      id: true,
      relation: true,
      fromSnapshot: { select: snapshotSelect },
      toSnapshot: { select: snapshotSelect },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
  });

  return rows.map((row) => mapEdgeRow(row as EdgeRowDb));
}

export type ListEdgesForEntityDirection = "out" | "in" | "both";

/**
 * Lists edges incident on a snapshot: outgoing, incoming, or both (default `both`).
 */
export async function listEdgesForEntity(
  tenantId: string,
  snapshotId: string,
  options: { direction?: ListEdgesForEntityDirection; take?: number } = {},
): Promise<TwinEdgeListItem[]> {
  const direction = options.direction ?? "both";
  const take = Math.min(Math.max(options.take ?? 200, 1), 500);

  if (direction === "out") {
    return listEdgesForTenant(tenantId, { fromSnapshotId: snapshotId, take });
  }
  if (direction === "in") {
    return listEdgesForTenant(tenantId, { toSnapshotId: snapshotId, take });
  }

  const rows = await prisma.supplyChainTwinEntityEdge.findMany({
    where: {
      tenantId,
      OR: [{ fromSnapshotId: snapshotId }, { toSnapshotId: snapshotId }],
    },
    select: {
      id: true,
      relation: true,
      fromSnapshot: { select: snapshotSelect },
      toSnapshot: { select: snapshotSelect },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
  });

  return rows.map((row) => mapEdgeRow(row as EdgeRowDb));
}

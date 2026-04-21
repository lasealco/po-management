import { prisma } from "@/lib/prisma";
import type { TwinEntityListItem } from "@/lib/supply-chain-twin/entities-catalog";
import { decodeTwinEntitiesCursor, encodeTwinEntitiesCursor } from "@/lib/supply-chain-twin/schemas/twin-entities-query";
import { TWIN_ENTITY_KINDS, type TwinEntityKind, type TwinEntityRef } from "@/lib/supply-chain-twin/types";

function toTwinEntityKind(value: string): TwinEntityKind {
  return (TWIN_ENTITY_KINDS as readonly string[]).includes(value) ? (value as TwinEntityKind) : "unknown";
}

export type ListForTenantOptions = {
  /** Case-insensitive match on `entityKey` or `entityKind`. */
  q?: string;
  take?: number;
};

export type ListForTenantPageOptions = {
  q?: string;
  /** Hard-clamped to 1..500 inside the repo (API route uses ≤100). */
  limit: number;
  cursor?: string | null;
  /** When set, restricts rows to this stored `entityKind` (exact match). */
  entityKind?: TwinEntityKind;
};

/**
 * Keyset-paginated list (newest `updatedAt` first, `id` tie-break). Fetches `limit + 1` to detect `nextCursor`.
 * Invalid `cursor` must be rejected by the caller (API returns 400).
 */
export async function listForTenantPage(
  tenantId: string,
  options: ListForTenantPageOptions,
): Promise<{ items: TwinEntityListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 500);
  const q = (options.q ?? "").trim();

  let cursorPos: { updatedAt: Date; id: string } | null = null;
  if (options.cursor && options.cursor.length > 0) {
    const decoded = decodeTwinEntitiesCursor(options.cursor);
    if (!decoded.ok) {
      throw new RangeError("INVALID_TWIN_ENTITIES_CURSOR");
    }
    cursorPos = { updatedAt: decoded.updatedAt, id: decoded.id };
  }

  const qFilter =
    q.length > 0
      ? {
          OR: [
            { entityKey: { contains: q, mode: "insensitive" as const } },
            { entityKind: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const kindFilter = options.entityKind ? { entityKind: options.entityKind } : {};

  const cursorFilter = cursorPos
    ? {
        OR: [
          { updatedAt: { lt: cursorPos.updatedAt } },
          {
            AND: [{ updatedAt: cursorPos.updatedAt }, { id: { lt: cursorPos.id } }],
          },
        ],
      }
    : {};

  const filters = [qFilter, cursorFilter, kindFilter].filter((part) => Object.keys(part).length > 0);
  const where =
    filters.length === 0 ? { tenantId } : { tenantId, AND: filters };

  const rows = await prisma.supplyChainTwinEntitySnapshot.findMany({
    where,
    select: { id: true, entityKind: true, entityKey: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last != null
      ? encodeTwinEntitiesCursor({ updatedAt: last.updatedAt, id: last.id })
      : null;

  const items = pageRows.map((row) => ({
    id: row.id,
    ref: { kind: toTwinEntityKind(row.entityKind), id: row.entityKey },
  }));

  return { items, nextCursor };
}

/**
 * Lists materialized twin entity rows for a tenant, newest first (non-paginated consumer helper).
 */
export async function listForTenant(
  tenantId: string,
  options: ListForTenantOptions = {},
): Promise<TwinEntityListItem[]> {
  const limit = Math.min(Math.max(options.take ?? 100, 1), 500);
  const { items } = await listForTenantPage(tenantId, {
    q: options.q,
    limit,
    cursor: null,
  });
  return items;
}

/** One `SupplyChainTwinEntitySnapshot` row for detail APIs (tenant-scoped). */
export type TwinEntitySnapshotDetail = {
  id: string;
  ref: TwinEntityRef;
  createdAt: Date;
  updatedAt: Date;
  payload: unknown;
};

/**
 * Loads a single entity snapshot by primary key for the tenant. Returns `null` when missing or not in tenant.
 */
export async function getEntitySnapshotByIdForTenant(
  tenantId: string,
  snapshotId: string,
): Promise<TwinEntitySnapshotDetail | null> {
  const row = await prisma.supplyChainTwinEntitySnapshot.findFirst({
    where: { tenantId, id: snapshotId },
    select: {
      id: true,
      entityKind: true,
      entityKey: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ref: { kind: toTwinEntityKind(row.entityKind), id: row.entityKey },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    payload: row.payload,
  };
}

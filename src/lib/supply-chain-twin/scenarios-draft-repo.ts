import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encodeTwinScenariosListCursor } from "@/lib/supply-chain-twin/schemas/twin-scenarios-list-query";

export type CreateScenarioDraftInput = {
  title?: string | null;
  /** Stored as JSON; must serialize under the API byte cap before insert. */
  draft: Prisma.InputJsonValue;
};

/**
 * Persists a new draft scenario row for the tenant. No solver or graph mutation.
 */
export async function createScenarioDraft(
  tenantId: string,
  input: CreateScenarioDraftInput,
): Promise<{ id: string; title: string | null; status: string; updatedAt: Date }> {
  const title = input.title?.trim() ? input.title.trim() : null;
  return prisma.supplyChainTwinScenarioDraft.create({
    data: {
      tenantId,
      title,
      status: "draft",
      draftJson: input.draft,
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });
}

export type ScenarioDraftListItem = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: Date;
};

/**
 * Keyset-paged scenario drafts for a tenant (`updatedAt` desc, `id` desc). `limit` is clamped to 1..100.
 * Decode the opaque `cursor` string in the API route; pass `cursorPosition` here.
 */
export async function listScenarioDraftsForTenantPage(
  tenantId: string,
  options: { limit: number; cursorPosition?: { updatedAt: Date; id: string } | null },
): Promise<{ items: ScenarioDraftListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 100);

  const cursorPos = options.cursorPosition ?? null;

  const where: Prisma.SupplyChainTwinScenarioDraftWhereInput = cursorPos
    ? {
        tenantId,
        OR: [
          { updatedAt: { lt: cursorPos.updatedAt } },
          {
            AND: [{ updatedAt: cursorPos.updatedAt }, { id: { lt: cursorPos.id } }],
          },
        ],
      }
    : { tenantId };

  const rows = await prisma.supplyChainTwinScenarioDraft.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last != null
      ? encodeTwinScenariosListCursor({
          updatedAt: last.updatedAt,
          id: last.id,
        })
      : null;

  return { items: pageRows, nextCursor };
}

export type ScenarioDraftDetailRow = {
  id: string;
  title: string | null;
  status: string;
  draftJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

/** Returns the row only when `id` belongs to `tenantId` (cross-tenant id yields `null`). */
export async function getScenarioDraftByIdForTenant(
  tenantId: string,
  draftId: string,
): Promise<ScenarioDraftDetailRow | null> {
  const row = await prisma.supplyChainTwinScenarioDraft.findFirst({
    where: { id: draftId, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      draftJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return row;
}

export type PatchScenarioDraftInput = {
  /** Set or clear; omit to leave unchanged. */
  title?: string | null;
  /** Replace stored JSON; omit to leave unchanged. */
  draft?: Prisma.InputJsonValue;
};

/**
 * Applies a partial update when the row exists for `tenantId` + `draftId`.
 * Returns the updated row, or `null` if no row matched (caller returns 404).
 */
export async function patchScenarioDraftForTenant(
  tenantId: string,
  draftId: string,
  patch: PatchScenarioDraftInput,
): Promise<ScenarioDraftDetailRow | null> {
  const data: Prisma.SupplyChainTwinScenarioDraftUpdateManyMutationInput = {};
  if (patch.title !== undefined) {
    data.title = patch.title;
  }
  if (patch.draft !== undefined) {
    data.draftJson = patch.draft;
  }

  const result = await prisma.supplyChainTwinScenarioDraft.updateMany({
    where: { id: draftId, tenantId },
    data,
  });
  if (result.count === 0) {
    return null;
  }
  return getScenarioDraftByIdForTenant(tenantId, draftId);
}

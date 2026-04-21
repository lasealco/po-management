import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encodeTwinScenariosListCursor } from "@/lib/supply-chain-twin/schemas/twin-scenarios-list-query";
import { getTwinScenarioStatusTransitionError } from "@/lib/supply-chain-twin/scenario-status-transitions";
import type { TwinScenarioDraftPatchStatus } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-patch";

export type CreateScenarioDraftInput = {
  title?: string | null;
  /** Stored as JSON; must serialize under the API byte cap before insert. */
  draft: Prisma.InputJsonValue;
  actorId?: string | null;
};

/**
 * Persists a new draft scenario row for the tenant. No solver or graph mutation.
 */
export async function createScenarioDraft(
  tenantId: string,
  input: CreateScenarioDraftInput,
): Promise<{ id: string; title: string | null; status: string; updatedAt: Date }> {
  const title = input.title?.trim() ? input.title.trim() : null;
  const row = await prisma.supplyChainTwinScenarioDraft.create({
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
  await createScenarioRevision({
    tenantId,
    scenarioDraftId: row.id,
    actorId: input.actorId ?? null,
    action: "create",
    titleBefore: null,
    titleAfter: row.title,
    statusBefore: null,
    statusAfter: row.status,
  });
  return row;
}

export type DuplicateScenarioDraftForTenantInput = {
  /** Appended after trimmed source title; omit to reuse the source title as stored. */
  titleSuffix?: string;
  actorId?: string | null;
};

function buildDuplicatedScenarioTitle(
  sourceTitle: string | null,
  titleSuffix: string | undefined,
): string | null {
  if (titleSuffix === undefined) {
    return sourceTitle;
  }
  const base = sourceTitle?.trim() ?? "";
  const merged = base.length > 0 ? `${base}${titleSuffix}` : titleSuffix;
  if (merged.length === 0) {
    return null;
  }
  return merged.length > 200 ? merged.slice(0, 200) : merged;
}

/**
 * Inserts a new `draft` row for `tenantId` with the same `draftJson` as the source. Returns `null` when no source row
 * exists for this tenant + id (including other tenants’ ids — **404**, do not leak).
 */
export async function duplicateScenarioDraftForTenant(
  tenantId: string,
  sourceDraftId: string,
  input: DuplicateScenarioDraftForTenantInput = {},
): Promise<{ id: string; title: string | null; status: string; updatedAt: Date } | null> {
  const source = await prisma.supplyChainTwinScenarioDraft.findFirst({
    where: { id: sourceDraftId, tenantId },
    select: { title: true, draftJson: true },
  });
  if (!source) {
    return null;
  }

  const mergedTitle = buildDuplicatedScenarioTitle(source.title, input.titleSuffix);
  const title = mergedTitle?.trim() ? mergedTitle.trim() : null;
  const draft = source.draftJson as Prisma.InputJsonValue;

  const row = await prisma.supplyChainTwinScenarioDraft.create({
    data: {
      tenantId,
      title,
      status: "draft",
      draftJson: draft,
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });
  await createScenarioRevision({
    tenantId,
    scenarioDraftId: row.id,
    actorId: input.actorId ?? null,
    action: "duplicate",
    titleBefore: null,
    titleAfter: row.title,
    statusBefore: null,
    statusAfter: row.status,
  });
  return row;
}

export type ScenarioDraftListItem = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: Date;
};

/**
 * Keyset-paged scenario drafts for a tenant (`updatedAt` desc, `id` desc). **No `OFFSET`** — stable under inserts.
 *
 * - **`limit`** is clamped to 1..100; Prisma `take` is **`limit + 1`** to detect a following page without a second
 *   query.
 * - **`cursorPosition`**: rows strictly “after” this `(updatedAt, id)` pair in sort order (ties on `updatedAt` broken
 *   by `id`). Matches `@@index([tenantId, updatedAt])` on `SupplyChainTwinScenarioDraft` for tenant-scoped scans.
 * - Decode the opaque `cursor` string in the API route; pass `cursorPosition` here only.
 * - **`status !== archived` only** — archived drafts are omitted here so the default list stays actionable; use
 *   `GET …/scenarios/[id]` to load an archived row by id.
 */
export async function listScenarioDraftsForTenantPage(
  tenantId: string,
  options: { limit: number; cursorPosition?: { updatedAt: Date; id: string } | null },
): Promise<{ items: ScenarioDraftListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 100);

  const cursorPos = options.cursorPosition ?? null;

  const notArchived: Prisma.SupplyChainTwinScenarioDraftWhereInput = {
    tenantId,
    status: { not: "archived" },
  };

  const where: Prisma.SupplyChainTwinScenarioDraftWhereInput = cursorPos
    ? {
        ...notArchived,
        OR: [
          { updatedAt: { lt: cursorPos.updatedAt } },
          {
            AND: [{ updatedAt: cursorPos.updatedAt }, { id: { lt: cursorPos.id } }],
          },
        ],
      }
    : notArchived;

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
  /** Workflow label; omit to leave unchanged. Transitions validated against current row. */
  status?: TwinScenarioDraftPatchStatus;
  /** Optional actor id for audit revisions. */
  actorId?: string | null;
};

export type PatchScenarioDraftResult =
  | { ok: true; row: ScenarioDraftDetailRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_status_transition"; message: string };

/**
 * Applies a partial update when the row exists for `tenantId` + `draftId`.
 * When `patch.status` is set, validates transition from the stored status first.
 */
export async function patchScenarioDraftForTenant(
  tenantId: string,
  draftId: string,
  patch: PatchScenarioDraftInput,
): Promise<PatchScenarioDraftResult> {
  const existing = await prisma.supplyChainTwinScenarioDraft.findFirst({
    where: { id: draftId, tenantId },
    select: { status: true, title: true },
  });
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (patch.status !== undefined) {
    const transitionErr = getTwinScenarioStatusTransitionError(existing.status, patch.status);
    if (transitionErr) {
      return { ok: false, reason: "invalid_status_transition", message: transitionErr };
    }
  }

  const data: Prisma.SupplyChainTwinScenarioDraftUpdateManyMutationInput = {};
  if (patch.title !== undefined) {
    data.title = patch.title;
  }
  if (patch.draft !== undefined) {
    data.draftJson = patch.draft;
  }
  if (patch.status !== undefined) {
    data.status = patch.status;
  }

  const result = await prisma.supplyChainTwinScenarioDraft.updateMany({
    where: { id: draftId, tenantId },
    data,
  });
  if (result.count === 0) {
    return { ok: false, reason: "not_found" };
  }
  const row = await getScenarioDraftByIdForTenant(tenantId, draftId);
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (existing.title !== row.title || existing.status !== row.status) {
    await createScenarioRevision({
      tenantId,
      scenarioDraftId: row.id,
      actorId: patch.actorId ?? null,
      action: "patch",
      titleBefore: existing.title,
      titleAfter: row.title,
      statusBefore: existing.status,
      statusAfter: row.status,
    });
  }
  return { ok: true, row };
}

export type ScenarioRevisionListItem = {
  id: string;
  createdAt: Date;
  actorId: string | null;
  action: string;
  titleBefore: string | null;
  titleAfter: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
};

export async function listScenarioHistoryForTenant(
  tenantId: string,
  draftId: string,
): Promise<ScenarioRevisionListItem[] | null> {
  const exists = await prisma.supplyChainTwinScenarioDraft.findFirst({
    where: { id: draftId, tenantId },
    select: { id: true },
  });
  if (!exists) {
    return null;
  }
  return prisma.supplyChainTwinScenarioRevision.findMany({
    where: { tenantId, scenarioDraftId: draftId },
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      action: true,
      titleBefore: true,
      titleAfter: true,
      statusBefore: true,
      statusAfter: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

async function createScenarioRevision(input: {
  tenantId: string;
  scenarioDraftId: string;
  actorId: string | null;
  action: string;
  titleBefore: string | null;
  titleAfter: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
}) {
  await prisma.supplyChainTwinScenarioRevision.create({
    data: {
      tenantId: input.tenantId,
      scenarioDraftId: input.scenarioDraftId,
      actorId: input.actorId,
      action: input.action,
      titleBefore: input.titleBefore,
      titleAfter: input.titleAfter,
      statusBefore: input.statusBefore,
      statusAfter: input.statusAfter,
    },
  });
}

/**
 * Hard-deletes one draft row for `tenantId` + `draftId`. Other tables do not reference this model today, so Prisma
 * performs no further cascades from this delete. The `tenant` relation on the model uses `onDelete: Cascade` from
 * `Tenant` → drafts (tenant removal wipes drafts), not the reverse.
 */
export async function deleteScenarioDraftForTenant(tenantId: string, draftId: string): Promise<boolean> {
  const result = await prisma.supplyChainTwinScenarioDraft.deleteMany({
    where: { id: draftId, tenantId },
  });
  return result.count > 0;
}

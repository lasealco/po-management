import type { Prisma } from "@prisma/client";

import type { ApiHubConnectorListSortField, ApiHubConnectorListSortOrder } from "@/lib/apihub/constants";
import { sortConnectorListRowsByNameSearch } from "@/lib/apihub/connector-search";
import { prisma } from "@/lib/prisma";

const DEFAULT_STUB_HEALTH = "Not connected — stub row (Phase 1)";

export type ApiHubConnectorListRow = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  authMode: string;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListApiHubConnectorsFilters = {
  status?: string;
  authMode?: string;
  /** Trimmed connector name search (`q` query); ranked exact → prefix → contains in-repo. */
  q?: string;
  /** Allowlisted list sort field; default `createdAt` when omitted. */
  sortField?: ApiHubConnectorListSortField;
  /** `asc` | `desc`; default `desc` when omitted. */
  sortOrder?: ApiHubConnectorListSortOrder;
};

function listOrderBy(
  field: ApiHubConnectorListSortField,
  order: ApiHubConnectorListSortOrder,
): Prisma.ApiHubConnectorOrderByWithRelationInput[] {
  if (field === "name") {
    return [{ name: order }, { id: order }];
  }
  if (field === "updatedAt") {
    return [{ updatedAt: order }, { id: order }];
  }
  return [{ createdAt: order }, { id: order }];
}

export type ApiHubConnectorAuditLogRow = {
  id: string;
  connectorId: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: Date;
};

export async function listApiHubConnectors(
  tenantId: string,
  filters?: ListApiHubConnectorsFilters,
): Promise<ApiHubConnectorListRow[]> {
  const qTrimmed = filters?.q?.trim() ?? "";
  const useSearch = qTrimmed.length > 0;
  const sortField = filters?.sortField ?? "createdAt";
  const sortOrder = filters?.sortOrder ?? "desc";

  const rows = await prisma.apiHubConnector.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.authMode ? { authMode: filters.authMode } : {}),
      ...(useSearch
        ? { name: { contains: qTrimmed, mode: "insensitive" as const } }
        : {}),
    },
    ...(!useSearch ? { orderBy: listOrderBy(sortField, sortOrder) } : {}),
    select: {
      id: true,
      name: true,
      sourceKind: true,
      status: true,
      authMode: true,
      lastSyncAt: true,
      healthSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (useSearch) {
    return sortConnectorListRowsByNameSearch(rows, qTrimmed, { field: sortField, order: sortOrder });
  }
  return rows;
}

export async function createStubApiHubConnector(opts: {
  tenantId: string;
  actorUserId: string;
  name: string;
}): Promise<ApiHubConnectorListRow> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.apiHubConnector.create({
      data: {
        tenantId: opts.tenantId,
        name: opts.name,
        sourceKind: "stub",
        status: "draft",
        healthSummary: DEFAULT_STUB_HEALTH,
      },
      select: {
        id: true,
        name: true,
        sourceKind: true,
        status: true,
        authMode: true,
        lastSyncAt: true,
        healthSummary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.apiHubConnectorAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: created.id,
        actorUserId: opts.actorUserId,
        action: "connector.created",
        note: "Created stub connector row.",
      },
    });

    return created;
  });
}

export async function updateApiHubConnectorLifecycle(opts: {
  tenantId: string;
  connectorId: string;
  actorUserId: string;
  status: string;
  syncNow: boolean;
  note: string | null;
}): Promise<ApiHubConnectorListRow | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.apiHubConnector.findFirst({
      where: { id: opts.connectorId, tenantId: opts.tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return null;
    }

    const updated = await tx.apiHubConnector.update({
      where: { id: existing.id },
      data: {
        status: opts.status,
        ...(opts.syncNow ? { lastSyncAt: new Date() } : {}),
      },
      select: {
        id: true,
        name: true,
        sourceKind: true,
        status: true,
        authMode: true,
        lastSyncAt: true,
        healthSummary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.apiHubConnectorAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: existing.id,
        actorUserId: opts.actorUserId,
        action: "connector.lifecycle.updated",
        note:
          opts.note ??
          `Status ${existing.status} -> ${opts.status}${opts.syncNow ? " (sync timestamp set)" : ""}`,
      },
    });

    return updated;
  });
}

export async function listApiHubConnectorAuditLogs(
  tenantId: string,
  connectorId: string,
  limit = 5,
): Promise<ApiHubConnectorAuditLogRow[]> {
  return prisma.apiHubConnectorAuditLog.findMany({
    where: { tenantId, connectorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      connectorId: true,
      actorUserId: true,
      action: true,
      note: true,
      createdAt: true,
    },
  });
}

export async function getApiHubConnectorInTenant(
  tenantId: string,
  connectorId: string,
): Promise<{ id: string; status: string } | null> {
  return prisma.apiHubConnector.findFirst({
    where: { id: connectorId, tenantId },
    select: { id: true, status: true },
  });
}

/** Tenant-scoped audit page: `createdAt` desc, `id` desc; `hasMore` via over-fetch of one row. */
export async function listApiHubConnectorAuditLogsPage(opts: {
  tenantId: string;
  connectorId: string;
  limit: number;
  offset: number;
}): Promise<{ items: ApiHubConnectorAuditLogRow[]; hasMore: boolean }> {
  const take = opts.limit + 1;
  const rows = await prisma.apiHubConnectorAuditLog.findMany({
    where: { tenantId: opts.tenantId, connectorId: opts.connectorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: opts.offset,
    take,
    select: {
      id: true,
      connectorId: true,
      actorUserId: true,
      action: true,
      note: true,
      createdAt: true,
    },
  });
  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  return { items, hasMore };
}

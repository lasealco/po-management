import type { Prisma } from "@prisma/client";

import {
  APIHUB_AUDIT_ACTION_CONNECTOR_AUTH_CONFIG_REF_UPDATED,
  APIHUB_AUDIT_ACTION_CONNECTOR_CREATED,
  APIHUB_AUDIT_ACTION_CONNECTOR_LIFECYCLE_UPDATED,
  APIHUB_AUDIT_ACTION_CONNECTOR_OPS_NOTE_UPDATED,
} from "@/lib/apihub/audit-contract";
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
  authState: string;
  /** Internal row only; never exposed on API DTOs. */
  authConfigRef: string | null;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  opsNote: string | null;
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
  actorEmail: string;
  actorName: string;
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
      authState: true,
      authConfigRef: true,
      lastSyncAt: true,
      healthSummary: true,
      opsNote: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (useSearch) {
    return sortConnectorListRowsByNameSearch(rows, qTrimmed, { field: sortField, order: sortOrder });
  }
  return rows;
}

/** List connectors plus the latest `auditLimit` audit rows per connector (for SSR + list API DTOs). */
export async function listApiHubConnectorsWithRecentAudit(
  tenantId: string,
  filters?: ListApiHubConnectorsFilters,
  auditLimit = 3,
): Promise<Array<ApiHubConnectorListRow & { auditLogs: ApiHubConnectorAuditLogRow[] }>> {
  const rows = await listApiHubConnectors(tenantId, filters);
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      auditLogs: await listApiHubConnectorAuditLogs(tenantId, row.id, auditLimit),
    })),
  );
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
        authState: true,
        authConfigRef: true,
        lastSyncAt: true,
        healthSummary: true,
        opsNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.apiHubConnectorAuditLog.create({
      data: {
        tenantId: opts.tenantId,
        connectorId: created.id,
        actorUserId: opts.actorUserId,
        action: APIHUB_AUDIT_ACTION_CONNECTOR_CREATED,
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
  /** When not `undefined`, sets or clears `opsNote` on the connector row. */
  opsNote?: string | null;
  /** When not `undefined`, sets or clears `authConfigRef` (already format-validated in the API layer). */
  authConfigRef?: string | null;
}): Promise<ApiHubConnectorListRow | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.apiHubConnector.findFirst({
      where: { id: opts.connectorId, tenantId: opts.tenantId },
      select: { id: true, status: true, opsNote: true, authConfigRef: true },
    });
    if (!existing) {
      return null;
    }

    const lifecycleChanged = existing.status !== opts.status || opts.syncNow;
    const oldOps = existing.opsNote ?? "";
    const newOps = opts.opsNote !== undefined ? (opts.opsNote ?? "") : oldOps;
    const opsChanged = opts.opsNote !== undefined && newOps !== oldOps;

    const oldRef = existing.authConfigRef ?? "";
    const newRef = opts.authConfigRef !== undefined ? (opts.authConfigRef ?? "") : oldRef;
    const authRefChanged = opts.authConfigRef !== undefined && newRef !== oldRef;

    const data: {
      status?: string;
      lastSyncAt?: Date;
      opsNote?: string | null;
      authConfigRef?: string | null;
    } = {};
    if (existing.status !== opts.status) {
      data.status = opts.status;
    }
    if (opts.syncNow) {
      data.lastSyncAt = new Date();
    }
    if (opts.opsNote !== undefined) {
      data.opsNote = opts.opsNote;
    }
    if (authRefChanged) {
      data.authConfigRef = opts.authConfigRef ?? null;
    }

    const connectorListRowSelect = {
      id: true,
      name: true,
      sourceKind: true,
      status: true,
      authMode: true,
      authState: true,
      authConfigRef: true,
      lastSyncAt: true,
      healthSummary: true,
      opsNote: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    let updated;
    if (Object.keys(data).length > 0) {
      const upd = await tx.apiHubConnector.updateMany({
        where: { id: existing.id, tenantId: opts.tenantId },
        data,
      });
      if (upd.count !== 1) {
        return null;
      }
      updated = await tx.apiHubConnector.findFirstOrThrow({
        where: { id: existing.id, tenantId: opts.tenantId },
        select: connectorListRowSelect,
      });
    } else {
      updated = await tx.apiHubConnector.findFirstOrThrow({
        where: { id: existing.id, tenantId: opts.tenantId },
        select: connectorListRowSelect,
      });
    }

    if (lifecycleChanged) {
      await tx.apiHubConnectorAuditLog.create({
        data: {
          tenantId: opts.tenantId,
          connectorId: existing.id,
          actorUserId: opts.actorUserId,
          action: APIHUB_AUDIT_ACTION_CONNECTOR_LIFECYCLE_UPDATED,
          note:
            opts.note ??
            `Status ${existing.status} -> ${opts.status}${opts.syncNow ? " (sync timestamp set)" : ""}`,
        },
      });
    }

    if (opsChanged) {
      await tx.apiHubConnectorAuditLog.create({
        data: {
          tenantId: opts.tenantId,
          connectorId: existing.id,
          actorUserId: opts.actorUserId,
          action: APIHUB_AUDIT_ACTION_CONNECTOR_OPS_NOTE_UPDATED,
          note:
            newOps.length === 0
              ? "Ops note cleared."
              : `Ops note updated (${newOps.length} characters).`,
        },
      });
    }

    if (authRefChanged) {
      await tx.apiHubConnectorAuditLog.create({
        data: {
          tenantId: opts.tenantId,
          connectorId: existing.id,
          actorUserId: opts.actorUserId,
          action: APIHUB_AUDIT_ACTION_CONNECTOR_AUTH_CONFIG_REF_UPDATED,
          note: newRef.length === 0 ? "Auth config reference cleared." : "Auth config reference updated.",
        },
      });
    }

    return updated;
  });
}

export async function listApiHubConnectorAuditLogs(
  tenantId: string,
  connectorId: string,
  limit = 5,
): Promise<ApiHubConnectorAuditLogRow[]> {
  const rows = await prisma.apiHubConnectorAuditLog.findMany({
    where: { tenantId, connectorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      actorUser: { select: { email: true, name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    connectorId: r.connectorId,
    actorUserId: r.actorUserId,
    actorEmail: r.actorUser.email,
    actorName: r.actorUser.name,
    action: r.action,
    note: r.note,
    createdAt: r.createdAt,
  }));
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

/** Tenant-scoped row slice for `GET …/connectors/:id/health` (no secret values in response). */
export type ApiHubConnectorHealthContextRow = {
  id: string;
  sourceKind: string;
  status: string;
  authMode: string;
  authState: string;
  authConfigRef: string | null;
  lastSyncAt: Date | null;
};

export async function getApiHubConnectorHealthContext(
  tenantId: string,
  connectorId: string,
): Promise<ApiHubConnectorHealthContextRow | null> {
  return prisma.apiHubConnector.findFirst({
    where: { id: connectorId, tenantId },
    select: {
      id: true,
      sourceKind: true,
      status: true,
      authMode: true,
      authState: true,
      authConfigRef: true,
      lastSyncAt: true,
    },
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
    include: {
      actorUser: { select: { email: true, name: true } },
    },
  });
  const hasMore = rows.length > opts.limit;
  const slice = hasMore ? rows.slice(0, opts.limit) : rows;
  const items: ApiHubConnectorAuditLogRow[] = slice.map((r) => ({
    id: r.id,
    connectorId: r.connectorId,
    actorUserId: r.actorUserId,
    actorEmail: r.actorUser.email,
    actorName: r.actorUser.name,
    action: r.action,
    note: r.note,
    createdAt: r.createdAt,
  }));
  return { items, hasMore };
}

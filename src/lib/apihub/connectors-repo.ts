import { prisma } from "@/lib/prisma";

const DEFAULT_STUB_HEALTH = "Not connected — stub row (Phase 1)";

export type ApiHubConnectorListRow = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiHubConnectorAuditLogRow = {
  id: string;
  connectorId: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: Date;
};

export async function listApiHubConnectors(tenantId: string): Promise<ApiHubConnectorListRow[]> {
  return prisma.apiHubConnector.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceKind: true,
      status: true,
      lastSyncAt: true,
      healthSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  });
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
    orderBy: { createdAt: "desc" },
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

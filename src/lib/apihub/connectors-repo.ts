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
  name: string;
}): Promise<ApiHubConnectorListRow> {
  return prisma.apiHubConnector.create({
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
}

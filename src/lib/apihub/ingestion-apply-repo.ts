import { prisma } from "@/lib/prisma";

import { APIHUB_INGESTION_RUN_ROW_SELECT, type ApiHubIngestionRunRow } from "@/lib/apihub/ingestion-runs-repo";

export type ApplyApiHubIngestionRunOutcome =
  | { kind: "applied"; run: ApiHubIngestionRunRow }
  | { kind: "already_applied"; run: ApiHubIngestionRunRow }
  | { kind: "not_succeeded"; status: string }
  | { kind: "blocked"; reason: "connector_not_found" | "connector_not_active"; connectorStatus?: string };

/**
 * Marks an ingestion run as applied after a successful pipeline (`status === succeeded`).
 * Uses a conditional update so concurrent apply attempts resolve to a single winner.
 */
export async function applyApiHubIngestionRun(opts: {
  tenantId: string;
  runId: string;
}): Promise<ApplyApiHubIngestionRunOutcome | null> {
  const anchor = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId: opts.tenantId, id: opts.runId },
    select: {
      id: true,
      connectorId: true,
      status: true,
      appliedAt: true,
      connector: { select: { id: true, status: true } },
    },
  });
  if (!anchor) return null;

  if (anchor.connectorId) {
    if (!anchor.connector) {
      return { kind: "blocked", reason: "connector_not_found" };
    }
    if (anchor.connector.status !== "active") {
      return {
        kind: "blocked",
        reason: "connector_not_active",
        connectorStatus: anchor.connector.status,
      };
    }
  }

  if (anchor.status !== "succeeded") {
    return { kind: "not_succeeded", status: anchor.status };
  }

  if (anchor.appliedAt) {
    const row = await prisma.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: opts.runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
    return row ? { kind: "already_applied", run: row } : null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiHubIngestionRun.updateMany({
      where: {
        tenantId: opts.tenantId,
        id: opts.runId,
        status: "succeeded",
        appliedAt: null,
      },
      data: { appliedAt: new Date() },
    });

    if (updated.count === 0) {
      const row = await tx.apiHubIngestionRun.findFirst({
        where: { tenantId: opts.tenantId, id: opts.runId },
        select: { status: true, appliedAt: true },
      });
      if (!row) return null;
      if (row.appliedAt) {
        const full = await tx.apiHubIngestionRun.findFirst({
          where: { tenantId: opts.tenantId, id: opts.runId },
          select: APIHUB_INGESTION_RUN_ROW_SELECT,
        });
        return full ? { kind: "already_applied", run: full } : null;
      }
      return { kind: "not_succeeded", status: row.status };
    }

    const run = await tx.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: opts.runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
    if (!run) return null;
    return { kind: "applied", run };
  });
}

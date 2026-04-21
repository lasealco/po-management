import { prisma } from "@/lib/prisma";

import { APIHUB_INGESTION_RUN_ROW_SELECT, type ApiHubIngestionRunRow } from "@/lib/apihub/ingestion-runs-repo";

export type ApplyDryRunGate =
  | { type: "not_succeeded"; status: string }
  | { type: "already_applied" }
  | {
      type: "blocked";
      reason: "connector_not_found" | "connector_not_active";
      connectorStatus?: string;
    };

export type ApplyApiHubIngestionRunOutcome =
  | { kind: "applied"; run: ApiHubIngestionRunRow }
  | { kind: "already_applied"; run: ApiHubIngestionRunRow }
  | { kind: "not_succeeded"; status: string }
  | { kind: "blocked"; reason: "connector_not_found" | "connector_not_active"; connectorStatus?: string }
  | { kind: "dry_run"; wouldApply: boolean; run: ApiHubIngestionRunRow; gate?: ApplyDryRunGate };

/**
 * Marks an ingestion run as applied after a successful pipeline (`status === succeeded`).
 * Uses a conditional update so concurrent apply attempts resolve to a single winner.
 *
 * With `dryRun: true`, performs the same eligibility checks but does not set `appliedAt`;
 * returns `kind: "dry_run"` with the current run row and an intended-write summary signal.
 */
export async function applyApiHubIngestionRun(opts: {
  tenantId: string;
  runId: string;
  dryRun?: boolean;
}): Promise<ApplyApiHubIngestionRunOutcome | null> {
  const { tenantId, runId, dryRun } = opts;

  const anchor = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId, id: runId },
    select: {
      id: true,
      connectorId: true,
      status: true,
      appliedAt: true,
      connector: { select: { id: true, status: true } },
    },
  });
  if (!anchor) return null;

  async function dryRunPreview(wouldApply: boolean, gate?: ApplyDryRunGate): Promise<ApplyApiHubIngestionRunOutcome | null> {
    const run = await prisma.apiHubIngestionRun.findFirst({
      where: { tenantId, id: runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
    if (!run) return null;
    return { kind: "dry_run", wouldApply, run, gate };
  }

  if (anchor.connectorId) {
    if (!anchor.connector) {
      if (dryRun) {
        return dryRunPreview(false, { type: "blocked", reason: "connector_not_found" });
      }
      return { kind: "blocked", reason: "connector_not_found" };
    }
    if (anchor.connector.status !== "active") {
      if (dryRun) {
        return dryRunPreview(false, {
          type: "blocked",
          reason: "connector_not_active",
          connectorStatus: anchor.connector.status,
        });
      }
      return {
        kind: "blocked",
        reason: "connector_not_active",
        connectorStatus: anchor.connector.status,
      };
    }
  }

  if (anchor.status !== "succeeded") {
    if (dryRun) {
      return dryRunPreview(false, { type: "not_succeeded", status: anchor.status });
    }
    return { kind: "not_succeeded", status: anchor.status };
  }

  if (anchor.appliedAt) {
    const row = await prisma.apiHubIngestionRun.findFirst({
      where: { tenantId, id: runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
    if (!row) return null;
    if (dryRun) {
      return { kind: "dry_run", wouldApply: false, run: row, gate: { type: "already_applied" } };
    }
    return { kind: "already_applied", run: row };
  }

  if (dryRun) {
    return dryRunPreview(true);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiHubIngestionRun.updateMany({
      where: {
        tenantId,
        id: runId,
        status: "succeeded",
        appliedAt: null,
      },
      data: { appliedAt: new Date() },
    });

    if (updated.count === 0) {
      const row = await tx.apiHubIngestionRun.findFirst({
        where: { tenantId, id: runId },
        select: { status: true, appliedAt: true },
      });
      if (!row) return null;
      if (row.appliedAt) {
        const full = await tx.apiHubIngestionRun.findFirst({
          where: { tenantId, id: runId },
          select: APIHUB_INGESTION_RUN_ROW_SELECT,
        });
        return full ? { kind: "already_applied", run: full } : null;
      }
      return { kind: "not_succeeded", status: row.status };
    }

    const run = await tx.apiHubIngestionRun.findFirst({
      where: { tenantId, id: runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
    if (!run) return null;
    return { kind: "applied", run };
  });
}

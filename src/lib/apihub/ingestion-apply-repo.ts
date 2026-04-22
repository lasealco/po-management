import { prisma } from "@/lib/prisma";

import type { ApiHubIngestionApplyMatchKey, ApiHubStagingApplyTarget } from "@/lib/apihub/constants";
import {
  applyMappedRowsInTransaction,
  dryRunMappedRowsPreview,
  dryRunPurchaseOrderBuyerReferenceConflicts,
  dryRunSalesOrderExternalRefConflicts,
  type ApiHubStagingApplySummary,
} from "@/lib/apihub/downstream-mapped-rows-apply";
import { resolveIngestionApplyMappedRows } from "@/lib/apihub/ingestion-apply-rows";
import { APIHUB_INGESTION_RUN_ROW_SELECT, type ApiHubIngestionRunRow } from "@/lib/apihub/ingestion-runs-repo";

export type ApplyDryRunGate =
  | { type: "not_succeeded"; status: string }
  | { type: "already_applied" }
  | {
      type: "blocked";
      reason: "connector_not_found" | "connector_not_active";
      connectorStatus?: string;
    }
  | { type: "downstream_rows_unresolved"; message: string }
  | { type: "downstream_rows_invalid"; summary: ApiHubStagingApplySummary }
  | { type: "duplicate_sales_order_external_ref"; rowIndex: number; externalRef: string }
  | { type: "duplicate_purchase_order_buyer_reference"; rowIndex: number; buyerReference: string };

export type ApplyIngestionRunDownstreamOpts = {
  target: ApiHubStagingApplyTarget;
  actorUserId: string;
  bodyRows?: unknown;
  matchKey: ApiHubIngestionApplyMatchKey;
};

export type ApplyApiHubIngestionRunOutcome =
  | { kind: "applied"; run: ApiHubIngestionRunRow; downstreamSummary?: ApiHubStagingApplySummary }
  | { kind: "already_applied"; run: ApiHubIngestionRunRow }
  | { kind: "not_succeeded"; status: string }
  | { kind: "blocked"; reason: "connector_not_found" | "connector_not_active"; connectorStatus?: string }
  | {
      kind: "dry_run";
      wouldApply: boolean;
      run: ApiHubIngestionRunRow;
      gate?: ApplyDryRunGate;
      downstreamPreview?: ApiHubStagingApplySummary;
    }
  | { kind: "downstream_failed"; message: string };

const ANCHOR_SELECT_MINIMAL = {
  id: true,
  connectorId: true,
  status: true,
  appliedAt: true,
  connector: { select: { id: true, status: true } },
} as const;

const ANCHOR_SELECT_DOWNSTREAM = {
  id: true,
  connectorId: true,
  status: true,
  appliedAt: true,
  resultSummary: true,
  connector: { select: { id: true, status: true } },
} as const;

/**
 * Marks an ingestion run as applied after a successful pipeline (`status === succeeded`), optionally
 * writing mapped rows to SO / PO / Control Tower audit (P3) in the same DB transaction as `appliedAt`.
 */
export async function applyApiHubIngestionRun(opts: {
  tenantId: string;
  runId: string;
  dryRun?: boolean;
  downstream?: ApplyIngestionRunDownstreamOpts;
}): Promise<ApplyApiHubIngestionRunOutcome | null> {
  const { tenantId, runId, dryRun, downstream } = opts;

  const anchorSelect = downstream ? ANCHOR_SELECT_DOWNSTREAM : ANCHOR_SELECT_MINIMAL;
  const anchor = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId, id: runId },
    select: anchorSelect,
  });
  if (!anchor) return null;

  async function loadFullRun(): Promise<ApiHubIngestionRunRow | null> {
    return prisma.apiHubIngestionRun.findFirst({
      where: { tenantId, id: runId },
      select: APIHUB_INGESTION_RUN_ROW_SELECT,
    });
  }

  async function dryRunPreview(
    wouldApply: boolean,
    gate?: ApplyDryRunGate,
    downstreamPreview?: ApiHubStagingApplySummary,
  ): Promise<ApplyApiHubIngestionRunOutcome | null> {
    const run = await loadFullRun();
    if (!run) return null;
    return { kind: "dry_run", wouldApply, run, gate, downstreamPreview };
  }

  if (anchor.connectorId) {
    if (!anchor.connector) {
      if (dryRun) {
        const run = await loadFullRun();
        if (!run) return null;
        return { kind: "dry_run", wouldApply: false, run, gate: { type: "blocked", reason: "connector_not_found" } };
      }
      return { kind: "blocked", reason: "connector_not_found" };
    }
    if (anchor.connector.status !== "active") {
      if (dryRun) {
        const run = await loadFullRun();
        if (!run) return null;
        return {
          kind: "dry_run",
          wouldApply: false,
          run,
          gate: {
            type: "blocked",
            reason: "connector_not_active",
            connectorStatus: anchor.connector.status,
          },
        };
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
      const run = await loadFullRun();
      if (!run) return null;
      return { kind: "dry_run", wouldApply: false, run, gate: { type: "not_succeeded", status: anchor.status } };
    }
    return { kind: "not_succeeded", status: anchor.status };
  }

  if (anchor.appliedAt) {
    const row = await loadFullRun();
    if (!row) return null;
    if (dryRun) {
      return { kind: "dry_run", wouldApply: false, run: row, gate: { type: "already_applied" } };
    }
    return { kind: "already_applied", run: row };
  }

  if (downstream) {
    const fullForResolve = await loadFullRun();
    if (!fullForResolve) return null;
    const resolved = resolveIngestionApplyMappedRows({
      bodyRows: downstream.bodyRows,
      resultSummary: fullForResolve.resultSummary,
    });
    if (!resolved.ok) {
      if (dryRun) {
        return dryRunPreview(false, { type: "downstream_rows_unresolved", message: resolved.message });
      }
      return { kind: "downstream_failed", message: resolved.message };
    }
    const enforceSalesOrderExternalRefUnique =
      downstream.target === "sales_order" && downstream.matchKey === "sales_order_external_ref";
    const enforcePurchaseOrderBuyerReferenceUnique =
      downstream.target === "purchase_order" && downstream.matchKey === "purchase_order_buyer_reference";

    if (dryRun) {
      const preview = await dryRunMappedRowsPreview({
        tenantId,
        target: downstream.target,
        rows: resolved.rows,
      });
      const anyInvalid = preview.rows.some((r) => !r.ok);
      if (anyInvalid) {
        return dryRunPreview(false, { type: "downstream_rows_invalid", summary: preview }, preview);
      }
      if (enforceSalesOrderExternalRefUnique) {
        const dup = await dryRunSalesOrderExternalRefConflicts(tenantId, resolved.rows);
        if (dup) {
          return dryRunPreview(false, {
            type: "duplicate_sales_order_external_ref",
            rowIndex: dup.rowIndex,
            externalRef: dup.externalRef,
          });
        }
      }
      if (enforcePurchaseOrderBuyerReferenceUnique) {
        const dupPo = await dryRunPurchaseOrderBuyerReferenceConflicts(tenantId, resolved.rows);
        if (dupPo) {
          return dryRunPreview(false, {
            type: "duplicate_purchase_order_buyer_reference",
            rowIndex: dupPo.rowIndex,
            buyerReference: dupPo.buyerReference,
          });
        }
      }
      return dryRunPreview(true, undefined, preview);
    }

    try {
      const { downstreamSummary, run } = await prisma.$transaction(async (tx) => {
        const claimed = await tx.apiHubIngestionRun.updateMany({
          where: {
            tenantId,
            id: runId,
            status: "succeeded",
            appliedAt: null,
          },
          data: { appliedAt: new Date() },
        });
        if (claimed.count === 0) {
          const row = await tx.apiHubIngestionRun.findFirst({
            where: { tenantId, id: runId },
            select: { status: true, appliedAt: true },
          });
          if (!row) {
            throw new Error("Run not found during apply claim.");
          }
          if (row.appliedAt) {
            const full = await tx.apiHubIngestionRun.findFirst({
              where: { tenantId, id: runId },
              select: APIHUB_INGESTION_RUN_ROW_SELECT,
            });
            throw Object.assign(new Error("already_applied"), { _applyRace: "already_applied" as const, run: full });
          }
          throw Object.assign(new Error("not_succeeded"), { _applyRace: "not_succeeded" as const, status: row.status });
        }

        const pack = await applyMappedRowsInTransaction(tx, {
          tenantId,
          actorUserId: downstream.actorUserId,
          target: downstream.target,
          rows: resolved.rows,
          ctSource: { kind: "ingestion_run", runId },
          enforceSalesOrderExternalRefUnique,
          enforcePurchaseOrderBuyerReferenceUnique,
        });

        const runRow = await tx.apiHubIngestionRun.findFirst({
          where: { tenantId, id: runId },
          select: APIHUB_INGESTION_RUN_ROW_SELECT,
        });
        if (!runRow) {
          throw new Error("Run not found after apply.");
        }
        return { downstreamSummary: pack, run: runRow };
      });
      return { kind: "applied", run, downstreamSummary };
    } catch (e) {
      if (e && typeof e === "object" && "_applyRace" in e) {
        const ex = e as { _applyRace: "already_applied" | "not_succeeded"; run?: ApiHubIngestionRunRow; status?: string };
        if (ex._applyRace === "already_applied" && ex.run) {
          return { kind: "already_applied", run: ex.run };
        }
        if (ex._applyRace === "not_succeeded" && typeof ex.status === "string") {
          return { kind: "not_succeeded", status: ex.status };
        }
      }
      const msg = e instanceof Error ? e.message : "Downstream apply failed.";
      return { kind: "downstream_failed", message: msg };
    }
  }

  if (dryRun) {
    const run = await loadFullRun();
    if (!run) return null;
    return { kind: "dry_run", wouldApply: true, run };
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

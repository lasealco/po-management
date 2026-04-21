import { prisma } from "@/lib/prisma";
import {
  getTwinIntegrityRepairDryRunForTenant,
  type TwinIntegrityRepairActionType,
  type TwinIntegrityRepairProposal,
} from "@/lib/supply-chain-twin/integrity-repair-dry-run";

export type TwinIntegrityRepairApplyAuditRecord = {
  action: TwinIntegrityRepairActionType;
  targetId: string;
  reason: string;
  applied: boolean;
  affectedRows: number;
};

export type TwinIntegrityRepairApplySummary = {
  checkedAt: string;
  tenantId: string;
  dryRun: false;
  confirmed: true;
  attemptedActionCount: number;
  appliedActionCount: number;
  auditRecords: TwinIntegrityRepairApplyAuditRecord[];
};

async function applyOneProposal(tenantId: string, proposal: TwinIntegrityRepairProposal): Promise<number> {
  if (
    proposal.action === "delete_orphan_edge_missing_from_snapshot" ||
    proposal.action === "delete_orphan_edge_missing_to_snapshot"
  ) {
    const result = await prisma.supplyChainTwinEntityEdge.deleteMany({
      where: { tenantId, id: proposal.targetId },
    });
    return result.count;
  }
  const result = await prisma.supplyChainTwinScenarioRevision.deleteMany({
    where: { tenantId, id: proposal.targetId },
  });
  return result.count;
}

/**
 * Applies integrity repairs for current tenant using the dry-run proposal set.
 * Caller must enforce explicit confirmation before invoking this mutating helper.
 */
export async function applyTwinIntegrityRepairsForTenant(
  tenantId: string,
  options: { maxActions?: number } = {},
): Promise<TwinIntegrityRepairApplySummary> {
  const maxActions = Math.min(Math.max(options.maxActions ?? 500, 1), 5000);
  const planned = await getTwinIntegrityRepairDryRunForTenant(tenantId, { maxProposals: maxActions });
  const proposals = planned.proposals.slice(0, maxActions);

  const auditRecords: TwinIntegrityRepairApplyAuditRecord[] = [];
  let appliedActionCount = 0;

  for (const proposal of proposals) {
    const affectedRows = await applyOneProposal(tenantId, proposal);
    const applied = affectedRows > 0;
    if (applied) {
      appliedActionCount += 1;
    }
    auditRecords.push({
      action: proposal.action,
      targetId: proposal.targetId,
      reason: proposal.reason,
      applied,
      affectedRows,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    tenantId,
    dryRun: false,
    confirmed: true,
    attemptedActionCount: proposals.length,
    appliedActionCount,
    auditRecords,
  };
}

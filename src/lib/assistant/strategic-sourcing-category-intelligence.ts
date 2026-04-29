export type StrategicSourcingInputs = {
  purchaseOrders: Array<{ supplierId: string | null; totalAmount: number }>;
  suppliers: Array<{ id: string; name: string; srmCategory: string; approvalStatus: string }>;
  quoteRequests: Array<{ id: string; title: string; status: string; quotesDueAt: Date | null; responseStatuses: string[] }>;
  tariffVersions: Array<{
    id: string;
    versionNo: number;
    validTo: Date | null;
    approvalStatus: string;
    status: string;
    contractTitle: string;
  }>;
  onboardingTasksOpen: Array<{ id: string; supplierId: string; supplierName: string; title: string }>;
  compliancePackets: Array<{ id: string; renewalRiskCount: number; complianceGapCount: number }>;
  procurementPackets: Array<{ id: string; tenderRiskCount: number }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function num(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && value !== null && "toString" in value ? String((value as { toString(): string }).toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

export function buildSpendCategorySignals(inputs: StrategicSourcingInputs) {
  const bySupplier = new Map<string, number>();
  let grand = 0;
  for (const row of inputs.purchaseOrders) {
    if (!row.supplierId) continue;
    const v = num(row.totalAmount);
    grand += v;
    bySupplier.set(row.supplierId, (bySupplier.get(row.supplierId) ?? 0) + v);
  }
  const supplierShares = inputs.suppliers.map((supplier) => {
    const spend = bySupplier.get(supplier.id) ?? 0;
    const sharePct = grand > 0 ? Math.round((spend / grand) * 1000) / 10 : 0;
    return { supplierId: supplier.id, name: supplier.name, category: supplier.srmCategory, spend, sharePct };
  });
  const concentrated = supplierShares.filter((row) => row.sharePct >= 32 && row.spend > 0);
  const concentrationRiskCount = concentrated.length;

  const categoryTotals = new Map<string, number>();
  for (const row of supplierShares) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.spend);
  }

  return {
    concentrationRiskCount,
    concentratedSuppliers: concentrated.slice(0, 16).map((row) => ({
      supplierId: row.supplierId,
      name: row.name,
      sharePct: row.sharePct,
      category: row.category,
    })),
    categoryTotals: [...categoryTotals.entries()].map(([category, spend]) => ({ category, spend })),
    guardrail:
      "Spend concentration overlays use sampled PO totals — they do not reallocate awards, split contracts, or change supplier master data automatically.",
  };
}

export function buildRfqPipelineSignals(inputs: StrategicSourcingInputs) {
  const now = Date.now();
  const risks: Array<{ quoteRequestId: string; title: string; reason: string }> = [];
  for (const qr of inputs.quoteRequests) {
    if (qr.status !== "OPEN") continue;
    const substantive = qr.responseStatuses.some((status) =>
      ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"].includes(status),
    );
    const duePassed = qr.quotesDueAt != null && qr.quotesDueAt.getTime() < now;
    if (!substantive) {
      risks.push({
        quoteRequestId: qr.id,
        title: qr.title,
        reason: duePassed ? "OPEN RFQ past quotes due without substantive carrier responses yet." : "OPEN RFQ awaiting substantive carrier responses.",
      });
    } else if (duePassed) {
      risks.push({
        quoteRequestId: qr.id,
        title: qr.title,
        reason: "OPEN RFQ has carrier responses but remains unawarded past quotes due.",
      });
    }
  }
  const rfqPipelineRiskCount = risks.length;
  return {
    rfqPipelineRiskCount,
    rfqSignals: risks.slice(0, 18),
    guardrail: "RFQ overlays summarize readiness — they do not invite carriers, award lanes, or broadcast RFQs automatically.",
  };
}

export function buildTariffCoverageSignals(inputs: StrategicSourcingInputs) {
  const horizonMs = 90 * 86_400_000;
  const cutoff = Date.now() + horizonMs;
  const risky = inputs.tariffVersions.filter((version) => {
    if (version.approvalStatus === "PENDING") return true;
    if (version.status === "DRAFT" || version.status === "UNDER_REVIEW") return true;
    if (version.validTo != null && version.validTo.getTime() <= cutoff) return true;
    return false;
  });
  const tariffCoverageRiskCount = risky.length;
  return {
    tariffCoverageRiskCount,
    contractVersions: risky.slice(0, 18).map((version) => ({
      versionId: version.id,
      contractTitle: version.contractTitle,
      versionNo: version.versionNo,
      approvalStatus: version.approvalStatus,
      status: version.status,
      validTo: version.validTo?.toISOString().slice(0, 10) ?? null,
    })),
    guardrail:
      "Tariff coverage cues highlight approvals and validity windows — they do not publish tariff versions, extend contracts, or activate carrier tables automatically.",
  };
}

export function buildSupplierPanelSignals(inputs: StrategicSourcingInputs) {
  const pendingApproval = inputs.suppliers.filter((supplier) => supplier.approvalStatus === "pending_approval");
  const panel = pendingApproval;
  const supplierPanelRiskCount = panel.length + Math.min(inputs.onboardingTasksOpen.length, 28);
  return {
    supplierPanelRiskCount,
    pendingSuppliers: panel.slice(0, 16).map((supplier) => ({ supplierId: supplier.id, name: supplier.name, approvalStatus: supplier.approvalStatus })),
    onboardingGaps: inputs.onboardingTasksOpen.slice(0, 16).map((task) => ({
      taskId: task.id,
      supplierName: task.supplierName,
      title: task.title,
    })),
    guardrail:
      "Supplier panel cues surface onboarding / approval gaps — they do not approve suppliers, issue invitations, or change qualification status automatically.",
  };
}

export function buildCompliancePortfolioSignals(inputs: StrategicSourcingInputs) {
  const hot = inputs.compliancePackets.filter((packet) => packet.renewalRiskCount > 0 || packet.complianceGapCount > 1);
  const compliancePortfolioRiskCount = hot.length;
  return {
    compliancePortfolioRiskCount,
    compliancePackets: hot.slice(0, 14).map((packet) => ({
      packetId: packet.id,
      renewalRiskCount: packet.renewalRiskCount,
      complianceGapCount: packet.complianceGapCount,
    })),
    guardrail:
      "Compliance portfolio excerpts reference AMP23 packets — they do not renew obligations, waive clauses, or publish supplier documents automatically.",
  };
}

export function buildSavingsPipelineSignals(inputs: StrategicSourcingInputs) {
  let awardGap = 0;
  const now = Date.now();
  for (const qr of inputs.quoteRequests) {
    if (qr.status !== "OPEN") continue;
    const submitted = qr.responseStatuses.some((status) => status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "SHORTLISTED");
    const duePassed = qr.quotesDueAt != null && qr.quotesDueAt.getTime() < now;
    if (submitted && duePassed) awardGap += 1;
  }
  const tenderBacklog = inputs.procurementPackets.filter((packet) => packet.tenderRiskCount > 0).length;
  const savingsPipelineRiskCount = awardGap + tenderBacklog;
  return {
    savingsPipelineRiskCount,
    awardGapRfqs: awardGap,
    tenderBacklogPackets: tenderBacklog,
    guardrail:
      "Savings pipeline cues highlight stuck awards and tender overlays — they do not launch sourcing waves, change allocations, or freeze bookings automatically.",
  };
}

export function buildStrategicSourcingPacket(inputs: StrategicSourcingInputs) {
  const spendCategory = buildSpendCategorySignals(inputs);
  const rfqPipeline = buildRfqPipelineSignals(inputs);
  const tariffCoverage = buildTariffCoverageSignals(inputs);
  const supplierPanel = buildSupplierPanelSignals(inputs);
  const compliancePortfolio = buildCompliancePortfolioSignals(inputs);
  const savingsPipeline = buildSavingsPipelineSignals(inputs);

  const concentrationRiskCount = spendCategory.concentrationRiskCount;
  const rfqPipelineRiskCount = rfqPipeline.rfqPipelineRiskCount;
  const tariffCoverageRiskCount = tariffCoverage.tariffCoverageRiskCount;
  const supplierPanelRiskCount = supplierPanel.supplierPanelRiskCount;
  const compliancePortfolioRiskCount = compliancePortfolio.compliancePortfolioRiskCount;
  const savingsPipelineRiskCount = savingsPipeline.savingsPipelineRiskCount;

  const sourcingScore = clamp(
    Math.round(
      100 -
        Math.min(18, concentrationRiskCount * 3) -
        Math.min(22, rfqPipelineRiskCount * 3) -
        Math.min(18, tariffCoverageRiskCount * 2) -
        Math.min(18, supplierPanelRiskCount * 2) -
        Math.min(14, compliancePortfolioRiskCount * 4) -
        Math.min(16, savingsPipelineRiskCount * 3),
    ),
  );

  const sourceSummary = {
    purchaseOrdersSampled: inputs.purchaseOrders.length,
    suppliersSampled: inputs.suppliers.length,
    quoteRequestsSampled: inputs.quoteRequests.length,
    tariffVersionsSampled: inputs.tariffVersions.length,
    onboardingTasksOpen: inputs.onboardingTasksOpen.length,
    compliancePacketsSampled: inputs.compliancePackets.length,
    procurementPacketsSampled: inputs.procurementPackets.length,
    guardrail:
      "Sprint 19 packets unify procurement posture signals across PO concentration, RFQs, tariff validity, supplier onboarding, contract compliance packets, and tender backlog cues — sourcing leadership reviews outcomes before launching events or reallocating spend.",
  };

  const responsePlan = {
    status:
      sourcingScore < 66 ? "STRATEGIC_SOURCING_REVIEW_REQUIRED" : sourcingScore < 82 ? "CATEGORY_MANAGER_DESK_REVIEW" : "MONITOR",
    owners: ["Category management", "Transport procurement", "Tariff ops", "Supplier onboarding", "Commercial contracts"],
    steps: [
      "Validate concentration math against finance-approved PO populations before supplier diversification narratives.",
      "Separate tariff expiry urgency from RFQ pipeline hygiene — avoid mixed escalations across unrelated lanes.",
      "Confirm supplier onboarding tasks against diligence outcomes prior to panel expansions.",
      "Treat savings backlog cues as queue inputs — awards and allocations remain workflow-owned.",
    ],
    guardrail: "Strategic sourcing recommendations stay advisory until category councils execute governed sourcing workflows.",
  };

  const rollbackPlan = {
    steps: [
      "Rejecting a packet does not delete RFQs, tariff versions, supplier profiles, or procurement packets.",
      "Open a fresh packet after awards, tariff republications, or supplier panel changes.",
      "Manual approvals remain mandatory before sourcing-event launches or spend commits.",
    ],
    guardrail: "Rollback preserves advisory narratives only — strategic sourcing records are never auto-reverted here.",
  };

  const leadershipSummary = [
    `Sprint 19 Strategic Sourcing & Category Intelligence score is ${sourcingScore}/100 with ${concentrationRiskCount} concentration cue(s), ${rfqPipelineRiskCount} RFQ pipeline cue(s), ${tariffCoverageRiskCount} tariff coverage cue(s), ${supplierPanelRiskCount} supplier panel cue(s), ${compliancePortfolioRiskCount} compliance portfolio cue(s), and ${savingsPipelineRiskCount} savings pipeline cue(s).`,
    savingsPipeline.guardrail,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 19 Strategic Sourcing & Category Intelligence: score ${sourcingScore}/100`,
    status: "DRAFT" as const,
    sourcingScore,
    concentrationRiskCount,
    rfqPipelineRiskCount,
    tariffCoverageRiskCount,
    supplierPanelRiskCount,
    compliancePortfolioRiskCount,
    savingsPipelineRiskCount,
    sourceSummary,
    spendCategory,
    rfqPipeline,
    tariffCoverage,
    supplierPanel,
    compliancePortfolio,
    savingsPipeline,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

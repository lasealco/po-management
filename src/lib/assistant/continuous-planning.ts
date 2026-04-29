export type PlanningInputs = {
  demandUnits: number;
  plannedDemandUnits: number;
  openSalesOrders: number;
  supplyUnits: number;
  plannedSupplyUnits: number;
  inboundPurchaseOrders: number;
  inventoryUnits: number;
  allocatedUnits: number;
  openWmsTasks: number;
  transportExceptions: number;
  lateShipments: number;
  supplierCommitmentGaps: number;
  financeRiskScore: number;
  simulationRecommendationKey: string | null;
};

type TriggerSeverity = "LOW" | "MEDIUM" | "HIGH";

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildPlanControlSnapshot(inputs: PlanningInputs) {
  const availableInventory = Math.max(0, inputs.inventoryUnits - inputs.allocatedUnits);
  const totalAvailable = availableInventory + inputs.supplyUnits;
  const demandVariancePct = pct(inputs.demandUnits - inputs.plannedDemandUnits, inputs.plannedDemandUnits);
  const supplyCoveragePct = pct(inputs.supplyUnits, Math.max(inputs.demandUnits, inputs.plannedDemandUnits));
  const inventoryCoveragePct = pct(availableInventory, Math.max(1, inputs.demandUnits));
  const totalCoveragePct = pct(totalAvailable, Math.max(1, inputs.demandUnits));
  return {
    demandUnits: inputs.demandUnits,
    plannedDemandUnits: inputs.plannedDemandUnits,
    demandVariancePct,
    openSalesOrders: inputs.openSalesOrders,
    supplyUnits: inputs.supplyUnits,
    plannedSupplyUnits: inputs.plannedSupplyUnits,
    supplyCoveragePct,
    inboundPurchaseOrders: inputs.inboundPurchaseOrders,
    inventoryUnits: inputs.inventoryUnits,
    allocatedUnits: inputs.allocatedUnits,
    availableInventory,
    inventoryCoveragePct,
    totalCoveragePct,
    openWmsTasks: inputs.openWmsTasks,
    transportExceptions: inputs.transportExceptions,
    lateShipments: inputs.lateShipments,
    supplierCommitmentGaps: inputs.supplierCommitmentGaps,
    financeRiskScore: inputs.financeRiskScore,
    simulationRecommendationKey: inputs.simulationRecommendationKey,
  };
}

export function buildPlanVariance(snapshot: ReturnType<typeof buildPlanControlSnapshot>) {
  const demandGapUnits = Math.max(0, snapshot.demandUnits - snapshot.plannedDemandUnits);
  const supplyGapUnits = Math.max(0, snapshot.demandUnits - snapshot.supplyUnits - snapshot.availableInventory);
  const taskPressurePct = pct(snapshot.openWmsTasks, Math.max(1, snapshot.openSalesOrders + snapshot.inboundPurchaseOrders));
  return {
    demandGapUnits,
    supplyGapUnits,
    taskPressurePct,
    transportRiskCount: snapshot.transportExceptions + snapshot.lateShipments,
    supplierCommitmentGaps: snapshot.supplierCommitmentGaps,
    financeRiskScore: snapshot.financeRiskScore,
    variances: [
      { key: "demand_vs_plan", valuePct: snapshot.demandVariancePct, thresholdPct: 10, breached: snapshot.demandVariancePct >= 10 },
      { key: "supply_coverage", valuePct: snapshot.supplyCoveragePct, thresholdPct: 80, breached: snapshot.supplyCoveragePct < 80 },
      { key: "inventory_coverage", valuePct: snapshot.inventoryCoveragePct, thresholdPct: 25, breached: snapshot.inventoryCoveragePct < 25 },
      { key: "task_pressure", valuePct: taskPressurePct, thresholdPct: 40, breached: taskPressurePct >= 40 },
    ],
  };
}

export function buildReplanningTriggers(snapshot: ReturnType<typeof buildPlanControlSnapshot>, variance = buildPlanVariance(snapshot)) {
  const triggers = [
    ...(variance.demandGapUnits > 0 && snapshot.demandVariancePct >= 10
      ? [
          {
            key: "demand_spike",
            severity: snapshot.demandVariancePct >= 25 ? ("HIGH" as TriggerSeverity) : ("MEDIUM" as TriggerSeverity),
            detail: `Demand is ${snapshot.demandVariancePct}% above plan with ${variance.demandGapUnits} gap units.`,
          },
        ]
      : []),
    ...(variance.supplyGapUnits > 0
      ? [
          {
            key: "supply_shortage",
            severity: variance.supplyGapUnits > snapshot.demandUnits * 0.2 ? ("HIGH" as TriggerSeverity) : ("MEDIUM" as TriggerSeverity),
            detail: `Supply plus available inventory leaves ${variance.supplyGapUnits} uncovered demand units.`,
          },
        ]
      : []),
    ...(variance.transportRiskCount > 0
      ? [
          {
            key: "transport_risk",
            severity: variance.transportRiskCount >= 5 ? ("HIGH" as TriggerSeverity) : ("MEDIUM" as TriggerSeverity),
            detail: `${variance.transportRiskCount} transport exception or late shipment signal(s) may affect plan execution.`,
          },
        ]
      : []),
    ...(snapshot.supplierCommitmentGaps > 0
      ? [
          {
            key: "supplier_commitment_gap",
            severity: snapshot.supplierCommitmentGaps >= 3 ? ("HIGH" as TriggerSeverity) : ("MEDIUM" as TriggerSeverity),
            detail: `${snapshot.supplierCommitmentGaps} supplier commitment gap(s) need follow-up before replanning.`,
          },
        ]
      : []),
    ...(snapshot.simulationRecommendationKey && snapshot.simulationRecommendationKey !== "baseline_current_plan"
      ? [
          {
            key: "simulation_promotion_review",
            severity: "MEDIUM" as TriggerSeverity,
            detail: `AMP34 recommends ${snapshot.simulationRecommendationKey}; review before plan promotion.`,
          },
        ]
      : []),
  ];
  return {
    replanningTriggerCount: triggers.length,
    triggers,
  };
}

export function buildRecoveryPlan(snapshot: ReturnType<typeof buildPlanControlSnapshot>, triggers = buildReplanningTriggers(snapshot)) {
  const actions = [
    ...triggers.triggers
      .filter((trigger) => trigger.key === "demand_spike" || trigger.key === "supply_shortage")
      .map((trigger) => ({
        actionKind: "planning_supply_demand_rebalance_review",
        priority: trigger.severity === "HIGH" ? "HIGH" : "MEDIUM",
        owner: "Planning",
        detail: "Review demand, inbound POs, inventory availability, and customer priority before changing promise or allocation.",
      })),
    ...triggers.triggers
      .filter((trigger) => trigger.key === "transport_risk")
      .map((trigger) => ({
        actionKind: "planning_transport_recovery_review",
        priority: trigger.severity === "HIGH" ? "HIGH" : "MEDIUM",
        owner: "Operations",
        detail: "Review shipment exceptions, carrier options, and customer-impact sequence before transport replanning.",
      })),
    ...triggers.triggers
      .filter((trigger) => trigger.key === "supplier_commitment_gap")
      .map((trigger) => ({
        actionKind: "planning_supplier_commitment_review",
        priority: trigger.severity === "HIGH" ? "HIGH" : "MEDIUM",
        owner: "Procurement",
        detail: "Confirm supplier commitments and alternate supply before adjusting the plan.",
      })),
    ...triggers.triggers
      .filter((trigger) => trigger.key === "simulation_promotion_review")
      .map(() => ({
        actionKind: "planning_simulation_promotion_review",
        priority: "MEDIUM",
        owner: "Planning",
        detail: "Validate AMP34 simulation assumptions before promoting a scenario into planning work.",
      })),
  ];
  return {
    recoveryActionCount: actions.length,
    actions,
    recommendation:
      triggers.replanningTriggerCount > 0
        ? "Queue replanning review and assign owners before changing demand, supply, inventory, transport, or supplier commitments."
        : "Keep current plan under monitor mode; no replanning trigger is currently breached.",
    guardrail: "Recovery actions are review work only and do not mutate forecasts, orders, POs, inventory, WMS, shipments, suppliers, or customer promises.",
  };
}

export function buildOwnerWork(triggers: ReturnType<typeof buildReplanningTriggers>, recovery = buildRecoveryPlan(buildPlanControlSnapshot({
  demandUnits: 0,
  plannedDemandUnits: 0,
  openSalesOrders: 0,
  supplyUnits: 0,
  plannedSupplyUnits: 0,
  inboundPurchaseOrders: 0,
  inventoryUnits: 0,
  allocatedUnits: 0,
  openWmsTasks: 0,
  transportExceptions: 0,
  lateShipments: 0,
  supplierCommitmentGaps: 0,
  financeRiskScore: 0,
  simulationRecommendationKey: null,
}), triggers)) {
  const ownerCounts = recovery.actions.reduce<Record<string, number>>((acc, action) => {
    acc[action.owner] = (acc[action.owner] ?? 0) + 1;
    return acc;
  }, {});
  return {
    ownerCounts,
    workItems: recovery.actions.map((action, index) => ({
      id: `amp35-work-${index + 1}`,
      owner: action.owner,
      actionKind: action.actionKind,
      priority: action.priority,
      detail: action.detail,
    })),
  };
}

export function buildPlanningApprovalPlan() {
  return {
    requiredApprovals: ["Planning", "Operations", "Procurement when supplier commitments change", "Customer service when promises change"],
    steps: [
      "Review plan-vs-actual variances and breached triggers.",
      "Assign recovery owners and due dates through action queue work.",
      "Create separate downstream work before changing forecasts, allocations, POs, WMS work, shipments, supplier commitments, or customer promises.",
    ],
    guardrail: "AMP35 packet approval is review approval only; execution requires separate downstream approved actions.",
  };
}

export function buildPlanningRollbackPlan() {
  const steps = [
    "Keep current forecasts, sales orders, purchase orders, inventory, WMS tasks, shipments, supplier commitments, and customer promises unchanged until downstream approval.",
    "If a replanning packet is rejected, preserve the packet and action queue notes as decision evidence.",
    "If actuals move materially, create a fresh AMP35 packet instead of editing archived plan-control evidence.",
    "Use audit events to explain why a plan trigger was accepted, rejected, or superseded.",
  ];
  return { stepCount: steps.length, steps };
}

export function scorePlanHealth(
  snapshot: ReturnType<typeof buildPlanControlSnapshot>,
  triggers: ReturnType<typeof buildReplanningTriggers>,
  variance: ReturnType<typeof buildPlanVariance>,
) {
  const demandPenalty = Math.min(25, Math.max(0, snapshot.demandVariancePct));
  const supplyPenalty = Math.min(25, Math.max(0, 85 - snapshot.supplyCoveragePct));
  const inventoryPenalty = Math.min(15, Math.max(0, 25 - snapshot.inventoryCoveragePct));
  const triggerPenalty = Math.min(30, triggers.replanningTriggerCount * 6);
  const transportPenalty = Math.min(15, variance.transportRiskCount * 3);
  return clamp(100 - demandPenalty - supplyPenalty - inventoryPenalty - triggerPenalty - transportPenalty);
}

export function buildContinuousPlanningPacket(inputs: PlanningInputs) {
  const snapshot = buildPlanControlSnapshot(inputs);
  const variance = buildPlanVariance(snapshot);
  const triggers = buildReplanningTriggers(snapshot, variance);
  const recoveryPlan = buildRecoveryPlan(snapshot, triggers);
  const ownerWork = buildOwnerWork(triggers, recoveryPlan);
  const approvalPlan = buildPlanningApprovalPlan();
  const rollbackPlan = buildPlanningRollbackPlan();
  const planHealthScore = scorePlanHealth(snapshot, triggers, variance);
  const leadershipSummary = [
    `Continuous planning health is ${planHealthScore}/100 with ${triggers.replanningTriggerCount} replanning trigger${triggers.replanningTriggerCount === 1 ? "" : "s"}.`,
    `Demand variance is ${snapshot.demandVariancePct}%, supply coverage is ${snapshot.supplyCoveragePct}%, inventory coverage is ${snapshot.inventoryCoveragePct}%, and transport risk count is ${variance.transportRiskCount}.`,
    "Packet creation does not mutate forecasts, sales orders, POs, inventory, WMS tasks, shipments, supplier commitments, or customer promises.",
  ].join("\n\n");
  return {
    title: triggers.replanningTriggerCount > 0 ? "Continuous planning: replanning review" : "Continuous planning: monitor",
    status: "DRAFT",
    planHealthScore,
    replanningTriggerCount: triggers.replanningTriggerCount,
    demandVariancePct: snapshot.demandVariancePct,
    supplyCoveragePct: snapshot.supplyCoveragePct,
    inventoryCoveragePct: snapshot.inventoryCoveragePct,
    transportRiskCount: variance.transportRiskCount,
    recoveryActionCount: recoveryPlan.recoveryActionCount,
    controlSnapshot: snapshot,
    variance,
    triggers,
    recoveryPlan,
    ownerWork,
    approvalPlan,
    rollbackPlan,
    leadershipSummary,
  };
}

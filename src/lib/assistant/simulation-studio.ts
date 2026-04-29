export type SimulationDomain = "DEMAND" | "SUPPLY" | "INVENTORY" | "TRANSPORT" | "FINANCE" | "RISK" | "NETWORK" | "WORK";

export type SimulationSignal = {
  id: string;
  domain: SimulationDomain;
  label: string;
  currentValue: number;
  unit: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  detail: string;
  stale: boolean;
};

export type SimulationStudioInputs = {
  signals: SimulationSignal[];
  networkRecommendationKey: string | null;
};

type ScenarioDefinition = {
  key: string;
  title: string;
  horizon: string;
  demandMultiplier: number;
  supplyMultiplier: number;
  inventoryMultiplier: number;
  transportDisruptionPct: number;
  costMultiplier: number;
  riskMultiplier: number;
};

const SCENARIOS: ScenarioDefinition[] = [
  {
    key: "baseline_current_plan",
    title: "Baseline current plan",
    horizon: "0-30 days",
    demandMultiplier: 1,
    supplyMultiplier: 1,
    inventoryMultiplier: 1,
    transportDisruptionPct: 0,
    costMultiplier: 1,
    riskMultiplier: 1,
  },
  {
    key: "demand_spike_15pct",
    title: "Demand spike +15%",
    horizon: "0-45 days",
    demandMultiplier: 1.15,
    supplyMultiplier: 1,
    inventoryMultiplier: 1,
    transportDisruptionPct: 3,
    costMultiplier: 1.03,
    riskMultiplier: 1.1,
  },
  {
    key: "supply_delay_10_days",
    title: "Supply delay 10 days",
    horizon: "15-60 days",
    demandMultiplier: 1,
    supplyMultiplier: 0.85,
    inventoryMultiplier: 0.92,
    transportDisruptionPct: 5,
    costMultiplier: 1.04,
    riskMultiplier: 1.2,
  },
  {
    key: "transport_disruption",
    title: "Transport disruption",
    horizon: "0-60 days",
    demandMultiplier: 1,
    supplyMultiplier: 0.95,
    inventoryMultiplier: 1,
    transportDisruptionPct: 18,
    costMultiplier: 1.08,
    riskMultiplier: 1.35,
  },
  {
    key: "cost_pressure_5pct",
    title: "Cost pressure +5%",
    horizon: "30-90 days",
    demandMultiplier: 1,
    supplyMultiplier: 1,
    inventoryMultiplier: 1,
    transportDisruptionPct: 2,
    costMultiplier: 1.05,
    riskMultiplier: 1.05,
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function domainTotal(inputs: SimulationStudioInputs, domain: SimulationDomain) {
  return inputs.signals.filter((signal) => signal.domain === domain).reduce((sum, signal) => sum + signal.currentValue, 0);
}

function confidencePenalty(inputs: SimulationStudioInputs) {
  return inputs.signals.reduce((sum, signal) => sum + (signal.confidence === "LOW" ? 3 : signal.confidence === "MEDIUM" ? 1 : 0), 0);
}

export function buildAssumptionLedger(inputs: SimulationStudioInputs) {
  const dataFreshnessRiskCount = inputs.signals.filter((signal) => signal.stale).length;
  const assumptions = [
    {
      key: "demand_multiplier",
      label: "Demand stress",
      sourceDomains: ["DEMAND"],
      detail: "Demand scenarios use open order and customer demand signals as the baseline.",
    },
    {
      key: "supply_delay",
      label: "Supply stress",
      sourceDomains: ["SUPPLY", "INVENTORY"],
      detail: "Supply delay scenarios reduce inbound/open PO capacity and available inventory proxies.",
    },
    {
      key: "transport_disruption",
      label: "Transport stress",
      sourceDomains: ["TRANSPORT", "NETWORK"],
      detail: "Transport disruption scenarios amplify booking lane exceptions and network risk signals.",
    },
    {
      key: "cost_pressure",
      label: "Cost stress",
      sourceDomains: ["FINANCE"],
      detail: "Cost pressure scenarios use finance packet risk and variance signals where available.",
    },
  ];
  return {
    assumptionCount: assumptions.length,
    dataFreshnessRiskCount,
    signals: inputs.signals.map((signal) => ({
      id: signal.id,
      domain: signal.domain,
      label: signal.label,
      currentValue: signal.currentValue,
      unit: signal.unit,
      confidence: signal.confidence,
      stale: signal.stale,
      detail: signal.detail,
    })),
    assumptions,
    guardrail: "Assumptions are replayable decision evidence only; they do not update forecasts, orders, supply, inventory, transport, finance, or network records.",
  };
}

export function runSimulationScenarios(inputs: SimulationStudioInputs) {
  const demand = domainTotal(inputs, "DEMAND");
  const supply = domainTotal(inputs, "SUPPLY");
  const inventory = domainTotal(inputs, "INVENTORY");
  const transport = domainTotal(inputs, "TRANSPORT");
  const finance = domainTotal(inputs, "FINANCE");
  const risk = domainTotal(inputs, "RISK") + domainTotal(inputs, "NETWORK") + domainTotal(inputs, "WORK");
  const runs = SCENARIOS.map((scenario) => {
    const simulatedDemand = Math.round(demand * scenario.demandMultiplier);
    const simulatedSupply = Math.round(supply * scenario.supplyMultiplier + inventory * scenario.inventoryMultiplier);
    const gapUnits = Math.max(0, simulatedDemand - simulatedSupply);
    const transportRisk = Math.round(transport * scenario.riskMultiplier + scenario.transportDisruptionPct);
    const costImpact = Math.round((finance + simulatedDemand * 0.5 + transportRisk * 10) * (scenario.costMultiplier - 1));
    const riskScore = clamp(Math.round(gapUnits / 10 + transportRisk + risk * scenario.riskMultiplier + confidencePenalty(inputs)));
    const serviceLevelPct = clamp(100 - Math.round(gapUnits / Math.max(1, simulatedDemand) * 100) - Math.round(transportRisk / 10));
    const valueImpact = Math.round(serviceLevelPct * 100 - costImpact - riskScore * 25);
    return {
      key: scenario.key,
      title: scenario.title,
      horizon: scenario.horizon,
      simulatedDemand,
      simulatedSupply,
      gapUnits,
      transportRisk,
      costImpact,
      riskScore,
      serviceLevelPct,
      valueImpact,
      assumptions: {
        demandMultiplier: scenario.demandMultiplier,
        supplyMultiplier: scenario.supplyMultiplier,
        inventoryMultiplier: scenario.inventoryMultiplier,
        transportDisruptionPct: scenario.transportDisruptionPct,
        costMultiplier: scenario.costMultiplier,
        riskMultiplier: scenario.riskMultiplier,
      },
      guardrail: "Simulation run is advisory and does not mutate planning, order, inventory, shipment, supplier, finance, or network records.",
    };
  });
  return {
    scenarioCount: runs.length,
    runs,
  };
}

export function compareSimulationRuns(runSet: ReturnType<typeof runSimulationScenarios>) {
  const comparisons = runSet.runs
    .map((run) => ({
      key: run.key,
      title: run.title,
      serviceLevelPct: run.serviceLevelPct,
      gapUnits: run.gapUnits,
      costImpact: run.costImpact,
      riskScore: run.riskScore,
      valueImpact: run.valueImpact,
      compositeScore: clamp(Math.round(run.serviceLevelPct + run.valueImpact / 250 - run.riskScore - run.costImpact / 100)),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);
  return {
    bestScenarioKey: comparisons[0]?.key ?? "baseline_current_plan",
    comparisons,
  };
}

export function buildSimulationRecommendation(inputs: SimulationStudioInputs, comparison = compareSimulationRuns(runSimulationScenarios(inputs))) {
  const best = comparison.comparisons[0];
  const baseline = comparison.comparisons.find((item) => item.key === "baseline_current_plan");
  const recommendedScenarioKey = best?.key ?? "baseline_current_plan";
  const networkLink =
    inputs.networkRecommendationKey && inputs.networkRecommendationKey !== "baseline_no_change"
      ? `Review AMP33 network recommendation ${inputs.networkRecommendationKey} before promoting this simulation.`
      : "No active non-baseline AMP33 network recommendation is required before promotion.";
  return {
    recommendedScenarioKey,
    title: best ? `Promote ${best.title}` : "Keep current plan",
    rationale: [
      best ? `${best.title} has the strongest composite score (${best.compositeScore}).` : "No simulation runs are available.",
      baseline && best && best.key !== baseline.key ? `Compared with baseline, service changes by ${best.serviceLevelPct - baseline.serviceLevelPct} points and risk changes by ${best.riskScore - baseline.riskScore}.` : "Baseline remains the recommended control case.",
      networkLink,
    ],
    promotionActions: [
      "Queue review before promoting any scenario into planning, network, procurement, transport, finance, or action-queue execution.",
      "Validate assumptions with business owners and refresh stale signals before customer-facing commitments.",
    ],
    guardrail: "Recommendation creates review evidence only; it does not promote a scenario, update plans, or execute downstream actions automatically.",
  };
}

export function buildReplayPlan(assumptions: ReturnType<typeof buildAssumptionLedger>, runSet: ReturnType<typeof runSimulationScenarios>) {
  return {
    replayKey: `amp34-${runSet.scenarioCount}-scenario-suite`,
    inputs: assumptions.signals.map((signal) => ({ id: signal.id, domain: signal.domain, value: signal.currentValue, unit: signal.unit })),
    steps: [
      "Freeze the assumption ledger and scenario definitions with the packet.",
      "Replay the same scenario definitions against refreshed signals before promotion.",
      "Compare refreshed results against archived composite scores and explain material changes.",
    ],
  };
}

export function buildArchivePlan() {
  return {
    archivePolicy: "Keep packet JSON as decision evidence; supersede with a new packet when assumptions materially change.",
    exportReady: true,
    steps: [
      "Archive assumption ledger, simulation runs, comparison, recommendation, and approval notes together.",
      "Link queued reviews and audit events back to the packet for traceability.",
      "Do not delete underlying operational evidence when archiving the simulation packet.",
    ],
  };
}

export function buildSimulationApprovalPlan(recommendation: ReturnType<typeof buildSimulationRecommendation>) {
  return {
    recommendedScenarioKey: recommendation.recommendedScenarioKey,
    requiredApprovals: ["Planning", "Operations", "Finance when cost impact is material", "Network owner when AMP33 footprint assumptions are referenced"],
    steps: [
      "Review assumptions, stale signal count, and scenario comparison.",
      "Approve or reject scenario promotion in the action queue.",
      "Create separate downstream work for planning, network, procurement, transport, finance, or customer commitments.",
    ],
    guardrail: "AMP34 queues simulation review only; approval of this packet is not execution approval for downstream records.",
  };
}

export function buildSimulationRollbackPlan() {
  const steps = [
    "Keep forecasts, orders, POs, inventory, shipments, finance records, network packets, and action execution unchanged until downstream approval.",
    "If a simulation is rejected, preserve the packet as decision evidence and mark the review item rejected.",
    "If assumptions change, create a new packet instead of overwriting archived scenario results.",
    "Use audit events and replay notes to explain why a scenario was promoted, rejected, or superseded.",
  ];
  return { stepCount: steps.length, steps };
}

export function scoreSimulationStudio(
  assumptions: ReturnType<typeof buildAssumptionLedger>,
  comparison: ReturnType<typeof compareSimulationRuns>,
) {
  const best = comparison.comparisons[0];
  const scenarioDepth = Math.min(25, comparison.comparisons.length * 5);
  const assumptionDepth = Math.min(20, assumptions.assumptionCount * 5);
  const freshnessPenalty = Math.min(20, assumptions.dataFreshnessRiskCount * 4);
  const confidence = Math.max(0, 25 - confidencePenalty({ signals: assumptions.signals, networkRecommendationKey: null }));
  const bestScore = best ? Math.max(0, Math.min(30, Math.round(best.compositeScore / 3))) : 0;
  return clamp(scenarioDepth + assumptionDepth + confidence + bestScore - freshnessPenalty);
}

export function buildSimulationStudioPacket(inputs: SimulationStudioInputs) {
  const assumptions = buildAssumptionLedger(inputs);
  const scenarioRuns = runSimulationScenarios(inputs);
  const comparison = compareSimulationRuns(scenarioRuns);
  const recommendation = buildSimulationRecommendation(inputs, comparison);
  const replayPlan = buildReplayPlan(assumptions, scenarioRuns);
  const archivePlan = buildArchivePlan();
  const approvalPlan = buildSimulationApprovalPlan(recommendation);
  const rollbackPlan = buildSimulationRollbackPlan();
  const simulationScore = scoreSimulationStudio(assumptions, comparison);
  const best = comparison.comparisons[0];
  const leadershipSummary = [
    `Simulation studio score is ${simulationScore}/100 across ${scenarioRuns.scenarioCount} replayable scenarios and ${assumptions.assumptionCount} assumption groups.`,
    `Recommended scenario: ${recommendation.recommendedScenarioKey}${best ? ` with service ${best.serviceLevelPct}%, risk ${best.riskScore}, and value impact ${best.valueImpact}.` : "."}`,
    `Stale signal count is ${assumptions.dataFreshnessRiskCount}; packet creation does not mutate forecasts, orders, POs, inventory, shipments, finance, network, or action execution records.`,
  ].join("\n\n");
  return {
    title: `Simulation studio: ${recommendation.recommendedScenarioKey}`,
    status: "DRAFT",
    simulationScore,
    scenarioCount: scenarioRuns.scenarioCount,
    assumptionCount: assumptions.assumptionCount,
    signalCount: inputs.signals.length,
    dataFreshnessRiskCount: assumptions.dataFreshnessRiskCount,
    recommendedScenarioKey: recommendation.recommendedScenarioKey,
    assumptions,
    scenarioRuns,
    comparison,
    recommendation,
    replayPlan,
    archivePlan,
    approvalPlan,
    rollbackPlan,
    leadershipSummary,
  };
}

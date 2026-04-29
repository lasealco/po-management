export type NetworkFacilityInput = {
  id: string;
  code: string | null;
  name: string;
  city: string | null;
  countryCode: string | null;
  isActive: boolean;
  onHandQty: number;
  allocatedQty: number;
  openTaskCount: number;
};

export type NetworkLaneInput = {
  id: string;
  originCode: string | null;
  destinationCode: string | null;
  mode: string | null;
  shipmentCount: number;
  totalWeightKg: number;
  totalVolumeCbm: number;
  exceptionCount: number;
};

export type NetworkSupplierInput = {
  id: string;
  name: string;
  countryCode: string | null;
  category: string;
  openPoCount: number;
};

export type NetworkCustomerInput = {
  id: string;
  name: string;
  segment: string | null;
  strategicFlag: boolean;
  openOrderCount: number;
};

export type NetworkDesignInputs = {
  facilities: NetworkFacilityInput[];
  lanes: NetworkLaneInput[];
  suppliers: NetworkSupplierInput[];
  customers: NetworkCustomerInput[];
};

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function utilization(facility: NetworkFacilityInput) {
  return facility.onHandQty > 0 ? Math.round((facility.allocatedQty / facility.onHandQty) * 100) : 0;
}

function modeLabel(mode: string | null) {
  return mode ?? "UNKNOWN";
}

export function buildNetworkBaseline(inputs: NetworkDesignInputs) {
  const activeFacilities = inputs.facilities.filter((facility) => facility.isActive);
  const constrainedFacilities = activeFacilities.filter((facility) => utilization(facility) >= 80 || facility.openTaskCount >= 20);
  const highExceptionLanes = inputs.lanes.filter((lane) => lane.exceptionCount > 0 && pct(lane.exceptionCount, lane.shipmentCount) >= 20);
  const lowVolumeLanes = inputs.lanes.filter((lane) => lane.shipmentCount > 0 && lane.shipmentCount <= 2);
  const missingDataCount =
    activeFacilities.filter((facility) => !facility.countryCode).length +
    inputs.lanes.filter((lane) => !lane.originCode || !lane.destinationCode).length +
    inputs.suppliers.filter((supplier) => !supplier.countryCode).length;
  const totalInventory = activeFacilities.reduce((sum, facility) => sum + facility.onHandQty, 0);
  const allocatedInventory = activeFacilities.reduce((sum, facility) => sum + facility.allocatedQty, 0);
  return {
    facilityCount: activeFacilities.length,
    inactiveFacilityCount: inputs.facilities.length - activeFacilities.length,
    laneCount: inputs.lanes.length,
    customerNodeCount: inputs.customers.length,
    supplierNodeCount: inputs.suppliers.length,
    strategicCustomerCount: inputs.customers.filter((customer) => customer.strategicFlag).length,
    totalInventory,
    allocatedInventory,
    allocationPct: pct(allocatedInventory, totalInventory),
    constrainedFacilities: constrainedFacilities.map((facility) => ({
      id: facility.id,
      label: facility.code ?? facility.name,
      utilizationPct: utilization(facility),
      openTaskCount: facility.openTaskCount,
    })),
    highExceptionLanes: highExceptionLanes.map((lane) => ({
      id: lane.id,
      lane: `${lane.originCode ?? "?"}-${lane.destinationCode ?? "?"}`,
      mode: modeLabel(lane.mode),
      exceptionPct: pct(lane.exceptionCount, lane.shipmentCount),
    })),
    lowVolumeLaneCount: lowVolumeLanes.length,
    missingDataCount,
  };
}

function supplierCountryConcentration(inputs: NetworkDesignInputs) {
  const counts = inputs.suppliers.reduce<Record<string, number>>((acc, supplier) => {
    const key = supplier.countryCode ?? "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const [countryCode = "UNKNOWN", count = 0] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return { countryCode, count, pct: pct(count, inputs.suppliers.length) };
}

export function buildNetworkRiskExposure(inputs: NetworkDesignInputs, baseline = buildNetworkBaseline(inputs)) {
  const supplierConcentration = supplierCountryConcentration(inputs);
  const customerOpenOrders = inputs.customers.reduce((sum, customer) => sum + customer.openOrderCount, 0);
  const topCustomer = [...inputs.customers].sort((a, b) => b.openOrderCount - a.openOrderCount)[0] ?? null;
  const serviceRisks = [
    ...baseline.constrainedFacilities.map((facility) => ({
      type: "FACILITY_CONSTRAINT",
      severity: facility.utilizationPct >= 90 || facility.openTaskCount >= 35 ? "HIGH" : "MEDIUM",
      detail: `${facility.label} is ${facility.utilizationPct}% allocated with ${facility.openTaskCount} open tasks.`,
    })),
    ...baseline.highExceptionLanes.map((lane) => ({
      type: "LANE_EXCEPTION",
      severity: lane.exceptionPct >= 40 ? "HIGH" : "MEDIUM",
      detail: `${lane.lane} ${lane.mode} has ${lane.exceptionPct}% exception incidence.`,
    })),
  ];
  const costRisks = [
    ...(baseline.lowVolumeLaneCount >= 3
      ? [
          {
            type: "LOW_VOLUME_LANE_FRAGMENTATION",
            severity: "MEDIUM" as const,
            detail: `${baseline.lowVolumeLaneCount} lanes have two or fewer shipments and may dilute tender leverage.`,
          },
        ]
      : []),
    ...(supplierConcentration.pct >= 70 && inputs.suppliers.length > 1
      ? [
          {
            type: "SUPPLIER_REGION_CONCENTRATION",
            severity: "HIGH" as const,
            detail: `${supplierConcentration.pct}% of suppliers sit in ${supplierConcentration.countryCode}.`,
          },
        ]
      : []),
  ];
  return {
    serviceRiskCount: serviceRisks.length,
    costRiskCount: costRisks.length,
    missingDataCount: baseline.missingDataCount,
    supplierConcentration,
    topCustomer: topCustomer
      ? { id: topCustomer.id, name: topCustomer.name, openOrderSharePct: pct(topCustomer.openOrderCount, customerOpenOrders) }
      : null,
    serviceRisks,
    costRisks,
  };
}

export function buildNetworkScenarios(inputs: NetworkDesignInputs, baseline = buildNetworkBaseline(inputs), risk = buildNetworkRiskExposure(inputs, baseline)) {
  const scenarios = [
    {
      key: "baseline_no_change",
      title: "Keep current footprint",
      horizon: "0-30 days",
      changeType: "MONITOR",
      expectedCostDeltaPct: 0,
      expectedServiceDeltaPct: 0,
      riskLevel: risk.serviceRiskCount || risk.costRiskCount ? ("MEDIUM" as RiskLevel) : ("LOW" as RiskLevel),
      actions: ["Keep existing facilities, lanes, supplier footprint, and customer promises unchanged."],
      assumptions: ["Uses current tenant evidence only; no synthetic facility or lane master data is created."],
      guardrail: "Baseline review does not mutate facilities, lanes, suppliers, customers, orders, or shipments.",
    },
    {
      key: "rebalance_constrained_facilities",
      title: "Rebalance work away from constrained facilities",
      horizon: "30-60 days",
      changeType: "SERVICE_RECOVERY",
      expectedCostDeltaPct: 2,
      expectedServiceDeltaPct: baseline.constrainedFacilities.length ? 8 : 1,
      riskLevel: baseline.constrainedFacilities.length >= 2 ? ("HIGH" as RiskLevel) : ("MEDIUM" as RiskLevel),
      actions: [
        "Review constrained facility inventory and open task load.",
        "Queue transfer, reservation, or wave-plan work only after operations approval.",
      ],
      assumptions: ["Capacity proxy uses allocated inventory percentage and open WMS task count."],
      guardrail: "No warehouse, inventory, WMS task, or reservation record changes until a human approves downstream work.",
    },
    {
      key: "consolidate_fragmented_lanes",
      title: "Consolidate fragmented low-volume lanes",
      horizon: "45-90 days",
      changeType: "COST_AND_SERVICE",
      expectedCostDeltaPct: baseline.lowVolumeLaneCount >= 3 ? -6 : -1,
      expectedServiceDeltaPct: risk.serviceRiskCount ? 3 : 1,
      riskLevel: baseline.lowVolumeLaneCount >= 5 ? ("HIGH" as RiskLevel) : ("MEDIUM" as RiskLevel),
      actions: ["Review low-volume lane clusters by origin, destination, and mode.", "Prepare carrier/RFQ review before any allocation change."],
      assumptions: ["Cost signal uses lane fragmentation because contracted lane cost may be unavailable."],
      guardrail: "No carrier allocation, RFQ, tariff, booking, or shipment route changes are applied automatically.",
    },
    {
      key: "dual_source_supplier_regions",
      title: "Add supplier-region resilience",
      horizon: "60-120 days",
      changeType: "RESILIENCE",
      expectedCostDeltaPct: 4,
      expectedServiceDeltaPct: risk.supplierConcentration.pct >= 70 ? 7 : 2,
      riskLevel: risk.supplierConcentration.pct >= 70 ? ("HIGH" as RiskLevel) : ("MEDIUM" as RiskLevel),
      actions: ["Review supplier region concentration.", "Queue sourcing due-diligence for an alternate region or backup supplier."],
      assumptions: ["Supplier resilience uses registered country coverage and open PO exposure."],
      guardrail: "No supplier master data, approval status, sourcing award, or PO split is changed without approval.",
    },
  ];
  const recommendedScenarioKey =
    risk.serviceRiskCount > 0
      ? "rebalance_constrained_facilities"
      : risk.costRiskCount > 0
        ? "consolidate_fragmented_lanes"
        : inputs.suppliers.length > 1 && risk.supplierConcentration.pct >= 70
          ? "dual_source_supplier_regions"
          : "baseline_no_change";
  return {
    scenarioCount: scenarios.length,
    recommendedScenarioKey,
    scenarios,
  };
}

export function buildNetworkTradeoffs(scenarioSet: ReturnType<typeof buildNetworkScenarios>) {
  return {
    recommendedScenarioKey: scenarioSet.recommendedScenarioKey,
    comparisons: scenarioSet.scenarios.map((scenario) => ({
      key: scenario.key,
      title: scenario.title,
      costDeltaPct: scenario.expectedCostDeltaPct,
      serviceDeltaPct: scenario.expectedServiceDeltaPct,
      riskLevel: scenario.riskLevel,
      approvalRequired: scenario.key !== "baseline_no_change",
    })),
  };
}

export function buildNetworkServiceImpact(inputs: NetworkDesignInputs, baseline = buildNetworkBaseline(inputs)) {
  return {
    customerCoverage: inputs.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      segment: customer.segment,
      strategic: customer.strategicFlag,
      openOrderCount: customer.openOrderCount,
      serviceWatch: customer.strategicFlag && baseline.constrainedFacilities.length > 0,
    })),
    facilityServiceWatchCount: baseline.constrainedFacilities.length,
    laneServiceWatchCount: baseline.highExceptionLanes.length,
  };
}

export function buildNetworkApprovalPlan(scenarioSet: ReturnType<typeof buildNetworkScenarios>) {
  return {
    recommendedScenarioKey: scenarioSet.recommendedScenarioKey,
    requiredApprovals: ["Operations", "Supply chain planning", "Finance or procurement when cost or sourcing changes are proposed"],
    steps: [
      "Review baseline evidence and missing-data gaps.",
      "Validate scenario assumptions with facility, lane, customer, and supplier owners.",
      "Queue downstream work items for any facility, lane, supplier, carrier, RFQ, or inventory change.",
      "Keep this packet as decision evidence; do not treat it as execution approval.",
    ],
    guardrail: "AMP33 creates a strategy packet and review queue item only; it does not mutate network master data or execute operational changes.",
  };
}

export function buildNetworkRollbackPlan() {
  const steps = [
    "Keep current facility, lane, supplier, customer, order, inventory, shipment, and RFQ records unchanged until downstream approval.",
    "If a scenario is rejected, mark the review queue item rejected and preserve the packet as decision evidence.",
    "If downstream work starts and conditions change, reopen the AMP33 packet and create a fresh scenario version before execution.",
    "Use audit events and action queue notes to explain why the network recommendation was accepted, rejected, or superseded.",
  ];
  return { stepCount: steps.length, steps };
}

export function scoreNetworkDesign(
  baseline: ReturnType<typeof buildNetworkBaseline>,
  risk: ReturnType<typeof buildNetworkRiskExposure>,
  scenarioSet: ReturnType<typeof buildNetworkScenarios>,
) {
  const coverage = Math.min(25, baseline.facilityCount * 4 + baseline.laneCount + baseline.customerNodeCount + baseline.supplierNodeCount);
  const scenarioDepth = Math.min(20, scenarioSet.scenarioCount * 5);
  const servicePenalty = Math.min(30, risk.serviceRiskCount * 8);
  const costPenalty = Math.min(20, risk.costRiskCount * 6);
  const dataPenalty = Math.min(15, baseline.missingDataCount * 3);
  return Math.max(0, Math.min(100, 55 + coverage + scenarioDepth - servicePenalty - costPenalty - dataPenalty));
}

export function buildNetworkDesignPacket(inputs: NetworkDesignInputs) {
  const baseline = buildNetworkBaseline(inputs);
  const risk = buildNetworkRiskExposure(inputs, baseline);
  const scenarioSet = buildNetworkScenarios(inputs, baseline, risk);
  const tradeoffs = buildNetworkTradeoffs(scenarioSet);
  const serviceImpact = buildNetworkServiceImpact(inputs, baseline);
  const approvalPlan = buildNetworkApprovalPlan(scenarioSet);
  const rollbackPlan = buildNetworkRollbackPlan();
  const networkScore = scoreNetworkDesign(baseline, risk, scenarioSet);
  const recommended = scenarioSet.scenarios.find((scenario) => scenario.key === scenarioSet.recommendedScenarioKey) ?? scenarioSet.scenarios[0];
  const leadershipSummary = [
    `Network design score is ${networkScore}/100 across ${baseline.facilityCount} active facilities, ${baseline.laneCount} lanes, ${baseline.customerNodeCount} customer nodes, and ${baseline.supplierNodeCount} supplier nodes.`,
    `Recommended scenario: ${recommended.title}. Service risks: ${risk.serviceRiskCount}; cost risks: ${risk.costRiskCount}; missing data gaps: ${baseline.missingDataCount}.`,
    "Packet creation does not mutate facilities, lanes, suppliers, customers, orders, shipments, inventory, RFQs, tariffs, or carrier allocations.",
  ].join("\n\n");
  return {
    title: `Network design: ${recommended.title}`,
    status: "DRAFT",
    networkScore,
    facilityCount: baseline.facilityCount,
    laneCount: baseline.laneCount,
    customerNodeCount: baseline.customerNodeCount,
    supplierNodeCount: baseline.supplierNodeCount,
    scenarioCount: scenarioSet.scenarioCount,
    serviceRiskCount: risk.serviceRiskCount,
    costRiskCount: risk.costRiskCount,
    recommendedScenarioKey: scenarioSet.recommendedScenarioKey,
    baseline,
    scenarios: scenarioSet,
    tradeoffs,
    serviceImpact,
    riskExposure: risk,
    approvalPlan,
    rollbackPlan,
    leadershipSummary,
  };
}

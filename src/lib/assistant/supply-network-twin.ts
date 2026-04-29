export type SupplyNetworkTwinInputs = {
  twinEntities: Array<{ id: string; entityKind: string; entityKey: string; updatedAt: string }>;
  twinEdges: Array<{ id: string; relation: string | null; fromKind: string; toKind: string }>;
  twinRisks: Array<{ id: string; code: string; severity: string; title: string; acknowledged: boolean }>;
  scenarioDrafts: Array<{ id: string; title: string | null; status: string; updatedAt: string }>;
  twinInsights: Array<{ id: string; status: string; graphConfidenceScore: number; summary: string }>;
  networkPackets: Array<{ id: string; title: string; status: string; networkScore: number; facilityCount: number; laneCount: number; customerNodeCount: number; supplierNodeCount: number; scenarioCount: number; serviceRiskCount: number; costRiskCount: number; recommendedScenarioKey: string | null }>;
  simulationPackets: Array<{ id: string; title: string; status: string; simulationScore: number; scenarioCount: number; dataFreshnessRiskCount: number; recommendedScenarioKey: string | null }>;
  planningPackets: Array<{ id: string; title: string; status: string; planHealthScore: number; replanningTriggerCount: number; demandVariancePct: number; supplyCoveragePct: number; inventoryCoveragePct: number; transportRiskCount: number; recoveryActionCount: number }>;
  resiliencePackets: Array<{ id: string; title: string; status: string; resilienceScore: number; partnerGapCount: number; promiseRiskCount: number; climateRiskCount: number; workforceRiskCount: number; safetySignalCount: number }>;
  orders: Array<{ id: string; status: string; customerName: string; lineCount: number; totalValue: number }>;
  shipments: Array<{ id: string; shipmentNo: string | null; status: string; transportMode: string | null; expectedReceiveAt: string | null; receivedAt: string | null; exceptionCount: number }>;
  inventory: Array<{ id: string; warehouseCode: string | null; warehouseName: string; onHandQty: number; allocatedQty: number }>;
  suppliers: Array<{ id: string; name: string; countryCode: string | null; openPoCount: number }>;
  customers: Array<{ id: string; name: string; segment: string | null; strategicFlag: boolean; openOrderCount: number }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function severityWeight(severity: string) {
  if (severity === "CRITICAL") return 100;
  if (severity === "HIGH") return 75;
  if (severity === "MEDIUM") return 45;
  if (severity === "LOW") return 20;
  return 10;
}

export function buildGraphCoverage(inputs: SupplyNetworkTwinInputs) {
  const entitiesByKind = inputs.twinEntities.reduce<Record<string, number>>((acc, entity) => {
    acc[entity.entityKind] = (acc[entity.entityKind] ?? 0) + 1;
    return acc;
  }, {});
  const edgesByRelation = inputs.twinEdges.reduce<Record<string, number>>((acc, edge) => {
    const key = edge.relation ?? "unlabeled";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const expectedCoverage = {
    orders: inputs.orders.length,
    shipments: inputs.shipments.length,
    inventory: inputs.inventory.length,
    suppliers: inputs.suppliers.length,
    customers: inputs.customers.length,
  };
  const missingCoverage = Object.entries(expectedCoverage)
    .filter(([, count]) => count > 0)
    .filter(([key, count]) => {
      const known = entitiesByKind[key] ?? entitiesByKind[key.toUpperCase()] ?? entitiesByKind[key.slice(0, -1)] ?? 0;
      return known < Math.min(count, 3);
    })
    .map(([key, count]) => ({ domain: key, sourceCount: count, gap: "Twin graph has low materialized coverage for this source domain." }));
  return {
    graphNodeCount: inputs.twinEntities.length,
    graphEdgeCount: inputs.twinEdges.length,
    entitiesByKind,
    edgesByRelation,
    expectedCoverage,
    missingCoverage,
    guardrail: "Graph coverage is decision evidence only; it does not create or mutate twin entities, source master data, orders, shipments, inventory, suppliers, or customers automatically.",
  };
}

export function buildNetworkBaseline(inputs: SupplyNetworkTwinInputs) {
  const allocatedQty = inputs.inventory.reduce((sum, row) => sum + row.allocatedQty, 0);
  const onHandQty = inputs.inventory.reduce((sum, row) => sum + row.onHandQty, 0);
  const lateShipments = inputs.shipments.filter((shipment) => shipment.expectedReceiveAt && !shipment.receivedAt && Date.parse(shipment.expectedReceiveAt) < Date.now());
  const openOrders = inputs.orders.filter((order) => order.status !== "CLOSED");
  return {
    openOrderCount: openOrders.length,
    openOrderValue: Math.round(openOrders.reduce((sum, order) => sum + order.totalValue, 0)),
    shipmentCount: inputs.shipments.length,
    lateShipmentCount: lateShipments.length,
    exceptionShipmentCount: inputs.shipments.filter((shipment) => shipment.exceptionCount > 0).length,
    inventoryLocationCount: inputs.inventory.length,
    onHandQty,
    allocatedQty,
    allocationPct: pct(allocatedQty, onHandQty),
    supplierCount: inputs.suppliers.length,
    customerCount: inputs.customers.length,
    strategicCustomerCount: inputs.customers.filter((customer) => customer.strategicFlag).length,
  };
}

export function buildScenarioCommand(inputs: SupplyNetworkTwinInputs) {
  const latestNetwork = inputs.networkPackets[0] ?? null;
  const latestSimulation = inputs.simulationPackets[0] ?? null;
  const latestPlanning = inputs.planningPackets[0] ?? null;
  const drafts = inputs.scenarioDrafts.map((draft) => ({ scenarioDraftId: draft.id, title: draft.title, status: draft.status, updatedAt: draft.updatedAt }));
  const scenarioCount = drafts.length + inputs.networkPackets.reduce((sum, packet) => sum + packet.scenarioCount, 0) + inputs.simulationPackets.reduce((sum, packet) => sum + packet.scenarioCount, 0);
  const recommendedScenarioKey =
    latestSimulation?.recommendedScenarioKey ?? latestNetwork?.recommendedScenarioKey ?? (latestPlanning?.replanningTriggerCount ? "planning_recovery_review" : "baseline_monitor");
  return {
    scenarioCount,
    recommendedScenarioKey,
    latestNetwork: latestNetwork
      ? { packetId: latestNetwork.id, title: latestNetwork.title, networkScore: latestNetwork.networkScore, recommendedScenarioKey: latestNetwork.recommendedScenarioKey, serviceRiskCount: latestNetwork.serviceRiskCount, costRiskCount: latestNetwork.costRiskCount }
      : null,
    latestSimulation: latestSimulation
      ? { packetId: latestSimulation.id, title: latestSimulation.title, simulationScore: latestSimulation.simulationScore, recommendedScenarioKey: latestSimulation.recommendedScenarioKey, dataFreshnessRiskCount: latestSimulation.dataFreshnessRiskCount }
      : null,
    latestPlanning: latestPlanning
      ? { packetId: latestPlanning.id, title: latestPlanning.title, planHealthScore: latestPlanning.planHealthScore, replanningTriggerCount: latestPlanning.replanningTriggerCount, supplyCoveragePct: latestPlanning.supplyCoveragePct, transportRiskCount: latestPlanning.transportRiskCount }
      : null,
    drafts: drafts.slice(0, 12),
    guardrail: "Scenario command output does not promote scenarios, change plans, execute network decisions, or mutate operational records automatically.",
  };
}

export function buildBottlenecks(inputs: SupplyNetworkTwinInputs, baseline = buildNetworkBaseline(inputs)) {
  const inventoryConstraints = inputs.inventory
    .filter((row) => row.onHandQty > 0 && pct(row.allocatedQty, row.onHandQty) >= 80)
    .map((row) => ({ type: "INVENTORY_CONSTRAINT", id: row.id, label: row.warehouseCode ?? row.warehouseName, utilizationPct: pct(row.allocatedQty, row.onHandQty), severity: pct(row.allocatedQty, row.onHandQty) >= 95 ? "HIGH" : "MEDIUM" }));
  const shipmentConstraints = inputs.shipments
    .filter((shipment) => shipment.exceptionCount > 0 || (shipment.expectedReceiveAt && !shipment.receivedAt && Date.parse(shipment.expectedReceiveAt) < Date.now()))
    .map((shipment) => ({ type: "SHIPMENT_CONSTRAINT", id: shipment.id, label: shipment.shipmentNo ?? shipment.id, severity: shipment.exceptionCount > 1 ? "HIGH" : "MEDIUM", status: shipment.status, exceptionCount: shipment.exceptionCount }));
  const planningConstraints = inputs.planningPackets
    .filter((packet) => packet.replanningTriggerCount > 0 || packet.supplyCoveragePct < 80 || packet.transportRiskCount > 0)
    .map((packet) => ({ type: "PLANNING_CONSTRAINT", id: packet.id, label: packet.title, severity: packet.planHealthScore < 65 ? "HIGH" : "MEDIUM", replanningTriggerCount: packet.replanningTriggerCount, supplyCoveragePct: packet.supplyCoveragePct }));
  const bottlenecks = [...inventoryConstraints, ...shipmentConstraints, ...planningConstraints];
  return {
    bottleneckCount: bottlenecks.length,
    baseline,
    bottlenecks: bottlenecks.slice(0, 20),
    guardrail: "Bottleneck analysis does not move inventory, complete WMS tasks, change shipment status, alter plans, or change customer promises automatically.",
  };
}

export function buildDisruption(input: SupplyNetworkTwinInputs) {
  const activeRisks = input.twinRisks.filter((risk) => !risk.acknowledged);
  const resilienceRisks = input.resiliencePackets.filter((packet) => packet.resilienceScore < 80 || packet.promiseRiskCount > 0 || packet.climateRiskCount > 0 || packet.safetySignalCount > 0);
  const networkRiskPackets = input.networkPackets.filter((packet) => packet.serviceRiskCount > 0 || packet.costRiskCount > 0);
  const topRisks = activeRisks
    .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.title.localeCompare(b.title))
    .slice(0, 12)
    .map((risk) => ({ riskSignalId: risk.id, code: risk.code, severity: risk.severity, title: risk.title }));
  return {
    disruptionRiskCount: activeRisks.length + resilienceRisks.length + networkRiskPackets.length,
    activeTwinRiskCount: activeRisks.length,
    resilienceRiskCount: resilienceRisks.length,
    networkRiskPacketCount: networkRiskPackets.length,
    topRisks,
    resilienceRisks: resilienceRisks.slice(0, 8).map((packet) => ({ packetId: packet.id, title: packet.title, resilienceScore: packet.resilienceScore, promiseRiskCount: packet.promiseRiskCount, climateRiskCount: packet.climateRiskCount, safetySignalCount: packet.safetySignalCount })),
    guardrail: "Disruption command does not acknowledge risk signals, reroute shipments, alter supply, change customer promises, or close incidents automatically.",
  };
}

export function buildRecoveryPlaybook(inputs: SupplyNetworkTwinInputs, bottleneck = buildBottlenecks(inputs), disruption = buildDisruption(inputs)) {
  const pendingActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /network|scenario|planning|recovery|shipment|inventory|supplier|resilience|twin/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const actions = [
    ...(bottleneck.bottlenecks.length > 0
      ? [{ owner: "Supply chain planning", priority: "HIGH", action: "Review bottleneck evidence and decide whether to queue recovery work." }]
      : []),
    ...(disruption.disruptionRiskCount > 0
      ? [{ owner: "Operations", priority: "HIGH", action: "Review active disruption signals and validate customer/supplier impact before execution." }]
      : []),
    ...(inputs.simulationPackets.some((packet) => packet.dataFreshnessRiskCount > 0)
      ? [{ owner: "Planning analytics", priority: "MEDIUM", action: "Refresh stale simulation signals before promoting scenario assumptions." }]
      : []),
    { owner: "Network owner", priority: "MEDIUM", action: "Create downstream approved tasks for any route, supplier, facility, inventory, or shipment change." },
  ];
  return {
    recoveryActionCount: actions.length + pendingActions.length,
    actions,
    pendingActions: pendingActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Recovery playbooks create review work only; they do not mutate orders, inventory, shipments, suppliers, warehouses, network plans, or customer promises.",
  };
}

export function buildConfidence(inputs: SupplyNetworkTwinInputs, graph = buildGraphCoverage(inputs)) {
  const avgInsightScore = inputs.twinInsights.length ? Math.round(inputs.twinInsights.reduce((sum, insight) => sum + insight.graphConfidenceScore, 0) / inputs.twinInsights.length) : 0;
  const coveragePenalty = Math.min(30, graph.missingCoverage.length * 6);
  const staleScenarioPenalty = Math.min(15, inputs.simulationPackets.reduce((sum, packet) => sum + packet.dataFreshnessRiskCount, 0) * 3);
  const confidenceScore = clamp(Math.round((avgInsightScore || 60) + Math.min(20, graph.graphNodeCount) + Math.min(15, graph.graphEdgeCount) - coveragePenalty - staleScenarioPenalty));
  return {
    confidenceScore,
    avgInsightScore,
    insightCount: inputs.twinInsights.length,
    missingCoverageCount: graph.missingCoverage.length,
    staleScenarioSignalCount: inputs.simulationPackets.reduce((sum, packet) => sum + packet.dataFreshnessRiskCount, 0),
    openInsights: inputs.twinInsights.filter((insight) => insight.status !== "CLOSED").slice(0, 8).map((insight) => ({ insightId: insight.id, graphConfidenceScore: insight.graphConfidenceScore, summary: insight.summary })),
    guardrail: "Confidence scoring is advisory and does not upsert twin graph records, overwrite evidence, or execute scenario decisions automatically.",
  };
}

export function buildSupplyNetworkTwinPacket(inputs: SupplyNetworkTwinInputs) {
  const graphCoverage = buildGraphCoverage(inputs);
  const networkBaseline = buildNetworkBaseline(inputs);
  const scenarioCommand = buildScenarioCommand(inputs);
  const bottleneck = buildBottlenecks(inputs, networkBaseline);
  const disruption = buildDisruption(inputs);
  const recoveryPlaybook = buildRecoveryPlaybook(inputs, bottleneck, disruption);
  const confidence = buildConfidence(inputs, graphCoverage);
  const sourceSummary = {
    twinEntities: inputs.twinEntities.length,
    twinEdges: inputs.twinEdges.length,
    twinRisks: inputs.twinRisks.length,
    scenarioDrafts: inputs.scenarioDrafts.length,
    twinInsights: inputs.twinInsights.length,
    networkPackets: inputs.networkPackets.length,
    simulationPackets: inputs.simulationPackets.length,
    planningPackets: inputs.planningPackets.length,
    resiliencePackets: inputs.resiliencePackets.length,
    orders: inputs.orders.length,
    shipments: inputs.shipments.length,
    inventoryLocations: inputs.inventory.length,
    suppliers: inputs.suppliers.length,
    customers: inputs.customers.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const twinScore = clamp(
    Math.round(
      75 +
        Math.min(15, graphCoverage.graphNodeCount + graphCoverage.graphEdgeCount) +
        Math.min(10, scenarioCommand.scenarioCount) +
        Math.round(confidence.confidenceScore / 10) -
        Math.min(22, bottleneck.bottleneckCount * 3) -
        Math.min(20, disruption.disruptionRiskCount * 3) -
        Math.min(12, graphCoverage.missingCoverage.length * 3),
    ),
  );
  const responsePlan = {
    status: twinScore < 70 ? "NETWORK_SCENARIO_REVIEW_REQUIRED" : twinScore < 85 ? "NETWORK_OWNER_REVIEW" : "MONITOR",
    owners: ["Supply chain planning", "Operations", "Warehouse", "Procurement", "Customer success", "Finance"],
    steps: [
      "Review twin graph coverage and missing source-domain evidence.",
      "Compare network, simulation, and continuous-planning scenario recommendations.",
      "Validate bottlenecks and disruptions with operations before creating downstream recovery work.",
      "Refresh stale or low-confidence evidence before customer-facing commitments.",
      "Queue separate approved tasks before changing orders, inventory, shipments, suppliers, warehouses, routes, or network plans.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep orders, shipments, inventory, WMS tasks, warehouses, suppliers, customers, routes, carrier allocations, RFQs, tariffs, planning packets, twin graph records, scenario drafts, and customer promises unchanged until downstream approval.",
      "If review is rejected, preserve packet evidence and action queue notes without executing scenario or recovery actions.",
      "Create a fresh packet when graph coverage, scenario results, planning posture, disruption signals, or operational source evidence changes materially.",
      "Use action queue approval and object-specific workflows before any network, planning, procurement, warehouse, transport, or customer-facing execution.",
    ],
  };
  const leadershipSummary = [
    `Sprint 7 Supply Network Twin score is ${twinScore}/100 across ${graphCoverage.graphNodeCount} graph nodes, ${graphCoverage.graphEdgeCount} graph edges, and ${scenarioCommand.scenarioCount} scenario signal(s).`,
    `Recommended scenario command is ${scenarioCommand.recommendedScenarioKey}; ${bottleneck.bottleneckCount} bottleneck(s), ${disruption.disruptionRiskCount} disruption risk(s), and ${recoveryPlaybook.recoveryActionCount} recovery action(s) need review.`,
    `Twin confidence is ${confidence.confidenceScore}/100 with ${graphCoverage.missingCoverage.length} graph coverage gap(s) and ${confidence.staleScenarioSignalCount} stale scenario signal(s).`,
    "Packet creation does not mutate orders, inventory, WMS tasks, shipments, suppliers, customers, warehouses, routes, RFQs, tariffs, twin graph records, scenario drafts, network plans, or customer promises.",
  ].join("\n\n");
  return {
    title: `Sprint 7 Supply Network Twin packet: score ${twinScore}/100`,
    status: "DRAFT",
    twinScore,
    sourceSummary,
    graphCoverage,
    networkBaseline,
    scenarioCommand,
    bottleneck,
    disruption,
    recoveryPlaybook,
    confidence,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

export type CollaborationResilienceInputs = {
  partnerPackets: Array<{ id: string; title: string; status: string; readinessScore: number; partnerCount: number; mappingIssueCount: number; openReviewCount: number }>;
  customerBriefs: Array<{ id: string; title: string; status: string; serviceScore: number }>;
  exceptionIncidents: Array<{ id: string; title: string; status: string; severity: string; severityScore: number; customerImpact: string | null }>;
  sustainabilityPackets: Array<{ id: string; title: string; status: string; sustainabilityScore: number; estimatedCo2eKg: number; missingDataCount: number; recommendationCount: number }>;
  frontlinePackets: Array<{ id: string; title: string; status: string; readinessScore: number; frontlineTaskCount: number; evidenceGapCount: number; offlineRiskCount: number; exceptionCount: number }>;
  supplierTasks: Array<{ id: string; title: string; done: boolean; dueAt: string | null; supplierName: string }>;
  productSignals: Array<{ id: string; sku: string | null; name: string; hasCategory: boolean; hasDimensions: boolean; hasTraceability: boolean }>;
  externalEvents: Array<{ id: string; eventType: string; title: string; severity: string; confidence: number; reviewState: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function severityWeight(value: string) {
  if (value === "CRITICAL") return 100;
  if (value === "HIGH") return 75;
  if (value === "MEDIUM") return 45;
  return 20;
}

function isResilienceEvent(event: { eventType: string; title: string }) {
  return /climate|energy|water|weather|flood|heat|drought|strike|labor|safety|supplier|port|disruption|resilience/i.test(`${event.eventType} ${event.title}`);
}

export function buildCollaborationHub(inputs: CollaborationResilienceInputs) {
  const overdueTasks = inputs.supplierTasks.filter((task) => !task.done && task.dueAt && Date.parse(task.dueAt) < Date.now());
  const partnerGaps = inputs.partnerPackets.filter((packet) => packet.readinessScore < 75 || packet.mappingIssueCount > 0 || packet.openReviewCount > 0);
  return {
    partnerCount: inputs.partnerPackets.reduce((sum, packet) => sum + packet.partnerCount, 0),
    partnerGapCount: partnerGaps.length + overdueTasks.length,
    supplierTaskCount: inputs.supplierTasks.length,
    overdueSupplierTasks: overdueTasks.slice(0, 12).map((task) => ({ taskId: task.id, title: task.title, supplierName: task.supplierName, dueAt: task.dueAt })),
    partnerGaps: partnerGaps.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, readinessScore: packet.readinessScore, mappingIssueCount: packet.mappingIssueCount, openReviewCount: packet.openReviewCount })),
    guardrail: "Collaboration output queues partner work only; supplier tasks, portal access, mappings, and external messages are not changed automatically.",
  };
}

export function buildPromiseReconciliation(inputs: CollaborationResilienceInputs) {
  const weakCustomers = inputs.customerBriefs.filter((brief) => brief.serviceScore < 75);
  const openIncidents = inputs.exceptionIncidents.filter((incident) => incident.status !== "CLOSED");
  const promiseActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /promise|customer|exception|shipment|delivery/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    promiseRiskCount: weakCustomers.length + openIncidents.length + promiseActions.length,
    weakCustomers: weakCustomers.map((brief) => ({ briefId: brief.id, title: brief.title, serviceScore: brief.serviceScore, status: brief.status })),
    openIncidents: openIncidents.slice(0, 10).map((incident) => ({ incidentId: incident.id, title: incident.title, severity: incident.severity, severityScore: incident.severityScore, customerImpact: incident.customerImpact })),
    pendingPromiseActions: promiseActions.slice(0, 10).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Promise reconciliation is review-only; customer promises, shipment dates, sales orders, and customer communications are not changed automatically.",
  };
}

export function buildResiliencePlan(inputs: CollaborationResilienceInputs) {
  const resilienceEvents = inputs.externalEvents.filter(isResilienceEvent);
  const sustainabilityRisks = inputs.sustainabilityPackets.filter((packet) => packet.sustainabilityScore < 75 || packet.missingDataCount > 0);
  return {
    climateRiskCount: resilienceEvents.length + sustainabilityRisks.length,
    sustainabilityScore: avg(inputs.sustainabilityPackets.map((packet) => packet.sustainabilityScore)),
    estimatedCo2eKg: Math.round(inputs.sustainabilityPackets.reduce((sum, packet) => sum + packet.estimatedCo2eKg, 0)),
    resilienceEvents: resilienceEvents
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
      .slice(0, 10)
      .map((event) => ({ eventId: event.id, title: event.title, eventType: event.eventType, severity: event.severity, confidence: event.confidence, reviewState: event.reviewState })),
    sustainabilityRisks: sustainabilityRisks.map((packet) => ({ packetId: packet.id, title: packet.title, sustainabilityScore: packet.sustainabilityScore, missingDataCount: packet.missingDataCount, recommendationCount: packet.recommendationCount })),
    steps: ["Review climate/energy/water disruption signals.", "Validate ESG data gaps before customer or board claims.", "Queue resilience actions before changing routing, suppliers, inventory, or warehouse plans."],
    guardrail: "Resilience plans do not change routes, suppliers, inventory, warehouse operations, or ESG claims automatically.",
  };
}

export function buildPassportReadiness(inputs: CollaborationResilienceInputs) {
  const gaps = inputs.productSignals
    .filter((product) => !product.hasCategory || !product.hasDimensions || !product.hasTraceability)
    .map((product) => ({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      missing: [
        !product.hasCategory ? "category" : null,
        !product.hasDimensions ? "dimensions" : null,
        !product.hasTraceability ? "traceability evidence" : null,
      ].filter((item): item is string => Boolean(item)),
    }));
  return {
    productCount: inputs.productSignals.length,
    passportGapCount: gaps.length,
    gaps: gaps.slice(0, 20),
    requiredEvidence: ["Product/category scope", "Dimensions or pack attributes", "Traceability/supplier evidence", "Sustainability assumptions", "Compliance review"],
    guardrail: "Passport readiness is evidence review only; product master data, supplier claims, and public passport records are not changed automatically.",
  };
}

export function buildWorkforceSafety(inputs: CollaborationResilienceInputs) {
  const weakFrontline = inputs.frontlinePackets.filter((packet) => packet.readinessScore < 75 || packet.evidenceGapCount > 0 || packet.offlineRiskCount > 0);
  const safetyEvents = inputs.externalEvents.filter((event) => /safety|labor|strike|workforce|injury|weather|heat/i.test(`${event.eventType} ${event.title}`));
  const safetyActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /safety|frontline|wms|warehouse|labor|driver/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    workforceRiskCount: weakFrontline.length + safetyActions.length,
    safetySignalCount: safetyEvents.length,
    weakFrontline: weakFrontline.map((packet) => ({ packetId: packet.id, title: packet.title, readinessScore: packet.readinessScore, evidenceGapCount: packet.evidenceGapCount, offlineRiskCount: packet.offlineRiskCount, exceptionCount: packet.exceptionCount })),
    safetyEvents: safetyEvents.slice(0, 10).map((event) => ({ eventId: event.id, title: event.title, severity: event.severity, confidence: event.confidence })),
    pendingSafetyActions: safetyActions.slice(0, 10).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Workforce and safety output drafts supervisor review only; WMS work, staffing, safety actions, and incident closure remain human-approved.",
  };
}

export function buildExternalRisk(inputs: CollaborationResilienceInputs) {
  const active = inputs.externalEvents.filter((event) => ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"].includes(event.reviewState));
  return {
    activeEventCount: active.length,
    topEvents: active
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
      .slice(0, 10)
      .map((event) => ({ eventId: event.id, title: event.title, eventType: event.eventType, severity: event.severity, confidence: event.confidence, reviewState: event.reviewState })),
  };
}

export function buildCollaborationResiliencePacket(inputs: CollaborationResilienceInputs) {
  const collaborationHub = buildCollaborationHub(inputs);
  const promiseReconciliation = buildPromiseReconciliation(inputs);
  const resiliencePlan = buildResiliencePlan(inputs);
  const passportReadiness = buildPassportReadiness(inputs);
  const workforceSafety = buildWorkforceSafety(inputs);
  const externalRisk = buildExternalRisk(inputs);
  const sourceSummary = {
    partnerPackets: inputs.partnerPackets.length,
    customerBriefs: inputs.customerBriefs.length,
    exceptionIncidents: inputs.exceptionIncidents.length,
    sustainabilityPackets: inputs.sustainabilityPackets.length,
    frontlinePackets: inputs.frontlinePackets.length,
    supplierTasks: inputs.supplierTasks.length,
    products: inputs.productSignals.length,
    externalEvents: inputs.externalEvents.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const resilienceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(20, collaborationHub.partnerGapCount * 3) -
          Math.min(20, promiseReconciliation.promiseRiskCount * 3) -
          Math.min(18, resiliencePlan.climateRiskCount * 3) -
          Math.min(16, passportReadiness.passportGapCount * 2) -
          Math.min(16, workforceSafety.workforceRiskCount * 3) -
          Math.min(12, workforceSafety.safetySignalCount * 3),
      ),
    ),
  );
  const responsePlan = {
    status: resilienceScore < 70 ? "RESILIENCE_REVIEW_REQUIRED" : resilienceScore < 85 ? "COLLABORATION_OWNER_REVIEW" : "MONITOR",
    owners: ["Supplier operations", "Customer success", "Sustainability", "Planning", "Warehouse/frontline", "Safety"],
    steps: [
      "Review supplier/customer collaboration gaps and overdue partner work.",
      "Reconcile customer promises against open incidents and pending actions.",
      "Validate climate, energy, water, and sustainability resilience risks.",
      "Complete product/passport evidence before external claims or exchanges.",
      "Queue workforce and safety reviews before changing WMS, staffing, supplier, shipment, or customer records.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep supplier tasks, portal access, mappings, customer promises, shipment dates, routing, warehouse work, ESG claims, product/passport records, workforce actions, safety incidents, and source records unchanged until downstream approval.",
      "If review rejects the packet, preserve evidence and notes for audit without executing collaboration or resilience actions.",
      "Create a fresh packet when partner, customer, sustainability, product, frontline, safety, or external event evidence changes materially.",
      "Use action queue approval before any partner/customer/resilience work changes operational systems or external communications.",
    ],
  };
  const leadershipSummary = [
    `Sprint 5 Collaboration & Resilience score is ${resilienceScore}/100 with ${collaborationHub.partnerGapCount} partner gap${collaborationHub.partnerGapCount === 1 ? "" : "s"}, ${promiseReconciliation.promiseRiskCount} promise risk${promiseReconciliation.promiseRiskCount === 1 ? "" : "s"}, and ${resiliencePlan.climateRiskCount} resilience/climate risk${resiliencePlan.climateRiskCount === 1 ? "" : "s"}.`,
    `${passportReadiness.passportGapCount} product/passport gap${passportReadiness.passportGapCount === 1 ? "" : "s"}, ${workforceSafety.workforceRiskCount} workforce risk${workforceSafety.workforceRiskCount === 1 ? "" : "s"}, and ${workforceSafety.safetySignalCount} safety signal${workforceSafety.safetySignalCount === 1 ? "" : "s"} require review.`,
    "Packet creation does not mutate supplier/customer collaboration records, promises, shipments, routes, ESG claims, product passports, workforce plans, safety incidents, or operational source records.",
  ].join("\n\n");
  return {
    title: `Sprint 5 Collaboration & Resilience packet: score ${resilienceScore}/100`,
    status: "DRAFT",
    resilienceScore,
    sourceSummary,
    collaborationHub,
    promiseReconciliation,
    resiliencePlan,
    passportReadiness,
    workforceSafety,
    externalRisk,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

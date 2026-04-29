export type AdvancedProgramKey =
  | "aftermarket-service"
  | "npi-readiness"
  | "quality-capa"
  | "trade-compliance"
  | "landed-cost"
  | "regulatory-obligations"
  | "energy-utilities"
  | "packaging-optimization"
  | "manufacturing-coordination"
  | "production-scheduling"
  | "category-strategy";

export type AdvancedProgramSignals = {
  products: number;
  activeSuppliers: number;
  supplierDocs: number;
  expiringSupplierDocs: number;
  productDocs: number;
  inventoryRows: number;
  onHandUnits: number;
  allocatedUnits: number;
  heldInventoryRows: number;
  openWmsTasks: number;
  openPurchaseOrders: number;
  openSalesOrders: number;
  shipments: number;
  shipmentExceptions: number;
  crmQuotes: number;
  tariffContracts: number;
  financeRiskScore: number;
  contractRiskCount: number;
  planningHealthScore: number;
  simulationRiskCount: number;
  networkRiskCount: number;
};

type ProgramConfig = {
  ampNumber: number;
  key: AdvancedProgramKey;
  slug: string;
  navLabel: string;
  title: string;
  surfaceTitle: string;
  sourceLabels: Array<keyof AdvancedProgramSignals>;
  riskRules: Array<{
    key: string;
    label: string;
    metric: keyof AdvancedProgramSignals;
    threshold: number;
    direction: "gte" | "lt";
    severity: "MEDIUM" | "HIGH";
  }>;
  recommendations: string[];
  artifactLabel: string;
  approvalOwners: string[];
  noMutation: string;
};

export const ADVANCED_PROGRAMS: Record<AdvancedProgramKey, ProgramConfig> = {
  "aftermarket-service": {
    ampNumber: 37,
    key: "aftermarket-service",
    slug: "aftermarket-service",
    navLabel: "Service",
    title: "Aftermarket service and spare-parts program",
    surfaceTitle: "Aftermarket Service & Spare Parts",
    sourceLabels: ["products", "inventoryRows", "onHandUnits", "allocatedUnits", "openSalesOrders", "shipments", "shipmentExceptions"],
    riskRules: [
      { key: "parts_shortage", label: "Spare parts coverage below dispatch threshold", metric: "onHandUnits", threshold: 50, direction: "lt", severity: "HIGH" },
      { key: "dispatch_risk", label: "Shipment/service dispatch exceptions present", metric: "shipmentExceptions", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Prioritize urgent service cases by customer promise and part availability.", "Queue part substitution or expedited dispatch review before customer updates."],
    artifactLabel: "service recovery packet",
    approvalOwners: ["Service", "Warehouse", "Customer operations"],
    noMutation: "service requests, spare-parts inventory, dispatches, shipments, or customer updates",
  },
  "npi-readiness": {
    ampNumber: 38,
    key: "npi-readiness",
    slug: "npi-readiness",
    navLabel: "NPI",
    title: "Product lifecycle and NPI readiness program",
    surfaceTitle: "Product Lifecycle & NPI Readiness",
    sourceLabels: ["products", "productDocs", "activeSuppliers", "supplierDocs", "openPurchaseOrders", "inventoryRows"],
    riskRules: [
      { key: "launch_docs_missing", label: "Product/document evidence is thin for launch review", metric: "productDocs", threshold: 1, direction: "lt", severity: "HIGH" },
      { key: "supplier_readiness", label: "Supplier compliance coverage needs review", metric: "supplierDocs", threshold: 2, direction: "lt", severity: "MEDIUM" },
    ],
    recommendations: ["Create launch checklist with BOM/readiness, supplier qualification, document, and ramp gates.", "Queue launch risk review before product release."],
    artifactLabel: "NPI launch readiness packet",
    approvalOwners: ["Product", "Procurement", "Quality"],
    noMutation: "product master, launch status, supplier qualification, inventory ramp, or release records",
  },
  "quality-capa": {
    ampNumber: 39,
    key: "quality-capa",
    slug: "quality-capa",
    navLabel: "CAPA",
    title: "Quality management and CAPA program",
    surfaceTitle: "Quality Management & CAPA",
    sourceLabels: ["heldInventoryRows", "shipmentExceptions", "supplierDocs", "openWmsTasks", "products"],
    riskRules: [
      { key: "quality_hold", label: "Held inventory rows require quality disposition", metric: "heldInventoryRows", threshold: 1, direction: "gte", severity: "HIGH" },
      { key: "defect_signal", label: "Shipment exceptions may need CAPA review", metric: "shipmentExceptions", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Open CAPA room with root-cause hypotheses, affected objects, owners, and deadlines.", "Queue corrective-action review and recurrence check."],
    artifactLabel: "CAPA room packet",
    approvalOwners: ["Quality", "Supplier owner", "Operations"],
    noMutation: "quality holds, supplier records, customer claims, inventory, or corrective actions",
  },
  "trade-compliance": {
    ampNumber: 40,
    key: "trade-compliance",
    slug: "trade-compliance",
    navLabel: "Trade",
    title: "Trade compliance and customs operations program",
    surfaceTitle: "Trade Compliance & Customs",
    sourceLabels: ["products", "shipments", "supplierDocs", "tariffContracts", "shipmentExceptions"],
    riskRules: [
      { key: "customs_doc_gap", label: "Supplier/product documents may be insufficient for customs packet", metric: "supplierDocs", threshold: 2, direction: "lt", severity: "HIGH" },
      { key: "blocked_shipments", label: "Shipment exceptions require broker/compliance review", metric: "shipmentExceptions", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Validate classification, document, screening, and broker-instruction evidence.", "Queue compliance hold/release review before shipment release."],
    artifactLabel: "customs release packet",
    approvalOwners: ["Trade compliance", "Operations", "Broker owner"],
    noMutation: "customs classifications, screening decisions, documents, broker instructions, holds, or shipment releases",
  },
  "landed-cost": {
    ampNumber: 41,
    key: "landed-cost",
    slug: "landed-cost",
    navLabel: "Landed",
    title: "Landed cost and duty optimization program",
    surfaceTitle: "Landed Cost & Duty Optimization",
    sourceLabels: ["tariffContracts", "shipments", "financeRiskScore", "crmQuotes", "openPurchaseOrders"],
    riskRules: [
      { key: "finance_exposure", label: "Finance variance/risk affects landed-cost confidence", metric: "financeRiskScore", threshold: 50, direction: "gte", severity: "HIGH" },
      { key: "rate_coverage", label: "Tariff contract coverage is limited", metric: "tariffContracts", threshold: 1, direction: "lt", severity: "MEDIUM" },
    ],
    recommendations: ["Compare route/source options by freight, duty, tax, FX, and margin assumptions.", "Queue finance/procurement approval before landed-cost decisions."],
    artifactLabel: "landed-cost comparison packet",
    approvalOwners: ["Finance", "Procurement", "Logistics"],
    noMutation: "tariffs, RFQs, quotes, invoices, shipment costs, accounting records, or sourcing decisions",
  },
  "regulatory-obligations": {
    ampNumber: 42,
    key: "regulatory-obligations",
    slug: "regulatory-obligations",
    navLabel: "Reg",
    title: "Regulatory obligation operations program",
    surfaceTitle: "Regulatory Obligation Operations",
    sourceLabels: ["supplierDocs", "expiringSupplierDocs", "productDocs", "contractRiskCount", "activeSuppliers"],
    riskRules: [
      { key: "expiring_obligations", label: "Expiring supplier/regulatory documents need attestation", metric: "expiringSupplierDocs", threshold: 1, direction: "gte", severity: "HIGH" },
      { key: "contract_obligation_gap", label: "Contract compliance risks need regulatory review", metric: "contractRiskCount", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Create obligation register with owners, due dates, evidence, attestations, and escalation path.", "Queue regulatory review before claims or releases."],
    artifactLabel: "obligation register packet",
    approvalOwners: ["Compliance", "Legal", "Supplier owner"],
    noMutation: "obligations, attestations, legal holds, supplier documents, or regulatory submissions",
  },
  "energy-utilities": {
    ampNumber: 43,
    key: "energy-utilities",
    slug: "energy-utilities",
    navLabel: "Energy",
    title: "Energy and utilities operations program",
    surfaceTitle: "Energy & Utilities Operations",
    sourceLabels: ["openWmsTasks", "shipments", "inventoryRows", "networkRiskCount", "planningHealthScore"],
    riskRules: [
      { key: "peak_load_proxy", label: "Warehouse activity suggests peak-load risk", metric: "openWmsTasks", threshold: 25, direction: "gte", severity: "MEDIUM" },
      { key: "network_resilience", label: "Network footprint risk may affect facility resilience", metric: "networkRiskCount", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Estimate facility load from warehouse activity and shipment pressure.", "Queue schedule/equipment review before operational changes."],
    artifactLabel: "energy resilience packet",
    approvalOwners: ["Facilities", "Warehouse", "Operations"],
    noMutation: "facility schedules, equipment settings, utility plans, warehouse work, or customer promises",
  },
  "packaging-optimization": {
    ampNumber: 44,
    key: "packaging-optimization",
    slug: "packaging-optimization",
    navLabel: "Packaging",
    title: "Packaging and material-flow optimization program",
    surfaceTitle: "Packaging & Material Flow Optimization",
    sourceLabels: ["products", "shipments", "shipmentExceptions", "heldInventoryRows", "activeSuppliers"],
    riskRules: [
      { key: "damage_signal", label: "Shipment/quality signals may indicate packaging risk", metric: "shipmentExceptions", threshold: 1, direction: "gte", severity: "MEDIUM" },
      { key: "material_hold", label: "Held inventory may need handling/packaging review", metric: "heldInventoryRows", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Compare pack design, cube, damage, waste, and handling constraints.", "Queue packaging change review before product master or supplier changes."],
    artifactLabel: "packaging change packet",
    approvalOwners: ["Packaging", "Quality", "Supplier owner"],
    noMutation: "product dimensions, packaging specs, supplier instructions, warehouse handling, or ESG claims",
  },
  "manufacturing-coordination": {
    ampNumber: 45,
    key: "manufacturing-coordination",
    slug: "manufacturing-coordination",
    navLabel: "Mfg",
    title: "Manufacturing execution coordination program",
    surfaceTitle: "Manufacturing Execution Coordination",
    sourceLabels: ["openSalesOrders", "openPurchaseOrders", "inventoryRows", "heldInventoryRows", "planningHealthScore"],
    riskRules: [
      { key: "material_constraint", label: "Inventory/supply signals may constrain production", metric: "planningHealthScore", threshold: 65, direction: "lt", severity: "HIGH" },
      { key: "quality_hold", label: "Held inventory may block production commitments", metric: "heldInventoryRows", threshold: 1, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Coordinate materials, capacity, quality holds, and promise impact.", "Queue production recovery review before MES or schedule changes."],
    artifactLabel: "manufacturing coordination packet",
    approvalOwners: ["Manufacturing", "Planning", "Quality"],
    noMutation: "production schedules, MES/WIP status, inventory, quality holds, or customer promises",
  },
  "production-scheduling": {
    ampNumber: 46,
    key: "production-scheduling",
    slug: "production-scheduling",
    navLabel: "Schedule",
    title: "Advanced production scheduling program",
    surfaceTitle: "Advanced Production Scheduling",
    sourceLabels: ["openSalesOrders", "openPurchaseOrders", "openWmsTasks", "planningHealthScore", "simulationRiskCount"],
    riskRules: [
      { key: "schedule_pressure", label: "Plan/simulation pressure suggests schedule review", metric: "simulationRiskCount", threshold: 1, direction: "gte", severity: "MEDIUM" },
      { key: "execution_load", label: "Open WMS work may constrain schedule execution", metric: "openWmsTasks", threshold: 25, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Build finite-capacity sequence options with changeover and material assumptions.", "Queue schedule sequence approval before promise or WIP changes."],
    artifactLabel: "schedule scenario packet",
    approvalOwners: ["Scheduling", "Manufacturing", "Customer service"],
    noMutation: "finite schedules, WIP, line assignments, allocations, or customer promises",
  },
  "category-strategy": {
    ampNumber: 47,
    key: "category-strategy",
    slug: "category-strategy",
    navLabel: "Sourcing",
    title: "Category strategy and sourcing program",
    surfaceTitle: "Category Strategy & Sourcing",
    sourceLabels: ["activeSuppliers", "openPurchaseOrders", "tariffContracts", "contractRiskCount", "financeRiskScore"],
    riskRules: [
      { key: "supplier_panel_depth", label: "Supplier panel needs sourcing review", metric: "activeSuppliers", threshold: 2, direction: "lt", severity: "HIGH" },
      { key: "commercial_leakage", label: "Finance/contract signals indicate savings opportunity", metric: "financeRiskScore", threshold: 50, direction: "gte", severity: "MEDIUM" },
    ],
    recommendations: ["Create category strategy with spend, supplier panel, RFQ/contract, savings, and risk evidence.", "Queue sourcing event review before awards or supplier changes."],
    artifactLabel: "category strategy packet",
    approvalOwners: ["Procurement", "Finance", "Supplier owner"],
    noMutation: "supplier panels, RFQs, sourcing awards, contracts, POs, or savings claims",
  },
};

export type AdvancedProgramPacketInputs = {
  signals: AdvancedProgramSignals;
  programKey: AdvancedProgramKey;
};

function metricValue(signals: AdvancedProgramSignals, metric: keyof AdvancedProgramSignals) {
  return signals[metric] ?? 0;
}

function breached(value: number, threshold: number, direction: "gte" | "lt") {
  return direction === "gte" ? value >= threshold : value < threshold;
}

export function getAdvancedProgramConfig(programKey: string) {
  return ADVANCED_PROGRAMS[programKey as AdvancedProgramKey] ?? null;
}

export function listAdvancedProgramConfigs() {
  return Object.values(ADVANCED_PROGRAMS).sort((a, b) => a.ampNumber - b.ampNumber);
}

export function buildAdvancedProgramPacket(inputs: AdvancedProgramPacketInputs) {
  const config = ADVANCED_PROGRAMS[inputs.programKey];
  const sourceSummary = {
    sources: config.sourceLabels.map((metric) => ({
      metric,
      value: metricValue(inputs.signals, metric),
    })),
    signalCount: config.sourceLabels.length,
  };
  const risks = config.riskRules
    .map((rule) => {
      const value = metricValue(inputs.signals, rule.metric);
      return {
        key: rule.key,
        label: rule.label,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        severity: rule.severity,
        breached: breached(value, rule.threshold, rule.direction),
      };
    })
    .filter((risk) => risk.breached);
  const recommendations = config.recommendations.map((text, index) => ({
    id: `${config.key}-rec-${index + 1}`,
    text,
    priority: risks.some((risk) => risk.severity === "HIGH") ? "HIGH" : risks.length ? "MEDIUM" : "LOW",
    guardrail: `Queue human review before changing ${config.noMutation}.`,
  }));
  const approvalSteps = config.approvalOwners.map((owner, index) => ({
    order: index + 1,
    owner,
    action: `Review ${config.artifactLabel} evidence and approve or reject downstream work.`,
  }));
  const score = Math.max(0, Math.min(100, 82 - risks.length * 12 - risks.filter((risk) => risk.severity === "HIGH").length * 8 + config.sourceLabels.length));
  const artifact = {
    label: config.artifactLabel,
    sections: ["source evidence", "risk assessment", "recommendations", "approval route", "rollback controls"],
    exportReady: true,
    noMutation: config.noMutation,
  };
  const rollbackPlan = {
    stepCount: 4,
    steps: [
      `Keep ${config.noMutation} unchanged until separate downstream approval.`,
      "If review is rejected, preserve packet evidence and action queue notes for audit.",
      "If source evidence changes materially, create a fresh packet instead of overwriting archived evidence.",
      "Use audit events to explain why recommendations were approved, rejected, or superseded.",
    ],
  };
  const leadershipSummary = [
    `AMP${config.ampNumber} ${config.surfaceTitle} score is ${score}/100 with ${risks.length} risk signal${risks.length === 1 ? "" : "s"} across ${sourceSummary.signalCount} source group${sourceSummary.signalCount === 1 ? "" : "s"}.`,
    `Recommended artifact: ${config.artifactLabel}. Approval route: ${config.approvalOwners.join(", ")}.`,
    `Packet creation does not mutate ${config.noMutation}.`,
  ].join("\n\n");
  return {
    ampNumber: config.ampNumber,
    programKey: config.key,
    programTitle: config.title,
    title: `AMP${config.ampNumber}: ${config.surfaceTitle}`,
    status: "DRAFT",
    programScore: score,
    signalCount: sourceSummary.signalCount,
    riskCount: risks.length,
    recommendationCount: recommendations.length,
    approvalStepCount: approvalSteps.length,
    sourceSummary,
    assessment: {
      risks,
      healthy: risks.length === 0,
    },
    recommendation: {
      recommendations,
      primaryRecommendation: recommendations[0]?.text ?? "Monitor program signals.",
    },
    approvalPlan: {
      steps: approvalSteps,
      guardrail: `AMP${config.ampNumber} queues review work only; execution requires separate approval.`,
    },
    artifact,
    rollbackPlan,
    leadershipSummary,
  };
}

export type ProductLifecycleProductSignal = {
  id: string;
  sku: string | null;
  productCode: string | null;
  name: string;
  categoryName: string | null;
  divisionName: string | null;
  hsCode: string | null;
  ean: string | null;
  isActive: boolean;
  isDangerousGoods: boolean;
  hasDangerousGoodsEvidence: boolean;
  msdsUrl: string | null;
  isTemperatureControlled: boolean;
  hasTemperatureEvidence: boolean;
  supplierCount: number;
  documentKinds: string[];
  inventoryBalanceCount: number;
  openWmsTaskCount: number;
  salesOrderLineCount: number;
  purchaseOrderLineCount: number;
  outboundOrderLineCount: number;
};

export type ProductLifecycleSupplierDocumentSignal = {
  id: string;
  supplierId: string;
  supplierName: string;
  documentType: string;
  status: string;
  title: string;
  expiresAt: string | null;
};

export type ProductLifecycleSupplierTaskSignal = {
  id: string;
  supplierId: string;
  supplierName: string;
  title: string;
  done: boolean;
  dueAt: string | null;
};

export type ProductLifecycleRiskSignal = {
  id: string;
  title: string;
  eventType: string;
  severity: string;
  confidence: number;
  reviewState: string;
  affectedObjectType: string | null;
  affectedObjectId: string | null;
};

export type ProductLifecycleInputs = {
  products: ProductLifecycleProductSignal[];
  supplierDocuments: ProductLifecycleSupplierDocumentSignal[];
  supplierTasks: ProductLifecycleSupplierTaskSignal[];
  sustainabilityPackets: Array<{ id: string; title: string; status: string; sustainabilityScore: number; missingDataCount: number; recommendationCount: number }>;
  contractCompliancePackets: Array<{ id: string; title: string; status: string; complianceScore: number; expiringDocumentCount: number; complianceGapCount: number; renewalRiskCount: number }>;
  riskSignals: ProductLifecycleRiskSignal[];
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
  nowIso?: string;
};

function daysUntil(dateIso: string | null, nowIso: string) {
  if (!dateIso) return null;
  const days = Math.ceil((Date.parse(dateIso) - Date.parse(nowIso)) / 86_400_000);
  return Number.isFinite(days) ? days : null;
}

function severityPenalty(severity: string) {
  if (severity === "CRITICAL") return 16;
  if (severity === "HIGH") return 10;
  if (severity === "MEDIUM") return 5;
  return 2;
}

export function buildCatalogReadiness(products: ProductLifecycleProductSignal[]) {
  const gaps = products
    .map((product) => {
      const missing = [
        !product.sku && !product.productCode ? "SKU or product code" : null,
        !product.categoryName ? "category" : null,
        !product.divisionName ? "division" : null,
        !product.hsCode ? "HS code" : null,
        !product.ean ? "EAN/GTIN" : null,
        product.supplierCount === 0 ? "approved supplier link" : null,
        product.isDangerousGoods && !product.hasDangerousGoodsEvidence ? "dangerous goods evidence" : null,
        product.isTemperatureControlled && !product.hasTemperatureEvidence ? "temperature handling evidence" : null,
      ].filter((item): item is string => Boolean(item));
      return { productId: product.id, sku: product.sku, productCode: product.productCode, name: product.name, missing };
    })
    .filter((row) => row.missing.length > 0);
  return {
    productCount: products.length,
    activeProductCount: products.filter((product) => product.isActive).length,
    catalogGapCount: gaps.length,
    gaps: gaps.slice(0, 25),
    guardrail: "Catalog readiness is review-only; product master data, SKU attributes, supplier links, HS codes, DG data, and temperature settings are not changed automatically.",
  };
}

export function buildPassportEvidence(products: ProductLifecycleProductSignal[]) {
  const rows = products.map((product) => {
    const evidence = [
      product.categoryName ? "category" : null,
      product.divisionName ? "division" : null,
      product.documentKinds.includes("PRIMARY_IMAGE") || product.documentKinds.includes("OTHER") ? "product document" : null,
      product.documentKinds.includes("MSDS") || product.msdsUrl ? "MSDS" : null,
      product.supplierCount > 0 ? "supplier source" : null,
      product.inventoryBalanceCount + product.openWmsTaskCount + product.salesOrderLineCount + product.purchaseOrderLineCount + product.outboundOrderLineCount > 0 ? "transaction trace" : null,
    ].filter((item): item is string => Boolean(item));
    const requiredEvidence = ["category", "division", "product document", product.isDangerousGoods ? "MSDS" : null, "supplier source", "transaction trace"].filter((item): item is string => Boolean(item));
    const missing = requiredEvidence.filter((item) => !evidence.includes(item));
    return { productId: product.id, sku: product.sku, productCode: product.productCode, name: product.name, evidence, missing };
  });
  const gaps = rows.filter((row) => row.missing.length > 0);
  return {
    evidenceRecordCount: rows.reduce((sum, row) => sum + row.evidence.length, 0),
    passportGapCount: gaps.length,
    products: rows.slice(0, 30),
    gaps: gaps.slice(0, 25),
    requiredEvidence: ["Catalog scope", "category/division ownership", "supplier source", "product document/MSDS where applicable", "transaction trace", "sustainability/compliance review"],
    guardrail: "Passport evidence is a draft evidence index only; public product passports, customer declarations, labels, certificates, and product documents are not created or published automatically.",
  };
}

export function buildSupplierCompliance(inputs: ProductLifecycleInputs) {
  const nowIso = inputs.nowIso ?? new Date().toISOString();
  const documentRisks = inputs.supplierDocuments
    .map((doc) => {
      const days = daysUntil(doc.expiresAt, nowIso);
      const severity = doc.status !== "active" || days == null || days < 0 ? "HIGH" : days <= 45 ? "MEDIUM" : "LOW";
      return { ...doc, daysUntilExpiry: days, severity, requiredAction: days == null ? "Confirm document expiry or evergreen status." : days < 0 ? "Replace expired supplier document." : "Schedule renewal before passport release." };
    })
    .filter((doc) => doc.status !== "active" || doc.daysUntilExpiry == null || doc.daysUntilExpiry <= 60);
  const overdueTasks = inputs.supplierTasks.filter((task) => !task.done && task.dueAt && Date.parse(task.dueAt) < Date.parse(nowIso));
  const weakContractPackets = inputs.contractCompliancePackets.filter((packet) => packet.complianceScore < 75 || packet.expiringDocumentCount > 0 || packet.complianceGapCount > 0 || packet.renewalRiskCount > 0);
  return {
    supplierDocumentCount: inputs.supplierDocuments.length,
    documentRiskCount: documentRisks.length,
    overdueTaskCount: overdueTasks.length,
    contractPacketRiskCount: weakContractPackets.length,
    supplierComplianceGapCount: documentRisks.length + overdueTasks.length + weakContractPackets.length,
    documentRisks: documentRisks.toSorted((a, b) => severityPenalty(b.severity) - severityPenalty(a.severity)).slice(0, 20),
    overdueTasks: overdueTasks.slice(0, 20),
    weakContractPackets: weakContractPackets.map((packet) => ({ packetId: packet.id, title: packet.title, complianceScore: packet.complianceScore, expiringDocumentCount: packet.expiringDocumentCount, complianceGapCount: packet.complianceGapCount })),
    guardrail: "Supplier compliance output queues review only; supplier documents, onboarding tasks, approvals, certificates, and contract packets are not changed automatically.",
  };
}

export function buildSustainabilityPassport(inputs: ProductLifecycleInputs) {
  const weakPackets = inputs.sustainabilityPackets.filter((packet) => packet.sustainabilityScore < 75 || packet.missingDataCount > 0);
  const dgProducts = inputs.products.filter((product) => product.isDangerousGoods);
  const temperatureProducts = inputs.products.filter((product) => product.isTemperatureControlled);
  const sustainabilityGapCount = weakPackets.length + inputs.products.filter((product) => !product.hsCode || product.supplierCount === 0).length;
  return {
    sustainabilityPacketCount: inputs.sustainabilityPackets.length,
    weakPacketCount: weakPackets.length,
    sustainabilityGapCount,
    dangerousGoodsProductCount: dgProducts.length,
    temperatureControlledProductCount: temperatureProducts.length,
    weakPackets: weakPackets.map((packet) => ({ packetId: packet.id, title: packet.title, sustainabilityScore: packet.sustainabilityScore, missingDataCount: packet.missingDataCount, recommendationCount: packet.recommendationCount })),
    regulatedProducts: [...dgProducts, ...temperatureProducts].slice(0, 20).map((product) => ({ productId: product.id, sku: product.sku, name: product.name, dangerousGoods: product.isDangerousGoods, temperatureControlled: product.isTemperatureControlled })),
    guardrail: "Sustainability passport content is planning evidence only; ESG claims, product labels, DG declarations, and customer-facing passports require reviewed factors and approval.",
  };
}

export function buildLifecycleRisk(inputs: ProductLifecycleInputs) {
  const productEvents = inputs.riskSignals.filter((event) => /product|sku|quality|recall|compliance|customs|tariff|certificate|supplier/i.test(`${event.eventType} ${event.title} ${event.affectedObjectType ?? ""}`));
  const pendingActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /product|passport|compliance|supplier|sustainability|quality|catalog/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    externalRiskCount: productEvents.length,
    pendingActionCount: pendingActions.length,
    riskSignals: productEvents.toSorted((a, b) => severityPenalty(b.severity) - severityPenalty(a.severity) || b.confidence - a.confidence).slice(0, 15),
    pendingActions: pendingActions.slice(0, 15).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority, objectType: item.objectType })),
    guardrail: "Lifecycle risk watch does not close risk events, change SKUs, recall products, alter suppliers, or update operational records automatically.",
  };
}

export function buildReleaseChecklist(input: {
  catalogReadiness: ReturnType<typeof buildCatalogReadiness>;
  passportEvidence: ReturnType<typeof buildPassportEvidence>;
  supplierCompliance: ReturnType<typeof buildSupplierCompliance>;
  sustainabilityPassport: ReturnType<typeof buildSustainabilityPassport>;
  lifecycleRisk: ReturnType<typeof buildLifecycleRisk>;
}) {
  const blockers = [
    input.catalogReadiness.catalogGapCount > 0 ? "Resolve catalog ownership and required attribute gaps." : null,
    input.passportEvidence.passportGapCount > 0 ? "Complete passport evidence index before customer exchange." : null,
    input.supplierCompliance.supplierComplianceGapCount > 0 ? "Clear supplier document/task/contract compliance risks." : null,
    input.sustainabilityPassport.sustainabilityGapCount > 0 ? "Review ESG/DG/temperature evidence and assumptions." : null,
    input.lifecycleRisk.externalRiskCount > 0 ? "Review product, supplier, quality, customs, or certificate risk events." : null,
  ].filter((item): item is string => Boolean(item));
  return {
    releaseReady: blockers.length === 0,
    blockerCount: blockers.length,
    blockers,
    checklist: [
      "Confirm catalog category/division, HS/EAN, DG, temperature, and supplier source evidence.",
      "Verify product documents and MSDS evidence before passport publication.",
      "Review supplier document expiries, onboarding tasks, and contract compliance packets.",
      "Validate sustainability assumptions before external ESG, label, or customer passport claims.",
      "Queue owner review before release, sunset, supplier change, recall, or public compliance action.",
    ],
    guardrail: "Release checklist is approval-gated; it does not activate products, publish passports, change suppliers, send certificates, launch recalls, or update customer-facing claims.",
  };
}

export function buildProductLifecyclePacket(inputs: ProductLifecycleInputs) {
  const catalogReadiness = buildCatalogReadiness(inputs.products);
  const passportEvidence = buildPassportEvidence(inputs.products);
  const supplierCompliance = buildSupplierCompliance(inputs);
  const sustainabilityPassport = buildSustainabilityPassport(inputs);
  const lifecycleRisk = buildLifecycleRisk(inputs);
  const releaseChecklist = buildReleaseChecklist({ catalogReadiness, passportEvidence, supplierCompliance, sustainabilityPassport, lifecycleRisk });
  const lifecycleActionCount = releaseChecklist.blockerCount + lifecycleRisk.pendingActionCount + supplierCompliance.supplierComplianceGapCount;
  const lifecycleScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(24, catalogReadiness.catalogGapCount * 4) -
          Math.min(24, passportEvidence.passportGapCount * 4) -
          Math.min(22, supplierCompliance.supplierComplianceGapCount * 3) -
          Math.min(18, sustainabilityPassport.sustainabilityGapCount * 2) -
          Math.min(14, lifecycleRisk.externalRiskCount * 4),
      ),
    ),
  );
  const sourceSummary = {
    products: inputs.products.length,
    supplierDocuments: inputs.supplierDocuments.length,
    supplierTasks: inputs.supplierTasks.length,
    sustainabilityPackets: inputs.sustainabilityPackets.length,
    contractCompliancePackets: inputs.contractCompliancePackets.length,
    riskSignals: inputs.riskSignals.length,
    actionQueueItems: inputs.actionQueue.length,
    guardrail: "Sprint 13 creates review packets only; product records, supplier records, product documents, public passports, labels, ESG claims, recalls, and compliance filings are never mutated silently.",
  };
  const responsePlan = {
    status: lifecycleScore < 70 ? "PRODUCT_COMPLIANCE_REVIEW_REQUIRED" : lifecycleScore < 85 ? "PRODUCT_OWNER_REVIEW" : "MONITOR",
    owners: ["Product owner", "Quality/compliance", "Supplier management", "Sustainability", "Warehouse/product operations"],
    steps: releaseChecklist.checklist,
  };
  const rollbackPlan = {
    steps: [
      "Leave product master data, documents, supplier links, supplier compliance records, ESG assumptions, risk events, labels, recalls, and customer-facing passport records unchanged until human approval.",
      "If review rejects the packet, keep the evidence snapshot and approval notes for audit without executing lifecycle actions.",
      "Create a fresh packet when product catalog, supplier document, compliance, sustainability, transaction trace, or risk evidence changes materially.",
      "Use the action queue before release, sunset, supplier change, recall, passport publication, or customer compliance communication.",
    ],
  };
  const leadershipSummary = [
    `Product Lifecycle & Compliance Passport score ${lifecycleScore}/100 across ${inputs.products.length} product${inputs.products.length === 1 ? "" : "s"}.`,
    `${passportEvidence.passportGapCount} passport gap${passportEvidence.passportGapCount === 1 ? "" : "s"}, ${supplierCompliance.supplierComplianceGapCount} supplier compliance gap${supplierCompliance.supplierComplianceGapCount === 1 ? "" : "s"}, ${sustainabilityPassport.sustainabilityGapCount} sustainability gap${sustainabilityPassport.sustainabilityGapCount === 1 ? "" : "s"}, and ${lifecycleRisk.externalRiskCount} lifecycle risk signal${lifecycleRisk.externalRiskCount === 1 ? "" : "s"} require review.`,
    "The packet is approval-gated and does not mutate product master data, supplier compliance records, documents, labels, public passports, ESG claims, recalls, or customer communications automatically.",
  ].join("\n\n");
  return {
    title: `Sprint 13 Product Lifecycle & Compliance Passport packet: score ${lifecycleScore}/100`,
    status: "DRAFT",
    lifecycleScore,
    productCount: inputs.products.length,
    passportGapCount: passportEvidence.passportGapCount,
    documentRiskCount: supplierCompliance.documentRiskCount,
    supplierComplianceGapCount: supplierCompliance.supplierComplianceGapCount,
    sustainabilityGapCount: sustainabilityPassport.sustainabilityGapCount,
    lifecycleActionCount,
    sourceSummary,
    catalogReadiness,
    passportEvidence,
    supplierCompliance,
    sustainabilityPassport,
    lifecycleRisk,
    releaseChecklist,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

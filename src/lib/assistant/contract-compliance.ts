export type ContractDocumentSignal = {
  id: string;
  supplierId: string;
  supplierLabel: string;
  documentType: string;
  title: string;
  status: string;
  expiresAt: string | null;
  updatedAt: string;
};

export type TariffContractSignal = {
  id: string;
  title: string;
  providerLabel: string;
  contractNumber: string | null;
  status: string;
  transportMode: string;
  validFrom: string | null;
  validTo: string | null;
  tradeScope: string | null;
  rateLineCount: number;
  chargeLineCount: number;
  freeTimeRuleCount: number;
};

export type RfqCommitmentSignal = {
  id: string;
  title: string;
  status: string;
  transportMode: string;
  quotesDueAt: string | null;
  responseCount: number;
  submittedResponseCount: number;
  validityTo: string | null;
  recommendedCarrier: string | null;
};

export type ContractComplianceInputs = {
  documents: ContractDocumentSignal[];
  tariffContracts: TariffContractSignal[];
  rfqCommitments: RfqCommitmentSignal[];
  nowIso?: string;
};

function daysUntil(dateIso: string | null, nowIso: string) {
  if (!dateIso) return null;
  const days = Math.ceil((Date.parse(dateIso) - Date.parse(nowIso)) / 86_400_000);
  return Number.isFinite(days) ? days : null;
}

function severityFromDays(days: number | null) {
  if (days == null) return "MEDIUM" as const;
  if (days < 0) return "CRITICAL" as const;
  if (days <= 14) return "HIGH" as const;
  if (days <= 45) return "MEDIUM" as const;
  return "LOW" as const;
}

function scorePenalty(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  if (severity === "CRITICAL") return 20;
  if (severity === "HIGH") return 12;
  if (severity === "MEDIUM") return 6;
  return 2;
}

export function extractContractObligations(inputs: ContractComplianceInputs) {
  const documentObligations = inputs.documents.map((doc) => ({
    sourceType: "SUPPLIER_DOCUMENT",
    sourceId: doc.id,
    party: doc.supplierLabel,
    obligation: `${doc.documentType.replaceAll("_", " ")} must remain active and current.`,
    dueAt: doc.expiresAt,
    evidence: doc.title,
  }));
  const tariffObligations = inputs.tariffContracts.flatMap((contract) => [
    {
      sourceType: "TARIFF_CONTRACT",
      sourceId: contract.id,
      party: contract.providerLabel,
      obligation: `${contract.transportMode} tariff ${contract.contractNumber ?? contract.title} must stay valid for covered trade scope.`,
      dueAt: contract.validTo,
      evidence: `${contract.rateLineCount} rates, ${contract.chargeLineCount} charges, ${contract.freeTimeRuleCount} free-time rules.`,
    },
    {
      sourceType: "TARIFF_CONTRACT",
      sourceId: contract.id,
      party: contract.providerLabel,
      obligation: "Commercial users must review included/excluded charges and free-time terms before booking or invoice audit.",
      dueAt: contract.validTo,
      evidence: contract.tradeScope ?? "No trade scope provided.",
    },
  ]);
  const rfqObligations = inputs.rfqCommitments.map((rfq) => ({
    sourceType: "RFQ_COMMITMENT",
    sourceId: rfq.id,
    party: rfq.recommendedCarrier ?? "Carrier shortlist",
    obligation: `${rfq.transportMode} RFQ outcome must be reviewed before tender or pricing commitment.`,
    dueAt: rfq.validityTo ?? rfq.quotesDueAt,
    evidence: `${rfq.submittedResponseCount}/${rfq.responseCount} responses submitted.`,
  }));
  return [...documentObligations, ...tariffObligations, ...rfqObligations];
}

export function buildDocumentRisks(documents: ContractDocumentSignal[], nowIso = new Date().toISOString()) {
  return documents
    .map((doc) => {
      const days = daysUntil(doc.expiresAt, nowIso);
      const severity = severityFromDays(days);
      return {
        documentId: doc.id,
        supplierId: doc.supplierId,
        supplierLabel: doc.supplierLabel,
        documentType: doc.documentType,
        title: doc.title,
        status: doc.status,
        expiresAt: doc.expiresAt,
        daysUntilExpiry: days,
        severity,
        requiredAction: days == null ? "Add expiry metadata or confirm evergreen status." : days < 0 ? "Replace expired compliance document." : "Schedule renewal review before expiry.",
      };
    })
    .filter((risk) => risk.status !== "active" || risk.daysUntilExpiry == null || risk.daysUntilExpiry <= 60)
    .sort((a, b) => scorePenalty(b.severity) - scorePenalty(a.severity) || String(a.expiresAt).localeCompare(String(b.expiresAt)));
}

export function buildRenewalRisks(inputs: ContractComplianceInputs) {
  const nowIso = inputs.nowIso ?? new Date().toISOString();
  const tariffRisks = inputs.tariffContracts.map((contract) => {
    const days = daysUntil(contract.validTo, nowIso);
    const severity = severityFromDays(days);
    return {
      sourceType: "TARIFF_CONTRACT",
      sourceId: contract.id,
      title: contract.title,
      party: contract.providerLabel,
      validTo: contract.validTo,
      daysUntilRenewal: days,
      severity,
      risk: days == null ? "Missing validity end date." : days < 0 ? "Tariff contract version is expired." : "Tariff contract renewal window is approaching.",
    };
  });
  const rfqRisks = inputs.rfqCommitments.map((rfq) => {
    const date = rfq.validityTo ?? rfq.quotesDueAt;
    const days = daysUntil(date, nowIso);
    const severity = severityFromDays(days);
    return {
      sourceType: "RFQ_COMMITMENT",
      sourceId: rfq.id,
      title: rfq.title,
      party: rfq.recommendedCarrier ?? "Carrier shortlist",
      validTo: date,
      daysUntilRenewal: days,
      severity,
      risk: rfq.submittedResponseCount === 0 ? "RFQ has no submitted commitment yet." : "RFQ pricing validity requires renewal or conversion review.",
    };
  });
  return [...tariffRisks, ...rfqRisks]
    .filter((risk) => risk.daysUntilRenewal == null || risk.daysUntilRenewal <= 90)
    .sort((a, b) => scorePenalty(b.severity) - scorePenalty(a.severity) || String(a.validTo).localeCompare(String(b.validTo)));
}

export function buildComplianceGaps(inputs: ContractComplianceInputs) {
  const gaps = [];
  for (const contract of inputs.tariffContracts) {
    if (contract.rateLineCount === 0) gaps.push({ sourceType: "TARIFF_CONTRACT", sourceId: contract.id, title: contract.title, severity: "HIGH" as const, gap: "No rate lines are attached." });
    if (contract.chargeLineCount === 0) gaps.push({ sourceType: "TARIFF_CONTRACT", sourceId: contract.id, title: contract.title, severity: "MEDIUM" as const, gap: "No charge lines are attached." });
    if (contract.freeTimeRuleCount === 0) gaps.push({ sourceType: "TARIFF_CONTRACT", sourceId: contract.id, title: contract.title, severity: "MEDIUM" as const, gap: "No free-time rule evidence is attached." });
  }
  for (const rfq of inputs.rfqCommitments) {
    if (rfq.responseCount === 0) gaps.push({ sourceType: "RFQ_COMMITMENT", sourceId: rfq.id, title: rfq.title, severity: "HIGH" as const, gap: "No carrier responses are attached." });
    if (rfq.responseCount > 0 && rfq.submittedResponseCount === 0) gaps.push({ sourceType: "RFQ_COMMITMENT", sourceId: rfq.id, title: rfq.title, severity: "MEDIUM" as const, gap: "Responses exist but none are submitted." });
    if (!rfq.validityTo) gaps.push({ sourceType: "RFQ_COMMITMENT", sourceId: rfq.id, title: rfq.title, severity: "MEDIUM" as const, gap: "No pricing validity end date found." });
  }
  return gaps.sort((a, b) => scorePenalty(b.severity) - scorePenalty(a.severity) || a.title.localeCompare(b.title));
}

export function scoreContractCompliance(input: { obligationCount: number; documentRiskCount: number; renewalRiskCount: number; gapCount: number }) {
  const penalty = Math.min(30, input.documentRiskCount * 6) + Math.min(30, input.renewalRiskCount * 5) + Math.min(28, input.gapCount * 7) + (input.obligationCount === 0 ? 15 : 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function buildContractCompliancePacket(inputs: ContractComplianceInputs) {
  const nowIso = inputs.nowIso ?? new Date().toISOString();
  const obligations = extractContractObligations(inputs);
  const documentRisks = buildDocumentRisks(inputs.documents, nowIso);
  const renewalRisks = buildRenewalRisks({ ...inputs, nowIso });
  const gaps = buildComplianceGaps(inputs);
  const complianceScore = scoreContractCompliance({
    obligationCount: obligations.length,
    documentRiskCount: documentRisks.length,
    renewalRiskCount: renewalRisks.length,
    gapCount: gaps.length,
  });
  const sourceSummary = {
    supplierDocuments: inputs.documents.length,
    tariffContracts: inputs.tariffContracts.length,
    rfqCommitments: inputs.rfqCommitments.length,
    guardrail: "Assistant proposes contract/compliance review work only; source documents, tariffs, RFQs, bookings, and messages are not changed automatically.",
  };
  const actionPlan = {
    steps: [
      { step: "Renew documents", owner: "Supplier compliance", action: "Replace expired or soon-expiring supplier documents and verify metadata." },
      { step: "Review contract validity", owner: "Procurement / logistics", action: "Confirm tariff and RFQ validity windows before quoting, booking, or invoice audit." },
      { step: "Close evidence gaps", owner: "Contract owner", action: "Attach missing rate, charge, free-time, response, and validity evidence." },
      { step: "Approve obligations", owner: "Compliance lead", action: "Queue obligation and renewal packet for human approval before downstream work." },
    ],
    priorityItems: [...documentRisks.slice(0, 5), ...renewalRisks.slice(0, 5), ...gaps.slice(0, 5)],
  };
  const leadershipSummary = [
    `Contract compliance score ${complianceScore}/100 across ${obligations.length} extracted obligation${obligations.length === 1 ? "" : "s"}.`,
    `${documentRisks.length} document risk${documentRisks.length === 1 ? "" : "s"}, ${renewalRisks.length} renewal risk${renewalRisks.length === 1 ? "" : "s"}, and ${gaps.length} compliance gap${gaps.length === 1 ? "" : "s"} require review.`,
    "Actions are approval-gated; the assistant does not modify supplier documents, tariff contracts, RFQs, bookings, or customer/supplier messages automatically.",
  ].join("\n\n");

  return {
    title: `Contract compliance packet: score ${complianceScore}/100`,
    status: "DRAFT",
    complianceScore,
    obligationCount: obligations.length,
    expiringDocumentCount: documentRisks.length,
    renewalRiskCount: renewalRisks.length,
    complianceGapCount: gaps.length,
    sourceSummary,
    obligations,
    renewalRisks,
    documentRisks,
    complianceGaps: gaps,
    actionPlan,
    leadershipSummary,
  };
}

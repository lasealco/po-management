export type RevenueQuoteInput = {
  id: string;
  title: string;
  status: string;
  quoteNumber: string | null;
  accountName: string;
  opportunityName: string | null;
  opportunityStage: string | null;
  probability: number | null;
  subtotal: number;
  currency: string;
  lineCount: number;
  validUntil: string | null;
  daysUntilExpiry: number | null;
  strategicAccount: boolean;
};

export type RevenueOperationsInputs = {
  quotes: RevenueQuoteInput[];
  opportunityCount: number;
  openOrderCount: number;
  inventoryCoveragePct: number;
  planHealthScore: number;
  transportRiskCount: number;
  financeRiskScore: number;
  contractRiskCount: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function money(value: number, currency: string) {
  return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
}

export function selectRevenueQuote(inputs: RevenueOperationsInputs) {
  return [...inputs.quotes].sort((a, b) => {
    const aScore = a.subtotal + (a.strategicAccount ? 25000 : 0) + (a.status === "DRAFT" ? 10000 : 0);
    const bScore = b.subtotal + (b.strategicAccount ? 25000 : 0) + (b.status === "DRAFT" ? 10000 : 0);
    return bScore - aScore;
  })[0] ?? null;
}

export function buildCommercialSnapshot(inputs: RevenueOperationsInputs, quote = selectRevenueQuote(inputs)) {
  const totalPipelineValue = inputs.quotes.reduce((sum, item) => sum + item.subtotal, 0);
  const draftQuoteCount = inputs.quotes.filter((item) => item.status === "DRAFT").length;
  const expiringQuoteCount = inputs.quotes.filter((item) => item.daysUntilExpiry != null && item.daysUntilExpiry <= 14).length;
  return {
    quoteCount: inputs.quotes.length,
    opportunityCount: inputs.opportunityCount,
    totalPipelineValue,
    draftQuoteCount,
    expiringQuoteCount,
    selectedQuote: quote
      ? {
          id: quote.id,
          title: quote.title,
          quoteNumber: quote.quoteNumber,
          accountName: quote.accountName,
          opportunityName: quote.opportunityName,
          stage: quote.opportunityStage,
          probability: quote.probability,
          subtotal: quote.subtotal,
          currency: quote.currency,
          lineCount: quote.lineCount,
          validUntil: quote.validUntil,
          strategicAccount: quote.strategicAccount,
        }
      : null,
  };
}

export function buildFulfillmentFeasibility(inputs: RevenueOperationsInputs, quote = selectRevenueQuote(inputs)) {
  const risks = [
    ...(inputs.inventoryCoveragePct < 40
      ? [{ key: "inventory_coverage", severity: inputs.inventoryCoveragePct < 20 ? "HIGH" : "MEDIUM", detail: `Inventory coverage is ${inputs.inventoryCoveragePct}%.` }]
      : []),
    ...(inputs.planHealthScore < 65
      ? [{ key: "plan_health", severity: inputs.planHealthScore < 45 ? "HIGH" : "MEDIUM", detail: `Plan health is ${inputs.planHealthScore}/100.` }]
      : []),
    ...(inputs.transportRiskCount > 0
      ? [{ key: "transport_risk", severity: inputs.transportRiskCount >= 5 ? "HIGH" : "MEDIUM", detail: `${inputs.transportRiskCount} transport risk signal(s) may affect fulfillment.` }]
      : []),
    ...(quote && quote.lineCount === 0
      ? [{ key: "missing_quote_lines", severity: "HIGH", detail: "Selected quote has no quote lines." }]
      : []),
  ];
  return {
    feasibilityRiskCount: risks.length,
    serviceFeasible: risks.every((risk) => risk.severity !== "HIGH"),
    risks,
    evidence: [
      `Open orders: ${inputs.openOrderCount}`,
      `Inventory coverage: ${inputs.inventoryCoveragePct}%`,
      `Plan health: ${inputs.planHealthScore}/100`,
      `Transport risk count: ${inputs.transportRiskCount}`,
    ],
    guardrail: "Feasibility review does not reserve inventory, change promise dates, create orders, or update shipments.",
  };
}

export function buildPricingEvidence(inputs: RevenueOperationsInputs, quote = selectRevenueQuote(inputs)) {
  const risks = [
    ...(quote && quote.subtotal <= 0 ? [{ key: "missing_subtotal", severity: "HIGH", detail: "Quote subtotal is missing or zero." }] : []),
    ...(quote && quote.lineCount === 0 ? [{ key: "missing_lines", severity: "HIGH", detail: "Quote lines are required before approval." }] : []),
    ...(inputs.financeRiskScore >= 60 ? [{ key: "finance_risk", severity: "MEDIUM", detail: `Finance risk score is ${inputs.financeRiskScore}.` }] : []),
    ...(quote && quote.daysUntilExpiry != null && quote.daysUntilExpiry <= 7 ? [{ key: "near_expiry", severity: "MEDIUM", detail: `Quote expires in ${quote.daysUntilExpiry} day(s).` }] : []),
  ];
  return {
    pricingRiskCount: risks.length,
    risks,
    evidence: quote
      ? [`Quote value ${money(quote.subtotal, quote.currency)}`, `${quote.lineCount} quote line(s)`, `Status ${quote.status}`]
      : ["No quote selected."],
    guardrail: "Pricing evidence is advisory and does not change quote amounts, RFQs, tariffs, margin, or finance records.",
  };
}

export function buildApprovalRoute(
  inputs: RevenueOperationsInputs,
  quote = selectRevenueQuote(inputs),
  feasibility = buildFulfillmentFeasibility(inputs, quote),
  pricing = buildPricingEvidence(inputs, quote),
) {
  const steps = [
    { owner: "Sales", action: "Confirm customer scope, timeline, and editable customer-ready language." },
    ...(pricing.pricingRiskCount > 0 || (quote?.subtotal ?? 0) >= 50000 ? [{ owner: "Finance", action: "Review pricing, margin, risk, and commercial terms before sending." }] : []),
    ...(feasibility.feasibilityRiskCount > 0 ? [{ owner: "Operations", action: "Validate fulfillment feasibility, plan health, inventory, and transport constraints." }] : []),
    ...(inputs.contractRiskCount > 0 ? [{ owner: "Legal/Contracts", action: "Review contract obligations, compliance gaps, renewal/term assumptions, and handoff package." }] : []),
  ];
  return {
    approvalStepCount: steps.length,
    steps,
    guardrail: "Approvals queue review work only; quote status, opportunity stage, contract, and customer communications are not changed automatically.",
  };
}

export function buildCustomerDraft(quote: RevenueQuoteInput | null, feasibility: ReturnType<typeof buildFulfillmentFeasibility>) {
  return {
    subject: quote ? `Proposal review: ${quote.title}` : "Proposal review",
    body: quote
      ? [
          `Hi ${quote.accountName},`,
          `We prepared the proposal package for ${quote.title} with ${quote.lineCount} commercial line item${quote.lineCount === 1 ? "" : "s"}.`,
          feasibility.serviceFeasible
            ? "Operational feasibility is currently within review thresholds, pending final internal approval."
            : "A few fulfillment assumptions need internal review before we can confirm final commitments.",
          "We will share the approved version once commercial, operational, and contract checks are complete.",
        ].join("\n\n")
      : "No quote is ready for a customer draft yet.",
    editable: true,
    guardrail: "Customer draft is copy/edit only and is not sent automatically.",
  };
}

export function buildContractHandoff(inputs: RevenueOperationsInputs, quote = selectRevenueQuote(inputs)) {
  return {
    readyForHandoff: Boolean(quote && quote.subtotal > 0 && quote.lineCount > 0 && inputs.contractRiskCount === 0),
    handoffChecklist: [
      "Quote header and lines reviewed.",
      "Commercial approval route completed.",
      "Fulfillment feasibility reviewed by operations.",
      "Customer-ready scope and assumptions approved.",
      "Contract obligations and risk gaps checked.",
    ],
    blockers: [
      ...(!quote ? ["No selected quote."] : []),
      ...(quote && quote.lineCount === 0 ? ["Quote lines missing."] : []),
      ...(inputs.contractRiskCount > 0 ? [`${inputs.contractRiskCount} contract/compliance risk signal(s) need review.`] : []),
    ],
    guardrail: "Contract handoff package does not create, amend, send, or sign contracts automatically.",
  };
}

export function buildRevenueRollbackPlan() {
  const steps = [
    "Keep CRM quote status, quote lines, opportunity stage, customer communications, sales orders, inventory, shipments, and contract records unchanged until separate approval.",
    "If review is rejected, preserve packet evidence and action queue notes for audit.",
    "If quote scope changes, create a fresh AMP36 packet instead of overwriting the archived commercial decision.",
    "Use audit events to explain why commercial approval, fulfillment feasibility, or contract handoff was accepted, rejected, or superseded.",
  ];
  return { stepCount: steps.length, steps };
}

export function scoreRevenueOperations(
  snapshot: ReturnType<typeof buildCommercialSnapshot>,
  feasibility: ReturnType<typeof buildFulfillmentFeasibility>,
  pricing: ReturnType<typeof buildPricingEvidence>,
  handoff: ReturnType<typeof buildContractHandoff>,
) {
  const quoteDepth = Math.min(20, snapshot.quoteCount * 4);
  const opportunityDepth = Math.min(15, snapshot.opportunityCount * 3);
  const readiness = handoff.readyForHandoff ? 25 : 10;
  const riskPenalty = Math.min(45, feasibility.feasibilityRiskCount * 10 + pricing.pricingRiskCount * 8);
  const expiryPenalty = Math.min(10, snapshot.expiringQuoteCount * 3);
  return clamp(50 + quoteDepth + opportunityDepth + readiness - riskPenalty - expiryPenalty);
}

export function buildRevenueOperationsPacket(inputs: RevenueOperationsInputs) {
  const selectedQuote = selectRevenueQuote(inputs);
  const commercialSnapshot = buildCommercialSnapshot(inputs, selectedQuote);
  const feasibility = buildFulfillmentFeasibility(inputs, selectedQuote);
  const pricingEvidence = buildPricingEvidence(inputs, selectedQuote);
  const approvalRoute = buildApprovalRoute(inputs, selectedQuote, feasibility, pricingEvidence);
  const customerDraft = buildCustomerDraft(selectedQuote, feasibility);
  const contractHandoff = buildContractHandoff(inputs, selectedQuote);
  const rollbackPlan = buildRevenueRollbackPlan();
  const revenueScore = scoreRevenueOperations(commercialSnapshot, feasibility, pricingEvidence, contractHandoff);
  const leadershipSummary = [
    `Revenue operations score is ${revenueScore}/100 across ${commercialSnapshot.quoteCount} quote(s) and ${commercialSnapshot.opportunityCount} opportunity record(s).`,
    selectedQuote
      ? `Selected quote: ${selectedQuote.title} for ${selectedQuote.accountName}, value ${money(selectedQuote.subtotal, selectedQuote.currency)}. Feasibility risks: ${feasibility.feasibilityRiskCount}; pricing risks: ${pricingEvidence.pricingRiskCount}; approval steps: ${approvalRoute.approvalStepCount}.`
      : "No quote is available for commercial review.",
    "Packet creation does not mutate quote status, opportunity stage, customer communications, sales orders, inventory, shipments, or contract records.",
  ].join("\n\n");
  return {
    title: selectedQuote ? `Revenue ops: ${selectedQuote.title}` : "Revenue ops: no quote ready",
    status: "DRAFT",
    revenueScore,
    quoteCount: commercialSnapshot.quoteCount,
    opportunityCount: commercialSnapshot.opportunityCount,
    feasibilityRiskCount: feasibility.feasibilityRiskCount,
    pricingRiskCount: pricingEvidence.pricingRiskCount,
    approvalStepCount: approvalRoute.approvalStepCount,
    selectedQuoteId: selectedQuote?.id ?? null,
    commercialSnapshot,
    feasibility,
    pricingEvidence,
    approvalRoute,
    customerDraft,
    contractHandoff,
    rollbackPlan,
    leadershipSummary,
  };
}

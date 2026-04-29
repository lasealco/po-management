export type CommercialRevenueControlInputs = {
  revenuePackets: Array<{
    id: string;
    title: string;
    status: string;
    revenueScore: number;
    quoteCount: number;
    opportunityCount: number;
    feasibilityRiskCount: number;
    pricingRiskCount: number;
    approvalStepCount: number;
    selectedQuoteId: string | null;
  }>;
  financePackets: Array<{
    id: string;
    title: string;
    status: string;
    riskScore: number;
    currency: string;
    totalVariance: number;
    disputeAmount: number;
    accrualAmount: number;
  }>;
  contractPackets: Array<{
    id: string;
    title: string;
    status: string;
    complianceScore: number;
    obligationCount: number;
    complianceGapCount: number;
    renewalRiskCount: number;
  }>;
  customerBriefs: Array<{ id: string; title: string; status: string; serviceScore: number }>;
  quotes: Array<{
    id: string;
    title: string;
    status: string;
    quoteNumber: string | null;
    accountName: string;
    subtotal: number;
    currency: string;
    lineCount: number;
    validUntil: string | null;
    daysUntilExpiry: number | null;
  }>;
  salesOrders: Array<{ id: string; soNumber: string; status: string; customerName: string; currency: string; lineCount: number; totalValue: number; assistantReviewStatus: string }>;
  pricingSnapshots: Array<{ id: string; sourceType: string; sourceSummary: string | null; currency: string; totalEstimatedCost: number; frozenAt: string; basisSide: string | null; incoterm: string | null }>;
  invoiceIntakes: Array<{ id: string; externalInvoiceNo: string | null; vendorLabel: string | null; status: string; currency: string; rollupOutcome: string; redLineCount: number; amberLineCount: number; approvedForAccounting: boolean }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function currencyOf(inputs: CommercialRevenueControlInputs) {
  return inputs.quotes[0]?.currency ?? inputs.salesOrders[0]?.currency ?? inputs.financePackets[0]?.currency ?? inputs.pricingSnapshots[0]?.currency ?? inputs.invoiceIntakes[0]?.currency ?? "USD";
}

export function buildQuoteToCash(inputs: CommercialRevenueControlInputs) {
  const expiringQuotes = inputs.quotes.filter((quote) => quote.daysUntilExpiry != null && quote.daysUntilExpiry <= 14);
  const quoteGaps = inputs.quotes.filter((quote) => quote.subtotal <= 0 || quote.lineCount === 0 || quote.status === "DRAFT");
  const unreviewedOrders = inputs.salesOrders.filter((order) => order.assistantReviewStatus !== "APPROVED" && order.status !== "CLOSED");
  const pendingCommercialActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /quote|revenue|commercial|sales|order|customer/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    quoteRiskCount: expiringQuotes.length + quoteGaps.length + unreviewedOrders.length + pendingCommercialActions.length,
    quoteCount: inputs.quotes.length,
    openSalesOrderCount: inputs.salesOrders.filter((order) => order.status !== "CLOSED").length,
    pipelineValue: roundMoney(inputs.quotes.reduce((sum, quote) => sum + quote.subtotal, 0)),
    salesOrderValue: roundMoney(inputs.salesOrders.reduce((sum, order) => sum + order.totalValue, 0)),
    expiringQuotes: expiringQuotes.slice(0, 10).map((quote) => ({ quoteId: quote.id, title: quote.title, accountName: quote.accountName, daysUntilExpiry: quote.daysUntilExpiry, subtotal: quote.subtotal, currency: quote.currency })),
    quoteGaps: quoteGaps.slice(0, 10).map((quote) => ({
      quoteId: quote.id,
      title: quote.title,
      accountName: quote.accountName,
      gaps: [quote.subtotal <= 0 ? "missing subtotal" : null, quote.lineCount === 0 ? "missing lines" : null, quote.status === "DRAFT" ? "draft status" : null].filter((item): item is string => Boolean(item)),
    })),
    unreviewedOrders: unreviewedOrders.slice(0, 10).map((order) => ({ salesOrderId: order.id, soNumber: order.soNumber, customerName: order.customerName, assistantReviewStatus: order.assistantReviewStatus, totalValue: order.totalValue })),
    pendingCommercialActions: pendingCommercialActions.slice(0, 10).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Quote-to-cash review does not change quotes, sales orders, opportunity stages, prices, customer promises, or customer communications automatically.",
  };
}

export function buildPricingDiscipline(inputs: CommercialRevenueControlInputs) {
  const riskyRevenuePackets = inputs.revenuePackets.filter((packet) => packet.pricingRiskCount > 0 || packet.feasibilityRiskCount > 0 || packet.revenueScore < 70);
  const staleOrSparseSnapshots = inputs.pricingSnapshots.filter((snapshot) => snapshot.totalEstimatedCost <= 0 || !snapshot.sourceSummary || !snapshot.basisSide || !snapshot.incoterm);
  return {
    pricingRiskCount: riskyRevenuePackets.reduce((sum, packet) => sum + packet.pricingRiskCount + packet.feasibilityRiskCount, 0) + staleOrSparseSnapshots.length,
    revenuePacketCount: inputs.revenuePackets.length,
    pricingSnapshotCount: inputs.pricingSnapshots.length,
    averageRevenueScore: inputs.revenuePackets.length ? Math.round(inputs.revenuePackets.reduce((sum, packet) => sum + packet.revenueScore, 0) / inputs.revenuePackets.length) : 0,
    riskyRevenuePackets: riskyRevenuePackets.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, revenueScore: packet.revenueScore, pricingRiskCount: packet.pricingRiskCount, feasibilityRiskCount: packet.feasibilityRiskCount, selectedQuoteId: packet.selectedQuoteId })),
    snapshotGaps: staleOrSparseSnapshots.slice(0, 10).map((snapshot) => ({
      snapshotId: snapshot.id,
      sourceType: snapshot.sourceType,
      sourceSummary: snapshot.sourceSummary,
      totalEstimatedCost: snapshot.totalEstimatedCost,
      missing: [snapshot.totalEstimatedCost <= 0 ? "cost" : null, !snapshot.sourceSummary ? "source summary" : null, !snapshot.basisSide ? "basis side" : null, !snapshot.incoterm ? "incoterm" : null].filter((item): item is string => Boolean(item)),
    })),
    guardrail: "Pricing discipline output is advisory; it does not update quote amounts, tariff rates, pricing snapshots, margin, RFQs, or contract terms automatically.",
  };
}

export function buildMarginLeakage(inputs: CommercialRevenueControlInputs) {
  const riskyFinancePackets = inputs.financePackets.filter((packet) => packet.riskScore >= 50 || packet.disputeAmount > 0 || packet.totalVariance < 0);
  const totalVariance = roundMoney(inputs.financePackets.reduce((sum, packet) => sum + packet.totalVariance, 0));
  const disputeAmount = roundMoney(inputs.financePackets.reduce((sum, packet) => sum + packet.disputeAmount, 0));
  const accrualAmount = roundMoney(inputs.financePackets.reduce((sum, packet) => sum + packet.accrualAmount, 0));
  return {
    marginLeakageCount: riskyFinancePackets.length,
    financePacketCount: inputs.financePackets.length,
    totalVariance,
    disputeAmount,
    accrualAmount,
    riskyFinancePackets: riskyFinancePackets.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, riskScore: packet.riskScore, totalVariance: packet.totalVariance, disputeAmount: packet.disputeAmount, accrualAmount: packet.accrualAmount, currency: packet.currency })),
    guardrail: "Margin leakage review does not change shipment costs, invoice decisions, accruals, accounting exports, pricing, or finance records automatically.",
  };
}

export function buildInvoiceAudit(inputs: CommercialRevenueControlInputs) {
  const riskyIntakes = inputs.invoiceIntakes.filter((invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0 || invoice.amberLineCount > 0 || !invoice.approvedForAccounting);
  return {
    invoiceRiskCount: riskyIntakes.length,
    invoiceCount: inputs.invoiceIntakes.length,
    failedInvoiceCount: inputs.invoiceIntakes.filter((invoice) => invoice.rollupOutcome === "FAIL").length,
    unapprovedAccountingCount: inputs.invoiceIntakes.filter((invoice) => !invoice.approvedForAccounting).length,
    riskyIntakes: riskyIntakes.slice(0, 12).map((invoice) => ({ intakeId: invoice.id, externalInvoiceNo: invoice.externalInvoiceNo, vendorLabel: invoice.vendorLabel, status: invoice.status, rollupOutcome: invoice.rollupOutcome, redLineCount: invoice.redLineCount, amberLineCount: invoice.amberLineCount, approvedForAccounting: invoice.approvedForAccounting })),
    guardrail: "Invoice audit output does not approve invoices, submit disputes, mark accounting approval, export accounting packets, or mutate invoice intake records automatically.",
  };
}

export function buildCustomerCommercial(inputs: CommercialRevenueControlInputs) {
  const weakCustomers = inputs.customerBriefs.filter((brief) => brief.serviceScore < 75);
  const customerDraftActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /customer|reply|email|brief|commercial_update/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    customerRiskCount: weakCustomers.length + customerDraftActions.length,
    customerBriefCount: inputs.customerBriefs.length,
    weakCustomers: weakCustomers.slice(0, 10).map((brief) => ({ briefId: brief.id, title: brief.title, serviceScore: brief.serviceScore, status: brief.status })),
    customerDraftActions: customerDraftActions.slice(0, 10).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    customerSafeDraft: [
      "Commercial update draft:",
      "We are reviewing pricing, fulfillment, invoice, and contract evidence before confirming any external commitment.",
      "No price, promise, credit, dispute, or contract change is final until approved by the responsible team.",
    ].join("\n"),
    guardrail: "Customer commercial drafts are copy/edit only; no external message, promise, price, discount, credit, or dispute statement is sent automatically.",
  };
}

export function buildContractHandoffControl(inputs: CommercialRevenueControlInputs) {
  const riskyContracts = inputs.contractPackets.filter((packet) => packet.complianceScore < 80 || packet.complianceGapCount > 0 || packet.renewalRiskCount > 0);
  return {
    contractRiskCount: riskyContracts.reduce((sum, packet) => sum + packet.complianceGapCount + packet.renewalRiskCount + (packet.complianceScore < 80 ? 1 : 0), 0),
    contractPacketCount: inputs.contractPackets.length,
    obligationCount: inputs.contractPackets.reduce((sum, packet) => sum + packet.obligationCount, 0),
    riskyContracts: riskyContracts.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, complianceScore: packet.complianceScore, complianceGapCount: packet.complianceGapCount, renewalRiskCount: packet.renewalRiskCount })),
    handoffChecklist: ["Quote and pricing evidence reviewed.", "Invoice/dispute and margin risks reviewed.", "Customer-safe language approved.", "Contract obligations, renewals, and gaps cleared.", "Downstream legal/finance action created separately if needed."],
    guardrail: "Contract handoff control does not create, amend, send, approve, or sign contracts automatically.",
  };
}

export function buildCommercialRevenueControlPacket(inputs: CommercialRevenueControlInputs) {
  const sourceSummary = {
    revenuePackets: inputs.revenuePackets.length,
    financePackets: inputs.financePackets.length,
    contractPackets: inputs.contractPackets.length,
    customerBriefs: inputs.customerBriefs.length,
    quotes: inputs.quotes.length,
    salesOrders: inputs.salesOrders.length,
    pricingSnapshots: inputs.pricingSnapshots.length,
    invoiceIntakes: inputs.invoiceIntakes.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const quoteToCash = buildQuoteToCash(inputs);
  const pricingDiscipline = buildPricingDiscipline(inputs);
  const marginLeakage = buildMarginLeakage(inputs);
  const invoiceAudit = buildInvoiceAudit(inputs);
  const customerCommercial = buildCustomerCommercial(inputs);
  const contractHandoff = buildContractHandoffControl(inputs);
  const commercialScore = clamp(
    Math.round(
      100 -
        Math.min(22, quoteToCash.quoteRiskCount * 3) -
        Math.min(22, pricingDiscipline.pricingRiskCount * 3) -
        Math.min(18, invoiceAudit.invoiceRiskCount * 2) -
        Math.min(14, marginLeakage.marginLeakageCount * 4) -
        Math.min(16, contractHandoff.contractRiskCount * 3) -
        Math.min(12, customerCommercial.customerRiskCount * 2),
    ),
  );
  const responsePlan = {
    status: commercialScore < 70 ? "COMMERCIAL_CONTROL_REVIEW_REQUIRED" : commercialScore < 85 ? "REVENUE_OWNER_REVIEW" : "MONITOR",
    owners: ["Sales", "Revenue operations", "Pricing", "Finance", "Customer success", "Legal/contracts"],
    steps: [
      "Review quote-to-cash gaps, expiring quotes, and unreviewed sales orders.",
      "Validate pricing snapshot assumptions, quote evidence, and commercial terms.",
      "Review invoice audit, variance, dispute, accrual, and margin leakage pressure.",
      "Approve customer-safe language before external communication.",
      "Queue separate downstream work before changing quotes, prices, invoices, contracts, orders, or customer messages.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep quotes, quote lines, pricing snapshots, tariffs, RFQs, invoice intakes, accounting approvals, contracts, sales orders, opportunity stages, customer promises, and customer communications unchanged until downstream approval.",
      "If review is rejected, preserve packet evidence and action queue notes without executing commercial changes.",
      "Create a fresh packet when quote, pricing, invoice, finance, customer, or contract evidence changes materially.",
      "Use action queue approval and object-specific workflows for any revenue, pricing, finance, contract, or customer-facing execution.",
    ],
  };
  const currency = currencyOf(inputs);
  const leadershipSummary = [
    `Sprint 6 Commercial & Revenue Control score is ${commercialScore}/100 with ${quoteToCash.quoteRiskCount} quote-to-cash risk${quoteToCash.quoteRiskCount === 1 ? "" : "s"}, ${pricingDiscipline.pricingRiskCount} pricing risk${pricingDiscipline.pricingRiskCount === 1 ? "" : "s"}, and ${invoiceAudit.invoiceRiskCount} invoice/audit risk${invoiceAudit.invoiceRiskCount === 1 ? "" : "s"}.`,
    `Pipeline value is ${currency} ${quoteToCash.pipelineValue.toLocaleString("en-US")} and open sales order value is ${currency} ${quoteToCash.salesOrderValue.toLocaleString("en-US")}; finance packets show ${currency} ${marginLeakage.disputeAmount.toLocaleString("en-US")} dispute exposure and ${currency} ${marginLeakage.accrualAmount.toLocaleString("en-US")} accrual exposure.`,
    `${marginLeakage.marginLeakageCount} margin leakage packet${marginLeakage.marginLeakageCount === 1 ? "" : "s"}, ${contractHandoff.contractRiskCount} contract handoff risk${contractHandoff.contractRiskCount === 1 ? "" : "s"}, and ${customerCommercial.customerRiskCount} customer-commercial risk${customerCommercial.customerRiskCount === 1 ? "" : "s"} require review.`,
    "Packet creation does not mutate quotes, prices, pricing snapshots, tariffs, RFQs, invoices, accounting approvals, contracts, sales orders, opportunity stages, customer promises, or customer communications.",
  ].join("\n\n");
  return {
    title: `Sprint 6 Commercial & Revenue Control packet: score ${commercialScore}/100`,
    status: "DRAFT",
    commercialScore,
    sourceSummary,
    quoteToCash,
    pricingDiscipline,
    marginLeakage,
    invoiceAudit,
    customerCommercial,
    contractHandoff,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

export type CustomerSuccessInputs = {
  customerBriefs: Array<{
    id: string;
    title: string;
    status: string;
    serviceScore: number;
    replyDraft: string;
    approvedReply: string | null;
  }>;
  quotes: Array<{ id: string; title: string; status: string; validUntil: Date | null }>;
  opportunities: Array<{ id: string; name: string; stage: string; closeDate: Date | null }>;
  salesOrders: Array<{ id: string; soNumber: string; status: string; requestedDeliveryDate: Date | null }>;
  shipments: Array<{
    id: string;
    shipmentNo: string | null;
    status: string;
    customerCrmAccountId: string | null;
    expectedReceiveAt: Date | null;
    shippedAt: Date;
    receivedAt: Date | null;
  }>;
  customerCtExceptions: Array<{
    id: string;
    severity: string;
    shipmentId: string;
    shipmentNo: string | null;
    customerAccountLabel: string | null;
  }>;
  invoiceIntakes: Array<{ id: string; rollupOutcome: string }>;
  financePackets: Array<{ id: string; title: string; disputeAmount: number }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function startOfUtcDay(date = new Date()) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function buildBriefSignals(inputs: CustomerSuccessInputs) {
  const weakHealth = inputs.customerBriefs.filter((brief) => brief.serviceScore < 60);
  const briefRiskCount = weakHealth.length;
  return {
    briefRiskCount,
    weakBriefs: weakHealth.slice(0, 18).map((brief) => ({
      briefId: brief.id,
      title: brief.title,
      serviceScore: brief.serviceScore,
      status: brief.status,
    })),
    guardrail:
      "Customer brief snapshots stay CRM-safe and advisory — they do not change CRM accounts, opportunities, or posting rules automatically.",
  };
}

export function buildPromiseExecution(inputs: CustomerSuccessInputs) {
  const today = startOfUtcDay();
  const lateOrders = inputs.salesOrders.filter(
    (order) => order.status === "OPEN" && order.requestedDeliveryDate != null && order.requestedDeliveryDate < today,
  );
  const terminal = new Set(["DELIVERED", "RECEIVED"]);
  const lateShipments = inputs.shipments.filter((shipment) => {
    if (!shipment.customerCrmAccountId) return false;
    if (terminal.has(shipment.status)) return false;
    if (shipment.expectedReceiveAt && shipment.expectedReceiveAt.getTime() < Date.now()) return true;
    return false;
  });
  const promiseRiskCount = lateOrders.length + lateShipments.length;
  return {
    promiseRiskCount,
    lateOrders: lateOrders.slice(0, 18).map((order) => ({
      salesOrderId: order.id,
      soNumber: order.soNumber,
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
    })),
    lateShipments: lateShipments.slice(0, 18).map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      expectedReceiveAt: shipment.expectedReceiveAt?.toISOString() ?? null,
      status: shipment.status,
    })),
    guardrail:
      "Promise overlays compare requested delivery and ETA evidence — they do not reschedule shipments, edit SO lines, or send customer updates automatically.",
  };
}

export function buildCrmPipeline(inputs: CustomerSuccessInputs) {
  const now = Date.now();
  const horizonMs = 14 * 86_400_000;
  const staleStages = new Set(["LOST", "WON_LIVE"]);
  const staleOpps = inputs.opportunities.filter(
    (opportunity) =>
      opportunity.closeDate != null && opportunity.closeDate.getTime() < now && !staleStages.has(opportunity.stage),
  );
  const quoteRisks = inputs.quotes.filter((quote) => {
    if (quote.status !== "SENT" || !quote.validUntil) return false;
    const vu = quote.validUntil.getTime();
    return vu < now + horizonMs;
  });
  const pipelineRiskCount = staleOpps.length + quoteRisks.length;
  return {
    pipelineRiskCount,
    expiringOrStaleQuotes: quoteRisks.slice(0, 18).map((quote) => ({
      quoteId: quote.id,
      title: quote.title,
      validUntil: quote.validUntil?.toISOString() ?? null,
      status: quote.status,
    })),
    staleOpportunities: staleOpps.slice(0, 18).map((opportunity) => ({
      opportunityId: opportunity.id,
      name: opportunity.name,
      stage: opportunity.stage,
      closeDate: opportunity.closeDate?.toISOString() ?? null,
    })),
    guardrail:
      "Pipeline overlays quote validity and opportunity close dates — they do not edit CRM stages, renew quotes, or advance opportunities automatically.",
  };
}

export function buildExceptionExposure(inputs: CustomerSuccessInputs) {
  const exceptionExposureCount = inputs.customerCtExceptions.length;
  return {
    exceptionExposureCount,
    customerFacingExceptions: inputs.customerCtExceptions.slice(0, 18).map((exception) => ({
      exceptionId: exception.id,
      severity: exception.severity,
      shipmentNo: exception.shipmentNo,
      customerAccountLabel: exception.customerAccountLabel,
    })),
    guardrail:
      "Customer-linked Control Tower exceptions are summarized only — recovery messaging and CT mutations remain human-approved.",
  };
}

export function buildDisputeFinance(inputs: CustomerSuccessInputs) {
  const failedInvoices = inputs.invoiceIntakes.filter((invoice) => invoice.rollupOutcome === "FAIL");
  const disputeFinancePackets = inputs.financePackets.filter((packet) => packet.disputeAmount > 0);
  const disputeFinanceRiskCount = failedInvoices.length + disputeFinancePackets.length;
  return {
    disputeFinanceRiskCount,
    failingInvoiceIntakes: failedInvoices.slice(0, 14).map((invoice) => ({ intakeId: invoice.id, rollupOutcome: invoice.rollupOutcome })),
    financeDisputeSignals: disputeFinancePackets.slice(0, 14).map((packet) => ({
      packetId: packet.id,
      title: packet.title,
      disputeAmount: packet.disputeAmount,
    })),
    guardrail:
      "Dispute and invoice cues remain internal until finance approves — no settlements, accounting exports, or carrier disputes are initiated here.",
  };
}

export function buildReplyGovernance(inputs: CustomerSuccessInputs) {
  const gaps = inputs.customerBriefs.filter((brief) => {
    const draft = brief.replyDraft.trim();
    const approved = brief.approvedReply?.trim() ?? "";
    return draft.length > 12 && approved.length < 8;
  });
  const governanceGapCount = gaps.length;
  return {
    governanceGapCount,
    draftWithoutApproval: gaps.slice(0, 16).map((brief) => ({
      briefId: brief.id,
      title: brief.title,
      serviceScore: brief.serviceScore,
    })),
    guardrail:
      "Governed replies stay drafts until an approver publishes — assistant packets never send emails or CRM timeline posts automatically.",
  };
}

export function buildCustomerSuccessPacket(inputs: CustomerSuccessInputs) {
  const briefSignals = buildBriefSignals(inputs);
  const promiseExecution = buildPromiseExecution(inputs);
  const crmPipeline = buildCrmPipeline(inputs);
  const exceptionExposure = buildExceptionExposure(inputs);
  const disputeFinance = buildDisputeFinance(inputs);
  const replyGovernance = buildReplyGovernance(inputs);

  const briefRiskCount = briefSignals.briefRiskCount;
  const promiseRiskCount = promiseExecution.promiseRiskCount;
  const pipelineRiskCount = crmPipeline.pipelineRiskCount;
  const exceptionExposureCount = exceptionExposure.exceptionExposureCount;
  const disputeFinanceRiskCount = disputeFinance.disputeFinanceRiskCount;
  const governanceGapCount = replyGovernance.governanceGapCount;

  const accountScore = clamp(
    Math.round(
      100 -
        Math.min(22, briefRiskCount * 4) -
        Math.min(26, promiseRiskCount * 3) -
        Math.min(18, pipelineRiskCount * 4) -
        Math.min(16, exceptionExposureCount * 2) -
        Math.min(18, disputeFinanceRiskCount * 3) -
        Math.min(14, governanceGapCount * 4),
    ),
  );

  const sourceSummary = {
    customerBriefs: inputs.customerBriefs.length,
    quotes: inputs.quotes.length,
    opportunities: inputs.opportunities.length,
    salesOrders: inputs.salesOrders.length,
    shipmentsWithCustomers: inputs.shipments.filter((row) => Boolean(row.customerCrmAccountId)).length,
    customerFacingCtExceptions: inputs.customerCtExceptions.length,
    invoiceIntakes: inputs.invoiceIntakes.length,
    financePacketsSampled: inputs.financePackets.length,
    guardrail:
      "Sprint 18 customer-success packets compose CRM briefs, orders, shipments, pipeline evidence, customer-linked exceptions, and finance/dispute cues without posting CRM updates, sending customer replies, or changing commercial terms automatically.",
  };

  const responsePlan = {
    status:
      accountScore < 66 ? "CUSTOMER_SUCCESS_REVIEW_REQUIRED" : accountScore < 82 ? "CS_OPS_DESK_REVIEW" : "MONITOR",
    owners: ["Customer success", "Commercial ops", "CRM ops", "Order desk", "Control Tower", "Finance disputes"],
    steps: [
      "Confirm promise dates against authoritative orders and shipment milestones before customer-facing narratives.",
      "Separate CRM pipeline hygiene from logistics exceptions — avoid blaming carriers for stale opportunity hygiene.",
      "Route dispute cues through invoice audit and finance workflows before any external disputes.",
      "Treat assistant reply drafts as unapproved until published through governed channels.",
    ],
    guardrail: "Customer success plans are advisory until operators execute approved CRM and communications workflows.",
  };

  const rollbackPlan = {
    steps: [
      "Rejecting a packet does not erase CRM brief history, audit trails, or shipment telemetry.",
      "Open a fresh packet after major booking changes, renewals, or dispute closures.",
      "Keep manual approvals on outgoing replies even when governance gaps show zero.",
    ],
    guardrail: "Rollback keeps advisory narratives reversible — operational records are never auto-reverted by this sprint.",
  };

  const leadershipSummary = [
    `Sprint 18 Customer Success & Account Intelligence score is ${accountScore}/100 with ${briefRiskCount} brief health cue(s), ${promiseRiskCount} promise execution cue(s), ${pipelineRiskCount} CRM pipeline cue(s), ${exceptionExposureCount} customer-facing exception overlay(s), ${disputeFinanceRiskCount} dispute/finance pressure cue(s), and ${governanceGapCount} governed reply gap(s).`,
    disputeFinance.guardrail,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 18 Customer Success & Account Intelligence: score ${accountScore}/100`,
    status: "DRAFT" as const,
    accountScore,
    briefRiskCount,
    promiseRiskCount,
    pipelineRiskCount,
    exceptionExposureCount,
    disputeFinanceRiskCount,
    governanceGapCount,
    sourceSummary,
    briefSignals,
    promiseExecution,
    crmPipeline,
    exceptionExposure,
    disputeFinance,
    replyGovernance,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

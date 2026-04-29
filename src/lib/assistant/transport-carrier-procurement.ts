export type TransportCarrierProcurementInputs = {
  quoteRequests: Array<{
    id: string;
    title: string;
    status: string;
    quotesDueAt: string | null;
    transportMode: string;
    originLabel: string;
    destinationLabel: string;
    responseCount: number;
    submittedQuoteCount: number;
  }>;
  tariffContractHeaders: Array<{
    id: string;
    title: string;
    status: string;
    transportMode: string;
    pendingVersionCount: number;
    rejectedVersionCount: number;
    versionCount: number;
  }>;
  bookingPricingSnapshots: Array<{
    id: string;
    sourceType: string;
    sourceSummary: string | null;
    currency: string;
    totalEstimatedCost: number;
    frozenAt: string;
    basisSide: string | null;
    incoterm: string | null;
    shipmentBookingId: string | null;
  }>;
  shipments: Array<{
    id: string;
    shipmentNo: string | null;
    status: string;
    carrierLabel: string | null;
    transportMode: string | null;
    updatedAt: string;
    bookingStatus: string | null;
    bookingSlaDueAt: string | null;
    originCode: string | null;
    destinationCode: string | null;
    openExceptionCount: number;
  }>;
  transportationProcurementPlans: Array<{
    id: string;
    title: string;
    status: string;
    allocationScore: number;
    recommendedCarrier: string | null;
    quoteRequestId: string | null;
  }>;
  invoiceIntakes: Array<{
    id: string;
    externalInvoiceNo: string | null;
    vendorLabel: string | null;
    status: string;
    currency: string;
    rollupOutcome: string;
    redLineCount: number;
    amberLineCount: number;
    approvedForAccounting: boolean;
  }>;
  ctExceptionsOpen: Array<{ id: string; severity: string; shipmentId: string; recoveryState: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildRfqTariffSignals(inputs: TransportCarrierProcurementInputs) {
  const now = Date.now();
  const staleOpen = inputs.quoteRequests.filter(
    (rfq) => rfq.status === "OPEN" && rfq.quotesDueAt != null && Date.parse(rfq.quotesDueAt) < now,
  );
  const openWithoutQuotes = inputs.quoteRequests.filter((rfq) => rfq.status === "OPEN" && rfq.submittedQuoteCount === 0);
  const draftRfqs = inputs.quoteRequests.filter((rfq) => rfq.status === "DRAFT");
  const rfqRiskCount = staleOpen.length + openWithoutQuotes.length + Math.min(draftRfqs.length, 8);
  return {
    rfqRiskCount,
    staleOpenRfqs: staleOpen.slice(0, 12).map((rfq) => ({
      quoteRequestId: rfq.id,
      title: rfq.title,
      originDestination: `${rfq.originLabel.slice(0, 48)} → ${rfq.destinationLabel.slice(0, 48)}`,
      quotesDueAt: rfq.quotesDueAt,
    })),
    openWithoutQuotes: openWithoutQuotes.slice(0, 12).map((rfq) => ({
      quoteRequestId: rfq.id,
      title: rfq.title,
      transportMode: rfq.transportMode,
    })),
    draftRfqs: draftRfqs.slice(0, 8).map((rfq) => ({ quoteRequestId: rfq.id, title: rfq.title })),
    guardrail: "RFQ intelligence is advisory; it does not award lanes, invite carriers, send bids, change RFQ status, or mutate quote responses automatically.",
  };
}

export function buildTariffBookingEvidence(inputs: TransportCarrierProcurementInputs) {
  const snapshotGaps = inputs.bookingPricingSnapshots.filter(
    (snap) => snap.totalEstimatedCost <= 0 || !snap.sourceSummary || !snap.basisSide || !snap.incoterm,
  );
  const tariffRiskRows = inputs.tariffContractHeaders.filter((header) => header.pendingVersionCount > 0 || header.rejectedVersionCount > 0);
  const tariffBookingRiskCount = snapshotGaps.length + tariffRiskRows.reduce((sum, row) => sum + row.pendingVersionCount + row.rejectedVersionCount, 0);
  return {
    tariffBookingRiskCount,
    snapshotCount: inputs.bookingPricingSnapshots.length,
    snapshotGaps: snapshotGaps.slice(0, 12).map((snap) => ({
      snapshotId: snap.id,
      sourceType: snap.sourceType,
      missing: [
        snap.totalEstimatedCost <= 0 ? "estimated cost" : null,
        !snap.sourceSummary ? "source summary" : null,
        !snap.basisSide ? "basis side" : null,
        !snap.incoterm ? "incoterm" : null,
      ].filter((item): item is string => Boolean(item)),
    })),
    tariffVersionRisk: tariffRiskRows.slice(0, 12).map((header) => ({
      contractHeaderId: header.id,
      title: header.title,
      transportMode: header.transportMode,
      pendingVersions: header.pendingVersionCount,
      rejectedVersions: header.rejectedVersionCount,
    })),
    guardrail: "Tariff and booking snapshot review does not publish rates, approve tariff versions, refreeze snapshots, or bind carriers automatically.",
  };
}

export function buildLaneExecution(inputs: TransportCarrierProcurementInputs) {
  const bookingSlaRisk = inputs.shipments.filter(
    (shipment) =>
      shipment.bookingSlaDueAt != null &&
      Date.parse(shipment.bookingSlaDueAt) < Date.now() &&
      (shipment.bookingStatus === "DRAFT" || shipment.bookingStatus === "SENT"),
  );
  const stuckBookingDraft = inputs.shipments.filter((shipment) => shipment.status === "BOOKING_DRAFT");
  const laneRiskCount =
    inputs.ctExceptionsOpen.length +
    bookingSlaRisk.length +
    Math.min(stuckBookingDraft.length, 25);
  return {
    laneRiskCount,
    openCtExceptions: inputs.ctExceptionsOpen.slice(0, 15).map((exception) => ({
      exceptionId: exception.id,
      severity: exception.severity,
      shipmentId: exception.shipmentId,
      recoveryState: exception.recoveryState,
    })),
    bookingSlaBreaches: bookingSlaRisk.slice(0, 12).map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      bookingStatus: shipment.bookingStatus,
      bookingSlaDueAt: shipment.bookingSlaDueAt,
    })),
    stuckBookingDrafts: stuckBookingDraft.slice(0, 12).map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      carrierLabel: shipment.carrierLabel,
      updatedAt: shipment.updatedAt,
    })),
    guardrail: "Lane execution signals do not confirm bookings, cancel shipments, message carriers, resolve exceptions, or change milestones automatically.",
  };
}

export function buildCarrierPerformance(inputs: TransportCarrierProcurementInputs) {
  const weights = new Map<string, { shipments: number; exceptions: number }>();
  for (const shipment of inputs.shipments) {
    const key = shipment.carrierLabel?.trim() || "Unknown carrier";
    const row = weights.get(key) ?? { shipments: 0, exceptions: 0 };
    row.shipments += 1;
    weights.set(key, row);
  }
  for (const exception of inputs.ctExceptionsOpen) {
    const shipment = inputs.shipments.find((row) => row.id === exception.shipmentId);
    const key = shipment?.carrierLabel?.trim() ?? "Unknown carrier";
    const row = weights.get(key) ?? { shipments: 0, exceptions: 0 };
    row.exceptions += 1;
    weights.set(key, row);
  }
  const carrierRows = [...weights.entries()]
    .map(([carrierLabel, stats]) => ({
      carrierLabel,
      shipmentCount: stats.shipments,
      openExceptionExposure: stats.exceptions,
      exceptionRate: stats.shipments ? roundMoney(stats.exceptions / stats.shipments) : stats.exceptions,
    }))
    .sort((a, b) => b.openExceptionExposure - a.openExceptionExposure)
    .slice(0, 12);
  const riskyCarriers = carrierRows.filter((row) => row.openExceptionExposure > 0 && row.exceptionRate >= 0.25);
  return {
    carrierScorecardRows: carrierRows,
    carrierRiskWatchCount: riskyCarriers.length,
    guardrail: "Carrier scorecards are heuristic overlays; they do not retender carriers, adjust allocations, or send scorecards externally automatically.",
  };
}

export function buildTenderAllocation(inputs: TransportCarrierProcurementInputs) {
  const lowScorePlans = inputs.transportationProcurementPlans.filter((plan) => plan.allocationScore < 70 || plan.status === "DRAFT");
  const spreadRfqs = inputs.quoteRequests.filter((rfq) => rfq.submittedQuoteCount > 1);
  const tenderRiskCount = lowScorePlans.length + spreadRfqs.length;
  return {
    tenderRiskCount,
    procurementPlans: inputs.transportationProcurementPlans.slice(0, 15).map((plan) => ({
      planId: plan.id,
      title: plan.title,
      status: plan.status,
      allocationScore: plan.allocationScore,
      recommendedCarrier: plan.recommendedCarrier,
      quoteRequestId: plan.quoteRequestId,
    })),
    multiBidRfqs: spreadRfqs.slice(0, 10).map((rfq) => ({
      quoteRequestId: rfq.id,
      title: rfq.title,
      submittedQuotes: rfq.submittedQuoteCount,
    })),
    guardrail: "Tender recommendations stay internal; they do not award volumes, sign carrier agreements, or activate procurement plans automatically.",
  };
}

export function buildInvoiceFeedback(inputs: TransportCarrierProcurementInputs) {
  const riskyIntakes = inputs.invoiceIntakes.filter(
    (invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0 || invoice.amberLineCount > 0 || !invoice.approvedForAccounting,
  );
  const freightHints = /freight|carrier|logistics|transport|forwarder|demurrage|fuel/i;
  const carrierFacing = riskyIntakes.filter(
    (invoice) => freightHints.test(`${invoice.vendorLabel ?? ""} ${invoice.externalInvoiceNo ?? ""}`),
  );
  return {
    invoiceVarianceCount: riskyIntakes.length,
    invoiceCount: inputs.invoiceIntakes.length,
    carrierLinkedVarianceCount: carrierFacing.length,
    riskyIntakes: riskyIntakes.slice(0, 14).map((invoice) => ({
      intakeId: invoice.id,
      externalInvoiceNo: invoice.externalInvoiceNo,
      vendorLabel: invoice.vendorLabel,
      rollupOutcome: invoice.rollupOutcome,
      redLineCount: invoice.redLineCount,
      amberLineCount: invoice.amberLineCount,
      approvedForAccounting: invoice.approvedForAccounting,
    })),
    guardrail: "Invoice feedback does not approve settlements, file disputes, trigger carrier chargebacks, or change accounting status automatically.",
  };
}

export function buildExecutionRisk(inputs: TransportCarrierProcurementInputs) {
  const fiveDaysAgo = Date.now() - 5 * 86_400_000;
  const agingBookingDraft = inputs.shipments.filter(
    (shipment) => shipment.status === "BOOKING_DRAFT" && Date.parse(shipment.updatedAt) < fiveDaysAgo,
  );
  const pendingTransportActions = inputs.actionQueue.filter(
    (item) =>
      item.status === "PENDING" &&
      /transport|carrier|freight|booking|rfq|tariff|shipment|lane|tender|invoice_audit/i.test(`${item.actionKind} ${item.objectType ?? ""}`),
  );
  const executionRiskCount = agingBookingDraft.length + pendingTransportActions.length;
  return {
    executionRiskCount,
    agingBookingDraft: agingBookingDraft.slice(0, 12).map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      carrierLabel: shipment.carrierLabel,
      updatedAt: shipment.updatedAt,
    })),
    pendingTransportActions: pendingTransportActions.slice(0, 12).map((item) => ({
      actionQueueItemId: item.id,
      actionKind: item.actionKind,
      priority: item.priority,
    })),
    guardrail: "Execution risk alerts do not advance bookings, complete tasks, release billing, or trigger integrations automatically.",
  };
}

export function buildTransportCarrierProcurementPacket(inputs: TransportCarrierProcurementInputs) {
  const sourceSummary = {
    quoteRequests: inputs.quoteRequests.length,
    tariffContractHeaders: inputs.tariffContractHeaders.length,
    bookingPricingSnapshots: inputs.bookingPricingSnapshots.length,
    shipments: inputs.shipments.length,
    transportationProcurementPlans: inputs.transportationProcurementPlans.length,
    invoiceIntakes: inputs.invoiceIntakes.length,
    ctExceptionsOpen: inputs.ctExceptionsOpen.length,
    actionQueueItems: inputs.actionQueue.length,
    guardrail: "Sprint 16 packets consolidate RFQ, tariff, booking snapshot, shipment/lane, procurement plan, invoice audit, and queue signals without mutating carriers, awards, bookings, rates, settlements, or logistics records silently.",
  };
  const rfqTariff = buildRfqTariffSignals(inputs);
  const bookingPricing = buildTariffBookingEvidence(inputs);
  const laneExecution = buildLaneExecution(inputs);
  const carrierPerformance = buildCarrierPerformance(inputs);
  const tenderAllocation = buildTenderAllocation(inputs);
  const invoiceFeedback = buildInvoiceFeedback(inputs);
  const executionRisk = buildExecutionRisk(inputs);

  const procurementScore = clamp(
    Math.round(
      100 -
        Math.min(22, rfqTariff.rfqRiskCount * 3) -
        Math.min(22, bookingPricing.tariffBookingRiskCount * 2) -
        Math.min(18, laneExecution.laneRiskCount * 2) -
        Math.min(14, tenderAllocation.tenderRiskCount * 3) -
        Math.min(16, invoiceFeedback.invoiceVarianceCount * 2) -
        Math.min(14, executionRisk.executionRiskCount * 2) -
        Math.min(10, carrierPerformance.carrierRiskWatchCount * 5),
    ),
  );

  const responsePlan = {
    status:
      procurementScore < 68
        ? "TRANSPORT_PROCUREMENT_REVIEW_REQUIRED"
        : procurementScore < 82
          ? "CARRIER_DESK_REVIEW"
          : "MONITOR",
    owners: ["Transport procurement", "Carrier management", "Tariff desk", "Invoice audit", "Control Tower"],
    steps: [
      "Validate RFQ timelines, carrier responses, and procurement plan scores before awarding lanes.",
      "Cross-check tariff/booking snapshots against lane execution reality and exception backlog.",
      "Review invoice variance vs frozen snapshots before settlements or disputes.",
      "Confirm tender drafts and allocation narratives with finance and ops stakeholders.",
      "Route execution-only changes through approved logistics workflows — never silent mutation.",
    ],
    guardrail: responsePlanStepsGuardrail(),
  };

  const rollbackPlan = {
    steps: [
      "Preserve RFQs, tariff versions, booking snapshots, shipments, procurement plans, invoices, settlements, and carrier contracts unchanged until explicit approvals.",
      "If review rejects recommendations, retain packet evidence and queue notes without executing logistics or finance mutations.",
      "Recreate packets when carrier awards, tariffs, bookings, exceptions, or invoices shift materially.",
    ],
    guardrail: rollbackGuardrail(),
  };

  const currency = inputs.bookingPricingSnapshots[0]?.currency ?? inputs.invoiceIntakes[0]?.currency ?? "USD";
  const leadershipSummary = [
    `Sprint 16 Transportation & Carrier Procurement score is ${procurementScore}/100 across RFQ (${rfqTariff.rfqRiskCount} risk signals), tariff/booking (${bookingPricing.tariffBookingRiskCount}), lane (${laneExecution.laneRiskCount}), tender (${tenderAllocation.tenderRiskCount}), invoice (${invoiceFeedback.invoiceVarianceCount}), and execution (${executionRisk.executionRiskCount}) dimensions.`,
    `${inputs.quoteRequests.length} RFQ workspace row(s), ${inputs.bookingPricingSnapshots.length} booking pricing snapshot(s), and ${inputs.transportationProcurementPlans.length} transportation procurement plan(s) inform this packet using ${currency} context where applicable.`,
    `${inputs.ctExceptionsOpen.length} open shipment exception(s) and ${carrierPerformance.carrierRiskWatchCount} carrier risk watch lane(s) require human confirmation before operational changes.`,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 16 Transportation & Carrier Procurement packet: score ${procurementScore}/100`,
    status: "DRAFT" as const,
    procurementScore,
    rfqRiskCount: rfqTariff.rfqRiskCount,
    tariffBookingRiskCount: bookingPricing.tariffBookingRiskCount,
    laneRiskCount: laneExecution.laneRiskCount,
    tenderRiskCount: tenderAllocation.tenderRiskCount,
    invoiceVarianceCount: invoiceFeedback.invoiceVarianceCount,
    executionRiskCount: executionRisk.executionRiskCount,
    sourceSummary,
    rfqTariff,
    bookingPricing,
    laneExecution,
    carrierPerformance,
    tenderAllocation,
    invoiceFeedback,
    executionRisk,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

function responsePlanStepsGuardrail() {
  return "Procurement response plans are internal guidance only; carriers, tenders, bookings, invoices, and settlements remain approval-gated.";
}

function rollbackGuardrail() {
  return "Rollback preserves carriers, tariffs, bookings, procurement plans, shipments, invoices, and integrations — production logistics data is never auto-reverted.";
}

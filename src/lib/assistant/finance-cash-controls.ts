export type FinanceCashControlInputs = {
  financePackets: Array<{ id: string; title: string; status: string; riskScore: number; currency: string; totalVariance: number; disputeAmount: number; accrualAmount: number }>;
  revenuePackets: Array<{ id: string; title: string; status: string; revenueScore: number; quoteCount: number; pricingRiskCount: number; feasibilityRiskCount: number }>;
  commercialPackets: Array<{ id: string; title: string; status: string; commercialScore: number; marginLeakageCount: number; invoiceRiskCount: number; quoteRiskCount: number; contractRiskCount: number }>;
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
    financeHandoffStatus: string;
    accountingApprovedAt: string | null;
  }>;
  financialSnapshots: Array<{ id: string; shipmentId: string; shipmentNo: string | null; currency: string; internalRevenue: number | null; internalCost: number | null; internalNet: number | null; internalMarginPct: number | null; asOf: string }>;
  shipmentCostLines: Array<{ id: string; shipmentId: string; shipmentNo: string | null; vendorName: string | null; currency: string; amount: number; status: string; occurredAt: string }>;
  wmsInvoiceRuns: Array<{ id: string; runNo: string; status: string; totalAmount: number; currency: string; periodFrom: string; periodTo: string; lineCount: number }>;
  quotes: Array<{ id: string; title: string; status: string; accountName: string; subtotal: number; currency: string; validUntil: string | null; daysUntilExpiry: number | null }>;
  salesOrders: Array<{ id: string; soNumber: string; status: string; customerName: string; currency: string; totalValue: number; lineCount: number }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function currencyOf(inputs: FinanceCashControlInputs) {
  return inputs.invoiceIntakes[0]?.currency ?? inputs.financialSnapshots[0]?.currency ?? inputs.salesOrders[0]?.currency ?? inputs.quotes[0]?.currency ?? inputs.wmsInvoiceRuns[0]?.currency ?? inputs.financePackets[0]?.currency ?? "USD";
}

export function buildCashPosture(inputs: FinanceCashControlInputs) {
  const currency = currencyOf(inputs);
  const openSalesOrderValue = roundMoney(inputs.salesOrders.filter((order) => order.status !== "CLOSED").reduce((sum, order) => sum + order.totalValue, 0));
  const openQuoteValue = roundMoney(inputs.quotes.filter((quote) => quote.status !== "WON" && quote.status !== "LOST").reduce((sum, quote) => sum + quote.subtotal, 0));
  const pendingBilling = roundMoney(inputs.wmsInvoiceRuns.filter((run) => run.status !== "POSTED" && run.status !== "VOID").reduce((sum, run) => sum + run.totalAmount, 0));
  const unapprovedAccrual = roundMoney(inputs.financePackets.reduce((sum, packet) => sum + packet.accrualAmount, 0));
  const cashExposureAmount = roundMoney(openSalesOrderValue + pendingBilling + unapprovedAccrual);
  const cashRisks = [
    ...(openSalesOrderValue > 0 && inputs.salesOrders.some((order) => order.lineCount === 0) ? [{ type: "ORDER_LINE_GAP", severity: "MEDIUM", detail: "Open sales orders include missing line detail." }] : []),
    ...(pendingBilling > 0 ? [{ type: "BILLING_NOT_POSTED", severity: "MEDIUM", detail: `${currency} ${pendingBilling.toLocaleString("en-US")} WMS billing remains unposted.` }] : []),
    ...(unapprovedAccrual > 0 ? [{ type: "UNAPPROVED_ACCRUAL", severity: "HIGH", detail: `${currency} ${unapprovedAccrual.toLocaleString("en-US")} accrual exposure is not cleared.` }] : []),
  ];
  return {
    currency,
    openSalesOrderValue,
    openQuoteValue,
    pendingBilling,
    unapprovedAccrual,
    cashExposureAmount,
    cashRiskCount: cashRisks.length,
    cashRisks,
    guardrail: "Cash posture is review-only; it does not post invoices, update orders, recognize revenue, create accruals, or change cash forecasts automatically.",
  };
}

export function buildReceivablesControl(inputs: FinanceCashControlInputs) {
  const expiringQuotes = inputs.quotes.filter((quote) => quote.daysUntilExpiry != null && quote.daysUntilExpiry <= 14);
  const unbilledOrders = inputs.salesOrders.filter((order) => order.status !== "CLOSED" && order.totalValue > 0);
  const riskyRevenue = inputs.revenuePackets.filter((packet) => packet.revenueScore < 75 || packet.pricingRiskCount > 0 || packet.feasibilityRiskCount > 0);
  const receivableRiskAmount = roundMoney(unbilledOrders.reduce((sum, order) => sum + order.totalValue, 0) + expiringQuotes.reduce((sum, quote) => sum + quote.subtotal, 0));
  return {
    receivableRiskAmount,
    unbilledOrderCount: unbilledOrders.length,
    expiringQuoteCount: expiringQuotes.length,
    riskyRevenuePacketCount: riskyRevenue.length,
    expiringQuotes: expiringQuotes.slice(0, 10).map((quote) => ({ quoteId: quote.id, title: quote.title, accountName: quote.accountName, subtotal: quote.subtotal, currency: quote.currency, daysUntilExpiry: quote.daysUntilExpiry })),
    unbilledOrders: unbilledOrders.slice(0, 10).map((order) => ({ salesOrderId: order.id, soNumber: order.soNumber, customerName: order.customerName, totalValue: order.totalValue, currency: order.currency })),
    guardrail: "Receivables control does not invoice customers, change quote status, alter sales orders, collect cash, apply credits, or send customer communications automatically.",
  };
}

export function buildPayablesControl(inputs: FinanceCashControlInputs) {
  const riskyInvoices = inputs.invoiceIntakes.filter((invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0 || invoice.amberLineCount > 0 || !invoice.approvedForAccounting);
  const payableRiskAmount = roundMoney(inputs.financePackets.reduce((sum, packet) => sum + Math.abs(packet.totalVariance) + packet.disputeAmount + packet.accrualAmount, 0));
  const openVendorCosts = roundMoney(inputs.shipmentCostLines.filter((line) => line.status !== "APPROVED" && line.status !== "POSTED").reduce((sum, line) => sum + line.amount, 0));
  return {
    payableRiskAmount,
    openVendorCostAmount: openVendorCosts,
    riskyInvoiceCount: riskyInvoices.length,
    disputedFinancePacketCount: inputs.financePackets.filter((packet) => packet.disputeAmount > 0 || packet.riskScore >= 50).length,
    riskyInvoices: riskyInvoices.slice(0, 12).map((invoice) => ({ intakeId: invoice.id, externalInvoiceNo: invoice.externalInvoiceNo, vendorLabel: invoice.vendorLabel, rollupOutcome: invoice.rollupOutcome, redLineCount: invoice.redLineCount, amberLineCount: invoice.amberLineCount, approvedForAccounting: invoice.approvedForAccounting })),
    guardrail: "Payables control does not approve invoices, pay vendors, submit disputes, change cost lines, create journal entries, or export accounting files automatically.",
  };
}

export function buildAccountingHandoff(inputs: FinanceCashControlInputs) {
  const blockers = inputs.invoiceIntakes
    .filter((invoice) => !invoice.approvedForAccounting || invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0 || invoice.financeHandoffStatus !== "APPROVED")
    .map((invoice) => ({
      intakeId: invoice.id,
      externalInvoiceNo: invoice.externalInvoiceNo,
      vendorLabel: invoice.vendorLabel,
      blockers: [
        !invoice.approvedForAccounting ? "not accounting-approved" : null,
        invoice.rollupOutcome === "FAIL" ? "audit failed" : null,
        invoice.redLineCount > 0 ? `${invoice.redLineCount} red line(s)` : null,
        invoice.financeHandoffStatus !== "APPROVED" ? `handoff ${invoice.financeHandoffStatus}` : null,
      ].filter((item): item is string => Boolean(item)),
    }));
  const pendingFinanceActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /accounting|finance|invoice|handoff|journal|close/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  return {
    accountingBlockerCount: blockers.length + pendingFinanceActions.length,
    approvedForAccountingCount: inputs.invoiceIntakes.filter((invoice) => invoice.approvedForAccounting).length,
    handoffApprovedCount: inputs.invoiceIntakes.filter((invoice) => invoice.financeHandoffStatus === "APPROVED").length,
    blockers: blockers.slice(0, 12),
    pendingFinanceActions: pendingFinanceActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Accounting handoff output does not mark approvals, generate journals, post to ERP, export files, close periods, or mutate invoice records automatically.",
  };
}

export function buildMarginLeakageControl(inputs: FinanceCashControlInputs) {
  const negativeSnapshots = inputs.financialSnapshots.filter((snapshot) => (snapshot.internalNet ?? 0) < 0);
  const lowMarginSnapshots = inputs.financialSnapshots.filter((snapshot) => snapshot.internalMarginPct != null && snapshot.internalMarginPct < 0.08);
  const marginLeakageAmount = roundMoney(
    inputs.financialSnapshots.reduce((sum, snapshot) => {
      if (snapshot.internalNet != null && snapshot.internalNet < 0) return sum + Math.abs(snapshot.internalNet);
      if (snapshot.internalRevenue != null && snapshot.internalCost != null && snapshot.internalRevenue < snapshot.internalCost) return sum + snapshot.internalCost - snapshot.internalRevenue;
      return sum;
    }, 0) + inputs.commercialPackets.reduce((sum, packet) => sum + packet.marginLeakageCount * 1000, 0),
  );
  return {
    marginLeakageAmount,
    negativeMarginCount: negativeSnapshots.length,
    lowMarginCount: lowMarginSnapshots.length,
    commercialMarginRiskCount: inputs.commercialPackets.reduce((sum, packet) => sum + packet.marginLeakageCount, 0),
    flaggedSnapshots: [...negativeSnapshots, ...lowMarginSnapshots].slice(0, 12).map((snapshot) => ({ snapshotId: snapshot.id, shipmentNo: snapshot.shipmentNo, internalNet: snapshot.internalNet, internalMarginPct: snapshot.internalMarginPct, currency: snapshot.currency })),
    guardrail: "Margin leakage control does not change shipment costs, revenue, pricing, tariffs, customer billing, vendor billing, or margin records automatically.",
  };
}

export function buildWarehouseBillingControl(inputs: FinanceCashControlInputs) {
  const draftRuns = inputs.wmsInvoiceRuns.filter((run) => run.status === "DRAFT");
  const reviewRuns = inputs.wmsInvoiceRuns.filter((run) => run.status !== "POSTED" && run.status !== "VOID");
  const zeroLineRuns = inputs.wmsInvoiceRuns.filter((run) => run.lineCount === 0 || run.totalAmount <= 0);
  return {
    invoiceRunCount: inputs.wmsInvoiceRuns.length,
    billingExceptionCount: draftRuns.length + zeroLineRuns.length,
    pendingBillingAmount: roundMoney(reviewRuns.reduce((sum, run) => sum + run.totalAmount, 0)),
    draftRuns: draftRuns.slice(0, 10).map((run) => ({ invoiceRunId: run.id, runNo: run.runNo, totalAmount: run.totalAmount, currency: run.currency, lineCount: run.lineCount })),
    zeroLineRuns: zeroLineRuns.slice(0, 10).map((run) => ({ invoiceRunId: run.id, runNo: run.runNo, totalAmount: run.totalAmount, lineCount: run.lineCount })),
    guardrail: "Warehouse billing control does not post invoice runs, edit billing lines, generate CSV exports, invoice customers, or mutate WMS billing records automatically.",
  };
}

export function buildCloseControls(inputs: FinanceCashControlInputs, accounting = buildAccountingHandoff(inputs), billing = buildWarehouseBillingControl(inputs), payables = buildPayablesControl(inputs)) {
  const checks = [
    { key: "invoice_accounting", label: "Invoice accounting handoff", passed: accounting.accountingBlockerCount === 0 },
    { key: "warehouse_billing", label: "Warehouse billing review", passed: billing.billingExceptionCount === 0 },
    { key: "payables_dispute", label: "Payables/dispute review", passed: payables.riskyInvoiceCount === 0 },
    { key: "finance_packets", label: "Finance packet approvals", passed: inputs.financePackets.every((packet) => packet.status === "APPROVED" || packet.riskScore < 50) },
    { key: "commercial_packets", label: "Commercial finance alignment", passed: inputs.commercialPackets.every((packet) => packet.status === "APPROVED" || packet.commercialScore >= 75) },
  ];
  const gaps = checks.filter((check) => !check.passed).map((check) => ({ key: check.key, label: check.label, severity: check.key === "invoice_accounting" ? "HIGH" : "MEDIUM" }));
  return {
    checkCount: checks.length,
    passedCount: checks.filter((check) => check.passed).length,
    closeControlGapCount: gaps.length,
    checks,
    gaps,
    guardrail: "Close controls are readiness gates only; they do not close accounting periods, post entries, export ledgers, approve packets, or mutate finance records automatically.",
  };
}

export function buildFinanceCashControlPacket(inputs: FinanceCashControlInputs) {
  const currency = currencyOf(inputs);
  const cashPosture = buildCashPosture(inputs);
  const receivables = buildReceivablesControl(inputs);
  const payables = buildPayablesControl(inputs);
  const accountingHandoff = buildAccountingHandoff(inputs);
  const marginLeakage = buildMarginLeakageControl(inputs);
  const warehouseBilling = buildWarehouseBillingControl(inputs);
  const closeControl = buildCloseControls(inputs, accountingHandoff, warehouseBilling, payables);
  const sourceSummary = {
    financePackets: inputs.financePackets.length,
    revenuePackets: inputs.revenuePackets.length,
    commercialPackets: inputs.commercialPackets.length,
    invoiceIntakes: inputs.invoiceIntakes.length,
    financialSnapshots: inputs.financialSnapshots.length,
    shipmentCostLines: inputs.shipmentCostLines.length,
    wmsInvoiceRuns: inputs.wmsInvoiceRuns.length,
    quotes: inputs.quotes.length,
    salesOrders: inputs.salesOrders.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const financeScore = clamp(
    96 -
      Math.min(28, accountingHandoff.accountingBlockerCount * 4) -
      Math.min(22, payables.riskyInvoiceCount * 3) -
      Math.min(20, warehouseBilling.billingExceptionCount * 5) -
      Math.min(24, closeControl.closeControlGapCount * 5) -
      Math.min(18, marginLeakage.negativeMarginCount * 4) -
      Math.min(16, receivables.expiringQuoteCount * 2),
  );
  const responsePlan = {
    status: financeScore < 70 || closeControl.closeControlGapCount > 0 ? "FINANCE_CLOSE_REVIEW_REQUIRED" : financeScore < 88 ? "CONTROLLER_REVIEW" : "MONITOR",
    owners: ["Controller", "Finance operations", "Accounting", "Revenue operations", "WMS billing", "Commercial owner"],
    steps: [
      "Review cash posture, receivables, payables, accounting handoff, margin leakage, WMS billing, and close controls.",
      "Queue controller review before accounting approval, journal creation, invoice export, billing post, customer invoice, vendor payment, or period close.",
      "Use source workflows for any invoice, billing, order, quote, margin, ledger, or accounting-system mutation.",
    ],
    guardrail: "Response plan is review-only and does not approve invoices, post journals, export accounting files, pay vendors, bill customers, close periods, or mutate finance records automatically.",
  };
  const rollbackPlan = {
    steps: [
      "Keep invoice approvals, accounting handoff, journals, WMS billing runs, shipment cost lines, sales orders, quotes, customer invoices, vendor payments, and close state unchanged until downstream approval.",
      "If review is rejected, preserve packet evidence and action queue notes for controller audit.",
      "Create a fresh packet when invoice, billing, quote, order, margin, or finance packet evidence changes materially.",
      "Route any ERP/accounting export, period-close, payment, dispute, billing, or revenue recognition work through separate approved workflows.",
    ],
    guardrail: "Rollback plan is evidence only; it does not reverse accounting entries, void invoices, reopen periods, change billing runs, revoke approvals, or mutate financial records automatically.",
  };
  const leadershipSummary = [
    `Sprint 12 Finance, Cash & Accounting Controls score is ${financeScore}/100 with ${currency} ${cashPosture.cashExposureAmount.toLocaleString("en-US")} cash exposure, ${currency} ${receivables.receivableRiskAmount.toLocaleString("en-US")} receivable risk, and ${currency} ${payables.payableRiskAmount.toLocaleString("en-US")} payable risk.`,
    `${accountingHandoff.accountingBlockerCount} accounting blocker(s), ${warehouseBilling.billingExceptionCount} WMS billing exception(s), ${closeControl.closeControlGapCount} close-control gap(s), and ${currency} ${marginLeakage.marginLeakageAmount.toLocaleString("en-US")} margin leakage need controller review.`,
    "Packet creation does not approve invoices, post journals, export accounting files, pay vendors, bill customers, change orders or quotes, close periods, or mutate finance records.",
  ].join("\n\n");
  return {
    title: `Sprint 12 Finance Cash Control packet: score ${financeScore}/100`,
    status: "DRAFT",
    financeScore,
    currency,
    sourceSummary,
    cashPosture,
    receivables,
    payables,
    accountingHandoff,
    marginLeakage,
    warehouseBilling,
    closeControl,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}

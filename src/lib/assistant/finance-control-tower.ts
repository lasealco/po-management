export type FinanceInvoiceSignal = {
  id: string;
  vendorLabel: string | null;
  externalInvoiceNo: string | null;
  currency: string;
  rollupOutcome: string;
  financeHandoffStatus: string;
  approvedForAccounting: boolean;
  totalEstimatedCost: number;
  totalVariance: number;
  redLineCount: number;
  amberLineCount: number;
};

export type FinanceShipmentCostSignal = {
  id: string;
  shipmentNo: string | null;
  currency: string;
  internalRevenue: number | null;
  internalCost: number | null;
  internalNet: number | null;
  internalMarginPct: number | null;
  costLineTotal: number;
};

export type FinanceControlInputs = {
  invoices: FinanceInvoiceSignal[];
  shipmentCosts: FinanceShipmentCostSignal[];
  procurementPlans: Array<{ id: string; recommendedCarrier: string | null; allocationScore: number; status: string }>;
  customerBriefs: Array<{ id: string; serviceScore: number; status: string }>;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function summarizeInvoiceVariance(invoices: FinanceInvoiceSignal[]) {
  const totalVariance = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.totalVariance, 0));
  const disputeAmount = roundMoney(
    invoices
      .filter((invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0)
      .reduce((sum, invoice) => sum + Math.abs(invoice.totalVariance), 0),
  );
  const unapprovedAccountingCount = invoices.filter((invoice) => !invoice.approvedForAccounting).length;
  const redLineCount = invoices.reduce((sum, invoice) => sum + invoice.redLineCount, 0);
  const amberLineCount = invoices.reduce((sum, invoice) => sum + invoice.amberLineCount, 0);
  return {
    invoiceCount: invoices.length,
    totalVariance,
    disputeAmount,
    unapprovedAccountingCount,
    redLineCount,
    amberLineCount,
  };
}

export function summarizeMarginLeakage(shipments: FinanceShipmentCostSignal[]) {
  const negativeMargin = shipments.filter((shipment) => (shipment.internalNet ?? 0) < 0);
  const lowMargin = shipments.filter((shipment) => shipment.internalMarginPct != null && shipment.internalMarginPct < 0.08);
  const estimatedLeakage = roundMoney(
    shipments.reduce((sum, shipment) => {
      if (shipment.internalNet != null && shipment.internalNet < 0) return sum + Math.abs(shipment.internalNet);
      if (shipment.internalRevenue != null && shipment.internalCost != null && shipment.internalRevenue < shipment.internalCost) {
        return sum + (shipment.internalCost - shipment.internalRevenue);
      }
      return sum;
    }, 0),
  );
  return {
    shipmentCount: shipments.length,
    negativeMarginCount: negativeMargin.length,
    lowMarginCount: lowMargin.length,
    estimatedLeakage,
    flaggedShipments: [...negativeMargin, ...lowMargin].slice(0, 10).map((shipment) => ({
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      internalNet: shipment.internalNet,
      internalMarginPct: shipment.internalMarginPct,
      costLineTotal: shipment.costLineTotal,
    })),
  };
}

export function buildAccrualRisk(input: FinanceControlInputs) {
  const unapprovedInvoices = input.invoices.filter((invoice) => !invoice.approvedForAccounting);
  const pendingProcurement = input.procurementPlans.filter((plan) => plan.status !== "ALLOCATION_QUEUED" && plan.status !== "APPROVED");
  const poorServiceBriefs = input.customerBriefs.filter((brief) => brief.serviceScore < 60);
  const accrualAmount = roundMoney(
    unapprovedInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalEstimatedCost + invoice.totalVariance), 0),
  );
  return {
    accrualAmount,
    unapprovedInvoiceCount: unapprovedInvoices.length,
    pendingProcurementCount: pendingProcurement.length,
    serviceRiskBriefCount: poorServiceBriefs.length,
    riskFlags: [
      unapprovedInvoices.length > 0 ? `${unapprovedInvoices.length} invoice(s) not cleared for accounting.` : null,
      pendingProcurement.length > 0 ? `${pendingProcurement.length} procurement allocation(s) still pending.` : null,
      poorServiceBriefs.length > 0 ? `${poorServiceBriefs.length} customer account(s) show service risk that may affect cash collection.` : null,
    ].filter((flag): flag is string => Boolean(flag)),
  };
}

export function scoreFinanceRisk(params: {
  variance: ReturnType<typeof summarizeInvoiceVariance>;
  leakage: ReturnType<typeof summarizeMarginLeakage>;
  accrual: ReturnType<typeof buildAccrualRisk>;
}) {
  const variancePressure = Math.min(35, Math.abs(params.variance.totalVariance) / 1000);
  const disputePressure = Math.min(25, params.variance.disputeAmount / 1000 + params.variance.redLineCount * 4);
  const leakagePressure = Math.min(25, params.leakage.estimatedLeakage / 1000 + params.leakage.negativeMarginCount * 5);
  const accrualPressure = Math.min(20, params.accrual.unapprovedInvoiceCount * 4 + params.accrual.pendingProcurementCount * 2);
  return Math.max(0, Math.min(100, Math.round(variancePressure + disputePressure + leakagePressure + accrualPressure)));
}

export function buildFinanceControlPacket(input: FinanceControlInputs) {
  const variance = summarizeInvoiceVariance(input.invoices);
  const leakage = summarizeMarginLeakage(input.shipmentCosts);
  const accrual = buildAccrualRisk(input);
  const riskScore = scoreFinanceRisk({ variance, leakage, accrual });
  const currency = input.invoices[0]?.currency ?? input.shipmentCosts[0]?.currency ?? "USD";
  const boardSummary = [
    `Finance risk score is ${riskScore}/100.`,
    `Invoice variance totals ${variance.totalVariance.toFixed(2)} ${currency}; dispute candidate amount ${variance.disputeAmount.toFixed(2)} ${currency}.`,
    `Estimated margin leakage is ${leakage.estimatedLeakage.toFixed(2)} ${currency} across ${leakage.negativeMarginCount} negative-margin shipment(s).`,
    `Accrual exposure is ${accrual.accrualAmount.toFixed(2)} ${currency}; ${accrual.unapprovedInvoiceCount} invoice(s) are not cleared for accounting.`,
    "No accounting export, dispute submission, or shipment cost mutation is performed without human approval.",
  ].join("\n");
  return {
    title: `Finance control packet ${new Date().toISOString().slice(0, 10)}`,
    status: riskScore >= 70 ? "FINANCE_REVIEW" : "DRAFT",
    riskScore,
    currency,
    totalVariance: variance.totalVariance,
    disputeAmount: variance.disputeAmount,
    accrualAmount: accrual.accrualAmount,
    varianceSummary: variance,
    leakage,
    disputeQueue: {
      candidates: input.invoices
        .filter((invoice) => invoice.rollupOutcome === "FAIL" || invoice.redLineCount > 0)
        .slice(0, 12)
        .map((invoice) => ({
          intakeId: invoice.id,
          vendorLabel: invoice.vendorLabel,
          externalInvoiceNo: invoice.externalInvoiceNo,
          variance: invoice.totalVariance,
          redLineCount: invoice.redLineCount,
        })),
    },
    accrualRisk: accrual,
    evidence: {
      invoiceIds: input.invoices.map((invoice) => invoice.id),
      shipmentIds: input.shipmentCosts.map((shipment) => shipment.id),
      procurementPlanIds: input.procurementPlans.map((plan) => plan.id),
      customerBriefIds: input.customerBriefs.map((brief) => brief.id),
    },
    boardSummary,
  };
}

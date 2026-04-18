import type {
  InvoiceAuditResult,
  InvoiceIntake,
  InvoiceLine,
  InvoiceToleranceRule,
} from "@prisma/client";

export function serializeToleranceRule(r: InvoiceToleranceRule) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    priority: r.priority,
    active: r.active,
    amountAbsTolerance: r.amountAbsTolerance?.toString() ?? null,
    percentTolerance: r.percentTolerance?.toString() ?? null,
    currencyScope: r.currencyScope,
    categoryScope: r.categoryScope,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function serializeInvoiceLine(l: InvoiceLine) {
  return {
    id: l.id,
    invoiceIntakeId: l.invoiceIntakeId,
    lineNo: l.lineNo,
    rawDescription: l.rawDescription,
    normalizedLabel: l.normalizedLabel,
    currency: l.currency,
    amount: l.amount.toString(),
    unitBasis: l.unitBasis,
    equipmentType: l.equipmentType,
    chargeStructureHint: l.chargeStructureHint,
    quantity: l.quantity?.toString() ?? null,
    sourceRowJson: l.sourceRowJson,
    parseConfidence: l.parseConfidence,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function serializeAuditResult(
  r: InvoiceAuditResult & {
    line?: Pick<InvoiceLine, "id" | "lineNo" | "rawDescription" | "amount" | "currency"> | null;
    toleranceRule?: Pick<
      InvoiceToleranceRule,
      | "id"
      | "name"
      | "priority"
      | "active"
      | "currencyScope"
      | "amountAbsTolerance"
      | "percentTolerance"
    > | null;
  },
) {
  return {
    id: r.id,
    invoiceIntakeId: r.invoiceIntakeId,
    invoiceLineId: r.invoiceLineId,
    bookingPricingSnapshotId: r.bookingPricingSnapshotId,
    toleranceRuleId: r.toleranceRuleId,
    toleranceRule: r.toleranceRule
      ? {
          id: r.toleranceRule.id,
          name: r.toleranceRule.name,
          priority: r.toleranceRule.priority,
          active: r.toleranceRule.active,
          currencyScope: r.toleranceRule.currencyScope,
          amountAbsTolerance: r.toleranceRule.amountAbsTolerance?.toString() ?? null,
          percentTolerance: r.toleranceRule.percentTolerance?.toString() ?? null,
        }
      : null,
    outcome: r.outcome,
    discrepancyCategories: r.discrepancyCategories,
    expectedAmount: r.expectedAmount?.toString() ?? null,
    amountVariance: r.amountVariance?.toString() ?? null,
    percentVariance: r.percentVariance?.toString() ?? null,
    snapshotMatchedJson: r.snapshotMatchedJson,
    explanation: r.explanation,
    createdAt: r.createdAt.toISOString(),
    line: r.line
      ? {
          id: r.line.id,
          lineNo: r.line.lineNo,
          rawDescription: r.line.rawDescription,
          currency: r.line.currency,
          amount: r.line.amount.toString(),
        }
      : null,
  };
}

export function serializeInvoiceIntakeListRow(
  row: InvoiceIntake & {
    bookingPricingSnapshot: { id: string; sourceSummary: string | null; currency: string; frozenAt: Date };
    _count?: { lines: number };
  },
) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    bookingPricingSnapshotId: row.bookingPricingSnapshotId,
    externalInvoiceNo: row.externalInvoiceNo,
    vendorLabel: row.vendorLabel,
    invoiceDate: row.invoiceDate?.toISOString().slice(0, 10) ?? null,
    currency: row.currency,
    rollupOutcome: row.rollupOutcome,
    greenLineCount: row.greenLineCount,
    amberLineCount: row.amberLineCount,
    redLineCount: row.redLineCount,
    unknownLineCount: row.unknownLineCount,
    parsedLineCount: row._count?.lines ?? 0,
    reviewDecision: row.reviewDecision,
    receivedAt: row.receivedAt.toISOString(),
    lastAuditAt: row.lastAuditAt?.toISOString() ?? null,
    auditRunError: row.auditRunError,
    parseError: row.parseError,
    bookingPricingSnapshot: {
      id: row.bookingPricingSnapshot.id,
      sourceSummary: row.bookingPricingSnapshot.sourceSummary,
      currency: row.bookingPricingSnapshot.currency,
      frozenAt: row.bookingPricingSnapshot.frozenAt.toISOString(),
    },
  };
}

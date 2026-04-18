import type { Prisma } from "@prisma/client";

import { auditOceanInvoiceLine, type LineAuditComputed } from "@/lib/invoice-audit/ocean-line-match";
import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";

export type { LineAuditComputed };

/** Legacy entrypoint: itemized matching without intake ports or aliases (invoiceLineCount>1 disables auto all-in). */
export function auditInvoiceLineAgainstCandidates(params: {
  invoiceLine: {
    rawDescription: string;
    normalizedLabel: string | null;
    currency: string;
    amount: Prisma.Decimal;
    unitBasis?: string | null;
    equipmentType?: string | null;
    chargeStructureHint?: string | null;
  };
  candidates: SnapshotPriceCandidate[];
  amountAbsTolerance: number;
  percentTolerance: number;
  toleranceRuleId: string | null;
}): LineAuditComputed {
  return auditOceanInvoiceLine({
    invoiceLine: {
      rawDescription: params.invoiceLine.rawDescription,
      normalizedLabel: params.invoiceLine.normalizedLabel,
      currency: params.invoiceLine.currency,
      amount: params.invoiceLine.amount,
      unitBasis: params.invoiceLine.unitBasis ?? null,
      equipmentType: params.invoiceLine.equipmentType ?? null,
      chargeStructureHint: params.invoiceLine.chargeStructureHint ?? null,
    },
    intake: { polCode: null, podCode: null },
    candidates: params.candidates,
    snapshotSourceType: "TARIFF_CONTRACT_VERSION",
    rfqGrandTotal: null,
    contractGrandTotal: null,
    aliases: [],
    amountAbsTolerance: params.amountAbsTolerance,
    percentTolerance: params.percentTolerance,
    toleranceRuleId: params.toleranceRuleId,
    invoiceLineCount: 2,
  });
}

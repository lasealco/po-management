import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  PRICING_SNAPSHOT_BREAKDOWN_SCHEMA_VERSION,
  TOTAL_DERIVATION_QUOTE_RESPONSE,
} from "@/lib/booking-pricing-snapshot/constants";
import { dateIso, decString } from "@/lib/booking-pricing-snapshot/serialize";
import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

export async function buildQuoteResponseSnapshotPayload(params: { tenantId: string; quoteResponseId: string }) {
  const response = await prisma.quoteResponse.findFirst({
    where: { id: params.quoteResponseId, quoteRequest: { tenantId: params.tenantId } },
    include: {
      quoteRequest: true,
      recipient: { include: { supplier: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!response) throw new SnapshotRepoError("NOT_FOUND", "Quote response not found for this tenant.");

  const lineSum = response.lines.reduce((s, l) => s + (l.amount != null ? Number(l.amount) : 0), 0);
  const totalFromField =
    response.totalAllInAmount != null ? Number(response.totalAllInAmount) : null;
  const total =
    totalFromField != null && Number.isFinite(totalFromField) ? totalFromField : lineSum;

  const breakdown: Prisma.InputJsonValue = {
    schemaVersion: PRICING_SNAPSHOT_BREAKDOWN_SCHEMA_VERSION,
    sourceType: "QUOTE_RESPONSE",
    sourceRecordId: response.id,
    quoteRequest: {
      id: response.quoteRequest.id,
      title: response.quoteRequest.title,
      status: response.quoteRequest.status,
      transportMode: response.quoteRequest.transportMode,
      originLabel: response.quoteRequest.originLabel,
      destinationLabel: response.quoteRequest.destinationLabel,
    },
    recipient: {
      id: response.recipient.id,
      displayName: response.recipient.displayName,
      contactEmail: response.recipient.contactEmail,
      supplierName: response.recipient.supplier?.name ?? null,
    },
    response: {
      id: response.id,
      status: response.status,
      currency: response.currency,
      totalAllInAmount: decString(response.totalAllInAmount),
      validityFrom: dateIso(response.validityFrom),
      validityTo: dateIso(response.validityTo),
      includedChargesJson: response.includedChargesJson ?? [],
      excludedChargesJson: response.excludedChargesJson ?? [],
    },
    lines: response.lines.map((l) => ({
      id: l.id,
      lineType: l.lineType,
      label: l.label,
      amount: decString(l.amount),
      currency: l.currency,
      unitBasis: l.unitBasis,
      isIncluded: l.isIncluded,
      notes: l.notes,
    })),
    totals: {
      lineSubtotal: lineSum,
      storedAllIn: totalFromField,
      grand: total,
    },
  };

  const freeTimeBasis: Prisma.InputJsonValue = {
    schemaVersion: 1,
    summary: response.freeTimeSummaryJson ?? {},
    source: "QUOTE_RESPONSE.freeTimeSummaryJson",
  };

  const sourceSummary = `${response.quoteRequest.title} · ${response.recipient.displayName} · RFQ response`;

  return {
    currency: response.currency,
    totalEstimatedCost: total,
    breakdown,
    freeTimeBasis,
    totalDerivation: TOTAL_DERIVATION_QUOTE_RESPONSE,
    sourceSummary,
  };
}

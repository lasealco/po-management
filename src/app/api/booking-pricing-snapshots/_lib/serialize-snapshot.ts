import type { BookingPricingSnapshot } from "@prisma/client";

export function serializeBookingPricingSnapshot(row: BookingPricingSnapshot) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    shipmentBookingId: row.shipmentBookingId,
    sourceType: row.sourceType,
    sourceRecordId: row.sourceRecordId,
    sourceSummary: row.sourceSummary,
    currency: row.currency,
    totalEstimatedCost: row.totalEstimatedCost.toString(),
    breakdownJson: row.breakdownJson,
    freeTimeBasisJson: row.freeTimeBasisJson,
    totalDerivation: row.totalDerivation,
    frozenAt: row.frozenAt.toISOString(),
    createdByUserId: row.createdByUserId,
    commercialJson: row.commercialJson,
    basisSide: row.basisSide,
  };
}

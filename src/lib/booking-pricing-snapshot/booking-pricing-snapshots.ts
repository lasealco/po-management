import { Prisma, type PricingSnapshotSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildContractVersionSnapshotPayload } from "@/lib/booking-pricing-snapshot/freeze-from-contract-version";
import { buildQuoteResponseSnapshotPayload } from "@/lib/booking-pricing-snapshot/freeze-from-quote-response";
import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

export async function assertShipmentBookingForTenant(params: { tenantId: string; shipmentBookingId: string }) {
  const b = await prisma.shipmentBooking.findFirst({
    where: { id: params.shipmentBookingId, shipment: { order: { tenantId: params.tenantId } } },
    select: { id: true },
  });
  if (!b) throw new SnapshotRepoError("NOT_FOUND", "Shipment booking not found for this tenant.");
}

export async function listBookingPricingSnapshotsForTenant(params: { tenantId: string; take?: number }) {
  const take = Math.min(params.take ?? 100, 300);
  return prisma.bookingPricingSnapshot.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ frozenAt: "desc" }, { id: "desc" }],
    take,
    include: { shipmentBooking: { select: { id: true, bookingNo: true, shipmentId: true } } },
  });
}

export async function getBookingPricingSnapshotForTenant(params: { tenantId: string; snapshotId: string }) {
  const row = await prisma.bookingPricingSnapshot.findFirst({
    where: { id: params.snapshotId, tenantId: params.tenantId },
    include: {
      shipmentBooking: {
        select: { id: true, bookingNo: true, shipmentId: true, status: true },
      },
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) throw new SnapshotRepoError("NOT_FOUND", "Pricing snapshot not found.");
  return row;
}

export async function createBookingPricingSnapshot(input: {
  tenantId: string;
  shipmentBookingId?: string | null;
  sourceType: PricingSnapshotSourceType;
  sourceRecordId: string;
  sourceSummary?: string | null;
  currency: string;
  totalEstimatedCost: number;
  breakdownJson: Prisma.InputJsonValue;
  freeTimeBasisJson: Prisma.InputJsonValue;
  totalDerivation: string;
  createdByUserId?: string | null;
  commercialJson?: Prisma.InputJsonValue | null;
  basisSide?: string | null;
}) {
  if (input.shipmentBookingId) {
    await assertShipmentBookingForTenant({
      tenantId: input.tenantId,
      shipmentBookingId: input.shipmentBookingId,
    });
  }

  return prisma.bookingPricingSnapshot.create({
    data: {
      tenantId: input.tenantId,
      shipmentBookingId: input.shipmentBookingId ?? null,
      sourceType: input.sourceType,
      sourceRecordId: input.sourceRecordId,
      sourceSummary: input.sourceSummary?.trim() || null,
      currency: input.currency.trim().toUpperCase().slice(0, 3),
      totalEstimatedCost: new Prisma.Decimal(String(input.totalEstimatedCost)),
      breakdownJson: input.breakdownJson,
      freeTimeBasisJson: input.freeTimeBasisJson,
      totalDerivation: input.totalDerivation,
      createdByUserId: input.createdByUserId ?? null,
      commercialJson: input.commercialJson ?? undefined,
      basisSide: input.basisSide?.trim() || null,
    },
  });
}

export async function freezeSnapshotFromContractVersion(params: {
  tenantId: string;
  contractVersionId: string;
  shipmentBookingId?: string | null;
  createdByUserId?: string | null;
}) {
  const built = await buildContractVersionSnapshotPayload({
    tenantId: params.tenantId,
    contractVersionId: params.contractVersionId,
  });
  return createBookingPricingSnapshot({
    tenantId: params.tenantId,
    shipmentBookingId: params.shipmentBookingId ?? null,
    sourceType: "TARIFF_CONTRACT_VERSION",
    sourceRecordId: params.contractVersionId,
    sourceSummary: built.sourceSummary,
    currency: built.currency,
    totalEstimatedCost: built.totalEstimatedCost,
    breakdownJson: built.breakdown,
    freeTimeBasisJson: built.freeTimeBasis,
    totalDerivation: built.totalDerivation,
    createdByUserId: params.createdByUserId ?? null,
  });
}

export async function freezeSnapshotFromQuoteResponse(params: {
  tenantId: string;
  quoteResponseId: string;
  shipmentBookingId?: string | null;
  createdByUserId?: string | null;
}) {
  const built = await buildQuoteResponseSnapshotPayload({
    tenantId: params.tenantId,
    quoteResponseId: params.quoteResponseId,
  });
  return createBookingPricingSnapshot({
    tenantId: params.tenantId,
    shipmentBookingId: params.shipmentBookingId ?? null,
    sourceType: "QUOTE_RESPONSE",
    sourceRecordId: params.quoteResponseId,
    sourceSummary: built.sourceSummary,
    currency: built.currency,
    totalEstimatedCost: built.totalEstimatedCost,
    breakdownJson: built.breakdown,
    freeTimeBasisJson: built.freeTimeBasis,
    totalDerivation: built.totalDerivation,
    createdByUserId: params.createdByUserId ?? null,
  });
}

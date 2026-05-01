import type { Prisma } from "@prisma/client";

/** Rows that may be rolled into a new draft invoice run for the period. */
export function invoiceEligibleBillingEventsWhere(
  tenantId: string,
  periodFrom: Date,
  periodTo: Date,
): Prisma.WmsBillingEventWhereInput {
  return {
    tenantId,
    invoiceRunId: null,
    billingDisputed: false,
    occurredAt: { gte: periodFrom, lte: periodTo },
  };
}

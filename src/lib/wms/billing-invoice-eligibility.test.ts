import { describe, expect, it } from "vitest";

import { invoiceEligibleBillingEventsWhere } from "@/lib/wms/billing-invoice-eligibility";

describe("invoiceEligibleBillingEventsWhere", () => {
  it("requires tenant, open invoice slot, non-disputed status, and occurred window", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T23:59:59.999Z");
    expect(invoiceEligibleBillingEventsWhere("tenant-a", from, to)).toEqual({
      tenantId: "tenant-a",
      invoiceRunId: null,
      billingDisputed: false,
      occurredAt: { gte: from, lte: to },
    });
  });
});

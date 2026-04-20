import { describe, expect, it } from "vitest";

import { buildWorkbenchCsv } from "@/components/control-tower-workbench/csv";
import type { WorkbenchRow } from "@/components/control-tower-workbench/types";
import { defaultWorkbenchColumnVisibility } from "@/lib/control-tower/workbench-column-prefs";

const row: WorkbenchRow = {
  id: "ship-1",
  shipmentNo: "ASN-1",
  status: "IN_TRANSIT",
  transportMode: "OCEAN",
  trackingNo: null,
  carrier: null,
  carrierSupplierId: null,
  orderId: "order-1",
  orderNumber: "PO-1",
  supplierId: null,
  supplierName: null,
  customerCrmAccountId: "acc-1",
  customerCrmAccountName: "ACME",
  originCode: "CNSHA",
  destinationCode: "USLAX",
  etd: null,
  eta: "2026-04-20T00:00:00.000Z",
  latestEta: null,
  receivedAt: "2026-04-21T00:00:00.000Z",
  routeProgressPct: 80,
  nextAction: "Mark departure",
  quantityRef: "100",
  weightKgRef: "2300",
  cbmRef: "9.5",
  updatedAt: "2026-04-20T12:00:00.000Z",
  latestMilestone: { code: "BOOKED", hasActual: true },
  trackingMilestoneSummary: {
    openCount: 1,
    lateCount: 0,
    next: { code: "DEPARTED", label: null, dueAt: null, isLate: false },
  },
  dispatchOwner: { id: "u1", name: "Alex" },
  openQueueCounts: { openAlerts: 1, openExceptions: 2 },
};

describe("buildWorkbenchCsv", () => {
  it("prepends truncation metadata and includes visible columns", () => {
    const csv = buildWorkbenchCsv({
      rows: [row],
      colVis: defaultWorkbenchColumnVisibility(),
      restrictedView: false,
      listTruncated: true,
      listLimit: 150,
      nowMs: Date.parse("2026-04-22T00:00:00.000Z"),
    });

    const [meta, header, firstRow] = csv.split("\n");
    expect(meta).toContain("list truncated at 150 rows");
    expect(header).toContain("health");
    expect(header).toContain("owner");
    expect(firstRow).toContain('"Delayed"');
    expect(firstRow).toContain('"BOOKED ✓; next:DEPARTED"');
  });

  it("omits owner columns in restricted view", () => {
    const csv = buildWorkbenchCsv({
      rows: [row],
      colVis: defaultWorkbenchColumnVisibility(),
      restrictedView: true,
      listTruncated: false,
      listLimit: null,
      nowMs: Date.parse("2026-04-20T00:00:00.000Z"),
    });

    const [header] = csv.split("\n");
    expect(header).not.toContain("owner");
    expect(header).not.toContain("openAlerts");
  });
});

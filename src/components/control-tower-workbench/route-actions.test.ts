import { describe, expect, it } from "vitest";

import { createRouteActionCounts } from "@/components/control-tower-workbench/route-actions";
import type { WorkbenchRow } from "@/components/control-tower-workbench/types";

const baseRow: WorkbenchRow = {
  id: "ship-1",
  shipmentNo: null,
  status: "IN_TRANSIT",
  transportMode: "OCEAN",
  trackingNo: null,
  carrier: null,
  carrierSupplierId: null,
  orderId: "order-1",
  orderNumber: "PO-1",
  supplierId: null,
  supplierName: null,
  customerCrmAccountId: null,
  customerCrmAccountName: null,
  originCode: null,
  destinationCode: null,
  etd: null,
  eta: null,
  latestEta: null,
  receivedAt: null,
  routeProgressPct: 30,
  nextAction: null,
  quantityRef: null,
  weightKgRef: null,
  cbmRef: null,
  updatedAt: "2026-04-20T12:00:00.000Z",
  latestMilestone: null,
  trackingMilestoneSummary: null,
  dispatchOwner: null,
  openQueueCounts: { openAlerts: 0, openExceptions: 0 },
};

describe("createRouteActionCounts", () => {
  it("counts prefix-matched actions consistently", () => {
    const counts = createRouteActionCounts([
      { ...baseRow, id: "1", nextAction: "Send booking now" },
      { ...baseRow, id: "2", nextAction: "Send booking follow-up" },
      { ...baseRow, id: "3", nextAction: "Await booking confirmation" },
      { ...baseRow, id: "4", nextAction: "Mark departure terminal gate out" },
      { ...baseRow, id: "5", nextAction: "Unknown action" },
    ]);

    expect(counts["Send booking"]).toBe(2);
    expect(counts["Await booking"]).toBe(1);
    expect(counts["Mark departure"]).toBe(1);
    expect(counts["Escalate booking"]).toBe(0);
  });
});

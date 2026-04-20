import { describe, expect, it } from "vitest";

import { classifyShipmentHealth, healthLabel } from "@/components/control-tower-workbench/health";
import type { WorkbenchRow } from "@/components/control-tower-workbench/types";

function buildRow(overrides: Partial<WorkbenchRow> = {}): WorkbenchRow {
  return {
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
    eta: "2026-04-20T12:00:00.000Z",
    latestEta: null,
    receivedAt: null,
    routeProgressPct: 50,
    nextAction: "Plan leg",
    quantityRef: null,
    weightKgRef: null,
    cbmRef: null,
    updatedAt: "2026-04-20T12:00:00.000Z",
    latestMilestone: null,
    trackingMilestoneSummary: { openCount: 0, lateCount: 0, next: null },
    dispatchOwner: null,
    openQueueCounts: { openAlerts: 0, openExceptions: 0 },
    ...overrides,
  };
}

describe("classifyShipmentHealth", () => {
  it("marks send-booking rows as missing data", () => {
    const row = buildRow({ nextAction: "Send booking" });
    expect(classifyShipmentHealth(row, Date.now())).toBe("missing_data");
    expect(healthLabel("missing_data")).toBe("Missing plan/tracking");
  });

  it("marks late deliveries as delayed", () => {
    const row = buildRow({
      eta: "2026-04-10T00:00:00.000Z",
      receivedAt: "2026-04-12T00:00:00.000Z",
    });
    expect(classifyShipmentHealth(row, Date.now())).toBe("delayed");
  });

  it("marks queue alerts as at risk", () => {
    const row = buildRow({
      openQueueCounts: { openAlerts: 2, openExceptions: 0 },
      trackingMilestoneSummary: { openCount: 2, lateCount: 0, next: null },
    });
    expect(classifyShipmentHealth(row, Date.now())).toBe("at_risk");
  });
});

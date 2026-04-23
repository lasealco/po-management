import { describe, expect, it } from "vitest";

import { buildControlTowerMapPins } from "./map-pins";
import type { ControlTowerShipmentListRow } from "./list-shipments";

function row(
  partial: Partial<ControlTowerShipmentListRow> & { id: string; originCode: string | null; destinationCode: string | null },
): ControlTowerShipmentListRow {
  return {
    shipmentNo: null,
    status: "IN_TRANSIT",
    transportMode: "OCEAN",
    trackingNo: null,
    carrier: null,
    carrierSupplierId: null,
    shippedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customerCrmAccountId: null,
    customerCrmAccountName: null,
    orderId: "o1",
    orderNumber: "PO-1",
    supplierId: null,
    supplierName: null,
    externalOrderRef: null,
    shipmentSource: "PO",
    etd: null,
    eta: null,
    latestEta: null,
    nextAction: null,
    bookingStatus: null,
    bookingSlaBreached: null,
    bookingSentAt: null,
    bookingConfirmSlaDueAt: null,
    latestMilestone: null,
    trackingMilestoneSummary: null,
    dispatchOwner: null,
    openQueueCounts: { openAlerts: 0, openExceptions: 0 },
    quantityRef: null,
    weightKgRef: null,
    cbmRef: null,
    receivedAt: null,
    routeProgressPct: 50,
    ...partial,
  } as ControlTowerShipmentListRow;
}

describe("buildControlTowerMapPins", () => {
  it("produces a pin for known origin and destination codes", () => {
    const { pins, unmappedCount } = buildControlTowerMapPins([
      row({
        id: "a1",
        originCode: "CNSZX",
        destinationCode: "USLAX",
      }),
    ]);
    expect(unmappedCount).toBe(0);
    expect(pins).toHaveLength(1);
    expect(pins[0].lat).toBeGreaterThan(-90);
    expect(pins[0].lat).toBeLessThan(90);
    expect(pins[0].href).toBe("/control-tower/shipments/a1");
  });

  it("skips rows with no mappable codes", () => {
    const { pins, unmappedCount } = buildControlTowerMapPins([
      row({
        id: "a2",
        originCode: null,
        destinationCode: "UNKNOWN-PORT-XYZ",
      }),
    ]);
    expect(pins).toHaveLength(0);
    expect(unmappedCount).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildReceivingAccrualSnapshotV1,
  flattenReceivingAccrualStagingToCsvRows,
  isReceivingAccrualSnapshotV1,
  receivingAccrualStagingCsvFromRows,
} from "./receiving-accrual-staging";

describe("receiving-accrual-staging BF-32", () => {
  it("buildReceivingAccrualSnapshotV1 captures shipment refs, GRN, and line economics", () => {
    const closedAt = new Date("2026-05-08T12:00:00.000Z");
    const snap = buildReceivingAccrualSnapshotV1({
      closedAt,
      grnReference: "GRN-DEMO-1",
      shipment: {
        id: "ship1",
        shipmentNo: "SN-1",
        asnReference: "ASN-9",
        order: { id: "po1", orderNumber: "PO-100", currency: "EUR" },
        items: [
          {
            id: "li1",
            quantityShipped: 10,
            quantityReceived: 9,
            wmsVarianceDisposition: "SHORT",
            orderItem: {
              productId: "p1",
              product: {
                id: "p1",
                sku: "SKU-A",
                productCode: "PC-A",
                name: "Widget",
              },
            },
          },
        ],
      },
    });
    expect(snap.schemaVersion).toBe(1);
    expect(snap.currency).toBe("EUR");
    expect(snap.grnReference).toBe("GRN-DEMO-1");
    expect(snap.shipmentRefs.purchaseOrderNumber).toBe("PO-100");
    expect(snap.lines).toHaveLength(1);
    expect(snap.lines[0]!.quantityShipped).toBe("10.000");
    expect(snap.lines[0]!.quantityReceived).toBe("9.000");
    expect(snap.lines[0]!.wmsVarianceDisposition).toBe("SHORT");
  });

  it("flattenReceivingAccrualStagingToCsvRows expands snapshot lines", () => {
    const closedAt = new Date("2026-05-08T12:00:00.000Z");
    const snapshotJson = buildReceivingAccrualSnapshotV1({
      closedAt,
      grnReference: null,
      shipment: {
        id: "ship1",
        shipmentNo: null,
        asnReference: null,
        order: { id: "po1", orderNumber: "PO-100", currency: "USD" },
        items: [
          {
            id: "li1",
            quantityShipped: 1,
            quantityReceived: 1,
            wmsVarianceDisposition: "MATCH",
            orderItem: { productId: null, product: null },
          },
        ],
      },
    });
    const rows = flattenReceivingAccrualStagingToCsvRows({
      id: "st1",
      createdAt: closedAt,
      wmsReceiptId: "rec1",
      shipmentId: "ship1",
      crmAccountId: "crm1",
      warehouseId: null,
      snapshotJson,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.crmAccountId).toBe("crm1");
    expect(rows[0]!.purchaseOrderNumber).toBe("PO-100");
    const csv = receivingAccrualStagingCsvFromRows(rows);
    expect(csv).toContain("stagingId");
    expect(csv).toContain("st1");
  });

  it("isReceivingAccrualSnapshotV1 rejects garbage", () => {
    expect(isReceivingAccrualSnapshotV1(null)).toBe(false);
    expect(isReceivingAccrualSnapshotV1({ schemaVersion: 2 })).toBe(false);
    expect(
      isReceivingAccrualSnapshotV1({
        schemaVersion: 1,
        closedAt: "x",
        lines: [],
      }),
    ).toBe(true);
  });
});

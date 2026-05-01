import { describe, expect, it, vi } from "vitest";

import { writeShipmentItemReceiveLineInTx } from "./inbound-receive-line-write";

describe("writeShipmentItemReceiveLineInTx", () => {
  it("merges audit extras into inbound_receive_line_updated payload", async () => {
    const shipmentItemUpdate = vi.fn().mockResolvedValue(undefined);
    const ctAuditLogCreate = vi.fn().mockResolvedValue(undefined);
    const tx = {
      shipmentItem: { update: shipmentItemUpdate },
      ctAuditLog: { create: ctAuditLogCreate },
    };

    await writeShipmentItemReceiveLineInTx(
      tx as never,
      "t1",
      "u1",
      {
        itemId: "si1",
        shipmentId: "sh1",
        quantityShipped: 10,
        receivedQty: 10,
        disposition: "MATCH",
        varianceNotePayload: null,
      },
      { wmsReceiptId: "wr1", source: "set_wms_receipt_line" },
    );

    expect(ctAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          wmsReceiptId: "wr1",
          source: "set_wms_receipt_line",
          disposition: "MATCH",
          quantityReceived: 10,
        }),
      }),
    });
  });
});

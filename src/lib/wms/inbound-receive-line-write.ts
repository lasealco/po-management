import type { Prisma, WmsShipmentItemVarianceDisposition } from "@prisma/client";

/** Inputs after tenant/shipment-item resolution and BF-01 disposition resolution. */
export type ShipmentReceiveLineWriteInput = {
  itemId: string;
  shipmentId: string;
  quantityShipped: number;
  receivedQty: number;
  disposition: WmsShipmentItemVarianceDisposition;
  /** `undefined` — omit `wmsVarianceNote` in DB update; `null` — clear. */
  varianceNotePayload: string | null | undefined;
};

/** Updates `ShipmentItem` receiving fields + `CtAuditLog` (`inbound_receive_line_updated`). */
export async function writeShipmentItemReceiveLineInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorUserId: string,
  input: ShipmentReceiveLineWriteInput,
  auditExtra?: Record<string, unknown>,
): Promise<void> {
  const shipped = input.quantityShipped;
  const qtyStr = input.receivedQty.toFixed(3);
  await tx.shipmentItem.update({
    where: { id: input.itemId },
    data: {
      quantityReceived: qtyStr,
      wmsVarianceDisposition: input.disposition,
      ...(input.varianceNotePayload !== undefined ? { wmsVarianceNote: input.varianceNotePayload } : {}),
    },
  });
  await tx.ctAuditLog.create({
    data: {
      tenantId,
      shipmentId: input.shipmentId,
      entityType: "SHIPMENT_ITEM",
      entityId: input.itemId,
      action: "inbound_receive_line_updated",
      payload: {
        quantityShipped: shipped,
        quantityReceived: input.receivedQty,
        disposition: input.disposition,
        ...(input.varianceNotePayload !== undefined && input.varianceNotePayload !== null
          ? { note: input.varianceNotePayload }
          : {}),
        ...(auditExtra ?? {}),
      },
      actorUserId,
    },
  });
}

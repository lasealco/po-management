import { prisma } from "@/lib/prisma";

const OUTBOUND_LINE_REFS = new Set(["OUTBOUND_LINE_PICK", "OUTBOUND_LINE_SHIP"]);
const SHIPMENT_ITEM = "SHIPMENT_ITEM";

/**
 * Map inventory movement id → CRM account id: outbound bill-to, inbound shipment
 * customer (3PL), or `null` when unlinked.
 */
export async function resolveCrmAccountIdsByMovementIds(
  tenantId: string,
  movements: Array<{ id: string; referenceType: string | null; referenceId: string | null }>,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const m of movements) {
    result.set(m.id, null);
  }

  const outboundLineIds = new Set<string>();
  const shipmentItemIds = new Set<string>();
  for (const m of movements) {
    if (!m.referenceId) continue;
    if (m.referenceType && OUTBOUND_LINE_REFS.has(m.referenceType)) {
      outboundLineIds.add(m.referenceId);
    }
    if (m.referenceType === SHIPMENT_ITEM) {
      shipmentItemIds.add(m.referenceId);
    }
  }

  if (outboundLineIds.size > 0) {
    const lines = await prisma.outboundOrderLine.findMany({
      where: { tenantId, id: { in: [...outboundLineIds] } },
      select: {
        id: true,
        outboundOrder: { select: { crmAccountId: true } },
      },
    });
    const crmByOutLine = new Map<string, string | null>();
    for (const row of lines) {
      crmByOutLine.set(row.id, row.outboundOrder.crmAccountId ?? null);
    }
    for (const m of movements) {
      if (!m.referenceId || !m.referenceType || !OUTBOUND_LINE_REFS.has(m.referenceType)) continue;
      result.set(m.id, crmByOutLine.get(m.referenceId) ?? null);
    }
  }

  if (shipmentItemIds.size > 0) {
    const items = await prisma.shipmentItem.findMany({
      where: { id: { in: [...shipmentItemIds] }, shipment: { order: { tenantId } } },
      select: {
        id: true,
        shipment: { select: { customerCrmAccountId: true } },
      },
    });
    const crmByShipItem = new Map<string, string | null>();
    for (const row of items) {
      crmByShipItem.set(row.id, row.shipment.customerCrmAccountId ?? null);
    }
    for (const m of movements) {
      if (m.referenceType !== SHIPMENT_ITEM || !m.referenceId) continue;
      result.set(m.id, crmByShipItem.get(m.referenceId) ?? null);
    }
  }

  return result;
}

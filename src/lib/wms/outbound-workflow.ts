import { prisma } from "@/lib/prisma";

/** After pick qty is committed: RELEASED → PICKING when any line has pick progress. */
export async function syncOutboundOrderStatusAfterPick(
  tenantId: string,
  outboundLineId: string | null,
) {
  if (!outboundLineId) return;
  const line = await prisma.outboundOrderLine.findFirst({
    where: { id: outboundLineId, tenantId },
    select: { outboundOrderId: true },
  });
  if (!line) return;
  const order = await prisma.outboundOrder.findFirst({
    where: { id: line.outboundOrderId, tenantId },
    include: { lines: true },
  });
  if (!order) return;
  if (order.status === "DRAFT" || order.status === "CANCELLED" || order.status === "SHIPPED") return;
  if (order.status === "PACKED") return;
  const anyPick = order.lines.some((l) => Number(l.pickedQty) > 0);
  if (order.status === "RELEASED" && anyPick) {
    await prisma.outboundOrder.updateMany({
      where: { id: order.id, tenantId, status: "RELEASED" },
      data: { status: "PICKING" },
    });
  }
}

import { prisma } from "@/lib/prisma";

/**
 * Creates a single open alert per shipment when booking was sent and the SLA deadline passed.
 * Idempotent: skips if an OPEN/ACK BOOKING_SLA_BREACHED alert already exists.
 */
export async function ensureBookingConfirmationSlaAlerts(params: {
  tenantId: string;
  shipmentIds: string[];
}): Promise<void> {
  const { tenantId, shipmentIds } = params;
  if (!shipmentIds.length) return;

  const now = new Date();
  const dueShipments = await prisma.shipment.findMany({
    where: {
      id: { in: shipmentIds },
      booking: {
        status: "SENT",
        bookingConfirmSlaDueAt: { lte: now },
      },
    },
    select: { id: true },
  });
  for (const { id: shipmentId } of dueShipments) {
    const existing = await prisma.ctAlert.findFirst({
      where: {
        tenantId,
        shipmentId,
        type: "BOOKING_SLA_BREACHED",
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.ctAlert.create({
      data: {
        tenantId,
        shipmentId,
        type: "BOOKING_SLA_BREACHED",
        severity: "CRITICAL",
        title: "Booking confirmation overdue",
        body: "The forwarder did not confirm the booking before the SLA deadline. Follow up or escalate.",
        status: "OPEN",
      },
    });
  }
}

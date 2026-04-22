import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureBookingConfirmationSlaAlerts } from "./booking-sla";

const prismaMock = vi.hoisted(() => ({
  shipment: { findMany: vi.fn() },
  ctAlert: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("ensureBookingConfirmationSlaAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when shipmentIds is empty", async () => {
    await ensureBookingConfirmationSlaAlerts({ tenantId: "t1", shipmentIds: [] });
    expect(prismaMock.shipment.findMany).not.toHaveBeenCalled();
  });

  it("creates alert when due shipment has no open booking SLA alert", async () => {
    prismaMock.shipment.findMany.mockResolvedValue([{ id: "s1" }]);
    prismaMock.ctAlert.findFirst.mockResolvedValue(null);
    prismaMock.ctAlert.create.mockResolvedValue({ id: "a1" });

    await ensureBookingConfirmationSlaAlerts({ tenantId: "t1", shipmentIds: ["s1"] });

    expect(prismaMock.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["s1"] },
          booking: {
            status: "SENT",
            bookingConfirmSlaDueAt: { lte: expect.any(Date) },
          },
        }),
        select: { id: true },
      }),
    );
    expect(prismaMock.ctAlert.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        shipmentId: "s1",
        type: "BOOKING_SLA_BREACHED",
        severity: "CRITICAL",
        title: "Booking confirmation overdue",
        body: "The forwarder did not confirm the booking before the SLA deadline. Follow up or escalate.",
        status: "OPEN",
      },
    });
  });

  it("skips create when an open or ack alert already exists", async () => {
    prismaMock.shipment.findMany.mockResolvedValue([{ id: "s1" }]);
    prismaMock.ctAlert.findFirst.mockResolvedValue({ id: "existing" });

    await ensureBookingConfirmationSlaAlerts({ tenantId: "t1", shipmentIds: ["s1"] });

    expect(prismaMock.ctAlert.create).not.toHaveBeenCalled();
  });
});

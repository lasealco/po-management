import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstPurchaseOrder = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseOrder: {
      findFirst: findFirstPurchaseOrder,
    },
  },
}));

vi.mock("./audit", () => ({
  writeCtAudit: vi.fn().mockResolvedValue(undefined),
}));

import { createLogisticsShipment } from "./create-logistics-shipment";

const base = {
  tenantId: "tenant-1",
  actorUserId: "user-1",
  transportMode: "OCEAN" as const,
};

describe("createLogisticsShipment validation", () => {
  beforeEach(() => {
    findFirstPurchaseOrder.mockReset();
  });

  it("rejects milestone pack when it does not match transport mode", async () => {
    await expect(
      createLogisticsShipment({
        ...base,
        transportMode: "AIR",
        milestonePackId: "OCEAN_PORT_TO_PORT",
        orderId: "order-1",
        lines: [{ orderItemId: "line-1", quantityShipped: "1" }],
      }),
    ).rejects.toThrow("Milestone pack does not match the selected transport mode");
    expect(findFirstPurchaseOrder).not.toHaveBeenCalled();
  });

  it("requires at least one line when orderId is set", async () => {
    await expect(
      createLogisticsShipment({
        ...base,
        orderId: "order-1",
        lines: [],
      }),
    ).rejects.toThrow("At least one order line with quantity is required");
    expect(findFirstPurchaseOrder).not.toHaveBeenCalled();
  });

  it("throws when PO is missing", async () => {
    findFirstPurchaseOrder.mockResolvedValue(null);
    await expect(
      createLogisticsShipment({
        ...base,
        orderId: "missing-order",
        lines: [{ orderItemId: "item-1", quantityShipped: "1" }],
      }),
    ).rejects.toThrow("Order not found");
  });

  it("throws on unknown order line id", async () => {
    findFirstPurchaseOrder.mockResolvedValue({
      id: "order-1",
      items: [{ id: "real-item", lineNo: 1, quantity: new Prisma.Decimal(1) }],
    });
    await expect(
      createLogisticsShipment({
        ...base,
        orderId: "order-1",
        lines: [{ orderItemId: "wrong-item", quantityShipped: "1" }],
      }),
    ).rejects.toThrow("Unknown orderItemId: wrong-item");
  });

  it("throws on duplicate orderItemId", async () => {
    findFirstPurchaseOrder.mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-a", lineNo: 1, quantity: new Prisma.Decimal(1) }],
    });
    await expect(
      createLogisticsShipment({
        ...base,
        orderId: "order-1",
        lines: [
          { orderItemId: "item-a", quantityShipped: "1" },
          { orderItemId: "item-a", quantityShipped: "2" },
        ],
      }),
    ).rejects.toThrow("Duplicate orderItemId: item-a");
  });

  it("throws when quantityShipped is not positive", async () => {
    findFirstPurchaseOrder.mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-a", lineNo: 1, quantity: new Prisma.Decimal(1) }],
    });
    await expect(
      createLogisticsShipment({
        ...base,
        orderId: "order-1",
        lines: [{ orderItemId: "item-a", quantityShipped: "0" }],
      }),
    ).rejects.toThrow("Each line needs a positive quantityShipped");
  });
});

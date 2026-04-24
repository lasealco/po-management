import { beforeEach, describe, expect, it, vi } from "vitest";

const { outboundFindMany, shipmentItemFindMany } = vi.hoisted(() => ({
  outboundFindMany: vi.fn(),
  shipmentItemFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboundOrderLine: { findMany: outboundFindMany },
    shipmentItem: { findMany: shipmentItemFindMany },
  },
}));

import { resolveCrmAccountIdsByMovementIds } from "./billing-crm-resolve";

describe("resolveCrmAccountIdsByMovementIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboundFindMany.mockResolvedValue([]);
    shipmentItemFindMany.mockResolvedValue([]);
  });

  it("resolves from outbound line pick to outbound crmAccountId", async () => {
    outboundFindMany.mockResolvedValueOnce([
      {
        id: "line-1",
        outboundOrder: { crmAccountId: "crm-a" },
      },
    ]);
    const map = await resolveCrmAccountIdsByMovementIds("t1", [
      { id: "mv-1", referenceType: "OUTBOUND_LINE_PICK", referenceId: "line-1" },
    ]);
    expect(outboundFindMany).toHaveBeenCalled();
    expect(map.get("mv-1")).toBe("crm-a");
  });

  it("resolves from SHIPMENT_ITEM to shipment customerCrmAccountId", async () => {
    shipmentItemFindMany.mockResolvedValueOnce([
      {
        id: "si-1",
        shipment: { customerCrmAccountId: "crm-b" },
      },
    ]);
    const map = await resolveCrmAccountIdsByMovementIds("t1", [
      { id: "mv-2", referenceType: "SHIPMENT_ITEM", referenceId: "si-1" },
    ]);
    expect(shipmentItemFindMany).toHaveBeenCalled();
    expect(map.get("mv-2")).toBe("crm-b");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniquePack = vi.hoisted(() => vi.fn());
const findFirstShipment = vi.hoisted(() => vi.fn());
const findManyMilestones = vi.hoisted(() => vi.fn());
const createTrackingMilestone = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const writeAudit = vi.hoisted(() => vi.fn());

vi.mock("./audit", () => ({
  writeCtAudit: writeAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctMilestoneTemplatePack: { findUnique: findUniquePack },
    shipment: { findFirst: findFirstShipment },
    ctTrackingMilestone: { findMany: findManyMilestones },
    $transaction: transaction,
  },
}));

import { applyCtMilestonePack } from "./milestone-templates";

function txRunner() {
  transaction.mockImplementation(
    async (fn: (tx: { ctTrackingMilestone: { create: typeof createTrackingMilestone } }) => Promise<void>) => {
      await fn({
        ctTrackingMilestone: { create: createTrackingMilestone },
      });
    },
  );
}

describe("applyCtMilestonePack", () => {
  beforeEach(() => {
    findUniquePack.mockReset();
    findFirstShipment.mockReset();
    findManyMilestones.mockReset();
    createTrackingMilestone.mockReset();
    transaction.mockReset();
    writeAudit.mockReset();
    writeAudit.mockResolvedValue(undefined);
    findManyMilestones.mockResolvedValue([]);
    txRunner();
  });

  it("throws when shipment is not in tenant scope", async () => {
    findUniquePack.mockResolvedValue({
      title: "Pack",
      milestones: [{ code: "A", label: "A", anchor: "SHIPMENT_CREATED", offsetDays: 0 }],
    });
    findFirstShipment.mockResolvedValue(null);
    await expect(
      applyCtMilestonePack({
        tenantId: "t1",
        shipmentId: "s1",
        actorUserId: "u1",
        packId: "CUSTOM",
      }),
    ).rejects.toThrow("Shipment not found");
    expect(transaction).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("throws when shipment already has tracking milestones", async () => {
    findUniquePack.mockResolvedValue({
      title: "Pack",
      milestones: [{ code: "A", label: "A", anchor: "SHIPMENT_CREATED", offsetDays: 0 }],
    });
    findFirstShipment.mockResolvedValue({
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      transportMode: "OCEAN",
      ctTrackingMilestones: [{ id: "existing" }],
      booking: { etd: null, eta: null, latestEta: null, mode: "OCEAN" },
    });
    await expect(
      applyCtMilestonePack({ tenantId: "t1", shipmentId: "s1", actorUserId: "u1", packId: "CUSTOM" }),
    ).rejects.toThrow("already has tracking milestones");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("throws when built-in pack mode does not match shipment mode", async () => {
    findUniquePack.mockResolvedValue(null);
    findFirstShipment.mockResolvedValue({
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      transportMode: "AIR",
      ctTrackingMilestones: [],
      booking: { etd: null, eta: null, latestEta: null, mode: "AIR" },
    });
    await expect(
      applyCtMilestonePack({
        tenantId: "t1",
        shipmentId: "s1",
        actorUserId: "u1",
        packId: "OCEAN_PORT_TO_PORT",
      }),
    ).rejects.toThrow("does not match the shipment transport mode");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates milestones from pack, skips missing anchor dates, and writes audit", async () => {
    const createdAt = new Date("2026-06-01T12:00:00.000Z");
    findUniquePack.mockResolvedValue({
      title: "Mixed",
      milestones: [
        { code: "HAS_ANCHOR", label: "Has", anchor: "SHIPMENT_CREATED", offsetDays: 0 },
        { code: "NO_ETD", label: "Skip", anchor: "BOOKING_ETD", offsetDays: 0 },
      ],
    });
    findFirstShipment.mockResolvedValue({
      createdAt,
      transportMode: "OCEAN",
      ctTrackingMilestones: [],
      booking: { etd: null, eta: null, latestEta: null, mode: "OCEAN" },
    });
    createTrackingMilestone.mockResolvedValue({ id: "m-new" });

    const r = await applyCtMilestonePack({
      tenantId: "t1",
      shipmentId: "s1",
      actorUserId: "u1",
      packId: "CUSTOM",
    });

    expect(r).toEqual({ created: 1, skipped: 1 });
    expect(createTrackingMilestone).toHaveBeenCalledTimes(1);
    expect(createTrackingMilestone).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        shipmentId: "s1",
        code: "HAS_ANCHOR",
        plannedAt: createdAt,
        sourceType: "TEMPLATE",
        sourceRef: "CUSTOM",
        updatedById: "u1",
      }),
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        shipmentId: "s1",
        action: "apply_ct_milestone_pack",
        actorUserId: "u1",
        payload: { packId: "CUSTOM", created: 1, skipped: 1 },
      }),
    );
  });

  it("skips milestone codes already on the shipment", async () => {
    findUniquePack.mockResolvedValue({
      title: "Pack",
      milestones: [{ code: "DUPE", label: "D", anchor: "SHIPMENT_CREATED", offsetDays: 0 }],
    });
    findFirstShipment.mockResolvedValue({
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      transportMode: "OCEAN",
      ctTrackingMilestones: [],
      booking: { etd: null, eta: null, latestEta: null, mode: "OCEAN" },
    });
    findManyMilestones.mockResolvedValue([{ code: "DUPE" }]);

    const r = await applyCtMilestonePack({
      tenantId: "t1",
      shipmentId: "s1",
      actorUserId: "u1",
      packId: "CUSTOM",
    });

    expect(r).toEqual({ created: 0, skipped: 1 });
    expect(createTrackingMilestone).not.toHaveBeenCalled();
  });
});

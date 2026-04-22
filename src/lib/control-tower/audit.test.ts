import { beforeEach, describe, expect, it, vi } from "vitest";

const createAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctAuditLog: {
      create: createAudit,
    },
  },
}));

import { writeCtAudit } from "./audit";

describe("writeCtAudit", () => {
  beforeEach(() => {
    createAudit.mockReset();
    createAudit.mockResolvedValue({});
  });

  it("persists audit row with optional payload", async () => {
    await writeCtAudit({
      tenantId: "t1",
      shipmentId: "s1",
      entityType: "CtAlert",
      entityId: "a1",
      action: "test_action",
      actorUserId: "u1",
      payload: { foo: 1 },
    });
    expect(createAudit).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        shipmentId: "s1",
        entityType: "CtAlert",
        entityId: "a1",
        action: "test_action",
        actorUserId: "u1",
        payload: { foo: 1 },
      },
    });
  });

  it("omits payload when unset", async () => {
    await writeCtAudit({
      tenantId: "t1",
      shipmentId: null,
      entityType: "Shipment",
      entityId: "s9",
      action: "note",
      actorUserId: "u2",
    });
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shipmentId: null,
        payload: undefined,
      }),
    });
  });
});

import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinIngestEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { appendTwinMutationAuditEvent } from "@/lib/supply-chain-twin/mutation-audit";

describe("appendTwinMutationAuditEvent", () => {
  it("writes metadata-only mutation audit event", async () => {
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.create).mockResolvedValueOnce({ id: "evt_1" });

    await appendTwinMutationAuditEvent({
      tenantId: "t1",
      actorId: "u1",
      action: "scenario_deleted",
      targetId: "draft_1",
      metadata: { source: "api" },
    });

    expect(prismaMock.supplyChainTwinIngestEvent.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        type: "mutation_audit",
        payloadJson: {
          action: "scenario_deleted",
          actorId: "u1",
          targetId: "draft_1",
          metadata: { source: "api" },
        },
      },
      select: { id: true },
    });
  });
});

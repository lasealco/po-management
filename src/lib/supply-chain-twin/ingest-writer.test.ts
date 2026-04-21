import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  TWIN_INGEST_MAX_PAYLOAD_BYTES,
  TWIN_INGEST_PAYLOAD_TOO_LARGE,
  TwinIngestPayloadTooLargeError,
  appendIngestEvent,
} from "@/lib/supply-chain-twin/ingest-writer";

beforeEach(() => {
  vi.mocked(prismaMock.supplyChainTwinIngestEvent.create).mockReset();
});

describe("appendIngestEvent", () => {
  it("persists when payload is under the byte cap", async () => {
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.create).mockResolvedValueOnce({ id: "evt_1" });

    const out = await appendIngestEvent({
      tenantId: "t1",
      type: "entity_upsert",
      payload: { ok: true },
    });

    expect(out).toEqual({ id: "evt_1" });
    expect(prismaMock.supplyChainTwinIngestEvent.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        type: "entity_upsert",
        payloadJson: { ok: true },
      },
      select: { id: true },
    });
  });

  it("rejects oversize payload with stable error code", async () => {
    const filler = "x".repeat(TWIN_INGEST_MAX_PAYLOAD_BYTES + 10);
    const err = await appendIngestEvent({
      tenantId: "t1",
      type: "blob",
      payload: { data: filler },
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TwinIngestPayloadTooLargeError);
    expect((err as TwinIngestPayloadTooLargeError).code).toBe(TWIN_INGEST_PAYLOAD_TOO_LARGE);
    expect(prismaMock.supplyChainTwinIngestEvent.create).not.toHaveBeenCalled();
  });

  it("rejects empty type", async () => {
    await expect(
      appendIngestEvent({
        tenantId: "t1",
        type: "   ",
        payload: {},
      }),
    ).rejects.toThrow(RangeError);

    expect(prismaMock.supplyChainTwinIngestEvent.create).not.toHaveBeenCalled();
  });
});

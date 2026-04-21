import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinIngestEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
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
  vi.mocked(prismaMock.supplyChainTwinIngestEvent.findFirst).mockReset();
});

describe("appendIngestEvent", () => {
  it("persists when payload is under the byte cap", async () => {
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.create).mockResolvedValueOnce({
      id: "evt_1",
      type: "entity_upsert",
    });

    const out = await appendIngestEvent({
      tenantId: "t1",
      type: "entity_upsert",
      payload: { ok: true },
    });

    expect(out).toEqual({ id: "evt_1", type: "entity_upsert" });
    expect(prismaMock.supplyChainTwinIngestEvent.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        type: "entity_upsert",
        payloadJson: { ok: true },
      },
      select: { id: true, type: true },
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

  it("returns existing event on idempotency replay", async () => {
    const duplicateError = Object.assign(new Error("unique"), { code: "P2002" });
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.create).mockRejectedValueOnce(duplicateError);
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findFirst).mockResolvedValueOnce({
      id: "evt-existing",
      type: "entity_upsert",
    });

    const out = await appendIngestEvent({
      tenantId: "t1",
      type: "entity_upsert",
      payload: { ok: true },
      idempotencyKey: "idem-1",
    });

    expect(out).toEqual({ id: "evt-existing", type: "entity_upsert" });
    expect(prismaMock.supplyChainTwinIngestEvent.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", idempotencyKey: "idem-1" },
      select: { id: true, type: true },
    });
  });
});

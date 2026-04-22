import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionApplyIdempotency: {
      findUnique: h.findUnique,
      create: h.create,
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { createApplyIdempotencyRecord, findApplyIdempotencyRecord } from "./ingestion-apply-idempotency-repo";

describe("ingestion-apply-idempotency-repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findApplyIdempotencyRecord delegates to prisma", async () => {
    const row = {
      id: "1",
      tenantId: "t1",
      idempotencyKey: "k1",
      ingestionRunId: "run-1",
      dryRun: false,
      requestFingerprint: "v1:marker",
      responseStatus: 200,
      responseBody: {},
      createdAt: new Date(),
    };
    h.findUnique.mockResolvedValue(row);
    await expect(findApplyIdempotencyRecord({ tenantId: "t1", idempotencyKey: "k1" })).resolves.toEqual(row);
    expect(h.findUnique).toHaveBeenCalledWith({
      where: { tenantId_idempotencyKey: { tenantId: "t1", idempotencyKey: "k1" } },
    });
  });

  it("createApplyIdempotencyRecord returns existing on unique violation", async () => {
    const existing = {
      id: "1",
      tenantId: "t1",
      idempotencyKey: "k1",
      ingestionRunId: "run-1",
      dryRun: false,
      requestFingerprint: "v1:marker",
      responseStatus: 409,
      responseBody: { ok: false },
      createdAt: new Date(),
    };
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["tenantId", "idempotencyKey"] },
    });
    h.create.mockRejectedValueOnce(p2002);
    h.findUnique.mockResolvedValueOnce(existing);
    await expect(
      createApplyIdempotencyRecord({
        tenantId: "t1",
        idempotencyKey: "k1",
        runId: "run-1",
        dryRun: false,
        requestFingerprint: "v1:marker",
        responseStatus: 200,
        responseBody: { applied: true },
      }),
    ).resolves.toEqual({ created: false, existing });
  });

  it("createApplyIdempotencyRecord returns created on success", async () => {
    h.create.mockResolvedValue({});
    await expect(
      createApplyIdempotencyRecord({
        tenantId: "t1",
        idempotencyKey: "k1",
        runId: "run-1",
        dryRun: false,
        requestFingerprint: "v1:marker",
        responseStatus: 200,
        responseBody: { applied: true },
      }),
    ).resolves.toEqual({ created: true });
    expect(prisma.apiHubIngestionApplyIdempotency.create).toHaveBeenCalled();
  });
});

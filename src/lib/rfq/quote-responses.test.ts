import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureDraftQuoteResponse,
  getQuoteResponseForTenant,
  submitQuoteResponse,
  updateQuoteResponseReview,
  updateQuoteResponseWithLines,
} from "./quote-responses";

const txMock = vi.hoisted(() => ({
  quoteResponse: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  quoteResponseLine: { deleteMany: vi.fn(), createMany: vi.fn() },
  quoteRequestRecipient: { update: vi.fn() },
  quoteRequest: { update: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  quoteRequestRecipient: { findFirst: vi.fn() },
  quoteResponse: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("ensureDraftQuoteResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteResponse.findUniqueOrThrow.mockResolvedValue({ id: "resp1", lines: [] });
    prismaMock.quoteResponse.create.mockResolvedValue({ id: "resp-new", lines: [] });
  });

  it("throws NOT_FOUND when recipient is missing", async () => {
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue(null);
    await expect(
      ensureDraftQuoteResponse({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns existing response when already linked", async () => {
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue({
      id: "r1",
      quoteRequestId: "q1",
      response: { id: "resp1" },
    });
    const r = await ensureDraftQuoteResponse({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" });
    expect(r.id).toBe("resp1");
    expect(prismaMock.quoteResponse.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "resp1" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    expect(prismaMock.quoteResponse.create).not.toHaveBeenCalled();
  });

  it("creates draft response when none exists", async () => {
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue({
      id: "r1",
      quoteRequestId: "q1",
      response: null,
    });
    const r = await ensureDraftQuoteResponse({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" });
    expect(r.id).toBe("resp-new");
    expect(prismaMock.quoteResponse.create).toHaveBeenCalledWith({
      data: { quoteRequestId: "q1", recipientId: "r1", status: "DRAFT" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
  });
});

describe("getQuoteResponseForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when response is missing", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue(null);
    await expect(getQuoteResponseForTenant({ tenantId: "t1", responseId: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("updateQuoteResponseWithLines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteResponse.findFirst.mockResolvedValue({ id: "resp1", status: "DRAFT" });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
    txMock.quoteResponse.update.mockResolvedValue({ id: "resp1" });
    txMock.quoteResponse.findUniqueOrThrow.mockResolvedValue({ id: "resp1", lines: [] });
    txMock.quoteResponseLine.deleteMany.mockResolvedValue({ count: 0 });
    txMock.quoteResponseLine.createMany.mockResolvedValue({ count: 1 });
  });

  it("throws NOT_FOUND when response is missing", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue(null);
    await expect(
      updateQuoteResponseWithLines({ tenantId: "t1", responseId: "x", patch: {} }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when response is not DRAFT", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({ id: "resp1", status: "SUBMITTED" });
    await expect(
      updateQuoteResponseWithLines({ tenantId: "t1", responseId: "resp1", patch: { currency: "usd" } }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("uppercases currency to 3 chars and maps null JSON to DbNull", async () => {
    await updateQuoteResponseWithLines({
      tenantId: "t1",
      responseId: "resp1",
      patch: { currency: "  eur  ", includedChargesJson: null },
      lines: null,
    });
    expect(txMock.quoteResponse.update).toHaveBeenCalledWith({
      where: { id: "resp1" },
      data: {
        currency: "EUR",
        includedChargesJson: Prisma.DbNull,
      },
    });
  });

  it("replaces lines when lines array is provided", async () => {
    await updateQuoteResponseWithLines({
      tenantId: "t1",
      responseId: "resp1",
      patch: {},
      lines: [{ lineType: "  FRT  ", label: "  base  ", amount: 100 }],
    });
    expect(txMock.quoteResponseLine.deleteMany).toHaveBeenCalledWith({ where: { quoteResponseId: "resp1" } });
    expect(txMock.quoteResponseLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          quoteResponseId: "resp1",
          sortOrder: 0,
          lineType: "FRT",
          label: "base",
          amount: 100,
          currency: "USD",
          unitBasis: null,
          isIncluded: true,
          notes: null,
        },
      ],
    });
  });
});

describe("submitQuoteResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
    txMock.quoteResponse.update.mockResolvedValue({ id: "resp1", status: "SUBMITTED" });
    txMock.quoteRequestRecipient.update.mockResolvedValue({ id: "r1" });
  });

  it("throws NOT_FOUND when response is missing", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue(null);
    await expect(submitQuoteResponse({ tenantId: "t1", responseId: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws CONFLICT when not draft", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({
      id: "resp1",
      status: "SUBMITTED",
      recipient: { id: "r1" },
    });
    await expect(submitQuoteResponse({ tenantId: "t1", responseId: "resp1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("marks response submitted and recipient responded", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({
      id: "resp1",
      status: "DRAFT",
      recipient: { id: "r1" },
    });
    await submitQuoteResponse({ tenantId: "t1", responseId: "resp1" });
    expect(txMock.quoteResponse.update).toHaveBeenCalledWith({
      where: { id: "resp1" },
      data: { status: "SUBMITTED", submittedAt: expect.any(Date) },
    });
    expect(txMock.quoteRequestRecipient.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { invitationStatus: "RESPONDED", respondedAt: expect.any(Date) },
    });
  });
});

describe("updateQuoteResponseReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
    txMock.quoteResponse.update.mockResolvedValue({ id: "resp1" });
    txMock.quoteRequest.update.mockResolvedValue({ id: "q1" });
  });

  it("throws NOT_FOUND when response is missing", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue(null);
    await expect(
      updateQuoteResponseReview({ tenantId: "t1", responseId: "x", status: "UNDER_REVIEW" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws CONFLICT when quote is not in a reviewable state", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({
      id: "resp1",
      status: "DRAFT",
      quoteRequestId: "q1",
    });
    await expect(
      updateQuoteResponseReview({ tenantId: "t1", responseId: "resp1", status: "UNDER_REVIEW" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws BAD_INPUT for disallowed target status", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({
      id: "resp1",
      status: "SUBMITTED",
      quoteRequestId: "q1",
    });
    await expect(
      updateQuoteResponseReview({ tenantId: "t1", responseId: "resp1", status: "DRAFT" as never }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
  });

  it("sets quote request to AWARDED when response is awarded", async () => {
    prismaMock.quoteResponse.findFirst.mockResolvedValue({
      id: "resp1",
      status: "SUBMITTED",
      quoteRequestId: "q1",
    });
    await updateQuoteResponseReview({
      tenantId: "t1",
      responseId: "resp1",
      status: "AWARDED",
      reviewNotes: "  pick  ",
    });
    expect(txMock.quoteRequest.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { status: "AWARDED" },
    });
    expect(txMock.quoteResponse.update).toHaveBeenCalledWith({
      where: { id: "resp1" },
      data: {
        status: "AWARDED",
        reviewedAt: expect.any(Date),
        reviewNotes: "pick",
      },
    });
  });
});

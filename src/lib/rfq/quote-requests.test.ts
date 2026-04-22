import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addQuoteClarification,
  addQuoteRequestRecipient,
  createQuoteRequest,
  getQuoteRequestDetail,
  listQuoteRequestsForTenant,
  markRecipientInvited,
  removeQuoteRequestRecipient,
  updateQuoteRequest,
} from "./quote-requests";

const prismaMock = vi.hoisted(() => ({
  quoteRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  supplier: { findFirst: vi.fn() },
  quoteRequestRecipient: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  quoteClarificationMessage: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listQuoteRequestsForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequest.findMany.mockResolvedValue([]);
  });

  it("caps take at 300 and defaults to 100", async () => {
    await listQuoteRequestsForTenant({ tenantId: "t1", take: 999 });
    expect(prismaMock.quoteRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 300 }),
    );
    vi.clearAllMocks();
    prismaMock.quoteRequest.findMany.mockResolvedValue([]);
    await listQuoteRequestsForTenant({ tenantId: "t1" });
    expect(prismaMock.quoteRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe("getQuoteRequestDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when quote request is missing", async () => {
    prismaMock.quoteRequest.findFirst.mockResolvedValue(null);
    await expect(getQuoteRequestDetail({ tenantId: "t1", quoteRequestId: "q1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("createQuoteRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequest.create.mockResolvedValue({ id: "new" });
  });

  it("trims text fields and defaults transport mode and status", async () => {
    await createQuoteRequest({
      tenantId: "t1",
      title: "  RFQ  ",
      description: "  desc  ",
      originLabel: "  A  ",
      destinationLabel: "  B  ",
      equipmentSummary: "  40HC  ",
      cargoDescription: "  gen  ",
    });
    expect(prismaMock.quoteRequest.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        title: "RFQ",
        description: "desc",
        transportMode: "OCEAN",
        originLabel: "A",
        destinationLabel: "B",
        equipmentSummary: "40HC",
        cargoDescription: "gen",
        ownerUserId: null,
        status: "DRAFT",
      },
    });
  });
});

describe("updateQuoteRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequest.findFirst.mockResolvedValue({ id: "q1" });
    prismaMock.quoteRequest.update.mockResolvedValue({ id: "q1" });
  });

  it("throws NOT_FOUND when quote request is missing", async () => {
    prismaMock.quoteRequest.findFirst.mockResolvedValue(null);
    await expect(updateQuoteRequest("t1", "gone", { title: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.quoteRequest.update).not.toHaveBeenCalled();
  });

  it("trims patch strings", async () => {
    await updateQuoteRequest("t1", "q1", { title: "  T  ", originLabel: "  O  " });
    expect(prismaMock.quoteRequest.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { title: "T", originLabel: "O" },
    });
  });
});

describe("addQuoteRequestRecipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequest.findFirst.mockResolvedValue({ id: "q1" });
    prismaMock.supplier.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.quoteRequestRecipient.create.mockResolvedValue({ id: "r1" });
  });

  it("throws NOT_FOUND when quote request is missing", async () => {
    prismaMock.quoteRequest.findFirst.mockResolvedValue(null);
    await expect(
      addQuoteRequestRecipient({ tenantId: "t1", quoteRequestId: "q1", displayName: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.quoteRequestRecipient.create).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when supplierId is not in tenant scope", async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expect(
      addQuoteRequestRecipient({
        tenantId: "t1",
        quoteRequestId: "q1",
        supplierId: "bad",
        displayName: "Co",
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prismaMock.quoteRequestRecipient.create).not.toHaveBeenCalled();
  });

  it("trims display fields", async () => {
    await addQuoteRequestRecipient({
      tenantId: "t1",
      quoteRequestId: "q1",
      displayName: "  Acme  ",
      contactEmail: "  a@b.co  ",
    });
    expect(prismaMock.quoteRequestRecipient.create).toHaveBeenCalledWith({
      data: {
        quoteRequestId: "q1",
        supplierId: null,
        displayName: "Acme",
        contactEmail: "a@b.co",
      },
    });
  });
});

describe("markRecipientInvited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue({ id: "r1" });
    prismaMock.quoteRequestRecipient.update.mockResolvedValue({ id: "r1" });
  });

  it("throws NOT_FOUND when recipient is missing", async () => {
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue(null);
    await expect(
      markRecipientInvited({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uses stub metadata when metadata is omitted", async () => {
    await markRecipientInvited({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" });
    expect(prismaMock.quoteRequestRecipient.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({
        invitationStatus: "INVITED",
        lastInviteMetadata: { stub: true, note: "No outbound email sent yet." },
      }),
    });
  });
});

describe("removeQuoteRequestRecipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue({ id: "r1" });
    prismaMock.quoteRequestRecipient.delete.mockResolvedValue({ id: "r1" });
  });

  it("throws NOT_FOUND when recipient is missing", async () => {
    prismaMock.quoteRequestRecipient.findFirst.mockResolvedValue(null);
    await expect(
      removeQuoteRequestRecipient({ tenantId: "t1", quoteRequestId: "q1", recipientId: "r1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.quoteRequestRecipient.delete).not.toHaveBeenCalled();
  });
});

describe("addQuoteClarification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quoteRequest.findFirst.mockResolvedValue({ id: "q1" });
    prismaMock.quoteClarificationMessage.create.mockResolvedValue({ id: "c1" });
  });

  it("throws NOT_FOUND when quote request is missing", async () => {
    prismaMock.quoteRequest.findFirst.mockResolvedValue(null);
    await expect(
      addQuoteClarification({ tenantId: "t1", quoteRequestId: "q1", body: "hi" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("trims body and defaults visibility INTERNAL", async () => {
    await addQuoteClarification({ tenantId: "t1", quoteRequestId: "q1", body: "  note  " });
    expect(prismaMock.quoteClarificationMessage.create).toHaveBeenCalledWith({
      data: {
        quoteRequestId: "q1",
        authorUserId: null,
        body: "note",
        visibility: "INTERNAL",
        recipientId: null,
        quoteResponseId: null,
        metadata: undefined,
      },
    });
  });
});

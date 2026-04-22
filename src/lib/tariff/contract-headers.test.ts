import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffContractHeader,
  getTariffContractHeaderForTenant,
  listTariffContractHeadersForTenant,
  updateTariffContractHeader,
} from "./contract-headers";

const prismaMock = vi.hoisted(() => ({
  tariffContractHeader: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffContractHeadersForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([]);
  });

  it("caps take at 300 and defaults to 100", async () => {
    await listTariffContractHeadersForTenant({ tenantId: "t1", take: 999 });
    expect(prismaMock.tariffContractHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 300 }),
    );
    vi.clearAllMocks();
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([]);
    await listTariffContractHeadersForTenant({ tenantId: "t1" });
    expect(prismaMock.tariffContractHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("filters by providerId when provided", async () => {
    await listTariffContractHeadersForTenant({ tenantId: "t1", providerId: "p1" });
    expect(prismaMock.tariffContractHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", providerId: "p1" },
      }),
    );
  });
});

describe("getTariffContractHeaderForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when header is missing", async () => {
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue(null);
    await expect(getTariffContractHeaderForTenant({ tenantId: "t1", id: "h1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("createTariffContractHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractHeader.create.mockResolvedValue({ id: "new" });
  });

  it("trims text fields and defaults status to DRAFT", async () => {
    await createTariffContractHeader({
      tenantId: "t1",
      providerId: "p1",
      transportMode: "OCEAN",
      title: "  Title  ",
      contractNumber: "  CN-1  ",
      tradeScope: "  scope  ",
      notes: "  n  ",
    });
    expect(prismaMock.tariffContractHeader.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        legalEntityId: null,
        providerId: "p1",
        transportMode: "OCEAN",
        contractNumber: "CN-1",
        title: "Title",
        tradeScope: "scope",
        status: "DRAFT",
        ownerUserId: null,
        notes: "n",
      },
    });
  });
});

describe("updateTariffContractHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue({ id: "h1" });
    prismaMock.tariffContractHeader.update.mockResolvedValue({ id: "h1" });
  });

  it("throws NOT_FOUND when header is missing", async () => {
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue(null);
    await expect(
      updateTariffContractHeader({ tenantId: "t1", id: "gone" }, { title: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffContractHeader.update).not.toHaveBeenCalled();
  });

  it("trims patch strings and forwards partial updates", async () => {
    await updateTariffContractHeader(
      { tenantId: "t1", id: "h1" },
      { title: "  New  ", contractNumber: "  x  ", notes: "  y  " },
    );
    expect(prismaMock.tariffContractHeader.update).toHaveBeenCalledWith({
      where: { id: "h1" },
      data: {
        title: "New",
        contractNumber: "x",
        notes: "y",
      },
    });
  });
});

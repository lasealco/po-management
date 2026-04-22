import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffProvider,
  getTariffProviderById,
  listTariffProviders,
  updateTariffProvider,
} from "./providers";

const prismaMock = vi.hoisted(() => ({
  tariffProvider: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps take at 500 and supports cursor pagination", async () => {
    prismaMock.tariffProvider.findMany.mockResolvedValue([]);
    await listTariffProviders({ take: 999, cursor: "c1", status: "ACTIVE" });
    expect(prismaMock.tariffProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "ACTIVE" },
        take: 501,
        cursor: { id: "c1" },
        skip: 1,
        orderBy: [{ legalName: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("returns nextCursor when an extra row is present", async () => {
    prismaMock.tariffProvider.findMany.mockResolvedValue([
      { id: "p1", legalName: "A" },
      { id: "p2", legalName: "B" },
    ]);
    const r = await listTariffProviders({ take: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].id).toBe("p1");
    expect(r.nextCursor).toBe("p2");
  });
});

describe("getTariffProviderById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when provider is missing", async () => {
    prismaMock.tariffProvider.findUnique.mockResolvedValue(null);
    await expect(getTariffProviderById("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffProvider.findUnique).toHaveBeenCalledWith({ where: { id: "missing" } });
  });
});

describe("createTariffProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffProvider.create.mockResolvedValue({ id: "new" });
  });

  it("trims names and normalizes country code", async () => {
    await createTariffProvider({
      legalName: "  Ocean Line  ",
      tradingName: "  OL  ",
      providerType: "OCEAN_CARRIER",
      countryCode: "  us  ",
      status: "  INACTIVE  ",
    });
    expect(prismaMock.tariffProvider.create).toHaveBeenCalledWith({
      data: {
        legalName: "Ocean Line",
        tradingName: "OL",
        providerType: "OCEAN_CARRIER",
        countryCode: "US",
        status: "INACTIVE",
      },
    });
  });
});

describe("updateTariffProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffProvider.findUnique.mockResolvedValue({ id: "p1" });
    prismaMock.tariffProvider.update.mockResolvedValue({ id: "p1" });
  });

  it("throws NOT_FOUND when provider is missing", async () => {
    prismaMock.tariffProvider.findUnique.mockResolvedValue(null);
    await expect(updateTariffProvider("gone", { legalName: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffProvider.update).not.toHaveBeenCalled();
  });

  it("updates with trimmed fields after load", async () => {
    await updateTariffProvider("p1", { legalName: "  New  ", countryCode: " gb " });
    expect(prismaMock.tariffProvider.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { legalName: "New", countryCode: "GB" },
    });
  });
});

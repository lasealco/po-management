import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffLegalEntity,
  getTariffLegalEntityForTenant,
  listTariffLegalEntitiesForTenant,
  updateTariffLegalEntity,
} from "./legal-entities";

const prismaMock = vi.hoisted(() => ({
  tariffLegalEntity: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("getTariffLegalEntityForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when no row matches tenant and id", async () => {
    prismaMock.tariffLegalEntity.findFirst.mockResolvedValue(null);
    await expect(getTariffLegalEntityForTenant({ tenantId: "t1", id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.tariffLegalEntity.findFirst).toHaveBeenCalledWith({
      where: { id: "missing", tenantId: "t1" },
    });
  });
});

describe("createTariffLegalEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffLegalEntity.create.mockResolvedValue({ id: "new-id" });
  });

  it("trims text fields, uppercases country and currency, and passes them to create", async () => {
    await createTariffLegalEntity({
      tenantId: "t1",
      name: "  Acme  ",
      code: "  cd  ",
      countryCode: "  de  ",
      baseCurrency: "  eur  ",
      status: "  DRAFT  ",
    });
    expect(prismaMock.tariffLegalEntity.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        name: "Acme",
        code: "cd",
        countryCode: "DE",
        baseCurrency: "EUR",
        status: "DRAFT",
      },
    });
  });

  it("defaults status to ACTIVE and nulls optional codes when omitted", async () => {
    await createTariffLegalEntity({ tenantId: "t1", name: "Solo" });
    expect(prismaMock.tariffLegalEntity.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        name: "Solo",
        code: null,
        countryCode: null,
        baseCurrency: null,
        status: "ACTIVE",
      },
    });
  });
});

describe("listTariffLegalEntitiesForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps take at 500 and requests one extra row for cursor detection", async () => {
    prismaMock.tariffLegalEntity.findMany.mockResolvedValue([]);
    await listTariffLegalEntitiesForTenant({ tenantId: "t1", take: 999 });
    expect(prismaMock.tariffLegalEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        take: 501,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("adds status filter and cursor pagination when provided", async () => {
    prismaMock.tariffLegalEntity.findMany.mockResolvedValue([]);
    await listTariffLegalEntitiesForTenant({ tenantId: "t1", status: "INACTIVE", cursor: "after-me" });
    expect(prismaMock.tariffLegalEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", status: "INACTIVE" },
        cursor: { id: "after-me" },
        skip: 1,
      }),
    );
  });

  it("returns nextCursor when more than take rows exist", async () => {
    prismaMock.tariffLegalEntity.findMany.mockResolvedValue([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ]);
    const r = await listTariffLegalEntitiesForTenant({ tenantId: "t1", take: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.items.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.nextCursor).toBe("c");
  });
});

describe("updateTariffLegalEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffLegalEntity.findFirst.mockResolvedValue({ id: "le1" });
    prismaMock.tariffLegalEntity.update.mockResolvedValue({ id: "le1" });
  });

  it("loads by tenant then updates with trimmed normalized fields", async () => {
    await updateTariffLegalEntity(
      { tenantId: "t1", id: "le1" },
      { name: "  New  ", code: null, countryCode: " fr ", baseCurrency: " usd " },
    );
    expect(prismaMock.tariffLegalEntity.findFirst).toHaveBeenCalledWith({
      where: { id: "le1", tenantId: "t1" },
    });
    expect(prismaMock.tariffLegalEntity.update).toHaveBeenCalledWith({
      where: { id: "le1" },
      data: {
        name: "New",
        code: null,
        countryCode: "FR",
        baseCurrency: "USD",
      },
    });
  });

  it("propagates NOT_FOUND from get when entity is missing", async () => {
    prismaMock.tariffLegalEntity.findFirst.mockResolvedValue(null);
    await expect(
      updateTariffLegalEntity({ tenantId: "t1", id: "gone" }, { name: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffLegalEntity.update).not.toHaveBeenCalled();
  });
});

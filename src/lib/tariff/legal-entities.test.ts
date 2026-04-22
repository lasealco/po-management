import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTariffLegalEntity, getTariffLegalEntityForTenant } from "./legal-entities";

const prismaMock = vi.hoisted(() => ({
  tariffLegalEntity: {
    findFirst: vi.fn(),
    create: vi.fn(),
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

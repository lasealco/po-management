import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffGeographyGroup,
  deleteTariffGeographyGroup,
  getTariffGeographyGroupById,
  listTariffGeographyGroups,
  updateTariffGeographyGroup,
} from "./geography-groups";

const prismaMock = vi.hoisted(() => ({
  tariffGeographyGroup: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffGeographyGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findMany.mockResolvedValue([]);
  });

  it("caps take at 500 and defaults to 200", async () => {
    await listTariffGeographyGroups({ take: 999 });
    expect(prismaMock.tariffGeographyGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findMany.mockResolvedValue([]);
    await listTariffGeographyGroups();
    expect(prismaMock.tariffGeographyGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("filters activeOnly when requested", async () => {
    await listTariffGeographyGroups({ activeOnly: true });
    expect(prismaMock.tariffGeographyGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    );
  });
});

describe("getTariffGeographyGroupById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when missing", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue(null);
    await expect(getTariffGeographyGroupById("g1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("includes members ordered by memberCode", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({ id: "g1", members: [] });
    await getTariffGeographyGroupById("g1");
    expect(prismaMock.tariffGeographyGroup.findUnique).toHaveBeenCalledWith({
      where: { id: "g1" },
      include: { members: { orderBy: { memberCode: "asc" } } },
    });
  });
});

describe("createTariffGeographyGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.create.mockResolvedValue({ id: "new" });
  });

  it("throws BAD_INPUT when validity window is inverted", async () => {
    await expect(
      createTariffGeographyGroup({
        geographyType: "PORT",
        name: "EU Ports",
        validFrom: new Date("2025-12-01"),
        validTo: new Date("2025-01-01"),
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prismaMock.tariffGeographyGroup.create).not.toHaveBeenCalled();
  });

  it("trims strings and defaults active true", async () => {
    await createTariffGeographyGroup({
      geographyType: "ZONE",
      name: "  North  ",
      code: "  n  ",
      aliasSource: "  src  ",
    });
    expect(prismaMock.tariffGeographyGroup.create).toHaveBeenCalledWith({
      data: {
        geographyType: "ZONE",
        name: "North",
        code: "n",
        aliasSource: "src",
        validFrom: null,
        validTo: null,
        active: true,
      },
    });
  });
});

describe("updateTariffGeographyGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({
      id: "g1",
      validFrom: new Date("2024-01-01"),
      validTo: new Date("2024-12-31"),
    });
    prismaMock.tariffGeographyGroup.update.mockResolvedValue({ id: "g1" });
  });

  it("throws NOT_FOUND when group is missing", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue(null);
    await expect(updateTariffGeographyGroup("gone", { name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.tariffGeographyGroup.update).not.toHaveBeenCalled();
  });

  it("merges existing validity with patch before asserting window", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({
      id: "g1",
      validFrom: new Date("2024-06-01"),
      validTo: new Date("2024-12-31"),
    });
    await expect(
      updateTariffGeographyGroup("g1", { validFrom: new Date("2025-01-02") }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prismaMock.tariffGeographyGroup.update).not.toHaveBeenCalled();
  });

  it("trims patch fields", async () => {
    await updateTariffGeographyGroup("g1", { name: "  New  ", code: "  c  " });
    expect(prismaMock.tariffGeographyGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "New", code: "c" },
    });
  });
});

describe("deleteTariffGeographyGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({ id: "g1" });
    prismaMock.tariffGeographyGroup.delete.mockResolvedValue({ id: "g1" });
  });

  it("throws NOT_FOUND when group is missing", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue(null);
    await expect(deleteTariffGeographyGroup("gone")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffGeographyGroup.delete).not.toHaveBeenCalled();
  });

  it("deletes by id when present", async () => {
    await deleteTariffGeographyGroup("g1");
    expect(prismaMock.tariffGeographyGroup.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });
});

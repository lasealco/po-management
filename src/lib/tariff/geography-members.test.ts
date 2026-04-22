import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffGeographyMember,
  deleteTariffGeographyMember,
  getTariffGeographyMemberById,
  listTariffGeographyMembersForGroup,
  updateTariffGeographyMember,
} from "./geography-members";

const prismaMock = vi.hoisted(() => ({
  tariffGeographyGroup: { findUnique: vi.fn() },
  tariffGeographyMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffGeographyMembersForGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({ id: "g1" });
    prismaMock.tariffGeographyMember.findMany.mockResolvedValue([]);
  });

  it("throws NOT_FOUND when geography group does not exist", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue(null);
    await expect(listTariffGeographyMembersForGroup("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffGeographyMember.findMany).not.toHaveBeenCalled();
  });

  it("lists members ordered by memberCode asc", async () => {
    await listTariffGeographyMembersForGroup("g1");
    expect(prismaMock.tariffGeographyMember.findMany).toHaveBeenCalledWith({
      where: { geographyGroupId: "g1" },
      orderBy: { memberCode: "asc" },
    });
  });
});

describe("getTariffGeographyMemberById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when member is missing", async () => {
    prismaMock.tariffGeographyMember.findUnique.mockResolvedValue(null);
    await expect(getTariffGeographyMemberById("m1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("createTariffGeographyMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue({ id: "g1" });
    prismaMock.tariffGeographyMember.create.mockResolvedValue({ id: "new" });
  });

  it("throws NOT_FOUND when group is missing", async () => {
    prismaMock.tariffGeographyGroup.findUnique.mockResolvedValue(null);
    await expect(
      createTariffGeographyMember({
        geographyGroupId: "gone",
        memberCode: "DEHAM",
        memberType: "PORT",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffGeographyMember.create).not.toHaveBeenCalled();
  });

  it("trims memberCode and memberName", async () => {
    await createTariffGeographyMember({
      geographyGroupId: "g1",
      memberCode: "  deham  ",
      memberName: "  Hamburg  ",
      memberType: "PORT",
    });
    expect(prismaMock.tariffGeographyMember.create).toHaveBeenCalledWith({
      data: {
        geographyGroupId: "g1",
        memberCode: "deham",
        memberName: "Hamburg",
        memberType: "PORT",
        validFrom: null,
        validTo: null,
      },
    });
  });
});

describe("updateTariffGeographyMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyMember.findUnique.mockResolvedValue({ id: "m1" });
    prismaMock.tariffGeographyMember.findFirst.mockResolvedValue({ id: "m1" });
    prismaMock.tariffGeographyMember.update.mockResolvedValue({ id: "m1" });
  });

  it("throws scoped NOT_FOUND when member is not in group", async () => {
    prismaMock.tariffGeographyMember.findFirst.mockResolvedValue(null);
    await expect(
      updateTariffGeographyMember("m1", { memberCode: "X" }, { geographyGroupId: "g-other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: expect.stringContaining("group") });
    expect(prismaMock.tariffGeographyMember.update).not.toHaveBeenCalled();
  });

  it("trims memberCode and memberName on patch", async () => {
    await updateTariffGeographyMember("m1", { memberCode: "  abc  ", memberName: "  nm  " });
    expect(prismaMock.tariffGeographyMember.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { memberCode: "abc", memberName: "nm" },
    });
  });
});

describe("deleteTariffGeographyMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffGeographyMember.findUnique.mockResolvedValue({ id: "m1" });
    prismaMock.tariffGeographyMember.findFirst.mockResolvedValue({ id: "m1" });
    prismaMock.tariffGeographyMember.delete.mockResolvedValue({ id: "m1" });
  });

  it("throws scoped NOT_FOUND when member is not in group", async () => {
    prismaMock.tariffGeographyMember.findFirst.mockResolvedValue(null);
    await expect(deleteTariffGeographyMember("m1", { geographyGroupId: "g-other" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.tariffGeographyMember.delete).not.toHaveBeenCalled();
  });

  it("deletes by id when scope is omitted", async () => {
    await deleteTariffGeographyMember("m1");
    expect(prismaMock.tariffGeographyMember.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const userIsSuperuserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({
  userIsSuperuser: userIsSuperuserMock,
}));

const loadOrgUnitSubtreeIdsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/org-scope", () => ({
  loadOrgUnitSubtreeIds: loadOrgUnitSubtreeIdsMock,
}));

const prismaUserFindFirst = vi.hoisted(() => vi.fn());
const prismaOrgUnitRoleAssignment = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: prismaUserFindFirst },
    orgUnitRoleAssignment: { findMany: prismaOrgUnitRoleAssignment },
  },
}));

import { assertSendToSupplierServedOrgPolicy } from "./po-served-org-workflow-policy";

describe("assertSendToSupplierServedOrgPolicy", () => {
  beforeEach(() => {
    userIsSuperuserMock.mockReset();
    userIsSuperuserMock.mockResolvedValue(false);
    prismaUserFindFirst.mockReset();
    prismaOrgUnitRoleAssignment.mockReset();
    loadOrgUnitSubtreeIdsMock.mockReset();
  });

  it("allows when no served org", async () => {
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", null);
    expect(r).toEqual({ ok: true });
  });

  it("allows superuser", async () => {
    userIsSuperuserMock.mockResolvedValue(true);
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "served-1");
    expect(r).toEqual({ ok: true });
  });

  it("denies when user has no primary org", async () => {
    prismaUserFindFirst.mockResolvedValue({ primaryOrgUnitId: null });
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "s-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/primary org/i);
  });

  it("denies when served is outside subtree", async () => {
    prismaUserFindFirst.mockResolvedValue({ primaryOrgUnitId: "hq" });
    loadOrgUnitSubtreeIdsMock.mockResolvedValue(["hq", "a"]);
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "other");
    expect(r.ok).toBe(false);
  });

  it("allows when served equals primary (same site)", async () => {
    prismaUserFindFirst.mockResolvedValue({ primaryOrgUnitId: "site" });
    loadOrgUnitSubtreeIdsMock.mockResolvedValue(["site", "child"]);
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "site");
    expect(r).toEqual({ ok: true });
  });

  it("allows cross-node when org has GROUP_PROCUREMENT", async () => {
    prismaUserFindFirst.mockResolvedValue({ primaryOrgUnitId: "hq" });
    loadOrgUnitSubtreeIdsMock.mockResolvedValue(["hq", "plant"]);
    prismaOrgUnitRoleAssignment.mockResolvedValue([{ role: "GROUP_PROCUREMENT" }]);
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "plant");
    expect(r).toEqual({ ok: true });
  });

  it("denies cross-node without procurement roles", async () => {
    prismaUserFindFirst.mockResolvedValue({ primaryOrgUnitId: "hq" });
    loadOrgUnitSubtreeIdsMock.mockResolvedValue(["hq", "plant"]);
    prismaOrgUnitRoleAssignment.mockResolvedValue([{ role: "PLANT" }]);
    const r = await assertSendToSupplierServedOrgPolicy("t", "u", "plant");
    expect(r.ok).toBe(false);
  });
});

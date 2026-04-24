import { beforeEach, describe, expect, it, vi } from "vitest";

const userIsSuperuserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authz", () => ({
  userIsSuperuser: userIsSuperuserMock,
}));

const prismaUserFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgUnit: { findMany: vi.fn() },
    user: { findFirst: prismaUserFindFirst },
  },
}));

import { getPurchaseOrderScopeWhere, orgUnitSubtreeIds } from "./org-scope";
import { prisma } from "@/lib/prisma";

describe("orgUnitSubtreeIds", () => {
  const rows = [
    { id: "g", parentId: null },
    { id: "a", parentId: "g" },
    { id: "b", parentId: "g" },
    { id: "us", parentId: "a" },
  ];

  it("returns root and descendants", () => {
    const s = new Set(orgUnitSubtreeIds(rows, "g"));
    expect(s.has("g")).toBe(true);
    expect(s.has("a")).toBe(true);
    expect(s.has("us")).toBe(true);
    expect(s.has("b")).toBe(true);
  });

  it("returns single node when no children", () => {
    expect(orgUnitSubtreeIds(rows, "us")).toEqual(["us"]);
  });
});

describe("getPurchaseOrderScopeWhere", () => {
  const loadOrg = vi.mocked(prisma.orgUnit.findMany);

  beforeEach(() => {
    userIsSuperuserMock.mockReset();
    userIsSuperuserMock.mockResolvedValue(false);
    prismaUserFindFirst.mockReset();
    loadOrg.mockReset();
  });

  it("returns only matching CRM account when user is customer-scoped", async () => {
    prismaUserFindFirst.mockResolvedValue({
      customerCrmAccountId: "crm-a",
      primaryOrgUnitId: null,
      productDivisionScope: [],
    } as Awaited<ReturnType<typeof prismaUserFindFirst>>);

    const w = await getPurchaseOrderScopeWhere("t-1", "u-1", {});
    expect(w).toEqual({ customerCrmAccountId: "crm-a" });
  });

  it("ands CRM customer with org subtree", async () => {
    prismaUserFindFirst.mockResolvedValue({
      customerCrmAccountId: "crm-a",
      primaryOrgUnitId: "g",
      productDivisionScope: [],
    } as Awaited<ReturnType<typeof prismaUserFindFirst>>);
    loadOrg.mockResolvedValue([{ id: "g", parentId: null }] as never);

    const w = await getPurchaseOrderScopeWhere("t-1", "u-1", {});
    expect(w).toEqual({
      AND: [
        { customerCrmAccountId: "crm-a" },
        {
          OR: [
            {
              requester: {
                OR: [{ primaryOrgUnitId: { in: ["g"] } }, { primaryOrgUnitId: null }],
              },
            },
            { servedOrgUnitId: { in: ["g"] } },
          ],
        },
      ],
    });
  });

  it("org-only scope allows served org in subtree (Phase 3) or matching requester", async () => {
    prismaUserFindFirst.mockResolvedValue({
      customerCrmAccountId: null,
      primaryOrgUnitId: "hq",
      productDivisionScope: [],
    } as Awaited<ReturnType<typeof prismaUserFindFirst>>);
    loadOrg.mockResolvedValue([
      { id: "hq", parentId: null },
      { id: "site-a", parentId: "hq" },
    ] as never);

    const w = await getPurchaseOrderScopeWhere("t-1", "u-1", {});
    expect(w).toEqual({
      OR: [
        {
          requester: {
            OR: [
              { primaryOrgUnitId: { in: ["hq", "site-a"] } },
              { primaryOrgUnitId: null },
            ],
          },
        },
        { servedOrgUnitId: { in: ["hq", "site-a"] } },
      ],
    });
  });
});

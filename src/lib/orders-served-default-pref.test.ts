import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPreference: { findUnique: findUnique, delete: deleteMock, upsert: upsert },
    orgUnit: { findFirst: findFirst },
  },
}));

import { getOrdersServedDefaultPreference, USER_PREF_ORDERS_SERVED_DEFAULT } from "./orders-served-default-pref";
import { prisma } from "@/lib/prisma";

describe("getOrdersServedDefaultPreference", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    deleteMock.mockReset();
  });

  it("returns null when no preference", async () => {
    findUnique.mockResolvedValue(null);
    const r = await getOrdersServedDefaultPreference("t1", "u1");
    expect(r).toEqual({ defaultOrg: null, preferenceUpdatedAt: null });
  });

  it("resolves org when id valid", async () => {
    findUnique.mockResolvedValue({
      value: { servedOrgUnitId: "ou1" },
      updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    });
    findFirst.mockResolvedValue({
      id: "ou1",
      name: "Plant",
      code: "P1",
      kind: "SITE",
    });
    const r = await getOrdersServedDefaultPreference("t1", "u1");
    expect(r.defaultOrg).toEqual({
      id: "ou1",
      name: "Plant",
      code: "P1",
      kind: "SITE",
    });
    expect(r.preferenceUpdatedAt).toBe("2026-01-15T00:00:00.000Z");
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId_key: { userId: "u1", key: USER_PREF_ORDERS_SERVED_DEFAULT } },
      select: { value: true, updatedAt: true },
    });
  });
});

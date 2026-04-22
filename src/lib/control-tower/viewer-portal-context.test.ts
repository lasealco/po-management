import { beforeEach, describe, expect, it, vi } from "vitest";

const userIsSuperuser = vi.hoisted(() => vi.fn());
const userHasRoleNamed = vi.hoisted(() => vi.fn());
const findUniqueUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authz", () => ({
  userIsSuperuser,
  userHasRoleNamed,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueUser,
    },
  },
}));

import { getControlTowerPortalContext } from "./viewer";

describe("getControlTowerPortalContext", () => {
  beforeEach(() => {
    userIsSuperuser.mockReset();
    userHasRoleNamed.mockReset();
    findUniqueUser.mockReset();
  });

  it("returns unrestricted context for superusers without hitting user lookup", async () => {
    userIsSuperuser.mockResolvedValue(true);
    const ctx = await getControlTowerPortalContext("u-super");
    expect(ctx).toEqual({
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
    expect(userHasRoleNamed).not.toHaveBeenCalled();
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it("marks supplier portal users as restricted", async () => {
    userIsSuperuser.mockResolvedValue(false);
    userHasRoleNamed.mockImplementation((_id, name) => Promise.resolve(name === "Supplier portal"));
    findUniqueUser.mockResolvedValue({ customerCrmAccountId: null });
    const ctx = await getControlTowerPortalContext("u-sup");
    expect(ctx).toEqual({
      isRestrictedView: true,
      isSupplierPortal: true,
      customerCrmAccountId: null,
    });
  });

  it("restricts when user has customerCrmAccountId", async () => {
    userIsSuperuser.mockResolvedValue(false);
    userHasRoleNamed.mockResolvedValue(false);
    findUniqueUser.mockResolvedValue({ customerCrmAccountId: "crm-99" });
    const ctx = await getControlTowerPortalContext("u-cust");
    expect(ctx).toEqual({
      isRestrictedView: true,
      isSupplierPortal: false,
      customerCrmAccountId: "crm-99",
    });
  });

  it("treats missing user row as unrestricted non-portal", async () => {
    userIsSuperuser.mockResolvedValue(false);
    userHasRoleNamed.mockResolvedValue(false);
    findUniqueUser.mockResolvedValue(null);
    const ctx = await getControlTowerPortalContext("u-missing");
    expect(ctx).toEqual({
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
  });
});

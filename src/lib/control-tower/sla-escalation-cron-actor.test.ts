import { afterEach, describe, expect, it, vi } from "vitest";

const findFirstUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: findFirstUser },
  },
}));

import { resolveTenantCronActorUserId } from "./sla-escalation";

describe("resolveTenantCronActorUserId", () => {
  const originalEmail = process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL;

  afterEach(() => {
    findFirstUser.mockReset();
    if (originalEmail === undefined) {
      delete process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL;
    } else {
      process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL = originalEmail;
    }
  });

  it("returns user matched by CONTROL_TOWER_SYSTEM_ACTOR_EMAIL (case-insensitive)", async () => {
    process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL = "  Cron@Example.COM ";
    findFirstUser.mockResolvedValueOnce({ id: "user-by-email" });
    const id = await resolveTenantCronActorUserId("tenant-a");
    expect(id).toBe("user-by-email");
    expect(findFirstUser).toHaveBeenCalledTimes(1);
    expect(findFirstUser).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        isActive: true,
        email: { equals: "cron@example.com", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("falls back to oldest active user when env email is unset", async () => {
    delete process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL;
    findFirstUser.mockResolvedValueOnce({ id: "first-active" });
    const id = await resolveTenantCronActorUserId("tenant-b");
    expect(id).toBe("first-active");
    expect(findFirstUser).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  });

  it("falls back when env email is set but no user matches", async () => {
    process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL = "missing@example.com";
    findFirstUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "fallback" });
    const id = await resolveTenantCronActorUserId("tenant-c");
    expect(id).toBe("fallback");
    expect(findFirstUser).toHaveBeenCalledTimes(2);
  });

  it("returns null when no active users exist", async () => {
    delete process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL;
    findFirstUser.mockResolvedValueOnce(null);
    const id = await resolveTenantCronActorUserId("tenant-d");
    expect(id).toBeNull();
  });
});

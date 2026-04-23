import { describe, expect, it, vi } from "vitest";

import { getSrmOperatorNotificationUnreadCount } from "./srm-operator-notification-unread";

describe("getSrmOperatorNotificationUnreadCount", () => {
  it("counts unread for tenant + user", async () => {
    const countMock = vi.fn().mockResolvedValue(3);
    const prisma = { srmOperatorNotification: { count: countMock } } as never;
    const n = await getSrmOperatorNotificationUnreadCount(prisma, { tenantId: "t1", userId: "u1" });
    expect(n).toBe(3);
    expect(countMock).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1", readAt: null },
    });
  });
});

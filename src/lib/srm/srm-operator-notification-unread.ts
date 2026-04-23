import type { PrismaClient } from "@prisma/client";

/** Unread in-app rows for a tenant user (Phase G; same filter as the notifications list `unread=1`). */
export function getSrmOperatorNotificationUnreadCount(
  prisma: PrismaClient,
  input: { tenantId: string; userId: string },
): Promise<number> {
  return prisma.srmOperatorNotification.count({
    where: { tenantId: input.tenantId, userId: input.userId, readAt: null },
  });
}

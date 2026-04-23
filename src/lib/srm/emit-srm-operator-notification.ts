import type { PrismaClient } from "@prisma/client";

import { isSrmOperatorEmailMirrorEnabled, sendSrmOperatorNotificationEmailMirror } from "@/lib/srm/srm-operator-notification-email-mirror";

export const SRM_NOTIFICATION_KIND = {
  ONBOARDING_TASK_ASSIGNED: "ONBOARDING_TASK_ASSIGNED",
} as const;

/**
 * Persists an in-app row for buyers/operators (Phase G). Optional email mirror when
 * `SRM_OPERATOR_EMAIL_NOTIFICATIONS=1` and Resend env is set — see `srm-operator-notification-email-mirror.ts`.
 */
export async function emitSrmOperatorNotification(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    userId: string;
    kind: string;
    title: string;
    body?: string | null;
    supplierId?: string | null;
    taskId?: string | null;
    actorUserId?: string | null;
  },
): Promise<void> {
  await prisma.srmOperatorNotification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      kind: input.kind.slice(0, 64),
      title: input.title.slice(0, 256),
      body: input.body ?? null,
      supplierId: input.supplierId ?? null,
      taskId: input.taskId ?? null,
      actorUserId: input.actorUserId ?? null,
    },
  });

  if (!isSrmOperatorEmailMirrorEnabled()) return;
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId, isActive: true },
    select: { email: true },
  });
  const to = user?.email?.trim();
  if (!to) return;
  try {
    await sendSrmOperatorNotificationEmailMirror({
      to,
      title: input.title,
      body: input.body ?? null,
    });
  } catch {
    /* best-effort; in-app row is the source of truth */
  }
}

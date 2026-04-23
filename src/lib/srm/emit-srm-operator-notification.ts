import type { PrismaClient } from "@prisma/client";

export const SRM_NOTIFICATION_KIND = {
  ONBOARDING_TASK_ASSIGNED: "ONBOARDING_TASK_ASSIGNED",
} as const;

/**
 * Persists an in-app row for buyers/operators (Phase G). Still local to SRM; email/webhooks stay future.
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
}

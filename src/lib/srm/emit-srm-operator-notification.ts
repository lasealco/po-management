import type { PrismaClient } from "@prisma/client";

import { isSrmOperatorEmailMirrorEnabled, sendSrmOperatorNotificationEmailMirror } from "@/lib/srm/srm-operator-notification-email-mirror";
import { getSrmOperatorWebhookUrl, postSrmOperatorNotificationWebhook } from "@/lib/srm/srm-operator-notification-webhook-mirror";

export const SRM_NOTIFICATION_KIND = {
  ONBOARDING_TASK_ASSIGNED: "ONBOARDING_TASK_ASSIGNED",
} as const;

/**
 * Persists an in-app row for buyers/operators (Phase G). Optional **email** mirror when
 * `SRM_OPERATOR_EMAIL_NOTIFICATIONS=1` and Resend — see `srm-operator-notification-email-mirror.ts`.
 * Optional **webhook** when `SRM_OPERATOR_WEBHOOK_URL` is set — see
 * `srm-operator-notification-webhook-mirror.ts`.
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
  const created = await prisma.srmOperatorNotification.create({
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

  const webhookUrl = getSrmOperatorWebhookUrl();
  const emailOn = isSrmOperatorEmailMirrorEnabled();
  const needExtras = Boolean(webhookUrl) || emailOn;

  let actorName: string | null = null;
  if (needExtras && created.actorUserId) {
    const actor = await prisma.user.findFirst({
      where: { id: created.actorUserId as string, tenantId: input.tenantId, isActive: true },
      select: { name: true },
    });
    actorName = actor?.name?.trim() || null;
  }

  let supplierName: string | null = null;
  let supplierCode: string | null = null;
  if (needExtras && created.supplierId) {
    const sup = await prisma.supplier.findFirst({
      where: { id: created.supplierId, tenantId: input.tenantId },
      select: { name: true, code: true },
    });
    supplierName = sup?.name?.trim() || null;
    const code = sup?.code?.trim();
    supplierCode = code ? code : null;
  }

  if (webhookUrl) {
    await postSrmOperatorNotificationWebhook({
      id: created.id,
      tenantId: created.tenantId,
      userId: created.userId,
      kind: created.kind,
      title: created.title,
      body: created.body,
      supplierId: created.supplierId,
      supplierName,
      supplierCode,
      taskId: created.taskId,
      actorUserId: created.actorUserId,
      actorName,
      createdAt: created.createdAt.toISOString(),
    });
  }

  if (!emailOn) return;
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
      actorName,
      supplierName,
      supplierCode,
    });
  } catch {
    /* best-effort; in-app row is the source of truth */
  }
}

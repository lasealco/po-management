import { prisma } from "@/lib/prisma";
import { scriNotificationHook } from "@/lib/scri/scri-notification-hook";
import type { ScriEventTriagePatch } from "@/lib/scri/schemas/event-triage-patch";

export type TriageApplyResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "BAD_OWNER" | "NO_CHANGES" };

export async function applyScriEventTriagePatch(
  tenantId: string,
  eventId: string,
  actorUserId: string,
  body: ScriEventTriagePatch,
): Promise<TriageApplyResult> {
  const event = await prisma.scriExternalEvent.findFirst({
    where: { id: eventId, tenantId },
    select: {
      id: true,
      reviewState: true,
      ownerUserId: true,
    },
  });
  if (!event) return { ok: false, code: "NOT_FOUND" };

  const nextState = body.reviewState ?? event.reviewState;
  let nextOwner = event.ownerUserId;
  if (body.ownerUserId !== undefined) {
    if (body.ownerUserId === null) {
      nextOwner = null;
    } else {
      const u = await prisma.user.findFirst({
        where: { id: body.ownerUserId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!u) return { ok: false, code: "BAD_OWNER" };
      nextOwner = body.ownerUserId;
    }
  }

  const stateChanged = nextState !== event.reviewState;
  const ownerChanged = nextOwner !== event.ownerUserId;
  const noteTrim = body.note?.trim() ?? "";
  const hasNote = noteTrim.length > 0;

  if (!stateChanged && !ownerChanged && !hasNote) {
    return { ok: false, code: "NO_CHANGES" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.scriExternalEvent.update({
      where: { id: eventId },
      data: { reviewState: nextState, ownerUserId: nextOwner },
    });

    await tx.scriEventReviewLog.create({
      data: {
        tenantId,
        eventId,
        actorUserId,
        reviewStateFrom: event.reviewState,
        reviewStateTo: nextState,
        ownerUserIdFrom: event.ownerUserId,
        ownerUserIdTo: nextOwner,
        note: hasNote ? noteTrim : null,
      },
    });
  });

  if (
    nextState === "ACTION_REQUIRED" &&
    event.reviewState !== "ACTION_REQUIRED"
  ) {
    scriNotificationHook({
      kind: "ACTION_REQUIRED",
      tenantId,
      eventId,
      reviewState: nextState,
      previousReviewState: event.reviewState,
      actorUserId,
    });
  }

  return { ok: true };
}

import { prisma } from "@/lib/prisma";
import { scriSeverityGte } from "@/lib/scri/scri-severity";
import { getScriTuningForTenant } from "@/lib/scri/tuning-repo";

/**
 * When tenant tuning enables automation and `SCR_AUTOMATION_DISABLED` is not set,
 * promote NEW events at/above `automationMinSeverity` to WATCH (audit log uses automation actor).
 */
export async function maybeApplyScriAutoWatchAfterIngest(tenantId: string, eventId: string): Promise<void> {
  const disabled = (process.env.SCR_AUTOMATION_DISABLED ?? "").trim().toLowerCase();
  if (disabled === "1" || disabled === "true") {
    return;
  }

  const { row } = await getScriTuningForTenant(tenantId);
  if (!row?.automationAutoWatch || !row.automationActorUserId) {
    return;
  }

  const event = await prisma.scriExternalEvent.findFirst({
    where: { id: eventId, tenantId },
    select: { reviewState: true, severity: true },
  });
  if (!event || event.reviewState !== "NEW") {
    return;
  }
  if (!scriSeverityGte(event.severity, row.automationMinSeverity)) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.scriExternalEvent.update({
      where: { id: eventId },
      data: { reviewState: "WATCH" },
    });
    await tx.scriEventReviewLog.create({
      data: {
        tenantId,
        eventId,
        actorUserId: row.automationActorUserId!,
        reviewStateFrom: "NEW",
        reviewStateTo: "WATCH",
        ownerUserIdFrom: null,
        ownerUserIdTo: null,
        note: "Automation: auto-watch from Risk intelligence tuning.",
      },
    });
  });
}

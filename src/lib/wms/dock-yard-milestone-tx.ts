import type { Prisma } from "@prisma/client";

import type { WmsDockYardMilestone } from "./dock-appointment";
import { detectMilestonePhaseBreach, parseDockDetentionPolicy } from "./dock-detention";

/** Minimal appointment snapshot for milestone writes + BF-54 detention evaluation. */
export type DockYardMilestoneAppointmentSnapshot = {
  id: string;
  shipmentId: string | null;
  gateCheckedInAt: Date | null;
  atDockAt: Date | null;
};

/**
 * Updates yard timestamps / completes appointment, writes primary audit, optional BF-54 detention breach audit.
 * Caller must enforce SCHEDULED status and BF-38 guards before invoking.
 */
export async function persistDockYardMilestoneWithDetentionAudit(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    appointment: DockYardMilestoneAppointmentSnapshot;
    milestone: WmsDockYardMilestone;
    occurredAt: Date;
    actorUserId: string;
    detentionPolicyJson: unknown | null | undefined;
    primaryAudit: {
      action: string;
      payload: Prisma.InputJsonValue;
    };
  },
): Promise<void> {
  const { tenantId, appointment, milestone, occurredAt, actorUserId, detentionPolicyJson, primaryAudit } =
    params;

  const milestoneData: Prisma.WmsDockAppointmentUpdateInput =
    milestone === "GATE_IN"
      ? { gateCheckedInAt: occurredAt }
      : milestone === "AT_DOCK"
        ? { atDockAt: occurredAt }
        : { departedAt: occurredAt, status: "COMPLETED" };

  await tx.wmsDockAppointment.update({
    where: { id: appointment.id },
    data: milestoneData,
  });

  await tx.ctAuditLog.create({
    data: {
      tenantId,
      shipmentId: appointment.shipmentId,
      entityType: "WMS_DOCK_APPOINTMENT",
      entityId: appointment.id,
      action: primaryAudit.action,
      payload: primaryAudit.payload,
      actorUserId,
    },
  });

  const detentionParsed = parseDockDetentionPolicy(detentionPolicyJson);
  const detentionPolicyForEval = detentionParsed.ok
    ? detentionParsed.value
    : { enabled: false, freeMinutesGateToDock: 120, freeMinutesDockToDepart: 240 };

  const breach =
    milestone === "AT_DOCK" || milestone === "DEPARTED"
      ? detectMilestonePhaseBreach({
          policy: detentionPolicyForEval,
          milestone,
          occurredAt,
          gateCheckedInAt: appointment.gateCheckedInAt,
          atDockAt: milestone === "DEPARTED" ? appointment.atDockAt : null,
        })
      : null;

  if (breach) {
    await tx.ctAuditLog.create({
      data: {
        tenantId,
        shipmentId: appointment.shipmentId,
        entityType: "WMS_DOCK_APPOINTMENT",
        entityId: appointment.id,
        action: "dock_detention_breach",
        payload: {
          phase: breach.phase,
          actualMinutes: breach.actualMinutes,
          limitMinutes: breach.limitMinutes,
          milestone,
          occurredAt: occurredAt.toISOString(),
        },
        actorUserId,
      },
    });
  }
}

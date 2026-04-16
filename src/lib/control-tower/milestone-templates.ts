/**
 * Spec-style milestone packs (see docs/controltower/control_tower_milestone_template_catalog_*.pdf).
 * Anchors derive planned dates from booking or shipment timestamps; rows are skipped when the anchor is missing.
 */

import { prisma } from "@/lib/prisma";

import { writeCtAudit } from "./audit";

export type MilestonePackId = "OCEAN_PORT_TO_PORT" | "AIR_ORIGIN_TO_DEST";

export type MilestoneAnchor =
  | "SHIPMENT_CREATED"
  | "BOOKING_ETD"
  | "BOOKING_ETA"
  | "BOOKING_LATEST_ETA";

export type MilestoneTemplateDef = {
  code: string;
  label: string;
  anchor: MilestoneAnchor;
  /** Calendar days after (or before if negative) the anchor instant. */
  offsetDays: number;
};

export const MILESTONE_PACKS: Record<
  MilestonePackId,
  { title: string; description: string; milestones: MilestoneTemplateDef[] }
> = {
  OCEAN_PORT_TO_PORT: {
    title: "Ocean — port to port",
    description:
      "Booking-driven cutoffs and port milestones (cargo ready, documentation, sail, arrival, release).",
    milestones: [
      { code: "BOOKING_CONFIRMED", label: "Booking confirmed", anchor: "SHIPMENT_CREATED", offsetDays: 0 },
      { code: "CARGO_READY", label: "Cargo ready / factory gate", anchor: "BOOKING_ETD", offsetDays: -10 },
      { code: "EXPORT_CUSTOMS_FILED", label: "Export customs filed", anchor: "BOOKING_ETD", offsetDays: -5 },
      { code: "POL_DEPARTURE", label: "Port of loading departure", anchor: "BOOKING_ETD", offsetDays: 0 },
      { code: "POD_ARRIVAL", label: "Port of discharge arrival", anchor: "BOOKING_ETA", offsetDays: 0 },
      { code: "IMPORT_CUSTOMS_RELEASE", label: "Import customs released", anchor: "BOOKING_ETA", offsetDays: 2 },
      { code: "DELIVERY_AVAILABLE", label: "Delivery slot / available", anchor: "BOOKING_LATEST_ETA", offsetDays: 0 },
    ],
  },
  AIR_ORIGIN_TO_DEST: {
    title: "Air — origin to destination",
    description: "Tighter air milestones around ETD/ETA windows.",
    milestones: [
      { code: "BOOKING_CONFIRMED", label: "Booking confirmed", anchor: "SHIPMENT_CREATED", offsetDays: 0 },
      { code: "CARGO_RECEIVED_ORIGIN", label: "Cargo received at origin", anchor: "BOOKING_ETD", offsetDays: -2 },
      { code: "FLIGHT_DEPARTURE", label: "Flight departure", anchor: "BOOKING_ETD", offsetDays: 0 },
      { code: "FLIGHT_ARRIVAL", label: "Flight arrival", anchor: "BOOKING_ETA", offsetDays: 0 },
      { code: "DESTINATION_CUSTOMS", label: "Destination customs cleared", anchor: "BOOKING_ETA", offsetDays: 1 },
    ],
  },
};

export function listMilestonePackSummaries(): Array<{
  id: MilestonePackId;
  title: string;
  description: string;
  milestoneCount: number;
}> {
  return (Object.keys(MILESTONE_PACKS) as MilestonePackId[]).map((id) => {
    const p = MILESTONE_PACKS[id];
    return { id, title: p.title, description: p.description, milestoneCount: p.milestones.length };
  });
}

function isPackId(v: string): v is MilestonePackId {
  return v === "OCEAN_PORT_TO_PORT" || v === "AIR_ORIGIN_TO_DEST";
}

function anchorDate(
  anchor: MilestoneAnchor,
  ctx: {
    createdAt: Date;
    etd: Date | null;
    eta: Date | null;
    latestEta: Date | null;
  },
): Date | null {
  switch (anchor) {
    case "SHIPMENT_CREATED":
      return ctx.createdAt;
    case "BOOKING_ETD":
      return ctx.etd;
    case "BOOKING_ETA":
      return ctx.eta;
    case "BOOKING_LATEST_ETA":
      return ctx.latestEta ?? ctx.eta;
    default:
      return null;
  }
}

/**
 * Creates CtTrackingMilestone rows for codes not yet present on the shipment.
 * Does not overwrite existing codes (manual or prior template apply).
 */
export async function applyCtMilestonePack(params: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
  packId: string;
}): Promise<{ created: number; skipped: number }> {
  const { tenantId, shipmentId, actorUserId, packId } = params;
  if (!isPackId(packId)) {
    throw new Error("Invalid milestone pack.");
  }
  const pack = MILESTONE_PACKS[packId];

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId } },
    select: {
      createdAt: true,
      booking: {
        select: { etd: true, eta: true, latestEta: true },
      },
    },
  });
  if (!shipment) {
    throw new Error("Shipment not found.");
  }

  const existing = await prisma.ctTrackingMilestone.findMany({
    where: { tenantId, shipmentId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((e) => e.code));

  const ctx = {
    createdAt: shipment.createdAt,
    etd: shipment.booking?.etd ?? null,
    eta: shipment.booking?.eta ?? null,
    latestEta: shipment.booking?.latestEta ?? null,
  };

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const def of pack.milestones) {
      if (existingCodes.has(def.code)) {
        skipped += 1;
        continue;
      }
      const base = anchorDate(def.anchor, ctx);
      if (!base) {
        skipped += 1;
        continue;
      }
      const plannedAt = new Date(base.getTime() + def.offsetDays * 86_400_000);
      await tx.ctTrackingMilestone.create({
        data: {
          tenantId,
          shipmentId,
          code: def.code,
          label: def.label,
          plannedAt,
          predictedAt: null,
          actualAt: null,
          sourceType: "TEMPLATE",
          sourceRef: packId,
          confidence: null,
          notes: `From pack: ${pack.title}`,
          updatedById: actorUserId,
        },
      });
      existingCodes.add(def.code);
      created += 1;
    }
  });

  await writeCtAudit({
    tenantId,
    shipmentId,
    entityType: "CtTrackingMilestone",
    entityId: packId,
    action: "apply_ct_milestone_pack",
    actorUserId,
    payload: { packId, created, skipped },
  });

  return { created, skipped };
}

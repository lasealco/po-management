/**
 * Milestone template packs (docs/controltower/control_tower_milestone_template_catalog_*.pdf).
 * Built-in definitions are merged with optional per-tenant rows in `CtMilestoneTemplatePack` (DB overrides / extensions).
 */

import { prisma } from "@/lib/prisma";

import { writeCtAudit } from "./audit";

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

export type BuiltInPackMeta = {
  title: string;
  description: string;
  milestones: MilestoneTemplateDef[];
};

/** Fallback when DB has no row for a slug (e.g. fresh tenant before seed). */
export const BUILT_IN_MILESTONE_PACKS: Record<string, BuiltInPackMeta> = {
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
  RAIL_TERMINAL_TO_TERMINAL: {
    title: "Rail — terminal to terminal",
    description: "Intermodal rail handoffs and arrival milestones (aligned with CT rail mode).",
    milestones: [
      { code: "BOOKING_CONFIRMED", label: "Booking confirmed", anchor: "SHIPMENT_CREATED", offsetDays: 0 },
      { code: "RAIL_ORIGIN_DEPARTURE", label: "Origin rail departure", anchor: "BOOKING_ETD", offsetDays: 0 },
      { code: "RAIL_INTERCHANGE", label: "Interchange / handoff", anchor: "BOOKING_ETD", offsetDays: 3 },
      { code: "RAIL_DESTINATION_ARRIVAL", label: "Destination rail arrival", anchor: "BOOKING_ETA", offsetDays: 0 },
      { code: "FINAL_MILE_READY", label: "Final mile / truck ready", anchor: "BOOKING_LATEST_ETA", offsetDays: 0 },
    ],
  },
};

const ANCHORS: MilestoneAnchor[] = [
  "SHIPMENT_CREATED",
  "BOOKING_ETD",
  "BOOKING_ETA",
  "BOOKING_LATEST_ETA",
];

function parseMilestoneSteps(raw: unknown): MilestoneTemplateDef[] {
  if (!Array.isArray(raw)) throw new Error("Pack milestones must be a JSON array.");
  return raw.map((row, i) => {
    if (!row || typeof row !== "object") throw new Error(`Invalid milestone at index ${i}.`);
    const o = row as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const anchor = o.anchor;
    const offsetDays = typeof o.offsetDays === "number" && Number.isFinite(o.offsetDays) ? Math.floor(o.offsetDays) : NaN;
    if (!code) throw new Error(`Milestone at ${i} missing code.`);
    if (!ANCHORS.includes(anchor as MilestoneAnchor)) throw new Error(`Milestone ${code}: invalid anchor.`);
    if (!Number.isFinite(offsetDays)) throw new Error(`Milestone ${code}: invalid offsetDays.`);
    return {
      code,
      label: label || code,
      anchor: anchor as MilestoneAnchor,
      offsetDays,
    };
  });
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

export type MilestonePackCatalogEntry = {
  id: string;
  title: string;
  description: string;
  milestoneCount: number;
};

export async function listMilestonePackCatalogForTenant(tenantId: string): Promise<MilestonePackCatalogEntry[]> {
  const dbRows = await prisma.ctMilestoneTemplatePack.findMany({
    where: { tenantId },
    orderBy: [{ slug: "asc" }],
  });
  const dbBySlug = new Map(dbRows.map((r) => [r.slug, r]));
  const out: MilestonePackCatalogEntry[] = [];
  const builtInOrder = Object.keys(BUILT_IN_MILESTONE_PACKS);
  for (const slug of builtInOrder) {
    const row = dbBySlug.get(slug);
    dbBySlug.delete(slug);
    if (row) {
      const steps = parseMilestoneSteps(row.milestones);
      out.push({
        id: row.slug,
        title: row.title,
        description: row.description ?? "",
        milestoneCount: steps.length,
      });
    } else {
      const b = BUILT_IN_MILESTONE_PACKS[slug]!;
      out.push({
        id: slug,
        title: b.title,
        description: b.description,
        milestoneCount: b.milestones.length,
      });
    }
  }
  for (const row of dbBySlug.values()) {
    const steps = parseMilestoneSteps(row.milestones);
    out.push({
      id: row.slug,
      title: row.title,
      description: row.description ?? "",
      milestoneCount: steps.length,
    });
  }
  return out;
}

export async function getMilestonePackForApply(
  tenantId: string,
  packSlug: string,
): Promise<{ title: string; milestones: MilestoneTemplateDef[] }> {
  const slug = packSlug.trim();
  if (!slug) throw new Error("packId required.");
  const db = await prisma.ctMilestoneTemplatePack.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
  });
  if (db) {
    return { title: db.title, milestones: parseMilestoneSteps(db.milestones) };
  }
  const built = BUILT_IN_MILESTONE_PACKS[slug];
  if (built) {
    return { title: built.title, milestones: built.milestones };
  }
  throw new Error("Unknown milestone pack.");
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
  const { title, milestones } = await getMilestonePackForApply(tenantId, packId);

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
    for (const def of milestones) {
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
          sourceRef: packId.trim(),
          confidence: null,
          notes: `From pack: ${title}`,
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
    entityId: packId.trim(),
    action: "apply_ct_milestone_pack",
    actorUserId,
    payload: { packId: packId.trim(), created, skipped },
  });

  return { created, skipped };
}

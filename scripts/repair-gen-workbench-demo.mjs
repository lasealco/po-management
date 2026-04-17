#!/usr/bin/env node
/**
 * Backfill Control Tower data for bulk GEN demo shipments created before
 * booking / legs / milestones were added to bulk-seed.
 *
 * Targets: shipmentNo ILIKE 'ASN-GEN-%' on orders GEN-* (demo-company tenant).
 * Idempotent: safe to run multiple times.
 *
 *   npm run db:repair:gen-workbench
 *   npm run db:repair:gen-workbench -- --dry-run
 *   npm run db:repair:gen-workbench -- --limit=50
 *
 * Env (optional):
 *   TENANT_SLUG=demo-company   (default)
 *   REPAIR_CT_ALERTS=1         create a sample OPEN alert on ~16% of rows (only if shipment has zero alerts)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const MILESTONE_CODES = [
  "PICKUP_CONFIRMED",
  "IN_TRANSIT_MAIN",
  "DELIVERED_FINAL",
];

const MODES = ["OCEAN", "AIR", "ROAD", "RAIL"];
const LANE_ORIGINS = ["CNSHA", "CNNGB", "USNYC", "SGSIN"];
const LANE_DESTS = ["USLAX", "DEHAM", "NLRTM", "AUMEL"];

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[repair-gen-workbench] Missing DATABASE_URL (.env / .env.local or shell).",
  );
  process.exit(1);
}

/** @param {string} key */
function stablePick(key, arr) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return arr[Math.abs(h) % arr.length];
}

/** @param {string} key */
function stableUnitInterval(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   dryRun: boolean;
 *   limit: number | null;
 *   tenantSlug: string;
 *   repairAlerts: boolean;
 * }} opts
 */
async function main(prisma, opts) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: opts.tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    console.error(`[repair-gen-workbench] Tenant not found: ${opts.tenantSlug}`);
    process.exit(1);
  }

  const buyer = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "buyer@demo-company.com" },
    select: { id: true },
  });
  if (!buyer) {
    console.error(
      "[repair-gen-workbench] buyer@demo-company.com not found — run db:seed first.",
    );
    process.exit(1);
  }

  const demoCustomer = await prisma.crmAccount.findFirst({
    where: { tenantId: tenant.id, name: "Demo Logistics Customer" },
    select: { id: true },
  });

  const take = opts.limit ?? undefined;

  const candidates = await prisma.shipment.findMany({
    where: {
      shipmentNo: { startsWith: "ASN-GEN-", mode: "insensitive" },
      order: {
        tenantId: tenant.id,
        orderNumber: { startsWith: "GEN-", mode: "insensitive" },
      },
    },
    take,
    select: {
      id: true,
      shipmentNo: true,
      status: true,
      shippedAt: true,
      receivedAt: true,
      expectedReceiveAt: true,
      transportMode: true,
      carrier: true,
      customerCrmAccountId: true,
      createdById: true,
      booking: { select: { id: true } },
      ctTrackingMilestones: {
        where: { code: { in: MILESTONE_CODES } },
        select: { code: true },
      },
      _count: {
        select: {
          ctLegs: true,
          ctAlerts: true,
        },
      },
    },
  });

  let wouldRepair = 0;
  let repaired = 0;
  let skipped = 0;
  let errors = 0;

  for (const s of candidates) {
    const needsBooking = !s.booking;
    const needsLegs = s._count.ctLegs < 2;
    const needsMilestones = s.ctTrackingMilestones.length < MILESTONE_CODES.length;
    const assignCustomer =
      Boolean(demoCustomer) && stableUnitInterval(s.id) < 0.4;
    const needsMeta =
      !s.expectedReceiveAt ||
      (!s.customerCrmAccountId && assignCustomer);

    if (!needsBooking && !needsLegs && !needsMilestones && !needsMeta) {
      skipped += 1;
      continue;
    }
    wouldRepair += 1;

    if (opts.dryRun) {
      console.log(
        `[dry-run] ${s.shipmentNo ?? s.id} booking=${needsBooking} legs=${needsLegs} milestones=${needsMilestones} meta=${needsMeta}`,
      );
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const transportMode =
          s.transportMode ?? stablePick(s.id, MODES);
        const originCode = stablePick(`${s.id}:o`, LANE_ORIGINS);
        const destinationCode = stablePick(`${s.id}:d`, LANE_DESTS);
        const etd = new Date(s.shippedAt.getTime() - 2 * 86400000);
        const eta = new Date(s.shippedAt.getTime() + 10 * 86400000);
        const receivedLike = s.status === "RECEIVED";
        const preMovement = [
          "BOOKING_DRAFT",
          "BOOKING_SUBMITTED",
          "BOOKED",
        ].includes(s.status);
        const shippedLike = [
          "SHIPPED",
          "IN_TRANSIT",
          "DELIVERED",
          "RECEIVED",
        ].includes(s.status);

        const leg1Eta = new Date(
          Math.min(eta.getTime() - 3 * 86400000, etd.getTime() + 3 * 86400000),
        );
        const leg2Etd = new Date(leg1Eta.getTime() + 6 * 3600000);

        const expectedReceiveAt =
          s.expectedReceiveAt ?? s.receivedAt ?? eta;
        const customerCrmAccountId =
          s.customerCrmAccountId ??
          (assignCustomer && demoCustomer ? demoCustomer.id : undefined);

        /** @type {import("@prisma/client").Prisma.ShipmentUpdateInput} */
        const shipmentPatch = {};
        if (!s.expectedReceiveAt) {
          shipmentPatch.expectedReceiveAt = expectedReceiveAt;
        }
        if (!s.customerCrmAccountId && assignCustomer && demoCustomer) {
          shipmentPatch.customerCrmAccountId = customerCrmAccountId;
        }
        if (Object.keys(shipmentPatch).length > 0) {
          await tx.shipment.update({
            where: { id: s.id },
            data: shipmentPatch,
          });
        }

        if (needsBooking) {
          await tx.shipmentBooking.create({
            data: {
              shipmentId: s.id,
              status: "CONFIRMED",
              originCode,
              destinationCode,
              mode: transportMode,
              etd,
              eta,
              latestEta: eta,
              createdById: buyer.id,
              updatedById: buyer.id,
            },
          });
        }

        if (needsLegs) {
          await tx.ctShipmentLeg.deleteMany({ where: { shipmentId: s.id } });
          await tx.ctShipmentLeg.createMany({
            data: [
              {
                tenantId: tenant.id,
                shipmentId: s.id,
                legNo: 1,
                originCode,
                destinationCode: "HUB",
                transportMode,
                carrier: s.carrier ?? undefined,
                plannedEtd: etd,
                plannedEta: leg1Eta,
                actualAtd: preMovement ? null : etd,
                actualAta: shippedLike ? leg1Eta : null,
              },
              {
                tenantId: tenant.id,
                shipmentId: s.id,
                legNo: 2,
                originCode: "HUB",
                destinationCode,
                transportMode,
                carrier: s.carrier ?? undefined,
                plannedEtd: leg2Etd,
                plannedEta: eta,
                actualAtd: ["IN_TRANSIT", "DELIVERED", "RECEIVED"].includes(
                  s.status,
                )
                  ? leg2Etd
                  : null,
                actualAta: receivedLike ? s.receivedAt ?? eta : null,
              },
            ],
          });
        }

        if (needsMilestones) {
          await tx.ctTrackingMilestone.deleteMany({
            where: { shipmentId: s.id, code: { in: MILESTONE_CODES } },
          });
          await tx.ctTrackingMilestone.createMany({
            data: [
              {
                tenantId: tenant.id,
                shipmentId: s.id,
                code: "PICKUP_CONFIRMED",
                label: "Pickup confirmed",
                plannedAt: etd,
                predictedAt: etd,
                actualAt: preMovement ? null : etd,
                sourceType: "SIMULATED",
                confidence: 72,
                notes: "Repair script baseline (GEN bulk workbench).",
                updatedById: buyer.id,
              },
              {
                tenantId: tenant.id,
                shipmentId: s.id,
                code: "IN_TRANSIT_MAIN",
                label: "Main leg in transit",
                plannedAt: leg2Etd,
                predictedAt: leg2Etd,
                actualAt: ["IN_TRANSIT", "DELIVERED", "RECEIVED"].includes(
                  s.status,
                )
                  ? leg2Etd
                  : null,
                sourceType: "SIMULATED",
                confidence: 70,
                notes: "Repair script baseline (GEN bulk workbench).",
                updatedById: buyer.id,
              },
              {
                tenantId: tenant.id,
                shipmentId: s.id,
                code: "DELIVERED_FINAL",
                label: "Final delivery",
                plannedAt: eta,
                predictedAt: eta,
                actualAt: receivedLike ? s.receivedAt ?? eta : null,
                sourceType: "SIMULATED",
                confidence: 68,
                notes: "Repair script baseline (GEN bulk workbench).",
                updatedById: buyer.id,
              },
            ],
          });
        }

        if (
          opts.repairAlerts &&
          s._count.ctAlerts === 0 &&
          stableUnitInterval(`${s.id}:alert`) < 0.16
        ) {
          await tx.ctAlert.create({
            data: {
              tenantId: tenant.id,
              shipmentId: s.id,
              type: "TRANSIT_RISK",
              severity: "WARN",
              title: "Schedule check",
              body: `Repair script — workbench owner sample (${originCode} → ${destinationCode}).`,
              ownerUserId: buyer.id,
              status: "OPEN",
            },
          });
        }
      });
      repaired += 1;
    } catch (e) {
      errors += 1;
      console.error(
        `[repair-gen-workbench] FAILED ${s.shipmentNo ?? s.id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `[repair-gen-workbench] candidates=${candidates.length} wouldRepair=${wouldRepair} repaired=${repaired} skipped=${skipped} errors=${errors}${opts.dryRun ? " (dry-run)" : ""}`,
  );
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null;
if (limitArg && (!Number.isFinite(limit) || limit < 1)) {
  console.error("[repair-gen-workbench] Invalid --limit=N");
  process.exit(1);
}

const tenantSlug = process.env.TENANT_SLUG?.trim() || "demo-company";
const repairAlerts = process.env.REPAIR_CT_ALERTS === "1";

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

try {
  await main(prisma, { dryRun, limit, tenantSlug, repairAlerts });
} finally {
  await prisma.$disconnect().catch(() => {});
}

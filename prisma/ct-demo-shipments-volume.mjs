/**
 * Control Tower / logistics volume demo: 3000 shipments on unique POs.
 *
 * Timeline (~14 months): from ~12 months ago through ~1 month in the future
 * (booking ETA / activity spread across that window).
 *
 * Mixed transport modes and delivery performance (on-time, late, overdue in-transit, future).
 *
 * Requires a seeded demo tenant (`npm run db:seed`) and a DB schema in sync with
 * the repo (`npm run db:migrate` / `db:migrate:deploy`). If Prisma reports a missing
 * column, apply migrations first.
 *
 *   npm run db:seed:ct-volume
 *   CT_VOL_COUNT=500 node prisma/ct-demo-shipments-volume.mjs   # smaller test
 *
 * Env note: `prisma migrate deploy` uses prisma.config.ts and effectively reads `.env`
 * (not `.env.local`). This script defaults the same way so migrations and seed hit the
 * same database. To use `DATABASE_URL` from `.env.local` (e.g. Neon only there), run:
 *   USE_DOTENV_LOCAL=1 npm run db:seed:ct-volume
 * Then run `npm run db:migrate` with that same URL (or migrate Neon in CI).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
if (process.env.USE_DOTENV_LOCAL === "1" || process.env.USE_DOTENV_LOCAL === "true") {
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}
if (cliDatabaseUrl) process.env.DATABASE_URL = cliDatabaseUrl;

/** Same precedence as prisma.config.ts datasource */
const connectionString =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("[ct-volume] Missing DATABASE_URL (or DATABASE_URL_UNPOOLED / DIRECT_URL).");
  process.exit(1);
}

try {
  const u = new URL(connectionString.replace(/^postgresql:/, "postgres:"));
  console.log(
    `[ct-volume] Connecting to ${u.hostname}${u.port ? `:${u.port}` : ""} /${u.pathname.replace(/^\//, "") || "db"}`,
  );
} catch {
  console.log("[ct-volume] Connecting (URL host not logged).");
}
if (!process.env.USE_DOTENV_LOCAL) {
  console.log("[ct-volume] Env: .env only (matches prisma migrate). USE_DOTENV_LOCAL=1 merges .env.local.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString,
    }),
  ),
});

const ORDER_PREFIX = "VOL3K-";
const DAY_MS = 86_400_000;

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

/** ~12 months past → ~1 month future (14 months span). */
function windowBounds() {
  const now = Date.now();
  const start = now - 365 * DAY_MS;
  const end = now + 31 * DAY_MS;
  return { start, end, now };
}

const MODES = ["OCEAN", "AIR", "ROAD", "RAIL"];
const MODE_WEIGHT = [0.42, 0.28, 0.22, 0.08];

function pickMode(rand) {
  const r = rand();
  let c = 0;
  for (let i = 0; i < MODE_WEIGHT.length; i += 1) {
    c += MODE_WEIGHT[i];
    if (r < c) return MODES[i];
  }
  return "OCEAN";
}

const ROUTES = [
  ["CNSHA", "USLAX"],
  ["SGSIN", "NLRTM"],
  ["INNSA", "DEHAM"],
  ["USNYC", "GBFXT"],
  ["KRPUS", "MXZLO"],
  ["VNHPH", "AUMEL"],
  ["CNSZX", "CAHAL"],
];

const CARRIERS = ["Maersk Demo", "CMA CGM Demo", "MSC Demo", "ONE Line", "Hapag-Lloyd", "DHL Global", "FedEx Freight"];

/**
 * @param {number} i
 * @param {number} total
 * @param {() => number} rand
 * @param {{ start: number; end: number; now: number }} win
 */
function buildShipmentScenario(i, total, rand, win) {
  const span = win.end - win.start;
  const denom = Math.max(1, total - 1);
  const baseT = win.start + (i / denom) * span + (rand() - 0.5) * 8 * DAY_MS;
  const clamped = Math.min(win.end, Math.max(win.start, baseT));

  const bucket = i % 11;
  /** @type {import("@prisma/client").ShipmentStatus} */
  let status;
  let receivedAt = null;
  let etaMs = clamped + (5 + rand() * 18) * DAY_MS;

  if (bucket <= 2) {
    status = "RECEIVED";
    etaMs = clamped + 14 * DAY_MS;
    receivedAt = new Date(etaMs - (1 + rand() * 3) * DAY_MS);
  } else if (bucket <= 4) {
    status = rand() < 0.5 ? "DELIVERED" : "RECEIVED";
    etaMs = clamped + 12 * DAY_MS;
    receivedAt = new Date(etaMs + (2 + rand() * 10) * DAY_MS);
  } else if (bucket === 5) {
    status = pick(["IN_TRANSIT", "IN_TRANSIT", "BOOKED"], rand);
    etaMs = win.now - (1 + rand() * 20) * DAY_MS;
  } else if (bucket === 6) {
    status = pick(["BOOKED", "VALIDATED", "SHIPPED"], rand);
    etaMs = win.now + (3 + rand() * 26) * DAY_MS;
  } else if (bucket === 7) {
    status = "IN_TRANSIT";
    etaMs = win.now + (5 + rand() * 18) * DAY_MS;
  } else if (bucket === 8) {
    status = pick(["VALIDATED", "BOOKED"], rand);
    etaMs = win.now + (8 + rand() * 22) * DAY_MS;
  } else if (bucket === 9) {
    status = "DELIVERED";
    etaMs = clamped + 10 * DAY_MS;
    receivedAt = new Date(etaMs - (0.5 + rand() * 2) * DAY_MS);
  } else {
    status = pick(["SHIPPED", "IN_TRANSIT"], rand);
    etaMs = clamped + (7 + rand() * 21) * DAY_MS;
    if (rand() < 0.35 && etaMs < win.now) {
      receivedAt = new Date(etaMs + rand() * 4 * DAY_MS);
      status = rand() < 0.6 ? "RECEIVED" : "DELIVERED";
    }
  }

  const etdMs = etaMs - (14 + rand() * 10) * DAY_MS;
  const latestEtaMs = etaMs + (rand() < 0.25 ? (rand() - 0.5) * 4 * DAY_MS : 0);

  const shippedAt = new Date(clamped);
  const createdAt = new Date(clamped - (1 + rand() * 5) * DAY_MS);

  return {
    status,
    shippedAt,
    createdAt,
    receivedAt,
    etd: new Date(etdMs),
    eta: new Date(etaMs),
    latestEta: new Date(latestEtaMs),
  };
}

async function main() {
  const total = Math.min(10_000, Math.max(1, Number(process.env.CT_VOL_COUNT || 3000)));
  const rand = mulberry32(0xdeed3000);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-company" },
    select: { id: true },
  });
  if (!tenant) {
    console.error('[ct-volume] Tenant "demo-company" not found. Run npm run db:seed first.');
    process.exit(1);
  }

  const buyer = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "buyer@demo-company.com" },
    select: { id: true },
  });
  if (!buyer) {
    console.error("[ct-volume] buyer@demo-company.com not found.");
    process.exit(1);
  }

  const wf = await prisma.workflow.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: "SUPPLIER_CONFIRM" } },
    select: { id: true },
  });
  if (!wf) {
    console.error("[ct-volume] SUPPLIER_CONFIRM workflow not found.");
    process.exit(1);
  }
  const fulfilled = await prisma.workflowStatus.findUnique({
    where: { workflowId_code: { workflowId: wf.id, code: "FULFILLED" } },
    select: { id: true },
  });
  if (!fulfilled) {
    console.error("[ct-volume] FULFILLED status not found.");
    process.exit(1);
  }

  const supplier = await prisma.supplier.findFirst({
    where: { tenantId: tenant.id, code: "SUP-001" },
    select: { id: true },
  });
  const supplierId = supplier?.id ?? null;

  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const productId = product?.id ?? null;

  const win = windowBounds();

  const existing = await prisma.purchaseOrder.count({
    where: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
  });
  if (existing > 0) {
    const del = await prisma.purchaseOrder.deleteMany({
      where: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
    });
    console.log(`[ct-volume] Removed ${del.count} prior ${ORDER_PREFIX}* order(s) (cascaded shipments).`);
  }

  const BATCH = 20;
  console.log(`[ct-volume] Creating ${total} orders + shipments + bookings (+ optional legs)…`);

  for (let start = 0; start < total; start += BATCH) {
    const end = Math.min(start + BATCH, total);
    await prisma.$transaction(
      async (tx) => {
        for (let i = start; i < end; i += 1) {
          const orderNumber = `${ORDER_PREFIX}${String(i + 1).padStart(7, "0")}`;
          const sc = buildShipmentScenario(i, total, rand, win);
          const mode = pickMode(rand);
          const [originCode, destinationCode] = pick(ROUTES, rand);
          const subtotal = (150 + Math.floor(rand() * 8500)).toFixed(2);
          const tax = (Number(subtotal) * 0.08).toFixed(2);
          const orderTotal = (Number(subtotal) + Number(tax)).toFixed(2);
          const lineQty = (2 + Math.floor(rand() * 80)).toFixed(3);
          const unitPrice = (Number(subtotal) / Number(lineQty)).toFixed(4);

          const po = await tx.purchaseOrder.create({
            data: {
              tenantId: tenant.id,
              orderNumber,
              title: `Volume demo ${orderNumber}`,
              workflowId: wf.id,
              statusId: fulfilled.id,
              requesterId: buyer.id,
              supplierId,
              currency: rand() < 0.9 ? "USD" : "EUR",
              subtotal,
              taxAmount: tax,
              totalAmount: orderTotal,
              incoterm: pick(["FOB", "CIF", "EXW"], rand),
              shipToName: "Demo Receiving",
              shipToCity: "Chicago",
              shipToRegion: "IL",
              shipToPostalCode: "60601",
              shipToCountryCode: "US",
              createdAt: sc.createdAt,
              items: {
                create: [
                  {
                    lineNo: 1,
                    productId,
                    description: productId ? "Volume demo line" : "Non-catalog demo line",
                    quantity: lineQty,
                    unitPrice,
                    lineTotal: subtotal,
                  },
                ],
              },
            },
            include: { items: { where: { lineNo: 1 }, take: 1 } },
          });

          const line = po.items[0];
          const qShip = line.quantity;

          const ship = await tx.shipment.create({
            data: {
              orderId: po.id,
              shipmentNo: `V3K-${String(i + 1).padStart(7, "0")}`,
              status: sc.status,
              shippedAt: sc.shippedAt,
              receivedAt: sc.receivedAt,
              carrier: pick(CARRIERS, rand),
              trackingNo: `V3KTRK${String(1_000_000 + i)}`,
              transportMode: mode,
              estimatedVolumeCbm: new Prisma.Decimal((3 + rand() * 40).toFixed(3)),
              estimatedWeightKg: new Prisma.Decimal((200 + rand() * 12_000).toFixed(3)),
              createdById: buyer.id,
              createdAt: sc.createdAt,
              items: {
                create: [
                  {
                    orderItemId: line.id,
                    quantityShipped: qShip,
                    quantityReceived:
                      sc.receivedAt != null
                        ? qShip
                        : rand() < 0.12
                          ? new Prisma.Decimal(Number(qShip) * 0.25).toDecimalPlaces(3)
                          : new Prisma.Decimal(0),
                    plannedShipDate: sc.etd,
                  },
                ],
              },
            },
          });

          await tx.shipmentBooking.create({
            data: {
              shipmentId: ship.id,
              status: "CONFIRMED",
              mode,
              originCode,
              destinationCode,
              etd: sc.etd,
              eta: sc.eta,
              latestEta: sc.latestEta,
              bookingNo: `BK-V3K-${String(i + 1).padStart(7, "0")}`,
              createdById: buyer.id,
              updatedById: buyer.id,
            },
          });

          const legRoll = rand();
          if (legRoll < 0.65) {
            const legMode = mode;
            const hasActual = sc.status === "RECEIVED" || sc.status === "DELIVERED";
            const plannedEtd = sc.etd;
            const plannedEta = sc.eta;
            await tx.ctShipmentLeg.create({
              data: {
                tenantId: tenant.id,
                shipmentId: ship.id,
                legNo: 1,
                originCode,
                destinationCode,
                carrier: pick(CARRIERS, rand),
                transportMode: legMode,
                plannedEtd,
                plannedEta,
                actualAtd: hasActual && rand() < 0.85 ? new Date(plannedEtd.getTime() + rand() * 2 * DAY_MS) : null,
                actualAta:
                  hasActual && rand() < 0.8 ? new Date(plannedEta.getTime() + (rand() - 0.3) * 3 * DAY_MS) : null,
              },
            });
          }
        }
      },
      { maxWait: 120_000, timeout: 300_000 },
    );
    if (end % 200 === 0 || end === total) {
      console.log(`[ct-volume] … ${end}/${total}`);
    }
  }

  console.log(`[ct-volume] Done. ${total} shipments with prefix ${ORDER_PREFIX} / V3K-* on tenant demo-company.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

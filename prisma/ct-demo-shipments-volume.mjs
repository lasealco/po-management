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
const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "45HC", "LCL"];
const SERVICE_LEVELS = ["STANDARD", "EXPRESS", "DEFERRED"];

function makeContainerNumber(i, n) {
  return `MSCU${String(2000000 + i * 3 + n).padStart(7, "0")}`;
}

function maybeRound(v, n = 3) {
  return new Prisma.Decimal(Number(v).toFixed(n));
}

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

async function assertControlTowerSchemaReady() {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Shipment'
        AND column_name = 'customerCrmAccountId'
    ) AS ok
  `;
  const ok = Array.isArray(rows) && rows[0]?.ok === true;
  if (!ok) {
    console.error(
      "[ct-volume] This database is missing column Shipment.customerCrmAccountId (migrations not applied here).",
    );
    console.error("  Run migrations against the SAME database as this script (see host in the log above):");
    console.error("    npm run db:migrate");
    console.error("  If you use Neon: copy DATABASE_URL (or DATABASE_URL_UNPOOLED) from .env.local into the");
    console.error("  shell, or run:  DATABASE_URL='postgresql://…neon…' npm run db:migrate");
    process.exit(1);
  }
}

async function main() {
  const total = Math.min(10_000, Math.max(1, Number(process.env.CT_VOL_COUNT || 3000)));
  const rand = mulberry32(0xdeed3000);

  await assertControlTowerSchemaReady();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-company" },
    select: { id: true },
  });
  if (!tenant) {
    console.error('[ct-volume] Tenant "demo-company" not found.');
    console.error("  Run base seed against this same database:");
    console.error("    npm run db:seed");
    console.error("  If demo data lives on Neon (DATABASE_URL in .env.local only):");
    console.error("    USE_DOTENV_LOCAL=1 npm run db:seed");
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
  const crmAccounts = await prisma.crmAccount.findMany({
    where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
    select: { id: true, name: true, legalName: true },
    take: 120,
  });
  const crmPool = crmAccounts.length > 0 ? crmAccounts : [{ id: null, name: "Demo Logistics Customer", legalName: null }];

  const win = windowBounds();

  const existing = await prisma.purchaseOrder.count({
    where: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
  });
  if (existing > 0) {
    const priorOrders = await prisma.purchaseOrder.findMany({
      where: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
      select: { id: true },
    });
    const priorOrderIds = priorOrders.map((o) => o.id);
    const CHUNK = 200;
    const LINE_CHUNK = 300;
    let removedLines = 0;
    let removedShipments = 0;
    let removedOrders = 0;
    for (let c = 0; c < priorOrderIds.length; c += CHUNK) {
      const idChunk = priorOrderIds.slice(c, c + CHUNK);
      const lineIds = (
        await prisma.purchaseOrderItem.findMany({
          where: { orderId: { in: idChunk } },
          select: { id: true },
        })
      ).map((row) => row.id);
      for (let lc = 0; lc < lineIds.length; lc += LINE_CHUNK) {
        const slice = lineIds.slice(lc, lc + LINE_CHUNK);
        if (slice.length === 0) continue;
        const r = await prisma.shipmentItem.deleteMany({ where: { orderItemId: { in: slice } } });
        removedLines += r.count;
      }
    }
    for (let c = 0; c < priorOrderIds.length; c += CHUNK) {
      const chunk = priorOrderIds.slice(c, c + CHUNK);
      const s = await prisma.shipment.deleteMany({ where: { orderId: { in: chunk } } });
      removedShipments += s.count;
    }
    for (let c = 0; c < priorOrderIds.length; c += CHUNK) {
      const chunk = priorOrderIds.slice(c, c + CHUNK);
      const p = await prisma.purchaseOrder.deleteMany({ where: { id: { in: chunk } } });
      removedOrders += p.count;
    }
    console.log(
      `[ct-volume] Removed prior ${ORDER_PREFIX}* data: ${removedLines} line(s), ${removedShipments} shipment(s), ${removedOrders} order(s).`,
    );
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
          const shipper = pick(crmPool, rand);
          const consignee = pick(crmPool, rand);
          const subtotal = (150 + Math.floor(rand() * 8500)).toFixed(2);
          const tax = (Number(subtotal) * 0.08).toFixed(2);
          const orderTotal = (Number(subtotal) + Number(tax)).toFixed(2);
          const lineQty = (2 + Math.floor(rand() * 80)).toFixed(3);
          const unitPrice = (Number(subtotal) / Number(lineQty)).toFixed(4);
          const estWeight = 200 + rand() * 12_000;
          const estCbm = 3 + rand() * 40;
          const dimL = 120 + rand() * 500;
          const dimW = 80 + rand() * 220;
          const dimH = 70 + rand() * 260;
          const isOverdue = sc.latestEta.getTime() < win.now && !sc.receivedAt;

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
              estimatedVolumeCbm: maybeRound(estCbm),
              estimatedWeightKg: maybeRound(estWeight),
              customerCrmAccountId: shipper.id,
              notes:
                `Shipper: ${shipper.legalName ?? shipper.name}. ` +
                `Consignee: ${consignee.legalName ?? consignee.name}. ` +
                `Dims(cm): ${dimL.toFixed(0)}x${dimW.toFixed(0)}x${dimH.toFixed(0)}.`,
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
              serviceLevel: pick(SERVICE_LEVELS, rand),
              etd: sc.etd,
              eta: sc.eta,
              latestEta: sc.latestEta,
              bookingNo: `BK-V3K-${String(i + 1).padStart(7, "0")}`,
              createdById: buyer.id,
              updatedById: buyer.id,
              notes: `${originCode} -> ${destinationCode}; qty ${lineQty}; est ${estWeight.toFixed(0)}kg / ${estCbm.toFixed(2)}cbm`,
            },
          });

          await tx.shipmentMilestone.createMany({
            data: [
              {
                shipmentId: ship.id,
                code: "ASN_SUBMITTED",
                source: "SUPPLIER",
                plannedAt: new Date(sc.etd.getTime() - 10 * DAY_MS),
                actualAt: new Date(sc.etd.getTime() - (9 + rand() * 2) * DAY_MS),
                note: "ASN submitted by supplier.",
                updatedById: buyer.id,
              },
              {
                shipmentId: ship.id,
                code: "BOOKING_CONFIRMED",
                source: "FORWARDER",
                plannedAt: new Date(sc.etd.getTime() - 5 * DAY_MS),
                actualAt: new Date(sc.etd.getTime() - (4 + rand()) * DAY_MS),
                note: "Forwarder booking confirmed.",
                updatedById: buyer.id,
              },
              {
                shipmentId: ship.id,
                code: "DEPARTED",
                source: "INTERNAL",
                plannedAt: sc.etd,
                actualAt: sc.status === "VALIDATED" || sc.status === "BOOKED" ? null : sc.shippedAt,
                note: "Departure milestone.",
                updatedById: buyer.id,
              },
              {
                shipmentId: ship.id,
                code: "ARRIVED",
                source: "SYSTEM",
                plannedAt: sc.eta,
                actualAt: sc.receivedAt,
                note: "Arrival milestone.",
                updatedById: buyer.id,
              },
            ],
          });

          await tx.ctTrackingMilestone.createMany({
            data: [
              {
                tenantId: tenant.id,
                shipmentId: ship.id,
                code: "ETD",
                label: "Planned ETD",
                plannedAt: sc.etd,
                predictedAt: sc.etd,
                actualAt: sc.status === "VALIDATED" || sc.status === "BOOKED" ? null : sc.shippedAt,
                sourceType: "SYSTEM",
                confidence: 92,
                notes: "Generated volume ETD marker.",
                updatedById: buyer.id,
              },
              {
                tenantId: tenant.id,
                shipmentId: ship.id,
                code: "ETA",
                label: "Latest ETA",
                plannedAt: sc.eta,
                predictedAt: sc.latestEta,
                actualAt: sc.receivedAt,
                sourceType: "CARRIER_ETA",
                confidence: isOverdue ? 55 : 84,
                notes: isOverdue ? "Predicted overdue in transit." : "Predicted on-track.",
                updatedById: buyer.id,
              },
            ],
          });

          await tx.ctShipmentReference.createMany({
            data: [
              { shipmentId: ship.id, refType: "BOOKING_NO", refValue: `BK-V3K-${String(i + 1).padStart(7, "0")}` },
              { shipmentId: ship.id, refType: "MASTER_BL", refValue: `MBL${String(900000 + i).padStart(8, "0")}` },
              { shipmentId: ship.id, refType: "SHIPPER", refValue: shipper.legalName ?? shipper.name },
              { shipmentId: ship.id, refType: "CONSIGNEE", refValue: consignee.legalName ?? consignee.name },
              { shipmentId: ship.id, refType: "QTY", refValue: lineQty },
              { shipmentId: ship.id, refType: "WEIGHT_KG", refValue: estWeight.toFixed(2) },
              { shipmentId: ship.id, refType: "CBM", refValue: estCbm.toFixed(3) },
            ],
          });

          await tx.ctShipmentFinancialSnapshot.create({
            data: {
              tenantId: tenant.id,
              shipmentId: ship.id,
              customerVisibleCost: maybeRound(Number(orderTotal) * 0.92, 2),
              internalCost: maybeRound(Number(orderTotal) * 0.7, 2),
              internalRevenue: maybeRound(Number(orderTotal) * 1.06, 2),
              internalNet: maybeRound(Number(orderTotal) * 0.36, 2),
              internalMarginPct: maybeRound(34 + rand() * 14, 4),
              currency: "USD",
              asOf: new Date(sc.createdAt.getTime() + 2 * DAY_MS),
              createdById: buyer.id,
            },
          });

          if (isOverdue || rand() < 0.18) {
            await tx.ctAlert.create({
              data: {
                tenantId: tenant.id,
                shipmentId: ship.id,
                type: isOverdue ? "ETA_DELAY" : "TRANSIT_RISK",
                severity: isOverdue ? "CRITICAL" : "WARN",
                title: isOverdue ? "Shipment overdue vs latest ETA" : "Schedule risk flagged",
                body: `Route ${originCode} -> ${destinationCode}. Latest ETA ${sc.latestEta.toISOString()}.`,
                ownerUserId: buyer.id,
                status: "OPEN",
              },
            });
          }
          if (isOverdue && rand() < 0.45) {
            await tx.ctException.create({
              data: {
                tenantId: tenant.id,
                shipmentId: ship.id,
                type: "TRANSIT_DELAY",
                severity: "CRITICAL",
                ownerUserId: buyer.id,
                rootCause: pick(["Port congestion", "Customs hold", "Carrier roll-over"], rand),
                status: rand() < 0.25 ? "IN_PROGRESS" : "OPEN",
                claimAmount: maybeRound(500 + rand() * 6000, 2),
              },
            });
          }

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

          const containerCount = mode === "OCEAN" ? 1 + Math.floor(rand() * 3) : rand() < 0.25 ? 1 : 0;
          if (containerCount > 0) {
            const firstLeg = await tx.ctShipmentLeg.findFirst({
              where: { tenantId: tenant.id, shipmentId: ship.id },
              orderBy: { legNo: "asc" },
              select: { id: true, plannedEtd: true, actualAtd: true },
            });
            for (let c = 0; c < containerCount; c += 1) {
              const gateBase = firstLeg?.actualAtd ?? firstLeg?.plannedEtd ?? sc.etd;
              await tx.ctShipmentContainer.create({
                data: {
                  tenantId: tenant.id,
                  shipmentId: ship.id,
                  legId: firstLeg?.id ?? null,
                  containerNumber: makeContainerNumber(i, c + 1),
                  containerType: pick(CONTAINER_TYPES, rand),
                  seal: `SEAL${String(100000 + i * 4 + c).padStart(6, "0")}`,
                  status: sc.receivedAt ? "ARRIVED" : sc.status === "IN_TRANSIT" ? "IN_TRANSIT" : "GATED_IN",
                  gateInAt: new Date(gateBase.getTime() - (2 + rand()) * DAY_MS),
                  gateOutAt: new Date(gateBase.getTime() - (0.3 + rand()) * DAY_MS),
                  notes: `Container for ${originCode} -> ${destinationCode}.`,
                },
              });
            }
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

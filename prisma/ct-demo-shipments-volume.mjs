/**
 * Control Tower / logistics volume demo: 2000 shipments on unique POs.
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
 *   CT_VOL_BALANCED=1 CT_VOL_COUNT=2000 node prisma/ct-demo-shipments-volume.mjs
 *
 * Performance (Neon / remote DB): fewer, larger transactions is much faster than tiny batches.
 *   CT_VOL_BATCH=50   # default; try 80–100 on a strong connection
 *   CT_VOL_BATCH=20   # safer if you hit transaction timeouts
 *
 * Each seeded shipment gets CtShipmentCostLine demo rows (multi-party cost model):
 *   DEMO_TRADE_* — shipper/consignee-facing charges (incoterm noted in description)
 *   DEMO_FWD_REV_* / DEMO_FWD_PAY_* — forwarder sell vs buy (margin = gap, logic later)
 *   DEMO_CARRIER_REV_* — carrier revenue from forwarder
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

const ORDER_PREFIX = "VOL2K-";
const SALES_ORDER_PREFIX = "SO-VOL2K-";
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

function customerizeDemoAccountName(name) {
  if (!name) return name;
  const dashed = name.replace(/^(.+?)\s+forwarder\s*[—\-–]\s*/i, "$1 customer — ");
  if (dashed !== name) return dashed;
  return name.replace(/\s+forwarder\s*[—\-–]\s*/gi, " customer — ");
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

/** Cents for CtShipmentCostLine.amountMinor (matches control-tower currency helpers). */
function amountToMinorScalar(amount) {
  return BigInt(Math.round(Number(amount) * 100));
}

function incotermTradeNote(incoterm) {
  const u = String(incoterm || "").toUpperCase();
  if (u === "EXW") return "EXW: origin/pickup typically seller; main + destination often buyer.";
  if (u === "FOB" || u === "FCA") return "FOB/FCA: export-side seller; main carriage + destination often buyer.";
  if (u === "CIF" || u === "CFR" || u === "CPT")
    return "CIF/CFR/CPT: seller pays to named point; terminal splits per contract.";
  if (u === "DDP" || u === "DAP") return "DAP/DDP: seller carries most charges; customer view per agreement.";
  return "Party visibility depends on contract and incoterm.";
}

function originThcLabel(mode) {
  if (mode === "AIR") return "Origin airport handling";
  if (mode === "RAIL") return "Origin rail terminal handling";
  return "Origin port / terminal handling";
}

function destThcLabel(mode) {
  if (mode === "AIR") return "Destination airport handling";
  if (mode === "RAIL") return "Destination rail terminal handling";
  return "Destination port / terminal handling";
}

function mainlaneLabel(mode) {
  if (mode === "OCEAN") return "Mainlane (ocean freight + surcharges)";
  if (mode === "AIR") return "Mainlane (air freight + surcharges)";
  if (mode === "RAIL") return "Mainlane (rail freight + surcharges)";
  return "Mainlane";
}

/**
 * Demo cost lines: trade (shipper/consignee lens), forwarder revenue, forwarder payables.
 * Categories are stable keys for future logic; descriptions carry incoterm hints.
 * @param {{
 *   tenantId: string;
 *   shipmentId: string;
 *   mode: string;
 *   tradeIncoterm: string;
 *   forwarderSupplier: { id: string; name: string } | null;
 *   carrierSupplier: { id: string; name: string } | null;
 *   createdById: string;
 *   rand: () => number;
 *   invoiceDate: Date | null;
 * }} p
 */
function buildDemoCostLines(p) {
  const {
    tenantId,
    shipmentId,
    mode,
    tradeIncoterm,
    forwarderSupplier: fwd,
    carrierSupplier: car,
    createdById,
    rand,
    invoiceDate,
  } = p;
  const note = incotermTradeNote(tradeIncoterm);
  const inv = `DEMO-${String(shipmentId).slice(-8)}`;
  const cur = rand() < 0.88 ? "USD" : "EUR";
  const rows = [];

  if (mode === "ROAD") {
    const totalTruck = 650 + rand() * 2400;
    const shipperShare = 0.35 + rand() * 0.35;
    const a1 = totalTruck * shipperShare;
    const a2 = totalTruck - a1;
    const rev = totalTruck * (0.97 + rand() * 0.05);
    const pay = totalTruck * (0.68 + rand() * 0.14);
    rows.push(
      {
        tenantId,
        shipmentId,
        category: "DEMO_TRADE_TRUCKING",
        description: `Shipper share · ${note}`,
        vendorSupplierId: fwd?.id ?? null,
        vendor: fwd?.name ?? null,
        invoiceNo: `${inv}-TS`,
        invoiceDate,
        amountMinor: amountToMinorScalar(a1),
        currency: cur,
        createdById,
      },
      {
        tenantId,
        shipmentId,
        category: "DEMO_TRADE_TRUCKING",
        description: `Consignee share · ${note}`,
        vendorSupplierId: fwd?.id ?? null,
        vendor: fwd?.name ?? null,
        invoiceNo: `${inv}-TC`,
        invoiceDate,
        amountMinor: amountToMinorScalar(a2),
        currency: cur,
        createdById,
      },
      {
        tenantId,
        shipmentId,
        category: "DEMO_FWD_REV_TRUCKING",
        description: "Forwarder revenue (trucking) — billed to trade",
        vendorSupplierId: fwd?.id ?? null,
        vendor: fwd?.name ?? null,
        invoiceNo: `${inv}-FR`,
        invoiceDate,
        amountMinor: amountToMinorScalar(rev),
        currency: cur,
        createdById,
      },
      {
        tenantId,
        shipmentId,
        category: "DEMO_FWD_PAY_TRUCKER",
        description: "Forwarder payables — linehaul / trucker",
        vendorSupplierId: car?.id ?? fwd?.id ?? null,
        vendor: car?.name ?? fwd?.name ?? null,
        invoiceNo: `${inv}-FP`,
        invoiceDate,
        amountMinor: amountToMinorScalar(pay),
        currency: cur,
        createdById,
      },
      {
        tenantId,
        shipmentId,
        category: "DEMO_CARRIER_REV_TRUCKING",
        description: "Carrier revenue (from forwarder) — trucking",
        vendorSupplierId: car?.id ?? null,
        vendor: car?.name ?? null,
        invoiceNo: `${inv}-CR`,
        invoiceDate,
        amountMinor: amountToMinorScalar(pay * (0.98 + rand() * 0.03)),
        currency: cur,
        createdById,
      },
    );
    return rows;
  }

  const mult = mode === "OCEAN" ? 1.25 : mode === "AIR" ? 1.12 : 1.05;
  const d = (lo, hi) => (lo + rand() * (hi - lo)) * mult;

  const tradeAmounts = {
    pickup: d(130, 720),
    exportHandling: d(160, 780),
    exportCustoms: d(95, 520),
    originThc: d(260, 1550),
    mainlane:
      mode === "OCEAN"
        ? d(1800, 9200)
        : mode === "AIR"
          ? d(950, 5600)
          : d(720, 4100),
    destThc: d(270, 1480),
    importCustoms: d(110, 540),
    importHandling: d(170, 760),
    delivery: d(190, 980),
  };

  rows.push(
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_PICKUP",
      description: `Trade · pickup · ${tradeIncoterm} · ${note}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T01`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.pickup),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_EXPORT_HANDLING",
      description: `Trade · export handling · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T02`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.exportHandling),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_EXPORT_CUSTOMS",
      description: `Trade · export customs clearance · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T03`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.exportCustoms),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_ORIGIN_THC",
      description: `Trade · ${originThcLabel(mode)} · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T04`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.originThc),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_MAINLANE",
      description: `Trade · ${mainlaneLabel(mode)} · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T05`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.mainlane),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_DEST_THC",
      description: `Trade · ${destThcLabel(mode)} · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T06`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.destThc),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_IMPORT_CUSTOMS",
      description: `Trade · import customs clearance · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T07`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.importCustoms),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_IMPORT_HANDLING",
      description: `Trade · import handling · ${tradeIncoterm}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T08`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.importHandling),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_TRADE_DELIVERY",
      description: `Trade · delivery · ${tradeIncoterm} · ${note}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-T09`,
      invoiceDate,
      amountMinor: amountToMinorScalar(tradeAmounts.delivery),
      currency: cur,
      createdById,
    },
  );

  const revPickup = tradeAmounts.pickup * (0.96 + rand() * 0.06);
  const revOrigin = (tradeAmounts.exportHandling + tradeAmounts.exportCustoms + tradeAmounts.originThc) * (0.94 + rand() * 0.07);
  const revMain = tradeAmounts.mainlane * (0.95 + rand() * 0.06);
  const revDest = (tradeAmounts.destThc + tradeAmounts.importCustoms + tradeAmounts.importHandling) * (0.93 + rand() * 0.08);
  const revDel = tradeAmounts.delivery * (0.96 + rand() * 0.06);

  rows.push(
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_REV_PICKUP",
      description: "Forwarder revenue — pickup (sell to trade)",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-R1`,
      invoiceDate,
      amountMinor: amountToMinorScalar(revPickup),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_REV_ORIGIN_PORT_THC",
      description: "Forwarder revenue — export + origin terminal / port / airport",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-R2`,
      invoiceDate,
      amountMinor: amountToMinorScalar(revOrigin),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_REV_MAINLANE",
      description: `Forwarder revenue — ${mainlaneLabel(mode)}`,
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-R3`,
      invoiceDate,
      amountMinor: amountToMinorScalar(revMain),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_REV_DEST_PORT_THC",
      description: "Forwarder revenue — destination terminal + import handling/customs (bundle)",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-R4`,
      invoiceDate,
      amountMinor: amountToMinorScalar(revDest),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_REV_DELIVERY",
      description: "Forwarder revenue — delivery",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-R5`,
      invoiceDate,
      amountMinor: amountToMinorScalar(revDel),
      currency: cur,
      createdById,
    },
  );

  const payMain = tradeAmounts.mainlane * (0.62 + rand() * 0.14);
  const payOrigin = tradeAmounts.originThc * (0.55 + rand() * 0.2);
  const payDest = tradeAmounts.destThc * (0.52 + rand() * 0.22);
  const payCustoms =
    (tradeAmounts.exportCustoms + tradeAmounts.importCustoms) * (0.45 + rand() * 0.25);
  const payDray = (tradeAmounts.pickup + tradeAmounts.delivery) * (0.35 + rand() * 0.2);

  rows.push(
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_PAY_CARRIER_MAINLANE",
      description: "Forwarder payables — carrier / mainlane",
      vendorSupplierId: car?.id ?? null,
      vendor: car?.name ?? null,
      invoiceNo: `${inv}-P1`,
      invoiceDate,
      amountMinor: amountToMinorScalar(payMain),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_PAY_ORIGIN_TERMINAL",
      description: "Forwarder payables — origin terminal / port / airport operator",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-P2`,
      invoiceDate,
      amountMinor: amountToMinorScalar(payOrigin),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_PAY_DEST_TERMINAL",
      description: "Forwarder payables — destination terminal / port / airport operator",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-P3`,
      invoiceDate,
      amountMinor: amountToMinorScalar(payDest),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_PAY_CUSTOMS_BROKER",
      description: "Forwarder payables — customs broker / filing",
      vendorSupplierId: fwd?.id ?? null,
      vendor: fwd?.name ?? null,
      invoiceNo: `${inv}-P4`,
      invoiceDate,
      amountMinor: amountToMinorScalar(payCustoms),
      currency: cur,
      createdById,
    },
    {
      tenantId,
      shipmentId,
      category: "DEMO_FWD_PAY_TRUCKING",
      description: "Forwarder payables — trucking / drayage legs",
      vendorSupplierId: car?.id ?? fwd?.id ?? null,
      vendor: car?.name ?? fwd?.name ?? null,
      invoiceNo: `${inv}-P5`,
      invoiceDate,
      amountMinor: amountToMinorScalar(payDray),
      currency: cur,
      createdById,
    },
  );

  rows.push({
    tenantId,
    shipmentId,
    category: "DEMO_CARRIER_REV_MAINLANE",
    description: "Carrier revenue (from forwarder) — mainlane / linehaul",
    vendorSupplierId: car?.id ?? null,
    vendor: car?.name ?? null,
    invoiceNo: `${inv}-C1`,
    invoiceDate,
    amountMinor: amountToMinorScalar(payMain * (0.97 + rand() * 0.04)),
    currency: cur,
    createdById,
  });

  return rows;
}

function modeDetail(mode, rand) {
  if (mode === "OCEAN") {
    const loadType = rand() < 0.68 ? "FCL" : "LCL";
    return {
      loadType,
      bookingServiceLevel: loadType,
      containerCount: loadType === "FCL" ? 1 + Math.floor(rand() * 3) : rand() < 0.45 ? 1 : 0,
      containerTypePool: loadType === "FCL" ? ["20GP", "40GP", "40HC", "45HC"] : ["LCL"],
    };
  }
  if (mode === "AIR") {
    return {
      loadType: "AIR",
      bookingServiceLevel: pick(["AIR_STANDARD", "AIR_EXPRESS"], rand),
      containerCount: 0,
      containerTypePool: [],
    };
  }
  if (mode === "ROAD") {
    return {
      loadType: "ROAD",
      bookingServiceLevel: pick(["FTL", "LTL"], rand),
      containerCount: rand() < 0.2 ? 1 : 0,
      containerTypePool: ["TRUCK_13_6", "LTL_PALLET"],
    };
  }
  return {
    loadType: "RAIL",
    bookingServiceLevel: pick(["RAIL_BLOCK", "RAIL_MIXED"], rand),
    containerCount: rand() < 0.35 ? 1 : 0,
    containerTypePool: ["40HC", "45HC"],
  };
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function ratioCount(total, ratio) {
  return Math.max(0, Math.min(total, Math.round(total * ratio)));
}

function buildBalancedModes(total, rand) {
  const targets = [
    ["OCEAN", ratioCount(total, 0.42)],
    ["AIR", ratioCount(total, 0.28)],
    ["ROAD", ratioCount(total, 0.22)],
    ["RAIL", ratioCount(total, 0.08)],
  ];
  const out = [];
  for (const [mode, count] of targets) {
    for (let i = 0; i < count; i += 1) out.push(mode);
  }
  while (out.length < total) out.push("OCEAN");
  if (out.length > total) out.length = total;
  return shuffleInPlace(out, rand);
}

function buildBalancedBoolean(total, trueRatio, rand) {
  const trueCount = ratioCount(total, trueRatio);
  const out = new Array(total).fill(false);
  for (let i = 0; i < trueCount; i += 1) out[i] = true;
  return shuffleInPlace(out, rand);
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
  const total = Math.min(10_000, Math.max(1, Number(process.env.CT_VOL_COUNT || 2000)));
  const rand = mulberry32(0xdeed3000);
  const balanced = process.env.CT_VOL_BALANCED === "1" || process.env.CT_VOL_BALANCED === "true";
  const dryRun = process.argv.includes("--dry-run");

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
  const supplierPool = await prisma.supplier.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
    take: 500,
  });
  const activeSupplierPool = supplierPool.length > 0 ? supplierPool : supplier ? [{ id: supplier.id, name: "Acme Industrial Supplies" }] : [];

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
  const targetSoCount = Math.max(50, Math.floor(total * 0.45));
  const balancedModes = balanced ? buildBalancedModes(total, rand) : null;
  const balancedAdhoc = balanced ? buildBalancedBoolean(total, 0.28, rand) : null;
  const balancedSoLink = balanced ? buildBalancedBoolean(total, 0.45, rand) : null;

  if (dryRun) {
    const modesSource = balancedModes ?? Array.from({ length: total }, () => pickMode(rand));
    const adhocSource = balancedAdhoc ?? Array.from({ length: total }, () => rand() < 0.28);
    const soSource = balancedSoLink ?? Array.from({ length: total }, () => rand() < 0.45);
    const count = (arr, pred) => arr.reduce((n, x) => n + (pred(x) ? 1 : 0), 0);
    const ocean = count(modesSource, (m) => m === "OCEAN");
    const air = count(modesSource, (m) => m === "AIR");
    const road = count(modesSource, (m) => m === "ROAD");
    const rail = count(modesSource, (m) => m === "RAIL");
    const adHoc = count(adhocSource, Boolean);
    const soLinked = count(soSource, Boolean);
    const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0");
    console.log("[ct-volume] Dry run (no writes).");
    console.log(
      JSON.stringify(
        {
          total,
          balanced,
          targetSalesOrderPool: targetSoCount,
          expected: {
            salesOrderLinked: soLinked,
            salesOrderLinkedPct: `${pct(soLinked)}%`,
            adHocShellOrders: adHoc,
            adHocPct: `${pct(adHoc)}%`,
            modeMix: {
              ocean,
              air,
              road,
              rail,
              oceanPct: `${pct(ocean)}%`,
              airPct: `${pct(air)}%`,
              roadPct: `${pct(road)}%`,
              railPct: `${pct(rail)}%`,
            },
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const existing = await prisma.purchaseOrder.count({
    where: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
  });
  const priorSalesOrders = await prisma.salesOrder.findMany({
    where: { tenantId: tenant.id, soNumber: { startsWith: SALES_ORDER_PREFIX } },
    select: { id: true },
  });
  if (priorSalesOrders.length > 0) {
    await prisma.shipment.updateMany({
      where: { salesOrderId: { in: priorSalesOrders.map((s) => s.id) }, order: { tenantId: tenant.id } },
      data: { salesOrderId: null },
    });
    await prisma.salesOrder.deleteMany({
      where: { id: { in: priorSalesOrders.map((s) => s.id) } },
    });
  }
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

  const salesOrders = [];
  for (let i = 0; i < targetSoCount; i += 1) {
    const c = pick(crmPool, rand);
    const row = await prisma.salesOrder.create({
      data: {
        tenantId: tenant.id,
        soNumber: `${SALES_ORDER_PREFIX}${String(i + 1).padStart(6, "0")}`,
        status: i % 8 === 0 ? "DRAFT" : i % 8 === 1 ? "CLOSED" : "OPEN",
        customerName: customerizeDemoAccountName(c.name),
        customerCrmAccountId: c.id,
        externalRef: `CUST-REF-${String(10_000 + i)}`,
        requestedDeliveryDate: new Date(Date.now() - Math.floor(rand() * 360) * DAY_MS),
        createdById: buyer.id,
      },
      select: { id: true },
    });
    salesOrders.push(row);
  }

  const batchRaw = Number(process.env.CT_VOL_BATCH ?? 50);
  const BATCH = Number.isFinite(batchRaw) ? Math.min(150, Math.max(5, Math.floor(batchRaw))) : 50;
  const txTimeoutMs = Math.min(900_000, Math.max(300_000, BATCH * 25_000));
  const txMaxWaitMs = Math.min(180_000, 60_000 + BATCH * 2_000);
  if (balanced) {
    console.log("[ct-volume] Scenario mode: balanced quotas (modes/adhoc/SO links).");
  }
  console.log(
    `[ct-volume] Creating ${total} orders + shipments + bookings (+ optional legs)… (batch=${BATCH}, tx timeout ${Math.round(txTimeoutMs / 1000)}s)`,
  );

  for (let start = 0; start < total; start += BATCH) {
    const end = Math.min(start + BATCH, total);
    await prisma.$transaction(
      async (tx) => {
        for (let i = start; i < end; i += 1) {
          const isAdhocOrder = balancedAdhoc ? Boolean(balancedAdhoc[i]) : rand() < 0.28;
          const orderNumber = isAdhocOrder
            ? `${ORDER_PREFIX}ADH-${String(i + 1).padStart(7, "0")}`
            : `${ORDER_PREFIX}PO-${String(i + 1).padStart(7, "0")}`;
          const sc = buildShipmentScenario(i, total, rand, win);
          const mode = balancedModes ? balancedModes[i] : pickMode(rand);
          const modeMeta = modeDetail(mode, rand);
          const [originCode, destinationCode] = pick(ROUTES, rand);
          const shipper = pick(crmPool, rand);
          const consignee = pick(crmPool, rand);
          const carrierSupplier = activeSupplierPool.length > 0 ? pick(activeSupplierPool, rand) : null;
          const forwarderSupplier = activeSupplierPool.length > 0 ? pick(activeSupplierPool, rand) : null;
          const shouldLinkSo = balancedSoLink ? Boolean(balancedSoLink[i]) : rand() < 0.45;
          const soLink = salesOrders.length > 0 && shouldLinkSo ? pick(salesOrders, rand) : null;
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
          const tradeIncoterm = pick(["EXW", "FOB", "FCA", "CIF", "DDP", "DAP"], rand);

          const po = await tx.purchaseOrder.create({
            data: {
              tenantId: tenant.id,
              orderNumber,
              title: isAdhocOrder
                ? `Ad-hoc logistics shell order ${orderNumber}`
                : `Volume demo ${orderNumber}`,
              workflowId: wf.id,
              statusId: fulfilled.id,
              requesterId: buyer.id,
              supplierId,
              currency: rand() < 0.9 ? "USD" : "EUR",
              subtotal,
              taxAmount: tax,
              totalAmount: orderTotal,
              incoterm: tradeIncoterm,
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
              salesOrderId: soLink?.id ?? null,
              status: sc.status,
              shippedAt: sc.shippedAt,
              receivedAt: sc.receivedAt,
              carrierSupplierId: carrierSupplier?.id ?? null,
              carrier: carrierSupplier?.name ?? pick(CARRIERS, rand),
              trackingNo: `V3KTRK${String(1_000_000 + i)}`,
              transportMode: mode,
              estimatedVolumeCbm: maybeRound(estCbm),
              estimatedWeightKg: maybeRound(estWeight),
              customerCrmAccountId: shipper.id,
              notes:
                `${isAdhocOrder ? "No source PO (ad-hoc capture). " : ""}` +
                `Shipper: ${shipper.legalName ?? shipper.name}. ` +
                `Consignee: ${consignee.legalName ?? consignee.name}. ` +
                `${modeMeta.loadType} move. Dims(cm): ${dimL.toFixed(0)}x${dimW.toFixed(0)}x${dimH.toFixed(0)}.`,
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
              serviceLevel: modeMeta.bookingServiceLevel ?? pick(SERVICE_LEVELS, rand),
              etd: sc.etd,
              eta: sc.eta,
              latestEta: sc.latestEta,
              bookingNo: `BK-V3K-${String(i + 1).padStart(7, "0")}`,
              forwarderSupplierId: forwarderSupplier?.id ?? null,
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
              { shipmentId: ship.id, refType: "LOAD_TYPE", refValue: modeMeta.loadType },
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

          const demoCostRows = buildDemoCostLines({
            tenantId: tenant.id,
            shipmentId: ship.id,
            mode,
            tradeIncoterm,
            forwarderSupplier,
            carrierSupplier,
            createdById: buyer.id,
            rand,
            invoiceDate: new Date(sc.createdAt.getTime() + 3 * DAY_MS),
          });
          if (demoCostRows.length > 0) {
            await tx.ctShipmentCostLine.createMany({ data: demoCostRows });
          }

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

          let firstLegId = null;
          let gateBaseFromLeg = null;
          const legRoll = rand();
          if (legRoll < 0.65) {
            const legMode = mode;
            const hasActual = sc.status === "RECEIVED" || sc.status === "DELIVERED";
            const plannedEtd = sc.etd;
            const plannedEta = sc.eta;
            const actualAtd =
              hasActual && rand() < 0.85 ? new Date(plannedEtd.getTime() + rand() * 2 * DAY_MS) : null;
            const actualAta =
              hasActual && rand() < 0.8 ? new Date(plannedEta.getTime() + (rand() - 0.3) * 3 * DAY_MS) : null;
            const createdLeg = await tx.ctShipmentLeg.create({
              data: {
                tenantId: tenant.id,
                shipmentId: ship.id,
                legNo: 1,
                originCode,
                destinationCode,
                carrierSupplierId: carrierSupplier?.id ?? null,
                carrier: carrierSupplier?.name ?? pick(CARRIERS, rand),
                transportMode: legMode,
                plannedEtd,
                plannedEta,
                actualAtd,
                actualAta,
              },
              select: { id: true, plannedEtd: true, actualAtd: true },
            });
            firstLegId = createdLeg.id;
            gateBaseFromLeg = createdLeg.actualAtd ?? createdLeg.plannedEtd;
          }

          const containerCount = modeMeta.containerCount;
          if (containerCount > 0) {
            for (let c = 0; c < containerCount; c += 1) {
              const gateBase = gateBaseFromLeg ?? sc.etd;
              await tx.ctShipmentContainer.create({
                data: {
                  tenantId: tenant.id,
                  shipmentId: ship.id,
                  legId: firstLegId,
                  containerNumber: makeContainerNumber(i, c + 1),
                  containerType: pick(modeMeta.containerTypePool.length > 0 ? modeMeta.containerTypePool : CONTAINER_TYPES, rand),
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
      { maxWait: txMaxWaitMs, timeout: txTimeoutMs },
    );
    if (end % 200 === 0 || end === total) {
      console.log(`[ct-volume] … ${end}/${total}`);
    }
  }

  const baseWhere = {
    order: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
    shipmentNo: { startsWith: "V3K-" },
  };
  const costScope = {
    tenantId: tenant.id,
    shipment: {
      order: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } },
      shipmentNo: { startsWith: "V3K-" },
    },
  };
  const [
    totalSeeded,
    soLinked,
    adHoc,
    ocean,
    air,
    road,
    rail,
    stBooked,
    stValidated,
    stShipped,
    stInTransit,
    stReceived,
    stDelivered,
    refs,
    costLinesTrade,
    costLinesFwdRev,
    costLinesFwdPay,
    costLinesCarrier,
  ] = await Promise.all([
    prisma.shipment.count({ where: baseWhere }),
    prisma.shipment.count({ where: { ...baseWhere, salesOrderId: { not: null } } }),
    prisma.shipment.count({
      where: { ...baseWhere, order: { tenantId: tenant.id, orderNumber: { contains: "ADH-" } } },
    }),
    prisma.shipment.count({ where: { ...baseWhere, transportMode: "OCEAN" } }),
    prisma.shipment.count({ where: { ...baseWhere, transportMode: "AIR" } }),
    prisma.shipment.count({ where: { ...baseWhere, transportMode: "ROAD" } }),
    prisma.shipment.count({ where: { ...baseWhere, transportMode: "RAIL" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "BOOKED" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "VALIDATED" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "SHIPPED" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "IN_TRANSIT" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "RECEIVED" } }),
    prisma.shipment.count({ where: { ...baseWhere, status: "DELIVERED" } }),
    prisma.ctShipmentReference.groupBy({
      by: ["refValue"],
      where: {
        shipment: { order: { tenantId: tenant.id, orderNumber: { startsWith: ORDER_PREFIX } } },
        refType: "LOAD_TYPE",
        refValue: { in: ["FCL", "LCL"] },
      },
      _count: { _all: true },
    }),
    prisma.ctShipmentCostLine.count({
      where: { ...costScope, category: { startsWith: "DEMO_TRADE_" } },
    }),
    prisma.ctShipmentCostLine.count({
      where: { ...costScope, category: { startsWith: "DEMO_FWD_REV_" } },
    }),
    prisma.ctShipmentCostLine.count({
      where: { ...costScope, category: { startsWith: "DEMO_FWD_PAY_" } },
    }),
    prisma.ctShipmentCostLine.count({
      where: { ...costScope, category: { startsWith: "DEMO_CARRIER_REV_" } },
    }),
  ]);

  const fcl = refs.find((r) => r.refValue === "FCL")?._count._all ?? 0;
  const lcl = refs.find((r) => r.refValue === "LCL")?._count._all ?? 0;
  const pct = (n) => (totalSeeded > 0 ? ((n / totalSeeded) * 100).toFixed(1) : "0.0");

  console.log(`[ct-volume] Done. ${total} shipments with prefix ${ORDER_PREFIX} / V3K-* on tenant demo-company.`);
  console.log("[ct-volume] Summary:");
  console.log(
    JSON.stringify(
      {
        totals: {
          shipments: totalSeeded,
          salesOrderLinked: soLinked,
          adHocShellOrders: adHoc,
          salesOrderLinkedPct: `${pct(soLinked)}%`,
          adHocPct: `${pct(adHoc)}%`,
        },
        modeMix: {
          ocean,
          air,
          road,
          rail,
          oceanPct: `${pct(ocean)}%`,
          airPct: `${pct(air)}%`,
          roadPct: `${pct(road)}%`,
          railPct: `${pct(rail)}%`,
          oceanFcl: fcl,
          oceanLcl: lcl,
        },
        statuses: {
          booked: stBooked,
          validated: stValidated,
          shipped: stShipped,
          inTransit: stInTransit,
          received: stReceived,
          delivered: stDelivered,
        },
        costLinesDemo: {
          tradeLens: costLinesTrade,
          forwarderRevenueLens: costLinesFwdRev,
          forwarderPayablesLens: costLinesFwdPay,
          carrierRevenueLens: costLinesCarrier,
          note: "Categories DEMO_TRADE_* (shipper/consignee bill), DEMO_FWD_REV_* / DEMO_FWD_PAY_* (forwarder P&L), DEMO_CARRIER_REV_* (carrier sales from forwarder).",
        },
      },
      null,
      2,
    ),
  );
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

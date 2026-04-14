/**
 * Optional volume data: 20 suppliers total (SUP-001 existing + 19 new),
 * 1000 parent POs (GEN-*): 900 historical + 100 active, with ASNs and some load-plan links.
 * Set SKIP_BULK_SEED=1 to skip (faster CI / first-time migrate).
 */
import { Prisma } from "@prisma/client";

/** Deterministic PRNG for reproducible seed data */
function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITIES = [
  ["Chicago", "IL", "60601", "US"],
  ["Detroit", "MI", "48201", "US"],
  ["Rotterdam", "ZH", "3011", "NL"],
  ["Shenzhen", "GD", "518000", "CN"],
  ["Los Angeles", "CA", "90021", "US"],
  ["Houston", "TX", "77002", "US"],
  ["Toronto", "ON", "M5H2N2", "CA"],
  ["Mumbai", "MH", "400001", "IN"],
];

const SUPPLIER_NAME_PARTS = [
  "Pacific",
  "Northern",
  "Global",
  "United",
  "Metro",
  "Summit",
  "Harbor",
  "Riverside",
  "Industrial",
  "Precision",
  "Alliance",
  "Vertex",
  "Catalyst",
  "Meridian",
  "Horizon",
];

const SUPPLIER_SUFFIX = [
  "Components",
  "Materials",
  "Trading",
  "Supply",
  "Manufacturing",
  "Logistics",
  "Electronics",
  "Packaging",
];

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function orderNumberGen(i) {
  return `GEN-${String(i + 1).padStart(6, "0")}`;
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   tenantId: string;
 *   buyerId: string;
 *   approverId: string;
 *   acmeSupplierId: string;
 *   simpleWorkflowId: string;
 *   supplierWorkflowId: string;
 *   simple: { draftId: string; openId: string; closedId: string };
 *   supplier: {
 *     draftId: string;
 *     sentId: string;
 *     confirmedId: string;
 *     fulfilledId: string;
 *     splitPendingId: string;
 *     cancelledId: string;
 *     declinedId: string;
 *     parentSplitCompleteId: string;
 *     pendingChildId: string;
 *   };
 *   productIds: string[];
 *   cfsShenzhenId: string;
 * }} ctx
 */
export async function runBulkSeed(prisma, ctx) {
  if (process.env.SKIP_BULK_SEED === "1") {
    console.log("[db:seed] SKIP_BULK_SEED=1 — skipping bulk suppliers / GEN-* orders");
    return;
  }

  const rand = mulberry32(0xcafebabe);
  const {
    tenantId,
    buyerId,
    approverId,
    acmeSupplierId,
    simpleWorkflowId,
    supplierWorkflowId,
    simple,
    supplier: supSt,
    productIds,
    cfsShenzhenId,
  } = ctx;

  console.log("[db:seed] Bulk volume: upserting suppliers SUP-002…SUP-020…");

  const extraSuppliers = [];
  for (let n = 2; n <= 20; n += 1) {
    const code = `SUP-${String(n).padStart(3, "0")}`;
    const name = `${pick(SUPPLIER_NAME_PARTS, rand)} ${pick(SUPPLIER_SUFFIX, rand)} ${String(n).padStart(2, "0")}`;
    const row = await prisma.supplier.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: { name, isActive: true, email: `orders+${code.toLowerCase()}@example.com` },
      create: {
        tenantId,
        code,
        name,
        email: `orders+${code.toLowerCase()}@example.com`,
        isActive: true,
        defaultIncoterm: pick(["FOB", "CIF", "EXW", "DDP"], rand),
        paymentTermsDays: pick([30, 45, 60], rand),
        paymentTermsLabel: "Net terms",
      },
      select: { id: true },
    });
    extraSuppliers.push(row.id);
  }

  const supplierPool = [acmeSupplierId, ...extraSuppliers];

  /** ILIKE catches odd casing; delete shipments first so ShipmentItem (Restrict on orderItem) cascades. */
  const genOrderRows = await prisma.$queryRaw(Prisma.sql`
    SELECT id FROM "PurchaseOrder"
    WHERE "tenantId" = ${tenantId}
      AND "orderNumber" ILIKE 'GEN-%'
  `);
  const genOrderIds = genOrderRows.map((r) => r.id);
  if (genOrderIds.length > 0) {
    const CHUNK = 200;
    const LINE_CHUNK = 300;
    let removedLines = 0;
    for (let c = 0; c < genOrderIds.length; c += CHUNK) {
      const idChunk = genOrderIds.slice(c, c + CHUNK);
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
    let shipDel = 0;
    let poDel = 0;
    for (let c = 0; c < genOrderIds.length; c += CHUNK) {
      const chunk = genOrderIds.slice(c, c + CHUNK);
      const s = await prisma.shipment.deleteMany({ where: { orderId: { in: chunk } } });
      shipDel += s.count;
    }
    for (let c = 0; c < genOrderIds.length; c += CHUNK) {
      const chunk = genOrderIds.slice(c, c + CHUNK);
      const p = await prisma.purchaseOrder.deleteMany({ where: { id: { in: chunk } } });
      poDel += p.count;
    }
    console.log(
      `[db:seed] Removed prior GEN-* data: ${removedLines} shipment line(s), ${shipDel} shipment(s), ${poDel} order(s) (ILIKE 'GEN-%')`,
    );
  }

  const historicalStatuses = [
    { w: 28, wf: "supplier", sid: supSt.fulfilledId },
    { w: 12, wf: "supplier", sid: supSt.declinedId },
    { w: 10, wf: "supplier", sid: supSt.cancelledId },
    { w: 8, wf: "supplier", sid: supSt.parentSplitCompleteId },
    { w: 22, wf: "simple", sid: simple.closedId },
    { w: 10, wf: "simple", sid: simple.openId },
    { w: 10, wf: "supplier", sid: supSt.confirmedId },
  ];

  const activeStatuses = [
    { w: 12, wf: "supplier", sid: supSt.draftId },
    { w: 18, wf: "supplier", sid: supSt.sentId },
    { w: 22, wf: "supplier", sid: supSt.confirmedId },
    { w: 8, wf: "supplier", sid: supSt.splitPendingId },
    { w: 15, wf: "simple", sid: simple.draftId },
    { w: 12, wf: "simple", sid: simple.openId },
    { w: 8, wf: "supplier", sid: supSt.pendingChildId },
    { w: 5, wf: "supplier", sid: supSt.fulfilledId },
  ];

  function expandStatusPlan(plan) {
    const out = [];
    for (const row of plan) {
      for (let k = 0; k < row.w; k += 1) out.push({ wf: row.wf, statusId: row.sid });
    }
    return out;
  }

  const histPick = expandStatusPlan(historicalStatuses);
  const actPick = expandStatusPlan(activeStatuses);

  /** @type {Array<{ orderId: string; loadAssignment: "final" | "draft" | null; logistics: string; createdAt: Date }>} */
  const shipmentQueue = [];

  function buildOrderPayload(index, isHistorical) {
    const i = index;
    const orderNumber = orderNumberGen(i);
    const supplierId = pick(supplierPool, rand);
    const requesterId = rand() < 0.55 ? buyerId : approverId;
    const useSupplierWf = isHistorical
      ? histPick[i % histPick.length].wf === "supplier"
      : actPick[(i - 900) % actPick.length].wf === "supplier";

    const workflowId = useSupplierWf ? supplierWorkflowId : simpleWorkflowId;
    const statusId = isHistorical
      ? histPick[i % histPick.length].statusId
      : actPick[(i - 900) % actPick.length].statusId;

    const now = Date.now();
    const createdAt = isHistorical
      ? new Date(now - (45 + Math.floor(rand() * 800)) * 86400000)
      : new Date(now - Math.floor(rand() * 75) * 86400000);

    const due = new Date(createdAt.getTime() + (14 + Math.floor(rand() * 60)) * 86400000);
    const [city, region, postal, country] = pick(CITIES, rand);
    const subtotal = (200 + Math.floor(rand() * 9800)).toFixed(2);
    const tax = (Number(subtotal) * 0.08).toFixed(2);
    const total = (Number(subtotal) + Number(tax)).toFixed(2);
    const currency = rand() < 0.88 ? "USD" : "EUR";
    const productId = productIds.length ? pick(productIds, rand) : null;
    const lineQty = (1 + Math.floor(rand() * 40)).toFixed(3);
    const unitPrice = (Number(subtotal) / Number(lineQty)).toFixed(4);
    const lineTotal = subtotal;

    const code = supSt;
    const terminalSupplier =
      statusId === code.fulfilledId ||
      statusId === code.declinedId ||
      statusId === code.cancelledId ||
      statusId === code.parentSplitCompleteId;
    const needsShipment =
      useSupplierWf &&
      (statusId === code.fulfilledId ||
        statusId === code.parentSplitCompleteId ||
        (isHistorical && statusId === code.confirmedId && rand() < 0.85) ||
        (!isHistorical && statusId === code.confirmedId && rand() < 0.35) ||
        (!isHistorical && statusId === code.fulfilledId));

    /** 'final' | 'draft' | null — link ASN to a load plan for consolidation demos */
    let loadAssignment = null;
    if (needsShipment && isHistorical && statusId !== code.declinedId) {
      const r = rand();
      if (r < 0.12) loadAssignment = "final";
      else if (r < 0.2) loadAssignment = "draft";
    }

    let logistics = "NONE";
    if (needsShipment && !terminalSupplier && statusId === code.confirmedId) {
      logistics = rand() < 0.25 ? "RECEIVED" : rand() < 0.45 ? "PARTIALLY_RECEIVED" : "SHIPPED";
    } else if (needsShipment && terminalSupplier) {
      logistics = rand() < 0.72 ? "RECEIVED" : rand() < 0.9 ? "PARTIALLY_RECEIVED" : "SHIPPED";
    }

    return {
      tenantId,
      orderNumber,
      title: `Bulk PO ${orderNumber}`,
      workflowId,
      statusId,
      requesterId,
      supplierId,
      currency,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      buyerReference: `REQ-GEN-${10000 + i}`,
      supplierReference: rand() < 0.7 ? `VEN-${20000 + i}` : null,
      paymentTermsDays: 30,
      paymentTermsLabel: "Net 30",
      incoterm: pick(["FOB", "CIF", "EXW"], rand),
      requestedDeliveryDate: due,
      shipToName: "Demo Company — Receiving",
      shipToLine1: `${100 + (i % 900)} Warehouse Row`,
      shipToCity: city,
      shipToRegion: region,
      shipToPostalCode: postal,
      shipToCountryCode: country,
      createdAt,
      items: {
        create: [
          {
            lineNo: 1,
            productId,
            description: productId ? "Catalog line" : "Non-catalog procurement line",
            quantity: lineQty,
            unitPrice,
            lineTotal,
          },
        ],
      },
      _bulkMeta: { needsShipment, logistics, loadAssignment, createdAt },
    };
  }

  console.log("[db:seed] Bulk volume: creating 1000 GEN-* orders (batched)…");

  /** Batched interactive transaction with a long timeout — array `$transaction` + pg adapter still used 5s cap (P2028). */
  async function createOrderBatch(isHistorical, fromIndex, toIndex) {
    await prisma.$transaction(
      async (tx) => {
        for (let i = fromIndex; i < toIndex; i += 1) {
          const raw = buildOrderPayload(i, isHistorical);
          const { _bulkMeta, items, ...po } = raw;
          const created = await tx.purchaseOrder.create({ data: { ...po, items } });
          if (!created?.id) {
            throw new Error(`[bulk-seed] purchaseOrder.create returned no id (${po.orderNumber})`);
          }
          if (_bulkMeta.needsShipment) {
            shipmentQueue.push({
              orderId: created.id,
              loadAssignment: _bulkMeta.loadAssignment,
              logistics: _bulkMeta.logistics,
              createdAt: _bulkMeta.createdAt,
            });
          }
        }
      },
      { maxWait: 60_000, timeout: 180_000 },
    );
  }

  const BATCH = 8;
  for (let start = 0; start < 900; start += BATCH) {
    const end = Math.min(start + BATCH, 900);
    await createOrderBatch(true, start, end);
    if ((start + BATCH) % 240 === 0 || end === 900) {
      console.log(`[db:seed] … historical ${end}/900`);
    }
  }

  for (let start = 900; start < 1000; start += BATCH) {
    const end = Math.min(start + BATCH, 1000);
    await createOrderBatch(false, start, end);
    if (end === 1000) console.log("[db:seed] … active 100/100");
  }

  console.log(`[db:seed] Bulk volume: creating ${shipmentQueue.length} shipments / ASNs…`);

  const carriers = ["Maersk Demo", "CMA CGM Demo", "DHL Freight", "FedEx Freight", "Schneider"];
  const modes = ["OCEAN", "AIR", "ROAD", "RAIL"];

  const queueOrderIds = shipmentQueue.map((r) => r.orderId);
  const lineRows = await prisma.purchaseOrderItem.findMany({
    where: { orderId: { in: queueOrderIds }, lineNo: 1 },
    select: { id: true, orderId: true, quantity: true },
  });
  const lineByOrderId = new Map(lineRows.map((r) => [r.orderId, r]));

  const bulkLoad = await prisma.loadPlan.upsert({
    where: { tenantId_reference: { tenantId, reference: "LOAD-BULK-CONSOL" } },
    update: {
      warehouseId: cfsShenzhenId,
      status: "FINALIZED",
      transportMode: "OCEAN",
      containerSize: "FCL_40",
      plannedEta: new Date("2025-11-15T00:00:00.000Z"),
    },
    create: {
      tenantId,
      reference: "LOAD-BULK-CONSOL",
      warehouseId: cfsShenzhenId,
      transportMode: "OCEAN",
      containerSize: "FCL_40",
      plannedEta: new Date("2025-11-15T00:00:00.000Z"),
      status: "FINALIZED",
      createdById: buyerId,
      notes: "Bulk-seeded finalized load for consolidation / ASN testing.",
    },
    select: { id: true },
  });

  const draftLoadForAssign = await prisma.loadPlan.upsert({
    where: { tenantId_reference: { tenantId, reference: "LOAD-BULK-DRAFT" } },
    update: {
      warehouseId: cfsShenzhenId,
      status: "DRAFT",
    },
    create: {
      tenantId,
      reference: "LOAD-BULK-DRAFT",
      warehouseId: cfsShenzhenId,
      transportMode: "OCEAN",
      containerSize: "LCL",
      plannedEta: new Date("2026-07-01T00:00:00.000Z"),
      status: "DRAFT",
      createdById: buyerId,
      notes: "Bulk-seeded draft load — assign ASNs from consolidation UI.",
    },
    select: { id: true },
  });

  let asn = 0;
  for (const row of shipmentQueue) {
    asn += 1;
    const shippedAt = new Date(row.createdAt.getTime() + (2 + Math.floor(rand() * 20)) * 86400000);
    const planDay = new Date(shippedAt.getTime() + 86400000);
    let status = "SHIPPED";
    let receivedAt = null;
    if (row.logistics === "RECEIVED") {
      status = "RECEIVED";
      receivedAt = new Date(shippedAt.getTime() + 5 * 86400000);
    }

    const orderItem = lineByOrderId.get(row.orderId);
    if (!orderItem) continue;

    const qShip = orderItem.quantity;
    const qRec =
      row.logistics === "RECEIVED"
        ? qShip
        : row.logistics === "PARTIALLY_RECEIVED"
          ? new Prisma.Decimal(Number(qShip) * 0.45).toDecimalPlaces(3)
          : new Prisma.Decimal(0);

    const ship = await prisma.shipment.create({
      data: {
        orderId: row.orderId,
        shipmentNo: `ASN-GEN-${String(asn).padStart(5, "0")}`,
        status,
        shippedAt,
        receivedAt,
        carrier: pick(carriers, rand),
        trackingNo: `TRK-GEN-${100000 + asn}`,
        transportMode: pick(modes, rand),
        estimatedVolumeCbm: new Prisma.Decimal((5 + rand() * 25).toFixed(3)),
        estimatedWeightKg: new Prisma.Decimal((800 + rand() * 9000).toFixed(3)),
        createdById: buyerId,
        items: {
          create: [
            {
              orderItemId: orderItem.id,
              quantityShipped: qShip,
              quantityReceived: qRec,
              plannedShipDate: planDay,
            },
          ],
        },
      },
    });

    if (row.loadAssignment === "final") {
      await prisma.loadPlanShipment.upsert({
        where: { shipmentId: ship.id },
        update: { loadPlanId: bulkLoad.id },
        create: { loadPlanId: bulkLoad.id, shipmentId: ship.id },
      });
    } else if (row.loadAssignment === "draft") {
      await prisma.loadPlanShipment.upsert({
        where: { shipmentId: ship.id },
        update: { loadPlanId: draftLoadForAssign.id },
        create: { loadPlanId: draftLoadForAssign.id, shipmentId: ship.id },
      });
    }
  }

  console.log(
    `[db:seed] Bulk volume: 20 suppliers total, 1000 GEN-* orders, ${shipmentQueue.length} ASNs, load plans LOAD-BULK-CONSOL (finalized) + LOAD-BULK-DRAFT`,
  );
}

/**
 * WMS demo: one regional DC (~20k sqm / 20 doors as narrative in name + address),
 * full zone/bin layout, inventory history, outbound paths, cross-dock, holds, tasks.
 *
 * Requires `npm run db:seed` (demo tenant, buyer, CRM account, products).
 *
 *   npm run db:seed:wms-demo
 *   USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo
 *
 * Idempotent for this warehouse: deletes existing `WH-DEMO-DC1` (and its load plans) then recreates.
 * Includes: cancelled outbound, wave release + complete, done replen (paper), cycle count (done + open),
 * outbound packed-not-shipped + multi-line draft, finalized load plan, WmsBillingEvent + draft invoice run,
 * multi-line shipped order, partial pick (PICKING), open wave with allocated picks, dock staging receipt, cancelled replen task,
 * inactive zone/bin, maxPallets on bulk lanes, inactive replen rule, cancelled load plan + wave, OPEN PUTAWAY
 * (from seeded PO shipment line), outbound with ship-to picked from dock,
 * completed ASN putaway to shelf, second open pick on partial line, load plan ↔ shipment + ASN fields,
 * outbound-sort lane receipt, BIN hold→clear + zero-variance cycle count, POSTED billing invoice run (per-event lines on last movements),
 * load plan plannedEta (ROAD + RAIL + AIR + OCEAN drafts + finalized SPOT), empty OPEN wave, partial outbound full pick+pack+ship, WDEF wave pick+pack+ship then wave DONE,
 * three-line outbound (TRIO) from three bins, RELEASED wave with OPEN allocated pick (WREL),
 * AIR draft load plan, completed open toner replen (best-effort), released→cancelled outbound (no picks),
 * sample PICK billing events linked to Demo Logistics CRM,
 * RAIL + OCEAN draft load plans, RELEASED wave with no tasks, decimal-qty outbound line, CRM-linked SHIPMENT billing sample,
 * split-line outbound (two picks one line), CRM-linked RECEIPT billing sample,
 * dual-order wave (two outbounds, one wave DONE), CRM PUTAWAY + ADJUSTMENT billing samples,
 * freezer-lane outbound (pallet SKU from FRZ-01), outbound with ship-to + requestedShipDate,
 * finalized spot load plan (no shipment link), fully picked not packed (PICKING), shelf BIN-S03 pick when ASN putaway stock exists,
 * multi-line outbound with only first line picked (line 2 not started), no-CRM outbound, two-line reverse pick order,
 * three-SKU outbound (toner + paper + corrugated),
 * overdue requestedShipDate + NL cross-border ship-to demo outbounds,
 * [RUSH] notes + near-term requestedShipDate, cold-chamber lane pick (COLD-01),
 * dock door 02 staging receipt + outbound pick, finalized SPOT load plan plannedEta,
 * receiving merge lanes RCV-MRG1 + RCV-MRG2 receipts + floor pick outbounds,
 * putaway queue bin PUT-Q1 receipt + pick-pack-ship outbound,
 * pallet reserve PLT-R06 receipt + outbound, shelf BIN-S01 pick while open cycle count exists,
 * OPEN wave for slotting dry-run (no picks), pack/ship helpers, posted invoice with one line per last reserved billing events.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const WH_CODE = "WH-DEMO-DC1";
const DEMO_WMS_INVOICE_RUN_NO = "INV-DEMO-DC1-Q1";
const DEMO_WMS_INVOICE_RUN_POSTED = "INV-DEMO-DC1-Q2-POSTED";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
if (process.env.USE_DOTENV_LOCAL === "1" || process.env.USE_DOTENV_LOCAL === "true") {
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}
if (cliDatabaseUrl) process.env.DATABASE_URL = cliDatabaseUrl;

const connectionString =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("[wms-demo] Missing DATABASE_URL (or DATABASE_URL_UNPOOLED / DIRECT_URL).");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString,
    }),
  ),
});

const q = (n) => String(n);

async function removeDemoWarehouse(tenantId) {
  const w = await prisma.warehouse.findFirst({
    where: { tenantId, code: WH_CODE },
    select: { id: true },
  });
  if (!w) return;
  await prisma.loadPlan.deleteMany({ where: { warehouseId: w.id } });
  await prisma.warehouse.deleteMany({ where: { id: w.id } });
  console.log(`[wms-demo] Removed previous warehouse ${WH_CODE}.`);
}

async function receipt(db, row) {
  const { tenantId, warehouseId, binId, productId, qty, userId, note, referenceType, referenceId } =
    row;
  await db.inventoryBalance.upsert({
    where: { warehouseId_binId_productId: { warehouseId, binId, productId } },
    create: {
      tenantId,
      warehouseId,
      binId,
      productId,
      onHandQty: q(qty),
    },
    update: { onHandQty: { increment: q(qty) } },
  });
  await db.inventoryMovement.create({
    data: {
      tenantId,
      warehouseId,
      binId,
      productId,
      movementType: "RECEIPT",
      quantity: q(qty),
      referenceType: referenceType ?? "WMS_DEMO_SEED",
      referenceId: referenceId ?? warehouseId,
      note: note ?? "Demo receipt",
      createdById: userId,
    },
  });
}

async function putawayDemo(db, row) {
  const { tenantId, warehouseId, binId, productId, qty, userId, note } = row;
  await db.inventoryBalance.upsert({
    where: { warehouseId_binId_productId: { warehouseId, binId, productId } },
    create: {
      tenantId,
      warehouseId,
      binId,
      productId,
      onHandQty: q(qty),
    },
    update: { onHandQty: { increment: q(qty) } },
  });
  await db.inventoryMovement.create({
    data: {
      tenantId,
      warehouseId,
      binId,
      productId,
      movementType: "PUTAWAY",
      quantity: q(qty),
      referenceType: "WMS_DEMO_SEED",
      referenceId: warehouseId,
      note: note ?? "Demo putaway (destination only)",
      createdById: userId,
    },
  });
}

async function adjustment(db, row) {
  const { tenantId, warehouseId, binId, productId, qty, userId, note } = row;
  await db.inventoryBalance.updateMany({
    where: { tenantId, warehouseId, binId, productId },
    data: { onHandQty: { increment: q(qty) } },
  });
  await db.inventoryMovement.create({
    data: {
      tenantId,
      warehouseId,
      binId,
      productId,
      movementType: "ADJUSTMENT",
      quantity: q(qty),
      referenceType: "WMS_DEMO_SEED",
      referenceId: warehouseId,
      note: note ?? "Demo adjustment",
      createdById: userId,
    },
  });
}

async function syncOutboundAfterPick(tenantId, outboundLineId) {
  const line = await prisma.outboundOrderLine.findFirst({
    where: { id: outboundLineId, tenantId },
    select: { outboundOrderId: true },
  });
  if (!line) return;
  const order = await prisma.outboundOrder.findFirst({
    where: { id: line.outboundOrderId, tenantId },
    include: { lines: true },
  });
  if (!order) return;
  if (order.status === "DRAFT" || order.status === "CANCELLED" || order.status === "SHIPPED") return;
  if (order.status === "PACKED") return;
  const anyPick = order.lines.some((l) => Number(l.pickedQty) > 0);
  if (order.status === "RELEASED" && anyPick) {
    await prisma.outboundOrder.updateMany({
      where: { id: order.id, tenantId, status: "RELEASED" },
      data: { status: "PICKING" },
    });
  }
}

/** Set each line packed qty from picked qty and mark order PACKED. */
async function packOutboundOrder(tenantId, outboundOrderId) {
  await prisma.$transaction(async (tx) => {
    const o = await tx.outboundOrder.findFirst({
      where: { id: outboundOrderId, tenantId },
      include: { lines: true },
    });
    if (!o) return;
    for (const line of o.lines) {
      await tx.outboundOrderLine.update({
        where: { id: line.id },
        data: { packedQty: line.pickedQty },
      });
    }
    await tx.outboundOrder.update({ where: { id: o.id }, data: { status: "PACKED" } });
  });
}

/** Ship full packed qty (delta vs shipped), SHIPMENT movements, order SHIPPED. */
async function shipOutboundPackedOrder(tenantId, actorId, outboundOrderId) {
  const packed = await prisma.outboundOrder.findFirst({
    where: { id: outboundOrderId, tenantId },
    include: { lines: true },
  });
  if (!packed) return;
  await prisma.$transaction(async (tx) => {
    for (const line of packed.lines) {
      const shipDelta = Number(line.packedQty) - Number(line.shippedQty);
      if (shipDelta <= 0) continue;
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: packed.warehouseId,
          binId: null,
          productId: line.productId,
          movementType: "SHIPMENT",
          quantity: q(shipDelta),
          referenceType: "OUTBOUND_LINE_SHIP",
          referenceId: line.id,
          createdById: actorId,
          note: `Outbound ${packed.outboundNo} shipped`,
        },
      });
      await tx.outboundOrderLine.update({
        where: { id: line.id },
        data: { shippedQty: line.packedQty },
      });
    }
    await tx.outboundOrder.update({ where: { id: packed.id }, data: { status: "SHIPPED" } });
  });
}

async function completePickTask(tenantId, actorId, taskId) {
  const task = await prisma.wmsTask.findFirst({
    where: { id: taskId, tenantId, status: "OPEN", taskType: "PICK" },
    select: { id: true, warehouseId: true, productId: true, binId: true, quantity: true, referenceId: true },
  });
  if (!task?.productId || !task.binId) throw new Error(`Pick task not found: ${taskId}`);
  const balPre = await prisma.inventoryBalance.findFirst({
    where: { tenantId, warehouseId: task.warehouseId, binId: task.binId, productId: task.productId },
    select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
  });
  if (!balPre || balPre.onHold || Number(balPre.onHandQty) < Number(task.quantity)) {
    throw new Error(`Cannot complete pick task ${taskId} (stock/hold).`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.update({
      where: { id: task.id },
      data: { status: "DONE", completedAt: new Date(), completedById: actorId },
    });
    await tx.inventoryBalance.update({
      where: { id: balPre.id },
      data: {
        onHandQty: { decrement: task.quantity },
        allocatedQty: { decrement: task.quantity },
      },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: task.binId,
        productId: task.productId,
        movementType: "PICK",
        quantity: task.quantity,
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: task.referenceId,
        createdById: actorId,
      },
    });
    if (task.referenceId) {
      await tx.outboundOrderLine.updateMany({
        where: { id: task.referenceId, tenantId },
        data: { pickedQty: { increment: task.quantity } },
      });
    }
  });
  await syncOutboundAfterPick(tenantId, task.referenceId);
}

/** Mirrors `complete_putaway_task` in post-actions (`targetBinId` overrides suggested bin). */
async function completePutawayTask(tenantId, actorId, taskId, targetBinIdOverride) {
  const task = await prisma.wmsTask.findFirst({
    where: { id: taskId, tenantId, status: "OPEN", taskType: "PUTAWAY" },
    select: {
      id: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      referenceId: true,
      binId: true,
    },
  });
  if (!task?.productId || !task.referenceId) {
    throw new Error(`Putaway task not found: ${taskId}`);
  }
  const targetBinId = targetBinIdOverride || task.binId;
  if (!targetBinId) throw new Error("Putaway target bin required.");
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.update({
      where: { id: task.id },
      data: { status: "DONE", binId: targetBinId, completedAt: new Date(), completedById: actorId },
    });
    await tx.inventoryBalance.upsert({
      where: {
        warehouseId_binId_productId: {
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId: task.productId,
        },
      },
      create: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: targetBinId,
        productId: task.productId,
        onHandQty: task.quantity,
      },
      update: { onHandQty: { increment: task.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: targetBinId,
        productId: task.productId,
        movementType: "PUTAWAY",
        quantity: task.quantity,
        referenceType: "SHIPMENT_ITEM",
        referenceId: task.referenceId,
        createdById: actorId,
      },
    });
  });
}

/** Mirrors `complete_replenish_task` in post-actions (bulk → pick face). */
async function completeReplenishTask(tenantId, actorId, taskId) {
  const task = await prisma.wmsTask.findFirst({
    where: { id: taskId, tenantId, status: "OPEN", taskType: "REPLENISH" },
    select: {
      id: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      binId: true,
      referenceId: true,
    },
  });
  if (!task?.productId || !task.binId || !task.referenceId) {
    throw new Error(`Replenish task not found: ${taskId}`);
  }
  const sourceBinId = task.referenceId;
  const targetBinId = task.binId;
  const productId = task.productId;
  const qtyBook = Number(task.quantity);
  const sourceBalPre = await prisma.inventoryBalance.findFirst({
    where: {
      tenantId,
      warehouseId: task.warehouseId,
      binId: sourceBinId,
      productId,
    },
    select: { id: true, onHandQty: true, allocatedQty: true },
  });
  if (!sourceBalPre) throw new Error("Replenish source balance missing.");
  const movable = Number(sourceBalPre.onHandQty) - Number(sourceBalPre.allocatedQty);
  const moveQty = Math.min(qtyBook, Math.max(0, movable));
  if (moveQty <= 0) throw new Error("Replenish: no movable qty.");
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.update({
      where: { id: task.id },
      data: {
        status: "DONE",
        quantity: q(moveQty),
        completedAt: new Date(),
        completedById: actorId,
      },
    });
    await tx.inventoryBalance.update({
      where: { id: sourceBalPre.id },
      data: { onHandQty: { decrement: q(moveQty) } },
    });
    await tx.inventoryBalance.upsert({
      where: {
        warehouseId_binId_productId: {
          warehouseId: task.warehouseId,
          binId: targetBinId,
          productId,
        },
      },
      create: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: targetBinId,
        productId,
        onHandQty: q(moveQty),
      },
      update: { onHandQty: { increment: q(moveQty) } },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: sourceBinId,
        productId,
        movementType: "ADJUSTMENT",
        quantity: q(-moveQty),
        referenceType: "REPLENISH_TASK",
        referenceId: task.id,
        note: "Replenish out",
        createdById: actorId,
      },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        warehouseId: task.warehouseId,
        binId: targetBinId,
        productId,
        movementType: "ADJUSTMENT",
        quantity: q(moveQty),
        referenceType: "REPLENISH_TASK",
        referenceId: task.id,
        note: "Replenish in",
        createdById: actorId,
      },
    });
  });
}

/** Mirrors `complete_wave` pick processing + wave DONE. */
async function completeWaveTasks(tenantId, actorId, waveId) {
  const lineIds = new Set();
  await prisma.$transaction(async (tx) => {
    const tasks = await tx.wmsTask.findMany({
      where: { tenantId, waveId, taskType: "PICK", status: "OPEN" },
      select: {
        id: true,
        warehouseId: true,
        productId: true,
        binId: true,
        quantity: true,
        referenceId: true,
      },
    });
    for (const task of tasks) {
      if (!task.productId || !task.binId) continue;
      if (task.referenceId) lineIds.add(task.referenceId);
      const bal = await tx.inventoryBalance.findFirst({
        where: {
          tenantId,
          warehouseId: task.warehouseId,
          productId: task.productId,
          binId: task.binId,
        },
        select: { id: true, onHandQty: true, allocatedQty: true, onHold: true },
      });
      if (!bal || bal.onHold || Number(bal.onHandQty) < Number(task.quantity)) continue;
      await tx.wmsTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date(), completedById: actorId },
      });
      await tx.inventoryBalance.update({
        where: { id: bal.id },
        data: {
          onHandQty: { decrement: task.quantity },
          allocatedQty: { decrement: task.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: task.binId,
          productId: task.productId,
          movementType: "PICK",
          quantity: task.quantity,
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: task.referenceId,
          createdById: actorId,
          note: "Wave completed",
        },
      });
      if (task.referenceId) {
        await tx.outboundOrderLine.updateMany({
          where: { id: task.referenceId, tenantId },
          data: { pickedQty: { increment: task.quantity } },
        });
      }
    }
    await tx.wmsWave.updateMany({
      where: { id: waveId, tenantId },
      data: { status: "DONE", completedAt: new Date() },
    });
  });
  for (const lineId of lineIds) {
    await syncOutboundAfterPick(tenantId, lineId);
  }
}

/** Mirrors `complete_cycle_count_task` in post-actions. */
async function completeCycleCountTask(tenantId, actorId, taskId, countedQty) {
  const counted = Number(countedQty);
  if (!Number.isFinite(counted) || counted < 0) {
    throw new Error(`Invalid countedQty for cycle count ${taskId}`);
  }
  const task = await prisma.wmsTask.findFirst({
    where: { id: taskId, tenantId, status: "OPEN", taskType: "CYCLE_COUNT" },
    select: {
      id: true,
      warehouseId: true,
      binId: true,
      productId: true,
      quantity: true,
      referenceId: true,
    },
  });
  if (!task?.productId || !task.binId || !task.referenceId) {
    throw new Error(`Cycle count task not found: ${taskId}`);
  }
  const book = Number(task.quantity);
  const variance = counted - book;
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.update({
      where: { id: task.id },
      data: { status: "DONE", completedAt: new Date(), completedById: actorId },
    });
    if (variance !== 0) {
      await tx.inventoryBalance.updateMany({
        where: { id: task.referenceId, tenantId },
        data: { onHandQty: { increment: q(variance) } },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          warehouseId: task.warehouseId,
          binId: task.binId,
          productId: task.productId,
          movementType: "ADJUSTMENT",
          quantity: q(variance),
          referenceType: "CYCLE_COUNT_TASK",
          referenceId: task.id,
          note: `Count variance (book ${book} → counted ${counted})`,
          createdById: actorId,
        },
      });
    }
  });
}

/** Draft invoice run rolling up billing events for this warehouse (last 3 events left unlinked for posted run when count > 3). */
async function seedDemoBillingInvoiceRun(tenantId, warehouseId, actorId) {
  const eventsAll = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, invoiceRunId: null },
    select: { id: true, amount: true },
    orderBy: { occurredAt: "asc" },
  });
  if (eventsAll.length === 0) return 0;
  const forDraft =
    eventsAll.length > 3 ? eventsAll.slice(0, -3) : eventsAll;
  const total = forDraft.reduce((s, e) => s + Number(e.amount), 0);
  const totalStr = total.toFixed(2);
  const run = await prisma.wmsBillingInvoiceRun.create({
    data: {
      tenantId,
      runNo: DEMO_WMS_INVOICE_RUN_NO,
      periodFrom: new Date(Date.now() - 45 * 86_400_000),
      periodTo: new Date(),
      status: "DRAFT",
      totalAmount: totalStr,
      currency: "USD",
      createdById: actorId,
      lines: {
        create: {
          tenantId,
          lineNo: 1,
          description: "Warehouse handling — demo rollup (seeded events in period)",
          quantity: "1",
          unitAmount: totalStr,
          lineAmount: totalStr,
        },
      },
    },
  });
  await prisma.wmsBillingEvent.updateMany({
    where: { id: { in: forDraft.map((e) => e.id) } },
    data: { invoiceRunId: run.id },
  });
  return forDraft.length;
}

/** Posted invoice run: links last reserved billing events with one invoice line each (or zero placeholder if none pending). */
async function seedDemoPostedInvoiceRun(tenantId, actorId, warehouseId) {
  const pending = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, invoiceRunId: null },
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      amount: true,
      quantity: true,
      movementType: true,
      rateCode: true,
      product: { select: { sku: true } },
    },
  });
  if (pending.length === 0) {
    await prisma.wmsBillingInvoiceRun.create({
      data: {
        tenantId,
        runNo: DEMO_WMS_INVOICE_RUN_POSTED,
        periodFrom: new Date(Date.now() - 7 * 86_400_000),
        periodTo: new Date(),
        status: "POSTED",
        totalAmount: "0.00",
        currency: "USD",
        createdById: actorId,
        lines: {
          create: {
            tenantId,
            lineNo: 1,
            description: "Demo posted run — period closed, no incremental charges",
            quantity: "1",
            unitAmount: "0.0000",
            lineAmount: "0.00",
          },
        },
      },
    });
    return;
  }
  const total = pending.reduce((s, e) => s + Number(e.amount), 0);
  const totalStr = total.toFixed(2);
  const lineCreates = pending.map((e, i) => {
    const amt = Number(e.amount);
    const qtyAbs = Math.abs(Number(e.quantity));
    const lineAmt = amt.toFixed(2);
    const unitStr = qtyAbs > 0 ? (amt / qtyAbs).toFixed(4) : lineAmt;
    const sku = e.product?.sku ?? "—";
    return {
      tenantId,
      lineNo: i + 1,
      description: `${e.movementType} — ${sku} (${e.rateCode})`,
      quantity: String(qtyAbs || 1),
      unitAmount: unitStr,
      lineAmount: lineAmt,
    };
  });
  const run = await prisma.wmsBillingInvoiceRun.create({
    data: {
      tenantId,
      runNo: DEMO_WMS_INVOICE_RUN_POSTED,
      periodFrom: new Date(Date.now() - 7 * 86_400_000),
      periodTo: new Date(),
      status: "POSTED",
      totalAmount: totalStr,
      currency: "USD",
      createdById: actorId,
      lines: { create: lineCreates },
    },
  });
  await prisma.wmsBillingEvent.updateMany({
    where: { id: { in: pending.map((e) => e.id) } },
    data: { invoiceRunId: run.id },
  });
}

/** Demo billing rows for movements in this warehouse (skips already billed). */
async function seedDemoBillingEvents(tenantId, warehouseId, limit = 500) {
  const rates = await prisma.wmsBillingRate.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: "asc" },
  });
  if (rates.length === 0) {
    console.warn("[wms-demo] No WmsBillingRate rows — skip billing events (run db:seed).");
    return 0;
  }
  const pickRate = (movementType) =>
    rates.find((r) => r.movementType === movementType) ?? rates.find((r) => r.movementType === null);

  const movements = await prisma.inventoryMovement.findMany({
    where: { tenantId, warehouseId },
    select: {
      id: true,
      movementType: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (movements.length === 0) return 0;

  const existing = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, inventoryMovementId: { in: movements.map((m) => m.id) } },
    select: { inventoryMovementId: true },
  });
  const billed = new Set(existing.map((e) => e.inventoryMovementId).filter(Boolean));

  let created = 0;
  for (const mv of movements) {
    if (billed.has(mv.id)) continue;
    const rate = pickRate(mv.movementType);
    if (!rate) continue;
    const qty = Math.abs(Number(mv.quantity));
    const unit = Number(rate.amountPerUnit);
    const amount = (Math.round(qty * unit * 100) / 100).toFixed(2);
    await prisma.wmsBillingEvent.create({
      data: {
        tenantId,
        profileSource: "MANUAL",
        crmAccountId: null,
        inventoryMovementId: mv.id,
        movementType: mv.movementType,
        warehouseId: mv.warehouseId,
        productId: mv.productId,
        quantity: mv.quantity,
        rateCode: rate.code,
        unitRate: rate.amountPerUnit,
        amount,
        currency: rate.currency ?? "USD",
        occurredAt: mv.createdAt,
      },
    });
    created += 1;
  }
  return created;
}

async function main() {
  console.log("[wms-demo] Starting…");

  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-company" }, select: { id: true } });
  if (!tenant) {
    console.error("[wms-demo] Tenant demo-company not found. Run npm run db:seed first.");
    process.exit(1);
  }
  const tenantId = tenant.id;

  const buyer = await prisma.user.findFirst({
    where: { tenantId, email: "buyer@demo-company.com" },
    select: { id: true },
  });
  if (!buyer) {
    console.error("[wms-demo] buyer@demo-company.com not found. Run npm run db:seed first.");
    process.exit(1);
  }
  const actorId = buyer.id;

  const crm = await prisma.crmAccount.findFirst({
    where: { tenantId, name: "Demo Logistics Customer" },
    select: { id: true },
  });
  if (!crm) {
    console.error("[wms-demo] Demo Logistics Customer CRM account not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const skus = ["OFF-PAPER-A4-500", "OFF-TONER-GEN-1", "PKG-CORR-ROLL", "PKG-PALLET-48"];
  const products = await prisma.product.findMany({
    where: { tenantId, sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const bySku = new Map(products.map((p) => [p.sku, p.id]));
  for (const s of skus) {
    if (!bySku.has(s)) {
      console.error(`[wms-demo] Missing product SKU ${s}. Run npm run db:seed first.`);
      process.exit(1);
    }
  }
  const paperId = bySku.get("OFF-PAPER-A4-500");
  const tonerId = bySku.get("OFF-TONER-GEN-1");
  const corrId = bySku.get("PKG-CORR-ROLL");
  const palletSkuId = bySku.get("PKG-PALLET-48");

  await removeDemoWarehouse(tenantId);
  /** Invoice runs are tenant-scoped, not warehouse-cascaded — clear demo run for idempotent re-seed. */
  await prisma.wmsBillingInvoiceRun.deleteMany({
    where: { tenantId, runNo: { in: [DEMO_WMS_INVOICE_RUN_NO, DEMO_WMS_INVOICE_RUN_POSTED] } },
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId,
      code: WH_CODE,
      name: "Demo DC EU-1 (~20 000 sqm, 20 dock doors)",
      type: "WAREHOUSE",
      addressLine1: "Design capacity ~20 000 sqm; 20 dock positions (demo narrative)",
      city: "Frankfurt",
      region: "HE",
      countryCode: "DE",
      isActive: true,
    },
  });
  const warehouseId = warehouse.id;

  const zoneDefs = [
    ["IN-RCV", "Inbound receiving & dock marshalling", "RECEIVING"],
    ["IN-STG", "Inbound pre-putaway staging", "STAGING"],
    ["XD-STG", "Cross-dock / flow-through staging", "STAGING"],
    ["PUT-STG", "Putaway queue / induction", "STAGING"],
    ["BULK-RES", "Pallet reserve (ambient bulk)", "RESERVE"],
    ["BIN-RES", "Bin / shelf reserve (ambient)", "RESERVE"],
    ["COLD-RES", "Cold storage (+2°C to +8°C)", "RESERVE"],
    ["FREEZ-RES", "Freezer storage", "RESERVE"],
    ["PICK-FAC", "Pick face & pack benches", "PICKING"],
    ["QUAR", "Quarantine / QA hold", "QUARANTINE"],
    ["OUT-STG", "Outbound sortation & order merge", "STAGING"],
    ["DOCKS", "Shipping dock doors (01–20)", "SHIPPING"],
  ];

  /** @type {Map<string, string>} */
  const zoneIdByCode = new Map();
  for (const [code, name, zoneType] of zoneDefs) {
    const z = await prisma.warehouseZone.create({
      data: { tenantId, warehouseId, code, name, zoneType },
    });
    zoneIdByCode.set(code, z.id);
  }

  const inStgZoneId = zoneIdByCode.get("IN-STG");
  if (inStgZoneId) {
    await prisma.warehouseZone.update({
      where: { id: inStgZoneId },
      data: {
        isActive: false,
        name: "Inbound pre-putaway staging (inactive — demo)",
      },
    });
  }

  const binRows = [];
  const addBin = (code, zoneCode, storageType, opts = {}) => {
    binRows.push({
      tenantId,
      warehouseId,
      zoneId: zoneIdByCode.get(zoneCode),
      code,
      name: opts.name ?? code,
      storageType,
      isPickFace: Boolean(opts.isPickFace),
      maxPallets: opts.maxPallets ?? null,
    });
  };

  addBin("RCV-MRG1", "IN-RCV", "PALLET", { name: "Receiving merge lane 1" });
  addBin("RCV-MRG2", "IN-RCV", "PALLET", { name: "Receiving merge lane 2" });
  addBin("INB-STG-1", "IN-STG", "FLOOR", { name: "Inbound floor staging" });
  addBin("XDOCK-A1", "XD-STG", "FLOOR", { name: "Cross-dock cell A1" });
  addBin("PUT-Q1", "PUT-STG", "STAGING", { name: "Putaway queue 1" });
  for (let i = 1; i <= 6; i += 1) {
    const n = String(i).padStart(2, "0");
    addBin(`PLT-R${n}`, "BULK-RES", "PALLET", { name: `Pallet reserve ${n}` });
  }
  for (let i = 1; i <= 4; i += 1) {
    const n = String(i).padStart(2, "0");
    addBin(`BIN-S${n}`, "BIN-RES", "SHELF", { name: `Shelf bin ${n}` });
  }
  addBin("COLD-01", "COLD-RES", "SHELF", { name: "Cold chamber lane 01" });
  addBin("FRZ-01", "FREEZ-RES", "PALLET", { name: "Freezer lane 01" });
  for (let i = 1; i <= 3; i += 1) {
    const n = String(i).padStart(2, "0");
    addBin(`PF-${n}`, "PICK-FAC", "SHELF", { name: `Pick face ${n}`, isPickFace: true });
  }
  addBin("Q-01", "QUAR", "QUARANTINE", { name: "Quarantine bin" });
  addBin("OUT-STG1", "OUT-STG", "STAGING", { name: "Outbound staging lane 1" });
  for (let d = 1; d <= 20; d += 1) {
    const n = String(d).padStart(2, "0");
    addBin(`DOCK-${n}`, "DOCKS", "FLOOR", { name: `Dock door ${n}` });
  }

  await prisma.warehouseBin.createMany({ data: binRows });

  const bins = await prisma.warehouseBin.findMany({
    where: { warehouseId },
    select: { id: true, code: true },
  });
  /** @type {Map<string, string>} */
  const binId = new Map(bins.map((b) => [b.code, b.id]));
  const B = (code) => {
    const id = binId.get(code);
    if (!id) throw new Error(`Missing bin ${code}`);
    return id;
  };

  await prisma.warehouseBin.updateMany({
    where: { warehouseId, code: { in: ["PLT-R01", "PLT-R02", "PLT-R03"] } },
    data: { maxPallets: 18 },
  });
  await prisma.warehouseBin.updateMany({
    where: { warehouseId, code: "INB-STG-1" },
    data: {
      isActive: false,
      name: "Inbound floor staging (inactive — demo)",
    },
  });

  const base = { tenantId, warehouseId, userId: actorId };
  for (const step of [
    () => receipt(prisma, { ...base, binId: B("PLT-R01"), productId: paperId, qty: 500, note: "ASN inbound (bulk reserve)" }),
    () =>
      adjustment(prisma, {
        ...base,
        binId: B("PLT-R01"),
        productId: paperId,
        qty: -5,
        note: "Demo shrink / count correction",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("RCV-MRG1"),
        productId: paperId,
        qty: 100,
        note: "Receiving checkpoint (dock)",
      }),
    () =>
      putawayDemo(prisma, {
        ...base,
        binId: B("PLT-R02"),
        productId: paperId,
        qty: 100,
        note: "Putaway from receiving (demo)",
      }),
    () => receipt(prisma, { ...base, binId: B("PLT-R05"), productId: tonerId, qty: 280, note: "Bulk reserve — toner" }),
    () => receipt(prisma, { ...base, binId: B("PF-01"), productId: tonerId, qty: 30, note: "Pick-face receipt" }),
    () => receipt(prisma, { ...base, binId: B("PLT-R03"), productId: corrId, qty: 500, note: "Cases in reserve" }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("XDOCK-A1"),
        productId: corrId,
        qty: 120,
        note: "Cross-dock / flow-through receipt",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("FRZ-01"),
        productId: palletSkuId,
        qty: 60,
        note: "Inbound to freezer reserve",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("COLD-01"),
        productId: paperId,
        qty: 40,
        note: "Cold-chain ambient SKU (demo)",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("Q-01"),
        productId: tonerId,
        qty: 25,
        note: "Lot sampling — pending QA",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("BIN-S01"),
        productId: paperId,
        qty: 150,
        note: "Reserve bin for cycle count demo",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("BIN-S02"),
        productId: paperId,
        qty: 48,
        note: "Shelf bin — cycle count with variance (demo)",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("PLT-R04"),
        productId: paperId,
        qty: 200,
        note: "Bulk reserve — paper (replen source)",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("PF-02"),
        productId: paperId,
        qty: 15,
        note: "Pick face — paper (low, replen target)",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("OUT-STG1"),
        productId: corrId,
        qty: 24,
        note: "Outbound sort lane — pre-wave consolidation (demo)",
      }),
    () =>
      receipt(prisma, {
        ...base,
        binId: B("BIN-S04"),
        productId: paperId,
        qty: 22,
        note: "Shelf reserve — hold / clear / zero-variance count (demo)",
      }),
  ]) {
    await step();
  }

  await prisma.inventoryBalance.updateMany({
    where: { tenantId, warehouseId, binId: B("Q-01"), productId: tonerId },
    data: { onHold: true, holdReason: "QA sampling — demo hold" },
  });

  const balBinS04 = await prisma.inventoryBalance.findFirst({
    where: { tenantId, warehouseId, binId: B("BIN-S04"), productId: paperId },
    select: { id: true },
  });
  if (balBinS04) {
    await prisma.inventoryBalance.updateMany({
      where: { id: balBinS04.id, tenantId },
      data: { onHold: true, holdReason: "Spot check — QA flash hold (demo)" },
    });
    await prisma.inventoryBalance.updateMany({
      where: { id: balBinS04.id, tenantId },
      data: { onHold: false, holdReason: null },
    });
    const ccZeroVar = await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "CYCLE_COUNT",
        binId: B("BIN-S04"),
        productId: paperId,
        referenceType: "INVENTORY_BALANCE",
        referenceId: balBinS04.id,
        quantity: "22",
        note: "Cycle count — zero variance (book = counted)",
        createdById: actorId,
      },
      select: { id: true },
    });
    await completeCycleCountTask(tenantId, actorId, ccZeroVar.id, 22);
  }

  const shipmentLineForPutaway = await prisma.shipmentItem.findFirst({
    where: { shipment: { order: { tenantId } } },
    include: {
      shipment: { select: { id: true, orderId: true } },
      orderItem: { select: { productId: true } },
    },
  });
  if (shipmentLineForPutaway?.orderItem?.productId) {
    const putawayFromAsn = await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PUTAWAY",
        shipmentId: shipmentLineForPutaway.shipment.id,
        orderId: shipmentLineForPutaway.shipment.orderId,
        productId: shipmentLineForPutaway.orderItem.productId,
        binId: B("PUT-Q1"),
        referenceType: "SHIPMENT_ITEM",
        referenceId: shipmentLineForPutaway.id,
        quantity: "8",
        note: "Putaway from ASN line → completed to shelf bin BIN-S03",
        createdById: actorId,
      },
      select: { id: true },
    });
    await completePutawayTask(tenantId, actorId, putawayFromAsn.id, B("BIN-S03"));
  } else {
    console.warn("[wms-demo] No ShipmentItem for tenant — skip PUTAWAY from ASN (ensure npm run db:seed).");
  }

  const balBinS01 = await prisma.inventoryBalance.findFirst({
    where: { tenantId, warehouseId, binId: B("BIN-S01"), productId: paperId },
    select: { id: true },
  });

  await prisma.replenishmentRule.upsert({
    where: { warehouseId_productId: { warehouseId, productId: tonerId } },
    create: {
      tenantId,
      warehouseId,
      productId: tonerId,
      sourceZoneId: zoneIdByCode.get("BULK-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "80",
      maxPickQty: "400",
      replenishQty: "100",
      isActive: true,
    },
    update: {
      sourceZoneId: zoneIdByCode.get("BULK-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "80",
      maxPickQty: "400",
      replenishQty: "100",
      isActive: true,
    },
  });

  await prisma.replenishmentRule.upsert({
    where: { warehouseId_productId: { warehouseId, productId: paperId } },
    create: {
      tenantId,
      warehouseId,
      productId: paperId,
      sourceZoneId: zoneIdByCode.get("BULK-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "50",
      maxPickQty: "500",
      replenishQty: "75",
      isActive: true,
    },
    update: {
      sourceZoneId: zoneIdByCode.get("BULK-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "50",
      maxPickQty: "500",
      replenishQty: "75",
      isActive: true,
    },
  });

  await prisma.replenishmentRule.upsert({
    where: { warehouseId_productId: { warehouseId, productId: palletSkuId } },
    create: {
      tenantId,
      warehouseId,
      productId: palletSkuId,
      sourceZoneId: zoneIdByCode.get("FREEZ-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "10",
      maxPickQty: "100",
      replenishQty: "20",
      isActive: false,
    },
    update: {
      sourceZoneId: zoneIdByCode.get("FREEZ-RES"),
      targetZoneId: zoneIdByCode.get("PICK-FAC"),
      minPickQty: "10",
      maxPickQty: "100",
      replenishQty: "20",
      isActive: false,
    },
  });

  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-ROAD",
      warehouseId,
      transportMode: "ROAD",
      containerSize: "TRUCK_13_6",
      status: "DRAFT",
      notes: "Demo load plan (outbound trailer against dock cut)",
      createdById: actorId,
    },
  });
  const plannedEtaRoad = new Date(Date.now() + 5 * 86_400_000);
  await prisma.$executeRaw`
    UPDATE "LoadPlan"
    SET "plannedEta" = ${plannedEtaRoad}
    WHERE "tenantId" = ${tenantId} AND "warehouseId" = ${warehouseId} AND "reference" = ${"LP-DEMO-DC1-ROAD"}
  `;
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-FINAL",
      warehouseId,
      transportMode: "ROAD",
      containerSize: "TRUCK_13_6",
      status: "FINALIZED",
      notes: "Demo sealed / finalized load plan",
      createdById: actorId,
    },
  });
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-VOID",
      warehouseId,
      transportMode: "ROAD",
      containerSize: "LCL",
      status: "CANCELLED",
      notes: "Demo cancelled load plan (customer pulled forwarder booking)",
      createdById: actorId,
    },
  });
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-SPOT",
      warehouseId,
      transportMode: "ROAD",
      containerSize: "LCL",
      status: "FINALIZED",
      notes: "Demo spot charter / ad-hoc truck — sealed without tenant shipment link",
      createdById: actorId,
    },
  });
  const plannedEtaSpot = new Date(Date.now() + 3 * 86_400_000);
  await prisma.$executeRaw`
    UPDATE "LoadPlan"
    SET "plannedEta" = ${plannedEtaSpot}
    WHERE "tenantId" = ${tenantId} AND "warehouseId" = ${warehouseId} AND "reference" = ${"LP-DEMO-DC1-SPOT"}
  `;
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-AIR",
      warehouseId,
      transportMode: "AIR",
      containerSize: "AIR_ULD",
      status: "DRAFT",
      notes: "Demo ULD air spot (linehaul staging)",
      createdById: actorId,
    },
  });
  const plannedEtaAir = new Date(Date.now() + 2 * 86_400_000);
  await prisma.$executeRaw`
    UPDATE "LoadPlan"
    SET "plannedEta" = ${plannedEtaAir}
    WHERE "tenantId" = ${tenantId} AND "warehouseId" = ${warehouseId} AND "reference" = ${"LP-DEMO-DC1-AIR"}
  `;
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-RAIL",
      warehouseId,
      transportMode: "RAIL",
      containerSize: "LCL",
      status: "DRAFT",
      notes: "Demo block train / rail shuttle (WMS staging)",
      createdById: actorId,
    },
  });
  const plannedEtaRail = new Date(Date.now() + 7 * 86_400_000);
  await prisma.$executeRaw`
    UPDATE "LoadPlan"
    SET "plannedEta" = ${plannedEtaRail}
    WHERE "tenantId" = ${tenantId} AND "warehouseId" = ${warehouseId} AND "reference" = ${"LP-DEMO-DC1-RAIL"}
  `;
  await prisma.loadPlan.create({
    data: {
      tenantId,
      reference: "LP-DEMO-DC1-OCEAN",
      warehouseId,
      transportMode: "OCEAN",
      containerSize: "FCL_40",
      status: "DRAFT",
      notes: "Demo FCL export — CY cut / vessel booking TBD",
      createdById: actorId,
    },
  });
  const plannedEtaOcean = new Date(Date.now() + 14 * 86_400_000);
  await prisma.$executeRaw`
    UPDATE "LoadPlan"
    SET "plannedEta" = ${plannedEtaOcean}
    WHERE "tenantId" = ${tenantId} AND "warehouseId" = ${warehouseId} AND "reference" = ${"LP-DEMO-DC1-OCEAN"}
  `;

  const loadPlanFinalRow = await prisma.loadPlan.findFirst({
    where: { tenantId, warehouseId, reference: "LP-DEMO-DC1-FINAL" },
    select: { id: true },
  });
  const tenantShipmentForPlan = await prisma.shipment.findFirst({
    where: { order: { tenantId } },
    select: { id: true },
  });
  if (loadPlanFinalRow && tenantShipmentForPlan) {
    const already = await prisma.loadPlanShipment.findUnique({
      where: { shipmentId: tenantShipmentForPlan.id },
      select: { id: true },
    });
    if (!already) {
      await prisma.loadPlanShipment.create({
        data: {
          loadPlanId: loadPlanFinalRow.id,
          shipmentId: tenantShipmentForPlan.id,
        },
      });
    }
    const eta = new Date(Date.now() + 2 * 86_400_000);
    await prisma.$executeRaw`
      UPDATE "Shipment"
      SET "asnReference" = ${"WMS-DEMO-ASN-DC1-01"},
          "expectedReceiveAt" = ${eta}
      WHERE "id" = ${tenantShipmentForPlan.id}
    `;
  }

  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-OPEN-1",
      status: "OPEN",
      note: "Open wave — release when ready to allocate picks",
      createdById: actorId,
    },
  });
  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-HIST-1",
      status: "DONE",
      note: "Historical wave (seeded)",
      createdById: actorId,
      releasedAt: new Date(Date.now() - 86_400_000),
      completedAt: new Date(Date.now() - 85_000_000),
    },
  });
  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-4-CAN",
      status: "CANCELLED",
      note: "Cancelled wave (demo — slot re-planned)",
      createdById: actorId,
    },
  });
  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-EMPTY",
      status: "OPEN",
      note: "Empty wave (no pick tasks — template / cancelled plan B)",
      createdById: actorId,
    },
  });
  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-REL-EMPTY",
      status: "RELEASED",
      releasedAt: new Date(),
      note: "Released wave with no tasks (cut cancelled / re-wave)",
      createdById: actorId,
    },
  });
  await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-SLOT",
      status: "OPEN",
      note: "Slotting dry-run (no picks attached — engineering / audit template)",
      createdById: actorId,
    },
  });

  const outShip = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-SHIP",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9001",
      notes: "Demo: full pick → pack → ship (pick face)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "20" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({
    where: { id: outShip.id },
    data: { status: "RELEASED" },
  });
  const lineShip = outShip.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineShip.id,
        productId: tonerId,
        binId: B("PF-01"),
        quantity: "20",
        note: "Demo pick (ship path)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PF-01"), productId: tonerId },
      data: { allocatedQty: { increment: "20" } },
    });
  });
  const pickShipTask = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineShip.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickShipTask.id);
  await packOutboundOrder(tenantId, outShip.id);
  await shipOutboundPackedOrder(tenantId, actorId, outShip.id);

  const outPacked = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-PACKED",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9001B",
      notes: "Demo: picked + packed — awaiting gate-out / ship",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "8" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outPacked.id }, data: { status: "RELEASED" } });
  const linePackedOnly = outPacked.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: linePackedOnly.id,
        productId: tonerId,
        binId: B("PF-01"),
        quantity: "8",
        note: "Demo pick (packed not shipped)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PF-01"), productId: tonerId },
      data: { allocatedQty: { increment: "8" } },
    });
  });
  const pickPackedOnly = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: linePackedOnly.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickPackedOnly.id);
  await packOutboundOrder(tenantId, outPacked.id);

  const outXd = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-XDOCK",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9002",
      notes: "Demo: cross-dock (ship from XDOCK staging)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "80" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outXd.id }, data: { status: "RELEASED" } });
  const lineXd = outXd.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineXd.id,
        productId: corrId,
        binId: B("XDOCK-A1"),
        quantity: "80",
        note: "Cross-dock pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("XDOCK-A1"), productId: corrId },
      data: { allocatedQty: { increment: "80" } },
    });
  });
  const pickXd = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineXd.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickXd.id);
  await packOutboundOrder(tenantId, outXd.id);
  await shipOutboundPackedOrder(tenantId, actorId, outXd.id);

  const outAlloc = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-ALLOC",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9003",
      notes: "Demo: allocation only (open pick task)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "200" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outAlloc.id }, data: { status: "RELEASED" } });
  const lineAlloc = outAlloc.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineAlloc.id,
        productId: paperId,
        binId: B("PLT-R01"),
        quantity: "80",
        note: "Allocated pick (not completed)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R01"), productId: paperId },
      data: { allocatedQty: { increment: "80" } },
    });
  });

  await prisma.wmsTask.create({
    data: {
      tenantId,
      warehouseId,
      taskType: "REPLENISH",
      productId: tonerId,
      binId: B("PF-01"),
      referenceType: "REPLENISH_BIN",
      referenceId: B("PLT-R05"),
      quantity: "100",
      note: "Open replenishment (bulk reserve → pick face)",
      createdById: actorId,
    },
  });

  const replPaperTask = await prisma.wmsTask.create({
    data: {
      tenantId,
      warehouseId,
      taskType: "REPLENISH",
      productId: paperId,
      binId: B("PF-02"),
      referenceType: "REPLENISH_BIN",
      referenceId: B("PLT-R04"),
      quantity: "75",
      note: "Completed replenishment (bulk → pick face)",
      createdById: actorId,
    },
    select: { id: true },
  });
  await completeReplenishTask(tenantId, actorId, replPaperTask.id);

  await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-CANCEL",
      status: "CANCELLED",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9004",
      notes: "Demo: cancelled before execution (customer PO voided)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: palletSkuId, quantity: "12" }],
      },
    },
  });

  const outWave = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-WAVE",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9005",
      notes: "Demo: pick tasks under a released wave (wave complete)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "12" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outWave.id }, data: { status: "RELEASED" } });
  const lineWave = outWave.lines[0];
  const wavePick = await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-2",
      status: "OPEN",
      note: "Demo wave — release then complete picks",
      createdById: actorId,
    },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        waveId: wavePick.id,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineWave.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "12",
        note: "Wave-allocated pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "12" } },
    });
  });
  await prisma.wmsWave.updateMany({
    where: { id: wavePick.id, tenantId, status: "OPEN" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await completeWaveTasks(tenantId, actorId, wavePick.id);

  const waveDual = await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-DUAL",
      status: "OPEN",
      note: "Demo wave — two customer orders, one release, floor complete",
      createdById: actorId,
    },
    select: { id: true },
  });
  const outDualA = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-DUAL-A",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9016A",
      notes: "Demo: wave slice A (corrugated)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "4" }],
      },
    },
    include: { lines: true },
  });
  const outDualB = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-DUAL-B",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9016B",
      notes: "Demo: wave slice B (paper)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "6" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outDualA.id }, data: { status: "RELEASED" } });
  await prisma.outboundOrder.update({ where: { id: outDualB.id }, data: { status: "RELEASED" } });
  const lineDualA = outDualA.lines[0];
  const lineDualB = outDualB.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        waveId: waveDual.id,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineDualA.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "4",
        note: "DUAL wave pick — order A",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "4" } },
    });
  });
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        waveId: waveDual.id,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineDualB.id,
        productId: paperId,
        binId: B("PLT-R04"),
        quantity: "6",
        note: "DUAL wave pick — order B",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R04"), productId: paperId },
      data: { allocatedQty: { increment: "6" } },
    });
  });
  await prisma.wmsWave.updateMany({
    where: { id: waveDual.id, tenantId, status: "OPEN" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await completeWaveTasks(tenantId, actorId, waveDual.id);
  await packOutboundOrder(tenantId, outDualA.id);
  await shipOutboundPackedOrder(tenantId, actorId, outDualA.id);
  await packOutboundOrder(tenantId, outDualB.id);
  await shipOutboundPackedOrder(tenantId, actorId, outDualB.id);

  const balBinS02 = await prisma.inventoryBalance.findFirst({
    where: { tenantId, warehouseId, binId: B("BIN-S02"), productId: paperId },
    select: { id: true },
  });
  if (balBinS02) {
    const ccDone = await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "CYCLE_COUNT",
        binId: B("BIN-S02"),
        productId: paperId,
        referenceType: "INVENTORY_BALANCE",
        referenceId: balBinS02.id,
        quantity: "48",
        note: "Completed cycle count (book 48 → counted 46, variance −2)",
        createdById: actorId,
      },
      select: { id: true },
    });
    await completeCycleCountTask(tenantId, actorId, ccDone.id, 46);
  }

  if (balBinS01) {
    await prisma.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "CYCLE_COUNT",
        binId: B("BIN-S01"),
        productId: paperId,
        referenceType: "INVENTORY_BALANCE",
        referenceId: balBinS01.id,
        quantity: "150",
        note: "Open cycle count (book = task.quantity)",
        createdById: actorId,
      },
    });
  }

  const outMulti = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-MULTI",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9007",
      notes: "Demo: multi-line outbound — full pick, pack, ship",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: corrId, quantity: "15" },
          { tenantId, lineNo: 2, productId: paperId, quantity: "20" },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outMulti.id }, data: { status: "RELEASED" } });
  const linesMulti = [...outMulti.lines].sort((a, b) => a.lineNo - b.lineNo);
  const [lineMultiCorr, lineMultiPaper] = linesMulti;
  for (const [lineRef, pid, bid, qty] of [
    [lineMultiCorr.id, corrId, B("PLT-R03"), "15"],
    [lineMultiPaper.id, paperId, B("PLT-R02"), "20"],
  ]) {
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId,
          taskType: "PICK",
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: lineRef,
          productId: pid,
          binId: bid,
          quantity: qty,
          note: "Demo pick (multi-line ship path)",
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId: bid, productId: pid },
        data: { allocatedQty: { increment: qty } },
      });
    });
    const pt = await prisma.wmsTask.findFirst({
      where: { tenantId, referenceId: lineRef, taskType: "PICK", status: "OPEN" },
      select: { id: true },
    });
    await completePickTask(tenantId, actorId, pt.id);
  }
  await packOutboundOrder(tenantId, outMulti.id);
  await shipOutboundPackedOrder(tenantId, actorId, outMulti.id);

  const outPartial = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-PARTIAL",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9008",
      notes: "Demo: partial pick — order stays PICKING",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "50" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outPartial.id }, data: { status: "RELEASED" } });
  const linePartial = outPartial.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: linePartial.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "15",
        note: "First pick only (line qty 50)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "15" } },
    });
  });
  const pickPartial = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: linePartial.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickPartial.id);
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: linePartial.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "35",
        note: "Second pick for same line (OPEN — line 15/50 picked)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "35" } },
    });
  });

  const outWdef = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-WDEF",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9009",
      notes: "Demo: released order tied to OPEN wave (allocated, not wave-released)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "6" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outWdef.id }, data: { status: "RELEASED" } });
  const lineWdef = outWdef.lines[0];
  const waveStuck = await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-3-STUCK",
      status: "OPEN",
      note: "Open wave with allocated picks (awaiting supervisor release)",
      createdById: actorId,
    },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        waveId: waveStuck.id,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineWdef.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "6",
        note: "Wave pick (wave still OPEN)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "6" } },
    });
  });

  const baseInv = { tenantId, warehouseId, userId: actorId };
  await receipt(prisma, {
    ...baseInv,
    binId: B("DOCK-10"),
    productId: corrId,
    qty: 14,
    note: "Dock door staging — cart consolidated for outbound cut",
  });
  await receipt(prisma, {
    ...baseInv,
    binId: B("DOCK-02"),
    productId: corrId,
    qty: 8,
    note: "Dock 02 short-hold staging (demo lane)",
  });
  await receipt(prisma, {
    ...baseInv,
    binId: B("RCV-MRG2"),
    productId: corrId,
    qty: 15,
    note: "Receiving merge lane 2 — floor stack pending putaway (demo)",
  });
  await receipt(prisma, {
    ...baseInv,
    binId: B("RCV-MRG1"),
    productId: corrId,
    qty: 12,
    note: "Receiving merge lane 1 — floor stack (demo)",
  });
  await receipt(prisma, {
    ...baseInv,
    binId: B("PUT-Q1"),
    productId: paperId,
    qty: 12,
    note: "Putaway queue staging — cart parked pending slotting (demo)",
  });
  await receipt(prisma, {
    ...baseInv,
    binId: B("PLT-R06"),
    productId: corrId,
    qty: 40,
    note: "Pallet reserve lane 06 — overflow corridor (demo)",
  });

  await prisma.wmsTask.create({
    data: {
      tenantId,
      warehouseId,
      taskType: "REPLENISH",
      status: "CANCELLED",
      productId: palletSkuId,
      binId: B("PF-03"),
      referenceType: "REPLENISH_BIN",
      referenceId: B("FRZ-01"),
      quantity: "4",
      note: "Demo: replen task cancelled before execution",
      createdById: actorId,
    },
  });

  const outAddr = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-ADDR",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9010",
      shipToName: "Demo Consignee GmbH",
      shipToLine1: "Industriepark 7",
      shipToCity: "Rotterdam",
      shipToCountryCode: "NL",
      requestedShipDate: new Date(Date.now() + 3 * 86_400_000),
      notes: "Demo: ship-to + dock pick (staging at DOCK-10)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "3" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outAddr.id }, data: { status: "RELEASED" } });
  const lineAddr = outAddr.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineAddr.id,
        productId: corrId,
        binId: B("DOCK-10"),
        quantity: "3",
        note: "Pick from dock staging",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("DOCK-10"), productId: corrId },
      data: { allocatedQty: { increment: "3" } },
    });
  });
  const pickAddr = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineAddr.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickAddr.id);
  await packOutboundOrder(tenantId, outAddr.id);
  await shipOutboundPackedOrder(tenantId, actorId, outAddr.id);

  await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-DRAFT",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9006",
      notes: "Demo: multi-line order not released",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: corrId, quantity: "5" },
          { tenantId, lineNo: 2, productId: paperId, quantity: "10" },
        ],
      },
    },
  });

  const pickPartialSecond = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      warehouseId,
      referenceId: linePartial.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "Second pick" },
    },
    select: { id: true },
  });
  if (pickPartialSecond) {
    await completePickTask(tenantId, actorId, pickPartialSecond.id);
    await packOutboundOrder(tenantId, outPartial.id);
    await shipOutboundPackedOrder(tenantId, actorId, outPartial.id);
  }

  const pickWdefWave = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      warehouseId,
      waveId: waveStuck.id,
      referenceId: lineWdef.id,
      taskType: "PICK",
      status: "OPEN",
    },
    select: { id: true },
  });
  if (pickWdefWave) {
    await completePickTask(tenantId, actorId, pickWdefWave.id);
    await packOutboundOrder(tenantId, outWdef.id);
    await shipOutboundPackedOrder(tenantId, actorId, outWdef.id);
    await prisma.wmsWave.updateMany({
      where: { id: waveStuck.id, tenantId },
      data: {
        status: "DONE",
        releasedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  const outTrio = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-TRIO",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9011",
      notes: "Demo: three lines from three bins — pick, pack, ship",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: corrId, quantity: "2" },
          { tenantId, lineNo: 2, productId: paperId, quantity: "3" },
          { tenantId, lineNo: 3, productId: corrId, quantity: "2" },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outTrio.id }, data: { status: "RELEASED" } });
  const trioLines = [...outTrio.lines].sort((a, b) => a.lineNo - b.lineNo);
  for (const [lineRef, pid, bid, qty] of [
    [trioLines[0].id, corrId, B("OUT-STG1"), "2"],
    [trioLines[1].id, paperId, B("PLT-R02"), "3"],
    [trioLines[2].id, corrId, B("PLT-R03"), "2"],
  ]) {
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId,
          taskType: "PICK",
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: lineRef,
          productId: pid,
          binId: bid,
          quantity: qty,
          note: "TRIO pick leg",
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId: bid, productId: pid },
        data: { allocatedQty: { increment: qty } },
      });
    });
    const pickTrio = await prisma.wmsTask.findFirst({
      where: {
        tenantId,
        referenceId: lineRef,
        taskType: "PICK",
        status: "OPEN",
        note: { contains: "TRIO" },
      },
      select: { id: true },
    });
    if (!pickTrio) throw new Error("[wms-demo] TRIO pick task missing.");
    await completePickTask(tenantId, actorId, pickTrio.id);
  }
  await packOutboundOrder(tenantId, outTrio.id);
  await shipOutboundPackedOrder(tenantId, actorId, outTrio.id);

  const outSplit = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-SPLIT",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9015",
      notes: "Demo: one line, two pick tasks from two reserve bins",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "25" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outSplit.id }, data: { status: "RELEASED" } });
  const lineSplit = outSplit.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineSplit.id,
        productId: paperId,
        binId: B("PLT-R01"),
        quantity: "10",
        note: "SPLIT pick leg 1 (PLT-R01)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R01"), productId: paperId },
      data: { allocatedQty: { increment: "10" } },
    });
  });
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineSplit.id,
        productId: paperId,
        binId: B("PLT-R02"),
        quantity: "15",
        note: "SPLIT pick leg 2 (PLT-R02)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R02"), productId: paperId },
      data: { allocatedQty: { increment: "15" } },
    });
  });
  const pickSplit1 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineSplit.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "SPLIT pick leg 1" },
    },
    select: { id: true },
  });
  const pickSplit2 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineSplit.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "SPLIT pick leg 2" },
    },
    select: { id: true },
  });
  if (!pickSplit1 || !pickSplit2) throw new Error("[wms-demo] SPLIT pick tasks missing.");
  await completePickTask(tenantId, actorId, pickSplit1.id);
  await completePickTask(tenantId, actorId, pickSplit2.id);
  await packOutboundOrder(tenantId, outSplit.id);
  await shipOutboundPackedOrder(tenantId, actorId, outSplit.id);

  const outWaveRel = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-WREL",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9012",
      notes: "Demo: RELEASED wave with OPEN pick (allocated, not executed)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "5" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outWaveRel.id }, data: { status: "RELEASED" } });
  const lineWaveRel = outWaveRel.lines[0];
  const waveReleasedPending = await prisma.wmsWave.create({
    data: {
      tenantId,
      warehouseId,
      waveNo: "W-DEMO-WAVE-REL-PEND",
      status: "RELEASED",
      releasedAt: new Date(),
      note: "Released wave — floor pick still OPEN",
      createdById: actorId,
    },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        waveId: waveReleasedPending.id,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineWaveRel.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "5",
        note: "Wave-released pick (OPEN)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "5" } },
    });
  });

  const outCold = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-COLD",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9018",
      notes: "Demo: frozen-reserve lane pick (pallet handling SKU)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: palletSkuId, quantity: "4" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outCold.id }, data: { status: "RELEASED" } });
  const lineCold = outCold.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineCold.id,
        productId: palletSkuId,
        binId: B("FRZ-01"),
        quantity: "4",
        note: "Cold-chain reserve pick (FRZ-01)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("FRZ-01"), productId: palletSkuId },
      data: { allocatedQty: { increment: "4" } },
    });
  });
  const pickCold = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineCold.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  if (!pickCold) throw new Error("[wms-demo] COLD pick task missing.");
  await completePickTask(tenantId, actorId, pickCold.id);
  await packOutboundOrder(tenantId, outCold.id);
  await shipOutboundPackedOrder(tenantId, actorId, outCold.id);

  const outShipTo = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-SHIPTO",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9017",
      shipToName: "Mueller Retail GmbH — Store 442",
      shipToLine1: "Industriepark Nord 12",
      shipToCity: "Hamburg",
      shipToCountryCode: "DE",
      requestedShipDate: new Date(Date.now() + 3 * 86_400_000),
      notes: "Demo: explicit ship-to + requested ship date (labels / routing)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "3" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outShipTo.id }, data: { status: "RELEASED" } });
  const lineShipTo = outShipTo.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineShipTo.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "3",
        note: "Reserve pick for ship-to order",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "3" } },
    });
  });
  const pickShipTo = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineShipTo.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  if (!pickShipTo) throw new Error("[wms-demo] SHIPTO pick task missing.");
  await completePickTask(tenantId, actorId, pickShipTo.id);
  await packOutboundOrder(tenantId, outShipTo.id);
  await shipOutboundPackedOrder(tenantId, actorId, outShipTo.id);

  const outPickFull = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-PICKFULL",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9019",
      notes: "Demo: line fully picked — order stays PICKING until pack (no pack/ship in seed)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "6" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outPickFull.id }, data: { status: "RELEASED" } });
  const linePickFull = outPickFull.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: linePickFull.id,
        productId: tonerId,
        binId: B("PLT-R05"),
        quantity: "6",
        note: "Single pick covers full line qty (awaiting pack)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R05"), productId: tonerId },
      data: { allocatedQty: { increment: "6" } },
    });
  });
  const pickPickFull = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: linePickFull.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  if (!pickPickFull) throw new Error("[wms-demo] PICKFULL pick task missing.");
  await completePickTask(tenantId, actorId, pickPickFull.id);

  const out2L1P = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-2L1P",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9021",
      notes: "Demo: two lines — line 1 fully picked, line 2 not started (multi-line PICKING)",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: paperId, quantity: "5" },
          { tenantId, lineNo: 2, productId: corrId, quantity: "10" },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: out2L1P.id }, data: { status: "RELEASED" } });
  const lines2L = [...out2L1P.lines].sort((a, b) => a.lineNo - b.lineNo);
  const line2LFirst = lines2L[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: line2LFirst.id,
        productId: paperId,
        binId: B("PLT-R02"),
        quantity: "5",
        note: "2L1P — line 1 only (line 2 pending)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R02"), productId: paperId },
      data: { allocatedQty: { increment: "5" } },
    });
  });
  const pick2L1P = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: line2LFirst.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "2L1P" },
    },
    select: { id: true },
  });
  if (!pick2L1P) throw new Error("[wms-demo] 2L1P pick task missing.");
  await completePickTask(tenantId, actorId, pick2L1P.id);

  const outNoCrm = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-NOCRM",
      status: "DRAFT",
      crmAccountId: null,
      customerRef: "SO-DEMO-9022",
      notes: "Demo: no CRM on order (spot / walk-in — bill-to TBD)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "2" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outNoCrm.id }, data: { status: "RELEASED" } });
  const lineNoCrm = outNoCrm.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineNoCrm.id,
        productId: corrId,
        binId: B("OUT-STG1"),
        quantity: "2",
        note: "NOCRM pick from outbound sort lane",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("OUT-STG1"), productId: corrId },
      data: { allocatedQty: { increment: "2" } },
    });
  });
  const pickNoCrm = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineNoCrm.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "NOCRM" },
    },
    select: { id: true },
  });
  if (!pickNoCrm) throw new Error("[wms-demo] NOCRM pick task missing.");
  await completePickTask(tenantId, actorId, pickNoCrm.id);
  await packOutboundOrder(tenantId, outNoCrm.id);
  await shipOutboundPackedOrder(tenantId, actorId, outNoCrm.id);

  const out2LRev = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-2LREV",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9023",
      notes: "Demo: two lines — pick completed in reverse line order (2 then 1)",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: paperId, quantity: "2" },
          { tenantId, lineNo: 2, productId: corrId, quantity: "3" },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: out2LRev.id }, data: { status: "RELEASED" } });
  const linesRev = [...out2LRev.lines].sort((a, b) => a.lineNo - b.lineNo);
  const lineRevPaper = linesRev[0];
  const lineRevCorr = linesRev[1];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineRevCorr.id,
        productId: corrId,
        binId: B("OUT-STG1"),
        quantity: "3",
        note: "2LREV — pick line 2 first (corr)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("OUT-STG1"), productId: corrId },
      data: { allocatedQty: { increment: "3" } },
    });
  });
  const pickRev2 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineRevCorr.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "2LREV" },
    },
    select: { id: true },
  });
  if (!pickRev2) throw new Error("[wms-demo] 2LREV line-2 pick missing.");
  await completePickTask(tenantId, actorId, pickRev2.id);
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineRevPaper.id,
        productId: paperId,
        binId: B("PF-02"),
        quantity: "2",
        note: "2LREV — pick line 1 second (paper pick face)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PF-02"), productId: paperId },
      data: { allocatedQty: { increment: "2" } },
    });
  });
  const pickRev1 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineRevPaper.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "2LREV" },
    },
    select: { id: true },
  });
  if (!pickRev1) throw new Error("[wms-demo] 2LREV line-1 pick missing.");
  await completePickTask(tenantId, actorId, pickRev1.id);
  await packOutboundOrder(tenantId, out2LRev.id);
  await shipOutboundPackedOrder(tenantId, actorId, out2LRev.id);

  const outAllSku = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-ALLSKU",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9024",
      notes: "Demo: one order — toner + paper + corrugated (three product families)",
      createdById: actorId,
      lines: {
        create: [
          { tenantId, lineNo: 1, productId: tonerId, quantity: "1" },
          { tenantId, lineNo: 2, productId: paperId, quantity: "1" },
          { tenantId, lineNo: 3, productId: corrId, quantity: "3" },
        ],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outAllSku.id }, data: { status: "RELEASED" } });
  const legsAll = [...outAllSku.lines].sort((a, b) => a.lineNo - b.lineNo);
  for (const [lineRef, pid, bid, qty, note] of [
    [legsAll[0].id, tonerId, B("PLT-R05"), "1", "ALLSKU toner (bulk)"],
    [legsAll[1].id, paperId, B("PF-02"), "1", "ALLSKU paper (pick face)"],
    [legsAll[2].id, corrId, B("OUT-STG1"), "3", "ALLSKU corr (out sort)"],
  ]) {
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId,
          taskType: "PICK",
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: lineRef,
          productId: pid,
          binId: bid,
          quantity: qty,
          note,
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId: bid, productId: pid },
        data: { allocatedQty: { increment: qty } },
      });
    });
    const pickLeg = await prisma.wmsTask.findFirst({
      where: {
        tenantId,
        referenceId: lineRef,
        taskType: "PICK",
        status: "OPEN",
        note: { contains: "ALLSKU" },
      },
      select: { id: true },
    });
    if (!pickLeg) throw new Error("[wms-demo] ALLSKU pick task missing.");
    await completePickTask(tenantId, actorId, pickLeg.id);
  }
  await packOutboundOrder(tenantId, outAllSku.id);
  await shipOutboundPackedOrder(tenantId, actorId, outAllSku.id);

  const outOverdue = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-OVERDUE",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9025",
      requestedShipDate: new Date(Date.now() - 4 * 86_400_000),
      notes: "Demo: requested ship date in the past (cut missed / expedite queue)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "2" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outOverdue.id }, data: { status: "RELEASED" } });
  const lineOverdue = outOverdue.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineOverdue.id,
        productId: corrId,
        binId: B("PLT-R03"),
        quantity: "2",
        note: "OVERDUE pick (reserve)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R03"), productId: corrId },
      data: { allocatedQty: { increment: "2" } },
    });
  });
  const pickOverdue = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineOverdue.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "OVERDUE" },
    },
    select: { id: true },
  });
  if (!pickOverdue) throw new Error("[wms-demo] OVERDUE pick missing.");
  await completePickTask(tenantId, actorId, pickOverdue.id);
  await packOutboundOrder(tenantId, outOverdue.id);
  await shipOutboundPackedOrder(tenantId, actorId, outOverdue.id);

  const outNl = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-NL",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9026",
      shipToName: "Rotterdam Cold Hub BV",
      shipToLine1: "Haven 8821, Warehouse C",
      shipToCity: "Rotterdam",
      shipToCountryCode: "NL",
      requestedShipDate: new Date(Date.now() + 6 * 86_400_000),
      notes: "Demo: cross-border ship-to (NL) + future requested date",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "2" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outNl.id }, data: { status: "RELEASED" } });
  const lineNl = outNl.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineNl.id,
        productId: paperId,
        binId: B("PLT-R02"),
        quantity: "2",
        note: "NL export pick (bulk paper)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R02"), productId: paperId },
      data: { allocatedQty: { increment: "2" } },
    });
  });
  const pickNl = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineNl.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "NL export" },
    },
    select: { id: true },
  });
  if (!pickNl) throw new Error("[wms-demo] NL pick missing.");
  await completePickTask(tenantId, actorId, pickNl.id);
  await packOutboundOrder(tenantId, outNl.id);
  await shipOutboundPackedOrder(tenantId, actorId, outNl.id);

  const outRush = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-RUSH",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9027",
      requestedShipDate: new Date(Date.now() + 12 * 3_600_000),
      notes: "[RUSH] Same-day customer promise — prioritize pack & gate-out",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "1" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outRush.id }, data: { status: "RELEASED" } });
  const lineRush = outRush.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineRush.id,
        productId: tonerId,
        binId: B("PLT-R05"),
        quantity: "1",
        note: "RUSH pick (bulk toner)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R05"), productId: tonerId },
      data: { allocatedQty: { increment: "1" } },
    });
  });
  const pickRush = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineRush.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "RUSH pick" },
    },
    select: { id: true },
  });
  if (!pickRush) throw new Error("[wms-demo] RUSH pick missing.");
  await completePickTask(tenantId, actorId, pickRush.id);
  await packOutboundOrder(tenantId, outRush.id);
  await shipOutboundPackedOrder(tenantId, actorId, outRush.id);

  const outChill = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-CHILL",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9028",
      notes: "Demo: ambient SKU from cold-chamber reserve lane (COLD-01)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "3" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outChill.id }, data: { status: "RELEASED" } });
  const lineChill = outChill.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineChill.id,
        productId: paperId,
        binId: B("COLD-01"),
        quantity: "3",
        note: "CHILL pick (cold chamber lane)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("COLD-01"), productId: paperId },
      data: { allocatedQty: { increment: "3" } },
    });
  });
  const pickChill = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineChill.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "CHILL pick" },
    },
    select: { id: true },
  });
  if (!pickChill) throw new Error("[wms-demo] CHILL pick missing.");
  await completePickTask(tenantId, actorId, pickChill.id);
  await packOutboundOrder(tenantId, outChill.id);
  await shipOutboundPackedOrder(tenantId, actorId, outChill.id);

  const outDock02 = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-DOCK02",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9029",
      notes: "Demo: pick from dock door 02 staging (express lane)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "5" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outDock02.id }, data: { status: "RELEASED" } });
  const lineDock02 = outDock02.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineDock02.id,
        productId: corrId,
        binId: B("DOCK-02"),
        quantity: "5",
        note: "DOCK-02 staging pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("DOCK-02"), productId: corrId },
      data: { allocatedQty: { increment: "5" } },
    });
  });
  const pickDock02 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineDock02.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "DOCK-02" },
    },
    select: { id: true },
  });
  if (!pickDock02) throw new Error("[wms-demo] DOCK-02 pick missing.");
  await completePickTask(tenantId, actorId, pickDock02.id);
  await packOutboundOrder(tenantId, outDock02.id);
  await shipOutboundPackedOrder(tenantId, actorId, outDock02.id);

  const outRcvM2 = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-RCVM2",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9030",
      notes: "Demo: ship from receiving merge lane (RCV-MRG2 floor)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "6" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outRcvM2.id }, data: { status: "RELEASED" } });
  const lineRcvM2 = outRcvM2.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineRcvM2.id,
        productId: corrId,
        binId: B("RCV-MRG2"),
        quantity: "6",
        note: "RCV-MRG2 receiving-lane pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("RCV-MRG2"), productId: corrId },
      data: { allocatedQty: { increment: "6" } },
    });
  });
  const pickRcvM2 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineRcvM2.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "RCV-MRG2" },
    },
    select: { id: true },
  });
  if (!pickRcvM2) throw new Error("[wms-demo] RCVM2 pick missing.");
  await completePickTask(tenantId, actorId, pickRcvM2.id);
  await packOutboundOrder(tenantId, outRcvM2.id);
  await shipOutboundPackedOrder(tenantId, actorId, outRcvM2.id);

  const outPutQ = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-PUTQ",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9031",
      notes: "Demo: pick from putaway queue staging (PUT-Q1)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "4" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outPutQ.id }, data: { status: "RELEASED" } });
  const linePutQ = outPutQ.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: linePutQ.id,
        productId: paperId,
        binId: B("PUT-Q1"),
        quantity: "4",
        note: "PUT-Q1 putaway-queue pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PUT-Q1"), productId: paperId },
      data: { allocatedQty: { increment: "4" } },
    });
  });
  const pickPutQ = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: linePutQ.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "PUT-Q1" },
    },
    select: { id: true },
  });
  if (!pickPutQ) throw new Error("[wms-demo] PUTQ pick missing.");
  await completePickTask(tenantId, actorId, pickPutQ.id);
  await packOutboundOrder(tenantId, outPutQ.id);
  await shipOutboundPackedOrder(tenantId, actorId, outPutQ.id);

  const outS01 = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-S01",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9032",
      notes: "Demo: pick from BIN-S01 while open cycle count exists on same balance",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: paperId, quantity: "3" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outS01.id }, data: { status: "RELEASED" } });
  const lineS01 = outS01.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineS01.id,
        productId: paperId,
        binId: B("BIN-S01"),
        quantity: "3",
        note: "BIN-S01 shelf pick (open CC on bin)",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("BIN-S01"), productId: paperId },
      data: { allocatedQty: { increment: "3" } },
    });
  });
  const pickS01 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineS01.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "BIN-S01" },
    },
    select: { id: true },
  });
  if (!pickS01) throw new Error("[wms-demo] S01 pick missing.");
  await completePickTask(tenantId, actorId, pickS01.id);
  await packOutboundOrder(tenantId, outS01.id);
  await shipOutboundPackedOrder(tenantId, actorId, outS01.id);

  const outR06 = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-R06",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9033",
      notes: "Demo: overflow reserve lane PLT-R06 (pallet grid tail)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "4" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outR06.id }, data: { status: "RELEASED" } });
  const lineR06 = outR06.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineR06.id,
        productId: corrId,
        binId: B("PLT-R06"),
        quantity: "4",
        note: "PLT-R06 reserve pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R06"), productId: corrId },
      data: { allocatedQty: { increment: "4" } },
    });
  });
  const pickR06 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineR06.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "PLT-R06" },
    },
    select: { id: true },
  });
  if (!pickR06) throw new Error("[wms-demo] R06 pick missing.");
  await completePickTask(tenantId, actorId, pickR06.id);
  await packOutboundOrder(tenantId, outR06.id);
  await shipOutboundPackedOrder(tenantId, actorId, outR06.id);

  const outRcvM1 = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-RCVM1",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9034",
      notes: "Demo: ship from receiving merge lane 1 (RCV-MRG1 floor)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: corrId, quantity: "5" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outRcvM1.id }, data: { status: "RELEASED" } });
  const lineRcvM1 = outRcvM1.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineRcvM1.id,
        productId: corrId,
        binId: B("RCV-MRG1"),
        quantity: "5",
        note: "RCV-MRG1 receiving-lane pick",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("RCV-MRG1"), productId: corrId },
      data: { allocatedQty: { increment: "5" } },
    });
  });
  const pickRcvM1 = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      referenceId: lineRcvM1.id,
      taskType: "PICK",
      status: "OPEN",
      note: { contains: "RCV-MRG1" },
    },
    select: { id: true },
  });
  if (!pickRcvM1) throw new Error("[wms-demo] RCVM1 pick missing.");
  await completePickTask(tenantId, actorId, pickRcvM1.id);
  await packOutboundOrder(tenantId, outRcvM1.id);
  await shipOutboundPackedOrder(tenantId, actorId, outRcvM1.id);

  const balS03 = await prisma.inventoryBalance.findFirst({
    where: { tenantId, warehouseId, binId: B("BIN-S03"), onHandQty: { gt: 0 } },
    select: { productId: true, onHandQty: true },
    orderBy: { updatedAt: "desc" },
  });
  if (balS03 && Number(balS03.onHandQty) >= 1) {
    const shelfQty = String(Math.min(5, Math.floor(Number(balS03.onHandQty))));
    const outShelf = await prisma.outboundOrder.create({
      data: {
        tenantId,
        warehouseId,
        outboundNo: "OUT-DEMO-DC1-SHELF",
        status: "DRAFT",
        crmAccountId: crm.id,
        customerRef: "SO-DEMO-9020",
        notes: "Demo: pick from shelf bin BIN-S03 (post-ASN putaway lane)",
        createdById: actorId,
        lines: {
          create: [{ tenantId, lineNo: 1, productId: balS03.productId, quantity: shelfQty }],
        },
      },
      include: { lines: true },
    });
    await prisma.outboundOrder.update({ where: { id: outShelf.id }, data: { status: "RELEASED" } });
    const lineShelf = outShelf.lines[0];
    await prisma.$transaction(async (tx) => {
      await tx.wmsTask.create({
        data: {
          tenantId,
          warehouseId,
          taskType: "PICK",
          referenceType: "OUTBOUND_LINE_PICK",
          referenceId: lineShelf.id,
          productId: balS03.productId,
          binId: B("BIN-S03"),
          quantity: shelfQty,
          note: "Shelf reserve pick (BIN-S03)",
          createdById: actorId,
        },
      });
      await tx.inventoryBalance.updateMany({
        where: { tenantId, warehouseId, binId: B("BIN-S03"), productId: balS03.productId },
        data: { allocatedQty: { increment: shelfQty } },
      });
    });
    const pickShelf = await prisma.wmsTask.findFirst({
      where: { tenantId, referenceId: lineShelf.id, taskType: "PICK", status: "OPEN" },
      select: { id: true },
    });
    if (pickShelf) {
      await completePickTask(tenantId, actorId, pickShelf.id);
      await packOutboundOrder(tenantId, outShelf.id);
      await shipOutboundPackedOrder(tenantId, actorId, outShelf.id);
    }
  }

  const outDec = await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-DEC",
      status: "DRAFT",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9014",
      notes: "Demo: decimal line qty (2.5 units)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "2.5" }],
      },
    },
    include: { lines: true },
  });
  await prisma.outboundOrder.update({ where: { id: outDec.id }, data: { status: "RELEASED" } });
  const lineDec = outDec.lines[0];
  await prisma.$transaction(async (tx) => {
    await tx.wmsTask.create({
      data: {
        tenantId,
        warehouseId,
        taskType: "PICK",
        referenceType: "OUTBOUND_LINE_PICK",
        referenceId: lineDec.id,
        productId: tonerId,
        binId: B("PLT-R05"),
        quantity: "2.5",
        note: "Decimal pick from bulk",
        createdById: actorId,
      },
    });
    await tx.inventoryBalance.updateMany({
      where: { tenantId, warehouseId, binId: B("PLT-R05"), productId: tonerId },
      data: { allocatedQty: { increment: "2.5" } },
    });
  });
  const pickDec = await prisma.wmsTask.findFirst({
    where: { tenantId, referenceId: lineDec.id, taskType: "PICK", status: "OPEN" },
    select: { id: true },
  });
  await completePickTask(tenantId, actorId, pickDec.id);
  await packOutboundOrder(tenantId, outDec.id);
  await shipOutboundPackedOrder(tenantId, actorId, outDec.id);

  const openTonerReplen = await prisma.wmsTask.findFirst({
    where: {
      tenantId,
      warehouseId,
      taskType: "REPLENISH",
      status: "OPEN",
      productId: tonerId,
    },
    select: { id: true },
  });
  if (openTonerReplen) {
    try {
      await completeReplenishTask(tenantId, actorId, openTonerReplen.id);
    } catch (e) {
      console.warn(
        "[wms-demo] Open toner replenishment not completed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  await prisma.outboundOrder.create({
    data: {
      tenantId,
      warehouseId,
      outboundNo: "OUT-DEMO-DC1-ABORT",
      status: "RELEASED",
      crmAccountId: crm.id,
      customerRef: "SO-DEMO-9013",
      notes: "Demo: released then cancelled (no picks)",
      createdById: actorId,
      lines: {
        create: [{ tenantId, lineNo: 1, productId: tonerId, quantity: "1" }],
      },
    },
  });
  await prisma.outboundOrder.updateMany({
    where: { tenantId, warehouseId, outboundNo: "OUT-DEMO-DC1-ABORT" },
    data: {
      status: "CANCELLED",
      notes: "Customer abort before pick release (demo)",
    },
  });

  const billingCreated = await seedDemoBillingEvents(tenantId, warehouseId, 1100);
  const pickBillSample = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, movementType: "PICK", crmAccountId: null },
    take: 5,
    orderBy: { occurredAt: "asc" },
    select: { id: true },
  });
  if (pickBillSample.length > 0) {
    await prisma.wmsBillingEvent.updateMany({
      where: { id: { in: pickBillSample.map((r) => r.id) } },
      data: { crmAccountId: crm.id, profileSource: "CRM_ACCOUNT" },
    });
  }
  const shipBillSample = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, movementType: "SHIPMENT", crmAccountId: null },
    take: 3,
    orderBy: { occurredAt: "asc" },
    select: { id: true },
  });
  if (shipBillSample.length > 0) {
    await prisma.wmsBillingEvent.updateMany({
      where: { id: { in: shipBillSample.map((r) => r.id) } },
      data: { crmAccountId: crm.id, profileSource: "CRM_ACCOUNT" },
    });
  }
  const rcptBillSample = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, movementType: "RECEIPT", crmAccountId: null },
    take: 2,
    orderBy: { occurredAt: "asc" },
    select: { id: true },
  });
  if (rcptBillSample.length > 0) {
    await prisma.wmsBillingEvent.updateMany({
      where: { id: { in: rcptBillSample.map((r) => r.id) } },
      data: { crmAccountId: crm.id, profileSource: "CRM_ACCOUNT" },
    });
  }
  const putBillSample = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, movementType: "PUTAWAY", crmAccountId: null },
    take: 2,
    orderBy: { occurredAt: "asc" },
    select: { id: true },
  });
  if (putBillSample.length > 0) {
    await prisma.wmsBillingEvent.updateMany({
      where: { id: { in: putBillSample.map((r) => r.id) } },
      data: { crmAccountId: crm.id, profileSource: "CRM_ACCOUNT" },
    });
  }
  const adjBillSample = await prisma.wmsBillingEvent.findMany({
    where: { tenantId, warehouseId, movementType: "ADJUSTMENT", crmAccountId: null },
    take: 1,
    orderBy: { occurredAt: "asc" },
    select: { id: true },
  });
  if (adjBillSample.length > 0) {
    await prisma.wmsBillingEvent.updateMany({
      where: { id: { in: adjBillSample.map((r) => r.id) } },
      data: { crmAccountId: crm.id, profileSource: "CRM_ACCOUNT" },
    });
  }
  const invoiceLinked = await seedDemoBillingInvoiceRun(tenantId, warehouseId, actorId);
  await seedDemoPostedInvoiceRun(tenantId, actorId, warehouseId);

  console.log(
    `[wms-demo] Done. Warehouse ${WH_CODE} (${warehouseId}) — TRIO, OUT-SPLIT, COLD, SHIPTO, PICKFULL, OUT-2L1P+NOCRM+2LREV+ALLSKU+OVERDUE+NL+RUSH+CHILL+DOCK02+RCVM1+RCVM2+PUTQ+S01+R06, SHELF-if-BIN-S03-stock, W-DUAL (2 orders), WREL, wave SLOT, LP SPOT(eta)+ROAD+RAIL(eta)+OCEAN(eta)+AIR(eta)+FINAL+VOID, waves inc. REL-EMPTY, OUT-DEC, replen/ABORT, CRM billing samples, billing cap 1100 mvmt, posted lines on last 3 events, …, WmsBillingEvent: ${billingCreated}, draft events: ${invoiceLinked}, posted ${DEMO_WMS_INVOICE_RUN_POSTED}.`,
  );
}

main()
  .catch((e) => {
    console.error("[wms-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

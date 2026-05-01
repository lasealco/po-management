import { Prisma, type InventoryMovementType, type WmsBillingRate } from "@prisma/client";

import { resolveCrmAccountIdsByMovementIds } from "@/lib/wms/billing-crm-resolve";
import type { DefaultRateSeed } from "@/lib/wms/billing-default-rates";
import { invoiceEligibleBillingEventsWhere } from "@/lib/wms/billing-invoice-eligibility";
import { prisma } from "@/lib/prisma";

function pickRate(
  rates: WmsBillingRate[],
  movementType: InventoryMovementType,
): WmsBillingRate | null {
  const active = rates.filter((r) => r.isActive);
  const match = active.find((r) => r.movementType === movementType);
  if (match) return match;
  return active.find((r) => r.movementType === null) ?? null;
}

export async function ensureDefaultBillingRates(tenantId: string, seeds: DefaultRateSeed[]) {
  for (const s of seeds) {
    await prisma.wmsBillingRate.upsert({
      where: { tenantId_code: { tenantId, code: s.code } },
      create: {
        tenantId,
        code: s.code,
        description: s.description,
        movementType: s.movementType,
        amountPerUnit: s.amountPerUnit,
      },
      update: {
        description: s.description,
        movementType: s.movementType,
        amountPerUnit: s.amountPerUnit,
        isActive: true,
      },
    });
  }
}

export type SyncBillingResult = { created: number; skipped: number };

/** Create `WmsBillingEvent` rows for movements that are not yet billed (no event row). */
export async function syncBillingEventsFromMovements(
  tenantId: string,
  opts: { since?: Date; until?: Date },
): Promise<SyncBillingResult> {
  const since = opts.since ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const until = opts.until ?? new Date();

  const rates = await prisma.wmsBillingRate.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: "asc" },
  });

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      tenantId,
      createdAt: { gte: since, lte: until },
    },
    select: {
      id: true,
      movementType: true,
      warehouseId: true,
      productId: true,
      quantity: true,
      createdAt: true,
      referenceType: true,
      referenceId: true,
    },
  });
  if (movements.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const crmByMovementId = await resolveCrmAccountIdsByMovementIds(tenantId, movements);

  const existing = await prisma.wmsBillingEvent.findMany({
    where: {
      tenantId,
      inventoryMovementId: { in: movements.map((m) => m.id) },
    },
    select: { inventoryMovementId: true },
  });
  const billed = new Set(
    existing.map((e) => e.inventoryMovementId).filter((id): id is string => Boolean(id)),
  );

  let created = 0;
  let skipped = 0;

  for (const mv of movements) {
    if (billed.has(mv.id)) {
      skipped += 1;
      continue;
    }
    const rate = pickRate(rates, mv.movementType);
    if (!rate) {
      skipped += 1;
      continue;
    }
    const qty = new Prisma.Decimal(mv.quantity).abs();
    const unit = new Prisma.Decimal(rate.amountPerUnit);
    const amount = qty.mul(unit).toDecimalPlaces(2);
    const crmAccountId = crmByMovementId.get(mv.id) ?? null;
    const profileSource = crmAccountId ? "CRM_ACCOUNT" : "MANUAL";

    await prisma.wmsBillingEvent.create({
      data: {
        tenantId,
        profileSource,
        crmAccountId,
        inventoryMovementId: mv.id,
        movementType: mv.movementType,
        warehouseId: mv.warehouseId,
        productId: mv.productId,
        quantity: mv.quantity,
        rateCode: rate.code,
        unitRate: rate.amountPerUnit,
        amount,
        currency: rate.currency,
        occurredAt: mv.createdAt,
      },
    });
    created += 1;
  }

  return { created, skipped };
}

export type InvoiceRunResult = {
  runId: string;
  runNo: string;
  lineCount: number;
  totalAmount: string;
  eventCount: number;
};

export async function createInvoiceRunFromUnbilledEvents(
  tenantId: string,
  actorId: string,
  periodFrom: Date,
  periodTo: Date,
): Promise<InvoiceRunResult> {
  const events = await prisma.wmsBillingEvent.findMany({
    where: invoiceEligibleBillingEventsWhere(tenantId, periodFrom, periodTo),
    orderBy: { occurredAt: "asc" },
  });

  if (events.length === 0) {
    throw new Error(
      "No billable unbilled events in the selected period (disputed charges are excluded until cleared).",
    );
  }

  type Agg = { quantity: Prisma.Decimal; amount: Prisma.Decimal; description: string; unitRate: Prisma.Decimal };
  const groups = new Map<string, Agg>();

  for (const e of events) {
    const key = `${e.rateCode}\t${e.movementType}`;
    const cur = groups.get(key);
    const lineAmount = new Prisma.Decimal(e.amount);
    const q = new Prisma.Decimal(e.quantity).abs();
    if (cur) {
      cur.quantity = cur.quantity.plus(q);
      cur.amount = cur.amount.plus(lineAmount);
    } else {
      groups.set(key, {
        quantity: q,
        amount: lineAmount,
        description: `${e.rateCode} (${e.movementType})`,
        unitRate: new Prisma.Decimal(e.unitRate),
      });
    }
  }

  const runNo = `INV-${Date.now().toString(36).toUpperCase()}`;
  let lineNo = 0;
  let total = new Prisma.Decimal(0);
  const lineRows: Array<{
    lineNo: number;
    description: string;
    quantity: Prisma.Decimal;
    unitAmount: Prisma.Decimal;
    lineAmount: Prisma.Decimal;
  }> = [];

  for (const [, agg] of groups) {
    lineNo += 1;
    total = total.plus(agg.amount);
    lineRows.push({
      lineNo,
      description: agg.description,
      quantity: agg.quantity,
      unitAmount: agg.unitRate,
      lineAmount: agg.amount,
    });
  }

  const csvLines = [
    "lineNo,description,quantity,unitAmount,lineAmount",
    ...lineRows.map(
      (r) =>
        `${r.lineNo},"${r.description.replace(/"/g, '""')}",${r.quantity.toString()},${r.unitAmount.toString()},${r.lineAmount.toString()}`,
    ),
  ];
  const csvSnapshot = csvLines.join("\n");

  const distinctCrm = new Set(
    events.map((e) => e.crmAccountId).filter((id): id is string => Boolean(id)),
  );
  const allLinkedCrm = events.every((e) => e.crmAccountId != null);
  const runProfileSource =
    allLinkedCrm && distinctCrm.size === 1 ? ("CRM_ACCOUNT" as const) : ("MANUAL" as const);

  const run = await prisma.$transaction(async (tx) => {
    const inv = await tx.wmsBillingInvoiceRun.create({
      data: {
        tenantId,
        runNo,
        profileSource: runProfileSource,
        periodFrom,
        periodTo,
        status: "DRAFT",
        totalAmount: total,
        currency: "USD",
        csvSnapshot,
        createdById: actorId,
      },
    });

    for (const r of lineRows) {
      await tx.wmsBillingInvoiceLine.create({
        data: {
          tenantId,
          invoiceRunId: inv.id,
          lineNo: r.lineNo,
          description: r.description,
          quantity: r.quantity,
          unitAmount: r.unitAmount,
          lineAmount: r.lineAmount,
        },
      });
    }

    await tx.wmsBillingEvent.updateMany({
      where: {
        tenantId,
        invoiceRunId: null,
        billingDisputed: false,
        id: { in: events.map((e) => e.id) },
      },
      data: { invoiceRunId: inv.id },
    });

    return inv;
  });


  return {
    runId: run.id,
    runNo: run.runNo,
    lineCount: lineRows.length,
    totalAmount: total.toString(),
    eventCount: events.length,
  };
}

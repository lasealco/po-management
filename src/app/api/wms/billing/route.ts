import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { DEFAULT_WMS_BILLING_RATES } from "@/lib/wms/billing-default-rates";
import {
  createInvoiceRunFromUnbilledEvents,
  ensureDefaultBillingRates,
  syncBillingEventsFromMovements,
} from "@/lib/wms/billing-materialize";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type BillingBody = {
  action?: string;
  since?: string;
  until?: string;
  periodFrom?: string;
  periodTo?: string;
  invoiceRunId?: string;
  code?: string;
  description?: string;
  amountPerUnit?: string | number;
  movementType?: string | null;
};

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const csvRunId = new URL(request.url).searchParams.get("csvRun");
  if (csvRunId) {
    const row = await prisma.wmsBillingInvoiceRun.findFirst({
      where: { id: csvRunId, tenantId: tenant.id },
      select: { csvSnapshot: true, runNo: true },
    });
    if (!row?.csvSnapshot) {
      return toApiErrorResponse({ error: "Invoice run or CSV not found.", code: "NOT_FOUND", status: 404 });
    }
    const safeName = row.runNo.replace(/[^\w.-]+/g, "_");
    return new NextResponse(row.csvSnapshot, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
      },
    });
  }

  const [rates, events, runs, unbilledCount] = await Promise.all([
    prisma.wmsBillingRate.findMany({
      where: { tenantId: tenant.id },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        description: true,
        movementType: true,
        amountPerUnit: true,
        currency: true,
        isActive: true,
      },
    }),
    prisma.wmsBillingEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { occurredAt: "desc" },
      take: 80,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, productCode: true, sku: true, name: true } },
        crmAccount: { select: { id: true, name: true } },
        invoiceRun: { select: { id: true, runNo: true, status: true } },
      },
    }),
    prisma.wmsBillingInvoiceRun.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        _count: { select: { lines: true, events: true } },
      },
    }),
    prisma.wmsBillingEvent.count({
      where: { tenantId: tenant.id, invoiceRunId: null },
    }),
  ]);

  return NextResponse.json({
    profileSourceNote:
      "Rates and invoice runs use profileSource MANUAL until Phase C (CRM / commercial).",
    unbilledEventCount: unbilledCount,
    rates: rates.map((r) => ({
      ...r,
      amountPerUnit: r.amountPerUnit.toString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      profileSource: e.profileSource,
      crmAccount: e.crmAccount,
      movementType: e.movementType,
      quantity: e.quantity.toString(),
      rateCode: e.rateCode,
      unitRate: e.unitRate.toString(),
      amount: e.amount.toString(),
      currency: e.currency,
      occurredAt: e.occurredAt.toISOString(),
      warehouse: e.warehouse,
      product: e.product,
      invoiceRun: e.invoiceRun,
    })),
    invoiceRuns: runs.map((r) => ({
      id: r.id,
      runNo: r.runNo,
      profileSource: r.profileSource,
      periodFrom: r.periodFrom.toISOString(),
      periodTo: r.periodTo.toISOString(),
      status: r.status,
      totalAmount: r.totalAmount.toString(),
      currency: r.currency,
      createdAt: r.createdAt.toISOString(),
      lineCount: r._count.lines,
      eventCount: r._count.events,
      hasCsv: Boolean(r.csvSnapshot),
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.wms", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as BillingBody;
  const action = input.action;

  if (action === "ensure_default_rates") {
    await ensureDefaultBillingRates(tenant.id, DEFAULT_WMS_BILLING_RATES);
    return NextResponse.json({ ok: true });
  }

  if (action === "sync_events_from_movements") {
    const since = input.since ? new Date(input.since) : undefined;
    const until = input.until ? new Date(input.until) : undefined;
    if (since && Number.isNaN(since.getTime())) {
      return toApiErrorResponse({ error: "Invalid since date.", code: "BAD_INPUT", status: 400 });
    }
    if (until && Number.isNaN(until.getTime())) {
      return toApiErrorResponse({ error: "Invalid until date.", code: "BAD_INPUT", status: 400 });
    }
    const result = await syncBillingEventsFromMovements(tenant.id, { since, until });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "create_invoice_run") {
    const periodFrom = input.periodFrom ? new Date(input.periodFrom) : null;
    const periodTo = input.periodTo ? new Date(input.periodTo) : null;
    if (!periodFrom || !periodTo || Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      return toApiErrorResponse({ error: "periodFrom and periodTo (ISO) required.", code: "BAD_INPUT", status: 400 });
    }
    if (periodFrom > periodTo) {
      return toApiErrorResponse({ error: "periodFrom must be before periodTo.", code: "BAD_INPUT", status: 400 });
    }
    try {
      const result = await createInvoiceRunFromUnbilledEvents(tenant.id, actorId, periodFrom, periodTo);
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invoice run failed.";
      return toApiErrorResponse({ error: msg, code: "BAD_INPUT", status: 400 });
    }
  }

  if (action === "post_invoice_run") {
    const invoiceRunId = input.invoiceRunId?.trim();
    if (!invoiceRunId) {
      return toApiErrorResponse({ error: "invoiceRunId required.", code: "BAD_INPUT", status: 400 });
    }
    const updated = await prisma.wmsBillingInvoiceRun.updateMany({
      where: { id: invoiceRunId, tenantId: tenant.id, status: "DRAFT" },
      data: { status: "POSTED" },
    });
    if (updated.count === 0) {
      return toApiErrorResponse({ error: "Run not found or not in DRAFT.", code: "NOT_FOUND", status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "upsert_rate") {
    const code = input.code?.trim() ?? "";
    const rawAmt = input.amountPerUnit;
    const amountStr =
      typeof rawAmt === "number" && Number.isFinite(rawAmt)
        ? String(rawAmt)
        : typeof rawAmt === "string"
          ? rawAmt.trim()
          : "";
    if (!code || !amountStr) {
      return toApiErrorResponse({ error: "code and amountPerUnit required.", code: "BAD_INPUT", status: 400 });
    }
    let dec: Prisma.Decimal;
    try {
      dec = new Prisma.Decimal(amountStr);
    } catch {
      return toApiErrorResponse({ error: "Invalid amountPerUnit.", code: "BAD_INPUT", status: 400 });
    }
    if (dec.lessThanOrEqualTo(0)) {
      return toApiErrorResponse({ error: "amountPerUnit must be positive.", code: "BAD_INPUT", status: 400 });
    }
    const m = input.movementType;
    const mt =
      m === "RECEIPT" || m === "PUTAWAY" || m === "PICK" || m === "ADJUSTMENT" || m === "SHIPMENT"
        ? m
        : null;
    const description = input.description?.trim() || null;
    await prisma.wmsBillingRate.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      create: {
        tenantId: tenant.id,
        code,
        description,
        movementType: mt,
        amountPerUnit: dec,
      },
      update: {
        description: description ?? undefined,
        movementType: mt,
        amountPerUnit: dec,
        isActive: true,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return toApiErrorResponse({ error: "Unsupported billing action.", code: "BAD_INPUT", status: 400 });
}

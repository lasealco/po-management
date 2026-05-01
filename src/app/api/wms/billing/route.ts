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
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";
import { gateWmsTierMutation } from "@/lib/wms/wms-mutation-grants";
import { prisma } from "@/lib/prisma";
import { normalizeBf47ReasonCode } from "@/lib/wms/billing-bf47";
import { scheduleEmitWmsOutboundWebhooks } from "@/lib/wms/outbound-webhook-dispatch";

function wmsBillingInvoiceRunReadWhere(
  tenantId: string,
  extra: Prisma.WmsBillingInvoiceRunWhereInput,
): Prisma.WmsBillingInvoiceRunWhereInput {
  if (!extra || Object.keys(extra).length === 0) return { tenantId };
  return { AND: [{ tenantId }, extra] };
}

type BillingBody = {
  action?: string;
  since?: string;
  until?: string;
  periodFrom?: string;
  periodTo?: string;
  invoiceRunId?: string;
  billingEventId?: string;
  billingDisputed?: boolean;
  billingDisputeNote?: string | null;
  postedBillingDisputed?: boolean;
  postedBillingDisputeReasonCode?: string;
  postedBillingDisputeNote?: string | null;
  creditMemoCreditAmount?: string | number;
  creditMemoReasonCode?: string;
  creditMemoNote?: string | null;
  creditMemoExternalArDocumentRef?: string | null;
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

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }
  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const billingEventWhere: Prisma.WmsBillingEventWhereInput =
    viewScope.wmsBillingEvent && Object.keys(viewScope.wmsBillingEvent).length > 0
      ? { AND: [{ tenantId: tenant.id }, viewScope.wmsBillingEvent] }
      : { tenantId: tenant.id };
  const invoiceRunWhere = wmsBillingInvoiceRunReadWhere(tenant.id, viewScope.wmsInvoiceRun);

  const csvRunId = new URL(request.url).searchParams.get("csvRun");
  if (csvRunId) {
    const row = await prisma.wmsBillingInvoiceRun.findFirst({
      where: { AND: [invoiceRunWhere, { id: csvRunId }] },
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

  const eligibleUnbilledWhere: Prisma.WmsBillingEventWhereInput = {
    AND: [billingEventWhere, { invoiceRunId: null, billingDisputed: false }],
  };
  const disputedUnbilledWhere: Prisma.WmsBillingEventWhereInput = {
    AND: [billingEventWhere, { invoiceRunId: null, billingDisputed: true }],
  };

  const postedDisputedWhere = {
    AND: [invoiceRunWhere, { status: "POST_DISPUTED" as const }],
  };

  const [rates, events, runs, unbilledCount, disputedUnbilledCount, postedDisputedRunCount] = await Promise.all([
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
      where: billingEventWhere,
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
      where: invoiceRunWhere,
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        _count: { select: { lines: true, events: true, billingCreditMemoStubs: true } },
        billingCreditMemoStubs: {
          orderBy: { createdAt: "desc" },
          take: 12,
          select: {
            id: true,
            creditAmount: true,
            currency: true,
            reasonCode: true,
            memoNote: true,
            externalArDocumentRef: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.wmsBillingEvent.count({ where: eligibleUnbilledWhere }),
    prisma.wmsBillingEvent.count({ where: disputedUnbilledWhere }),
    prisma.wmsBillingInvoiceRun.count({ where: postedDisputedWhere }),
  ]);

  return NextResponse.json({
    profileSourceNote:
      "Rates and invoice runs use profileSource MANUAL until Phase C (CRM / commercial).",
    unbilledEventCount: unbilledCount,
    disputedUnbilledEventCount: disputedUnbilledCount,
    postedDisputedInvoiceRunCount: postedDisputedRunCount,
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
      billingDisputed: e.billingDisputed,
      billingDisputeNote: e.billingDisputeNote,
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
      creditMemoStubCount: r._count.billingCreditMemoStubs,
      hasCsv: Boolean(r.csvSnapshot),
      postedDisputeOpenedAt: r.postedDisputeOpenedAt?.toISOString() ?? null,
      postedDisputeReasonCode: r.postedDisputeReasonCode,
      postedDisputeNote: r.postedDisputeNote,
      creditMemoStubs: r.billingCreditMemoStubs.map((s) => ({
        id: s.id,
        creditAmount: s.creditAmount.toString(),
        currency: s.currency,
        reasonCode: s.reasonCode,
        memoNote: s.memoNote,
        externalArDocumentRef: s.externalArDocumentRef,
        createdAt: s.createdAt.toISOString(),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const gateView = await requireApiGrant("org.wms", "view");
  if (gateView) return gateView;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const gateTier = await gateWmsTierMutation(actorId, "operations");
  if (gateTier) return gateTier;

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

  if (action === "set_billing_event_dispute") {
    const billingEventId = input.billingEventId?.trim();
    if (!billingEventId) {
      return toApiErrorResponse({ error: "billingEventId required.", code: "BAD_INPUT", status: 400 });
    }
    if (typeof input.billingDisputed !== "boolean") {
      return toApiErrorResponse({ error: "billingDisputed boolean required.", code: "BAD_INPUT", status: 400 });
    }
    const disputed = input.billingDisputed;
    let note: string | null = null;
    if (disputed) {
      const raw = input.billingDisputeNote;
      if (typeof raw === "string") {
        note = raw.trim().slice(0, 800) || null;
      }
    }
    const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
    const billingEventWhere: Prisma.WmsBillingEventWhereInput =
      viewScope.wmsBillingEvent && Object.keys(viewScope.wmsBillingEvent).length > 0
        ? { AND: [{ tenantId: tenant.id }, viewScope.wmsBillingEvent] }
        : { tenantId: tenant.id };

    const updated = await prisma.wmsBillingEvent.updateMany({
      where: { AND: [billingEventWhere, { id: billingEventId, invoiceRunId: null }] },
      data: {
        billingDisputed: disputed,
        billingDisputeNote: disputed ? note : null,
      },
    });
    if (updated.count === 0) {
      return toApiErrorResponse({
        error: "Billing event not found, out of scope, or already invoiced.",
        code: "NOT_FOUND",
        status: 404,
      });
    }
    if (disputed) {
      const ev = await prisma.wmsBillingEvent.findFirst({
        where: { AND: [billingEventWhere, { id: billingEventId }] },
        select: {
          id: true,
          movementType: true,
          amount: true,
          currency: true,
          occurredAt: true,
          rateCode: true,
          warehouseId: true,
          crmAccountId: true,
          billingDisputeNote: true,
        },
      });
      if (ev) {
        scheduleEmitWmsOutboundWebhooks(tenant.id, "BILLING_EVENT_DISPUTED", ev.id, {
          billingEventId: ev.id,
          movementType: ev.movementType,
          amount: ev.amount.toString(),
          currency: ev.currency,
          occurredAt: ev.occurredAt.toISOString(),
          rateCode: ev.rateCode,
          warehouseId: ev.warehouseId,
          crmAccountId: ev.crmAccountId,
          billingDisputeNote: ev.billingDisputeNote,
        });
      }
    }
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
    const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
    const invoiceRunWhere = wmsBillingInvoiceRunReadWhere(tenant.id, viewScope.wmsInvoiceRun);
    const updated = await prisma.wmsBillingInvoiceRun.updateMany({
      where: { AND: [invoiceRunWhere, { id: invoiceRunId, status: "DRAFT" }] },
      data: { status: "POSTED" },
    });
    if (updated.count === 0) {
      return toApiErrorResponse({ error: "Run not found or not in DRAFT.", code: "NOT_FOUND", status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_invoice_run_posted_dispute") {
    const invoiceRunId = input.invoiceRunId?.trim();
    if (!invoiceRunId) {
      return toApiErrorResponse({ error: "invoiceRunId required.", code: "BAD_INPUT", status: 400 });
    }
    if (typeof input.postedBillingDisputed !== "boolean") {
      return toApiErrorResponse({ error: "postedBillingDisputed boolean required.", code: "BAD_INPUT", status: 400 });
    }
    const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
    const invoiceRunWhere = wmsBillingInvoiceRunReadWhere(tenant.id, viewScope.wmsInvoiceRun);

    if (input.postedBillingDisputed) {
      const reason = normalizeBf47ReasonCode(input.postedBillingDisputeReasonCode ?? "");
      if (!reason) {
        return toApiErrorResponse({
          error:
            "postedBillingDisputeReasonCode must be one of: RATE_DISPUTE, QUANTITY_DISPUTE, SERVICE_LEVEL, DUPLICATE_CHARGE, OTHER.",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      let note: string | null = null;
      const rawNote = input.postedBillingDisputeNote;
      if (typeof rawNote === "string") {
        note = rawNote.trim().slice(0, 800) || null;
      }
      const updated = await prisma.wmsBillingInvoiceRun.updateMany({
        where: { AND: [invoiceRunWhere, { id: invoiceRunId, status: "POSTED" }] },
        data: {
          status: "POST_DISPUTED",
          postedDisputeOpenedAt: new Date(),
          postedDisputeReasonCode: reason,
          postedDisputeNote: note,
          postedDisputeOpenedById: actorId,
        },
      });
      if (updated.count === 0) {
        return toApiErrorResponse({
          error: "Run not found, out of scope, or not POSTED.",
          code: "NOT_FOUND",
          status: 404,
        });
      }
      const run = await prisma.wmsBillingInvoiceRun.findFirst({
        where: { AND: [invoiceRunWhere, { id: invoiceRunId }] },
        select: {
          id: true,
          runNo: true,
          totalAmount: true,
          currency: true,
          postedDisputeReasonCode: true,
          postedDisputeNote: true,
        },
      });
      if (run) {
        scheduleEmitWmsOutboundWebhooks(tenant.id, "BILLING_INVOICE_POST_DISPUTED", run.id, {
          invoiceRunId: run.id,
          runNo: run.runNo,
          totalAmount: run.totalAmount.toString(),
          currency: run.currency,
          postedDisputeReasonCode: run.postedDisputeReasonCode,
          postedDisputeNote: run.postedDisputeNote,
        });
      }
      return NextResponse.json({ ok: true });
    }

    const cleared = await prisma.wmsBillingInvoiceRun.updateMany({
      where: { AND: [invoiceRunWhere, { id: invoiceRunId, status: "POST_DISPUTED" }] },
      data: {
        status: "POSTED",
        postedDisputeOpenedAt: null,
        postedDisputeReasonCode: null,
        postedDisputeNote: null,
        postedDisputeOpenedById: null,
      },
    });
    if (cleared.count === 0) {
      return toApiErrorResponse({
        error: "Run not found, out of scope, or not POST_DISPUTED.",
        code: "NOT_FOUND",
        status: 404,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "create_billing_credit_memo_stub") {
    const invoiceRunId = input.invoiceRunId?.trim();
    if (!invoiceRunId) {
      return toApiErrorResponse({ error: "invoiceRunId required.", code: "BAD_INPUT", status: 400 });
    }
    const reason = normalizeBf47ReasonCode(input.creditMemoReasonCode ?? "");
    if (!reason) {
      return toApiErrorResponse({
        error:
          "creditMemoReasonCode must be one of: RATE_DISPUTE, QUANTITY_DISPUTE, SERVICE_LEVEL, DUPLICATE_CHARGE, OTHER.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
    const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
    const invoiceRunWhere = wmsBillingInvoiceRunReadWhere(tenant.id, viewScope.wmsInvoiceRun);
    const run = await prisma.wmsBillingInvoiceRun.findFirst({
      where: { AND: [invoiceRunWhere, { id: invoiceRunId, status: "POST_DISPUTED" }] },
      select: { id: true, totalAmount: true, currency: true, runNo: true },
    });
    if (!run) {
      return toApiErrorResponse({
        error: "Invoice run not found, out of scope, or not POST_DISPUTED.",
        code: "NOT_FOUND",
        status: 404,
      });
    }
    let creditDec: Prisma.Decimal;
    const rawAmt = input.creditMemoCreditAmount;
    const amountStr =
      typeof rawAmt === "number" && Number.isFinite(rawAmt)
        ? String(rawAmt)
        : typeof rawAmt === "string"
          ? rawAmt.trim()
          : "";
    if (!amountStr) {
      creditDec = run.totalAmount;
    } else {
      try {
        creditDec = new Prisma.Decimal(amountStr);
      } catch {
        return toApiErrorResponse({ error: "Invalid creditMemoCreditAmount.", code: "BAD_INPUT", status: 400 });
      }
    }
    if (creditDec.lessThanOrEqualTo(0)) {
      return toApiErrorResponse({ error: "creditMemoCreditAmount must be positive.", code: "BAD_INPUT", status: 400 });
    }
    let memoNote: string | null = null;
    if (typeof input.creditMemoNote === "string") {
      memoNote = input.creditMemoNote.trim().slice(0, 800) || null;
    }
    let extRef: string | null = null;
    if (typeof input.creditMemoExternalArDocumentRef === "string") {
      extRef = input.creditMemoExternalArDocumentRef.trim().slice(0, 128) || null;
    }
    const stub = await prisma.wmsBillingCreditMemoStub.create({
      data: {
        tenantId: tenant.id,
        sourceInvoiceRunId: run.id,
        creditAmount: creditDec,
        currency: run.currency,
        reasonCode: reason,
        memoNote,
        externalArDocumentRef: extRef,
        createdById: actorId,
      },
    });
    scheduleEmitWmsOutboundWebhooks(tenant.id, "BILLING_CREDIT_MEMO_STUB_CREATED", stub.id, {
      creditMemoStubId: stub.id,
      sourceInvoiceRunId: run.id,
      runNo: run.runNo,
      creditAmount: stub.creditAmount.toString(),
      currency: stub.currency,
      reasonCode: stub.reasonCode,
      memoNote: stub.memoNote,
      externalArDocumentRef: stub.externalArDocumentRef,
    });
    return NextResponse.json({ ok: true, creditMemoStubId: stub.id });
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

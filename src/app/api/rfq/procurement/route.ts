import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildCarrierScorecards,
  buildTenderDraft,
  buildTransportationAllocationPlan,
  buildTransportationProcurementSummary,
  normalizeAmount,
  type TransportationProcurementCandidate,
} from "@/lib/rfq/transportation-procurement";

export const dynamic = "force-dynamic";

async function requireProcurementAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  if (!viewerHas(access.grantSet, "org.rfq", edit ? "edit" : "view")) {
    return { ok: false as const, response: toApiErrorResponse({ error: `Forbidden: requires org.rfq ${edit ? "edit" : "view"}.`, code: "FORBIDDEN", status: 403 }) };
  }
  return { ok: true as const, access };
}

async function buildProcurementSnapshot(tenantId: string) {
  const [quoteRequests, snapshots, plans] = await Promise.all([
    prisma.quoteRequest.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 40,
      select: { id: true, title: true, status: true, transportMode: true, originLabel: true, destinationLabel: true, updatedAt: true },
    }),
    prisma.bookingPricingSnapshot.findMany({
      where: { tenantId },
      orderBy: [{ frozenAt: "desc" }, { id: "desc" }],
      take: 25,
      select: { id: true, sourceType: true, sourceRecordId: true, sourceSummary: true, currency: true, totalEstimatedCost: true, frozenAt: true },
    }),
    prisma.transportationProcurementPlan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        quoteRequestId: true,
        recommendedCarrier: true,
        allocationScore: true,
        allocationPlanJson: true,
        tenderDraftJson: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    quoteRequests: quoteRequests.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    snapshots: snapshots.map((row) => ({
      ...row,
      totalEstimatedCost: String(row.totalEstimatedCost),
      frozenAt: row.frozenAt.toISOString(),
    })),
    plans: plans.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireProcurementAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildProcurementSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireProcurementAccess(true);
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "queue_allocation") {
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    if (!planId) return toApiErrorResponse({ error: "planId is required.", code: "BAD_INPUT", status: 400 });
    const plan = await prisma.transportationProcurementPlan.findFirst({ where: { tenantId: gate.access.tenant.id, id: planId } });
    if (!plan) return toApiErrorResponse({ error: "Procurement plan not found.", code: "NOT_FOUND", status: 404 });

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "rfq_transportation_procurement",
        prompt: "Queue carrier allocation for approval",
        answerKind: "carrier_allocation",
        message: `Queued carrier allocation review for ${plan.title}.`,
        evidence: { planId: plan.id, allocationPlan: plan.allocationPlanJson, tenderDraft: plan.tenderDraftJson } as Prisma.InputJsonValue,
        objectType: "transportation_procurement_plan",
        objectId: plan.id,
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "transportation_procurement_plan",
        objectId: plan.id,
        objectHref: "/rfq/procurement",
        priority: plan.allocationScore >= 80 ? "MEDIUM" : "HIGH",
        actionId: `amp16-allocate-${plan.id}`.slice(0, 128),
        actionKind: "carrier_allocation_approval",
        label: `Approve carrier allocation: ${plan.recommendedCarrier ?? plan.title}`,
        description: "Approve carrier allocation and tender draft before any booking change or external carrier message.",
        payload: { planId: plan.id, allocationPlan: plan.allocationPlanJson, tenderDraft: plan.tenderDraftJson } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.transportationProcurementPlan.update({
      where: { id: plan.id },
      data: { status: "ALLOCATION_QUEUED", actionQueueItemId: actionItem.id, approvedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, plan: updated });
  }

  if (action !== "create_plan") {
    return toApiErrorResponse({ error: "Unsupported procurement action.", code: "BAD_INPUT", status: 400 });
  }

  const quoteRequestId = typeof body.quoteRequestId === "string" && body.quoteRequestId.trim() ? body.quoteRequestId.trim() : "";
  if (!quoteRequestId) return toApiErrorResponse({ error: "quoteRequestId is required.", code: "BAD_INPUT", status: 400 });

  const quoteRequest = await prisma.quoteRequest.findFirst({
    where: { tenantId: gate.access.tenant.id, id: quoteRequestId },
    include: {
      recipients: {
        include: { supplier: { select: { id: true, name: true, code: true } }, response: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quoteRequest) return toApiErrorResponse({ error: "RFQ not found.", code: "NOT_FOUND", status: 404 });

  const responses = quoteRequest.recipients.map((recipient) => recipient.response).filter((response): response is NonNullable<typeof response> => Boolean(response));
  const responseIds = responses.map((response) => response.id);
  const supplierIds = quoteRequest.recipients.map((recipient) => recipient.supplierId).filter((id): id is string => Boolean(id));

  const [snapshots, supplierShipments, invoiceFeedback] = await Promise.all([
    responseIds.length > 0
      ? prisma.bookingPricingSnapshot.findMany({
          where: { tenantId: gate.access.tenant.id, sourceType: "QUOTE_RESPONSE", sourceRecordId: { in: responseIds } },
          orderBy: { frozenAt: "desc" },
          select: { id: true, sourceRecordId: true, sourceSummary: true, currency: true, totalEstimatedCost: true, frozenAt: true },
        })
      : Promise.resolve([]),
    supplierIds.length > 0
      ? prisma.shipment.findMany({
          where: { order: { tenantId: gate.access.tenant.id }, carrierSupplierId: { in: supplierIds } },
          take: 300,
          select: {
            carrierSupplierId: true,
            status: true,
            expectedReceiveAt: true,
            receivedAt: true,
            booking: { select: { eta: true, latestEta: true } },
          },
        })
      : Promise.resolve([]),
    prisma.invoiceIntake.findMany({
      where: { tenantId: gate.access.tenant.id, bookingPricingSnapshot: { sourceType: "QUOTE_RESPONSE", sourceRecordId: { in: responseIds } } },
      take: 200,
      select: {
        id: true,
        bookingPricingSnapshot: { select: { sourceRecordId: true } },
        rollupOutcome: true,
        amberLineCount: true,
        redLineCount: true,
        financeHandoffStatus: true,
      },
    }),
  ]);

  const snapshotsByResponse = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    snapshotsByResponse.set(snapshot.sourceRecordId, [...(snapshotsByResponse.get(snapshot.sourceRecordId) ?? []), snapshot]);
  }
  const shipmentsBySupplier = new Map<string, typeof supplierShipments>();
  for (const shipment of supplierShipments) {
    if (!shipment.carrierSupplierId) continue;
    shipmentsBySupplier.set(shipment.carrierSupplierId, [...(shipmentsBySupplier.get(shipment.carrierSupplierId) ?? []), shipment]);
  }
  const invoicesByResponse = new Map<string, typeof invoiceFeedback>();
  for (const invoice of invoiceFeedback) {
    const responseId = invoice.bookingPricingSnapshot.sourceRecordId;
    invoicesByResponse.set(responseId, [...(invoicesByResponse.get(responseId) ?? []), invoice]);
  }

  const now = Date.now();
  const candidates: TransportationProcurementCandidate[] = quoteRequest.recipients.flatMap((recipient) => {
    if (!recipient.response) return [];
    const carrierShipments = recipient.supplierId ? (shipmentsBySupplier.get(recipient.supplierId) ?? []) : [];
    const lateShipmentCount = carrierShipments.filter((shipment) => {
      if (shipment.status !== "DELIVERED" && shipment.status !== "RECEIVED") {
        const due = shipment.booking?.latestEta ?? shipment.booking?.eta ?? shipment.expectedReceiveAt;
        return due ? due.getTime() < now : false;
      }
      const due = shipment.booking?.latestEta ?? shipment.booking?.eta ?? shipment.expectedReceiveAt;
      return Boolean(due && shipment.receivedAt && shipment.receivedAt.getTime() > due.getTime());
    }).length;
    const invoices = invoicesByResponse.get(recipient.response.id) ?? [];
    return [
      {
        responseId: recipient.response.id,
        supplierId: recipient.supplierId,
        carrierName: recipient.supplier?.name ?? recipient.displayName,
        currency: recipient.response.currency,
        totalAmount: normalizeAmount(recipient.response.totalAllInAmount),
        quoteStatus: String(recipient.response.status),
        snapshotCount: snapshotsByResponse.get(recipient.response.id)?.length ?? 0,
        shipmentCount: carrierShipments.length,
        lateShipmentCount,
        invoiceIntakeCount: invoices.length,
        invoiceRedLineCount: invoices.reduce((sum, invoice) => sum + invoice.redLineCount, 0),
        invoiceAmberLineCount: invoices.reduce((sum, invoice) => sum + invoice.amberLineCount, 0),
      },
    ];
  });

  const scorecards = buildCarrierScorecards(candidates);
  const allocationPlan = buildTransportationAllocationPlan(scorecards);
  const recommendedSnapshots = allocationPlan.recommendedResponseId ? (snapshotsByResponse.get(allocationPlan.recommendedResponseId) ?? []) : [];
  const tenderDraft = buildTenderDraft({
    rfqTitle: quoteRequest.title,
    originLabel: quoteRequest.originLabel,
    destinationLabel: quoteRequest.destinationLabel,
    equipmentSummary: quoteRequest.equipmentSummary ?? null,
    allocationPlan,
  });
  const plan = await prisma.transportationProcurementPlan.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      quoteRequestId: quoteRequest.id,
      title: `Carrier allocation for ${quoteRequest.title}`,
      status: allocationPlan.status,
      recommendedCarrier: allocationPlan.recommendedCarrier,
      recommendedSupplierId: allocationPlan.recommendedSupplierId,
      recommendedResponseId: allocationPlan.recommendedResponseId,
      recommendedSnapshotId: recommendedSnapshots[0]?.id ?? null,
      allocationScore: allocationPlan.allocationScore,
      carrierScorecardJson: scorecards as unknown as Prisma.InputJsonValue,
      rfqEvidenceJson: { quoteRequestId: quoteRequest.id, title: quoteRequest.title, candidates } as unknown as Prisma.InputJsonValue,
      snapshotEvidenceJson: recommendedSnapshots.map((snapshot) => ({
        id: snapshot.id,
        sourceRecordId: snapshot.sourceRecordId,
        sourceSummary: snapshot.sourceSummary,
        currency: snapshot.currency,
        totalEstimatedCost: String(snapshot.totalEstimatedCost),
        frozenAt: snapshot.frozenAt.toISOString(),
      })) as unknown as Prisma.InputJsonValue,
      invoiceFeedbackJson: invoiceFeedback.map((invoice) => ({
        id: invoice.id,
        responseId: invoice.bookingPricingSnapshot.sourceRecordId,
        rollupOutcome: invoice.rollupOutcome,
        amberLineCount: invoice.amberLineCount,
        redLineCount: invoice.redLineCount,
        financeHandoffStatus: invoice.financeHandoffStatus,
      })) as unknown as Prisma.InputJsonValue,
      allocationPlanJson: allocationPlan as unknown as Prisma.InputJsonValue,
      tenderDraftJson: tenderDraft as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true, recommendedCarrier: true, allocationScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "rfq_transportation_procurement",
      prompt: `Create carrier allocation plan for ${quoteRequest.title}`,
      answerKind: "carrier_allocation_plan",
      message: buildTransportationProcurementSummary(allocationPlan),
      evidence: { quoteRequestId: quoteRequest.id, scorecards, allocationPlan, tenderDraft } as unknown as Prisma.InputJsonValue,
      objectType: "quote_request",
      objectId: quoteRequest.id,
    },
  });
  return NextResponse.json({ ok: true, plan }, { status: 201 });
}

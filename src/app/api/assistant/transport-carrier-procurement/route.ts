import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildTransportCarrierProcurementPacket,
  type TransportCarrierProcurementInputs,
} from "@/lib/assistant/transport-carrier-procurement";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireTransportCarrierAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.rfq", mode) ||
    viewerHas(access.grantSet, "org.tariffs", mode) ||
    viewerHas(access.grantSet, "org.invoice_audit", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.reports", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires RFQ, tariffs, invoice audit, orders, Control Tower, or reports access for Sprint 16.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function num(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && value !== null && "toString" in value ? String((value as { toString(): string }).toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

function submittedQuoteCount(statuses: string[]) {
  return statuses.filter((status) => status !== "DRAFT" && status !== "WITHDRAWN").length;
}

async function loadTransportInputs(tenantId: string, grantSet: Set<string>): Promise<TransportCarrierProcurementInputs> {
  const canRfq = viewerHas(grantSet, "org.rfq", "view") || viewerHas(grantSet, "org.reports", "view");
  const canTariff = viewerHas(grantSet, "org.tariffs", "view") || viewerHas(grantSet, "org.reports", "view");
  const canPricing = canTariff || viewerHas(grantSet, "org.rfq", "view") || viewerHas(grantSet, "org.reports", "view");
  const canShipments = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view");
  const canInvoice = viewerHas(grantSet, "org.invoice_audit", "view") || viewerHas(grantSet, "org.reports", "view");
  const canCt = viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view");

  const [
    quoteRequestsRaw,
    tariffContractHeadersRaw,
    bookingPricingSnapshots,
    shipmentsRaw,
    transportationProcurementPlans,
    invoiceIntakes,
    ctExceptionsOpen,
    actionQueue,
  ] = await Promise.all([
    canRfq
      ? prisma.quoteRequest.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 90,
          select: {
            id: true,
            title: true,
            status: true,
            quotesDueAt: true,
            transportMode: true,
            originLabel: true,
            destinationLabel: true,
            responses: { select: { status: true } },
          },
        })
      : Promise.resolve([]),
    canTariff
      ? prisma.tariffContractHeader.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: {
            id: true,
            title: true,
            status: true,
            transportMode: true,
            versions: { select: { approvalStatus: true, status: true } },
          },
        })
      : Promise.resolve([]),
    canPricing
      ? prisma.bookingPricingSnapshot.findMany({
          where: { tenantId },
          orderBy: { frozenAt: "desc" },
          take: 120,
          select: {
            id: true,
            sourceType: true,
            sourceSummary: true,
            currency: true,
            totalEstimatedCost: true,
            frozenAt: true,
            basisSide: true,
            incoterm: true,
            shipmentBookingId: true,
          },
        })
      : Promise.resolve([]),
    canShipments
      ? prisma.shipment.findMany({
          where: { order: { tenantId } },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            shipmentNo: true,
            status: true,
            carrier: true,
            transportMode: true,
            updatedAt: true,
            carrierSupplier: { select: { name: true } },
            booking: {
              select: {
                status: true,
                bookingConfirmSlaDueAt: true,
                originCode: true,
                destinationCode: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canRfq || canPricing
      ? prisma.transportationProcurementPlan.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            allocationScore: true,
            recommendedCarrier: true,
            quoteRequestId: true,
          },
        })
      : Promise.resolve([]),
    canInvoice
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: {
            id: true,
            externalInvoiceNo: true,
            vendorLabel: true,
            status: true,
            currency: true,
            rollupOutcome: true,
            redLineCount: true,
            amberLineCount: true,
            approvedForAccounting: true,
          },
        })
      : Promise.resolve([]),
    canCt
      ? prisma.ctException.findMany({
          where: { tenantId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, severity: true, shipmentId: true, recoveryState: true },
        })
      : Promise.resolve([]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  const exceptionCountByShipment = new Map<string, number>();
  for (const exception of ctExceptionsOpen) {
    exceptionCountByShipment.set(exception.shipmentId, (exceptionCountByShipment.get(exception.shipmentId) ?? 0) + 1);
  }

  const quoteRequests = quoteRequestsRaw.map((rfq) => ({
    id: rfq.id,
    title: rfq.title,
    status: String(rfq.status),
    quotesDueAt: rfq.quotesDueAt?.toISOString() ?? null,
    transportMode: String(rfq.transportMode),
    originLabel: rfq.originLabel,
    destinationLabel: rfq.destinationLabel,
    responseCount: rfq.responses.length,
    submittedQuoteCount: submittedQuoteCount(rfq.responses.map((response) => String(response.status))),
  }));

  const tariffContractHeaders = tariffContractHeadersRaw.map((header) => {
    let pendingVersionCount = 0;
    let rejectedVersionCount = 0;
    for (const version of header.versions) {
      if (version.approvalStatus === "PENDING") pendingVersionCount += 1;
      if (version.approvalStatus === "REJECTED") rejectedVersionCount += 1;
    }
    return {
      id: header.id,
      title: header.title,
      status: String(header.status),
      transportMode: String(header.transportMode),
      pendingVersionCount,
      rejectedVersionCount,
      versionCount: header.versions.length,
    };
  });

  const shipments = shipmentsRaw.map((shipment) => ({
    id: shipment.id,
    shipmentNo: shipment.shipmentNo,
    status: String(shipment.status),
    carrierLabel: shipment.carrierSupplier?.name ?? shipment.carrier ?? null,
    transportMode: shipment.transportMode ? String(shipment.transportMode) : null,
    updatedAt: shipment.updatedAt.toISOString(),
    bookingStatus: shipment.booking ? String(shipment.booking.status) : null,
    bookingSlaDueAt: shipment.booking?.bookingConfirmSlaDueAt?.toISOString() ?? null,
    originCode: shipment.booking?.originCode ?? null,
    destinationCode: shipment.booking?.destinationCode ?? null,
    openExceptionCount: exceptionCountByShipment.get(shipment.id) ?? 0,
  }));

  return {
    quoteRequests,
    tariffContractHeaders,
    bookingPricingSnapshots: bookingPricingSnapshots.map((snapshot) => ({
      ...snapshot,
      sourceType: String(snapshot.sourceType),
      totalEstimatedCost: num(snapshot.totalEstimatedCost),
      frozenAt: snapshot.frozenAt.toISOString(),
    })),
    shipments,
    transportationProcurementPlans,
    invoiceIntakes: invoiceIntakes.map((invoice) => ({
      ...invoice,
      status: String(invoice.status),
      rollupOutcome: String(invoice.rollupOutcome),
    })),
    ctExceptionsOpen,
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantTransportCarrierProcurementPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        procurementScore: true,
        rfqRiskCount: true,
        tariffBookingRiskCount: true,
        laneRiskCount: true,
        tenderRiskCount: true,
        invoiceVarianceCount: true,
        executionRiskCount: true,
        sourceSummaryJson: true,
        rfqTariffJson: true,
        bookingPricingJson: true,
        laneExecutionJson: true,
        carrierPerformanceJson: true,
        tenderAllocationJson: true,
        invoiceFeedbackJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadTransportInputs(tenantId, grantSet),
  ]);
  const preview = buildTransportCarrierProcurementPacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewProcurementScore: preview.procurementScore,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireTransportCarrierAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireTransportCarrierAccess(true);
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

  if (action === "queue_procurement_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantTransportCarrierProcurementPacket.findFirst({
      where: { id: packetId, tenantId: gate.access.tenant.id },
    });
    if (!packet) return toApiErrorResponse({ error: "Transportation & Carrier Procurement packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantTransportCarrierProcurementPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_transport_carrier_procurement",
          prompt: "Approve Sprint 16 Transportation & Carrier Procurement packet",
          answerKind: "sprint16_transport_ok",
          message:
            "Transportation & Carrier Procurement packet approved after human review. RFQs, tariffs, booking snapshots, tenders, carrier awards, bookings, settlements, invoices, procurement plans, shipments, and integrations were not changed automatically.",
          evidence: { packetId: packet.id, procurementScore: packet.procurementScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_transport_carrier_procurement_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_transport_carrier_procurement",
        prompt: "Queue Sprint 16 carrier procurement review",
        answerKind: "sprint16_transport_rev",
        message:
          "Carrier procurement review queued. The assistant does not award carriers, confirm bookings, change tariffs, freeze snapshots, settle invoices, or mutate logistics records.",
        evidence: { packetId: packet.id, procurementScore: packet.procurementScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_transport_carrier_procurement_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_transport_carrier_procurement_packet",
        objectId: packet.id,
        objectHref: "/assistant/transport-carrier-procurement",
        priority: packet.procurementScore < 72 || packet.invoiceVarianceCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint16-transport-carrier-${packet.id}`.slice(0, 128),
        actionKind: "transport_carrier_procurement_review",
        label: `Review ${packet.title}`,
        description: "Review RFQ, tariff/booking, lane, tender, invoice variance, and execution signals before carrier or settlement actions.",
        payload: { packetId: packet.id, procurementScore: packet.procurementScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantTransportCarrierProcurementPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Transportation & Carrier Procurement action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadTransportInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildTransportCarrierProcurementPacket(inputs);
  const packet = await prisma.assistantTransportCarrierProcurementPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      procurementScore: built.procurementScore,
      rfqRiskCount: built.rfqRiskCount,
      tariffBookingRiskCount: built.tariffBookingRiskCount,
      laneRiskCount: built.laneRiskCount,
      tenderRiskCount: built.tenderRiskCount,
      invoiceVarianceCount: built.invoiceVarianceCount,
      executionRiskCount: built.executionRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      rfqTariffJson: built.rfqTariff as Prisma.InputJsonValue,
      bookingPricingJson: built.bookingPricing as Prisma.InputJsonValue,
      laneExecutionJson: built.laneExecution as Prisma.InputJsonValue,
      carrierPerformanceJson: built.carrierPerformance as Prisma.InputJsonValue,
      tenderAllocationJson: built.tenderAllocation as Prisma.InputJsonValue,
      invoiceFeedbackJson: built.invoiceFeedback as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, procurementScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_transport_carrier_procurement",
      prompt: "Create Sprint 16 Transportation & Carrier Procurement packet",
      answerKind: "sprint16_transport_pkt",
      message: built.leadershipSummary,
      evidence: { procurementScore: built.procurementScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_transport_carrier_procurement_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}

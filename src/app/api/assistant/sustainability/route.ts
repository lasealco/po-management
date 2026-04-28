import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildSustainabilityPacket,
  type SustainabilityShipmentSignal,
  type SustainabilitySupplierSignal,
  type SustainabilityWarehouseSignal,
  type TransportModeLabel,
} from "@/lib/assistant/sustainability";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireSustainabilityAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canOps = viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view") || viewerHas(access.grantSet, "org.wms", "view");
  const canPartners = viewerHas(access.grantSet, "org.suppliers", "view") || viewerHas(access.grantSet, "org.crm", "view");
  if (!canOps || !canPartners) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires operational and partner evidence access for sustainability packets.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mode(value: unknown): TransportModeLabel {
  return value === "OCEAN" || value === "AIR" || value === "ROAD" || value === "RAIL" ? value : "UNKNOWN";
}

async function loadSustainabilityInputs(tenantId: string, grantSet: Set<string>) {
  const [shipments, wmsEvents, suppliers] = await Promise.all([
    viewerHas(grantSet, "org.controltower", "view")
      ? prisma.shipment.findMany({
          where: { order: { tenantId } },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            shipmentNo: true,
            status: true,
            transportMode: true,
            carrier: true,
            estimatedVolumeCbm: true,
            estimatedWeightKg: true,
            cargoChargeableWeightKg: true,
            carrierSupplier: { select: { name: true } },
            customerCrmAccount: { select: { name: true } },
            ctLegs: {
              orderBy: { legNo: "asc" },
              take: 1,
              select: { originCode: true, destinationCode: true, transportMode: true, carrier: true, carrierSupplier: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.wms", "view")
      ? prisma.wmsBillingEvent.findMany({
          where: { tenantId },
          orderBy: { occurredAt: "desc" },
          take: 160,
          select: { id: true, movementType: true, quantity: true, occurredAt: true, warehouse: { select: { code: true, name: true } } },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view")
      ? prisma.supplier.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, name: true, registeredCountryCode: true, srmCategory: true },
        })
      : Promise.resolve([]),
  ]);

  const shipmentSignals: SustainabilityShipmentSignal[] = shipments.map((shipment) => {
    const leg = shipment.ctLegs[0];
    return {
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      mode: mode(leg?.transportMode ?? shipment.transportMode),
      carrierLabel: leg?.carrierSupplier?.name ?? leg?.carrier ?? shipment.carrierSupplier?.name ?? shipment.carrier,
      customerLabel: shipment.customerCrmAccount?.name ?? null,
      originCode: leg?.originCode ?? null,
      destinationCode: leg?.destinationCode ?? null,
      estimatedWeightKg: num(shipment.estimatedWeightKg),
      estimatedVolumeCbm: num(shipment.estimatedVolumeCbm),
      chargeableWeightKg: num(shipment.cargoChargeableWeightKg),
      status: String(shipment.status),
    };
  });
  const warehouseActivity: SustainabilityWarehouseSignal[] = wmsEvents.map((event) => ({
    id: event.id,
    warehouseLabel: event.warehouse.code ?? event.warehouse.name,
    movementType: String(event.movementType),
    quantity: num(event.quantity) ?? 0,
    occurredAt: event.occurredAt.toISOString(),
  }));
  const supplierSignals: SustainabilitySupplierSignal[] = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    countryCode: supplier.registeredCountryCode,
    category: String(supplier.srmCategory),
  }));

  return { shipments: shipmentSignals, warehouseActivity, suppliers: supplierSignals };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantSustainabilityPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        sustainabilityScore: true,
        estimatedCo2eKg: true,
        potentialSavingsKg: true,
        missingDataCount: true,
        recommendationCount: true,
        shipmentSummaryJson: true,
        warehouseSummaryJson: true,
        emissionsJson: true,
        missingDataJson: true,
        recommendationJson: true,
        assumptionsJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadSustainabilityInputs(tenantId, grantSet),
  ]);
  const preview = buildSustainabilityPacket(inputs);
  return {
    signals: {
      shipments: inputs.shipments.length,
      warehouseEvents: inputs.warehouseActivity.length,
      suppliers: inputs.suppliers.length,
      previewSustainabilityScore: preview.sustainabilityScore,
      previewCo2eKg: preview.estimatedCo2eKg,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      estimatedCo2eKg: packet.estimatedCo2eKg.toString(),
      potentialSavingsKg: packet.potentialSavingsKg.toString(),
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireSustainabilityAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireSustainabilityAccess(true);
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

  if (action === "queue_sustainability_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantSustainabilityPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Sustainability packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_sustainability",
        prompt: "Queue sustainability review",
        answerKind: "sustainability_review",
        message: "Sustainability packet queued for human review. No routing, carrier, warehouse, supplier, or ESG claim was changed automatically.",
        evidence: { packetId: packet.id, sustainabilityScore: packet.sustainabilityScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_sustainability_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_sustainability_packet",
        objectId: packet.id,
        objectHref: "/assistant/sustainability",
        priority: packet.missingDataCount > 5 || packet.sustainabilityScore < 65 ? "HIGH" : "MEDIUM",
        actionId: `amp24-esg-${packet.id}`.slice(0, 128),
        actionKind: "sustainability_review",
        label: `Review ESG packet: ${packet.title}`,
        description: "Approve emissions assumptions, data-gap cleanup, and greener-option review before source changes or external ESG claims.",
        payload: { packetId: packet.id, sustainabilityScore: packet.sustainabilityScore, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantSustainabilityPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported sustainability action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadSustainabilityInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildSustainabilityPacket(inputs);
  const packet = await prisma.assistantSustainabilityPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      sustainabilityScore: built.sustainabilityScore,
      estimatedCo2eKg: new Prisma.Decimal(String(built.estimatedCo2eKg)),
      potentialSavingsKg: new Prisma.Decimal(String(built.potentialSavingsKg)),
      missingDataCount: built.missingDataCount,
      recommendationCount: built.recommendationCount,
      shipmentSummaryJson: built.shipmentSummary as Prisma.InputJsonValue,
      warehouseSummaryJson: built.warehouseSummary as Prisma.InputJsonValue,
      emissionsJson: built.emissions as Prisma.InputJsonValue,
      missingDataJson: built.missingData as Prisma.InputJsonValue,
      recommendationJson: built.recommendations as Prisma.InputJsonValue,
      assumptionsJson: built.assumptions as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, sustainabilityScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_sustainability",
      prompt: "Create sustainability packet",
      answerKind: "sustainability_packet",
      message: built.leadershipSummary,
      evidence: { sustainabilityScore: built.sustainabilityScore, estimatedCo2eKg: built.estimatedCo2eKg, assumptions: built.assumptions } as Prisma.InputJsonObject,
      objectType: "assistant_sustainability_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}

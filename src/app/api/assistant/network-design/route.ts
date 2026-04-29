import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildNetworkDesignPacket, type NetworkDesignInputs, type NetworkLaneInput } from "@/lib/assistant/network-design";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireNetworkDesignAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canOpen =
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view");
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings, operations, WMS, or orders access for network design.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadNetworkInputs(tenantId: string): Promise<NetworkDesignInputs> {
  const [warehouses, inventory, tasks, suppliers, purchaseOrders, customers, salesOrders, bookings, exceptions] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 80,
      select: { id: true, code: true, name: true, city: true, countryCode: true, isActive: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { tenantId },
      take: 2000,
      select: { warehouseId: true, onHandQty: true, allocatedQty: true },
    }),
    prisma.wmsTask.findMany({
      where: { tenantId, status: "OPEN" },
      take: 1000,
      select: { warehouseId: true },
    }),
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      take: 120,
      select: { id: true, name: true, registeredCountryCode: true, srmCategory: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, splitParentId: null },
      orderBy: { createdAt: "desc" },
      take: 600,
      select: { supplierId: true },
    }),
    prisma.crmAccount.findMany({
      where: { tenantId, lifecycle: "ACTIVE" },
      orderBy: [{ strategicFlag: "desc" }, { name: "asc" }],
      take: 120,
      select: { id: true, name: true, segment: true, strategicFlag: true },
    }),
    prisma.salesOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 800,
      select: { customerCrmAccountId: true, status: true },
    }),
    prisma.shipmentBooking.findMany({
      where: { shipment: { order: { tenantId } } },
      orderBy: { updatedAt: "desc" },
      take: 600,
      select: {
        id: true,
        originCode: true,
        destinationCode: true,
        mode: true,
        shipment: {
          select: {
            id: true,
            estimatedWeightKg: true,
            estimatedVolumeCbm: true,
          },
        },
      },
    }),
    prisma.ctException.findMany({
      where: { tenantId, status: { not: "RESOLVED" } },
      take: 1000,
      select: { shipmentId: true },
    }),
  ]);

  const inventoryByWarehouse = inventory.reduce<Record<string, { onHandQty: number; allocatedQty: number }>>((acc, row) => {
    const next = acc[row.warehouseId] ?? { onHandQty: 0, allocatedQty: 0 };
    next.onHandQty += numberValue(row.onHandQty);
    next.allocatedQty += numberValue(row.allocatedQty);
    acc[row.warehouseId] = next;
    return acc;
  }, {});
  const openTasksByWarehouse = tasks.reduce<Record<string, number>>((acc, row) => {
    acc[row.warehouseId] = (acc[row.warehouseId] ?? 0) + 1;
    return acc;
  }, {});
  const openPoBySupplier = purchaseOrders.reduce<Record<string, number>>((acc, order) => {
    if (order.supplierId) acc[order.supplierId] = (acc[order.supplierId] ?? 0) + 1;
    return acc;
  }, {});
  const openOrderByCustomer = salesOrders.reduce<Record<string, number>>((acc, order) => {
    if (order.customerCrmAccountId && order.status !== "CLOSED") acc[order.customerCrmAccountId] = (acc[order.customerCrmAccountId] ?? 0) + 1;
    return acc;
  }, {});
  const exceptionsByShipment = exceptions.reduce<Record<string, number>>((acc, exception) => {
    acc[exception.shipmentId] = (acc[exception.shipmentId] ?? 0) + 1;
    return acc;
  }, {});
  const lanesByKey = bookings.reduce<Record<string, NetworkLaneInput>>((acc, booking) => {
    const origin = booking.originCode ?? "UNKNOWN_ORIGIN";
    const destination = booking.destinationCode ?? "UNKNOWN_DESTINATION";
    const mode = booking.mode ?? "UNKNOWN";
    const key = `${origin}|${destination}|${mode}`;
    const lane = acc[key] ?? {
      id: key,
      originCode: booking.originCode,
      destinationCode: booking.destinationCode,
      mode,
      shipmentCount: 0,
      totalWeightKg: 0,
      totalVolumeCbm: 0,
      exceptionCount: 0,
    };
    lane.shipmentCount += 1;
    lane.totalWeightKg += numberValue(booking.shipment.estimatedWeightKg);
    lane.totalVolumeCbm += numberValue(booking.shipment.estimatedVolumeCbm);
    lane.exceptionCount += exceptionsByShipment[booking.shipment.id] ?? 0;
    acc[key] = lane;
    return acc;
  }, {});

  return {
    facilities: warehouses.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      city: warehouse.city,
      countryCode: warehouse.countryCode,
      isActive: warehouse.isActive,
      onHandQty: inventoryByWarehouse[warehouse.id]?.onHandQty ?? 0,
      allocatedQty: inventoryByWarehouse[warehouse.id]?.allocatedQty ?? 0,
      openTaskCount: openTasksByWarehouse[warehouse.id] ?? 0,
    })),
    lanes: Object.values(lanesByKey).sort((a, b) => b.shipmentCount - a.shipmentCount).slice(0, 100),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      countryCode: supplier.registeredCountryCode,
      category: supplier.srmCategory,
      openPoCount: openPoBySupplier[supplier.id] ?? 0,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      segment: customer.segment,
      strategicFlag: customer.strategicFlag,
      openOrderCount: openOrderByCustomer[customer.id] ?? 0,
    })),
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantNetworkDesignPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        networkScore: true,
        facilityCount: true,
        laneCount: true,
        customerNodeCount: true,
        supplierNodeCount: true,
        scenarioCount: true,
        serviceRiskCount: true,
        costRiskCount: true,
        recommendedScenarioKey: true,
        baselineJson: true,
        scenarioJson: true,
        tradeoffJson: true,
        serviceImpactJson: true,
        riskExposureJson: true,
        approvalPlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadNetworkInputs(tenantId),
  ]);
  const preview = buildNetworkDesignPacket(inputs);
  return {
    signals: {
      facilities: inputs.facilities.length,
      lanes: inputs.lanes.length,
      suppliers: inputs.suppliers.length,
      customers: inputs.customers.length,
      previewNetworkScore: preview.networkScore,
      recommendedScenarioKey: preview.recommendedScenarioKey,
      serviceRisks: preview.serviceRiskCount,
      costRisks: preview.costRiskCount,
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
  const gate = await requireNetworkDesignAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireNetworkDesignAccess(true);
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

  if (action === "queue_network_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantNetworkDesignPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Network design packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_network_design",
        prompt: "Queue assistant network design review",
        answerKind: "assistant_network_design_review",
        message: "Assistant network design packet queued for human review. Facilities, lanes, suppliers, customers, orders, shipments, inventory, RFQs, tariffs, and carrier allocations were not mutated automatically.",
        evidence: {
          packetId: packet.id,
          networkScore: packet.networkScore,
          recommendedScenarioKey: packet.recommendedScenarioKey,
          approvalNote,
        } as Prisma.InputJsonObject,
        objectType: "assistant_network_design_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_network_design_packet",
        objectId: packet.id,
        objectHref: "/assistant/network-design",
        priority: packet.serviceRiskCount > 0 ? "HIGH" : packet.costRiskCount > 0 ? "MEDIUM" : "LOW",
        actionId: `amp33-network-${packet.id}`.slice(0, 128),
        actionKind: "assistant_network_design_review",
        label: `Review network design: ${packet.title}`,
        description: "Review facility, lane, supplier, and customer footprint tradeoffs before any downstream network change.",
        payload: {
          packetId: packet.id,
          networkScore: packet.networkScore,
          recommendedScenarioKey: packet.recommendedScenarioKey,
          approvalNote,
        } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantNetworkDesignPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported network design action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadNetworkInputs(gate.access.tenant.id);
  const built = buildNetworkDesignPacket(inputs);
  const packet = await prisma.assistantNetworkDesignPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      networkScore: built.networkScore,
      facilityCount: built.facilityCount,
      laneCount: built.laneCount,
      customerNodeCount: built.customerNodeCount,
      supplierNodeCount: built.supplierNodeCount,
      scenarioCount: built.scenarioCount,
      serviceRiskCount: built.serviceRiskCount,
      costRiskCount: built.costRiskCount,
      recommendedScenarioKey: built.recommendedScenarioKey,
      baselineJson: built.baseline as Prisma.InputJsonValue,
      scenarioJson: built.scenarios as Prisma.InputJsonValue,
      tradeoffJson: built.tradeoffs as Prisma.InputJsonValue,
      serviceImpactJson: built.serviceImpact as Prisma.InputJsonValue,
      riskExposureJson: built.riskExposure as Prisma.InputJsonValue,
      approvalPlanJson: built.approvalPlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, networkScore: true, recommendedScenarioKey: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_network_design",
      prompt: "Create assistant network design packet",
      answerKind: "assistant_network_design_packet",
      message: built.leadershipSummary,
      evidence: {
        baseline: built.baseline,
        scenarios: built.scenarios,
        tradeoffs: built.tradeoffs,
        approvalPlan: built.approvalPlan,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_network_design_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}

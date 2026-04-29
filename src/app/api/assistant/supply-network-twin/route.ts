import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildSupplyNetworkTwinPacket, type SupplyNetworkTwinInputs } from "@/lib/assistant/supply-network-twin";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireSupplyNetworkTwinAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.wms", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.suppliers", mode) ||
    viewerHas(access.grantSet, "org.crm", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires reports, Control Tower, WMS, orders, suppliers, or CRM access for Supply Network Twin.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadSupplyNetworkInputs(tenantId: string, grantSet: Set<string>): Promise<SupplyNetworkTwinInputs> {
  const canOrders = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.reports", "view");
  const canCt = viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view");
  const canWms = viewerHas(grantSet, "org.wms", "view") || viewerHas(grantSet, "org.reports", "view");
  const canSuppliers = viewerHas(grantSet, "org.suppliers", "view") || viewerHas(grantSet, "org.reports", "view");
  const canCrm = viewerHas(grantSet, "org.crm", "view") || viewerHas(grantSet, "org.reports", "view");
  const [
    twinEntities,
    twinEdges,
    twinRisks,
    scenarioDrafts,
    twinInsights,
    networkPackets,
    simulationPackets,
    planningPackets,
    resiliencePackets,
    orders,
    shipments,
    inventory,
    suppliers,
    purchaseOrders,
    customers,
    salesOrders,
    actionQueue,
  ] = await Promise.all([
    prisma.supplyChainTwinEntitySnapshot.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, entityKind: true, entityKey: true, updatedAt: true },
    }),
    prisma.supplyChainTwinEntityEdge.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, relation: true, fromSnapshot: { select: { entityKind: true } }, toSnapshot: { select: { entityKind: true } } },
    }),
    prisma.supplyChainTwinRiskSignal.findMany({
      where: { tenantId },
      orderBy: [{ acknowledged: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: { id: true, code: true, severity: true, title: true, acknowledged: true },
    }),
    prisma.supplyChainTwinScenarioDraft.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    prisma.supplyChainTwinAssistantInsight.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, status: true, graphConfidenceScore: true, summary: true },
    }),
    prisma.assistantNetworkDesignPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, networkScore: true, facilityCount: true, laneCount: true, customerNodeCount: true, supplierNodeCount: true, scenarioCount: true, serviceRiskCount: true, costRiskCount: true, recommendedScenarioKey: true },
    }),
    prisma.assistantSimulationStudioPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, simulationScore: true, scenarioCount: true, dataFreshnessRiskCount: true, recommendedScenarioKey: true },
    }),
    prisma.assistantContinuousPlanningPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, planHealthScore: true, replanningTriggerCount: true, demandVariancePct: true, supplyCoveragePct: true, inventoryCoveragePct: true, transportRiskCount: true, recoveryActionCount: true },
    }),
    prisma.assistantCollaborationResiliencePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, status: true, resilienceScore: true, partnerGapCount: true, promiseRiskCount: true, climateRiskCount: true, workforceRiskCount: true, safetySignalCount: true },
    }),
    canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 160,
          select: { id: true, status: true, customerName: true, lines: { select: { lineTotal: true } } },
        })
      : Promise.resolve([]),
    canCt
      ? prisma.shipment.findMany({
          where: { order: { tenantId } },
          orderBy: { updatedAt: "desc" },
          take: 180,
          select: { id: true, shipmentNo: true, status: true, transportMode: true, expectedReceiveAt: true, receivedAt: true, ctExceptions: { where: { status: { not: "RESOLVED" } }, select: { id: true } } },
        })
      : Promise.resolve([]),
    canWms
      ? prisma.inventoryBalance.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 500,
          select: { id: true, onHandQty: true, allocatedQty: true, warehouse: { select: { code: true, name: true } } },
        })
      : Promise.resolve([]),
    canSuppliers
      ? prisma.supplier.findMany({
          where: { tenantId, isActive: true },
          orderBy: { name: "asc" },
          take: 160,
          select: { id: true, name: true, registeredCountryCode: true },
        })
      : Promise.resolve([]),
    canSuppliers || canOrders
      ? prisma.purchaseOrder.findMany({
          where: { tenantId, splitParentId: null },
          orderBy: { createdAt: "desc" },
          take: 600,
          select: { supplierId: true },
        })
      : Promise.resolve([]),
    canCrm
      ? prisma.crmAccount.findMany({
          where: { tenantId, lifecycle: "ACTIVE" },
          orderBy: [{ strategicFlag: "desc" }, { name: "asc" }],
          take: 160,
          select: { id: true, name: true, segment: true, strategicFlag: true },
        })
      : Promise.resolve([]),
    canCrm || canOrders
      ? prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 600,
          select: { customerCrmAccountId: true, status: true },
        })
      : Promise.resolve([]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);
  const openPoBySupplier = purchaseOrders.reduce<Record<string, number>>((acc, order) => {
    if (order.supplierId) acc[order.supplierId] = (acc[order.supplierId] ?? 0) + 1;
    return acc;
  }, {});
  const openOrderByCustomer = salesOrders.reduce<Record<string, number>>((acc, order) => {
    if (order.customerCrmAccountId && order.status !== "CLOSED") acc[order.customerCrmAccountId] = (acc[order.customerCrmAccountId] ?? 0) + 1;
    return acc;
  }, {});
  return {
    twinEntities: twinEntities.map((entity) => ({ ...entity, updatedAt: entity.updatedAt.toISOString() })),
    twinEdges: twinEdges.map((edge) => ({ id: edge.id, relation: edge.relation, fromKind: edge.fromSnapshot.entityKind, toKind: edge.toSnapshot.entityKind })),
    twinRisks: twinRisks.map((risk) => ({ ...risk, severity: String(risk.severity) })),
    scenarioDrafts: scenarioDrafts.map((draft) => ({ id: draft.id, title: draft.title, status: draft.status, updatedAt: draft.updatedAt.toISOString() })),
    twinInsights,
    networkPackets,
    simulationPackets,
    planningPackets,
    resiliencePackets,
    orders: orders.map((order) => ({ id: order.id, status: String(order.status), customerName: order.customerName, lineCount: order.lines.length, totalValue: numberValue(order.lines.reduce((sum, line) => sum + numberValue(line.lineTotal), 0)) })),
    shipments: shipments.map((shipment) => ({ id: shipment.id, shipmentNo: shipment.shipmentNo, status: String(shipment.status), transportMode: shipment.transportMode ? String(shipment.transportMode) : null, expectedReceiveAt: shipment.expectedReceiveAt?.toISOString() ?? null, receivedAt: shipment.receivedAt?.toISOString() ?? null, exceptionCount: shipment.ctExceptions.length })),
    inventory: inventory.map((row) => ({ id: row.id, warehouseCode: row.warehouse.code, warehouseName: row.warehouse.name, onHandQty: numberValue(row.onHandQty), allocatedQty: numberValue(row.allocatedQty) })),
    suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, countryCode: supplier.registeredCountryCode, openPoCount: openPoBySupplier[supplier.id] ?? 0 })),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name, segment: customer.segment, strategicFlag: customer.strategicFlag, openOrderCount: openOrderByCustomer[customer.id] ?? 0 })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantSupplyNetworkTwinPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        twinScore: true,
        graphNodeCount: true,
        graphEdgeCount: true,
        scenarioCount: true,
        bottleneckCount: true,
        disruptionRiskCount: true,
        recoveryActionCount: true,
        sourceSummaryJson: true,
        graphCoverageJson: true,
        networkBaselineJson: true,
        scenarioCommandJson: true,
        bottleneckJson: true,
        disruptionJson: true,
        recoveryPlaybookJson: true,
        confidenceJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadSupplyNetworkInputs(tenantId, grantSet),
  ]);
  const preview = buildSupplyNetworkTwinPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewTwinScore: preview.twinScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireSupplyNetworkTwinAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireSupplyNetworkTwinAccess(true);
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

  if (action === "queue_network_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantSupplyNetworkTwinPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Supply Network Twin packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantSupplyNetworkTwinPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_supply_network_twin",
          prompt: "Approve Sprint 7 Supply Network Twin packet",
          answerKind: "supply_network_twin_approved",
          message: "Supply Network Twin packet approved after human review. Orders, inventory, WMS tasks, shipments, suppliers, customers, warehouses, routes, RFQs, tariffs, twin graph records, scenario drafts, network plans, and customer promises were not changed automatically.",
          evidence: { packetId: packet.id, twinScore: packet.twinScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_supply_network_twin_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_supply_network_twin",
        prompt: "Queue Sprint 7 Supply Network Twin review",
        answerKind: "supply_network_twin_review",
        message: "Supply network twin and scenario command review queued. The assistant does not mutate orders, inventory, WMS tasks, shipments, suppliers, customers, warehouses, routes, RFQs, tariffs, twin graph records, scenario drafts, network plans, or customer promises.",
        evidence: { packetId: packet.id, twinScore: packet.twinScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_supply_network_twin_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_supply_network_twin_packet",
        objectId: packet.id,
        objectHref: "/assistant/supply-network-twin",
        priority: packet.twinScore < 70 || packet.disruptionRiskCount > 0 || packet.bottleneckCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint7-supply-network-twin-${packet.id}`.slice(0, 128),
        actionKind: "supply_network_twin_review",
        label: `Review ${packet.title}`,
        description: "Review graph coverage, scenarios, bottlenecks, disruptions, and recovery playbooks before network execution.",
        payload: { packetId: packet.id, twinScore: packet.twinScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantSupplyNetworkTwinPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Supply Network Twin action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadSupplyNetworkInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildSupplyNetworkTwinPacket(inputs);
  const packet = await prisma.assistantSupplyNetworkTwinPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      twinScore: built.twinScore,
      graphNodeCount: built.graphCoverage.graphNodeCount,
      graphEdgeCount: built.graphCoverage.graphEdgeCount,
      scenarioCount: built.scenarioCommand.scenarioCount,
      bottleneckCount: built.bottleneck.bottleneckCount,
      disruptionRiskCount: built.disruption.disruptionRiskCount,
      recoveryActionCount: built.recoveryPlaybook.recoveryActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      graphCoverageJson: built.graphCoverage as Prisma.InputJsonValue,
      networkBaselineJson: built.networkBaseline as Prisma.InputJsonValue,
      scenarioCommandJson: built.scenarioCommand as Prisma.InputJsonValue,
      bottleneckJson: built.bottleneck as Prisma.InputJsonValue,
      disruptionJson: built.disruption as Prisma.InputJsonValue,
      recoveryPlaybookJson: built.recoveryPlaybook as Prisma.InputJsonValue,
      confidenceJson: built.confidence as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, twinScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_supply_network_twin",
      prompt: "Create Sprint 7 Supply Network Twin packet",
      answerKind: "supply_network_twin_packet",
      message: built.leadershipSummary,
      evidence: { twinScore: built.twinScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_supply_network_twin_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}

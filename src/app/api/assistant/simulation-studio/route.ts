import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildSimulationStudioPacket, type SimulationSignal, type SimulationStudioInputs } from "@/lib/assistant/simulation-studio";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireSimulationStudioAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canOpen =
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.reports", "view") ||
    viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view");
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings, reports, orders, operations, or WMS access for simulation studio.",
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

function isStale(date: Date | null | undefined) {
  if (!date) return true;
  return Date.now() - date.getTime() > 1000 * 60 * 60 * 24 * 14;
}

function signal(params: Omit<SimulationSignal, "currentValue"> & { currentValue: unknown }): SimulationSignal {
  return { ...params, currentValue: numberValue(params.currentValue) };
}

async function loadSimulationInputs(tenantId: string): Promise<SimulationStudioInputs> {
  const [
    openSalesOrders,
    purchaseOrders,
    inventory,
    bookings,
    exceptions,
    financePackets,
    riskRooms,
    planningPackets,
    actionItems,
    networkPackets,
  ] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { tenantId, status: { not: "CLOSED" } },
      take: 1000,
      select: { id: true, updatedAt: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, splitParentId: null },
      orderBy: { updatedAt: "desc" },
      take: 800,
      select: { id: true, totalAmount: true, updatedAt: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { tenantId },
      take: 2500,
      select: { onHandQty: true, allocatedQty: true, updatedAt: true },
    }),
    prisma.shipmentBooking.findMany({
      where: { shipment: { order: { tenantId } } },
      orderBy: { updatedAt: "desc" },
      take: 800,
      select: { id: true, updatedAt: true },
    }),
    prisma.ctException.findMany({
      where: { tenantId, status: { not: "RESOLVED" } },
      take: 1000,
      select: { id: true, severity: true, updatedAt: true },
    }),
    prisma.assistantFinancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, riskScore: true, totalVariance: true, updatedAt: true },
    }),
    prisma.assistantRiskWarRoom.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, riskScore: true, severity: true, updatedAt: true },
    }),
    prisma.assistantPlanningPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, planningScore: true, demandUnits: true, shortageUnits: true, updatedAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { updatedAt: "desc" },
      take: 250,
      select: { id: true, priority: true, updatedAt: true },
    }),
    prisma.assistantNetworkDesignPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, networkScore: true, serviceRiskCount: true, costRiskCount: true, recommendedScenarioKey: true, updatedAt: true },
    }),
  ]);

  const onHand = inventory.reduce((sum, row) => sum + numberValue(row.onHandQty), 0);
  const allocated = inventory.reduce((sum, row) => sum + numberValue(row.allocatedQty), 0);
  const openPoValue = purchaseOrders.reduce((sum, order) => sum + numberValue(order.totalAmount), 0);
  const financeExposure = financePackets.reduce((sum, packet) => sum + packet.riskScore + Math.abs(numberValue(packet.totalVariance)) / 1000, 0);
  const riskExposure = riskRooms.reduce((sum, room) => sum + room.riskScore + (room.severity === "CRITICAL" ? 20 : room.severity === "HIGH" ? 10 : 0), 0);
  const planningDemand = planningPackets.reduce((sum, packet) => sum + numberValue(packet.demandUnits), 0);
  const planningShortage = planningPackets.reduce((sum, packet) => sum + numberValue(packet.shortageUnits), 0);
  const highPriorityActions = actionItems.filter((item) => item.priority === "HIGH").length;
  const latestNetwork = networkPackets[0] ?? null;
  const networkRisk = networkPackets.reduce((sum, packet) => sum + packet.serviceRiskCount * 10 + packet.costRiskCount * 7 + Math.max(0, 70 - packet.networkScore), 0);
  const latestDates = [
    openSalesOrders[0]?.updatedAt,
    purchaseOrders[0]?.updatedAt,
    inventory[0]?.updatedAt,
    bookings[0]?.updatedAt,
    exceptions[0]?.updatedAt,
    financePackets[0]?.updatedAt,
    riskRooms[0]?.updatedAt,
    planningPackets[0]?.updatedAt,
    actionItems[0]?.updatedAt,
    latestNetwork?.updatedAt,
  ];

  return {
    networkRecommendationKey: latestNetwork?.recommendedScenarioKey ?? null,
    signals: [
      signal({
        id: "open_sales_orders",
        domain: "DEMAND",
        label: "Open sales order demand",
        currentValue: Math.max(openSalesOrders.length * 100, planningDemand),
        unit: "units",
        confidence: planningPackets.length ? "HIGH" : "MEDIUM",
        detail: `${openSalesOrders.length} open sales orders and ${planningPackets.length} planning packet(s).`,
        stale: isStale(latestDates[0]),
      }),
      signal({
        id: "open_purchase_supply",
        domain: "SUPPLY",
        label: "Open purchase supply",
        currentValue: Math.max(purchaseOrders.length * 80, openPoValue / 100),
        unit: "units",
        confidence: purchaseOrders.length ? "MEDIUM" : "LOW",
        detail: `${purchaseOrders.length} parent POs in recent sample.`,
        stale: isStale(latestDates[1]),
      }),
      signal({
        id: "available_inventory",
        domain: "INVENTORY",
        label: "Available inventory",
        currentValue: Math.max(0, onHand - allocated - planningShortage),
        unit: "units",
        confidence: inventory.length ? "HIGH" : "LOW",
        detail: `${onHand} on hand, ${allocated} allocated, ${planningShortage} planning shortage units.`,
        stale: isStale(latestDates[2]),
      }),
      signal({
        id: "transport_exposure",
        domain: "TRANSPORT",
        label: "Transport exposure",
        currentValue: bookings.length + exceptions.length * 5,
        unit: "risk points",
        confidence: bookings.length ? "MEDIUM" : "LOW",
        detail: `${bookings.length} bookings and ${exceptions.length} open Control Tower exceptions.`,
        stale: isStale(latestDates[3]) && isStale(latestDates[4]),
      }),
      signal({
        id: "finance_exposure",
        domain: "FINANCE",
        label: "Finance exposure",
        currentValue: financeExposure,
        unit: "risk points",
        confidence: financePackets.length ? "MEDIUM" : "LOW",
        detail: `${financePackets.length} finance packet(s) with variance/risk signals.`,
        stale: isStale(latestDates[5]),
      }),
      signal({
        id: "risk_war_room_exposure",
        domain: "RISK",
        label: "Risk war room exposure",
        currentValue: riskExposure,
        unit: "risk points",
        confidence: riskRooms.length ? "HIGH" : "LOW",
        detail: `${riskRooms.length} risk war room packet(s).`,
        stale: isStale(latestDates[6]),
      }),
      signal({
        id: "network_design_exposure",
        domain: "NETWORK",
        label: "Network design exposure",
        currentValue: networkRisk,
        unit: "risk points",
        confidence: networkPackets.length ? "HIGH" : "LOW",
        detail: `${networkPackets.length} AMP33 network packet(s); latest recommendation ${latestNetwork?.recommendedScenarioKey ?? "none"}.`,
        stale: isStale(latestDates[9]),
      }),
      signal({
        id: "pending_action_pressure",
        domain: "WORK",
        label: "Pending action pressure",
        currentValue: actionItems.length + highPriorityActions * 4,
        unit: "work points",
        confidence: "HIGH",
        detail: `${actionItems.length} pending action(s), ${highPriorityActions} high priority.`,
        stale: isStale(latestDates[8]),
      }),
    ],
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantSimulationStudioPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        simulationScore: true,
        scenarioCount: true,
        assumptionCount: true,
        signalCount: true,
        dataFreshnessRiskCount: true,
        recommendedScenarioKey: true,
        assumptionLedgerJson: true,
        scenarioRunJson: true,
        comparisonJson: true,
        recommendationJson: true,
        replayPlanJson: true,
        archivePlanJson: true,
        approvalPlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadSimulationInputs(tenantId),
  ]);
  const preview = buildSimulationStudioPacket(inputs);
  return {
    signals: {
      signalCount: inputs.signals.length,
      scenarioCount: preview.scenarioCount,
      previewSimulationScore: preview.simulationScore,
      recommendedScenarioKey: preview.recommendedScenarioKey,
      staleSignals: preview.dataFreshnessRiskCount,
      networkRecommendationKey: inputs.networkRecommendationKey,
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
  const gate = await requireSimulationStudioAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireSimulationStudioAccess(true);
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

  if (action === "queue_simulation_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantSimulationStudioPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Simulation studio packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_simulation_studio",
        prompt: "Queue assistant simulation studio review",
        answerKind: "assistant_simulation_studio_review",
        message: "Assistant simulation packet queued for human review. Forecasts, orders, POs, inventory, shipments, finance records, network packets, and action execution were not mutated automatically.",
        evidence: {
          packetId: packet.id,
          simulationScore: packet.simulationScore,
          recommendedScenarioKey: packet.recommendedScenarioKey,
          approvalNote,
        } as Prisma.InputJsonObject,
        objectType: "assistant_simulation_studio_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_simulation_studio_packet",
        objectId: packet.id,
        objectHref: "/assistant/simulation-studio",
        priority: packet.dataFreshnessRiskCount > 0 ? "HIGH" : packet.simulationScore < 55 ? "MEDIUM" : "LOW",
        actionId: `amp34-simulation-${packet.id}`.slice(0, 128),
        actionKind: "assistant_simulation_studio_review",
        label: `Review simulation: ${packet.title}`,
        description: "Review replayable scenario assumptions and comparison before promoting any downstream work.",
        payload: {
          packetId: packet.id,
          simulationScore: packet.simulationScore,
          recommendedScenarioKey: packet.recommendedScenarioKey,
          approvalNote,
        } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantSimulationStudioPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported simulation studio action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadSimulationInputs(gate.access.tenant.id);
  const built = buildSimulationStudioPacket(inputs);
  const packet = await prisma.assistantSimulationStudioPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      simulationScore: built.simulationScore,
      scenarioCount: built.scenarioCount,
      assumptionCount: built.assumptionCount,
      signalCount: built.signalCount,
      dataFreshnessRiskCount: built.dataFreshnessRiskCount,
      recommendedScenarioKey: built.recommendedScenarioKey,
      assumptionLedgerJson: built.assumptions as Prisma.InputJsonValue,
      scenarioRunJson: built.scenarioRuns as Prisma.InputJsonValue,
      comparisonJson: built.comparison as Prisma.InputJsonValue,
      recommendationJson: built.recommendation as Prisma.InputJsonValue,
      replayPlanJson: built.replayPlan as Prisma.InputJsonValue,
      archivePlanJson: built.archivePlan as Prisma.InputJsonValue,
      approvalPlanJson: built.approvalPlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, simulationScore: true, recommendedScenarioKey: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_simulation_studio",
      prompt: "Create assistant simulation studio packet",
      answerKind: "assistant_simulation_studio_packet",
      message: built.leadershipSummary,
      evidence: {
        assumptions: built.assumptions,
        scenarioRuns: built.scenarioRuns,
        comparison: built.comparison,
        recommendation: built.recommendation,
        replayPlan: built.replayPlan,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_simulation_studio_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}

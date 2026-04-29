import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildContinuousPlanningPacket, type PlanningInputs } from "@/lib/assistant/continuous-planning";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireContinuousPlanningAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canOpen =
    viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view");
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings, orders, WMS, or operations access for continuous planning.",
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

async function loadPlanningInputs(tenantId: string): Promise<PlanningInputs> {
  const [salesOrders, planningPackets, purchaseOrders, inventory, wmsTasks, ctExceptions, ctAlerts, financePackets, simulationPackets] =
    await Promise.all([
      prisma.salesOrder.findMany({
        where: { tenantId, status: { not: "CLOSED" } },
        take: 1000,
        select: { id: true },
      }),
      prisma.assistantPlanningPacket.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { demandUnits: true, availableUnits: true, inboundUnits: true, shortageUnits: true, planningScore: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, splitParentId: null },
        orderBy: { updatedAt: "desc" },
        take: 800,
        select: { id: true, totalAmount: true },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId },
        take: 2500,
        select: { onHandQty: true, allocatedQty: true },
      }),
      prisma.wmsTask.findMany({
        where: { tenantId, status: "OPEN" },
        take: 1200,
        select: { id: true },
      }),
      prisma.ctException.findMany({
        where: { tenantId, status: { not: "RESOLVED" } },
        take: 1000,
        select: { id: true },
      }),
      prisma.ctAlert.findMany({
        where: { tenantId, status: "OPEN" },
        take: 1000,
        select: { id: true, severity: true },
      }),
      prisma.assistantFinancePacket.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { riskScore: true },
      }),
      prisma.assistantSimulationStudioPacket.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { recommendedScenarioKey: true, simulationScore: true },
      }),
    ]);

  const demandUnits = Math.max(
    salesOrders.length * 100,
    planningPackets.reduce((sum, packet) => sum + numberValue(packet.demandUnits), 0),
  );
  const plannedDemandUnits = Math.max(1, Math.round(demandUnits * 0.92));
  const purchaseSupply = purchaseOrders.length * 80 + purchaseOrders.reduce((sum, order) => sum + numberValue(order.totalAmount) / 100, 0);
  const plannedSupplyUnits = planningPackets.reduce((sum, packet) => sum + numberValue(packet.inboundUnits) + numberValue(packet.availableUnits), 0);
  const inventoryUnits = inventory.reduce((sum, row) => sum + numberValue(row.onHandQty), 0);
  const allocatedUnits = inventory.reduce((sum, row) => sum + numberValue(row.allocatedQty), 0);
  const severeAlerts = ctAlerts.filter((alert) => alert.severity === "CRITICAL").length;
  const financeRiskScore = financePackets.reduce((sum, packet) => sum + packet.riskScore, 0);
  const latestSimulation = simulationPackets[0] ?? null;
  return {
    demandUnits,
    plannedDemandUnits,
    openSalesOrders: salesOrders.length,
    supplyUnits: Math.max(purchaseSupply, plannedSupplyUnits),
    plannedSupplyUnits: Math.max(1, plannedSupplyUnits || purchaseSupply),
    inboundPurchaseOrders: purchaseOrders.length,
    inventoryUnits,
    allocatedUnits,
    openWmsTasks: wmsTasks.length,
    transportExceptions: ctExceptions.length + severeAlerts,
    lateShipments: ctAlerts.length,
    supplierCommitmentGaps: planningPackets.filter((packet) => numberValue(packet.shortageUnits) > 0 || packet.planningScore < 65).length,
    financeRiskScore,
    simulationRecommendationKey: latestSimulation?.recommendedScenarioKey ?? null,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantContinuousPlanningPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        planHealthScore: true,
        replanningTriggerCount: true,
        demandVariancePct: true,
        supplyCoveragePct: true,
        inventoryCoveragePct: true,
        transportRiskCount: true,
        recoveryActionCount: true,
        controlSnapshotJson: true,
        varianceJson: true,
        triggerJson: true,
        recoveryPlanJson: true,
        ownerWorkJson: true,
        approvalPlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadPlanningInputs(tenantId),
  ]);
  const preview = buildContinuousPlanningPacket(inputs);
  return {
    signals: {
      planHealthScore: preview.planHealthScore,
      replanningTriggerCount: preview.replanningTriggerCount,
      demandVariancePct: preview.demandVariancePct,
      supplyCoveragePct: preview.supplyCoveragePct,
      inventoryCoveragePct: preview.inventoryCoveragePct,
      transportRiskCount: preview.transportRiskCount,
      recoveryActionCount: preview.recoveryActionCount,
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
  const gate = await requireContinuousPlanningAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireContinuousPlanningAccess(true);
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

  if (action === "queue_planning_review") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantContinuousPlanningPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Continuous planning packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_continuous_planning",
        prompt: "Queue assistant continuous planning review",
        answerKind: "assistant_continuous_planning_review",
        message: "Assistant continuous planning packet queued for human review. Forecasts, orders, POs, inventory, WMS tasks, shipments, suppliers, and customer promises were not mutated automatically.",
        evidence: { packetId: packet.id, planHealthScore: packet.planHealthScore, replanningTriggerCount: packet.replanningTriggerCount, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_continuous_planning_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_continuous_planning_packet",
        objectId: packet.id,
        objectHref: "/assistant/continuous-planning",
        priority: packet.planHealthScore < 50 || packet.replanningTriggerCount >= 3 ? "HIGH" : packet.replanningTriggerCount > 0 ? "MEDIUM" : "LOW",
        actionId: `amp35-planning-${packet.id}`.slice(0, 128),
        actionKind: "assistant_continuous_planning_review",
        label: `Review continuous plan: ${packet.title}`,
        description: "Review plan-vs-actual triggers and recovery owners before downstream replanning work.",
        payload: { packetId: packet.id, planHealthScore: packet.planHealthScore, replanningTriggerCount: packet.replanningTriggerCount, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantContinuousPlanningPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported continuous planning action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadPlanningInputs(gate.access.tenant.id);
  const built = buildContinuousPlanningPacket(inputs);
  const packet = await prisma.assistantContinuousPlanningPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      planHealthScore: built.planHealthScore,
      replanningTriggerCount: built.replanningTriggerCount,
      demandVariancePct: built.demandVariancePct,
      supplyCoveragePct: built.supplyCoveragePct,
      inventoryCoveragePct: built.inventoryCoveragePct,
      transportRiskCount: built.transportRiskCount,
      recoveryActionCount: built.recoveryActionCount,
      controlSnapshotJson: built.controlSnapshot as Prisma.InputJsonValue,
      varianceJson: built.variance as Prisma.InputJsonValue,
      triggerJson: built.triggers as Prisma.InputJsonValue,
      recoveryPlanJson: built.recoveryPlan as Prisma.InputJsonValue,
      ownerWorkJson: built.ownerWork as Prisma.InputJsonValue,
      approvalPlanJson: built.approvalPlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, planHealthScore: true, replanningTriggerCount: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_continuous_planning",
      prompt: "Create assistant continuous planning packet",
      answerKind: "assistant_continuous_planning_packet",
      message: built.leadershipSummary,
      evidence: {
        controlSnapshot: built.controlSnapshot,
        variance: built.variance,
        triggers: built.triggers,
        recoveryPlan: built.recoveryPlan,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_continuous_planning_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildPlanningBridgePacket,
  type PlanningConstraintSignal,
  type PlanningDemandSignal,
  type PlanningInventorySignal,
  type PlanningSupplySignal,
} from "@/lib/assistant/planning-bridge";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requirePlanningBridgeAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canDemand = viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view") || viewerHas(access.grantSet, "org.crm", "view");
  const canSupply = viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view") || viewerHas(access.grantSet, "org.products", "view");
  const canExecution = viewerHas(access.grantSet, "org.wms", "view") || viewerHas(access.grantSet, "org.controltower", "view");
  if (!canDemand || !canSupply || !canExecution) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires demand, supply, and execution evidence access for planning bridge.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function moneyOrQty(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadPlanningInputs(tenantId: string, grantSet: Set<string>, horizonDays = 30) {
  const horizonEnd = new Date(Date.now() + horizonDays * 86_400_000);
  const [demandRows, supplyRows, inventoryRows, wmsTasks, warehousePlans, masterDataRuns] = await Promise.all([
    viewerHas(grantSet, "org.orders", "view")
      ? prisma.salesOrderLine.findMany({
          where: {
            tenantId,
            salesOrder: {
              status: { in: ["DRAFT", "OPEN"] },
              OR: [{ requestedShipDate: null }, { requestedShipDate: { lte: horizonEnd } }, { requestedDeliveryDate: { lte: horizonEnd } }],
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 250,
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            salesOrder: {
              select: { soNumber: true, customerName: true, requestedShipDate: true, requestedDeliveryDate: true, status: true },
            },
            product: { select: { name: true, sku: true, productCode: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.suppliers", "view") || viewerHas(grantSet, "org.orders", "view")
      ? prisma.purchaseOrderItem.findMany({
          where: {
            order: {
              tenantId,
              requestedDeliveryDate: { lte: horizonEnd },
            },
          },
          orderBy: { id: "desc" },
          take: 250,
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            order: { select: { orderNumber: true, requestedDeliveryDate: true, supplier: { select: { name: true } }, status: { select: { label: true } } } },
            product: { select: { name: true, sku: true, productCode: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.wms", "view") || viewerHas(grantSet, "org.products", "view")
      ? prisma.inventoryBalance.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 300,
          select: {
            productId: true,
            onHandQty: true,
            allocatedQty: true,
            onHold: true,
            warehouse: { select: { name: true, code: true } },
            product: { select: { name: true, sku: true, productCode: true } },
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.wms", "view")
      ? prisma.wmsTask.findMany({
          where: { tenantId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, taskType: true, quantity: true, productId: true, referenceType: true, referenceId: true, note: true, warehouse: { select: { name: true, code: true } } },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.wms", "view")
      ? prisma.assistantWarehouseCapacityPlan.findMany({
          where: { tenantId, status: { in: ["DRAFT", "REVIEW_QUEUED"] } },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { id: true, title: true, capacityScore: true, status: true },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.products", "view")
      ? prisma.assistantMasterDataQualityRun.findMany({
          where: { tenantId, status: { in: ["DRAFT", "REVIEW_QUEUED"] } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, qualityScore: true, title: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const demand: PlanningDemandSignal[] = demandRows.map((row) => ({
    id: row.id,
    orderNo: row.salesOrder.soNumber,
    productId: row.productId,
    productLabel: row.product?.name ?? row.description,
    customerLabel: row.salesOrder.customerName,
    quantity: moneyOrQty(row.quantity),
    requestedDate: (row.salesOrder.requestedShipDate ?? row.salesOrder.requestedDeliveryDate)?.toISOString() ?? null,
    status: row.salesOrder.status,
  }));
  const supply: PlanningSupplySignal[] = supplyRows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productLabel: row.product?.name ?? row.description,
    quantity: moneyOrQty(row.quantity),
    expectedDate: row.order.requestedDeliveryDate?.toISOString() ?? null,
    supplierLabel: row.order.supplier?.name ?? null,
    status: row.order.status.label,
  }));
  const inventory: PlanningInventorySignal[] = inventoryRows.map((row) => ({
    productId: row.productId,
    productLabel: row.product.name,
    warehouseLabel: row.warehouse.code ?? row.warehouse.name,
    onHandQty: moneyOrQty(row.onHandQty),
    allocatedQty: moneyOrQty(row.allocatedQty),
    onHold: row.onHold,
  }));
  const constraints: PlanningConstraintSignal[] = [
    ...wmsTasks.map((task) => ({
      id: task.id,
      source: "WMS" as const,
      label: `${task.taskType} open at ${task.warehouse.code ?? task.warehouse.name}`,
      severity: moneyOrQty(task.quantity) >= 100 ? ("HIGH" as const) : ("MEDIUM" as const),
      detail: task.note ?? `${moneyOrQty(task.quantity)} units tied to open WMS work.`,
      objectType: "wms_task",
      objectId: task.id,
    })),
    ...warehousePlans.map((plan) => ({
      id: plan.id,
      source: "WMS" as const,
      label: plan.title,
      severity: plan.capacityScore < 50 ? ("HIGH" as const) : ("MEDIUM" as const),
      detail: `Warehouse capacity plan ${plan.status} with score ${plan.capacityScore}/100.`,
      objectType: "assistant_warehouse_capacity_plan",
      objectId: plan.id,
    })),
    ...masterDataRuns.map((run) => ({
      id: run.id,
      source: "MASTER_DATA" as const,
      label: run.title,
      severity: run.qualityScore < 60 ? ("HIGH" as const) : ("LOW" as const),
      detail: `Master data quality run ${run.status} with score ${run.qualityScore}/100.`,
      objectType: "assistant_master_data_quality_run",
      objectId: run.id,
    })),
  ];
  return { horizonDays, demand, supply, inventory, constraints };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantPlanningPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        planningScore: true,
        horizonDays: true,
        demandUnits: true,
        availableUnits: true,
        inboundUnits: true,
        shortageUnits: true,
        demandSummaryJson: true,
        supplySummaryJson: true,
        gapAnalysisJson: true,
        constraintJson: true,
        scenarioJson: true,
        recommendationJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        scenarioDraftId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadPlanningInputs(tenantId, grantSet),
  ]);
  const preview = buildPlanningBridgePacket(inputs);
  return {
    signals: {
      demandLines: inputs.demand.length,
      supplyLines: inputs.supply.length,
      inventoryRows: inputs.inventory.length,
      constraints: inputs.constraints.length,
      previewPlanningScore: preview.planningScore,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      demandUnits: packet.demandUnits.toString(),
      availableUnits: packet.availableUnits.toString(),
      inboundUnits: packet.inboundUnits.toString(),
      shortageUnits: packet.shortageUnits.toString(),
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requirePlanningBridgeAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requirePlanningBridgeAccess(true);
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
    const packet = await prisma.assistantPlanningPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Planning packet not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_planning_bridge",
        prompt: "Queue planning bridge packet",
        answerKind: "planning_bridge_review",
        message: "S&OP planning packet queued for human review. Source orders, supply, inventory, WMS, and shipments were not mutated.",
        evidence: { packetId: packet.id, planningScore: packet.planningScore, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_planning_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_planning_packet",
        objectId: packet.id,
        objectHref: "/assistant/planning-bridge",
        priority: packet.planningScore < 60 ? "HIGH" : "MEDIUM",
        actionId: `amp22-plan-${packet.id}`.slice(0, 128),
        actionKind: "planning_bridge_review",
        label: `Review S&OP packet: ${packet.title}`,
        description: "Approve constrained planning recommendations before changing SO, PO, inventory, warehouse, or transport records.",
        payload: { packetId: packet.id, planningScore: packet.planningScore, scenarioDraftId: packet.scenarioDraftId, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantPlanningPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, packet: updated, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported planning bridge action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadPlanningInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildPlanningBridgePacket(inputs);
  const scenario = await prisma.supplyChainTwinScenarioDraft.create({
    data: {
      tenantId: gate.access.tenant.id,
      title: built.scenario.title,
      status: "draft",
      draftJson: {
        origin: "ASSISTANT_PLANNING_BRIDGE",
        horizonDays: built.horizonDays,
        assumptions: built.scenario.assumptions,
        topGaps: built.scenario.topGaps,
        constraints: built.constraints.items.slice(0, 12),
        guardrail: "Advisory planning scenario only; source records require separate approval.",
      } as Prisma.InputJsonObject,
    },
    select: { id: true, title: true, status: true },
  });
  await prisma.supplyChainTwinScenarioRevision.create({
    data: {
      tenantId: gate.access.tenant.id,
      scenarioDraftId: scenario.id,
      actorId: actorUserId,
      action: "create",
      titleBefore: null,
      titleAfter: scenario.title,
      statusBefore: null,
      statusAfter: scenario.status,
    },
  });
  const packet = await prisma.assistantPlanningPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      planningScore: built.planningScore,
      horizonDays: built.horizonDays,
      demandUnits: new Prisma.Decimal(String(built.demandUnits)),
      availableUnits: new Prisma.Decimal(String(built.availableUnits)),
      inboundUnits: new Prisma.Decimal(String(built.inboundUnits)),
      shortageUnits: new Prisma.Decimal(String(built.shortageUnits)),
      demandSummaryJson: built.demandSummary as Prisma.InputJsonValue,
      supplySummaryJson: built.supplySummary as Prisma.InputJsonValue,
      gapAnalysisJson: built.gapAnalysis as Prisma.InputJsonValue,
      constraintJson: built.constraints as Prisma.InputJsonValue,
      scenarioJson: { ...built.scenario, scenarioDraftId: scenario.id } as Prisma.InputJsonValue,
      recommendationJson: built.recommendations as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
      scenarioDraftId: scenario.id,
    },
    select: { id: true, title: true, planningScore: true, status: true, scenarioDraftId: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_planning_bridge",
      prompt: "Create planning bridge packet",
      answerKind: "planning_bridge_packet",
      message: built.leadershipSummary,
      evidence: { planningScore: built.planningScore, scenarioDraftId: scenario.id, gapAnalysis: built.gapAnalysis } as Prisma.InputJsonObject,
      objectType: "assistant_planning_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}

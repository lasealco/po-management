import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildWarehouseFulfillmentPacket, type WarehouseFulfillmentInputs } from "@/lib/assistant/warehouse-fulfillment-autonomy";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireWarehouseFulfillmentAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen = viewerHas(access.grantSet, "org.wms", mode) || viewerHas(access.grantSet, "org.controltower", mode) || viewerHas(access.grantSet, "org.orders", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires WMS, Control Tower, or orders access for Warehouse & Fulfillment Autonomy.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadWarehouseFulfillmentInputs(tenantId: string): Promise<WarehouseFulfillmentInputs> {
  const [warehouses, tasks, waves, outboundOrders, inventory, shipments, capacityPlans, networkPackets, actionQueue] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 120,
      select: { id: true, code: true, name: true, isActive: true },
    }),
    prisma.wmsTask.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: {
        id: true,
        warehouseId: true,
        taskType: true,
        status: true,
        quantity: true,
        createdAt: true,
        warehouse: { select: { name: true } },
        product: { select: { name: true, sku: true } },
        shipment: { select: { shipmentNo: true } },
        order: { select: { orderNumber: true } },
        wave: { select: { waveNo: true } },
      },
    }),
    prisma.wmsWave.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        warehouseId: true,
        waveNo: true,
        status: true,
        createdAt: true,
        warehouse: { select: { name: true } },
        tasks: { select: { status: true } },
      },
    }),
    prisma.outboundOrder.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 220,
      select: {
        id: true,
        warehouseId: true,
        outboundNo: true,
        status: true,
        requestedShipDate: true,
        warehouse: { select: { name: true } },
        lines: { select: { quantity: true, pickedQty: true, packedQty: true, shippedQty: true } },
      },
    }),
    prisma.inventoryBalance.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 800,
      select: { id: true, warehouseId: true, onHandQty: true, allocatedQty: true, onHold: true, holdReason: true, warehouse: { select: { name: true } } },
    }),
    prisma.shipment.findMany({
      where: { order: { tenantId } },
      orderBy: { updatedAt: "desc" },
      take: 220,
      select: { id: true, shipmentNo: true, status: true, expectedReceiveAt: true, receivedAt: true, ctExceptions: { where: { status: { not: "RESOLVED" } }, select: { id: true } } },
    }),
    prisma.assistantWarehouseCapacityPlan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, capacityScore: true, warehouseId: true },
    }),
    prisma.assistantSupplyNetworkTwinPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, status: true, twinScore: true, bottleneckCount: true, disruptionRiskCount: true, recoveryActionCount: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);
  const now = Date.now();
  return {
    warehouses,
    tasks: tasks.map((task) => ({
      id: task.id,
      warehouseId: task.warehouseId,
      warehouseName: task.warehouse.name,
      taskType: String(task.taskType),
      status: String(task.status),
      quantity: numberValue(task.quantity),
      ageHours: Math.max(0, Math.floor((now - task.createdAt.getTime()) / (1000 * 60 * 60))),
      productName: task.product?.name ?? task.product?.sku ?? null,
      shipmentNo: task.shipment?.shipmentNo ?? null,
      orderNumber: task.order?.orderNumber ?? null,
      waveNo: task.wave?.waveNo ?? null,
    })),
    waves: waves.map((wave) => ({
      id: wave.id,
      warehouseId: wave.warehouseId,
      warehouseName: wave.warehouse.name,
      waveNo: wave.waveNo,
      status: String(wave.status),
      taskCount: wave.tasks.length,
      openTaskCount: wave.tasks.filter((task) => task.status === "OPEN").length,
      ageHours: Math.max(0, Math.floor((now - wave.createdAt.getTime()) / (1000 * 60 * 60))),
    })),
    outboundOrders: outboundOrders.map((order) => ({
      id: order.id,
      warehouseId: order.warehouseId,
      warehouseName: order.warehouse.name,
      outboundNo: order.outboundNo,
      status: String(order.status),
      requestedShipDate: order.requestedShipDate?.toISOString() ?? null,
      lineCount: order.lines.length,
      pickedQty: order.lines.reduce((sum, line) => sum + numberValue(line.pickedQty), 0),
      packedQty: order.lines.reduce((sum, line) => sum + numberValue(line.packedQty), 0),
      shippedQty: order.lines.reduce((sum, line) => sum + numberValue(line.shippedQty), 0),
      totalQty: order.lines.reduce((sum, line) => sum + numberValue(line.quantity), 0),
    })),
    inventory: inventory.map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      onHandQty: numberValue(row.onHandQty),
      allocatedQty: numberValue(row.allocatedQty),
      onHold: row.onHold,
      holdReason: row.holdReason,
    })),
    shipments: shipments.map((shipment) => ({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      status: String(shipment.status),
      expectedReceiveAt: shipment.expectedReceiveAt?.toISOString() ?? null,
      receivedAt: shipment.receivedAt?.toISOString() ?? null,
      exceptionCount: shipment.ctExceptions.length,
    })),
    capacityPlans,
    networkPackets,
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantWarehouseFulfillmentPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        autonomyScore: true,
        warehouseCount: true,
        openTaskCount: true,
        agedTaskCount: true,
        waveRiskCount: true,
        outboundRiskCount: true,
        exceptionCount: true,
        recoveryActionCount: true,
        sourceSummaryJson: true,
        capacityPostureJson: true,
        taskRecoveryJson: true,
        waveHealthJson: true,
        outboundFulfillmentJson: true,
        exceptionEvidenceJson: true,
        supervisorActionJson: true,
        mobileWorkJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadWarehouseFulfillmentInputs(tenantId),
  ]);
  const preview = buildWarehouseFulfillmentPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewAutonomyScore: preview.autonomyScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireWarehouseFulfillmentAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireWarehouseFulfillmentAccess(true);
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

  if (action === "queue_supervisor_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantWarehouseFulfillmentPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Warehouse fulfillment packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantWarehouseFulfillmentPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_warehouse_fulfillment_autonomy",
          prompt: "Approve Sprint 8 Warehouse Fulfillment packet",
          answerKind: "warehouse_fulfillment_approved",
          message: "Warehouse & Fulfillment Autonomy packet approved after human review. WMS tasks, waves, inventory, outbound orders, shipments, staffing, mobile work, and customer promises were not changed automatically.",
          evidence: { packetId: packet.id, autonomyScore: packet.autonomyScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_warehouse_fulfillment_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_warehouse_fulfillment_autonomy",
        prompt: "Queue Sprint 8 Warehouse Fulfillment supervisor review",
        answerKind: "warehouse_fulfillment_supervisor_review",
        message: "Supervisor review queued for warehouse fulfillment autonomy. The assistant does not mutate WMS tasks, waves, inventory, outbound orders, shipments, staffing, mobile work, or customer promises.",
        evidence: { packetId: packet.id, autonomyScore: packet.autonomyScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_warehouse_fulfillment_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_warehouse_fulfillment_packet",
        objectId: packet.id,
        objectHref: "/assistant/warehouse-fulfillment-autonomy",
        priority: packet.autonomyScore < 65 || packet.agedTaskCount > 0 || packet.waveRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint8-warehouse-fulfillment-${packet.id}`.slice(0, 128),
        actionKind: "warehouse_fulfillment_supervisor_review",
        label: `Review ${packet.title}`,
        description: "Review capacity, task recovery, wave health, outbound risk, exceptions, mobile work, and rollback before WMS execution.",
        payload: { packetId: packet.id, autonomyScore: packet.autonomyScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantWarehouseFulfillmentPacket.update({ where: { id: packet.id }, data: { status: "SUPERVISOR_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Warehouse Fulfillment action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadWarehouseFulfillmentInputs(gate.access.tenant.id);
  const built = buildWarehouseFulfillmentPacket(inputs);
  const packet = await prisma.assistantWarehouseFulfillmentPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      autonomyScore: built.autonomyScore,
      warehouseCount: built.capacityPosture.warehouseCount,
      openTaskCount: built.taskRecovery.openTaskCount,
      agedTaskCount: built.taskRecovery.agedTaskCount,
      waveRiskCount: built.waveHealth.waveRiskCount,
      outboundRiskCount: built.outboundFulfillment.outboundRiskCount,
      exceptionCount: built.exceptionEvidence.exceptionCount,
      recoveryActionCount: built.supervisorAction.recoveryActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      capacityPostureJson: built.capacityPosture as Prisma.InputJsonValue,
      taskRecoveryJson: built.taskRecovery as Prisma.InputJsonValue,
      waveHealthJson: built.waveHealth as Prisma.InputJsonValue,
      outboundFulfillmentJson: built.outboundFulfillment as Prisma.InputJsonValue,
      exceptionEvidenceJson: built.exceptionEvidence as Prisma.InputJsonValue,
      supervisorActionJson: built.supervisorAction as Prisma.InputJsonValue,
      mobileWorkJson: built.mobileWork as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, autonomyScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_warehouse_fulfillment_autonomy",
      prompt: "Create Sprint 8 Warehouse Fulfillment packet",
      answerKind: "warehouse_fulfillment_packet",
      message: built.leadershipSummary,
      evidence: { autonomyScore: built.autonomyScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_warehouse_fulfillment_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}

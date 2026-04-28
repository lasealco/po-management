import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildWarehouseCapacitySummary,
  buildWarehouseRecoveryPlan,
  type WarehouseCapacityTaskSignal,
} from "@/lib/assistant/warehouse-capacity";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

async function requireWarehouseCapacityAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  if (!viewerHas(access.grantSet, "org.wms", edit ? "edit" : "view")) {
    return { ok: false as const, response: toApiErrorResponse({ error: `Forbidden: requires org.wms ${edit ? "edit" : "view"}.`, code: "FORBIDDEN", status: 403 }) };
  }
  return { ok: true as const, access };
}

async function buildWarehouseSnapshot(tenantId: string) {
  const [warehouses, plans] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, code: true, name: true },
    }),
    prisma.assistantWarehouseCapacityPlan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, title: true, status: true, capacityScore: true, warehouseId: true, recoveryPlanJson: true, updatedAt: true },
    }),
  ]);
  return { warehouses, plans: plans.map((plan) => ({ ...plan, updatedAt: plan.updatedAt.toISOString() })) };
}

export async function GET() {
  const gate = await requireWarehouseCapacityAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildWarehouseSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireWarehouseCapacityAccess(true);
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

  if (action === "queue_recovery") {
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    if (!planId) return toApiErrorResponse({ error: "planId is required.", code: "BAD_INPUT", status: 400 });
    const plan = await prisma.assistantWarehouseCapacityPlan.findFirst({ where: { tenantId: gate.access.tenant.id, id: planId } });
    if (!plan) return toApiErrorResponse({ error: "Plan not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_warehouse_capacity",
        prompt: "Queue warehouse capacity recovery",
        answerKind: "warehouse_capacity_recovery",
        message: `Queued supervisor recovery work for ${plan.title}.`,
        evidence: { planId: plan.id, recoveryPlan: plan.recoveryPlanJson } as Prisma.InputJsonValue,
        objectType: "assistant_warehouse_capacity_plan",
        objectId: plan.id,
      },
      select: { id: true },
    });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_warehouse_capacity_plan",
        objectId: plan.id,
        objectHref: "/assistant/warehouse-capacity",
        priority: plan.capacityScore < 45 ? "HIGH" : "MEDIUM",
        actionId: `amp15-recover-${plan.id}`.slice(0, 128),
        actionKind: "warehouse_capacity_recovery",
        label: `Review warehouse recovery: ${plan.title}`,
        description: "Approve task sequencing, held-stock review, and outbound prioritization before any WMS mutation.",
        payload: { planId: plan.id, recoveryPlan: plan.recoveryPlanJson } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantWarehouseCapacityPlan.update({
      where: { id: plan.id },
      data: { status: "RECOVERY_QUEUED", actionQueueItemId: actionItem.id, approvedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, plan: updated });
  }

  if (action !== "create_plan") {
    return toApiErrorResponse({ error: "Unsupported warehouse capacity action.", code: "BAD_INPUT", status: 400 });
  }

  const warehouseId = typeof body.warehouseId === "string" && body.warehouseId.trim() ? body.warehouseId.trim() : null;
  const warehouse = warehouseId
    ? await prisma.warehouse.findFirst({ where: { tenantId: gate.access.tenant.id, id: warehouseId }, select: { id: true, name: true, code: true } })
    : await prisma.warehouse.findFirst({ where: { tenantId: gate.access.tenant.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  if (!warehouse) return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });

  const [tasks, heldBalanceCount, releasedOutboundCount] = await Promise.all([
    prisma.wmsTask.findMany({
      where: { tenantId: gate.access.tenant.id, warehouseId: warehouse.id, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: {
        id: true,
        taskType: true,
        quantity: true,
        createdAt: true,
        product: { select: { name: true, sku: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.inventoryBalance.count({ where: { tenantId: gate.access.tenant.id, warehouseId: warehouse.id, onHold: true } }),
    prisma.outboundOrder.count({ where: { tenantId: gate.access.tenant.id, warehouseId: warehouse.id, status: "RELEASED" } }),
  ]);
  const now = Date.now();
  const openTasks: WarehouseCapacityTaskSignal[] = tasks.map((task) => ({
    id: task.id,
    taskType: task.taskType,
    quantity: Number(task.quantity),
    ageHours: Math.max(0, Math.floor((now - task.createdAt.getTime()) / (1000 * 60 * 60))),
    productName: task.product?.name ?? task.product?.sku ?? null,
    orderNumber: task.order?.orderNumber ?? null,
  }));
  const recoveryPlan = buildWarehouseRecoveryPlan({
    warehouseName: warehouse.name,
    openTasks,
    heldBalanceCount,
    releasedOutboundCount,
  });
  const summary = buildWarehouseCapacitySummary(recoveryPlan);
  const plan = await prisma.assistantWarehouseCapacityPlan.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      warehouseId: warehouse.id,
      title: `Capacity plan for ${warehouse.name}`,
      status: recoveryPlan.status,
      capacityScore: recoveryPlan.score,
      taskSummaryJson: { openTasks, heldBalanceCount, releasedOutboundCount } as unknown as Prisma.InputJsonValue,
      bottleneckJson: recoveryPlan.bottlenecks as unknown as Prisma.InputJsonValue,
      recoveryPlanJson: recoveryPlan as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true, capacityScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_warehouse_capacity",
      prompt: `Create warehouse capacity plan for ${warehouse.name}`,
      answerKind: "warehouse_capacity_plan",
      message: summary,
      evidence: { warehouse, recoveryPlan } as unknown as Prisma.InputJsonValue,
      objectType: "warehouse",
      objectId: warehouse.id,
    },
  });
  return NextResponse.json({ ok: true, plan }, { status: 201 });
}

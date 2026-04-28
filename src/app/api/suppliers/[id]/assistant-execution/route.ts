import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, loadGlobalGrantsForUser, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import { fetchSupplierOrderAnalytics } from "@/lib/supplier-order-analytics";
import {
  buildSupplierFollowUpMessage,
  buildSupplierOnboardingGapPlan,
  buildSupplierPerformanceBrief,
  needsSupplierFollowUp,
  parseSupplierAssistantExecutionStatus,
  type SupplierAssistantOrderSignal,
  type SupplierAssistantTaskSignal,
} from "@/lib/suppliers/assistant-execution";

export const dynamic = "force-dynamic";

async function loadSupplierExecution(tenantId: string, supplierId: string, canViewOrders: boolean) {
  await ensureSupplierOnboardingTasks(prisma, tenantId, supplierId);
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: {
      id: true,
      name: true,
      code: true,
      assistantPerformanceBrief: true,
      assistantOnboardingGapPlan: true,
      assistantExecutionStatus: true,
      assistantExecutionNote: true,
      assistantLastReviewedAt: true,
      onboardingTasks: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, taskKey: true, title: true, done: true, dueAt: true, notes: true },
      },
    },
  });
  if (!supplier) return null;

  const tasks: SupplierAssistantTaskSignal[] = supplier.onboardingTasks.map((task) => ({
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    done: task.done,
    dueAt: task.dueAt?.toISOString() ?? null,
    notes: task.notes,
  }));

  const orderAnalytics = canViewOrders ? await fetchSupplierOrderAnalytics(prisma, tenantId, supplierId) : null;
  const openOrders = canViewOrders
    ? await prisma.purchaseOrder.findMany({
        where: { tenantId, supplierId, splitParentId: null },
        orderBy: [{ requestedDeliveryDate: "asc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          orderNumber: true,
          title: true,
          requestedDeliveryDate: true,
          totalAmount: true,
          currency: true,
          status: { select: { code: true, label: true, isEnd: true } },
          _count: { select: { items: true } },
        },
      })
    : [];
  const orderSignals: SupplierAssistantOrderSignal[] = openOrders
    .filter((order) => !order.status.isEnd)
    .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      statusCode: order.status.code,
      statusLabel: order.status.label,
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
      totalAmount: order.totalAmount.toString(),
      currency: order.currency,
      itemCount: order._count.items,
    }));
  const followUpOrders = orderSignals.filter((order) => needsSupplierFollowUp(order));
  const generatedBrief = buildSupplierPerformanceBrief({
    supplierName: supplier.name,
    orderCount: orderAnalytics?.parentOrderCount ?? 0,
    awaitingConfirmation: orderAnalytics?.performance.confirmation.ordersAwaitingConfirmation ?? 0,
    onTimeShipPct: orderAnalytics?.performance.shippingVsRequested.onTimeShipPct ?? null,
    openSignals: orderSignals,
  });
  const generatedGapPlan = buildSupplierOnboardingGapPlan(tasks);
  const firstFollowUp = followUpOrders[0] ?? orderSignals[0] ?? null;

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      assistantPerformanceBrief: supplier.assistantPerformanceBrief,
      assistantOnboardingGapPlan: supplier.assistantOnboardingGapPlan,
      assistantExecutionStatus: supplier.assistantExecutionStatus,
      assistantExecutionNote: supplier.assistantExecutionNote,
      assistantLastReviewedAt: supplier.assistantLastReviewedAt?.toISOString() ?? null,
    },
    generated: {
      performanceBrief: generatedBrief,
      onboardingGapPlan: generatedGapPlan,
      followUpMessage: firstFollowUp
        ? buildSupplierFollowUpMessage({ supplierName: supplier.name, order: firstFollowUp })
        : `Hi ${supplier.name},\n\nPlease confirm whether there are any open blockers we should capture in our supplier workspace.`,
    },
    metrics: {
      parentOrderCount: orderAnalytics?.parentOrderCount ?? null,
      awaitingConfirmation: orderAnalytics?.performance.confirmation.ordersAwaitingConfirmation ?? null,
      onTimeShipPct: orderAnalytics?.performance.shippingVsRequested.onTimeShipPct ?? null,
      openOnboardingTasks: tasks.filter((task) => !task.done).length,
      followUpOrderCount: followUpOrders.length,
    },
    orders: orderSignals,
    followUpOrders,
    onboardingTasks: tasks,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  const grants = actorId ? await loadGlobalGrantsForUser(actorId) : new Set<string>();
  const canViewOrders = viewerHas(grants, "org.orders", "view");
  const { id } = await context.params;
  const snapshot = await loadSupplierExecution(tenant.id, id, canViewOrders);
  if (!snapshot) return toApiErrorResponse({ error: "Supplier not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = Object.prototype.hasOwnProperty.call(record, "assistantExecutionStatus")
    ? parseSupplierAssistantExecutionStatus(record.assistantExecutionStatus)
    : null;
  if (Object.prototype.hasOwnProperty.call(record, "assistantExecutionStatus") && !status) {
    return toApiErrorResponse({ error: "Invalid assistantExecutionStatus.", code: "BAD_INPUT", status: 400 });
  }
  const performanceBrief =
    typeof record.assistantPerformanceBrief === "string" ? record.assistantPerformanceBrief.trim().slice(0, 12_000) : undefined;
  const gapPlan =
    typeof record.assistantOnboardingGapPlan === "string" ? record.assistantOnboardingGapPlan.trim().slice(0, 12_000) : undefined;
  const note = typeof record.assistantExecutionNote === "string" ? record.assistantExecutionNote.trim().slice(0, 12_000) : undefined;

  const existing = await prisma.supplier.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true, name: true } });
  if (!existing) return toApiErrorResponse({ error: "Supplier not found.", code: "NOT_FOUND", status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.update({
      where: { id: existing.id },
      data: {
        ...(performanceBrief !== undefined ? { assistantPerformanceBrief: performanceBrief || null } : {}),
        ...(gapPlan !== undefined ? { assistantOnboardingGapPlan: gapPlan || null } : {}),
        ...(note !== undefined ? { assistantExecutionNote: note || null } : {}),
        ...(status ? { assistantExecutionStatus: status, assistantLastReviewedAt: new Date() } : {}),
      },
      select: {
        id: true,
        assistantPerformanceBrief: true,
        assistantOnboardingGapPlan: true,
        assistantExecutionStatus: true,
        assistantExecutionNote: true,
      },
    });
    await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actorId,
        surface: "supplier_detail",
        prompt: `Review supplier execution plan for ${existing.name}`,
        answerKind: "supplier_execution_review",
        message: status
          ? `Supplier execution plan marked ${status} for ${existing.name}.`
          : `Supplier execution plan updated for ${existing.name}.`,
        evidence: [{ label: existing.name, href: `/suppliers/${existing.id}` }],
        quality: { mode: "human_review", status: status ?? "UPDATED" },
        objectType: "supplier",
        objectId: existing.id,
      },
    });
    return supplier;
  });

  return NextResponse.json({ ok: true, supplier: updated });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof record.action === "string" ? record.action : "";
  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true, name: true } });
  if (!supplier) return toApiErrorResponse({ error: "Supplier not found.", code: "NOT_FOUND", status: 404 });

  if (action === "create_onboarding_task") {
    const title = typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 256) : "";
    if (!title) return toApiErrorResponse({ error: "title is required.", code: "BAD_INPUT", status: 400 });
    const notes = typeof record.notes === "string" && record.notes.trim() ? record.notes.trim().slice(0, 4_000) : null;
    const taskKey = `assistant_${Date.now()}`;
    const task = await prisma.supplierOnboardingTask.create({
      data: { tenantId: tenant.id, supplierId: supplier.id, taskKey, title, notes, sortOrder: 900 },
      select: { id: true, title: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actorId,
        surface: "supplier_detail",
        prompt: `Create onboarding task for ${supplier.name}`,
        answerKind: "supplier_onboarding_task",
        message: `Created onboarding task "${task.title}" for ${supplier.name}.`,
        evidence: [{ label: supplier.name, href: `/suppliers/${supplier.id}` }],
        quality: { mode: "human_approved", source: "amp2_supplier_execution" },
        objectType: "supplier",
        objectId: supplier.id,
      },
    });
    return NextResponse.json({ ok: true, task });
  }

  if (action === "queue_supplier_followup") {
    const message = typeof record.message === "string" && record.message.trim() ? record.message.trim().slice(0, 12_000) : "";
    if (!message) return toApiErrorResponse({ error: "message is required.", code: "BAD_INPUT", status: 400 });
    const purchaseOrderId = typeof record.purchaseOrderId === "string" && record.purchaseOrderId.trim() ? record.purchaseOrderId.trim() : null;
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actorId,
        surface: "supplier_detail",
        prompt: `Queue supplier follow-up for ${supplier.name}`,
        answerKind: "supplier_follow_up",
        message: `Queued supplier follow-up for ${supplier.name}.`,
        evidence: [
          { label: supplier.name, href: `/suppliers/${supplier.id}` },
          ...(purchaseOrderId ? [{ label: "Purchase order", href: `/orders/${purchaseOrderId}` }] : []),
        ],
        quality: { mode: "human_approved", source: "amp2_supplier_execution" },
        objectType: "supplier",
        objectId: supplier.id,
      },
    });
    const item = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actorId,
        auditEventId: audit.id,
        objectType: "supplier",
        objectId: supplier.id,
        actionId: "supplier_follow_up",
        actionKind: "copy_text",
        label: `Send supplier follow-up to ${supplier.name}`,
        description: "Review/copy this supplier message through the approved communications channel.",
        payload: { supplierId: supplier.id, purchaseOrderId, message },
      },
      select: { id: true, status: true },
    });
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { assistantExecutionStatus: "FOLLOW_UP_QUEUED", assistantLastReviewedAt: new Date() },
    });
    return NextResponse.json({ ok: true, actionQueueItem: item });
  }

  return toApiErrorResponse({ error: "Unsupported action.", code: "BAD_INPUT", status: 400 });
}

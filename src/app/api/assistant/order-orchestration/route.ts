import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildOrderOrchestrationProposal,
  buildOrderOrchestrationSummary,
  parseOrderDemandText,
  type OrderOrchestrationAtpLine,
} from "@/lib/assistant/order-orchestration";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

async function requireOrderOrchestrationAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  if (!viewerHas(access.grantSet, "org.orders", edit ? "edit" : "view")) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: `Forbidden: requires org.orders ${edit ? "edit" : "view"}.`, code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

async function buildSnapshot(tenantId: string) {
  const [plans, customers, products, warehouses] = await Promise.all([
    prisma.assistantOrderOrchestrationPlan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, title: true, status: true, sourceKind: true, sourceText: true, customerCrmAccountId: true, salesOrderId: true, proposalJson: true, updatedAt: true },
    }),
    prisma.crmAccount.findMany({
      where: { tenantId, lifecycle: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 80,
      select: { id: true, name: true, accountType: true },
    }),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      take: 120,
      select: { id: true, name: true, sku: true, productCode: true },
    }),
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true, code: true },
    }),
  ]);
  return {
    plans: plans.map((plan) => ({ ...plan, updatedAt: plan.updatedAt.toISOString() })),
    customers,
    products,
    warehouses,
  };
}

export async function GET() {
  const gate = await requireOrderOrchestrationAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireOrderOrchestrationAccess(true);
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

  if (action === "approve_plan") {
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
    if (!planId) return toApiErrorResponse({ error: "planId is required.", code: "BAD_INPUT", status: 400 });
    const plan = await prisma.assistantOrderOrchestrationPlan.findFirst({ where: { tenantId: gate.access.tenant.id, id: planId } });
    if (!plan) return toApiErrorResponse({ error: "Plan not found.", code: "NOT_FOUND", status: 404 });
    const actionItem = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        objectType: "assistant_order_orchestration_plan",
        objectId: plan.id,
        objectHref: "/assistant/order-orchestration",
        priority: "HIGH",
        actionId: `amp13-approve-${plan.id}`.slice(0, 128),
        actionKind: "approve_order_orchestration",
        label: "Approve order orchestration plan",
        description: `Review and approve demand-to-promise orchestration plan: ${plan.title}`,
        payload: { planId: plan.id, proposal: plan.proposalJson } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantOrderOrchestrationPlan.update({
      where: { id: plan.id },
      data: { status: "APPROVAL_QUEUED", actionQueueItemId: actionItem.id, approvalNote: note, approvedAt: new Date() },
      select: { id: true, status: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_order_orchestration",
        prompt: "Approve order orchestration plan",
        answerKind: "approval_queue",
        message: `Queued approval for order orchestration plan ${plan.title}.`,
        evidence: { planId: plan.id, proposal: plan.proposalJson, note } as Prisma.InputJsonValue,
        objectType: "assistant_order_orchestration_plan",
        objectId: plan.id,
      },
    });
    return NextResponse.json({ ok: true, plan: updated });
  }

  if (action !== "create_plan") {
    return toApiErrorResponse({ error: "Unsupported order orchestration action.", code: "BAD_INPUT", status: 400 });
  }

  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim().slice(0, 12000) : "";
  if (!sourceText) return toApiErrorResponse({ error: "sourceText is required.", code: "BAD_INPUT", status: 400 });
  const customerCrmAccountId = typeof body.customerCrmAccountId === "string" && body.customerCrmAccountId.trim() ? body.customerCrmAccountId.trim() : null;
  const productId = typeof body.productId === "string" && body.productId.trim() ? body.productId.trim() : null;
  const requestedDeliveryDate =
    typeof body.requestedDeliveryDate === "string" && body.requestedDeliveryDate.trim()
      ? new Date(body.requestedDeliveryDate.trim())
      : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return toApiErrorResponse({ error: "Invalid requestedDeliveryDate.", code: "BAD_INPUT", status: 400 });
  }

  const [customer, product] = await Promise.all([
    customerCrmAccountId
      ? prisma.crmAccount.findFirst({ where: { tenantId: gate.access.tenant.id, id: customerCrmAccountId }, select: { id: true, name: true } })
      : null,
    productId
      ? prisma.product.findFirst({ where: { tenantId: gate.access.tenant.id, id: productId, isActive: true }, select: { id: true, name: true, sku: true } })
      : null,
  ]);
  const demand = parseOrderDemandText(sourceText);
  const quantity = demand.lines[0]?.quantity ?? 1;
  const balances = product
    ? await prisma.inventoryBalance.findMany({
        where: { tenantId: gate.access.tenant.id, productId: product.id },
        select: { onHandQty: true, allocatedQty: true, onHold: true, warehouse: { select: { id: true, name: true, code: true } } },
      })
    : [];
  const availableNow = balances.reduce((sum, row) => sum + (row.onHold ? 0 : Math.max(0, Number(row.onHandQty) - Number(row.allocatedQty))), 0);
  const atpLines: OrderOrchestrationAtpLine[] = [
    {
      description: product?.name ?? demand.lines[0]?.description ?? "Demand line",
      quantity,
      availableNow,
      inboundQty: 0,
      shortageQty: Math.max(0, quantity - availableNow),
    },
  ];
  const proposal = buildOrderOrchestrationProposal(atpLines);
  const summary = buildOrderOrchestrationSummary({ customerName: customer?.name ?? null, lineCount: atpLines.length, proposal });
  const plan = await prisma.assistantOrderOrchestrationPlan.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      sourceKind: typeof body.sourceKind === "string" && body.sourceKind.trim() ? body.sourceKind.trim().slice(0, 64) : "manual_prompt",
      sourceText,
      title: demand.title,
      status: proposal.status === "PROMISE_READY" ? "PROMISE_READY" : "DRAFT",
      customerCrmAccountId: customer?.id ?? null,
      requestedDeliveryDate,
      demandJson: demand as unknown as Prisma.InputJsonValue,
      matchJson: {
        customer,
        product,
        ambiguity: {
          customerMatched: Boolean(customer),
          productMatched: Boolean(product),
          needsReview: !customer || !product,
        },
      } as Prisma.InputJsonValue,
      atpJson: { lines: atpLines, balances } as unknown as Prisma.InputJsonValue,
      proposalJson: proposal as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_order_orchestration",
      prompt: sourceText,
      answerKind: "order_orchestration_plan",
      message: summary,
      evidence: { planId: plan.id, demand, proposal } as Prisma.InputJsonValue,
      objectType: "assistant_order_orchestration_plan",
      objectId: plan.id,
    },
  });
  return NextResponse.json({ ok: true, plan }, { status: 201 });
}

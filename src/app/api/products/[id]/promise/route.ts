import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, loadGlobalGrantsForUser, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  buildProductPromiseSummary,
  buildProductRecoveryProposal,
  computeProductAtp,
  parseProductPromiseStatus,
} from "@/lib/products/assistant-promise";

export const dynamic = "force-dynamic";

function numberFromDecimalish(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

async function loadPromiseSnapshot(tenantId: string, productId: string, canViewWms: boolean, canViewOrders: boolean) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      id: true,
      productCode: true,
      sku: true,
      name: true,
      unit: true,
      assistantPromiseStatus: true,
      assistantPromiseSummary: true,
      assistantRecoveryProposal: true,
      assistantPromiseReviewedAt: true,
    },
  });
  if (!product) return null;

  const balances = canViewWms
    ? await prisma.inventoryBalance.findMany({
        where: { tenantId, productId },
        orderBy: [{ onHold: "desc" }, { updatedAt: "desc" }],
        take: 25,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
        },
      })
    : [];
  const openWmsTasks = canViewWms
    ? await prisma.wmsTask.findMany({
        where: { tenantId, productId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          taskType: true,
          status: true,
          quantity: true,
          note: true,
          warehouse: { select: { id: true, code: true, name: true } },
          bin: { select: { id: true, code: true, name: true } },
        },
      })
    : [];
  const openSalesLines = canViewOrders
    ? await prisma.salesOrderLine.findMany({
        where: { tenantId, productId, salesOrder: { status: { in: ["DRAFT", "OPEN"] } } },
        orderBy: { updatedAt: "desc" },
        take: 25,
        include: { salesOrder: { select: { id: true, soNumber: true, customerName: true, status: true } } },
      })
    : [];
  const inboundPoLines = canViewOrders
    ? await prisma.purchaseOrderItem.findMany({
        where: { productId, order: { tenantId, status: { isEnd: false } } },
        orderBy: { order: { updatedAt: "desc" } },
        take: 25,
        include: { order: { select: { id: true, orderNumber: true, requestedDeliveryDate: true, status: { select: { code: true, label: true } } } } },
      })
    : [];

  const onHandQty = balances.reduce((sum, row) => sum + numberFromDecimalish(row.onHandQty), 0);
  const allocatedQty = balances.reduce((sum, row) => sum + numberFromDecimalish(row.allocatedQty), 0);
  const onHoldQty = balances.filter((row) => row.onHold).reduce((sum, row) => sum + numberFromDecimalish(row.onHandQty), 0);
  const openSalesDemandQty = openSalesLines.reduce((sum, row) => sum + numberFromDecimalish(row.quantity), 0);
  const inboundQty = inboundPoLines.reduce((sum, row) => sum + numberFromDecimalish(row.quantity), 0);
  const openWmsTaskQty = openWmsTasks.reduce((sum, row) => sum + numberFromDecimalish(row.quantity), 0);
  const inputs = { onHandQty, allocatedQty, onHoldQty, openSalesDemandQty, inboundQty, openWmsTaskQty };
  const atp = computeProductAtp(inputs);
  const generatedSummary = buildProductPromiseSummary({ productName: product.name, inputs });
  const generatedProposal = buildProductRecoveryProposal({
    productName: product.name,
    inputs,
    hasHold: onHoldQty > 0,
    hasWmsBlocker: openWmsTasks.length > 0,
  });

  return {
    product: {
      id: product.id,
      label: product.productCode || product.sku || product.name,
      name: product.name,
      unit: product.unit,
      assistantPromiseStatus: product.assistantPromiseStatus,
      assistantPromiseSummary: product.assistantPromiseSummary,
      assistantRecoveryProposal: product.assistantRecoveryProposal,
      assistantPromiseReviewedAt: product.assistantPromiseReviewedAt?.toISOString() ?? null,
    },
    permissions: { canViewWms, canViewOrders },
    metrics: { ...inputs, ...atp },
    generated: { promiseSummary: generatedSummary, recoveryProposal: generatedProposal },
    balances: balances.map((row) => ({
      id: row.id,
      warehouse: { id: row.warehouse.id, code: row.warehouse.code, name: row.warehouse.name },
      bin: { id: row.bin.id, code: row.bin.code, name: row.bin.name },
      onHandQty: row.onHandQty.toString(),
      allocatedQty: row.allocatedQty.toString(),
      availableQty: Math.max(0, numberFromDecimalish(row.onHandQty) - numberFromDecimalish(row.allocatedQty)).toString(),
      onHold: row.onHold,
      holdReason: row.holdReason,
    })),
    blockers: openWmsTasks.map((task) => ({
      id: task.id,
      taskType: task.taskType,
      status: task.status,
      quantity: task.quantity.toString(),
      warehouse: { id: task.warehouse.id, code: task.warehouse.code, name: task.warehouse.name },
      bin: task.bin ? { id: task.bin.id, code: task.bin.code, name: task.bin.name } : null,
      note: task.note,
    })),
    demand: openSalesLines.map((line) => ({
      id: line.id,
      quantity: line.quantity.toString(),
      salesOrder: line.salesOrder,
    })),
    inbound: inboundPoLines.map((line) => ({
      id: line.id,
      quantity: line.quantity.toString(),
      order: {
        id: line.order.id,
        orderNumber: line.order.orderNumber,
        requestedDeliveryDate: line.order.requestedDeliveryDate?.toISOString() ?? null,
        status: line.order.status,
      },
    })),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.products", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const grants = await loadGlobalGrantsForUser(actorUserId);
  const { id } = await context.params;
  const snapshot = await loadPromiseSnapshot(
    tenant.id,
    id,
    viewerHas(grants, "org.wms", "view"),
    viewerHas(grants, "org.orders", "view"),
  );
  if (!snapshot) return toApiErrorResponse({ error: "Product not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const promiseStatus = Object.prototype.hasOwnProperty.call(record, "assistantPromiseStatus")
    ? parseProductPromiseStatus(record.assistantPromiseStatus)
    : null;
  if (Object.prototype.hasOwnProperty.call(record, "assistantPromiseStatus") && !promiseStatus) {
    return toApiErrorResponse({ error: "Invalid assistantPromiseStatus.", code: "BAD_INPUT", status: 400 });
  }
  const summary =
    typeof record.assistantPromiseSummary === "string" ? record.assistantPromiseSummary.trim().slice(0, 12_000) : undefined;
  const proposal =
    typeof record.assistantRecoveryProposal === "string" ? record.assistantRecoveryProposal.trim().slice(0, 12_000) : undefined;
  const existing = await prisma.product.findFirst({ where: { id, tenantId: tenant.id }, select: { id: true, name: true } });
  if (!existing) return toApiErrorResponse({ error: "Product not found.", code: "NOT_FOUND", status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: existing.id },
      data: {
        ...(summary !== undefined ? { assistantPromiseSummary: summary || null } : {}),
        ...(proposal !== undefined ? { assistantRecoveryProposal: proposal || null } : {}),
        ...(promiseStatus ? { assistantPromiseStatus: promiseStatus, assistantPromiseReviewedAt: new Date() } : {}),
      },
      select: { id: true, assistantPromiseStatus: true },
    });
    await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "product_detail",
        prompt: `Review availability promise for ${existing.name}`,
        answerKind: "product_promise_review",
        message: `Updated availability promise for ${existing.name}.`,
        evidence: [{ label: existing.name, href: `/products/${existing.id}` }],
        quality: { mode: "human_review", source: "amp4_product_promise", promiseStatus: product.assistantPromiseStatus },
        objectType: "product",
        objectId: existing.id,
      },
    });
    return product;
  });
  return NextResponse.json({ ok: true, product: updated });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof record.action === "string" ? record.action : "";
  if (action !== "queue_inventory_recovery") {
    return toApiErrorResponse({ error: "Unsupported action.", code: "BAD_INPUT", status: 400 });
  }
  const proposal = typeof record.proposal === "string" && record.proposal.trim() ? record.proposal.trim().slice(0, 12_000) : "";
  if (!proposal) return toApiErrorResponse({ error: "proposal is required.", code: "BAD_INPUT", status: 400 });
  const product = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, name: true, productCode: true, sku: true },
  });
  if (!product) return toApiErrorResponse({ error: "Product not found.", code: "NOT_FOUND", status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "product_detail",
        prompt: `Queue inventory recovery for ${product.name}`,
        answerKind: "product_inventory_recovery",
        message: `Queued inventory recovery proposal for ${product.name}.`,
        evidence: [{ label: product.productCode || product.sku || product.name, href: `/products/${product.id}` }],
        quality: { mode: "human_approved", source: "amp4_product_promise", noSilentInventoryMutation: true },
        objectType: "product",
        objectId: product.id,
      },
    });
    const item = await tx.assistantActionQueueItem.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "product",
        objectId: product.id,
        actionId: "product_inventory_recovery",
        actionKind: "review_inventory_recovery",
        label: `Review inventory recovery for ${product.productCode || product.sku || product.name}`,
        description: "Review proposed release/reallocation/replenishment before any stock movement is posted.",
        payload: { productId: product.id, proposal },
      },
      select: { id: true, status: true },
    });
    await tx.product.update({
      where: { id: product.id },
      data: { assistantPromiseStatus: "RECOVERY_QUEUED", assistantPromiseReviewedAt: new Date() },
    });
    return item;
  });
  return NextResponse.json({ ok: true, actionQueueItem: result });
}

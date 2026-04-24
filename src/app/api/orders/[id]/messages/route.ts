import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  actorIsSupplierPortalRestricted,
  getActorUserId,
  requireApiGrant,
  userHasGlobalGrant,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

const MAX_LEN = 8000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gateView = await requireApiGrant("org.orders", "view");
  if (gateView) return gateView;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const { id: orderId } = await context.params;

  const msgActorId = await getActorUserId();
  const msgIsSupplier =
    msgActorId !== null && (await actorIsSupplierPortalRestricted(msgActorId));
  const msgScope = await getPurchaseOrderScopeWhere(tenant.id, msgActorId, {
    isSupplierPortalUser: msgIsSupplier,
  });
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, tenantId: tenant.id, ...(msgScope ?? {}) },
    select: { id: true },
  });
  if (!order) {
    return toApiErrorResponse({ error: "Order not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = msgActorId;
  if (!actorId) {
    return toApiErrorResponse({ error: "No active demo user for this session.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const o = body as Record<string, unknown>;
  const text =
    typeof o.body === "string" && o.body.trim() ? o.body.trim() : null;
  if (!text) {
    return toApiErrorResponse({ error: "body is required.", code: "BAD_INPUT", status: 400 });
  }
  if (text.length > MAX_LEN) {
    return toApiErrorResponse({ error: `Message must be at most ${MAX_LEN} characters.`, code: "BAD_INPUT", status: 400 });
  }

  const isInternal = Boolean(o.isInternal);
  if (isInternal) {
    const ok = await userHasGlobalGrant(actorId, "org.orders", "edit");
    if (!ok) {
      return toApiErrorResponse({ error: "Forbidden: internal messages require org.orders → edit.", code: "FORBIDDEN", status: 403 });
    }
  }

  const message = await prisma.orderChatMessage.create({
    data: {
      orderId,
      authorUserId: actorId,
      body: text,
      isInternal,
    },
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      createdAt: message.createdAt.toISOString(),
      body: message.body,
      isInternal: message.isInternal,
      author: message.author,
    },
  });
}

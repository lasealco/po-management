import { NextResponse } from "next/server";
import {
  getActorUserId,
  requireApiGrant,
  userHasGlobalGrant,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
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
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const { id: orderId } = await context.params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      { error: "No active demo user for this session." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const text =
    typeof o.body === "string" && o.body.trim() ? o.body.trim() : null;
  if (!text) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Message must be at most ${MAX_LEN} characters.` },
      { status: 400 },
    );
  }

  const isInternal = Boolean(o.isInternal);
  if (isInternal) {
    const ok = await userHasGlobalGrant(actorId, "org.orders", "edit");
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Forbidden: internal messages require org.orders → edit.",
        },
        { status: 403 },
      );
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

import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });
  const { id } = await params;

  const widget = await prisma.ctDashboardWidget.findFirst({
    where: { id, tenantId: tenant.id },
    select: { userId: true },
  });
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  if (widget.userId !== actorId) return NextResponse.json({ error: "Only owner can delete widget." }, { status: 403 });

  await prisma.ctDashboardWidget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });
  const { id } = await params;

  const widget = await prisma.ctDashboardWidget.findFirst({
    where: { id, tenantId: tenant.id, userId: actorId },
    select: { id: true },
  });
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = typeof obj.title === "string" ? obj.title.trim().slice(0, 120) : undefined;
  const sortOrderRaw = Number(obj.sortOrder);
  const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(0, Math.floor(sortOrderRaw)) : undefined;
  const layoutJson =
    obj.layoutJson && typeof obj.layoutJson === "object" ? (obj.layoutJson as object) : undefined;

  await prisma.ctDashboardWidget.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(layoutJson ? { layoutJson } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

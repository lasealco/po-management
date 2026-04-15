import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { sanitizeCtReportConfig } from "@/lib/control-tower/report-engine";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

  const existing = await prisma.ctSavedReport.findFirst({
    where: { id, tenantId: tenant.id },
    select: { userId: true },
  });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.userId !== actorId) return NextResponse.json({ error: "Only owner can edit." }, { status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 120) : undefined;
  const description =
    typeof obj.description === "string" ? (obj.description.trim() || null) : undefined;
  const isShared = typeof obj.isShared === "boolean" ? obj.isShared : undefined;
  const config = obj.config ? sanitizeCtReportConfig(obj.config) : undefined;

  await prisma.ctSavedReport.update({
    where: { id },
    data: {
      ...(name != null ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isShared !== undefined ? { isShared } : {}),
      ...(config ? { configJson: config } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

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

  const existing = await prisma.ctSavedReport.findFirst({
    where: { id, tenantId: tenant.id },
    select: { userId: true },
  });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.userId !== actorId) return NextResponse.json({ error: "Only owner can delete." }, { status: 403 });

  await prisma.ctSavedReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

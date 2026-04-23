import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const userId = await getActorUserId();
  if (!userId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const read = o?.read === true;

  if (!read) {
    return toApiErrorResponse({ error: "Expected { read: true } to mark as read.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const row = await prisma.srmOperatorNotification.findFirst({
    where: { id, tenantId: tenant.id, userId },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const updated = await prisma.srmOperatorNotification.update({
    where: { id },
    data: { readAt: new Date() },
    select: { id: true, readAt: true },
  });

  return NextResponse.json({ id: updated.id, readAt: updated.readAt?.toISOString() ?? null });
}

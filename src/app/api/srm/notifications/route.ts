import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

function unreadOnlyParam(url: URL): boolean {
  const v = url.searchParams.get("unread");
  return v === "1" || v === "true" || v === "yes";
}

/** List in-app SRM notifications for the current operator (Phase G). `?unread=1` limits rows to unread only. */
export async function GET(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const userId = await getActorUserId();
  if (!userId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const unreadOnly = unreadOnlyParam(new URL(request.url));

  const whereBase: { tenantId: string; userId: string; readAt?: null } = { tenantId: tenant.id, userId };
  if (unreadOnly) {
    whereBase.readAt = null;
  }

  const rows = await prisma.srmOperatorNotification.findMany({
    where: whereBase,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      readAt: true,
      supplierId: true,
      taskId: true,
      actorUserId: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  const unreadCount = await prisma.srmOperatorNotification.count({
    where: { tenantId: tenant.id, userId, readAt: null },
  });

  return NextResponse.json({
    unreadCount,
    unreadFilter: unreadOnly,
    notifications: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      readAt: r.readAt?.toISOString() ?? null,
      supplierId: r.supplierId,
      taskId: r.taskId,
      actorUserId: r.actorUserId,
      actorName: r.actor?.name?.trim() || null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** Mark all in-app SRM notifications read for the current user (Phase G-v1). */
export async function POST(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const userId = await getActorUserId();
  if (!userId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o || o.markAllRead !== true) {
    return toApiErrorResponse({
      error: "Expected { markAllRead: true } to mark all notifications read.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const res = await prisma.srmOperatorNotification.updateMany({
    where: { tenantId: tenant.id, userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: res.count });
}

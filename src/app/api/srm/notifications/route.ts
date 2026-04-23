import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

/** List in-app SRM notifications for the current operator (Phase G). */
export async function GET() {
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

  const rows = await prisma.srmOperatorNotification.findMany({
    where: { tenantId: tenant.id, userId },
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
      createdAt: true,
    },
  });

  const unreadCount = await prisma.srmOperatorNotification.count({
    where: { tenantId: tenant.id, userId, readAt: null },
  });

  return NextResponse.json({
    unreadCount,
    notifications: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      readAt: r.readAt?.toISOString() ?? null,
      supplierId: r.supplierId,
      taskId: r.taskId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const ids = Array.isArray(o.ids)
    ? o.ids
        .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        .map((id) => id.trim())
        .slice(0, 50)
    : [];
  if (!ids.length) return toApiErrorResponse({ error: "ids are required.", code: "BAD_INPUT", status: 400 });
  const archiveReason =
    typeof o.archiveReason === "string" && o.archiveReason.trim()
      ? `${o.archiveReason.trim().slice(0, 1000)} (by ${actorUserId})`
      : `Archived from AMP6 work engine by ${actorUserId}`;
  const result = await prisma.assistantAuditEvent.updateMany({
    where: { tenantId: tenant.id, id: { in: ids } },
    data: { archivedAt: new Date(), archiveReason },
  });
  return NextResponse.json({ ok: true, archived: result.count });
}

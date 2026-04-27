import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : null;
  if (status !== "APPROVED" && status !== "REJECTED" && status !== "DONE") {
    return toApiErrorResponse({ error: "status must be APPROVED, REJECTED, or DONE.", code: "BAD_INPUT", status: 400 });
  }

  const updated = await prisma.assistantActionQueueItem.updateMany({
    where: { id, tenantId: tenant.id },
    data: { status, decidedAt: new Date() },
  });
  if (updated.count === 0) {
    return toApiErrorResponse({ error: "Action queue item not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json({ ok: true, status });
}

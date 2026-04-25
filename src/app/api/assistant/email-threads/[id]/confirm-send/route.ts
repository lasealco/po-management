import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/assistant/email-threads/[id]/confirm-send
 * Records operator confirmation — does not send email from app servers unless SMTP is configured later.
 * Requires org.orders edit (same gate as creating sales orders).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAssistantEmailPilotEnabled()) {
    return toApiErrorResponse({ error: "Assistant email pilot is disabled.", code: "FEATURE_DISABLED", status: 404 });
  }

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "edit")) {
    return toApiErrorResponse({
      error: "You need org.orders edit to confirm a send (audit + future SMTP).",
      code: "FORBIDDEN",
      status: 403,
    });
  }
  const g = await requireApiGrant("org.orders", "edit");
  if (g) return g;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }
  const mode =
    body && typeof body === "object" && typeof (body as { mode?: unknown }).mode === "string"
      ? (body as { mode: string }).mode
      : "audit_only";
  const sendMode = mode === "mailto" ? "mailto" : "audit_only";

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const { id } = await context.params;
  if (!id) {
    return toApiErrorResponse({ error: "Missing id.", code: "BAD_INPUT", status: 400 });
  }

  const row = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });
  }
  if (!row.draftReply?.trim()) {
    return toApiErrorResponse({
      error: "Save a draft reply before confirming send.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const updated = await prisma.assistantEmailThread.update({
    where: { id },
    data: {
      status: "REPLIED",
      lastSendConfirmAt: new Date(),
      lastSendConfirmById: actorId,
      lastSendMode: sendMode,
    },
  });

  const mailtoHref = `mailto:${encodeURIComponent(row.fromAddress)}?subject=${encodeURIComponent(`Re: ${row.subject}`)}&body=${encodeURIComponent(row.draftReply)}`;

  return NextResponse.json({
    ok: true,
    thread: updated,
    mailtoHref,
    notice:
      sendMode === "mailto"
        ? "Open the mailto link in your desktop client to send from your mailbox. The app does not send mail on your behalf in this pilot."
        : "Confirmation recorded. No email was sent from our servers. Connect a provider (Gmail/M365) in a future release for server-side send with policy.",
  });
}

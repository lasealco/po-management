import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { emailPreviewFromBody, isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { requireApiGrant, viewerHas } from "@/lib/authz";
import { getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function requirePilot() {
  if (!isAssistantEmailPilotEnabled()) {
    return toApiErrorResponse({
      error: "Assistant email pilot is disabled. Set ASSISTANT_EMAIL_PILOT=1 to enable.",
      code: "FEATURE_DISABLED",
      status: 404,
    });
  }
  return null;
}

/**
 * GET /api/assistant/email-threads — list threads (newest first).
 */
export async function GET() {
  const gateP = requirePilot();
  if (gateP) return gateP;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "You need org.orders view for the mail pilot.", code: "FORBIDDEN", status: 403 });
  }
  const g = await requireApiGrant("org.orders", "view");
  if (g) return g;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const rows = await prisma.assistantEmailThread.findMany({
    where: { tenantId: tenant.id },
    orderBy: { receivedAt: "desc" },
    take: 80,
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      toAddress: true,
      preview: true,
      receivedAt: true,
      status: true,
      draftReply: true,
      lastSendConfirmAt: true,
      lastSendMode: true,
      linkedCrmAccountId: true,
      linkedCrmAccount: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ok: true, threads: rows });
}

type IngestBody = {
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  receivedAt?: string;
  providerMsgId?: string | null;
  linkedCrmAccountId?: string | null;
};

/**
 * POST /api/assistant/email-threads — ingest inbound (pilot: manual JSON or paste flow from UI).
 */
export async function POST(request: Request) {
  const gateP = requirePilot();
  if (gateP) return gateP;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "You need org.orders view to import mail.", code: "FORBIDDEN", status: 403 });
  }
  const g = await requireApiGrant("org.orders", "view");
  if (g) return g;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as IngestBody;
  const fromAddress = typeof o.fromAddress === "string" ? o.fromAddress.trim() : "";
  const toAddress = typeof o.toAddress === "string" ? o.toAddress.trim() : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const bodyText = typeof o.bodyText === "string" ? o.bodyText.trim() : "";
  if (!fromAddress || !toAddress || !subject || !bodyText) {
    return toApiErrorResponse({
      error: "fromAddress, toAddress, subject, and bodyText are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const providerMsgId =
    typeof o.providerMsgId === "string" && o.providerMsgId.trim() ? o.providerMsgId.trim().slice(0, 500) : null;
  let receivedAt = new Date();
  if (typeof o.receivedAt === "string" && o.receivedAt.trim()) {
    const d = new Date(o.receivedAt);
    if (!Number.isNaN(d.getTime())) receivedAt = d;
  }

  let linked: string | null = null;
  if (typeof o.linkedCrmAccountId === "string" && o.linkedCrmAccountId.trim()) {
    const acc = await prisma.crmAccount.findFirst({
      where: { id: o.linkedCrmAccountId.trim(), tenantId: tenant.id },
      select: { id: true },
    });
    if (acc) linked = acc.id;
  }

  const preview = emailPreviewFromBody(bodyText, 500);

  if (providerMsgId) {
    const row = await prisma.assistantEmailThread.upsert({
      where: { tenantId_providerMsgId: { tenantId: tenant.id, providerMsgId } },
      create: {
        tenantId: tenant.id,
        providerMsgId,
        subject,
        fromAddress,
        toAddress,
        preview,
        bodyText,
        receivedAt,
        status: "OPEN",
        linkedCrmAccountId: linked,
      },
      update: {
        subject,
        fromAddress,
        toAddress,
        preview,
        bodyText,
        receivedAt,
        linkedCrmAccountId: linked,
      },
    });
    return NextResponse.json({ ok: true, thread: row });
  }

  const row = await prisma.assistantEmailThread.create({
    data: {
      tenantId: tenant.id,
      providerMsgId: null,
      subject,
      fromAddress,
      toAddress,
      preview,
      bodyText,
      receivedAt,
      status: "OPEN",
      linkedCrmAccountId: linked,
    },
  });
  return NextResponse.json({ ok: true, thread: row });
}

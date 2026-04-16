import type { CrmQuoteStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES: CrmQuoteStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
];

async function loadQuote(tenantId: string, quoteId: string, actorId: string) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmQuote.findFirst({
    where: {
      id: quoteId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
    },
    include: {
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id } = await context.params;
  const quote = await loadQuote(tenant.id, id, actorId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  return NextResponse.json({ quote });
}

type PatchBody = {
  title?: string;
  status?: CrmQuoteStatus;
  validUntil?: string | null;
  notes?: string | null;
  currency?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await loadQuote(tenant.id, id, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  if (!canEditAll && existing.ownerUserId !== actorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.validUntil !== undefined) {
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.currency !== undefined) {
    data.currency = (body.currency?.trim() || "USD").slice(0, 3).toUpperCase();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const quote = await prisma.crmQuote.update({
    where: { id },
    data: data as never,
    include: {
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ quote });
}

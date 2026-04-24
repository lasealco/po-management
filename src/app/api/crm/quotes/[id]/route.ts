import type { CrmQuoteStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
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
  const scope = await getCrmAccessScope(tenantId, actorId);
  return prisma.crmQuote.findFirst({
    where: {
      id: quoteId,
      tenantId,
      ...crmOwnerRelationClause(scope),
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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const quote = await loadQuote(tenant.id, id, actorId);
  if (!quote) {
    return toApiErrorResponse({ error: "Quote not found.", code: "NOT_FOUND", status: 404 });
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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const existing = await loadQuote(tenant.id, id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Quote not found.", code: "NOT_FOUND", status: 404 });
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  if (!canEditAll && existing.ownerUserId !== actorId) {
    return toApiErrorResponse({ error: "Forbidden.", code: "FORBIDDEN", status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return toApiErrorResponse({ error: "Invalid status.", code: "BAD_INPUT", status: 400 });
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
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
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

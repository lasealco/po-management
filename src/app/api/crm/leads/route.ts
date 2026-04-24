import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const scope = await getCrmAccessScope(tenant.id, actorId);
  const where = { tenantId: tenant.id, ...crmOwnerRelationClause(scope) };

  const leads = await prisma.crmLead.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      companyName: true,
      status: true,
      source: true,
      contactEmail: true,
      ownerUserId: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ leads });
}

type PostBody = {
  companyName?: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  serviceInterest?: string | null;
  qualificationNotes?: string | null;
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const companyName = body.companyName?.trim();
  if (!companyName) {
    return toApiErrorResponse({ error: "companyName is required.", code: "BAD_INPUT", status: 400 });
  }

  const lead = await prisma.crmLead.create({
    data: {
      tenantId: tenant.id,
      ownerUserId: actorId,
      companyName,
      contactFirstName: body.contactFirstName?.trim() || null,
      contactLastName: body.contactLastName?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      source: body.source?.trim() || "MANUAL",
      serviceInterest: body.serviceInterest?.trim() || null,
      qualificationNotes: body.qualificationNotes?.trim() || null,
    },
    select: {
      id: true,
      companyName: true,
      status: true,
      source: true,
      ownerUserId: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}

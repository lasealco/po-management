import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  const where =
    "ownerUserId" in scope && scope.ownerUserId
      ? { tenantId: tenant.id, ownerUserId: scope.ownerUserId }
      : { tenantId: tenant.id };

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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const companyName = body.companyName?.trim();
  if (!companyName) {
    return NextResponse.json(
      { error: "companyName is required." },
      { status: 400 },
    );
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

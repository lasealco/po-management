import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const scope = await getCrmAccessScope(tenant.id, actorId);
  const baseWhere = { tenantId: tenant.id, ...crmOwnerRelationClause(scope) };

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const where = q
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { legalName: { contains: q, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const accounts = await prisma.crmAccount.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      legalName: true,
      accountType: true,
      lifecycle: true,
      industry: true,
      strategicFlag: true,
      ownerUserId: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { contacts: true, opportunities: true } },
    },
  });

  return NextResponse.json({ accounts });
}

type PostBody = {
  name?: string;
  legalName?: string | null;
  website?: string | null;
  accountType?: "CUSTOMER" | "PROSPECT" | "PARTNER" | "AGENT" | "OTHER";
  industry?: string | null;
  segment?: string | null;
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

  const name = body.name?.trim();
  if (!name) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }

  const account = await prisma.crmAccount.create({
    data: {
      tenantId: tenant.id,
      ownerUserId: actorId,
      name,
      legalName: body.legalName?.trim() || null,
      website: body.website?.trim() || null,
      accountType: body.accountType ?? "PROSPECT",
      industry: body.industry?.trim() || null,
      segment: body.segment?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      accountType: true,
      lifecycle: true,
      ownerUserId: true,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}

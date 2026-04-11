import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  const baseWhere =
    "ownerUserId" in scope && scope.ownerUserId
      ? { tenantId: tenant.id, ownerUserId: scope.ownerUserId }
      : { tenantId: tenant.id };

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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
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

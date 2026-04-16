import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
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
  const ownerClause =
    "ownerUserId" in scope && scope.ownerUserId
      ? { ownerUserId: scope.ownerUserId }
      : {};

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId")?.trim();
  const q = searchParams.get("q")?.trim();

  const quotes = await prisma.crmQuote.findMany({
    where: {
      tenantId: tenant.id,
      ...ownerClause,
      ...(accountId ? { accountId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { quoteNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      status: true,
      quoteNumber: true,
      validUntil: true,
      currency: true,
      subtotal: true,
      updatedAt: true,
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ quotes });
}

type PostBody = {
  accountId?: string;
  opportunityId?: string | null;
  title?: string;
  validUntil?: string | null;
  notes?: string | null;
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

  const accountId = body.accountId?.trim();
  const title = body.title?.trim();
  if (!accountId || !title) {
    return NextResponse.json(
      { error: "accountId and title are required." },
      { status: 400 },
    );
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  const account = await prisma.crmAccount.findFirst({
    where: {
      id: accountId,
      tenantId: tenant.id,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
    },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const opportunityId: string | null = body.opportunityId?.trim() || null;
  if (opportunityId) {
    const opp = await prisma.crmOpportunity.findFirst({
      where: {
        id: opportunityId,
        tenantId: tenant.id,
        accountId,
        ...(canEditAll ? {} : { ownerUserId: actorId }),
      },
      select: { id: true },
    });
    if (!opp) {
      return NextResponse.json(
        { error: "Opportunity not found on this account." },
        { status: 400 },
      );
    }
  }

  const n = await prisma.crmQuote.count({ where: { tenantId: tenant.id } });
  const quoteNumber = `Q-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;

  const quote = await prisma.crmQuote.create({
    data: {
      tenantId: tenant.id,
      ownerUserId: actorId,
      accountId,
      opportunityId,
      title,
      quoteNumber,
      notes: body.notes?.trim() || null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      status: "DRAFT",
    },
    select: {
      id: true,
      title: true,
      status: true,
      quoteNumber: true,
      accountId: true,
    },
  });

  return NextResponse.json({ quote }, { status: 201 });
}

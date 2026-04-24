import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { crmAccountInScope, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function assertAccountAccess(
  tenantId: string,
  accountId: string,
  actorId: string,
) {
  const scope = await getCrmAccessScope(tenantId, actorId);
  const account = await prisma.crmAccount.findFirst({
    where: {
      id: accountId,
      ...crmAccountInScope(tenantId, scope),
    },
    select: { id: true },
  });
  return Boolean(account);
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId")?.trim();

  if (!accountId) {
    const scope = await getCrmAccessScope(tenant.id, actorId);
    const contactWhere = {
      tenantId: tenant.id,
      account: { is: crmAccountInScope(tenant.id, scope) },
    };

    const contacts = await prisma.crmContact.findMany({
      where: contactWhere,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        department: true,
        decisionRole: true,
        ownerUserId: true,
        updatedAt: true,
        accountId: true,
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ contacts });
  }

  const ok = await assertAccountAccess(tenant.id, accountId, actorId);
  if (!ok) {
    return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
  }

  const contacts = await prisma.crmContact.findMany({
    where: { tenantId: tenant.id, accountId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      title: true,
      department: true,
      decisionRole: true,
      ownerUserId: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ contacts });
}

type PostBody = {
  accountId?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  department?: string | null;
  decisionRole?: string | null;
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

  const accountId = body.accountId?.trim();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  if (!accountId || !firstName || !lastName) {
    return toApiErrorResponse({ error: "accountId, firstName, and lastName are required.", code: "BAD_INPUT", status: 400 });
  }

  const ok = await assertAccountAccess(tenant.id, accountId, actorId);
  if (!ok) {
    return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
  }

  const contact = await prisma.crmContact.create({
    data: {
      tenantId: tenant.id,
      accountId,
      ownerUserId: actorId,
      firstName,
      lastName,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      title: body.title?.trim() || null,
      department: body.department?.trim() || null,
      decisionRole: body.decisionRole?.trim() || null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      accountId: true,
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}

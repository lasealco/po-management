import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ConvertBody = {
  /** When set, attach the lead to this account instead of creating a new one (same owner rules as account access). */
  existingAccountId?: string | null;
};

/** Convert qualified lead → account (+ optional contact + starter opportunity). PRD US-005 baseline. */
export async function POST(
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

  const { id: leadId } = await context.params;

  let body: ConvertBody = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as ConvertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const lead = await prisma.crmLead.findFirst({
    where: { id: leadId, tenantId: tenant.id },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  if (!canEditAll && lead.ownerUserId !== actorId) {
    return NextResponse.json(
      { error: "You can only convert leads you own." },
      { status: 403 },
    );
  }

  if (lead.status === "CONVERTED") {
    return NextResponse.json(
      { error: "Lead is already converted." },
      { status: 400 },
    );
  }

  const existingAccountId = body.existingAccountId?.trim() || null;

  if (existingAccountId) {
    const acc = await prisma.crmAccount.findFirst({
      where: {
        id: existingAccountId,
        tenantId: tenant.id,
        ...(canEditAll ? {} : { ownerUserId: lead.ownerUserId }),
      },
      select: { id: true },
    });
    if (!acc) {
      return NextResponse.json(
        { error: "Account not found or you cannot attach to this account." },
        { status: 404 },
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let account: { id: string; name: string };

    if (existingAccountId) {
      const acc = await tx.crmAccount.findFirstOrThrow({
        where: { id: existingAccountId, tenantId: tenant.id },
        select: { id: true, name: true },
      });
      account = acc;
    } else {
      account = await tx.crmAccount.create({
        data: {
          tenantId: tenant.id,
          ownerUserId: lead.ownerUserId,
          name: lead.companyName,
          accountType: "PROSPECT",
          lifecycle: "ACTIVE",
        },
        select: { id: true, name: true },
      });
    }

    let contact: { id: string; firstName: string; lastName: string } | null =
      null;
    const hasContact =
      (lead.contactFirstName && lead.contactFirstName.trim()) ||
      (lead.contactLastName && lead.contactLastName.trim()) ||
      (lead.contactEmail && lead.contactEmail.trim());

    if (hasContact) {
      const email = lead.contactEmail?.trim() || null;
      if (email) {
        const dup = await tx.crmContact.findFirst({
          where: { accountId: account.id, email },
          select: { id: true },
        });
        if (!dup) {
          contact = await tx.crmContact.create({
            data: {
              tenantId: tenant.id,
              accountId: account.id,
              ownerUserId: lead.ownerUserId,
              firstName: (lead.contactFirstName ?? "").trim() || "—",
              lastName: (lead.contactLastName ?? "").trim() || "—",
              email,
              phone: lead.contactPhone?.trim() || null,
            },
            select: { id: true, firstName: true, lastName: true },
          });
        }
      } else {
        contact = await tx.crmContact.create({
          data: {
            tenantId: tenant.id,
            accountId: account.id,
            ownerUserId: lead.ownerUserId,
            firstName: (lead.contactFirstName ?? "").trim() || "—",
            lastName: (lead.contactLastName ?? "").trim() || "—",
            email: null,
            phone: lead.contactPhone?.trim() || null,
          },
          select: { id: true, firstName: true, lastName: true },
        });
      }
    }

    const opportunity = await tx.crmOpportunity.create({
      data: {
        tenantId: tenant.id,
        accountId: account.id,
        ownerUserId: lead.ownerUserId,
        primaryContactId: contact?.id ?? null,
        name: `${lead.companyName} — New opportunity`,
        stage: "IDENTIFIED",
        probability: 10,
        currency: "USD",
        nextStep: lead.qualificationNotes
          ? `From lead: ${lead.qualificationNotes.slice(0, 500)}`
          : null,
      },
      select: { id: true, name: true },
    });

    await tx.crmLead.update({
      where: { id: lead.id },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedAccountId: account.id,
      },
    });

    return {
      account,
      contact,
      opportunity,
      linkedExistingAccount: Boolean(existingAccountId),
    };
  });

  return NextResponse.json(result, { status: 201 });
}

import type { CrmLeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PATCHABLE_STATUSES: CrmLeadStatus[] = [
  "NEW",
  "WORKING",
  "QUALIFIED",
  "DISQUALIFIED",
];

async function loadLead(tenantId: string, leadId: string, actorId: string) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmLead.findFirst({
    where: {
      id: leadId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
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
  const lead = await loadLead(tenant.id, id, actorId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

type PatchBody = {
  companyName?: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: CrmLeadStatus;
  source?: string | null;
  serviceInterest?: string | null;
  qualificationNotes?: string | null;
  estimatedAnnualSpend?: string | number | null;
  targetStartDate?: string | null;
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
  const existing = await loadLead(tenant.id, id, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
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

  if (existing.status === "CONVERTED") {
    const sent = Object.keys(body).filter(
      (k) => body[k as keyof PatchBody] !== undefined,
    );
    const allowedKeys = new Set(["qualificationNotes", "serviceInterest"]);
    const bad = sent.filter((k) => !allowedKeys.has(k));
    if (bad.length > 0) {
      return NextResponse.json(
        { error: "Converted leads can only update notes and service interest." },
        { status: 400 },
      );
    }
    const convData: Record<string, unknown> = {};
    if (body.qualificationNotes !== undefined) {
      convData.qualificationNotes = body.qualificationNotes?.trim() || null;
    }
    if (body.serviceInterest !== undefined) {
      convData.serviceInterest = body.serviceInterest?.trim() || null;
    }
    if (Object.keys(convData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }
    const leadConverted = await prisma.crmLead.update({
      where: { id },
      data: convData as never,
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ lead: leadConverted });
  }

  if (body.status === "CONVERTED") {
    return NextResponse.json(
      { error: "Use POST /api/crm/leads/:id/convert to convert a lead." },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (body.companyName !== undefined) data.companyName = body.companyName.trim();
  if (body.contactFirstName !== undefined) {
    data.contactFirstName = body.contactFirstName?.trim() || null;
  }
  if (body.contactLastName !== undefined) {
    data.contactLastName = body.contactLastName?.trim() || null;
  }
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.trim() || null;
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.trim() || null;
  if (body.source !== undefined) data.source = body.source?.trim() || "MANUAL";
  if (body.serviceInterest !== undefined) {
    data.serviceInterest = body.serviceInterest?.trim() || null;
  }
  if (body.qualificationNotes !== undefined) {
    data.qualificationNotes = body.qualificationNotes?.trim() || null;
  }
  if (body.status !== undefined) {
    if (!PATCHABLE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.estimatedAnnualSpend !== undefined) {
    data.estimatedAnnualSpend =
      body.estimatedAnnualSpend === null || body.estimatedAnnualSpend === ""
        ? null
        : String(body.estimatedAnnualSpend);
  }
  if (body.targetStartDate !== undefined) {
    data.targetStartDate = body.targetStartDate
      ? new Date(body.targetStartDate)
      : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const lead = await prisma.crmLead.update({
    where: { id },
    data: data as never,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ lead });
}

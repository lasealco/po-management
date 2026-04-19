import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { getTariffContractHeaderForTenant, updateTariffContractHeader } from "@/lib/tariff/contract-headers";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id } = await context.params;
  try {
    const contract = await getTariffContractHeaderForTenant({ tenantId: tenant.id, id });
    return NextResponse.json({ contract });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const { id } = await context.params;

  const before = await prisma.tariffContractHeader.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      title: true,
      status: true,
      contractNumber: true,
      transportMode: true,
      providerId: true,
      legalEntityId: true,
    },
  });
  if (!before) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  try {
    const updated = await updateTariffContractHeader(
      { tenantId: tenant.id, id },
      {
        ...(typeof o.legalEntityId === "string" || o.legalEntityId === null
          ? { legalEntityId: typeof o.legalEntityId === "string" ? o.legalEntityId.trim() || null : null }
          : {}),
        ...(typeof o.providerId === "string" ? { providerId: o.providerId.trim() } : {}),
        ...(typeof o.transportMode === "string" ? { transportMode: o.transportMode.trim() as never } : {}),
        ...(typeof o.contractNumber === "string" || o.contractNumber === null
          ? { contractNumber: typeof o.contractNumber === "string" ? o.contractNumber.trim() || null : null }
          : {}),
        ...(typeof o.title === "string" ? { title: o.title.trim() } : {}),
        ...(typeof o.tradeScope === "string" || o.tradeScope === null
          ? { tradeScope: typeof o.tradeScope === "string" ? o.tradeScope.trim() || null : null }
          : {}),
        ...(typeof o.status === "string" ? { status: o.status.trim() as never } : {}),
        ...(typeof o.ownerUserId === "string" || o.ownerUserId === null
          ? { ownerUserId: typeof o.ownerUserId === "string" ? o.ownerUserId.trim() || null : null }
          : {}),
        ...(typeof o.notes === "string" || o.notes === null
          ? { notes: typeof o.notes === "string" ? o.notes.trim() || null : null }
          : {}),
      },
    );
    await recordTariffAuditLog({
      objectType: "contract_header",
      objectId: id,
      action: "update",
      userId: actorId,
      oldValue: before,
      newValue: {
        title: updated.title,
        status: updated.status,
        contractNumber: updated.contractNumber,
        transportMode: updated.transportMode,
        providerId: updated.providerId,
        legalEntityId: updated.legalEntityId,
      },
    });
    return NextResponse.json({ contract: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

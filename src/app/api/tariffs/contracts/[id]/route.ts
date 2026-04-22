import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { getTariffContractHeaderForTenant, updateTariffContractHeader } from "@/lib/tariff/contract-headers";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import {
  TARIFF_CONTRACT_HEADER_STATUS_SET,
  TARIFF_TRANSPORT_MODE_SET,
} from "@/lib/tariff/tariff-enum-sets";
import { prisma } from "@/lib/prisma";

import type { TariffContractStatus, TariffTransportMode } from "@prisma/client";

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

  if (typeof o.transportMode === "string") {
    const tm = o.transportMode.trim();
    if (!TARIFF_TRANSPORT_MODE_SET.has(tm)) {
      return NextResponse.json({ error: "Invalid transportMode." }, { status: 400 });
    }
  }
  if (typeof o.status === "string") {
    const st = o.status.trim();
    if (!TARIFF_CONTRACT_HEADER_STATUS_SET.has(st)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
  }

  const patch: Parameters<typeof updateTariffContractHeader>[1] = {};
  if (typeof o.legalEntityId === "string" || o.legalEntityId === null) {
    patch.legalEntityId = typeof o.legalEntityId === "string" ? o.legalEntityId.trim() || null : null;
  }
  if (typeof o.providerId === "string") patch.providerId = o.providerId.trim();
  if (typeof o.transportMode === "string") {
    patch.transportMode = o.transportMode.trim() as TariffTransportMode;
  }
  if (typeof o.contractNumber === "string" || o.contractNumber === null) {
    patch.contractNumber = typeof o.contractNumber === "string" ? o.contractNumber.trim() || null : null;
  }
  if (typeof o.title === "string") {
    const t = o.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty." }, { status: 400 });
    patch.title = t;
  }
  if (typeof o.tradeScope === "string" || o.tradeScope === null) {
    patch.tradeScope = typeof o.tradeScope === "string" ? o.tradeScope.trim() || null : null;
  }
  if (typeof o.status === "string") {
    patch.status = o.status.trim() as TariffContractStatus;
  }
  if (typeof o.ownerUserId === "string" || o.ownerUserId === null) {
    patch.ownerUserId = typeof o.ownerUserId === "string" ? o.ownerUserId.trim() || null : null;
  }
  if (typeof o.notes === "string" || o.notes === null) {
    patch.notes = typeof o.notes === "string" ? o.notes.trim() || null : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const updated = await updateTariffContractHeader({ tenantId: tenant.id, id }, patch);
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

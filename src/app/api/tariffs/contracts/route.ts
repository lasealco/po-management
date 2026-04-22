import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffContractHeader, listTariffContractHeadersForTenant } from "@/lib/tariff/contract-headers";
import { getDemoTenant } from "@/lib/demo-tenant";
import type { TariffTransportMode } from "@prisma/client";

import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { TARIFF_TRANSPORT_MODE_SET } from "@/lib/tariff/tariff-enum-sets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  let take = 200;
  try {
    const raw = new URL(request.url).searchParams.get("take");
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json({ error: "Query take must be a positive integer." }, { status: 400 });
      }
      take = Math.min(n, 300);
    }
  } catch {
    /* default take */
  }
  const providerId = new URL(request.url).searchParams.get("providerId")?.trim() || undefined;

  const rows = await listTariffContractHeadersForTenant({
    tenantId: tenant.id,
    take,
    ...(providerId ? { providerId } : {}),
  });
  return NextResponse.json({ contracts: rows });
}

export async function POST(request: Request) {
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
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const providerId = typeof o.providerId === "string" ? o.providerId.trim() : "";
  const transportMode = typeof o.transportMode === "string" ? o.transportMode.trim() : "";
  if (!title || !providerId || !transportMode) {
    return NextResponse.json(
      { error: "title, providerId, and transportMode are required." },
      { status: 400 },
    );
  }
  if (!TARIFF_TRANSPORT_MODE_SET.has(transportMode)) {
    return NextResponse.json({ error: "Invalid transportMode." }, { status: 400 });
  }

  try {
    const created = await createTariffContractHeader({
      tenantId: tenant.id,
      legalEntityId: typeof o.legalEntityId === "string" ? o.legalEntityId.trim() || null : null,
      providerId,
      transportMode: transportMode as TariffTransportMode,
      contractNumber: typeof o.contractNumber === "string" ? o.contractNumber.trim() || null : null,
      title,
      tradeScope: typeof o.tradeScope === "string" ? o.tradeScope.trim() || null : null,
      ownerUserId: typeof o.ownerUserId === "string" ? o.ownerUserId.trim() || null : actorId,
      notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    });
    await recordTariffAuditLog({
      objectType: "contract_header",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: { title: created.title, providerId: created.providerId, transportMode: created.transportMode },
    });
    return NextResponse.json({ contract: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

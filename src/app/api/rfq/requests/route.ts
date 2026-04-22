import type { TariffTransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { createQuoteRequest, listQuoteRequestsForTenant } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";
import { TARIFF_TRANSPORT_MODE_SET } from "@/lib/tariff/tariff-enum-sets";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.rfq", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const requests = await listQuoteRequestsForTenant({ tenantId: tenant.id, take: 200 });
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const originLabel = typeof o.originLabel === "string" ? o.originLabel.trim() : "";
  const destinationLabel = typeof o.destinationLabel === "string" ? o.destinationLabel.trim() : "";
  if (!title || !originLabel || !destinationLabel) {
    return toApiErrorResponse({
      error: "title, originLabel, and destinationLabel are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const transportModeRaw = typeof o.transportMode === "string" ? o.transportMode.trim().toUpperCase() : "OCEAN";
  if (!TARIFF_TRANSPORT_MODE_SET.has(transportModeRaw)) {
    return toApiErrorResponse({ error: "Invalid transportMode.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const created = await createQuoteRequest({
      tenantId: tenant.id,
      title,
      description: typeof o.description === "string" ? o.description.trim() || null : null,
      transportMode: transportModeRaw as TariffTransportMode,
      originLabel,
      destinationLabel,
      equipmentSummary: typeof o.equipmentSummary === "string" ? o.equipmentSummary.trim() || null : null,
      cargoDescription: typeof o.cargoDescription === "string" ? o.cargoDescription.trim() || null : null,
      quotesDueAt:
        typeof o.quotesDueAt === "string" && o.quotesDueAt.trim()
          ? new Date(o.quotesDueAt)
          : o.quotesDueAt === null
            ? null
            : undefined,
      ownerUserId: actorId,
    });
    return NextResponse.json({ request: created });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}

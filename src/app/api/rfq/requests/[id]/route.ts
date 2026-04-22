import type { QuoteRequestStatus, TariffTransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getQuoteRequestDetail, updateQuoteRequest } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";
import { TARIFF_TRANSPORT_MODE_SET } from "@/lib/tariff/tariff-enum-sets";

export const dynamic = "force-dynamic";

const STATUS = new Set<string>(["DRAFT", "OPEN", "CLOSED", "AWARDED", "CANCELLED"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.rfq", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await context.params;
  try {
    const request = await getQuoteRequestDetail({ tenantId: tenant.id, quoteRequestId: id });
    return NextResponse.json({ request });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.rfq", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateQuoteRequest>[2] = {};
  if (typeof o.title === "string") patch.title = o.title;
  if (o.description !== undefined) patch.description = typeof o.description === "string" ? o.description : null;
  if (typeof o.status === "string") {
    const s = o.status.trim();
    if (!STATUS.has(s)) {
      return toApiErrorResponse({ error: "Invalid status.", code: "BAD_INPUT", status: 400 });
    }
    patch.status = s as QuoteRequestStatus;
  }
  if (typeof o.transportMode === "string") {
    const t = o.transportMode.trim().toUpperCase();
    if (!TARIFF_TRANSPORT_MODE_SET.has(t)) {
      return toApiErrorResponse({ error: "Invalid transportMode.", code: "BAD_INPUT", status: 400 });
    }
    patch.transportMode = t as TariffTransportMode;
  }
  if (typeof o.originLabel === "string") patch.originLabel = o.originLabel;
  if (typeof o.destinationLabel === "string") patch.destinationLabel = o.destinationLabel;
  if (o.equipmentSummary !== undefined) {
    patch.equipmentSummary = typeof o.equipmentSummary === "string" ? o.equipmentSummary.trim() || null : null;
  }
  if (o.cargoDescription !== undefined) {
    patch.cargoDescription = typeof o.cargoDescription === "string" ? o.cargoDescription.trim() || null : null;
  }
  if (o.quotesDueAt !== undefined) {
    patch.quotesDueAt =
      typeof o.quotesDueAt === "string" && o.quotesDueAt.trim()
        ? new Date(o.quotesDueAt)
        : o.quotesDueAt === null
          ? null
          : undefined;
  }

  if (Object.keys(patch).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const updated = await updateQuoteRequest(tenant.id, id, patch);
    return NextResponse.json({ request: updated });
  } catch (e) {
    const j = jsonFromRfqError(e);
    if (j) return j;
    throw e;
  }
}

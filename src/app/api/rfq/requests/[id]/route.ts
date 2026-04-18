import type { QuoteRequestStatus, TariffTransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getQuoteRequestDetail, updateQuoteRequest } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromRfqError } from "@/app/api/rfq/_lib/rfq-api-error";

export const dynamic = "force-dynamic";

const STATUS = new Set<string>(["DRAFT", "OPEN", "CLOSED", "AWARDED", "CANCELLED"]);
const TRANSPORT = new Set<string>(["OCEAN", "LCL", "AIR", "TRUCK", "RAIL", "LOCAL_SERVICE"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.rfq", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

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
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateQuoteRequest>[2] = {};
  if (typeof o.title === "string") patch.title = o.title;
  if (o.description !== undefined) patch.description = typeof o.description === "string" ? o.description : null;
  if (typeof o.status === "string") {
    const s = o.status.trim();
    if (!STATUS.has(s)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = s as QuoteRequestStatus;
  }
  if (typeof o.transportMode === "string") {
    const t = o.transportMode.trim();
    if (!TRANSPORT.has(t)) return NextResponse.json({ error: "Invalid transportMode." }, { status: 400 });
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
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
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

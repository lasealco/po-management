import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildOperationsAnswer } from "@/lib/assistant/build-operations-answer";
import { extractProductQueryHint, isOperationsQuestion } from "@/lib/assistant/operations-intent";
import { findProductCandidates } from "@/lib/assistant/operations-product-search";
import { getActorUserId, getViewerGrantSet, requireApiGrant, userHasGlobalGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/assistant/answer-operations
 * Body: { text, resolvedProductId? }
 * Resolves stock / in-transit / PO evidence for a product; returns { kind: "defer" } when the message
 * is not an operations question (caller should use sales-order intent).
 */
export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "You need org.orders view for product and trace in the assistant.", code: "FORBIDDEN", status: 403 });
  }
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected an object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const resolvedProductId = typeof o.resolvedProductId === "string" ? o.resolvedProductId.trim() : "";

  if (!text) {
    return toApiErrorResponse({ error: "text is required.", code: "BAD_INPUT", status: 400 });
  }

  if (!isOperationsQuestion(text) && !resolvedProductId) {
    return NextResponse.json({ kind: "defer" as const });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const canWms = await userHasGlobalGrant(actorId, "org.wms", "view");

  let productId = resolvedProductId;
  if (!productId) {
    const hint = extractProductQueryHint(text);
    if (!hint) {
      return NextResponse.json({
        kind: "no_hint" as const,
        message: "Name a product, SKU, or product code to check stock or trace (e.g. “How much corr-roll is in the demo warehouse?”).",
      });
    }
    const candidates = await findProductCandidates(tenant.id, hint);
    if (candidates.length === 0) {
      return NextResponse.json({
        kind: "not_found" as const,
        message: `No product matched “${hint}” in the catalog. Try a SKU, product code, or words from the product name.`,
        hint,
      });
    }
    if (candidates.length > 1) {
      return NextResponse.json({
        kind: "clarify" as const,
        message: "Which product do you mean?",
        options: candidates,
      });
    }
    productId = candidates[0]!.id;
  }

  const product =
    (await prisma.product.findFirst({
      where: { id: productId, tenantId: tenant.id },
      select: { id: true, name: true, productCode: true, sku: true },
    })) ?? null;
  if (!product) {
    return NextResponse.json({
      kind: "not_found" as const,
      message: "That product is not in this tenant (or you don’t have access).",
      hint: productId,
    });
  }

  const out = await buildOperationsAnswer({
    tenantId: tenant.id,
    actorUserId: actorId,
    product,
    canWms,
  });
  if (out.kind === "not_found") {
    return NextResponse.json({ kind: "not_found" as const, message: out.message, hint: out.hint });
  }

  return NextResponse.json({
    kind: "answer" as const,
    message: out.message,
    evidence: out.evidence,
  });
}

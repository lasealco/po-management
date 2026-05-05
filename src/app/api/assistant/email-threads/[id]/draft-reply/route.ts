import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildOperationsAnswer } from "@/lib/assistant/build-operations-answer";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { extractProductQueryHint, isOperationsQuestion } from "@/lib/assistant/operations-intent";
import { findProductCandidates } from "@/lib/assistant/operations-product-search";
import {
  parseSalesOrderIntent,
  type AccountCandidate,
  type ProductCandidate,
} from "@/lib/assistant/sales-order-intent";
import { getActorUserId, getViewerGrantSet, requireApiGrant, userHasGlobalGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function greeting(fromAddress: string) {
  const local = fromAddress.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  const name = local ? local.split(/\s+/)[0] : "";
  return name ? `Hi ${name[0]?.toUpperCase()}${name.slice(1)},` : "Hi,";
}

function signature() {
  return ["", "Best,", "NEOLINK Team"].join("\n");
}

function evidenceLine(evidence: Array<{ label: string; href: string }>) {
  if (evidence.length === 0) return "";
  return ["", "Evidence:", ...evidence.slice(0, 4).map((e) => `- ${e.label}: ${e.href}`)].join("\n");
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAssistantEmailPilotEnabled()) {
    return toApiErrorResponse({ error: "Assistant email pilot is disabled.", code: "FEATURE_DISABLED", status: 404 });
  }

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const { id } = await context.params;

  const thread = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
    include: { linkedCrmAccount: { select: { id: true, name: true } } },
  });
  if (!thread) {
    return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });
  }

  const raw = `${thread.subject}\n\n${thread.bodyText}`.slice(0, 8_000);
  let draft: string;
  let source: "operations" | "sales_order" | "fallback" = "fallback";

  const operationsQuestion = isOperationsQuestion(raw);
  const hint = extractProductQueryHint(raw);
  if (operationsQuestion || hint) {
    const candidates = hint ? await findProductCandidates(tenant.id, hint) : [];
    if (candidates.length === 1) {
      const canWms = await userHasGlobalGrant(actorId, "org.wms", "view");
      const answer = await buildOperationsAnswer({
        tenantId: tenant.id,
        actorUserId: actorId,
        product: candidates[0]!,
        canWms,
      });
      if (answer.kind === "answer") {
        source = "operations";
        draft = [
          greeting(thread.fromAddress),
          "",
          "Thanks for reaching out. Here is what I found:",
          "",
          answer.message,
          evidenceLine(answer.evidence),
          "",
          "Please confirm if you want us to reserve stock or prepare a formal sales order.",
          signature(),
        ].join("\n");
      } else {
        draft = "";
      }
    } else if (candidates.length > 1) {
      draft = [
        greeting(thread.fromAddress),
        "",
        "Thanks for reaching out. Before I answer, could you confirm which product you mean?",
        "",
        ...candidates.slice(0, 6).map((p) => `- ${p.name}${p.sku ? ` (${p.sku})` : ""}`),
        signature(),
      ].join("\n");
    } else {
      draft = "";
    }
  } else {
    draft = "";
  }

  if (!draft) {
    const [crmRows, productRows, warehouses, orgUnits] = await Promise.all([
      prisma.crmAccount.findMany({
        where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, legalName: true },
      }),
      prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: [{ productCode: "asc" }, { name: "asc" }],
        take: 500,
        select: { id: true, name: true, productCode: true },
      }),
      prisma.warehouse.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.orgUnit.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true },
      }),
    ]);

    const accounts: AccountCandidate[] = crmRows;
    const products: ProductCandidate[] = productRows;
    const result = parseSalesOrderIntent(raw, { accounts, products, warehouses, orgUnits }, {
      accountId: thread.linkedCrmAccountId,
      productId: null,
    });

    if (result.kind === "ready") {
      source = "sales_order";
      draft = [
        greeting(thread.fromAddress),
        "",
        "Thanks for the request. I can prepare this as a draft sales order for your confirmation:",
        "",
        `Customer: ${result.summary.accountName}`,
        `Product: ${result.summary.productName}`,
        `Quantity: ${result.summary.quantity ?? "please confirm"}`,
        `Unit price: ${
          result.summary.unitPrice != null ? `${result.summary.unitPrice} USD` : "please confirm"
        }`,
        `Requested date: ${result.summary.requestedDate ?? "please confirm"}`,
        result.summary.warehouseLabel ? `Pickup / warehouse: ${result.summary.warehouseLabel}` : null,
        "",
        "Please confirm these details and we will proceed with the draft order.",
        signature(),
      ]
        .filter((line): line is string => line != null)
        .join("\n");
    } else if (result.kind === "clarify_account") {
      draft = [
        greeting(thread.fromAddress),
        "",
        "Thanks for the request. Could you confirm which customer account this should be linked to?",
        "",
        ...result.options.slice(0, 6).map((a) => `- ${a.name}${a.legalName ? ` (${a.legalName})` : ""}`),
        signature(),
      ].join("\n");
    } else if (result.kind === "clarify_product") {
      draft = [
        greeting(thread.fromAddress),
        "",
        "Thanks for the request. Could you confirm which product you mean?",
        "",
        ...result.options.slice(0, 6).map((p) => `- ${p.name}${p.productCode ? ` (${p.productCode})` : ""}`),
        signature(),
      ].join("\n");
    } else {
      draft = [
        greeting(thread.fromAddress),
        "",
        "Thanks for your message. We are reviewing the request and will come back with availability, pricing, or the next step shortly.",
        "",
        "If this is for an order, please confirm the customer account, product/SKU, quantity, target date, and delivery or pickup details.",
        signature(),
      ].join("\n");
    }
  }

  const updated = await prisma.assistantEmailThread.update({
    where: { id: thread.id },
    data: { draftReply: draft },
  });

  return NextResponse.json({ ok: true, source, draftReply: draft, thread: updated });
}

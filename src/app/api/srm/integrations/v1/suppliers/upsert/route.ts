import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  getActorUserId,
  loadGlobalGrantsForUser,
  requireApiGrant,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  checkSrmIdempotency,
  parseSrmIdempotencyKeyHeader,
  srmBodySha256,
  SRM_INTEGRATION_UPSURF_SUPPLIER_V1,
  storeSrmIdempotency,
} from "@/lib/srm/srm-integration-idempotency";
import { parseSrmSupplierUpsertV1Body, runSrmSupplierUpsertV1 } from "@/lib/srm/srm-supplier-upsert-v1";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const grantSet = await loadGlobalGrantsForUser(actorId);
  const canApprove = viewerHas(grantSet, "org.suppliers", "approve");

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const idemHeader = parseSrmIdempotencyKeyHeader(request);
  if (!idemHeader.ok) {
    return toApiErrorResponse({ error: idemHeader.error, code: "BAD_INPUT", status: 400 });
  }

  const rawText = await request.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return toApiErrorResponse({ error: "Request body too large.", code: "BAD_INPUT", status: 400 });
  }

  let body: unknown;
  try {
    body = rawText.length ? JSON.parse(rawText) : null;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = parseSrmSupplierUpsertV1Body(body);
  if (!parsed.ok) return parsed.response;

  const bodyHash = srmBodySha256(body);

  if (idemHeader.key) {
    const idem = await checkSrmIdempotency(prisma, {
      tenantId: tenant.id,
      surface: SRM_INTEGRATION_UPSURF_SUPPLIER_V1,
      idempotencyKey: idemHeader.key,
      bodyHash,
    });
    if (idem.type === "conflict") {
      return toApiErrorResponse({
        error: "Idempotency-Key was already used with a different request body.",
        code: "IDEMPOTENCY_CONFLICT",
        status: 409,
      });
    }
    if (idem.type === "replay") {
      return new NextResponse(idem.bodyText, {
        status: idem.statusCode,
        headers: { "Content-Type": "application/json", "X-Idempotent-Replay": "true" },
      });
    }
  }

  const res = await runSrmSupplierUpsertV1(prisma, {
    tenantId: tenant.id,
    body: parsed.value,
    canApprove,
  });

  if (idemHeader.key && res.status >= 200 && res.status < 300) {
    const text = await res.clone().text();
    await storeSrmIdempotency(prisma, {
      tenantId: tenant.id,
      surface: SRM_INTEGRATION_UPSURF_SUPPLIER_V1,
      idempotencyKey: idemHeader.key,
      bodyHash,
      statusCode: res.status,
      responseBody: text,
    });
  }

  return res;
}

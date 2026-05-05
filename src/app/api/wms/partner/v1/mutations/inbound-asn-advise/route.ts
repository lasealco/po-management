import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { prisma } from "@/lib/prisma";
import { authenticatePartnerApiRequest, partnerHasScope } from "@/lib/wms/partner-api-auth";
import {
  inboundAsnAdviseLinesToPrismaJson,
  parseInboundAsnAdviseLines,
} from "@/lib/wms/inbound-asn-advise";
import { upsertInboundAsnAdviseRow } from "@/lib/wms/inbound-asn-advise-upsert";
import { resolvePartnerMutationActorUserIdBf98 } from "@/lib/wms/partner-mutation-actor-bf98";
import { partnerV1Json } from "@/lib/wms/partner-v1-response";

export const dynamic = "force-dynamic";

type PostBody = {
  externalAsnId?: string;
  asnPartnerId?: string | null;
  warehouseId?: string | null;
  purchaseOrderId?: string | null;
  shipmentId?: string | null;
  asnReference?: string | null;
  expectedReceiveAt?: string | null;
  lines?: unknown;
  rawPayload?: unknown;
};

export async function POST(request: Request) {
  const auth = await authenticatePartnerApiRequest(request);
  if (!auth) {
    return toApiErrorResponse({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 });
  }
  if (!partnerHasScope(auth, "INBOUND_ASN_ADVISE_WRITE")) {
    return toApiErrorResponse({
      error: "Missing INBOUND_ASN_ADVISE_WRITE scope.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const externalAsnId = body.externalAsnId?.trim() ?? "";
  if (!externalAsnId) {
    return partnerV1Json(
      {
        schemaVersion: "bf98.v1",
        tenantSlug: auth.tenantSlug,
        ok: false,
        error: "externalAsnId is required.",
        code: "VALIDATION_ERROR",
      },
      400,
    );
  }
  if (externalAsnId.length > 256) {
    return partnerV1Json(
      {
        schemaVersion: "bf98.v1",
        tenantSlug: auth.tenantSlug,
        ok: false,
        error: "externalAsnId must be at most 256 characters.",
        code: "VALIDATION_ERROR",
      },
      400,
    );
  }

  const parsed = parseInboundAsnAdviseLines(body.lines);
  if (!parsed.ok) {
    return partnerV1Json(
      {
        schemaVersion: "bf98.v1",
        tenantSlug: auth.tenantSlug,
        ok: false,
        error: parsed.error,
        code: "VALIDATION_ERROR",
      },
      400,
    );
  }

  const linesJson = inboundAsnAdviseLinesToPrismaJson(parsed.lines);
  let rawPayloadJson: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
  if (body.rawPayload !== undefined) {
    rawPayloadJson =
      body.rawPayload === null ? Prisma.JsonNull : (body.rawPayload as Prisma.InputJsonValue);
  }

  const asnReference = body.asnReference?.trim().slice(0, 256) || null;

  let expectedReceiveAt: Date | null = null;
  if (body.expectedReceiveAt?.trim()) {
    const d = new Date(body.expectedReceiveAt.trim());
    if (!Number.isFinite(d.getTime())) {
      return partnerV1Json(
        {
          schemaVersion: "bf98.v1",
          tenantSlug: auth.tenantSlug,
          ok: false,
          error: "expectedReceiveAt must be a valid ISO datetime when provided.",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }
    expectedReceiveAt = d;
  }

  const warehouseId = body.warehouseId?.trim() || null;
  const purchaseOrderId = body.purchaseOrderId?.trim() || null;
  const shipmentId = body.shipmentId?.trim() || null;

  let asnPartnerPatch: string | null | undefined = undefined;
  if ("asnPartnerId" in body) {
    asnPartnerPatch = body.asnPartnerId?.trim() || null;
  }

  const actorId = await resolvePartnerMutationActorUserIdBf98(prisma, auth.tenantId);
  if (!actorId) {
    return partnerV1Json(
      {
        schemaVersion: "bf98.v1",
        tenantSlug: auth.tenantSlug,
        ok: false,
        error: "No active tenant user available as partner mutation actor surrogate.",
        code: "SERVICE_UNAVAILABLE",
      },
      503,
    );
  }

  const up = await upsertInboundAsnAdviseRow(prisma, {
    tenantId: auth.tenantId,
    actorId,
    externalAsnId,
    linesJson,
    ...(asnPartnerPatch !== undefined ? { asnPartnerId: asnPartnerPatch } : {}),
    asnReference,
    expectedReceiveAt,
    warehouseId,
    purchaseOrderId,
    shipmentId,
    ...(rawPayloadJson !== undefined ? { rawPayloadJson } : {}),
  });

  if (!up.ok) {
    return partnerV1Json(
      {
        schemaVersion: "bf98.v1",
        tenantSlug: auth.tenantSlug,
        ok: false,
        error: up.err.error,
        code: up.err.code,
      },
      up.err.status,
    );
  }

  await prisma.ctAuditLog.create({
    data: {
      tenantId: auth.tenantId,
      entityType: "WMS_INBOUND_ASN_ADVISE",
      entityId: up.row.id,
      action: "bf98_partner_inbound_asn_advise_upsert",
      payload: {
        partnerApiKeyId: auth.keyId,
        externalAsnId: up.row.externalAsnId,
        updated: up.updated,
      },
      actorUserId: actorId,
    },
  });

  return partnerV1Json({
    schemaVersion: "bf98.v1",
    tenantSlug: auth.tenantSlug,
    ok: true,
    id: up.row.id,
    externalAsnId: up.row.externalAsnId,
    updated: up.updated,
  });
}

import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toScriEventDetailDto } from "@/lib/scri/event-dto";
import { getScriEventForTenant } from "@/lib/scri/event-repo";
import {
  zodValidationApiExtra,
  zodValidationSummary,
} from "@/lib/scri/ingest-validation";
import { scriRecommendationStatusPatchSchema } from "@/lib/scri/schemas/recommendation-status-patch";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.scri", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = scriRecommendationStatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: zodValidationSummary(parsed.error),
      code: "BAD_INPUT",
      status: 400,
      extra: zodValidationApiExtra(parsed.error),
    });
  }

  const { id } = await ctx.params;
  const note =
    parsed.data.statusNote != null && parsed.data.statusNote.trim().length > 0
      ? parsed.data.statusNote.trim()
      : null;

  const updated = await prisma.scriEventRecommendation.updateMany({
    where: { id, tenantId: tenant.id },
    data: {
      status: parsed.data.status,
      statusNote: note,
    },
  });

  if (updated.count === 0) {
    return toApiErrorResponse({ error: "Recommendation not found.", code: "NOT_FOUND", status: 404 });
  }

  const row = await prisma.scriEventRecommendation.findFirst({
    where: { id, tenantId: tenant.id },
    select: { eventId: true },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Recommendation not found.", code: "NOT_FOUND", status: 404 });
  }

  const eventRow = await getScriEventForTenant(tenant.id, row.eventId);
  if (!eventRow) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({ ok: true, event: toScriEventDetailDto(eventRow) });
}

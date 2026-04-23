import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  zodValidationApiExtra,
  zodValidationSummary,
} from "@/lib/scri/ingest-validation";
import { scriTuningPatchSchema } from "@/lib/scri/schemas/tuning-patch";
import {
  getScriTuningForTenant,
  tuningRowToDto,
  upsertScriTuningForTenant,
} from "@/lib/scri/tuning-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.scri", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { row, dto } = await getScriTuningForTenant(tenant.id);
  return NextResponse.json({ tuning: dto, persisted: Boolean(row) });
}

export async function PATCH(request: Request) {
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

  const parsed = scriTuningPatchSchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: zodValidationSummary(parsed.error),
      code: "BAD_INPUT",
      status: 400,
      extra: zodValidationApiExtra(parsed.error),
    });
  }

  const actorId = parsed.data.automationActorUserId;
  if (actorId) {
    const u = await prisma.user.findFirst({
      where: { id: actorId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!u) {
      return toApiErrorResponse({
        error: "automationActorUserId must be an active user in this tenant.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
  }

  const row = await upsertScriTuningForTenant(tenant.id, parsed.data);
  return NextResponse.json({ ok: true, tuning: tuningRowToDto(row) });
}

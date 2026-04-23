import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { applyScriEventTaskLink } from "@/lib/scri/apply-task-link";
import { toScriEventDetailDto } from "@/lib/scri/event-dto";
import { getScriEventForTenant } from "@/lib/scri/event-repo";
import {
  zodValidationApiExtra,
  zodValidationSummary,
} from "@/lib/scri/ingest-validation";
import { scriTaskLinkBodySchema } from "@/lib/scri/schemas/task-link-body";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.scri", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({
      error: "No active demo user for this session.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = scriTaskLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: zodValidationSummary(parsed.error),
      code: "BAD_INPUT",
      status: 400,
      extra: zodValidationApiExtra(parsed.error),
    });
  }

  const { id } = await ctx.params;
  const result = await applyScriEventTaskLink(tenant.id, id, actorUserId, parsed.data);
  if (!result.ok) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  const row = await getScriEventForTenant(tenant.id, id);
  if (!row) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({
    ok: true,
    taskLinkId: result.id,
    event: toScriEventDetailDto(row),
  });
}

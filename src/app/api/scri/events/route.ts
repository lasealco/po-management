import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { applyScriIngest } from "@/lib/scri/apply-ingest";
import { toScriEventListItemDto } from "@/lib/scri/event-dto";
import { listScriEventsForTenant } from "@/lib/scri/event-repo";
import { scriIngestBodySchema } from "@/lib/scri/schemas/ingest-body";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.scri", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const url = new URL(request.url);
  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : 50;
  const rows = await listScriEventsForTenant(tenant.id, Number.isFinite(take) ? take : 50);

  return NextResponse.json({
    events: rows.map(toScriEventListItemDto),
  });
}

export async function POST(request: Request) {
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

  const parsed = scriIngestBodySchema.safeParse(body);
  if (!parsed.success) {
    return toApiErrorResponse({
      error: parsed.error.flatten().formErrors.join("; ") || "Validation failed.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  try {
    const id = await applyScriIngest(tenant.id, parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return toApiErrorResponse({
      error: "Ingest failed.",
      code: "INTERNAL",
      status: 500,
    });
  }
}

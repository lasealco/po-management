import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { retryApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  idempotencyKey?: unknown;
};

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Demo tenant not found. Run `npm run db:seed` to create starter data." },
      { status: 404 },
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const { jobId } = await context.params;
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const rawBodyIdempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeaderIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  const idempotencyKey = (rawHeaderIdempotencyKey || rawBodyIdempotencyKey)?.slice(0, 128) ?? null;

  try {
    const retried = await retryApiHubIngestionRun({
      tenantId: tenant.id,
      actorUserId: actorId,
      runId: jobId,
      idempotencyKey,
    });
    if (!retried) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
    return NextResponse.json({ run: toApiHubIngestionRunDto(retried) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "retry_requires_failed_status") {
      return NextResponse.json({ error: "Only failed runs can be retried." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "retry_limit_reached") {
      return NextResponse.json({ error: "Run has reached its max retry attempts." }, { status: 409 });
    }
    throw error;
  }
}

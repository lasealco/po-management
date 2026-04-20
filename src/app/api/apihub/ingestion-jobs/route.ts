import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { createApiHubIngestionRun, listApiHubIngestionRuns } from "@/lib/apihub/ingestion-runs-repo";
import { isValidRunStatus } from "@/lib/apihub/run-lifecycle";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  connectorId?: unknown;
  idempotencyKey?: unknown;
};

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const rawStatus = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  if (rawStatus.length > 0 && !isValidRunStatus(rawStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${APIHUB_INGESTION_JOB_STATUSES.join(", ")}.` },
      { status: 400 },
    );
  }

  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 20;
  const rows = await listApiHubIngestionRuns({
    tenantId: tenant.id,
    status: rawStatus.length > 0 ? rawStatus : null,
    limit,
  });
  return NextResponse.json({ runs: rows.map(toApiHubIngestionRunDto) });
}

export async function POST(request: Request) {
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

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const connectorId =
    typeof body.connectorId === "string" && body.connectorId.trim().length > 0 ? body.connectorId.trim() : null;
  const rawBodyIdempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeaderIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  const idempotencyKey = (rawHeaderIdempotencyKey || rawBodyIdempotencyKey)?.slice(0, 128) ?? null;

  try {
    const created = await createApiHubIngestionRun({
      tenantId: tenant.id,
      actorUserId: actorId,
      connectorId,
      idempotencyKey,
    });
    return NextResponse.json(
      { run: toApiHubIngestionRunDto(created.run), idempotentReplay: created.idempotentReplay },
      { status: created.idempotentReplay ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "connector_not_found") {
      return NextResponse.json({ error: "Connector not found for tenant." }, { status: 404 });
    }
    throw error;
  }
}

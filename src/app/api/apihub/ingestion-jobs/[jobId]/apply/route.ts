import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { apiHubError } from "@/lib/apihub/api-error";
import { applyApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  note?: unknown;
};

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubError(404, "TENANT_NOT_FOUND", "Demo tenant not found. Run `npm run db:seed` to create starter data.");
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubError(403, "ACTOR_NOT_FOUND", "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.");
  }

  const { jobId } = await context.params;
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const note = typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim().slice(0, 280) : null;

  try {
    const result = await applyApiHubIngestionRun({
      tenantId: tenant.id,
      runId: jobId,
      actorUserId: actorId,
      note,
    });
    if (!result) {
      return apiHubError(404, "RUN_NOT_FOUND", "Run not found.");
    }
    return NextResponse.json({
      runId: result.run.id,
      applied: result.applied,
      auditLog: result.auditLog,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "apply_requires_succeeded_status") {
      return apiHubError(409, "APPLY_REQUIRES_SUCCEEDED", "Only succeeded runs can be applied.");
    }
    throw error;
  }
}

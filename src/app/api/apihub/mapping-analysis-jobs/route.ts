import { after } from "next/server";

import type { Prisma } from "@prisma/client";

import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { parseApiHubMappingAnalysisJobCreateBody } from "@/lib/apihub/mapping-analysis-job-create-body";
import { toApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { processApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-job-process";
import {
  createApiHubMappingAnalysisJob,
  listApiHubMappingAnalysisJobs,
} from "@/lib/apihub/mapping-analysis-jobs-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  records?: unknown;
  targetFields?: unknown;
  note?: unknown;
};

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const limitParsed = parseApiHubListLimitFromUrl(new URL(request.url));
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping analysis job list query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const rows = await listApiHubMappingAnalysisJobs({ tenantId: tenant.id, limit: limitParsed.limit });
  return apiHubJson({ jobs: rows.map(toApiHubMappingAnalysisJobDto) }, requestId);
}

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const parsed = parseApiHubMappingAnalysisJobCreateBody(body);
  if (!parsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping analysis job create validation failed.", parsed.issues, requestId);
  }

  const job = await createApiHubMappingAnalysisJob({
    tenantId: tenant.id,
    requestedByUserId: actorId,
    inputPayload: JSON.parse(
      JSON.stringify({
        schemaVersion: parsed.value.schemaVersion,
        records: parsed.value.records,
        targetFields: parsed.value.targetFields,
        note: parsed.value.note,
      }),
    ) as Prisma.InputJsonValue,
  });

  after(() => {
    void processApiHubMappingAnalysisJob(job.id, tenant.id).catch((err) => {
      console.error("[apihub] mapping analysis job failed", err);
    });
  });

  return apiHubJson({ job: toApiHubMappingAnalysisJobDto(job) }, requestId, 201);
}

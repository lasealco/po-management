import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { APIHUB_JSON_BODY_MAX_BYTES_LARGE } from "@/lib/apihub/constants";
import { getApiHubIngestionRunById } from "@/lib/apihub/ingestion-runs-repo";
import { computeMappingPreview, type MappingPreviewPostBody } from "@/lib/apihub/mapping-preview-run";
import { parseApiHubPostJsonForRoute } from "@/lib/apihub/request-body-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const { jobId } = await context.params;
  const run = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!run) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }

  let body: MappingPreviewPostBody = {};
  const parsedBody = await parseApiHubPostJsonForRoute(request, requestId, APIHUB_JSON_BODY_MAX_BYTES_LARGE, {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as MappingPreviewPostBody;

  const computed = computeMappingPreview(body);
  if (!computed.ok) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping preview payload validation failed.",
      computed.issues,
      requestId,
    );
  }

  return apiHubJson(
    {
      runId: run.id,
      sampling: computed.sampling,
      preview: computed.rows.map((row) => ({
        recordIndex: row.recordIndex,
        mapped: row.mapped,
        issues: row.issues,
      })),
    },
    requestId,
  );
}

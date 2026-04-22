import { NextResponse } from "next/server";

import {
  apiHubError,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { buildMappingPreviewIssuesCsv, buildMappingPreviewIssuesJson } from "@/lib/apihub/mapping-preview-export-build";
import { computeMappingPreview, type MappingPreviewPostBody } from "@/lib/apihub/mapping-preview-run";
import { getApiHubIngestionRunById } from "@/lib/apihub/ingestion-runs-repo";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

type ExportPostBody = MappingPreviewPostBody & {
  format?: unknown;
};

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

  let body: ExportPostBody = {};
  try {
    body = (await request.json()) as ExportPostBody;
  } catch {
    body = {};
  }

  const computed = computeMappingPreview(body);
  if (!computed.ok) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Mapping preview export validation failed.",
      computed.issues,
      requestId,
    );
  }

  const rawFormat = body.format;
  const fmt = typeof rawFormat === "string" ? rawFormat.trim().toLowerCase() : "";
  if (fmt !== "json" && fmt !== "csv") {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Mapping preview export validation failed.", [
      {
        field: "format",
        code: "INVALID_ENUM",
        message: "format must be json or csv.",
        severity: "error",
      },
    ], requestId);
  }

  const generatedAt = new Date().toISOString();
  const safeTs = generatedAt.replace(/:/g, "-").replace(/\./g, "-");
  const filename = fmt === "json" ? `mapping-preview-issues-${run.id}-${safeTs}.json` : `mapping-preview-issues-${run.id}-${safeTs}.csv`;

  const payload = {
    runId: run.id,
    generatedAt,
    sampling: computed.sampling,
    preview: computed.rows,
  };

  const bodyOut = fmt === "json" ? buildMappingPreviewIssuesJson(payload) : buildMappingPreviewIssuesCsv(computed.rows);

  return new NextResponse(bodyOut, {
    status: 200,
    headers: {
      [APIHUB_REQUEST_ID_HEADER]: requestId,
      "Content-Type": fmt === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

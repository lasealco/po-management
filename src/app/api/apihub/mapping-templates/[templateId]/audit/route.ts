import {
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { toApiHubMappingTemplateAuditLogDto } from "@/lib/apihub/mapping-template-audit-dto";
import { listApiHubMappingTemplateAuditLogsPage } from "@/lib/apihub/mapping-templates-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

const AUDIT_PAGE_MAX = 10_000;

function parseAuditPage(url: URL): { ok: true; page: number } | { ok: false; issues: ApiHubValidationIssue[] } {
  const raw = url.searchParams.get("page");
  if (raw == null || raw.trim() === "") {
    return { ok: true, page: 1 };
  }
  const trimmed = raw.trim();
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) {
    return {
      ok: false,
      issues: [
        {
          field: "page",
          code: "INVALID_NUMBER",
          message: "page must be a finite integer ≥ 1.",
          severity: "error",
        },
      ],
    };
  }
  return { ok: true, page: Math.min(Math.trunc(n), AUDIT_PAGE_MAX) };
}

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const { templateId } = await context.params;
  const url = new URL(request.url);
  const limitParsed = parseApiHubListLimitFromUrl(url);
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Audit list query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const pageParsed = parseAuditPage(url);
  if (!pageParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Audit list query validation failed.", pageParsed.issues, requestId);
  }

  const limit = limitParsed.limit;
  const offset = (pageParsed.page - 1) * limit;
  const { items, hasMore } = await listApiHubMappingTemplateAuditLogsPage({
    tenantId: tenant.id,
    templateId,
    limit,
    offset,
  });

  return apiHubJson(
    {
      templateId,
      page: pageParsed.page,
      limit,
      hasMore,
      audit: items.map(toApiHubMappingTemplateAuditLogDto),
    },
    requestId,
  );
}

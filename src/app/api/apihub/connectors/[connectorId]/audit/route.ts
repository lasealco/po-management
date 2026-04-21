import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { toApiHubConnectorAuditLogDto } from "@/lib/apihub/connector-dto";
import {
  getApiHubConnectorInTenant,
  listApiHubConnectorAuditLogsPage,
} from "@/lib/apihub/connectors-repo";
import { parseApiHubListLimitFromUrl } from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

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
        },
      ],
    };
  }
  return { ok: true, page: Math.min(Math.trunc(n), AUDIT_PAGE_MAX) };
}

export async function GET(request: Request, context: { params: Promise<{ connectorId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const { connectorId } = await context.params;
  if (!connectorId) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Connector path validation failed.", [
      { field: "connectorId", code: "REQUIRED", message: "Connector id is required." },
    ], requestId);
  }

  const url = new URL(request.url);
  const limitParsed = parseApiHubListLimitFromUrl(url);
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Audit list query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: "limit must be a finite number between 1 and 100.",
      },
    ], requestId);
  }

  const pageParsed = parseAuditPage(url);
  if (!pageParsed.ok) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Audit list query validation failed.",
      pageParsed.issues,
      requestId,
    );
  }

  const connector = await getApiHubConnectorInTenant(tenant.id, connectorId);
  if (!connector) {
    return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found.", requestId);
  }

  const limit = limitParsed.limit;
  const offset = (pageParsed.page - 1) * limit;
  const { items, hasMore } = await listApiHubConnectorAuditLogsPage({
    tenantId: tenant.id,
    connectorId,
    limit,
    offset,
  });

  return apiHubJson(
    {
      connectorId,
      page: pageParsed.page,
      limit,
      hasMore,
      audit: items.map(toApiHubConnectorAuditLogDto),
    },
    requestId,
  );
}

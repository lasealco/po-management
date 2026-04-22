import {
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import {
  APIHUB_CONNECTOR_AUTH_MODES,
  APIHUB_CONNECTOR_LIST_SORT_FIELDS,
  APIHUB_CONNECTOR_LIST_SORT_ORDERS,
  APIHUB_CONNECTOR_STATUSES,
  APIHUB_JSON_BODY_MAX_BYTES,
} from "@/lib/apihub/constants";
import { APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN } from "@/lib/apihub/connector-search";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import {
  createStubApiHubConnector,
  listApiHubConnectorAuditLogs,
  listApiHubConnectorsWithRecentAudit,
} from "@/lib/apihub/connectors-repo";
import { parseApiHubPostJsonForRoute } from "@/lib/apihub/request-body-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const url = new URL(request.url);
  const rawStatus = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const rawAuthMode = (url.searchParams.get("authMode") ?? "").trim().toLowerCase();
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  const rawSort = (url.searchParams.get("sort") ?? "").trim().toLowerCase();
  const rawOrder = (url.searchParams.get("order") ?? "").trim().toLowerCase();

  const issues: ApiHubValidationIssue[] = [];
  if (rawQ.length > APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN) {
    issues.push({
      field: "q",
      code: "MAX_LENGTH",
      message: `q must be at most ${APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN} characters.`,
    });
  }
  if (
    rawSort.length > 0 &&
    !APIHUB_CONNECTOR_LIST_SORT_FIELDS.includes(rawSort as (typeof APIHUB_CONNECTOR_LIST_SORT_FIELDS)[number])
  ) {
    issues.push({
      field: "sort",
      code: "INVALID_ENUM",
      message: `sort must be one of: ${APIHUB_CONNECTOR_LIST_SORT_FIELDS.join(", ")}.`,
    });
  }
  if (
    rawOrder.length > 0 &&
    !APIHUB_CONNECTOR_LIST_SORT_ORDERS.includes(rawOrder as (typeof APIHUB_CONNECTOR_LIST_SORT_ORDERS)[number])
  ) {
    issues.push({
      field: "order",
      code: "INVALID_ENUM",
      message: `order must be one of: ${APIHUB_CONNECTOR_LIST_SORT_ORDERS.join(", ")}.`,
    });
  }
  if (rawStatus.length > 0 && !APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
    issues.push({
      field: "status",
      code: "INVALID_ENUM",
      message: `status must be one of: ${APIHUB_CONNECTOR_STATUSES.join(", ")}.`,
    });
  }
  if (
    rawAuthMode.length > 0 &&
    !APIHUB_CONNECTOR_AUTH_MODES.includes(rawAuthMode as (typeof APIHUB_CONNECTOR_AUTH_MODES)[number])
  ) {
    issues.push({
      field: "authMode",
      code: "INVALID_ENUM",
      message: `authMode must be one of: ${APIHUB_CONNECTOR_AUTH_MODES.join(", ")}.`,
    });
  }
  if (issues.length > 0) {
    return apiHubValidationError(
      400,
      "VALIDATION_ERROR",
      "Connector list query validation failed.",
      issues,
      requestId,
    );
  }

  const rows = await listApiHubConnectorsWithRecentAudit(
    tenant.id,
    {
      status: rawStatus.length > 0 ? rawStatus : undefined,
      authMode: rawAuthMode.length > 0 ? rawAuthMode : undefined,
      q: rawQ.length > 0 ? rawQ : undefined,
      sortField:
        rawSort.length > 0 ? (rawSort as (typeof APIHUB_CONNECTOR_LIST_SORT_FIELDS)[number]) : undefined,
      sortOrder:
        rawOrder.length > 0 ? (rawOrder as (typeof APIHUB_CONNECTOR_LIST_SORT_ORDERS)[number]) : undefined,
    },
    3,
  );
  return apiHubJson({ connectors: rows.map(toApiHubConnectorDto) }, requestId);
}

type PostBody = {
  name?: unknown;
};

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRoute(request, requestId, APIHUB_JSON_BODY_MAX_BYTES, {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName.length > 0 ? rawName.slice(0, 128) : "Stub connector";

  const created = await createStubApiHubConnector({ tenantId: tenant.id, actorUserId: actorId, name });
  const auditLogs = await listApiHubConnectorAuditLogs(tenant.id, created.id, 3);
  return apiHubJson({ connector: toApiHubConnectorDto({ ...created, auditLogs }) }, requestId, 201);
}

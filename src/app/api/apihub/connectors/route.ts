import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { APIHUB_CONNECTOR_AUTH_MODES, APIHUB_CONNECTOR_STATUSES } from "@/lib/apihub/constants";
import { APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN } from "@/lib/apihub/connector-search";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import {
  createStubApiHubConnector,
  listApiHubConnectorAuditLogs,
  listApiHubConnectors,
} from "@/lib/apihub/connectors-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

  const url = new URL(request.url);
  const rawStatus = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const rawAuthMode = (url.searchParams.get("authMode") ?? "").trim().toLowerCase();
  const rawQ = (url.searchParams.get("q") ?? "").trim();

  const issues: ApiHubValidationIssue[] = [];
  if (rawQ.length > APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN) {
    issues.push({
      field: "q",
      code: "MAX_LENGTH",
      message: `q must be at most ${APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN} characters.`,
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

  const rows = await listApiHubConnectors(tenant.id, {
    status: rawStatus.length > 0 ? rawStatus : undefined,
    authMode: rawAuthMode.length > 0 ? rawAuthMode : undefined,
    q: rawQ.length > 0 ? rawQ : undefined,
  });
  const rowsWithAudit = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      auditLogs: await listApiHubConnectorAuditLogs(tenant.id, row.id, 3),
    })),
  );
  return apiHubJson({ connectors: rowsWithAudit.map(toApiHubConnectorDto) }, requestId);
}

type PostBody = {
  name?: unknown;
};

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

  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName.length > 0 ? rawName.slice(0, 128) : "Stub connector";

  const created = await createStubApiHubConnector({ tenantId: tenant.id, actorUserId: actorId, name });
  return apiHubJson({ connector: toApiHubConnectorDto(created) }, requestId, 201);
}

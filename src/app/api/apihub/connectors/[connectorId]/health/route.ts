import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { buildApiHubConnectorHealthPayload } from "@/lib/apihub/connector-health-probe";
import { APIHUB_PHASE, APIHUB_SERVICE } from "@/lib/apihub/constants";
import { getApiHubConnectorHealthContext } from "@/lib/apihub/connectors-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ connectorId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const { connectorId } = await context.params;
  if (!connectorId) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Connector path validation failed.", [
      { field: "connectorId", code: "REQUIRED", message: "Connector id is required." },
    ], requestId);
  }

  const row = await getApiHubConnectorHealthContext(tenant.id, connectorId);
  if (!row) {
    return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found.", requestId);
  }

  const health = buildApiHubConnectorHealthPayload(
    {
      sourceKind: row.sourceKind,
      status: row.status,
      authMode: row.authMode,
      authState: row.authState,
      authConfigRef: row.authConfigRef,
      lastSyncAt: row.lastSyncAt,
    },
    new Date(),
  );

  return apiHubJson(
    {
      ok: true as const,
      service: APIHUB_SERVICE,
      phase: APIHUB_PHASE,
      connectorId,
      health,
    },
    requestId,
  );
}

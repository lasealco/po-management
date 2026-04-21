import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { getActorUserId } from "@/lib/authz";
import { APIHUB_CONNECTOR_STATUSES } from "@/lib/apihub/constants";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import { updateApiHubConnectorLifecycle } from "@/lib/apihub/connectors-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getDemoTenant } from "@/lib/demo-tenant";

type PatchBody = {
  status?: unknown;
  markSyncedNow?: unknown;
  note?: unknown;
};

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectorId: string }> },
) {
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

  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    body = {};
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Connector lifecycle validation failed.", [
      {
        field: "status",
        code: "INVALID_ENUM",
        message: `status must be one of: ${APIHUB_CONNECTOR_STATUSES.join(", ")}.`,
      },
    ], requestId);
  }

  const markSyncedNow = body.markSyncedNow === true;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : null;

  const updated = await updateApiHubConnectorLifecycle({
    tenantId: tenant.id,
    connectorId,
    actorUserId: actorId,
    status: rawStatus,
    syncNow: markSyncedNow,
    note,
  });

  if (!updated) {
    return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found.", requestId);
  }

  return apiHubJson({ connector: toApiHubConnectorDto(updated) }, requestId);
}

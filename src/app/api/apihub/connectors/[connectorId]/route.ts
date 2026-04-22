import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { validateApiHubAuthConfigRefForWrite } from "@/lib/apihub/auth-config-ref";
import {
  APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN,
  APIHUB_CONNECTOR_OPS_NOTE_MAX,
  APIHUB_CONNECTOR_STATUSES,
  APIHUB_JSON_BODY_MAX_BYTES,
} from "@/lib/apihub/constants";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import {
  getApiHubConnectorInTenant,
  listApiHubConnectorAuditLogs,
  updateApiHubConnectorLifecycle,
} from "@/lib/apihub/connectors-repo";
import { countInFlightApiHubIngestionRunsForConnector } from "@/lib/apihub/ingestion-runs-repo";
import { parseApiHubPostJsonForRoute } from "@/lib/apihub/request-body-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

type PatchBody = {
  status?: unknown;
  markSyncedNow?: unknown;
  note?: unknown;
  opsNote?: unknown;
  authConfigRef?: unknown;
};

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectorId: string }> },
) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  const { connectorId } = await context.params;
  if (!connectorId) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Connector path validation failed.", [
      { field: "connectorId", code: "REQUIRED", message: "Connector id is required." },
    ], requestId);
  }

  let body: PatchBody = {};
  const parsedBody = await parseApiHubPostJsonForRoute(request, requestId, APIHUB_JSON_BODY_MAX_BYTES, {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PatchBody;

  const existing = await getApiHubConnectorInTenant(tenant.id, connectorId);
  if (!existing) {
    return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found.", requestId);
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  let rawStatus: string;
  if (hasStatus) {
    if (typeof body.status !== "string") {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Connector lifecycle validation failed.", [
        {
          field: "status",
          code: "INVALID_TYPE",
          message: "status must be a string when provided.",
        },
      ], requestId);
    }
    rawStatus = body.status.trim().toLowerCase();
    if (rawStatus.length === 0) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Connector lifecycle validation failed.", [
        {
          field: "status",
          code: "REQUIRED",
          message: "status cannot be empty.",
        },
      ], requestId);
    }
    if (!APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Connector lifecycle validation failed.", [
        {
          field: "status",
          code: "INVALID_ENUM",
          message: `status must be one of: ${APIHUB_CONNECTOR_STATUSES.join(", ")}.`,
        },
      ], requestId);
    }
  } else {
    rawStatus = existing.status.trim().toLowerCase();
    if (!APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
      return apiHubError(
        409,
        "CONNECTOR_STATUS_INVALID",
        "Stored connector status is not a recognized lifecycle value.",
        requestId,
      );
    }
  }

  let authConfigRefUpdate: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, "authConfigRef")) {
    const parsed = validateApiHubAuthConfigRefForWrite(body.authConfigRef);
    if (!parsed.ok) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Connector auth config ref validation failed.", [
        { field: "authConfigRef", code: parsed.code, message: parsed.message },
      ], requestId);
    }
    authConfigRefUpdate = parsed.value;
  }

  let opsNoteUpdate: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, "opsNote")) {
    if (body.opsNote === null) {
      opsNoteUpdate = null;
    } else if (typeof body.opsNote === "string") {
      const trimmed = body.opsNote.trim();
      if (trimmed.length > APIHUB_CONNECTOR_OPS_NOTE_MAX) {
        return apiHubValidationError(400, "VALIDATION_ERROR", "Connector metadata validation failed.", [
          {
            field: "opsNote",
            code: "MAX_LENGTH",
            message: `opsNote must be at most ${APIHUB_CONNECTOR_OPS_NOTE_MAX} characters after trimming.`,
          },
        ], requestId);
      }
      opsNoteUpdate = trimmed.length === 0 ? null : trimmed;
    } else {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Connector metadata validation failed.", [
        {
          field: "opsNote",
          code: "INVALID_TYPE",
          message: "opsNote must be a string, null, or omitted.",
        },
      ], requestId);
    }
  }

  const markSyncedNow = body.markSyncedNow === true;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : null;

  const existingStatusLower = existing.status.trim().toLowerCase();
  const isLeavingActive = existingStatusLower === "active" && rawStatus !== "active";
  if (isLeavingActive) {
    const inFlight = await countInFlightApiHubIngestionRunsForConnector({
      tenantId: tenant.id,
      connectorId,
    });
    if (inFlight > 0) {
      const trimmed = (note ?? "").trim();
      if (trimmed.length < APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN) {
        return apiHubError(
          409,
          "ACTIVE_CONNECTOR_HAS_RUNNING_JOBS",
          `Cannot change status away from active while ${inFlight} ingestion job(s) are queued or running. Add an ops note with at least ${APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN} characters to acknowledge.`,
          requestId,
        );
      }
    }
  }

  const updated = await updateApiHubConnectorLifecycle({
    tenantId: tenant.id,
    connectorId,
    actorUserId: actorId,
    status: rawStatus,
    syncNow: markSyncedNow,
    note,
    ...(opsNoteUpdate !== undefined ? { opsNote: opsNoteUpdate } : {}),
    ...(authConfigRefUpdate !== undefined ? { authConfigRef: authConfigRefUpdate } : {}),
  });

  if (!updated) {
    return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found.", requestId);
  }

  const auditLogs = await listApiHubConnectorAuditLogs(tenant.id, connectorId, 3);
  return apiHubJson({ connector: toApiHubConnectorDto({ ...updated, auditLogs }) }, requestId);
}

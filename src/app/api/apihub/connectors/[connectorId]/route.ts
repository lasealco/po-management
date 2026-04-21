import { apiHubJson } from "@/lib/apihub/api-error";
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
    return apiHubJson(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      requestId,
      404,
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubJson(
      {
        error:
          "No active demo user for this session. Open Settings -> Demo session (/settings/demo) to choose who you are acting as.",
      },
      requestId,
      403,
    );
  }

  const { connectorId } = await context.params;
  if (!connectorId) {
    return apiHubJson({ error: "Connector id is required." }, requestId, 400);
  }

  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    body = {};
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
    return apiHubJson(
      {
        error: `status must be one of: ${APIHUB_CONNECTOR_STATUSES.join(", ")}.`,
      },
      requestId,
      400,
    );
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
    return apiHubJson({ error: "Connector not found." }, requestId, 404);
  }

  return apiHubJson({ connector: toApiHubConnectorDto(updated) }, requestId);
}

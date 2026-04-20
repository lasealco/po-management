import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { APIHUB_CONNECTOR_STATUSES } from "@/lib/apihub/constants";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import { updateApiHubConnectorLifecycle } from "@/lib/apihub/connectors-repo";
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
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings -> Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const { connectorId } = await context.params;
  if (!connectorId) {
    return NextResponse.json({ error: "Connector id is required." }, { status: 400 });
  }

  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    body = {};
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!APIHUB_CONNECTOR_STATUSES.includes(rawStatus as (typeof APIHUB_CONNECTOR_STATUSES)[number])) {
    return NextResponse.json(
      {
        error: `status must be one of: ${APIHUB_CONNECTOR_STATUSES.join(", ")}.`,
      },
      { status: 400 },
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
    return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  }

  return NextResponse.json({ connector: toApiHubConnectorDto(updated) });
}

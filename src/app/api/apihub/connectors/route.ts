import { NextResponse } from "next/server";

import { APIHUB_CONNECTOR_AUTH_MODES, APIHUB_CONNECTOR_AUTH_STATES } from "@/lib/apihub/constants";
import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import {
  createStubApiHubConnector,
  listApiHubConnectorAuditLogs,
  listApiHubConnectors,
} from "@/lib/apihub/connectors-repo";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const rows = await listApiHubConnectors(tenant.id);
  const rowsWithAudit = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      auditLogs: await listApiHubConnectorAuditLogs(tenant.id, row.id, 3),
    })),
  );
  return NextResponse.json({ connectors: rowsWithAudit.map(toApiHubConnectorDto) });
}

type PostBody = {
  name?: unknown;
  authMode?: unknown;
  authConfigRef?: unknown;
  authState?: unknown;
};

export async function POST(request: Request) {
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName.length > 0 ? rawName.slice(0, 128) : "Stub connector";
  const rawAuthMode = typeof body.authMode === "string" ? body.authMode.trim().toLowerCase() : "none";
  if (!APIHUB_CONNECTOR_AUTH_MODES.includes(rawAuthMode as (typeof APIHUB_CONNECTOR_AUTH_MODES)[number])) {
    return NextResponse.json(
      {
        error: `authMode must be one of: ${APIHUB_CONNECTOR_AUTH_MODES.join(", ")}.`,
      },
      { status: 400 },
    );
  }
  const rawAuthState =
    typeof body.authState === "string" ? body.authState.trim().toLowerCase() : "not_configured";
  if (!APIHUB_CONNECTOR_AUTH_STATES.includes(rawAuthState as (typeof APIHUB_CONNECTOR_AUTH_STATES)[number])) {
    return NextResponse.json(
      {
        error: `authState must be one of: ${APIHUB_CONNECTOR_AUTH_STATES.join(", ")}.`,
      },
      { status: 400 },
    );
  }
  const authConfigRef =
    typeof body.authConfigRef === "string" && body.authConfigRef.trim().length > 0
      ? body.authConfigRef.trim().slice(0, 280)
      : null;

  const created = await createStubApiHubConnector({
    tenantId: tenant.id,
    actorUserId: actorId,
    name,
    authMode: rawAuthMode,
    authConfigRef,
    authState: rawAuthState,
  });
  return NextResponse.json({ connector: toApiHubConnectorDto(created) }, { status: 201 });
}

import { apiHubJson } from "@/lib/apihub/api-error";
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      requestId,
      403,
    );
  }

  const rows = await listApiHubConnectors(tenant.id);
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      requestId,
      403,
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

  const created = await createStubApiHubConnector({ tenantId: tenant.id, actorUserId: actorId, name });
  return apiHubJson({ connector: toApiHubConnectorDto(created) }, requestId, 201);
}

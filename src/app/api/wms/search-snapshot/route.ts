import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  decodeSearchSnapshotBf99Cursor,
  loadSearchSnapshotBf99Ndjson,
  parseSearchSnapshotBf99Limit,
  SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION,
} from "@/lib/wms/search-snapshot-bf99";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const url = new URL(request.url);
  const cursorRaw = url.searchParams.get("cursor");
  const cursorCheck = decodeSearchSnapshotBf99Cursor(cursorRaw);
  if (!cursorCheck.ok) {
    return toApiErrorResponse({
      error: cursorCheck.message,
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const limit = parseSearchSnapshotBf99Limit(url.searchParams.get("limit"));

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);

  let snapshot: { body: string; nextCursor: string | null; lineCount: number };
  try {
    snapshot = await loadSearchSnapshotBf99Ndjson(prisma, tenant.id, tenant.slug, viewScope, {
      cursorRaw,
      limit,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search snapshot failed.";
    return toApiErrorResponse({ error: msg, code: "INTERNAL_ERROR", status: 500 });
  }

  const attachment = url.searchParams.get("attachment")?.trim() === "1";
  const headers: Record<string, string> = {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "X-Search-Snapshot-Schema": SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION,
    "X-Search-Snapshot-Line-Count": String(snapshot.lineCount),
    ...(snapshot.nextCursor ? { "X-Search-Snapshot-Next-Cursor": snapshot.nextCursor } : {}),
  };
  if (attachment) {
    headers["Content-Disposition"] = 'attachment; filename="wms-search-snapshot-bf99.ndjson"';
  }

  return new NextResponse(snapshot.body, { status: 200, headers });
}

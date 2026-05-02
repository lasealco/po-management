import { NextResponse } from "next/server";

import { requireAnyApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  clampTimelineLimit,
  decodeOperationsTimelineCursor,
  fetchTenantOperationsTimelinePage,
  parseTimelineSourcesParam,
  TIMELINE_LIMIT_DEFAULT,
} from "@/lib/operations/tenant-operations-timeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAnyApiGrant([
    { resource: "org.controltower", action: "view" },
    { resource: "org.wms", action: "view" },
  ]);
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limit =
    rawLimit === null || rawLimit.trim() === ""
      ? TIMELINE_LIMIT_DEFAULT
      : clampTimelineLimit(Number(rawLimit));
  const sources = parseTimelineSourcesParam(url.searchParams.get("sources"));

  const rawCursor = (url.searchParams.get("cursor") ?? "").trim();
  let cursor: { t: Date; sk: number; id: string } | null = null;
  if (rawCursor.length > 0) {
    const decoded = decodeOperationsTimelineCursor(rawCursor);
    if (!decoded.ok) {
      return NextResponse.json({ error: decoded.message, code: "INVALID_CURSOR" }, { status: 400 });
    }
    cursor = { t: decoded.t, sk: decoded.sk, id: decoded.id };
  }

  const page = await fetchTenantOperationsTimelinePage({
    tenantId: tenant.id,
    limit,
    sources,
    cursor,
  });

  return NextResponse.json({
    events: page.events,
    nextCursor: page.nextCursor,
    limit,
    sources: Array.from(sources).sort(),
  });
}

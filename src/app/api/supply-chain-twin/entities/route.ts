import { NextResponse } from "next/server";

import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { parseTwinEntitiesQuery } from "@/lib/supply-chain-twin/entities-catalog";

export const dynamic = "force-dynamic";

/**
 * Stub entity catalog. Query `q` is zod-validated; response is `{ items: [] }` until Slice 4+.
 */
export async function GET(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const { linkVisibility } = await resolveNavState(access);
  if (!linkVisibility?.supplyChainTwin) {
    return NextResponse.json(
      {
        error:
          "Forbidden: Supply Chain Twin preview requires broader workspace access than this session has.",
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const parsed = parseTwinEntitiesQuery(url.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const body = { items: [] as const };
  return NextResponse.json(body);
}

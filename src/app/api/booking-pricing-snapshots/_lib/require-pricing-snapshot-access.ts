import { NextResponse } from "next/server";

import { getDemoTenant } from "@/lib/demo-tenant";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function requirePricingSnapshotRead(): Promise<NextResponse | null> {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Demo tenant not found. Run `npm run db:seed` to create starter data." },
      { status: 404 },
    );
  }
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
  const g = access.grantSet;
  if (!viewerHas(g, "org.tariffs", "view") && !viewerHas(g, "org.rfq", "view")) {
    return NextResponse.json(
      { error: "Forbidden: requires org.tariffs → view or org.rfq → view." },
      { status: 403 },
    );
  }
  return null;
}

export async function requirePricingSnapshotWriteForSource(params: {
  sourceType: "TARIFF_CONTRACT_VERSION" | "QUOTE_RESPONSE";
}): Promise<NextResponse | null> {
  const readGate = await requirePricingSnapshotRead();
  if (readGate) return readGate;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const g = access.grantSet;
  if (params.sourceType === "TARIFF_CONTRACT_VERSION") {
    if (!viewerHas(g, "org.tariffs", "edit")) {
      return NextResponse.json({ error: "Forbidden: requires org.tariffs → edit." }, { status: 403 });
    }
  } else {
    if (!viewerHas(g, "org.rfq", "edit")) {
      return NextResponse.json({ error: "Forbidden: requires org.rfq → edit." }, { status: 403 });
    }
  }
  return null;
}

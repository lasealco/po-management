import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function requirePricingSnapshotRead(): Promise<NextResponse | null> {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({
      error: "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      code: "TENANT_NOT_FOUND",
      status: 404,
    });
  }
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({
      error:
        "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      code: "NO_ACTIVE_USER",
      status: 403,
    });
  }
  const g = access.grantSet;
  if (
    !viewerHas(g, "org.tariffs", "view") &&
    !viewerHas(g, "org.rfq", "view") &&
    !viewerHas(g, "org.invoice_audit", "view")
  ) {
    return toApiErrorResponse({
      error: "Forbidden: requires org.tariffs → view, org.rfq → view, or org.invoice_audit → view.",
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return null;
}

export async function requirePricingSnapshotWriteForSource(params: {
  sourceType: "TARIFF_CONTRACT_VERSION" | "QUOTE_RESPONSE" | "COMPOSITE_CONTRACT_VERSION";
}): Promise<NextResponse | null> {
  const readGate = await requirePricingSnapshotRead();
  if (readGate) return readGate;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "No active user.", code: "NO_ACTIVE_USER", status: 403 });
  }
  const g = access.grantSet;
  if (params.sourceType === "TARIFF_CONTRACT_VERSION" || params.sourceType === "COMPOSITE_CONTRACT_VERSION") {
    if (!viewerHas(g, "org.tariffs", "edit")) {
      return toApiErrorResponse({
        error: "Forbidden: requires org.tariffs → edit.",
        code: "FORBIDDEN",
        status: 403,
      });
    }
  } else {
    if (!viewerHas(g, "org.rfq", "edit")) {
      return toApiErrorResponse({
        error: "Forbidden: requires org.rfq → edit.",
        code: "FORBIDDEN",
        status: 403,
      });
    }
  }
  return null;
}

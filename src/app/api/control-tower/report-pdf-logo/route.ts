import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { loadReportPdfLogoFromEnv } from "@/lib/control-tower/report-pdf-load-logo";

/**
 * Serves the optional raster logo bytes for in-app **Download PDF** (same source as
 * `CONTROL_TOWER_REPORT_PDF_LOGO_URL` used by scheduled report emails / cron). 404 when unset.
 */
export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const logo = await loadReportPdfLogoFromEnv();
  if (!logo) {
    return toApiErrorResponse({
      error: "No report PDF logo is configured (set CONTROL_TOWER_REPORT_PDF_LOGO_URL to a public https PNG or JPEG).",
      code: "NOT_FOUND",
      status: 404,
    });
  }
  return new NextResponse(Buffer.from(logo.bytes), {
    status: 200,
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

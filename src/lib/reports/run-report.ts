import { getReportDefinition } from "@/lib/reports/registry";
import type { ReportContext, ReportResult } from "@/lib/reports/types";
import { userHasGlobalGrant } from "@/lib/authz";
import type { PrismaClient } from "@prisma/client";

export async function canUserRunReport(
  userId: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await userHasGlobalGrant(userId, "org.reports", "view"))) {
    return { ok: false, error: "Forbidden: requires org.reports → view." };
  }
  const def = getReportDefinition(reportId);
  if (!def) {
    return { ok: false, error: "Unknown report." };
  }
  for (const req of def.requires ?? []) {
    if (!(await userHasGlobalGrant(userId, req.resource, req.action))) {
      return {
        ok: false,
        error: `Forbidden: this report also needs ${req.resource} → ${req.action}.`,
      };
    }
  }
  return { ok: true };
}

export async function executeReport(params: {
  userId: string;
  tenantId: string;
  prisma: PrismaClient;
  reportId: string;
  /** Reserved for parameterized reports. */
  inputParams?: Record<string, unknown>;
}): Promise<{ ok: true; result: ReportResult } | { ok: false; error: string }> {
  const gate = await canUserRunReport(params.userId, params.reportId);
  if (!gate.ok) return gate;

  const def = getReportDefinition(params.reportId);
  if (!def) return { ok: false, error: "Unknown report." };

  const ctx: ReportContext = {
    tenantId: params.tenantId,
    prisma: params.prisma,
  };

  try {
    const partial = await def.run(ctx, params.inputParams ?? {});
    const result: ReportResult = {
      ...partial,
      reportId: def.id,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Report failed.";
    return { ok: false, error: message };
  }
}

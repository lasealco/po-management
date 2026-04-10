import { getReportDefinition } from "@/lib/reports/registry";
import type { ReportContext, ReportDefinition, ReportResult } from "@/lib/reports/types";
import { userHasGlobalGrant } from "@/lib/authz";
import type { PrismaClient } from "@prisma/client";

async function firstMissingReportRequirement(
  userId: string,
  def: ReportDefinition,
): Promise<string | null> {
  if (!(await userHasGlobalGrant(userId, "org.reports", "view"))) {
    return "org.reports → view";
  }
  for (const req of def.requires ?? []) {
    if (!(await userHasGlobalGrant(userId, req.resource, req.action))) {
      return `${req.resource} → ${req.action}`;
    }
  }
  return null;
}

/**
 * For a registered report id: first missing global permission, or null if the user can run it.
 * For an unknown id, returns null (callers should validate with `getReportDefinition` first).
 */
export async function getReportAccessBlocker(
  userId: string,
  reportId: string,
): Promise<string | null> {
  const def = getReportDefinition(reportId);
  if (!def) return null;
  return firstMissingReportRequirement(userId, def);
}

export async function canUserRunReport(
  userId: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const def = getReportDefinition(reportId);
  if (!def) {
    return { ok: false, error: "Unknown report." };
  }
  const missing = await firstMissingReportRequirement(userId, def);
  if (missing === null) return { ok: true };
  return { ok: false, error: `Forbidden: requires ${missing}.` };
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

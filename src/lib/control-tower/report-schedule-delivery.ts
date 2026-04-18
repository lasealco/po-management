import type { CtReportSchedule, CtReportScheduleFrequency } from "@prisma/client";

import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";
import {
  buildControlTowerReportCsv,
  runControlTowerReport,
  type CtRunReportResult,
} from "@/lib/control-tower/report-engine";
import { buildControlTowerReportPdfBytes } from "@/lib/control-tower/report-pdf";
import {
  dimensionLabel,
  formatReportDateWindowLine,
  metricLabel,
} from "@/lib/control-tower/report-labels";

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * True when this schedule should run for the current UTC calendar day.
 * Uses "slot started" (`hourUtc`:00) so an **hourly** cron (Pro) can pick up each hour, and a
 * **once-daily** sweep after all hours (Hobby) still works — see `vercel.json` cron schedule.
 */
export function isReportScheduleDue(schedule: CtReportSchedule, now: Date): boolean {
  if (schedule.frequency === "WEEKLY") {
    if (schedule.dayOfWeek == null) return false;
    if (now.getUTCDay() !== schedule.dayOfWeek) return false;
  }
  const slotStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    schedule.hourUtc,
    0,
    0,
    0,
  );
  if (now.getTime() < slotStart) return false;

  const today = utcDayStart(now);
  if (!schedule.lastRunAt) return true;
  return utcDayStart(schedule.lastRunAt) < today;
}

function truncateEmailOrgName(raw: string, max = 72): string {
  const t = raw.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function formatReportRunForEmail(
  result: CtRunReportResult,
  reportName: string,
  opts?: { organizationName?: string },
): {
  subject: string;
  text: string;
} {
  const title = result.config.title?.trim() || reportName;
  const org = opts?.organizationName?.trim() ? truncateEmailOrgName(opts.organizationName.trim()) : "";
  const orgLead = org ? `${org} — ` : "";
  const dateWindowLine = formatReportDateWindowLine({
    dateField: result.config.dateField,
    dateFrom: result.config.dateFrom,
    dateTo: result.config.dateTo,
  });
  const measureDimensionLine = `${metricLabel(result.config.measure)} · ${dimensionLabel(result.config.dimension)}`;
  const compare = result.config.compareMeasure;
  const compareLine = compare ? `Compare measure: ${metricLabel(compare)}` : null;
  const lines: string[] = [
    org
      ? `Control Tower scheduled report (${org}): ${title}`
      : `Control Tower scheduled report: ${title}`,
    `Generated (UTC): ${result.generatedAt}`,
    "",
    `Coverage: ${result.coverage.shipmentsAggregated} shipments aggregated (${result.coverage.totalShipmentsQueried} queried, ${result.coverage.excludedByDateOrMissingDateField} excluded by date / missing date field).`,
    measureDimensionLine,
    ...(dateWindowLine ? [dateWindowLine] : []),
    ...(compareLine ? [compareLine] : []),
    "",
    `Totals — shipments: ${result.totals.shipments}, volume cbm: ${result.totals.volumeCbm.toFixed(2)}, weight kg: ${result.totals.weightKg.toFixed(1)}, shipping spend: ${result.totals.shippingSpend.toFixed(2)}`,
    "",
    "Top rows:",
  ];
  const top = result.rows.slice(0, 25);
  for (const row of top) {
    const m = row.metrics;
    lines.push(
      `  · ${row.label}: shipments=${m.shipments}, vol=${m.volumeCbm.toFixed(2)} cbm, spend=${m.shippingSpend.toFixed(2)}`,
    );
  }
  if (result.rows.length > top.length) {
    lines.push(`  … and ${result.rows.length - top.length} more rows (open the report in-app for the full table).`);
  }
  lines.push(
    "",
    "A UTF-8 CSV of the full series (all buckets) and a short PDF summary are attached when email delivery is configured.",
    "",
    "—",
    "This message was sent by your PO / Control Tower report schedule.",
  );
  const subjectCore = `${orgLead}${title}`.trim();
  return {
    subject: `[Control Tower] ${truncateEmailOrgName(subjectCore, 920)}`,
    text: lines.join("\n"),
  };
}

function scheduleReportCsvFilename(reportName: string, generatedAt: string): string {
  const slug = reportName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const safe = slug || "report";
  const stamp = generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `ct-${safe}-${stamp}.csv`;
}

function scheduleReportPdfFilename(reportName: string, generatedAt: string): string {
  const slug = reportName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const safe = slug || "report";
  const stamp = generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `ct-${safe}-${stamp}.pdf`;
}

export async function sendScheduledReportEmail(params: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; contentBase64: string }>;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, reason: "missing_RESEND_API_KEY_or_CONTROL_TOWER_REPORTS_EMAIL_FROM" };
  }
  const payload: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject.slice(0, 998),
    text: params.text.slice(0, 100_000),
  };
  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((a) => ({
      filename: a.filename.slice(0, 200),
      content: a.contentBase64,
    }));
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    return { ok: false, reason: `resend_http_${res.status}:${errText}` };
  }
  return { ok: true };
}

export type ReportScheduleCronSummary = {
  checked: number;
  due: number;
  ran: number;
  emailed: number;
  skippedInactiveUser: number;
  skippedNonCtDataset: number;
  emailDeferredNoConfig: number;
  failures: number;
};

/**
 * Invoked by cron (all tenants). Runs due schedules, updates lastRunAt / lastError.
 * Email sends only when `RESEND_API_KEY` and `CONTROL_TOWER_REPORTS_EMAIL_FROM` are set; otherwise lastError notes deferral.
 */
export async function runControlTowerReportScheduleCron(now = new Date()): Promise<ReportScheduleCronSummary> {
  const schedules = await prisma.ctReportSchedule.findMany({
    where: { isActive: true },
    include: {
      savedReport: { select: { id: true, tenantId: true, name: true, dataset: true, configJson: true } },
      user: { select: { id: true, isActive: true } },
    },
  });

  const summary: ReportScheduleCronSummary = {
    checked: schedules.length,
    due: 0,
    ran: 0,
    emailed: 0,
    skippedInactiveUser: 0,
    skippedNonCtDataset: 0,
    emailDeferredNoConfig: 0,
    failures: 0,
  };

  const tenantIds = [...new Set(schedules.map((s) => s.tenantId))];
  const tenantRows =
    tenantIds.length > 0
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
  const tenantNameById = new Map(tenantRows.map((t) => [t.id, t.name]));

  for (const s of schedules) {
    if (!isReportScheduleDue(s, now)) continue;
    summary.due++;

    if (!s.user.isActive) {
      summary.skippedInactiveUser++;
      await prisma.ctReportSchedule.update({
        where: { id: s.id },
        data: {
          lastRunAt: now,
          lastError: "skipped_inactive_schedule_owner",
        },
      });
      continue;
    }
    if (s.savedReport.dataset !== "CONTROL_TOWER") {
      summary.skippedNonCtDataset++;
      await prisma.ctReportSchedule.update({
        where: { id: s.id },
        data: { lastRunAt: now, lastError: "skipped_non_control_tower_dataset" },
      });
      continue;
    }

    try {
      const ctx = await getControlTowerPortalContext(s.userId);
      const result = await runControlTowerReport({
        tenantId: s.tenantId,
        ctx,
        configInput: s.savedReport.configJson,
        actorUserId: s.userId,
      });
      const { subject, text } = formatReportRunForEmail(result, s.savedReport.name, {
        organizationName: tenantNameById.get(s.tenantId),
      });
      const csv = buildControlTowerReportCsv(result);
      const csvB64 = Buffer.from(csv, "utf8").toString("base64");
      const csvFilename = scheduleReportCsvFilename(s.savedReport.name, result.generatedAt);
      const title = result.config.title?.trim() || s.savedReport.name;
      const pdfBytes = await buildControlTowerReportPdfBytes({
        rows: result.rows,
        fullSeriesRows: result.fullSeriesRows,
        totals: result.totals,
        title,
        generatedAt: result.generatedAt,
        shipmentsAggregated: result.coverage.shipmentsAggregated,
        totalShipmentsQueried: result.coverage.totalShipmentsQueried,
        excludedByDateOrMissingDateField: result.coverage.excludedByDateOrMissingDateField,
        organizationLabel: tenantNameById.get(s.tenantId),
        reportMeasure: result.config.measure,
        reportDimension: result.config.dimension,
        reportDateField: result.config.dateField,
        reportDateFrom: result.config.dateFrom,
        reportDateTo: result.config.dateTo,
      });
      const pdfB64 = Buffer.from(pdfBytes).toString("base64");
      const pdfFilename = scheduleReportPdfFilename(s.savedReport.name, result.generatedAt);
      const send = await sendScheduledReportEmail({
        to: s.recipientEmail,
        subject,
        text,
        attachments: [
          { filename: csvFilename, contentBase64: csvB64 },
          { filename: pdfFilename, contentBase64: pdfB64 },
        ],
      });
      summary.ran++;
      if (send.ok) {
        summary.emailed++;
        await prisma.ctReportSchedule.update({
          where: { id: s.id },
          data: { lastRunAt: now, lastError: null },
        });
      } else {
        if (send.reason.startsWith("missing_")) summary.emailDeferredNoConfig++;
        else summary.failures++;
        await prisma.ctReportSchedule.update({
          where: { id: s.id },
          data: { lastRunAt: now, lastError: send.reason.slice(0, 2000) },
        });
      }
    } catch (e) {
      summary.failures++;
      await prisma.ctReportSchedule.update({
        where: { id: s.id },
        data: {
          lastRunAt: now,
          lastError: (e instanceof Error ? e.message : "run_failed").slice(0, 2000),
        },
      });
    }
  }

  return summary;
}

export function parseScheduleFrequency(raw: unknown): CtReportScheduleFrequency | null {
  if (raw === "DAILY" || raw === "WEEKLY") return raw;
  return null;
}

import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { parseScheduleFrequency } from "@/lib/control-tower/report-schedule-delivery";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseHourUtc(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 23) return null;
  return n;
}

function parseDayOfWeek(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  const schedules = await prisma.ctReportSchedule.findMany({
    where: { tenantId: tenant.id, userId: actorId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      savedReportId: true,
      recipientEmail: true,
      frequency: true,
      hourUtc: true,
      dayOfWeek: true,
      isActive: true,
      lastRunAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      savedReport: { select: { name: true } },
    },
  });

  return NextResponse.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      savedReportId: s.savedReportId,
      savedReportName: s.savedReport.name,
      recipientEmail: s.recipientEmail,
      frequency: s.frequency,
      hourUtc: s.hourUtc,
      dayOfWeek: s.dayOfWeek,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      lastError: s.lastError,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const savedReportId = typeof obj.savedReportId === "string" ? obj.savedReportId.trim() : "";
  const recipientEmail = typeof obj.recipientEmail === "string" ? obj.recipientEmail.trim().slice(0, 320) : "";
  const frequency = parseScheduleFrequency(obj.frequency);
  const hourUtc = parseHourUtc(obj.hourUtc);
  const dayOfWeek = parseDayOfWeek(obj.dayOfWeek);

  if (!savedReportId) return toApiErrorResponse({ error: "savedReportId is required.", code: "BAD_INPUT", status: 400 });
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return toApiErrorResponse({ error: "recipientEmail must be a valid address.", code: "BAD_INPUT", status: 400 });
  }
  if (!frequency) return toApiErrorResponse({ error: "frequency must be DAILY or WEEKLY.", code: "BAD_INPUT", status: 400 });
  if (hourUtc == null) return toApiErrorResponse({ error: "hourUtc must be an integer 0–23 (UTC).", code: "BAD_INPUT", status: 400 });
  if (frequency === "WEEKLY" && dayOfWeek == null) {
    return toApiErrorResponse({ error: "dayOfWeek (0–6, UTC weekday) is required for WEEKLY.", code: "BAD_INPUT", status: 400 });
  }
  if (frequency === "DAILY" && dayOfWeek != null) {
    return toApiErrorResponse({ error: "dayOfWeek must be omitted for DAILY.", code: "BAD_INPUT", status: 400 });
  }

  const report = await prisma.ctSavedReport.findFirst({
    where: {
      id: savedReportId,
      tenantId: tenant.id,
      OR: [{ userId: actorId }, { isShared: true }],
      dataset: "CONTROL_TOWER",
    },
    select: { id: true },
  });
  if (!report) {
    return toApiErrorResponse({ error: "Saved report not found, not visible, or not a Control Tower dataset report.", code: "NOT_FOUND", status: 404 });
  }

  const count = await prisma.ctReportSchedule.count({
    where: { tenantId: tenant.id, userId: actorId },
  });
  if (count >= 30) {
    return toApiErrorResponse({ error: "Maximum 30 schedules per user.", code: "BAD_INPUT", status: 400 });
  }

  const created = await prisma.ctReportSchedule.create({
    data: {
      tenantId: tenant.id,
      userId: actorId,
      savedReportId,
      recipientEmail,
      frequency,
      hourUtc,
      dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

import { NextResponse } from "next/server";

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
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

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
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

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

  if (!savedReportId) return NextResponse.json({ error: "savedReportId is required." }, { status: 400 });
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "recipientEmail must be a valid address." }, { status: 400 });
  }
  if (!frequency) return NextResponse.json({ error: "frequency must be DAILY or WEEKLY." }, { status: 400 });
  if (hourUtc == null) return NextResponse.json({ error: "hourUtc must be an integer 0–23 (UTC)." }, { status: 400 });
  if (frequency === "WEEKLY" && dayOfWeek == null) {
    return NextResponse.json({ error: "dayOfWeek (0–6, UTC weekday) is required for WEEKLY." }, { status: 400 });
  }
  if (frequency === "DAILY" && dayOfWeek != null) {
    return NextResponse.json({ error: "dayOfWeek must be omitted for DAILY." }, { status: 400 });
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
    return NextResponse.json(
      { error: "Saved report not found, not visible, or not a Control Tower dataset report." },
      { status: 404 },
    );
  }

  const count = await prisma.ctReportSchedule.count({
    where: { tenantId: tenant.id, userId: actorId },
  });
  if (count >= 30) {
    return NextResponse.json({ error: "Maximum 30 schedules per user." }, { status: 400 });
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

import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { parseScheduleFrequency } from "@/lib/control-tower/report-schedule-delivery";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseHourUtc(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(String(v), 10) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 23) return null;
  return n;
}

function parseDayOfWeekPatch(v: unknown): number | null | undefined | "clear" {
  if (v === undefined) return undefined;
  if (v === null) return "clear";
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(String(v), 10) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });
  const { id } = await params;

  const existing = await prisma.ctReportSchedule.findFirst({
    where: { id, tenantId: tenant.id, userId: actorId },
  });
  if (!existing) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const nextFrequency = obj.frequency !== undefined ? parseScheduleFrequency(obj.frequency) : undefined;
  if (obj.frequency !== undefined && !nextFrequency) {
    return NextResponse.json({ error: "frequency must be DAILY or WEEKLY." }, { status: 400 });
  }
  const frequency = nextFrequency ?? existing.frequency;

  const hourPatch = parseHourUtc(obj.hourUtc);
  if (obj.hourUtc !== undefined && hourPatch === null) {
    return NextResponse.json({ error: "hourUtc must be an integer 0–23." }, { status: 400 });
  }
  const hourUtc = hourPatch ?? existing.hourUtc;

  let dayOfWeek = existing.dayOfWeek;
  if (obj.dayOfWeek !== undefined) {
    const d = parseDayOfWeekPatch(obj.dayOfWeek);
    if (d === null) return NextResponse.json({ error: "dayOfWeek must be 0–6 or null." }, { status: 400 });
    if (d === "clear") dayOfWeek = null;
    else if (typeof d === "number") dayOfWeek = d;
  }

  if (frequency === "WEEKLY" && dayOfWeek == null) {
    return NextResponse.json({ error: "WEEKLY schedules require dayOfWeek (0–6)." }, { status: 400 });
  }
  if (frequency === "DAILY") dayOfWeek = null;

  const recipientEmail =
    typeof obj.recipientEmail === "string"
      ? obj.recipientEmail.trim().slice(0, 320)
      : existing.recipientEmail;
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "recipientEmail must be a valid address." }, { status: 400 });
  }

  const isActive = typeof obj.isActive === "boolean" ? obj.isActive : existing.isActive;

  await prisma.ctReportSchedule.update({
    where: { id },
    data: {
      frequency,
      hourUtc,
      dayOfWeek,
      recipientEmail,
      isActive,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });
  const { id } = await params;

  const del = await prisma.ctReportSchedule.deleteMany({
    where: { id, tenantId: tenant.id, userId: actorId },
  });
  if (del.count === 0) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

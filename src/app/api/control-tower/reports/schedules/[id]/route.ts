import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await params;

  const existing = await prisma.ctReportSchedule.findFirst({
    where: { id, tenantId: tenant.id, userId: actorId },
  });
  if (!existing) return toApiErrorResponse({ error: "Schedule not found.", code: "NOT_FOUND", status: 404 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const nextFrequency = obj.frequency !== undefined ? parseScheduleFrequency(obj.frequency) : undefined;
  if (obj.frequency !== undefined && !nextFrequency) {
    return toApiErrorResponse({ error: "frequency must be DAILY or WEEKLY.", code: "BAD_INPUT", status: 400 });
  }
  const frequency = nextFrequency ?? existing.frequency;

  const hourPatch = parseHourUtc(obj.hourUtc);
  if (obj.hourUtc !== undefined && hourPatch === null) {
    return toApiErrorResponse({ error: "hourUtc must be an integer 0–23.", code: "BAD_INPUT", status: 400 });
  }
  const hourUtc = hourPatch ?? existing.hourUtc;

  let dayOfWeek = existing.dayOfWeek;
  if (obj.dayOfWeek !== undefined) {
    const d = parseDayOfWeekPatch(obj.dayOfWeek);
    if (d === null) return toApiErrorResponse({ error: "dayOfWeek must be 0–6 or null.", code: "BAD_INPUT", status: 400 });
    if (d === "clear") dayOfWeek = null;
    else if (typeof d === "number") dayOfWeek = d;
  }

  if (frequency === "WEEKLY" && dayOfWeek == null) {
    return toApiErrorResponse({ error: "WEEKLY schedules require dayOfWeek (0–6).", code: "BAD_INPUT", status: 400 });
  }
  if (frequency === "DAILY") dayOfWeek = null;

  const recipientEmail =
    typeof obj.recipientEmail === "string"
      ? obj.recipientEmail.trim().slice(0, 320)
      : existing.recipientEmail;
  if (!EMAIL_RE.test(recipientEmail)) {
    return toApiErrorResponse({ error: "recipientEmail must be a valid address.", code: "BAD_INPUT", status: 400 });
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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await params;

  const del = await prisma.ctReportSchedule.deleteMany({
    where: { id, tenantId: tenant.id, userId: actorId },
  });
  if (del.count === 0) return toApiErrorResponse({ error: "Schedule not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json({ ok: true });
}

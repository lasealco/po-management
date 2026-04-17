import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { sanitizeCtReportConfig } from "@/lib/control-tower/report-engine";
import { parseReportDatasetQuery } from "@/lib/reporting/report-dataset";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

function sanitizePersistedReportConfig(input: unknown): Prisma.InputJsonValue {
  return sanitizeCtReportConfig(input) as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

  const datasetFilter = parseReportDatasetQuery(new URL(request.url).searchParams.get("dataset"));

  const reports = await prisma.ctSavedReport.findMany({
    where: {
      tenantId: tenant.id,
      OR: [{ userId: actorId }, { isShared: true }],
      ...(datasetFilter ? { dataset: datasetFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isShared: true,
      configJson: true,
      user: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    meUserId: actorId,
    reports: reports.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isShared: r.isShared,
      owner: r.user,
      config: sanitizePersistedReportConfig(r.configJson),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
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
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const description =
    typeof obj.description === "string" && obj.description.trim() ? obj.description.trim() : null;
  const isShared = obj.isShared === true;
  const config = sanitizePersistedReportConfig(obj.config ?? {});

  const created = await prisma.ctSavedReport.create({
    data: {
      tenantId: tenant.id,
      userId: actorId,
      name: name.slice(0, 120),
      description,
      isShared,
      dataset: "CONTROL_TOWER",
      configJson: config,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: created.id });
}

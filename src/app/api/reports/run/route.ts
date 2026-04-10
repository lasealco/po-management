import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { executeReport } from "@/lib/reports/run-report";

type Body = {
  reportId?: string;
  params?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.reports", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as Body;
  const reportId = (input.reportId ?? "").trim();
  if (!reportId) {
    return NextResponse.json({ error: "reportId is required." }, { status: 400 });
  }

  const out = await executeReport({
    userId: actorId,
    tenantId: tenant.id,
    prisma,
    reportId,
    inputParams: input.params,
  });

  if (!out.ok) {
    const status = out.error.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: out.error }, { status });
  }

  return NextResponse.json({ result: out.result });
}

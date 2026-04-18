import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parsePerformanceScorecardPatchBody } from "@/lib/srm/supplier-performance-scorecard-parse";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; scorecardId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, scorecardId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierPerformanceScorecard.findFirst({
    where: { id: scorecardId, supplierId, tenantId: tenant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const parsed = parsePerformanceScorecardPatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierPerformanceScorecard.update({
    where: { id: scorecardId },
    data: parsed.data,
  });

  return NextResponse.json({
    scorecard: {
      id: row.id,
      periodKey: row.periodKey,
      onTimeDeliveryPct: row.onTimeDeliveryPct?.toString() ?? null,
      qualityRating: row.qualityRating,
      notes: row.notes,
      recordedAt: row.recordedAt.toISOString(),
    },
  });
}

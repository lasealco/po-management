import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parsePerformanceScorecardCreateBody } from "@/lib/srm/supplier-performance-scorecard-parse";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!supplier) {
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

  const parsed = parsePerformanceScorecardCreateBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const row = await prisma.supplierPerformanceScorecard.create({
      data: {
        tenantId: tenant.id,
        supplierId,
        periodKey: parsed.data.periodKey,
        onTimeDeliveryPct: parsed.data.onTimeDeliveryPct,
        qualityRating: parsed.data.qualityRating,
        notes: parsed.data.notes,
      },
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
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : null;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A scorecard for this period already exists. Edit it instead." },
        { status: 409 },
      );
    }
    throw e;
  }
}

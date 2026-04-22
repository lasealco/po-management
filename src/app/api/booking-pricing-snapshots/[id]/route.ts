import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromSnapshotError } from "@/app/api/booking-pricing-snapshots/_lib/snapshot-api-error";
import { serializeBookingPricingSnapshot } from "@/app/api/booking-pricing-snapshots/_lib/serialize-snapshot";
import { requirePricingSnapshotRead } from "@/app/api/booking-pricing-snapshots/_lib/require-pricing-snapshot-access";
import { getBookingPricingSnapshotForTenant } from "@/lib/booking-pricing-snapshot";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePricingSnapshotRead();
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id } = await ctx.params;
  try {
    const row = await getBookingPricingSnapshotForTenant({ tenantId: tenant.id, snapshotId: id });
    return NextResponse.json({
      snapshot: serializeBookingPricingSnapshot(row),
      shipmentBooking: row.shipmentBooking ?? null,
      creator: row.creator ?? null,
    });
  } catch (e) {
    const j = jsonFromSnapshotError(e);
    if (j) return j;
    throw e;
  }
}

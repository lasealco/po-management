import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromSnapshotError } from "@/app/api/booking-pricing-snapshots/_lib/snapshot-api-error";
import { serializeBookingPricingSnapshot } from "@/app/api/booking-pricing-snapshots/_lib/serialize-snapshot";
import {
  requirePricingSnapshotRead,
  requirePricingSnapshotWriteForSource,
} from "@/app/api/booking-pricing-snapshots/_lib/require-pricing-snapshot-access";
import {
  freezeSnapshotFromCompositeContractVersions,
  freezeSnapshotFromContractVersion,
  freezeSnapshotFromQuoteResponse,
  listBookingPricingSnapshotsForTenant,
} from "@/lib/booking-pricing-snapshot";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requirePricingSnapshotRead();
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const url = new URL(request.url);
  const takeRaw = url.searchParams.get("take");
  let take = 200;
  if (takeRaw != null && takeRaw.trim() !== "") {
    const n = Number(takeRaw);
    if (!Number.isFinite(n)) {
      return toApiErrorResponse({ error: "take must be a finite number.", code: "BAD_INPUT", status: 400 });
    }
    take = Math.floor(n);
  }

  const snapshots = await listBookingPricingSnapshotsForTenant({ tenantId: tenant.id, take });
  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      ...serializeBookingPricingSnapshot(s),
      shipmentBooking: s.shipmentBooking,
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const sourceTypeRaw = typeof o.sourceType === "string" ? o.sourceType.trim() : "";
  if (
    sourceTypeRaw !== "TARIFF_CONTRACT_VERSION" &&
    sourceTypeRaw !== "QUOTE_RESPONSE" &&
    sourceTypeRaw !== "COMPOSITE_CONTRACT_VERSION"
  ) {
    return NextResponse.json(
      {
        error:
          "sourceType must be TARIFF_CONTRACT_VERSION, QUOTE_RESPONSE, or COMPOSITE_CONTRACT_VERSION.",
      },
      { status: 400 },
    );
  }

  const writeGate = await requirePricingSnapshotWriteForSource({ sourceType: sourceTypeRaw });
  if (writeGate) return writeGate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const shipmentBookingId =
    typeof o.shipmentBookingId === "string" && o.shipmentBookingId.trim()
      ? o.shipmentBookingId.trim()
      : null;

  try {
    if (sourceTypeRaw === "COMPOSITE_CONTRACT_VERSION") {
      const componentsRaw = o.components;
      if (!Array.isArray(componentsRaw) || componentsRaw.length === 0) {
        return NextResponse.json(
          { error: "components must be a non-empty array of { role, contractVersionId }." },
          { status: 400 },
        );
      }
      const components: { role: string; contractVersionId: string }[] = [];
      for (const item of componentsRaw) {
        if (!item || typeof item !== "object") {
          return NextResponse.json({ error: "Each component must be an object." }, { status: 400 });
        }
        const it = item as Record<string, unknown>;
        const role = typeof it.role === "string" ? it.role.trim() : "";
        const contractVersionId =
          typeof it.contractVersionId === "string" ? it.contractVersionId.trim() : "";
        if (!role || !contractVersionId) {
          return NextResponse.json(
            { error: "Each component needs role and contractVersionId." },
            { status: 400 },
          );
        }
        components.push({ role, contractVersionId });
      }
      const incoterm = typeof o.incoterm === "string" ? o.incoterm.trim() : null;
      const created = await freezeSnapshotFromCompositeContractVersions({
        tenantId: tenant.id,
        incoterm,
        components,
        shipmentBookingId,
        createdByUserId: actorId,
      });
      return NextResponse.json({ snapshot: serializeBookingPricingSnapshot(created) });
    }

    if (sourceTypeRaw === "TARIFF_CONTRACT_VERSION") {
      const contractVersionId =
        typeof o.contractVersionId === "string" ? o.contractVersionId.trim() : "";
      if (!contractVersionId) {
        return NextResponse.json({ error: "contractVersionId is required." }, { status: 400 });
      }
      const created = await freezeSnapshotFromContractVersion({
        tenantId: tenant.id,
        contractVersionId,
        shipmentBookingId,
        createdByUserId: actorId,
      });
      return NextResponse.json({ snapshot: serializeBookingPricingSnapshot(created) });
    }

    const quoteResponseId = typeof o.quoteResponseId === "string" ? o.quoteResponseId.trim() : "";
    if (!quoteResponseId) {
      return NextResponse.json({ error: "quoteResponseId is required." }, { status: 400 });
    }
    const created = await freezeSnapshotFromQuoteResponse({
      tenantId: tenant.id,
      quoteResponseId,
      shipmentBookingId,
      createdByUserId: actorId,
    });
    return NextResponse.json({ snapshot: serializeBookingPricingSnapshot(created) });
  } catch (e) {
    const j = jsonFromSnapshotError(e);
    if (j) return j;
    throw e;
  }
}

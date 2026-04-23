import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { loadPortalLinkedSupplier } from "@/lib/srm/portal-linked-supplier";

/**
 * Self-service: profile summary for the logged-in **Supplier portal** user (linked `Supplier` only).
 * Does not require `org.suppliers` — the actor is the supplier.
 */
export async function GET() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Demo tenant not found. Run `npm run db:seed`." },
      { status: 404 },
    );
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      { error: "Not signed in. Open Settings → Demo session (/settings/demo) or log in." },
      { status: 403 },
    );
  }
  const result = await loadPortalLinkedSupplier(actorId);
  if (!result.ok) {
    if (result.reason === "not_portal") {
      return NextResponse.json(
        { error: "Supplier portal only. This account is not a supplier portal user." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error:
          "No supplier is linked to this user yet. An administrator can set the portal link on the user record.",
        code: result.reason,
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ tenantId: tenant.id, supplier: result.supplier });
}

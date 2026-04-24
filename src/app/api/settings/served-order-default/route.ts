import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  getOrdersServedDefaultPreference,
  setOrdersServedDefaultPreference,
} from "@/lib/orders-served-default-pref";

/**
 * User preference: default "order for" (served) org on PO/SO create (Phase 6). Not a substitute
 * for `servedOrgUnitId` on each document; reduces clicks for centralized buyers.
 */
export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const userId = await getActorUserId();
  if (!userId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const data = await getOrdersServedDefaultPreference(tenant.id, userId);
  return NextResponse.json({
    default: data.defaultOrg,
    preferenceUpdatedAt: data.preferenceUpdatedAt,
  });
}

export async function PUT(request: Request) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const userId = await getActorUserId();
  if (!userId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (!Object.prototype.hasOwnProperty.call(o, "servedOrgUnitId")) {
    return toApiErrorResponse({
      error: "Body must include servedOrgUnitId (string id) or null to clear the default.",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  const raw = o.servedOrgUnitId;
  if (raw === null) {
    // clear
  } else if (typeof raw === "string") {
    if (!raw.trim()) {
      // treat empty string as clear
    }
  } else {
    return toApiErrorResponse({ error: "servedOrgUnitId must be a string id or null.", code: "BAD_INPUT", status: 400 });
  }
  const servedOrgUnitId =
    raw === null ? null : typeof raw === "string" ? (raw.trim() || null) : null;
  try {
    const data = await setOrdersServedDefaultPreference(tenant.id, userId, servedOrgUnitId);
    return NextResponse.json({
      ok: true,
      default: data.defaultOrg,
      preferenceUpdatedAt: data.preferenceUpdatedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save preference.";
    return toApiErrorResponse({ error: msg, code: "BAD_INPUT", status: 400 });
  }
}

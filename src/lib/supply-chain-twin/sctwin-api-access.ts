import { actorIsSupplierPortalRestricted, getViewerGrantSet, type ViewerAccess, viewerHas } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

/** Stable 403 copy when the demo session has no acting user (matches twin API routes). */
export const TWIN_API_ERROR_NO_DEMO_USER =
  "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.";

/** Stable 403 copy when the actor is supplier-portal-restricted (Slice 25). */
export const TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN =
  "Forbidden: Supply Chain Twin is not available for supplier portal sessions.";

/** Stable 403 copy when twin is hidden for this session (grants / nav gate). */
export const TWIN_API_ERROR_VISIBILITY_FORBIDDEN =
  "Forbidden: Supply Chain Twin preview requires broader workspace access than this session has.";

/** Stable 403 copy when tenant/module entitlement gate disables Twin APIs. */
export const TWIN_API_ERROR_MODULE_DISABLED =
  "Forbidden: Supply Chain Twin is not enabled for this tenant.";

/** Stable 403 copy when Twin maintenance routes require elevated admin grant. */
export const TWIN_API_ERROR_ADMIN_FORBIDDEN =
  "Forbidden: Supply Chain Twin maintenance routes require org.settings edit permission.";

export type TwinApiAccessDenied = { status: 403; error: string };

export type TwinApiAccessOk = {
  ok: true;
  access: ViewerAccess & { user: NonNullable<ViewerAccess["user"]> };
};

function parseDisabledTenantSlugs(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0),
  );
}

/**
 * Future-proof entitlement switch for Twin APIs.
 * - `SCTWIN_FORCE_DISABLE=1|true` disables Twin for all tenants.
 * - `SCTWIN_DISABLED_TENANT_SLUGS=a,b,c` disables Twin for specific tenant slugs.
 */
export function isTwinModuleEnabledForTenant(tenantSlug: string): boolean {
  const forceDisable = (process.env.SCTWIN_FORCE_DISABLE ?? "").trim().toLowerCase();
  if (forceDisable === "1" || forceDisable === "true") {
    return false;
  }
  const disabledSlugs = parseDisabledTenantSlugs(process.env.SCTWIN_DISABLED_TENANT_SLUGS);
  return !disabledSlugs.has(tenantSlug.trim().toLowerCase());
}

/**
 * Shared gate for all ` /api/supply-chain-twin/*` handlers: demo user, **not** supplier-portal-only, then twin visibility.
 * Call before reading request bodies so portal sessions never hit downstream parsers.
 */
export async function requireTwinApiAccess(): Promise<TwinApiAccessOk | { ok: false; denied: TwinApiAccessDenied }> {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_NO_DEMO_USER } };
  }

  if (!isTwinModuleEnabledForTenant(access.tenant.slug)) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_MODULE_DISABLED } };
  }

  if (await actorIsSupplierPortalRestricted(access.user.id)) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN } };
  }

  const { linkVisibility } = await resolveNavState(access);
  if (!linkVisibility?.supplyChainTwin) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_VISIBILITY_FORBIDDEN } };
  }

  return { ok: true, access: { ...access, user: access.user } };
}

/**
 * Elevated gate for Twin maintenance/admin routes.
 * Requires standard Twin API access plus `org.settings` `edit` grant.
 */
export async function requireTwinMaintenanceAccess(): Promise<TwinApiAccessOk | { ok: false; denied: TwinApiAccessDenied }> {
  const gate = await requireTwinApiAccess();
  if (!gate.ok) {
    return gate;
  }
  if (!viewerHas(gate.access.grantSet, "org.settings", "edit")) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_ADMIN_FORBIDDEN } };
  }
  return gate;
}

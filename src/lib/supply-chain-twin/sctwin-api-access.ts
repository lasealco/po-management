import { actorIsSupplierPortalRestricted, getViewerGrantSet, type ViewerAccess } from "@/lib/authz";
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

export type TwinApiAccessDenied = { status: 403; error: string };

export type TwinApiAccessOk = {
  ok: true;
  access: ViewerAccess & { user: NonNullable<ViewerAccess["user"]> };
};

/**
 * Shared gate for all ` /api/supply-chain-twin/*` handlers: demo user, **not** supplier-portal-only, then twin visibility.
 * Call before reading request bodies so portal sessions never hit downstream parsers.
 */
export async function requireTwinApiAccess(): Promise<TwinApiAccessOk | { ok: false; denied: TwinApiAccessDenied }> {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false, denied: { status: 403, error: TWIN_API_ERROR_NO_DEMO_USER } };
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

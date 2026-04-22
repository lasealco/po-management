/**
 * API Hub access model — documentation constants only (no runtime enforcement).
 *
 * Handlers live under `src/app/api/apihub/**`. Today, every route except health
 * resolves the demo tenant and demo-actor user before serving.
 *
 * Route inventory: **27** `route.ts` files (public health + guarded); keep aligned with
 * `docs/apihub/permissions-matrix.md` when adding paths.
 *
 * @see docs/apihub/permissions-matrix.md
 */

/** Discovery / deploy probe; handler does not call tenant or actor guards. */
export const APIHUB_PUBLIC_API_PATHS = ["/api/apihub/health"] as const;

/**
 * Human description of the standard guard used by all other API Hub routes:
 * `getDemoTenant()` + `getActorUserId()` (see `@/lib/demo-tenant`, `@/lib/authz`).
 */
export const APIHUB_STANDARD_ROUTE_GUARD =
  "demo_tenant_plus_demo_actor" as const;

/**
 * WE-08 — documented inventory of `/api/wms` authorization vs `requireApiGrant`.
 * Keep aligned with route handlers under `src/app/api/wms/` (nested `route.ts` files).
 */
export const WMS_API_ENDPOINT_ACCESS = [
  {
    id: "api-wms",
    pathPattern: "/api/wms",
    methods: { GET: "view", POST: "edit" } as const,
  },
  {
    id: "api-wms-billing",
    pathPattern: "/api/wms/billing",
    methods: { GET: "view", POST: "edit" } as const,
  },
  {
    id: "api-wms-saved-ledger-views",
    pathPattern: "/api/wms/saved-ledger-views",
    methods: { GET: "view", POST: "edit" } as const,
  },
  {
    id: "api-wms-saved-ledger-views-id",
    pathPattern: "/api/wms/saved-ledger-views/[id]",
    methods: { DELETE: "edit" } as const,
  },
  {
    id: "api-wms-receiving-accrual-staging",
    pathPattern: "/api/wms/receiving-accrual-staging",
    methods: { GET: "view" } as const,
  },
] as const;

export type WmsOrgGrantLevel = "view" | "edit";

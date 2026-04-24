# Read scope inventory & audit (Phase 8)

This note supports **auditing** and **hardening** data reads so we do not rely on `tenantId` alone when org, product-division, customer, or portal rules apply. A full **policy engine** (portable rules, central evaluation) is a **product** follow-on; the app today encodes policy in **typed helpers** and route-level composition.

## Canonical import surface

| Concern | Primary APIs | Note |
|--------|----------------|------|
| Purchase orders, order-linked reads | `getPurchaseOrderScopeWhere`, `purchaseOrderWhereWithViewerScope` in `src/lib/org-scope.ts` (org + **served** `servedOrgUnitId` per Phase 3); **Phase 4** — `assertSendToSupplierServedOrgPolicy` in `src/lib/po-served-org-workflow-policy.ts` (buyer `send_to_supplier` when served org is set) | Also re-exported from `src/lib/viewer-scopes.ts` |
| CRM (owner = user) | `getCrmAccessScope`, `crmOwnerRelationClause`, `crmAccountInScope` in `src/lib/crm-scope.ts` | Re-exported from `viewer-scopes.ts` |
| Control Tower shipments | `getControlTowerPortalContext`, `controlTowerShipmentAccessWhere` in `src/lib/control-tower/viewer.ts` | Re-exported from `viewer-scopes.ts` |
| WMS + inventory + CT shipment for ops | `loadWmsViewReadScope` in `src/lib/wms/wms-read-scope.ts` | Re-exported from `viewer-scopes.ts` |
| Customer portal (hide internal nav) | `actorIsCustomerCrmScoped` in `src/lib/authz.ts` | Re-exported from `viewer-scopes.ts` |
| Delegation (admin) | `src/lib/delegation-guard.ts` | User/role changes, not list reads |
| New code that needs several layers at once | `loadViewerReadScopeBundle` in `src/lib/viewer-scopes.ts` | One call: WMS read scope + PO merge helper + portal flags (bundle does **not** replace every specialized compositor) |

Imports can use either the **concrete** module (e.g. `org-scope`) or the **barrel** `@/lib/viewer-scopes` for discoverability; both are valid.

## Modules with scoped read paths (rollout status)

- **PO / orders API & pages** — `getPurchaseOrderScopeWhere` and supplier-workflow filter where applicable.
- **Control Tower** — `controlTowerShipmentAccessWhere` and related; customer CRM on `User` applies.
- **CRM** — `getCrmAccessScope` on list/detail and conversions as implemented.
- **WMS** — `loadWmsViewReadScope` for dashboard, tasks, billing lists, etc.
- **Executive & reporting cockpits** — `loadWmsViewReadScope`, `purchaseOrderWhereWithViewerScope`, CRM owner scope; see `src/lib/executive/summary.ts`, `src/lib/reporting/cockpit-data.ts`, `src/lib/reports/definitions/*`.
- **Verticals with own guards** — e.g. Supply Chain Twin (`sctwin-api-access`), SCRI, invoice-audit slices — use module-specific access layers; they are **not** required to import `viewer-scopes` for the audit script to be satisfied.

## Advisory audit script

From repo root (informational, exit 0):

```bash
node scripts/read-scope-audit-hints.mjs
```

The script lists `src/app/api/**/route.ts` files that reference **Prisma** and **`tenantId`** but do not contain common **scope import markers** (path substrings and helper names). The list is for **human review**—many results are **expected** (health, auth, tenant-wide admin, cron, module-specific enforcers not matched by the heuristic).

**When to treat a file as a gap:** the handler returns **operational** data (orders, shipments, CRM, WMS, inventory, billing) for a **non–superuser** and filters only by `tenantId`. Fix by applying the right helper from the table above, or by delegating to an existing service that already applies scope.

## Checklist for new list/detail API routes

1. Identify the **entity** and whether org/division, customer, or portal rules apply.
2. Prefer an existing **scoped** data loader from the same module.
3. If multiple dimensions apply, consider `loadViewerReadScopeBundle` or `loadWmsViewReadScope` + `mergePurchaseOrderWhere` from `viewer-scopes.ts`.
4. Run `node scripts/read-scope-audit-hints.mjs` and confirm the new route either appears with scope markers or is explicitly tenant-wide by design.
5. Add or update a **test** for the scoping path if the route is high-risk (PII, cross-customer, financials).

## References

- `docs/icp-and-tenancy.md` — Phase 5–8 roadmap and changelog
- `docs/engineering/USER_ROLES_AND_RBAC.md` — role model vs scoped reads

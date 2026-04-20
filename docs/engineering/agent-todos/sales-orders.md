# Sales orders — agent todo list

**GitHub label:** `module:sales-orders`  
**Typical allowed paths:** `src/app/sales-orders/**`, `src/app/api/sales-orders/**`, `src/components/sales-order*.tsx` (only files clearly tied to sales orders)  
**Grant:** `org.orders` (view/edit) — keep API guards aligned.

**Avoid:** Tariff (`src/app/tariffs/**`, `src/lib/tariff/**`), CRM core, Control Tower, WMS — unless an issue explicitly names a cross-link (e.g. shipment ↔ SO already exists in CT).

**Relationship to tariffs:** **None by default.** Tariffs price contracts/lanes; **sales orders** are commercial/execution documents (`SalesOrder` + shipments). Linking “SO line priced from tariff X” is a **future** cross-slice and should be its own issue.

---

## Suggested slices

- [ ] **List hub:** filters (`?status=`, `?q=`), pagination or “show more”, URL-synced.
- [ ] **Detail:** clearer shipment table + deep links to Control Tower where grants allow.
- [ ] **New SO flow:** validation + step header polish (`WorkflowHeader` pattern).
- [ ] **API:** tighten `GET/PATCH` `sales-orders/[id]` error shapes + tests.
- [ ] **Tests:** Vitest for small pure formatters or API body parsers if extracted to `src/lib/sales-orders/**` (create folder if needed).

# SRM — agent todo list

**GitHub label:** `module:srm`  
**Typical allowed paths:** `src/app/srm/**`, `src/app/suppliers/**` (when SRM-scoped), `src/lib/srm/**`, `src/app/api/**` only SRM-named routes if they exist  
**Avoid:** Unrelated supplier PO flows unless the issue ties them to SRM explicitly.

**Source of truth:** `docs/srm/*.pdf` (sprint plan, blueprint, PRD) + `docs/srm/GAP_MAP.md` (current PDF-to-repo mapping baseline).

---

## Current app baseline (context)

Routes exist: `/srm`, `/srm/new`, `/srm/[id]`, supplier links from suppliers hub. Use issues to extend **depth**, not re-scaffold without cause.

---

## Suggested agent-sized slices (create an issue per checkbox)

- [ ] **Gap doc** — add `docs/srm/GAP_MAP.md` mirroring Control Tower/WMS style (PDF → repo reality table); no behavior change.
- [ ] **Onboarding workflow** — implement next step from `srm_supplier_lifecycle_and_onboarding_spec` (define acceptance in issue).
- [ ] **Permissions matrix** — map `srm_permission_and_visibility_matrix` to `org.*` grants + API guards (one slice at a time).
- [ ] **Compliance / documents** — document control hooks from spec (likely read-only v1).
- [ ] **Performance / KPI** — minimal dashboard or metrics from `srm_performance_risk_and_kpi_spec` (pick one chart/table first).
- [ ] **Integration pack** — one inbound/outbound payload type from `srm_integration_and_api_payload_pack` + tests.

---

## Hygiene

- [ ] Link each merged PR to a line in `docs/srm/GAP_MAP.md` once it exists.
- [x] SRM gap baseline: [`docs/srm/GAP_MAP.md`](../../srm/GAP_MAP.md)
- [x] Issue #13 (`[srm] Meeting batch (~2h): GAP_MAP + list search UX + tests`) maps to `docs/srm/GAP_MAP.md` sections: "Routes and authorization", "Supplier and list/detail usage", and near-term build order item 2.
- [x] SRM permissions matrix slice: shared SRM permission resolver + list/detail order-metrics gating (`org.orders` → view), documented in `docs/srm/GAP_MAP.md` routes/permissions rows.

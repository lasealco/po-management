# SRM — agent todo list

**GitHub label:** `module:srm`  
**Typical allowed paths:** `src/app/srm/**`, `src/app/suppliers/**` (when SRM-scoped), `src/lib/srm/**`, `src/app/api/**` only SRM-named routes if they exist  
**Avoid:** Unrelated supplier PO flows unless the issue ties them to SRM explicitly.

**Source of truth:** `docs/srm/*.pdf` (sprint plan, blueprint, PRD) + `docs/srm/GAP_MAP.md` (current PDF-to-repo mapping baseline).

**Finish program (30 slices):** [`docs/srm/SRM_FINISH_SLICES.md`](../../srm/SRM_FINISH_SLICES.md) — all **30** slices are represented in `GAP_MAP.md` and `SRM_FINISH_SLICES.md`. **Index:** [`docs/srm/GAP_MAP.md` § Completion program](../../srm/GAP_MAP.md#completion-program-srm-mvp) · [MVP sign-off checklist](../../srm/GAP_MAP.md#srm-mvp-sign-off-checklist-reviewers).

---

## Finish program — slice status (update as you merge)

- [x] **Slice 1 — SRM completion index** — `GAP_MAP.md` has **Completion program (SRM MVP)**; this file links the program + index anchor.
- [x] **Slice 2 — Definition-of-done checklist** — `GAP_MAP.md` § **SRM MVP sign-off checklist (reviewers)**.
- [x] **Slice 3 — Slice tracker table** in `GAP_MAP.md`
- [x] **Phase A (slices 4–10)** — UX + `bookingConfirmationSlaHours` + office edit + supplier GET tests (see `GAP_MAP.md` tracker note)
- [x] **Phase B (slices 11–15)** — approval state machine + PO activation guard + onboarding tasks + assignee/due + notification hook stub (`GAP_MAP.md` Phase B note)
- [x] **Phase C (slices 16–20)** — compliance document vault: Prisma + APIs + `/srm/[id]` Compliance tab + audit log + read-only vs edit (`GAP_MAP.md` Phase C note)
- [x] **Phase D (slices 21–24)** — `/srm/analytics` + aggregates + concentration + booking SLA panel + API (`GAP_MAP.md` Phase D note)
- [x] **Phase E (slices 25–28)** — inbound upsert v1 + idempotency + export + `INTEGRATION.md` (`GAP_MAP.md` Phase E note)
- [x] **Phase F (slices 29–30)** — `db:seed:srm-demo` + `docs/database-neon.md`; `GAP_MAP.md` Phase F + blueprint refresh + MVP sign-off (`GAP_MAP.md` Phase F note)

**SRM MVP (finish program scope)** is **signed off in-repo**; use `GAP_MAP.md` for what is deferred beyond MVP.

---

## Current app baseline (context)

Routes exist: `/srm`, `/srm/new`, `/srm/[id]`, supplier links from suppliers hub. Use issues to extend **depth**, not re-scaffold without cause.

---

## Suggested follow-ups (post–finish program; create an issue per item)

- [ ] Deeper **lifecycle** — supplier portal, staged capture, in-app notifications (see PDF specs; out of **SRM MVP** in `SRM_FINISH_SLICES.md`).
- [ ] **Field-level permissions** from `srm_permission_and_visibility_matrix_*.pdf` beyond current `org.*` grants.
- [ ] **Pixel / wireframe parity** with `srm_ux_ui_design_guideline_and_wireframe_pack_*.pdf` where product asks for it.

---

## Hygiene

- [ ] Link each merged PR to a line in `docs/srm/GAP_MAP.md` once it exists.
- [x] SRM gap baseline: [`docs/srm/GAP_MAP.md`](../../srm/GAP_MAP.md)
- [x] Issue #13 (`[srm] Meeting batch (~2h): GAP_MAP + list search UX + tests`) maps to `docs/srm/GAP_MAP.md` sections: "Routes and authorization", "Supplier and list/detail usage", and near-term build order item 2.
- [x] SRM permissions matrix slice: shared SRM permission resolver + list/detail order-metrics gating (`org.orders` → view), documented in `docs/srm/GAP_MAP.md` routes/permissions rows.

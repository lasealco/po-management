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
- [x] **Phase B (slices 11–15)** — approval state machine + PO activation guard + onboarding tasks + assignee/due + notification hook stub; route tests for **`GET`/`PATCH` onboarding-task APIs** (`GAP_MAP.md` Phase B note)
- [x] **Phase C (slices 16–20)** — compliance document vault: Prisma + APIs + `/srm/[id]` Compliance tab + audit log + read-only vs edit; route tests for srm-documents, `[docId]` PATCH/DELETE, and **audit-logs** (`GAP_MAP.md` Phase C note)
- [x] **Phase D (slices 21–24)** — `/srm/analytics` + aggregates + concentration + booking SLA; API tests for **tenant 404**, **date-range 400**, **logistics `bookingSla`**, order-metrics gate (`GAP_MAP.md` Phase D note)
- [x] **Phase E (slices 25–28)** — inbound upsert v1 + idempotency + export + `INTEGRATION.md`; **export** + extended **upsert** route tests (`GAP_MAP.md` Phase E note)
- [x] **Phase F (slices 29–30)** — `db:seed:srm-demo` + `docs/database-neon.md`; GAP/blueprint/`agent-todos` sign-off; **seed file contract** Vitest `srm-demo-seed-file.contract.test.ts` (`GAP_MAP.md` Phase F note)

**SRM MVP (finish program scope)** is **signed off in-repo**; use `GAP_MAP.md` for what is deferred beyond MVP.

**After MVP (not sliced):** optional **5 post-MVP phases (G–K)** — see [`SRM_FINISH_SLICES.md` § Post-MVP](../../srm/SRM_FINISH_SLICES.md) (lifecycle → portal → compliance v2 → KPI/integration depth → enterprise polish). Create issues per row when you prioritize; that is a **separate** program from slices **1–30**.

**Current product priority (post-MVP program):** **G → I → K** (operator lifecycle + notifications, compliance depth, field-level / enterprise polish). **Not** the active focus in this pass: **H** (portal), **J** (KPI/FX/ERP). See **[`docs/srm/SRM_ROADMAP_G_I_K.md`](../../srm/SRM_ROADMAP_G_I_K.md)** for scope tiers, what already exists, and how to run milestones.

---

## Current app baseline (context)

Routes exist: `/srm`, `/srm/new`, `/srm/[id]`, supplier links from suppliers hub. Use issues to extend **depth**, not re-scaffold without cause.

---

## Suggested follow-ups (post–finish program; create an issue per item)

Use the **phase table** in [`SRM_FINISH_SLICES.md` (Post-MVP)](../../srm/SRM_FINISH_SLICES.md) as the index; checkboxes here are a short hand-off:

- [ ] **Phase G** — Deeper **lifecycle** (staged capture, notifications) — **priority 1** · roadmap: [`SRM_ROADMAP_G_I_K` § G](../../srm/SRM_ROADMAP_G_I_K.md) · **G-v1 shipped:** auto-**cleared** when all tasks done, notification unread filter + mark all read · *still open: email / webhooks, richer automation*
- [ ] **Phase H** — **Supplier portal** (external login) — *de-prioritised for G/I/K program;* *(started: `User.portalLinkedSupplierId`, `/srm/portal`, `GET /api/srm/portal/me`)*
- [ ] **Phase I** — **Compliance DMS v2** (beyond vault v1) — **priority 2** · roadmap: [`SRM_ROADMAP_G_I_K` § I](../../srm/SRM_ROADMAP_G_I_K.md) · *(started: revision groups + new-version upload + matrix UI)*
- [ ] **Phase J** — **KPI + integration** depth (FX, more payloads, ERP) — *de-prioritised for G/I/K program;* *(started: operational signals on analytics + integration snapshot)*
- [ ] **Phase K** — **Field-level permissions**, **wireframe parity**, **rules engine** — **priority 3** · roadmap: [`SRM_ROADMAP_G_I_K` § K](../../srm/SRM_ROADMAP_G_I_K.md) · *(started: `canViewSupplierSensitiveFields` + `redact-supplier-sensitive`)*

---

## Hygiene

- [x] **Finish-program slice tracker** — `docs/srm/GAP_MAP.md` lists slices **1–30** with **(landed)** (optional: add GitHub issue/PR per row when you track work in issues).
- [x] SRM gap baseline: [`docs/srm/GAP_MAP.md`](../../srm/GAP_MAP.md)
- [x] Issue #13 (`[srm] Meeting batch (~2h): GAP_MAP + list search UX + tests`) maps to `docs/srm/GAP_MAP.md` sections: "Routes and authorization", "Supplier and list/detail usage", and near-term build order item 2.
- [x] SRM permissions matrix slice: shared SRM permission resolver + list/detail order-metrics gating (`org.orders` → view), documented in `docs/srm/GAP_MAP.md` routes/permissions rows.

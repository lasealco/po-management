# Control Tower + WMS — phased program

**Status:** Living plan. **Does not** replace module sources of truth — it sequences how we advance **Control Tower** and **WMS** in parallel-friendly phases, using existing GAP maps and agent todo files.

| Module | GAP / backlog source | Agent queue |
|--------|----------------------|------------|
| Control Tower | [`docs/controltower/GAP_MAP.md`](../controltower/GAP_MAP.md) | [`agent-todos/control-tower.md`](./agent-todos/control-tower.md) |
| WMS | [`docs/wms/GAP_MAP.md`](../wms/GAP_MAP.md) | [`agent-todos/wms.md`](./agent-todos/wms.md) |

**Out of scope for this document** (track separately): Supply Chain **Twin** program (`docs/sctwin/`), **SRM** G/I/K follow-ups, **tariff** vertical, **product catalog margin / buy–sell analytics**, **telematics / RTCM / GPS asset** platforms, and **full enterprise RBAC** (see `docs/icp-and-tenancy.md`, `agent-todos/system.md`). Those can re-enter as **later** epics once CT/WMS slices are moving.

---

## Program goals (what “as far as we can for now” means)

1. **Reduce blueprint drift** — keep GAP tables honest after each merge ([Control Tower #3](https://github.com/lasealco/po-management/issues/3) pattern).
2. **Ship the smallest next vertical** in each module — one issue per PR, no drive-by refactors.
3. **Leave a clear “next”** when a phase pauses (handoff to Twin or another program).

---

## Phase 0 — Hygiene & alignment (docs + filed issues)

**Goal:** No code required beyond tiny fixes; everything else unblocks clean sequencing.

| # | Action | Status (2026-04-23) |
|---|--------|----------------------|
| 0.1 | Refresh **Control Tower** `GAP_MAP` near-term backlog vs code | **Done** — Changelog + Phase 0 note; near-term **4–7** and **Suggested next PRs** re-affirmed vs `main` ([`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md)) |
| 0.2 | **WMS** `GAP_MAP` — “Last updated” + row notes | **Done** — `_Last updated_` line refreshed; row tables unchanged (no WMS code change in this pass) |
| 0.3 | Triage **Control Tower** filed issues: **#4**–**#6** | **Done** — Triage in [`control-tower.md`](./agent-todos/control-tower.md); close or narrow on GitHub as needed |
| 0.4 | No stray API route trees; **ApiHub** `route.ts` count = test | **Done** — `git ls-files` → **28** = `apihub-routes-conformance.test.ts`; `npm run verify:apihub` **passes**; do not add untracked duplicate route dirs (e.g. `…/health 2/`) that inflate local counts |

**Exit:** GAP + todos reflect reality; open GitHub issues are the execution queue for Phase 1.

**Phase 0 is complete** as of 2026-04-23 — start **Phase 1** with one Control Tower vertical when ready.

---

## Phase 1 — Control Tower: “next PR” verticals (highest leverage partials)

**Source:** [`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md) **Suggested next PRs** and **R3** Assist / reporting / workbench notes.

Work **one issue at a time** (parallel agents only on **non-overlapping paths**). Suggested order is **not** rigid—pick the slice that matches the week’s product bet:

| Priority | Track | What | Why |
|----------|--------|------|-----|
| 1A | **Assist** | Embedding-backed (or vector) retrieval **or** feature-flagged spike; keep keyword fallback | Closes largest **Assist** gap vs PDF; [`GAP_MAP` R3](../controltower/GAP_MAP.md) |
| 1B | **Reporting** | Logo + typography pass on **tabular PDF** (`report-pdf.ts`) | Unlocks branded PDF without a full template engine rewrite |
| 1C | **Workbench** | One more **bulk** operator (e.g. exception owner / ops assignee) *or* server-stored default column visibility | Improves throughput; reuse existing `POST` action + audit patterns |
| 1D | **Report engine** | Exception-aware measures / rates if product wants analytics beyond workbench | [`GAP_map` #7 / suggested PRs](../controltower/GAP_MAP.md#suggested-next-prs) |
| 1E | **Inbound** | Carrier-specific **mapper** example + tests on `inbound-webhook` patterns | Extends real-world integration; [`control-tower.md`](./agent-todos/control-tower.md) |

**Exit:** At least one **1A–1E** item merged per iteration while Phase 0 stays current; Assist / PDF / workbench / inbound each move one step (not “all PDF parity”).

---

## Phase 2 — WMS: Phase A continuation (optional increments + polish)

**Source:** [`wms/GAP_MAP.md`](../wms/GAP_MAP.md) “Near-term build order” + [`wms.md`](./agent-todos/wms.md).

| # | Track | What | GAP / todo |
|---|--------|------|------------|
| 2.1 | **Ledger** | **Saved** ledger / filter **views** (align with Control Tower saved-view UX if product wants) | **Done (2026-04-23)** — `WmsSavedLedgerView` + `/api/wms/saved-ledger-views`; see [`wms/GAP_MAP`](../wms/GAP_MAP.md) |
| 2.2 | **ASN** | **Outbound** ASN parity vs blueprint where rows show 🟡 | WMS agent todos |
| 2.3 | **Receiving** | Deeper **receiving** states — only after a **short spec issue** (state machine) | [`wms/GAP_MAP.md`](../wms/GAP_MAP.md) |
| 2.4 | **UX** | Pick one: **packing / labels**, **wave / replenish** path verification, **dashboard** “At a glance” vs blueprint KPIs | WMS agent todos “UX / ops polish” |

**Deferred (epic-sized, split before code):** appointment scheduling, VAS / work orders, commercial quotes — see [`wms.md` § Gaps](agent-todos/wms.md).

**Exit:** WMS GAP “optional increments” are either **landed** or **explicitly deferred** with a one-line reason in GAP.

---

## Phase 3 — Operations “map” & cross-surface visibility (epic)

**Status (2026-04-23):** **3.1–3.3 done** — [product brief + layers](../engineering/CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md), **Leaflet** + **`product-trace-geo`** (derived pins from booking/leg codes, no `Shipment` lat/lng), **`/control-tower/map`** + **`GET /api/control-tower/map-pins`** with workbench-parity query params. **3.4** (WMS floor / “globe”) still optional.

**Intent:** Your product ask for a **map** (where shipments, orders, **action-required** work sits) is **not** a single checkbox in GAP; it is a **composed experience** that may pull from:

- **Control Tower:** workbench, shipment list, 360, command center, digest, open exceptions/alerts.
- **WMS (warehouse):** existing **bin / rack** grid and zone visualization where 🟡 in GAP.
- **Orders / CRM links** (read-only or deep links) depending on tenant grants.

| Step | Action | Status |
|------|--------|--------|
| 3.1 | **Product brief**: map **layers** (shipments, orders, exception pins?, WMS site?), **tenant grants**, **MVP: read-only + deep links** | **Done** — [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](../engineering/CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) |
| 3.2 | **Spike** — map library + source of truth for coordinates | **Done** — Leaflet (repo); pins from `product-trace-geo` + booking/leg codes |
| 3.3 | **MVP** — `/control-tower/map` reuses workbench list filters, pins + 360 + workbench link | **Done** — subnav **Map**; `shipments-list-query-from-search-params.ts` shared with **`GET …/shipments`** |
| 3.4 | **Iterate** — WMS floor map + CT globe | **Open** (defer until 3.3 adoption) |

**Exit (met for MVP):** Shipped read-only **Control Tower** map behind `org.controltower` **view**; WMS/CRM map layers still future.

---

## Cross-cutting (run alongside any phase, do not block CT/WMS slices)

| Topic | Where to track |
|-------|------------------|
| **RBAC / roles** | [`docs/icp-and-tenancy.md`](../icp-and-tenancy.md), [`agent-todos/system.md`](./agent-todos/system.md) |
| **CI / verify scripts** | `package.json` + `.github/workflows/ci.yml`; module gates like `verify:apihub` |
| **Product analytics** (margin, buy/sell) | New epic: products + orders + sales; **not** this roadmap |

---

## How to use this in Cursor / agents

1. **Pick a phase** (0 → 1 → 2; 3 when product greenlights the epic).
2. **Open one GitHub issue** with: phase id, link to this file + the relevant **GAP row** or **Suggested next PR** line, **allowed paths** from the module agent todo.
3. **Label** `module:tower` or `module:wms` (or both only if the issue says so and paths don’t conflict).
4. **After merge:** update the module **GAP** changelog / near-term list; tick or adjust [`control-tower.md`](./agent-todos/control-tower.md) / [`wms.md`](./agent-todos/wms.md).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | **Phase 0 complete** (docs + GAP + ApiHub/verify gate); see Phase 0 table above. |
| 2026-04-23 | **Phase 2.1 (WMS) — saved ledger views:** `WmsSavedLedgerView` + `/api/wms/saved-ledger-views`, `wms/GAP_MAP.md` + `wms.md` updated. |
| 2026-04-23 | **Phase 3 (CT operations map) MVP:** `/control-tower/map`, `GET /api/control-tower/map-pins`, `CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`, `controltower/GAP_MAP.md` R3 + route table. |
| 2026-04-23 | Initial phased roadmap for Control Tower + WMS (phases 0–3 + cross-cutting). |

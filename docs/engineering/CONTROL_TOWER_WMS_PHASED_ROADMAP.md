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

| # | Action | Status (2026-04-25) |
|---|--------|----------------------|
| 0.1 | Refresh **Control Tower** `GAP_MAP` near-term backlog vs code | **Done** — Re-checked near-term **4–7** + **Suggested next PRs** vs `main` ([`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md)); changelog line added |
| 0.2 | **WMS** `GAP_MAP` — “Last updated” + row notes | **Done** — `_Last updated_` line refreshed; row tables unchanged (no WMS code change) |
| 0.3 | Triage **Control Tower** filed issues: **#4**–**#6** | **Done (standing)** — Handoff in [`control-tower.md`](./agent-todos/control-tower.md); maintainers close or narrow on GitHub as needed |
| 0.4 | No stray API route trees; **ApiHub** `route.ts` count = test | **Done** — `APIHUB_ROUTE_TS_EXPECTED_COUNT` **28** = `git ls-files` count; `npm run verify:apihub` **passes**; no `* 2` duplicate route paths under `src/app/api` |

**Exit:** GAP + todos reflect reality; open GitHub issues are the execution queue for Phase 1.

**Phase 0 re-pass (2026-04-25):** hygiene verified; no CT code change. **Start Phase 1** when ready (one vertical: Assist 1A, Reporting 1B, Workbench 1C, report engine 1D, or inbound 1E per [`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md#suggested-next-prs)).

---

## Phase 1 — Control Tower: “next PR” verticals (highest leverage partials)

**Source:** [`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md) **Suggested next PRs** and **R3** Assist / reporting / workbench notes.

Work **one issue at a time** (parallel agents only on **non-overlapping paths**). Suggested order is **not** rigid—pick the slice that matches the week’s product bet.

**Assist vs the search/chatbot PDF (architecture reality):** The biggest product gap to `control_tower_search_and_chatbot_spec_*.pdf` is **Assist + RAG + tools + multi-turn sessions** (see [`controltower/GAP_MAP.md`](../controltower/GAP_MAP.md) **R3** + [issue #6](https://github.com/lasealco/po-management/issues/6)). The **right engineering path** is still **one Phase 1 vertical per PR** along **1A → 1B → 1C → 1D → 1E** (or a deliberate swap for the week’s bet)—**not** a monolithic “chatbot v2” that tries to close the whole PDF in one change set.

| Priority | Track | What | Why |
|----------|--------|------|-----|
| 1A | **Assist** | ~~Embedding-backed retrieval~~ **Landed 2026-04-25:** `assist-retrieval-embed.ts` + `CONTROL_TOWER_ASSIST_EMBEDDINGS=1` + `OPENAI_API_KEY`; keyword fallback | Next: tools / re-rank / chunking per [`GAP_MAP` R3](../controltower/GAP_MAP.md) |
| 1B | **Reporting** | ~~Logo + typography pass on **tabular PDF** (`report-pdf.ts`)~~ **Landed 2026-04-23:** `report-pdf-logo` API + in-app **Download PDF** fetches same raster as cron; table/header typography + light banding | Unlocks branded PDF without a full template engine rewrite |
| 1C | **Workbench** | ~~One more **bulk** operator (ops assignee) *or* server-stored default column visibility~~ **Landed 2026-04-23:** `bulk_update_shipment_ops_assignee` + workbench UI + `GET …/workbench-assignees` | **Next:** exception-owner bulk or default columns per actor |
| 1D | **Report engine** | ~~**`openExceptionRatePct`** + exports/builder~~ **Landed 2026-04-25** | **Next:** rootCause/NC in reports ([`GAP` #7](../controltower/GAP_MAP.md#near-term-build-order-engineering-backlog)) |
| 1E | **Inbound** | ~~**`sea_port_track_v1`** + `inbound-carrier-mappers.ts` + tests~~ **Landed 2026-04-25** | **Next:** next carrier contract in same module pattern ([`GAP` R4](../controltower/GAP_MAP.md#r4--integrations--source-of-truth-pdf-integration--payload-packs)) |

**Exit:** At least one **1A–1E** item merged per iteration while Phase 0 stays current; Assist / PDF / workbench / inbound each move one step (not “all PDF parity”).

---

## Phase 2 — WMS: Phase A continuation (optional increments + polish)

**Source:** [`wms/GAP_MAP.md`](../wms/GAP_MAP.md) “Near-term build order” + [`wms.md`](./agent-todos/wms.md).

| # | Track | What | GAP / todo |
|---|--------|------|------------|
| 2.1 | **Ledger** | **Saved** ledger / filter **views** (align with Control Tower saved-view UX if product wants) | **Done (2026-04-23)** — `WmsSavedLedgerView` + `/api/wms/saved-ledger-views`; see [`wms/GAP_MAP`](../wms/GAP_MAP.md) |
| 2.2 | **ASN** | **Outbound** ASN parity vs blueprint | **Done (2026-04-25)** — `OutboundOrder.asnReference` + `requestedShipDate` in `GET /api/wms` + `set_outbound_order_asn_fields` + create optional fields; WMS **Outbound flow** UI |
| 2.3 | **Receiving** | Deeper **receiving** states — only after a **short spec issue** (state machine) | [`wms/GAP_MAP.md`](../wms/GAP_MAP.md) |
| 2.4 | **UX** | Pick one: **packing / labels**, **wave / replenish** path verification, **dashboard** “At a glance” vs blueprint KPIs | **Replenish slice done (2026-04-25):** `GET /api/wms` `openTasks[].sourceBin` for REPLENISH + **From → To** in Operations; setup hint. **optional:** packing/labels, dashboard KPI depth — [`wms.md`](../agent-todos/wms.md) |

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
| 3.4 | **Iterate** — WMS floor map + CT globe + **cross-surface** deep links | **Partial (2026-04-25):** dual-grant **WMS ↔ map** entry points; floor / globe still open — [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](../CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) |

**Exit (met for MVP):** Shipped read-only **Control Tower** map behind `org.controltower` **view**; WMS/CRM map layers still future.

---

## Cross-cutting (run alongside any phase, do not block CT/WMS slices)

| Topic | Where to track |
|-------|------------------|
| **RBAC / roles** | [`docs/icp-and-tenancy.md`](../icp-and-tenancy.md), [`agent-todos/system.md`](./agent-todos/system.md) |
| **CI / verify scripts** | `package.json` + `.github/workflows/ci.yml`; module gates like `verify:apihub` |
| **Product analytics** (margin, buy/sell) | New epic: products + orders + sales; **not** this roadmap |

---

## Program tranche handoff (2026-04-26)

**Intent:** “Closing gaps” in this repo does **not** mean every 🟡 row in the PDF **GAP** tables is enterprise-complete — the maps are **evergreen** (MVP + deferred). This section records what is **closed for the current program line** (merged on `main` + honest docs) so the team can **move on**; remaining work is **backlog** (issues), not a hidden failure state.

| Area | Status for this tranche |
|------|-------------------------|
| **Phase 0** | **Closed** — hygiene, GAP re-checks, `npm run verify:apihub` (see Phase 0 table). |
| **Control Tower Phase 1 (1A–1E)** | **Closed** — per roadmap table (Assist embeddings, report PDF pass, workbench bulk + assignee API, `openExceptionRatePct`, `sea_port_track_v1` + mapper + tests). |
| **CT GAP near-term 1–4** | **Closed** — (1) GAP living doc, (2) exception catalog + API, (3) inbound webhooks + formats + tests, (4) Assist: read-only `postActionToolCatalog` on assist + Search. |
| **WMS Phase 2 (tracked slices)** | **Closed** for **2.1** (saved ledger), **2.2** (outbound ASN), **2.4** REPLENISH **source → target** in open tasks. **Not** 2.3 (receiving state machine — spec first). |
| **Phase 3 (map)** | **MVP + partial 3.4 closed** — `/control-tower/map`, `map-pins`, dual-grant WMS↔map links. **Open:** floor / globe / CRM map layers. |
| **Sequencing policy** | **Closed in docs** — Phase 1 vertical PRs vs full chatbot PDF; no monolithic “chatbot v2.” |

**Explicit backlog (not blockers to exit this tranche):** Assist **audited tool calls** (suggested next PR), full **chatbot / sessions / PDF** parity ([issue #6](https://github.com/lasealco/po-management/issues/6), GAP R3, near-term **#5–#7**), report per-row exception analytics ([issue #5](https://github.com/lasealco/po-management/issues/5)), WMS **2.3** + optional polish (packing, dashboard), deferred **❌** epics in `wms/GAP_MAP` (appointments, VAS, commercial quotes), Phase **3.4** floor/globe.

**Next step:** file **new** GitHub issues for any backlog line you schedule; the phased **0→3** line as documented here is **handed off**.

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
| 2026-04-26 | **Program tranche handoff:** table **“closed vs backlog”** (Phases 0–3, near-term 1–4, WMS 2.1/2.2/2.4). |
| 2026-04-25 | **Near-term #4 slice:** `postActionToolCatalog` on **`POST …/assist`** + Search UI (`assist-tool-catalog.ts`); `controltower/GAP_MAP`. |
| 2026-04-25 | **Phase 1 doc:** Assist/chatbot PDF gap vs **1A→1E vertical PRs** (avoid monolithic chatbot v2). |
| 2026-04-25 | **Control Tower Phase 3.4 (partial):** `/wms` → shipment map and `/control-tower/map` → WMS when dual grants; `CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`. |
| 2026-04-25 | **WMS Phase 2.4 (REPLENISH UX):** `openTasks` includes `sourceBin` for **From → To** in open tasks; `wms/GAP_MAP.md` R2 replenishment. |
| 2026-04-25 | **WMS Phase 2.2 (Outbound ASN):** `asnReference` on `OutboundOrder`, `set_outbound_order_asn_fields`, WMS operations UI + payload; `wms/GAP_MAP.md`. |
| 2026-04-25 | **Control Tower Phase 1A:** optional OpenAI **embedding hybrid** for assist (`assist-retrieval-embed.ts`); see `controltower/GAP_MAP.md`. |
| 2026-04-25 | **Control Tower Phase 1E (Inbound):** `sea_port_track_v1` + `inbound-carrier-mappers.ts`, tests, assist snippet. See `controltower/GAP_MAP.md`. |
| 2026-04-25 | **Control Tower Phase 1D (Report engine):** `openExceptionRatePct` measure, CSV/PDF/scheduled email, report builder template. See `controltower/GAP_MAP.md`. |
| 2026-04-23 | **Control Tower Phase 1C (Workbench):** `bulk_update_shipment_ops_assignee`, `GET /api/control-tower/workbench-assignees`, workbench **Ops assignee** bulk. See `controltower/GAP_MAP.md`. |
| 2026-04-23 | **Control Tower Phase 1B (Reporting / PDF):** `GET /api/control-tower/report-pdf-logo`; report builder **Download PDF** includes optional env logo; `report-pdf.ts` table/header styling pass. See `controltower/GAP_MAP.md`. |
| 2026-04-25 | **CT + WMS Phase 0 re-pass (docs + verify):** `controltower/GAP_MAP` + WMS GAP “last updated”; `npm run verify:apihub` + `APIHUB_ROUTE_TS_EXPECTED_COUNT` **28**; no duplicate `* 2` API routes. |
| 2026-04-23 | **Phase 0 complete** (docs + GAP + ApiHub/verify gate); see Phase 0 table above. |
| 2026-04-23 | **Phase 2.1 (WMS) — saved ledger views:** `WmsSavedLedgerView` + `/api/wms/saved-ledger-views`, `wms/GAP_MAP.md` + `wms.md` updated. |
| 2026-04-23 | **Phase 3 (CT operations map) MVP:** `/control-tower/map`, `GET /api/control-tower/map-pins`, `CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`, `controltower/GAP_MAP.md` R3 + route table. |
| 2026-04-23 | Initial phased roadmap for Control Tower + WMS (phases 0–3 + cross-cutting). |

# SCRI — Implementation workbook (phased)

This workbook ties the **documentation pack** in `docs/SCRI/` to **concrete build work**. Use it as a execution checklist; update it as you ship.

---

## 1. Do we have “full” documentation?

**Yes, for product definition.** The pack covers vision, PRD-level screens, data model targets, matching dimensions, integrations, AI/scoring intent, workflows, UX wireframe notes, and a release-shaped backlog.

**What is “missing” is not more narrative docs** — it is **implementation and data** for everything after the thin vertical slice already in code (see baseline below).

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Pack index, R1–R7 build order |
| [supply_chain_risk_intelligence_blueprint_and_module_definition.md](./supply_chain_risk_intelligence_blueprint_and_module_definition.md) | Vision, event families, principles |
| [supply_chain_risk_intelligence_functional_prd.md](./supply_chain_risk_intelligence_functional_prd.md) | Screens, flows |
| [supply_chain_risk_intelligence_data_model_and_matching_spec.md](./supply_chain_risk_intelligence_data_model_and_matching_spec.md) | Entities, matching dimensions |
| [supply_chain_risk_intelligence_integrations_spec.md](./supply_chain_risk_intelligence_integrations_spec.md) | External/internal I/O, pipeline rules |
| [supply_chain_risk_intelligence_workflow_and_business_rules.md](./supply_chain_risk_intelligence_workflow_and_business_rules.md) | Triage, ownership, dismissal |
| [supply_chain_risk_intelligence_ai_and_risk_scoring_spec.md](./supply_chain_risk_intelligence_ai_and_risk_scoring_spec.md) | Summaries, scoring, explanations |
| [supply_chain_risk_intelligence_ux_ui_and_wireframes.md](./supply_chain_risk_intelligence_ux_ui_and_wireframes.md) | UX structure |
| [supply_chain_risk_intelligence_sprint_backlog_and_release_plan.md](./supply_chain_risk_intelligence_sprint_backlog_and_release_plan.md) | R1–R7 outcomes |
| [cursor_supply_chain_risk_intelligence_prompt_sequence.md](./cursor_supply_chain_risk_intelligence_prompt_sequence.md) | Agent-oriented build sequence |
| `archive/*.zip` | Frozen dev pack snapshot |

---

## 2. Baseline in repo (today)

**Database (Prisma):** `ScriExternalEvent`, `ScriEventSource`, `ScriEventGeography`, `ScriEventAffectedEntity`, `ScriEventReviewState` on the event row.

**API:** `GET/POST /api/scri/events`, `GET /api/scri/events/[id]`, `POST /api/scri/events/[id]/match`.

**UI:** `/risk-intelligence` list, `/risk-intelligence/[id]` detail, manual **Run network match**.

**Matching (R2 partial):** Deterministic geo-related pass over shipments (booking/legs), PO ship-to, supplier country, linked sales orders — see `src/lib/scri/matching/run-event-match.ts`.

**Schema additions after baseline:** **Recommendation** (`ScriEventRecommendation`), **Triage audit** (`ScriEventReviewLog`), **Task links** (`ScriEventTaskLink`), **R7 tuning** (`ScriTenantTuning`, `ScriWatchlistRule`). Legacy workbook note above is historical.

---

## 3. How to use this workbook

- Work **top to bottom** within a phase before expanding scope.
- After each task, tick the box and (if useful) add a one-line note (PR link, date).
- When a spec and code disagree, **treat the spec as target** unless you explicitly decide to defer (document the deferral in this file).

---

## Phase A — Harden R1 (event feed foundation)

**Outcome (backlog):** Ingest and display supply-chain-relevant external events with trustworthy metadata.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Ingest:** Idempotent `ingestKey`, validate payload vs `ingest-body` schema; surface validation errors clearly | `400` returns `fieldErrors`, `formErrors`, `issues`; see `ingest-validation.ts` |
| [x] | **Sources:** Ensure multi-source events persist `ScriEventSource` rows when API sends them; show count + list on detail | Already in `apply-ingest`; detail shows publisher + count |
| [x] | **Geography:** Normalize country / UN/LOC / region in ingest or on write; document required fields for matching | `normalize-ingest-geography.ts`; invalid ISO-2 stored in `raw.invalidCountryCode` |
| [x] | **Classification:** Event type vocabulary aligned with blueprint “Event Families”; avoid unbounded free text in UI | `event-type-taxonomy.ts` + Zod enum on ingest; UI uses labels |
| [x] | **Clustering / dedup:** Define `clusterKey` behavior (when set, UI grouping); optional background job to merge duplicates | Feed: cluster badge + `?cluster=` filter; `GET ?clusterKey=` on API |
| [x] | **Feed UX:** Event cards show severity, confidence, freshness, geography, impacted counts (from R2) | `formatScriFreshness`, source count, trust %, type labels |
| [x] | **Ops visibility:** Log or table for failed ingest / match (per integrations spec) | Structured JSON line on ingest 500 (`module: scri`, `ingestKey`); DB table deferred |

---

## Phase B — Complete R2 (internal relevance matching)

**Outcome:** Connect events to internal exposure with rationale; counts roll up to feed and dashboard.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Geo / flow match (v1):** Deterministic pass for shipments, legs, PO ship-to, supplier country, sales order links | `run-event-match.ts` |
| [x] | **Matching:** Extend to additional object types in spec (sites/warehouses, inventory nodes, lanes as first-class) where data exists | `WAREHOUSE`, `INVENTORY_BALANCE`; UN/LOC via legs/booking |
| [x] | **Caps & performance:** Replace fixed scan caps with indexed queries or tenant-scoped windows; document limits | `resolve-shipment-candidates.ts`, `run-event-match-limits.ts` |
| [x] | **Tentative matches:** Low-confidence or partial geo match flagged in UI (`matchConfidence`, copy) | `scriMatchTier` + detail badge |
| [x] | **Impact levels:** Consistent `impactLevel` semantics and display | PORT_UNLOC → HIGH; labels on DTO + detail |
| [x] | **Re-run rules:** When ingest updates geographies, auto-queue or prompt re-match; define idempotency | `autoRematch` default true + `geographies` non-empty; `runMatch` forces |

---

## Phase C — R3 Triage and workflow

**Outcome:** Users operationalize events (watch, dismiss, assign, tasks, notifications).

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Review API + UI:** PATCH event `reviewState`; optional owner assignment (user id) | `PATCH /api/scri/events/[id]`; `ScriTriagePanel` on detail |
| [x] | **Audit trail:** Append-only triage history (who, when, decision, note) — new table per data model | `ScriEventReviewLog` + “Triage log” on detail |
| [x] | **Tasks:** Link events to existing task/workflow module via `task_ref` | `POST /api/scri/events/[id]/task-links`; `ScriEventTaskLink` |
| [x] | **Notifications:** Hook to platform notifications for ACTION_REQUIRED / escalation | `scri-notification-hook.ts` structured log (provider TBD) |

---

## Phase D — R4 AI summaries and explanations

**Outcome:** Faster comprehension; clear separation of facts vs interpretation.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Populate `aiSummary`:** Batch or on-ingest pipeline with guardrails | Ingest: optional `aiSummary` (CONNECTOR); else `build-deterministic-ai-summary` (DETERMINISTIC_V1); `aiSummary: null` clears |
| [x] | **Detail UI:** Distinct blocks for source text, structured payload, AI summary | Ingest narrative → primary sources (+ excerpt) → geography → AI-assisted summary (provenance label) |
| [x] | **Rationale:** Surface match `rationale` strings in impact panel | Exposure section intro + per-row rationale (existing) |

---

## Phase E — R5 Recommendation layer

**Outcome:** Decision support — accept / reject / snooze suggestions.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Schema:** `ScriEventRecommendation` + `ScriRecommendationStatus` (ACTIVE / ACCEPTED / REJECTED / SNOOZED) | Migration `20260522123000_scri_r5_recommendations` |
| [x] | **Engine v0:** Deterministic rules from severity, event type, R2 rollup; full replace on each R2 run | `build-deterministic-recommendations`, `run-event-match` |
| [x] | **API:** `PATCH /api/scri/recommendations/[id]` (status + optional note); clears recs when R2 exits early (no geo) | |
| [x] | **UI:** Embedded panel on event detail (accept / reject / snooze) | `/risk-intelligence/[id]` |

---

## Phase F — R6 Twin integration

**Outcome:** Launch scenario from event; seed twin impact.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Contract:** `twin_scenario_seed_from_scri_v1` draft JSON + stable risk `code` `SCRI:<ingestKey>` + ingest `scri_scenario_launch` | `src/lib/scri/twin-bridge/scri-twin-scenario-contract.ts`, `build-twin-scenario-draft-from-scri-event.ts` |
| [x] | **API:** `POST /api/scri/events/[id]/twin-scenario` (requires `org.scri` edit + twin session gate) | Upserts risk signal, creates scenario draft + revision, append ingest |
| [x] | **UI:** “Launch twin scenario” on event detail | `ScriTwinLaunchPanel` on `/risk-intelligence/[id]` |

---

## Phase G — R7 Tuning and automation

**Outcome:** Customer-specific relevance and controlled automation.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Watchlists:** `ScriWatchlistRule` CRUD + Settings UI; feed badge when event matches an active rule | `watchlist-repo`, `/settings/risk-intelligence`, `POST/PATCH/DELETE /api/scri/watchlist-rules` |
| [x] | **Trust / sensitivity:** `ScriTenantTuning` — source trust floor, severity highlight, `geoAliases` JSON (applied at ingest via `normalizeIngestGeography`) | `GET/PATCH /api/scri/tuning` |
| [x] | **Automation:** Optional NEW→WATCH when severity ≥ `automationMinSeverity`, with `automationActorUserId` triage log; env kill `SCR_AUTOMATION_DISABLED=1` | `maybe-auto-watch-after-ingest.ts` |

---

## Phase H — Dashboard and cross-module outputs

**Outcome:** Module delivers value outside the event list (executive and ops surfaces).

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [x] | **Dashboard:** `/risk-intelligence/dashboard` — severity distribution, critical 30d, watchlist sample match count, tuning signals, R2 impact by object type (30d) | `dashboard-aggregates.ts`, `GET /api/scri/dashboard` |
| [x] | **Impact workspace:** Tabbed `ScriImpactWorkspace` on event detail (by object type) | `/risk-intelligence/[id]` |
| [x] | **Downstream (CT):** `POST /api/scri/events/[id]/control-tower-alert` creates `CtAlert` type `SCRI_EVENT` on top matched shipment (`org.scri` edit + `org.controltower` edit) | UI: `ScriCtAlertButton` |
| [ ] | **PO/supplier row flags:** Deferred (no `PurchaseOrder` / `Supplier` columns in this slice); use R2 links + dashboard aggregates instead |

---

## 4. Suggested sequencing

1. **Phase A** until ingest + feed are trustworthy.  
2. **Phase B** until matching coverage matches your network data reality.  
3. **Phase C** when events need operational ownership.  
4. **Phases D–E** in parallel only if you have AI/recommendation capacity; otherwise D then E.  
5. **Phase F** when Twin APIs are stable.  
6. **Phase G** after real user feedback.  
7. **Phase H** continuously, but prioritize **dashboard aggregates** once R2 counts are reliable.

---

## 5. Maintaining this workbook

- After each release, mark phases done or split deferred items into a “Parking lot” section.
- If the canonical spec changes, update the **Baseline** section and task rows so newcomers are not misled.

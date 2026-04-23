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

**Not in schema yet (per data model spec):** dedicated tables for **Watchlist Rule**, **Recommendation**, **Event Review / Triage audit rows**, **Event Task Link** (today, `reviewState` is only a field on the event).

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
| [ ] | **Matching:** Extend to additional object types in spec (sites/warehouses, inventory nodes, lanes as first-class) where data exists | Data model: Supply / Flow / Demand match |
| [ ] | **Caps & performance:** Replace fixed scan caps with indexed queries or tenant-scoped windows; document limits | Matching spec |
| [ ] | **Tentative matches:** Low-confidence or partial geo match flagged in UI (`matchConfidence`, copy) | Matching spec: tentative |
| [ ] | **Impact levels:** Consistent `impactLevel` semantics and display | `ScriEventAffectedEntity.impactLevel` |
| [ ] | **Re-run rules:** When ingest updates geographies, auto-queue or prompt re-match; define idempotency | Integrations |

---

## Phase C — R3 Triage and workflow

**Outcome:** Users operationalize events (watch, dismiss, assign, tasks, notifications).

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Review API + UI:** PATCH event `reviewState`; optional owner assignment (user id) | PRD: Triage Workspace |
| [ ] | **Audit trail:** Append-only triage history (who, when, decision, note) — new table per data model | Data model: Event Review / Triage |
| [ ] | **Tasks:** Link events to existing task/workflow module via `task_ref` | Data model: Event Task Link |
| [ ] | **Notifications:** Hook to platform notifications for ACTION_REQUIRED / escalation | Backlog R3 |

---

## Phase D — R4 AI summaries and explanations

**Outcome:** Faster comprehension; clear separation of facts vs interpretation.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Populate `aiSummary`:** Batch or on-ingest pipeline with guardrails | AI spec |
| [ ] | **Detail UI:** Distinct blocks for source text, structured payload, AI summary | UX: Event Detail |
| [ ] | **Rationale:** Surface match `rationale` strings in impact panel | UX principles |

---

## Phase E — R5 Recommendation layer

**Outcome:** Decision support — accept / reject / snooze suggestions.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Schema:** `Recommendation` table + status lifecycle | Data model |
| [ ] | **Engine v0:** Rule-based recommendations from event type + impacted object classes | Backlog R5 |
| [ ] | **UI:** Recommendation Center or embedded panel on event | PRD |

---

## Phase F — R6 Twin integration

**Outcome:** Launch scenario from event; seed twin impact.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Contract:** Define payload from SCRI event to Twin scenario create API | Integrations: twin scenario seeds |
| [ ] | **UI:** “Launch scenario” from event detail / triage | UX: Triage Workspace |

---

## Phase G — R7 Tuning and automation

**Outcome:** Customer-specific relevance and controlled automation.

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Watchlists:** `Watchlist Rule` CRUD + subscription center UI | Data model + PRD |
| [ ] | **Trust / sensitivity:** Source trust weights, severity thresholds, geography aliases | PRD: Settings / Tuning |
| [ ] | **Automation hooks:** Optional auto-watch, auto-task rules (feature-flagged) | Backlog R7 |

---

## Phase H — Dashboard and cross-module outputs

**Outcome:** Module delivers value outside the event list (executive and ops surfaces).

| Done | Task | Notes / spec pointer |
|------|------|----------------------|
| [ ] | **Dashboard:** Critical events, watchlist, impacted shipments/POs/orders/suppliers aggregates | PRD: Risk Intelligence Dashboard |
| [ ] | **Impact workspace:** Tabbed drill-down from event to object lists | PRD: Impact Workspace |
| [ ] | **Downstream:** Control Tower alerts, PO/supplier flags per integrations spec | Integrations: Internal Outputs |

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

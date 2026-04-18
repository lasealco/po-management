# Control Tower — blueprint ↔ codebase gap map

**Purpose:** Single place to see how **PDF specs** in `docs/controltower/` map to **this repo** (`src/app/control-tower`, `src/lib/control-tower`, `src/components/control-tower-*`, `/api/control-tower/*`, Prisma `Ct*` / shipment booking models). Use it like `docs/wms/GAP_MAP.md` for planning and PR scope.

**Legend:** ✅ covered · 🟡 partial / demo-first · ❌ not wired or intentionally out of scope

**Phase note:** The app ships a **credible demo + internal ops depth** slice. PDFs describe **enterprise** depth (integration mesh, full event bus, customer portals at scale). Treat ❌ as “not here yet,” not “forgotten.”

---

## R1 — Visibility, workbench, shipment workspace, permissions

| Blueprint / PRD area | Repo reality | Notes |
|----------------------|--------------|--------|
| Tenant isolation | ✅ `tenantId` on CT entities; shipment via `order.tenantId` | Same tenant model as PO/WMS |
| Role gates | ✅ `org.controltower` → `view` / `edit`; supplier portal + `User.customerCrmAccountId` scope | `src/lib/authz.ts`, `viewer.ts`, API `requireApiGrant` |
| Overview / KPI strip | ✅ `/control-tower` + `getControlTowerOverview` + API `GET /api/control-tower/overview`; **restricted** hub adds **Shipment digest** shortcut card (`lg:grid-cols-3` for six tiles); hub header **Reporting hub** + **Workbench** | `control-tower-dashboard.tsx`, `control-tower/page.tsx`, pinned widgets shell |
| Tracking workbench | ✅ List, filters (incl. **open exception code** + **open alert type**), CSV (**`# …` metadata line** when **`truncated`**), saved views, **column visibility** (localStorage + optional per saved view); **`GET …/shipments`** returns **`listLimit`** / **`itemCount`** / **`truncated`**; workbench + command center show an **amber cap** when truncated; workbench page header **Reporting hub** (`?focus=control-tower`) for all portal scopes | `list-shipments.ts`, `control-tower-workbench.tsx`, `control-tower-command-center.tsx`, `workbench-column-prefs.ts`, `saved-filters` API; assist snippet **`saved-workbench-views`** |
| Shipment 360 | ✅ Tabs: details, booking, milestones, legs, containers, refs, alerts, exceptions, docs, notes, finance, audit, …; page chrome **Workbench** (this shipment) + **Reporting hub** | `shipment-360.ts`, `control-tower-shipment-360.tsx`; assist **`legs-containers-cargo`**, **`shipment-refs-sales-order`**, **`shipment-notes-finance`** |
| Booking workflow (draft → send → confirm) | 🟡 POST actions + UI on 360; **New booking** page header **Reporting hub** + **Workbench** | Simulated / demo paths; not live EDI; assist snippet **`booking-forwarder`** |
| **Exception type catalog** | ✅ `CtExceptionCode` per tenant + Shipment 360 dropdown + **Settings** `/settings/control-tower-exception-codes` + `GET /api/control-tower/exception-codes` + `upsert_ct_exception_code` | Tenant admins extend beyond migration seed set |
| Milestone templates | 🟡 `CtMilestoneTemplatePack` + seed JSON + apply pack action | `milestone-pack-catalog` GET (**full** catalog without `mode`, lane filter + **400** on bad `mode`), `apply_ct_milestone_pack`; assist snippet **`milestone-template-pack`** |
| Customer digest / portal | 🟡 `GET /api/control-tower/customer/digest` + **`/control-tower/digest`** page (shared **`buildControlTowerDigest`** in `customer-digest.ts`) + reduced 360 | Depends on CRM link + grants for scoped rows; JSON includes **`digestLimit`** (250), **`itemCount`**, **`truncated`** when the cap may hide older rows; digest page **Download CSV** (`# control-tower-digest:` metadata line); subnav **Digest** only for **restricted** sessions; **hub shortcut card** for restricted; **command palette** + reporting hub CT card links; help playbook **`control_tower`** step **5** |
| **Audit trail** | ✅ `CtAuditLog` + 360 Audit tab | Writes from `post-actions.ts` |

---

## R2 — Alerts, exceptions, ops, command center, documents

| Area | Repo reality | Notes |
|------|--------------|--------|
| Alerts CRUD + lifecycle | ✅ create / ack / close / reopen / assign owner | `post-actions.ts` |
| Exceptions CRUD | ✅ create / update / assign; uses **catalog** codes when present | |
| Ops assignee on shipment | ✅ `Shipment.opsAssigneeUserId` + action | **`update_shipment_ops_assignee`**; assist snippet **`shipment-party-fields`** (with customer + carrier on shipment) |
| Command center / ops console | 🟡 Kanban-style lanes, escalation API; **Reporting hub** + **Workbench** header links on **`/control-tower/command-center`** and **`/control-tower/ops`** | `command-center`, `ops`, `ops/run-escalation`, **`/api/cron/control-tower-sla-escalation`** (Bearer `CRON_SECRET`), `sla-escalation.ts` |
| Document upload (Blob) | 🟡 Upload + register | Needs `BLOB_READ_WRITE_TOKEN` in prod |
| FX / display currency | 🟡 Rates + shipment display currency actions | `fx-refresh.ts`, post-actions; assist snippet **`control-tower-fx`** |

---

## R3 — Reporting, saved reports, dashboard, search & assist

| Area | Repo reality | Notes |
|------|--------------|--------|
| Report builder + run | ✅ `/control-tower/reports`, `report-engine.ts`, run/summary/insight APIs | **`POST …/reports/run`** includes **`runSummary`** (`report-run-summary.ts`); builder shows a **scope strip** after each run. Insight LLM (`report-insight-llm.ts`): model JSON includes **dateFrom** / **dateTo** / **dateWindowLine** + **compareMeasure**; **`POST …/reports/insight`** returns **`runSummary`** on success and on **503** (LLM off/failure) so the scope card can render either way |
| Saved reports + pin | ✅ Saved CRUD + dashboard widgets + modal drill | `GET …/dashboard/widgets` embeds **`runSummary`** on each **`report`** (same as `reports/run`); hub + **My dashboard** cards show date window / compare; modal insight UX matches report builder (**503** keeps scope card); **My dashboard** header links **Reporting hub** (`/reporting?focus=control-tower`) + report builder |
| Search | ✅ `/control-tower/search` + `search-query.ts` + API + **`exceptionCode`** / **`alertType`** (open queue rows); **`GET …/search`** returns **`searchLimit`** / **`itemCount`** / **`truncated`** (default take **60**, max **200**); search page header links **Reporting hub** + **Workbench** | `list-shipments.ts`, assist **`exception:`** / **`ex:`**, **`alertType:`** / **`ctAlert:`** |
| Assist | 🟡 Rule-based + optional LLM merge + **keyword retrieval** (`assist-retrieval.ts`: inbound, milestones, **milestone template packs**, exceptions, trace, schedules, **report AI insight**, **overview vs reports summary**, **`reporting-hub-focus`**, **CT search API**, routes, **saved workbench views**, dispatch, **shipment party fields**, **ops/escalation**, **CT cron jobs**, **forwarder booking**, **legs/containers/cargo**, **refs + sales order link**, **notes + finance snapshots/cost lines**, **customer digest** + **`/control-tower/digest`**, **documents/Blob**, **FX / display currency** → hints + `retrievedDocSnippets`) + **product trace** + **saved report + workbench names**; help playbooks **`control_tower`** (digest) + **`reporting_hub`** (**`focus`** step) | `assist.ts`, `assist-llm.ts`, `assist` API, `help-playbooks.ts` |
| **Scheduled / emailed reports** | 🟡 Schedules + cron + Resend + **CSV + PDF** attachments; **Download CSV / PDF** on report builder (`report-csv.ts`, `report-pdf.ts`); PDF + **email subject/body** include **tenant / org** when known; PDF subtitle **measure · dimension** + optional **date window**; **plain-text body** mirrors **measure · dimension**, date window, and **compare measure** when set (`report-labels.ts`); **Reporting hub** (`/reporting`) Control Tower card links **Workbench** + **Shipment digest**; **Reporting** page header adds **Control Tower home** / **Workbench** / **Shipment digest** when **`org.controltower`** view | Richer layouts / spec parity still open |
| **Full chatbot spec** (retrieval, tools, guardrails) | 🟡 Narrow assistant today | PDF `control_tower_search_and_chatbot_spec` |

---

## R4 — Integrations & “source of truth” (PDF integration + payload packs)

| Area | Repo reality | Notes |
|------|--------------|--------|
| Inbound webhooks (carrier, forwarder) | 🟡 Secret + audit + idempotent milestone upsert + **`generic_carrier_v1`** + **`carrier_webhook_v1`** (`data[]` batch, default cap **50**, env **`CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS`** up to **200**; responses + batch audit include **`maxBatchRows`**) + **`tms_event_v1`** + **`visibility_flat_v1`** | `POST /api/integrations/control-tower/inbound`, `inbound-webhook.ts`; add carrier-specific mappers as needed |
| Normalized event stream / idempotency keys | 🟡 Audit + milestone `sourceType` | Not a dedicated event bus table |
| Master / house B/L, AWB as first-class sync | 🟡 `CtShipmentReference` + manual add | assist snippet **`shipment-refs-sales-order`** |
| **SIMULATED** vs **INTEGRATION** provenance | 🟡 `sourceType` on `CtTrackingMilestone` + **Shipment 360** chips/legend (`milestone-provenance.ts`); workflow milestone source pills | Demo **enrich / regenerate** on workbench + **Milestones** tab (this shipment); POST actions accept optional **`shipmentId`** + regenerate **`demoProfile`**; carrier-specific feeds |
| Cross-module: PO → shipment → WMS | 🟡 PO creates shipment; WMS reads `Shipment` | CRM SO create/link on shipment via **`create_sales_order_from_shipment`** / **`link_shipment_sales_order`** (see assist **`shipment-refs-sales-order`**) |

---

## `POST /api/control-tower` actions (inventory)

Handlers live in `src/lib/control-tower/post-actions.ts` (thin `src/app/api/control-tower/route.ts`).

High-level groups: **references** · **tracking milestones** (+ pack apply) · **notes** · **documents** · **financial snapshots** · **cost lines** · **FX / display currency** · **alerts** · **exceptions** · **booking / forwarder** · **saved filters** · **shipment customer & carrier** · **sales order link / create** · **booking send/confirm** · **demo enrich/timeline** (optional **`shipmentId`**, regenerate + **`demoProfile`**: `delayed` \| `at_risk` \| `on_time`) · **legs** · **containers** · **cargo lines** · **exception code upsert** (catalog).

*(When adding actions, extend this list in the same PR.)*

---

## Other API routes (non-POST shell)

| Route | Role |
|-------|------|
| `GET …/overview` | **Hub** KPI JSON (`getControlTowerOverview` — status mix, arrivals windows, stale/overdue hints, legs/containers); not the same contract as **`GET …/reports/summary`** |
| `GET/POST …/shipments` | List (filters incl. **`exceptionCode`**, **`alertType`**); **`GET`** JSON **`listLimit`** (clamped `take`, default **80**), **`itemCount`**, **`truncated`**, **`shipments`** / mutations as defined in route |
| `GET/PATCH …/shipments/[id]` | Shipment 360 payload |
| `GET …/search` | Search (incl. **`exceptionCode`**, **`alertType`**); JSON **`searchLimit`**, **`itemCount`**, **`truncated`**, **`shipments`** |
| `POST …/assist` | Assist (rules + saved names + **keyword doc retrieval** + optional LLM) |
| `GET …/saved-filters` | List actor’s **CtSavedFilter** (workbench); persist via **`save_ct_filter`** / **`delete_ct_filter`** on `POST …/control-tower` |
| `GET …/milestone-pack-catalog` | Milestone template packs (**full list** if `mode` omitted; **`?mode=`** `OCEAN` \| `AIR` \| `ROAD` \| `RAIL` filters built-ins; **400** if `mode` present but not one of those). JSON **`modeFilter`** is the applied mode or `null`. |
| `GET …/exception-codes` | Tenant exception catalog (Settings + API consumers) |
| `GET/POST …/reports/*`, `…/dashboard/widgets/*` | Reporting & pins; **`POST …/reports/run`** and **`GET …/dashboard/widgets`** embed **`runSummary`** on each report JSON (see `report-run-summary.ts`) |
| `GET …/reports/summary` | Tenant-scoped **reports overview** KPIs (`getControlTowerReportsSummary` — status mix, booking coverage, open exceptions/alerts, SLA-breach counts); grant **`org.controltower`** `view` |
| `POST …/reports/insight` | Runs report + optional OpenAI insight; JSON **`runSummary`** (measure/dimension labels, date window, compare, coverage subset) + **`insight`** + **`generatedAt`**; on LLM disabled/error **503** still returns **`runSummary`** + **`generatedAt`** with **`error`** |
| `GET/POST …/reports/schedules`, `PATCH/DELETE …/reports/schedules/[id]` | Saved report email schedules |
| `GET/POST …/cron/control-tower-report-schedules` | Cron sweep (Bearer `CRON_SECRET`) |
| `GET/POST …/cron/control-tower-fx-refresh` | Daily FX pull (**Frankfurter**); Bearer `CRON_SECRET`; env **`CONTROL_TOWER_FX_BASES`** / **`CONTROL_TOWER_FX_TARGETS`** |
| `GET/POST …/cron/control-tower-sla-escalation` | Booking **SLA breach** sweep (internal notes + alerts); Bearer `CRON_SECRET`; optional **`CONTROL_TOWER_SYSTEM_ACTOR_EMAIL`** |
| `GET …/ops/summary`, `POST …/ops/run-escalation` | Ops |
| `POST …/documents/upload` | Blob upload |
| `GET …/customer/digest` | Portal digest (max **250** items, **`digestLimit`** / **`itemCount`** / **`truncated`** on JSON); in-app **`/control-tower/digest`** uses the same builder |
| `POST …/integrations/control-tower/inbound` | Inbound webhook: secret + audit + **`idempotencyKey`**, **`generic_carrier_v1`** / **`carrier_webhook_v1`** (batch cap **50** default, env up to **200**; **`maxBatchRows`** on JSON + audit) / **`tms_event_v1`** / **`visibility_flat_v1`**, **`CtTrackingMilestone`** upsert (`INTEGRATION`) |

---

## Near-term build order (engineering backlog)

1. **Keep this file current** when merging Control Tower PRs (checkbox discipline).
2. ~~**Exception catalog admin**~~ — ✅ Settings page + `GET /api/control-tower/exception-codes` + `upsert_ct_exception_code` POST action.
3. ~~**Integration stub**~~ — 🟡 `POST /api/integrations/control-tower/inbound` + audit; **idempotent replays** (`idempotencyKey` + `INBOUND_WEBHOOK_EVENT` audit), **`generic_carrier_v1` / `carrier_webhook_v1` / `tms_event_v1` / `visibility_flat_v1`** + canonical milestone mapping, **`CtTrackingMilestone`** upsert — extend with carrier-specific mappers as needed (`carrier_webhook_v1` batch cap: env up to 200).
4. **Assist / chatbot** — ~~saved CT reports + saved workbench filter names~~; ~~**keyword doc retrieval** (static corpus, no embeddings) for hints + LLM snippets~~; remaining: embeddings / vector search, fuller tool use vs PDF spec.
5. **Reporting** — ~~CT schedules + email CSV/PDF + in-app Download CSV/PDF~~ (`pdf-lib` summary PDF); remaining: richer branded templates vs `control_tower_reporting_and_kpi_spec`.
6. **Workbench** — ~~column prefs persistence~~ (localStorage + CSV respects visible columns); ~~cross-filter deep links~~ from Control Tower dashboard + executive cockpit (`controlTowerWorkbenchPath`, overdue ETA + status chips).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-17 | Initial `GAP_MAP.md` + `README.md`. Implemented **Settings → Control Tower exception types** + `exception-codes` GET + `upsert_ct_exception_code` POST action. |
| 2026-04-17 | Control Tower inbound webhook stub; workbench **table column** prefs + CSV alignment; assist `supplier:` / `customer:` cuid filters + search API support. |
| 2026-04-17 | Saved workbench views persist **columnVisibility**; search → workbench link omits stray `take=`; assist **carrier:** cuid token + search `carrierSupplierId`. |
| 2026-04-17 | `controlTowerWorkbenchPath` + deep links: dashboard **by-status** + overdue ETA, executive **overdue** + delayed row → Shipment 360, hub workbench card footer. |
| 2026-04-17 | Assist **`origin:`** / **`dest:`** / **`destination:`** port tokens + `GET /api/control-tower/search` `originCode` & `destinationCode` (workbench URL parity). |
| 2026-04-17 | Assist **`route:<slug>`** (e.g. `plan_leg`, `send_booking`) + search `routeAction` → list `routeActionPrefix`. |
| 2026-04-17 | Assist **`source:`** / **`shipmentSource:`** / **`flow:`** `po` \| `unlinked` \| `export` + search `shipmentSource`. |
| 2026-04-17 | Assist **`owner:`** / **`assignee:`** / **`dispatch:`** cuid + search `dispatchOwnerUserId` (open alert/exception owner scope). |
| 2026-04-17 | `tsconfig`: exclude `.next` from `tsc` (stable CI; avoids stale/duplicate generated validators); reports snapshot **workbench drills** (ETA lane → origin/dest, route-action buckets, overdue links). |
| 2026-04-17 | **Ops** + **Command center** → workbench: overdue drill in ops copy; command center “open filters in workbench” encodes status, routeAction, overdue, q, dispatch owner. |
| 2026-04-17 | **Shipment 360** back links → workbench with `q=<shipmentId>` (matches list `q` id branch). |
| 2026-04-17 | **Product trace** in help: `/product-trace` on `open_path` allowlist + optional `q`; playbook `product_trace`; assist **`trace:`** / **`sku:`** / **`product:`** → search UI **Open product trace →**; LLM assist may set `productTraceQ`. |
| 2026-04-17 | **Inbound webhook**: `inbound-webhook.ts` — optional **`idempotencyKey`** (stored replay on `CtAuditLog` `INBOUND_WEBHOOK_EVENT`), **`payloadFormat`** `generic_carrier_v1`, canonical **`milestone`** → upsert **`CtTrackingMilestone`** (`sourceType: INTEGRATION`). |
| 2026-04-17 | **Report email schedules**: `CtReportSchedule` (DAILY/WEEKLY UTC), `report-schedule-delivery.ts`, cron `/api/cron/control-tower-report-schedules`, Resend HTTP; builder UI **Email schedule** on saved CT reports. |
| 2026-04-17 | Scheduled report emails: **`buildControlTowerReportCsv`** (`report-engine.ts`) — UTF-8 CSV of `fullSeriesRows` + **TOTAL** row; Resend **`attachments`** (base64) from cron. |
| 2026-04-17 | **`report-csv.ts`**: client-safe CSV builder; report builder **Download CSV**; `report-engine` delegates CSV build for server + cron parity. |
| 2026-04-17 | **`report-pdf.ts`** (`pdf-lib`): tabular summary PDF; scheduled email **second attachment**; report builder **Download PDF** (dynamic import). |
| 2026-04-17 | **Assist retrieval**: `assist-retrieval.ts` — keyword-scored snippets (webhook, provenance, exception catalog, product trace, schedules, route actions, dispatch); merged into hints; **`retrievedDocSnippets`** in LLM user JSON when enabled. |
| 2026-04-17 | **Inbound webhook**: `payloadFormat` **`visibility_flat_v1`** + `visibilityPayload` (flat shipment id, status/event code, ISO timestamp aliases, optional tracking/correlation id). |
| 2026-04-17 | **Assist retrieval corpus**: ops/command center + SLA escalation APIs, customer digest vs internal 360, document upload / Blob env; inbound terms include **visibility_flat** / **visibility payload**. |
| 2026-04-17 | **Workbench / search / assist**: filter shipments with an **open exception** by catalog **`exceptionCode`** (query param + workbench URL); assist tokens **`exception:`** / **`ex:`**; list + GET shipments + search API. |
| 2026-04-17 | **Open alert type** filter: query **`alertType`** + workbench + assist **`alertType:`** / **`ctAlert:`**; `CtAlert.type` on **OPEN** or **ACKNOWLEDGED** (symmetric with exception filter). |
| 2026-04-17 | **Assist**: `POST /api/control-tower/assist` loads recent **saved CT reports** (names, mine/shared); `savedReportAssistHints` + LLM user JSON **`savedControlTowerReports`** (hints-only contract). |
| 2026-04-17 | **Assist**: **`CtSavedFilter`** names for the actor + **`savedWorkbenchFilterAssistHints`** + LLM **`savedWorkbenchFilterNames`**; shared `hasAssistStructuredTokens` for hint gating. |
| 2026-04-17 | **Milestone provenance**: `milestone-provenance.ts` — Shipment 360 **Milestones** tab shows **Simulated / Integration / Manual** chips for CT tracking rows + workflow **Internal/Supplier/…** pills + short legend. |
| 2026-04-17 | **Inbound webhook**: `payloadFormat` **`tms_event_v1`** + `tmsPayload` (camel/snake aliases for shipment id, milestone code, timestamps, correlation id). |
| 2026-04-17 | **Demo timeline**: `enrich_ct_demo_tracking` / `regenerate_ct_demo_timeline` accept optional **`shipmentId`** (tenant-scoped single shipment); regenerate accepts **`demoProfile`**. Shipment 360 **Milestones** tab adds scoped buttons + profile selector. |
| 2026-04-17 | **Control Tower hub** (`control-tower-dashboard-widgets.tsx`): **`initialLoadDone`** + **`HubReportWidgetsSkeleton`** while `GET …/dashboard/widgets` resolves — avoids empty flash before pinned cards render. |
| 2026-04-17 | **Inbound webhook**: `payloadFormat` **`carrier_webhook_v1`** — **`data[]`** batch (max **50** rows, each like `generic_carrier_v1`); **`rows[]`** outcomes; **400** if no row applies; idempotency key suffix **`:index`** per row for milestone `sourceRef` fallback; **`milestonesProcessed`** / **`milestonesFailed`**; idempotent replay only on **200**. |
| 2026-04-17 | **Report PDF** (`report-pdf.ts`): optional **`organizationLabel`** — tenant name on cover line + closing tagline + bottom-left on each page; **reports** page passes `tenantName`; **schedule cron** batches `Tenant.name` by `tenantId`. |
| 2026-04-17 | **Scheduled report email** (`formatReportRunForEmail`): optional **`organizationName`** — inbox **subject** uses `[Control Tower] {tenant} — {title}` when tenant is resolved in cron; body opens with **(tenant)** in the headline. |
| 2026-04-17 | **Assist retrieval**: snippet **`milestone-template-pack`** — `GET …/milestone-pack-catalog?mode=`, **`apply_ct_milestone_pack`** POST action, links to Shipment 360 / new booking flows. |
| 2026-04-17 | **`GET …/milestone-pack-catalog`**: omit **`mode`** → **full** merged catalog; valid **`mode`** → lane-filtered list; invalid **`mode`** → **400**; response includes **`modeFilter`** (`null` when unfiltered). |
| 2026-04-17 | **Assist retrieval**: snippet **`control-tower-fx`** — **`upsert_ct_fx_rate`**, **`set_ct_display_currency`**, cron **`/api/cron/control-tower-fx-refresh`**, Frankfurter + **`CONTROL_TOWER_FX_*`** env; GAP route table row for FX cron. |
| 2026-04-17 | **Assist retrieval**: snippets **`control-tower-cron-jobs`** (three Bearer `CRON_SECRET` routes) + **`booking-forwarder`** (`send_booking_to_forwarder`, `confirm_forwarder_booking`). **GAP_MAP**: **`/api/cron/control-tower-sla-escalation`** route row + R2 ops / R1 booking notes. |
| 2026-04-17 | **Assist retrieval**: snippet **`legs-containers-cargo`** — Shipment 360 **Legs** / **Containers** POST actions (`create_ct_leg`, `move_ct_leg`, `upsert_ct_container_cargo_line`, cargo summary updates, etc.); **GAP_MAP** R1 Shipment 360 + R3 assist corpus. |
| 2026-04-17 | **Assist retrieval**: snippet **`saved-workbench-views`** — **`GET …/saved-filters`**, **`save_ct_filter`** / **`delete_ct_filter`**, workbench vs search scope, **`filtersJson`** sanitization; **GAP_MAP** R1 workbench + R3 assist corpus. |
| 2026-04-17 | **Assist retrieval**: snippet **`shipment-refs-sales-order`** — **`add_ct_reference`**, **`set_order_external_reference`**, **`create_sales_order_from_shipment`**, **`link_shipment_sales_order`**; **GAP_MAP** R1 Shipment 360, R4 refs / cross-module, R3 assist corpus. |
| 2026-04-17 | **Assist retrieval**: snippet **`shipment-party-fields`** — **`set_shipment_customer_crm_account`**, **`set_shipment_carrier_supplier`**, **`update_shipment_ops_assignee`** vs dispatch-owner queue filters; **dispatch-owner** detail cross-link. **GAP_MAP** R2 ops assignee + R3 assist corpus. |
| 2026-04-17 | **Assist retrieval**: snippet **`shipment-notes-finance`** — **`create_ct_note`**, **`create_ct_financial_snapshot`**, **`add_ct_cost_line`** / **`delete_ct_cost_line`**; **GAP_MAP** R1 Shipment 360 + R3 assist corpus. |
| 2026-04-17 | **Reporting**: **`report-labels.ts`** — shared **`metricLabel`** / **`dimensionLabel`** (server-safe); **`report-pdf`** optional **`reportMeasure`** / **`reportDimension`** → subtitle under coverage; **report builder** + **schedule cron** pass config; **chart-kit** re-exports from lib. |
| 2026-04-17 | **Reporting**: **`runControlTowerReport`** echoes **`dateFrom`** / **`dateTo`** on **`result.config`**; **`formatReportDateWindowLine`** + **`dateFieldLabel`** in **`report-labels.ts`**; PDF + scheduled **email body** show the date window when set; **`report-pdf`** accepts **`reportDateField`** / **`reportDateFrom`** / **`reportDateTo`**. |
| 2026-04-17 | **Reporting**: **`buildReportInsightContext`** (`report-insight-llm.ts`) passes **`dateFrom`** / **`dateTo`** / **`dateWindowLine`**, **`compareMeasure`** / **`compareMeasureLabel`**, and system text reminds the model to respect the date window. |
| 2026-04-17 | **Inbound `carrier_webhook_v1`**: per-request cap default **50** `data[]` rows, override **`CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS`** (integer **1–200**); **GAP** + inbound route JSDoc + assist **`inbound-webhook`** snippet updated. |
| 2026-04-17 | **Scheduled report email** (`formatReportRunForEmail`): body adds **`metricLabel` · `dimensionLabel`** (PDF parity), optional **compare measure** line when `compareMeasure` is set; assist schedules snippet updated. |
| 2026-04-17 | **`POST …/reports/insight`**: response **`runSummary`** from **`buildReportInsightRunSummary`** (now **`report-run-summary.ts`**); report builder **Optional AI insight** panel shows scope + coverage card; assist snippet **`report-ai-insight`**; **GAP** route row. |
| 2026-04-17 | **`POST …/reports/insight`**: **503** (LLM off/error) still returns **`runSummary`** + **`generatedAt`** with **`error`**; report builder keeps the scope card so operators see what would have been interpreted. |
| 2026-04-17 | **`report-run-summary.ts`**: **`buildReportInsightRunSummary`** + type moved out of **`report-insight-llm.ts`**; **`POST …/reports/run`** JSON includes **`runSummary`** (labeled scope for any client); **`RunResult`** typing updated in report builder. |
| 2026-04-17 | **`GET …/dashboard/widgets`**: each **`report`** includes **`runSummary`**; hub + **My dashboard** cards show date window / compare; **`ControlTowerDashboardWidgetModal`** insight flow matches report builder (**503** + scope card). |
| 2026-04-17 | **Report builder**: after **Run report**, a **scope strip** (title, measure · dimension, date window, compare, coverage) renders from **`result.runSummary`**; **GAP** route row for **`GET …/reports/summary`** (`reports-summary.ts`). |
| 2026-04-17 | **Inbound `carrier_webhook_v1`**: JSON **200** / relevant **400** bodies include **`maxBatchRows`** (resolved cap); **`EXTERNAL_WEBHOOK`** audit payload stores **`maxBatchRows`** for batch receipts. |
| 2026-04-17 | **`GET …/customer/digest`**: JSON adds **`digestLimit`**, **`itemCount`**, **`truncated`** (≥ limit); **`DIGEST_MAX_ITEMS`** constant **250**; assist **`customer-digest`** + **GAP** digest rows updated. |
| 2026-04-17 | **Assist** snippet **`overview-vs-reports-summary`** — **`GET …/overview`** (hub, `getControlTowerOverview`) vs **`GET …/reports/summary`** (`getControlTowerReportsSummary`); **GAP** overview route row + JSDoc on both route handlers. |
| 2026-04-17 | **`GET …/search`**: JSON **`searchLimit`** (default **60**, max **200**), **`itemCount`**, **`truncated`**; **`search-client`** truncation hint + Workbench link; assist **`control-tower-search-api`**; **GAP** search rows. |
| 2026-04-17 | **`listControlTowerShipments`**: returns **`listLimit`** / **`truncated`** with rows; **`GET …/shipments`** echoes **`listLimit`**, **`itemCount`**, **`truncated`**; workbench + command center **amber list-cap** hint; assist **`control-tower-search-api`** notes parity with shipments list. |
| 2026-04-17 | **Shipment digest UI**: **`customer-digest.ts`** (`buildControlTowerDigest`, **`DIGEST_MAX_ITEMS`**) shared by **`GET …/customer/digest`** and **`/control-tower/digest`**; subnav **Digest**; help **`open_path`** allowlist + assist **`customer-digest`**; **GAP** digest rows. |
| 2026-04-17 | **Help**: playbook **`control_tower`** adds step **5** (Shipment digest → `/control-tower/digest`); **`help-llm`** Control Tower match adds **Open shipment digest** quick action. |
| 2026-04-17 | **Subnav**: **`ControlTowerSubNavShell`** (layout) passes **`includeDigestNav`** when `getControlTowerPortalContext` → **`isRestrictedView`**; internal operators keep workbench-first chrome; digest page still URL-open. **GAP** R1 + R3 assist row. |
| 2026-04-17 | **Hub** (`/control-tower`): **Shipment digest** shortcut card when **`isRestrictedView`**; grid **`lg:grid-cols-3`** for six tiles vs five for internal. **GAP** overview row. |
| 2026-04-17 | **Command palette**: **Control Tower — shipment digest** (`/control-tower/digest`) for **`org.controltower`** discoverability when Digest is omitted from subnav. |
| 2026-04-17 | **Workbench Export CSV**: when **`truncated`** + **`listLimit`**, file starts with a **`# control-tower-workbench export:`** comment line documenting the server row cap. **GAP** R1 workbench row. |
| 2026-04-17 | **Digest CSV** + **reporting hub**: `/control-tower/digest` **Download CSV** (metadata **`# control-tower-digest:`**); `/reporting` Control Tower section adds **Workbench** + **Shipment digest** links. **GAP** R1 digest + R3 reporting hub. |
| 2026-04-17 | **Cross-links**: **Executive** hero chips + **WMS reporting** + **CRM reporting** footers add **Control Tower workbench** + **Shipment digest** (same grant-gated destinations as `/reporting`). |
| 2026-04-17 | **Housekeeping**: removed stray **`src/app/reporting/page 2.tsx`** (non-route duplicate of reporting hub). **`/control-tower/digest`** footer nav → reporting hub (**`?focus=control-tower`**), workbench, CT home; **Platform** Control Tower blurb mentions digest. |
| 2026-04-17 | **Command palette**: **Reporting hub — Control Tower** → **`/reporting?focus=control-tower`** (with other CT commands). |
| 2026-04-17 | **Help `open_path`**: optional **`focus`** for **`/reporting`** (`po` \| `control-tower` \| `crm` \| `wms`); stripped when the actor lacks that module grant; **`help-llm`** contract + **reporting_hub** quick action “Reporting hub — Control Tower section”. |
| 2026-04-17 | **Help playbook `reporting_hub`**: new step **Jump to Control Tower on the hub** (`focus: control-tower`); chart drill step renumbered to **5**; assist snippet **`reporting-hub-focus`**. **GAP** R3. |
| 2026-04-17 | **My dashboard** (`control-tower-dashboard-manager-inner`): header **Reporting hub** → **`/reporting?focus=control-tower`** next to report builder. **GAP** R3 saved reports row. |
| 2026-04-17 | **Workbench** + **Search** pages: header **Reporting hub** (`?focus=control-tower`); search adds **Workbench** link. **GAP** R1 workbench + R3 search rows. |
| 2026-04-17 | **Command center**, **Ops**, **New booking**: same **Reporting hub** + **Workbench** header links. **GAP** R1 booking + R2 ops/command rows. |
| 2026-04-17 | **Control Tower hub** + **Shipment 360** (`/control-tower/shipments/[id]`): **Reporting hub** link (360 next to workbench back-link). **GAP** R1 overview + Shipment 360 rows. |
| 2026-04-17 | **Control Tower subnav**: **Reporting hub** item → **`/reporting?focus=control-tower`**; **`useSearchParams`** highlights active when on **`/reporting`** with **`focus=control-tower`**. **GAP** R1 digest / nav. |
| 2026-04-17 | **`/reporting`** header: **Control Tower home**, **Workbench**, **Shipment digest** links when actor has **`org.controltower`** view (round-trip from CT subnav). **GAP** R3 reporting hub. |
| 2026-04-17 | **`/product-trace`**: header **Reporting hub** + **Workbench** when **`org.controltower`** view (same pattern as CT Search). Assist **product-trace** snippet; **GAP** changelog (cross-link). |
| 2026-04-17 | **`reporting-hub-paths.ts`**: **`REPORTING_HUB_CONTROL_TOWER_HREF`** — single source for CT reporting-hub deep links (subnav, pages, My dashboard, command palette, help playbook step href); **`help-actions`** JSDoc cross-ref. Assist **`reporting-hub-focus`** detail updated. |
| 2026-04-17 | **`ControlTowerReportingHubWorkbenchLinks`**: shared sky text (**Reporting hub** + **Workbench**); optional **`includeWorkbench`** (default true); **Shipment 360** uses **`includeWorkbench={false}`** beside **← Control Tower workbench**; **`variant="button"`** + **`buttonSize`** `sm` \| `md` for **My dashboard** and **workbench** toolbars; **`reportingLabel`** / **`workbenchLabel`** / **`noWrapper`** (digest nav, CT reports back-link); CT hub, Search, command center, ops, new booking, product trace; assist **`reporting-hub-focus`**. **GAP** changelog. |
| 2026-04-17 | **`reporting-hub-paths.ts`**: **`REPORTING_HUB_FOCUS_PO_HREF`**, **`…_CRM_…`**, **`…_WMS_…`** (+ existing CT) — PO / CRM / WMS reporting pages use constants aligned with **`help-actions`** **`REPORTING_FOCUS`**. **GAP** R3 cross-module. |
| 2026-04-17 | **Tests**: **`vitest`** + **`vitest.config.ts`**; **`help-actions.*.test.ts`** — reporting focus, open path, sanitize + queue + **`open_order`** row, **`open_order`** (mocked Prisma), edge cases (**`open_order`** in **`sanitizeHelpDoActions`**, unknown action type, no user). **`npm run test`**. **GAP** R3 assist / help. |
| 2026-04-17 | **CI**: **`.github/workflows/ci.yml`** — Node **22**, **`npm ci`**, **`npm run lint`**, **`npx tsc --noEmit`**, **`npm run test`** on push/PR to **`main`**/**`master`**. Repository root must be the **`po-management`** app folder (or move workflow / set **`defaults.run.working-directory`**). **GAP** engineering hygiene. |

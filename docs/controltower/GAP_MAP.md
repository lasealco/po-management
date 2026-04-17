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
| Overview / KPI strip | ✅ `/control-tower` + `getControlTowerOverview` + API `GET /api/control-tower/overview` | `control-tower-dashboard.tsx`, pinned widgets shell |
| Tracking workbench | ✅ List, filters, CSV, saved views, **column visibility** (localStorage + optional per saved view) | `list-shipments.ts`, `control-tower-workbench.tsx`, `workbench-column-prefs.ts`, `saved-filters` API |
| Shipment 360 | ✅ Tabs: details, booking, milestones, legs, containers, refs, alerts, exceptions, docs, notes, finance, audit, … | `shipment-360.ts`, `control-tower-shipment-360.tsx` |
| Booking workflow (draft → send → confirm) | 🟡 POST actions + UI on 360 | Simulated / demo paths; not live EDI |
| **Exception type catalog** | ✅ `CtExceptionCode` per tenant + Shipment 360 dropdown + **Settings** `/settings/control-tower-exception-codes` + `GET /api/control-tower/exception-codes` + `upsert_ct_exception_code` | Tenant admins extend beyond migration seed set |
| Milestone templates | 🟡 `CtMilestoneTemplatePack` + seed JSON + apply pack action | `milestone-pack-catalog` API, `apply_ct_milestone_pack` |
| Customer digest / portal | 🟡 `GET /api/control-tower/customer/digest` + reduced 360 | Depends on CRM link + grants |
| **Audit trail** | ✅ `CtAuditLog` + 360 Audit tab | Writes from `post-actions.ts` |

---

## R2 — Alerts, exceptions, ops, command center, documents

| Area | Repo reality | Notes |
|------|--------------|--------|
| Alerts CRUD + lifecycle | ✅ create / ack / close / reopen / assign owner | `post-actions.ts` |
| Exceptions CRUD | ✅ create / update / assign; uses **catalog** codes when present | |
| Ops assignee on shipment | ✅ `Shipment.opsAssigneeUserId` + action | |
| Command center / ops console | 🟡 Kanban-style lanes, escalation API | `command-center`, `ops`, `ops/run-escalation`, `sla-escalation.ts` |
| Document upload (Blob) | 🟡 Upload + register | Needs `BLOB_READ_WRITE_TOKEN` in prod |
| FX / display currency | 🟡 Rates + shipment display currency actions | `fx-refresh.ts`, post-actions |

---

## R3 — Reporting, saved reports, dashboard, search & assist

| Area | Repo reality | Notes |
|------|--------------|--------|
| Report builder + run | ✅ `/control-tower/reports`, `report-engine.ts`, run/summary/insight APIs | Insight optional LLM via env |
| Saved reports + pin | ✅ Saved CRUD + dashboard widgets + modal drill | `dashboard/widgets` API; **initial load skeleton** in manager inner |
| Search | ✅ `/control-tower/search` + `search-query.ts` + API | |
| Assist | 🟡 Rule-based core + optional LLM merge | `assist.ts`, `assist-llm.ts`, `assist` API |
| **Scheduled / emailed reports** | ❌ | Backlog |
| **Full chatbot spec** (retrieval, tools, guardrails) | 🟡 Narrow assistant today | PDF `control_tower_search_and_chatbot_spec` |

---

## R4 — Integrations & “source of truth” (PDF integration + payload packs)

| Area | Repo reality | Notes |
|------|--------------|--------|
| Inbound webhooks (carrier, forwarder) | 🟡 Signed stub + `CtAuditLog` only | `POST /api/integrations/control-tower/inbound` + `CONTROL_TOWER_INBOUND_WEBHOOK_SECRET`; no carrier-specific payload mapping yet |
| Normalized event stream / idempotency keys | 🟡 Audit + milestone `sourceType` | Not a dedicated event bus table |
| Master / house B/L, AWB as first-class sync | 🟡 `CtShipmentReference` + manual add | |
| **SIMULATED** vs **INTEGRATION** provenance | 🟡 Fields + UI hints | Enrich/regenerate demo timeline actions |
| Cross-module: PO → shipment → WMS | 🟡 PO creates shipment; WMS reads `Shipment` | As designed in monolith |

---

## `POST /api/control-tower` actions (inventory)

Handlers live in `src/lib/control-tower/post-actions.ts` (thin `src/app/api/control-tower/route.ts`).

High-level groups: **references** · **tracking milestones** (+ pack apply) · **notes** · **documents** · **financial snapshots** · **cost lines** · **FX / display currency** · **alerts** · **exceptions** · **booking / forwarder** · **saved filters** · **shipment customer & carrier** · **sales order link / create** · **booking send/confirm** · **demo enrich/timeline** · **legs** · **containers** · **cargo lines** · **exception code upsert** (catalog).

*(When adding actions, extend this list in the same PR.)*

---

## Other API routes (non-POST shell)

| Route | Role |
|-------|------|
| `GET/POST …/overview` | Dashboard JSON |
| `GET/POST …/shipments` | List / mutations as defined in route |
| `GET/PATCH …/shipments/[id]` | Shipment 360 payload |
| `GET …/search` | Search |
| `POST …/assist` | Assist |
| `GET …/saved-filters` | Saved workbench filters |
| `GET …/milestone-pack-catalog` | Packs |
| `GET …/exception-codes` | Tenant exception catalog (Settings + API consumers) |
| `GET/POST …/reports/*`, `…/dashboard/widgets/*` | Reporting & pins |
| `GET …/ops/summary`, `POST …/ops/run-escalation` | Ops |
| `POST …/documents/upload` | Blob upload |
| `GET …/customer/digest` | Portal digest |
| `POST …/integrations/control-tower/inbound` | Demo inbound webhook (secret + audit row) |

---

## Near-term build order (engineering backlog)

1. **Keep this file current** when merging Control Tower PRs (checkbox discipline).
2. ~~**Exception catalog admin**~~ — ✅ Settings page + `GET /api/control-tower/exception-codes` + `upsert_ct_exception_code` POST action.
3. ~~**Integration stub**~~ — 🟡 `POST /api/integrations/control-tower/inbound` + audit log; extend with idempotent milestone updates / payload mapping when needed.
4. **Assist / chatbot** — expand rule pack + retrieval over saved reports / workbench context; tighten LLM prompts from PDF (lane / **origin** / **dest** port tokens + carrier/supplier/customer cuid + search API parity).
5. **Reporting** — schedules, email/export parity with `control_tower_reporting_and_kpi_spec`.
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

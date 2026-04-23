# SRM — blueprint PDFs ↔ codebase gap map

**Purpose:** Same role as `docs/controltower/GAP_MAP.md` and `docs/wms/GAP_MAP.md`: map each **blueprint filename** under `docs/srm/` to **what exists in this repo** today (routes, grants, Prisma `Supplier` and related reads). Use it for scoping PRs and onboarding; it is **not** a substitute for reading the PDFs.

**Legend:** ✅ covered in repo (at current depth) · 🟡 partial / demo-first · ❌ not wired or intentionally deferred

**Baseline:** The app ships **tenant-scoped supplier master** with **product vs logistics** categories, **SRM list + create + 360** under `/srm`, and shared supplier APIs/components with the legacy `/suppliers` directory. PDFs describe **enterprise** depth (full lifecycle, compliance vault, integration mesh). Treat ❌ as "not here yet," not "ignored."

---

## Completion program (SRM MVP)

SRM “finished” for MVP is defined and sequenced in **[`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md)** — **30 slices** (phases A–F), from UX and permissions through compliance, KPI, integration, and final sign-off.

| Resource | Location |
|----------|----------|
| Slice list, acceptance hints, MVP definition | [`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md) |
| GitHub label & allowed paths | [`docs/engineering/agent-todos/srm.md`](../engineering/agent-todos/srm.md) |

### Slice tracker (issues & PRs)

Add **Issue** / **PR** when you file work; Phase **B–F** rows stay open until those slices ship.

| # | Slice (short) | GitHub issue | PR |
|---|----------------|--------------|-----|
| 1 | SRM completion index | — | (landed) |
| 2 | MVP sign-off checklist | — | (landed) |
| 3 | Slice tracker table | — | (this doc) |
| 4 | List page polish |  |  |
| 5 | Create partner wizard polish |  |  |
| 6 | 360 layout & navigation |  |  |
| 7 | 360 profile completeness |  |  |
| 8 | Contacts & offices CRUD |  |  |
| 9 | Capabilities matrix UX |  |  |
| 10 | API guard pass (read) |  |  |
| 11–15 | Phase B — lifecycle & onboarding | — | (landed) |
| 16–20 | Phase C — compliance & documents | — | (landed) |
| 21–24 | Phase D — KPI & analytics | — | (landed) |
| 25–28 | Phase E — integration pack | — | (landed) |
| 29–30 | See [`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md) |  |  |

**Phase A (slices 4–10) — shipped in repo:** mobile partner cards + zero-state on `/srm`; create redirects to `/srm/[id]` with validation; 360 **Profile / Contacts & sites / Capabilities / Orders / Compliance / Activity** tabs (sticky nav); **booking confirmation SLA (hours)** on profile PATCH + UI; **office inline edit**; capabilities empty CTA + primary add button; **Vitest** for `GET /api/suppliers` and `GET /api/suppliers/[id]` grant + tenant gates.

**Phase B (slices 11–15) — shipped in repo:** `supplier-approval-transitions` enforced on **`POST /api/suppliers/[id]/approval`** (`approve` / `reject` / `reopen`) and **`PATCH /api/suppliers/[id]`** when `approvalStatus` changes; **`supplierOperationalBlockReason`** on **`POST /api/orders`** (line supplier + forwarder); **`SupplierOnboardingTask`** model + **`GET/PATCH`** onboarding task APIs; default tasks seeded on create + first 360 load; **Onboarding** tab on `/srm/[id]` with assignee/due/notes + **Assigned onboarding** filter on `/srm`; **`srmNotificationHook`** structured log stub on approval decisions; docs: **`docs/srm/SRM_ACTIVATION_GUARDS.md`**; Vitest for approval transitions + list-query `onboardingMine`.

**Phase C (slices 16–20) — shipped in repo:** **`SrmSupplierDocument`** + **`SrmSupplierDocumentAuditLog`** (Prisma); **`GET`/`POST`** `/api/suppliers/[id]/srm-documents`, **`PATCH`/`DELETE`** `/api/suppliers/[id]/srm-documents/[docId]` (archive), **`GET`** `.../audit-logs`; **Compliance** tab on `/srm/[id]` with upload (edit grant), list, expiry badges (query-time), view-only messaging, audit trail; local dev uploads under `public/uploads/srm-documents` or Blob in production; Vitest for document list + grant gate on POST.

**Phase D (slices 21–24) — shipped in repo:** **`/srm/analytics`** — parent **PO** volume + spend by **currency** (no FX) + **top-3 concentration** (order-count % and per-currency spend %); **`GET /api/srm/analytics`**; **PO metrics** require **`org.orders` → view** (session without it still opens the page for logistics **booking SLA** when `kind=logistics`). **Booking SLA:** `ShipmentBooking.bookingSentAt` vs first **`BOOKING_CONFIRMED`** milestone on the linked **Shipment** vs forwarder **`bookingConfirmationSlaHours`** (else 24h); sparse/missing milestone → indeterminate + UI callout. Implementation: **`src/lib/srm/srm-analytics-aggregates.ts`**.

**Phase E (slices 25–28) — shipped in repo:** **`POST /api/srm/integrations/v1/suppliers/upsert`** — `srm_supplier_upsert_v1` (`schemaVersion: 1`), `match.id` / `match.code` / create; **`SrmIntegrationIdempotency`** table for **`Idempotency-Key`** replay; field mapping aligned with supplier **PATCH**/**POST**; **`GET /api/srm/integrations/v1/suppliers/export`** (`format`, `kind`); **`docs/srm/INTEGRATION.md`**; Vitest in **`upsert/route.test.ts`**.

### SRM MVP sign-off checklist (reviewers)

Run this before declaring **SRM MVP complete** (finish program **slice 30**). Some rows stay **N/A** until later slices (compliance, KPI, integration)—re-run the full list at sign-off.

#### Routes and UI

- [ ] **`/srm`** — list loads; filters `kind=product` / `kind=logistics`; `q=` search; unauthenticated or unauthorized users see access denied (not a stack trace).
- [ ] **`/srm/new`** — create partner flow works with **`org.suppliers` → edit**; users with view-only cannot mutate.
- [ ] **`/srm/[id]`** — supplier 360 loads for a supplier in the active tenant; wrong tenant / unknown id → 404 or access denied.
- [ ] **Legacy `/suppliers` and `/suppliers/[id]`** — if still in scope, same grant behavior as above (or document deprecation in this file).

#### Grants and APIs

- [ ] **`org.suppliers` → view** required for list and 360 read paths used in production.
- [ ] **`org.suppliers` → edit** (and **approve** where implemented) enforced on PATCH/create/delete and SRM JSON APIs.
- [ ] **Order analytics / counts** on SRM surfaces gated by **`org.orders` → view** (when those widgets exist).
- [ ] Spot-check SRM-related **`/api/**` routes**: 403 without grant; no cross-tenant data in JSON.

#### Migrations and schema

- [ ] Production (or target environment) has run **`prisma migrate deploy`** (or `npm run db:migrate`) through all merged migrations that touch **`Supplier`** and related SRM tables.
- [ ] No known migration failures or missing columns for SRM pages (app boots; 360 does not 500 on Prisma).

#### Seeds and demo data

- [ ] **`demo-company`** tenant exists for demos (e.g. after **`npm run db:seed`** per `docs/database-neon.md`).
- [ ] When **slice 29** lands: idempotent **SRM demo seed** documented and runnable (`package.json` script + short note in `docs/database-neon.md` or here).

#### Manual smoke URLs (copy/paste)

Replace `<supplierId>` with a real id from the list.

| Step | URL / action |
|------|----------------|
| Demo user | **Settings → Demo session** — user with `org.suppliers` **view** (and **edit** for create test). |
| List | `/srm` |
| Search | `/srm?q=test` |
| Onboarding filter | `/srm?onboardingMine=1` (tasks assigned to demo user, incomplete) |
| Kind filter | `/srm?kind=logistics` |
| Create | `/srm/new` |
| 360 | `/srm/<supplierId>` |
| Post–slices | `/srm/analytics` or compliance tab, **inbound integration** `curl` — per **`SRM_FINISH_SLICES.md`** when those slices merge. |

#### Documentation gate (slice 30)

- [ ] **`GAP_MAP.md`** blueprint table: each row **✅** (MVP met) or **⏸** deferred with one-line reason + link.
- [ ] **`SRM_FINISH_SLICES.md`**: all **30** slices merged or explicitly skipped with owner sign-off.

---

## Routes and authorization (repo reality)

| Surface | Path | Grants (typical) | Notes |
|---------|------|------------------|--------|
| SRM partner list | `/srm` | `org.suppliers` → **view** | Query: `kind=` (`product` \| `logistics`, default product), **`q=`** search on name / code / email (case-insensitive contains). Order count column is visible only with `org.orders` → **view**. |
| Create partner | `/srm/new` | `org.suppliers` → **edit** | `kind=` selects default `srmCategory` on create. |
| Supplier 360 | `/srm/[id]` | `org.suppliers` → **view**; **edit** / **approve** for mutations | Uses `loadSupplierDetailSnapshot`; order analytics if `org.orders` → view. |
| Legacy directory | `/suppliers`, `/suppliers/[id]` | Same grants | Alternate list/detail chrome; not deprecated in code. |

---

## Blueprint files (`docs/srm/*.pdf`) ↔ product themes ↔ repo

| Blueprint PDF (filename in repo) | Theme (from title) | Repo reality | Notes |
|----------------------------------|--------------------|--------------|--------|
| `srm_blueprint_and_module_definition_20260417_063215.pdf` | Module definition | 🟡 | SRM hub = supplier master + 360; no separate "SRM platform" modules beyond shared tenant/auth. |
| `srm_functional_prd_20260417_063215.pdf` | Functional PRD | 🟡 | List / create / profile / approvals / capabilities / registered address / commercial fields on `Supplier` + related models. |
| `srm_data_model_and_er_spec_20260417_063215.pdf` | Data model / ER | 🟡 | `Supplier`, `SupplierOffice`, `SupplierContact`, `SupplierServiceCapability`, links to PO / bookings / CT as in Prisma; not every ER relationship exposed in UI. |
| `srm_supplier_lifecycle_and_onboarding_spec_20260417_063215.pdf` | Lifecycle & onboarding | 🟡 | `approvalStatus`, activation, buyer create path; full staged onboarding / portal flows ❌. |
| `srm_workflow_and_business_rules_20260417_063215.pdf` | Workflows & rules | 🟡 | Approval + category split; deep workflow engine / rule builder ❌. |
| `srm_permission_and_visibility_matrix_20260417_063215.pdf` | Permissions matrix | 🟡 | `org.suppliers` view / edit / approve mapped through shared SRM permission resolver; order metrics/history gated by `org.orders` view. Field-level matrix ❌. |
| `srm_ux_ui_design_guideline_and_wireframe_pack_20260417_063215.pdf` | UX / wireframes | 🟡 | Workflow headers, tables, 360 client; pixel parity with pack ❌. |
| `srm_compliance_and_document_control_spec_20260417_063215.pdf` | Compliance & doc control | ❌ | No dedicated document-control vault for SRM yet. |
| `srm_performance_risk_and_kpi_spec_20260417_063215.pdf` | Performance / KPI | ❌ | No SRM KPI dashboard slice yet. |
| `srm_integration_and_api_payload_pack_20260417_063215.pdf` | Integration payloads | ❌ | Supplier CRUD via app + Prisma; no dedicated inbound/outbound payload pack implementation in this vertical. |

---

## `Supplier` and list/detail usage (fields the UI relies on)

| Area | Fields / relations | Where |
|------|---------------------|--------|
| List row | `id`, `name`, `code`, `email`, `phone`, `isActive`, `srmCategory`, `approvalStatus`, `_count.orders` | `src/app/srm/page.tsx` |
| Search filter (server) | `name`, `code`, `email` | `contains` + case-insensitive when `q` present |
| 360 snapshot | Core: `name`, `code`, `email`, `phone`, `isActive`, `srmCategory`, `approvalStatus`, `legalName`, `taxId`, `website`, registered address lines, `paymentTermsDays` / `paymentTermsLabel`, `creditLimit` / `creditCurrency`, `defaultIncoterm`, `internalNotes`, `bookingConfirmationSlaHours`, `offices`, `contacts`, `serviceCapabilities`, counts | `src/lib/srm/load-supplier-detail-snapshot.ts`, `supplier-detail-client` |

Other `Supplier` columns exist in Prisma (e.g. commercial / SLA) and may surface in forms without being repeated here.

---

## Near-term build order (aligned with sprint / backlog themes)

Numbered for engineering slices; refresh when shipped behavior changes.

1. **Hygiene & planning** — Keep this `GAP_MAP` current; link each merged SRM slice PR to the relevant row (see `docs/engineering/agent-todos/srm.md`).
2. **Operator list quality** — **Done in meeting batch:** URL **`q=`** search + no-results state on `/srm` (server-side filter, `kind=` preserved).
3. **Lifecycle / onboarding** — Next steps from `srm_supplier_lifecycle_and_onboarding_spec` (tasks, notifications, staged data capture) as separate issues.
4. **Permissions depth** — In progress: shared SRM grant resolver now gates list/detail and hides order metrics unless `org.orders` → view. Continue with API and field-level guards.
5. **Compliance & documents** — Read-only hooks or attachments from `srm_compliance_and_document_control_spec` before write-heavy vault.
6. **KPI / risk** — One chart or table from `srm_performance_risk_and_kpi_spec` (supplier health, concentration, SLA) scoped to demo data.
7. **Integration pack** — One payload type + tests from `srm_integration_and_api_payload_pack` (inbound or outbound).
8. **Workflow rules** — Explicit validations / transitions from `srm_workflow_and_business_rules` where they exceed today's approval + active flags.

_Last updated: SRM permissions slice (shared resolver + order-metrics visibility), SRM list search (`?q=`), GAP_MAP introduction._

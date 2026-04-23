# SRM — blueprint PDFs ↔ codebase gap map

**Purpose:** Same role as `docs/controltower/GAP_MAP.md` and `docs/wms/GAP_MAP.md`: map each **blueprint filename** under `docs/srm/` to **what exists in this repo** today (routes, grants, Prisma `Supplier` and related reads). Use it for scoping PRs and onboarding; it is **not** a substitute for reading the PDFs.

**Legend:** ✅ covered in repo (at current depth) · 🟡 partial / demo-first · ❌ not wired or intentionally deferred

**Baseline:** The app ships **tenant-scoped supplier master** with **product vs logistics** categories, **SRM list + create + 360** under `/srm`, and shared supplier APIs/components with the legacy `/suppliers` directory. PDFs describe **enterprise** depth (full lifecycle, compliance vault, integration mesh). Treat ❌ as "not here yet," not "ignored."

**Module completion program:** 30 scoped engineering slices through MVP sign-off — see [`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md). Track issue/PR links in a table (slice **1–3** instruct where to add the tracker).

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
